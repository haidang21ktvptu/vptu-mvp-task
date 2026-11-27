// Khối "Kết quả nộp trong 7 ngày" (Cần xử lý A1/A2 — Đợt D v3.20, 0090: nộp minh chứng hợp lệ là hoàn thành, không chờ lãnh đạo xác nhận). Không phải
// việc bắt buộc: người giao việc / người theo dõi / lãnh đạo trong phạm vi đánh giá chất lượng hoặc trả lại khi chưa đạt; minh chứng nộp trước v3.20
// còn chờ thì Xác nhận một bấm. Người nộp không tự đánh giá (MC-6) — ẩn nút; hàm xac_nhan_minh_chung là chốt.
// v3.36 (CAU-HOI V-13): mỗi kết quả hai dòng chữ — (1) mã việc, trạng thái, nội dung việc; (2) người nộp, lúc nộp, trích yếu (không có thì mô tả kết
// quả, số hiệu văn bản) và liên kết "Xem tệp". Số hiệu, ngày, cấp nhận, mô tả kết quả, phòng của người nộp ở gợi ý của dòng (title) và ở ngăn chi tiết
// của việc — bấm mã việc để mở (xemDienBien: dòng này không phải thẻ nên mở ngăn chi tiết tại chỗ). Danh sách hiện SO_MC_DAU kết quả mới nhất, "Xem
// tất cả N kết quả" (components/ds-gon.js, danh sách tên "dhMc").
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { nhanChatLuongHtml } from '../../../lib/kl/nhan.js';
import { duocXemLaiMinhChung } from '../../../lib/kl/minh-chung.js';
import { dh, timRow } from './du-lieu.js';
import { nutHetHtml, apDanhSach, dangKyDanhSach } from '../../../components/ds-gon.js';
import { oDanhGiaHtml } from '../chat-luong.js';

function nutHtml(r, m) {
  if (!duocXemLaiMinhChung(r, m)) return '';
  const traLai = '<button type="button" class="nut" data-action="moO" data-o="oMc-' + m.id + '">Trả lại</button>';
  if (m.hop_le === null) return `<button type="button" class="nut lam" data-action="mcHopLeThe" data-id="${m.id}" data-nv="${r.id}">Xác nhận</button>${traLai}`;
  return (r.tien_do_ma === 'HOAN_THANH' ? `<button type="button" class="nut" data-action="moO" data-o="oDgDh-${m.id}">${r.chat_luong ? 'Sửa đánh giá' : 'Đánh giá'}</button>` : '') + traLai;
}

const SO_MC_DAU = 5;
dangKyDanhSach('dhMc', { vung: () => document.getElementById('dhMcCho'), chon: ':scope > div[id]', so: SO_MC_DAU, donVi: 'kết quả' });
// Gọi sau khi màn hình đã trả lại các ô đang mở (giuONhap): dòng đang mở ô Trả lại / Đánh giá không bị ẩn.
export const apDsMc = () => apDanhSach('dhMc');

export function minhChungChoHtml() {
  const ds = dh.mcCho.filter((m) => timRow(m.nhiem_vu_id));
  if (ds.length === 0) return '<p class="trong">Chưa có kết quả nào nộp trong 7 ngày.</p>';
  return `<div class="da-gui" id="dhMcCho">${ds.map((m) => {
    const r = timRow(m.nhiem_vu_id);
    const nguoi = findAccount(m.nop_boi);
    const tt = m.hop_le === null ? '<span class="trang-thai tt-cho">chờ xác nhận</span>'
      : r.tien_do_ma === 'HOAN_THANH' ? `<span class="trang-thai tt-xong">hoàn thành</span> ${nhanChatLuongHtml(r.chat_luong) || ''}` : '';
    const vanBan = `Văn bản ${m.so_hieu || ''}${m.ngay_van_ban ? ` ngày ${formatNgay(m.ngay_van_ban)}` : ''}${m.cap_nhan ? `, cấp nhận: ${tenTrongDanhMuc('cap', m.cap_nhan)}` : ''}`;
    const nop = `${nguoi?.full_name || 'không xác định'} nộp ${formatDateTime(m.nop_luc)}`;
    const day = [r.noi_dung, vanBan, m.trich_yeu ? `Trích yếu: ${m.trich_yeu}` : '', m.mo_ta_ket_qua ? `Kết quả: ${m.mo_ta_ket_qua}` : '',
      `${nop}${nguoi?.department ? ` (${DEPT_NAMES[nguoi.department] || nguoi.department})` : ''}`].filter(Boolean).join('\n');
    const tep = m.tep_path ? `<button type="button" class="lien-ket" data-action="xemTepMinhChung" data-path="${escapeHtml(m.tep_path)}" title="${escapeHtml(m.tep_ten || 'tệp đính kèm')}">Xem tệp</button>` : '';
    return `<div id="mcCho-${m.id}"><p title="${escapeHtml(day)}"><span class="mc-viec"><button type="button" class="cx-ma" data-action="xemDienBien" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}" title="Mở chi tiết việc"><b>${escapeHtml(r.ma)}</b></button> ${tt} ${escapeHtml(r.noi_dung)}</span>
        <small class="mc-nop"><span>${escapeHtml(`${nop}: ${m.trich_yeu || m.mo_ta_ket_qua || vanBan}`)}</span>${tep}</small></p>
      ${nutHtml(r, m)}
      ${m.hop_le === true && r.tien_do_ma === 'HOAN_THANH' && duocXemLaiMinhChung(r, m) ? oDanhGiaHtml(`oDgDh-${m.id}`, 'mcDanhGiaThe', { id: m.id, nv: r.id }) : ''}
      <form class="o" id="oMc-${m.id}" data-submit="mcKhongHopLeThe" data-id="${m.id}"><input name="noi_dung" required placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
        <button type="submit" class="nut chinh">Trả lại minh chứng</button><button type="button" class="nut" data-action="dongO" data-o="oMc-${m.id}">Huỷ</button></form>
    </div>`;
  }).join('')}</div>${nutHetHtml('dhMc', ds.length, SO_MC_DAU, 'kết quả')}`;
}
