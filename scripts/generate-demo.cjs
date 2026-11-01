// Independent fictional data. Never read or transform the supplied accounting extracts.
const fs = require('node:fs');
const C = require('../dist/assets/core.js');
const amount = cents => (cents / 100).toFixed(2);
const ap = {source:'FICTIONAL_DEMO_Vendor_Transactions.csv', headers:C.AP_HEADERS, rows:[]};
for (let i=0; i<39; i++) {
  const count=i===0?4:i===38?1:2;
  const details=Array.from({length:count}, (_,j)=>10000+i*137+j*251);
  for (let j=0; j<count; j++) ap.rows.push({
    Type:'AP INVOICE',Location:'DEMO70',Vendor:`DEMO${String(i%24+1).padStart(3,'0')}`,
    Number:`${String(i+1).padStart(8,'0')}DM`,Date:`10/${String(5+i%12).padStart(2,'0')}/2026`,
    'Gl Date':'',Amount:amount(details.reduce((a,b)=>a+b,0)),'Payment Terms':'','Due Date':'',
    Comment:'FICTIONAL DEMO — not a real invoice','Detail Account':String(55120+j*10),
    'Detail Amount':amount(details[j]),'Detail Location':'DEMO70','Detail Comment':'Synthetic allocation'
  });
}
const sales=[[19,25,53],[12,18,47],[5,11,41],[1,4,21]].map(([start,end,count],week)=>{
  const range=`10/${String(start).padStart(2,'0')}-10/${String(end).padStart(2,'0')}`;
  const sheet=`DEMO Sales JE 10${String(start).padStart(2,'0')}-10${String(end).padStart(2,'0')}`;
  const base={JENumber:`DEMO Sales ${range}`,Type:'Standard',Date:`10/${String(start).padStart(2,'0')}/2026`,
    'Reversal Date':'',JEComment:`FICTIONAL DEMO Sales ${range}`,JELocation:'DEMO70',DetailLocation:'DEMO70'};
  const rows=[],invoices=[],credits=Array(6).fill(0);
  for (let i=0;i<count;i++) {
    const cents=i===count-1?-1234:2000+week*193+i*79;
    const number=`${String((week+1)*1000+i+1).padStart(8,'0')}DM`,account=String(12510+(i%6)*10);
    rows.push({...base,Account:account,Debit:amount(cents),Credit:'0.00',DetailComment:`DEMO Inv.${number}`});
    invoices.push({date:base.Date,customer:`Fictional customer ${i%6+1}`,number,amount:amount(cents),account,sourceRow:i+6});
    if(cents>0)credits[i%6]+=cents;
  }
  credits.forEach((cents,i)=>rows.push({...base,Account:String(41000+i*10),Debit:'0.00',Credit:amount(cents),DetailComment:'FICTIONAL DEMO sales allocation'}));
  rows.push({...base,Account:'41000',Debit:'0.00',Credit:'-12.34',DetailComment:'FICTIONAL DEMO negative entry for review'});
  rows.push({...base,Account:'41000',Debit:'0.00',Credit:'0.00',DetailComment:'FICTIONAL DEMO zero line'});
  rows.push({...base,Account:'41010',Debit:'0.00',Credit:'0.00',DetailComment:'FICTIONAL DEMO zero line'});
  if(week===0) rows.slice(-9).forEach(r=>r.DetailComment='FICTIONAL DEMO Import sales 10-12/10-18');
  if(week===2) rows.forEach((r,i)=>r.JELocation=r.DetailLocation=`DEMO7${i%4}`);
  rows.forEach((r,i)=>r._sourceRow=i+6);
  return {sheet,period:`10${String(start).padStart(2,'0')}-10${String(end).padStart(2,'0')}`,headers:C.JE_HEADERS,rows,invoices};
});
const users=[['Demo Reviewer','reviewer','DR'],['Demo Preparer','preparer','DP'],['Demo Finance','finance','DF'],['Demo Administrator','admin','DA']]
  .map(([name,role,initials])=>({name,role,initials,email:`${role}@example.com`}));
const data={fictional:true,ap,sales,users,sourceWorkbook:'FICTIONAL_DEMO_Sales_Oct_2026.xlsx'};
fs.writeFileSync(require('node:path').join(__dirname,'../tests/fixtures-demo.js'),
  '// FICTIONAL DEMO ONLY. Generated independently of the supplied accounting data.\nwindow.GB_DATA = '+JSON.stringify(data)+';\n');
console.log('Generated fictional AP and sales samples.');
