// Điểm vào của app: nối các module lại, không chứa nghiệp vụ.
import './styles/main.css';
import { initActionDelegation } from './lib/actions.js';
import { initLogin, startSession } from './auth/login.js';
import { initChangePassword } from './auth/change-password.js';
import { restoreSession } from './auth/session.js';
import { registerViews } from './views/index.js';
import { khoiPhucTu404 } from './views/shell/duong-dan.js';

// v3.29 (CAU-HOI O-7): không chạy khi bị trang khác nhúng trong khung (chống lừa bấm — GitHub Pages không đặt được tiêu đề chống nhúng, frame-ancestors
// không có tác dụng trong thẻ meta CSP).
if (window.top !== window.self) {
  document.body.innerHTML = `<p class="trong">Hệ thống quản trị nhiệm vụ không mở trong khung của trang khác. <a href="${import.meta.env.BASE_URL}" target="_top" rel="noopener">Mở trực tiếp</a>.</p>`;
} else {
  khoiPhucTu404();   // đường dẫn chuyển từ 404.html (?p=…) → đặt lại thanh địa chỉ trước khi chạy
  initActionDelegation();
  registerViews();
  initLogin();
  initChangePassword();
  restoreSession(startSession);
}
