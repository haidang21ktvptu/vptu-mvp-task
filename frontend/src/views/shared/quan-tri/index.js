// Màn hình "Quản trị hệ thống" (GĐ8, thiết kế KL BTVTU Phần 5): mục dùng chung ngoài vai trò, chỉ có ở
// thanh bên khi tài khoản có quan_tri_he_thong (shell.renderNav). Ba phần: tài khoản + cờ, phụ trách
// phòng, nhật ký. Quyền thật kiểm ở hàm SQL admin_* và RLS; ở đây chỉ ẩn/hiện.
import { $, filterRowsByKeyword } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { loadAccountsCache } from '../../../auth/session.js';
import { setActiveNav, showSection } from '../../shell.js';
import { quanTriTemplate } from './template.js';
import { mountLyDoModal } from './ly-do-modal.js';
import { renderTaiKhoan, renderNhatKy, toggleQuanTriKl } from './tai-khoan.js';
import { renderPhuTrach, togglePhuTrach } from './phu-trach.js';

// Nạp lại danh bạ (cờ mới nhất) rồi vẽ ba phần; cập nhật cả cờ của chính người đang đăng nhập.
export async function loadQuanTri() {
  await loadAccountsCache();
  const me = state.accounts.find((a) => a.id === state.user.id);
  if (me) state.user = { ...state.user, quan_tri_kl: me.quan_tri_kl, quan_tri_he_thong: me.quan_tri_he_thong };
  renderTaiKhoan();
  await Promise.all([renderPhuTrach(), renderNhatKy()]);
}

function openQuanTri() {
  if (!state.user?.quan_tri_he_thong) return;
  showSection('viewQuanTri');
  setActiveNav('navQuanTri');
  loadQuanTri();
}

export function registerQuanTriView() {
  $('viewQuanTri').innerHTML = quanTriTemplate;
  mountLyDoModal();
  $('qtTimTaiKhoan').addEventListener('input', (e) => filterRowsByKeyword('qtTaiKhoanBody', e.target.value));
  registerActions({
    openQuanTri,
    loadQuanTri,
    toggleQuanTriKl: (ds) => toggleQuanTriKl(ds, loadQuanTri),
    togglePhuTrach: (ds) => togglePhuTrach(ds, loadQuanTri),
  });
}
