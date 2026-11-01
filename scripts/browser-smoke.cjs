// Optional browser QA: PLAYWRIGHT_MODULE can point to an existing Playwright install.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const C = require('../dist/assets/core.js');
const url = process.env.BASE_URL || 'http://127.0.0.1:8080';
const artifacts = path.join(__dirname,'../artifacts');
async function run(credentials){
  await fs.mkdir(artifacts,{recursive:true});
  execFileSync('python3',[path.join(__dirname,'demo-imports.py')]);
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    page.setDefaultTimeout(12000);
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(url);assert.equal(response.status(),200);
    if(new URL(page.url()).pathname==='/login'){
      const account=credentials||{email:process.env.GB_TEST_EMAIL,password:process.env.GB_TEST_PASSWORD};
      if(!account.email||!account.password)throw Error('Browser QA needs GB_TEST_EMAIL and GB_TEST_PASSWORD for the authenticated portal.');
      await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);await page.locator('#sign-in').click();
    }
    await page.locator('.demo-notice').waitFor();
    const authenticated=await page.evaluate(()=>!!window.GB_SESSION);
    const data=await page.evaluate(()=>window.GB_DATA);
    assert.equal(data.fictional,true);
    const action=name=>page.locator(`[data-action="${name}"]`).last();
    const nav=async name=>{
      if(await page.locator('.mobile-menu').isVisible()) await page.locator('.mobile-menu').click();
      await page.locator(`.nav-item[data-nav="${name}"]`).click();
      await page.locator(`.nav-item[data-nav="${name}"][aria-current="page"]`).waitFor();
    };
    for(const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:1000});
      for(const route of ['overview','ap','sales','mapping','activity','team','guide']) {
        await nav(route);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${route} overflows at ${width}px`);
        if(width===390&&['ap','sales'].includes(route)) await page.screenshot({path:path.join(artifacts,`${route}-390.png`),fullPage:true,animations:'disabled'});
      }
      await nav('overview');
      await page.screenshot({path:path.join(artifacts,`overview-${width}.png`),fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({width:1440,height:1000});
    await action('language').click();assert.equal(await page.locator('html').getAttribute('lang'),'es');
    await page.setViewportSize({width:390,height:844});
    for(const route of ['ap','sales','mapping','activity','team','guide']) {
      await nav(route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${route} overflows in Spanish`);
    }
    await page.reload();await page.locator('.demo-notice').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'es');
    await action('language').click();
    await page.setViewportSize({width:1440,height:1000});
    await nav('ap');
    await page.locator('[data-action="detail"]').first().click();
    assert.equal(await page.locator('#modal tbody tr').count(),4);
    await action('close').click();
    await page.locator('#table-search').fill('00000001DM');
    assert.equal(await page.locator('#records-region tbody tr').count(),1);
    await page.locator('#table-search').fill('');
    await action('page-next').click();assert.match(await page.locator('.table-foot').innerText(),/10–18/);
    await action('page-prev').click();
    await action('validate').click();
    await action('approve').click();
    await page.locator('#approve-confirm').check();
    await action('confirm-approve').click();
    async function downloadPreview(kind){
      const pending=page.waitForEvent('download');await action('export').click();const download=await pending;
      assert.match(download.suggestedFilename(),/PREVIEW/);
      const file=path.join(artifacts,`${kind}-preview.csv`);await download.saveAs(file);
      const csv=await fs.readFile(file,'utf8');await action('close').click();return C.parseCSV(csv);
    }
    const apCSV=await downloadPreview('AP');assert.equal(apCSV.rows.length,79);assert.equal(apCSV.rows[0].Number,'00000001DM');
    await nav('sales');
    assert.equal(await action('approve').isDisabled(),true);
    await action('review').click();assert.equal(await page.locator('[data-review-code]').count(),2);
    for(const checkbox of await page.locator('[data-review-code]').all()) await checkbox.check();
    await action('save-review').click();await action('validate').click();await action('approve').click();
    await page.locator('#approve-confirm').check();await action('confirm-approve').click();
    const salesCSV=await downloadPreview('JE');
    assert.equal(salesCSV.rows.length,62);assert.equal(C.summarizeJE(salesCSV.rows).difference,0);
    assert.equal(C.summarizeJE(salesCSV.rows).issues.filter(i=>i.code==='negative').length,2);
    assert.equal(C.summarizeJE(salesCSV.rows).issues.filter(i=>i.code==='period').length,9);
    await page.locator('#week-select').selectOption('2');
    await action('review').click();assert.equal(await page.locator('[data-review-code="locations"]').count(),1);await action('close').click();
    if(authenticated){
      await action('profile').click();assert.equal(await page.locator('[data-action="choose-profile"]').count(),0);await action('close').click();
    }else{
      await action('profile').click();await page.locator('[data-action="choose-profile"][data-user="1"]').click();
      await action('validate').click();assert.equal(await action('approve').isDisabled(),true);
      await action('profile').click();await page.locator('[data-action="choose-profile"][data-user="0"]').click();
    }
    for(const [extension,delimiter] of [['csv',','],['tsv','\t'],['txt',';']]) {
      await nav('ap');await action('import').click();
      const row={...data.ap.rows[0],Number:`00042${extension}DM`,Amount:'25.50','Detail Amount':'25.50'};
      const csv=C.AP_HEADERS.join(delimiter)+'\n'+C.AP_HEADERS.map(k=>row[k]).join(delimiter);
      const file={name:`fictional.${extension}`,mimeType:'text/plain',buffer:Buffer.from(csv)};
      await page.locator('#upload-file').setInputFiles(file);await action('read-file').click();
      await page.locator('#modal').waitFor({state:'hidden'});
      assert.match(await page.locator('#records-region').innerText(),new RegExp(row.Number));
      assert.equal(await action('approve').isDisabled(),true);
      await action('import').click();await page.locator('#upload-file').setInputFiles(file);await action('read-file').click();
      await page.locator('#modal').waitFor({state:'hidden'});assert.match(await page.locator('#toast').innerText(),/already loaded/);
    }
    await nav('sales');await action('import').click();
    await page.locator('#upload-file').setInputFiles(path.join(artifacts,'fictional-journals.xlsx'));
    await page.locator('#xlsx-sheet').waitFor();assert.equal(await page.locator('#xlsx-sheet option').count(),4);
    await page.locator('#xlsx-sheet').selectOption(data.sales[1].sheet);await action('read-file').click();
    await page.locator('#modal').waitFor({state:'hidden'});
    assert.match(await page.locator('.file-info').innerText(),/56 journal rows/);
    assert.match(await page.locator('#records-region .table-foot').innerText(),/47 records/);
    assert.match(await page.locator('#records-region tbody').innerText(),/00002001DM/);
    await action('import').click();await page.locator('#upload-file').setInputFiles(path.join(artifacts,'fictional-journals.xlsx'));
    await page.locator('#xlsx-sheet').waitFor();await page.locator('#xlsx-sheet').selectOption(data.sales[1].sheet);
    await action('read-file').click();await page.locator('#modal').waitFor({state:'hidden'});
    assert.match(await page.locator('#toast').innerText(),/already loaded/);
    await page.locator('[data-tab="lines"]').click();assert.equal(await page.locator('#records-region tbody tr').count(),9);
    await page.locator('[data-tab="export"]').click();assert.equal(await page.locator('#records-region th').count(),11);
    await nav('ap');await action('import').click();
    await page.locator('#upload-file').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('wrong,columns\n1,2')});
    await action('read-file').click();await page.locator('#upload-error .error-box').waitFor();
    assert.match(await page.locator('#upload-error').innerText(),/Missing columns/);await action('close').click();
    await nav('activity');assert.match(await page.locator('main').innerText(),/Preview downloaded/);
    assert.match(await page.locator('main').innerText(),/Duplicate skipped/);
    await action('reset').click();await action('confirm-reset').click();await nav('activity');
    assert.match(await page.locator('main').innerText(),/Your review starts here/);
    await page.reload();await page.locator('.demo-notice').waitFor();assert.match(await page.locator('main').innerText(),/Your review starts here/);
    await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked')}}));
    await page.reload();await page.locator('.demo-notice').waitFor();await page.locator('.demo-notice').waitFor();
    await action('language').click();assert.equal(await page.locator('html').getAttribute('lang'),'es');
    assert.deepEqual(errors,[]);
    console.log(`Browser QA passed: ${url}; 7 screens, 4 widths, EN/ES, AP/JE review and CSV export, CSV/TSV/TXT/XLSX imports, duplicate rejection, roles and session reset.`);
  } finally {await browser.close();}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
