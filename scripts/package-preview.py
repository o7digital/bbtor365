"""Package the operational application. Its backend is required; no offline demo is produced."""
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parent.parent
out=root/'artifacts'
out.mkdir(exist_ok=True)
legacy=out/'GBtoR365-preview.html'
if legacy.exists(): legacy.unlink()
bundle=out/'GBtoR365_Artimex_Code.zip'
with zipfile.ZipFile(bundle,'w',zipfile.ZIP_DEFLATED) as archive:
    for directory in ['dist','server','api','ops','tests','scripts','docs']:
        for p in sorted((root/directory).rglob('*')):
            if p.is_file() and '__pycache__' not in p.parts and p.suffix not in ['.sqlite3','.db','.pyc']:
                archive.write(p,'GBtoR365/'+p.relative_to(root).as_posix())
    for name in ['README.md','CODEX_BRIEF.md','package.json','.gitignore','vercel.json','.vercelignore']:
        archive.write(root/name,'GBtoR365/'+name)
print(bundle)
