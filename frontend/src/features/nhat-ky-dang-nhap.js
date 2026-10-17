// Nhật ký đăng nhập (0104, v3.24): ghi nhận phiên khi vào app (startSession — đăng nhập hoặc tải lại trang; cùng một phiên chỉ một dòng, tải
// lại chỉ cập nhật "hoạt động gần nhất") và cập nhật hoạt động gần nhất tối đa 5 phút một lần khi có thao tác (chuột, phím, chạm).
// Máy chủ tự lấy thời điểm đăng nhập, trình duyệt, địa chỉ IP (hàm ghi_nhan_dang_nhap). Mọi lỗi bỏ qua — không bao giờ chặn đăng nhập.
// Dữ liệu chỉ quản trị hệ thống đọc (RLS) ở Quản trị › Thống kê sử dụng.
import { supabase } from '../lib/supabase.js';
import { onSessionEnter, onSessionLeave } from '../auth/session.js';

export const CHU_KY_HOAT_DONG_MS = 5 * 60_000;
const SU_KIEN = ['pointerdown', 'keydown', 'touchstart'];
let lanGhi = 0;

export function ghiNhanDangNhap() {
  lanGhi = Date.now();
  try { supabase.rpc('ghi_nhan_dang_nhap').then(() => {}, () => {}); } catch { /* chưa có hàm (trước 0104) / mất mạng: bỏ qua */ }
}

function khiThaoTac() { if (Date.now() - lanGhi >= CHU_KY_HOAT_DONG_MS) ghiNhanDangNhap(); }
const bat = () => SU_KIEN.forEach((s) => document.addEventListener(s, khiThaoTac, { passive: true, capture: true }));
const tat = () => SU_KIEN.forEach((s) => document.removeEventListener(s, khiThaoTac, { capture: true }));

export function initNhatKyDangNhap() {
  onSessionEnter(bat);
  onSessionLeave(tat);
}
