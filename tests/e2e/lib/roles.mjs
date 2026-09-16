// Tài khoản seed theo vai trò và đường dẫn storageState (phiên đăng nhập sẵn do global-setup tạo).
// GĐ18 (2 worker): mỗi spec ghi dữ liệu có tài khoản riêng (E2E_*) để không đè nhau; A1/A2/A3 chuẩn cho dang-nhap, quan-tri,
// nhiem-vu (A2 giao việc), dieu-hanh/kl-realtime (A1 xem); PCVP2 cho kl-dashboard (khối Quản trị không spec nào ghi).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const A1 = 'Lãnh đạo Văn phòng (A1)';
const A2 = 'Trưởng phòng chuyên môn (A2)';
const A3 = 'Cán bộ thực hiện (A3)';
const DB = '#viewKlDashboard';
const KL = '#viewKl';

export const USERS = {
  A1: { username: 'demo_cvp', fullName: 'Demo Chánh Văn phòng', section: DB, roleLabel: A1 },
  A2: { username: 'demo_truongphong', fullName: 'Demo Trưởng phòng', section: KL, roleLabel: A2 },
  A3: { username: 'demo_cv1', fullName: 'Demo Chuyên viên Một', section: KL, roleLabel: A3 },
  PCVP2: { username: 'demo_pcvp2', fullName: 'Demo Phó Chánh Văn phòng Hai', section: DB, roleLabel: A1 },
  E2E_KL: { username: 'demo_e2e_kl', fullName: 'Demo E2E Chuyên viên KL', section: KL, roleLabel: A3 },
  E2E_MC: { username: 'demo_e2e_mc', fullName: 'Demo E2E Chuyên viên MC', section: KL, roleLabel: A3 },
  E2E_NV: { username: 'demo_e2e_nv', fullName: 'Demo E2E Chuyên viên NV', section: KL, roleLabel: A3 },
  E2E_DH: { username: 'demo_e2e_dh', fullName: 'Demo E2E Chuyên viên DH', section: KL, roleLabel: A3 },
  E2E_TP: { username: 'demo_e2e_tp', fullName: 'Demo E2E Trưởng phòng RT', section: KL, roleLabel: A2 },
  E2E_CV: { username: 'demo_e2e_cv', fullName: 'Demo E2E Chuyên viên RT', section: KL, roleLabel: A3 },
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
  QTHT: { username: 'demo_qtht', fullName: 'Demo Quản trị hệ thống', roleLabel: A3 },
  A0: { username: 'demo_a0', fullName: 'Demo Thường trực Tỉnh ủy', section: DB, roleLabel: 'Thường trực Tỉnh ủy (A0)' },
};
