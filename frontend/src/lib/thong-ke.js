// Thống kê sử dụng (0104, v3.24) — hàm thuần cho Quản trị › Thống kê sử dụng: khoảng thời gian theo giờ Việt Nam, giờ hiển thị theo giờ Việt
// Nam, nhãn trình duyệt / hệ điều hành từ user-agent, tóm tắt đăng nhập, gom số nhiệm vụ nhập mới theo kỳ (ngày / tuần bắt đầu thứ Hai / tháng
// / năm — khớp date_trunc của Postgres). Không chạm DOM, không gọi mạng — unit test frontend/tests/thong-ke.test.mjs.
import { homNayVN, congNgay } from './kl/ngay.js';

const MUI_GIO_VN = 'Asia/Ho_Chi_Minh';
export const dauNgayVN = (ngay) => `${ngay}T00:00:00+07:00`;   // 00:00 giờ Việt Nam của ngày 'YYYY-MM-DD' (timestamptz)
export const MOC_NHAT_KY = '2026-01-01';   // "Từ khi có nhật ký": trước mọi dòng (hệ thống chạy từ 9/2026)

// '16/10/2026 08:05' theo giờ Việt Nam (máy người xem ở múi giờ nào cũng như nhau); rỗng → ''.
export function gioVN(iso) {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: MUI_GIO_VN, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso));
  const lay = (t) => p.find((x) => x.type === t).value;
  return `${lay('day')}/${lay('month')}/${lay('year')} ${lay('hour')}:${lay('minute')}`;
}

// Kỳ xem nhật ký đăng nhập. tuy = { tu, den } ('YYYY-MM-DD') khi ma = 'tuy-chon'. Trả { tuNgay, denNgay } (ngày, gồm cả hai đầu) và { tu, den }
// (timestamptz, den là 00:00 ngày sau) cho qt_thong_ke_dang_nhap; khoảng sai → null.
export const KY_DANG_NHAP = [['hom-nay', 'Hôm nay'], ['7-ngay', '7 ngày'], ['30-ngay', '30 ngày'], ['thang-nay', 'Tháng này'], ['tat-ca', 'Từ khi có nhật ký']];
export function khoangDangNhap(ma, homNay = homNayVN(), tuy = {}) {
  const LUI = { 'hom-nay': 0, '7-ngay': 6, '30-ngay': 29 };
  const tuNgay = ma in LUI ? congNgay(homNay, -LUI[ma]) : ma === 'thang-nay' ? `${homNay.slice(0, 8)}01` : ma === 'tuy-chon' ? tuy.tu : MOC_NHAT_KY;
  const denNgay = ma === 'tuy-chon' ? tuy.den : homNay;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuNgay || '') || !/^\d{4}-\d{2}-\d{2}$/.test(denNgay || '') || denNgay < tuNgay) return null;
  return { tuNgay, denNgay, tu: dauNgayVN(tuNgay), den: dauNgayVN(congNgay(denNgay, 1)) };
}

// User-agent → "Chrome 109 · Windows 7" (đủ để quản trị nhận ra máy cơ quan / điện thoại); không rõ → 'Không rõ'.
export function thietBi(ua) {
  const s = String(ua || '');
  if (!s) return 'Không rõ';
  const ban = (re) => (re.exec(s)?.[1] || '').split('.')[0];
  const trinh = /coc_coc_browser\//i.test(s) ? `Cốc Cốc ${ban(/coc_coc_browser\/([\d.]+)/i)}`
    : /Edg(?:A|iOS)?\//.test(s) ? `Edge ${ban(/Edg(?:A|iOS)?\/([\d.]+)/)}`
      : /OPR\//.test(s) ? `Opera ${ban(/OPR\/([\d.]+)/)}`
        : /Firefox\/|FxiOS\//.test(s) ? `Firefox ${ban(/(?:Firefox|FxiOS)\/([\d.]+)/)}`
          : /Zalo/i.test(s) ? 'Zalo'
            : /Chrome\/|CriOS\//.test(s) ? `Chrome ${ban(/(?:Chrome|CriOS)\/([\d.]+)/)}`
              : /Safari\//.test(s) ? `Safari ${ban(/Version\/([\d.]+)/)}` : 'Trình duyệt khác';
  const he = /Windows NT 10\.0/.test(s) ? 'Windows 10/11' : /Windows NT 6\.3/.test(s) ? 'Windows 8.1' : /Windows NT 6\.2/.test(s) ? 'Windows 8'
    : /Windows NT 6\.1/.test(s) ? 'Windows 7' : /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Mac OS X|Macintosh/.test(s) ? 'macOS'
      : /Linux/.test(s) ? 'Linux' : '';
  return [trinh.trim(), he].filter(Boolean).join(' · ');
}

// Tóm tắt một danh sách dòng của qt_thong_ke_dang_nhap (đã lọc phòng / vai / tìm): số tài khoản đã / chưa đăng nhập trong kỳ, số lượt,
// số người đăng nhập hôm nay, số người hoạt động trong 15 phút qua (theo mọi thời gian, không theo kỳ).
export const PHUT_DANG_HOAT_DONG = 15;
export function tomTatDangNhap(ds, { homNay = homNayVN(), now = Date.now() } = {}) {
  const dau = Date.parse(dauNgayVN(homNay));
  const homNayCo = (r) => Boolean(r.lan_cuoi_tong) && Date.parse(r.lan_cuoi_tong) >= dau;
  const dangHd = (r) => Boolean(r.hoat_dong_cuoi_tong) && now - Date.parse(r.hoat_dong_cuoi_tong) <= PHUT_DANG_HOAT_DONG * 60_000;
  return { tong: ds.length, da: ds.filter((r) => r.so_lan > 0).length, chua: ds.filter((r) => !r.so_lan).length,
    luot: ds.reduce((s, r) => s + (r.so_lan || 0), 0), homNay: ds.filter(homNayCo).length, dangHd: ds.filter(dangHd).length,
    loc: { tat: () => true, da: (r) => r.so_lan > 0, chua: (r) => !r.so_lan, homNay: homNayCo, dangHd } };
}

// ---- Nhiệm vụ nhập mới ----
export const DON_VI = { ngay: ['day', 'ngày'], tuan: ['week', 'tuần'], thang: ['month', 'tháng'], nam: ['year', 'năm'] };
export const CACH_NHAP = { GIAO_VIEC: 'Giao việc trên hệ thống', TIEP_XUONG: 'Giao tiếp xuống', EXCEL: 'Nhập từ Excel' };
const thang = (y, m) => `${y}-${String(m).padStart(2, '0')}-01`;

// Đầu kỳ chứa ngày d; kỳ sau / kỳ trước của một đầu kỳ.
export function dauKy(d, donVi) {
  if (donVi === 'thang') return `${d.slice(0, 8)}01`;
  if (donVi === 'nam') return `${d.slice(0, 4)}-01-01`;
  if (donVi !== 'tuan') return d;
  const [y, m, n] = d.split('-').map(Number);
  return congNgay(d, -((new Date(Date.UTC(y, m - 1, n)).getUTCDay() + 6) % 7));   // thứ Hai = 0
}
export function kyKe(k, donVi, buoc = 1) {
  const [y, m] = k.split('-').map(Number);
  if (donVi === 'ngay') return congNgay(k, buoc);
  if (donVi === 'tuan') return congNgay(k, 7 * buoc);
  if (donVi === 'nam') return `${y + buoc}-01-01`;
  const t = y * 12 + (m - 1) + buoc;
  return thang(Math.floor(t / 12), (t % 12) + 1);
}
// Khoảng mặc định: 14 ngày, 8 tuần, 12 tháng, 5 năm gần nhất (kết thúc hôm nay).
export function khoangMacDinh(donVi, homNay = homNayVN()) {
  const so = { ngay: 14, tuan: 8, thang: 12, nam: 5 }[donVi] || 14;
  return { tu: kyKe(dauKy(homNay, donVi), donVi, -(so - 1)), den: homNay };
}
// Mọi đầu kỳ từ tu tới den (gồm kỳ không có việc — biểu đồ không bỏ khoảng trống); giữ tối đa 400 kỳ GẦN NHẤT.
export function cacKy(tu, den, donVi) {
  const ds = [];
  for (let k = dauKy(tu, donVi); k <= den && ds.length < 5000; k = kyKe(k, donVi)) ds.push(k);
  return ds.slice(-400);
}
// Độ dài khoảng xem tối đa (số ngày) theo đơn vị — biểu đồ đọc được, số dòng thống kê vừa phải; hàm SQL cho tối đa 3660 ngày.
export const KHOANG_TOI_DA = { ngay: 366, tuan: 1099, thang: 3660, nam: 3660 };
export const NHAN_KHOANG_TOI_DA = { ngay: '366 ngày', tuan: '157 tuần (khoảng 3 năm)', thang: '10 năm', nam: '10 năm' };
export function nhanKy(k, donVi, ngan = false) {
  const [y, m, d] = k.split('-');
  if (donVi === 'ngay') return ngan ? `${d}/${m}` : `ngày ${d}/${m}/${y}`;
  if (donVi === 'tuan') { const c = congNgay(k, 6); return ngan ? `${d}/${m}` : `tuần ${d}/${m} – ${c.slice(8)}/${c.slice(5, 7)}/${c.slice(0, 4)}`; }
  if (donVi === 'thang') return ngan ? `T${Number(m)}/${y.slice(2)}` : `tháng ${Number(m)}/${y}`;
  return `năm ${y}`;
}
export const khoangCuaKy = (k, donVi) => ({ tu: k, den: congNgay(kyKe(k, donVi), -1) });

// Cách nhập của một dòng v_nhiem_vu — khớp CASE của qt_thong_ke_nhap_moi (0104): việc do lô Excel TẠO (idExcel: dong_nhap có kết quả trong
// KQ_LO_TAO_VIEC; CAP_NHAT = lô chỉ sửa việc có sẵn) hoặc nguồn excel của bộ dữ liệu ban đầu → EXCEL; có việc cha → TIEP_XUONG; còn lại GIAO_VIEC.
export const KQ_LO_TAO_VIEC = ['GIAO', 'DA_XONG', 'CHO_NGHIEM_THU', 'DA_HOAN_THIEN'];
export const cachNhapCua = (r, idExcel = new Set()) => (r.nguon === 'excel' || idExcel.has(r.id) ? 'EXCEL' : r.nhiem_vu_cha ? 'TIEP_XUONG' : 'GIAO_VIEC');
// Trục dọc "đẹp" của biểu đồ cột: bước 1/2/5/10/20/50… sao cho tối đa 5 khoảng; đỉnh ≥ một bước.
export function trucDep(mx) {
  const buoc = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((b) => Math.ceil(Math.max(mx, 1) / b) <= 5) || 2000;
  const dinh = Math.max(buoc, Math.ceil(mx / buoc) * buoc);
  return { dinh, vach: Array.from({ length: dinh / buoc + 1 }, (_, i) => i * buoc) };
}

// Gom dòng qt_thong_ke_nhap_moi ({ ky, nguoi_nhap, cach, so_viec }) theo kỳ và theo người nhập, có lọc người nhập / cách nhập.
export function gomNhapMoi(dong, { tu, den, donVi, nguoi = '', cach = '' }) {
  const moi = () => ({ tong: 0, GIAO_VIEC: 0, TIEP_XUONG: 0, EXCEL: 0 });
  const ky = cacKy(tu, den, donVi).map((k) => ({ ky: k, ...moi(), nguoi: {} }));
  const theoKy = new Map(ky.map((x) => [x.ky, x]));
  const theoNguoi = new Map(); const tong = moi();
  (dong || []).filter((r) => (!nguoi || (r.nguoi_nhap || '') === nguoi) && (!cach || r.cach === cach)).forEach((r) => {
    const n = r.so_viec || 0; const id = r.nguoi_nhap || ''; const x = theoKy.get(r.ky);
    if (x) { x.tong += n; x[r.cach] += n; x.nguoi[id] = (x.nguoi[id] || 0) + n; }
    const g = theoNguoi.get(id) || { nguoi: id, ...moi() };
    g.tong += n; g[r.cach] += n; theoNguoi.set(id, g);
    tong.tong += n; tong[r.cach] += n;
  });
  return { ky, nguoi: [...theoNguoi.values()].sort((a, b) => b.tong - a.tong), tong: { ...tong, soNguoi: [...theoNguoi.keys()].filter(Boolean).length } };
}
