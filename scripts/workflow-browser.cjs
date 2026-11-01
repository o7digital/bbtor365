const http=require('node:http'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {randomBytes}=require('node:crypto'),assert=require('node:assert/strict');
const A=require('../server/auth.cjs'),C=require('../dist/assets/core.js');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gb-browser-'));process.env.GB_STORE_PATH=path.join(tmp,'workflow.sqlite3');
  const accounts=[];
  for(const [i,role] of ['admin','reviewer','preparer','finance','viewer','viewer','viewer'].entries()){
    const email=`test${i}@example.com`,password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex'),record={email,name:`Test User ${i}`,role,salt,hash:await A.passwordHash(password,salt)};
    if(role==='admin')process.env.GB_AUTH_CONFIG=JSON.stringify({...record,secret:randomBytes(32).toString('hex')});else process.env[A.userKey(email)]=JSON.stringify(record);
    accounts.push({email,password,role});
  }
  const handler=require('../server/portal.cjs');const server=http.createServer((req,res)=>handler(req,res).catch(()=>{res.statusCode=500;res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    fs.mkdirSync('artifacts',{recursive:true});const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(20000);
    const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    async function login(p,a){await p.goto(base+'/login');await p.locator('#email').fill(a.email);await p.locator('#password').fill(a.password);await p.locator('#sign-in').click();await p.locator('#main').waitFor();}
    async function nav(view){if(await page.locator('.mobile-menu').isVisible())await page.locator('.mobile-menu').click();await page.locator(`.nav-item[data-nav="${view}"]`).click();await page.locator(`.nav-item[data-nav="${view}"][aria-current="page"]`).waitFor();}
    await login(page,accounts[0]);
    for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});for(const view of ['overview','ap','sales','mapping','activity','r365','team','guide']){await nav(view);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${view} overflow ${width}`);}
      await nav('ap');assert.match(await page.locator('#main').innerText(),/No source report has been uploaded/);await page.screenshot({path:`artifacts/empty-ap-${width}.png`,fullPage:true,animations:'disabled'});
    }
    assert.ok(!requests.some(r=>r.includes('sample-data')));assert.equal((await context.request.get(base+'/assets/sample-data.js')).status(),404);
    await page.setViewportSize({width:1440,height:1000});
    const scope={window:{}};vm.runInNewContext(fs.readFileSync('tests/fixtures-demo.js','utf8'),scope);
    const fixture=scope.window.GB_DATA;
    const ap=process.env.GB_REAL_AP?fs.readFileSync(process.env.GB_REAL_AP):Buffer.from(C.toCSV(C.AP_HEADERS,fixture.ap.rows));
    const je=process.env.GB_REAL_JE?fs.readFileSync(process.env.GB_REAL_JE):Buffer.from(C.toCSV(C.JE_HEADERS,fixture.sales[0].rows));
    async function upload(kind,name,buffer){await nav(kind);await page.locator('[data-action="import"]').first().click();await page.locator('#period-from').fill('2026-10-01');await page.locator('#period-to').fill('2026-10-31');await page.locator('#source-file').setInputFiles({name,mimeType:'text/csv',buffer});await page.locator('[data-action="upload"]').click();await page.locator('#modal').waitFor({state:'hidden'});await page.locator('#records-region').waitFor();}
    await upload('ap','supplier-reference.csv',ap);
    const ws=()=>context.request.get(base+'/api/workspace').then(r=>r.json());let data=await ws();assert.equal(data.batches.total,1);assert.equal(data.batches.items[0].summary.total,process.env.GB_REAL_AP?15672309:998621);const id=data.batches.items[0].id;
    const original=await context.request.get(base+'/api/batches/'+id+'/original');assert.deepEqual(await original.body(),ap);
    await page.reload();await page.locator('#records-region').waitFor();assert.equal((await ws()).batches.total,1);
    await page.locator('[data-action="detail"]').first().click();assert.ok(await page.locator('#modal tbody tr').count());await page.locator('[data-action="close"]').last().click();
    async function approve(){await page.locator('[data-action="validate"]').click();await page.locator('[data-action="approve"]:not([disabled])').waitFor();await page.locator('[data-action="approve"]').click();await page.locator('#approval-confirm').check();await page.locator('[data-action="confirm-approve"]').click();await page.locator('[data-action="export"]').waitFor();}
    await approve();
    async function exportFile(){const next=page.waitForEvent('download');await page.locator('[data-action="export"]').click();const download=await next;const target=path.join(tmp,download.suggestedFilename());await download.saveAs(target);await page.locator('#main').getByText('CSV generated',{exact:true}).first().waitFor();return fs.readFileSync(target,'utf8');}
    const csv=await exportFile();assert.equal(C.parseCSV(csv).rows.length,79);assert.match(csv,process.env.GB_REAL_AP?/00450097JA/:/00000001DM/);
    await upload('ap','same-file-renamed.csv',ap);assert.equal((await ws()).batches.total,1);assert.match(await page.locator('#toast').innerText(),/already stored/);
    await page.locator('[data-action="new-mapping"]').click();await page.locator('#mapping-name').fill('QA prepared source mapping');await page.locator('[data-action="save-mapping"]').click();await page.locator('#modal').waitFor({state:'hidden'});data=await ws();const mapping=data.mappings.items.find(m=>m.name==='QA prepared source mapping');assert.ok(mapping);
    await page.locator('#reprocess-mapping').selectOption(mapping.id);page.once('dialog',d=>d.accept());await page.locator('[data-action="reprocess"]').click();
    await page.locator('[data-action="export"]').waitFor({state:'hidden'});const changed=await (await context.request.get(base+'/api/batches/'+id)).json();assert.equal(changed.approval,null);assert.equal(changed.mappingId,mapping.id);
    await upload('sales','weekly-journal-reference.csv',je);await page.locator('[data-action="validate"]').click();await page.locator('[data-action="review"]').click();
    for(const checkbox of await page.locator('[data-review-code]').all())await checkbox.check();await page.locator('#review-note').fill('Reviewed source signs and period comments; original values retained.');await page.locator('[data-action="save-review"]').click();await page.locator('#modal').waitFor({state:'hidden'});
    await page.locator('[data-action="approve"]:not([disabled])').waitFor();await page.locator('[data-action="approve"]').click();await page.locator('#approval-confirm').check();await page.locator('[data-action="confirm-approve"]').click();await page.locator('[data-action="export"]').waitFor();
    const sales=C.parseCSV(await exportFile()),summary=C.summarizeJE(sales.rows);assert.equal(sales.rows.length,62);assert.equal(summary.difference,0);assert.equal(summary.issues.filter(i=>i.code==='negative').length,2);assert.equal(summary.issues.filter(i=>i.code==='period').length,9);if(process.env.GB_REAL_JE)assert.equal(summary.debit,25870287);
    await nav('activity');assert.match(await page.locator('#main').innerText(),/export_generated/);await page.reload();await page.locator('#main').waitFor();assert.match(await page.locator('#main').innerText(),/export_generated/);
    await page.locator('[data-action="language"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'es');await page.setViewportSize({width:390,height:1000});
    for(const view of ['overview','ap','sales','mapping','activity','r365','team','guide']){await nav(view);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,view+' Spanish overflow');}
    const viewer=await browser.newContext(),vp=await viewer.newPage();await login(vp,accounts[4]);await vp.locator('.nav-item[data-nav="ap"]').click();assert.equal(await vp.locator('[data-action="import"]').isDisabled(),true);
    const denied=await viewer.request.post(base+'/api/batches/'+id+'/approve',{headers:{Origin:base},data:{version:changed.version}});assert.equal(denied.status(),403);
    const send=await context.request.post(base+'/api/batches/'+id+'/send',{headers:{Origin:base},data:{}});assert.equal(send.status(),409);
    assert.deepEqual(errors,[]);await viewer.close();await context.close();
    console.log('Operational workflow browser QA passed: empty workspace, no demo assets, original bytes retained, persistent AP/JE uploads, duplicate rename, mapping reuse, validation/review/approval/export, audit, EN/ES/mobile, read-only restrictions and blocked R365 submission.');
    console.log(process.env.GB_REAL_AP?'Private received accounting files verified locally; none uploaded to production.':'Test-only fixtures were used in a temporary local database.');
  }finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(error=>{console.error(error.name+': '+String(error.message).split('\n')[0]);console.error(String(error.stack).split('\n').find(s=>s.includes('workflow-browser.cjs:'))||'');process.exitCode=1;});
