const fs=require('node:fs/promises');
const path=require('node:path');
const A=require('./auth.cjs');
const W=require('./workflow.cjs'),S=require('./store.cjs');
const root=path.join(__dirname,'../dist');
const publicFiles=new Map([
  ['/login','login.html'],['/login.html','login.html'],
  ...['login.js','login.css','styles.css','artimex-logo.webp','favicon.svg'].map(f=>['/assets/'+f,'assets/'+f])
]);
const protectedFiles=new Map([
  ['/','index.html'],['/index.html','index.html'],
  ...['session.js','core.js','xlsx-reader.js','app.js','workflow.css'].map(f=>['/assets/'+f,'assets/'+f])
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
async function jsonBody(req,limit=4096){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw Object.assign(Error(),{status:415});
  if(Number(req.headers['content-length'])>limit)throw Object.assign(Error(),{status:413});
  // Vercel's Node runtime may already have parsed the request body.
  if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(raw)>limit)throw Object.assign(Error(),{status:413});return typeof req.body==='string'?JSON.parse(req.body):req.body;}
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw Object.assign(Error(),{status:413});}
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
  if(route.startsWith('/api/')&&!['/api/session','/api/team','/api/login','/api/logout'].includes(route)){
    if(!user)return send(res,401,{error:'unauthorized'});
    if(!['GET','POST'].includes(req.method))return send(res,405,{error:'method'});
    if(req.method==='POST'&&!sameOrigin(req))return send(res,403,{error:'origin'});
    try{
      await W.initialize();
      if(req.method==='GET'&&route==='/api/workspace'){
        const [batches,mappings,events]=await Promise.all([S.command('list',{prefix:'batch:'}),S.command('list',{prefix:'mapping:'}),S.command('events')]);
        return send(res,200,{batches,mappings,events,r365:{ready:false,reason:'R365_TEST_ACCESS_AND_WRITE_API_DOCUMENTATION_REQUIRED'}});
      }
      if(req.method==='GET'&&/^\/api\/mappings\/[a-zA-Z0-9_-]+$/.test(route)){const key='mapping:'+route.split('/').at(-1),entry=(await S.get([key]))[key];return send(res,entry?200:404,entry?{...entry.value,version:entry.version}:{error:'not_found'});}
      if(req.method==='POST'&&route==='/api/mappings')return send(res,200,await W.saveMapping(await jsonBody(req,1024*1024),user));
      if(req.method==='POST'&&route==='/api/batches'){
        const result=await W.upload(await jsonBody(req,3*1024*1024),user);result.batch=W.external(result.batch);return send(res,result.duplicate?200:201,result);
      }
      const match=route.match(/^\/api\/batches\/([a-f0-9-]{36})(?:\/(original|validate|review|approve|export|reprocess|send))?$/);
      if(match){
        const [,id,action]=match;
        if(req.method==='GET'&&!action)return send(res,200,W.external(await W.batch(id)));
        if(req.method==='GET'&&action==='original'){
          const batch=await W.batch(id);res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(batch.name));res.end(Buffer.from(batch.original,'base64'));return;
        }
        if(req.method==='POST'&&action){
          if(action==='send')return send(res,user.permissions.approve?409:403,{error:user.permissions.approve?'r365_not_configured':'forbidden'});
          const result=await W.action(id,action,await jsonBody(req,16384),user);
          if(action==='export'){res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="'+result.filename+'"');res.end(result.csv);return;}
          return send(res,200,result);
        }
      }
      return send(res,404,{error:'not_found'});
    }catch(error){return send(res,error.status||503,{error:error.code||'storage_unavailable',detail:error.detail});}
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
