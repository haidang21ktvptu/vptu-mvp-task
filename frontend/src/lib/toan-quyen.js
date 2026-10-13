// v3.22 (migration 0100): tài khoản toàn quyền (accounts.toan_quyen — chỉ qt_vptu, đặt bằng migration, không cấp qua giao diện).
// CSDL coi tài khoản này như Chánh Văn phòng ở mọi kiểm tra quyền của người gọi (me_role / me_is_chief, giao_viec, nhập Excel, chỉ đạo);
// giao diện theo đúng điều đó: hồ sơ hiệu dụng mang vai A1 + is_chief (menu, Tổng quan, Giao việc, Nhiệm vụ như Chánh VP) cộng Quản trị
// nếu có cờ quan_tri_he_thong. Vai thật giữ ở vai_goc; danh bạ (state.accounts) giữ vai thật — người này không thành "Chánh VP" trong danh sách.
// Thường trực (A0) không bao giờ là toàn quyền (như CSDL).

export const laToanQuyen = (u) => Boolean(u?.toan_quyen) && u.role_group !== 'A0';

// Hồ sơ người đăng nhập sau khi áp toàn quyền (gọi đúng một lần trên hồ sơ đọc từ accounts_public; gọi lại không đổi gì).
export function hoSoHieuDung(p) {
  if (!laToanQuyen(p) || p.vai_goc) return p;
  return { ...p, role_group: 'A1', is_chief: true, vai_goc: p.role_group };
}
