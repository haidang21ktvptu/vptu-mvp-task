// Nhóm nút gom sau một nút (v3.36, CAU-HOI V-13, DESIGN mục 17): bấm nút mở danh sách hành động ngay dưới nút; chọn một hành động, bấm ra ngoài
// hoặc nhấn Esc thì đóng. Mục của danh sách là nút thường (giữ id và data-action của nút cũ); mục mang lớp `hidden` không hiện.
import { registerActions } from '../lib/actions.js';

const MUI = '<svg class="menu-tha-mui" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

export const menuThaHtml = (id, nhan, muc, lop = 'nut nho') => `<div class="menu-tha" id="${id}"><button type="button" class="${lop}" id="${id}Mo" data-action="menuTha" aria-haspopup="true" aria-expanded="false">${nhan}${MUI}</button><div class="menu-tha-ds" role="group" aria-label="${nhan}" hidden>${muc}</div></div>`;

const nutCua = (m) => m.querySelector(':scope > button');
const dsCua = (m) => m.querySelector(':scope > .menu-tha-ds');
const dangMo = () => [...document.querySelectorAll('.menu-tha > button[aria-expanded="true"]')].map((n) => n.parentElement);
function dong(m, traTieuDiem = false) {
  dsCua(m).hidden = true; nutCua(m).setAttribute('aria-expanded', 'false');
  if (traTieuDiem) nutCua(m).focus();
}

function menuTha(_, el) {
  const m = el.closest('.menu-tha'); const mo = el.getAttribute('aria-expanded') !== 'true';
  dangMo().forEach((x) => dong(x));
  if (!mo) return;
  const ds = dsCua(m); ds.classList.remove('trai'); ds.hidden = false; el.setAttribute('aria-expanded', 'true');
  if (ds.getBoundingClientRect().left < 8) ds.classList.add('trai');   // nút nằm sát mép trái (màn hẹp): danh sách mở về bên phải
}

// Gọi một lần lúc khởi động (sau initActionDelegation: hành động của mục chạy trước, rồi danh sách mới đóng).
export function mountMenuTha() {
  registerActions({ menuTha });
  document.addEventListener('click', (e) => dangMo().forEach((m) => { if (!m.contains(e.target) || e.target.closest('.menu-tha-ds button, .menu-tha-ds a')) dong(m); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dangMo().forEach((m) => dong(m, m.contains(document.activeElement))); });
}
