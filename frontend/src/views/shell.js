// Khung sau đăng nhập: header, hiện đúng view theo vai trò (SPEC AUTH-5), gọi view.init().
import { show, setText } from '../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../lib/constants.js';
import { state } from '../lib/state.js';
import { getView } from './registry.js';

const SECTION_BY_ROLE = { A1: 'viewThuongTruc', A2: 'viewLanhDaoVP', A3: 'viewChuyenVien' };

export function initUserInterface() {
  const user = state.user;
  show('loginSection', false);
  show('mainHeader', true);
  show('dmBubbleLauncher', true);

  setText('currentUserDisplay', `${user.full_name} (${user.position_title})`);
  setText('currentRoleDisplay', ROLE_LABELS[user.role_group] || '');
  setText('headerDeptDisplay', DEPT_NAMES[user.department] || 'Văn phòng Tỉnh ủy Cao Bằng');

  Object.entries(SECTION_BY_ROLE).forEach(([role, id]) => show(id, user.role_group === role));
  getView(user.role_group)?.init();
}

// Nạp lại view hiện tại sau thao tác làm đổi dữ liệu (phân công lại, duyệt...).
export function reloadCurrentView() {
  getView(state.user?.role_group)?.reload();
}
