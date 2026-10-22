// Khung dùng chung của các bảng nhiệm vụ theo cột (v3.25, mẫu 16/10/2026 — Nhiệm vụ, Việc của tôi, Việc tôi theo dõi, Theo văn bản): ô số (chọn
// một ô một lúc; số đếm trên cùng mảng với bảng), hàng tiêu đề cột, chú giải màu mức, nút trang, giữ nút đang focus qua lần vẽ lại (realtime /
// sau hành động). Tên lớp viết nguyên văn (Tailwind giữ lớp).
import { escapeHtml } from '../../../lib/dom.js';

// ds: [[khoá, tên, …]]; so: { khoá: số }; mau: { khoá: lớp màu của số — vang | do | luc | canh }.
export const oSoHtml = (ds, so, chon, action, mau = {}) => ds.map(([k, ten]) => `<button type="button" class="o-so${mau[k] ? ` ${mau[k]}` : ''}" data-action="${action}" data-loc="${k}" aria-pressed="${String(chon === k)}"><span>${escapeHtml(ten)}</span><b>${so[k] ?? 0}</b></button>`).join('');
// cot: [[tên cột, lớp]] — hàng tiêu đề chỉ để nhìn (mỗi ô của dòng có nhãn riêng — data-nhan — khi bảng thành thẻ).
export const dauBangHtml = (cot) => cot.map(([ten, lop]) => `<span${lop ? ` class="${lop}"` : ''}>${ten}</span>`).join('');
// v3.29: chú giải ghi nghĩa trước, tên mức theo Công văn 1400 trong ngoặc (số ngày theo mặc định cấu hình — như nhãn ở lib/kl/nhan.js tenMuc).
export const CHU_GIAI_MUC = '<span><i class="dac-biet"></i>Quá hạn từ 3 ngày trở lên (mức Đỏ đặc biệt)</span><span><i class="do"></i>Quá hạn dưới 3 ngày (mức Đỏ)</span>'
  + '<span><i class="vang"></i>Sắp đến hạn: còn ≤ 3 ngày (mức Vàng)</span><span><i class="lam"></i>Trong hạn</span><span><i class="luc"></i>Hoàn thành</span>';

// Nút trang (chỉ khi nhiều hơn một trang): ‹ Trang trước · Trang x/y · Trang sau › (data-huong để giữ con trỏ bàn phím khi sang trang).
export function nutTrangHtml(p, action) {
  if (p.soTrang <= 1) return '';
  const nut = (t, chu, tat, huong) => `<button type="button" class="nut nho" data-action="${action}" data-trang="${t}" data-huong="${huong}"${tat ? ' disabled' : ''}>${chu}</button>`;
  return `${nut(p.trang - 1, '‹ Trang trước', p.trang <= 1, 'truoc')}<span class="bnv-so-trang">Trang ${p.trang}/${p.soTrang}</span>${nut(p.trang + 1, 'Trang sau ›', p.trang >= p.soTrang, 'sau')}`;
}

// Giữ nút đang focus qua lần vẽ lại innerHTML của vùng (ô trong biểu mẫu do giuONhap — lib/dom.js — giữ). Nút của một việc: data-action + id
// (+ kieu) — bỏ thuộc tính đổi theo trạng thái (mức, nhóm); nút khác: mọi thuộc tính định danh có mặt (ô số, phạm vi, vai trò, quan hệ, văn bản,
// biểu mẫu, mục dải Cần xử lý, chiều trang). Nút trang tới trang cuối / đầu bị tắt → sang nút trang còn lại.
const KHOA = ['action', 'loc', 'kieu', 'pv', 'vai', 'qh', 'khoa', 'vb', 'o', 'muc', 'nv', 'tb', 'sx', 'huong'];
const tenThuocTinh = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
export function giuTieuDiem(vung) {
  const a = document.activeElement;
  if (!vung || !a || !vung.contains(a) || !a.dataset?.action || a.form) return () => {};
  const khoa = a.dataset.id !== undefined ? ['action', 'id', 'kieu'] : KHOA;
  const sel = khoa.filter((k) => a.dataset[k] !== undefined).map((k) => `[data-${tenThuocTinh(k)}="${CSS.escape(a.dataset[k])}"]`).join('');
  const { action, huong } = a.dataset;
  return () => {
    let e = vung.querySelector(sel);
    if ((!e || e.disabled) && huong) e = vung.querySelector(`[data-action="${CSS.escape(action)}"][data-huong]:not([disabled])`);
    if (e && e !== document.activeElement && !e.disabled) e.focus({ preventScroll: true });
  };
}
