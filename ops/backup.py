"""Online SQLite backup, with fourteen local daily copies retained."""
from pathlib import Path
from datetime import datetime, timezone
import sqlite3, os
root=Path('/srv/gbtor365-db')
out=root/'backups';out.mkdir(mode=0o700,exist_ok=True)
target=out/(datetime.now(timezone.utc).strftime('%Y-%m-%d')+'.sqlite3')
with sqlite3.connect(root/'gbtor365.sqlite3') as source, sqlite3.connect(target) as dest:
    source.backup(dest)
os.chmod(target,0o600)
for old in sorted(out.glob('*.sqlite3'),reverse=True)[14:]: old.unlink()
