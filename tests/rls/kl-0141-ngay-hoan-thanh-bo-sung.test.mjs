// 0141 (v3.36 — CAU-HOI V-2): bổ sung ngày hoàn thành cho việc đã hoàn thành chưa ghi ngày. (1) Chỉ service_role gọi kl_bo_sung_ngay_hoan_thanh,
// kl_bo_sung_ngay_hoan_thanh_hoan_tac, kl_nht_ung_vien. (2) Xem trước chạy thử rồi hoàn lại: không ghi gì, trả số sẽ ghi, số theo từng cách, số sẽ đúng hạn /
// trễ hạn. (3) Ngày: lịch sử chuyển sang Hoàn thành nếu có (LICH_SU), không thì ngày giao + 30 ngày, không quá ngày nhập việc (UOC_TINH); không trước ngày
// giao nhiệm vụ, không sau hôm nay. (4) Thực hiện ghi ngày + dấu, không đổi người / giờ cập nhật cuối, v_nhiem_vu có cột dấu, đúng hạn tính theo ngày mới;
// gọi lại không ghi thêm. (5) Người dùng sửa ngày thì dấu tự bỏ; dấu không ghi tay được. (6) Hoàn tác trả việc còn dấu về chưa ghi ngày. Mọi lời gọi giới hạn
// p_ids = việc của test (không chạm dữ liệu khác). Mã NV-T15x.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, LA_PRODUCTION, BO_QUA_PRODUCTION, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = LA_PRODUCTION ? BO_QUA_PRODUCTION : (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {};
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
    noi_dung: `KL-0141 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', nganh_ma: 'KINH_TE_TONG_HOP', ngay_nhan_van_ban: '2026-08-05', ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const ids = () => Object.values(id);
const xong = { tien_do_ma: 'HOAN_THANH', nguon: 'excel' };   // nhập Excel "đã xong ngoài hệ thống": không ngày, không minh chứng
const dong = async (ma) => (await db().from('v_nhiem_vu').select('ngay_hoan_thanh, ngay_hoan_thanh_bo_sung, ket_qua, cap_nhat_luc, cap_nhat_boi').eq('id', id[ma]).single()).data;
const don = async () => { await db().from('nhiem_vu').delete().like('ma', 'NV-T15%'); };

describe('0141 — ngày hoàn thành bổ sung: quyền gọi, xem trước, cách lấy ngày, thực hiện, dấu, hoàn tác', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'NV-T150', ...xong, han_xu_ly: '2026-09-30' });   // ước tính 5/8 + 30 = 4/9 ≤ hạn → đúng hạn
    await them({ ma: 'NV-T151', ...xong, han_xu_ly: '2026-08-10' });   // lịch sử: chuyển Hoàn thành 12/8 → trễ hạn
    assertOk(await db().from('lich_su').insert({ nhiem_vu_id: id['NV-T151'], nguoi_sua: IDS.cv1, cot: 'tien_do_ma', gia_tri_cu: 'DANG_THUC_HIEN',
      gia_tri_moi: 'HOAN_THANH', nguon: 'app', luc: '2026-08-12T03:00:00Z' }), 'lịch sử NV-T151');
    await them({ ma: 'NV-T152', ...xong, han_xu_ly: null, ly_do_chua_co_han: 'Chưa có hạn' });   // không hạn: không xét đúng hạn
    await them({ ma: 'NV-T153', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-14', han_xu_ly: '2026-09-30', minh_chung: 'Báo cáo số 14-BC/VPTU' });   // đã có ngày
    await them({ ma: 'NV-T154', han_xu_ly: '2026-12-30' });   // đang thực hiện
    await them({ ma: 'NV-T155', ...xong, han_xu_ly: null, ly_do_chua_co_han: 'Chưa có hạn', ngay_nhan_van_ban: '2026-08-20' });   // lịch sử 12/8 trước ngày giao 20/8
    assertOk(await db().from('lich_su').insert({ nhiem_vu_id: id['NV-T155'], nguoi_sua: IDS.cv1, cot: 'tien_do_ma', gia_tri_cu: 'DANG_THUC_HIEN',
      gia_tri_moi: 'HOAN_THANH', nguon: 'app', luc: '2026-08-12T03:00:00Z' }), 'lịch sử NV-T155');
  });
  after(don);

  test('1. chỉ service_role gọi được ba hàm', async () => {
    const goi = [['kl_bo_sung_ngay_hoan_thanh', { p_thuc_hien: true, p_ids: ids() }], ['kl_bo_sung_ngay_hoan_thanh_hoan_tac', { p_ids: ids() }], ['kl_nht_ung_vien', { p_ids: ids() }]];
    const kq = await songSong(goi.flatMap(([ham, ts]) => [async () => (await userClient('demo_cvp')).rpc(ham, ts), async () => (await userClient('demo_qtht')).rpc(ham, ts),
      () => anonClient().rpc(ham, ts)]));
    kq.forEach((r, i) => assertDenied(r, `${goi[Math.floor(i / 3)][0]} lượt ${i % 3}`));
  });

  test('2. xem trước (chạy thử rồi hoàn lại): số sẽ ghi, số theo từng cách, số sẽ đúng hạn / trễ hạn; không ghi gì', async () => {
    const r = await db().rpc('kl_bo_sung_ngay_hoan_thanh', { p_thuc_hien: false, p_ids: ids() });
    assertOk(r, 'xem trước');
    assert.deepEqual([r.data.tong, r.data.lich_su, r.data.uoc_tinh, r.data.ghi, r.data.loi, r.data.co_han, r.data.dung_han, r.data.tre_han, r.data.thuc_hien],
      [4, 2, 2, 4, 0, 2, 1, 1, false], JSON.stringify(r.data.mau_loi));
    assert.equal((await dong('NV-T150')).ngay_hoan_thanh, null, 'xem trước không ghi ngày');
    const ls = (await db().from('lich_su').select('id').eq('nhiem_vu_id', id['NV-T150']).eq('cot', 'ngay_hoan_thanh')).data;
    assert.equal(ls.length, 0, 'chạy thử không để lại lịch sử');
  });

  test('3. ngày từng việc: lịch sử nếu có, không thì ngày giao + 30 ngày (không quá ngày nhập, hôm nay)', async () => {
    const r = await db().rpc('kl_nht_ung_vien', { p_ids: ids() });
    assertOk(r, 'ứng viên');
    const m = Object.fromEntries(r.data.map((u) => [u.ma, [u.ngay, u.nguon]]));
    assert.deepEqual(m, { 'NV-T150': ['2026-09-04', 'UOC_TINH'], 'NV-T151': ['2026-08-12', 'LICH_SU'], 'NV-T152': ['2026-09-04', 'UOC_TINH'],
      'NV-T155': ['2026-08-20', 'LICH_SU'] }, 'NV-T155: không trước ngày giao nhiệm vụ (lead time không âm)');
  });

  test('4. thực hiện: ngày + dấu, đúng hạn theo ngày mới, không đổi người / giờ cập nhật cuối', async () => {
    const truoc = await dong('NV-T150');
    const r = await db().rpc('kl_bo_sung_ngay_hoan_thanh', { p_thuc_hien: true, p_ids: ids() });
    assertOk(r, 'thực hiện');
    assert.deepEqual([r.data.ghi, r.data.loi, r.data.khong_con, r.data.thuc_hien], [4, 0, 0, true], JSON.stringify(r.data.mau_loi));
    const [a, b, c] = await Promise.all(['NV-T150', 'NV-T151', 'NV-T152'].map(dong));
    assert.deepEqual([a.ngay_hoan_thanh, a.ngay_hoan_thanh_bo_sung, a.ket_qua], ['2026-09-04', 'UOC_TINH', 'DUNG_HAN']);
    assert.deepEqual([b.ngay_hoan_thanh, b.ngay_hoan_thanh_bo_sung, b.ket_qua], ['2026-08-12', 'LICH_SU', 'TRE']);
    assert.deepEqual([c.ngay_hoan_thanh_bo_sung, c.ket_qua], ['UOC_TINH', 'KHONG_DANH_GIA']);
    assert.deepEqual(Object.values(await dong('NV-T155')).slice(0, 2), ['2026-08-20', 'LICH_SU'], 'không trước ngày giao nhiệm vụ');
    assert.deepEqual([a.cap_nhat_luc, a.cap_nhat_boi], [truoc.cap_nhat_luc, truoc.cap_nhat_boi], 'không đổi người / giờ cập nhật cuối');
    assert.equal((await dong('NV-T153')).ngay_hoan_thanh_bo_sung, null, 'việc đã có ngày không bị đụng');
    const ls = (await db().from('lich_su').select('cot, gia_tri_moi, nguoi_sua').eq('nhiem_vu_id', id['NV-T150']).eq('cot', 'ngay_hoan_thanh')).data;
    assert.deepEqual(ls, [{ cot: 'ngay_hoan_thanh', gia_tri_moi: '2026-09-04', nguoi_sua: null }], 'lịch sử ghi thay đổi, người sửa trống (hệ thống)');
    const lai = await db().rpc('kl_bo_sung_ngay_hoan_thanh', { p_thuc_hien: true, p_ids: ids() });
    assertOk(lai, 'gọi lại');
    assert.deepEqual([lai.data.tong, lai.data.ghi], [0, 0], 'gọi lại (mạng chập chờn) không ghi thêm');
  });

  test('5. sửa ngày hoàn thành thì bỏ dấu; dấu không ghi tay được', async () => {
    assertOk(await db().from('nhiem_vu').update({ ngay_hoan_thanh: '2026-09-01' }).eq('id', id['NV-T150']), 'sửa ngày');
    assert.deepEqual(Object.values(await dong('NV-T150')).slice(0, 2), ['2026-09-01', null]);
    assertOk(await db().from('nhiem_vu').update({ ngay_hoan_thanh_bo_sung: 'UOC_TINH' }).eq('id', id['NV-T153']), 'ghi tay dấu');
    assert.equal((await dong('NV-T153')).ngay_hoan_thanh_bo_sung, null, 'dấu ghi tay bị bỏ qua');
  });

  test('6. hoàn tác: việc còn dấu trở về chưa ghi ngày; việc đã sửa ngày giữ nguyên', async () => {
    const r = await db().rpc('kl_bo_sung_ngay_hoan_thanh_hoan_tac', { p_ids: ids() });
    assertOk(r, 'hoàn tác');
    assert.deepEqual([r.data.hoan_tac, r.data.loi], [3, 0], JSON.stringify(r.data.mau_loi));
    const [a, b, c, e] = await Promise.all(['NV-T150', 'NV-T151', 'NV-T152', 'NV-T155'].map(dong));
    assert.deepEqual([a.ngay_hoan_thanh, b.ngay_hoan_thanh, b.ngay_hoan_thanh_bo_sung, c.ngay_hoan_thanh, e.ngay_hoan_thanh], ['2026-09-01', null, null, null, null]);
  });
});
