// Màn chờ và mở đầu hình tròn (v3.36, CAU-HOI V-12; DESIGN mục 7). Màn chờ (#manCho trong index.html): nền màu menu, biểu trưng và tên cơ quan đúng
// vị trí của thanh đầu trang — hiện khi tải lại trang mà máy còn phiên đăng nhập (đoạn mã đầu index.html gắn lớp cho-phien trên <html> trước khi vẽ,
// thay cho việc chớp màn đăng nhập) và khi vừa đăng nhập xong, đang nạp hồ sơ. Vào ứng dụng: khung ứng dụng mở ra theo hình tròn từ biểu trưng trên
// thanh đầu trang (lớp mo-dau; styles/chuyen-dong.css), 0,8 giây. Không vào ứng dụng (về màn đăng nhập, trang đặt mật khẩu mới): bỏ màn chờ; quá 10–12
// giây chưa vào được thì màn chờ tự bỏ (hẹn henChoPhien trên <html>).
// Giảm chuyển động: không có hình tròn, màn chờ (nếu có) bỏ ngay khi khung ứng dụng hiện.
import { coChuyenDong } from '../../lib/chuyen-dong.js';

const MS_MO_DAU_TOI_DA = 2600;   // hình tròn 0,8 giây tính từ khung hình đầu; quá mốc này chưa thấy báo xong (máy rất chậm) thì gỡ lớp
const MS_TU_BO = 12000;   // màn chờ tự bỏ nếu quá lâu chưa vào được ứng dụng (lỗi bất ngờ lúc nạp): màn đăng nhập hiện lại như trước v3.36
const goc = () => document.documentElement;
let hen = null;

// Vừa đăng nhập xong / vừa đặt xong mật khẩu mới, đang nạp dữ liệu vào ứng dụng: che màn hình bằng màn chờ (hiện dần). Đã có màn chờ thì giữ nguyên.
export function hienManCho() {
  if (!coChuyenDong() || goc().classList.contains('cho-phien')) return;
  clearTimeout(goc().henChoPhien);
  goc().classList.add('cho-phien', 'tu-form');
  goc().henChoPhien = setTimeout(boManCho, MS_TU_BO);
}

export function boManCho() {
  clearTimeout(goc().henChoPhien);   // hẹn tự bỏ màn chờ sau 10 giây của đoạn mã đầu index.html: không còn cần
  goc().classList.remove('cho-phien', 'tu-form');
}

// Khung ứng dụng vừa hiện (shell/index.js initUserInterface): mở ra theo hình tròn từ tâm biểu trưng.
export function chayMoDau() {
  const g = goc();
  if (!coChuyenDong()) { boManCho(); return; }
  const r = document.querySelector('#mainHeader .logo')?.getBoundingClientRect();
  if (r?.width) {
    g.style.setProperty('--mo-x', `${Math.round(r.left + r.width / 2)}px`);
    g.style.setProperty('--mo-y', `${Math.round(r.top + r.height / 2)}px`);
  }
  const khung = document.getElementById('appShell');
  const xong = (ev) => {   // gỡ lớp khi chính hiệu ứng của khung chạy xong (sự kiện của phần tử con nổi lên thì bỏ qua) — không cắt ngang khi khung hình đầu đến muộn
    if (ev && ev.target !== khung) return;
    clearTimeout(hen); khung?.removeEventListener('animationend', xong); g.classList.remove('mo-dau');
  };
  g.classList.add('mo-dau');
  boManCho();
  clearTimeout(hen);
  khung?.addEventListener('animationend', xong);
  hen = setTimeout(xong, MS_MO_DAU_TOI_DA);
}
