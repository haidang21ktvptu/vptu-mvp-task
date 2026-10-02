// Tệp .xlsx HƯ CẤU tạo lúc chạy cho spec nhập Excel (không dữ liệu thật, không lưu tệp vào kho): một sheet, ô chữ inlineStr, ô số, ô ngày
// ('YYYY-MM-DD' → số ngày Excel kèm định dạng ngày numFmtId 14), ô gộp. ZIP DEFLATE bằng node:zlib — đủ cho bộ đọc lib/xlsx-doc.js của app.
import { deflateRawSync, crc32 } from 'node:zlib';

function zip(tep) {
  const phan = []; const tt = []; let viTri = 0;
  for (const [ten, noiDung] of tep) {
    const du = Buffer.from(noiDung, 'utf8'); const nen = deflateRawSync(du); const tb = Buffer.from(ten, 'utf8'); const c = crc32(du);
    const dau = Buffer.alloc(30); dau.writeUInt32LE(0x04034b50, 0); dau.writeUInt16LE(20, 4); dau.writeUInt16LE(0x0800, 6); dau.writeUInt16LE(8, 8);
    dau.writeUInt32LE(c, 14); dau.writeUInt32LE(nen.length, 18); dau.writeUInt32LE(du.length, 22); dau.writeUInt16LE(tb.length, 26);
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(c, 16); cd.writeUInt32LE(nen.length, 20); cd.writeUInt32LE(du.length, 24); cd.writeUInt16LE(tb.length, 28); cd.writeUInt32LE(viTri, 42);
    phan.push(dau, tb, nen); tt.push(cd, tb); viTri += 30 + tb.length + nen.length;
  }
  const ket = Buffer.alloc(22); ket.writeUInt32LE(0x06054b50, 0); ket.writeUInt16LE(tep.length, 8); ket.writeUInt16LE(tep.length, 10);
  ket.writeUInt32LE(tt.reduce((s, x) => s + x.length, 0), 12); ket.writeUInt32LE(viTri, 16);
  return Buffer.concat([...phan, ...tt, ket]);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const soNgay = (d) => (Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5;
const tenCot = (i) => (i < 26 ? '' : String.fromCharCode(64 + Math.floor(i / 26))) + String.fromCharCode(65 + (i % 26));
function o(c, r, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') return `<c r="${c}${r}"><v>${v}</v></c>`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `<c r="${c}${r}" s="1"><v>${soNgay(v)}</v></c>`;
  return `<c r="${c}${r}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
}

// dong: { [số dòng Excel]: [giá trị cột A, B, …] }; gop: ['A1:Q1', …] → Buffer .xlsx
export function taoXlsx(tenSheet, dong, gop = []) {
  const rows = Object.entries(dong).map(([r, ds]) => `<row r="${r}">${ds.map((v, i) => o(tenCot(i), r, v)).join('')}</row>`).join('');
  const tron = gop.length ? `<mergeCells count="${gop.length}">${gop.map((g) => `<mergeCell ref="${g}"/>`).join('')}</mergeCells>` : '';
  return zip([
    ['[Content_Types].xml', '<Types/>'],
    ['xl/workbook.xml', `<workbook><sheets><sheet name="${esc(tenSheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'],
    ['xl/styles.xml', '<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>'],
    ['xl/worksheets/sheet1.xml', `<worksheet><sheetData>${rows}</sheetData>${tron}</worksheet>`],
  ]);
}
