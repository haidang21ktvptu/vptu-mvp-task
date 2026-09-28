// PQ-4 — ca biên E1 (Owner là đơn vị ngoài Văn phòng, owner_tai_khoan NULL) và Owner là phòng (không tài khoản): chỉ NGƯỜI THEO DÕI
// xác nhận nhận việc (A3 hoặc A2 tuỳ ai được ghi theo dõi); A3 khác, A2 không theo dõi, CVP, PCVP (kể cả phụ trách phòng), A0, thư ký TT,
// quan_tri_kl, quan_tri_he_thong, anon → 42501. QTHT (không quan_tri_kl) gọi hàm nghiệp vụ (chi_dao_gui, dat_cap_quyet_dinh, chi_dao_dong,
// van_ban_dat_trich_yeu, xac_nhan_nhan_viec) → 42501; quan_tri_kl A3 gọi xac_nhan_nhan_viec / chi_dao_gui trên việc người khác → 42501.
// B5/B6 (minh chứng, đóng) KHÔNG kiểm ở đây (logic sẽ đổi ở PR sau). Khoá dữ liệu: "KL-PQ4"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ4';
const TK = { username: 'demo_e2e_tk', id: '00000000-0000-4000-8000-000000000018' }; // A3 Tổng hợp, cấp cờ thư ký lúc chạy
let fx; const id = {}; let vbCvp; let vbNull;
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const nhan = (u, ma) => rpc(u, 'xac_nhan_nhan_viec', { p_id: id[ma] });
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, tao_boi: IDS.cvp, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const khoiPhucTaiKhoan = async () => {
  await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK.id);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await khoiPhucTaiKhoan();
};

describe('PQ-4 — Owner là đơn vị / phòng: chỉ người theo dõi nhận việc; QTHT và quan_tri_kl không có quyền nghiệp vụ trên việc người khác', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    const vb = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} văn bản của CVP`, ngay_ban_hanh: '2026-09-01', tao_boi: IDS.cvp }).select('id').single();
    assertOk(vb, 'văn bản mẫu'); vbCvp = vb.data.id;
    // Văn bản riêng tao_boi NULL (như văn bản nhập bằng script), KHÔNG có nhiệm vụ → ca 5b không ghi lich_su/trích yếu vào fixture dùng chung.
    const vn = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} văn bản tao_boi NULL`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    assertOk(vn, 'văn bản tao_boi NULL'); vbNull = vn.data.id;
    await them({ ma: 'DV-A3', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1 });          // đơn vị ngoài, theo dõi = A3 Tổng hợp
    await them({ ma: 'DV-A2', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.truongphong });  // đơn vị ngoài, theo dõi = Trưởng phòng Tổng hợp
    await them({ ma: 'PHONG', owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong });      // Owner = phòng (không tài khoản), theo dõi = Trưởng phòng
    assertOk(await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK.id), 'cấp cờ thư ký');
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm quan_tri_kl cho cv2');
  });
  after(don);

  test('1. E1: Owner đơn vị ngoài, theo dõi A3 — mọi vai không phải người theo dõi bị chặn 42501 (kể cả CVP, PCVP phụ trách phòng, A0, quan_tri_kl, QTHT, thư ký TT, anon)', async () => {
    for (const u of ['demo_cv2', 'demo_truongphong', 'demo_cvp', 'demo_pcvp', 'demo_pcvp2', 'demo_a0', 'demo_qtht', TK.username]) {
      assertDenied(await nhan(u, 'DV-A3'), `${u} xác nhận nhận việc DV-A3`);
    }
    assertDenied(await anonClient().rpc('xac_nhan_nhan_viec', { p_id: id['DV-A3'] }), 'anon');
    assert.equal((await db().from('lich_su').select('id').eq('nhiem_vu_id', id['DV-A3']).eq('cot', 'xac_nhan_nhan_viec')).data.length, 0, 'chưa ai nhận');
  });

  test('2. E1: người theo dõi A3 (cv1) nhận được → true, 1 dòng lich_su đúng người; gọi lại → false', async () => {
    const r = await nhan('demo_cv1', 'DV-A3');
    assertOk(r, 'cv1 nhận'); assert.equal(r.data, true);
    const ls = (await db().from('lich_su').select('nguoi_sua').eq('nhiem_vu_id', id['DV-A3']).eq('cot', 'xac_nhan_nhan_viec')).data;
    assert.deepEqual(ls.map((x) => x.nguoi_sua), [IDS.cv1]);
    assert.equal((await nhan('demo_cv1', 'DV-A3')).data, false, 'gọi lại không ghi thêm');
  });

  test('3. E1: Owner đơn vị ngoài, theo dõi A2 — Trưởng phòng nhận được; A3 cùng phòng (cv1), CVP, PCVP phụ trách, A0, QTHT bị chặn', async () => {
    for (const u of ['demo_cv1', 'demo_cvp', 'demo_pcvp', 'demo_a0', 'demo_qtht']) assertDenied(await nhan(u, 'DV-A2'), `${u} nhận DV-A2`);
    const r = await nhan('demo_truongphong', 'DV-A2');
    assertOk(r, 'Trưởng phòng (theo dõi) nhận'); assert.equal(r.data, true);
  });

  test('4. E2: Owner là phòng Tổng hợp (không tài khoản), theo dõi = Trưởng phòng — A3 trong phòng không thấy, không nhận; Trưởng phòng nhận được', async () => {
    const cv1 = await userClient('demo_cv1');
    const thay = await cv1.from('nhiem_vu').select('id').eq('id', id['PHONG']);
    assertOk(thay, 'cv1 đọc'); assert.equal(thay.data.length, 0, 'A3 trong phòng không thấy việc Owner = phòng');
    assertDenied(await nhan('demo_cv1', 'PHONG'), 'cv1 nhận việc của phòng');
    assertDenied(await nhan('demo_cv2', 'PHONG'), 'cv2 (quan_tri_kl) nhận việc của phòng');
    assert.equal((await nhan('demo_truongphong', 'PHONG')).data, true, 'Trưởng phòng nhận');
  });

  test('5. QTHT (không quan_tri_kl) gọi hàm nghiệp vụ trên việc/văn bản người khác: chi_dao_gui, dat_cap_quyet_dinh, chi_dao_dong, van_ban_dat_trich_yeu → 42501', async () => {
    assertDenied(await rpc('demo_qtht', 'chi_dao_gui', { p: { nhiem_vu_id: id['DV-A3'], loai: 'DON_DOC', noi_dung: `${KHOA} qtht` } }), 'QTHT đôn đốc');
    assertDenied(await rpc('demo_qtht', 'chi_dao_gui', { p: { nhiem_vu_id: id['DV-A3'], loai: 'Y_KIEN', noi_dung: `${KHOA} qtht` } }), 'QTHT ý kiến');
    assertDenied(await rpc('demo_qtht', 'dat_cap_quyet_dinh', { p_id: id['DV-A3'], p_cap: 'THUONG_TRUC' }), 'QTHT đặt cấp quyết định');
    assertDenied(await rpc('demo_qtht', 'chi_dao_dong', { p_id: fx.d1 }), 'QTHT đóng chỉ đạo của Trưởng phòng');
    assertDenied(await rpc('demo_qtht', 'van_ban_dat_trich_yeu', { p_id: vbCvp, p_trich_yeu: `${KHOA} trích yếu` }), 'QTHT đặt trích yếu văn bản của CVP');
    assertDenied(await rpc('demo_cv1', 'van_ban_dat_trich_yeu', { p_id: vbCvp, p_trich_yeu: `${KHOA} trích yếu` }), 'A3 đặt trích yếu văn bản của CVP');
    assert.equal((await db().from('chi_dao').select('id').eq('nhiem_vu_id', id['DV-A3'])).data.length, 0, 'không có chỉ đạo nào được ghi');
  });

  // LỖI HIỆN TẠI (phát hiện 2026-09-22, chờ PR RLS): văn bản có tao_boi NULL (nhập bằng script/service_role) → biểu thức
  // "tao_boi = auth.uid() OR A1 OR quan_tri_kl" cho NULL, IF NOT NULL không chặn → MỌI người đăng nhập sửa được trích yếu.
  test('5b. [hanh-vi-hien-tai] văn bản tao_boi NULL: QTHT / A3 đặt trích yếu phải bị chặn — hiện KHÔNG chặn (lỗi NULL trong allowlist)', { todo: 'chờ PR RLS sửa van_ban_dat_trich_yeu (tao_boi NULL)' }, async () => {
    assertDenied(await rpc('demo_qtht', 'van_ban_dat_trich_yeu', { p_id: vbNull, p_trich_yeu: `${KHOA} trích yếu` }), 'QTHT đặt trích yếu văn bản tao_boi NULL');
    assertDenied(await rpc('demo_cv1', 'van_ban_dat_trich_yeu', { p_id: vbNull, p_trich_yeu: `${KHOA} trích yếu` }), 'A3 đặt trích yếu văn bản tao_boi NULL');
  });

  test('6. quan_tri_kl là A3 (cv2): xac_nhan_nhan_viec / chi_dao_gui / dat_cap_quyet_dinh trên việc người khác → 42501 (cờ nhập liệu không thêm quyền điều hành); thư ký TT cũng vậy', async () => {
    for (const u of ['demo_cv2', TK.username]) {
      assertDenied(await nhan(u, 'DV-A2'), `${u} nhận việc người khác`);
      assertDenied(await rpc(u, 'chi_dao_gui', { p: { nhiem_vu_id: id['DV-A3'], loai: 'DON_DOC', noi_dung: `${KHOA} ${u}` } }), `${u} đôn đốc`);
    }
    assertDenied(await rpc(TK.username, 'dat_cap_quyet_dinh', { p_id: id['DV-A3'], p_cap: 'THUONG_TRUC' }), 'thư ký đặt cấp quyết định');
  });
});
