// v3.36 (CAU-HOI V-1, rà soát 25/11/2026): thẻ việc ở Cần xử lý hiện nội dung tối đa hai dòng (lớp .nd-gon — the-viec.css), mã việc đứng đầu cùng
// khối; nguyên văn ở title (rê chuột) và ở ngăn chi tiết. Thông tin phụ (hạn, người, nhãn) xuống dòng riêng bằng .nd-phu nên không bị cắt.
import { escapeHtml } from '../dom.js';

export const ndGonHtml = (ma, noiDung, maHtml = '') => `<span class="nd-gon" title="${escapeHtml(noiDung || '')}">${maHtml
  || (ma ? `<b>${escapeHtml(ma)}</b> ` : '')}${escapeHtml(noiDung || '')}</span>`;

// Dòng phụ dưới nội dung (chuỗi HTML đã thoát ký tự ở nơi gọi); rỗng thì không vẽ.
export const ndPhuHtml = (html) => (html && String(html).trim() ? `<span class="nd-phu">${html}</span>` : '');
