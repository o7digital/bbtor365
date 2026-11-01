const {randomBytes,scrypt,timingSafeEqual,createHmac,createHash}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const COOKIE='gbtor365_session',TTL=8*60*60;
async function passwordHash(password,salt){return (await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex');}
function config(){
  try {
    const c=JSON.parse(process.env.GB_AUTH_CONFIG||'null');
    if(!c||typeof c.email!=='string'||!c.email.includes('@')||typeof c.name!=='string'||!/^[a-f0-9]{32}$/.test(c.salt)||!/^[a-f0-9]{128}$/.test(c.hash)||!/^[a-f0-9]{64}$/.test(c.secret))return null;
    return {...c,email:c.email.trim().toLowerCase()};
  }catch{return null;}
}
const version=c=>createHash('sha256').update(c.email+c.hash).digest('hex');
const signature=(payload,c)=>createHmac('sha256',c.secret).update(payload).digest('base64url');
function issue(c,now=Math.floor(Date.now()/1000)){
  const payload=Buffer.from(JSON.stringify({sub:c.email,iat:now,exp:now+TTL,v:version(c),nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+signature(payload,c);
}
function verify(token,c,now=Math.floor(Date.now()/1000)){
  try {
    if(!c||typeof token!=='string'||token.length>2048)return null;
    const parts=token.split('.');if(parts.length!==2)return null;
    const [payload,sig]=parts,expected=signature(payload,c);
    if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(data.sub!==c.email||data.v!==version(c)||!Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now||data.exp<=now||data.exp-data.iat!==TTL)return null;
    return {name:c.name,email:c.email,role:'admin',initials:c.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase(),expiresAt:data.exp*1000};
  }catch{return null;}
}
function session(cookie,c){
  const matches=String(cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
  return matches.length===1?verify(matches[0].slice(COOKIE.length+1),c):null;
}
function cookie(token,secure=true){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?TTL:0}${secure?'; Secure':''}`;}
async function credentials(email,password,c){
  if(!c||typeof email!=='string'||typeof password!=='string'||password.length>256||email.length>254)return false;
  const hash=await passwordHash(password,c.salt);
  return timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(c.hash,'hex'))&&email.trim().toLowerCase()===c.email;
}
module.exports={config,issue,verify,session,cookie,credentials,passwordHash,TTL,COOKIE};
