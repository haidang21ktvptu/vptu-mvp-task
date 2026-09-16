// GĐ14 (0023/0024) — hàm trang_thai(): 4 mức cảnh báo (NT-5, CN-4, CH-10) + lead time (CN-2.1, DL-4) với ngày cố định, wrapper
// kl_trang_thai giữ 7 trường cũ; v_nhiem_vu tại hôm nay giờ Việt Nam (khung 17–24h UTC); bí danh kl_* cho frontend cũ đi qua
// RLS bảng gốc (đọc/ghi bằng tên cột cũ, cot trong lịch sử dịch ngược). Mã NV-T7x, nội dung 'KL-1400 …', tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, assertNoRows, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {};
const base = () => ({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'KL-1400 trạng thái', loai_thoi_han_ma: 'CO_HAN_CU_THE' });
const them = async (row) => { const r = await db().from('nhiem_vu').insert({ ...base(), ...row }).select('id, ma').single(); assertOk(r, row.ma); id[r.data.ma] = r.data.id; };
const tt = async (ma, ngay) => { const r = await db().rpc('tinh_trang_thai', { p_id: id[ma] || ma, p_ngay: ngay }); assertOk(r, `tinh_trang_thai ${ngay}`); return r.data; };
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

describe('0024 — trang_thai 4 mức, lead time, v_nhiem_vu, bí danh', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await db().from('nhiem_vu').delete().like('ma', 'NV-T7%');
    const homNay = homNayVN();
    await them({ ma: 'NV-T70', han_xu_ly: '2026-08-15' });                                            // mở, không minh chứng
    await them({ ma: 'NV-T71', han_xu_ly: '2026-08-15', minh_chung: 'Tờ trình 5/TTr-VPTU' });         // mở, đã có minh chứng
    await them({ ma: 'NV-T72', han_xu_ly: '2026-08-20', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-25', minh_chung: 'CV 1', ngay_nhan_van_ban: '2026-08-05' });
    await them({ ma: 'NV-T73', han_xu_ly: '2026-08-20', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-25', minh_chung: 'CV 2' }); // ngày nhận ước tính
    await them({ ma: 'NV-T74', han_xu_ly: homNay });                                                    // hạn hôm nay VN
    await them({ ma: 'NV-T75', han_xu_ly: congNgay(homNay, -1) });                                     // quá hạn 1 ngày VN
    await them({ ma: 'NV-T76', han_xu_ly: congNgay(homNay, -3) });                                     // quá hạn 3 ngày VN
  });
  after(async () => { await db().from('nhiem_vu').delete().like('ma', 'NV-T7%'); });

  test('1. XANH → VÀNG (còn ≤ 3, chưa minh chứng) → ĐỎ → ĐỎ ĐẶC BIỆT (quá ≥ 3) theo ngày cố định; có minh chứng thì không VÀNG', async () => {
    const m = async (ma, ngay) => (await tt(ma, ngay)).muc_canh_bao;
    assert.equal(await m('NV-T70', '2026-08-01'), 'XANH');            // DANG_THUC_HIEN
    assert.equal(await m('NV-T70', '2026-08-11'), 'XANH');            // SAP_DEN_HAN (còn 4) nhưng > 3
    assert.equal(await m('NV-T70', '2026-08-12'), 'VANG');            // còn 3
    assert.equal(await m('NV-T70', '2026-08-15'), 'VANG');            // còn 0
    assert.equal(await m('NV-T70', '2026-08-16'), 'DO');              // quá 1
    assert.equal(await m('NV-T70', '2026-08-17'), 'DO');              // quá 2
    assert.equal(await m('NV-T70', '2026-08-18'), 'DO_DAC_BIET');     // quá 3 = ngưỡng
    assert.equal(await m('NV-T71', '2026-08-14'), 'XANH', 'đã có minh chứng → không nhắc VÀNG');
    assert.equal(await m('NV-T71', '2026-08-16'), 'DO', 'quá hạn vẫn ĐỎ dù có minh chứng (chưa đóng)');
  });

  test('2. KHONG_AP_DUNG cho đã đóng / thường xuyên / chờ điều kiện / cần điền hạn; 7 trường đầu = kl_trang_thai (bộ số cũ)', async () => {
    for (const [ma, tt0] of [['NV-T72', 'HOAN_THANH'], [fx.n6, 'THUONG_XUYEN'], [fx.n5, 'CHO_DIEU_KIEN'], [fx.n4, 'CAN_DIEN_HAN']]) {
      const r = await tt(ma, '2026-09-14');
      assert.equal(r.trang_thai, tt0); assert.equal(r.muc_canh_bao, 'KHONG_AP_DUNG');
    }
    for (const nv of [fx.n1, fx.n2, fx.n7, id['NV-T72']]) {
      const moi = await tt(nv, '2026-09-14');
      const cu = await db().rpc('kl_tinh_trang_thai', { p_id: nv, p_ngay: '2026-09-14' });
      assertOk(cu, 'wrapper');
      const { muc_canh_bao, lead_time_ngay, ...bay } = moi;
      assert.deepEqual(cu.data, bay, 'wrapper kl_trang_thai = 7 trường đầu');
      assert.ok(typeof muc_canh_bao === 'string' && (lead_time_ngay === null || Number.isInteger(lead_time_ngay)));
    }
  });

  test('3. lead time = ngày hoàn thành − ngày nhận thật; ngày nhận ước tính → NULL; việc chưa đóng → NULL', async () => {
    assert.equal((await tt('NV-T72', '2026-09-14')).lead_time_ngay, 20);
    assert.equal((await tt('NV-T73', '2026-09-14')).lead_time_ngay, null);
    assert.equal((await tt('NV-T70', '2026-09-14')).lead_time_ngay, null);
    assertOk(await db().from('nhiem_vu').update({ ngay_nhan_van_ban: '2026-08-10' }).eq('ma', 'NV-T73').select('id'), 'điền ngày nhận thật');
    assert.equal((await tt('NV-T73', '2026-09-14')).lead_time_ngay, 15);
  });

  test('4. v_nhiem_vu tại hôm nay giờ Việt Nam: hạn hôm nay → VÀNG, quá 1 → ĐỎ, quá 3 → ĐỎ ĐẶC BIỆT (đúng cả khung 17–24h UTC)', async () => {
    const r = await db().from('v_nhiem_vu').select('ma, muc_canh_bao, so_ngay_qua, owner_don_vi_ten, nguoi_theo_doi_ten, san_pham_ten').like('ma', 'NV-T7%');
    assertOk(r, 'v_nhiem_vu');
    const m = Object.fromEntries(r.data.map((x) => [x.ma, x]));
    assert.equal(m['NV-T74'].muc_canh_bao, 'VANG'); assert.equal(m['NV-T75'].muc_canh_bao, 'DO'); assert.equal(m['NV-T75'].so_ngay_qua, 1);
    assert.equal(m['NV-T76'].muc_canh_bao, 'DO_DAC_BIET'); assert.equal(m['NV-T76'].so_ngay_qua, 3);
    assert.equal(m['NV-T70'].nguoi_theo_doi_ten, 'Demo Chuyên viên Một');
    assertDenied(await anonClient().from('v_nhiem_vu').select('ma'), 'anon v_nhiem_vu');
    const cv2 = await userClient('demo_cv2');
    assert.equal((await cv2.from('v_nhiem_vu').select('ma').like('ma', 'NV-T7%')).data.length, 0, 'A3 khác phòng không thấy (RLS qua view)');
  });

  test('5. bí danh kl_nhiem_vu/kl_hoi_nghi/kl_lich_su: tên cột cũ, RLS bảng gốc, ghi được, cot lịch sử dịch ngược; anon bị chặn', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('kl_nhiem_vu').select('ma, chu_tri_id, hoi_nghi_id, co_quan_trinh_ma, ghi_hoan_thanh_luc').eq('ma', 'NV-T70').single();
    assertOk(r, 'A3 đọc bí danh'); assert.equal(r.data.chu_tri_id, IDS.cv1); assert.equal(r.data.hoi_nghi_id, fx.hn);
    assert.equal((await cv1.from('kl_nhiem_vu').select('ma').eq('ma', 'NV-T04')).data.length, 0, 'A3 không thấy việc phòng khác qua bí danh');
    assertOk(await cv1.from('kl_nhiem_vu').update({ ghi_chu: 'qua bí danh' }).eq('ma', 'NV-T70').select('id'), 'A3 sửa ghi chú qua bí danh');
    assertNoRows(await (await userClient('demo_cv2')).from('kl_nhiem_vu').update({ ghi_chu: 'x' }).eq('ma', 'NV-T70').select('id'), 'A3 khác sửa');
    assertDenied(await anonClient().from('kl_nhiem_vu').select('ma'), 'anon kl_nhiem_vu');
    assertDenied(await anonClient().from('kl_hoi_nghi').select('id'), 'anon kl_hoi_nghi');
    const ins = await db().from('kl_nhiem_vu').insert({ ma: 'NV-T77', hoi_nghi_id: fx.hn, chu_tri_id: IDS.cv1, co_quan_trinh_ma: 'DANG_UY_UBND',
      noi_dung: 'KL-1400 qua bí danh', loai_thoi_han_ma: 'KY_BAN_HANH' }).select('id, ma, han_xu_ly').single();
    assertOk(ins, 'INSERT qua bí danh (mặc định + trigger chạy)'); assert.equal(ins.data.han_xu_ly, '2026-08-11'); id['NV-T77'] = ins.data.id;
    assertOk(await db().from('nhiem_vu').update({ nguoi_theo_doi: IDS.truongphong }).eq('ma', 'NV-T77').select('id'), 'đổi người theo dõi');
    const ls = await cv1.from('kl_lich_su').select('cot').eq('nhiem_vu_id', ins.data.id).eq('cot', 'chu_tri_id');
    assert.equal(ls.data?.length, 0, 'cv1 không còn thấy sau khi đổi người theo dõi');
    const ls2 = await db().from('kl_lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', ins.data.id).eq('cot', 'chu_tri_id');
    assert.equal(ls2.data.length, 1, 'lịch sử cot nguoi_theo_doi dịch ngược thành chu_tri_id'); assert.equal(ls2.data[0].gia_tri_moi, IDS.truongphong);
    const hn = await cv1.from('kl_hoi_nghi').select('so_hoi_nghi, loai').eq('id', fx.hn).single();
    assertOk(hn, 'A3 đọc bí danh hội nghị'); assert.equal(hn.data.loai, 'KL_BTV');
  });
});
