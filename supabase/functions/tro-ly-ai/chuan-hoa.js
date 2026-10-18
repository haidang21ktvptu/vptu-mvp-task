// Chuẩn hoá chữ để đối chiếu kết quả AI với chữ của tệp PDF (v3.25; tách khỏi xac-minh.js ở đợt sửa gộp 18/10/2026 để dùng chung cho đối chiếu theo
// vị trí — van-ban-goc.js — và rà soát sót / trùng — ra-soat.js). Thuần — unit test frontend/tests/tro-ly-ai.test.mjs.

const LN = /[\p{L}\p{N}]/u;
export const chuanTrich = (s) => String(s || '').normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, '');
export const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
// Bỏ dấu GIỮ ĐỘ DÀI (từng ký tự một — chữ Việt NFC bỏ dấu còn đúng một ký tự): vị trí trong chữ không dấu trùng vị trí trong chữ chuẩn hoá.
export function khongDauDeu(s) {
  let r = '';
  for (const c of String(s || '')) { const b = boDau(c); r += b.length === c.length ? b : c; }
  return r;
}
export const coDau = (s) => { const t = String(s || '').normalize('NFC'); return boDau(t) !== t; };
export const laChuSo = (c) => Boolean(c) && LN.test(c);

// Số trang ở chỗ ngắt trang (chủ dự án duyệt 18/10/2026 sau kiểm tay): văn bản của Đảng đánh số trang ở giữa, phía trên đầu trang từ trang 2 → câu
// vắt qua hai trang có số trang chen giữa. Trình duyệt ghép các trang bằng một dòng trống, trong trang không có dòng trống (lib/kl/doc-pdf.js; trang
// trống vẫn giữ thứ tự). Chỉ bỏ dòng NGOÀI CÙNG (đầu hoặc cuối chữ của trang) khi cả dòng chỉ là số của CHÍNH trang đó ("2" ở trang 2, "- 2 -", "(2)",
// "Trang 2", "2/28", "Trang 2/28"). Không bỏ dòng đầu / chân trang khác (rà soát độc lập 18/10: quy tắc "dòng lặp ở mép" làm khớp nhầm câu bỏ sót).
export const laSoTrang = (s, k) => {
  const m = /^[\s\-–—(]*(?:trang|page)?\s*(\d{1,3})(?:\s*\/\s*\d{1,3})?[\s\-–—)]*$/.exec(boDau(String(s)).toLowerCase());
  return Boolean(m) && Number(m[1]) === k;
};
// Các trang đã bỏ số trang ở mép (một trang: giữ nguyên).
export function cacTrang(chu) {
  const trang = String(chu ?? '').split('\n\n');
  if (trang.length < 2) return trang;
  return trang.map((t, i) => {
    const ds = t ? t.split('\n') : [];
    if (ds.length && laSoTrang(ds[0], i + 1)) ds.shift();
    if (ds.length && laSoTrang(ds[ds.length - 1], i + 1)) ds.pop();
    return ds.join('\n');
  });
}
export const boMepTrang = (chu) => (String(chu ?? '').split('\n\n').length < 2 ? String(chu ?? '') : cacTrang(chu).join('\n'));

// Bản đồ ký tự: chữ chuẩn hoá (như chuanTrich) và vị trí trong chữ gốc của từng ký tự chuẩn hoá — để lấy lại NGUYÊN VĂN đoạn khớp.
export function banDo(goc) {
  let chuan = ''; const viTri = [];
  for (let i = 0; i < goc.length;) {
    const c = String.fromCodePoint(goc.codePointAt(i));
    if (LN.test(c)) for (const l of c.toLocaleLowerCase('vi')) { if (LN.test(l)) { chuan += l; for (let k = 0; k < l.length; k++) viTri.push(i); } }
    i += c.length;
  }
  return { chuan, viTri };
}
