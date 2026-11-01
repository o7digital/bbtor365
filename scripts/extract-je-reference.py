"""Extract a received, already-prepared R365 JE worksheet for private regression QA only."""
import csv, sys, zipfile, posixpath
from pathlib import Path
from datetime import datetime,timedelta
from decimal import Decimal,ROUND_HALF_UP
from xml.etree import ElementTree as E
file=Path(sys.argv[1]);out=Path(sys.argv[2]);sheet_name=sys.argv[3] if len(sys.argv)>3 else 'ArtxSales JE 1019-1025'
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(file) as z:
    strings=[]
    if 'xl/sharedStrings.xml' in z.namelist(): strings=[''.join(x.itertext()) for x in E.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',ns)]
    rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    workbook=E.fromstring(z.read('xl/workbook.xml'))
    sheet=next(s for s in workbook.findall('m:sheets/m:sheet',ns) if s.attrib['name']==sheet_name)
    target=rels[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
    target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
    matrix=[]
    for row in E.fromstring(z.read(target)).findall('m:sheetData/m:row',ns):
        cells={}
        for c in row.findall('m:c',ns):
            col=''.join(x for x in c.attrib['r'] if x.isalpha());value=c.findtext('m:v','',ns)
            if c.attrib.get('t')=='s': value=strings[int(value)]
            elif c.attrib.get('t')=='inlineStr': value=''.join(c.find('m:is',ns).itertext())
            cells[col]=value
        matrix.append(cells)
    columns=list('NOPQRSTUVWX');header=next(r for r in matrix if r.get('N')=='JENumber');headers=[header.get(c,'').strip() for c in columns]
    records=[]
    for r in matrix:
        if r.get('O')!='Standard': continue
        data={h:r.get(c,'') for h,c in zip(headers,columns)}
        for h in ['Date','Reversal Date']:
            v=data[h]
            if v and '/' not in v:data[h]=(datetime(1899,12,30)+timedelta(days=int(float(v)))).strftime('%m/%d/%Y')
        for h in ['Debit','Credit']:
            if data[h]: data[h]=str(Decimal(data[h]).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP))
        records.append(data)
out.parent.mkdir(parents=True,exist_ok=True)
with out.open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,headers);w.writeheader();w.writerows(records)
print('Private JE regression reference extracted:',len(records),'rows')
