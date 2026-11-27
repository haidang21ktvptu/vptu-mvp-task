// Gợi ý dùng chung cho mọi màn hình (v3.36, CAU-HOI V-13, DESIGN mục 17): phần tử mang data-goi hiện một hộp gợi ý khi rê chuột, đưa tiêu điểm bàn
// phím hoặc chạm; nút "i" .nut-goi cạnh tên khối mang ghi chú của khối. Một hộp duy nhất gắn vào <body> (ngoài mọi màn hình, không in). Trước đây chỉ
// Tổng quan có hộp riêng (#tqGoi).
import { escapeHtml } from '../lib/dom.js';

export const thuocGoi = (chu) => (chu ? ` data-goi="${escapeHtml(chu)}"` : '');
export const nutGoi = (chu) => (chu ? `<button type="button" class="nut-goi" data-goi="${escapeHtml(chu)}" aria-label="${escapeHtml(`Ghi chú: ${chu}`)}">i</button>` : '');

let hop = null; let neo = null; let hen = 0;
export function anGoi() { if (hop) hop.hidden = true; neo = null; clearInterval(hen); hen = 0; }

function hienGoi(e) {
  const el = e.target.closest?.('[data-goi]');
  if (!el) { anGoi(); return; }
  if (!hop) {
    hop = document.createElement('div'); hop.id = 'goiChung'; hop.className = 'goi-tq'; hop.setAttribute('role', 'tooltip');
    document.body.appendChild(hop);
  }
  hop.textContent = el.dataset.goi; hop.hidden = false;
  neo = el; if (!hen) hen = setInterval(() => { if (!neo?.isConnected) anGoi(); }, 400);   // màn hình vẽ lại nền (realtime) làm phần tử neo rời trang: ẩn hộp
  const r = el.getBoundingClientRect(); const w = hop.offsetWidth;
  hop.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  hop.style.top = `${Math.max(8, r.top - hop.offsetHeight - 8)}px`;
}

// Gọi một lần lúc khởi động. Bấm ra ngoài thì ẩn hộp; bấm phần tử có hành động (mở danh sách, lọc, chuyển màn) cũng ẩn vì màn hình sắp vẽ lại.
// Nút "i" và phần tử chỉ để đọc (không có hành động) giữ hộp: trên màn hình chạm, chạm vào chính là cách đọc gợi ý.
export function mountGoi() {
  document.addEventListener('mouseover', hienGoi);
  document.addEventListener('focusin', hienGoi);
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest?.('.nut-goi')) return;
    if (!t.closest?.('[data-goi]') || t.closest('[data-action]')) anGoi();
  });
  window.addEventListener('scroll', anGoi, { passive: true, capture: true });
}
