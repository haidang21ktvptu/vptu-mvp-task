// RLS-6 (direct_messages: chỉ người gửi/nhận) và RLS-8 (hàm SECURITY DEFINER kiểm tra quyền bên trong — mark_messages_read).
// Các hàm luồng tasks v2 (assign_task, submit_evidence, approve_task, warn_task, mark_directives_read) đã bỏ ở GĐ18 (0031);
// hàm nghiệp vụ của thực thể thống nhất có test riêng kl-0025 → kl-0030.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, assertDenied, assertOk, IDS } from './lib.mjs';
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
  test('bị chặn: anon gọi hàm', async () => {
    assertDenied(await anonClient().rpc('mark_messages_read', { p_peer_id: IDS.pcvp }), 'anon rpc');
  });
});
