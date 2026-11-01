// Account records go directly to individual sensitive Vercel variables. No files or emails.
const {randomBytes}=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const A=require('../server/auth.cjs');
const readline=require('node:readline');
(async()=>{
  if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});
  console.log('Ready for account definitions on hidden stdin.');
  let input;try{input=await new Promise((resolve,reject)=>{const r=readline.createInterface({input:process.stdin,terminal:false});r.once('line',line=>{r.close();try{resolve(JSON.parse(line));}catch{reject(Error('Invalid account definitions'));}});});}
  finally{if(process.stdin.isTTY)execFileSync('stty',['echo'],{stdio:'inherit'});}
  if(!Array.isArray(input)||!input.length)throw Error('An account list is required');
  const emails=new Set();
  for(const u of input){if(!u||typeof u.name!=='string'||!u.name.trim()||typeof u.email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email)||!A.ROLES.includes(u.role))throw Error('Invalid name, email or role');u.email=u.email.trim().toLowerCase();if(emails.has(u.email))throw Error('Duplicate account');emails.add(u.email);}
  const listing=spawnSync('vercel',['env','ls','production','--scope','olivier-steineur'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(listing.status!==0)throw Error('Unable to inspect existing account configuration');
  const metadata=listing.stdout+listing.stderr;
  const output=[];
  for(const u of input){
    const key=A.userKey(u.email);
    if(metadata.includes(key)){console.log(JSON.stringify({email:u.email,skipped:true,reason:'Existing credential preserved'}));continue;}
    const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
    const record={name:u.name.trim(),email:u.email,role:u.role,active:true,salt,hash:await A.passwordHash(password,salt)};
    execFileSync('vercel',['env','add',key,'production,preview','--sensitive','--yes','--scope','olivier-steineur'],{input:JSON.stringify(record),stdio:['pipe','pipe','pipe']});
    // Emit each completed account immediately so a later failure cannot lose its initial password.
    console.log(JSON.stringify({name:record.name,email:record.email,role:record.role,password}));
    output.push(record.email);
  }
  console.log(JSON.stringify({completed:true,created:output.length}));
})().catch(error=>{console.error('Account provisioning failed: '+(error.status?'Vercel CLI exited with '+error.status:error.message));process.exitCode=1;});
