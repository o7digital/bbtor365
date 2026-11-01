const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const A=require('../server/auth.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function input(){
  if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});
  console.log('Ready for team test credentials on hidden stdin.');
  try{return await new Promise((resolve,reject)=>{const r=require('node:readline').createInterface({input:process.stdin,terminal:false});r.once('line',line=>{r.close();try{resolve(JSON.parse(line));}catch{reject(Error('Invalid input'));}});});}
  finally{if(process.stdin.isTTY)execFileSync('stty',['echo'],{stdio:'inherit'});}
}
(async()=>{
  let server,accounts;
  if(process.argv.includes('--remote'))accounts=await input();
  else{
    process.env.GB_STORE_PATH=require('node:path').join(require('node:os').tmpdir(),'gb-team-'+randomBytes(8).toString('hex')+'.sqlite3');
    accounts=[];
    for(const [i,role] of ['admin','reviewer','preparer','finance','viewer','viewer','viewer'].entries()){
      const email=`test${i}@example.com`,password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
      const record={email,name:`Test User ${i}`,role,active:true,salt,hash:await A.passwordHash(password,salt)};
      if(role==='admin')process.env.GB_AUTH_CONFIG=JSON.stringify({...record,secret:randomBytes(32).toString('hex')});
      else process.env[A.userKey(email)]=JSON.stringify(record);
      accounts.push({email,password,role});
    }
    const portal=require('../server/portal.cjs');server=http.createServer((req,res)=>portal(req,res).catch(()=>{res.statusCode=500;res.end();}));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));process.env.BASE_URL='http://127.0.0.1:'+server.address().port;
  }
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const account of accounts){
      const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
      page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(process.env.BASE_URL+'/login');await page.locator('#email').fill(account.email);await page.locator('#password').fill(account.password);await page.locator('#sign-in').click();
      await page.locator('#main').waitFor();
      assert.equal(await page.evaluate(()=>window.GB_SESSION.email),account.email);
      assert.equal(await page.evaluate(()=>window.GB_SESSION.role),account.role);
      const session=await (await context.request.get(process.env.BASE_URL+'/api/session')).json();assert.equal(session.user.role,account.role);
      await page.locator('.nav-item[data-nav="ap"]').click();
      assert.equal(await page.locator('[data-action="import"]').first().isDisabled(),!session.user.permissions.prepare);
      await page.locator('.nav-item[data-nav="team"]').click();assert.equal(await page.locator('.user-card').count(),accounts.length);
      assert.equal(await page.locator('[data-action="edit-role"]').count(),0);
      await page.locator('[data-action="profile"]').click();assert.equal(await page.locator('[data-action="choose-profile"]').count(),0);
      assert.match(await page.locator('#modal').innerText(),new RegExp(account.email.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
      await page.locator('[data-action="logout"]').click();await page.waitForURL('**/login');
      assert.equal((await context.request.get(process.env.BASE_URL+'/api/session')).status(),401);assert.deepEqual(errors,[]);
      await context.close();console.log('Account verified: '+account.email+' ('+account.role+')');
    }
    console.log('Team browser QA passed: independent logins, assigned roles, seven real profiles, action permissions and logout.');
  }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
})().catch(error=>{console.error('Team browser QA failed: '+error.name+'; '+String(error.message).split('\n')[0]);console.error(String(error.stack).split('\n').find(line=>line.includes('team-browser.cjs:'))||'');process.exitCode=1;});
