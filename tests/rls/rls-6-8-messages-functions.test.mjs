// RLS-6 (direct_messages: chỉ người gửi/nhận) và RLS-8 (hàm SECURITY DEFINER kiểm tra quyền bên trong).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, adminClient, assertDenied, assertOk, IDS } from './lib.mjs';
import { setupFixtures } from './fixtures.mjs';

let fx;
before(async () => { fx = await setupFixtures(); });

describe('RLS-6 direct_messages', () => {
  test('được phép: người nhận đọc tin gửi cho mình; bị chặn: người thứ ba', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('direct_messages').select('id').eq('id', fx.m1);
    assertOk(r, 'receiver select'); assert.equal(r.data.length, 1);
    const cv2 = await userClient('demo_cv2');
    const r2 = await cv2.from('direct_messages').select('id').eq('id', fx.m1);
    assertOk(r2, 'third party select'); assert.equal(r2.data.length, 0);
  });
  test('được phép: gửi tin với sender_id = mình; bị chặn: giả mạo sender', async () => {
    const cv1 = await userClient('demo_cv1');
    assertOk(await cv1.from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: 'RLS-TEST M2', is_read: false }).select('id'), 'send');
    assertDenied(await cv1.from('direct_messages').insert({ sender_id: IDS.cv2, receiver_id: IDS.cv1, content: 'RLS-TEST giả', is_read: false }).select('id'), 'giả sender');
  });
  test('bị chặn: đánh dấu đã đọc trực tiếp (chỉ qua mark_messages_read); anon', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('direct_messages').update({ is_read: true }).eq('id', fx.m1).select('id'), 'update trực tiếp');
    assertDenied(await anonClient().from('direct_messages').select('id'), 'anon messages');
  });
});

describe('RLS-8 hàm nghiệp vụ', () => {
  test('mark_messages_read: người nhận đánh dấu được; người khác không ảnh hưởng', async () => {
    const cv2 = await userClient('demo_cv2');
    const r0 = await cv2.rpc('mark_messages_read', { p_peer_id: IDS.pcvp });
    assertOk(r0, 'cv2 mark'); assert.equal(r0.data, 0);
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.rpc('mark_messages_read', { p_peer_id: IDS.pcvp });
    assertOk(r, 'cv1 mark'); assert.equal(r.data, 1);
  });
  test('mark_directives_read: bên liên quan được; người ngoài bị chặn', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.rpc('mark_directives_read', { p_task_id: fx.t1 });
    assertOk(r, 'cv1 mark directives'); assert.equal(r.data, 1);
    assertDenied(await cv1.rpc('mark_directives_read', { p_task_id: fx.t2 }), 'cv1 mark T2');
  });
  test('assign_task: A2 giao trong phòng được; A2 giao phòng khác và A3 bị chặn', async () => {
    const tp = await userClient('demo_truongphong');
    const p = { title: 'RLS-TEST T4', resolution_code: 'RLS-TEST', expected_product: 'x', deadline: new Date(Date.now() + 86400000).toISOString(), critical_overdue_days: 3, leader_in_charge: IDS.truongphong };
    const ok = await tp.rpc('assign_task', { p: { ...p, assigned_to: IDS.cv1 } });
    assertOk(ok, 'A2 assign'); assert.ok(ok.data);
    assertDenied(await tp.rpc('assign_task', { p: { ...p, assigned_to: IDS.cv2 } }), 'A2 assign phòng khác');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('assign_task', { p: { ...p, assigned_to: IDS.cv1 } }), 'A3 assign');
  });
  test('submit_evidence: A3 nộp cho việc đang làm của mình; A3 khác bị chặn', async () => {
    const cv2 = await userClient('demo_cv2');
    const r = await cv2.rpc('submit_evidence', { p_task_id: fx.t2, p_title: 'RLS-TEST nộp', p_url: 'https://example.local/ok' });
    assertOk(r, 'cv2 submit'); assert.ok(r.data);
    const { data: t } = await adminClient().from('tasks').select('status').eq('id', fx.t2).single();
    assert.equal(t.status, 'CHO_DUYET');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('submit_evidence', { p_task_id: fx.t2, p_title: 'x', p_url: 'https://x' }), 'cv1 submit việc khác');
  });
  test('approve_task: PCVP2 duyệt trong khối được; A2 phòng khác và A3 bị chặn', async () => {
    const tp = await userClient('demo_truongphong');
    assertDenied(await tp.rpc('approve_task', { p_task_id: fx.t2 }), 'A2 duyệt phòng khác');
    const cv2 = await userClient('demo_cv2');
    assertDenied(await cv2.rpc('approve_task', { p_task_id: fx.t2 }), 'A3 tự duyệt');
    const pcvp2 = await userClient('demo_pcvp2');
    assertOk(await pcvp2.rpc('approve_task', { p_task_id: fx.t2 }), 'PCVP2 duyệt');
    const { data: t } = await adminClient().from('tasks').select('status, completed_at').eq('id', fx.t2).single();
    assert.equal(t.status, 'HOAN_THANH'); assert.ok(t.completed_at);
  });
  test('warn_task: A2 đôn đốc phòng mình được; phòng khác bị chặn', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.rpc('warn_task', { p_task_id: fx.t1 });
    assertOk(r, 'warn T1'); assert.ok(r.data >= 1); // T1 có thể đã bị test RLS-4 đôn đốc trước
    assertDenied(await tp.rpc('warn_task', { p_task_id: fx.t2 }), 'warn T2');
  });
  test('bị chặn: anon gọi hàm', async () => {
    assertDenied(await anonClient().rpc('warn_task', { p_task_id: fx.t1 }), 'anon rpc');
  });
});
