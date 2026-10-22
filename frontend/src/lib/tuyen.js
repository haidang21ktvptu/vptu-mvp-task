// Đường dẫn riêng cho từng chức năng (v3.29 — chủ dự án 22/10/2026, CAU-HOI O-7): "…/vptu-mvp-task/Tong-quan", "…/Quan-tri/Tai-khoan". Phần THUẦN
// (không DOM, không mạng; unit test frontend/tests/tuyen.test.mjs; vite.config.js đọc DS_TEP để dựng sẵn tệp cho GitHub Pages): bảng đường dẫn ↔ mục
// menu / màn, tách và chuẩn hoá đường dẫn (chữ hoa / thường, gạch chéo cuối, ".html"), chọn chức năng được mở. Đường dẫn chỉ gồm tên chức năng — không
// chứa mã việc hay dữ liệu. Mở được hay không do menu của người đang đăng nhập quyết định (menuCuaVai) — và dữ liệu vẫn chỉ theo RLS.
export const TUYEN = [
  { duong: 'Tong-quan', nav: 'navTongQuan' },
  { duong: 'Can-xu-ly', nav: 'navDieuHanh' },
  { duong: 'Viec-cua-toi', nav: 'navDieuHanh', vai: 'A3' },   // chuyên viên: mục "Việc của tôi" (cùng màn Cần xử lý)
  { duong: 'Giao-viec', nav: 'navGiaoViec' },
  { duong: 'Nhap-Excel', nav: 'navGiaoViec', theGv: 'nhap' },   // thẻ của Giao việc (người nhập liệu); mục menu riêng "Nhập từ Excel" cũng về đây
  { duong: 'Cho-hoan-thien', nav: 'navGiaoViec', theGv: 'cho' },
  { duong: 'Nhiem-vu', nav: 'navKl' },
  { duong: 'Viec-toi-theo-doi', nav: 'navTheoDoi' },
  { duong: 'Theo-van-ban', nav: 'navTheoVanBan' },
  { duong: 'Can-bo', nav: 'navCanBo' },
  { duong: 'Bao-cao', nav: 'navBaoCao' },
  { duong: 'Chi-dao-da-gui', nav: 'navChiDaoDaGui' },
  { duong: 'Chi-dao-Thuong-truc', nav: 'navChiDaoTTThuKy' },
  { duong: 'Quan-tri', nav: 'navQuanTri' },
  { duong: 'Ra-soat-phan-loai', man: 'viewRaSoatMucTieu', action: 'moRaSoatMucTieu' },
  { duong: 'Ca-nhan', man: 'viewCaNhan', action: 'openCaNhan' },
  { duong: 'Tro-giup', man: 'viewTroGiup', action: 'openTroGiup' },
];
// Thẻ của màn Quản trị (khu → đuôi đường dẫn, theo nhãn thẻ).
export const THE_QUAN_TRI = {
  qtKhuPhuTrach: 'Phan-cong-phu-trach', qtKhuTaiKhoan: 'Tai-khoan', qtKhuDanhMuc: 'Danh-muc-linh-vuc', qtKhuMucTieu: 'Danh-muc-muc-tieu',
  qtKhuCauHinh: 'Nguong-canh-bao', qtKhuAi: 'Cau-hinh-AI', qtKhuNgayNghi: 'Ngay-nghi', qtKhuNhatKy: 'Nhat-ky', qtKhuDonDuLieu: 'Don-du-lieu',
  qtKhuNhatKyHeThong: 'Nhat-ky-he-thong', qtKhuThongKe: 'Thong-ke-su-dung',
};
// Màn đăng nhập (chủ dự án 22/10/2026): chưa có phiên thì thanh địa chỉ ghi "/Dang-nhap" — không phải chức năng của menu (chonMo không nhận).
export const DUONG_DANG_NHAP = 'Dang-nhap';
// Mọi tệp cần dựng sẵn trên GitHub Pages (bản sao index.html): "Dang-nhap", "Tong-quan", …, "Quan-tri/Tai-khoan".
export const DS_TEP = [DUONG_DANG_NHAP, ...new Set(TUYEN.map((t) => t.duong)), ...Object.values(THE_QUAN_TRI).map((d) => `Quan-tri/${d}`)];

const thuong = (s) => String(s || '').toLowerCase();
export const laDangNhap = (duong) => thuong(duong) === thuong(DUONG_DANG_NHAP);
// Mã nhiệm vụ trên đường dẫn (chủ dự án 22/10/2026 17:02): "…/<Chức năng>/NV-9601" — chỉ nhận đúng dạng NV-<số> (mã do CSDL sinh); chuỗi khác không
// phải mã. Không có tệp dựng sẵn cho từng việc (không đưa mã / dữ liệu lên trang công khai): Pages trả 404.html → app (?p=).
const MA_VIEC = /^NV-\d{1,9}$/i;
export const laMaViec = (s) => MA_VIEC.test(String(s || ''));
// { duong, the } (tachDuong) → thêm ma: đoạn cuối là mã việc thì tách ra (chữ hoa), phần còn lại là chức năng; "/NV-9601" → trang đầu + việc.
export function tachViec(t) {
  if (!t) return t;
  const phan = [t.duong, ...String(t.the || '').split('/')].filter(Boolean);
  if (!laMaViec(phan.at(-1))) return { ...t, ma: '' };
  return { duong: phan[0] && phan.length > 1 ? phan[0] : '', the: phan.slice(1, -1).join('/'), ma: phan.at(-1).toUpperCase() };
}
// Đường dẫn chức năng (không mã việc) của { duong, the } để so màn: "Quan-tri/Tai-khoan", "Tong-quan".
export const duongChucNang = (t) => [t?.duong, t?.the].filter(Boolean).join('/');
// pathname + base ("/vptu-mvp-task/" hoặc "/vptu-mvp-task/staging/") → { duong, the } (phần sau base, đã bỏ ".html", gạch chéo, giải mã); ngoài base → null.
export function tachDuong(pathname, base = '/') {
  let p = String(pathname || '');
  try { p = decodeURIComponent(p); } catch { /* giữ nguyên chuỗi lạ */ }
  const b = thuong(base.endsWith('/') ? base : `${base}/`);
  if (thuong(p) === b.slice(0, -1)) return { duong: '', the: '' };   // "/vptu-mvp-task" (thiếu "/" cuối)
  if (!thuong(p).startsWith(b)) return null;
  const phan = p.slice(b.length).replace(/\.html$/i, '').split('/').filter(Boolean);
  if (phan.length === 1 && thuong(phan[0]) === 'index') return { duong: '', the: '' };
  return { duong: phan[0] || '', the: phan.slice(1).join('/') };
}
// Mục bảng theo tên đường dẫn (không phân biệt hoa / thường); vai A3 ưu tiên dòng riêng của chuyên viên.
export function timTuyen(duong, vai = null) {
  const ds = TUYEN.filter((t) => thuong(t.duong) === thuong(duong));
  return ds.find((t) => t.vai === vai) || ds.find((t) => !t.vai) || ds[0] || null;
}
export function timThe(duong) {
  const k = Object.keys(THE_QUAN_TRI).find((x) => thuong(THE_QUAN_TRI[x]) === thuong(duong));
  return k || null;
}
// Đường dẫn (không base) của màn đang hiện: màn ngoài menu (Rà soát, Cá nhân, Trợ giúp) theo section; còn lại theo mục menu đang sáng; the = thẻ đang
// chọn của màn có thẻ (Quản trị: "/Quan-tri/<thẻ>"; Giao việc: thẻ Nhập từ Excel / Chờ hoàn thiện có đường dẫn riêng ở cấp đầu).
export function duongCua({ nav = '', man = '', vai = null, the = '' } = {}) {
  const theoMan = TUYEN.find((t) => t.man && t.man === man);
  if (theoMan) return theoMan.duong;
  if (nav === 'navNhapExcel') return duongCua({ nav: 'navGiaoViec', the: the && the !== 'giao' ? the : 'nhap' });   // người chỉ nhập liệu (không có Giao việc)
  const ds = TUYEN.filter((t) => t.nav && t.nav === nav);
  if (nav === 'navGiaoViec') return (ds.find((x) => x.theGv && x.theGv === the) || ds.find((x) => !x.theGv))?.duong || '';
  const t = ds.find((x) => x.vai === vai) || ds.find((x) => !x.vai);
  if (!t) return '';
  return t.nav === 'navQuanTri' && THE_QUAN_TRI[the] ? `${t.duong}/${THE_QUAN_TRI[the]}` : t.duong;
}
// Chọn chức năng mở từ đường dẫn: menu = mục menu của người dùng ([{ id, action }]); quyen = { quanTri, raSoat, nhapExcel } (màn / thẻ theo quyền).
// → { action, ds: dataset } | { tuChoi: true } (đường dẫn lạ / không thuộc vai) | null (không có đường dẫn — mở trang đầu). Đường dẫn chuẩn (chữ hoa,
// tên theo vai) do màn ghi lại khi mở (setActiveNav → views/shell/duong-dan.js).
export function chonMo({ duong, the }, { vai = null, menu = [], quyen = {} } = {}) {
  if (!duong) return null;
  const t = timTuyen(duong, vai);
  if (!t) return { tuChoi: true };
  if (t.man) return t.man !== 'viewRaSoatMucTieu' || quyen.raSoat ? { action: t.action, ds: {} } : { tuChoi: true };
  if (t.theGv) {   // thẻ nhập liệu của Giao việc: người nhập liệu có Giao việc hoặc mục "Nhập từ Excel"
    const co = menu.some((m) => m.id === 'navGiaoViec' || m.id === 'navNhapExcel');
    return co && quyen.nhapExcel ? { action: 'openNhapExcel', ds: { tab: t.theGv } } : { tuChoi: true };
  }
  const muc = menu.find((m) => m.id === t.nav);
  if (t.nav === 'navQuanTri') {
    if (!muc && !quyen.quanTri) return { tuChoi: true };
    const k = the ? timThe(the) : null;
    return { action: 'openQuanTri', ds: k ? { tab: k } : {} };
  }
  return muc ? { action: muc.action, ds: {} } : { tuChoi: true };
}
