"""Create an offline HTML preview and a portable source ZIP (standard library only)."""
from pathlib import Path
import base64
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "artifacts"
out.mkdir(parents=True, exist_ok=True)
html = (root / "dist/index.html").read_text()
# The standalone consultation copy remains an explicit offline demo, without a login server.
html = html.replace('<script src="assets/session.js"></script>', ''.join(f'<script src="assets/{name}"></script>' for name in ['sample-data.js', 'core.js', 'xlsx-reader.js', 'app.js']))
css = (root / "dist/assets/styles.css").read_text()
logo = "data:image/webp;base64," + base64.b64encode((root / "dist/assets/artimex-logo.webp").read_bytes()).decode()
html = re.sub(r'<link[^>]+href="assets/styles.css"[^>]*>', lambda _: "<style>" + css + "</style>", html)
favicon = "data:image/svg+xml;base64," + base64.b64encode((root / "dist/assets/favicon.svg").read_bytes()).decode()
html = html.replace("assets/favicon.svg", favicon)
def embed(match):
    src = (root / "dist" / match[1]).read_text().replace("assets/artimex-logo.webp", logo)
    return "<script>" + src.replace("</script", "<\\/script") + "</script>"
html = re.sub(r'<script src="([^"]+)"[^>]*></script>', embed, html)
offline = out / "GBtoR365-preview.html"
offline.write_text(html)
bundle = out / "GBtoR365_Artimex_Code.zip"
with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as z:
    for name in ["dist", "tests", "docs", "scripts", "server", "api"]:
        for p in sorted((root / name).rglob("*")):
            if p.is_file() and '__pycache__' not in p.parts:
                z.write(p, "GBtoR365/" + p.relative_to(root).as_posix())
    for name in ["README.md", "CODEX_BRIEF.md", "package.json", ".gitignore", "vercel.json", ".vercelignore"]:
        z.write(root / name, "GBtoR365/" + name)
    z.write(offline, "GBtoR365/GBtoR365-preview.html")
print(bundle)
