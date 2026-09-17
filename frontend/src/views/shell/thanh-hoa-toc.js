// Thanh đỏ cố định đầu mọi trang (GĐ22): việc / chỉ đạo Hỏa tốc mà TÔI là người nhận chưa bấm "Đã nhận" (kl_so_chua_xu_ly.hoa_toc). Bấm Đã nhận
// = xac_nhan_nhan_viec (việc) hoặc xac_nhan_da_nhan_chi_dao (chỉ đạo); hàm DB là chốt. Cập nhật theo huy hiệu (realtime).
import { $, show, escapeHtml } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { xacNhanNhanViec } from '../../lib/kl/du-lieu.js';
import { xacNhanDaNhanChiDao } from '../../lib/kl/dieu-hanh.js';
import { onSoChuaXuLy, lamMoiHuyHieu } from '../../features/huy-hieu.js';
import { reloadCurrentView } from './index.js';

const dongHtml = (x) => `<div class="hoa-toc-dong" data-loai="${x.loai}" data-id="${x.id}">
    <span><b>${escapeHtml(x.ma)}</b> ${x.loai === 'chi_dao' ? 'chỉ đạo hỏa tốc: ' : ''}${escapeHtml((x.noi_dung || '').slice(0, 90))}</span>
    <button type="button" class="nut nho" data-action="daNhanHoaToc" data-loai="${x.loai}" data-id="${x.id}">Đã nhận</button></div>`;

function ve(so) {
  const ds = so?.hoa_toc || [];
  const el = $('thanhHoaToc');
  if (!el) return;
  el.innerHTML = ds.length ? `<b>Hỏa tốc — ${ds.length} việc/chỉ đạo cần bấm Đã nhận trong 2 giờ làm việc</b>${ds.map(dongHtml).join('')}` : '';
  show(el, ds.length > 0);
}

async function daNhanHoaToc({ loai, id }) {
  try {
    await (loai === 'chi_dao' ? xacNhanDaNhanChiDao(id) : xacNhanNhanViec(id));
    notifySuccess('Đã ghi nhận đồng chí đã nhận. Người giao được báo.');
    await lamMoiHuyHieu();
    reloadCurrentView();
  } catch (e) { notifyError(e.message); }
}

export function mountThanhHoaToc() {
  $('mainHeader').insertAdjacentHTML('afterend', '<div id="thanhHoaToc" class="thanh-hoa-toc hidden" role="alert" aria-live="assertive"></div>');
  onSoChuaXuLy(ve);
  registerActions({ daNhanHoaToc });
}
