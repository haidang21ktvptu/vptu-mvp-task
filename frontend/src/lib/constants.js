// Hằng số nghiệp vụ dùng chung (giữ nguyên nhãn tiếng Việt của bản index.html cũ).

export const AUTH_EMAIL_DOMAIN = 'vptu.caobang.local';

export const DEPT_NAMES = {
  LANH_DAO_VAN_PHONG: 'Lãnh đạo Văn phòng',
  TONG_HOP: 'Phòng Tổng hợp',
  HC_LT: 'Phòng Hành chính - Lưu trữ',
  CDS_CY: 'Phòng Chuyển đổi số - Cơ yếu',
  TAI_CHINH_DANG: 'Phòng Tài chính Đảng',
  QUAN_TRI: 'Phòng Quản trị',
};

export const ROLE_LABELS = {
  A0: 'Thường trực Tỉnh ủy (A0)',
  A1: 'Lãnh đạo Văn phòng (A1)',
  A2: 'Trưởng phòng chuyên môn (A2)',
  A3: 'Cán bộ thực hiện (A3)',
};

// Nhãn vai trò người gửi trong luồng ý kiến chỉ đạo.
export function senderRoleTag(roleGroup) {
  if (roleGroup === 'A0') return 'Thường trực Tỉnh ủy';
  if (roleGroup === 'A1') return 'Lãnh đạo Văn phòng';
  if (roleGroup === 'A2') return 'Trưởng phòng';
  return 'Cán bộ thực hiện';
}

// Tên phòng ngắn cho dòng 2 dải nhận diện ("Phó Chánh Văn phòng · Phụ trách CĐS-CY").
export const TEN_PHONG_NGAN = { LANH_DAO_VAN_PHONG: 'Lãnh đạo VP', TONG_HOP: 'Tổng hợp', HC_LT: 'HC-LT', CDS_CY: 'CĐS-CY', TAI_CHINH_DANG: 'Tài chính Đảng', QUAN_TRI: 'Quản trị' };

// Dòng 2 dưới tên trên dải (mẫu dhtn.dcs.vn): chức danh theo vai · đơn vị; không mã vai, không lặp chữ.
// phongPhuTrach: danh sách mã phòng PCVP đang phụ trách (shell nạp từ phu_trach_phong), chỉ dùng cho A1 không phải Chánh VP.
export function nhanChucDanh(user, phongPhuTrach = []) {
  if (!user) return '';
  if (user.role_group === 'A0') return 'Thường trực Tỉnh ủy';
  if (user.role_group === 'A1') {
    if (user.is_chief) return 'Chánh Văn phòng';
    const pt = phongPhuTrach.map((p) => TEN_PHONG_NGAN[p] || p).join(', ');
    return pt ? `Phó Chánh Văn phòng · Phụ trách ${pt}` : 'Phó Chánh Văn phòng';
  }
  const phong = DEPT_NAMES[user.department] || user.department || '';
  const chucDanh = user.role_group === 'A2' ? 'Trưởng phòng' : (user.position_title || 'Chuyên viên');
  return phong ? `${chucDanh} · ${phong}` : chucDanh;
}
