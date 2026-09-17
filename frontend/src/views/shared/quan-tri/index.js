// Màn hình "Quản trị" (thiết kế KL BTVTU Phần 5; GĐ23 mở rộng): khu theo quyền — Phân công phụ trách (quan_tri_he_thong, Chánh VP), Tài khoản
// (quan_tri_he_thong), Danh mục (quan_tri_kl), Nhật ký cấp quyền, Ngưỡng cảnh báo (A1: CVP sửa, PCVP xem), Ủy quyền giao việc (A2),
// Dọn dữ liệu + Nhật ký hệ thống (quan_tri_he_thong). Vào từ pill "Quản trị" (cờ) hoặc menu bánh răng (data-tab). Quyền thật ở hàm SQL / RLS /
// Edge Function; ở đây chỉ ẩn/hiện tab và khu.
import { $, show, filterRowsByKeyword } from '../../../lib/dom.js';
import { state, isChief } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { loadAccountsCache } from '../../../auth/session.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell/index.js';
import { quanTriTemplate } from './template.js';
import { mountLyDoModal } from './ly-do-modal.js';
import { loadDanhMuc } from './danh-muc.js';
import { renderTaiKhoan, renderNhatKy, toggleQuanTriKl, toggleQuanTriHeThong, khoaTaiKhoan, resetMatKhau } from './tai-khoan.js';
import { mountTaiKhoanForm } from './tai-khoan-form.js';
import { renderPhuTrach, togglePhuTrach, ketThucKiemNhiem } from './phu-trach.js';
import { mountKiemNhiemModal } from './kiem-nhiem-modal.js';
import { mountDanhMucLinhVuc, renderDanhMucLinhVuc } from './danh-muc-linh-vuc.js';
import { renderCauHinh, luuCauHinh } from './cau-hinh.js';
import { renderUyQuyen, guiUyQuyen, thuUyQuyen } from './uy-quyen.js';
import { renderDonDuLieu, mountDonDuLieu } from './don-du-lieu.js';
import { renderNhatKyHeThong } from './nhat-ky-he-thong.js';

// Khu nào mở cho ai (thứ tự = thứ tự tab). Hàm quyền đọc state.user (cờ mới nhất sau loadQuanTri).
const KHU = {
  qtKhuPhuTrach: { tab: 'qtTabPhuTrach', cho: (u) => u.quan_tri_he_thong || (u.role_group === 'A1' && isChief()), ve: renderPhuTrach },
  qtKhuTaiKhoan: { tab: 'qtTabTaiKhoan', cho: (u) => u.quan_tri_he_thong, ve: renderTaiKhoan },
  qtKhuDanhMuc: { tab: 'qtTabDanhMuc', cho: (u) => u.quan_tri_kl, ve: renderDanhMucLinhVuc },
  qtKhuCauHinh: { tab: 'qtTabCauHinh', cho: (u) => u.quan_tri_he_thong || u.role_group === 'A1', ve: renderCauHinh },
  qtKhuUyQuyen: { tab: 'qtTabUyQuyen', cho: (u) => u.role_group === 'A2', ve: renderUyQuyen },
  qtKhuNhatKy: { tab: 'qtTabNhatKy', cho: (u) => u.quan_tri_he_thong || u.quan_tri_kl, ve: renderNhatKy },
  qtKhuDonDuLieu: { tab: 'qtTabDonDuLieu', cho: (u) => u.quan_tri_he_thong, ve: renderDonDuLieu },
  qtKhuNhatKyHeThong: { tab: 'qtTabNhatKyHeThong', cho: (u) => u.quan_tri_he_thong, ve: renderNhatKyHeThong },
};
export const coQuyenQuanTri = (u) => Boolean(u) && Object.values(KHU).some((k) => k.cho(u));
let tabDangChon = null;

function chonTabQuanTri({ tab }) {
  tabDangChon = tab;
  Object.entries(KHU).forEach(([k, d]) => { show(k, k === tab); $(d.tab).setAttribute('aria-selected', String(k === tab)); });
}

// Nạp lại danh bạ (cờ mới nhất) + danh mục rồi vẽ các khu theo quyền của chính người đang đăng nhập.
export async function loadQuanTri() {
  await loadAccountsCache();
  const me = state.accounts.find((a) => a.id === state.user.id);
  if (me) state.user = { ...state.user, quan_tri_kl: me.quan_tri_kl, quan_tri_he_thong: me.quan_tri_he_thong, quan_tri_kl_het_han: me.quan_tri_kl_het_han };
  const u = state.user;
  if (u.quan_tri_kl || u.quan_tri_he_thong) { try { await loadDanhMuc(); } catch (e) { notifyError('Không đọc được danh mục ngành/lĩnh vực: ' + e.message); } }
  const hopLe = Object.keys(KHU).filter((k) => KHU[k].cho(u));
  Object.entries(KHU).forEach(([k, d]) => show(d.tab, hopLe.includes(k)));
  show('qtKhuNhatKyQuyen', Boolean(u.quan_tri_he_thong)); show('qtKhuNhatKyDanhMuc', Boolean(u.quan_tri_kl));
  chonTabQuanTri({ tab: hopLe.includes(tabDangChon) ? tabDangChon : hopLe[0] });
  await Promise.all(hopLe.map((k) => KHU[k].ve()));
}

// Mở màn hình; data-tab (bánh răng) chọn thẳng khu nếu người dùng có quyền vào khu đó.
function openQuanTri(ds = {}) {
  if (!coQuyenQuanTri(state.user)) return;
  if (ds.tab && KHU[ds.tab]) tabDangChon = ds.tab;
  showSection('viewQuanTri');
  setActiveNav('navQuanTri');
  loadQuanTri();
}

export function registerQuanTriView() {
  $('viewQuanTri').innerHTML = quanTriTemplate;
  mountLyDoModal();
  mountKiemNhiemModal(loadQuanTri);
  mountDanhMucLinhVuc(loadQuanTri);
  mountTaiKhoanForm(loadQuanTri);
  mountDonDuLieu();
  $('qtTimTaiKhoan').addEventListener('input', (e) => filterRowsByKeyword('qtTaiKhoanBody', e.target.value));
  $('qtUyQuyenForm').addEventListener('submit', (e) => guiUyQuyen(e, loadQuanTri));
  registerActions({
    openQuanTri, loadQuanTri, chonTabQuanTri,
    toggleQuanTriKl: (ds) => toggleQuanTriKl(ds, loadQuanTri),
    toggleQuanTriHeThong: (ds) => toggleQuanTriHeThong(ds, loadQuanTri),
    khoaTaiKhoan: (ds) => khoaTaiKhoan(ds, loadQuanTri),
    resetMatKhau: (ds) => resetMatKhau(ds, loadQuanTri),
    togglePhuTrach: (ds) => togglePhuTrach(ds, loadQuanTri),
    ketThucKiemNhiem: (ds) => ketThucKiemNhiem(ds, loadQuanTri),
    luuCauHinh: (ds) => luuCauHinh(ds, loadQuanTri),
    thuUyQuyen: (ds) => thuUyQuyen(ds, loadQuanTri),
  });
}
