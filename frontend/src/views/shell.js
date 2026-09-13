// Khung sau đăng nhập (DESIGN mục 4): thanh bên chàm với điều hướng theo vai trò, đầu trang,
// hiện đúng view theo vai trò (SPEC AUTH-5), gọi view.init().
import { $, show, setText, escapeHtml } from '../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../lib/constants.js';
import { state } from '../lib/state.js';
import { getView } from './registry.js';

const SECTION_BY_ROLE = { A1: 'viewThuongTruc', A2: 'viewLanhDaoVP', A3: 'viewChuyenVien' };

// Mỗi mục: { id, label, action, tab } — id giữ nguyên tên nút tab cũ để kịch bản e2e không đổi.
function navItemHtml(item) {
  const data = Object.entries(item.data || {}).map(([k, v]) => `data-${k}="${escapeHtml(v)}"`).join(' ');
  const badge = item.badgeId ? `<span id="${item.badgeId}" class="huy-hieu hidden">0</span>` : '';
  return `<button type="button" id="${item.id}" class="nav-item" data-action="${item.action}" ${data}>${escapeHtml(item.label)}${badge}</button>`;
}

// Mục "Nhắn tin" dùng chung mọi vai trò (MSG-1); id giữ nguyên để e2e và features/messages dùng.
const MESSAGES_NAV = { id: 'dmBubbleLauncher', label: 'Nhắn tin', action: 'openDMPicker', badgeId: 'dmBubbleBadge' };

export function renderNav(items) {
  $('mainNav').innerHTML = [...items, MESSAGES_NAV].map(navItemHtml).join('');
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
  renderNav(view?.nav || []);

  Object.entries(SECTION_BY_ROLE).forEach(([role, id]) => show(id, user.role_group === role));
  view?.init();
}

// Nạp lại view hiện tại sau thao tác làm đổi dữ liệu (phân công lại, duyệt...).
export function reloadCurrentView() {
  getView(state.user?.role_group)?.reload();
}
