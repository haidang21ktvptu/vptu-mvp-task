// Gắn markup từng view/modal/tính năng vào trang và đăng ký view theo vai trò (gọi một lần lúc khởi động).
import { registerA1View } from './a1/index.js';
import { registerA2View } from './a2/index.js';
import { registerA3View } from './a3/index.js';
import { registerQuanTriView } from './shared/quan-tri/index.js';
import { registerKlView } from './shared/kl/index.js';
import { registerKlDashboard } from './a1/kl-dashboard/index.js';
import { mountMessages, loadDMUnreadMap } from '../features/messages/index.js';
import { initRealtime } from '../features/realtime.js';
import { initKlRealtime } from '../features/kl-realtime.js';
import { onSessionEnter } from '../auth/session.js';

export function registerViews() {
  registerA1View();
  registerA2View();
  registerA3View();
  registerQuanTriView(); // mục dùng chung, chỉ hiện ở thanh bên khi có quan_tri_he_thong (GĐ8)
  registerKlView();      // Nhiệm vụ (thực thể thống nhất GĐ14), mọi vai trò
  registerKlDashboard(); // Tổng quan nhiệm vụ, mục thanh bên A1 (GĐ10) — mặc định sau đăng nhập của A1 (GĐ14)
  mountMessages();
  onSessionEnter(loadDMUnreadMap); // huy hiệu tin nhắn chưa đọc ngay khi vào app
  initRealtime();
  initKlRealtime(); // kênh KL: bật khi mở màn hình KL, tắt khi đăng xuất (GĐ10)
}
