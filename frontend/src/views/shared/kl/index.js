// Màn hình "Kết luận BTVTU" (GĐ10 PR 10B): mục dùng chung mọi vai trò — A3 thấy việc mình chủ trì, A2 phòng mình,
// A1 theo phụ trách/kiêm nhiệm, quan_tri_kl tất cả — phạm vi do RLS (kl_pham_vi 0019) quyết định, frontend chỉ vẽ.
import { $ } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { setActiveNav, showSection } from '../../shell.js';
import { klTemplate } from './template.js';
import { loadKl, ganBoLoc, locKlNhom, boKlLoc, setKlLoc } from './danh-sach.js';
import { mountKlCapNhatModal } from './cap-nhat-modal.js';
import { toggleKlChiTiet } from './chi-tiet.js';

// Mở màn hình; loc (tuỳ chọn) = bộ lọc do dashboard A1 truyền sang (thay thế toàn bộ bộ lọc hiện có).
export function openKl(loc) {
  showSection('viewKl');
  setActiveNav('navKl');
  if (loc) setKlLoc(loc, true);
  loadKl();
}

export function registerKlView() {
  $('viewKl').innerHTML = klTemplate;
  mountKlCapNhatModal(loadKl);
  ganBoLoc();
  registerActions({ openKl: () => openKl(), loadKl, locKlNhom, boKlLoc, toggleKlChiTiet });
}
