// Đối chiếu THEO VỊ TRÍ trong chữ của tệp (v3.25 — đợt sửa gộp 18/10/2026, chủ dự án: "dùng AI đọc văn bản để đề xuất nhiệm vụ cần phải hiểu văn bản
// và tách nhiệm vụ chính xác nhất có thể"). Chữ gốc = các trang đã bỏ số trang ở mép (chuan-hoa.js cacTrang), gộp khoảng trắng, ghép bằng một dòng; bản đồ
// ký tự cho biết đoạn khớp nằm ở đâu → (1) điền NGUYÊN VĂN chữ của tệp thay chữ AI chép (AI đổi "12%" thành "1,2%", đổi dấu — so bỏ dấu câu vẫn khớp);
// (2) đoạn phải bắt đầu, kết thúc ở ranh giới từ, và biết câu trong văn bản còn tiếp hay không; (3) hạn, đơn vị phối hợp, mô tả sản phẩm phải nằm trong
// chính nhiệm vụ (hoặc câu thời hạn / sản phẩm ngay sau). Phần đầu trang 1: dau-van-ban.js. Thuần — unit test frontend/tests/tro-ly-ai-doi-chieu.test.mjs.
import { chuanTrich, khongDauDeu, coDau, laChuSo, cacTrang, banDo } from './chuan-hoa.js';

export const MUC = '(?:[-+•*–—]|\\(?\\d{1,3}(?:\\.\\d{1,3})*[.)]|\\(?[a-zđ][.)]|[IVX]{1,5}\\.)';
const MUC_DONG = new RegExp(`^(${MUC}) (?=[\\p{L}(“"])`, 'u');
const MUC_GIUA = new RegExp(`[:;] (${MUC}) (?=[\\p{L}(“"])`, 'gu');
// Ký hiệu đầu ý THẬT (a), 1., 2.1., -, +): đầu dòng mà dòng trước đã hết câu (. ; : ! ?) hoặc là dòng ngắn (tiêu đề mục), hoặc sau ": " / "; " cùng dòng;
// sau ký hiệu là chữ. Không tính "điểm\nb) khoản 2", "giai đoạn 2026\n- 2030", "1.500 tỷ" (rà soát độc lập 18/10).
function cacMuc(text) {
  const ds = []; let o = 0; let truocDong = null;
  for (const dong of text.split('\n')) {
    const m = MUC_DONG.exec(dong);
    if (m && (truocDong === null || /[.;:!?][)\]”"’»]*$/.test(truocDong) || truocDong.length <= 60)) ds.push([o, o + m[1].length]);
    for (const g of dong.matchAll(MUC_GIUA)) { const a = o + g.index + 2; ds.push([a, a + g[1].length]); }
    o += dong.length + 1; truocDong = dong;
  }
  return ds.sort((x, y) => x[0] - y[0]);
}
export function taoGoc(chu) {
  const trang = cacTrang(String(chu ?? '').normalize('NFC'))
    .map((t) => t.replace(/[^\S\n]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim());   // gộp khoảng trắng: biểu thức chính quy tuyến tính
  const text = trang.join('\n'); const dauTrang = []; let o = 0;
  trang.forEach((t) => { dauTrang.push(o); o += t.length + 1; });
  const { chuan, viTri } = banDo(text);
  const muc = cacMuc(text); const bo = new Set(); muc.forEach(([a, b]) => { for (let k = a; k < b; k++) bo.add(k); });
  let kc = ''; const kv = [];   // bản bỏ ký hiệu đầu ý: AI chép nội dung gồm nhiều ý thường bỏ các ký hiệu ở giữa
  for (let i = 0; i < chuan.length; i++) if (!bo.has(viTri[i])) { kc += chuan[i]; kv.push(viTri[i]); }
  return { text, dauTrang, trang1: trang[0] || '', chuan, viTri, khongDau: khongDauDeu(chuan), co: chuan.length > 0, muc, dauMuc: new Set(muc.map(([a]) => a)),
    km: { chuan: kc, viTri: kv, khongDau: khongDauDeu(kc) }, nho: new Map() };
}
export const trangCua = (goc, a) => { let p = 0; while (p + 1 < goc.dauTrang.length && goc.dauTrang[p + 1] <= a) p += 1; return p + 1; };
const cuoi = (goc, k, vt = goc.viTri) => vt[k] + (goc.text.codePointAt(vt[k]) > 0xffff ? 2 : 1);
const truoc = (t, a) => (a > 0 ? String.fromCodePoint(t.codePointAt(a - 1 - (a > 1 && /[\uDC00-\uDFFF]/.test(t[a - 1]) ? 1 : 0))) : '');
const tai = (t, a) => (a < t.length ? String.fromCodePoint(t.codePointAt(a)) : '');
// Hai ký tự liền nhau thuộc cùng một từ — trừ chỗ chữ thường / số liền chữ hoa (PDF dính hai từ: "Tỉnh ủyGiao", "2026Giao").
const giuaTu = (x, y) => laChuSo(x) && laChuSo(y) && !(/\p{Lu}/u.test(y) && /[\p{Ll}\p{N}]/u.test(x));
// Vị trí trong chữ gốc → vị trí chuẩn hoá đầu tiên ở / sau đó.
export const viTriChuan = (goc, a) => { let l = 0; let h = goc.viTri.length; while (l < h) { const m = (l + h) >> 1; if (goc.viTri[m] < a) l = m + 1; else h = m; } return l; };

// Mọi lần khớp hợp lệ (ranh giới từ) của chuỗi → [{ xm: 'dung' | 'khong_dau', s, e (chuẩn hoá), a, b (chữ gốc), km }] — chỉ của cách so ĐẦU TIÊN có kết
// quả: có dấu, có dấu bỏ ký hiệu đầu ý, không dấu, không dấu bỏ ký hiệu. Nhớ theo chuỗi (một lượt đối chiếu).
export function timTatCa(goc, chuoi, toiThieu = 12) {
  const n = chuanTrich(chuoi); const khoa = `${toiThieu}|${n}`;
  if (!goc.co || n.length < toiThieu) return [];
  if (goc.nho.has(khoa)) return goc.nho.get(khoa);
  const k = khongDauDeu(n); let ds = [];
  for (const [hay, vt, kim, xm, km] of [[goc.chuan, goc.viTri, n, 'dung', false], [goc.km.chuan, goc.km.viTri, n, 'dung', true],
    [goc.khongDau, goc.viTri, k, 'khong_dau', false], [goc.km.khongDau, goc.km.viTri, k, 'khong_dau', true]]) {
    for (let i = hay.indexOf(kim); i >= 0 && ds.length < 40; i = hay.indexOf(kim, i + 1)) {
      const a = vt[i]; const b = cuoi(goc, i + kim.length - 1, vt);
      if (giuaTu(truoc(goc.text, a), tai(goc.text, a)) || giuaTu(truoc(goc.text, b), tai(goc.text, b))) continue;
      ds.push({ xm, s: km ? viTriChuan(goc, a) : i, e: km ? viTriChuan(goc, b) : i + kim.length, a, b, km });
    }
    if (ds.length) break;
  }
  ds = ds.sort((x, y) => x.s - y.s); goc.nho.set(khoa, ds);
  return ds;
}
// Một lần khớp: lần đầu từ vị trí tu (nhiệm vụ theo thứ tự văn bản), không có thì lần đầu.
export const timDoan = (goc, chuoi, { tu = 0, toiThieu = 12 } = {}) => { const ds = timTatCa(goc, chuoi, toiThieu); return ds.find((x) => x.s >= tu) || ds[0] || null; };

const DAU_Y = new RegExp(`^\\s*${MUC}(?= )\\s*`, 'u');
const LAI_Y = new RegExp(`(?:^|\\n|[:;.])\\s*${MUC}?\\s*$`, 'u');
// Cấp của ký hiệu đầu ý: I. > 1. > 1.1. > a) > - > + (số nhỏ = cấp cao).
const KIEU = [[0, /^[IVX]{1,5}\.$/], [2, /^\(?\d{1,3}\.\d{1,3}(?:\.\d{1,3})*[.)]?$/], [1, /^\(?\d{1,3}[.)]$/], [3, /^\(?[a-zđ][.)]$/], [4, /^[-–—•*]$/], [5, /^\+$/]];
export const capCua = (mk) => { for (const [c, r] of KIEU) if (r.test(mk)) return c; return 4; };
const mucDauDong = (goc, a) => { const d = goc.text.lastIndexOf('\n', a - 1) + 1; const m = goc.muc.find(([x]) => x === d); return m ? goc.text.slice(m[0], m[1]) : null; };
const mucTruoc = (goc, a) => { const m = goc.muc.find(([, y]) => y <= a && a - y <= 2); return m ? goc.text.slice(m[0], m[1]) : null; };
// Câu dẫn hợp lệ của ý d2: kết thúc trước ý, liền sau có dấu hai chấm, giữa câu dẫn và ý không có câu dẫn khác (dòng kết thúc bằng ":"), ý ở cấp sâu hơn câu dẫn.
function laDanCua(goc, x, d2) {
  if (x.e > d2.s || d2.s - x.e > 6000 || !/^[)\]”"’»]*:/.test(goc.text.slice(x.b, x.b + 4))) return false;
  if (goc.text.slice(goc.text.indexOf(':', x.b) + 1, d2.a).includes(':\n')) return false;
  const m1 = mucDauDong(goc, x.a); const m2 = mucTruoc(goc, d2.a);
  return !(m1 && m2 && capCua(m2) <= capCua(m1));
}
// Nhiệm vụ = câu dẫn kết thúc bằng dấu hai chấm + ý liệt kê (đề bài quy tắc 4c; tối đa 3 tầng, thử tối đa 4 dấu hai chấm): tìm Ý trước (từ vị trí tu), rồi
// câu dẫn là lần khớp GẦN NHẤT trước ý thoả laDanCua (câu dẫn có thể lặp lại ở chỗ khác trong văn bản — rà soát độc lập 18/10).
export function timNhiemVu(goc, chuoi, tu = 0, tang = 0) {
  const lien = timDoan(goc, chuoi, { tu });
  if (lien) return { xm: lien.xm, phan: [lien] };
  if (tang >= 2) return null;
  let thu = 0;
  for (let k = chuoi.indexOf(':'); k > 0 && thu < 4; k = chuoi.indexOf(':', k + 1)) {
    const dan = chuoi.slice(0, k);
    if (chuanTrich(dan).length < 8) continue;
    thu += 1;
    const sau = timNhiemVu(goc, chuoi.slice(k + 1), tu, tang + 1); const d2 = sau?.phan[0];
    if (!d2 || !LAI_Y.test(goc.text.slice(Math.max(0, d2.a - 16), d2.a))) continue;
    const d1 = timTatCa(goc, dan, 8).filter((x) => laDanCua(goc, x, d2)).pop();
    if (d1) return { xm: d1.xm === 'dung' && sau.xm === 'dung' ? 'dung' : 'khong_dau', phan: [d1, ...sau.phan] };
  }
  return null;
}
// Nguyên văn một đoạn (gộp khoảng trắng; bỏ ký hiệu đầu ý ở đầu; ký hiệu ở giữa chỉ bỏ khi AI đã bỏ chúng — khớp ở bản bỏ ký hiệu); giữ ngoặc đóng và
// dấu chấm liền sau — câu dẫn: giữ dấu hai chấm.
export function nguyenVan(goc, d, { dan = false } = {}) {
  const them = /^[)\]”"’»]*/.exec(goc.text.slice(d.b, d.b + 4))[0];
  const dau = dan ? ':' : /^[)\]”"’»]*(\.?)/.exec(goc.text.slice(d.b, d.b + 4))[1];
  let t = ''; let k = d.a;
  if (d.km) for (const [x, y] of goc.muc) { if (y <= d.a || x >= d.b) continue; t += goc.text.slice(k, Math.max(k, x)); k = Math.max(k, y); }
  return (t + goc.text.slice(k, d.b) + them + dau).replace(/\s+/g, ' ').replace(DAU_Y, '').trim();
}
// Giá trị điền: chữ AI khi chỉ khác chữ hoa / khoảng trắng; ngược lại chữ của tệp — trừ khi tệp mất dấu (chữ AI có dấu, khớp không dấu).
export function giaTriDien(goc, ket, chuoi) {
  const tep = ket.phan.map((d, i) => nguyenVan(goc, d, { dan: i < ket.phan.length - 1 })).join(' ');
  const long = (s) => String(s).normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  if (long(tep) === long(chuoi)) return { gia_tri: String(chuoi).replace(/\s+/g, ' ').trim(), xm: ket.xm };
  if (ket.xm === 'khong_dau' && !coDau(tep)) return { gia_tri: String(chuoi).replace(/\s+/g, ' ').trim(), xm: 'khong_dau' };
  return { gia_tri: tep, xm: 'dung' };
}

const CAU_MOI = /^(?:Giao|Đề nghị|Yêu cầu) /u;
const THUOC_TINH = /^(?:Thời hạn|Thời gian|Hạn hoàn thành|Hoàn thành|Sản phẩm|Cơ quan phối hợp|Đơn vị phối hợp|Phối hợp|Kết quả)\b/iu;
const laYMoi = (goc, p) => goc.dauMuc.has(p) || CAU_MOI.test(goc.text.slice(p, p + 12));
// Hết câu / hết ý tính từ vị trí i (≤ 1500 ký tự): dấu . ! ? rồi khoảng trắng (không tính "1.500"), xuống dòng sang ý mới, dấu ; trước ý mới.
export function hetCau(goc, i) {
  const t = goc.text; const max = Math.min(t.length, i + 1500);
  for (let k = i; k < max; k++) {
    const c = t[k];
    if ('.!?'.includes(c) && (k + 1 >= t.length || /\s/.test(t[k + 1])) && !goc.muc.some(([x, y]) => k >= x && k < y)) return k + 1;
    if (c === '\n' && laYMoi(goc, k + 1)) return k;
    if (c === ';' && laYMoi(goc, k + 2)) return k + 1;
  }
  return max;
}
// Câu trong văn bản còn tiếp sau đoạn khớp? → null | { chu: phần còn tiếp đến hết câu, dan: đoạn khớp là câu dẫn (sau là dấu hai chấm + các ý) }.
// Xuống dòng: dòng chứa chỗ kết thúc dài (≥ 55 ký tự — dòng bị ngắt giữa câu) và dòng sau không mở ý mới → còn tiếp, kể cả khi dòng sau viết hoa (tên cơ quan:
// "trình Ban Thường vụ\nTỉnh ủy trong quý I"); dòng ngắn (hết đoạn, ô bảng) → đã trọn.
export function conTiep(goc, d) {
  const t = goc.text; let i = d.b;
  while (i < t.length && /[)\]”"’»]/.test(t[i])) i += 1;
  const c = t[i];
  if (c === undefined || '.!?'.includes(c)) return null;
  if (c === ';' && laYMoi(goc, i + 2)) return null;
  if (c === '\n') {
    const dong = t.slice(t.lastIndexOf('\n', d.b - 1) + 1, d.b);
    if (laYMoi(goc, i + 1) || dong.length < 55 || !/^[\p{L}\p{N}]/u.test(t.slice(i + 1, i + 2))) return null;
  }
  // Dấu phẩy: luôn coi là còn tiếp (", báo cáo … trước ngày …" hay ", Sở Tài chính …" — người giao chọn "Dùng trọn câu" hoặc "Dùng phần trợ lý AI tách").
  const dan = c === ':';
  const het = dan ? Math.min(t.length, i + 300) : hetCau(goc, i);
  const chu = t.slice(i, het).replace(/\s+/g, ' ').trim();
  return chu ? { chu, dan } : null;
}
// Khoảng của nhiệm vụ: các phần + phần ngay sau tới hết câu, cộng các câu thời hạn / sản phẩm / phối hợp liền sau ("Thời hạn hoàn thành: …"); không quá
// 600 ký tự chuẩn hoá, dừng ở nhiệm vụ kế tiếp đã tách (ke). Câu mới khác ("Sở Tài chính bảo đảm kinh phí, …") không thuộc nhiệm vụ.
export function khoang(goc, ket, ke = Infinity) {
  const p = ket.phan; const d = p[p.length - 1]; const t = goc.text;
  let het = hetCau(goc, d.b);
  for (let n = 0; n < 3; n++) {
    let k = het; while (k < t.length && /\s/.test(t[k])) k += 1;
    if (!THUOC_TINH.test(t.slice(k, k + 30))) break;
    het = hetCau(goc, k);
  }
  return [...p.map((x) => [x.s, x.e]), [d.e, Math.min(d.e + 600, ke, viTriChuan(goc, het))]];
}
export function trongKhoang(goc, ks, chuoi, toiThieu = 4) {
  const n = chuanTrich(chuoi);
  if (!goc.co || n.length < toiThieu) return null;
  for (const [hay, kim, xm] of [[goc.chuan, n, 'dung'], [goc.khongDau, khongDauDeu(n), 'khong_dau']]) {
    for (const [s, e] of ks) { const i = hay.indexOf(kim, s); if (i >= 0 && i + kim.length <= e) return { xm, s: i, e: i + kim.length }; }
  }
  return null;
}
// Chữ của tệp ứng với đoạn chuẩn hoá [s, e) — gộp khoảng trắng.
export const chuDoan = (goc, s, e) => goc.text.slice(goc.viTri[s], cuoi(goc, e - 1)).replace(/\s+/g, ' ').trim();
