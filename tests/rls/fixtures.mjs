// Dữ liệu mẫu cho test RLS nhắn tin 1-1, tạo bằng service_role (bỏ qua RLS) và dọn sau khi test.
//   M1: tin nhắn demo_pcvp -> demo_cv1
// (Luồng tasks/task_directives/task_evidences v2 đã bỏ ở GĐ18 — migration 0031.)

import { adminClient, IDS } from './lib.mjs';

const TAG = 'RLS-TEST';

let cached = null; // promise, để các hook before chạy đồng thời vẫn chỉ tạo 1 lần
// Tạo đúng một lần cho cả tiến trình (các file test chạy chung với --test-isolation=none);
// dọn ở zz-teardown.test.mjs và ở đầu lần chạy sau.
export function setupFixtures() {
  if (!cached) cached = createFixtures();
  return cached;
}

async function createFixtures() {
  const db = adminClient();
  await teardownFixtures(); // dọn rác lần chạy trước nếu có
  const { data: msgs, error } = await db.from('direct_messages').insert([
    { sender_id: IDS.pcvp, receiver_id: IDS.cv1, content: `${TAG} M1`, is_read: false },
  ]).select('id');
  if (error) throw new Error(`Tạo message mẫu thất bại: ${error.message}`);
  return { m1: msgs[0].id };
}

export async function teardownFixtures() {
  await adminClient().from('direct_messages').delete().like('content', `${TAG}%`);
}
