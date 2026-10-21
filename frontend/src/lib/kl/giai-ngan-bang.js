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
  if (s === '' || /^[-–—x]$/i.test(s)) return null;
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

const laTuSo = (t) => /^[(-]?\d[\d.,]*\)?%?$/.test(t) || /^[-–—x]$/i.test(t);
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
// HTML trong bộ nhớ tạm (Excel / Word / trang web chép bảng) → bảng; Excel ghi giá trị gốc ở thuộc tính x:num — dùng giá trị đó (không phụ thuộc dấu
// chấm, phẩy). Ô gộp ngang (colspan) thêm ô trống cho thẳng cột. Không có bảng → null.
export function bangTuHtml(html) {
  const t = /<table[\s\S]*?<\/table>/i.exec(String(html ?? ''));
  if (!t) return null;
  const kq = [];
  for (const tr of t[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const dong = [];
    for (const td of tr[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      const num = /\bx:num(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/i.exec(td[2]);
      const goc = num ? (num[1] ?? num[2] ?? num[3]) : undefined;
      const chu = giaiMa(td[3].replace(/<br\s*\/?>/gi, ' ').replace(/<\/p>/gi, ' ').replace(/<[^>]+>/g, '')).replace(KHOANG, ' ').trim();
      dong.push(goc !== undefined && goc !== '' && Number.isFinite(Number(goc)) ? Number(goc) : chu);
      const span = Number(/\bcolspan=["']?(\d+)/i.exec(td[2])?.[1] || 1);
      for (let k = 1; k < Math.min(span, 50); k++) dong.push('');
    }
    if (dong.some((x) => String(x).trim() !== '')) kq.push(dong);
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
// Đoán cột tên / kế hoạch / đã giải ngân và dòng bắt đầu dữ liệu: theo dòng tiêu đề nếu có (cột giải ngân ưu tiên "lũy kế / đến ngày", bỏ cột tỷ lệ),
// không thì cột chữ đầu + hai cột số đầu của dòng có số đầu tiên. tuDong của cách đoán thứ hai = dòng đó (coTieuDe = false).
export function doanCot(bang) {
  for (let i = 0; i < Math.min(bang.length, 15); i++) {
    const d = (bang[i] || []).map((o) => (typeof o === 'string' ? o.normalize('NFC') : ''));
    const kh = d.findIndex((o) => KHOP.kh.test(o) && !KHOP.da.test(o));
    const ung = d.map((o, j) => (j !== kh && KHOP.da.test(o) && !/(tỷ\s*lệ|%)/i.test(o) ? j : -1)).filter((j) => j >= 0);
    const da = ung.find((j) => KHOP.luyKe.test(d[j])) ?? ung[0];
    if (kh >= 0 && da !== undefined) {
      const ten = d.findIndex((o, j) => j !== kh && j !== da && KHOP.ten.test(o));
      const tuDong = bang.slice(i + 1).findIndex((x) => laSo(x?.[kh]) || laSo(x?.[da]));
      return { tuDong: tuDong >= 0 ? i + 1 + tuDong : i + 1, ten: ten >= 0 ? ten : 0, kh, da, coTieuDe: true };
    }
  }
  const mau = bang.find((d) => d.filter((v) => laSo(v) && String(v).trim() !== '').length >= 2) || [];
  const so = mau.map((v, j) => (laSo(v) && String(v).trim() !== '' ? j : -1)).filter((j) => j >= 0);
  const ten = mau.findIndex((v, j) => !so.includes(j) && !STT_TRAN.test(String(v ?? '').trim()) && String(v ?? '').trim().length > 1);
  return { tuDong: Math.max(0, bang.indexOf(mau)), ten: Math.max(0, ten), kh: so[0] ?? 1, da: so[1] ?? 2, coTieuDe: false };
}

// "Tổng cộng (A+B)", "Tổng số", "Cộng", "Trong đó:", "Toàn tỉnh" — không nhầm "Tổng công ty…", "Cộng đồng…".
const TONG = /^(tổng\s*cộng|tổng\s*số|tổng|cộng|trong\s*đó|toàn\s*tỉnh)(\s*[:(,]|\s*$|\s+(toàn|chung|các|a\s*\+))/i;
// Bảng → các dòng { dong (số dòng trong bảng, từ 1), ten, tenChuan, kh, da (tỷ đồng), laTong, loi, chon }.
// Dòng tổng / dòng lỗi / dòng trùng tên dòng trên: không tích sẵn.
export function docBang(bang, { cot, tuDong = 0, kieu = 'vi', donVi = 'ty' }) {
  const he = DON_VI[donVi] ?? 1; const kq = []; const daCo = new Set();
  for (let i = tuDong; i < bang.length; i++) {
    const d = bang[i] || []; const ten = tenGon(d[cot.ten]);
    const kh = docSo(d[cot.kh], kieu); const da = docSo(d[cot.da], kieu);
    if (!ten && kh === null && da === null) continue;
    const loi = !ten ? 'thiếu tên' : Number.isNaN(kh) || Number.isNaN(da) ? 'số không đọc được'
      : (kh ?? 0) < 0 || (da ?? 0) < 0 ? 'số âm' : kh === null && da === null ? 'không có số' : '';
    const laTong = TONG.test(ten); const tc = tenChuan(ten);
    const trung = !loi && !laTong && daCo.has(tc);
    if (!loi && !laTong) daCo.add(tc);
    kq.push({ dong: i + 1, ten, tenChuan: tc, kh: typeof kh === 'number' && !Number.isNaN(kh) ? lam(kh * he) : null,
      da: typeof da === 'number' && !Number.isNaN(da) ? lam(da * he) : null, laTong, loi: loi || (trung ? 'trùng tên dòng trên' : ''), chon: !loi && !laTong && !trung });
  }
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
