const {randomBytes,scrypt,timingSafeEqual,createHmac,createHash}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
const COOKIE='gbtor365_session',TTL=8*60*60;
const ROLES=['admin','reviewer','preparer','finance','viewer'];
const userKey=email=>'GB_USER_'+createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0,16).toUpperCase();
const validUser=u=>u&&typeof u.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)&&typeof u.name==='string'&&u.name.trim()&&/^[a-f0-9]{32}$/.test(u.salt)&&/^[a-f0-9]{128}$/.test(u.hash)&&ROLES.includes(u.role);
const permissions=role=>({prepare:['admin','reviewer','preparer'].includes(role),review:['admin','reviewer','preparer','finance'].includes(role),approve:['admin','reviewer','finance'].includes(role),export:['admin','reviewer','finance'].includes(role),manageUsers:role==='admin'});
function publicUser(u){return {name:u.name,email:u.email,role:u.role,permissions:permissions(u.role),initials:u.name.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase()};}
const users=c=>c.users||[{...c,role:'admin'}];
async function passwordHash(password,salt){return (await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex');}
function config(){
  try {
    const c=JSON.parse(process.env.GB_AUTH_CONFIG||'null');
    if(!c||typeof c.email!=='string'||!c.email.includes('@')||typeof c.name!=='string'||!/^[a-f0-9]{32}$/.test(c.salt)||!/^[a-f0-9]{128}$/.test(c.hash)||!/^[a-f0-9]{64}$/.test(c.secret))return null;
    const admin={...c,email:c.email.trim().toLowerCase(),role:'admin'};
    const accounts=[admin];
    for(const [key,value] of Object.entries(process.env)){
      if(!/^GB_USER_[A-F0-9]{16}$/.test(key))continue;
      const u=JSON.parse(value);if(!validUser(u)||userKey(u.email)!==key)return null;
      const record={...u,email:u.email.trim().toLowerCase()};
      if(accounts.some(a=>a.email===record.email))return null;
      accounts.push(record);
    }
    return {...admin,users:accounts};
  }catch{return null;}
}
const version=c=>createHash('sha256').update(c.email+c.hash+(c.role&&c.role!=='admin'?c.role:'')).digest('hex');
const signature=(payload,c)=>createHmac('sha256',c.secret).update(payload).digest('base64url');
function issue(c,now=Math.floor(Date.now()/1000),account=c){
  const payload=Buffer.from(JSON.stringify({sub:account.email,iat:now,exp:now+TTL,v:version(account),nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+signature(payload,c);
}
function verify(token,c,now=Math.floor(Date.now()/1000)){
  try {
    if(!c||typeof token!=='string'||token.length>2048)return null;
    const parts=token.split('.');if(parts.length!==2)return null;
    const [payload,sig]=parts,expected=signature(payload,c);
    if(sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    const account=users(c).find(u=>u.email===data.sub&&u.active!==false);
    if(!account||data.v!==version(account)||!Number.isInteger(data.iat)||!Number.isInteger(data.exp)||data.iat>now||data.exp<=now||data.exp-data.iat!==TTL)return null;
    return {...publicUser({...account,role:account.role||'admin'}),expiresAt:data.exp*1000};
  }catch{return null;}
}
function session(cookie,c){
  const matches=String(cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));
  return matches.length===1?verify(matches[0].slice(COOKIE.length+1),c):null;
}
function cookie(token,secure=true){return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?TTL:0}${secure?'; Secure':''}`;}
async function credentials(email,password,c){
  if(!c||typeof email!=='string'||typeof password!=='string'||password.length>256||email.length>254)return null;
  const account=users(c).find(u=>u.email===email.trim().toLowerCase()&&u.active!==false);
  const target=account||c,hash=await passwordHash(password,target.salt);
  return timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(target.hash,'hex'))&&account?account:null;
}
module.exports={config,issue,verify,session,cookie,credentials,passwordHash,permissions,publicUser,userKey,users,ROLES,TTL,COOKIE};
