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
  A1: 'Lãnh đạo Văn phòng (A1)',
  A2: 'Trưởng phòng chuyên môn (A2)',
  A3: 'Cán bộ thực hiện (A3)',
};

const STATUS_LABELS = {
  CHUA_GIAO: 'Chưa giao cán bộ',
  CHO_TIEP_NHAN: 'Chờ nhận việc',
  TU_CHOI_TIEP_NHAN: 'Đã từ chối',
  DANG_THUC_HIEN: 'Đang thực hiện',
  CHO_DUYET: 'Đã nộp chờ duyệt',
  HOAN_THANH: '✓ Hoàn thành',
};

export function taskStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

// Nhãn vai trò người gửi trong luồng ý kiến chỉ đạo.
export function senderRoleTag(roleGroup) {
  if (roleGroup === 'A1') return 'Lãnh đạo Văn phòng';
  if (roleGroup === 'A2') return 'Trưởng phòng';
  return 'Cán bộ thực hiện';
}
