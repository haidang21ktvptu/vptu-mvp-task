// Đầu trang chủ mọi vai (GĐ22, GĐ23): (1) dải "Cần xử lý ngay" — mỗi mục (tin chưa đọc, việc cần quyết, đề nghị chờ duyệt, bị từ chối, việc mới
// chờ xác nhận, Hỏa tốc chưa Đã nhận) là một NÚT: bấm mở ngay dưới dải danh sách gọn các việc của mục kèm nút hành động đúng việc (can-xu-ly-chi-tiet.js); (2) khối "Việc Thường trực giao" (A1/A2: Xác nhận đã nhận / Từ chối tại chỗ);
// (3) khối "Việc đồng chí giao bị từ chối / đang đề nghị từ chối" (người giao, kể cả giao thay mặt) với nút Giao lại (A1/A2). Dữ liệu thẻ từ dh
// (dòng RLS trả về); hàm DB là chốt. Mọi khối trả '' khi không có gì.
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { nhanPhuHtml } from '../../lib/kl/do-khan.js';
import { soChuaXuLy, onSoChuaXuLy, lamMoiHuyHieu } from '../../features/huy-hieu.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { xacNhanNhanViec } from '../../lib/kl/du-lieu.js';
import { loadDMUnreadMap } from '../../features/messages/index.js';
import { napLaiViec } from './kl/nap-lai-viec.js';
import { reloadCurrentView } from '../shell/index.js';
import { chiTietHtml } from './can-xu-ly-chi-tiet.js';

let mucDangMo = null; // mục đang mở danh sách dưới dải (giữ qua các lần vẽ lại theo realtime / sau hành động)

// Mọi trang chủ đặt <div id="dhCanXuLy"> — vẽ lại dải khi số chưa xử lý đổi (realtime), không chờ trang nạp lại.
export function mountCanXuLy() {
  onSoChuaXuLy((so) => { const el = $('dhCanXuLy'); if (el) el.innerHTML = canXuLyHtml(so); });
  registerActions({ moCanXuLy, cxXacNhanNhan, cxMoChuong });
}

// Bấm một mục của dải: mở / đóng danh sách của mục đó (tin: đọc lại số chưa đọc theo người trước khi vẽ).
async function moCanXuLy({ muc }) {
  mucDangMo = mucDangMo === muc ? null : muc;
  if (mucDangMo === 'tin') { try { await loadDMUnreadMap(); } catch { /* vẽ theo số đang có */ } }
  const el = $('dhCanXuLy'); if (el) el.innerHTML = canXuLyHtml();
  $('cxChiTiet')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
// Xác nhận đã nhận việc ngay trên dòng (mọi vai): hàm DB là chốt; nạp lại đúng việc rồi vẽ lại trang.
async function cxXacNhanNhan({ id, ma }) {
  try {
    const moi = await xacNhanNhanViec(id);
    notifySuccess(moi ? `Đã xác nhận nhận việc ${ma}. Hạn và trạng thái không đổi.` : 'Đồng chí đã xác nhận nhận việc này trước đó.');
    await napLaiViec(id); await lamMoiHuyHieu(); reloadCurrentView();
  } catch (e) { notifyError('Không xác nhận được: ' + e.message); }
}
// Mở chuông sau khi sự kiện bấm hiện tại kết thúc (bộ "bấm ra ngoài" của chuông đóng bảng ngay trong cùng sự kiện).
const cxMoChuong = () => setTimeout(() => $('chuongBtn')?.click(), 0);
import { dh } from './dieu-hanh/du-lieu.js';
import { oGiaoLaiHtml } from './dieu-hanh/the-viec.js';

const me = () => state.user?.id;
const vai = () => state.user?.role_group;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const xem = (r) => `<button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem diễn biến</button>`;

// Dải "Cần xử lý ngay": mỗi mục là một nút mở danh sách việc của mục đó ngay bên dưới (data-muc); mục đang mở có aria-expanded.
export function canXuLyHtml(so = soChuaXuLy()) {
  if (!so) return '';
  const n = (k) => Number(so[k] || 0);
  const nut = (muc, so_, chu, lop = '') => (so_ ? `<button type="button" class="${lop}" data-action="moCanXuLy" data-muc="${muc}" aria-expanded="${String(mucDangMo === muc)}"><b>${so_}</b> ${chu}</button>` : '');
  const muc = [
    nut('tin', n('nhan_tin'), 'tin chưa đọc'),
    vai() !== 'A3' ? nut('quyet', n('can_quyet'), 'việc cần quyết') : '',
    vai() !== 'A3' ? nut('denghi', n('de_nghi_cho_duyet'), 'đề nghị chờ duyệt') : '',
    nut('tuchoi', n('bi_tu_choi'), 'việc bị từ chối'),
    nut('moi', n('viec_moi'), `việc mới chờ xác nhận${n('tt_cho_nhan') ? ` (${n('tt_cho_nhan')} Thường trực giao)` : ''}`),
    nut('hoatoc', n('hoa_toc_viec') + n('hoa_toc_chi_dao'), 'Hỏa tốc chưa Đã nhận', 'do'),
  ].filter(Boolean);
  if (!muc.length) { mucDangMo = null; return ''; }
  return `<div class="can-xu-ly" id="canXuLy" role="region" aria-label="Cần xử lý ngay"><span>Cần xử lý ngay</span>${muc.join('')}</div>
    <div id="cxChiTiet" class="cx-chi-tiet ${mucDangMo ? '' : 'hidden'}" role="region" aria-label="Danh sách cần xử lý">${mucDangMo ? chiTietHtml(mucDangMo, so) : ''}</div>`;
}

// Việc Thường trực giao cho tôi, chưa xác nhận nhận (A1: Owner tài khoản; A2: người theo dõi khi giao cho phòng).
export function khoiThuongTrucHtml() {
  const ds = dh.rows.filter((r) => r.uu_tien === 'THUONG_TRUC' && mo(r) && !r.bi_tu_choi && !r.toi_da_xac_nhan && (r.owner_tai_khoan === me() || r.nguoi_theo_doi === me()));
  if (ds.length === 0) return '';
  return `<div class="muc do" id="khoiTT"><b>Việc Thường trực giao, chờ đồng chí xác nhận đã nhận (${ds.length})</b>
    <p>Xác nhận trong 1 ngày làm việc; quá hạn hệ thống nhắc đồng chí và Chánh Văn phòng. Từ chối cần lý do, Thường trực duyệt.</p>
    ${ds.map((r) => `<div class="the-con" id="tt-viec-${r.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}, hạn ${r.han_xu_ly ? formatNgay(r.han_xu_ly) : 'chưa có'} ${nhanPhuHtml(r)}</p>
      ${r.tu_choi_cho ? `<p class="chu-canh-bao-inline">Đã đề nghị từ chối ${formatDateTime(r.tu_choi_cho.tao_luc)}, chờ ${escapeHtml(findAccount(r.tu_choi_cho.cap_duyet)?.full_name || 'Thường trực')} duyệt.</p><div class="hanh-dong">${xem(r)}</div>`
    : `<div class="hanh-dong"><button type="button" class="nut lam" data-action="xacNhanNhanTT" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xác nhận đã nhận</button>
        <button type="button" class="nut" data-action="moO" data-o="oTcTT-${r.id}">Từ chối</button>${xem(r)}</div>
      <form class="o" id="oTcTT-${r.id}" data-submit="deNghiTuChoiThe" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">
        <input name="noi_dung" required placeholder="Lý do từ chối (bắt buộc)" aria-label="Lý do từ chối">
        <button type="submit" class="nut chinh">Gửi đề nghị</button><button type="button" class="nut" data-action="dongO" data-o="oTcTT-${r.id}">Huỷ</button></form>`}</div>`).join('')}</div>`;
}

// Việc TÔI giao (kể cả giao thay mặt cho tôi) bị từ chối (đã duyệt đồng ý) hoặc đang có đề nghị từ chối chờ duyệt.
export function khoiBiTuChoiHtml() {
  const ds = dh.rows.filter((r) => mo(r) && (r.bi_tu_choi || r.tu_choi_cho) && (r.tao_boi === me() || r.giao_thay_mat_cho === me()));
  if (ds.length === 0) return '';
  const giaoLai = ['A1', 'A2'].includes(vai());
  return `<div class="muc do" id="khoiBiTuChoi"><b>Việc đồng chí giao bị từ chối / đang đề nghị từ chối (${ds.length})</b>
    <p>${giaoLai ? 'Giao lại = đổi chủ trì ngay tại đây; cờ "bị từ chối" tự xoá; chủ trì mới xác nhận nhận việc lại.' : 'Lãnh đạo Văn phòng giao lại cho chủ trì khác.'}</p>
    ${ds.map((r) => {
    const dn = r.tu_choi_cho; const nd = dn ? findAccount(dn.nguoi_de_nghi) : null;
    const tt = r.bi_tu_choi ? '<span class="nhan-tu-choi">Bị từ chối</span>' : `<span class="nhan-xam">${escapeHtml(nd?.full_name || 'Cán bộ')} đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(findAccount(dn.cap_duyet)?.full_name || 'cấp duyệt')} duyệt</span>`;
    return `<div class="the-con" id="btc-${r.id}" data-tu-choi="${r.bi_tu_choi ? 'da' : 'cho'}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)} · ${escapeHtml(r.owner_tai_khoan_ten || r.nguoi_theo_doi_ten || '')} ${tt}</p>
      <div class="hanh-dong">${giaoLai && r.bi_tu_choi ? `<button type="button" class="nut lam" data-action="moO" data-o="oGiaoLai-${r.id}">Giao lại</button>` : ''}${xem(r)}</div>
      ${giaoLai && r.bi_tu_choi ? oGiaoLaiHtml(r) : ''}</div>`;
  }).join('')}</div>`;
}
