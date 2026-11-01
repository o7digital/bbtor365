const {createHash,randomUUID}=require('node:crypto');
const C=require('../dist/assets/core.js'),S=require('./store.cjs');
const hash=value=>createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
function problem(status,code,detail){throw Object.assign(Error(code),{status,code,detail});}
const headers=kind=>kind==='ap'?C.AP_HEADERS:C.JE_HEADERS;
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function date(value){if(!ISO.test(value||''))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value;}
const meta=b=>({id:b.id,name:b.name,kind:b.kind,period:b.period,status:b.status,createdAt:b.createdAt,createdBy:b.createdBy,updatedAt:b.updatedAt,mappingId:b.mappingId,mappingVersion:b.mappingVersion,sourceHash:b.sourceHash,rows:b.rows.length,summary:b.summary,approved:b.approval,revision:b.revision});
function basicSummary(kind,rows){
  const sum=kind==='ap'?C.summarizeAP(rows):C.summarizeJE(rows);
  if(sum.groups)sum.groups=sum.groups.map(({rows,...g})=>g);
  return sum;
}
function defaultMapping(kind){
  return {id:kind+'-r365',name:kind==='ap'?'R365 Vendor Transaction by Account · prepared CSV':'R365 Journal Entry · prepared CSV',kind,createdAt:now(),createdBy:'system',versions:[{version:1,at:now(),by:'system',fields:Object.fromEntries(headers(kind).map(h=>[h,{column:h,transform:'identity'}])),filter:null,lookups:{},groupBy:[],note:'Prepared R365 column layout. A raw GlobalBake export requires its own validated mapping.'}]};
}
async function initialize(){
  const items=await S.get(['mapping:ap-r365','mapping:sales-r365']);
  const changes=Object.entries(items).filter(([,v])=>!v).map(([key])=>{const v=defaultMapping(key.includes('ap-')?'ap':'sales');return {key,expected:null,value:v,meta:{id:v.id,name:v.name,kind:v.kind,version:1}};});
  if(changes.length)await S.command('commit',{changes});
}
function transform(value,name){
  if(!name||name==='identity')return value;
  if(name==='account0092')return C.normalizeAccount(value);
  if(name==='isoDate'){if(!date(value))throw Error('Invalid ISO date');return value.slice(5,7)+'/'+value.slice(8,10)+'/'+value.slice(0,4);}
  if(name==='cents')return (C.cents(value)/100).toFixed(2);
  throw Error('Unknown transformation');
}
function apply(parsed,mapping,period){
  const version=mapping.versions.at(-1),issues=[],rows=[];
  const required=new Set(Object.values(version.fields).filter(f=>f.column).map(f=>f.column));if(version.filter?.column)required.add(version.filter.column);
  const missing=[...required].filter(h=>!parsed.headers.includes(h));
  if(missing.length)return {rows,excluded:0,summary:{lines:0,issues:missing.map(field=>({code:'source_column',field,level:'error'}))}};
  let excluded=0;
  for(const [index,source] of parsed.rows.entries()){
    if(version.filter&&source[version.filter.column]!==version.filter.equals){excluded++;continue;}
    const row={_sourceRow:index+2};
    for(const h of headers(mapping.kind)){
      const f=version.fields[h]||{constant:''};
      try{
        let value=f.column?source[f.column]:String(f.constant??'');
        value=transform(value,f.transform);
        if(version.lookups?.[h]){if(!Object.hasOwn(version.lookups[h],value))throw Error('Unknown mapping code');value=version.lookups[h][value];}
        row[h]=String(value);
      }catch{issues.push({code:'transform',field:h,row:index+2,level:'error'});row[h]='';}
    }
    rows.push(row);
  }
  let output=rows;
  if(version.groupBy?.length){
    const groups=new Map(),sums=mapping.kind==='ap'?['Detail Amount']:['Debit','Credit'];
    for(const row of rows){const key=JSON.stringify(version.groupBy.map(h=>row[h]));if(!groups.has(key)){groups.set(key,{...row});continue;}
      const target=groups.get(key);
      for(const h of headers(mapping.kind)){if(sums.includes(h)){try{target[h]=((C.cents(target[h])+C.cents(row[h]))/100).toFixed(2);}catch{issues.push({code:'amount',row:row._sourceRow,field:h,level:'error'});}}else if(target[h]!==row[h])issues.push({code:'group_conflict',field:h,row:row._sourceRow,level:'error'});}
    }
    output=[...groups.values()];
  }
  if(Buffer.byteLength(JSON.stringify(output))>2500000)problem(413,'converted_limit');
  const summary=basicSummary(mapping.kind,output);summary.issues=summary.issues.map(i=>i.row&&!['negative','period'].includes(i.code)?{...i,row:output[i.row-2]?._sourceRow||i.row}:i);summary.issues.push(...issues);
  if(!output.length)summary.issues.push({code:'empty',level:'error'});
  for(const row of output){
    if(mapping.kind==='sales'&&row.Type!=='Standard')summary.issues.push({code:'type',row:row._sourceRow,level:'error'});
    if(C.validDate(row.Date)){const [m,d,y]=row.Date.split('/'),iso=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');if(iso<period.from||iso>period.to)summary.issues.push({code:'period_range',row:row._sourceRow,level:'error'});}
  }
  return {rows:output,excluded,summary};
}
async function load(key){const entry=(await S.get([key]))[key];if(!entry)problem(404,'not_found');return entry;}
function status(b){if(b.summary.issues.some(i=>i.level==='error'))return 'blocked';if(b.approval)return b.exports?.some(e=>e.revision===b.revision)?'exported':'approved';if(!b.validated)return 'checked';const codes=new Set(b.summary.issues.filter(i=>i.level==='review').map(i=>i.code));return [...codes].every(c=>b.review?.codes.includes(c))?'validated':'needs_review';}
async function commitBatch(entry,b,actor,action,detail={},extra=[]){
  b.updatedAt=now();b.status=status(b);
  const result=await S.command('commit',{changes:[{key:'batch:'+b.id,expected:entry?.version??null,value:b,meta:meta(b)},...extra],event:{actor:actor.email,action,batchId:b.id,detail}});
  if(result.conflict)problem(409,'conflict');return {version:result.versions['batch:'+b.id],...b};
}
async function business(b){
  const keys=b.kind==='ap'?(b.summary.groups||[]).map(g=>JSON.stringify([g.location,g.vendor,g.number])):[...new Set(b.rows.map(r=>JSON.stringify([r.JELocation,r.JENumber])))];
  const unique=[...new Set(keys)].map(k=>'business:'+b.kind+':'+hash(k));
  const records=unique.length?await S.get(unique):{},changes=[];
  for(const key of unique){const old=records[key],ids=old?.value.ids||[];
    const others=ids.filter(id=>id!==b.id);if(others.length)b.summary.issues.push({code:'duplicate_document',level:'review',batches:others});
    if(!ids.includes(b.id))changes.push({key,expected:old?.version??null,value:{ids:[...ids,b.id]}});
  }
  return changes;
}
async function upload(input,actor){
  if(!actor.permissions.prepare)problem(403,'forbidden');
  if(typeof input.name!=='string'||!input.name.trim()||input.name.length>200||!/[.]csv$/i.test(input.name))problem(400,'file_format');
  let bytes;
  if(typeof input.contentBase64==='string'){
    if(input.contentBase64.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64))problem(400,'file_format');
    bytes=Buffer.from(input.contentBase64,'base64');if(bytes.toString('base64')!==input.contentBase64)problem(400,'file_format');
  }else if(typeof input.content==='string')bytes=Buffer.from(input.content);else problem(400,'file_format');
  if(bytes.length>2*1024*1024)problem(413,'file_limit');
  let content;try{content=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{problem(400,'encoding');}
  if(content.includes('\0'))problem(400,'encoding');
  if(!date(input.period?.from)||!date(input.period?.to)||input.period.from>input.period.to)problem(400,'period');
  let parsed;try{parsed=C.parseCSV(content);}catch(e){problem(400,'csv',e.message);}
  if(parsed.rows.length>20000||parsed.headers.length>100)problem(413,'file_limit');
  const digest=hash(bytes),finger='fingerprint:'+digest,old=(await S.get([finger]))[finger];
  if(old)return {duplicate:true,batch:await batch(old.value.id)};
  const mapEntry=await load('mapping:'+input.mappingId),mapping=mapEntry.value;
  const result=apply(parsed,mapping,input.period);
  const b={id:randomUUID(),kind:mapping.kind,name:input.name,createdAt:now(),createdBy:actor.email,updatedAt:now(),period:input.period,sourceHash:digest,original:bytes.toString('base64'),sourceHeaders:parsed.headers,sourceRows:parsed.rows.length,mappingId:mapping.id,mappingVersion:mapping.versions.at(-1).version,revision:1,...result,validated:null,review:null,approval:null,exports:[]};
  const extra=await business(b);extra.push({key:finger,expected:null,value:{id:b.id}});
  try{return {duplicate:false,batch:await commitBatch(null,b,actor,'uploaded',{name:b.name,sourceHash:digest,rows:b.sourceRows},extra)};}
  catch(e){if(e.code==='conflict'){const existing=(await S.get([finger]))[finger];if(existing)return {duplicate:true,batch:await batch(existing.value.id)};}throw e;}
}
async function batch(id){const e=await load('batch:'+id);return {...e.value,version:e.version};}
function external(b){const {original,...result}=b;return result;}
async function action(id,action,input,actor){
  const e=await load('batch:'+id),b=e.value;
  const permission={validate:'review',review:'review',approve:'approve',reprocess:'prepare',export:'export'}[action];
  if(!permission||!actor.permissions[permission])problem(403,'forbidden');
  if(input.version!==e.version)problem(409,'conflict');
  let extra=[];
  if(action==='reprocess'){
    const m=(await load('mapping:'+(input.mappingId||b.mappingId))).value,parsed=C.parseCSV(Buffer.from(b.original,'base64').toString());
    if(m.kind!==b.kind)problem(400,'mapping_kind');
    Object.assign(b,apply(parsed,m,b.period),{mappingId:m.id,mappingVersion:m.versions.at(-1).version,revision:b.revision+1,validated:null,review:null,approval:null});extra=await business(b);
  }else{
    if(b.summary.issues.some(i=>i.level==='error'))problem(409,'validation_errors');
    if(action==='validate'){b.validated={by:actor.email,at:now(),revision:b.revision};b.approval=null;}
    if(action==='review'){
      const needed=[...new Set(b.summary.issues.filter(i=>i.level==='review').map(i=>i.code))];
      if(!Array.isArray(input.codes)||needed.some(c=>!input.codes.includes(c))||typeof input.note!=='string'||!input.note.trim()||input.note.length>2000)problem(400,'review_required');
      b.review={by:actor.email,at:now(),codes:needed,note:input.note.trim(),revision:b.revision};b.approval=null;
    }
    if(action==='approve'){
      if(!b.validated||b.validated.revision!==b.revision||!['validated','approved','exported'].includes(status(b)))problem(409,'review_required');
      b.approval={by:actor.email,at:now(),revision:b.revision};
    }
    if(action==='export'){
      if(!b.approval||b.approval.revision!==b.revision)problem(409,'approval_required');
      const csv=C.toCSV(headers(b.kind),b.rows),filename=`GBtoR365_${b.kind.toUpperCase()}_${b.id.slice(0,8)}.csv`;
      b.exports.push({at:now(),by:actor.email,sha256:hash(csv),filename,revision:b.revision});
      await commitBatch(e,b,actor,'export_generated',{filename,sha256:hash(csv)});
      return {csv,filename};
    }
  }
  return external(await commitBatch(e,b,actor,action,action==='review'?{note:b.review.note,codes:b.review.codes}:{revision:b.revision},extra));
}
async function saveMapping(input,actor){
  if(!actor.permissions.manageUsers)problem(403,'forbidden');
  if(!['ap','sales'].includes(input.kind)||typeof input.name!=='string'||!input.name.trim()||input.name.length>120)problem(400,'mapping');
  const fields=input.fields;
  if(!fields||typeof fields!=='object'||headers(input.kind).some(h=>!Object.hasOwn(fields,h)))problem(400,'mapping_fields');
  for(const [target,f] of Object.entries(fields)){if(!headers(input.kind).includes(target)||!f||typeof f!=='object'||(f.column&&typeof f.column!=='string')||!['identity','account0092','isoDate','cents'].includes(f.transform||'identity'))problem(400,'mapping_fields');}
  if(input.filter&&(!input.filter.column||typeof input.filter.equals!=='string'))problem(400,'mapping_filter');
  if(input.lookups&&Object.entries(input.lookups).some(([k,v])=>!headers(input.kind).includes(k)||!v||typeof v!=='object'||Object.values(v).some(x=>typeof x!=='string')))problem(400,'mapping_lookups');
  if(input.groupBy&&(!Array.isArray(input.groupBy)||input.groupBy.some(h=>!headers(input.kind).includes(h))))problem(400,'mapping_groups');
  const id=input.id||randomUUID(),key='mapping:'+id,old=input.id?await load(key):null;
  if(old&&(old.value.kind!==input.kind||old.version!==input.version))problem(409,'conflict');
  const current=old?.value||{id,name:input.name,kind:input.kind,versions:[],createdBy:actor.email,createdAt:now()};
  current.name=input.name.trim();const version=current.versions.length+1;
  const candidate={version,fields,filter:input.filter||null,lookups:input.lookups||{},groupBy:input.groupBy||[],note:String(input.note||'').slice(0,2000),by:actor.email,at:now()};
  if(input.sourceBatchId){const b=await batch(input.sourceBatchId);if(b.kind!==input.kind)problem(400,'mapping_kind');const preview=apply(C.parseCSV(Buffer.from(b.original,'base64').toString()),{...current,versions:[candidate]},b.period);if(preview.summary.issues.some(i=>i.level==='error'))problem(400,'mapping_validation',preview.summary.issues);candidate.validatedAgainst=b.sourceHash;}
  current.versions.push(candidate);
  const result=await S.command('commit',{changes:[{key,expected:old?.version??null,value:current,meta:{id,name:current.name,kind:current.kind,version}}],event:{actor:actor.email,action:'mapping_saved',detail:{mappingId:id,version}}});
  if(result.conflict)problem(409,'conflict');return current;
}
module.exports={initialize,upload,batch,external,action,saveMapping,apply,headers,problem,meta};
