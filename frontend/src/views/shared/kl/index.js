// Màn hình "Nhiệm vụ" (GĐ10 PR 10B, GĐ14 thực thể thống nhất): mục dùng chung mọi vai trò — A3 thấy việc mình là Owner
// hoặc người theo dõi, A2 phòng mình, A1 theo phụ trách/kiêm nhiệm, quan_tri_kl tất cả — phạm vi do RLS (kl_pham_vi 0025)
// quyết định, frontend chỉ vẽ. Nút "Giao việc" cho A1/A2/quan_tri_kl (quyền thật trong hàm giao_viec).
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell.js';
import { xacNhanNhanViec } from '../../../lib/kl/du-lieu.js';
import { klTemplate } from './template.js';
import { loadKl, ganBoLoc, locKlNhom, boKlLoc, setKlLoc } from './danh-sach.js';
import { mountKlCapNhatModal } from './cap-nhat-modal.js';
import { mountKlThemModal } from './them-modal.js';
import { toggleKlChiTiet } from './chi-tiet.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';

export const duocGiaoViec = () => ['A1', 'A2'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl);

// Mở màn hình; loc (tuỳ chọn) = bộ lọc do dashboard A1 truyền sang (thay thế toàn bộ bộ lọc hiện có).
export function openKl(loc) {
  showSection('viewKl');
  setActiveNav('navKl');
  show('klNutThem', duocGiaoViec()); // ẩn/hiện cho đẹp; hàm giao_viec 0025 là chốt
  if (loc) setKlLoc(loc, true);
  loadKl();
  // Realtime: đọc lại danh sách khi có thay đổi, chỉ khi màn hình này đang hiện; chỉ báo kết nối ở #klKetNoi.
  batKlRealtime(() => { if (!$('viewKl').classList.contains('hidden')) loadKl(); }, (m) => hienKetNoi('klKetNoi', m));
}

// Xác nhận đã nhận việc (GV-5): chỉ ghi lịch sử, không đổi trạng thái/hạn — đồng hồ không dừng (CN-2.2).
async function xacNhanNhanViecAction({ id }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? 'Đã ghi nhận đồng chí xác nhận nhận việc. Hạn và trạng thái không đổi.' : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    loadKl();
  } catch (e) {
    notifyError('Không xác nhận được: ' + e.message);
  }
}

export function registerKlView() {
  $('viewKl').innerHTML = klTemplate;
  mountKlCapNhatModal(loadKl);
  mountKlThemModal(loadKl);
  ganBoLoc();
  // Mục thanh bên: đặt lại toàn bộ bộ lọc (kể cả bộ lọc dashboard truyền sang) để thấy đủ phạm vi.
  registerActions({ openKl: () => openKl({}), loadKl, locKlNhom, boKlLoc, toggleKlChiTiet, xacNhanNhanViec: xacNhanNhanViecAction });
}
