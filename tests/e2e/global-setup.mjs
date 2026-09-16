// Chạy một lần trước cả bộ e2e:
//   1. Dọn dữ liệu do lần chạy trước để lại (nhiệm vụ có tiêu đề bắt đầu bằng E2E_TAG) bằng service_role.
//   2. Đăng nhập các tài khoản seed (3 vai chuẩn + tài khoản riêng từng spec, GĐ18; + demo_qtht/demo_a0 nếu có) và ghi phiên thành storageState
//      (.auth/<vai trò>.json, khoá localStorage sb-<ref>-auth-token mà supabase-js đọc khi tải trang),
//      để các kịch bản dùng lại phiên thay vì đăng nhập lại — giữ tổng lượt đăng nhập mỗi lần chạy
//      dưới giới hạn 30 lượt/5 phút/IP của Supabase (xem README).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys, SEED_PASSWORD, EMAIL_DOMAIN } from './lib/keys.mjs';
import { USERS, OPTIONAL_USERS, AUTH_DIR, sessionPath } from './lib/roles.mjs';

export const E2E_TAG = 'E2E-TEST';
export const BASE_URL = 'http://127.0.0.1:4173/vptu-mvp-task/';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export async function cleanupE2EData() {
  const k = getKeys();
  const db = createClient(k.url, k.service, noSession);
  // Rác của lần chạy trước (spec tự dọn theo hội nghị 992–997; đây là lưới cuối): nhiệm vụ rồi văn bản giao việc.
  const r1 = await db.from('nhiem_vu').delete().like('noi_dung', `${E2E_TAG}%`);
  const r2 = await db.from('van_ban_giao_viec').delete().like('so_ket_luan', `${E2E_TAG}%`);
  const error = r1.error || r2.error;
  if (error) throw new Error(`Dọn dữ liệu e2e thất bại: ${error.message}`);
}

async function saveSessions() {
  const k = getKeys();
  mkdirSync(AUTH_DIR, { recursive: true });
  const login = async (user) => {
    const client = createClient(k.url, k.anon, noSession);
    const { data, error } = await client.auth.signInWithPassword({
      email: `${user.username}@${EMAIL_DOMAIN}`, password: SEED_PASSWORD,
    });
    if (error) return { error };
    return { state: data.session }; // cặp token; lib/app.js làm mới theo chuỗi cho từng context
  };
  for (const [role, user] of Object.entries(USERS)) {
    const { state, error } = await login(user);
    if (error) throw new Error(`Đăng nhập ${user.username} thất bại: ${error.message}`);
    writeFileSync(sessionPath(role), JSON.stringify(state));
  }
  // Tài khoản tuỳ chọn (chưa có trên staging cho tới khi merge migration + nạp seed tương ứng):
  // đăng nhập lỗi thì xoá phiên cũ để kịch bản liên quan tự bỏ qua, không làm đỏ cả bộ.
  for (const [role, user] of Object.entries(OPTIONAL_USERS)) {
    const { state } = await login(user);
    if (state) writeFileSync(sessionPath(role), JSON.stringify(state));
    else rmSync(sessionPath(role), { force: true });
  }
}

export default async function globalSetup() {
  // Key lấy MỘT lần ở đây rồi truyền cho worker qua biến môi trường (Playwright kế thừa env của globalSetup): 2 worker cùng gọi
  // Supabase CLI một lúc thỉnh thoảng lỗi (GĐ18); CI vốn đã có sẵn 3 biến này.
  const k = getKeys();
  Object.assign(process.env, { SUPABASE_URL: k.url, SUPABASE_ANON_KEY: k.anon, SUPABASE_SERVICE_ROLE_KEY: k.service });
  await cleanupE2EData();
  await saveSessions();
}
