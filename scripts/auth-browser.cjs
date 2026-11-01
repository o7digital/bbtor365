const http=require('node:http');
const {randomBytes}=require('node:crypto');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const A=require('../server/auth.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function readCredentials(){
  if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});
  console.log('Ready for administrator test credentials on hidden stdin.');
  try{return await new Promise((resolve,reject)=>{
    const readline=require('node:readline').createInterface({input:process.stdin,terminal:false});
    readline.once('line',line=>{readline.close();try{resolve(JSON.parse(line));}catch{reject(Error('Invalid credential input'));}});
  });}finally{if(process.stdin.isTTY)execFileSync('stty',['echo'],{stdio:'inherit'});}
}
(async()=>{
  let server,credentials;
  if(process.argv.includes('--remote'))credentials=await readCredentials();
  else{
    const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
    credentials={email:'admin@example.com',password};
    process.env.GB_STORE_PATH=require('node:path').join(require('node:os').tmpdir(),'gb-auth-'+randomBytes(8).toString('hex')+'.sqlite3');
    process.env.GB_AUTH_CONFIG=JSON.stringify({email:credentials.email,name:'Test Administrator',salt,hash:await A.passwordHash(password,salt),secret:randomBytes(32).toString('hex')});
    const portal=require('../server/portal.cjs');server=http.createServer((req,res)=>portal(req,res).catch(()=>{res.statusCode=500;res.end();}));
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    process.env.BASE_URL='http://127.0.0.1:'+server.address().port;
  }
  const base=process.env.BASE_URL;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    await fs.mkdir('artifacts',{recursive:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    assert.equal((await context.request.get(base+'/assets/core.js')).status(),401);
    await page.goto(base);await page.waitForURL('**/login');
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.screenshot({path:`artifacts/login-${width}.png`,fullPage:true,animations:'disabled'});
    }
    await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('lang'),'es');
    await page.locator('#show-password').click();assert.equal(await page.locator('#password').getAttribute('type'),'text');
    await page.locator('#show-password').click();await page.locator('#language').click();
    await page.locator('#email').fill(credentials.email);await page.locator('#password').fill('invalid-test-password');await page.locator('#sign-in').click();
    await page.locator('#login-error:not(.hide)').waitFor();assert.match(await page.locator('#login-error').innerText(),/incorrect/);
    await page.locator('#password').fill(credentials.password);await page.locator('#sign-in').click();await page.locator('#main').waitFor();
    const cookie=(await context.cookies()).find(c=>c.name===A.COOKIE);assert.ok(cookie);assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'Strict');
    if(base.startsWith('https:'))assert.equal(cookie.secure,true);
    assert.equal(await page.evaluate(()=>document.cookie.includes('gbtor365_session')),false);
    assert.equal(await page.evaluate(()=>window.GB_SESSION.email),credentials.email);
    await page.reload();await page.locator('#main').waitFor();
    assert.equal((await context.request.get(base+'/assets/core.js')).status(),200);
    await page.locator('[data-action="profile"]').click();assert.equal(await page.locator('[data-action="choose-profile"]').count(),0);
    await page.locator('[data-action="logout"]').click();await page.waitForURL('**/login');
    assert.equal((await context.request.get(base+'/api/session')).status(),401);assert.equal((await context.request.get(base+'/assets/core.js')).status(),401);
    const anonymous=await browser.newContext();
    await anonymous.addCookies([{name:A.COOKIE,value:cookie.value.slice(0,-3)+'xxx',url:base}]);
    const denied=await anonymous.newPage();await denied.goto(base);await denied.waitForURL('**/login');await anonymous.close();
    assert.deepEqual(errors,[]);await context.close();console.log('Authentication browser checks passed: login EN/ES, mobile, wrong password, signed session, reload, protected assets, logout and forged cookie.');
    // Accounting processing is covered by test:workflow-browser and workflow integration tests.
  }finally{await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
})().catch(error=>{console.error('Authentication browser QA failed: '+error.name+'; '+String(error.message).split('\n')[0]);console.error(String(error.stack).split('\n').find(line=>line.includes('auth-browser.cjs:'))||'');process.exitCode=1;});
