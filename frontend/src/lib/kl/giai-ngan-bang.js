// Đọc bảng số liệu giải ngân (v3.28) dán từ Excel / Word / trang web (bảng HTML của bộ nhớ tạm), chữ có tab, chữ chép từ PDF (cách bằng dấu cách),
// hoặc lấy từ tệp .xlsx (lib/xlsx-doc.js — số gốc). Số kiểu Việt Nam (1.234,567) hay kiểu Anh (1,234.567) tự nhận theo cả bảng; đơn vị tỷ / triệu /
// nghìn / đồng (theo dòng "Đơn vị: …" nếu có, không thì theo độ lớn); bỏ dòng trống, số thứ tự đầu tên; dòng "Tổng cộng / Trong đó" không tích sẵn
// (dùng điền số tổng, đối chiếu); ô "-" / "x" = trống. Tên chuẩn hoá để khớp cùng đối tượng giữa các kỳ (DB lưu ten_chuan): NFC, chữ thường, gộp
// khoảng trắng, dấu thanh kiểu cũ (hoà → hòa, thuỷ → thủy). Hàm thuần: bảng = mảng dòng, mỗi dòng mảng ô (chuỗi hoặc số).
const KHOANG = /\s+/g;   // \s gồm cả khoảng trắng không ngắt (Excel, PDF), khoảng mảnh
const STT = /^((?:[IVXLC]+|\d+(?:\.\d+)*|[A-Za-zĐđ])[.)]|[-+•])\s+/;   // số La Mã chỉ chữ hoa (họ "Vi" không bị cắt)
const STT_TRAN = /^(?:[IVXLC]+|\d+(?:\.\d+)*|[A-Za-zĐđ])[.)]?$/;   // ô / từ đầu dòng chỉ là số thứ tự (chép từ PDF)
export const DON_VI = { ty: 1, trieu: 1e-3, nghin: 1e-6, dong: 1e-9 };
export const TEN_DON_VI = { ty: 'tỷ đồng', trieu: 'triệu đồng', nghin: 'nghìn đồng', dong: 'đồng' };
const lam = (x) => Math.round(x * 1000) / 1000;
// oà → òa, oẻ → ỏe, uỷ → ủy khi cặp nguyên âm ở cuối âm tiết (dạng NFD: dấu thanh đứng sau nguyên âm thứ hai); không đụng "qu" (quà, quý).
const KIEU_CU = /(?<!q)([ou])([aey])([\u{300}\u{301}\u{303}\u{309}\u{323}])(?![\p{L}\p{M}])/gu;

// Tên để hiển thị: NFC, Ð (eth, hay gặp khi chép từ PDF) → Đ, gạch nối các kiểu → '-', gộp khoảng trắng, bỏ số thứ tự đầu dòng.
export const tenGon = (s) => String(s ?? '').normalize('NFC').replace(/\xD0/g, 'Đ').replace(/\xF0/g, 'đ').replace(/[\u{2010}-\u{2015}\u{2212}]/gu, '-')
  .replace(KHOANG, ' ').trim().replace(STT, '').trim();
// Tên chuẩn để khớp: như tenGon, chữ thường, dấu thanh kiểu cũ.
export const tenChuan = (s) => tenGon(s).toLocaleLowerCase('vi').normalize('NFD').replace(KIEU_CU, '$1$3$2').normalize('NFC');
// Khớp lỏng (gợi ý cùng đối tượng khi tên khác chút): bỏ dấu, bỏ mọi ký tự không phải chữ / số.
export const tenLong = (s) => tenChuan(s).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]/gu, '');

// Một ô → số (chưa đổi đơn vị) | null (trống, '-', 'x') | NaN (không đọc được). kieu: 'vi' (1.234,5) | 'en' (1,234.5).
export function docSo(v, kieu = 'vi') {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? '').normalize('NFC').replace(KHOANG, '').replace(/[%*]+$/, '');
  if (s === '' || /^[-–—−x]$/i.test(s)) return null;
  let am = false;
  if (/^\(.*\)$/.test(s)) { am = true; s = s.slice(1, -1); }
  if (/^[-–—−]/.test(s)) { am = true; s = s.slice(1); }
  s = kieu === 'en' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return am ? -Number(s) : Number(s);
}

// Đoán kiểu số của cả bảng từ các ô không mơ hồ (1.234,5 / 1,234.5 / 2054,5 / 1.234.567); chỉ có ô mơ hồ (2,054) → 'vi' (báo cáo trong nước).
export function doanKieuSo(o) {
  let vi = 0; let en = 0;
  for (const v of o) {
    if (typeof v !== 'string') continue;
    const s = v.replace(KHOANG, '').replace(/[%*()]/g, '').replace(/^[-–—−]/, '');
    if (!/^[\d.,]+$/.test(s)) continue;
    const c = s.lastIndexOf(','); const d = s.lastIndexOf('.');
    if (c >= 0 && d >= 0) { if (c > d) vi++; else en++; continue; }
    const sep = c >= 0 ? ',' : d >= 0 ? '.' : '';
    if (!sep) continue;
    const phan = s.split(sep);
    if (phan.length > 2) { if (sep === '.') vi++; else en++; continue; }   // 1.234.567 — nhóm nghìn
    if (phan[1].length !== 3) { if (sep === ',') vi++; else en++; }        // 2054,5 → thập phân kiểu Việt; đúng 3 chữ số sau dấu: mơ hồ, bỏ qua
  }
  return en > vi ? 'en' : 'vi';
}

// Chữ dán có tab giữa ô, xuống dòng giữa dòng (ô có xuống dòng nằm trong "…" như Excel chép) → bảng.
export function bangTuChu(text) {
  const s = String(text ?? '').replace(/\r\n?/g, '\n'); const kq = []; let dong = []; let o = ''; let ngoac = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (ngoac) { if (c === '"') { if (s[i + 1] === '"') { o += '"'; i++; } else ngoac = false; } else o += c; continue; }
    if (c === '"' && o === '') { ngoac = true; continue; }
    if (c === '\t') { dong.push(o); o = ''; continue; }
    if (c === '\n') { dong.push(o); kq.push(dong); dong = []; o = ''; continue; }
    o += c;
  }
  if (o !== '' || dong.length) { dong.push(o); kq.push(dong); }
  return kq.filter((d) => d.some((x) => String(x).trim() !== ''));
}

const laTuSo = (t) => /^[(-]?\d[\d.,]*\)?%?$/.test(t) || /^[-–—−x]$/i.test(t);
// Chữ chép từ PDF (ô cách nhau bằng dấu cách): mỗi dòng = tên + các số ở cuối dòng. Số cột số = số gặp nhiều nhất (≥ 2) ở cuối các dòng — tên có số
// ("… số 2") không bị cắt; dòng không có số ngay sau một dòng có số = phần tên xuống dòng của dòng trên. → [[tên, số 1, số 2, …]].
export function bangTuChuPdf(text) {
  const dong = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.normalize('NFC').replace(KHOANG, ' ').trim()).filter(Boolean)
    .map((l) => { const t = l.split(' '); let n = 0; while (n < t.length - 1 && laTuSo(t[t.length - 1 - n])) n++; return { t, n }; });
  const dem = new Map(); dong.forEach((d) => { if (d.n >= 2) dem.set(d.n, (dem.get(d.n) || 0) + 1); });
  const soCot = [...dem.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] || 0;
  const kq = []; let coSoTruoc = false;
  for (const { t, n } of dong) {
    if (!n && coSoTruoc && !STT_TRAN.test(t[0])) { kq[kq.length - 1][0] += ` ${t.join(' ')}`; continue; }
    const lay = soCot ? Math.min(n, soCot) : n; const ten = t.slice(0, t.length - lay); const so = t.slice(t.length - lay);
    if (ten.length > 1 && STT_TRAN.test(ten[0])) ten.shift();
    kq.push([ten.join(' '), ...so, ...Array(Math.max(0, soCot - so.length)).fill('')]);
    coSoTruoc = so.length > 0;
  }
  return kq;
}

const giaiMa = (s) => s.replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/gi, '&');
// HTML trong bộ nhớ tạm (Excel / Word / LibreOffice / trang web chép bảng) → bảng; Excel ghi giá trị gốc ở thuộc tính x:num (LibreOffice: sdval) — dùng
// giá trị đó (không phụ thuộc dấu chấm, phẩy). Dựng lưới theo ô gộp: colspan / rowspan giữ đúng cột; ô gộp có chữ lặp lại ở các ô nó phủ (tiêu đề hai
// dòng "Giải ngân" → "Trong tháng | Lũy kế"; "Tổng cộng" gộp qua cột STT), ô số gộp không lặp. Không có bảng → null.
export function bangTuHtml(html) {
  const t = /<table[\s\S]*?<\/table>/i.exec(String(html ?? ''));
  if (!t) return null;
  const kq = []; const cho = []; let r = 0;   // cho[r][c]: giá trị của ô gộp dọc từ dòng trên phủ xuống
  for (const tr of t[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const dong = []; let c = 0;
    const lap = () => { while (cho[r]?.[c] !== undefined) { dong[c] = cho[r][c]; c++; } };
    for (const td of tr[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      lap();
      const num = /\b(?:x:num|sdval)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/i.exec(td[2]);   // Excel: x:num; LibreOffice: sdval
      const goc = num ? (num[1] ?? num[2] ?? num[3]) : undefined;
      const chu = giaiMa(td[3].replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<[^>]+>/g, '')).replace(KHOANG, ' ').trim();
      const gt = goc !== undefined && goc !== '' && Number.isFinite(Number(goc)) ? Number(goc) : chu; const lai = typeof gt === 'number' ? '' : gt;
      const ngang = Math.min(Number(/\bcolspan=["']?(\d+)/i.exec(td[2])?.[1] || 1), 50); const doc = Math.min(Number(/\browspan=["']?(\d+)/i.exec(td[2])?.[1] || 1), 200);
      for (let k = 0; k < ngang; k++) {
        dong[c + k] = k ? lai : gt;
        for (let h = 1; h < doc; h++) (cho[r + h] ||= [])[c + k] = lai;
      }
      c += ngang;
    }
    lap();
    const du = Array.from(dong, (x) => x ?? '');
    if (du.some((x) => String(x).trim() !== '')) kq.push(du);
    r++;
  }
  return kq.length ? kq : null;
}
// Chữ / HTML dán → bảng: bảng HTML trước, rồi chữ có tab, cuối cùng chữ chép từ PDF.
export const bangTuDan = (text, html = '') => bangTuHtml(html) || (String(text ?? '').includes('\t') ? bangTuChu(text) : bangTuChuPdf(text));

// Đơn vị ghi ở đầu bảng ("Đơn vị: triệu đồng", "ĐVT: tỷ đồng") → khoá DON_VI; không có → null.
export function donViTheoChu(bang) {
  for (const d of bang.slice(0, 12)) {
    const m = /(?:đơn\s*vị(?:\s*tính)?|đvt)\s*[:.]?\s*(tỷ|tỉ|triệu|nghìn|ngàn)?\s*đồng/i.exec(d.map((o) => String(o ?? '')).join(' ').normalize('NFC'));
    if (m) return { 'tỷ': 'ty', 'tỉ': 'ty', 'triệu': 'trieu', 'nghìn': 'nghin', 'ngàn': 'nghin' }[(m[1] || '').toLocaleLowerCase('vi')] || 'dong';
  }
  return null;
}

const KHOP = { ten: /(tên|nguồn\s*vốn|chủ\s*đầu\s*tư|đơn\s*vị|dự\s*án|nội\s*dung|địa\s*phương)/i, kh: /(kế\s*hoạch|vốn\s*giao|kh\s*vốn)/i,
  da: /(giải\s*ngân|thực\s*hiện|lũy\s*kế|luỹ\s*kế)/i, luyKe: /(lũy|luỹ)\s*kế|đến\s*(ngày|hết)|từ\s*đầu\s*năm/i };
const laSo = (v) => typeof v === 'number' || (typeof v === 'string' && /^[(-]?\d[\d.,\s]*\)?%?$/.test(v.trim()));
const coO = (v) => String(v ?? '').trim() !== '';
const soO = (d) => (d || []).filter((v) => laSo(v) && coO(v)).length;
const chuO = (o) => (typeof o === 'string' ? o.normalize('NFC').replace(KHOANG, ' ').trim() : '');
// Dòng chỉ số cột của biểu ("A | B | 1 | 2 | 3 | 4=3/2", "(1) | (2) | (3)") — thuộc phần tiêu đề, không phải dữ liệu.
const CHI_SO = /^\(?(?:[A-ZĐ]|\d{1,2})\)?(?:\s*=\s*[\dA-ZĐ\s()+\-*/x:.,]+)?$/;
export const laDongChiSo = (d) => { const o = (d || []).map((v) => (typeof v === 'number' ? String(v) : chuO(v))).filter(Boolean); return o.length >= 3 && o.every((x) => CHI_SO.test(x)); };
// Dòng tiêu đề: từ hai nhãn chữ khác nhau, không ô số, ô đầu không phải số thứ tự (dòng nhóm "A | Vốn trong nước", "I | Các dự án…" không phải tiêu đề).
const laTieuDe = (d) => { const o = (d || []).map(chuO).filter(Boolean); return new Set(o).size > 1 && !soO(d) && !STT_TRAN.test(o[0]) && !laDongChiSo(d); };
// Khối tiêu đề ngay trên dòng den: các dòng tiêu đề liền nhau (bỏ qua dòng trống, dòng chỉ số cột), tối đa 3; dừng ở dòng chú thích / dòng nhóm / dòng số.
function khoiTieuDe(bang, den) {
  const ds = [];
  for (let i = den - 1; i >= 0 && ds.length < 3; i--) {
    const d = bang[i] || [];
    if (!d.some(coO) || laDongChiSo(d)) continue;
    if (!laTieuDe(d)) break;
    ds.unshift(i);
  }
  return ds;
}
// Nhãn mỗi cột ghép từ các dòng (chỉ số dòng; bỏ dòng chú thích — một nhãn trải cả bảng như "Biểu 2", "Đơn vị: …"). Ô trống của dòng trên mà dòng dưới
// có nhãn con → lấy nhãn bên trái (ô gộp ngang chép bằng tab: Excel chỉ ghi chữ ở ô đầu).
function nhanGop(bang, dong) {
  const ds = dong.map((i) => bang[i] || []).filter((d) => new Set(d.map(chuO).filter(Boolean)).size > 1);
  const rong = Math.max(0, ...ds.map((d) => d.length)); const nhan = Array.from({ length: rong }, () => []);
  ds.forEach((d, i) => {
    let trai = '';
    for (let j = 0; j < rong; j++) {
      let o = chuO(d[j]);
      if (!o && trai && i < ds.length - 1 && chuO(ds[i + 1][j])) o = trai;
      if (o && nhan[j].at(-1) !== o) nhan[j].push(o);
      trai = o;
    }
  });
  return nhan.map((x) => x.join(' '));
}
function khopNhan(d) {
  const kh = d.findIndex((o) => KHOP.kh.test(o) && !KHOP.da.test(o));
  const ung = d.map((o, j) => (j !== kh && KHOP.da.test(o) && !/(tỷ\s*lệ|%)/i.test(o) ? j : -1)).filter((j) => j >= 0);
  const da = ung.find((j) => KHOP.luyKe.test(d[j])) ?? ung[0];
  if (kh < 0 || da === undefined) return null;
  const ten = d.findIndex((o, j) => j !== kh && j !== da && KHOP.ten.test(o));
  return { ten: ten >= 0 ? ten : 0, kh, da };
}
// Nhãn cột cho ô chọn của màn xem trước: ghép khối tiêu đề (tối đa 3 dòng) ngay trên dòng dữ liệu đầu.
export const nhanCot = (bang, tuDong) => nhanGop(bang, khoiTieuDe(bang, tuDong));
// Đoán cột tên / kế hoạch / đã giải ngân và dòng bắt đầu dữ liệu. (1) Khối tiêu đề (1–3 dòng, ghép theo cột) ngay trên dòng có số đầu tiên — dòng đó là
// dòng dữ liệu đầu, kể cả khi chỉ có một ô số (dòng "Tổng cộng" đầu bảng); cột giải ngân ưu tiên "lũy kế / đến ngày / từ đầu năm", bỏ cột tỷ lệ. (2) Không
// thấy: dò tiêu đề từng dòng, dữ liệu từ dòng sau đó có số ở cột kế hoạch / giải ngân. (3) Không có tiêu đề nhận ra được: cột chữ đầu + hai cột số đầu
// của dòng đầu có từ hai ô số, dữ liệu từ dòng đó (coTieuDe = false). Dòng chỉ số cột (A | B | 1 | 2…) không bao giờ là dữ liệu.
export function doanCot(bang) {
  const dau = bang.findIndex((d) => soO(d) > 0 && !laDongChiSo(d));
  const gan = dau > 0 ? khopNhan(nhanCot(bang, dau)) : null;
  if (gan) return { tuDong: dau, ...gan, coTieuDe: true };
  for (let i = 0; i < Math.min(bang.length, 15); i++) {
    const k = khopNhan(nhanGop(bang, [i]));
    if (k) { const tu = bang.slice(i + 1).findIndex((x) => !laDongChiSo(x) && (laSo(x?.[k.kh]) || laSo(x?.[k.da]))); return { tuDong: tu >= 0 ? i + 1 + tu : i + 1, ...k, coTieuDe: true }; }
  }
  const dau2 = bang.findIndex((d) => soO(d) >= 2 && !laDongChiSo(d)); const mau = bang[dau2] || [];
  const so = mau.map((v, j) => (laSo(v) && coO(v) ? j : -1)).filter((j) => j >= 0);
  const ten = mau.findIndex((v, j) => !so.includes(j) && !STT_TRAN.test(String(v ?? '').trim()) && String(v ?? '').trim().length > 1);
  return { tuDong: Math.max(0, dau2), ten: Math.max(0, ten), kh: so[0] ?? 1, da: so[1] ?? 2, coTieuDe: false };
}

// "Tổng cộng (A+B)", "Tổng số", "Cộng", "Trong đó:", "Toàn tỉnh" — không nhầm "Tổng công ty…", "Cộng đồng…".
const TONG = /^(tổng\s*cộng|tổng\s*số|tổng|cộng|trong\s*đó|toàn\s*tỉnh)(\s*[:(,]|\s*$|\s+(toàn|chung|các|a\s*\+))/i;
// Cấp của số thứ tự (đã bỏ dấu chấm / ngoặc): A, B → 0; I, II → 1; 1, 2 → 2; 1.1 → 3; a, b → 4; "-", "+", "•" → 5; không có → null. Chữ I, V, X, L, C
// đứng ngay sau chữ cái liền trước (B → C, H → I) là chữ cái (cấp 0), không phải số La Mã.
function capStt(s, chuTruoc) {
  if (!s) return null;
  if (/^[IVXLC]$/.test(s) && chuTruoc && s.codePointAt(0) === chuTruoc.codePointAt(0) + 1) return 0;
  if (/^[IVXLC]+$/.test(s)) return 1;
  if (/^[A-ZĐ]$/.test(s)) return 0;
  if (/^\d+$/.test(s)) return 2;
  if (/^\d+(\.\d+)+$/.test(s)) return 2 + s.split('.').length - 1;
  if (/^[a-zđ]$/.test(s)) return 4;
  return /^[-+•]$/.test(s) ? 5 : null;
}
// Bảng → các dòng { dong (số dòng trong bảng, từ 1), ten, tenChuan, kh, da (tỷ đồng), laTong, nhom, loi, chon }.
// Không tích sẵn: dòng tổng, dòng lỗi, dòng trùng tên dòng trên, dòng nhóm (số thứ tự cấp trên, ngay dưới là dòng cấp con — tích cả hai thì cộng trùng).
// Số thứ tự lấy ở cột ngay trước cột tên, hoặc ở đầu ô tên ("I. Vốn trong nước"). Bỏ qua: dòng chỉ số cột, dòng chữ gộp ngang (đề mục trải cả bảng —
// bảng HTML lặp chữ ở các ô gộp).
export function docBang(bang, { cot, tuDong = 0, kieu = 'vi', donVi = 'ty' }) {
  const he = DON_VI[donVi] ?? 1; const kq = []; const daCo = new Set(); let chuTruoc = '';
  for (let i = tuDong; i < bang.length; i++) {
    const d = bang[i] || []; const chu = d.map(chuO).filter(Boolean);
    if (laDongChiSo(d) || (chu.length > 1 && new Set(chu).size === 1 && !d.some((v) => typeof v === 'number'))) continue;
    const goc = String(d[cot.ten] ?? '').normalize('NFC').replace(KHOANG, ' ').trim(); const ten = tenGon(goc);
    const kh = docSo(d[cot.kh], kieu); const da = docSo(d[cot.da], kieu);
    if (!ten && kh === null && da === null) continue;
    const loi = !ten ? 'thiếu tên' : Number.isNaN(kh) || Number.isNaN(da) ? 'số không đọc được'
      : (kh ?? 0) < 0 || (da ?? 0) < 0 ? 'số âm' : kh === null && da === null ? 'không có số' : '';
    const laTong = TONG.test(ten); const tc = tenChuan(ten);
    const trung = !loi && !laTong && daCo.has(tc);
    if (!loi && !laTong) daCo.add(tc);
    const stt = String(cot.ten > 0 && STT_TRAN.test(String(d[cot.ten - 1] ?? '').trim()) ? d[cot.ten - 1] : (STT.exec(goc)?.[1] ?? '')).trim().replace(/[.)]$/, '');
    const cap = capStt(stt, chuTruoc); if (cap === 0) chuTruoc = stt;
    kq.push({ dong: i + 1, ten, tenChuan: tc, kh: typeof kh === 'number' && !Number.isNaN(kh) ? lam(kh * he) : null,
      da: typeof da === 'number' && !Number.isNaN(da) ? lam(da * he) : null, laTong, cap, nhom: false, loi: loi || (trung ? 'trùng tên dòng trên' : ''), chon: !loi && !laTong && !trung });
  }
  kq.forEach((x, j) => {   // dòng nhóm: dòng có số kế tiếp (không phải dòng tổng) ở cấp sâu hơn
    const sau = kq.slice(j + 1).find((y) => !y.laTong && !y.loi);
    if (!x.laTong && x.cap !== null && sau?.cap !== null && sau?.cap !== undefined && sau.cap > x.cap) { x.nhom = true; x.chon = false; }
  });
  return kq;
}

// Gợi ý đơn vị: dòng "Đơn vị: …" của bảng, không có thì theo độ lớn tổng kế hoạch đọc như tỷ (Cao Bằng ~ 10^4 tỷ / năm): ≤ 10^5 tỷ, ≤ 10^8 triệu,
// ≤ 10^11 nghìn, lớn hơn: đồng.
export function goiYDonVi(bang, cot, tuDong, kieu) {
  const chu = donViTheoChu(bang);
  if (chu) return chu;
  const tong = bang.slice(tuDong).reduce((t, d) => { const x = docSo((d || [])[cot.kh], kieu); return t + (typeof x === 'number' && x > 0 ? x : 0); }, 0);
  return tong > 1e11 ? 'dong' : tong > 1e8 ? 'nghin' : tong > 1e5 ? 'trieu' : 'ty';
}

// Dòng tổng đầu tiên có số (điền sẵn số tổng của kỳ / đối chiếu).
export const dongTong = (ds) => ds.find((d) => d.laTong && d.kh !== null) || null;

// Khớp tên với kỳ trước cùng loại: 'khop' (cùng tên chuẩn), 'gan' (chỉ khác dấu / ký tự — gợi ý dùng tên kỳ trước để giữ đúng đối tượng), 'moi'.
export function khopTen(tc, dsTruoc = []) {
  if (dsTruoc.some((x) => x.ten_chuan === tc)) return { kieu: 'khop' };
  const l = tenLong(tc); const g = l && dsTruoc.find((x) => tenLong(x.ten_chuan) === l);
  return g ? { kieu: 'gan', ten: g.ten, tenChuan: g.ten_chuan } : { kieu: 'moi' };
}
