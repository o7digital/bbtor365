const http=require('node:http');
const {randomBytes}=require('node:crypto');
const A=require('../server/auth.cjs');
const handler=require('../server/portal.cjs');
(async()=>{
  if(!process.env.GB_STORE_URL&&!process.env.GB_STORE_PATH)process.env.GB_STORE_PATH=require('node:path').join(__dirname,'../.private/local-workflow.sqlite3');
  if(!process.env.GB_AUTH_CONFIG){
    const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
    process.env.GB_AUTH_CONFIG=JSON.stringify({email:'admin@example.com',name:'Local Administrator',salt,hash:await A.passwordHash(password,salt),secret:randomBytes(32).toString('hex')});
    console.log('Local-only account: admin@example.com\nLocal-only password: '+password);
  }
  const server=http.createServer((req,res)=>handler(req,res).catch(()=>{if(!res.headersSent)res.statusCode=500;res.end('Server error');}));
  server.listen(Number(process.env.PORT||8080),'127.0.0.1',()=>console.log(`GBtoR365: http://127.0.0.1:${server.address().port}`));
})().catch(()=>{console.error('Unable to configure local authentication');process.exitCode=1;});
