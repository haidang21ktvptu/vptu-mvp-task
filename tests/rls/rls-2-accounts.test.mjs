// RLS-2: accounts — ai đã đăng nhập cũng đọc được cột công khai; chỉ A1 sửa; anon bị chặn.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, assertDenied, assertNoRows, assertOk, IDS } from './lib.mjs';

describe('RLS-2 accounts', () => {
  test('được phép: A3 đọc danh mục cán bộ (accounts_public)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('accounts_public').select('id, username, is_chief');
    assertOk(r, 'A3 select accounts_public');
    assert.ok(r.data.length >= 6, 'phải thấy đủ tài khoản seed');
    assert.equal(r.data.find((a) => a.id === IDS.cvp).is_chief, true);
  });

  test('được phép: A1 sửa chức danh một cán bộ', async () => {
    const cvp = await userClient('demo_cvp');
    const r = await cvp.from('accounts').update({ position_title: 'Chuyên viên (test)' }).eq('id', IDS.cv2).select('id');
    assertOk(r, 'A1 update accounts');
    assert.equal(r.data.length, 1);
    await cvp.from('accounts').update({ position_title: 'Chuyên viên' }).eq('id', IDS.cv2);
  });

  test('bị chặn: A3 sửa accounts (0 dòng)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('accounts').update({ full_name: 'Hack' }).eq('id', IDS.cv1).select('id');
    // Cột full_name có GRANT UPDATE cho authenticated nhưng policy chỉ cho A1 -> 0 dòng.
    assertNoRows(r, 'A3 update accounts');
  });

  test('bị chặn: A2 sửa cột không được cấp (role_group)', async () => {
    const tp = await userClient('demo_truongphong');
    const r = await tp.from('accounts').update({ role_group: 'A1' }).eq('id', IDS.truongphong).select('id');
    assertDenied(r, 'A2 update role_group');
  });

  test('bị chặn: anon không đọc được accounts_public', async () => {
    const r = await anonClient().from('accounts_public').select('id');
    assertDenied(r, 'anon select accounts_public');
  });

  test('bị chặn: không ai đọc được auth.users qua API', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.schema('auth').from('users').select('id');
    assert.ok(r.error, 'auth.users phải không truy cập được');
  });
});
