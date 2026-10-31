"""Build a small synthetic OOXML workbook for the browser import checks."""
from pathlib import Path
from xml.sax.saxutils import escape
import json
import zipfile

root = Path(__file__).resolve().parent.parent
source = (root / "dist/assets/sample-data.js").read_text()
data = json.loads(source[source.index("{"):source.rindex("}") + 1])
assert data.get("fictional"), "Only fictional fixtures may be packaged"
out = root / "artifacts"
out.mkdir(exist_ok=True)
ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
with zipfile.ZipFile(out / "fictional-journals.xlsx", "w", zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + ''.join(f'<Override PartName="/xl/worksheets/sheet{i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(4)) + '</Types>')
    archive.writestr("_rels/.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="{rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    archive.writestr("xl/workbook.xml", f'<workbook {ns} xmlns:r="{rel}"><sheets>' + ''.join(f'<sheet name="{w["sheet"]}" sheetId="{i+1}" r:id="rId{i+1}"/>' for i, w in enumerate(data['sales'])) + '</sheets></workbook>')
    archive.writestr("xl/_rels/workbook.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(f'<Relationship Id="rId{i+1}" Type="{rel}/worksheet" Target="worksheets/sheet{i+1}.xml"/>' for i in range(4)) + '</Relationships>')
    for i, week in enumerate(data['sales']):
        def record(number, values):
            return f'<row r="{number}">' + ''.join(f'<c r="{column}{number}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>' for column, value in values.items()) + '</row>'
        columns = list('NOPQRSTUVWX')
        rows = [record(5, dict(zip(columns, week['headers'])))]
        for j, row in enumerate(week['rows']):
            values = dict(zip(columns, (row[h] for h in week['headers'])))
            if j < len(week['invoices']):
                invoice = week['invoices'][j]
                values.update(dict(zip('BCDEF', (invoice[k] for k in ['date', 'customer', 'number', 'amount', 'account']))))
            rows.append(record(j+6, values))
        archive.writestr(f'xl/worksheets/sheet{i+1}.xml', f'<worksheet {ns}><sheetData>' + ''.join(rows) + '</sheetData></worksheet>')
print(out / "fictional-journals.xlsx")
