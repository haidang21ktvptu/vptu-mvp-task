// Bảng menu theo vai (mockup v7 "Menu theo từng vai trò"): mục đầu là hộp thư việc của chính người đó; mọi hành động làm ngay trên
// dòng; menu còn lại để tra cứu và cấu hình. Trên điện thoại mỗi vai có thanh dưới 3 mục (duoi: true), mục còn lại vào "Khác".
// nhom: nhóm trên menu dọc v8 (Điều hành / Theo dõi / Trao đổi / Hệ thống). id giữ tên cũ ở những mục e2e đã dùng (navKl, navQuanTri, dmBubbleLauncher); action là tên hành động đã đăng ký (lib/actions.js).
// GĐ22: mục đầu của mọi vai có huy hiệu số chưa xử lý (dhBadge, features/huy-hieu.js); A0 có "Giao việc" (biểu mẫu chung, bản rút gọn).
// v9: A0/A1/A2 mở đầu bằng "Tổng quan" (shared/tong-quan); màn hình điều hành đổi tên "Cần xử lý" (id navDieuHanh giữ nguyên cho e2e).
// Đợt E v3.18 (0085): mọi chuyên viên có "Giao việc" (giao thẳng cho chuyên viên, không thay mặt) và "Cần nghiệm thu" (việc mình giao, mình là người theo dõi).
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
    { id: 'navCanBo', label: 'Cán bộ trong phòng', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
  ],
  A3: [
    { id: 'navDieuHanh', label: 'Việc của tôi', ngan: 'Việc của tôi', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', duoi: true, nhom: 'Điều hành' },
    { id: 'navTheoDoi', label: 'Việc tôi theo dõi', ngan: 'Theo dõi', action: 'openTheoDoi', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
  ],
};

// Mục dùng chung mọi vai (A0 nhắn tin 1-1 từ 0034): Nhắn tin có huy hiệu; Quản trị chỉ khi có cờ.
export const NHAN_TIN_NAV = { id: 'dmBubbleLauncher', label: 'Nhắn tin', ngan: 'Nhắn tin', action: 'openNhanTin', section: 'viewNhanTin', badgeId: 'dmBubbleBadge', nhom: 'Trao đổi' };
export const QUAN_TRI_NAV = { id: 'navQuanTri', label: 'Quản trị', ngan: 'Quản trị', action: 'openQuanTri', section: 'viewQuanTri', nhom: 'Hệ thống' };
// Thư ký Thường trực (0047, cờ thu_ky_thuong_truc, mọi vai trừ A0): đóng chỉ đạo Thường trực thay mặt.
// PR-2b: "Cần nghiệm thu (n)" — A1, A2, quan_tri_kl, thư ký Thường trực (việc Thường trực giao cho Chánh VP); số = minh chứng chờ tôi là người nhận nhắc chính.
export const NGHIEM_THU_NAV = { id: 'navNghiemThu', label: 'Cần nghiệm thu', ngan: 'Nghiệm thu', action: 'openNghiemThu', section: 'viewNghiemThu', badgeId: 'ntBadge', nhom: 'Điều hành' };
export const THU_KY_TT_NAV = { id: 'navChiDaoTTThuKy', label: 'Chỉ đạo Thường trực', ngan: 'Chỉ đạo TT', action: 'openChiDaoTTThuKy', section: 'viewChiDaoTTThuKy', nhom: 'Theo dõi' };
// v9 đợt 2: quản trị hệ thống không giữ quyền giao việc vẫn nhập Excel (thẻ trong màn Giao việc); vai đã có Giao việc dùng thẻ ở đó.
export const NHAP_EXCEL_NAV = { id: 'navNhapExcel', label: 'Nhập từ Excel', ngan: 'Nhập Excel', action: 'openNhapExcel', section: 'viewGiaoViec', nhom: 'Điều hành' };

// Chuyên viên giữ quan_tri_kl (nhập/sửa mọi nhiệm vụ) có thêm Nhiệm vụ toàn phạm vi (Giao việc đã có với mọi chuyên viên từ 0085).
const QTKL_A3 = [{ ...MENU.A1[3], label: 'Toàn bộ nhiệm vụ' }];

export function menuCuaVai(user) {
  const goc = [...(MENU[user?.role_group] || []), ...(user?.role_group === 'A3' && user?.quan_tri_kl ? QTKL_A3 : [])];
  const nhanTin = [{ ...NHAN_TIN_NAV, duoi: user?.role_group === 'A3' }];
  const thuKy = user?.thu_ky_thuong_truc && user?.role_group !== 'A0' ? [THU_KY_TT_NAV] : [];
  const quanTri = user?.quan_tri_he_thong || user?.quan_tri_kl ? [QUAN_TRI_NAV] : [];
  if (user?.quan_tri_he_thong && user.role_group !== 'A0' && !goc.some((it) => it.id === 'navGiaoViec')) goc.push(NHAP_EXCEL_NAV);
  const nghiemThu = user && user.role_group !== 'A0' ? [NGHIEM_THU_NAV] : [];   // 0085: cả chuyên viên (nghiệm thu việc mình giao)
  const sau = goc.findIndex((it) => it.id === 'navDieuHanh') + 1; // "Cần nghiệm thu" đứng ngay sau màn hình điều hành (sau Tổng quan nếu có)
  return [...goc.slice(0, sau), ...nghiemThu, ...goc.slice(sau), ...thuKy, ...nhanTin, ...quanTri];
}
