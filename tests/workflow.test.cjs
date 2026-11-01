const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createHash}=require('node:crypto');
const W=require('../server/workflow.cjs'),S=require('../server/store.cjs'),A=require('../server/auth.cjs'),C=require('../dist/assets/core.js');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gb-workflow-'));
const actor=role=>({email:role+'@example.com',role,permissions:A.permissions(role)});
const admin=actor('admin'),preparer=actor('preparer'),reviewer=actor('reviewer'),viewer=actor('viewer');
const period={from:'2026-10-01',to:'2026-10-31'};
const row=(number='00001DM',detail='25.00')=>({Type:'AP INVOICE',Location:'TEST70',Vendor:'TEST',Number:number,Date:'10/15/2026','Gl Date':'',Amount:'50.00','Payment Terms':'','Due Date':'',Comment:'test','Detail Account':'55120','Detail Amount':detail,'Detail Location':'TEST70','Detail Comment':'test'});
const source=number=>C.toCSV(C.AP_HEADERS,[row(number),{...row(number),'Detail Account':'55130'}]);
test.before(async()=>{process.env.GB_STORE_PATH=path.join(directory,'workflow.sqlite3');await W.initialize();});
test.after(()=>{delete process.env.GB_STORE_PATH;fs.rmSync(directory,{recursive:true,force:true});});
test('workspace starts with zero batches and only documented mapping templates',async()=>{
 assert.equal((await S.command('list',{prefix:'batch:'})).total,0);assert.equal((await S.command('list',{prefix:'mapping:'})).total,2);
});
test('source bytes, leading zeros and independent invoice controls survive database reload; duplicate rename is idempotent',async()=>{
 const content=source('00001DM');const result=await W.upload({name:'source.csv',contentBase64:Buffer.from(content).toString('base64'),mappingId:'ap-r365',period},preparer);
 const b=result.batch;assert.equal(b.rows[0].Number,'00001DM');assert.equal(b.summary.total,5000);assert.equal(b.summary.lines,2);assert.equal(b.status,'checked');
 const loaded=await W.batch(b.id);assert.equal(Buffer.from(loaded.original,'base64').toString(),content);assert.equal(loaded.sourceHash,createHash('sha256').update(content).digest('hex'));
 const duplicate=await W.upload({name:'renamed.csv',content,mappingId:'ap-r365',period},preparer);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.batch.id,b.id);
 assert.equal((await S.command('list',{prefix:'batch:'})).total,1);
});
test('server roles, validation, approval and export are enforced and audited',async()=>{
 await assert.rejects(W.upload({name:'a.csv',content:source('00002DM'),mappingId:'ap-r365',period},viewer),{status:403});
 let b=(await W.upload({name:'b.csv',content:source('00002DM'),mappingId:'ap-r365',period},preparer)).batch;
 await assert.rejects(W.action(b.id,'export',{version:b.version},reviewer),{code:'approval_required'});
 b=await W.action(b.id,'validate',{version:b.version},preparer);
 await assert.rejects(W.action(b.id,'approve',{version:b.version},preparer),{status:403});
 b=await W.action(b.id,'approve',{version:b.version},reviewer);
 const exported=await W.action(b.id,'export',{version:b.version},reviewer);assert.match(exported.csv,/00002DM/);assert.equal(C.parseCSV(exported.csv).rows.length,2);
 b=await W.batch(b.id);assert.equal(b.status,'exported');assert.equal(b.approval.by,reviewer.email);
 const events=await S.command('events',{batchId:b.id});assert.deepEqual(events.map(e=>e.action),['export_generated','approve','validate','uploaded']);
 await assert.rejects(W.action(b.id,'validate',{version:1},preparer),{code:'conflict'});
});
test('journal exceptions require an explicit recorded review; source signs and comments are retained',async()=>{
 const base={JENumber:'Sales 10/19-10/25',Type:'Standard',Date:'10/19/2026','Reversal Date':'',JEComment:'Sales',JELocation:'TEST70',Account:'12510',DetailLocation:'TEST70',DetailComment:'Import sales 10-12/10-18'};
 const rows=[{...base,Debit:'-12.34',Credit:'0.00'},{...base,Account:'41000',Debit:'0.00',Credit:'-12.34'}];
 let b=(await W.upload({name:'journal.csv',content:C.toCSV(C.JE_HEADERS,rows),mappingId:'sales-r365',period},preparer)).batch;
 b=await W.action(b.id,'validate',{version:b.version},preparer);assert.equal(b.status,'needs_review');
 await assert.rejects(W.action(b.id,'approve',{version:b.version},reviewer),{code:'review_required'});
 b=await W.action(b.id,'review',{version:b.version,codes:['negative','period'],note:'Accounting treatment reviewed; source unchanged.'},reviewer);
 b=await W.action(b.id,'approve',{version:b.version},reviewer);
 const csv=(await W.action(b.id,'export',{version:b.version},reviewer)).csv;assert.match(csv,/-12.34/);assert.match(csv,/Import sales 10-12\/10-18/);
});
test('unknown raw CSV is retained blocked; mapping by header name is saved, reused and versioned without implicit reprocessing',async()=>{
 const content='Invoice,VendorCode,InvoiceDate,InvoiceTotal,AccountCode,LineTotal,Site\n00003DM,TEST,2026-10-15,50.00,0092-55120000,25.00,TEST70\n00003DM,TEST,2026-10-15,50.00,0092-55130000,25.00,TEST70';
 let b=(await W.upload({name:'raw.csv',content,mappingId:'ap-r365',period},preparer)).batch;assert.equal(b.status,'blocked');assert.ok(b.summary.issues.some(i=>i.code==='source_column'));
 const fields=Object.fromEntries(C.AP_HEADERS.map(h=>[h,{constant:''}]));
 Object.assign(fields,{Type:{constant:'AP INVOICE'},Location:{column:'Site'},Vendor:{column:'VendorCode'},Number:{column:'Invoice'},Date:{column:'InvoiceDate',transform:'isoDate'},Amount:{column:'InvoiceTotal'},'Detail Account':{column:'AccountCode',transform:'account0092'},'Detail Amount':{column:'LineTotal'},'Detail Location':{column:'Site'}});
 const mapping=await W.saveMapping({name:'Validated raw CSV',kind:'ap',fields,sourceBatchId:b.id},admin);
 b=await W.action(b.id,'reprocess',{version:b.version,mappingId:mapping.id},preparer);assert.equal(b.status,'checked');assert.equal(b.rows[0]['Detail Account'],'55120');assert.equal(b.rows[0].Number,'00003DM');
 b=await W.action(b.id,'validate',{version:b.version},preparer);b=await W.action(b.id,'approve',{version:b.version},reviewer);
 const mapKey='mapping:'+mapping.id,mapEntry=(await S.get([mapKey]))[mapKey];
 await W.saveMapping({...mapping,version:mapEntry.version,fields,note:'Second version'},admin);
 assert.equal((await W.batch(b.id)).mappingVersion,1);
 b=await W.action(b.id,'reprocess',{version:b.version},preparer);assert.equal(b.mappingVersion,2);assert.equal(b.approval,null);assert.equal(b.validated,null);
 const reordered='Site,LineTotal,InvoiceTotal,AccountCode,VendorCode,InvoiceDate,Invoice\nTEST70,50.00,50.00,0092-55120000,TEST,2026-10-16,00004DM';
 const next=(await W.upload({name:'next.csv',content:reordered,mappingId:mapping.id,period},preparer)).batch;assert.equal(next.summary.total,5000);assert.equal(next.mappingVersion,2);assert.equal(next.rows[0].Number,'00004DM');
 await assert.rejects(W.saveMapping({name:'No',kind:'ap',fields},viewer),{status:403});
});
test('overlapping invoice references are flagged persistently and invalid period/amounts cannot be approved',async()=>{
 let b=(await W.upload({name:'correction.csv',content:source('00001DM').replace('test','different note'),mappingId:'ap-r365',period},preparer)).batch;
 assert.ok(b.summary.issues.some(i=>i.code==='duplicate_document'));
 const bad=(await W.upload({name:'wrong-period.csv',content:source('00005DM'),mappingId:'ap-r365',period:{from:'2026-09-01',to:'2026-09-30'}},preparer)).batch;assert.equal(bad.status,'blocked');
 await assert.rejects(W.action(bad.id,'validate',{version:bad.version},reviewer),{code:'validation_errors'});
 await assert.rejects(W.upload({name:'x.csv',content:'a,b\n1,2',mappingId:'ap-r365',period:{from:'2026-02-30',to:'2026-10-31'}},preparer),{code:'period'});
});
