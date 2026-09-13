// Dữ liệu mẫu cho test RLS, tạo bằng service_role (bỏ qua RLS) và dọn sau khi test.
//   T1: phòng TONG_HOP, khối demo_pcvp   — assigned demo_cv1, leader/creator demo_truongphong
//   T2: phòng QUAN_TRI, khối demo_pcvp2  — assigned demo_cv2, leader/creator demo_pcvp2
//   D1/D2: ý kiến trên T1/T2; E2: minh chứng của T2; M1: tin nhắn demo_pcvp -> demo_cv1

import { adminClient, IDS } from './lib.mjs';

const TAG = 'RLS-TEST';

function deadline(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

let cached = null; // promise, để 3 hook before chạy đồng thời vẫn chỉ tạo 1 lần
// Tạo đúng một lần cho cả tiến trình (các file test chạy chung với --test-isolation=none);
// dọn ở zz-teardown.test.mjs và ở đầu lần chạy sau.
export function setupFixtures() {
  if (!cached) cached = createFixtures();
  return cached;
}

async function createFixtures() {
  const db = adminClient();
  await teardownFixtures(); // dọn rác lần chạy trước nếu có

  const { data: tasks, error: e1 } = await db.from('tasks').insert([
    {
      title: `${TAG} T1`, resolution_code: TAG, expected_product: 'Báo cáo', deadline: deadline(7),
      critical_overdue_days: 3, competent_authority: 'Lãnh đạo Văn phòng', status: 'CHO_TIEP_NHAN',
      assigned_to: IDS.cv1, leader_in_charge: IDS.truongphong, created_by: IDS.truongphong, warning_count: 0,
    },
    {
      title: `${TAG} T2`, resolution_code: TAG, expected_product: 'Tờ trình', deadline: deadline(7),
      critical_overdue_days: 3, competent_authority: 'Lãnh đạo Văn phòng', status: 'DANG_THUC_HIEN',
      assigned_to: IDS.cv2, leader_in_charge: IDS.pcvp2, created_by: IDS.pcvp2, warning_count: 0,
    },
  ]).select('id, title');
  if (e1) throw new Error(`Tạo tasks mẫu thất bại: ${e1.message}`);
  const t1 = tasks.find((t) => t.title.endsWith('T1')).id;
  const t2 = tasks.find((t) => t.title.endsWith('T2')).id;

  const { data: dirs, error: e2 } = await db.from('task_directives').insert([
    { task_id: t1, sender_id: IDS.truongphong, content: `${TAG} D1`, is_read: false },
    { task_id: t2, sender_id: IDS.pcvp2, content: `${TAG} D2`, is_read: false },
  ]).select('id, task_id');
  if (e2) throw new Error(`Tạo directives mẫu thất bại: ${e2.message}`);

  const { data: ev, error: e3 } = await db.from('task_evidences').insert([
    { task_id: t2, uploaded_by: IDS.cv2, document_title: `${TAG} E2`, file_url: 'https://example.local/e2' },
  ]).select('id');
  if (e3) throw new Error(`Tạo evidence mẫu thất bại: ${e3.message}`);

  const { data: msgs, error: e4 } = await db.from('direct_messages').insert([
    { sender_id: IDS.pcvp, receiver_id: IDS.cv1, content: `${TAG} M1`, is_read: false },
  ]).select('id');
  if (e4) throw new Error(`Tạo message mẫu thất bại: ${e4.message}`);

  return {
    t1, t2,
    d1: dirs.find((d) => d.task_id === t1).id,
    d2: dirs.find((d) => d.task_id === t2).id,
    e2: ev[0].id,
    m1: msgs[0].id,
  };
}

export async function teardownFixtures() {
  const db = adminClient();
  // tasks cascade xoá directives/evidences (FK ON DELETE CASCADE ở baseline).
  await db.from('tasks').delete().eq('resolution_code', TAG);
  await db.from('direct_messages').delete().like('content', `${TAG}%`);
}
