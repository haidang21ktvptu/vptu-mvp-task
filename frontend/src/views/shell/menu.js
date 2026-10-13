// Bảng menu theo vai (mockup v7 "Menu theo từng vai trò"): mục đầu là hộp thư việc của chính người đó; mọi hành động làm ngay trên
// dòng; menu còn lại để tra cứu và cấu hình. Trên điện thoại mỗi vai có thanh dưới 3 mục (duoi: true), mục còn lại vào "Khác".
// nhom: nhóm trên menu dọc v8 (Điều hành / Theo dõi / Hệ thống). id giữ tên cũ ở những mục e2e đã dùng (navKl, navQuanTri); action là tên hành động đã đăng ký (lib/actions.js).
// GĐ22: mục đầu của mọi vai có huy hiệu số chưa xử lý (dhBadge, features/huy-hieu.js); A0 có "Giao việc" (biểu mẫu chung, bản rút gọn).
// v9: A0/A1/A2 mở đầu bằng "Tổng quan" (shared/tong-quan); màn hình điều hành đổi tên "Cần xử lý" (id navDieuHanh giữ nguyên cho e2e).
// Đợt E v3.18 (0085): mọi chuyên viên có "Giao việc" (giao thẳng cho chuyên viên, không thay mặt). Đợt D v3.20 (0090): bỏ màn "Cần nghiệm thu" —
// nộp minh chứng hợp lệ là hoàn thành; xem / đánh giá / trả lại (không bắt buộc) ở ngăn chi tiết và khối "Kết quả nộp trong 7 ngày" của Cần xử lý.
// Đợt C1 v3.19 (0086): cấu hình pham_vi_chuyen_vien = 2 → chuyên viên có thêm "Tổng quan phòng" và "Nhiệm vụ của phòng" (chỉ xem; xemPhong).
// v3.22.1 (chủ dự án 13/10/2026): Trưởng phòng, chuyên viên có "Theo văn bản" — cây chỉ gồm việc trong phạm vi RLS của người xem (không đổi quyền);
// không lên thanh dưới điện thoại (vào "Khác").
// v3.23 (chủ dự án 13/10/2026): bỏ mục Nhắn tin ở mọi vai (thông báo hệ thống vẫn ở chuông); cấu hình xem toàn bộ (0103) → chuyên viên có
// "Tổng quan" (chung toàn Văn phòng) và "Toàn bộ nhiệm vụ" (danh sách Toàn Văn phòng, chỉ xem việc ngoài phạm vi); Trưởng phòng: "Tổng quan".
export const MENU = {
  A0: [
    { id: 'navTongQuan', label: 'Tổng quan', ngan: 'Tổng quan', action: 'openTongQuan', section: 'viewTongQuan', duoi: true, nhom: 'Điều hành' },
    { id: 'navDieuHanh', label: 'Cần xử lý', ngan: 'Cần xử lý', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', nhom: 'Điều hành' },
    { id: 'navChiDaoDaGui', label: 'Chỉ đạo đã gửi', ngan: 'Chỉ đạo', action: 'openChiDaoDaGui', section: 'viewChiDaoDaGui', duoi: true, nhom: 'Điều hành' },
    { id: 'navKl', label: 'Toàn bộ nhiệm vụ', ngan: 'Tra cứu', action: 'openKl', section: 'viewKl', nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },
    { id: 'navCanBo', label: 'Cán bộ', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
  ],
  A1: [
    { id: 'navTongQuan', label: 'Tổng quan', ngan: 'Tổng quan', action: 'openTongQuan', section: 'viewTongQuan', duoi: true, nhom: 'Điều hành' },
    { id: 'navDieuHanh', label: 'Cần xử lý', ngan: 'Cần xử lý', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', nhom: 'Điều hành' },
    { id: 'navKl', label: 'Nhiệm vụ', ngan: 'Nhiệm vụ', action: 'openKl', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },
    { id: 'navCanBo', label: 'Cán bộ thuộc quyền', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
    { id: 'navBaoCao', label: 'Báo cáo', ngan: 'Báo cáo', action: 'openBaoCao', section: 'viewBaoCao', nhom: 'Theo dõi' },
  ],
  A2: [
    { id: 'navTongQuan', label: 'Tổng quan phòng', ngan: 'Tổng quan', action: 'openTongQuan', section: 'viewTongQuan', duoi: true, nhom: 'Điều hành' },
    { id: 'navDieuHanh', label: 'Cần xử lý', ngan: 'Cần xử lý', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc trong phòng', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', nhom: 'Điều hành' },
    { id: 'navKl', label: 'Nhiệm vụ của phòng', ngan: 'Nhiệm vụ', action: 'openKl', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },   // v3.22.1
    { id: 'navCanBo', label: 'Cán bộ trong phòng', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
  ],
  A3: [
    { id: 'navDieuHanh', label: 'Việc của tôi', ngan: 'Việc của tôi', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', duoi: true, nhom: 'Điều hành' },
    { id: 'navTheoDoi', label: 'Việc tôi theo dõi', ngan: 'Theo dõi', action: 'openTheoDoi', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },   // v3.22.1
  ],
};

// Mục dùng chung mọi vai: Quản trị chỉ khi có cờ. (Nhắn tin 1-1 bỏ ở v3.23 — tin cũ giữ trong cơ sở dữ liệu.)
export const QUAN_TRI_NAV = { id: 'navQuanTri', label: 'Quản trị', ngan: 'Quản trị', action: 'openQuanTri', section: 'viewQuanTri', nhom: 'Hệ thống' };
// Thư ký Thường trực (0047, cờ thu_ky_thuong_truc, mọi vai trừ A0): đóng chỉ đạo Thường trực thay mặt.
export const THU_KY_TT_NAV = { id: 'navChiDaoTTThuKy', label: 'Chỉ đạo Thường trực', ngan: 'Chỉ đạo TT', action: 'openChiDaoTTThuKy', section: 'viewChiDaoTTThuKy', nhom: 'Theo dõi' };
// v9 đợt 2: quản trị hệ thống không giữ quyền giao việc vẫn nhập Excel (thẻ trong màn Giao việc); vai đã có Giao việc dùng thẻ ở đó.
export const NHAP_EXCEL_NAV = { id: 'navNhapExcel', label: 'Nhập từ Excel', ngan: 'Nhập Excel', action: 'openNhapExcel', section: 'viewGiaoViec', nhom: 'Điều hành' };

// Chuyên viên giữ quan_tri_kl (cờ cũ — 0096 thu hết, không cấp lại; giữ cho kiểm thử dùng cờ tạm) có thêm Nhiệm vụ toàn phạm vi.
const QTKL_A3 = [{ ...MENU.A1[3], label: 'Toàn bộ nhiệm vụ' }];
// 0086: chuyên viên xem cả phòng — Tổng quan phòng (đầu menu, như các vai lãnh đạo) và Nhiệm vụ của phòng (danh sách, chip Việc của tôi / Cả phòng).
// Không lên thanh dưới điện thoại (duoi: false) — thanh của chuyên viên giữ Việc của tôi / Giao việc / Theo dõi.
const PHONG_A3 = { tongQuan: { ...MENU.A2[0], label: 'Tổng quan phòng', duoi: false }, nhiemVu: { ...MENU.A2[3], label: 'Nhiệm vụ của phòng', duoi: false, action: 'openKlPhong' } };
// 0103: cấu hình xem toàn bộ — Tổng quan chung, Toàn bộ nhiệm vụ (chuyên viên chưa có mục Nhiệm vụ nào khác).
const TOAN_BO_A3 = { tongQuan: { ...MENU.A1[0], duoi: false }, nhiemVu: { ...MENU.A1[3], label: 'Toàn bộ nhiệm vụ', duoi: false, action: 'openKlToanBo' } };

export function menuCuaVai(user, { xemPhong = false, xemToanBo = false } = {}) {
  const a3 = user?.role_group === 'A3';
  const vai = (MENU[user?.role_group] || []).map((it) => (xemToanBo && it.id === 'navTongQuan' ? { ...it, label: 'Tổng quan' } : it));
  const tongQuanA3 = a3 && xemToanBo ? [TOAN_BO_A3.tongQuan] : a3 && xemPhong ? [PHONG_A3.tongQuan] : [];
  const nhiemVuA3 = !a3 ? [] : user?.quan_tri_kl ? QTKL_A3 : xemPhong ? [PHONG_A3.nhiemVu] : xemToanBo ? [TOAN_BO_A3.nhiemVu] : [];
  const goc = [...tongQuanA3, ...vai, ...nhiemVuA3];   // 0096: không còn ngoại lệ quản trị KL
  const thuKy = user?.thu_ky_thuong_truc && user?.role_group !== 'A0' ? [THU_KY_TT_NAV] : [];
  const quanTri = user?.quan_tri_he_thong || user?.quan_tri_kl ? [QUAN_TRI_NAV] : [];
  if (user?.quan_tri_he_thong && user.role_group !== 'A0' && !goc.some((it) => it.id === 'navGiaoViec')) goc.push(NHAP_EXCEL_NAV);
  return [...goc, ...thuKy, ...quanTri];
}
