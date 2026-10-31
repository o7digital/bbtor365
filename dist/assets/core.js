(function (root) {
  'use strict';
  const AP_HEADERS = ['Type','Location','Vendor','Number','Date','Gl Date','Amount','Payment Terms','Due Date','Comment','Detail Account','Detail Amount','Detail Location','Detail Comment'];
  const JE_HEADERS = ['JENumber','Type','Date','Reversal Date','JEComment','JELocation','Account','Debit','Credit','DetailLocation','DetailComment'];
  function cents(value) {
    let s = String(value ?? '').trim().replace(/[$,\s]/g,'');
    if (!s) return 0;
    if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1,-1);
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('Invalid amount: ' + value);
    const negative = s[0] === '-';
    const [whole, fraction=''] = s.replace('-','').split('.');
    let n = Number(whole)*100 + Number((fraction+'00').slice(0,2));
    if (Number(fraction[2] || 0) >= 5) n++;
    if (!Number.isSafeInteger(n)) throw new Error('Amount exceeds supported range');
    return negative ? -n : n;
  }
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/,'');
    const first = text.split(/\r?\n/)[0];
    const delimiter = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ',';
    const matrix=[]; let row=[], cell='', quoted=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
      else if(c===delimiter && !quoted){row.push(cell);cell='';}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))matrix.push(row);row=[];cell='';}
      else cell+=c;
    }
    if(quoted)throw new Error('Unclosed quoted CSV field');
    row.push(cell);if(row.some(v=>v.trim()))matrix.push(row);
    if(matrix.length<2)throw new Error('A header and at least one data row are required');
    const headers=matrix.shift().map(s=>s.trim());
    if(new Set(headers).size!==headers.length)throw new Error('Duplicate column headers');
    const rows=matrix.map((r,i)=>{if(r.length!==headers.length)throw new Error('Column count differs on row '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]));});
    return {headers,rows};
  }
  function validDate(v) {const m=String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(!m)return false;const d=new Date(Date.UTC(+m[3],+m[1]-1,+m[2]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[1]-1&&d.getUTCDate()===+m[2];}
  function summarizeAP(rows) {
    const groups=new Map(), issues=[];
    rows.forEach((r,i)=>{
      for(const k of ['Type','Location','Vendor','Number','Date','Amount','Detail Account','Detail Amount','Detail Location'])if(String(r[k]??'').trim()==='')issues.push({code:'missing',row:i+2,field:k,level:'error'});
      if(r.Type!=='AP INVOICE')issues.push({code:'type',row:i+2,level:'error'});
      if(!validDate(r.Date))issues.push({code:'date',row:i+2,level:'error'});
      if(!/^\d{5}$/.test(String(r['Detail Account'])))issues.push({code:'account',row:i+2,level:'error'});
      let amount=0,detail=0;try{amount=cents(r.Amount);detail=cents(r['Detail Amount']);}catch(e){issues.push({code:'amount',row:i+2,level:'error'});}
      const key=JSON.stringify([r.Location,r.Vendor,r.Number]);
      if(!groups.has(key))groups.set(key,{key,location:r.Location,vendor:r.Vendor,number:r.Number,date:r.Date,amount,detail:0,rows:[],accounts:new Set()});
      const g=groups.get(key);if(g.amount!==amount)issues.push({code:'header',row:i+2,level:'error'});
      g.detail+=detail;g.rows.push(r);g.accounts.add(r['Detail Account']);
    });
    for(const g of groups.values())if(g.amount!==g.detail)issues.push({code:'mismatch',number:g.number,difference:g.detail-g.amount,level:'error'});
    return {groups:[...groups.values()].map(g=>({...g,accounts:[...g.accounts]})),count:groups.size,lines:rows.length,total:[...groups.values()].reduce((n,g)=>n+g.amount,0),vendors:new Set(rows.map(r=>r.Vendor)).size,issues};
  }
  function summarizeJE(rows) {
    const issues=[], accounts=new Set(), groups=new Map();let debit=0,credit=0,activeLines=0;
    for(let i=0;i<rows.length;i++){
      const r=rows[i];let d=0,c=0;
      try{d=cents(r.Debit);c=cents(r.Credit)}catch{issues.push({code:'amount',row:i+2,level:'error'});}
      if(d||c)activeLines++;
      debit+=d;credit+=c;accounts.add(String(r.Account));
      for(const k of ['JENumber','Type','Date','JELocation','Account','DetailLocation'])if(String(r[k]??'').trim()==='')issues.push({code:'missing',row:i+2,field:k,level:'error'});
      if(!validDate(r.Date))issues.push({code:'date',row:i+2,level:'error'});
      if(!/^\d{5}$/.test(String(r.Account)))issues.push({code:'account',row:i+2,level:'error'});
      if(d<0||c<0)issues.push({code:'negative',row:r._sourceRow||i+2,level:'review'});
      const key=String(r.JENumber);if(!groups.has(key))groups.set(key,{debit:0,credit:0});groups.get(key).debit+=d;groups.get(key).credit+=c;
      const m=String(r.JENumber).match(/(\d\d)\/(\d\d)-(\d\d)\/(\d\d)/), t=String(r.DetailComment).match(/Import sales (\d\d)-(\d\d)\/(\d\d)-(\d\d)/i);
      if(m&&t&&m.slice(1).join('')!==t.slice(1).join(''))issues.push({code:'period',row:r._sourceRow||i+2,level:'review'});
    }
    for(const [key,g]of groups)if(g.debit!==g.credit)issues.push({code:'unbalanced',number:key,difference:g.debit-g.credit,level:'error'});
    if(new Set(rows.map(r=>r.JELocation)).size>1)issues.push({code:'locations',level:'review'});
    return {debit,credit,difference:debit-credit,accounts:accounts.size,lines:rows.length,activeLines,issues};
  }
  function toCSV(headers,rows) {
    const escape=v=>{let s=String(v??''); if(/^[=+@\t\r]/.test(s)||(/^\-/.test(s)&&!/^\-\d+(\.\d+)?$/.test(s)))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return '\uFEFF'+[headers.map(escape).join(','),...rows.map(r=>headers.map(h=>escape(r[h.trim()])).join(','))].join('\r\n');
  }
  function normalizeAccount(source){const m=String(source).match(/^0092-(\d{5})000$/);if(!m)throw new Error('No approved sample rule for this account');return m[1];}
  const api={AP_HEADERS,JE_HEADERS,cents,parseCSV,validDate,summarizeAP,summarizeJE,toCSV,normalizeAccount};
  root.GBCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
