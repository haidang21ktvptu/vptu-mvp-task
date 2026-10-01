// Ghi tệp .xlsx chuẩn OOXML không cần thư viện (PR-3 G): gói ZIP kiểu STORE (không nén) + CRC32, chuỗi ghi thẳng trong ô (inlineStr, không
// sharedStrings), dòng tiêu đề đậm + cố định + bộ lọc tự động, ô ngày là số ngày Excel định dạng dd/mm/yyyy, chữ dài tự xuống dòng.
// Excel, LibreOffice, Google Sheets đều mở được (STORE là phương thức chuẩn của ZIP). Module chỉ nạp khi bấm "Xuất Excel" (import() động).
// Bảo vệ nội dung: escape đủ & < > " ' và bỏ ký tự điều khiển XML 1.0 không cho phép (giữ tab, xuống dòng); tên sheet ≤ 31 ký tự, không [ ] : * ? / \.

const enc = new TextEncoder();
const BANG_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = BANG_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ZIP STORE: [đầu tệp cục bộ + dữ liệu]… + thư mục trung tâm + bản ghi kết thúc. Thời gian tệp cố định (1/1/2026) — không ảnh hưởng nội dung.
function zip(tep) {
  const phan = []; const tt = []; let viTri = 0;
  for (const { ten, du } of tep) {
    const tenB = enc.encode(ten); const crc = crc32(du);
    const dau = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x5C21, 2], [14, crc, 4], [18, du.length, 4], [22, du.length, 4], [26, tenB.length, 2], [28, 0, 2]]
      .forEach(([o, v, n]) => (n === 4 ? dau.setUint32(o, v, true) : dau.setUint16(o, v, true)));
    const cd = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x5C21, 2], [16, crc, 4], [20, du.length, 4], [24, du.length, 4],
      [28, tenB.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, viTri, 4]]
      .forEach(([o, v, n]) => (n === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true)));
    phan.push(new Uint8Array(dau.buffer), tenB, du); tt.push(new Uint8Array(cd.buffer), tenB);
    viTri += 30 + tenB.length + du.length;
  }
  const coTt = tt.reduce((s, x) => s + x.length, 0);
  const ket = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, tep.length, 2], [10, tep.length, 2], [12, coTt, 4], [16, viTri, 4], [20, 0, 2]]
    .forEach(([o, v, n]) => (n === 4 ? ket.setUint32(o, v, true) : ket.setUint16(o, v, true)));
  const tatCa = [...phan, ...tt, new Uint8Array(ket.buffer)];
  const out = new Uint8Array(tatCa.reduce((s, x) => s + x.length, 0)); let o = 0;
  tatCa.forEach((x) => { out.set(x, o); o += x.length; });
  return out;
}

// Ký tự XML 1.0 hợp lệ: tab, LF, CR, U+0020–U+D7FF, U+E000–U+FFFD, cặp surrogate đủ đôi. Còn lại bỏ.
export const xmlChu = (s) => String(s ?? '')
  .replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')   // cờ u: cặp surrogate = một ký tự; surrogate lẻ bị bỏ
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
// Tên sheet: bỏ ký tự cấm, ≤ 31 ký tự, không trùng (thêm " (2)"…).
export function tenSheet(ten, daCo = new Set()) {
  const goc = String(ten || 'Trang').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Trang';
  let t = goc; let i = 2;
  while (daCo.has(t.toLowerCase())) { const duoi = ` (${i++})`; t = goc.slice(0, 31 - duoi.length) + duoi; }
  daCo.add(t.toLowerCase());
  return t;
}
const chuCot = (i) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const soNgayExcel = (d) => { const m = NGAY.exec(d); return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000; };

// Một ô: kieu 'ngay' + 'YYYY-MM-DD' → số ngày (kiểu 2); số → n; còn lại → chuỗi (kiểu 3: xuống dòng). Rỗng → bỏ ô.
function oXml(v, ref, kieu) {
  if (v === null || v === undefined || v === '') return '';
  if (kieu === 'ngay' && NGAY.test(String(v))) return `<c r="${ref}" s="2"><v>${soNgayExcel(String(v))}</v></c>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr" s="3"><is><t xml:space="preserve">${xmlChu(v)}</t></is></c>`;
}
function sheetXml({ cot, dong }) {
  const cuoi = chuCot(Math.max(cot.length - 1, 0));
  const dau = `<row r="1">${cot.map((c, i) => `<c r="${chuCot(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${xmlChu(c.nhan)}</t></is></c>`).join('')}</row>`;
  const than = dong.map((d, j) => `<row r="${j + 2}">${cot.map((c, i) => oXml(d[i], `${chuCot(i)}${j + 2}`, c.kieu)).join('')}</row>`).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${cot.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.rong || 14}" customWidth="1"/>`).join('')}</cols>`
    + `<sheetData>${dau}${than}</sheetData>${dong.length ? `<autoFilter ref="A1:${cuoi}${dong.length + 1}"/>` : ''}</worksheet>`;
}
const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

// sheets: [{ ten, cot: [{ nhan, rong?, kieu?: 'ngay' }], dong: [[giá trị theo cột]] }] → Uint8Array (.xlsx).
export function taoXlsx(sheets) {
  const daCo = new Set(); const ds = sheets.map((s) => ({ ...s, ten: tenSheet(s.ten, daCo) }));
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const tep = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + ds.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>'],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${ns}"><sheets>`
      + ds.map((s, i) => `<sheet name="${xmlChu(s.ten)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + ds.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${ns}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${ds.length + 1}" Type="${ns}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', STYLES],
    ...ds.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(tep.map(([ten, xml]) => ({ ten, du: enc.encode(xml) })));
}

// Tải tệp về máy (Blob + thẻ a[download]); thu hồi URL sau khi bấm.
export function taiXuong(tenTep, bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = tenTep; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
