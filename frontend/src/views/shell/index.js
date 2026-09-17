// Khung sau đăng nhập (mockup v7): dải nhận diện, menu theo vai, hiện đúng một section trong trang; gọi view.init() theo vai.
import { $, show, setText } from '../../lib/dom.js';
import { DEPT_NAMES, ROLE_LABELS } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { getView } from '../registry.js';
import { renderNav, toggleNavKhac } from './nav.js';

export { setActiveNav, setNavBadge } from './nav.js';

const SECTIONS = ['viewDieuHanh', 'viewChiDaoDaGui', 'viewKl', 'viewGiaoViec', 'viewCanBo', 'viewBaoCao', 'viewNhanTin', 'viewQuanTri'];

// Hiện đúng một section trong vùng nội dung.
export function showSection(id) {
  SECTIONS.forEach((s) => show(s, s === id));
  window.scrollTo({ top: 0 });
}

export const sectionDangHien = (id) => !$(id)?.classList.contains('hidden');

export function initUserInterface() {
  const user = state.user;
  const view = getView(user.role_group);
  show('loginSection', false);
  show('appShell', true);
  setText('currentUserDisplay', user.full_name);
  setText('currentRoleDisplay', ROLE_LABELS[user.role_group] || '');
  setText('headerDeptDisplay', DEPT_NAMES[user.department] || (user.role_group === 'A0' ? 'Thường trực Tỉnh ủy Cao Bằng' : 'Văn phòng Tỉnh ủy Cao Bằng'));
  renderNav(user);
  view?.init();
}

// Nạp lại view hiện tại sau thao tác làm đổi dữ liệu (phân công lại, duyệt...).
export function reloadCurrentView() {
  getView(state.user?.role_group)?.reload();
}

registerActions({ toggleNavKhac });
