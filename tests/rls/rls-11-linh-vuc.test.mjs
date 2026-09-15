// RLS-11 (GĐ9 PR 9A, 0018–0019): phân công PCVP theo lĩnh vực — PCVP kiêm nhiệm chỉ thấy việc đúng (ngành, lĩnh vực)
// của phòng khác; PCVP phụ trách phòng mất việc đã bị kiêm nhiệm; việc lĩnh vực NULL vẫn thuộc PCVP phòng; A2 không đổi;
// hai EXCLUDE chặn chồng chéo; giới hạn 2 phòng "cả phòng"; danh mục dm_linh_vuc chỉ sửa qua hàm có nhật ký (0020); đính chính linh_vuc_ma; FK ghép.
// Fixture dùng chung với rls-10 (N1, N3, N4 = LV08_TAI_CHINH; N2 = LV08_DAU_TU; N5–N7 NULL). Mọi dòng phân công tạo ở đây
// có ly_do bắt đầu bằng "RLS-TEST LV" và được xoá bằng service_role ở cuối từng describe (rls-9 chạy sau cần seed sạch).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, anonClient, adminClient, assertDenied, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await linhVucReady()) ? false : 'Chưa có migration 0018–0019 trên project này (chạy lại sau khi merge).';
// Phần danh mục qua hàm + đính chính linh_vuc_ma cần 0020 (dm_lich_su): staging trước khi merge PR 9B tự bỏ qua.
const SKIP_0020 = SKIP || ((await adminClient().from('dm_lich_su').select('id').limit(1)).error ? 'Chưa có migration 0020 (dm_lich_su) trên project này.' : false);
const LY_DO = 'RLS-TEST LV';
const NGANH = 'KINH_TE_TONG_HOP';
const BAY_VIEC = ['NV-T01', 'NV-T02', 'NV-T03', 'NV-T04', 'NV-T05', 'NV-T06', 'NV-T07'];
let fx;
before(async () => { if (!SKIP) fx = await setupKlFixtures(); });
const donPhanCong = async () => { if (!SKIP) await adminClient().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`); };

async function maThay(username) {
  const c = await userClient(username);
  const r = await c.from('kl_nhiem_vu').select('ma').in('ma', BAY_VIEC).order('ma'); // chỉ 7 việc gốc (kl-trang-thai/rls-10 thêm dòng khác vào cùng fixture)
  assertOk(r, `${username} select`);
  return r.data.map((x) => x.ma);
}
const kiemNhiem = (qtht, username, phong, linhVuc, bat, tuNgay) => qtht.rpc('admin_kiem_nhiem_linh_vuc', {
  p_username: username, p_phong: phong, p_nganh_ma: NGANH, p_linh_vuc_ma: linhVuc, p_bat: bat, p_ly_do: LY_DO,
  ...(tuNgay ? { p_tu_ngay: tuNgay } : {}),
});

describe('RLS-11 phạm vi PCVP theo (ngành, lĩnh vực)', { skip: SKIP }, () => {
  after(donPhanCong);
  test('(a)(b)(c) pcvp2 kiêm nhiệm TONG_HOP/Tài chính: thấy N1, N3 (+N4 của mình); pcvp mất N1, N3 nhưng giữ N5 lĩnh vực NULL; A2, CVP không đổi', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_TAI_CHINH'], true, '2026-09-01'), 'kiêm nhiệm');
    assert.deepEqual(await maThay('demo_pcvp2'), ['NV-T01', 'NV-T03', 'NV-T04']);
    assert.deepEqual(await maThay('demo_pcvp'), ['NV-T02', 'NV-T05', 'NV-T06', 'NV-T07']);
    assert.equal((await maThay('demo_truongphong')).length, 6, 'A2 vẫn thấy cả phòng, kể cả lĩnh vực bị kiêm nhiệm');
    assert.equal((await maThay('demo_cvp')).length, 7);
    assert.equal((await maThay('demo_cv1')).length, 5);
    // Kiêm nhiệm không mở "cả phòng"; hội nghị thấy được vì có việc trong phạm vi; dashboard có tên lĩnh vực.
    const pcvp2 = await userClient('demo_pcvp2');
    assert.equal((await pcvp2.rpc('phu_trach', { p_lanh_dao: IDS.pcvp2, p_phong: 'TONG_HOP' })).data, false);
    const hn = await pcvp2.from('kl_hoi_nghi').select('id').eq('id', fx.hn);
    assertOk(hn, 'hội nghị'); assert.equal(hn.data.length, 1);
    const v = await pcvp2.from('v_kl_dashboard').select('ma, linh_vuc_ma, linh_vuc_ten').eq('ma', 'NV-T01').single();
    assertOk(v, 'dashboard'); assert.deepEqual(v.data, { ma: 'NV-T01', linh_vuc_ma: 'LV08_TAI_CHINH', linh_vuc_ten: 'Tài chính' });
    const log = await qtht.from('quyen_lich_su').select('co, bat').eq('tai_khoan', IDS.pcvp2).order('id');
    assert.deepEqual(log.data.slice(-1).map((l) => [l.co, l.bat]), [['kiem_nhiem:TONG_HOP:KINH_TE_TONG_HOP:LV08_TAI_CHINH', true]]);
  });
  test('(d) hai A1 kiêm nhiệm cùng (phòng, ngành, lĩnh vực) cùng kỳ: hàm báo tiếng Việt; ghi thẳng bị EXCLUDE 23P01; mảng có phần tử trùng → không ghi gì', async () => {
    const qtht = await userClient('demo_qtht');
    const r = await kiemNhiem(qtht, 'demo_pcvp', 'TONG_HOP', ['LV08_TAI_CHINH'], true, '2026-09-10');
    assert.match(r.error?.message || '', /đang do .* kiêm nhiệm/);
    const truc = await adminClient().from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp, phong: 'TONG_HOP', nganh_ma: NGANH, linh_vuc_ma: 'LV08_TAI_CHINH', tu_ngay: '2026-09-10', ly_do: `${LY_DO} exclude` }).select('id');
    assert.equal(truc.error?.code, '23P01', 'EXCLUDE kiem_nhiem_duy_nhat');
    const goi = await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_DAU_TU', 'LV08_TAI_CHINH'], true, '2026-09-10');
    assert.match(goi.error?.message || '', /trùng kỳ/);
    const { data: rows } = await adminClient().from('phu_trach_phong').select('id').eq('lanh_dao_id', IDS.pcvp2).eq('linh_vuc_ma', 'LV08_DAU_TU');
    assert.equal(rows.length, 0, 'một transaction: Đầu tư không được ghi khi Tài chính lỗi');
    assertOk(await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_DAU_TU'], true, '2026-09-10'), 'lĩnh vực khác cùng ngành');
    assert.deepEqual(await maThay('demo_pcvp2'), ['NV-T01', 'NV-T02', 'NV-T03', 'NV-T04']);
    assert.deepEqual(await maThay('demo_pcvp'), ['NV-T05', 'NV-T06', 'NV-T07']);
  });
  test('(f) kết thúc kiêm nhiệm (ngày mặc định = hôm nay giờ VN) → việc trở về PCVP phòng; dòng cũ đóng den_ngay, không xoá', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_TAI_CHINH', 'LV08_DAU_TU'], false), 'kết thúc');
    assert.deepEqual(await maThay('demo_pcvp2'), ['NV-T04']);
    assert.equal((await maThay('demo_pcvp')).length, 6);
    const homNay = (await qtht.rpc('kl_hom_nay')).data;
    const { data: rows } = await adminClient().from('phu_trach_phong').select('linh_vuc_ma, den_ngay').eq('lanh_dao_id', IDS.pcvp2).not('linh_vuc_ma', 'is', null).order('linh_vuc_ma');
    const truoc = new Date(`${homNay}T00:00:00Z`); truoc.setUTCDate(truoc.getUTCDate() - 1);
    assert.deepEqual(rows, [{ linh_vuc_ma: 'LV08_DAU_TU', den_ngay: truoc.toISOString().slice(0, 10) }, { linh_vuc_ma: 'LV08_TAI_CHINH', den_ngay: truoc.toISOString().slice(0, 10) }]);
  });
  test('hàm: thiếu lĩnh vực, lĩnh vực sai ngành, mảng rỗng, ngày mặc định = kl_hom_nay(); bật rồi tắt cùng ngày → xoá dòng', async () => {
    const qtht = await userClient('demo_qtht');
    assert.ok((await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO, p_nganh_ma: NGANH })).error, 'thiếu lĩnh vực');
    const sai = await qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_bat: true, p_ly_do: LY_DO, p_nganh_ma: 'NOI_CHINH', p_linh_vuc_ma: 'LV08_TAI_CHINH' });
    assert.match(sai.error?.message || '', /không thuộc ngành/);
    assert.ok((await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', [], true)).error, 'mảng rỗng');
    assertOk(await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_NGAN_SACH'], true), 'bật không truyền ngày');
    const homNay = (await qtht.rpc('kl_hom_nay')).data;
    const { data: r1 } = await adminClient().from('phu_trach_phong').select('tu_ngay').eq('lanh_dao_id', IDS.pcvp2).eq('linh_vuc_ma', 'LV08_NGAN_SACH');
    assert.deepEqual(r1, [{ tu_ngay: homNay }], 'mặc định p_tu_ngay theo giờ Việt Nam');
    assertOk(await kiemNhiem(qtht, 'demo_pcvp2', 'TONG_HOP', ['LV08_NGAN_SACH'], false), 'tắt cùng ngày');
    const { data: r2 } = await adminClient().from('phu_trach_phong').select('id').eq('lanh_dao_id', IDS.pcvp2).eq('linh_vuc_ma', 'LV08_NGAN_SACH');
    assert.equal(r2.length, 0, 'chưa từng hiệu lực → xoá');
  });
});

describe('RLS-11 giới hạn 2 phòng "cả phòng" mỗi PCVP', { skip: SKIP }, () => {
  after(donPhanCong);
  test('(e) pcvp (đang TONG_HOP) bật CDS_CY được; HC_LT bị chặn; kiêm nhiệm ở HC_LT không tính; kết thúc CDS_CY rồi bật HC_LT được', async () => {
    const qtht = await userClient('demo_qtht');
    const caPhong = (phong, bat, tuNgay) => qtht.rpc('admin_phan_cong_phong', { p_username: 'demo_pcvp', p_phong: phong, p_bat: bat, p_ly_do: LY_DO, p_tu_ngay: tuNgay });
    assertOk(await caPhong('CDS_CY', true, '2026-09-01'), 'phòng thứ 2');
    const ba = await caPhong('HC_LT', true, '2026-09-01');
    assert.match(ba.error?.message || '', /tối đa 2 phòng/);
    assertOk(await kiemNhiem(qtht, 'demo_pcvp', 'HC_LT', ['LV08_TAI_CHINH'], true, '2026-09-01'), 'kiêm nhiệm không tính vào giới hạn');
    assertOk(await caPhong('CDS_CY', false, '2026-09-03'), 'kết thúc phòng 2');
    assertOk(await caPhong('HC_LT', true, '2026-09-05'), 'sau khi kết thúc, bật phòng khác được');
    const { data: rows } = await adminClient().from('phu_trach_phong').select('phong, nganh_ma, den_ngay').eq('lanh_dao_id', IDS.pcvp).like('ly_do', `${LY_DO}%`).order('phong').order('nganh_ma', { nullsFirst: true });
    assert.deepEqual(rows, [{ phong: 'CDS_CY', nganh_ma: null, den_ngay: '2026-09-02' }, { phong: 'HC_LT', nganh_ma: null, den_ngay: null }, { phong: 'HC_LT', nganh_ma: NGANH, den_ngay: null }]);
  });
});

describe('RLS-11 danh mục dm_linh_vuc: chỉ qua hàm có nhật ký, đính chính linh_vuc_ma (0020)', { skip: SKIP_0020 }, () => {
  const LY = 'RLS-TEST LV danh mục';
  let maMoi = null;
  after(async () => {
    if (maMoi) await adminClient().from('dm_linh_vuc').delete().eq('ma', maMoi);
    await adminClient().from('dm_lich_su').delete().like('ly_do', `${LY}%`);
    await adminClient().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
  });
  test('ai đã đăng nhập đọc 32 lĩnh vực (ngành 8 có 4); anon bị chặn; ghi thẳng bị chặn với MỌI người kể cả quan_tri_kl', async () => {
    const cv1 = await userClient('demo_cv1');
    const all = await cv1.from('dm_linh_vuc').select('ma, nganh_ma');
    assertOk(all, 'đọc'); assert.equal(all.data.length, 32); assert.equal(all.data.filter((l) => l.nganh_ma === NGANH).length, 4);
    assertDenied(await anonClient().from('dm_linh_vuc').select('ma').limit(1), 'anon');
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY }), 'cấp');
    const row = { ma: 'LV08_RLS_TEST', nganh_ma: NGANH, ten: 'RLS-TEST lĩnh vực', thu_tu: 99 };
    for (const [u, c] of [['cv1', cv1], ['qtht', qtht], ['cv2 (quan_tri_kl)', await userClient('demo_cv2')]]) {
      assertDenied(await c.from('dm_linh_vuc').insert(row).select('ma'), `${u} insert thẳng`);
      assertDenied(await c.from('dm_linh_vuc').update({ ten: 'x' }).eq('ma', 'LV08_TAI_CHINH').select('ma'), `${u} update thẳng`);
      assertDenied(await c.from('dm_linh_vuc').delete().eq('ma', 'LV08_TAI_CHINH').select('ma'), `${u} delete`);
    }
  });
  test('admin_them_linh_vuc: A3/QTHT bị chặn; quan_tri_kl thêm → mã LV08_… sinh ở server, thu_tu cuối ngành, dm_lich_su ghi "them"', async () => {
    const cv1 = await userClient('demo_cv1'); const qtht = await userClient('demo_qtht'); const cv2 = await userClient('demo_cv2');
    assertDenied(await cv1.rpc('admin_them_linh_vuc', { p_nganh_ma: NGANH, p_ten: 'RLS-TEST Tài chính công', p_ly_do: LY }), 'A3');
    assertDenied(await qtht.rpc('admin_them_linh_vuc', { p_nganh_ma: NGANH, p_ten: 'RLS-TEST Tài chính công', p_ly_do: LY }), 'QTHT không có quan_tri_kl');
    assert.ok((await cv2.rpc('admin_them_linh_vuc', { p_nganh_ma: NGANH, p_ten: 'RLS-TEST Tài chính công', p_ly_do: ' ' })).error, 'thiếu lý do');
    assert.ok((await cv2.rpc('admin_them_linh_vuc', { p_nganh_ma: 'KHONG_CO', p_ten: 'x', p_ly_do: LY })).error, 'ngành lạ');
    assert.ok((await cv2.rpc('admin_them_linh_vuc', { p_nganh_ma: NGANH, p_ten: 'tài chính', p_ly_do: LY })).error, 'trùng tên (không phân biệt hoa thường)');
    const r = await cv2.rpc('admin_them_linh_vuc', { p_nganh_ma: NGANH, p_ten: ' RLS-TEST Tài chính công – Đầu tư ', p_ly_do: LY });
    assertOk(r, 'thêm'); maMoi = r.data; assert.equal(maMoi, 'LV08_RLS_TEST_TAI_CHINH_CONG_DAU_TU');
    const { data: lv } = await adminClient().from('dm_linh_vuc').select('nganh_ma, ten, thu_tu').eq('ma', maMoi).single();
    assert.deepEqual(lv, { nganh_ma: NGANH, ten: 'RLS-TEST Tài chính công – Đầu tư', thu_tu: 5 });
    const { data: ls } = await cv2.from('dm_lich_su').select('nguoi, nguoi_ghi_chu, bang, ma, hanh_dong, gia_tri_cu, ly_do').eq('ma', maMoi);
    assert.deepEqual(ls, [{ nguoi: IDS.cv2, nguoi_ghi_chu: null, bang: 'dm_linh_vuc', ma: maMoi, hanh_dong: 'them', gia_tri_cu: null, ly_do: LY }]);
  });
  test('admin_sua_linh_vuc: đổi tên/thứ tự ghi cột đổi; không đổi gì → lỗi; dm_lich_su chỉ quan_tri_kl/QTHT đọc, không ghi thẳng', async () => {
    const cv2 = await userClient('demo_cv2');
    assert.ok((await cv2.rpc('admin_sua_linh_vuc', { p_ma: maMoi, p_ten: 'RLS-TEST Tài chính công – Đầu tư', p_thu_tu: 5, p_ly_do: LY })).error, 'không đổi gì');
    assertOk(await cv2.rpc('admin_sua_linh_vuc', { p_ma: maMoi, p_ten: 'RLS-TEST Tài chính công (sửa)', p_thu_tu: 9, p_ly_do: `${LY} sửa` }), 'sửa');
    const { data: lv } = await adminClient().from('dm_linh_vuc').select('ten, thu_tu').eq('ma', maMoi).single();
    assert.deepEqual(lv, { ten: 'RLS-TEST Tài chính công (sửa)', thu_tu: 9 });
    const { data: ls } = await cv2.from('dm_lich_su').select('hanh_dong, gia_tri_cu, gia_tri_moi').eq('ma', maMoi).eq('hanh_dong', 'sua');
    assert.deepEqual(ls, [{ hanh_dong: 'sua', gia_tri_cu: { ten: 'RLS-TEST Tài chính công – Đầu tư', thu_tu: 5 }, gia_tri_moi: { ten: 'RLS-TEST Tài chính công (sửa)', thu_tu: 9 } }]);
    const cv1 = await userClient('demo_cv1'); const qtht = await userClient('demo_qtht');
    const r0 = await cv1.from('dm_lich_su').select('id'); assertOk(r0, 'cv1 đọc'); assert.equal(r0.data.length, 0);
    const r1 = await qtht.from('dm_lich_su').select('id').eq('ma', maMoi); assertOk(r1, 'QTHT đọc'); assert.equal(r1.data.length, 2);
    assertDenied(await cv2.from('dm_lich_su').insert({ bang: 'dm_linh_vuc', ma: maMoi, hanh_dong: 'them', ly_do: 'giả' }).select('id'), 'insert thẳng');
    assertDenied(await cv2.from('dm_lich_su').delete().eq('ma', maMoi).select('id'), 'delete');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: false, p_ly_do: LY }), 'thu');
    assertDenied(await cv2.rpc('admin_sua_linh_vuc', { p_ma: maMoi, p_ten: 'x', p_thu_tu: 9, p_ly_do: LY }), 'sau khi thu cờ');
  });
  test('đính chính linh_vuc_ma (0020): chủ trì đề nghị → quan_tri_kl duyệt → cột đổi, lịch sử nguon dinh_chinh; sai ngành → duyệt bị FK chặn, đề nghị vẫn CHO_DUYET', async () => {
    const cv1 = await userClient('demo_cv1'); const qtht = await userClient('demo_qtht'); const cv2 = await userClient('demo_cv2');
    const dn = await cv1.rpc('kl_de_nghi_dinh_chinh', { p_nhiem_vu: fx.n5, p_cot: 'linh_vuc_ma', p_gia_tri_moi: 'LV08_TAI_CHINH', p_ly_do: 'RLS-TEST gán lĩnh vực' });
    assertOk(dn, 'đề nghị'); assert.ok(dn.data);
    const sai = await cv1.rpc('kl_de_nghi_dinh_chinh', { p_nhiem_vu: fx.n6, p_cot: 'linh_vuc_ma', p_gia_tri_moi: 'LV03_TU_PHAP', p_ly_do: 'RLS-TEST sai ngành' });
    assertOk(sai, 'đề nghị sai ngành vẫn ghi nhận (kiểm khi duyệt)');
    assertOk(await qtht.rpc('admin_dat_co', { p_username: 'demo_cv2', p_co: 'quan_tri_kl', p_bat: true, p_ly_do: LY }), 'cấp');
    assertOk(await cv2.rpc('kl_duyet_dinh_chinh', { p_id: dn.data, p_chap_nhan: true }), 'duyệt');
    const { data: n5 } = await adminClient().from('kl_nhiem_vu').select('linh_vuc_ma').eq('id', fx.n5).single();
    assert.equal(n5.linh_vuc_ma, 'LV08_TAI_CHINH');
    const { data: ls } = await adminClient().from('kl_lich_su').select('cot, gia_tri_moi, nguon').eq('nhiem_vu_id', fx.n5).eq('nguon', 'dinh_chinh');
    assert.deepEqual(ls, [{ cot: 'linh_vuc_ma', gia_tri_moi: 'LV08_TAI_CHINH', nguon: 'dinh_chinh' }]);
    const r = await cv2.rpc('kl_duyet_dinh_chinh', { p_id: sai.data, p_chap_nhan: true });
    assert.equal(r.error?.code, '23503', 'FK ghép chặn lĩnh vực sai ngành');
    const { data: dc } = await adminClient().from('kl_dinh_chinh').select('trang_thai').eq('id', sai.data).single();
    assert.equal(dc.trang_thai, 'CHO_DUYET');
    const { data: n6 } = await adminClient().from('kl_nhiem_vu').select('linh_vuc_ma').eq('id', fx.n6).single();
    assert.equal(n6.linh_vuc_ma, null);
    assertOk(await cv2.rpc('kl_duyet_dinh_chinh', { p_id: sai.data, p_chap_nhan: false, p_ly_do: 'RLS-TEST bác' }), 'bác bỏ để dọn');
  });
});

describe('RLS-11 FK ghép lĩnh vực ↔ ngành (0018)', { skip: SKIP }, () => {
  test('FK ghép: lĩnh vực không thuộc ngành của dòng bị chặn (23503); có lĩnh vực mà bỏ ngành bị chặn (23514) — kể cả service_role', async () => {
    const db = adminClient();
    const r1 = await db.from('kl_nhiem_vu').update({ linh_vuc_ma: 'LV03_TU_PHAP' }).eq('id', fx.n7).select('id');
    assert.equal(r1.error?.code, '23503');
    const r2 = await db.from('kl_nhiem_vu').update({ nganh_ma: null }).eq('id', fx.n1).select('id');
    assert.equal(r2.error?.code, '23514');
    const r3 = await db.from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', nganh_ma: NGANH, linh_vuc_ma: 'LV03_TU_PHAP', ly_do: `${LY_DO} fk` }).select('id');
    assert.equal(r3.error?.code, '23503');
    const r4 = await db.from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', nganh_ma: NGANH, ly_do: `${LY_DO} check` }).select('id');
    assert.equal(r4.error?.code, '23514');
  });
});
