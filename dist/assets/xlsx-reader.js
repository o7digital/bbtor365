/* Read-only, bounded OOXML reader for the supplied R365 journal layout.
 * This is not a general-purpose Excel engine. Formulas use cached values.
 */
window.GBXlsx = (() => {
  const decoder = new TextDecoder();
  const parse = text => {const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw Error('Invalid worksheet XML');return xml;};
  async function open(file) {
    const buffer=await file.arrayBuffer(), view=new DataView(buffer), bytes=new Uint8Array(buffer);
    if(bytes.length>10*1024*1024)throw Error('Maximum file size is 10 MB');
    let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}
    if(eocd<0)throw Error('Unsupported workbook archive');
    const count=view.getUint16(eocd+10,true);let position=view.getUint32(eocd+16,true),total=0;
    if(count>5000)throw Error('Too many workbook entries');
    const entries=new Map();
    for(let i=0;i<count;i++){
      if(position+46>bytes.length||view.getUint32(position,true)!==0x02014b50)throw Error('Invalid workbook directory');
      const method=view.getUint16(position+10,true), compressed=view.getUint32(position+20,true), size=view.getUint32(position+24,true),nl=view.getUint16(position+28,true),extra=view.getUint16(position+30,true),comment=view.getUint16(position+32,true),offset=view.getUint32(position+42,true);
      const name=decoder.decode(bytes.slice(position+46,position+46+nl));
      total+=size;if(total>100*1024*1024||size>25*1024*1024)throw Error('Workbook expands beyond the preview limit');
      entries.set(name,{method,compressed,size,offset});position+=46+nl+extra+comment;
    }
    async function text(name){
      const e=entries.get(name);if(!e)return '';
      if(e.offset+30>bytes.length||view.getUint32(e.offset,true)!==0x04034b50)throw Error('Invalid workbook entry');
      const start=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);
      if(start+e.compressed>bytes.length)throw Error('Truncated workbook entry');
      const part=bytes.slice(start,start+e.compressed);
      if(e.method===0)return decoder.decode(part);
      if(e.method!==8)throw Error('Unsupported workbook compression');
      let stream;try{stream=new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw Error('This browser cannot read XLSX files. Please use CSV.');}
      const reader=stream.getReader(),chunks=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>e.size+100||length>25*1024*1024){await reader.cancel();throw Error('Workbook entry size is invalid');}chunks.push(value);}
      const result=new Uint8Array(length);let o=0;for(const c of chunks){result.set(c,o);o+=c.length;}return decoder.decode(result);
    }
    const wb=parse(await text('xl/workbook.xml')), rel=parse(await text('xl/_rels/workbook.xml.rels'));
    const map=new Map([...rel.getElementsByTagName('Relationship')].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
    const date1904=wb.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904')==='1';
    const sheets=[...wb.getElementsByTagName('sheet')].map(s=>{const target=map.get(s.getAttribute('r:id'));return {name:s.getAttribute('name'),path:target?.startsWith('/')?target.slice(1):'xl/'+target};});
    let shared=[];
    if(entries.has('xl/sharedStrings.xml'))shared=[...parse(await text('xl/sharedStrings.xml')).getElementsByTagName('si')].map(s=>[...s.getElementsByTagName('t')].map(x=>x.textContent).join(''));
    function excelDate(value){if(!/^\d+(\.\d+)?$/.test(String(value)))return String(value);const n=Number(value);if(n<1||n>100000)return String(value);const dt=new Date((date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30))+Math.floor(n)*86400000);return `${String(dt.getUTCMonth()+1).padStart(2,'0')}/${String(dt.getUTCDate()).padStart(2,'0')}/${dt.getUTCFullYear()}`;}
    async function readSheet(name){
      const sheet=sheets.find(s=>s.name===name);if(!sheet)throw Error('Worksheet not found');
      const doc=parse(await text(sheet.path));const matrix=[];
      for(const row of doc.getElementsByTagName('row')){
        if(matrix.length>20000)throw Error('Preview supports up to 20,000 worksheet rows');
        const values=[];
        for(const cell of row.getElementsByTagName('c')){
          const ref=cell.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0]||'A';let col=0;for(const c of letters)col=col*26+c.charCodeAt(0)-64;col--;
          if(col>200)continue;
          const type=cell.getAttribute('t');let value=cell.getElementsByTagName('v')[0]?.textContent||'';
          if(type==='s')value=shared[Number(value)]??'';
          else if(type==='inlineStr')value=[...cell.getElementsByTagName('t')].map(x=>x.textContent).join('');
          values[col]=value;
        }
        if(values.some(x=>String(x??'').trim()))matrix.push({sourceRow:Number(row.getAttribute('r')),values});
      }
      const headerIndex=matrix.findIndex(r=>r.values.includes('JENumber'));
      if(headerIndex<0)throw Error('Select a journal worksheet with a JENumber column');
      const header=matrix[headerIndex].values, indexes=GBCore.JE_HEADERS.map(k=>header.indexOf(k,header.indexOf('JENumber')));
      if(indexes.some(i=>i<0))throw Error('The R365 journal columns are incomplete');
      const rows=[],invoices=[];
      for(const record of matrix.slice(headerIndex+1)){
        const values=record.values;if(!values[indexes[0]]||values[indexes[1]]!=='Standard')continue;
        const row=Object.fromEntries(GBCore.JE_HEADERS.map((h,i)=>[h,String(values[indexes[i]]??'').trim()]));
        row.Date=excelDate(row.Date);if(row['Reversal Date'])row['Reversal Date']=excelDate(row['Reversal Date']);
        for(const field of ['Debit','Credit'])if(row[field])row[field]=(GBCore.cents(Number(row[field]).toFixed(2))/100).toFixed(2);
        row._sourceRow=record.sourceRow;rows.push(row);
        if(String(values[3]??'').trim())invoices.push({date:excelDate(values[1]),customer:values[2]||'',number:String(values[3]).trim(),amount:Number(values[4]||0).toFixed(2),account:values[5]||'',sourceRow:record.sourceRow});
      }
      if(!rows.length)throw Error('No journal entries found in this worksheet');
      return {rows,invoices,headers:GBCore.JE_HEADERS,sheet:name};
    }
    return {sheets,readSheet};
  }
  return {open};
})();
