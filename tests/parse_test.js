const fs = require('fs'), path = require('path');
// Eingaben: eigene Dateien über KLEIDERSCHRANK und OUTFITS, sonst die erfundenen Testdaten
const TXT = process.env.KLEIDERSCHRANK || path.join(__dirname, 'fixtures', 'kleiderschrank.txt');
const XLSX = process.env.OUTFITS || path.join(__dirname, 'fixtures', 'outfits.xlsx');
const P = require('../src/parser.js');
(async () => {
  const txt = fs.readFileSync(TXT, 'utf8');
  const items = P.parseWardrobeText(txt);
  console.log('items from txt:', items.length);
  for (const it of items) console.log(String(it.no).padStart(2), '|', it.cat.padEnd(13), '|', (it.brand||'-').padEnd(15), '|', it.colorKey.padEnd(18), '|', it.pattern.padEnd(9), '|', (it.texture||'').padEnd(10), '|', (it.fit||'').padEnd(16), '|', it.material.join('+').padEnd(22), '| f', it.f, 'w', it.w, '|', it.label, '| q', it.qty, it.notes ? '| N: ' + it.notes : '', it.details ? '| D: ' + it.details : '');
  const merged = P.mergeDuplicates(items.map(x => ({...x, nos: [...x.nos]})));
  console.log('merged:', merged.length, merged.filter(m => m.nos.length > 1).map(m => m.label + ' ' + m.nos.join(',')));
  const buf = fs.readFileSync(XLSX);
  const sheets = await P.readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log('sheets:', sheets.map(s => s.name + ' rows=' + s.rows.length));
  const an = P.analyzeSheets(sheets);
  console.log('xlsx items:', an.items.length, 'outfits:', an.outfits.length);
  console.log(an.outfits.slice(0,3));
  // compare xlsx items to txt items
  const diff = an.items.filter((x,i) => JSON.stringify([x.no,x.colorKey,x.cat]) !== JSON.stringify([items[i]?.no, items[i]?.colorKey, items[i]?.cat]));
  console.log('diff count', diff.length);
})();
