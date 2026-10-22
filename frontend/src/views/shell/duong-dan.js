// Đường dẫn trên thanh địa chỉ (v3.29 — chủ dự án 22/10/2026, CAU-HOI O-7): đổi màn → ghi đường dẫn của màn (history.pushState, gọi từ
// setActiveNav và khi đổi thẻ Quản trị / Giao việc); Quay lại / Tiến tới → mở đúng chức năng (popstate); vào app (đăng nhập xong, tải lại, mở đường dẫn
// được gửi) → moManDau mở chức năng theo đường dẫn nếu thuộc menu / quyền của người dùng, không thì trang đầu của vai kèm thông báo. Bảng đường dẫn và
// quy tắc chọn ở lib/tuyen.js (thuần). Đây chỉ chọn màn để vẽ — quyền thật vẫn ở RLS / hàm DB.
// Một lượt bấm có thể sáng nhiều mục liên tiếp (chuyên viên: "Việc tôi theo dõi" mở danh sách rồi đổi mục) → các lần ghi trong cùng lượt gộp làm một
// (mục cuối, ghi ở microtask). Mở theo đường dẫn / Quay lại (đồng bộ, trước await đầu tiên của màn) → sửa bước lịch sử hiện tại, không thêm bước.
// Chưa có phiên (mở đường dẫn, hết phiên, đăng xuất): thanh địa chỉ ghi "/Dang-nhap" (chủ dự án 22/10/2026); chức năng đang mở giữ trong
// history.state.tiep — không ghi lên đường dẫn — để đăng nhập xong mở đúng chức năng, bước "/Dang-nhap" được thay bằng đường dẫn chức năng.
import { state } from '../../lib/state.js';
import { goiHanhDong } from '../../lib/actions.js';
import { notify } from '../../components/toast.js';
import { tachDuong, chonMo, duongCua, laDangNhap, DUONG_DANG_NHAP } from '../../lib/tuyen.js';

// Gốc của app ("/vptu-mvp-task/", staging "/vptu-mvp-task/staging/") — Vite thay import.meta.env.BASE_URL lúc build; chạy trong Node (unit test): "/".
const goc = () => { try { return import.meta.env.BASE_URL || '/'; } catch { return '/'; } };
const BASE = goc();
const MAN_RIENG = ['viewRaSoatMucTieu', 'viewCaNhan', 'viewTroGiup'];   // màn ngoài menu có đường dẫn riêng (theo section đang hiện)
let menu = [];               // mục menu của người đang đăng nhập (renderNav)
let macDinhVai = null;       // mở trang đầu của vai (init của view)
let dangMoTheoDuong = false; // trong phần đồng bộ của lượt mở theo đường dẫn / Quay lại
let cho = null;              // lần ghi đang chờ của lượt hiện tại: { navId, thay }
const quyen = {};            // quyền mở màn ngoài menu: { quanTri, raSoat, nhapExcel } (u) => bool — màn tự đăng ký (tránh import vòng)
const theCua = {};           // thẻ đang chọn của màn có thẻ: { navQuanTri: () => 'qtKhuTaiKhoan', navGiaoViec: () => 'nhap' }

export const datMenuDuongDan = (ds) => { menu = ds || []; };
export const dangKyQuyenDuongDan = (ten, fn) => { quyen[ten] = fn; };
export const dangKyThe = (navId, fn) => { theCua[navId] = fn; };
const manRiengDangHien = () => MAN_RIENG.find((id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); }) || '';

function ghiCho() {
  const c = cho; cho = null;
  if (!c || !state.user) return;
  const duong = duongCua({ nav: c.navId, man: manRiengDangHien(), vai: state.user.role_group, the: theCua[c.navId]?.() || '' });
  if (!duong) return;
  const url = `${BASE}${duong}`;
  if (location.pathname === url && !location.search) return;
  history[c.thay ? 'replaceState' : 'pushState'](null, '', `${url}${location.hash}`);
}
// Ghi đường dẫn của màn đang hiện nếu khác thanh địa chỉ (bỏ cả ?p= còn lại). navId: mục menu vừa sáng ('' = màn ngoài menu); thay: sửa bước lịch sử
// hiện tại thay vì thêm bước (màn tự chọn lại thẻ khác thẻ trong đường dẫn).
export function ghiDuongDan(navId, { thay = false } = {}) {
  if (!state.user) return;
  const dau = !cho;
  cho = { navId, thay: Boolean(cho?.thay) || thay || dangMoTheoDuong };
  if (dau) queueMicrotask(ghiCho);
}

// Màn đăng nhập: "/Dang-nhap" (giữ chức năng của đường dẫn đang mở — hoặc của lần trước — trong history.state.tiep).
export function ghiDangNhap() {
  const t = tachDuong(location.pathname, BASE);
  const tiep = t?.duong && !laDangNhap(t.duong) ? [t.duong, t.the].filter(Boolean).join('/') : String(history.state?.tiep || '');
  history.replaceState(tiep ? { tiep } : null, '', `${BASE}${DUONG_DANG_NHAP}${location.hash}`);
}
// Đường dẫn để chọn màn: đang ở "/Dang-nhap" (vừa đăng nhập) → chức năng đã mở trước khi đăng nhập, không có thì trang đầu.
function duongCanMo() {
  const t = tachDuong(location.pathname, BASE);
  if (!t || !laDangNhap(t.duong)) return t;
  const tiep = String(history.state?.tiep || '');
  return tiep ? tachDuong(`${BASE}${tiep}`, BASE) : null;
}

function moTheoDuong(macDinh) {
  const u = state.user;
  const t = duongCanMo();
  const q = Object.fromEntries(['quanTri', 'raSoat', 'nhapExcel'].map((k) => [k, Boolean(quyen[k]?.(u))]));
  const kq = t ? chonMo(t, { vai: u?.role_group, menu, quyen: q }) : null;
  dangMoTheoDuong = true;
  try {
    if (kq?.action) return goiHanhDong(kq.action, kq.ds);
    if (kq?.tuChoi) notify('Đường dẫn không thuộc chức năng của tài khoản đồng chí — đã mở trang đầu.');
    return macDinh?.();
  } finally { dangMoTheoDuong = false; }
}

// Trang đầu khi vào app — thay cho gọi thẳng openTongQuan / openDieuHanh trong init của từng vai.
export function moManDau(macDinh) {
  macDinhVai = macDinh;
  return moTheoDuong(macDinh);
}

if (typeof window !== 'undefined') window.addEventListener('popstate', () => { if (state.user && macDinhVai) moTheoDuong(macDinhVai); });

// 404.html của site (GitHub Pages) chuyển đường dẫn lạ / sai chữ hoa về app kèm ?p=<phần sau base>: đặt lại thanh địa chỉ trước khi chạy app.
export function khoiPhucTu404() {
  const p = new URLSearchParams(location.search).get('p');
  if (p === null) return;
  history.replaceState(null, '', `${BASE}${p.split(/[?#]/)[0].replace(/^\/+/, '')}${location.hash}`);
}
