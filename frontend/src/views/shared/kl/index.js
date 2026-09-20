// Màn hình "Nhiệm vụ" (mockup: tổng quan → danh sách → chi tiết): mục dùng chung mọi vai — A3 việc mình là Owner hoặc người theo dõi,
// A2 phòng mình, A1 theo phụ trách/kiêm nhiệm, A0 và quan_tri_kl tất cả — phạm vi do RLS (kl_pham_vi) quyết định, frontend chỉ vẽ.
// Nút "Giao việc" cho A1/A2/quan_tri_kl (quyền thật trong hàm giao_viec). moNhiemVu(id, ma, cheDo): các màn hình khác mở đúng việc.
import { $, show } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { xacNhanNhanViec } from '../../../lib/kl/du-lieu.js';
import { datCapQuyetDinh, deNghiTuChoi } from '../../../lib/kl/dieu-hanh.js';
import { napLaiViec } from './nap-lai-viec.js';
import { lamMoiHuyHieu } from '../../../features/huy-hieu.js';
import { klTemplate } from './template.js';
import { loadKl, ganBoLoc, locKlNhom, boKlLoc, setKlLoc, timKlRow, datKlChuaNap } from './danh-sach.js';
import { mountKlCapNhatModal } from './cap-nhat-modal.js';
import { toggleKlChiTiet, chonKlRow, dongKlChiTiet, idDangMo } from './chi-tiet.js';
import { mountChiDao } from './chi-dao.js';
import { mountMinhChung } from './minh-chung.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';

export const duocGiaoViec = () => ['A1', 'A2'].includes(state.user?.role_group) || Boolean(state.user?.quan_tri_kl);
const TIEU_DE = { A0: 'Toàn bộ nhiệm vụ', A2: 'Nhiệm vụ của phòng', A3: 'Việc của tôi' };

// Mở màn hình; loc (tuỳ chọn) = bộ lọc do màn hình khác truyền sang (thay thế toàn bộ bộ lọc hiện có). A3 mặc định = việc của tôi.
export function openKl(loc) {
  showSection('viewKl');
  setActiveNav('navKl');
  datKlChuaNap(); // đang nạp lại: render() bỏ dấu hiệu data-nap cũ
  show('klNutThem', duocGiaoViec());
  $('klTieuDe').textContent = TIEU_DE[state.user?.role_group] || 'Nhiệm vụ';
  const bo = loc || (state.user?.role_group === 'A3' ? { cuaToi: state.user.id } : {});
  setKlLoc(bo, true);
  const nap = loadKl();
  batKlRealtime(() => { if (sectionDangHien('viewKl')) loadKl(); }, (m) => hienKetNoi('klKetNoi', m));
  return nap;
}

// Mở đúng một việc từ màn hình khác (thẻ điều hành, chuông, chỉ đạo đã gửi): lọc theo mã rồi mở ngăn chi tiết.
export async function moNhiemVu(id, ma, cheDo = 'chi-tiet') {
  await openKl({ tuTongQuan: true, tuKhoa: ma });
  if (!timKlRow(id)) await loadKl(); // đọc lỗi tạm / dòng vừa thêm chưa kịp về → đọc lại một lần
  await toggleKlChiTiet({ id, cheDo });
  $(`klRow-${id}`)?.scrollIntoView({ block: 'nearest' });
}

// Sau MỌI hành động ghi thành công (GĐ23): nạp lại đúng việc đó ngay (ngăn chi tiết, dòng, thẻ điều hành — không chờ realtime hay cả danh sách),
// rồi nạp lại cả danh sách phía sau. Không có id (chỉ đạo / minh chứng gọi không tham số) → việc đang mở ở ngăn chi tiết.
async function napLaiSauHanhDong(id) {
  await napLaiViec(id || idDangMo());
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
  mountKlCapNhatModal(loadKl);
  mountChiDao(registerActions, napLaiSauHanhDong);
  mountMinhChung(registerActions, napLaiSauHanhDong);
  ganBoLoc();
  registerActions({ openKl: () => openKl(), loadKl, locKlNhom, boKlLoc, toggleKlChiTiet, chonKlRow, dongKlChiTiet, xacNhanNhanViec: xacNhanNhanViecAction, tuChoiNhanViec });
}
