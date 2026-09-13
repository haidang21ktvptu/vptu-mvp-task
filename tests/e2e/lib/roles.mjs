// Tài khoản seed theo vai trò và đường dẫn storageState (phiên đăng nhập sẵn do global-setup tạo).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const USERS = {
  A1: { username: 'demo_cvp', fullName: 'Demo Chánh Văn phòng', section: '#viewThuongTruc', roleLabel: 'Lãnh đạo Văn phòng (A1)' },
  A2: { username: 'demo_truongphong', fullName: 'Demo Trưởng phòng', section: '#viewLanhDaoVP', roleLabel: 'Trưởng phòng chuyên môn (A2)' },
  A3: { username: 'demo_cv1', fullName: 'Demo Chuyên viên Một', section: '#viewChuyenVien', roleLabel: 'Cán bộ thực hiện (A3)' },
};

export const AUTH_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.auth');

export function storageStatePath(role) {
  return join(AUTH_DIR, `${role}.json`);
}
