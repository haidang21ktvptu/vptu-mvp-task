// RLS-5 (task_directives: bên liên quan) và RLS-7 (task_evidences: A3 thêm cho việc của mình; A1/A2 đọc trong phạm vi).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, assertDenied, assertOk, ids, IDS } from './lib.mjs';
import { setupFixtures } from './fixtures.mjs';

let fx;
before(async () => { fx = await setupFixtures(); });

async function seenDirectives(username) {
  const c = await userClient(username);
  const r = await c.from('task_directives').select('id').like('content', 'RLS-TEST%');
  assertOk(r, `${username} select directives`);
  return ids(r.data);
}

describe('RLS-5 task_directives', () => {
  test('được phép: A3 đọc ý kiến trên việc của mình; bị chặn: việc khác', async () => {
    const seen = await seenDirectives('demo_cv1');
    assert.ok(seen.includes(fx.d1) && !seen.includes(fx.d2));
  });
  test('được phép: A2 (leader) đọc; PCVP đọc trong khối; bị chặn: khối khác', async () => {
    assert.ok((await seenDirectives('demo_truongphong')).includes(fx.d1));
    const pcvp = await seenDirectives('demo_pcvp');
    assert.ok(pcvp.includes(fx.d1) && !pcvp.includes(fx.d2));
  });
  test('được phép: CVP đọc tất cả', async () => {
    const seen = await seenDirectives('demo_cvp');
    assert.ok(seen.includes(fx.d1) && seen.includes(fx.d2));
  });
  test('được phép: A3 gửi ý kiến trên việc của mình', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('task_directives').insert({ task_id: fx.t1, sender_id: IDS.cv1, content: 'RLS-TEST trả lời', is_read: false }).select('id');
    assertOk(r, 'A3 insert directive');
  });
  test('bị chặn: A3 gửi ý kiến vào việc người khác', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('task_directives').insert({ task_id: fx.t2, sender_id: IDS.cv1, content: 'RLS-TEST xâm nhập', is_read: false }).select('id'), 'A3 insert việc khác');
  });
  test('bị chặn: giả mạo sender_id', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('task_directives').insert({ task_id: fx.t1, sender_id: IDS.truongphong, content: 'RLS-TEST giả', is_read: false }).select('id'), 'giả sender');
  });
  test('bị chặn: cập nhật trực tiếp is_read (chỉ qua mark_directives_read)', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('task_directives').update({ is_read: true }).eq('id', fx.d1).select('id'), 'update trực tiếp');
  });
  test('bị chặn: anon', async () => {
    assertDenied(await anonClient().from('task_directives').select('id'), 'anon directives');
  });
});

describe('RLS-7 task_evidences', () => {
  test('được phép: A3 thêm minh chứng cho việc của mình', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('task_evidences').insert({ task_id: fx.t1, uploaded_by: IDS.cv1, document_title: 'RLS-TEST E1', file_url: 'https://example.local/e1' }).select('id');
    assertOk(r, 'A3 insert evidence');
  });
  test('bị chặn: A3 thêm minh chứng cho việc người khác', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('task_evidences').insert({ task_id: fx.t2, uploaded_by: IDS.cv1, document_title: 'RLS-TEST xấu', file_url: 'https://x' }).select('id'), 'A3 insert việc khác');
  });
  test('bị chặn: A2 tự thêm minh chứng', async () => {
    const tp = await userClient('demo_truongphong');
    assertDenied(await tp.from('task_evidences').insert({ task_id: fx.t1, uploaded_by: IDS.truongphong, document_title: 'RLS-TEST A2', file_url: 'https://x' }).select('id'), 'A2 insert evidence');
  });
  test('được phép: A2 đọc minh chứng phòng mình; bị chặn: phòng khác', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('task_evidences').select('id, task_id').like('document_title', 'RLS-TEST%');
    assertOk(r, 'A2 select evidences');
    const tasks = r.data.map((e) => e.task_id);
    assert.ok(tasks.includes(fx.t1) && !tasks.includes(fx.t2));
  });
  test('được phép: PCVP2 đọc minh chứng khối mình; bị chặn: CV1 không thấy E2', async () => {
    const pcvp2 = await userClient('demo_pcvp2');
    const r = await pcvp2.from('task_evidences').select('id').eq('id', fx.e2);
    assertOk(r, 'PCVP2 select E2'); assert.equal(r.data.length, 1);
    const cv1 = await userClient('demo_cv1');
    const r2 = await cv1.from('task_evidences').select('id').eq('id', fx.e2);
    assertOk(r2, 'CV1 select E2'); assert.equal(r2.data.length, 0);
  });
  test('bị chặn: duyệt minh chứng trực tiếp (chỉ qua approve_task)', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('task_evidences').update({ is_approved: true }).eq('task_id', fx.t1).select('id');
    assertDenied(r, 'update evidences trực tiếp');
  });
});
