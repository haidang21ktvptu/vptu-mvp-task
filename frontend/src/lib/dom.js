// Tiện ích DOM nhỏ, không phụ thuộc nghiệp vụ.

export const $ = (id) => document.getElementById(id);

export function show(el, visible = true) {
  const node = typeof el === 'string' ? $(el) : el;
  if (node) node.classList.toggle('hidden', !visible);
}

export function hide(el) {
  show(el, false);
}

export function setText(id, text) {
  const node = $(id);
  if (node) node.innerText = text;
}

// Thoát ký tự HTML khi chèn dữ liệu người dùng vào chuỗi template.
export function escapeHtml(text) {
  if (text === null || text === undefined || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ô lỗi inline (đăng nhập, đổi mật khẩu): rỗng = ẩn.
export function showInlineError(id, message) {
  const el = $(id);
  if (!el) return;
  el.innerText = message || '';
  el.classList.toggle('hidden', !message);
}

// Giá trị cho <input type="datetime-local"> theo giờ địa phương.
export function toDatetimeLocalValue(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// "18/9/2026 23:31" — ngày trước, giờ sau, không giây.
export function formatDateTime(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${d.toLocaleDateString('vi-VN')} ${time}`;
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Lọc dòng bảng theo thuộc tính data-search (DASH-5).
export function filterRowsByKeyword(tbodyId, keyword) {
  const kw = keyword.trim().toLowerCase();
  document.querySelectorAll(`#${tbodyId} tr[data-search]`).forEach((tr) => {
    tr.classList.toggle('hidden', Boolean(kw) && !tr.getAttribute('data-search').includes(kw));
  });
}
