// Dọn dữ liệu do lần chạy trước để lại (nhiệm vụ có tiêu đề bắt đầu bằng E2E_TAG) bằng
// service_role trước khi chạy, để kịch bản A3 tiếp nhận không bị nhiệm vụ cũ chen vào.
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';

export const E2E_TAG = 'E2E-TEST';

export async function cleanupE2EData() {
  const k = getKeys();
  const db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
  // task_directives / task_evidences xoá theo FK ON DELETE CASCADE.
  const { error } = await db.from('tasks').delete().like('title', `${E2E_TAG}%`);
  if (error) throw new Error(`Dọn dữ liệu e2e thất bại: ${error.message}`);
}

export default async function globalSetup() {
  await cleanupE2EData();
}
