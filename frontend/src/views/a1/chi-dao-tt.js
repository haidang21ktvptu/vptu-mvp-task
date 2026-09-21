// Khối đầu trang A1 (mockup): "N chỉ đạo của Thường trực đang chờ Văn phòng" — mỗi chỉ đạo một thẻ rộng: mã, gửi lúc, hạn phản hồi,
// nội dung; hai ô một dòng: "Phản hồi Thường trực" (chi_dao_phan_hoi) và "Đôn đốc phòng" (DON_DOC gắn tra_loi_cho = luồng Thường trực →
// chỉ đạo con; Thường trực được báo là chỉ đạo đã được chuyển xuống, 0032).
import { escapeHtml, formatDateTime } from '../../lib/dom.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { chiDaoTTCuaToi, timRow } from '../shared/dieu-hanh/du-lieu.js';

function theTTHtml(c) {
  const r = timRow(c.nhiem_vu_id);
  const owner = r ? (r.owner_tai_khoan_ten || r.owner_don_vi_ten || '') : '';
  return `<article class="viec" id="tt-${c.id}" data-trang-thai="${c.trang_thai}">
      <p class="ma">${escapeHtml(c.ma)}, gửi ${formatDateTime(c.created_at)}, hạn phản hồi ${formatNgay(c.han_phan_hoi)}${c.qua_han_phan_hoi ? ' <span class="chu-canh-bao-inline">— đã quá hạn</span>' : ''}</p>
      <h3>${escapeHtml(c.noi_dung)}</h3>
      <p class="chu-phu" style="margin-top:6px">${escapeHtml(c.nhiem_vu_noi_dung)}${owner ? ` · ${escapeHtml(owner)}` : ''}${r?.so_ngay_qua ? ` · trễ ${r.so_ngay_qua} ngày` : ''}</p>
      <div class="hanh-dong"><button type="button" class="nut chinh" data-action="moO" data-o="oTTph-${c.id}">Phản hồi Thường trực</button>
        <button type="button" class="nut lam" data-action="moO" data-o="oTTdd-${c.id}">Đôn đốc phòng</button>
        <button type="button" class="nut" data-action="xemDienBien" data-id="${c.nhiem_vu_id}" data-ma="${escapeHtml(c.ma)}">Xem diễn biến</button></div>
      <form class="o" id="oTTph-${c.id}" data-submit="phanHoiThe" data-chi-dao="${c.id}"><input name="noi_dung" required placeholder="Nội dung phản hồi" aria-label="Nội dung phản hồi">
        <button type="submit" class="nut chinh">Gửi</button><button type="button" class="nut" data-action="dongO" data-o="oTTph-${c.id}">Huỷ</button></form>
      <form class="o" id="oTTdd-${c.id}" data-submit="guiDonDocThe" data-id="${c.nhiem_vu_id}" data-ma="${escapeHtml(c.ma)}" data-tra-loi-cho="${c.id}">
        <small>Đôn đốc gửi Trưởng phòng và chuyên viên theo dõi; Thường trực được báo là chỉ đạo đã được chuyển xuống.</small>
        <input name="noi_dung" required placeholder="Nội dung đôn đốc" aria-label="Nội dung đôn đốc">
        <button type="submit" class="nut lam">Gửi đôn đốc</button><button type="button" class="nut" data-action="dongO" data-o="oTTdd-${c.id}">Huỷ</button></form>
    </article>`;
}

export function khoiChiDaoTTHtml() {
  const cho = chiDaoTTCuaToi().filter((c) => c.trang_thai === 'CHO_PHAN_HOI');
  if (cho.length === 0) return '<div class="tam-dau"><h2><em class="luc">0</em> chỉ đạo của Thường trực đang chờ Văn phòng</h2></div><p class="dan">Không có chỉ đạo Thường trực nào chờ đồng chí phản hồi.</p>';
  return `<div class="tam-dau"><h2><em class="do">${cho.length}</em> chỉ đạo của Thường trực đang chờ Văn phòng</h2><span>trả lời ngay trên việc</span></div>${cho.map(theTTHtml).join('')}`;
}
