// Bảng menu theo vai (mockup v7 "Menu theo từng vai trò"): mục đầu là hộp thư việc của chính người đó; mọi hành động làm ngay trên
// dòng; menu còn lại để tra cứu và cấu hình. Trên điện thoại mỗi vai có thanh dưới 3 mục (duoi: true), mục còn lại vào "Khác".
// nhom: nhóm trên menu dọc v8 (Điều hành / Theo dõi / Trao đổi / Hệ thống). id giữ tên cũ ở những mục e2e đã dùng (navKl, navQuanTri, dmBubbleLauncher); action là tên hành động đã đăng ký (lib/actions.js).
// GĐ22: mục đầu của mọi vai có huy hiệu số chưa xử lý (dhBadge, features/huy-hieu.js); A0 có "Giao việc" (biểu mẫu chung, bản rút gọn).
export const MENU = {
  A0: [
    { id: 'navDieuHanh', label: 'Trung tâm điều hành', ngan: 'Điều hành', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', duoi: true, nhom: 'Điều hành' },
    { id: 'navChiDaoDaGui', label: 'Chỉ đạo đã gửi', ngan: 'Chỉ đạo', action: 'openChiDaoDaGui', section: 'viewChiDaoDaGui', duoi: true, nhom: 'Điều hành' },
    { id: 'navKl', label: 'Toàn bộ nhiệm vụ', ngan: 'Tra cứu', action: 'openKl', section: 'viewKl', nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },
    { id: 'navCanBo', label: 'Cán bộ', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
  ],
  A1: [
    { id: 'navDieuHanh', label: 'Điều hành hôm nay', ngan: 'Điều hành', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', duoi: true, nhom: 'Điều hành' },
    { id: 'navKl', label: 'Nhiệm vụ', ngan: 'Nhiệm vụ', action: 'openKl', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
    { id: 'navTheoVanBan', label: 'Theo văn bản', ngan: 'Văn bản', action: 'openTheoVanBan', section: 'viewTheoVanBan', nhom: 'Theo dõi' },
    { id: 'navCanBo', label: 'Cán bộ thuộc quyền', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
    { id: 'navBaoCao', label: 'Báo cáo', ngan: 'Báo cáo', action: 'openBaoCao', section: 'viewBaoCao', nhom: 'Theo dõi' },
  ],
  A2: [
    { id: 'navDieuHanh', label: 'Phòng tôi hôm nay', ngan: 'Phòng tôi', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navGiaoViec', label: 'Giao việc trong phòng', ngan: 'Giao việc', action: 'openGiaoViec', section: 'viewGiaoViec', duoi: true, nhom: 'Điều hành' },
    { id: 'navKl', label: 'Nhiệm vụ của phòng', ngan: 'Nhiệm vụ', action: 'openKl', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
    { id: 'navCanBo', label: 'Cán bộ trong phòng', ngan: 'Cán bộ', action: 'openCanBo', section: 'viewCanBo', nhom: 'Theo dõi' },
  ],
  A3: [
    { id: 'navDieuHanh', label: 'Việc của tôi', ngan: 'Việc của tôi', action: 'openDieuHanh', section: 'viewDieuHanh', duoi: true, badgeId: 'dhBadge', nhom: 'Điều hành' },
    { id: 'navTheoDoi', label: 'Việc tôi theo dõi', ngan: 'Theo dõi', action: 'openTheoDoi', section: 'viewKl', duoi: true, nhom: 'Theo dõi' },
  ],
};

// Mục dùng chung mọi vai (A0 nhắn tin 1-1 từ 0034): Nhắn tin có huy hiệu; Quản trị chỉ khi có cờ.
export const NHAN_TIN_NAV = { id: 'dmBubbleLauncher', label: 'Nhắn tin', ngan: 'Nhắn tin', action: 'openNhanTin', section: 'viewNhanTin', badgeId: 'dmBubbleBadge', nhom: 'Trao đổi' };
export const QUAN_TRI_NAV = { id: 'navQuanTri', label: 'Quản trị', ngan: 'Quản trị', action: 'openQuanTri', section: 'viewQuanTri', nhom: 'Hệ thống' };

// Chuyên viên giữ quan_tri_kl (nhập/sửa mọi nhiệm vụ) có thêm Giao việc và Nhiệm vụ toàn phạm vi.
const QTKL_A3 = [MENU.A1[1], { ...MENU.A1[2], label: 'Toàn bộ nhiệm vụ' }];

export function menuCuaVai(user) {
  const goc = [...(MENU[user?.role_group] || []), ...(user?.role_group === 'A3' && user?.quan_tri_kl ? QTKL_A3 : [])];
  const nhanTin = [{ ...NHAN_TIN_NAV, duoi: user?.role_group === 'A3' }];
  const quanTri = user?.quan_tri_he_thong || user?.quan_tri_kl ? [QUAN_TRI_NAV] : [];
  return [...goc, ...nhanTin, ...quanTri];
}
