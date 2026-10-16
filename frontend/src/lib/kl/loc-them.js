// Bộ lọc chi tiết và cách sắp xếp của màn Nhiệm vụ (v3.24; chủ dự án 16/10/2026: danh sách như V-Office — việc nhập sau lên trước — có lựa
// chọn "hạn gần trước"; "bộ lọc phải chi tiết để khi cần xem thông tin cụ thể bộ lọc đáp ứng được ngay"). Hàm thuần (không DOM, không
// Supabase): giải kỳ của ô "Thời gian nhập" / "Hạn xử lý" thành khoá của locRows (tong-hop.js), hai cách sắp xếp mới; "Mức cảnh báo" vẫn là
// sapXep (tong-hop.js). Thời gian nhập = created_at theo giờ Việt Nam. Unit test: frontend/tests/loc-them.test.mjs.
import { congNgay } from './ngay.js';
import { nhomCua } from './nhan.js';

export const KY_NHAP = [['hom-nay', 'Nhập hôm nay'], ['hom-qua', 'Nhập hôm qua'], ['7-ngay', 'Nhập 7 ngày qua'], ['30-ngay', 'Nhập 30 ngày qua'],
  ['thang-nay', 'Nhập trong tháng này'], ['tuy-chon', 'Nhập trong khoảng ngày…']];
export const KY_HAN = [['hom-nay', 'Đến hạn hôm nay'], ['3-ngay', 'Đến hạn trong 3 ngày tới'], ['7-ngay', 'Đến hạn trong 7 ngày tới'],
  ['30-ngay', 'Đến hạn trong 30 ngày tới'], ['thang-nay', 'Hạn trong tháng này'], ['thang-sau', 'Hạn trong tháng sau'], ['chua-co', 'Chưa có hạn'],
  ['tuy-chon', 'Hạn trong khoảng ngày…']];
export const CAP_GIAO = [['GOC', 'Giao từ văn bản'], ['TIEP_XUONG', 'Giao tiếp xuống (từ việc cấp trên)']];
export const SAP_XEP = [['moi', 'Mới nhập trước', 'Việc nhập lên hệ thống sau hiện trước (cùng một lần nhập: theo thứ tự mã)'],
  ['han', 'Hạn gần trước', 'Việc đang mở theo hạn xử lý tăng dần — quá hạn lên đầu; việc chưa có hạn, việc đã hoàn thành ở cuối'],
  ['canh-bao', 'Mức cảnh báo', 'Hỏa tốc, Thường trực giao, chỉ đạo chờ phản hồi, quá hạn lên trước (thứ tự cũ)']];
// Khoá lọc nằm trong "Thêm bộ lọc" (đếm số đang áp dụng ở nhãn).
export const KHOA_THEM = ['nhapKy', 'nguoiNhap', 'capGiao', 'hanKy', 'doKhan', 'hoiNghi', 'nganh', 'linhVuc', 'nguon'];
export const demLocThem = (loc = {}) => KHOA_THEM.filter((k) => loc[k]).length;

const ngay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '');
const dauNgayMs = (d) => Date.parse(`${d}T00:00:00+07:00`);   // 00:00 giờ Việt Nam
function dauThang(d, buoc = 0) {
  const [y, m] = d.split('-').map(Number); const t = y * 12 + (m - 1) + buoc;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
}
const cuoiThang = (d, buoc = 0) => congNgay(dauThang(d, buoc + 1), -1);
const thuTu = (tu, den) => (tu && den && den < tu ? [den, tu] : [tu, den]);   // khoảng gõ ngược: đổi chỗ

// loc.nhapKy (+ nhapTuNgay, nhapDenNgay khi 'tuy-chon') → nhapTuMs / nhapDenMs (mốc created_at; đến = 00:00 ngày sau, không gồm).
// loc.hanKy (+ hanTuNgay, hanDenNgay) → hanTu / hanDen ('YYYY-MM-DD', gồm hai đầu), hanMo (chỉ việc đang mở: "đến hạn trong N ngày tới"), chuaCoHan.
export function giaiLocThem(loc = {}, homNay) {
  const f = {};
  const nhap = { 'hom-nay': [homNay, homNay], 'hom-qua': [congNgay(homNay, -1), congNgay(homNay, -1)], '7-ngay': [congNgay(homNay, -6), homNay],
    '30-ngay': [congNgay(homNay, -29), homNay], 'thang-nay': [dauThang(homNay), homNay], 'tuy-chon': thuTu(ngay(loc.nhapTuNgay), ngay(loc.nhapDenNgay)) }[loc.nhapKy];
  if (nhap) {
    if (nhap[0]) f.nhapTuMs = dauNgayMs(nhap[0]);
    if (nhap[1]) f.nhapDenMs = dauNgayMs(congNgay(nhap[1], 1));
  }
  const toi = (n) => ({ hanTu: homNay, hanDen: congNgay(homNay, n), hanMo: true });
  const han = { 'hom-nay': toi(0), '3-ngay': toi(3), '7-ngay': toi(7), '30-ngay': toi(30),
    'thang-nay': { hanTu: dauThang(homNay), hanDen: cuoiThang(homNay) }, 'thang-sau': { hanTu: dauThang(homNay, 1), hanDen: cuoiThang(homNay, 1) },
    'chua-co': { chuaCoHan: true } }[loc.hanKy];
  if (han) Object.assign(f, han);
  if (loc.hanKy === 'tuy-chon') {
    const [tu, den] = thuTu(ngay(loc.hanTuNgay), ngay(loc.hanDenNgay));
    if (tu) f.hanTu = tu;
    if (den) f.hanDen = den;
  }
  return f;
}

const soSanhMa = new Intl.Collator('vi', { numeric: true }).compare;
const phutNhap = (r) => Math.floor((Date.parse(r.created_at) || 0) / 60000);
const THU_TU_DK = { HOA_TOC: 1, THUONG_KHAN: 2, KHAN: 3 };   // cùng bảng với do-khan.js (giữ file thuần)

// Mới nhập trước: theo phút nhập (giảm dần) — các việc của cùng một lần giao / một lô Excel đứng liền nhau theo thứ tự mã (tăng dần).
export const sapXepMoiNhap = (rows) => [...rows].sort((a, b) => phutNhap(b) - phutNhap(a) || soSanhMa(a.ma || '', b.ma || ''));

// Hạn gần trước: việc đang mở có hạn (hạn tăng dần — quá hạn lên đầu) → đang mở chưa có hạn → đã hoàn thành; cùng hạn thì độ khẩn cao trước,
// rồi mới nhập trước, rồi mã.
export function sapXepHan(rows) {
  const khoa = (r) => [nhomCua(r.nhom_dem).mo ? 0 : 1, r.han_xu_ly ? 0 : 1, r.han_xu_ly || '', THU_TU_DK[r.do_khan] || 4, -phutNhap(r)];
  return [...rows].map((r) => [khoa(r), r]).sort(([a, ra], [b, rb]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return soSanhMa(ra.ma || '', rb.ma || '');
  }).map(([, r]) => r);
}

// Việc "mới": nhập trong 24 giờ qua (nhãn Mới trên dòng).
export const laViecMoi = (r, now = Date.now()) => Boolean(r.created_at) && now - Date.parse(r.created_at) < 24 * 3600_000;

// Thời điểm nhập trên dòng: "nhập 08:05 hôm nay" / "nhập 16:40 hôm qua" / "nhập 09:12 ngày 3/10" (khác năm: "ngày 3/10/2025"); giờ Việt Nam.
const FMT_NHAP = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function nhanNhap(iso, homNay) {
  if (!iso) return '';
  const p = Object.fromEntries(FMT_NHAP.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const ngayNhap = `${p.year}-${p.month}-${p.day}`; const gio = `${p.hour}:${p.minute}`;
  if (ngayNhap === homNay) return `nhập ${gio} hôm nay`;
  if (ngayNhap === congNgay(homNay, -1)) return `nhập ${gio} hôm qua`;
  return `nhập ${gio} ngày ${Number(p.day)}/${Number(p.month)}${p.year === homNay.slice(0, 4) ? '' : `/${p.year}`}`;
}
