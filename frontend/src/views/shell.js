// Khung sau đăng nhập (DESIGN mục 4): thanh bên chàm với điều hướng theo vai trò, đầu trang,
// hiện đúng view theo vai trò (SPEC AUTH-5), gọi view.init().
import { $, show, setText, escapeHtml } from '../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../lib/constants.js';
import { state } from '../lib/state.js';
import { getView } from './registry.js';

// "Thứ Hai, 14/9/2026" — ngày ở đầu trang (ẩn trên điện thoại).
function formatLongDate(d) {
  const s = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SECTION_BY_ROLE = { A1: 'viewThuongTruc', A2: 'viewLanhDaoVP', A3: 'viewChuyenVien' };
// Mục dùng chung ngoài vai trò (GĐ8): chỉ hiện khi tài khoản có cờ tương ứng; mục khai báo data-section
// tự hiện section của mình, các mục còn lại đưa về section theo vai trò.
const EXTRA_SECTIONS = ['viewQuanTri'];
const QUAN_TRI_NAV = { id: 'navQuanTri', label: 'Quản trị hệ thống', action: 'openQuanTri', data: { section: 'viewQuanTri' } };

// Mỗi mục: { id, label, action, tab } — id giữ nguyên tên nút tab cũ để kịch bản e2e không đổi.
function navItemHtml(item) {
  const data = Object.entries(item.data || {}).map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(' ');
  const badge = item.badgeId ? `<span id="${item.badgeId}" class="huy-hieu hidden">0</span>` : '';
  return `<button type="button" id="${item.id}" class="nav-item" data-action="${item.action}" ${data}>${escapeHtml(item.label)}${badge}</button>`;
}

// Mục "Nhắn tin" dùng chung mọi vai trò (MSG-1); id giữ nguyên để e2e và features/messages dùng.
const MESSAGES_NAV = { id: 'dmBubbleLauncher', label: 'Nhắn tin', action: 'openDMPicker', badgeId: 'dmBubbleBadge' };

export function renderNav(items) {
  // Quản trị hệ thống: quan_tri_he_thong (cờ, phân công) hoặc quan_tri_kl (danh mục lĩnh vực) — quyền thật ở RLS/hàm.
  const extra = state.user?.quan_tri_he_thong || state.user?.quan_tri_kl ? [QUAN_TRI_NAV] : [];
  $('mainNav').innerHTML = [...items, ...extra, MESSAGES_NAV].map(navItemHtml).join('');
}

// Hiện đúng một section trong vùng nội dung (theo vai trò hoặc mục dùng chung).
export function showSection(id) {
  [...Object.values(SECTION_BY_ROLE), ...EXTRA_SECTIONS].forEach((s) => show(s, s === id));
}

export function showRoleSection() {
  showSection(SECTION_BY_ROLE[state.user?.role_group]);
}

// Đánh dấu mục đang chọn ở thanh bên.
export function setActiveNav(id) {
  document.querySelectorAll('#mainNav .nav-item').forEach((el) => el.classList.toggle('on', el.id === id));
}

export function initUserInterface() {
  const user = state.user;
  const view = getView(user.role_group);
  show('loginSection', false);
  show('appShell', true);

  setText('currentUserDisplay', `${user.full_name} (${user.position_title})`);
  setText('currentRoleDisplay', ROLE_LABELS[user.role_group] || '');
  setText('headerDeptDisplay', DEPT_NAMES[user.department] || 'Văn phòng Tỉnh ủy Cao Bằng');
  setText('headerDate', formatLongDate(new Date()));
  renderNav(view?.nav || []);

  showRoleSection();
  view?.init();
}

// Nạp lại view hiện tại sau thao tác làm đổi dữ liệu (phân công lại, duyệt...).
export function reloadCurrentView() {
  getView(state.user?.role_group)?.reload();
}

// Bấm mục theo vai trò (không có data-section) khi đang ở mục dùng chung → về section vai trò.
// Chạy trước uỷ quyền data-action ở body (bắt ở mainNav, giai đoạn nổi bọt) nên view đã hiện khi nạp.
$('mainNav').addEventListener('click', (event) => {
  const el = event.target.closest('.nav-item');
  if (!el || el.dataset.section || el.id === MESSAGES_NAV.id) return;
  showRoleSection();
  setActiveNav(el.id); // view theo vai trò có thể không tự đánh dấu (ví dụ A3 chỉ có một mục)
});
