// GĐ10 (PR 10A, 0021): chuyển sang Hoàn thành bắt buộc minh chứng + ngày hoàn thành thật; dữ liệu cũ đã Hoàn thành
// mà thiếu (78 dòng Excel) không bị chặn ngược, chỉ không được xoá minh chứng; script nhập (INSERT nguon = excel)
// vẫn nhập nguyên trạng; đường đính chính đi qua cùng trigger. Dòng thử tạo riêng (tiền tố KL-MC, hội nghị 999 của
// fixture) và tự xoá ở cuối để kl-moc (đếm nguon = excel) và rls-10 (đếm RLS-TEST) không đổi.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, adminClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const MA = ['NV-T21', 'NV-T22', 'NV-T23', 'NV-T24'];
const LY_DO = 'RLS-TEST MC';
let fx; let id = {};

// 0021 chỉ đổi thân hàm trigger, không có bảng mới để dò → thử INSERT nguon = app Hoàn thành thiếu minh chứng bằng
// service_role: bị chặn = đã có 0021; được ghi = staging trước khi merge → xoá dòng thử và bỏ qua cả file.
async function coMigration0021() {
  if (!(await klSchemaReady())) return false;
  const db = adminClient();
  const { data: hn } = await db.from('van_ban_giao_viec').select('id').order('ngay_ban_hanh').limit(1).maybeSingle();
  if (!hn) return false;
  const r = await db.from('nhiem_vu').insert({ van_ban_id: hn.id, nguoi_theo_doi: IDS.cv1, ma: 'NV-T29', noi_dung: 'KL-MC dò 0021',
    loai_thoi_han_ma: 'CHO_QUYET_DINH', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01' }).select('id');
  if (r.error) return /phải có minh chứng/.test(r.error.message);
  await db.from('nhiem_vu').delete().in('id', r.data.map((x) => x.id));
  return false;
}
const SKIP = (await coMigration0021()) ? false : 'Chưa có migration 0021 (hoặc 0014–0016) trên project này (chạy lại sau khi merge).';

const capNhat = async (username, ma, patch) => (await userClient(username)).from('nhiem_vu').update(patch).eq('id', id[ma]).select('tien_do_ma, thieu_minh_chung, dong_luc');

describe('0021 — Hoàn thành bắt buộc minh chứng và ngày hoàn thành', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    const db = adminClient();
    await db.from('nhiem_vu').delete().in('ma', MA);
    const base = { van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-10-31' };
    const r = await db.from('nhiem_vu').insert([
      { ...base, ma: 'NV-T21', noi_dung: 'KL-MC M1 đang làm, sẽ hoàn thành' },
      { ...base, ma: 'NV-T22', noi_dung: 'KL-MC M2 Excel hoàn thành thiếu minh chứng', tien_do_ma: 'HOAN_THANH', nguon: 'excel' },
      { ...base, ma: 'NV-T23', noi_dung: 'KL-MC M3 app hoàn thành đủ', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01', minh_chung: 'CV 13' },
      { ...base, ma: 'NV-T24', noi_dung: 'KL-MC M4 đang làm, cho đính chính' },
    ], { defaultToNull: false }).select('id, ma');
    assertOk(r, 'tạo dòng thử');
    id = Object.fromEntries(r.data.map((x) => [x.ma, x.id]));
  });
  after(async () => {
    await adminClient().from('nhiem_vu').delete().in('ma', MA);
    await adminClient().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
  });
  test('1–2. chủ trì chuyển sang Hoàn thành thiếu minh chứng, hoặc thiếu ngày → chặn, thông báo tiếng Việt', async () => {
    const r1 = await capNhat('demo_cv1', 'NV-T21', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-10' });
    assert.match(r1.error?.message || '', /phải có minh chứng/);
    const r2 = await capNhat('demo_cv1', 'NV-T21', { tien_do_ma: 'HOAN_THANH', minh_chung: 'CV 11' });
    assert.match(r2.error?.message || '', /ngày hoàn thành thật/);
    const r3 = await capNhat('demo_cv1', 'NV-T21', { tien_do_ma: 'HOAN_THANH', minh_chung: '   ', ngay_hoan_thanh: '2026-09-10' });
    assert.match(r3.error?.message || '', /phải có minh chứng/, 'chuỗi trắng = trống');
  });
  test('3. đủ minh chứng + ngày → Hoàn thành; ghi lúc chuyển; lịch sử ghi ba cột với người sửa = chủ trì', async () => {
    const r = await capNhat('demo_cv1', 'NV-T21', { tien_do_ma: 'HOAN_THANH', minh_chung: 'CV 11', ngay_hoan_thanh: '2026-09-10' });
    assertOk(r, 'hoàn thành đủ');
    assert.equal(r.data[0].thieu_minh_chung, false); assert.ok(r.data[0].dong_luc);
    const { data: ls } = await adminClient().from('lich_su').select('cot, nguoi_sua, nguon').eq('nhiem_vu_id', id['NV-T21']).neq('cot', '*').order('cot');
    assert.deepEqual(ls.map((l) => [l.cot, l.nguoi_sua, l.nguon]),
      [['minh_chung', IDS.cv1, 'app'], ['ngay_hoan_thanh', IDS.cv1, 'app'], ['tien_do_ma', IDS.cv1, 'app']]);
  });
  test('4–5. dữ liệu cũ đã Hoàn thành thiếu minh chứng: sửa ghi chú vẫn được (không chặn ngược); bổ sung minh chứng, ngày → được', async () => {
    const r = await capNhat('demo_cv1', 'NV-T22', { ghi_chu: 'KL-MC ghi chú' });
    assertOk(r, 'sửa ghi chú dòng cũ'); assert.deepEqual([r.data[0].tien_do_ma, r.data[0].thieu_minh_chung], ['HOAN_THANH', true]);
    const r2 = await capNhat('demo_cv1', 'NV-T22', { minh_chung: 'CV 12 bổ sung' });
    assertOk(r2, 'bổ sung minh chứng'); assert.equal(r2.data[0].thieu_minh_chung, false);
    assertOk(await capNhat('demo_cv1', 'NV-T22', { ngay_hoan_thanh: '2026-08-20' }), 'bổ sung ngày hoàn thành');
  });
  test('6. xoá minh chứng của dòng đang Hoàn thành (kể cả dòng vừa được bổ sung) → chặn', async () => {
    assert.match((await capNhat('demo_cv1', 'NV-T23', { minh_chung: '' })).error?.message || '', /phải có minh chứng/);
    assert.match((await capNhat('demo_cv1', 'NV-T23', { minh_chung: null })).error?.message || '', /phải có minh chứng/);
    assert.match((await capNhat('demo_cv1', 'NV-T22', { minh_chung: null })).error?.message || '', /phải có minh chứng/, 'dòng cũ đã có minh chứng thì không xoá được nữa');
  });
  test('7–8. INSERT: nguon = app Hoàn thành thiếu minh chứng → chặn (kể cả service_role); nguon = excel → nhập nguyên trạng, cờ thieu_minh_chung', async () => {
    const db = adminClient();
    const base = { van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, loai_thoi_han_ma: 'CHO_QUYET_DINH', tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01' };
    const app = await db.from('nhiem_vu').insert({ ...base, ma: 'NV-T25', noi_dung: 'KL-MC app thiếu' }).select('id');
    assert.match(app.error?.message || '', /phải có minh chứng/);
    const xl = await db.from('nhiem_vu').insert({ ...base, ma: 'NV-T25', noi_dung: 'KL-MC excel thiếu', nguon: 'excel', ngay_hoan_thanh: null }).select('id, thieu_minh_chung');
    assertOk(xl, 'excel nhập nguyên trạng'); assert.equal(xl.data[0].thieu_minh_chung, true);
    await db.from('nhiem_vu').delete().eq('id', xl.data[0].id);
  });
  test('9. đính chính tien_do_ma → Hoàn thành trên dòng không minh chứng: duyệt bị chặn tại trigger, đề nghị vẫn chờ duyệt', async () => {
    const cv1 = await userClient('demo_cv1');
    const dn = await cv1.rpc('kl_de_nghi_dinh_chinh', { p_nhiem_vu: id['NV-T24'], p_cot: 'tien_do_ma', p_gia_tri_moi: 'HOAN_THANH', p_ly_do: `${LY_DO} sửa tiến độ` });
    assertOk(dn, 'đề nghị');
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY_DO }), 'cấp quan_tri_kl tạm');
    const cv2 = await userClient('demo_cv2');
    assert.match((await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: true })).error?.message || '', /phải có minh chứng/);
    const { data } = await adminClient().from('dinh_chinh').select('trang_thai').eq('id', dn.data).single();
    assert.equal(data.trang_thai, 'CHO_DUYET');
    assertOk(await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: false, p_ly_do: `${LY_DO} cần minh chứng trước` }), 'bác bỏ để dọn');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: false, p_ly_do: LY_DO }), 'thu');
  });
  test('10. múi giờ: ngày hoàn thành = kl_hom_nay() (giờ Việt Nam) được nhận ở mọi giờ chạy; hôm nay + 1 bị chặn', async () => {
    const cv1 = await userClient('demo_cv1');
    const homNay = (await cv1.rpc('kl_hom_nay')).data;
    const mai = new Date(`${homNay}T00:00:00Z`); mai.setUTCDate(mai.getUTCDate() + 1);
    const r1 = await capNhat('demo_cv1', 'NV-T24', { tien_do_ma: 'HOAN_THANH', minh_chung: 'CV 14', ngay_hoan_thanh: mai.toISOString().slice(0, 10) });
    assert.match(r1.error?.message || '', /tới hôm nay/);
    const r2 = await capNhat('demo_cv1', 'NV-T24', { tien_do_ma: 'HOAN_THANH', minh_chung: 'CV 14', ngay_hoan_thanh: homNay });
    assertOk(r2, 'ngày hoàn thành = hôm nay giờ VN'); assert.equal(r2.data[0].tien_do_ma, 'HOAN_THANH');
  });
});
