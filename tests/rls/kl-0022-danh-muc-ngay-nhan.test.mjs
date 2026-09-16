// GĐ14 (0022) — danh mục mới, tham số, cột văn bản/nhiệm vụ và quy tắc NGÀY NHẬN (CN-1.1, CH-9). Mỗi CHECK/trigger một case
// bị chặn + một case được phép. Dòng thử mang mã NV-T5x, nội dung 'KL-1400 …' (không mang RLS-TEST để rls-10 đếm không đổi),
// tự dọn ở after; văn bản 997 (có ngày nhận thật) tự tạo/tự xoá. Test 8 là bất biến của bước điền dữ liệu cũ (mọi dòng excel).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; let hn997;
const base = () => ({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'KL-1400 ngày nhận', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31' });
const them = (row) => db().from('nhiem_vu').insert({ ...base(), ...row }).select('id, ma, ngay_nhan_van_ban, ngay_nhan_uoc_tinh, theo_1400').single();
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

describe('0022 — danh mục, tham số và ngày nhận văn bản', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await db().from('nhiem_vu').delete().like('ma', 'NV-T5%');
    await db().from('van_ban_giao_viec').delete().eq('so_hoi_nghi', 997);
  });
  after(async () => {
    await db().from('nhiem_vu').delete().like('ma', 'NV-T5%');
    await db().from('van_ban_giao_viec').delete().eq('so_hoi_nghi', 997);
  });

  test('1. dm_don_vi: 13 dòng cũ giữ nguyên + 3 cột mới; chỉ Văn phòng Tỉnh ủy trong_van_phong, chưa dòng phòng nào (14C)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('dm_don_vi').select('ma, trong_van_phong, phong, lanh_dao_phu_trach').order('thu_tu');
    assertOk(r, 'A3 đọc dm_don_vi');
    assert.equal(r.data.length, 13);
    assert.deepEqual(r.data.filter((d) => d.trong_van_phong).map((d) => d.ma), ['VAN_PHONG_TINH_UY']);
    assert.ok(r.data.every((d) => d.phong === null && d.lanh_dao_phu_trach === null));
    const cu = await cv1.from('dm_co_quan_trinh').select('ma, ten, thu_tu');   // bí danh cho frontend cũ
    assertOk(cu, 'bí danh dm_co_quan_trinh'); assert.equal(cu.data.length, 13);
    // CHECK: phong chỉ khi trong_van_phong.
    assert.ok((await db().from('dm_don_vi').update({ phong: 'TONG_HOP' }).eq('ma', 'BAN_TO_CHUC').select('ma')).error, 'phong trên đơn vị ngoài bị chặn');
  });

  test('2. dm_san_pham 7 loại, dm_cap 6 cấp: đã đăng nhập đọc được; anon và ghi bị chặn; FK trên nhiệm vụ', async () => {
    const cv1 = await userClient('demo_cv1');
    assert.equal((await cv1.from('dm_san_pham').select('ma')).data.length, 7);
    assert.equal((await cv1.from('dm_cap').select('ma')).data.length, 6);
    assertDenied(await anonClient().from('dm_san_pham').select('ma'), 'anon dm_san_pham');
    assertDenied(await anonClient().from('dm_cap').select('ma'), 'anon dm_cap');
    assertDenied(await cv1.from('dm_san_pham').insert({ ma: 'X', ten: 'X', thu_tu: 9 }).select('ma'), 'A3 thêm sản phẩm');
    assert.equal((await them({ ma: 'NV-T50', san_pham_loai: 'KHONG_CO' })).error?.code, '23503', 'sản phẩm ngoài danh mục');
    assert.equal((await them({ ma: 'NV-T50', cap_nhan_san_pham: 'KHONG_CO' })).error?.code, '23503', 'cấp ngoài danh mục');
    const ok = await them({ ma: 'NV-T50', san_pham_loai: 'TO_TRINH', san_pham_mo_ta: 'Tờ trình thử', cap_nhan_san_pham: 'THUONG_TRUC', cap_quyet_dinh: 'CHANH_VAN_PHONG' });
    assertOk(ok, 'đủ sản phẩm + cấp'); assert.equal(ok.data.theo_1400, false, 'mặc định chưa theo 1400');
  });

  test('3. dm_loai_thoi_han.cho_phep_tao_moi đúng 2 loại; kl_cau_hinh có 3 khoá mới (3/3/30) và 4 khoá cũ', async () => {
    const cv1 = await userClient('demo_cv1');
    const lt = await cv1.from('dm_loai_thoi_han').select('ma, cho_phep_tao_moi');
    assert.deepEqual(lt.data.filter((x) => x.cho_phep_tao_moi).map((x) => x.ma).sort(), ['CO_HAN_CU_THE', 'KY_BAN_HANH']);
    const ch = await cv1.from('kl_cau_hinh').select('khoa, gia_tri');
    const m = Object.fromEntries(ch.data.map((x) => [x.khoa, x.gia_tri]));
    assert.equal(m.nguong_vang_ngay, '3'); assert.equal(m.nguong_do_dac_biet_ngay, '3'); assert.equal(m.ngay_ra_soat_toi_da, '30');
    assert.equal(m.nguong_sap_den_han_ngay, '7'); assert.equal(Object.keys(m).length, 7);
  });

  test('4. văn bản: loai mặc định KL_BTV, loai lạ bị chặn; ngày nhận < ngày ban hành hoặc > hôm nay bị chặn; hợp lệ được', async () => {
    const vb = { so_hoi_nghi: 997, so_ket_luan: 'KL-1400', ngay_ban_hanh: '2026-08-01' };
    assert.ok((await db().from('van_ban_giao_viec').insert({ ...vb, loai: 'LA' }).select('id')).error, 'loai ngoài danh sách');
    assert.match((await db().from('van_ban_giao_viec').insert({ ...vb, ngay_nhan: '2026-07-31' }).select('id')).error?.message || '', /Ngày nhận văn bản/);
    assert.match((await db().from('van_ban_giao_viec').insert({ ...vb, ngay_nhan: congNgay(homNayVN(), 1) }).select('id')).error?.message || '', /Ngày nhận văn bản/);
    const ok = await db().from('van_ban_giao_viec').insert({ ...vb, ngay_nhan: '2026-08-05', co_quan_ban_hanh: 'Ban Thường vụ Tỉnh ủy' }).select('id, loai').single();
    assertOk(ok, 'văn bản có ngày nhận'); assert.equal(ok.data.loai, 'KL_BTV'); hn997 = ok.data.id;
  });

  test('5. nhiệm vụ thiếu ngày nhận: = ngày nhận của văn bản (cờ false) hoặc = ngày ban hành (cờ true)', async () => {
    const a = await them({ ma: 'NV-T51' });
    assertOk(a, 'văn bản 999 không có ngày nhận'); assert.equal(a.data.ngay_nhan_van_ban, '2026-08-01'); assert.equal(a.data.ngay_nhan_uoc_tinh, true);
    const b = await them({ ma: 'NV-T52', van_ban_id: hn997 });
    assertOk(b, 'văn bản 997 có ngày nhận'); assert.equal(b.data.ngay_nhan_van_ban, '2026-08-05'); assert.equal(b.data.ngay_nhan_uoc_tinh, false);
  });

  test('6. ngày nhận nhập tay: trước ngày ban hành bị chặn; sau hôm nay bị chặn; = hôm nay giờ Việt Nam được nhận ở mọi giờ chạy', async () => {
    assert.match((await them({ ma: 'NV-T53', ngay_nhan_van_ban: '2026-07-31' })).error?.message || '', /Ngày nhận văn bản/);
    const homNay = (await db().rpc('kl_hom_nay')).data;
    assert.equal(homNay, homNayVN(), 'kl_hom_nay() phải là ngày theo giờ Việt Nam (lệch UTC ở khung 17–24h)');
    assert.match((await them({ ma: 'NV-T53', ngay_nhan_van_ban: congNgay(homNay, 1) })).error?.message || '', /Ngày nhận văn bản/);
    const ok = await them({ ma: 'NV-T53', ngay_nhan_van_ban: homNay });
    assertOk(ok, 'ngày nhận = hôm nay VN'); assert.equal(ok.data.ngay_nhan_uoc_tinh, false);
  });

  test('7. sửa tay ngày nhận → cờ ước tính tự tắt; người theo dõi A3 chưa được sửa cột mới (guard 0015, để 14C)', async () => {
    const r = await db().from('nhiem_vu').update({ ngay_nhan_van_ban: '2026-08-03' }).eq('ma', 'NV-T51').select('ngay_nhan_uoc_tinh').single();
    assertOk(r, 'admin sửa ngày nhận'); assert.equal(r.data.ngay_nhan_uoc_tinh, false);
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('nhiem_vu').update({ ngay_nhan_van_ban: '2026-08-04' }).eq('ma', 'NV-T51').select('id'), 'A3 sửa ngày nhận');
    assertDenied(await cv1.from('nhiem_vu').update({ san_pham_mo_ta: 'x' }).eq('ma', 'NV-T51').select('id'), 'A3 sửa sản phẩm');
  });

  test('8. bất biến dữ liệu cũ: mọi dòng excel có ngày nhận = ngày ban hành, cờ ước tính, theo_1400 = false, không dòng lịch sử cột mới', async () => {
    const r = await db().from('nhiem_vu').select('ma, ngay_nhan_van_ban, ngay_nhan_uoc_tinh, theo_1400, van_ban_giao_viec(ngay_ban_hanh)').eq('nguon', 'excel');
    assertOk(r, 'đọc dòng excel');
    for (const n of r.data) {
      assert.equal(n.ngay_nhan_van_ban, n.van_ban_giao_viec.ngay_ban_hanh, `${n.ma} ngày nhận ≠ ngày ban hành`);
      assert.equal(n.ngay_nhan_uoc_tinh, true, `${n.ma} phải là ước tính`); assert.equal(n.theo_1400, false, `${n.ma} không theo 1400`);
    }
    const excel = (await db().from('nhiem_vu').select('id').eq('nguon', 'excel')).data.map((x) => x.id);
    const ls = await db().from('lich_su').select('id', { count: 'exact', head: true })
      .in('cot', ['ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh', 'theo_1400']).in('nhiem_vu_id', excel);
    assert.equal(ls.count, 0, 'bước điền dữ liệu cũ không được sinh lịch sử');
  });

  test('9. đổi ngày ban hành/ngày nhận của văn bản → ngày nhận ƯỚC TÍNH của nhiệm vụ tính lại (vẫn là ước tính); ngày nhận thật giữ nguyên', async () => {
    const doc = async (ma) => (await db().from('nhiem_vu').select('ngay_nhan_van_ban, ngay_nhan_uoc_tinh').eq('ma', ma).single()).data;
    assertOk(await them({ ma: 'NV-T54', van_ban_id: hn997 }), 'ước tính theo văn bản 997');       // 997 có ngày nhận 05/08 → thật
    assertOk(await db().from('van_ban_giao_viec').update({ ngay_nhan: null }).eq('id', hn997).select('id'), 'bỏ ngày nhận văn bản');
    assert.deepEqual(await doc('NV-T54'), { ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false }, 'ngày nhận thật không đổi');
    assertOk(await db().from('van_ban_giao_viec').update({ ngay_ban_hanh: '2026-08-03' }).eq('id', hn997).select('id'), 'đổi ngày ban hành');
    assert.deepEqual(await doc('NV-T52'), { ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false });
    assertOk(await them({ ma: 'NV-T55', van_ban_id: hn997 }), 'không ngày nhận → ước tính = 03/08');
    assert.deepEqual(await doc('NV-T55'), { ngay_nhan_van_ban: '2026-08-03', ngay_nhan_uoc_tinh: true });
    assertOk(await db().from('van_ban_giao_viec').update({ ngay_nhan: '2026-08-04' }).eq('id', hn997).select('id'), 'thêm ngày nhận văn bản');
    assert.deepEqual(await doc('NV-T55'), { ngay_nhan_van_ban: '2026-08-04', ngay_nhan_uoc_tinh: false }, 'ước tính → lấy ngày nhận thật của văn bản');
  });
});
