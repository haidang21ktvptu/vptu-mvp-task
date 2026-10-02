// Menu bánh răng trên dải (GĐ23): mục chung (Hồ sơ, Đổi mật khẩu, Thông báo, Trợ giúp) → Kiểu giao diện (v9: Thanh lịch / Trang nghiêm, Nền tối;
// shell/kieu-giao-dien.js, nhớ theo máy) → mục theo vai (A0 Bản gọn; A1 Phân công phụ trách,
// Ngưỡng cảnh báo; A2 Ủy quyền giao việc) → nhóm Quản trị hệ thống (chỉ cờ quan_tri_he_thong) → Đăng xuất (đỏ, cuối). Gạch ngăn giữa nhóm.
// Frontend chỉ ẩn/hiện; quyền thật ở hàm SQL / RLS / Edge Function.
import { $, show, escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { handleLogout } from '../../auth/session.js';
import { kieuHienTai, nenToiDangBat } from './kieu-giao-dien.js';

export const LINK_SAO_LUU = 'https://github.com/haidang21ktvptu/vptu-mvp-task/actions/workflows/backup-dinh-ky.yml';

// chon: mục chọn (role menuitemradio / menuitemcheckbox + aria-checked) — một thuộc tính role duy nhất, trình đọc màn hình đọc được trạng thái.
const muc = (label, action, data = {}, chon = null) => `<button type="button" role="${chon ? chon[0] : 'menuitem'}" data-action="${action}" ${Object.entries(data).map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(' ')}${chon ? ` aria-checked="${String(chon[1])}"` : ''}>${escapeHtml(label)}</button>`;
const qt = (label, tab) => muc(label, 'openQuanTri', { tab });

export function menuBanhRang(user) {
  const nhom = [[
    muc('Hồ sơ cá nhân', 'openCaNhan', { tab: 'hoSo' }),
    muc('Đổi mật khẩu', 'moDoiMatKhau'),
    muc('Thông báo', 'openCaNhan', { tab: 'thongBao' }),
    muc('Trợ giúp', 'openTroGiup'),
  ], [
    '<span class="br-nhom">Kiểu giao diện</span>',
    ...[['thanh-lich', 'Thanh lịch, xanh lam'], ['trang-nghiem', 'Trang nghiêm, đỏ son']].map(([kieu, ten]) => muc(ten, 'datKieuGiaoDien', { kieu }, ['menuitemradio', kieuHienTai() === kieu])),
    muc('Nền tối', 'doiNenToi', {}, ['menuitemcheckbox', nenToiDangBat()]),
  ]];
  if (user.role_group === 'A0') nhom.push([muc('Bản gọn', 'toggleBanGon', {}, ['menuitemcheckbox', user.tuy_chon?.ban_gon === true])]);
  if (user.role_group === 'A1') nhom.push([qt('Phân công phụ trách', 'qtKhuPhuTrach'), qt('Ngưỡng cảnh báo', 'qtKhuCauHinh')]);
  if (user.role_group === 'A2') nhom.push([qt('Ủy quyền giao việc', 'qtKhuUyQuyen')]);
  if (user.quan_tri_he_thong) {
    nhom.push([`<span class="br-nhom">Quản trị hệ thống</span>`, qt('Tài khoản', 'qtKhuTaiKhoan'), qt('Danh mục', 'qtKhuDanhMuc'), qt('Dọn dữ liệu', 'qtKhuDonDuLieu'),
      qt('Nhật ký hệ thống', 'qtKhuNhatKyHeThong'), `<a role="menuitem" href="${LINK_SAO_LUU}" target="_blank" rel="noopener">Sao lưu (workflow GitHub)</a>`]);
  }
  nhom.push([`<button type="button" role="menuitem" id="logoutBtn" class="br-thoat" data-action="dangXuat">Đăng xuất</button>`]);
  return nhom.map((n) => n.join('')).join('<hr>');
}

export function renderBanhRang(user = state.user) {
  $('banhRangMenu').innerHTML = menuBanhRang(user);
}

function dongBanhRang() {
  show('banhRangMenu', false);
  $('banhRangBtn').setAttribute('aria-expanded', 'false');
}

function toggleBanhRang() {
  const mo = $('banhRangMenu').classList.contains('hidden');
  show('banhRangMenu', mo);
  $('banhRangBtn').setAttribute('aria-expanded', String(mo));
}

// Bấm ra ngoài hoặc chọn một mục → đóng menu (mục vẫn chạy action của nó qua delegation).
function onClickNgoai(e) {
  if ($('banhRangMenu')?.classList.contains('hidden')) return;
  if (e.target.closest('#banhRangBtn')) return;
  dongBanhRang();
}

export function mountBanhRang() {
  document.addEventListener('click', onClickNgoai);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongBanhRang(); });
  registerActions({ toggleBanhRang, dangXuat: handleLogout });
}
