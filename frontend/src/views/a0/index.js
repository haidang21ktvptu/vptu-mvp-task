// View A0 — Thường trực Tỉnh ủy (GĐ18, CH-11 = A, SPEC CB-5): màn hình mặc định = Dashboard (bảng ngoại lệ, lọc sẵn Đỏ đặc
// biệt, mở rộng được sang mọi việc Đỏ và tổng quan); mục "Nhiệm vụ" dùng chung để xem toàn bộ (RLS: kl_pham_vi 0030 mở đọc).
// Chỉ đọc + ghi "Ý kiến" (chi_dao loại Y_KIEN) — mọi nút ghi khác ẩn (quyền thật: hàm 0030 từ chối A0 tường minh).
import { registerView } from '../registry.js';
import { KL_DASHBOARD_NAV, openKlDashboard } from '../a1/kl-dashboard/index.js';

export function registerA0View() {
  registerView('A0', {
    nav: [KL_DASHBOARD_NAV],
    init() { openKlDashboard(); },
    reload() {},
  });
}
