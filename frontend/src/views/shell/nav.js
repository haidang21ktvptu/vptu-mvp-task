// Vẽ menu theo vai: hàng pill dưới dải (máy tính) và thanh dưới 3 mục + "Khác" (điện thoại). Cùng một bảng MENU; nút điện thoại
// có id <id>Duoi để không trùng id. Đánh dấu mục đang chọn ở cả hai nơi.
import { $, show, escapeHtml } from '../../lib/dom.js';
import { menuCuaVai } from './menu.js';

let items = [];

const badge = (it) => (it.badgeId ? `<span id="${it.badgeId}" class="huy-hieu hidden">0</span>` : '');
const badgeDuoi = (it) => (it.badgeId ? `<span id="${it.badgeId}Duoi" class="huy-hieu hidden">0</span>` : '');

function pillHtml(it) {
  return `<button type="button" id="${it.id}" role="tab" aria-selected="false" data-action="${it.action}" data-nav="${it.id}">${escapeHtml(it.label)}${badge(it)}</button>`;
}
function duoiHtml(it) {
  return `<button type="button" id="${it.id}Duoi" role="tab" aria-selected="false" data-action="${it.action}" data-nav="${it.id}">${escapeHtml(it.ngan)}${badgeDuoi(it)}</button>`;
}

export function renderNav(user) {
  items = menuCuaVai(user);
  $('mainNav').innerHTML = items.map(pillHtml).join('');
  const chinh = items.filter((it) => it.duoi).slice(0, 3);
  const khac = items.filter((it) => !chinh.includes(it));
  $('thanhDuoi').innerHTML = chinh.map(duoiHtml).join('')
    + (khac.length ? '<button type="button" id="navKhacDuoi" data-action="toggleNavKhac" aria-expanded="false">Khác</button>' : '');
  $('thanhKhac').innerHTML = khac.map(duoiHtml).join('');
  show('thanhKhac', false);
}

// Huy hiệu (chưa đọc) đặt ở cả pill và nút điện thoại.
export function setNavBadge(badgeId, n) {
  [badgeId, `${badgeId}Duoi`].forEach((id) => { const el = $(id); if (el) { el.innerText = n; show(el, n > 0); } });
}

export function setActiveNav(id) {
  document.querySelectorAll('#mainNav [data-nav], #thanhDuoi [data-nav], #thanhKhac [data-nav]').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.nav === id)));
  show('thanhKhac', false);
  $('navKhacDuoi')?.setAttribute('aria-expanded', 'false');
}

export function toggleNavKhac() {
  const mo = $('thanhKhac').classList.contains('hidden');
  show('thanhKhac', mo);
  $('navKhacDuoi')?.setAttribute('aria-expanded', String(mo));
}

export const navItems = () => items;
