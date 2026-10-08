// Khối "Kết quả nộp trong 7 ngày" (Cần xử lý A1/A2 — Đợt D v3.20, 0090: nộp minh chứng hợp lệ là hoàn thành, không chờ lãnh đạo xác nhận): mỗi dòng
// = mã việc, số hiệu · ngày · cấp nhận, trích yếu + mô tả kết quả, tệp, ai nộp lúc nào. Không phải việc bắt buộc: người giao việc / người theo dõi /
// lãnh đạo trong phạm vi đánh giá chất lượng hoặc trả lại khi chưa đạt; minh chứng nộp trước v3.20 còn chờ thì Xác nhận một bấm. Người nộp không tự
// đánh giá (MC-6) — ẩn nút; hàm xac_nhan_minh_chung là chốt.
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { nhanChatLuongHtml } from '../../../lib/kl/nhan.js';
import { duocXemLaiMinhChung } from '../../../lib/kl/minh-chung.js';
import { dh, timRow } from './du-lieu.js';
import { oDanhGiaHtml } from '../chat-luong.js';
import { tepHtml } from '../kl/minh-chung-tep.js';

function nutHtml(r, m) {
  if (!duocXemLaiMinhChung(r, m)) return '';
  const traLai = '<button type="button" class="nut" data-action="moO" data-o="oMc-' + m.id + '">Trả lại</button>';
  if (m.hop_le === null) return `<button type="button" class="nut lam" data-action="mcHopLeThe" data-id="${m.id}" data-nv="${r.id}">Xác nhận</button>${traLai}`;
  return (r.tien_do_ma === 'HOAN_THANH' ? `<button type="button" class="nut" data-action="moO" data-o="oDgDh-${m.id}">${r.chat_luong ? 'Sửa đánh giá' : 'Đánh giá'}</button>` : '') + traLai;
}

export function minhChungChoHtml() {
  const ds = dh.mcCho.filter((m) => timRow(m.nhiem_vu_id));
  if (ds.length === 0) return '<p class="trong">Chưa có kết quả nào nộp trong 7 ngày.</p>';
  return `<div class="da-gui" id="dhMcCho">${ds.map((m) => {
    const r = timRow(m.nhiem_vu_id);
    const nguoi = findAccount(m.nop_boi);
    const tt = m.hop_le === null ? '<span class="trang-thai tt-cho">chờ xác nhận</span>'
      : r.tien_do_ma === 'HOAN_THANH' ? `<span class="trang-thai tt-xong">hoàn thành</span> ${nhanChatLuongHtml(r.chat_luong) || ''}` : '';
    return `<div id="mcCho-${m.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(`Văn bản ${m.so_hieu || ''}`)}${m.ngay_van_ban ? ` ngày ${formatNgay(m.ngay_van_ban)}` : ''}${m.cap_nhan ? `, cấp nhận: ${escapeHtml(tenTrongDanhMuc('cap', m.cap_nhan))}` : ''} ${tt}
        ${m.trich_yeu ? `<span class="mc-trich-yeu">${escapeHtml(m.trich_yeu)}</span>` : ''}${m.mo_ta_ket_qua ? `<span class="mc-mo-ta">${escapeHtml(m.mo_ta_ket_qua)}</span>` : ''}
        <small>${escapeHtml(r.noi_dung)} · ${escapeHtml(nguoi?.full_name || 'không xác định')}${nguoi?.department ? ` (${escapeHtml(DEPT_NAMES[nguoi.department] || nguoi.department)})` : ''} nộp ${formatDateTime(m.nop_luc)}</small>${tepHtml(m, true)}</p>
      ${nutHtml(r, m)}
      ${m.hop_le === true && r.tien_do_ma === 'HOAN_THANH' && duocXemLaiMinhChung(r, m) ? oDanhGiaHtml(`oDgDh-${m.id}`, 'mcDanhGiaThe', { id: m.id, nv: r.id }) : ''}
      <form class="o" id="oMc-${m.id}" data-submit="mcKhongHopLeThe" data-id="${m.id}"><input name="noi_dung" required placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
        <button type="submit" class="nut chinh">Trả lại minh chứng</button><button type="button" class="nut" data-action="dongO" data-o="oMc-${m.id}">Huỷ</button></form>
    </div>`;
  }).join('')}</div>`;
}
