// Màn hình "Kết luận BTVTU" (GĐ10 PR 10B): mục dùng chung mọi vai trò — A3 thấy việc mình chủ trì, A2 phòng mình,
// A1 theo phụ trách/kiêm nhiệm, quan_tri_kl tất cả — phạm vi do RLS (kl_pham_vi 0019) quyết định, frontend chỉ vẽ.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { setActiveNav, showSection } from '../../shell.js';
import { klTemplate } from './template.js';
import { loadKl, ganBoLoc, locKlNhom, boKlLoc, setKlLoc } from './danh-sach.js';
import { mountKlCapNhatModal } from './cap-nhat-modal.js';
import { mountKlThemModal } from './them-modal.js';
import { toggleKlChiTiet } from './chi-tiet.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';

// Mở màn hình; loc (tuỳ chọn) = bộ lọc do dashboard A1 truyền sang (thay thế toàn bộ bộ lọc hiện có).
export function openKl(loc) {
  showSection('viewKl');
  setActiveNav('navKl');
  show('klNutThem', Boolean(state.user?.quan_tri_kl)); // ẩn/hiện cho đẹp; policy INSERT 0016 là chốt
  if (loc) setKlLoc(loc, true);
  loadKl();
  // Realtime: đọc lại danh sách khi có thay đổi, chỉ khi màn hình này đang hiện; chỉ báo kết nối ở #klKetNoi.
  batKlRealtime(() => { if (!$('viewKl').classList.contains('hidden')) loadKl(); }, (m) => hienKetNoi('klKetNoi', m));
}

export function registerKlView() {
  $('viewKl').innerHTML = klTemplate;
  mountKlCapNhatModal(loadKl);
  mountKlThemModal(loadKl);
  ganBoLoc();
  // Mục thanh bên: đặt lại toàn bộ bộ lọc (kể cả bộ lọc dashboard truyền sang) để thấy đủ phạm vi.
  registerActions({ openKl: () => openKl({}), loadKl, locKlNhom, boKlLoc, toggleKlChiTiet });
}
