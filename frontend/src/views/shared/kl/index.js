// Màn hình "Nhiệm vụ" (mockup: tổng quan → danh sách → chi tiết): mục dùng chung mọi vai — A3 việc mình là Owner hoặc người theo dõi,
// A2 phòng mình, A1 theo phụ trách/kiêm nhiệm, A0 và quan_tri_kl tất cả — phạm vi do RLS (kl_pham_vi) quyết định, frontend chỉ vẽ.
// Nút "Giao việc" cho A1/A2/quan_tri_kl (quyền thật trong hàm giao_viec). moNhiemVu(id, ma, cheDo): các màn hình khác mở đúng việc.
// Đợt C1 v3.19 (0086): cấu hình pham_vi_chuyen_vien = 2 → chuyên viên vào "Nhiệm vụ của phòng" (openKlPhong, nút Việc của tôi / Cả phòng; chỉ xem).
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { xacNhanNhanViec, chuyenVienXemPhong } from '../../../lib/kl/du-lieu.js';
import { datCapQuyetDinh, deNghiTuChoi } from '../../../lib/kl/dieu-hanh.js';
import { napLaiViec } from './nap-lai-viec.js';
import { lamMoiHuyHieu } from '../../../features/huy-hieu.js';
import { klTemplate } from './template.js';
import { loadKl, ganBoLoc, locKlNhom, boKlLoc, setKlLoc, timKlRow, datKlChuaNap, render, dsDangHien } from './danh-sach.js';
import { mountXuatKy } from './xuat-ky.js';
import { mountKlCapNhatModal } from './cap-nhat-modal.js';
import { toggleKlChiTiet, chonKlRow, dongKlChiTiet, idDangMo } from './chi-tiet.js';
import { mountChiDao } from './chi-dao.js';
import { mountMinhChung } from './minh-chung.js';
import { mountThongTinGiao } from './thong-tin-giao.js';
import { mountSuaTang } from './sua-tang.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { moNganViec } from '../ngan-chi-tiet.js';
import { laNguoiNhap } from '../../../lib/kl/nhap/du-lieu.js';

export const duocGiaoViec = () => ['A1', 'A2', 'A3'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl);   // 0085: cả chuyên viên (giao thẳng)
// Chuyên viên thường: màn này là "Việc của tôi" (mặc định lọc việc mình chủ trì / theo dõi). Chuyên viên giữ quyền quản trị nhiệm vụ vào
// từ mục "Toàn bộ nhiệm vụ" (menu.js) nên không lọc — việc của riêng họ đã có màn hình điều hành; tìm nhanh (tim-nhanh.js) cùng quy tắc.
export const chiViecCuaToi = () => state.user?.role_group === 'A3' && !state.user?.quan_tri_kl;
const TIEU_DE = { A0: 'Toàn bộ nhiệm vụ', A2: 'Nhiệm vụ của phòng', A3: 'Việc của tôi' };

// Mở màn hình; loc (tuỳ chọn) = bộ lọc do màn hình khác truyền sang (thay thế toàn bộ bộ lọc hiện có). A3 thường mặc định = việc của tôi.
// phong = true (0086, chuyên viên xem cả phòng): tiêu đề "Nhiệm vụ của phòng", không lọc (RLS đã giới hạn trong phòng), hiện nút phạm vi.
export function openKl(loc, phong = false) {
  showSection('viewKl');
  setActiveNav(chiViecCuaToi() && !phong ? 'navDieuHanh' : 'navKl');   // chuyên viên xem "việc của tôi" (0086: navKl là Nhiệm vụ của phòng)
  datKlChuaNap(); // đang nạp lại: render() bỏ dấu hiệu data-nap cũ
  show('klNutThem', duocGiaoViec()); show('klXuatMau', laNguoiNhap(state.user));   // v9 đợt 2: xuất theo mẫu nhập (người nhập Excel)
  $('klTieuDe').textContent = phong ? 'Nhiệm vụ của phòng' : (state.user?.role_group === 'A3' && state.user?.quan_tri_kl ? 'Toàn bộ nhiệm vụ' : TIEU_DE[state.user?.role_group]) || 'Nhiệm vụ';
  show('klPhamVi', phong);
  const bo = loc || (chiViecCuaToi() && !phong ? { cuaToi: state.user.id } : {});
  setKlLoc(bo, true);
  const nap = loadKl();
  batKlRealtime(klTheoSuKien, (m) => hienKetNoi('klKetNoi', m));
  return nap;
}
// Chuyên viên (cấu hình 2) mở "Nhiệm vụ của phòng"; nút phạm vi: Việc của tôi = lọc cuaToi, Cả phòng = bỏ lọc. Không có cấu hình → như Việc của tôi.
const openKlPhong = () => openKl(null, chiViecCuaToi() && chuyenVienXemPhong());
const klPhamVi = ({ pv }) => setKlLoc({ cuaToi: pv === 'toi' ? state.user.id : null });

// Realtime (B6): sự kiện của việc đã có trong danh sách → nạp lại riêng việc đó (dòng + ngăn chi tiết đang mở); còn lại nạp cả danh sách.
async function klTheoSuKien(su) {
  if (!sectionDangHien('viewKl')) return;
  const ids = [...new Set(su.map((e) => e.id))];
  if (su.length && ids.length <= 5 && ids.every((id) => id && timKlRow(id))) {
    try { await Promise.all(ids.map((id) => napLaiViec(id, { nemLoi: true, veLai: false }))); render(true); return; } catch { /* nạp cả danh sách */ }
  }
  loadKl();
}

// Mở đúng một việc từ màn hình khác (thẻ điều hành, chuông, chỉ đạo đã gửi, Theo văn bản, nghiệm thu, nhắn tin): v9 đợt 2 — mở trong ngăn chi
// tiết dùng chung NGAY TRÊN màn hình đang xem (không chuyển sang mục Nhiệm vụ); đang ở mục Nhiệm vụ thì lọc theo mã rồi mở ngăn trong trang.
export async function moNhiemVu(id, ma, cheDo = 'chi-tiet') {
  if (!sectionDangHien('viewKl')) { await moNganViec(id, { cheDo }); return; }
  await openKl({ tuKhoa: ma });
  if (!timKlRow(id)) await loadKl(); // đọc lỗi tạm / dòng vừa thêm chưa kịp về → đọc lại một lần
  await toggleKlChiTiet({ id, cheDo });
  $(`klRow-${id}`)?.scrollIntoView({ block: 'nearest' });
}

// Sau MỌI hành động ghi thành công (GĐ23): nạp lại đúng việc đó ngay (ngăn chi tiết, dòng, thẻ điều hành — không chờ realtime hay cả danh sách),
// rồi nạp lại cả danh sách phía sau. Không có id (chỉ đạo / minh chứng gọi không tham số) → việc đang mở ở ngăn chi tiết.
// v9 đợt 2: phát 'viec-da-ghi' — màn hình đang nằm dưới ngăn chi tiết dùng chung (không có realtime) tự nạp lại (ngan-chi-tiet.js).
async function napLaiSauHanhDong(id) {
  const vid = id || idDangMo();
  await napLaiViec(vid);
  document.dispatchEvent(new CustomEvent('viec-da-ghi', { detail: vid }));
  await lamMoiHuyHieu(); // số chưa xử lý (dải Cần xử lý ngay, huy hiệu) đổi ngay sau ghi, không chờ realtime
  loadKl();
}

// Xác nhận đã nhận việc (GV-5): chỉ ghi lịch sử, không đổi trạng thái/hạn — đồng hồ không dừng (CN-2.2).
async function xacNhanNhanViecAction({ id }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? 'Đã ghi nhận đồng chí xác nhận nhận việc. Hạn và trạng thái không đổi.' : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    await napLaiSauHanhDong(id);
  } catch (e) {
    notifyError('Không xác nhận được: ' + e.message);
  }
}

// Đề nghị từ chối nhận việc từ ngăn chi tiết (0034): lý do bắt buộc; hàm de_nghi_tu_choi là chốt (chưa xác nhận, một đề nghị chờ mỗi việc).
async function tuChoiNhanViec({ id, ma }, form) {
  const lyDo = (new FormData(form).get('noi_dung') || '').trim();
  if (!lyDo) { notifyError('Đề nghị từ chối phải có lý do.'); return; }
  try {
    await deNghiTuChoi(id, lyDo);
    notifySuccess(`Đã gửi đề nghị từ chối ${ma}. Lãnh đạo trực tiếp của đồng chí sẽ duyệt; hạn và trạng thái việc không đổi.`);
    await napLaiSauHanhDong(id);
  } catch (e) { notifyError(e.message); }
}

// Chọn cấp cần quyết định tại chỗ trong ngăn chi tiết (A1/A2): ghi qua hàm, lịch sử do trigger; nạp lại danh sách ngay.
async function onDoiCap(e) {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement) || !sel.classList.contains('nl-cap')) return;
  sel.disabled = true;
  try {
    await datCapQuyetDinh(sel.dataset.id, sel.value);
    notifySuccess(sel.value ? 'Đã xác định cấp cần quyết định.' : 'Đã bỏ cấp cần quyết định.');
    await napLaiSauHanhDong(sel.dataset.id);
  } catch (err) {
    notifyError(err.message);
    sel.disabled = false;
  }
}

export function registerKlView() {
  $('viewKl').innerHTML = klTemplate;
  $('klChiTiet').addEventListener('change', onDoiCap);
  mountKlCapNhatModal(napLaiSauHanhDong);
  mountChiDao(registerActions, napLaiSauHanhDong);
  mountMinhChung(registerActions, napLaiSauHanhDong);
  mountThongTinGiao(registerActions, napLaiSauHanhDong);
  mountSuaTang(registerActions, napLaiSauHanhDong);   // v9 đợt 2: sửa thông tin giao / đề nghị sửa (0070–0071)
  mountXuatKy();   // v3.16: xuất Excel theo tuần / tháng / quý / năm
  ganBoLoc();
  // PR-3 G: Xuất Excel nạp động lib/kl/xuat.js + lib/xlsx.js (không tăng bundle lúc mở app); In / lưu PDF dùng in.css.
  const klXuatExcel = async () => {
    try { const { xuatNhiemVu } = await import('../../../lib/kl/xuat.js'); notifySuccess(`Đã xuất ${dsDangHien().length} nhiệm vụ ra tệp ${xuatNhiemVu(dsDangHien())}.`); } catch (e) { notifyError('Không xuất được Excel: ' + e.message); }
  };
  registerActions({ klXuatExcel, klIn: () => window.print(), openKl: () => openKl(), openKlPhong, klPhamVi, loadKl, locKlNhom, boKlLoc, toggleKlChiTiet, chonKlRow, dongKlChiTiet, xacNhanNhanViec: xacNhanNhanViecAction, tuChoiNhanViec });
}
