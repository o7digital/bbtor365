const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'../dist');
assert.equal(fs.existsSync(path.join(root,'assets/sample-data.js')),false,'Sample accounting records must not be deployed');
const files=fs.readdirSync(path.join(root,'assets'));assert.ok(!files.some(f=>/\.(csv|xlsx|sqlite3?)$/i.test(f)),'Accounting files belong in private server storage');
const scripts=['session.js','app.js'].map(f=>fs.readFileSync(path.join(root,'assets',f),'utf8')).join('\n');
assert.doesNotMatch(scripts,/GB_DATA|FICTIONAL_DEMO|sample-data\.js|use-sample|confirm-reset/);
console.log('Deployment check passed: no demo records or source files in the served assets.');
