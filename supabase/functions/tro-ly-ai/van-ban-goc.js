// Đối chiếu THEO VỊ TRÍ trong chữ của tệp (v3.25 — đợt sửa gộp 18/10/2026, chủ dự án: "dùng AI đọc văn bản để đề xuất nhiệm vụ cần phải hiểu văn bản
// và tách nhiệm vụ chính xác nhất có thể"). Chữ gốc = các trang đã bỏ số trang ở mép (chuan-hoa.js cacTrang), gộp khoảng trắng, ghép bằng một dòng; bản đồ
// ký tự cho biết đoạn khớp nằm ở đâu → (1) điền NGUYÊN VĂN chữ của tệp thay chữ AI chép (AI đổi "12%" thành "1,2%", đổi dấu — so bỏ dấu câu vẫn khớp);
// (2) đoạn phải bắt đầu, kết thúc ở ranh giới từ, và biết câu trong văn bản còn tiếp hay không; (3) hạn, đơn vị phối hợp, mô tả sản phẩm phải nằm trong
// chính nhiệm vụ (hoặc câu thời hạn / sản phẩm ngay sau). Phần đầu trang 1: dau-van-ban.js. Thuần — unit test frontend/tests/tro-ly-ai-doi-chieu.test.mjs.
import { chuanTrich, khongDauDeu, coDau, laChuSo, cacTrang, banDo } from './chuan-hoa.js';

export const MUC = '(?:[-+•*–—]|\\(?\\d{1,3}(?:\\.\\d{1,3})*[.)]|\\(?[a-zđ][.)]|[IVX]{1,5}\\.)';
const MUC_DONG = new RegExp(`^(${MUC}) (?=[\\p{L}\\p{N}(“"])`, 'u');
const MUC_GIUA = new RegExp(`[:;] (${MUC}) (?=[\\p{L}\\p{N}(“"])`, 'gu');
export const HET_DONG = /[.;:!?][)\]”"’»]*$/;
// Cuối dòng "treo" — câu chắc chắn còn tiếp ở dòng sau (rà soát độc lập lần 2, 18/10): dấu phẩy / gạch nối; giới từ, liên từ, từ chỉ lượng ("của", "và",
// "các", "phối hợp"…); "số / năm / ngày / quý / điểm…" khi dòng sau mở đầu bằng số (hoặc a), I); "Sở / Ban / Văn phòng / Thường vụ…" khi dòng sau viết hoa.
const TREO_TU = /(?:^|[\s(“"])(?:của|cho|tại|về|trong|với|theo|đến|tới|từ|trên|dưới|vào|ở|qua|sau|trước|và|hoặc|hay|cùng|nhưng|mà|để|nhằm|các|những|mọi|mỗi|từng|một|là|có|được|bị|sẽ|đã|đang|cần|phải|đối với|bảo đảm|đảm bảo|gồm|như|thuộc|giữa|bằng|do|nếu|khi|thì|rằng|phối hợp|chủ trì|tham mưu)$/iu;
const TREO_SO = /(?:^|[\s(])(?:số|năm|ngày|tháng|quý|giai đoạn|lần thứ|khoản|điểm|mục|điều|khóa|khoá|nhiệm kỳ|đợt)$/iu;
const TREO_CQ = /(?:^|\s)(?:Sở|Ban|Bộ|Cục|Ủy ban|Uỷ ban|Văn phòng|Thường vụ|Thường trực|Chấp hành)$/u;
export const treo = (dong, sau = '') => { const d = dong.trimEnd(); return /[,–—-]$/.test(d) || TREO_TU.test(d)
  || (TREO_SO.test(d) && /^(?:\p{N}|[IVX]{1,4}\b|[a-zđ]\))/u.test(sau)) || (TREO_CQ.test(d) && /^\p{Lu}/u.test(sau)); };
// Ký hiệu đầu ý THẬT (a), 1., 2.1., -, +), sau ký hiệu là chữ hoặc số ("- 100% xã…", "a) 95% …"): đầu dòng mà dòng trước đã hết câu (. ; : ! ?), hoặc
// dòng trước không treo và là dòng ngắn (tiêu đề mục) hay dòng dài mà ý mở bằng chữ hoa (ý trước thiếu dấu câu); hoặc sau ": " / "; " cùng dòng. Không
// tính "điểm\nb) khoản 2", "giai đoạn 2026\n- 2030", "đạt\n- 5%", "1.500 tỷ".
const laMucDong = (dong, mk, truoc) => {
  if (truoc === null || HET_DONG.test(truoc)) return true;
  const sau = dong.slice(mk.length + 1);
  if (treo(truoc, dong) || (/^[-–—]$/.test(mk) && /^\d/.test(sau) && (truoc.length > 60 || (/\d{4}$/.test(truoc) && /^\d{4}(?!\d)/.test(sau))))) return false;
  return truoc.length <= 60 || /^\p{Lu}/u.test(sau);
};
function cacMuc(text) {
  const ds = []; let o = 0; let truocDong = null;
  for (const dong of text.split('\n')) {
    const m = MUC_DONG.exec(dong);
    if (m && laMucDong(dong, m[1], truocDong)) ds.push([o, o + m[1].length]);
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
  const muc = cacMuc(text); const trongMuc = new Uint8Array(text.length + 1); muc.forEach(([a, b]) => trongMuc.fill(1, a, b));
  let kc = ''; const kv = [];   // bản bỏ ký hiệu đầu ý: AI chép nội dung gồm nhiều ý thường bỏ các ký hiệu ở giữa
  for (let i = 0; i < chuan.length; i++) if (!trongMuc[viTri[i]]) { kc += chuan[i]; kv.push(viTri[i]); }
  return { text, dauTrang, trang1: trang[0] || '', chuan, viTri, khongDau: khongDauDeu(chuan), co: chuan.length > 0, muc, trongMuc,
    dauMuc: new Set(muc.map(([a]) => a)), mucTai: new Map(muc.map(([a, b]) => [a, text.slice(a, b)])), mucCuoi: new Map(muc.map(([a, b]) => [b, a])),
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
const dauDong = (t, a) => t.lastIndexOf('\n', a - 1) + 1;
const mucDauDong = (goc, a) => goc.mucTai.get(dauDong(goc.text, a)) ?? null;
// Ký hiệu đứng ngay trước vị trí a (cách tối đa 2 ký tự) → [đầu, cuối] | null.
const mucTruoc = (goc, a) => { for (const y of [a, a - 1, a - 2]) if (goc.mucCuoi.has(y)) return [goc.mucCuoi.get(y), y]; return null; };
const mucSau = (goc, p) => { let l = 0; let h = goc.muc.length; while (l < h) { const m = (l + h) >> 1; if (goc.muc[m][0] <= p) l = m + 1; else h = m; } return l; };
// Đầu đoạn chứa vị trí k: lùi qua các dòng mà dòng trước chưa hết câu (dòng bị ngắt giữa câu), dừng ở dòng mở bằng ký hiệu đầu ý.
function dauDoan(goc, k) {
  const t = goc.text; let d = dauDong(t, k);
  for (let n = 0; n < 12 && d > 0 && !goc.dauMuc.has(d); n++) { const p = dauDong(t, d - 1); if (HET_DONG.test(t.slice(p, d - 1))) break; d = p; }
  return d;
}
// Câu dẫn hợp lệ của ý d2 (rà soát độc lập lần 2): kết thúc trước ý, liền sau có dấu hai chấm; ý ở cấp NGAY DƯỚI câu dẫn (cấp của ký hiệu đầu tiên sau dấu
// hai chấm) và sâu hơn ký hiệu của chính câu dẫn; giữa câu dẫn và ý không có ký hiệu cấp cao hơn (danh sách đã hết — "2." của mục khác) và không có câu
// dẫn của đoạn khác (dòng kết thúc bằng ":" không thuộc một ý cùng cấp / sâu hơn — ý a) có danh sách con của nó vẫn được).
function laDanCua(goc, x, d2) {
  const t = goc.text;
  if (x.e > d2.s || d2.s - x.e > 6000 || !/^[)\]”"’»]*:/.test(t.slice(x.b, x.b + 4))) return false;
  const p = t.indexOf(':', x.b); const m2 = mucTruoc(goc, d2.a); const c2 = m2 ? capCua(t.slice(m2[0], m2[1])) : null;
  const giua = [];
  for (let j = mucSau(goc, p); j < goc.muc.length && goc.muc[j][0] < (m2 ? m2[0] : d2.a); j++) giua.push(capCua(t.slice(goc.muc[j][0], goc.muc[j][1])));
  const m1 = mucDauDong(goc, x.a); const c1 = m1 === null ? null : capCua(m1); const L = giua.length ? giua[0] : c2;
  if (c1 !== null && [...giua, c2].some((c) => c !== null && c <= c1)) return false;
  if (giua.length && (c2 !== L || giua.some((c) => c < L))) return false;
  for (let k = t.indexOf(':\n', p + 1); k >= 0 && k < d2.a; k = t.indexOf(':\n', k + 1)) {
    const mk = goc.mucTai.get(dauDoan(goc, k));
    if (mk === undefined || L === null || capCua(mk) < L) return false;
  }
  return true;
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
  let j = d.b; while (j < goc.text.length && /[)\]”"’»]/.test(goc.text[j])) j += 1;
  const h = goc.text[j] === '.' ? hetCauTai(goc, j) : 0;   // dấu chấm hết câu (không lấy dấu chấm của "TP.", "1.500") + ngoặc đóng sau nó
  const duoi = dan ? `${goc.text.slice(d.b, j)}:` : goc.text.slice(d.b, h || j);
  let t = ''; let k = d.a;
  if (d.km) for (const [x, y] of goc.muc) { if (y <= d.a || x >= d.b) continue; t += goc.text.slice(k, Math.max(k, x)); k = Math.max(k, y); }
  return (t + goc.text.slice(k, d.b) + duoi).replace(/\s+/g, ' ').replace(DAU_Y, '').trim();
}
// Giá trị điền: chữ AI khi chỉ khác chữ hoa / khoảng trắng; ngược lại chữ của tệp — trừ khi tệp mất dấu (chữ AI có dấu, khớp không dấu).
export function giaTriDien(goc, ket, chuoi) {
  const tep = ket.phan.map((d, i) => nguyenVan(goc, d, { dan: i < ket.phan.length - 1 })).join(' ');
  const long = (s) => String(s).normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
  if (long(tep) === long(chuoi)) return { gia_tri: String(chuoi).replace(/\s+/g, ' ').trim(), xm: ket.xm };
  if (ket.xm === 'khong_dau' && !coDau(tep)) return { gia_tri: String(chuoi).replace(/\s+/g, ' ').trim(), xm: 'khong_dau' };
  return { gia_tri: tep, xm: 'dung' };
}

// Câu giao việc mới ở đầu dòng / sau "; " — "Giao Sở …", "Đề nghị các …" (không tính "Giao thông vận tải", "Giao ban" ở dòng bị ngắt giữa câu).
const CAU_MOI = /^(?:Giao|Đề nghị|Yêu cầu) (?:cho |các |\p{Lu})/u;
const THUOC_TINH = /^(?:Thời hạn|Thời gian|Hạn hoàn thành|Hoàn thành|Sản phẩm|Cơ quan phối hợp|Đơn vị phối hợp|Phối hợp|Kết quả)\b/iu;
const dongTruoc = (t, k) => t.slice(dauDong(t, k), k);
const laYMoi = (goc, p) => goc.dauMuc.has(p) || (CAU_MOI.test(goc.text.slice(p, p + 16))
  && !(goc.text[p - 1] === '\n' && treo(dongTruoc(goc.text, p - 1), goc.text.slice(p, p + 16))));
// Xuống dòng ở k (t[k] = "\n") còn nối câu / ô bảng? Không: ý mới, dòng trước hết câu / là câu dẫn, dấu ; cuối dòng (trừ khi dòng sau viết thường).
// Có: dòng trước treo; dòng sau viết thường hoặc là số hiệu văn bản ("15-NQ/TU"); dòng trước dài (≥ 55 ký tự — văn xuôi bị ngắt giữa câu, tên riêng ở đầu
// dòng sau: "trình Ban Thường vụ\nTỉnh ủy"). Dòng ngắn không treo + dòng sau viết hoa / là số → hết ô bảng, hết đoạn (rà soát độc lập lần 2: ô bảng bị cắt).
export function noiDong(goc, k) {
  const t = goc.text; const dong = dongTruoc(t, k).trimEnd(); const sau = t.slice(k + 1, k + 16);
  let j = k - 1; while (j >= 0 && /[)\]”"’»\s]/.test(t[j])) j -= 1;
  if (goc.dauMuc.has(k + 1) || t[j] === ':' || hetCauTai(goc, j)) return false;
  if (/;[)\]”"’»]*$/.test(dong)) return /^\p{Ll}/u.test(sau);
  if (treo(dong, sau)) return true;
  if (CAU_MOI.test(sau)) return false;
  if (/^\p{Ll}/u.test(sau) || /^\d{1,5}[-/]\p{Lu}/u.test(sau)) return true;
  return /^[\p{L}\p{N}(“"]/u.test(sau) && dong.length >= 55;
}
// Hết câu ở k: dấu . ! ? (rồi các ngoặc đóng) rồi khoảng trắng → vị trí ngay sau đó; không phải hết câu → 0 ("1.500", dấu chấm của ký hiệu "2.1.", của chữ
// viết tắt "TP. Cao Bằng", "TX.", "ThS.").
const VIET_TAT = /(?:^|[^\p{L}])(?:TP|Tp|TX|Tx|TT|ThS|TS|PGS|GS)$/u;
export const hetCauTai = (goc, k) => {
  const t = goc.text; if (!'.!?'.includes(t[k]) || goc.trongMuc[k] || (t[k] === '.' && VIET_TAT.test(t.slice(Math.max(0, k - 4), k)))) return 0;
  let j = k + 1; while (j < t.length && /[)\]”"’»]/.test(t[j])) j += 1;
  return j >= t.length || /\s/.test(t[j]) ? j : 0;
};
// Hết câu / hết ý tính từ vị trí i (≤ 1500 ký tự): hết câu, xuống dòng sang ý mới, dấu ; trước ý mới. theoDong: dừng cả ở chỗ xuống dòng không nối câu
// (noiDong — phần còn tiếp của một ô bảng chỉ tới hết ô).
export function hetCau(goc, i, theoDong = false) {
  const t = goc.text; const max = Math.min(t.length, i + 1500);
  for (let k = i; k < max; k++) {
    const c = t[k]; const h = hetCauTai(goc, k);
    if (h) return h;
    if (c === '\n' && (laYMoi(goc, k + 1) || (theoDong && k > i && !noiDong(goc, k)))) return k;
    if (c === ';' && (laYMoi(goc, k + 2) || (t[k + 1] === '\n' && !/^\p{Ll}/u.test(t.slice(k + 2, k + 3))))) return k + 1;   // ";" cuối dòng: hết ý
  }
  return max;
}
// Câu trong văn bản còn tiếp sau đoạn khớp? → null | { chu: phần còn tiếp đến hết câu, dan: đoạn khớp là câu dẫn (sau là dấu hai chấm + các ý) }.
// Dấu phẩy, dấu ; giữa dòng: còn tiếp (", báo cáo … trước ngày …", "; hoàn thành trong quý IV" — người giao chọn "Dùng trọn câu" hoặc "Dùng phần trợ lý AI
// tách"); xuống dòng: theo noiDong.
export function conTiep(goc, d) {
  const t = goc.text; let i = d.b;
  while (i < t.length && /[)\]”"’»]/.test(t[i])) i += 1;
  const c = t[i];
  if (c === undefined || hetCauTai(goc, i)) return null;
  if (c === ';' && (laYMoi(goc, i + 2) || (t[i + 1] === '\n' && !noiDong(goc, i + 1)))) return null;
  if (c === '\n' && !noiDong(goc, i)) return null;
  const dan = c === ':';
  const het = dan ? Math.min(t.length, i + 300) : hetCau(goc, i, true);
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
// Giá trị (hạn, đơn vị phối hợp, mô tả) nằm trong một khoảng của nhiệm vụ, ở ranh giới từ ("5/12/2026" không khớp trong "15/12/2026").
export function trongKhoang(goc, ks, chuoi, toiThieu = 4) {
  const n = chuanTrich(chuoi);
  if (!goc.co || n.length < toiThieu) return null;
  const bien = (i, l) => { const a = goc.viTri[i]; const b = cuoi(goc, i + l - 1); return !giuaTu(truoc(goc.text, a), tai(goc.text, a)) && !giuaTu(truoc(goc.text, b), tai(goc.text, b)); };
  for (const [hay, kim, xm] of [[goc.chuan, n, 'dung'], [goc.khongDau, khongDauDeu(n), 'khong_dau']]) {
    for (const [s, e] of ks) {
      for (let i = hay.indexOf(kim, s); i >= 0 && i + kim.length <= e; i = hay.indexOf(kim, i + 1)) if (bien(i, kim.length)) return { xm, s: i, e: i + kim.length };
    }
  }
  return null;
}
// Chữ của tệp ứng với đoạn chuẩn hoá [s, e) — gộp khoảng trắng.
export const chuDoan = (goc, s, e) => goc.text.slice(goc.viTri[s], cuoi(goc, e - 1)).replace(/\s+/g, ' ').trim();
