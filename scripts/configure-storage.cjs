// One-time dedicated storage setup. Credentials are accepted only on hidden stdin.
const {execFileSync}=require('node:child_process');
(async()=>{
  if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});
  console.log('Ready for storage configuration on hidden stdin.');
  let value;try{value=await new Promise((resolve,reject)=>{const r=require('node:readline').createInterface({input:process.stdin,terminal:false});r.once('line',line=>{r.close();try{resolve(JSON.parse(line));}catch{reject(Error('Invalid input'));}});});}finally{if(process.stdin.isTTY)execFileSync('stty',['echo'],{stdio:'inherit'});}
  if(!/^[a-f0-9]{64}$/.test(value.token)||!/^[a-f0-9]{64}$/.test(value.hash))throw Error('Invalid storage credential');
  execFileSync('ssh',['-o','BatchMode=yes','o7-vps','docker exec -i gbtor365-store python /app/store.py --token-hash'],{input:value.hash,stdio:['pipe','pipe','pipe']});
  for(const [name,content,sensitive] of [['GB_STORE_URL','https://mail.o7digitalgroup.com/gbtor365-store',false],['GB_STORE_TOKEN',value.token,true]]){
    execFileSync('vercel',['env','add',name,'production,preview','--yes',sensitive?'--sensitive':'--no-sensitive','--scope','olivier-steineur'],{input:content,stdio:['pipe','pipe','pipe']});
    console.log(name+' configured');
  }
})().catch(error=>{console.error('Storage setup failed: '+(error.status?'child command exited with '+error.status:error.message));process.exitCode=1;});
