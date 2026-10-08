// 0070–0071 (giao diện v9 đợt 2, C) — NHẬP THEO TẦNG + ĐỀ NGHỊ SỬA, bằng token thật. Việc mẫu: người giao = Trưởng phòng Tổng hợp, Owner = theo
// dõi = cv1, văn bản KL_BTV có sẵn ngành / lĩnh vực, sản phẩm Báo cáo. Kiểm: (1) cấp dưới chỉ ĐIỀN ô tầng giao còn trống, cột thực hiện vẫn ghi
// được; (2) cột định danh không đổi qua API trực tiếp với mọi vai kể cả quản trị nhiệm vụ; (3) sua_thong_tin_giao chỉ tầng giao, có lịch sử + tin;
// (4) đề nghị sửa: gửi → một đề nghị chờ mỗi việc → người duyệt chấp nhận (áp) / giữ nguyên (ý kiến bắt buộc) / người gửi rút; người ngoài không
// duyệt được, không ghi thẳng bảng; đọc theo vai; số chờ duyệt trong kl_so_chua_xu_ly. Khoá dữ liệu "KL-0070"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, assertNoRows, IDS, CHI_CUC_BO } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const KHOA = 'KL-0070';
const db = () => adminClient();
const coBang = (await klSchemaReady()) && !(await db().from('de_nghi_sua').select('id').limit(1)).error;
const SKIP = coBang ? false : 'Chưa có migration 0070–0071 trên project này.';
let fx; let nv; let lv;
const don = async () => {
  const { data } = await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`);
  const idDs = (data || []).map((r) => r.id);
  if (idDs.length) await db().from('direct_messages').delete().in('nhiem_vu_id', idDs);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};
const sua = async (u, patch) => (await userClient(u)).from('nhiem_vu').update(patch).eq('id', nv).select('id');
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const doc = async () => (await db().from('nhiem_vu').select('*').eq('id', nv).single()).data;
const choDuyet = async () => (await db().from('de_nghi_sua').select('*').eq('nhiem_vu_id', nv).eq('trang_thai', 'CHO_DUYET').maybeSingle()).data;

describe('0070–0071 — nhập theo tầng, sửa thông tin giao, đề nghị sửa', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    lv = (await db().from('dm_linh_vuc').select('ma, nganh_ma').order('ma').limit(2)).data;
    const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} báo cáo quý`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: lv[0].nganh_ma, linh_vuc_ma: lv[0].ma, theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP',
      owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG',
      nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' }).select('id').single();
    assertOk(r, 'việc mẫu'); nv = r.data.id;
  });
  after(don);

  test('1. Owner: ô tầng giao đã điền → chặn (lời nhắc Đề nghị sửa); điền ô còn trống, cột thực hiện → được', async () => {
    const chan = await sua('demo_cv1', { san_pham_loai: 'TO_TRINH' });
    assertDenied(chan, 'Owner đổi sản phẩm đã điền'); assert.match(chan.error.message, /Đề nghị sửa/);
    assertDenied(await sua('demo_cv1', { cap_nhan_san_pham: 'CHANH_VAN_PHONG' }), 'Owner đổi cấp nhận đã điền');
    const nn = await sua('demo_cv1', { ngay_nhan_van_ban: '2026-08-06' });
    assertDenied(nn, 'Owner đổi ngày nhận đã chốt'); assert.match(nn.error.message, /báo người giao việc/, 'ô không có Đề nghị sửa: không chỉ sang Đề nghị sửa');
    assertDenied(await sua('demo_cv1', { ngay_nhan_uoc_tinh: true }), 'Owner tự chuyển ngày nhận đã chốt thành ước tính (để mở khoá)');
    const ok = await sua('demo_cv1', { san_pham_mo_ta: `${KHOA} mô tả`, ghi_chu: `${KHOA} đang làm`, tien_do_ma: 'DANG_THUC_HIEN' });
    assertOk(ok, 'Owner điền mô tả còn trống + ghi chú, tiến độ'); assert.equal(ok.data.length, 1);
    assertDenied(await sua('demo_cv1', { san_pham_mo_ta: 'đổi lại' }), 'mô tả vừa điền nay đã là ô có giá trị');
  });

  test('2. cột định danh qua API trực tiếp: Owner và quản trị nhiệm vụ đều bị chặn; quản trị nhiệm vụ vẫn sửa nội dung trực tiếp', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm quan_tri_kl cho cv2');
    try {
      for (const [cot, gt] of [['tao_boi', IDS.cv2], ['giao_thay_mat_cho', IDS.cvp], ['van_ban_id', null], ['theo_1400', false], ['nguon', 'excel']]) {
        assertDenied(await sua('demo_cv2', { [cot]: gt }), `quan_tri_kl đổi ${cot}`);
      }
      assertDenied(await sua('demo_cv1', { tao_boi: IDS.cv1 }), 'Owner đổi tao_boi');
      assertOk(await sua('demo_cv2', { noi_dung: `${KHOA} báo cáo quý (qtkl)` }), 'quan_tri_kl sửa nội dung trực tiếp');
    } finally { await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2); }
    assert.equal((await doc()).tao_boi, IDS.truongphong, 'người giao không đổi');
  });

  test('3. sua_thong_tin_giao: Owner / PCVP ngoài phạm vi → chặn (0091: lãnh đạo cấp trên người giao trong phạm vi được); người giao sửa được, có lịch sử + tin cho Owner; giá trị sai → lỗi rõ', async () => {
    const tham = (thay, lyDo = `${KHOA} theo giao ban`) => ({ p_id: nv, p_thay_doi: thay, p_ly_do: lyDo });
    assertDenied(await goi('demo_cv1', 'sua_thong_tin_giao', tham({ do_khan: 'KHAN' })), 'Owner gọi');
    assertDenied(await goi('demo_pcvp2', 'sua_thong_tin_giao', tham({ do_khan: 'KHAN' })), 'PCVP ngoài phạm vi');
    assertOk(await goi('demo_truongphong', 'sua_thong_tin_giao', tham({ do_khan: 'KHAN', don_vi_phoi_hop: `${KHOA} Phòng Quản trị` })), 'người giao sửa');
    const v = await doc();
    assert.equal(v.do_khan, 'KHAN'); assert.equal(v.don_vi_phoi_hop, `${KHOA} Phòng Quản trị`);
    const ls = (await db().from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', nv).eq('cot', 'sua_thong_tin_giao')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /Độ khẩn, Đơn vị phối hợp — lý do/);
    const tin = (await db().from('direct_messages').select('receiver_id, content').eq('nhiem_vu_id', nv).like('content', 'Sửa thông tin giao%')).data;
    assert.deepEqual(tin.map((t) => t.receiver_id), [IDS.cv1]);
    if (!CHI_CUC_BO) for (const [thay, mau] of [[{ do_khan: 'KHAN' }, /Không có gì thay đổi/], [{ han_xu_ly: '2026-12-01' }, /không sửa được/], [{ cap_nhan_san_pham: 'KHONG_CO' }, /danh mục/],
      [{ cap_nhan_san_pham: null }, /cấp nhận sản phẩm/],
      [{ linh_vuc_ma: lv[1].nganh_ma === lv[0].nganh_ma ? 'KHONG_CO' : lv[1].ma }, /danh mục|không thuộc ngành/], [{ nganh_ma: '' }, /ngành và lĩnh vực/]]) {
      const r = await goi('demo_truongphong', 'sua_thong_tin_giao', tham(thay));
      assert.ok(r.error, `phải lỗi: ${JSON.stringify(thay)}`); assert.match(r.error.message, mau);
    }
    assert.match((await goi('demo_truongphong', 'sua_thong_tin_giao', tham({ do_khan: 'THUONG' }, '  '))).error?.message || '', /Lý do/);
  });

  test('4. đề nghị sửa: Owner gửi → người giao duyệt; một đề nghị chờ mỗi việc; đọc theo vai; ghi thẳng bảng bị chặn; số chờ duyệt', async () => {
    const dv = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} việc của đơn vị ngoài`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: lv[0].nganh_ma, linh_vuc_ma: lv[0].ma, theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'DANG_UY_UBND',
      nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' }).select('id').single();
    assertOk(dv, 'việc giao cho đơn vị (không có tài khoản chủ trì)');
    assertDenied(await goi('demo_cv2', 'de_nghi_sua_gui', { p_nhiem_vu: dv.data.id, p_thay_doi: { do_khan: 'KHAN' }, p_ly_do: 'x' }),
      'người ngoài gửi đề nghị trên việc owner_tai_khoan NULL');
    assertDenied(await goi('demo_truongphong', 'de_nghi_sua_gui', { p_nhiem_vu: nv, p_thay_doi: { do_khan: 'THUONG' }, p_ly_do: 'x' }), 'người không phải Owner / theo dõi');
    assertDenied(await goi('demo_a0', 'de_nghi_sua_gui', { p_nhiem_vu: nv, p_thay_doi: { do_khan: 'THUONG' }, p_ly_do: 'x' }), 'A0 không gửi');
    const g = await goi('demo_cv1', 'de_nghi_sua_gui', { p_nhiem_vu: nv, p_thay_doi: { san_pham_loai: 'TO_TRINH' }, p_ly_do: `${KHOA} theo kết luận giao ban` });
    assertOk(g, 'Owner gửi đề nghị');
    const t = await choDuyet();
    assert.equal(t.cap_duyet, IDS.truongphong, 'người duyệt = người giao'); assert.deepEqual(t.gia_tri_cu, { san_pham_loai: 'BAO_CAO' });
    assert.match((await goi('demo_cv1', 'de_nghi_sua_gui', { p_nhiem_vu: nv, p_thay_doi: { do_khan: 'THUONG' }, p_ly_do: 'x' })).error?.message || '', /đang chờ duyệt/);
    const dem = async (u) => ((await (await userClient(u)).from('de_nghi_sua').select('id').eq('nhiem_vu_id', nv)).data || []).length;
    assert.deepEqual([await dem('demo_cv1'), await dem('demo_truongphong'), await dem('demo_cvp'), await dem('demo_cv2')], [1, 1, 1, 0], 'đọc: người gửi, người duyệt, Chánh VP; người ngoài 0');
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('de_nghi_sua').insert({ nhiem_vu_id: nv, nguoi_de_nghi: IDS.cv1, cap_duyet: IDS.cv1, thay_doi: { a: 1 }, gia_tri_cu: {}, ly_do: 'x' }).select('id'), 'INSERT thẳng');
    const up = await (await userClient('demo_truongphong')).from('de_nghi_sua').update({ trang_thai: 'DONG_Y' }).eq('id', t.id).select('id');
    if (up.error) assertDenied(up, 'UPDATE thẳng'); else assertNoRows(up, 'UPDATE thẳng');
    assert.equal((await (await userClient('demo_truongphong')).rpc('kl_so_chua_xu_ly')).data.de_nghi_sua >= 1, true, 'số chờ duyệt của người giao');
    assertDenied(await goi('demo_cv1', 'de_nghi_sua_duyet', { p_id: t.id, p_dong_y: true }), 'người gửi tự duyệt');
    assertDenied(await goi('demo_cv2', 'de_nghi_sua_duyet', { p_id: t.id, p_dong_y: true }), 'người ngoài duyệt');
    assert.match((await goi('demo_truongphong', 'de_nghi_sua_duyet', { p_id: t.id, p_dong_y: false, p_y_kien: ' ' })).error?.message || '', /ý kiến/);
    assertOk(await goi('demo_truongphong', 'de_nghi_sua_duyet', { p_id: t.id, p_dong_y: true }), 'người giao chấp nhận');
    assert.equal((await doc()).san_pham_loai, 'TO_TRINH', 'đã áp');
    const xong = (await db().from('de_nghi_sua').select('trang_thai, duyet_boi').eq('id', t.id).single()).data;
    assert.deepEqual(xong, { trang_thai: 'DONG_Y', duyet_boi: IDS.truongphong });
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', nv).like('content', 'Duyệt đề nghị sửa%')).data;
    assert.deepEqual(tin.map((x) => x.receiver_id), [IDS.cv1], 'người gửi nhận kết quả');
  });

  test('5. giữ nguyên kèm ý kiến; người gửi rút đề nghị; dữ liệu đã đổi sau khi gửi → không chấp nhận được', async () => {
    const gui = async (thay) => { assertOk(await goi('demo_cv1', 'de_nghi_sua_gui', { p_nhiem_vu: nv, p_thay_doi: thay, p_ly_do: `${KHOA} lý do` }), 'gửi'); return (await choDuyet()).id; };
    let id = await gui({ do_khan: 'THUONG_KHAN' });
    assertOk(await goi('demo_truongphong', 'de_nghi_sua_duyet', { p_id: id, p_dong_y: false, p_y_kien: `${KHOA} giữ Khẩn` }), 'giữ nguyên');
    assert.equal((await doc()).do_khan, 'KHAN', 'không đổi');
    id = await gui({ do_khan: 'THUONG_KHAN' });
    assertDenied(await goi('demo_truongphong', 'de_nghi_sua_huy', { p_id: id }), 'người khác rút');
    assertOk(await goi('demo_cv1', 'de_nghi_sua_huy', { p_id: id }), 'người gửi rút');
    id = await gui({ san_pham_mo_ta: `${KHOA} mô tả mới` });
    assertOk(await goi('demo_truongphong', 'sua_thong_tin_giao', { p_id: nv, p_thay_doi: { san_pham_mo_ta: `${KHOA} người giao sửa trước` }, p_ly_do: 'x' }), 'người giao sửa trước');
    assert.match((await goi('demo_truongphong', 'de_nghi_sua_duyet', { p_id: id, p_dong_y: true })).error?.message || '', /đã đổi sau khi đề nghị/);
    const tt = (await db().from('de_nghi_sua').select('trang_thai').eq('nhiem_vu_id', nv)).data.map((x) => x.trang_thai).sort();
    assert.deepEqual(tt, ['CHO_DUYET', 'DONG_Y', 'HUY', 'KHONG_DONG_Y']);
  });
});
