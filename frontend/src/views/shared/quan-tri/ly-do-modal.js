// Hộp xác nhận bắt gõ lý do (thiết kế KL BTVTU 5.2): trả về Promise<{ lyDo, ngay } | null>.
// Một hộp dùng chung cho cấp/thu cờ và bật/tắt phụ trách phòng; đóng = null.
import { $, show } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { quanTriLyDoModalTemplate } from './template.js';

let resolveCurrent = null;

function finish(value) {
  show('qtLyDoModal', false);
  const r = resolveCurrent;
  resolveCurrent = null;
  if (r) r(value);
}

// Ngày hôm nay theo giờ địa phương dạng YYYY-MM-DD (cho <input type="date">).
export function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function askLyDo({ title, moTa, canNgay = false, nhanXacNhan = 'Xác nhận' }) {
  if (resolveCurrent) finish(null);
  $('qtLyDoTitle').innerText = title;
  $('qtLyDoMoTa').innerText = moTa;
  $('qtLyDoXacNhan').innerText = nhanXacNhan;
  $('qtLyDo').value = '';
  $('qtNgay').value = todayLocal();
  show('qtNgayWrap', canNgay);
  show('qtLyDoModal', true);
  $('qtLyDo').focus();
  return new Promise((resolve) => { resolveCurrent = resolve; });
}

function confirmQtLyDo() {
  const lyDo = $('qtLyDo').value.trim();
  const canNgay = !$('qtNgayWrap').classList.contains('hidden');
  const ngay = $('qtNgay').value;
  if (!lyDo) {
    notifyError('Phải ghi lý do — lý do được lưu vào nhật ký cấp quyền.');
    $('qtLyDo').focus();
    return;
  }
  if (canNgay && !ngay) {
    notifyError('Chọn ngày hiệu lực.');
    return;
  }
  finish({ lyDo, ngay: canNgay ? ngay : null });
}

export function mountLyDoModal() {
  $('modalRoot').insertAdjacentHTML('beforeend', quanTriLyDoModalTemplate);
  registerActions({ confirmQtLyDo, closeQtLyDo: () => finish(null) });
}
