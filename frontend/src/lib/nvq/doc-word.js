// Phân hệ Nhiệm vụ quý BTV: đọc bảng đầu tiên (≥ 7 cột) của tệp Word .docx trong trình duyệt, không thư viện — giải nén bằng bộ đọc ZIP của lib/xlsx-doc.js
// (DecompressionStream), đọc word/document.xml bằng biểu thức chính quy (định dạng máy sinh, ổn định; tiền tố "w:" của thẻ đã bỏ). Mỗi ô → { den, do, tat }:
// chữ màu khác đen (thuộc tính màu chữ của từng đoạn chữ) là chữ đỏ — quy ước chủ trì theo dõi / kết quả đã cập nhật của tệp theo dõi Văn phòng;
// mỗi đoạn văn một dòng. Ô gộp ngang (gridSpan) → thêm null cho các cột bị gộp; ô gộp dọc tiếp nối → null. Đầu ra dùng cho lib/nvq/phu-luc.js.
import { docZip, layTep, boXml } from '../xlsx-doc.js';

export const TOI_DA_BYTE_WORD = 15 * 1024 * 1024;
const loi = (m) => Object.assign(new Error(m), { cuaTa: true });
const DEN = new Set(['000000', 'AUTO', '']);

// Chữ của một đoạn văn: các đoạn chữ (r) → [{ chu, do }]. Tab → khoảng trắng, xuống dòng mềm → khoảng trắng.
function doanChu(pXml) {
  const ra = [];
  for (const m of pXml.matchAll(/<r\b[^>]*>([\s\S]*?)<\/r>/g)) {
    const rXml = m[1];
    const mau = (rXml.match(/<color\b[^>]*\bw:val="([0-9A-Fa-f]{6}|auto)"/) || [])[1] || '';
    const chu = [...rXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<(tab|br|cr)\b[^>]*\/>/g)].map((x) => (x[1] !== undefined ? boXml(x[1]) : x[2] === 'tab' ? ' ' : '\n')).join('');
    if (chu) ra.push({ chu, do: !DEN.has(mau.toUpperCase()) });
  }
  return ra;
}
function oChu(tcXml) {
  const den = []; const dO = []; const tat = [];
  for (const m of tcXml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>|<p\b[^>]*\/>/g)) {
    const ds = m[1] ? doanChu(m[1]) : [];
    const d1 = ds.filter((x) => !x.do).map((x) => x.chu).join('').trim();
    const d2 = ds.filter((x) => x.do).map((x) => x.chu).join('').trim();
    const t = ds.map((x) => x.chu).join('').trim();
    if (d1) den.push(d1);
    if (d2) dO.push(d2);
    if (t) tat.push(t);
  }
  return { den: den.join('\n'), do: dO.join('\n'), tat: tat.join('\n') };
}
// Bảng (chuỗi XML) → [[ô | null]]. Bảng lồng trong ô: bỏ (không có ở mẫu Phụ lục).
export function docBangXml(tblXml) {
  const hang = [];
  for (const tr of tblXml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    const o = [];
    for (const tc of tr[1].matchAll(/<tc\b[^>]*>([\s\S]*?)<\/tc>/g)) {
      const tcPr = (tc[1].match(/<tcPr\b[^>]*>([\s\S]*?)<\/tcPr>/) || [])[1] || '';
      const span = Number((tcPr.match(/<gridSpan\b[^>]*\bw:val="(\d+)"/) || [])[1] || 1);
      const tiepDoc = /<vMerge\b(?![^>]*w:val="restart")[^>]*\/?>/.test(tcPr);
      o.push(tiepDoc ? null : oChu(tc[1]));
      for (let k = 1; k < span; k++) o.push(null);
    }
    hang.push(o);
  }
  return hang;
}
// Các bảng cấp ngoài cùng của tài liệu (XML đã bỏ tiền tố); <tblPr>, <tblGrid> không khớp (\b).
export function cacBang(xml) {
  const ra = []; const re = /<(\/?)tbl\b[^>]*>/g; let sau = 0; let bat = -1; let m;
  while ((m = re.exec(xml))) {
    if (!m[1]) { if (sau === 0) bat = m.index; sau += 1; } else if (sau > 0) { sau -= 1; if (sau === 0) ra.push(xml.slice(bat, re.lastIndex)); }
  }
  return ra;
}
export async function docBangWord(buf) {
  if (!buf || buf.byteLength > TOI_DA_BYTE_WORD) throw loi('Tệp Word quá lớn (tối đa 15 MB).');
  let z;
  try { z = docZip(buf); } catch { throw loi('Không đọc được tệp này — chọn tệp Word .docx (mở bằng Word rồi "Lưu thành" .docx nếu là tệp .doc).'); }
  const xml = await layTep(z, 'word/document.xml');
  if (!xml) throw loi('Tệp không phải văn bản Word .docx.');
  const bang = cacBang(xml).map(docBangXml).filter((b) => b.some((h) => h.length >= 7));
  if (!bang.length) throw loi('Không thấy bảng danh mục (7 cột: Stt, Nhiệm vụ được giao, Lãnh đạo phụ trách, Trục, Đơn vị tham mưu, Kết quả/sản phẩm, Tiến độ) trong tệp.');
  return bang.sort((a, b) => b.length - a.length)[0];
}
