const {execFileSync}=require('node:child_process');
(async()=>{
  if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});console.log('Ready for storage verification on hidden stdin.');
  let c;try{c=await new Promise((resolve,reject)=>{const r=require('node:readline').createInterface({input:process.stdin,terminal:false});r.once('line',line=>{r.close();try{resolve(JSON.parse(line));}catch{reject(Error('Invalid input'));}});});}finally{if(process.stdin.isTTY)execFileSync('stty',['echo'],{stdio:'inherit'});}
  const url='https://mail.o7digitalgroup.com/gbtor365-store';
  async function rpc(op,args={}){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({op,args}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Storage request failed');return (await r.json()).result;}
  const anonymous=await fetch(url,{method:'POST',body:'{}'});if(anonymous.status!==401)throw Error('Storage accepted an anonymous request');
  const key='qa:persistence-check',old=(await rpc('get',{keys:[key]}))[key];
  const marker={at:new Date().toISOString(),purpose:'non-accounting deployment health check'};
  const committed=await rpc('commit',{changes:[{key,expected:old?.version??null,value:marker}]});if(committed.conflict)throw Error('Diagnostic conflict');
  execFileSync('ssh',['-o','BatchMode=yes','o7-vps','docker restart gbtor365-store'],{stdio:['ignore','pipe','pipe']});
  let restored;for(let i=0;i<12;i++){try{restored=(await rpc('get',{keys:[key]}))[key];break;}catch{await new Promise(resolve=>setTimeout(resolve,500));}}
  if(restored?.value.at!==marker.at)throw Error('Persistence verification failed');
  console.log(JSON.stringify({authenticated:true,anonymousDenied:true,persistedAfterContainerRestart:true,batches:(await rpc('list',{prefix:'batch:'})).total,schema:(await rpc('health')).schema}));
})().catch(()=>{console.error('Dedicated storage verification failed.');process.exitCode=1;});
