// Gắn markup từng màn hình/tính năng vào trang và đăng ký view theo vai trò (gọi một lần lúc khởi động).
import { registerA0View } from './a0/index.js';
import { registerA1View } from './a1/index.js';
import { registerA2View } from './a2/index.js';
import { registerA3View } from './a3/index.js';
import { registerQuanTriView } from './shared/quan-tri/index.js';
import { registerKlView } from './shared/kl/index.js';
import { registerGiaoViec } from './shared/giao-viec/index.js';
import { mountDieuHanh } from './shared/dieu-hanh/man-hinh.js';
import { mountMessages, loadDMUnreadMap } from '../features/messages/index.js';
import { mountThongBao, loadThongBao } from '../features/thong-bao/index.js';
import { initRealtime } from '../features/realtime.js';
import { initKlRealtime } from '../features/kl-realtime.js';
import { initHuyHieu } from '../features/huy-hieu.js';
import { mountThanhHoaToc } from './shell/thanh-hoa-toc.js';
import { mountCanXuLy } from './shared/can-xu-ly.js';
import { onSessionEnter } from '../auth/session.js';

export function registerViews() {
  registerKlView();      // Nhiệm vụ (tổng quan → danh sách → ngăn chi tiết), mọi vai trò
  registerGiaoViec();    // Giao việc ba bước một trang (A1/A2/quan_tri_kl)
  mountDieuHanh();       // hành động dùng chung của các màn hình điều hành (A0/A1)
  registerA0View();      // Trung tâm điều hành Thường trực, Chỉ đạo đã gửi
  registerA1View();      // Điều hành hôm nay, Cán bộ thuộc quyền, Báo cáo
  registerA2View();      // Phòng tôi hôm nay, Cán bộ trong phòng
  registerA3View();      // Việc của tôi, Việc tôi theo dõi
  registerQuanTriView(); // mục theo cờ quan_tri_he_thong / quan_tri_kl
  mountMessages();       // Nhắn tin gom theo việc
  mountThongBao();       // chuông gom theo việc, mọi vai trò
  mountThanhHoaToc();    // thanh đỏ Hỏa tốc chưa Đã nhận (GĐ22)
  mountCanXuLy();        // dải "Cần xử lý ngay" vẽ lại theo realtime (GĐ22)
  onSessionEnter(loadDMUnreadMap);
  onSessionEnter(loadThongBao);
  initRealtime();
  initKlRealtime();
  initHuyHieu();         // số chưa xử lý trên menu + dải "Cần xử lý ngay" (GĐ22)
}
