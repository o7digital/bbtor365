const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const C = require('../dist/assets/core.js');
const samplePath=process.env.GB_SAMPLE_DATA || require.resolve('./fixtures-demo.js');
const context={window:{}};vm.runInNewContext(fs.readFileSync(samplePath,'utf8'),context);
const data=context.window.GB_DATA;
test('supplied AP sample reconciles at invoice level without double-counting repeated headers',()=>{
 const s=C.summarizeAP(data.ap.rows);assert.equal(s.count,39);assert.equal(s.lines,79);assert.equal(s.vendors,24);assert.equal(s.total,data.fictional?998621:15672309);assert.equal(s.issues.length,0);
});
test('supplied weekly journal balances and preserves accounting exceptions',()=>{
 const s=C.summarizeJE(data.sales[0].rows);assert.equal(s.lines,62);assert.equal(s.activeLines,60);assert.equal(s.debit,data.fictional?207520:25870287);assert.equal(s.credit,data.fictional?207520:25870287);assert.equal(s.difference,0);
 assert.equal(s.issues.filter(i=>i.code==='negative').length,2);assert.equal(s.issues.filter(i=>i.code==='period').length,9);assert.equal(s.issues.filter(i=>i.level==='error').length,0);
});
test('all four supplied journal weeks balance after rounding cached decimals to cents',()=>{for(const w of data.sales)assert.equal(C.summarizeJE(w.rows).difference,0);});
test('CSV parser preserves leading zeros, quoted commas, embedded newlines and escaped quotes',()=>{
 const r=C.parseCSV('Vendor,Number,Amount,Note\r\nDDW00,00450097JA,"1,200.00","A\r\nB ""quote"""');assert.equal(r.rows[0].Number,'00450097JA');assert.equal(r.rows[0].Amount,'1,200.00');assert.equal(r.rows[0].Note,'A\r\nB "quote"');
});
test('malformed CSV columns and unfinished quoted fields are rejected',()=>{assert.throws(()=>C.parseCSV('a,b\n1,2,3'));assert.throws(()=>C.parseCSV('a,b\n1,"abc'));});
test('same invoice number for a different vendor remains a separate invoice',()=>{
 const rows=[{...data.ap.rows[0]},{...data.ap.rows[0],Vendor:'OTHER'}];assert.equal(C.summarizeAP(rows).count,2);
});
test('invoice mismatch cannot disappear in a batch-level total',()=>{
 const groups=C.summarizeAP(data.ap.rows).groups.slice(0,2);
 const rows=groups.flatMap((g,i)=>g.rows.map((r,j)=>({...r,'Detail Amount':j===0?((C.cents(r['Detail Amount'])+(i===0?1:-1))/100).toFixed(2):r['Detail Amount']})));
 const s=C.summarizeAP(rows);assert.equal(s.issues.filter(i=>i.code==='mismatch').length,2);assert.equal(s.groups.reduce((n,g)=>n+g.detail-g.amount,0),0);
});
test('journal numbers balance separately even when the whole batch balances',()=>{
 const base=data.sales[0].rows[0];const rows=[{...base,JENumber:'A',Debit:'10',Credit:'0'},{...base,JENumber:'B',Debit:'0',Credit:'10'}];const s=C.summarizeJE(rows);assert.equal(s.difference,0);assert.equal(s.issues.filter(i=>i.code==='unbalanced').length,2);
});
test('account rule is bounded to the documented prefix and suffix',()=>{assert.equal(C.normalizeAccount('0092-55120000'),'55120');assert.throws(()=>C.normalizeAccount('0093-55120000'));assert.throws(()=>C.normalizeAccount('0092-55120123'));});
test('CSV preview retains source negative values and escapes formula text',()=>{
 const csv=C.toCSV(['Number','Debit','Text'],[{Number:'00450097JA',Debit:'-26.12',Text:'=HYPERLINK("x")'}]);assert.match(csv,/00450097JA/);assert.match(csv,/"-26.12"/);assert.match(csv,/"'=HYPERLINK/);
});
test('dates and currency reject malformed inputs',()=>{assert.equal(C.cents('(1,234.56)'),-123456);assert.equal(C.validDate('02/30/2026'),false);assert.equal(C.validDate('10/19/2026'),true);assert.throws(()=>C.cents('bad'));});
test('invalid journal amounts produce blocking diagnostics instead of throwing during the summary',()=>{
 const row={...data.sales[0].rows[0],Debit:'not an amount',Credit:'0.00'};
 const s=C.summarizeJE([row]);assert.equal(s.activeLines,0);assert.ok(s.issues.some(i=>i.code==='amount'&&i.level==='error'&&i.row===2));
});
