// Màn hình "Quản trị hệ thống" (GĐ8–9, thiết kế KL BTVTU Phần 5): mục dùng chung ngoài vai trò, có ở thanh bên
// khi tài khoản có quan_tri_he_thong (tài khoản + cờ, phụ trách phòng/kiêm nhiệm lĩnh vực, nhật ký) hoặc
// quan_tri_kl (danh mục lĩnh vực). Quyền thật kiểm ở hàm SQL admin_* và RLS; ở đây chỉ ẩn/hiện.
import { $, show, filterRowsByKeyword } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { loadAccountsCache } from '../../../auth/session.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell.js';
import { quanTriTemplate } from './template.js';
import { mountLyDoModal } from './ly-do-modal.js';
import { loadDanhMuc } from './danh-muc.js';
import { renderTaiKhoan, renderNhatKy, toggleQuanTriKl } from './tai-khoan.js';
import { renderPhuTrach, togglePhuTrach, ketThucKiemNhiem } from './phu-trach.js';
import { mountKiemNhiemModal } from './kiem-nhiem-modal.js';
import { mountDanhMucLinhVuc, renderDanhMucLinhVuc } from './danh-muc-linh-vuc.js';

export const coQuyenQuanTri = (u) => Boolean(u?.quan_tri_he_thong || u?.quan_tri_kl);

// Nạp lại danh bạ (cờ mới nhất) + danh mục rồi vẽ các phần theo cờ của chính người đang đăng nhập.
export async function loadQuanTri() {
  await loadAccountsCache();
  const me = state.accounts.find((a) => a.id === state.user.id);
  if (me) state.user = { ...state.user, quan_tri_kl: me.quan_tri_kl, quan_tri_he_thong: me.quan_tri_he_thong };
  try {
    await loadDanhMuc();
  } catch (e) {
    notifyError('Không đọc được danh mục ngành/lĩnh vực: ' + e.message);
  }
  show('qtKhuHeThong', state.user.quan_tri_he_thong);
  show('qtKhuDanhMuc', state.user.quan_tri_kl);
  const viec = [];
  if (state.user.quan_tri_he_thong) {
    renderTaiKhoan();
    viec.push(renderPhuTrach(), renderNhatKy());
  }
  if (state.user.quan_tri_kl) viec.push(renderDanhMucLinhVuc());
  await Promise.all(viec);
}

function openQuanTri() {
  if (!coQuyenQuanTri(state.user)) return;
  showSection('viewQuanTri');
  setActiveNav('navQuanTri');
  loadQuanTri();
}

export function registerQuanTriView() {
  $('viewQuanTri').innerHTML = quanTriTemplate;
  mountLyDoModal();
  mountKiemNhiemModal(loadQuanTri);
  mountDanhMucLinhVuc(loadQuanTri);
  $('qtTimTaiKhoan').addEventListener('input', (e) => filterRowsByKeyword('qtTaiKhoanBody', e.target.value));
  registerActions({
    openQuanTri,
    loadQuanTri,
    toggleQuanTriKl: (ds) => toggleQuanTriKl(ds, loadQuanTri),
    togglePhuTrach: (ds) => togglePhuTrach(ds, loadQuanTri),
    ketThucKiemNhiem: (ds) => ketThucKiemNhiem(ds, loadQuanTri),
  });
}
