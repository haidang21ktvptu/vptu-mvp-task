// Khung sau đăng nhập (v8 đợt 1): thanh đầu trang (Tìm → Chuông → avatar + tên hai dòng → Bánh răng), menu dọc theo vai bên trái,
// hiện đúng một section trong trang; gọi view.init() theo vai. Đăng xuất nằm trong menu bánh răng (shell/banh-rang.js).
import { $, show, setText, escapeHtml } from '../../lib/dom.js';
import { nhanChucDanh } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { supabase } from '../../lib/supabase.js';
import { registerActions } from '../../lib/actions.js';
import { getView } from '../registry.js';
import { renderNav, toggleNavKhac, toggleMenuDoc } from './nav.js';
import { renderBanhRang } from './banh-rang.js';

export { setActiveNav, setNavBadge } from './nav.js';

const SECTIONS = ['viewDieuHanh', 'viewChiDaoDaGui', 'viewKl', 'viewGiaoViec', 'viewCanBo', 'viewBaoCao', 'viewNhanTin', 'viewQuanTri', 'viewCaNhan', 'viewTroGiup'];

// Hiện đúng một section trong vùng nội dung.
export function showSection(id) {
  SECTIONS.forEach((s) => show(s, s === id));
  window.scrollTo({ top: 0 });
}

export const sectionDangHien = (id) => !$(id)?.classList.contains('hidden');

// Chữ cái đầu của tên (họ tên Việt: lấy tên cuối) hoặc ảnh hồ sơ.
export function renderAvatar(user = state.user) {
  const el = $('avatarNguoi');
  if (!el || !user) return;
  const ten = (user.full_name || '').trim().split(/\s+/).pop() || '?';
  el.innerHTML = user.anh_url ? `<img src="${escapeHtml(user.anh_url)}" alt="">` : escapeHtml(ten.charAt(0).toUpperCase());
}

// Dòng 2 dưới tên: PCVP cần danh sách phòng đang phụ trách (phu_trach_phong hiệu lực hôm nay) — đọc một lần khi vào app.
export async function renderChucDanh(user = state.user) {
  let phong = [];
  if (user?.role_group === 'A1' && !user.is_chief) {
    const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const { data } = await supabase.from('phu_trach_phong').select('phong').eq('lanh_dao_id', user.id).lte('tu_ngay', hom).or(`den_ngay.is.null,den_ngay.gte.${hom}`);
    phong = [...new Set((data || []).map((r) => r.phong))];
  }
  setText('currentRoleDisplay', nhanChucDanh(user, phong));
}

export function initUserInterface() {
  const user = state.user;
  const view = getView(user.role_group);
  show('loginSection', false);
  show('appShell', true);
  setText('currentUserDisplay', user.full_name);
  setText('currentRoleDisplay', nhanChucDanh(user));
  renderAvatar(user);
  renderChucDanh(user);
  document.body.classList.toggle('ban-gon', user.role_group === 'A0' && user.tuy_chon?.ban_gon === true);
  renderNav(user);
  renderBanhRang(user);
  view?.init();
}

// Nạp lại view hiện tại sau thao tác làm đổi dữ liệu (phân công lại, duyệt...).
export function reloadCurrentView() {
  getView(state.user?.role_group)?.reload();
}

registerActions({ toggleNavKhac, toggleMenuDoc });
