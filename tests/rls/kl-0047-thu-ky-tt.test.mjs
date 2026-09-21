// 0047 — thư ký Thường trực (cờ accounts.thu_ky_thuong_truc): chỉ quan_tri_he_thong cấp/thu qua admin_dat_co (quyen_lich_su + nhat_ky_he_thong);
// thư ký ĐỌC nhiệm vụ có ≥ 1 CHI_DAO_TT (không thấy việc không có), ĐÓNG được CHI_DAO_TT thay mặt (vết "Đóng thay mặt Thường trực — <họ tên>",
// dong_boi), KHÔNG gửi CHI_DAO_TT / loại khác, KHÔNG đóng DON_DOC / Y_KIEN, KHÔNG ghi gì khác (nop_minh_chung, giao_viec, xac_nhan_nhan_viec,
// cập nhật tiến độ). A1/A2/A3 thường không đóng CHI_DAO_TT; A0 người gửi vẫn đóng được. Thư ký = demo_e2e_kl (A3 Tổng hợp, không là Owner/theo dõi việc mẫu → ngoài phạm vi).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, LA_PRODUCTION, BO_QUA_PRODUCTION } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = LA_PRODUCTION ? BO_QUA_PRODUCTION : (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const TK_ID = '00000000-0000-4000-8000-000000000010'; // demo_e2e_kl (seed.sql) — thư ký trong test này
let fx; const id = {}; let tt1; let tt2; let dd1; let yk1; let t0;
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `KL-0047 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const gui = async (u, ma, loai, noi_dung = 'x') => { const r = await rpc(u, 'chi_dao_gui', { p: { nhiem_vu_id: id[ma], loai, noi_dung } }); assertOk(r, `${u} gửi ${loai}`); return r.data; };
const dong = (u, cid) => rpc(u, 'chi_dao_dong', { p_id: cid });
const co = (bat) => rpc('demo_qtht', 'admin_dat_co', { p_username: 'demo_e2e_kl', p_co: 'thu_ky_thuong_truc', p_bat: bat, p_ly_do: 'RLS 0047' });
const don = async () => {
  await db().from('nhiem_vu').delete().in('ma', ['NV-T95', 'NV-T96']);
  await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK_ID);
  if (t0) { await db().from('quyen_lich_su').delete().eq('co', 'thu_ky_thuong_truc').gte('luc', t0); await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'cap_co').eq('doi_tuong', 'demo_e2e_kl').gte('luc', t0); }
};

describe('0047 — thư ký Thường trực: cấp cờ, phạm vi đọc, đóng thay mặt, không quyền ghi khác', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    t0 = new Date().toISOString();
    await them({ ma: 'NV-T95' });   // sẽ có CHI_DAO_TT
    await them({ ma: 'NV-T96' });   // không có CHI_DAO_TT → thư ký không thấy
    tt1 = await gui('demo_a0', 'NV-T95', 'CHI_DAO_TT', 'Báo cáo Thường trực (0047 tt1)');
    tt2 = await gui('demo_a0', 'NV-T95', 'CHI_DAO_TT', 'Báo cáo Thường trực (0047 tt2)');
    yk1 = await gui('demo_a0', 'NV-T95', 'Y_KIEN', 'Ý kiến (0047)');
    dd1 = await gui('demo_cvp', 'NV-T95', 'DON_DOC', 'Đôn đốc của Chánh VP (0047)');
  });
  after(don);

  test('1. Cấp cờ: A1 (không phải QTHT) bị chặn; QTHT cấp được → accounts_public, quyen_lich_su, nhat_ky_he_thong; thiếu lý do bị chặn', async () => {
    assertDenied(await rpc('demo_cvp', 'admin_dat_co', { p_username: 'demo_e2e_kl', p_co: 'thu_ky_thuong_truc', p_bat: true, p_ly_do: 'x' }), 'Chánh VP cấp cờ thư ký');
    assertDenied(await rpc('demo_e2e_kl', 'admin_dat_co', { p_username: 'demo_e2e_kl', p_co: 'thu_ky_thuong_truc', p_bat: true, p_ly_do: 'x' }), 'tự cấp');
    assert.ok((await rpc('demo_qtht', 'admin_dat_co', { p_username: 'demo_e2e_kl', p_co: 'thu_ky_thuong_truc', p_bat: true, p_ly_do: '' })).error, 'thiếu lý do');
    assertOk(await co(true), 'QTHT cấp');
    const a = await (await userClient('demo_e2e_kl')).from('accounts_public').select('thu_ky_thuong_truc').eq('id', TK_ID).single();
    assert.equal(a.data.thu_ky_thuong_truc, true);
    const q = await db().from('quyen_lich_su').select('co, bat, ly_do').eq('tai_khoan', TK_ID).eq('co', 'thu_ky_thuong_truc').gte('luc', t0);
    assert.deepEqual(q.data, [{ co: 'thu_ky_thuong_truc', bat: true, ly_do: 'RLS 0047' }]);
    const n = await db().from('nhat_ky_he_thong').select('hanh_dong, chi_tiet').eq('doi_tuong', 'demo_e2e_kl').gte('luc', t0);
    assert.equal(n.data.length, 1); assert.equal(n.data[0].chi_tiet.co, 'thu_ky_thuong_truc');
  });

  test('2. Phạm vi đọc: thư ký thấy NV-T95 (có CHI_DAO_TT) và luồng chỉ đạo của nó; KHÔNG thấy NV-T96', async () => {
    const c = await userClient('demo_e2e_kl');
    const nv = await c.from('v_nhiem_vu').select('id').in('id', [id['NV-T95'], id['NV-T96']]);
    assertOk(nv, 'v_nhiem_vu'); assert.deepEqual(nv.data.map((r) => r.id), [id['NV-T95']]);
    const cd = await c.from('chi_dao').select('id').eq('nhiem_vu_id', id['NV-T95']);
    assert.equal(cd.data.length, 4, 'thấy 4 dòng chỉ đạo của NV-T95');
    const tt = await c.from('v_chi_dao_tt').select('id').eq('nhiem_vu_id', id['NV-T95']);
    assert.equal(tt.data.length, 2, 'v_chi_dao_tt: 2 luồng TT');
    await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK_ID);
    const khong = await (await userClient('demo_e2e_kl')).from('v_nhiem_vu').select('id').eq('id', id['NV-T95']);
    assert.equal(khong.data.length, 0, 'thu cờ → không còn thấy');
    await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK_ID);
  });

  test('3. Thư ký KHÔNG ghi gì khác: chi_dao_gui mọi loại, nop_minh_chung, giao_viec, xac_nhan_nhan_viec, cập nhật tiến độ', async () => {
    for (const loai of ['CHI_DAO_TT', 'DON_DOC', 'Y_KIEN', 'GIA_HAN']) assertDenied(await rpc('demo_e2e_kl', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T95'], loai, noi_dung: 'x' } }), `thư ký gửi ${loai}`);
    assertDenied(await rpc('demo_e2e_kl', 'nop_minh_chung', { p: { nhiem_vu_id: id['NV-T95'], so_hieu: '1/BC', ngay_van_ban: '2026-08-20', cap_nhan: 'CHANH_VAN_PHONG', trich_yeu: 'x', mo_ta_ket_qua: 'x' } }), 'nộp minh chứng');
    assertDenied(await rpc('demo_e2e_kl', 'giao_viec', { p: { van_ban_id: fx.hn, noi_dung: 'x', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, san_pham_loai: 'BAO_CAO', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nhiem_vu_cha: id['NV-T95'] } }), 'giao việc');
    assertDenied(await rpc('demo_e2e_kl', 'xac_nhan_nhan_viec', { p_id: id['NV-T95'] }), 'xác nhận nhận việc');
    const up = await (await userClient('demo_e2e_kl')).from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH' }).eq('id', id['NV-T95']).select('id');
    assert.ok(up.error || up.data.length === 0, 'cập nhật tiến độ phải bị RLS chặn');
  });

  test('4. Đóng: thư ký KHÔNG đóng DON_DOC của Chánh VP / Y_KIEN của A0; A1, A2, A3 thường KHÔNG đóng CHI_DAO_TT', async () => {
    assertDenied(await dong('demo_e2e_kl', dd1), 'thư ký đóng DON_DOC');
    assertDenied(await dong('demo_e2e_kl', yk1), 'thư ký đóng Y_KIEN');
    for (const u of ['demo_cvp', 'demo_truongphong', 'demo_cv1']) assertDenied(await dong(u, tt1), `${u} đóng CHI_DAO_TT`);
    assert.equal((await db().from('chi_dao').select('trang_thai').eq('id', tt1).single()).data.trang_thai, 'CHO_PHAN_HOI');
  });

  test('5. Thư ký đóng CHI_DAO_TT → DA_DONG, dong_boi = thư ký, vết + tin cho A0 "Đóng thay mặt Thường trực — Demo E2E Chuyên viên KL"; đóng lại bị chặn', async () => {
    assertOk(await dong('demo_e2e_kl', tt1), 'thư ký đóng tt1');
    const c = (await db().from('chi_dao').select('trang_thai, dong_boi, dong_luc').eq('id', tt1).single()).data;
    assert.equal(c.trang_thai, 'DA_DONG'); assert.equal(c.dong_boi, TK_ID); assert.ok(c.dong_luc);
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['NV-T95']).eq('cot', 'chi_dao').like('gia_tri_moi', 'Đóng thay mặt%');
    assert.equal(ls.data.length, 1); assert.match(ls.data[0].gia_tri_moi, /^Đóng thay mặt Thường trực — Demo E2E Chuyên viên KL · NV-T95: /);
    const tin = await db().from('direct_messages').select('content').eq('receiver_id', IDS.a0).eq('nhiem_vu_id', id['NV-T95']).like('content', 'Đóng thay mặt%');
    assert.equal(tin.data.length, 1, 'A0 (người gửi) được báo');
    assert.ok((await dong('demo_e2e_kl', tt1)).error, 'đóng lại');
    const v = await (await userClient('demo_a0')).from('v_chi_dao_tt').select('dong_boi_ten').eq('id', tt1).single();
    assert.equal(v.data.dong_boi_ten, 'Demo E2E Chuyên viên KL', 'A0 thấy tên người đóng thay mặt');
  });

  test('6. A0 người gửi vẫn đóng luồng của mình (dong_boi = A0, vết thường); QTHT thu cờ → thư ký hết quyền đóng', async () => {
    assertOk(await dong('demo_a0', tt2), 'A0 đóng tt2');
    const c = (await db().from('chi_dao').select('dong_boi').eq('id', tt2).single()).data; assert.equal(c.dong_boi, IDS.a0);
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['NV-T95']).eq('cot', 'chi_dao').like('gia_tri_moi', 'Đóng chỉ đạo Thường trực%');
    assert.equal(ls.data.length, 1);
    assertOk(await co(false), 'QTHT thu cờ');
    const tt3 = await gui('demo_a0', 'NV-T95', 'CHI_DAO_TT', 'tt3');
    assertDenied(await dong('demo_e2e_kl', tt3), 'hết cờ → không đóng');
  });
});
