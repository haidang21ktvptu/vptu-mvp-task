// Khung sau đăng nhập (v8 đợt 1): thanh đầu trang (Tìm → Chuông → avatar + tên hai dòng → Bánh răng), menu dọc theo vai bên trái,
// hiện đúng một section trong trang; gọi view.init() theo vai. Đăng xuất nằm trong menu bánh răng (shell/banh-rang.js).
import { $, show, setText } from '../../lib/dom.js';
import { nhanChucDanh } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { supabase } from '../../lib/supabase.js';
import { veAnh } from '../../lib/anh-ho-so.js';
import { registerActions } from '../../lib/actions.js';
import { getView } from '../registry.js';
import { renderNav, toggleNavKhac, toggleMenuDoc, doiNhomMenu } from './nav.js';
import { renderBanhRang } from './banh-rang.js';
import { ngayVanBanVN } from '../../lib/kl/ngay.js';
import { batDauRa, batDauVao } from './chuyen-trang.js';   // v3.36 (V-12): mục cũ nhòe rồi mờ, mục mới hiện lần lượt
import { chayMoDau } from './mo-dau.js';

export { setActiveNav, setNavBadge } from './nav.js';

const SECTIONS = ['viewTongQuan', 'viewDieuHanh', 'viewChiDaoDaGui', 'viewKl', 'viewTheoVanBan', 'viewRaSoatMucTieu', 'viewChiDaoTTThuKy', 'viewGiaoViec', 'viewCanBo', 'viewBaoCao', 'viewNvq', 'viewNhanTin', 'viewQuanTri', 'viewCaNhan', 'viewTroGiup'];

// Hiện đúng một section trong vùng nội dung.
// Đổi mục: phát sự kiện 'doi-man' (ngăn chi tiết dùng chung tự đóng); mở lại đúng mục đang xem thì không phát.
// v3.36 (CAU-HOI V-12): đổi mục có chuyển động (chuyen-trang.js) — lớp .hidden vẫn đổi ngay tại đây như trước.
export function showSection(id) {
  const cu = SECTIONS.find((s) => sectionDangHien(s));
  const doi = cu !== id;
  if (doi) batDauRa($(cu));
  SECTIONS.forEach((s) => show(s, s === id));
  window.scrollTo({ top: 0 });
  if (!doi) return;
  batDauVao($(cu), $(id));
  document.dispatchEvent(new CustomEvent('doi-man', { detail: id }));
}

export const sectionDangHien = (id) => !$(id)?.classList.contains('hidden');

// Chữ cái đầu của tên (họ tên Việt: lấy tên cuối), thay bằng ảnh hồ sơ qua signed URL khi có (C2).
export function renderAvatar(user = state.user) {
  veAnh($('avatarNguoi'), user);
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
  chayMoDau();   // v3.36: bỏ màn chờ, khung ứng dụng mở ra theo hình tròn từ biểu trưng
  setText('currentUserDisplay', user.full_name);
  setText('ngayVanBan', ngayVanBanVN());
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

registerActions({ toggleNavKhac, toggleMenuDoc, doiNhomMenu });
