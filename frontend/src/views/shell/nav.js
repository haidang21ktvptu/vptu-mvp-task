// Vẽ menu theo vai (v8 đợt 1): menu dọc bên trái chia nhóm (máy tính, ≥ 901px; 601–900px thu thành thanh biểu tượng, nhãn ở title),
// v3.36 (CAU-HOI V-1): tiêu đề nhóm là nút thu gọn / mở nhóm (aria-expanded); lãnh đạo mặc định thu nhóm Nhiệm vụ quý BTV (Tổng quan đã có dòng nhiệm
// vụ quý); lựa chọn lưu trên máy theo tài khoản (localStorage — lỗi thì chỉ giữ trong phiên); nhóm chứa mục đang mở luôn mở; thanh biểu tượng mở mọi nhóm.
// ≤ 600px menu dọc thành ngăn kéo (body.menu-mo, nút ☰ trên thanh đầu trang) và thanh dưới 3 mục + "Khác". Cùng một bảng MENU; nút điện thoại
// có id <id>Duoi để không trùng id. Chân menu ghi phiên bản + giờ build đọc từ phien-ban.json (không có khi chạy local → để trống).
import { $, show, setText, escapeHtml } from '../../lib/dom.js';
import { menuCuaVai } from './menu.js';
import { chuyenVienXemPhong, xemToanBo } from '../../lib/kl/du-lieu.js';
import { ghiDuongDan, datMenuDuongDan } from './duong-dan.js';   // v3.29: đường dẫn riêng từng chức năng
import { nq } from '../../lib/nvq/du-lieu.js';   // v3.35: quyền phân hệ Nhiệm vụ quý BTV
import { DAU_CHON_HTML, datDauChon } from './dau-chon.js';   // v3.36 (V-12): dấu chọn trượt theo mục đang chọn
import { vaoCungMuc } from './chuyen-trang.js';

let items = [];
const NHOM = ['Điều hành', 'Nhiệm vụ', 'Nhiệm vụ quý BTV', 'Quản trị'];   // v3.23: bỏ nhóm Trao đổi; v3.35: Nhiệm vụ quý BTV; v3.36: đổi tên nhóm
const THU_MAC_DINH = { A0: ['Nhiệm vụ quý BTV'], A1: ['Nhiệm vụ quý BTV'], A2: ['Nhiệm vụ quý BTV'] };
let nguoi = null; let nhomThu = null;   // tài khoản của lần vẽ menu gần nhất; tập nhóm đang thu
const khoaThu = () => `vptu.menuNhomThu.${nguoi?.id || ''}`;
function docNhomThu() {
  if (nhomThu) return nhomThu;
  let luu;
  try { luu = JSON.parse(localStorage.getItem(khoaThu()) || 'null'); } catch { luu = null; }
  nhomThu = new Set(Array.isArray(luu) ? luu : THU_MAC_DINH[nguoi?.role_group] || []);
  return nhomThu;
}
function ghiNhomThu() { try { localStorage.setItem(khoaThu(), JSON.stringify([...nhomThu])); } catch { /* trình duyệt chặn lưu: giữ trong phiên */ } }
const MUI = '<svg class="mui" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function nhomHtml(n, i, ds) {
  const thu = docNhomThu().has(n);
  return `<div class="menu-khoi" role="group" aria-labelledby="menuNhom${i}"><button type="button" class="menu-nhom" id="menuNhom${i}" data-action="doiNhomMenu" data-nhom="${escapeHtml(n)}"
    aria-expanded="${String(!thu)}" aria-controls="menuDs${i}"><span>${n}</span>${MUI}</button>
    <div class="menu-ds" id="menuDs${i}" role="tablist" aria-label="${escapeHtml(n)}"${thu ? ' hidden' : ''}>${ds.map(pillHtml).join('')}</div></div>`;
}
// Mở / thu một nhóm. Người dùng bấm tiêu đề nhóm thì lưu lựa chọn; mở vì mục đang chọn nằm trong nhóm đang thu (luu = false) thì không lưu.
function datNhom(nut, mo, luu = true) {
  const ds = nut && $(nut.getAttribute('aria-controls'));
  if (!ds) return;
  nut.setAttribute('aria-expanded', String(mo)); ds.hidden = !mo;
  if (luu) { docNhomThu()[mo ? 'delete' : 'add'](nut.dataset.nhom); ghiNhomThu(); }
  datDauChon({ ngay: true });   // các mục bên dưới đổi chỗ: dấu chọn theo ngay, không trượt
}
export const doiNhomMenu = (_d, el) => datNhom(el, el.getAttribute('aria-expanded') !== 'true');

// Biểu tượng nét đơn (viewBox 24, stroke = màu chữ) theo id mục; mục lạ dùng dấu chấm tròn.
const ICON = {
  navTongQuan: '<path d="M3.5 16a8.5 8.5 0 1 1 17 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.6"/><path d="M5 20h14"/>',
  navDieuHanh: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  navChiDaoDaGui: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  navKl: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  navTheoVanBan: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  navChiDaoTTThuKy: '<path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  navDaGiao: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>',
  navGiaoViec: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>',
  navNhapExcel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  navCanBo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5a5 5 0 0 1 6 5"/>',
  navBaoCao: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  navNqTongQuan: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 15l2.5 2.5L16 12"/>',
  navNqDanhMuc: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11"/><circle cx="5" cy="18" r="1.3"/>',
  navNqCapNhat: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  navNqBaoCao: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 17v-3M12 17v-5M15 17v-2"/>',
  navNqQuanLy: '<path d="M4 6h10M4 12h6M4 18h10"/><circle cx="17" cy="6" r="2"/><circle cx="13" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
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
  // 0086: Tổng quan phòng, Nhiệm vụ của phòng cho chuyên viên; 0103: Tổng quan chung, Toàn bộ nhiệm vụ (cấu hình xem toàn bộ)
  items = menuCuaVai(user, { xemPhong: user?.role_group === 'A3' && chuyenVienXemPhong(), xemToanBo: xemToanBo(),
    nvq: { quanLy: Boolean(nq.quyen.quan_ly), phanQuyen: Boolean(nq.quyen.phan_quyen) } });   // v3.35: quyền nạp lúc vào app (auth/session.js)
  datMenuDuongDan(items);
  nguoi = user; nhomThu = null;   // đọc lại lựa chọn thu nhóm của tài khoản đang đăng nhập
  $('mainNav').classList.remove('co-dau');   // menu vẽ lại: lần đặt dấu chọn kế tiếp vào thẳng chỗ, không trượt từ góc
  $('mainNav').innerHTML = NHOM.map((n, i) => { const ds = items.filter((it) => it.nhom === n); return ds.length ? nhomHtml(n, i, ds) : ''; }).join('')
    + '<div class="menu-chan">Hệ thống quản trị nhiệm vụ<br><span id="menuPhienBan"></span></div>' + DAU_CHON_HTML;   // dấu chọn đặt cuối: không đổi con đầu của menu (.menu-khoi:first-child)
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

let navDangChon = null;   // mục menu của lần setActiveNav gần nhất
export function setActiveNav(id) {
  // v3.36: đổi mục menu trong cùng mục nội dung (trang của Nhiệm vụ quý…) cũng có hiệu ứng vào trang — xét sau khi lệnh mở màn chạy xong (showSection có thể gọi sau)
  if (id !== navDangChon) { navDangChon = id; queueMicrotask(vaoCungMuc); }
  document.querySelectorAll('#mainNav [data-nav], #thanhDuoi [data-nav], #thanhKhac [data-nav]').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.nav === id)));
  const ds = $(id)?.closest('.menu-ds');
  if (ds?.hidden) datNhom(ds.parentElement.querySelector('.menu-nhom'), true, false);   // mục đang mở nằm trong nhóm đang thu: mở nhóm, không lưu
  datDauChon();   // v3.36: dấu chọn trượt sang mục mới
  show('thanhKhac', false);
  $('navKhacDuoi')?.setAttribute('aria-expanded', 'false');
  if (document.body.classList.contains('menu-mo')) toggleMenuDoc();
  ghiDuongDan(id);   // v3.29: thanh địa chỉ theo màn (mọi màn đều gọi setActiveNav)
}

// Ngăn kéo menu dọc trên điện thoại (nút ☰ hoặc lớp mờ .menu-nen); chọn một mục (setActiveNav) thì đóng.
export function toggleMenuDoc() {
  const mo = !document.body.classList.contains('menu-mo');
  document.body.classList.toggle('menu-mo', mo);
  $('menuMoBtn')?.setAttribute('aria-expanded', String(mo));
  if (mo) datDauChon({ ngay: true });   // ngăn kéo vừa hiện: giờ mới đo được vị trí mục đang chọn
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
