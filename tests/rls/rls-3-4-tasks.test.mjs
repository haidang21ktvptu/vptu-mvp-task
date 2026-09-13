// RLS-3 (đọc tasks theo vai trò) và RLS-4 (ghi tasks trong phạm vi; A3 chỉ đổi status).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, adminClient, assertDenied, assertNoRows, assertOk, ids, IDS } from './lib.mjs';
import { setupFixtures } from './fixtures.mjs';

let fx;
before(async () => { fx = await setupFixtures(); });

async function visible(username) {
  const c = await userClient(username);
  const r = await c.from('tasks').select('id').eq('resolution_code', 'RLS-TEST');
  assertOk(r, `${username} select tasks`);
  return ids(r.data);
}

describe('RLS-3 tasks — đọc', () => {
  test('được phép: A3 thấy việc của mình; bị chặn: không thấy việc người khác', async () => {
    const seen = await visible('demo_cv1');
    assert.ok(seen.includes(fx.t1)); assert.ok(!seen.includes(fx.t2));
  });
  test('được phép: A2 thấy việc phòng mình; bị chặn: không thấy phòng khác', async () => {
    const seen = await visible('demo_truongphong');
    assert.ok(seen.includes(fx.t1)); assert.ok(!seen.includes(fx.t2));
  });
  test('được phép: PCVP thấy khối mình; bị chặn: không thấy khối khác', async () => {
    const seen = await visible('demo_pcvp');
    assert.ok(seen.includes(fx.t1)); assert.ok(!seen.includes(fx.t2));
    const seen2 = await visible('demo_pcvp2');
    assert.ok(seen2.includes(fx.t2)); assert.ok(!seen2.includes(fx.t1));
  });
  test('được phép: CVP thấy tất cả', async () => {
    const seen = await visible('demo_cvp');
    assert.ok(seen.includes(fx.t1) && seen.includes(fx.t2));
  });
  test('view_exception_dashboard theo RLS (security_invoker): PCVP không thấy khối khác', async () => {
    const pcvp = await userClient('demo_pcvp');
    const r = await pcvp.from('view_exception_dashboard').select('task_id').eq('resolution_code', 'RLS-TEST');
    assertOk(r, 'PCVP select view');
    const seen = ids(r.data);
    assert.ok(seen.includes(fx.t1) && !seen.includes(fx.t2));
  });
  test('bị chặn: anon không đọc được tasks', async () => {
    assertDenied(await anonClient().from('tasks').select('id'), 'anon select tasks');
  });
});

describe('RLS-4 tasks — ghi', () => {
  const base = {
    title: 'RLS-TEST T3', resolution_code: 'RLS-TEST', expected_product: 'x', critical_overdue_days: 3,
    competent_authority: 'LĐVP', status: 'CHO_TIEP_NHAN', deadline: new Date(Date.now() + 86400000).toISOString(),
  };
  test('được phép: A2 giao việc cho người trong phòng', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('tasks').insert({ ...base, assigned_to: IDS.cv1, leader_in_charge: IDS.truongphong, created_by: IDS.truongphong }).select('id');
    assertOk(r, 'A2 insert trong phòng');
    await adminClient().from('tasks').delete().eq('id', r.data[0].id);
  });
  test('bị chặn: A2 giao việc cho người phòng khác', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('tasks').insert({ ...base, assigned_to: IDS.cv2, leader_in_charge: IDS.truongphong, created_by: IDS.truongphong }).select('id');
    assertDenied(r, 'A2 insert phòng khác');
  });
  test('bị chặn: A3 không được giao việc', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('tasks').insert({ ...base, assigned_to: IDS.cv1, created_by: IDS.cv1 }).select('id');
    assertDenied(r, 'A3 insert');
  });
  test('được phép: A3 tiếp nhận việc của mình (status)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('tasks').update({ status: 'DANG_THUC_HIEN' }).eq('id', fx.t1).select('id, status');
    assertOk(r, 'A3 update status');
    assert.equal(r.data[0]?.status, 'DANG_THUC_HIEN');
  });
  test('bị chặn: A3 sửa trường khác status (trigger)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('tasks').update({ title: 'Đổi tên' }).eq('id', fx.t1).select('id');
    assertDenied(r, 'A3 update title');
  });
  test('bị chặn: A3 nhảy trạng thái không hợp lệ (DANG_THUC_HIEN -> HOAN_THANH)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('tasks').update({ status: 'HOAN_THANH' }).eq('id', fx.t1).select('id');
    assertDenied(r, 'A3 tự hoàn thành');
  });
  test('bị chặn: A3 sửa việc của người khác (0 dòng)', async () => {
    const cv1 = await userClient('demo_cv1');
    assertNoRows(await cv1.from('tasks').update({ status: 'CHO_DUYET' }).eq('id', fx.t2).select('id'), 'A3 update việc khác');
  });
  test('bị chặn: PCVP đổi người sang ngoài khối', async () => {
    const pcvp = await userClient('demo_pcvp');
    const r = await pcvp.from('tasks').update({ assigned_to: IDS.cv2 }).eq('id', fx.t1).select('id');
    assertDenied(r, 'PCVP reassign ngoài khối');
  });
  test('được phép: A2 đôn đốc/đổi người trong phòng', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('tasks').update({ warning_count: 1 }).eq('id', fx.t1).select('id');
    assertOk(r, 'A2 update trong phòng');
    assert.equal(r.data.length, 1);
  });
  test('bị chặn: A2 sửa việc phòng khác (0 dòng)', async () => {
    const tp = await userClient('demo_truongphong');
    assertNoRows(await tp.from('tasks').update({ warning_count: 9 }).eq('id', fx.t2).select('id'), 'A2 update phòng khác');
  });
});
