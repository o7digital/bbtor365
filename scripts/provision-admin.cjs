// Set a hashed administrator credential directly in Vercel, never in repository files.
const {randomBytes}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const A=require('../server/auth.cjs');
(async()=>{
  const [email,name]=process.argv.slice(2);
  if(!email||!email.includes('@')||!name)throw Error('Usage: node scripts/provision-admin.cjs <email> <name>');
  const password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');
  const config={email:email.trim().toLowerCase(),name,salt,hash:await A.passwordHash(password,salt),secret:randomBytes(32).toString('hex')};
  execFileSync('vercel',['env','add','GB_AUTH_CONFIG','production,preview','--sensitive','--yes','--scope','olivier-steineur'],{input:JSON.stringify(config),stdio:['pipe','pipe','pipe']});
  // Output once to the administrator's terminal. No password is written to disk.
  console.log(JSON.stringify({email:config.email,password}));
})().catch(error=>{console.error('Administrator setup failed: '+(error.status?'Vercel CLI exited with '+error.status:error.message));process.exitCode=1;});
