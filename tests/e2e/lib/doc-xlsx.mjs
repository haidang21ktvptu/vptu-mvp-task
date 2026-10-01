// Đọc tệp .xlsx do app xuất (PR-3 G — lib/xlsx.js ghi ZIP STORE, chuỗi inlineStr): lấy tên sheet và ma trận chữ của từng sheet để spec kiểm
// số dòng và tiêu đề cột. Chỉ hỗ trợ đúng định dạng app ghi (không nén); gặp phương thức nén khác ⇒ báo lỗi rõ.
import { readFileSync } from 'node:fs';

function phanZip(b) {
  const ra = {}; let o = 0;
  while (o + 30 <= b.length && b.readUInt32LE(o) === 0x04034b50) {
    if (b.readUInt16LE(o + 8) !== 0) throw new Error('Tệp xlsx không ở dạng STORE (app ghi không nén).');
    const co = b.readUInt32LE(o + 18); const nTen = b.readUInt16LE(o + 26); const nThem = b.readUInt16LE(o + 28);
    ra[b.subarray(o + 30, o + 30 + nTen).toString('utf8')] = b.subarray(o + 30 + nTen + nThem, o + 30 + nTen + nThem + co).toString('utf8');
    o += 30 + nTen + nThem + co;
  }
  return ra;
}
const boXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// → [{ ten, dong: [[chuỗi ô theo thứ tự cột A, B, …]] }] (ô số / ngày trả chuỗi số).
export function docXlsx(duongDan) {
  const p = phanZip(readFileSync(duongDan));
  const ten = [...(p['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]*)"/g)].map((m) => boXml(m[1]));
  return ten.map((t, i) => {
    const xml = p[`xl/worksheets/sheet${i + 1}.xml`] || '';
    const dong = [...xml.matchAll(/<row [^>]*>(.*?)<\/row>/gs)].map((m) => [...m[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs)]
      .map((c) => boXml((/<t[^>]*>(.*?)<\/t>/s.exec(c[2]) || /<v>(.*?)<\/v>/s.exec(c[2]) || [])[1] || '')));
    return { ten: t, dong };
  });
}
