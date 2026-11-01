const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const A=require('../server/auth.cjs');
const portal=require('../server/portal.cjs');
let config,server,base;
const password='Local-test-password-only-42';
test.before(async()=>{
  const salt=randomBytes(16).toString('hex');
  config={email:'admin@example.com',name:'Test Administrator',salt,hash:await A.passwordHash(password,salt),secret:randomBytes(32).toString('hex')};
  process.env.GB_AUTH_CONFIG=JSON.stringify(config);
  server=http.createServer((req,res)=>portal(req,res).catch(e=>{res.statusCode=500;res.end(e.message);}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{delete process.env.GB_AUTH_CONFIG;await new Promise(resolve=>server.close(resolve));});
const get=(route,options={})=>fetch(base+route,{redirect:'manual',...options});
const post=(route,body,headers={})=>get(route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('unsigned, tampered, expired and password-rotation sessions are refused',()=>{
  const token=A.issue(config,1000);assert.equal(A.verify(token,config,1001).role,'admin');
  assert.equal(A.verify(token.slice(0,-2)+'xx',config,1001),null);
  assert.equal(A.verify(token,config,1000+A.TTL),null);
  assert.equal(A.verify(token,config,999),null);
  assert.equal(A.verify(token,{...config,hash:'a'.repeat(128)},1001),null);
  assert.equal(A.verify(Buffer.from('{"role":"admin"}').toString('base64url'),config),null);
  assert.equal(A.session(`${A.COOKIE}=${token}; ${A.COOKIE}=${token}`,config),null);
});
test('login page is public; dashboard and all accounting code/data require a valid session',async()=>{
  const root=await get('/');assert.equal(root.status,302);assert.equal(root.headers.get('location'),'/login');
  assert.equal((await get('/login')).status,200);
  for(const name of ['sample-data.js','core.js','app.js','xlsx-reader.js','session.js'])assert.equal((await get('/assets/'+name)).status,401);
  assert.equal((await get('/api/session')).status,401);
  for(const route of ['/.env.local','/.private/GBtoR365/dist/assets/sample-data.js','/server/auth.cjs','/../server/auth.cjs'])assert.equal((await get(route)).status,404);
  assert.equal((await get('/api/portal?route=assets/sample-data.js')).status,401);
});
test('credentials are checked on the server and a successful login creates an HttpOnly, bounded session',async()=>{
  assert.equal((await post('/api/login',{email:config.email,password:'wrong'})).status,401);
  const result=await post('/api/login',{email:config.email.toUpperCase(),password});assert.equal(result.status,200);
  const cookie=result.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Max-Age=28800/);
  assert.match(A.cookie(A.issue(config),true),/Secure/);
  const headers={Cookie:cookie.split(';')[0]};
  const session=await get('/api/session',{headers});assert.equal(session.status,200);
  const data=await session.json();assert.equal(data.user.email,config.email);assert.equal(data.user.role,'admin');assert.equal(JSON.stringify(data).includes(config.hash),false);
  assert.equal((await get('/',{headers})).status,200);assert.equal((await get('/assets/sample-data.js',{headers})).status,200);
  const logout=await post('/api/logout',{},headers);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.match(session.headers.get('cache-control'),/no-store/);
});
test('cross-origin login/logout, invalid payloads and unsupported methods are rejected',async()=>{
  assert.equal((await post('/api/login',{email:config.email,password},{Origin:'https://other.example'})).status,403);
  assert.equal((await post('/api/logout',{}, {Origin:'https://other.example'})).status,403);
  assert.equal((await post('/api/login',null)).status,400);
  assert.equal((await post('/api/login',{email:config.email,password},{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post('/api/login',{password:'x'.repeat(5000)})).status,413);
  assert.equal((await get('/api/login')).status,405);
  assert.equal((await get('/api/logout')).status,405);
});
test('missing authentication configuration fails closed and invalid attempts are throttled',async()=>{
  const original=process.env.GB_AUTH_CONFIG;delete process.env.GB_AUTH_CONFIG;
  assert.equal((await post('/api/login',{email:config.email,password})).status,503);
  assert.equal((await get('/assets/sample-data.js')).status,401);process.env.GB_AUTH_CONFIG=original;
  for(let i=0;i<8;i++)await post('/api/login',{email:config.email,password:'wrong'});
  const limited=await post('/api/login',{email:config.email,password});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');
});
