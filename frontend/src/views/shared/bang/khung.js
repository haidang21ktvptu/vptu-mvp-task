// Khung dùng chung của các bảng nhiệm vụ theo cột (v3.25, mẫu 16/10/2026 — Nhiệm vụ, Việc của tôi, Việc tôi theo dõi, Theo văn bản): ô số (chọn
// một ô một lúc; số đếm trên cùng mảng với bảng), hàng tiêu đề cột, chú giải màu mức, nút trang, giữ nút đang focus qua lần vẽ lại (realtime /
// sau hành động). Tên lớp viết nguyên văn (Tailwind giữ lớp).
import { escapeHtml } from '../../../lib/dom.js';

// ds: [[khoá, tên, …]]; so: { khoá: số }; mau: { khoá: lớp màu của số — vang | do | luc | canh }.
export const oSoHtml = (ds, so, chon, action, mau = {}) => ds.map(([k, ten]) => `<button type="button" class="o-so${mau[k] ? ` ${mau[k]}` : ''}" data-action="${action}" data-loc="${k}" aria-pressed="${String(chon === k)}"><span>${escapeHtml(ten)}</span><b>${so[k] ?? 0}</b></button>`).join('');
// cot: [[tên cột, lớp]] — hàng tiêu đề chỉ để nhìn (mỗi ô của dòng có nhãn riêng — data-nhan — khi bảng thành thẻ).
export const dauBangHtml = (cot) => cot.map(([ten, lop]) => `<span${lop ? ` class="${lop}"` : ''}>${ten}</span>`).join('');
export const CHU_GIAI_MUC = '<span><i class="dac-biet"></i>Đỏ đặc biệt: quá hạn từ 3 ngày</span><span><i class="do"></i>Đỏ: quá hạn</span>'
  + '<span><i class="vang"></i>Vàng: còn không quá 3 ngày</span><span><i class="lam"></i>Trong hạn</span><span><i class="luc"></i>Hoàn thành</span>';

// Nút trang (chỉ khi nhiều hơn một trang): ‹ Trang trước · Trang x/y · Trang sau ›.
export function nutTrangHtml(p, action) {
  if (p.soTrang <= 1) return '';
  const nut = (t, chu, tat) => `<button type="button" class="nut nho" data-action="${action}" data-trang="${t}"${tat ? ' disabled' : ''}>${chu}</button>`;
  return `${nut(p.trang - 1, '‹ Trang trước', p.trang <= 1)}<span class="bnv-so-trang">Trang ${p.trang}/${p.soTrang}</span>${nut(p.trang + 1, 'Trang sau ›', p.trang >= p.soTrang)}`;
}

// Giữ nút đang focus (cùng data-action và data-id / loc / kieu / trang / pv / vai) qua lần vẽ lại innerHTML của vùng; ô trong biểu mẫu do
// giuONhap (lib/dom.js) giữ.
const KHOA = ['action', 'id', 'loc', 'kieu', 'trang', 'pv', 'vai', 'qh'];
export function giuTieuDiem(vung) {
  const a = document.activeElement;
  if (!vung || !a || !vung.contains(a) || !a.dataset?.action || a.form) return () => {};
  const sel = KHOA.filter((k) => a.dataset[k] !== undefined).map((k) => `[data-${k}="${CSS.escape(a.dataset[k])}"]`).join('');
  return () => { const e = vung.querySelector(sel); if (e && e !== document.activeElement && !e.disabled) e.focus({ preventScroll: true }); };
}
