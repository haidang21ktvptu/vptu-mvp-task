// Khối "Dữ liệu gốc từ Excel" của ngăn chi tiết (v9 đợt 2): việc được tạo / cập nhật từ lô nhập Excel (lịch sử có dòng "nhap_excel") hiện dòng tệp
// tương ứng — lô, tên tệp, số dòng và MỌI cột của tệp, kể cả cột hệ thống không dùng (không mất thông tin khi chuyển từ bảng tính). Đọc theo RLS
// (người thấy việc); không có dòng nhập → ẩn khối.
import { $, show, escapeHtml, formatDateTime } from '../../../lib/dom.js';
import { docDuLieuGoc } from '../../../lib/kl/nhap/du-lieu.js';
import { hienGoc } from '../../../lib/kl/nhap/bang.js';

export const coNhapExcel = (ls) => ls.some((l) => l.cot === 'nhap_excel');
export const khoiDuLieuGocHtml = (r) => `<details class="khoi-nho nx-goc hidden" id="klGoc-${r.id}"><summary>Dữ liệu gốc từ Excel <span class="chu-phu">mọi cột của dòng trong tệp đã nhập</span></summary><div></div></details>`;

export async function napDuLieuGoc(r) {
  if (!$(`klGoc-${r.id}`)) return;
  const ds = await docDuLieuGoc(r.id);
  const o = $(`klGoc-${r.id}`); if (!o) return;
  if (!ds.length) { show(o, false); return; }
  o.querySelector(':scope > div').innerHTML = ds.map((d) => `<p class="chu-phu">${d.lo_nhap?.ma ? `Lô ${escapeHtml(d.lo_nhap.ma)} · tệp ${escapeHtml(d.lo_nhap.ten_tep)} · ` : ''}dòng ${d.so_dong}
    · ${formatDateTime(d.xu_ly_luc)}</p><dl class="nx-goc-ds">${Object.entries(d.du_lieu_goc || {}).map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(hienGoc(v))}</dd></div>`).join('')}</dl>`).join('');
  show(o, true);
}
