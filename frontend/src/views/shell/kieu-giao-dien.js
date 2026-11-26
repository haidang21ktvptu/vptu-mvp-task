// Kiểu giao diện v9 (docs/DESIGN.md mục 2): Thanh lịch (mặc định, lam) / Trang nghiêm (đỏ son), nền tối bật/tắt — chọn ở menu bánh răng, nhớ
// THEO MÁY (localStorage; trình duyệt chặn lưu trữ thì vẫn đổi được trong phiên). index.html đặt sẵn các thuộc tính trên <html> trước khi vẽ
// để không chớp kiểu mặc định. Chỉ là trình bày: không ghi gì lên máy chủ.
// v3.36 (CAU-HOI V-1): "Cỡ chữ lớn" — <html data-co-chu="lon"> đặt gốc 18px, cả thang chữ rem (tokens.css) lớn theo. Máy chưa chọn thì theo
// vai: lãnh đạo (Thường trực A0, lãnh đạo Văn phòng A1) mặc định cỡ lớn; người khác cỡ vừa. Chọn ở menu thì nhớ theo máy ('lon' | 'vua').
import { registerActions } from '../../lib/actions.js';
import { state } from '../../lib/state.js';
import { onSessionEnter } from '../../auth/session.js';

const goc = () => document.documentElement;
const KHOA_KIEU = 'vptu.kieu'; const KHOA_TOI = 'vptu.nen-toi'; const KHOA_CO_CHU = 'vptu.co-chu'; const KHOA_CHUYEN_DONG = 'vptu.chuyen-dong';

export const kieuHienTai = () => (goc().getAttribute('data-kieu') === 'trang-nghiem' ? 'trang-nghiem' : 'thanh-lich');
export const nenToiDangBat = () => goc().getAttribute('data-theme') === 'dark';
export const coChuLon = () => goc().getAttribute('data-co-chu') === 'lon';
// v3.36 (CAU-HOI V-12): "Hiệu ứng chuyển động" — bỏ chọn thì <html data-chuyen-dong="giam"> tắt mọi hiệu ứng (styles/chuyen-dong.css, lib/chuyen-dong.js).
export const chuyenDongBat = () => goc().getAttribute('data-chuyen-dong') !== 'giam';

function ghiNho(khoa, giaTri) {
  try { if (giaTri) localStorage.setItem(khoa, giaTri); else localStorage.removeItem(khoa); } catch { /* chặn lưu trữ: chỉ đổi trong phiên */ }
}
function docNho(khoa) {
  try { return localStorage.getItem(khoa); } catch { return null; }
}

// Màu thanh trình duyệt điện thoại theo màu menu của kiểu đang dùng.
function capNhatMauThanh() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const mau = getComputedStyle(goc()).getPropertyValue('--ben-mau').trim();
  if (meta && mau) meta.setAttribute('content', mau);
}

// Đánh dấu lại các mục đang mở trong menu bánh răng (không vẽ lại menu — tránh phụ thuộc vòng với banh-rang.js).
function danhDauMenu() {
  document.querySelectorAll('#banhRangMenu [data-action="datKieuGiaoDien"]').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.kieu === kieuHienTai())));
  document.querySelectorAll('#banhRangMenu [data-action="doiNenToi"]').forEach((el) => el.setAttribute('aria-checked', String(nenToiDangBat())));
  document.querySelectorAll('#banhRangMenu [data-action="doiCoChu"]').forEach((el) => el.setAttribute('aria-checked', String(coChuLon())));
  document.querySelectorAll('#banhRangMenu [data-action="doiChuyenDong"]').forEach((el) => el.setAttribute('aria-checked', String(chuyenDongBat())));
}

function datKieuGiaoDien({ kieu }) {
  if (kieu === 'trang-nghiem') goc().setAttribute('data-kieu', 'trang-nghiem'); else goc().removeAttribute('data-kieu');
  ghiNho(KHOA_KIEU, kieu === 'trang-nghiem' ? 'trang-nghiem' : null);
  capNhatMauThanh(); danhDauMenu();
}

function doiNenToi() {
  const bat = !nenToiDangBat();
  if (bat) goc().setAttribute('data-theme', 'dark'); else goc().removeAttribute('data-theme');
  ghiNho(KHOA_TOI, bat ? '1' : null);
  capNhatMauThanh(); danhDauMenu();
}

function datCoChu(lon) {
  if (lon) goc().setAttribute('data-co-chu', 'lon'); else goc().removeAttribute('data-co-chu');
}

function doiCoChu() {
  const lon = !coChuLon();
  datCoChu(lon); ghiNho(KHOA_CO_CHU, lon ? 'lon' : 'vua'); danhDauMenu();
}

function doiChuyenDong() {
  const bat = !chuyenDongBat();
  if (bat) goc().removeAttribute('data-chuyen-dong'); else goc().setAttribute('data-chuyen-dong', 'giam');
  ghiNho(KHOA_CHUYEN_DONG, bat ? null : 'giam'); danhDauMenu();
}

// Gọi sau mỗi lần vào phiên: máy đã chọn thì giữ; chưa chọn thì lãnh đạo cỡ lớn, người khác cỡ vừa (đổi người trên cùng máy không mang theo).
export function apDungCoChuMacDinh(user) {
  const daChon = docNho(KHOA_CO_CHU);
  if (daChon === 'lon' || daChon === 'vua') { datCoChu(daChon === 'lon'); danhDauMenu(); return; }
  datCoChu(user?.role_group === 'A0' || user?.role_group === 'A1');
  danhDauMenu();
}

export function mountKieuGiaoDien() {
  registerActions({ datKieuGiaoDien, doiNenToi, doiCoChu, doiChuyenDong });
  onSessionEnter(() => apDungCoChuMacDinh(state.user));
  capNhatMauThanh();
}
