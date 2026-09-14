// Chạy một lần trước cả bộ e2e:
//   1. Dọn dữ liệu do lần chạy trước để lại (nhiệm vụ có tiêu đề bắt đầu bằng E2E_TAG) bằng service_role.
//   2. Đăng nhập 3 tài khoản seed A1/A2/A3 qua API (3 lượt, + demo_qtht nếu có) và ghi phiên thành storageState
//      (.auth/<vai trò>.json, khoá localStorage sb-<ref>-auth-token mà supabase-js đọc khi tải trang),
//      để các kịch bản dùng lại phiên thay vì đăng nhập lại — giữ tổng lượt đăng nhập mỗi lần chạy
//      dưới giới hạn 30 lượt/5 phút/IP của Supabase (xem README).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys, SEED_PASSWORD, EMAIL_DOMAIN } from './lib/keys.mjs';
import { USERS, OPTIONAL_USERS, AUTH_DIR, storageStatePath } from './lib/roles.mjs';

export const E2E_TAG = 'E2E-TEST';
export const BASE_URL = 'http://127.0.0.1:4173/vptu-mvp-task/';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export async function cleanupE2EData() {
  const k = getKeys();
  const db = createClient(k.url, k.service, noSession);
  // task_directives / task_evidences xoá theo FK ON DELETE CASCADE.
  const { error } = await db.from('tasks').delete().like('title', `${E2E_TAG}%`);
  if (error) throw new Error(`Dọn dữ liệu e2e thất bại: ${error.message}`);
}

async function saveSessions() {
  const k = getKeys();
  const storageKey = `sb-${new URL(k.url).hostname.split('.')[0]}-auth-token`;
  mkdirSync(AUTH_DIR, { recursive: true });
  const login = async (user) => {
    const client = createClient(k.url, k.anon, noSession);
    const { data, error } = await client.auth.signInWithPassword({
      email: `${user.username}@${EMAIL_DOMAIN}`, password: SEED_PASSWORD,
    });
    if (error) return { error };
    return {
      state: {
        cookies: [],
        origins: [{ origin: new URL(BASE_URL).origin, localStorage: [{ name: storageKey, value: JSON.stringify(data.session) }] }],
      },
    };
  };
  for (const [role, user] of Object.entries(USERS)) {
    const { state, error } = await login(user);
    if (error) throw new Error(`Đăng nhập ${user.username} thất bại: ${error.message}`);
    writeFileSync(storageStatePath(role), JSON.stringify(state));
  }
  // Tài khoản tuỳ chọn (chưa có trên staging cho tới khi merge migration + nạp seed tương ứng):
  // đăng nhập lỗi thì xoá phiên cũ để kịch bản liên quan tự bỏ qua, không làm đỏ cả bộ.
  for (const [role, user] of Object.entries(OPTIONAL_USERS)) {
    const { state } = await login(user);
    if (state) writeFileSync(storageStatePath(role), JSON.stringify(state));
    else rmSync(storageStatePath(role), { force: true });
  }
}

export default async function globalSetup() {
  await cleanupE2EData();
  await saveSessions();
}
