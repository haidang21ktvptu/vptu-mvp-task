// Màn hình "Quản trị" (thiết kế KL BTVTU Phần 5; mockup: mục riêng theo cờ, phân công phụ trách lên đầu): có ở menu khi tài khoản có
// quan_tri_he_thong (phân công, tài khoản + cờ, nhật ký cấp quyền) hoặc quan_tri_kl (danh mục lĩnh vực + nhật ký danh mục).
// Quyền thật kiểm ở hàm SQL admin_* và RLS; ở đây chỉ ẩn/hiện tab và khu.
import { $, show, filterRowsByKeyword } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { loadAccountsCache } from '../../../auth/session.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { quanTriTemplate } from './template.js';
import { mountLyDoModal } from './ly-do-modal.js';
import { loadDanhMuc } from './danh-muc.js';
import { renderTaiKhoan, renderNhatKy, toggleQuanTriKl } from './tai-khoan.js';
import { renderPhuTrach, togglePhuTrach, ketThucKiemNhiem } from './phu-trach.js';
import { mountKiemNhiemModal } from './kiem-nhiem-modal.js';
import { mountDanhMucLinhVuc, renderDanhMucLinhVuc } from './danh-muc-linh-vuc.js';

export const coQuyenQuanTri = (u) => Boolean(u?.quan_tri_he_thong || u?.quan_tri_kl);
const TAB_HE_THONG = ['qtKhuPhuTrach', 'qtKhuTaiKhoan'];
const KHU = ['qtKhuPhuTrach', 'qtKhuTaiKhoan', 'qtKhuDanhMuc', 'qtKhuNhatKy'];
const TAB_CUA_KHU = { qtKhuPhuTrach: 'qtTabPhuTrach', qtKhuTaiKhoan: 'qtTabTaiKhoan', qtKhuDanhMuc: 'qtTabDanhMuc', qtKhuNhatKy: 'qtTabNhatKy' };
let tabDangChon = null;

function chonTabQuanTri({ tab }) {
  tabDangChon = tab;
  KHU.forEach((k) => { show(k, k === tab); $(TAB_CUA_KHU[k]).setAttribute('aria-selected', String(k === tab)); });
}

// Nạp lại danh bạ (cờ mới nhất) + danh mục rồi vẽ các phần theo cờ của chính người đang đăng nhập.
export async function loadQuanTri() {
  await loadAccountsCache();
  const me = state.accounts.find((a) => a.id === state.user.id);
  if (me) state.user = { ...state.user, quan_tri_kl: me.quan_tri_kl, quan_tri_he_thong: me.quan_tri_he_thong };
  try { await loadDanhMuc(); } catch (e) { notifyError('Không đọc được danh mục ngành/lĩnh vực: ' + e.message); }
  const ht = Boolean(state.user.quan_tri_he_thong); const kl = Boolean(state.user.quan_tri_kl);
  TAB_HE_THONG.forEach((k) => show(TAB_CUA_KHU[k], ht));
  show('qtTabDanhMuc', kl);
  show('qtKhuNhatKyQuyen', ht); show('qtKhuNhatKyDanhMuc', kl);
  const viec = [];
  if (ht) { renderTaiKhoan(); viec.push(renderPhuTrach(), renderNhatKy()); }
  if (kl) viec.push(renderDanhMucLinhVuc());
  const khuHopLe = KHU.filter((k) => (TAB_HE_THONG.includes(k) ? ht : k === 'qtKhuDanhMuc' ? kl : true));
  chonTabQuanTri({ tab: khuHopLe.includes(tabDangChon) ? tabDangChon : khuHopLe[0] });
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
    openQuanTri, loadQuanTri, chonTabQuanTri,
    toggleQuanTriKl: (ds) => toggleQuanTriKl(ds, loadQuanTri),
    togglePhuTrach: (ds) => togglePhuTrach(ds, loadQuanTri),
    ketThucKiemNhiem: (ds) => ketThucKiemNhiem(ds, loadQuanTri),
  });
}
