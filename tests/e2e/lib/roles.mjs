// Tài khoản seed theo vai trò và đường dẫn storageState (phiên đăng nhập sẵn do global-setup tạo).
// GĐ18 (2 worker): mỗi spec ghi dữ liệu có tài khoản riêng (E2E_*) để không đè nhau; A1/A2/A3 chuẩn cho dang-nhap, quan-tri,
// nhiem-vu (A2 giao việc), dieu-hanh/kl-realtime (A1 xem); PCVP2 cho kl-dashboard (khối Quản trị không spec nào ghi).
// GĐ20 (giao diện v7): mọi vai vào thẳng màn hình điều hành của mình (#viewDieuHanh: Trung tâm điều hành / Điều hành hôm nay /
// Phòng tôi hôm nay / Việc của tôi); các màn khác là section dùng chung.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// GĐ23: dòng 2 dải nhận diện = chức danh theo mẫu dhtn, sinh bằng CÙNG hàm nhanChucDanh của app từ vai + phòng của từng tài khoản (như
// supabase/seed.sql / scripts/seed-demo.mjs) — không gõ tay; phòng ngoài DEPT_NAMES (E2E_RT) hiện mã phòng. PCVP: phần "Phụ trách …" phụ thuộc
// dữ liệu phân công nên expectLoggedIn dùng toContainText.
import { nhanChucDanh } from '../../../frontend/src/lib/constants.js';

const DH = '#viewDieuHanh';
const tk = (username, fullName, role_group, department, extra = {}) => ({
  username, fullName, section: DH, roleLabel: nhanChucDanh({ role_group, department, is_chief: extra.is_chief === true, position_title: extra.position_title || 'Chuyên viên' }), ...extra,
});

export const USERS = {
  A1: tk('demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'LANH_DAO_VAN_PHONG', { is_chief: true }),
  A2: tk('demo_truongphong', 'Demo Trưởng phòng', 'A2', 'TONG_HOP'),
  A3: tk('demo_cv1', 'Demo Chuyên viên Một', 'A3', 'TONG_HOP'),
  PCVP2: tk('demo_pcvp2', 'Demo Phó Chánh Văn phòng Hai', 'A1', 'LANH_DAO_VAN_PHONG'),
  E2E_KL: tk('demo_e2e_kl', 'Demo E2E Chuyên viên KL', 'A3', 'TONG_HOP'),
  E2E_MC: tk('demo_e2e_mc', 'Demo E2E Chuyên viên MC', 'A3', 'TONG_HOP'),
  E2E_NV: tk('demo_e2e_nv', 'Demo E2E Chuyên viên NV', 'A3', 'TONG_HOP'),
  E2E_DH: tk('demo_e2e_dh', 'Demo E2E Chuyên viên DH', 'A3', 'TONG_HOP'),
  E2E_TP: tk('demo_e2e_tp', 'Demo E2E Trưởng phòng RT', 'A2', 'E2E_RT'),
  E2E_CV: tk('demo_e2e_cv', 'Demo E2E Chuyên viên RT', 'A3', 'E2E_RT'),
};

export const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.auth');

// .auth/<vai>.json = phiên (cặp token) mới nhất của vai, do global-setup tạo và lib/app.js làm mới theo chuỗi (CI-4).
export function sessionPath(role) {
  return join(AUTH_DIR, `${role}.json`);
}
export const storageStatePath = sessionPath; // tên cũ, giữ cho các spec kiểm tra existsSync

// Tài khoản ngoài bộ chuẩn, đăng nhập "nếu có" (global-setup bỏ qua khi đăng nhập lỗi; kịch bản tự skip):
// demo_qtht (A3 giữ quan_tri_he_thong, GĐ8), demo_a0 (Thường trực Tỉnh ủy, GĐ18 — có từ migration 0030 + seed mới).
export const OPTIONAL_USERS = {
  QTHT: tk('demo_qtht', 'Demo Quản trị hệ thống', 'A3', 'CDS_CY'),
  A0: tk('demo_a0', 'Demo Thường trực Tỉnh ủy', 'A0', null),
};
