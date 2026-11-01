const fs=require('node:fs/promises');
const path=require('node:path');
const A=require('./auth.cjs');
const root=path.join(__dirname,'../dist');
const publicFiles=new Map([
  ['/login','login.html'],['/login.html','login.html'],
  ...['login.js','login.css','styles.css','artimex-logo.webp','favicon.svg'].map(f=>['/assets/'+f,'assets/'+f])
]);
const protectedFiles=new Map([
  ['/','index.html'],['/index.html','index.html'],
  ...['session.js','sample-data.js','core.js','xlsx-reader.js','app.js'].map(f=>['/assets/'+f,'assets/'+f])
]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
// Per-instance protection; a managed identity service remains the next step for team accounts.
const attempts=new Map();let hashing=0;
function limited(ip){
  const now=Date.now();for(const [key,item] of attempts)if(item.until<now)attempts.delete(key);
  const item=attempts.get(ip);return item&&item.count>=8;
}
function failed(ip){if(attempts.size>=512&&!attempts.has(ip))attempts.delete(attempts.keys().next().value);const item=attempts.get(ip)||{count:0,until:Date.now()+15*60*1000};item.count++;attempts.set(ip,item);}
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));}
function redirect(res,to){res.statusCode=302;res.setHeader('Location',to);res.end();}
function sameOrigin(req){try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
async function jsonBody(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Object.assign(Error(),{status:415});
  if(Number(req.headers['content-length'])>4096)throw Object.assign(Error(),{status:413});
  // Vercel's Node runtime may already have parsed the request body.
  if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>4096)throw Object.assign(Error(),{status:413});return typeof req.body==='string'?JSON.parse(req.body):req.body;}
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)throw Object.assign(Error(),{status:413});}
  return JSON.parse(raw);
}
module.exports=async function portal(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const url=new URL(req.url,'http://localhost');
  // Every Vercel route targets this handler. Query selection cannot bypass the access checks below.
  const selected=req.query?.route??url.searchParams.get('route');
  const route=selected===null||selected===undefined?url.pathname:'/'+String(selected).replace(/^\//,'');
  const c=A.config(),user=A.session(req.headers.cookie,c);
  const secure=process.env.VERCEL==='1';
  if(route==='/api/login'||route==='/api/logout'){
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'method'});}
    if(!sameOrigin(req))return send(res,403,{error:'origin'});
    if(route==='/api/logout'){res.setHeader('Set-Cookie',A.cookie('',secure));return send(res,200,{ok:true});}
    if(!c)return send(res,503,{error:'unavailable'});
    const ip=String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown');
    if(limited(ip)||hashing>=4){res.setHeader('Retry-After','900');return send(res,429,{error:'rate_limit'});}
    let body;try{body=await jsonBody(req);}catch(e){return send(res,e.status||400,{error:'request'});}
    if(!body||typeof body!=='object')return send(res,400,{error:'request'});
    let valid=false;hashing++;try{valid=await A.credentials(body.email,body.password,c);}finally{hashing--;}
    if(!valid){failed(ip);return send(res,401,{error:'credentials'});}
    attempts.delete(ip);res.setHeader('Set-Cookie',A.cookie(A.issue(c,undefined,valid),secure));return send(res,200,{ok:true});
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return send(res,405,{error:'method'});}
  if(route==='/api/session')return send(res,user?200:401,user?{user}:{error:'unauthorized'});
  if(route==='/api/team')return send(res,user?200:401,user?{users:A.users(c).filter(u=>u.active!==false).map(A.publicUser)}:{error:'unauthorized'});
  const file=publicFiles.get(route)||protectedFiles.get(route);
  if(!file)return send(res,404,{error:'not_found'});
  if(protectedFiles.has(route)&&!user){
    if(route==='/'||route==='/index.html')return redirect(res,'/login');
    return send(res,401,{error:'unauthorized'});
  }
  if((route==='/login'||route==='/login.html')&&user)return redirect(res,'/');
  try{
    const content=await fs.readFile(path.join(root,file));res.statusCode=200;
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Content-Length',content.length);res.end(req.method==='HEAD'?undefined:content);
  }catch{return send(res,404,{error:'not_found'});}
};
