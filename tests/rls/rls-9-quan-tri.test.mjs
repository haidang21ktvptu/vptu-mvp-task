// RLS-9 (GĐ8, migration 0013): quản trị đặc quyền — hai cờ trên accounts, hàm admin_dat_co,
// nhật ký quyen_lich_su, bảng phu_trach_phong + admin_phan_cong_phong (hiệu lực theo ngày).
// Mọi thay đổi cờ/phân công tạo trong test đều được thu lại ở cuối file (không phụ thuộc teardown).
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, adminClient, assertDenied, assertOk, IDS } from './lib.mjs';

const LY_DO = 'RLS-TEST quản trị';

// Trên staging trước khi merge, migration 0013 và tài khoản demo_qtht chưa có (CI job staging chỉ có
// schema đã merge; seed nạp tay) → bỏ qua cả file thay vì đỏ. Trên local (RLS_LOCAL=1) luôn chạy.
const probe = await adminClient().from('phu_trach_phong').select('id').limit(1);
const qthtRow = probe.error ? null : (await adminClient().from('accounts').select('id').eq('id', IDS.qtht).maybeSingle()).data;
const SKIP = probe.error || !qthtRow
  ? 'Chưa có migration 0013 hoặc seed demo_qtht trên project này (chạy lại sau khi merge + nạp seed)'
  : false;

after(async () => {
  if (SKIP) return;
  // Thu về trạng thái seed bằng service_role (dọn cả khi test giữa chừng lỗi).
  const db = adminClient();
  await db.from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
  await db.from('phu_trach_phong').delete().eq('lanh_dao_id', IDS.pcvp2).eq('phong', 'TONG_HOP');
});

describe('RLS-9 cờ đặc quyền và admin_dat_co', { skip: SKIP }, () => {
  test('được phép: ai đã đăng nhập cũng thấy hai cờ trên accounts_public; seed đúng', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('accounts_public').select('id, quan_tri_kl, quan_tri_he_thong');
    assertOk(r, 'select cờ');
    assert.equal(r.data.find((a) => a.id === IDS.qtht).quan_tri_he_thong, true);
    assert.equal(r.data.filter((a) => a.quan_tri_kl).length, 0, 'seed không ai có quan_tri_kl');
  });

  test('bị chặn: UPDATE trực tiếp hai cờ (quyền cột), kể cả A1', async () => {
    const cvp = await userClient('demo_cvp');
    assertDenied(await cvp.from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cvp).select('id'), 'A1 tự bật quan_tri_kl');
    assertDenied(await cvp.from('accounts').update({ quan_tri_he_thong: true }).eq('id', IDS.cvp).select('id'), 'A1 tự bật quan_tri_he_thong');
    const qtht = await userClient('demo_qtht');
    assertDenied(await qtht.from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2).select('id'), 'QTHT update thẳng');
  });

  test('bị chặn: người không có quan_tri_he_thong gọi admin_dat_co (Chánh VP, A3)', async () => {
    const cvp = await userClient('demo_cvp');
    assertDenied(await cvp.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO }), 'CVP cấp');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('admin_dat_co', { p_username: 'demo_cv1', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO }), 'A3 tự cấp');
    assertDenied(await anonClient().rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO }), 'anon');
  });

  test('được phép: QTHT cấp rồi thu quan_tri_kl; cờ đổi và nhật ký ghi đủ hai dòng', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO }), 'cấp');
    const cv2 = await userClient('demo_cv2');
    const r1 = await cv2.from('accounts_public').select('quan_tri_kl').eq('id', IDS.cv2).single();
    assertOk(r1, 'đọc cờ'); assert.equal(r1.data.quan_tri_kl, true);

    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: false, p_ly_do: `${LY_DO} thu` }), 'thu');
    const r2 = await cv2.from('accounts_public').select('quan_tri_kl').eq('id', IDS.cv2).single();
    assert.equal(r2.data.quan_tri_kl, false);

    const log = await qtht.from('quyen_lich_su').select('cap_boi, co, bat, ly_do').eq('tai_khoan', IDS.cv2).order('id');
    assertOk(log, 'đọc nhật ký');
    // Nhật ký không xoá được nên tích luỹ qua các lần chạy: chỉ so hai dòng cuối.
    const mine = log.data.filter((l) => l.ly_do.startsWith(LY_DO)).slice(-2);
    assert.deepEqual(mine.map((l) => [l.cap_boi, l.co, l.bat]), [[IDS.qtht, 'quan_tri_kl', true], [IDS.qtht, 'quan_tri_kl', false]]);
  });

  test('bị chặn: cấp quan_tri_he_thong qua hàm; thiếu lý do; tài khoản không tồn tại', async () => {
    const qtht = await userClient('demo_qtht');
    assert.ok((await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_he_thong', p_bat: true, p_ly_do: LY_DO })).error, 'cờ hệ thống');
    assert.ok((await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: '  ' })).error, 'thiếu lý do');
    assert.ok((await qtht.rpc('admin_dat_co', { p_username: 'khong_co', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO })).error, 'không có tài khoản');
    const chk = await qtht.from('accounts_public').select('quan_tri_kl, quan_tri_he_thong').eq('id', IDS.cv2).single();
    assert.deepEqual(chk.data, { quan_tri_kl: false, quan_tri_he_thong: false });
  });

  test('bị chặn: người khác đọc quyen_lich_su (0 dòng); không ai ghi trực tiếp; anon', async () => {
    const cvp = await userClient('demo_cvp');
    const r = await cvp.from('quyen_lich_su').select('id');
    assertOk(r, 'CVP đọc nhật ký'); assert.equal(r.data.length, 0);
    const qtht = await userClient('demo_qtht');
    assertDenied(await qtht.from('quyen_lich_su').insert({ tai_khoan: IDS.cv2, co: 'quan_tri_kl', bat: true, ly_do: 'giả' }).select('id'), 'insert thẳng');
    assertDenied(await qtht.from('quyen_lich_su').delete().eq('tai_khoan', IDS.cv2).select('id'), 'delete');
    assertDenied(await anonClient().from('quyen_lich_su').select('id'), 'anon');
  });
});

describe('RLS-9 phu_trach_phong và admin_phan_cong_phong', { skip: SKIP }, () => {
  test('được phép: ai đã đăng nhập cũng đọc bảng phân công; seed 2 dòng đang hiệu lực', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('phu_trach_phong').select('lanh_dao_id, phong, den_ngay').is('den_ngay', null).order('phong');
    assertOk(r, 'đọc phân công');
    assert.deepEqual(r.data.map((p) => [p.lanh_dao_id, p.phong]), [[IDS.pcvp2, 'QUAN_TRI'], [IDS.pcvp, 'TONG_HOP']]);
  });

  test('bị chặn: ghi trực tiếp phu_trach_phong; PCVP tự phân công; A3 gọi hàm', async () => {
    const qtht = await userClient('demo_qtht');
    assertDenied(await qtht.from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', ly_do: 'giả' }).select('id'), 'insert thẳng');
    assertDenied(await qtht.from('phu_trach_phong').update({ den_ngay: '2026-01-02' }).eq('lanh_dao_id', IDS.pcvp).select('id'), 'update thẳng');
    const pcvp2 = await userClient('demo_pcvp2');
    assertDenied(await pcvp2.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO }), 'PCVP tự phân công');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO }), 'A3 gọi hàm');
  });

  test('được phép: QTHT bật PCVP2 ↔ TONG_HOP rồi tắt; dòng cũ đóng den_ngay, không xoá', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-09-01' }), 'bật');
    const on = await qtht.rpc('phu_trach', { p_lanh_dao: IDS.pcvp2, p_phong: 'TONG_HOP' });
    assertOk(on, 'phu_trach sau bật'); assert.equal(on.data, true);

    assertOk(await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: false, p_ly_do: `${LY_DO} tắt`, p_tu_ngay: '2026-09-10' }), 'tắt');
    const rows = await qtht.from('phu_trach_phong').select('tu_ngay, den_ngay').eq('lanh_dao_id', IDS.pcvp2).eq('phong', 'TONG_HOP');
    assertOk(rows, 'đọc dòng'); assert.deepEqual(rows.data, [{ tu_ngay: '2026-09-01', den_ngay: '2026-09-09' }]);
    const giua = await qtht.rpc('phu_trach', { p_lanh_dao: IDS.pcvp2, p_phong: 'TONG_HOP', p_ngay: '2026-09-05' });
    assert.equal(giua.data, true, 'hiệu lực trong kỳ cũ vẫn đúng');
    const sau = await qtht.rpc('phu_trach', { p_lanh_dao: IDS.pcvp2, p_phong: 'TONG_HOP', p_ngay: '2026-09-10' });
    assert.equal(sau.data, false, 'hết hiệu lực từ ngày tắt');
    const log = await qtht.from('quyen_lich_su').select('co, bat').eq('tai_khoan', IDS.pcvp2).order('id');
    assert.deepEqual(log.data.map((l) => [l.co, l.bat]).slice(-2), [['phu_trach:TONG_HOP', true], ['phu_trach:TONG_HOP', false]]);
  });

  test('bị chặn: chồng kỳ cho cùng lãnh đạo/phòng; tắt khi không có phân công; phân công cho A2/Chánh VP', async () => {
    const qtht = await userClient('demo_qtht');
    assert.ok((await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-06-01' })).error, 'chồng kỳ với seed');
    assert.ok((await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'CDS_CY', p_bat: false, p_ly_do: LY_DO })).error, 'tắt khi không có');
    assert.ok((await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_truongphong', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO })).error, 'A2');
    assert.ok((await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_cvp', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO })).error, 'Chánh VP');
  });

  test('phu_trach: Chánh VP mọi phòng; A2 phòng mình; PCVP theo bảng; trước ngày hiệu lực = false', async () => {
    const cv1 = await userClient('demo_cv1');
    const f = async (p_lanh_dao, p_phong, p_ngay) => (await cv1.rpc('phu_trach', { p_lanh_dao, p_phong, ...(p_ngay ? { p_ngay } : {}) })).data;
    assert.equal(await f(IDS.cvp, 'CDS_CY'), true);
    assert.equal(await f(IDS.truongphong, 'TONG_HOP'), true);
    assert.equal(await f(IDS.truongphong, 'QUAN_TRI'), false);
    assert.equal(await f(IDS.pcvp, 'TONG_HOP'), true);
    assert.equal(await f(IDS.pcvp, 'QUAN_TRI'), false);
    assert.equal(await f(IDS.pcvp, 'TONG_HOP', '2025-12-31'), false);
    assert.equal(await f(IDS.cv1, 'TONG_HOP'), false, 'A3 không phụ trách');
  });
});
