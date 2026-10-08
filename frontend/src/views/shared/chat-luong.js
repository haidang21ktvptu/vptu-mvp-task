// Hộp đánh giá chất lượng hoàn thành dùng chung (PR-3 0063; Đợt D 0090 — định hướng 8/10/2026: KHÔNG bắt buộc, nộp minh chứng hợp lệ đã là hoàn
// thành việc; người giao việc / người theo dõi / lãnh đạo trong phạm vi đánh giá khi muốn): Không đạt / Đạt / Đạt tốt / Đạt xuất sắc; nút "Lưu đánh giá"
// mờ tới khi chọn mức. Dùng ở ngăn chi tiết (khối minh chứng) và Cần xử lý (kết quả vừa nộp) — mỗi nơi tự xử lý submit (data-submit).
import { escapeHtml } from '../../lib/dom.js';
import { CHAT_LUONG } from '../../lib/kl/nhan.js';

export const oChonChatLuongHtml = (id, batBuoc = true) => `<label class="nhan nho" for="${id}">Chất lượng hoàn thành${batBuoc ? '<b class="gv-bb" aria-hidden="true">*</b>' : ''}</label>
  <select id="${id}" name="chat_luong" class="o-nhap nho"${batBuoc ? ' required' : ''}><option value="">${batBuoc ? 'Chọn mức' : 'Không đánh giá'}</option>${CHAT_LUONG.map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('')}</select>`;

// Form đánh giá (lớp .o: mở / đóng bằng moO / dongO). data: các thuộc tính data-* (id minh chứng, việc…).
export function oDanhGiaHtml(formId, action, data) {
  const attr = Object.entries(data).map(([k, v]) => `data-${k}="${escapeHtml(String(v))}"`).join(' ');
  return `<form class="o o-danh-gia" id="${formId}" data-submit="${action}" ${attr}>
    ${oChonChatLuongHtml(`${formId}-cl`)}
    <button type="submit" class="nut chinh" disabled>Lưu đánh giá</button><button type="button" class="nut" data-action="dongO" data-o="${formId}">Huỷ</button></form>`;
}
export const chatLuongCuaForm = (form) => String(new FormData(form).get('chat_luong') || '');

// Sau khi vẽ lại vùng có form (giuONhap trả lại ô đang mở / giá trị đã chọn): đặt lại trạng thái nút lưu theo ô chất lượng.
export function dongBoNutDanhGia(vung) {
  vung?.querySelectorAll('.o-danh-gia').forEach((f) => {
    const nut = f.querySelector('button[type="submit"]'); if (nut) nut.disabled = !f.querySelector('select[name="chat_luong"]')?.value;
  });
}
// Nút lưu chỉ sáng khi đã chọn mức — một bộ nghe chung cho mọi form .o-danh-gia (kể cả form vẽ lại sau realtime).
document.addEventListener('change', (e) => {
  const s = e.target;
  if (s?.name !== 'chat_luong') return;
  const nut = s.closest('.o-danh-gia')?.querySelector('button[type="submit"]');
  if (nut) nut.disabled = !s.value;
});
