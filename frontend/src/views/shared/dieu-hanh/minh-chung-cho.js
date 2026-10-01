// Khối "minh chứng đã nộp, chờ nghiệm thu" (A1/A2, mockup): mỗi dòng = mã việc, số hiệu · ngày · cấp nhận, trích yếu + mô tả kết quả (0046), ai nộp lúc nào; nút
// Nghiệm thu (một bấm — PR-2b Q2: đóng việc cùng giao dịch) và Trả lại (ô lý do + hạn nộp lại, Q3). Người nộp không tự xác nhận (MC-6) — ẩn nút;
// hàm xac_nhan_minh_chung là chốt (kể cả khung hạn nộp lại khi việc đã qua hạn hoàn thành).
import { escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { formatNgay, homNayVN } from '../../../lib/kl/ngay.js';
import { tenTrongDanhMuc } from '../../../lib/kl/du-lieu.js';
import { laViecTtGiaoCvp, nghiemThuViecTt } from '../../../lib/kl/minh-chung.js';
import { dh, timRow } from './du-lieu.js';
import { nghiemThuDongViec, oNghiemThuHtml } from '../chat-luong.js';

export function minhChungChoHtml() {
  const ds = dh.mcCho.filter((m) => timRow(m.nhiem_vu_id));
  if (ds.length === 0) return '<p class="trong">Không có minh chứng nào chờ nghiệm thu.</p>';
  const hom = homNayVN();
  return `<div class="da-gui" id="dhMcCho">${ds.map((m) => {
    const r = timRow(m.nhiem_vu_id);
    const nguoi = findAccount(m.nop_boi);
    const nut = m.nop_boi === state.user?.id ? '<span class="chu-phu">minh chứng do đồng chí nộp — người khác xác nhận</span>'
      : laViecTtGiaoCvp(r) && !nghiemThuViecTt(r, m.nop_boi) ? '<span class="chu-phu">việc Thường trực giao — thư ký Thường trực nghiệm thu thay mặt Thường trực</span>' : `
      ${nghiemThuDongViec(r, m) ? `<button type="button" class="nut lam" data-action="moO" data-o="oNtDh-${m.id}">Nghiệm thu</button>`   // PR-3: chọn chất lượng (bắt buộc)
    : `<button type="button" class="nut lam" data-action="mcHopLeThe" data-id="${m.id}" data-nv="${r.id}">Nghiệm thu</button>`}
      <button type="button" class="nut" data-action="moO" data-o="oMc-${m.id}">Trả lại</button>`;
    const toiDa = r.han_xu_ly && r.han_xu_ly >= hom ? r.han_xu_ly : '';
    return `<div id="mcCho-${m.id}"><p><b>${escapeHtml(r.ma)}</b> ${escapeHtml(m.loai === 'chu_cu' ? 'Minh chứng cũ' : `Văn bản ${m.so_hieu || ''}`)}${m.ngay_van_ban ? ` ngày ${formatNgay(m.ngay_van_ban)}` : ''}${m.cap_nhan ? `, cấp nhận: ${escapeHtml(tenTrongDanhMuc('cap', m.cap_nhan))}` : ''}
        ${m.trich_yeu ? `<span class="mc-trich-yeu">${escapeHtml(m.trich_yeu)}</span>` : ''}${m.mo_ta_ket_qua ? `<span class="mc-mo-ta">${escapeHtml(m.mo_ta_ket_qua)}</span>` : ''}
        <small>${escapeHtml(r.noi_dung)} · ${escapeHtml(nguoi?.full_name || 'không xác định')}${nguoi?.department ? ` (${escapeHtml(DEPT_NAMES[nguoi.department] || nguoi.department)})` : ''} nộp ${formatDateTime(m.nop_luc)}</small></p>
      ${nut}
      ${nghiemThuDongViec(r, m) && !nut.includes('chu-phu') ? oNghiemThuHtml(`oNtDh-${m.id}`, 'mcNghiemThuThe', { id: m.id, nv: r.id }) : ''}
      <form class="o" id="oMc-${m.id}" data-submit="mcKhongHopLeThe" data-id="${m.id}"><input name="noi_dung" required placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại">
        <input type="date" name="han_nop_lai" required min="${hom}"${toiDa ? ` max="${toiDa}"` : ''} aria-label="Hạn nộp lại" title="${toiDa ? `Hạn nộp lại muộn nhất ${formatNgay(toiDa)}` : 'Đã qua hạn hoàn thành: hạn nộp lại tối đa 2 ngày làm việc'}">
        <button type="submit" class="nut chinh">Trả lại minh chứng</button><button type="button" class="nut" data-action="dongO" data-o="oMc-${m.id}">Huỷ</button></form>
    </div>`;
  }).join('')}</div>`;
}
