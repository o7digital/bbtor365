(async()=>{
  async function check(){
    const response=await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok){location.replace('/login'+location.hash);return null;}
    return (await response.json()).user;
  }
  try{
    const user=await check();if(!user)return;window.GB_SESSION=user;
    const teamResponse=await fetch('/api/team',{cache:'no-store',credentials:'same-origin'});
    if(!teamResponse.ok)throw Error('Unable to load the team');
    const team=(await teamResponse.json()).users;
    for(const src of ['sample-data.js','core.js','xlsx-reader.js','app.js']){
      if(src==='app.js')window.GB_DATA.users=team.sort((a,b)=>['reviewer','preparer','finance','admin','viewer'].indexOf(a.role)-['reviewer','preparer','finance','admin','viewer'].indexOf(b.role));
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/'+src;script.onload=resolve;script.onerror=reject;document.body.append(script);});
    }
    setInterval(()=>check().catch(()=>{}),60000);
    window.addEventListener('pageshow',event=>{if(event.persisted)check().catch(()=>location.replace('/login'));});
  }catch{document.getElementById('app').textContent='Unable to load the workspace. Please reload. / No se pudo cargar el espacio. Recarga la página.';}
})();
