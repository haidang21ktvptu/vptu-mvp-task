// Kiểu giao diện v9 (docs/DESIGN.md mục 1): Thanh lịch (mặc định, lam) / Trang nghiêm (đỏ son), nền tối bật/tắt — chọn ở menu bánh răng, nhớ
// THEO MÁY (localStorage; trình duyệt chặn lưu trữ thì vẫn đổi được trong phiên). index.html đặt sẵn hai thuộc tính trên <html> trước khi vẽ
// để không chớp kiểu mặc định. Chỉ là trình bày: không ghi gì lên máy chủ.
import { registerActions } from '../../lib/actions.js';

const goc = () => document.documentElement;
const KHOA_KIEU = 'vptu.kieu'; const KHOA_TOI = 'vptu.nen-toi';

export const kieuHienTai = () => (goc().getAttribute('data-kieu') === 'trang-nghiem' ? 'trang-nghiem' : 'thanh-lich');
export const nenToiDangBat = () => goc().getAttribute('data-theme') === 'dark';

function ghiNho(khoa, giaTri) {
  try { if (giaTri) localStorage.setItem(khoa, giaTri); else localStorage.removeItem(khoa); } catch { /* chặn lưu trữ: chỉ đổi trong phiên */ }
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

export function mountKieuGiaoDien() {
  registerActions({ datKieuGiaoDien, doiNenToi });
  capNhatMauThanh();
}
