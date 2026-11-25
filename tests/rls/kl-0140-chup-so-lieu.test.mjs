// 0140 (v3.36 — Tổng quan ba tầng): bảng chụp số liệu hằng ngày kl_chup_viec. (1) Chỉ service_role gọi kl_chup_so_lieu; không nhận ngày sau hôm
// nay. (2) Bản chụp gồm mọi việc chưa hoàn thành với nhóm đếm, mức cảnh báo (cùng trang_thai_dong), có vướng mắc, cấp cần quyết định; việc đã hoàn
// thành không có. (3) Đọc như nhiệm vụ: với mỗi tài khoản, tập bản chụp thấy được = tập nhiệm vụ thấy được (policy nhiem_vu_select); Chánh VP thấy
// đủ. (4) authenticated không ghi, sửa, xoá được bảng. (5) Chạy lại trong ngày thay bản chụp (việc vừa hoàn thành không còn); xoá nhiệm vụ xoá bản
// chụp của việc đó. Ngày chụp cố định trong quá khứ (không đụng bản chụp thật của hôm nay); mã NV-T14x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, LA_PRODUCTION, BO_QUA_PRODUCTION, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = LA_PRODUCTION ? BO_QUA_PRODUCTION : (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const NGAY = '2026-08-20';
let fx; const id = {};
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0140 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    nganh_ma: 'KINH_TE_TONG_HOP', ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const chup = async (ngay = NGAY) => { const r = await db().rpc('kl_chup_so_lieu', { p_ngay: ngay }); assertOk(r, `kl_chup_so_lieu ${ngay}`); return r.data; };
const banChup = async (client = db()) => (await client.from('kl_chup_viec').select('nhiem_vu_id, nhom_dem, muc_canh_bao, co_vuong_mac, cap_quyet_dinh')
  .eq('ngay', NGAY).in('nhiem_vu_id', Object.values(id))).data || [];
const don = async () => {
  await db().from('kl_chup_viec').delete().eq('ngay', NGAY);
  await db().from('nhiem_vu').delete().like('ma', 'NV-T14%');
};

describe('0140 — bảng chụp số liệu hằng ngày: quyền gọi, nội dung, quyền đọc như nhiệm vụ, chạy lại, xoá theo nhiệm vụ', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'NV-T140', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, han_xu_ly: '2026-08-19', vuong_mac: 'Chờ ý kiến về kinh phí' });   // ĐỎ, có vướng mắc
    await them({ ma: 'NV-T141', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, han_xu_ly: '2026-08-10', cap_quyet_dinh: 'THUONG_TRUC' });          // ĐỎ ĐẶC BIỆT, ghi cấp quyết
    await them({ ma: 'NV-T142', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, han_xu_ly: '2026-09-30' });                // XANH, phòng khác
    await them({ ma: 'NV-T143', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, han_xu_ly: '2026-08-15', tien_do_ma: 'HOAN_THANH',
      ngay_hoan_thanh: '2026-08-14' });                                                                                                                      // đã hoàn thành
  });
  after(don);

  test('1. chỉ service_role gọi được; ngày sau hôm nay bị từ chối', async () => {
    const U = ['demo_cv1', 'demo_truongphong', 'demo_cvp'];
    const chan = await songSong([...U.map((u) => async () => (await userClient(u)).rpc('kl_chup_so_lieu', { p_ngay: NGAY })),
      () => anonClient().rpc('kl_chup_so_lieu', { p_ngay: NGAY })]);
    chan.forEach((r, i) => assertDenied(r, `${U[i] || 'anon'} gọi kl_chup_so_lieu`));
    const kq = await chup();
    assert.equal(kq.ngay, NGAY);
    assert.ok(kq.so_viec >= 3, `số việc chụp: ${JSON.stringify(kq)}`);
    const sau = await db().rpc('kl_chup_so_lieu', { p_ngay: '2999-01-01' });
    assert.equal(sau.error?.code, '22023', `ngày sau hôm nay: ${sau.error?.message}`);
  });

  test('2. nội dung bản chụp: mức theo trang_thai_dong tại ngày chụp, vướng mắc, cấp quyết; việc đã hoàn thành không có', async () => {
    const m = new Map((await banChup()).map((s) => [s.nhiem_vu_id, s]));
    assert.deepEqual([m.get(id['NV-T140'])?.muc_canh_bao, m.get(id['NV-T140'])?.co_vuong_mac, m.get(id['NV-T140'])?.nhom_dem], ['DO', true, 'QUA_HAN']);
    assert.deepEqual([m.get(id['NV-T141'])?.muc_canh_bao, m.get(id['NV-T141'])?.cap_quyet_dinh, m.get(id['NV-T141'])?.co_vuong_mac], ['DO_DAC_BIET', 'THUONG_TRUC', false]);
    assert.equal(m.get(id['NV-T142'])?.muc_canh_bao, 'XANH');
    assert.equal(m.has(id['NV-T143']), false, 'việc đã hoàn thành không có trong bản chụp');
  });

  test('3. đọc như nhiệm vụ: tập bản chụp thấy được = tập nhiệm vụ thấy được (mỗi vai); Chánh VP thấy đủ', async () => {
    const cua = Object.values(id);
    for (const u of ['demo_cv1', 'demo_cv2', 'demo_truongphong', 'demo_pcvp', 'demo_cvp']) {
      const c = await userClient(u);
      const nv = new Set(((await c.from('nhiem_vu').select('id').in('id', cua)).data || []).map((r) => r.id).filter((x) => x !== id['NV-T143']));
      const cp = new Set((await banChup(c)).map((s) => s.nhiem_vu_id));
      assert.deepEqual([...cp].sort(), [...nv].sort(), `${u}: bản chụp thấy được khác nhiệm vụ thấy được`);
      if (u === 'demo_cvp') assert.equal(cp.size, 3, 'Chánh VP thấy đủ ba việc chưa hoàn thành');
    }
  });

  test('4. authenticated không ghi, sửa, xoá được bảng chụp', async () => {
    const c = await userClient('demo_cvp');
    assertDenied(await c.from('kl_chup_viec').insert({ ngay: NGAY, nhiem_vu_id: id['NV-T142'], nhom_dem: 'QUA_HAN', muc_canh_bao: 'DO' }), 'insert');
    assertDenied(await c.from('kl_chup_viec').update({ muc_canh_bao: 'XANH' }).eq('ngay', NGAY).select(), 'update');
    assertDenied(await c.from('kl_chup_viec').delete().eq('ngay', NGAY).select(), 'delete');
    assert.equal((await banChup()).length, 3, 'bản chụp còn nguyên');
  });

  test('5. chạy lại trong ngày thay bản chụp; xoá nhiệm vụ xoá bản chụp của việc đó', async () => {
    assertOk(await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-20' }).eq('id', id['NV-T142']), 'hoàn thành NV-T142');
    await chup();
    assert.deepEqual((await banChup()).map((s) => s.nhiem_vu_id).sort(), [id['NV-T140'], id['NV-T141']].sort());
    assertOk(await db().from('nhiem_vu').delete().eq('id', id['NV-T140']), 'xoá NV-T140');
    assert.deepEqual((await banChup()).map((s) => s.nhiem_vu_id), [id['NV-T141']]);
  });
});
