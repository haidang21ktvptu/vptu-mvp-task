// Modal bắt buộc tiếp nhận (GV-5, CN-2.2): chỉ với việc theo_1400 = true, đang mở, tôi là Owner/người theo dõi, chưa xác nhận.
// "Tiếp nhận" = gọi xac_nhan_nhan_viec (chỉ ghi lịch sử, không đổi trạng thái/hạn). "Để sau" đóng modal trong phiên này
// (việc vẫn hiện chip "chưa xác nhận nhận việc" trên danh sách). Từ chối/phản hồi đi qua chỉ đạo (GĐ18).
import { $, show, setText } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { xacNhanNhanViec } from '../../lib/kl/du-lieu.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { loadKl } from '../shared/kl/danh-sach.js';
import { sanPhamText } from '../shared/kl/dong.js';
import { acceptModalTemplate } from './accept-modal-template.js';

const deSau = new Set();   // id đã bấm "Để sau" trong phiên

export const canXacNhan = (r, me = state.user?.id) => r.theo_1400 && r.tien_do_ma !== 'HOAN_THANH' && !r.da_xac_nhan_nhan
  && (r.owner_tai_khoan === me || r.nguoi_theo_doi === me);

export function kiemTraNhanViec(rows) {
  const r = rows.find((x) => canXacNhan(x) && !deSau.has(x.id));
  if (!r) { show('mandatoryAcceptModal', false); return; }
  $('mandatoryTaskId').value = r.id;
  setText('mandatoryTaskTitle', `${r.ma} · ${r.noi_dung}`);
  setText('mandatoryTaskRes', r.so_ket_luan || '');
  setText('mandatoryTaskOwner', r.owner_tai_khoan_ten || r.owner_don_vi_ten || '');
  setText('mandatoryTaskProduct', sanPhamText(r) || '—');
  setText('mandatoryTaskDeadline', r.han_xu_ly ? formatNgay(r.han_xu_ly) : '—');
  show('mandatoryAcceptModal', true);
}

async function acceptTask() {
  const id = $('mandatoryTaskId').value;
  try {
    await xacNhanNhanViec(id);
    notifySuccess('Đã xác nhận nhận việc. Hạn và trạng thái không đổi — đồng hồ đã chạy từ ngày nhận văn bản.');
    show('mandatoryAcceptModal', false);
    loadKl();   // nạp lại → nếu còn việc chưa xác nhận, modal hiện tiếp
  } catch (e) {
    notifyError('Không xác nhận được: ' + e.message);
  }
}

function deSauTask() {
  deSau.add($('mandatoryTaskId').value);
  show('mandatoryAcceptModal', false);
}

export function mountAcceptModal() {
  $('modalRoot').insertAdjacentHTML('beforeend', acceptModalTemplate);
  registerActions({ acceptTask, deSauTask });
}
