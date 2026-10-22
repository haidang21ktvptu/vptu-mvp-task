// Màn hình "Quản trị" (thiết kế KL BTVTU Phần 5; GĐ23 mở rộng): khu theo quyền — Phân công phụ trách (quan_tri_he_thong, Chánh VP), Tài khoản
// (quan_tri_he_thong), Danh mục (mọi tài khoản trừ Thường trực — Đợt F v3.21, 0096), Nhật ký cấp quyền, Ngưỡng cảnh báo (A1: CVP sửa, PCVP xem),
// Dọn dữ liệu + Nhật ký hệ thống + Thống kê sử dụng (quan_tri_he_thong); v3.25: Danh mục mục tiêu (cán bộ nhập liệu xem, thêm; quản trị hệ thống sửa, khoá,
// gộp, quy tắc nhận diện), Cấu hình AI (quản trị hệ thống / toàn quyền). Vào từ pill "Quản trị" (cờ) hoặc menu bánh răng (data-tab). Quyền thật ở hàm SQL / RLS /
// Edge Function; ở đây chỉ ẩn/hiện tab và khu.
import { $, show, filterRowsByKeyword } from '../../../lib/dom.js';
import { state, isChief } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { loadAccountsCache } from '../../../auth/session.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { ghiDuongDan, dangKyQuyenDuongDan, dangKyTheQuanTri } from '../../shell/duong-dan.js';   // v3.29: "/Quan-tri/<thẻ>"
import { quanTriTemplate } from './template.js';
import { mountLyDoModal } from './ly-do-modal.js';
import { loadDanhMuc } from './danh-muc.js';
import { laNguoiNhap } from '../../../lib/kl/nhap/du-lieu.js';
import { renderTaiKhoan, renderNhatKy, toggleThuKyTT, toggleQuanTriHeThong, khoaTaiKhoan, resetMatKhau } from './tai-khoan.js';
import { mountTaiKhoanForm } from './tai-khoan-form.js';
import { mountBanGiao } from './ban-giao.js';
import { mountSuaTaiKhoan } from './sua-tai-khoan.js';
import { mountChuyenTheoDoi } from './chuyen-theo-doi.js';
import { renderPhuTrach, togglePhuTrach, ketThucKiemNhiem } from './phu-trach.js';
import { mountKiemNhiemModal } from './kiem-nhiem-modal.js';
import { mountDanhMucLinhVuc, renderDanhMucLinhVuc } from './danh-muc-linh-vuc.js';
import { renderCauHinh, luuCauHinh } from './cau-hinh.js';
import { renderDonDuLieu, mountDonDuLieu } from './don-du-lieu.js';
import { renderNhatKyHeThong } from './nhat-ky-he-thong.js';
import { renderNgayNghi, themNgayNghi, boNgayNghi } from './ngay-nghi.js';
import { renderThongKe, mountThongKe } from './thong-ke.js';
import { renderMucTieu, mountMucTieu } from './muc-tieu-dm.js';   // v3.25 (0107–0111): danh mục mục tiêu then chốt, quy tắc nhận diện
import { renderCauHinhAi, mountCauHinhAi } from './cau-hinh-ai.js';   // v3.25 (0112): trợ lý AI
import { laQuanTriMt } from './muc-tieu-thuan.js';

// Khu nào mở cho ai (thứ tự = thứ tự tab). Hàm quyền đọc state.user (cờ mới nhất sau loadQuanTri).
const KHU = {
  qtKhuPhuTrach: { tab: 'qtTabPhuTrach', cho: (u) => u.quan_tri_he_thong || (u.role_group === 'A1' && isChief()), ve: renderPhuTrach },
  qtKhuTaiKhoan: { tab: 'qtTabTaiKhoan', cho: (u) => u.quan_tri_he_thong, ve: renderTaiKhoan },
  qtKhuDanhMuc: { tab: 'qtTabDanhMuc', cho: (u) => laNguoiNhap(u), ve: renderDanhMucLinhVuc },   // 0096: quyền chung (kl_kiem_tra_quan_tri_kl)
  qtKhuMucTieu: { tab: 'qtTabMucTieu', cho: (u) => laNguoiNhap(u) || Boolean(u.quan_tri_he_thong), ve: renderMucTieu, khiMo: true },   // v3.25: thêm nhanh — sửa có kiểm soát
  qtKhuCauHinh: { tab: 'qtTabCauHinh', cho: (u) => u.quan_tri_he_thong || u.role_group === 'A1', ve: renderCauHinh },
  qtKhuAi: { tab: 'qtTabAi', cho: (u) => laQuanTriMt(u), ve: renderCauHinhAi, khiMo: true },   // v3.25 (0112): quản trị hệ thống / toàn quyền
  qtKhuNgayNghi: { tab: 'qtTabNgayNghi', cho: (u) => u.quan_tri_he_thong || (u.role_group === 'A1' && isChief()), ve: renderNgayNghi },   // PR-2b
  qtKhuNhatKy: { tab: 'qtTabNhatKy', cho: (u) => u.quan_tri_he_thong || laNguoiNhap(u), ve: renderNhatKy },
  qtKhuDonDuLieu: { tab: 'qtTabDonDuLieu', cho: (u) => u.quan_tri_he_thong, ve: renderDonDuLieu },
  qtKhuNhatKyHeThong: { tab: 'qtTabNhatKyHeThong', cho: (u) => u.quan_tri_he_thong, ve: renderNhatKyHeThong, khiMo: true },   // v3.25: đọc lại mỗi lần mở (thấy ngay thao tác vừa làm)
  qtKhuThongKe: { tab: 'qtTabThongKe', cho: (u) => u.quan_tri_he_thong, ve: renderThongKe, khiMo: true },   // v3.24 (0104); khiMo: chỉ nạp khi đang mở tab
};
export const coQuyenQuanTri = (u) => Boolean(u) && Object.values(KHU).some((k) => k.cho(u));
let tabDangChon = null;

// veKhiMo = false khi loadQuanTri tự vẽ sau đó; bấm tab (handler nhận dataset, phần tử) thì khu "khiMo" (truy vấn nặng) nạp ngay lúc mở.
function chonTabQuanTri({ tab }, veKhiMo = true) {
  tabDangChon = tab;
  Object.entries(KHU).forEach(([k, d]) => { show(k, k === tab); $(d.tab).setAttribute('aria-selected', String(k === tab)); });
  if (veKhiMo && KHU[tab]?.khiMo) KHU[tab].ve();
  if (sectionDangHien('viewQuanTri')) ghiDuongDan('navQuanTri', { thay: !veKhiMo });   // bấm thẻ: thêm bước lịch sử; tự chọn lại: sửa tại chỗ
}

// Nạp lại danh bạ (cờ mới nhất) + danh mục rồi vẽ các khu theo quyền của chính người đang đăng nhập.
export async function loadQuanTri() {
  await loadAccountsCache();
  const me = state.accounts.find((a) => a.id === state.user.id);
  if (me) state.user = { ...state.user, quan_tri_kl: me.quan_tri_kl, quan_tri_he_thong: me.quan_tri_he_thong, quan_tri_kl_het_han: me.quan_tri_kl_het_han };
  const u = state.user;
  if (laNguoiNhap(u) || u.quan_tri_he_thong) { try { await loadDanhMuc(); } catch (e) { notifyError('Không đọc được danh mục ngành/lĩnh vực: ' + e.message); } }
  const hopLe = Object.keys(KHU).filter((k) => KHU[k].cho(u));
  Object.entries(KHU).forEach(([k, d]) => show(d.tab, hopLe.includes(k)));
  show('qtKhuNhatKyQuyen', Boolean(u.quan_tri_he_thong)); show('qtKhuNhatKyDanhMuc', laNguoiNhap(u) || Boolean(u.quan_tri_he_thong));
  chonTabQuanTri({ tab: hopLe.includes(tabDangChon) ? tabDangChon : hopLe[0] }, false);
  await Promise.all(hopLe.filter((k) => !KHU[k].khiMo || k === tabDangChon).map((k) => KHU[k].ve()));
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
  mountBanGiao(loadQuanTri);
  mountSuaTaiKhoan(loadQuanTri);
  mountChuyenTheoDoi(loadQuanTri);   // J-6 (0092)
  mountDonDuLieu();
  mountThongKe();   // v3.24 (0104)
  mountMucTieu(); mountCauHinhAi();   // v3.25
  $('qtTimTaiKhoan').addEventListener('input', (e) => filterRowsByKeyword('qtTaiKhoanBody', e.target.value));
  dangKyQuyenDuongDan('quanTri', coQuyenQuanTri); dangKyTheQuanTri(() => tabDangChon);
  registerActions({
    openQuanTri, loadQuanTri, chonTabQuanTri,
    toggleQuanTriHeThong: (ds) => toggleQuanTriHeThong(ds, loadQuanTri),
    toggleThuKyTT: (ds) => toggleThuKyTT(ds, loadQuanTri),
    khoaTaiKhoan: (ds) => khoaTaiKhoan(ds, loadQuanTri),
    resetMatKhau: (ds) => resetMatKhau(ds, loadQuanTri),
    togglePhuTrach: (ds) => togglePhuTrach(ds, loadQuanTri),
    ketThucKiemNhiem: (ds) => ketThucKiemNhiem(ds, loadQuanTri),
    luuCauHinh: (ds) => luuCauHinh(ds, loadQuanTri),
    qtThemNgayNghi: (ds, form) => themNgayNghi(form), qtBoNgayNghi: boNgayNghi,
  });
}
