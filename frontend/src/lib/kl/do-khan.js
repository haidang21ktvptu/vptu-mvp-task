// Độ khẩn 4 cấp (0035): tên, thứ tự (1 = Hỏa tốc), lớp nhãn (tên lớp nguyên văn — Tailwind cắt lớp ghép chuỗi), biểu tượng nét đơn.
// Nhãn phụ dùng chung cho thẻ/dòng/ngăn: Thường trực giao, Thay mặt <chức danh> giao, Bị từ chối. DB là nguồn (nhiem_vu.do_khan / uu_tien /
// giao_thay_mat_cho, chi_dao.do_khan); ở đây chỉ đặt tên và vẽ.
import { escapeHtml } from '../dom.js';
import { findAccount } from '../state.js';

export const DO_KHAN = {
  THUONG:      { ten: 'Thường',      thuTu: 4, lop: 'dk dk-thuong',      ico: '<circle cx="12" cy="12" r="4"/>' },
  KHAN:        { ten: 'Khẩn',        thuTu: 3, lop: 'dk dk-khan',        ico: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>' },
  THUONG_KHAN: { ten: 'Thượng khẩn', thuTu: 2, lop: 'dk dk-thuong-khan', ico: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/><path d="M19 3v5M19 11v.5"/>' },
  HOA_TOC:     { ten: 'Hỏa tốc',     thuTu: 1, lop: 'dk dk-hoa-toc',     ico: '<path d="M12 22c4-2 6-5 6-8a6 6 0 0 0-3-5c0 2-1 3-2 3 0-3-1-5-4-7 0 3-1 4-3 6a6 6 0 0 0-1 3c0 3 2 6 7 8z"/>' },
};
export const THU_TU_DO_KHAN = ['THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC'];
export const doKhanCua = (ma) => DO_KHAN[ma] || DO_KHAN.THUONG;
export const tenDoKhan = (ma) => doKhanCua(ma).ten;
export const thuTuDoKhan = (r) => doKhanCua(r?.do_khan).thuTu;
const ico = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.ico}</svg>`;

// Nhãn màu + biểu tượng của một cấp; Thường không hiện (an = true) trừ khi bắt buộc.
export function nhanDoKhanHtml(ma, luonHien = false) {
  const d = doKhanCua(ma);
  if (!luonHien && (!ma || ma === 'THUONG')) return '';
  return `<span class="${d.lop}" data-do-khan="${escapeHtml(ma || 'THUONG')}">${ico(d)}${d.ten}</span>`;
}

// Bốn nút chọn độ khẩn (aria-pressed), ô ẩn name=do_khan (id tuỳ chọn) giữ giá trị; onclick uỷ quyền qua data-action="chonDoKhan".
export function nutDoKhanHtml(name = 'do_khan', chon = 'THUONG', id = name) {
  return `<div class="dk-chon" role="group" aria-label="Độ khẩn" data-name="${escapeHtml(name)}">
    ${THU_TU_DO_KHAN.map((k) => `<button type="button" class="${DO_KHAN[k].lop}" data-action="chonDoKhan" data-gia-tri="${k}" aria-pressed="${String(k === chon)}">${ico(DO_KHAN[k])}${DO_KHAN[k].ten}</button>`).join('')}
    <input type="hidden" name="${escapeHtml(name)}" id="${escapeHtml(id)}" value="${escapeHtml(chon)}"></div>`;
}
// Xử lý bấm nút: đổi aria-pressed trong nhóm và giá trị ô ẩn.
export function chonDoKhan({ giaTri }, el) {
  const nhom = el.closest('.dk-chon');
  if (!nhom) return;
  nhom.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
  const inp = nhom.querySelector('input[type=hidden]');
  if (inp) { inp.value = giaTri; inp.dispatchEvent(new Event('change', { bubbles: true })); }
}

// Nhãn phụ trên thẻ/dòng: Thường trực giao · Thay mặt <chức danh> giao · Bị từ chối · Đề nghị từ chối.
export function nhanPhuHtml(r) {
  const tm = r.giao_thay_mat_cho ? findAccount(r.giao_thay_mat_cho) : null;
  return [
    nhanDoKhanHtml(r.do_khan),
    r.uu_tien === 'THUONG_TRUC' ? '<span class="nhan-tt">Thường trực giao</span>' : '',
    r.giao_thay_mat_cho ? `<span class="nhan-xam">Thay mặt ${escapeHtml(tm?.position_title || r.giao_thay_mat_cho_ten || 'lãnh đạo')} giao</span>` : '',
    r.bi_tu_choi ? '<span class="nhan-tu-choi">Bị từ chối</span>' : r.tu_choi_cho ? '<span class="nhan-xam">Đề nghị từ chối, chờ duyệt</span>' : '',
  ].filter(Boolean).join(' ');
}

// So sánh cho mọi danh sách: độ khẩn (Hỏa tốc trước) → Thường trực giao → phần còn lại do màn hình quyết.
export const soSanhDoKhan = (a, b) => thuTuDoKhan(a) - thuTuDoKhan(b) || (b.uu_tien === 'THUONG_TRUC' ? 1 : 0) - (a.uu_tien === 'THUONG_TRUC' ? 1 : 0);
