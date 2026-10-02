// Gắn markup từng màn hình/tính năng vào trang và đăng ký view theo vai trò (gọi một lần lúc khởi động).
import { registerA0View } from './a0/index.js';
import { registerA1View } from './a1/index.js';
import { registerA2View } from './a2/index.js';
import { registerA3View } from './a3/index.js';
import { registerQuanTriView } from './shared/quan-tri/index.js';
import { registerCaNhanView } from './shared/ca-nhan/index.js';
import { mountBanhRang } from './shell/banh-rang.js';
import { mountKieuGiaoDien } from './shell/kieu-giao-dien.js';
import { mountTimNhanh } from './shell/tim-nhanh.js';
import { registerKlView } from './shared/kl/index.js';
import { registerGiaoViec, openGiaoViec } from './shared/giao-viec/index.js';
import { mountTabGiaoViec } from './shared/nhap-excel/tab.js';
import { mountNhapExcel } from './shared/nhap-excel/index.js';
import { mountChoHoanThien } from './shared/nhap-excel/cho.js';
import { mountGiaoViecV9 } from './shared/giao-viec/v9.js';
import { registerTheoVanBan } from './shared/theo-van-ban/index.js';
import { registerChiDaoTTThuKy } from './shared/chi-dao-tt-thu-ky/index.js';
import { registerNghiemThu } from './shared/nghiem-thu.js';
import { mountDieuHanh } from './shared/dieu-hanh/man-hinh.js';
import { registerTongQuan } from './shared/tong-quan/index.js';
import { mountNganChiTiet } from './shared/ngan-chi-tiet.js';
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
  mountGiaoViecV9();     // v9: dải 1-1-1-1-3, chọn nhanh, kế thừa, văn bản đang nhập
  mountTabGiaoViec(openGiaoViec); mountNhapExcel(); mountChoHoanThien();   // v9 đợt 2: Nhập từ Excel, Chờ hoàn thiện (người nhập)
  registerTheoVanBan();  // Cây "Theo văn bản" (A0/A1, v8 đợt 4)
  registerChiDaoTTThuKy(); // "Chỉ đạo Thường trực" của thư ký Thường trực (0047)
  registerNghiemThu();   // "Cần nghiệm thu" (PR-2b): A1, A2, quan_tri_kl, thư ký
  mountDieuHanh();       // hành động dùng chung của các màn hình điều hành (A0/A1)
  registerTongQuan();    // v9: Tổng quan — trang mở đầu của A0/A1/A2
  mountNganChiTiet();    // v9 đợt 2: ngăn chi tiết dùng chung — mọi "bấm để xem" mở tại chỗ, không đổi mục
  registerA0View();      // Trung tâm điều hành Thường trực, Chỉ đạo đã gửi
  registerA1View();      // Điều hành hôm nay, Cán bộ thuộc quyền, Báo cáo
  registerA2View();      // Phòng tôi hôm nay, Cán bộ trong phòng
  registerA3View();      // Việc của tôi, Việc tôi theo dõi
  registerQuanTriView(); // khu theo quyền: cờ quan_tri_*, Chánh VP (phân công, ngưỡng), Trưởng phòng (ủy quyền)
  registerCaNhanView();  // Hồ sơ cá nhân, Thông báo, Trợ giúp, Bản gọn (bánh răng)
  mountBanhRang();       // menu bánh răng trên dải (Đăng xuất ở cuối)
  mountKieuGiaoDien();   // v9: Thanh lịch / Trang nghiêm, nền tối (nhớ theo máy)
  mountTimNhanh();       // ô tìm nhanh trên dải
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
