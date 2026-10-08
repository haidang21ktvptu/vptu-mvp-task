// 0086 (Đợt C1 v3.19): cấu hình pham_vi_chuyen_vien — 1 (mặc định) chuyên viên chỉ thấy việc mình chủ trì / theo dõi / đã giao; 2 = thấy thêm mọi
// việc của phòng mình (phòng người theo dõi hoặc phòng chủ trì — như Trưởng phòng), CHỈ XEM: nộp minh chứng / xác nhận / từ chối / UPDATE vẫn bị
// chặn vì các chốt ghi không đổi. Chuẩn đối chiếu kl_tham_chieu_pham_vi khớp view dưới cấu hình 2. Minh chứng nhanh: số hiệu + ngày là đủ, cấp
// nhận trống = cap_nhan_san_pham của việc, trích yếu / mô tả tuỳ chọn. Khoá "KL-0086"; cấu hình khôi phục; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0086';
const cauHinh = async () => (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'pham_vi_chuyen_vien').maybeSingle()).data?.gia_tri;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : (await cauHinh()) === undefined ? 'Chưa có migration 0086 (kl_cau_hinh pham_vi_chuyen_vien).' : false;
let dem = 0; let cauHinhCu = '1';
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem + 1}`, ...CHUNG, ...p } });
const datCauHinh = (v) => db().from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'pham_vi_chuyen_vien');
const thay = async (username) => ((await (await userClient(username)).from('v_nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data || []).map((r) => r.id).sort();
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0086 — chuyên viên xem cả phòng (cấu hình 2, chỉ xem); minh chứng nhanh', { skip: SKIP }, () => {
  before(async () => { cauHinhCu = (await cauHinh()) || '1'; assertOk(await datCauHinh('1'), 'đặt cấu hình 1'); await don(); });
  after(async () => { await don(); await datCauHinh(cauHinhCu); });
  let a; let b; let c;   // A: Trưởng phòng TONG_HOP tự giao (cv1 không liên quan); B: Chánh VP giao cv2 (QUAN_TRI); C: cv2 tự giao

  test('1. dựng dữ liệu; cấu hình 1: cv1 không thấy việc nào, cv2 thấy B và C', async () => {
    const ra = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.truongphong }); assertOk(ra, 'TP tự giao'); a = ra.data.id;
    const rb = await giao('demo_cvp', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cvp }); assertOk(rb, 'CVP giao cv2'); b = rb.data.id;
    const rc = await giao('demo_cv2', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 }); assertOk(rc, 'cv2 tự giao'); c = rc.data.id;
    assert.deepEqual(await thay('demo_cv1'), []);
    assert.deepEqual(await thay('demo_cv2'), [b, c].sort());
  });

  test('2. cấu hình 2: cv1 (TONG_HOP) thấy A — không thấy B, C (QUAN_TRI); lịch sử, văn bản của A đọc được; cv2 vẫn chỉ B, C; chuẩn đối chiếu khớp view', async () => {
    assertOk(await datCauHinh('2'), 'đặt cấu hình 2');
    assert.deepEqual(await thay('demo_cv1'), [a]);
    assert.deepEqual(await thay('demo_cv2'), [b, c].sort());
    const cv1 = await userClient('demo_cv1');
    assert.equal((await cv1.rpc('kl_thay_nhiem_vu', { p_id: a })).data, true, 'kl_thay_nhiem_vu(A)');
    assert.equal((await cv1.rpc('kl_thay_nhiem_vu', { p_id: b })).data, false, 'kl_thay_nhiem_vu(B)');
    assert.ok(((await cv1.from('lich_su').select('id').eq('nhiem_vu_id', a)).data || []).length >= 1, 'lịch sử của A theo phạm vi');
    assert.equal(((await cv1.from('van_ban_giao_viec').select('id').like('so_ket_luan', `${KHOA}%`)).data || []).length, 1, 'chỉ văn bản của A');
    const tatCa = (await cv1.from('v_nhiem_vu').select('id', { count: 'exact', head: true })).count;
    const ref = (await db().rpc('kl_tham_chieu_pham_vi', { p_nguoi: IDS.cv1 })).data.find((x) => x.bang === 'nhiem_vu');
    assert.equal((ref.ids || []).length, tatCa, 'kl_tham_chieu_pham_vi(cv1) = số dòng v_nhiem_vu dưới cấu hình 2');
  });

  test('3. cấu hình 2 chỉ xem: cv1 không nộp minh chứng / xác nhận / từ chối / cập nhật việc A của Trưởng phòng cùng phòng', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.rpc('nop_minh_chung', { p: { nhiem_vu_id: a, so_hieu: '1/BC', ngay_van_ban: '2026-10-05' } }), 'nộp minh chứng');
    assertDenied(await cv1.rpc('xac_nhan_nhan_viec', { p_id: a }), 'xác nhận nhận việc');
    assertDenied(await cv1.rpc('de_nghi_tu_choi', { p_nhiem_vu: a, p_ly_do: 'x' }), 'đề nghị từ chối');
    const upd = await cv1.from('nhiem_vu').update({ vuong_mac: 'x' }).eq('id', a).select('id');
    assert.ok(upd.error || (upd.data || []).length === 0, `UPDATE phải 0 dòng hoặc bị chặn: ${JSON.stringify(upd.data)}`);
    assert.equal((await db().from('nhiem_vu').select('vuong_mac').eq('id', a).single()).data.vuong_mac, null, 'không ghi được');
    assertOk(await datCauHinh('1'), 'trả cấu hình 1');
    assert.deepEqual(await thay('demo_cv1'), [], 'về cấu hình 1 lại không thấy');
  });

  test('4. minh chứng nhanh: số hiệu + ngày → cấp nhận = cap_nhan_san_pham, trích yếu / mô tả trống, chờ nghiệm thu, lịch sử gọn; thiếu ngày bị chặn; đủ bốn yếu tố vẫn nộp được', async () => {
    const cv2 = await userClient('demo_cv2');
    const r = await cv2.rpc('nop_minh_chung', { p: { nhiem_vu_id: c, so_hieu: '12/BC-QT', ngay_van_ban: '2026-10-06' } }); assertOk(r, 'nộp nhanh');
    const mc = (await db().from('minh_chung').select('so_hieu, cap_nhan, trich_yeu, mo_ta_ket_qua').eq('id', r.data).single()).data;
    const nv = (await db().from('nhiem_vu').select('cap_nhan_san_pham').eq('id', c).single()).data;
    assert.deepEqual(mc, { so_hieu: '12/BC-QT', cap_nhan: nv.cap_nhan_san_pham, trich_yeu: null, mo_ta_ket_qua: null });
    assert.equal((await db().from('v_nhiem_vu').select('nhom_dem').eq('id', c).single()).data.nhom_dem, 'CHO_NGHIEM_THU');
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', c).eq('cot', 'minh_chung_nop').single()).data;
    assert.match(ls.gia_tri_moi, /^Nộp minh chứng · NV-\d+: số 12\/BC-QT \(ngày 06\/10\/2026, [^)]+\)$/);
    loi(await cv2.rpc('nop_minh_chung', { p: { nhiem_vu_id: b, so_hieu: '13/BC', ngay_van_ban: '' } }), /số hiệu và ngày văn bản/, 'thiếu ngày');
    const r2 = await cv2.rpc('nop_minh_chung', { p: { nhiem_vu_id: b, so_hieu: '14/BC', ngay_van_ban: '2026-10-06', cap_nhan: 'CHANH_VAN_PHONG', trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'đủ 4 yếu tố' } });
    assertOk(r2, 'nộp đủ');
    assert.deepEqual((await db().from('minh_chung').select('cap_nhan, trich_yeu').eq('id', r2.data).single()).data, { cap_nhan: 'CHANH_VAN_PHONG', trich_yeu: 'Báo cáo' });
  });
});
