// GĐ14 (0025, PR 14C) — phạm vi đọc thêm nhánh Owner (NT-1; 3 vai), guard cột mới cho người theo dõi/Owner, hàm giao_viec
// (GV-3 quyền theo vai; 1-1-1 với theo_1400 = true; việc cũ không đòi sản phẩm; người theo dõi trong phạm vi người giao —
// bổ sung 3), xac_nhan_nhan_viec (chỉ lịch sử, việc đã đóng bị chặn, gọi lại không ghi thêm). Mã NV-T8x/T9x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {};
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'KL-1400 phạm vi', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', ...row }).select('id, ma').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const thay = async (username, ma) => (await (await userClient(username)).from('v_nhiem_vu').select('ma').eq('ma', ma)).data?.length === 1;
const giao = async (username, p) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: fx.hn, noi_dung: `KL-1400 giao ${p.ma || ''}`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...p } });
const loi = (r) => r.error?.message || '';
const don = async () => {
  await db().from('nhiem_vu').delete().like('ma', 'NV-T8%');
  await db().from('nhiem_vu').delete().like('noi_dung', 'KL-1400 giao%');
  await db().from('van_ban_giao_viec').delete().eq('so_ket_luan', 'KL-1400 CV moi');
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};

describe('0025 — phạm vi Owner, giao_viec, xac_nhan_nhan_viec', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'NV-T80', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 });     // Owner = cv2 (QUAN_TRI), theo dõi cv1 (TONG_HOP)
    await them({ ma: 'NV-T81', owner_don_vi_ma: 'QUAN_TRI' });                              // Owner = phòng Quản trị, không tài khoản
    await them({ ma: 'NV-T82', owner_don_vi_ma: 'DANG_UY_UBND' });                          // Owner đơn vị ngoài
    await them({ ma: 'NV-T83', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-09-01', minh_chung: 'CV 9' });
  });
  after(don);

  test('1. phạm vi Owner: A3 thấy việc mình là Owner; A3 khác không; A2 thấy Owner thuộc phòng; PCVP theo phòng Owner; đơn vị ngoài chỉ theo người theo dõi', async () => {
    assert.equal(await thay('demo_cv2', 'NV-T80'), true, 'cv2 là Owner');
    assert.equal(await thay('demo_cv2', 'NV-T81'), false, 'cv2 không phải Owner tài khoản của việc Owner = phòng');
    assert.equal(await thay('demo_cv2', 'NV-T82'), false, 'cv2 không liên quan việc đơn vị ngoài');
    assert.equal(await thay('demo_truongphong', 'NV-T80'), true, 'A2 Tổng hợp thấy vì người theo dõi thuộc phòng');
    assert.equal(await thay('demo_pcvp2', 'NV-T80'), true, 'PCVP phụ trách Quản trị thấy vì Owner thuộc Quản trị');
    assert.equal(await thay('demo_pcvp2', 'NV-T81'), true, 'PCVP phụ trách Quản trị thấy việc Owner = phòng Quản trị');
    assert.equal(await thay('demo_pcvp2', 'NV-T82'), false, 'PCVP Quản trị không thấy việc đơn vị ngoài do Tổng hợp theo dõi');
    assert.equal(await thay('demo_pcvp', 'NV-T82'), true, 'PCVP Tổng hợp thấy qua người theo dõi');
  });

  test('2. guard: Owner tài khoản sửa sản phẩm/cấp/ngày nhận của việc mình; không đổi Owner/người theo dõi; người ngoài 0 dòng', async () => {
    const cv2 = await userClient('demo_cv2');
    const r = await cv2.from('nhiem_vu').update({ san_pham_loai: 'BAO_CAO', san_pham_mo_ta: 'Báo cáo thử', cap_quyet_dinh: 'CHANH_VAN_PHONG', ngay_nhan_van_ban: '2026-08-10' }).eq('ma', 'NV-T80').select('san_pham_loai, ngay_nhan_uoc_tinh');
    assertOk(r, 'Owner sửa cột mới'); assert.equal(r.data[0].san_pham_loai, 'BAO_CAO'); assert.equal(r.data[0].ngay_nhan_uoc_tinh, false);
    assertDenied(await cv2.from('nhiem_vu').update({ nguoi_theo_doi: IDS.cv2 }).eq('ma', 'NV-T80').select('id'), 'Owner đổi người theo dõi');
    assertDenied(await cv2.from('nhiem_vu').update({ owner_tai_khoan: IDS.cv1 }).eq('ma', 'NV-T80').select('id'), 'Owner đổi Owner');
    const cv1 = await userClient('demo_cv1');
    assertOk(await cv1.from('nhiem_vu').update({ ghi_chu: 'việc cũ không cần sản phẩm' }).eq('id', fx.n1).select('id'), 'người theo dõi cập nhật việc cũ không sản phẩm');
    assert.equal((await cv2.from('nhiem_vu').update({ ghi_chu: 'x' }).eq('id', fx.n1).select('id')).data.length, 0, 'ngoài phạm vi: 0 dòng');
  });

  test('3. giao_viec: A3 bị chặn; A2 giao cho chuyên viên phòng mình được (cấp nhận = Trưởng phòng, ngày nhận = hôm nay, theo_1400); khác phòng/phòng/đơn vị ngoài bị chặn', async () => {
    assertDenied(await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }), 'A3 giao việc');
    const ok = await giao('demo_truongphong', { ma: 'A2', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(ok, 'A2 giao cho cv1');
    const nv = (await db().from('nhiem_vu').select('theo_1400, cap_nhan_san_pham, ngay_nhan_van_ban, ngay_nhan_uoc_tinh, nguoi_theo_doi, tao_boi, han_xu_ly').eq('id', ok.data.id).single()).data;
    assert.deepEqual(nv, { theo_1400: true, cap_nhan_san_pham: 'TRUONG_PHONG', ngay_nhan_van_ban: homNayVN(), ngay_nhan_uoc_tinh: false, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.truongphong, han_xu_ly: '2026-12-31' });
    assert.equal((await db().rpc('tinh_trang_thai', { p_id: ok.data.id, p_ngay: homNayVN() })).data.muc_canh_bao, 'XANH');
    assert.match(loi(await giao('demo_truongphong', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 })), /chuyên viên phòng mình/);
    assert.match(loi(await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP' })), /chuyên viên phòng mình/);
    assert.match(loi(await giao('demo_truongphong', { owner_don_vi_ma: 'DANG_UY_UBND' })), /đơn vị ngoài Văn phòng/);
    assert.match(loi(await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv2 })), /thuộc phòng của đồng chí/);
  });

  test('4. giao_viec 1-1-1 với theo_1400: thiếu Owner / sản phẩm / hạn / loại không hạn / ngành-lĩnh vực (KL_BTV) bị chặn', async () => {
    const cvp = 'demo_cvp';
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: null })), /1 Owner/);
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: 'TONG_HOP', san_pham_loai: null })), /1 Product/);
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: 'TONG_HOP', han_xu_ly: null })), /1 Deadline/);
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: 'TONG_HOP', loai_thoi_han_ma: 'THUONG_XUYEN' })), /phải có thời hạn/);
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: 'TONG_HOP', linh_vuc_ma: null })), /ngành và lĩnh vực/);
    assert.match(loi(await giao(cvp, { owner_don_vi_ma: 'TONG_HOP', van_ban_id: null })), /văn bản giao việc/);
  });

  test('5. giao_viec theo vai A1: Chánh VP giao Owner = Văn phòng/phòng; PCVP chỉ phòng phụ trách; A1 không nhập đơn vị ngoài; văn bản mới inline', async () => {
    const vp = await giao('demo_cvp', { ma: 'CVP', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp, nguoi_theo_doi: IDS.cv1 });
    assertOk(vp, 'CVP giao cho PCVP'); assert.equal((await db().from('nhiem_vu').select('cap_nhan_san_pham').eq('id', vp.data.id).single()).data.cap_nhan_san_pham, 'THUONG_TRUC');
    const ph = await giao('demo_pcvp', { ma: 'PCVP', owner_don_vi_ma: 'TONG_HOP' });
    assertOk(ph, 'PCVP Tổng hợp giao cho phòng Tổng hợp'); assert.equal((await db().from('nhiem_vu').select('cap_nhan_san_pham').eq('id', ph.data.id).single()).data.cap_nhan_san_pham, 'PHO_CHANH_VAN_PHONG');
    assert.match(loi(await giao('demo_pcvp', { owner_don_vi_ma: 'QUAN_TRI' })), /được phân công phụ trách/);
    assert.match(loi(await giao('demo_pcvp', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.cv2 })), /phòng đồng chí phụ trách/);
    assert.match(loi(await giao('demo_cvp', { owner_don_vi_ma: 'DANG_UY_UBND' })), /đơn vị ngoài Văn phòng/);
    const moi = await giao('demo_cvp', { ma: 'VBMOI', van_ban_id: null, van_ban: { loai: 'CONG_VAN', so_ket_luan: 'KL-1400 CV moi', ngay_ban_hanh: '2026-09-10', ngay_nhan: '2026-09-12' }, owner_don_vi_ma: 'TONG_HOP', nganh_ma: null, linh_vuc_ma: null });
    assertOk(moi, 'văn bản mới inline, không cần ngành với CONG_VAN');
    const vb = (await db().from('van_ban_giao_viec').select('loai, so_hoi_nghi, ngay_nhan').eq('id', moi.data.van_ban_id).single()).data;
    assert.deepEqual(vb, { loai: 'CONG_VAN', so_hoi_nghi: null, ngay_nhan: '2026-09-12' });
    assert.equal((await db().from('nhiem_vu').select('ngay_nhan_van_ban').eq('id', moi.data.id).single()).data.ngay_nhan_van_ban, '2026-09-12', 'ngày nhận = ngày nhận văn bản');
    assert.match(loi(await giao('demo_cvp', { van_ban_id: null, van_ban: { loai: 'KL_BTV', so_ket_luan: 'KL-1400 CV moi', ngay_ban_hanh: '2026-09-10' }, owner_don_vi_ma: 'TONG_HOP' })), /so_hoi_nghi/);
  });

  test('6. quan_tri_kl nhập việc Owner đơn vị ngoài với người theo dõi Văn phòng; người theo dõi hệ thống bị chặn', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm');
    const r = await giao('demo_cv2', { ma: 'QTKL', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.cvp }); // GĐ22: quan_tri_kl giao thay mặt lãnh đạo
    assertOk(r, 'quan_tri_kl nhập việc đơn vị ngoài');
    const nv = (await db().from('nhiem_vu').select('owner_tai_khoan, nguoi_theo_doi, cap_nhan_san_pham').eq('id', r.data.id).single()).data;
    assert.deepEqual(nv, { owner_tai_khoan: null, nguoi_theo_doi: IDS.cv1, cap_nhan_san_pham: 'THUONG_TRUC' });
    assert.match(loi(await giao('demo_cv2', { owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: '00000000-0000-4000-8000-000000000007', thay_mat_cho: IDS.cvp })), /cán bộ Văn phòng/);
    await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
  });

  test('7. xac_nhan_nhan_viec: Owner ghi 1 dòng lịch sử, hạn/tiến độ/cap_nhat_luc không đổi; gọi lại false; người ngoài bị chặn; việc đã đóng bị chặn', async () => {
    const cv2 = await userClient('demo_cv2');
    const truoc = (await db().from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('ma', 'NV-T80').single()).data;
    const r1 = await cv2.rpc('xac_nhan_nhan_viec', { p_id: id['NV-T80'] });
    assertOk(r1, 'Owner xác nhận'); assert.equal(r1.data, true);
    const r2 = await cv2.rpc('xac_nhan_nhan_viec', { p_id: id['NV-T80'] });
    assertOk(r2, 'gọi lại'); assert.equal(r2.data, false);
    const ls = await db().from('lich_su').select('cot, nguoi_sua, nguon').eq('nhiem_vu_id', id['NV-T80']).eq('cot', 'xac_nhan_nhan_viec');
    assert.equal(ls.data.length, 1); assert.equal(ls.data[0].nguoi_sua, IDS.cv2); assert.equal(ls.data[0].nguon, 'app');
    const sau = (await db().from('nhiem_vu').select('han_xu_ly, tien_do_ma, cap_nhat_luc').eq('ma', 'NV-T80').single()).data;
    assert.deepEqual(sau, truoc, 'không dừng đồng hồ, không đổi gì trên nhiệm vụ');
    const cv1 = await userClient('demo_cv1');
    assertOk(await cv1.rpc('xac_nhan_nhan_viec', { p_id: id['NV-T80'] }), 'người theo dõi cũng xác nhận được (dòng riêng)');
    assertDenied(await (await userClient('demo_truongphong')).rpc('xac_nhan_nhan_viec', { p_id: id['NV-T80'] }), 'A2 không phải bên trong');
    assert.match(loi(await cv2.rpc('xac_nhan_nhan_viec', { p_id: id['NV-T83'] })), /đã đóng/);
  });
});
