// Đầu trang chủ mọi vai (GĐ22): (1) dải "Cần xử lý ngay" gom bốn thứ từ kl_so_chua_xu_ly — tin chưa đọc, việc cần quyết / đề nghị chờ duyệt / bị
// từ chối, việc mới chờ xác nhận, Hỏa tốc chưa Đã nhận; (2) khối "Việc Thường trực giao" (A1/A2: Xác nhận đã nhận / Từ chối tại chỗ);
// (3) khối "Việc đồng chí giao bị từ chối / đang đề nghị từ chối" (người giao, kể cả giao thay mặt) với nút Giao lại (A1/A2). Dữ liệu thẻ từ dh
// (dòng RLS trả về); hàm DB là chốt. Mọi khối trả '' khi không có gì.
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { nhanPhuHtml } from '../../lib/kl/do-khan.js';
import { soChuaXuLy, onSoChuaXuLy } from '../../features/huy-hieu.js';

// Mọi trang chủ đặt <div id="dhCanXuLy"> — vẽ lại dải khi số chưa xử lý đổi (realtime), không chờ trang nạp lại.
export function mountCanXuLy() {
  onSoChuaXuLy((so) => { const el = $('dhCanXuLy'); if (el) el.innerHTML = canXuLyHtml(so); });
}
import { dh } from './dieu-hanh/du-lieu.js';
import { oGiaoLaiHtml } from './dieu-hanh/the-viec.js';

const me = () => state.user?.id;
const vai = () => state.user?.role_group;
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const xem = (r) => `<button type="button" class="nut" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}">Xem diễn biến</button>`;

// Dải "Cần xử lý ngay": mỗi mục là một nút nhảy tới nơi xử lý (Nhắn tin, khối trong trang, thanh Hỏa tốc).
export function canXuLyHtml(so = soChuaXuLy()) {
  if (!so) return '';
  const n = (k) => Number(so[k] || 0);
  const quyet = n('can_quyet') + n('de_nghi_cho_duyet') + n('bi_tu_choi');
  const muc = [
    n('nhan_tin') ? `<button type="button" data-action="openNhanTin"><b>${n('nhan_tin')}</b> tin chưa đọc</button>` : '',
    quyet && vai() !== 'A3' ? `<button type="button" data-action="cuonToi" data-toi="dhTC"><b>${quyet}</b> ${[n('can_quyet') && 'việc cần quyết', n('de_nghi_cho_duyet') && 'đề nghị chờ duyệt', n('bi_tu_choi') && 'việc bị từ chối'].filter(Boolean).join(', ')}</button>` : '',
    n('viec_moi') ? `<button type="button" data-action="cuonToi" data-toi="${vai() === 'A3' ? 'vctMuc-moi' : 'khoiTT'}"><b>${n('viec_moi')}</b> việc mới chờ xác nhận${n('tt_cho_nhan') ? ` (${n('tt_cho_nhan')} Thường trực giao)` : ''}</button>` : '',
    n('hoa_toc_viec') + n('hoa_toc_chi_dao') ? `<button type="button" class="do" data-action="cuonToi" data-toi="thanhHoaToc"><b>${n('hoa_toc_viec') + n('hoa_toc_chi_dao')}</b> Hỏa tốc chưa Đã nhận</button>` : '',
  ].filter(Boolean);
  return muc.length ? `<div class="can-xu-ly" id="canXuLy" role="region" aria-label="Cần xử lý ngay"><span>Cần xử lý ngay</span>${muc.join('')}</div>` : '';
}

// Việc Thường trực giao cho tôi, chưa xác nhận nhận (A1: Owner tài khoản; A2: người theo dõi khi giao cho phòng).
export function khoiThuongTrucHtml() {
  const ds = dh.rows.filter((r) => r.uu_tien === 'THUONG_TRUC' && mo(r) && !r.bi_tu_choi && !r.da_xac_nhan_nhan && (r.owner_tai_khoan === me() || r.nguoi_theo_doi === me()));
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
    <p>${giaoLai ? 'Giao lại cho người theo dõi mới ngay tại đây; cờ "bị từ chối" tự xoá.' : 'Lãnh đạo Văn phòng giao lại cho người khác.'}</p>
    ${ds.map((r) => {
    const dn = r.tu_choi_cho; const nd = dn ? findAccount(dn.nguoi_de_nghi) : null;
    const tt = r.bi_tu_choi ? '<span class="nhan-tu-choi">Bị từ chối</span>' : `<span class="nhan-xam">${escapeHtml(nd?.full_name || 'Cán bộ')} đề nghị từ chối ${formatDateTime(dn.tao_luc)}, chờ ${escapeHtml(findAccount(dn.cap_duyet)?.full_name || 'cấp duyệt')} duyệt</span>`;
    return `<div class="the-con" id="btc-${r.id}" data-tu-choi="${r.bi_tu_choi ? 'da' : 'cho'}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)} · ${escapeHtml(r.owner_tai_khoan_ten || r.nguoi_theo_doi_ten || '')} ${tt}</p>
      <div class="hanh-dong">${giaoLai && r.bi_tu_choi ? `<button type="button" class="nut lam" data-action="moO" data-o="oGiaoLai-${r.id}">Giao lại</button>` : ''}${xem(r)}</div>
      ${giaoLai && r.bi_tu_choi ? oGiaoLaiHtml(r) : ''}</div>`;
  }).join('')}</div>`;
}
