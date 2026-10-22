// Đường dẫn trên thanh địa chỉ (v3.29 — chủ dự án 22/10/2026, CAU-HOI O-7): đổi màn → ghi đường dẫn của màn (history.pushState, gọi từ
// setActiveNav và khi đổi thẻ Quản trị); Quay lại / Tiến tới → mở đúng chức năng (popstate); vào app (đăng nhập xong, tải lại, mở đường dẫn được gửi)
// → moManDau mở chức năng theo đường dẫn nếu thuộc menu / quyền của người dùng, không thì trang đầu của vai kèm thông báo. Bảng đường dẫn và quy tắc
// chọn ở lib/tuyen.js (thuần). Đây chỉ chọn màn để vẽ — quyền thật vẫn ở RLS / hàm DB.
import { state } from '../../lib/state.js';
import { goiHanhDong } from '../../lib/actions.js';
import { notify } from '../../components/toast.js';
import { tachDuong, chonMo, duongCua } from '../../lib/tuyen.js';

const BASE = import.meta.env?.BASE_URL || '/';
const MAN_RIENG = ['viewRaSoatMucTieu', 'viewCaNhan', 'viewTroGiup'];   // màn ngoài menu có đường dẫn riêng (theo section đang hiện)
let menu = [];            // mục menu của người đang đăng nhập (renderNav)
let macDinhVai = null;    // mở trang đầu của vai (init của view)
let thayThe = 0;          // > 0: đang mở theo đường dẫn — ghi bằng replaceState, không thêm bước lịch sử
const quyen = {};         // quyền mở màn ngoài menu: { quanTri: (u) => bool, raSoat: (u) => bool } — màn tự đăng ký (tránh import vòng)
let theQt = () => '';     // khu đang chọn của Quản trị

export const datMenuDuongDan = (ds) => { menu = ds || []; };
export const dangKyQuyenDuongDan = (ten, fn) => { quyen[ten] = fn; };
export const dangKyTheQuanTri = (fn) => { theQt = fn; };
const manRiengDangHien = () => MAN_RIENG.find((id) => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); }) || '';

// Ghi đường dẫn của màn đang hiện nếu khác thanh địa chỉ (bỏ cả ?p= còn lại). navId: mục menu vừa sáng ('' = màn ngoài menu); thay: sửa bước
// lịch sử hiện tại thay vì thêm bước (màn tự chọn lại thẻ khác thẻ trong đường dẫn).
export function ghiDuongDan(navId, { thay = false } = {}) {
  if (!state.user) return;
  const duong = duongCua({ nav: navId, man: manRiengDangHien(), vai: state.user.role_group, theQt: navId === 'navQuanTri' ? theQt() : '' });
  if (!duong) return;
  const url = `${BASE}${duong}`;
  if (location.pathname === url && !location.search) return;
  history[thay || thayThe > 0 ? 'replaceState' : 'pushState'](null, '', `${url}${location.hash}`);
}

function moTheoDuong(macDinh) {
  const u = state.user;
  const t = tachDuong(location.pathname, BASE);
  const kq = t ? chonMo(t, { vai: u?.role_group, menu, quyen: { quanTri: Boolean(quyen.quanTri?.(u)), raSoat: Boolean(quyen.raSoat?.(u)) } }) : null;
  thayThe += 1;
  let p;
  try {
    if (kq?.action) p = goiHanhDong(kq.action, kq.ds);
    else {
      p = macDinh?.();
      if (kq?.tuChoi) notify('Đường dẫn không thuộc chức năng của tài khoản đồng chí — đã mở trang đầu.');
    }
  } finally {
    Promise.resolve(p).catch(() => null).finally(() => { thayThe -= 1; });   // màn nạp xong mới ghi đường dẫn (setActiveNav sau await)
  }
  return p;
}

// Trang đầu khi vào app — thay cho gọi thẳng openTongQuan / openDieuHanh trong init của từng vai.
export function moManDau(macDinh) {
  macDinhVai = macDinh;
  return moTheoDuong(macDinh);
}

window.addEventListener('popstate', () => { if (state.user && macDinhVai) moTheoDuong(macDinhVai); });

// 404.html của site (GitHub Pages) chuyển đường dẫn lạ / sai chữ hoa về app kèm ?p=<phần sau base>: đặt lại thanh địa chỉ trước khi chạy app.
export function khoiPhucTu404() {
  const p = new URLSearchParams(location.search).get('p');
  if (p === null) return;
  history.replaceState(null, '', `${BASE}${p.split(/[?#]/)[0].replace(/^\/+/, '')}${location.hash}`);
}
