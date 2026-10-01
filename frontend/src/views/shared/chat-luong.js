// Hộp nghiệm thu dùng chung (PR-3 A; 0063): nghiệm thu một minh chứng ở việc đang mở = đóng việc ⇒ BẮT BUỘC chọn chất lượng hoàn thành
// (Không đạt / Đạt / Đạt tốt / Đạt xuất sắc); nút "Xác nhận nghiệm thu" mờ cho tới khi chọn. Dùng ở ngăn chi tiết (khối minh chứng), Điều hành
// (minh chứng chờ) và màn Cần nghiệm thu — mỗi nơi tự xử lý submit (data-submit). Hàm xac_nhan_minh_chung là chốt (thiếu chất lượng ⇒ lỗi).
import { escapeHtml } from '../../lib/dom.js';
import { CHAT_LUONG } from '../../lib/kl/nhan.js';

// Nghiệm thu có đóng việc không — cùng điều kiện v_dong của 0063: việc đang mở và minh chứng có ngày văn bản.
export const nghiemThuDongViec = (r, m) => Boolean(r) && r.tien_do_ma !== 'HOAN_THANH' && !r.dong_luc && Boolean(m?.ngay_van_ban);

export const oChonChatLuongHtml = (id, batBuoc = true) => `<label class="nhan nho" for="${id}">Chất lượng hoàn thành${batBuoc ? '<b class="gv-bb" aria-hidden="true">*</b>' : ''}</label>
  <select id="${id}" name="chat_luong" class="o-nhap nho"${batBuoc ? ' required' : ''}><option value="">${batBuoc ? 'Chọn mức' : 'Không đánh giá'}</option>${CHAT_LUONG.map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('')}</select>`;

// Form nghiệm thu (lớp .o: mở / đóng bằng moO / dongO). data: các thuộc tính data-* (id minh chứng, việc, mã…).
export function oNghiemThuHtml(formId, action, data) {
  const attr = Object.entries(data).map(([k, v]) => `data-${k}="${escapeHtml(String(v))}"`).join(' ');
  return `<form class="o o-nghiem-thu" id="${formId}" data-submit="${action}" ${attr}>
    ${oChonChatLuongHtml(`${formId}-cl`)}
    <button type="submit" class="nut chinh" disabled>Xác nhận nghiệm thu</button><button type="button" class="nut" data-action="dongO" data-o="${formId}">Huỷ</button></form>`;
}
export const chatLuongCuaForm = (form) => String(new FormData(form).get('chat_luong') || '');

// Sau khi vẽ lại vùng có form (giuONhap trả lại ô đang mở / giá trị đã chọn): đặt lại trạng thái nút xác nhận theo ô chất lượng.
export function dongBoNutNghiemThu(vung) {
  vung?.querySelectorAll('.o-nghiem-thu').forEach((f) => {
    const nut = f.querySelector('button[type="submit"]'); if (nut) nut.disabled = !f.querySelector('select[name="chat_luong"]')?.value;
  });
}
// Nút xác nhận chỉ sáng khi đã chọn mức — một bộ nghe chung cho mọi form .o-nghiem-thu (kể cả form vẽ lại sau realtime).
document.addEventListener('change', (e) => {
  const s = e.target;
  if (s?.name !== 'chat_luong') return;
  const nut = s.closest('.o-nghiem-thu')?.querySelector('button[type="submit"]');
  if (nut) nut.disabled = !s.value;
});
