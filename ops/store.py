"""Dedicated GBtoR365 SQLite bridge. No dependencies, no shared EGG Order database."""
import hashlib, hmac, json, os, re, sqlite3, sys
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
DB = os.environ.get('GB_STORE_PATH', '/data/gbtor365.sqlite3')
KEY = re.compile(r'^(batch|mapping|fingerprint|business|qa):[a-zA-Z0-9_.:-]{1,180}$')
@contextmanager
def connect():
    db = sqlite3.connect(DB, timeout=20)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA foreign_keys=ON')
    try:
        with db: yield db
    finally: db.close()
def initialize():
    os.makedirs(os.path.dirname(os.path.abspath(DB)), exist_ok=True)
    with connect() as db:
        db.executescript('''CREATE TABLE IF NOT EXISTS documents(key TEXT PRIMARY KEY, version INTEGER NOT NULL, value TEXT NOT NULL, meta TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_events(id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), actor TEXT NOT NULL, action TEXT NOT NULL, batch_id TEXT, detail TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        INSERT OR IGNORE INTO schema_migrations(version) VALUES(1);''')
def execute(request):
    op, args = request['op'], request.get('args', {})
    with connect() as db:
        if op == 'health': return {'ready':True, 'schema':1}
        if op == 'get':
            keys = args['keys']
            if not isinstance(keys,list) or len(keys)>20000 or any(not KEY.fullmatch(k) for k in keys): raise ValueError()
            result = {}
            for key in keys:
                row=db.execute('SELECT version,value FROM documents WHERE key=?',(key,)).fetchone()
                result[key]={'version':row[0], 'value':json.loads(row[1])} if row else None
            return result
        if op == 'list':
            prefix=args['prefix']
            if prefix not in ('batch:','mapping:'): raise ValueError()
            limit=min(1000,max(1,int(args.get('limit',500))))
            rows=db.execute('SELECT key,version,meta FROM documents WHERE key LIKE ? ORDER BY rowid DESC LIMIT ?',(prefix+'%',limit)).fetchall()
            total=db.execute('SELECT COUNT(*) FROM documents WHERE key LIKE ?',(prefix+'%',)).fetchone()[0]
            return {'items':[{'key':r[0],'version':r[1],**json.loads(r[2])} for r in rows], 'total':total, 'limit':limit}
        if op == 'events':
            batch=args.get('batchId')
            rows=db.execute('SELECT id,at,actor,action,batch_id,detail FROM audit_events '+('WHERE batch_id=? ' if batch else '')+'ORDER BY id DESC LIMIT 1000', (batch,) if batch else ()).fetchall()
            return [{'id':r[0],'at':r[1],'actor':r[2],'action':r[3],'batchId':r[4],'detail':json.loads(r[5])} for r in rows]
        if op == 'commit':
            changes=args['changes']
            if not isinstance(changes,list) or not 1<=len(changes)<=20002 or len({c['key'] for c in changes})!=len(changes): raise ValueError()
            db.execute('BEGIN IMMEDIATE')
            for c in changes:
                if not KEY.fullmatch(c['key']): raise ValueError()
                row=db.execute('SELECT version FROM documents WHERE key=?',(c['key'],)).fetchone()
                if (row[0] if row else None)!=c.get('expected'): return {'conflict':True}
            versions={}
            for c in changes:
                version=(c.get('expected') or 0)+1
                db.execute('INSERT INTO documents(key,version,value,meta) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET version=excluded.version,value=excluded.value,meta=excluded.meta', (c['key'],version,json.dumps(c['value'],ensure_ascii=False),json.dumps(c.get('meta',{}),ensure_ascii=False)))
                versions[c['key']]=version
            event=args.get('event')
            if event:
                db.execute('INSERT INTO audit_events(actor,action,batch_id,detail) VALUES(?,?,?,?)',(event['actor'],event['action'],event.get('batchId'),json.dumps(event.get('detail',{}),ensure_ascii=False)))
            return {'versions':versions}
        raise ValueError()
class Handler(BaseHTTPRequestHandler):
    def reply(self,status,data):
        body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def do_POST(self):
        provided=self.headers.get('Authorization','').removeprefix('Bearer ')
        with connect() as db: row=db.execute("SELECT value FROM settings WHERE key='token_sha256'").fetchone()
        if not row or not hmac.compare_digest(hashlib.sha256(provided.encode()).hexdigest(),row[0]): return self.reply(401,{'error':'Unauthorized'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=16*1024*1024: return self.reply(413,{'error':'Too large'})
            return self.reply(200,{'result':execute(json.loads(self.rfile.read(size)))})
        except (ValueError,TypeError,KeyError,IndexError): self.reply(400,{'error':'Invalid command'})
        except Exception: self.reply(503,{'error':'Storage unavailable'})
    def log_message(self,*args): pass
if __name__=='__main__':
    initialize()
    if '--command' in sys.argv:
        print(json.dumps(execute(json.load(sys.stdin)),ensure_ascii=False))
    elif '--token-hash' in sys.argv:
        digest=sys.stdin.read().strip()
        if not re.fullmatch('[a-f0-9]{64}',digest): raise ValueError('Invalid hash')
        with connect() as db: db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('token_sha256',?)",(digest,))
    else: ThreadingHTTPServer(('0.0.0.0',8080),Handler).serve_forever()
