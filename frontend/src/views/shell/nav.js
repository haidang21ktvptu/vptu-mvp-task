// Vẽ menu theo vai (v8 đợt 1): menu dọc bên trái chia nhóm (máy tính, ≥ 901px; 601–900px thu thành thanh biểu tượng, nhãn ở title),
// ≤ 600px menu dọc thành ngăn kéo (body.menu-mo, nút ☰ trên thanh đầu trang) và thanh dưới 3 mục + "Khác". Cùng một bảng MENU; nút điện thoại
// có id <id>Duoi để không trùng id. Chân menu ghi phiên bản + giờ build đọc từ phien-ban.json (không có khi chạy local → để trống).
import { $, show, setText, escapeHtml } from '../../lib/dom.js';
import { menuCuaVai } from './menu.js';

let items = [];
const NHOM = ['Điều hành', 'Theo dõi', 'Trao đổi', 'Hệ thống'];

// Biểu tượng nét đơn (viewBox 24, stroke = màu chữ) theo id mục; mục lạ dùng dấu chấm tròn.
const ICON = {
  navDieuHanh: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  navChiDaoDaGui: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  navKl: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  navTheoDoi: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  navGiaoViec: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  navCanBo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/>',
  navBaoCao: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  dmBubbleLauncher: '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>',
  navQuanTri: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
};
const icon = (it) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[it.id] || '<circle cx="12" cy="12" r="4"/>'}</svg>`;
const badge = (it) => (it.badgeId ? `<span id="${it.badgeId}" class="huy-hieu hidden">0</span>` : '');
const badgeDuoi = (it) => (it.badgeId ? `<span id="${it.badgeId}Duoi" class="huy-hieu hidden">0</span>` : '');

function pillHtml(it) {
  return `<button type="button" id="${it.id}" role="tab" aria-selected="false" data-action="${it.action}" data-nav="${it.id}" title="${escapeHtml(it.label)}">${icon(it)}<span class="nhan-menu">${escapeHtml(it.label)}</span>${badge(it)}</button>`;
}
function duoiHtml(it) {
  return `<button type="button" id="${it.id}Duoi" role="tab" aria-selected="false" data-action="${it.action}" data-nav="${it.id}">${escapeHtml(it.ngan)}${badgeDuoi(it)}</button>`;
}

export function renderNav(user) {
  items = menuCuaVai(user);
  $('mainNav').innerHTML = NHOM.map((n) => { const ds = items.filter((it) => it.nhom === n); return ds.length ? `<div class="menu-nhom">${n}</div>${ds.map(pillHtml).join('')}` : ''; }).join('')
    + '<div class="menu-chan">Hệ thống quản trị nhiệm vụ<br><span id="menuPhienBan"></span></div>';
  veChanMenu();
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
  if (document.body.classList.contains('menu-mo')) toggleMenuDoc();
}

// Ngăn kéo menu dọc trên điện thoại (nút ☰ hoặc lớp mờ .menu-nen); chọn một mục (setActiveNav) thì đóng.
export function toggleMenuDoc() {
  const mo = !document.body.classList.contains('menu-mo');
  document.body.classList.toggle('menu-mo', mo);
  $('menuMoBtn')?.setAttribute('aria-expanded', String(mo));
}

async function veChanMenu() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}phien-ban.json`, { cache: 'no-store' });
    if (!r.ok) return;
    const pb = await r.json();
    const luc = pb.build_luc ? new Date(pb.build_luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
    // Mọi chuỗi 40 hex (có/không tiền tố "main@") → 7 ký tự; chỉ giữ số phiên bản dạng vX.Y.Z: "v3.6.3 · 309c1de · cập nhật 20/09 10:15", staging "bbbbcf5 · cập nhật …".
    const sha7 = (s) => (String(s || '').match(/[0-9a-f]{40}/i) || [''])[0].slice(0, 7);
    const phienBan = (String(pb.phien_ban || '').match(/^v\d[\w.-]*/) || [''])[0];
    const sha = sha7(pb.commit) || sha7(pb.phien_ban);
    setText('menuPhienBan', [phienBan, sha, luc && `cập nhật ${luc}`].filter(Boolean).join(' · '));
  } catch { return; }
}

export function toggleNavKhac() {
  const mo = $('thanhKhac').classList.contains('hidden');
  show('thanhKhac', mo);
  $('navKhacDuoi')?.setAttribute('aria-expanded', String(mo));
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-mo')) toggleMenuDoc(); });

export const navItems = () => items;
