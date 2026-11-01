const {spawn}=require('node:child_process');
const path=require('node:path');
async function command(op,args={}){
  if(process.env.GB_STORE_URL&&process.env.GB_STORE_TOKEN){
    if(!process.env.GB_STORE_URL.startsWith('https://'))throw Error('Storage requires HTTPS');
    const response=await fetch(process.env.GB_STORE_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.GB_STORE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({op,args}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('Persistent storage unavailable');
    return (await response.json()).result;
  }
  if(process.env.VERCEL==='1'||!process.env.GB_STORE_PATH)throw Error('Persistent storage is not configured');
  return new Promise((resolve,reject)=>{
    const child=spawn('python3',[path.join(__dirname,'../ops/store.py'),'--command'],{env:process.env,stdio:['pipe','pipe','pipe']});
    const output=[];child.stdout.on('data',chunk=>output.push(chunk));child.stderr.resume();child.once('error',reject);
    child.once('close',code=>{if(code!==0)return reject(Error('Local SQLite storage unavailable'));try{resolve(JSON.parse(Buffer.concat(output).toString()));}catch{reject(Error('Invalid storage response'));}});
    child.stdin.end(JSON.stringify({op,args}));
  });
}
const get=async keys=>command('get',{keys});
module.exports={command,get};
