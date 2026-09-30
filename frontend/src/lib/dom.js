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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;'); // thuộc tính data-loc='...' chứa JSON: dấu nháy đơn trong tên kết luận không được cắt thuộc tính
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

// Giữ ô nhập người dùng đang dùng qua một lần vẽ lại innerHTML (nạp lại nền / realtime — PR-2a, lỗi đua): với mỗi form có id trong vùng — trạng
// thái mở (.mo) và giá trị các ô đã đổi so với mặc định — cùng ô đang focus. Gọi trước khi vẽ; gọi hàm trả về sau khi vẽ (form không còn thì bỏ).
const daDoi = (e) => (e.tagName === 'SELECT' ? [...e.options].some((o) => o.selected !== o.defaultSelected)
  : e.type === 'checkbox' ? e.checked !== e.defaultChecked : e.value !== e.defaultValue);
export function giuONhap(vung) {
  if (!vung) return () => {};
  const ds = [...vung.querySelectorAll('form[id]')].map((f) => ({ id: f.id, mo: f.classList.contains('mo'),
    o: [...f.elements].filter((e) => e.name && e.type !== 'radio' && daDoi(e)).map((e) => [e.name, e.type === 'checkbox' ? e.checked : e.value]) }))
    .filter((x) => x.mo || x.o.length);
  const a = document.activeElement;
  const fc = a?.form?.id && a.name && vung.contains(a) ? { f: a.form.id, n: a.name, d: a.selectionStart, c: a.selectionEnd } : null;
  const o = (id, n) => { const e = vung.querySelector(`#${CSS.escape(id)}`)?.elements.namedItem(n); return e instanceof Element ? e : null; };
  return () => {
    ds.forEach(({ id, mo, o: gt }) => {
      const f = vung.querySelector(`#${CSS.escape(id)}`); if (!f) return;
      if (mo) f.classList.add('mo');
      gt.forEach(([n, v]) => { const e = o(id, n); if (e) { if (typeof v === 'boolean') e.checked = v; else e.value = v; } });
    });
    const e = fc && o(fc.f, fc.n);
    if (e) { e.focus(); try { e.setSelectionRange(fc.d, fc.c); } catch { /* ô không hỗ trợ chọn */ } }
  };
}
