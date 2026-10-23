// 0085 (Đợt E v3.18): chuyên viên (A3 thường, không quan_tri_kl) giao thẳng — Owner là chuyên viên phòng bất kỳ hoặc chính mình, người theo dõi ép =
// người giao, không áp GV-3, tin giao tới Owner; phòng / lãnh đạo / đơn vị ngoài bị chặn (0095: ghi thay mặt thành quyền chung — kl-0095); tầng giao = chuyên viên tạo việc (sửa thông tin
// giao, cấp duyệt đề nghị sửa); phạm vi thấy việc của các vai; cấu hình xac_nhan_nhan_viec = 2 → trigger ghi "đã nhận" cho Owner và người theo dõi
// (giao_viec, giao lại), viec_moi = 0, từ chối không còn. Khoá "KL-0085"; cấu hình và cờ quan_tri_kl (cv2, cấp tạm ở test 7) khôi phục; tự dọn.
// v3.31 (0128): người theo dõi (nội bộ) luôn = chủ trì — không còn "ép = người giao"; các khẳng định liên quan đổi theo (ghi chú tại chỗ).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0085';
const co0085 = async () => (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xac_nhan_nhan_viec').maybeSingle()).data?.gia_tri;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : (await co0085()) === undefined ? 'Chưa có migration 0085 (kl_cau_hinh xac_nhan_nhan_viec).' : false;
let dem = 0; let cauHinhCu = '1';
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem + 1}`, ...CHUNG, ...p } });
const ma = (r, code, label) => assert.equal(r.error?.code, code, `${label}: ${r.error?.message || 'không bị chặn'}`);
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const doc = async (id) => (await db().from('nhiem_vu').select('tao_boi, nguoi_theo_doi, owner_tai_khoan, owner_don_vi_ma, giao_thay_mat_cho, giao_thay_mat_nhom, uu_tien, do_khan, cap_nhan_san_pham').eq('id', id).single()).data;
const daNhan = async (id) => (await db().from('lich_su').select('nguoi_sua, gia_tri_moi').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec')).data.map((x) => x.nguoi_sua).sort();
const nguoiNhanTin = async (id) => (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', id).eq('loai', 'he_thong')).data.map((x) => x.receiver_id);
const thay = async (username, id) => ((await (await userClient(username)).from('v_nhiem_vu').select('id').eq('id', id)).data || []).length === 1;
const datCauHinh = (v) => db().from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'xac_nhan_nhan_viec');
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};

describe('0085 — chuyên viên giao thẳng; cấu hình coi như đã nhận khi giao', { skip: SKIP }, () => {
  before(async () => { cauHinhCu = (await co0085()) || '1'; assertOk(await datCauHinh('1'), 'đặt cấu hình 1'); await don(); });
  after(async () => { await don(); await datCauHinh(cauHinhCu); });
  let nv1;

  test('1. cv1 (Tổng hợp) giao thẳng cho cv2 (Quản trị — khác phòng, khác khối): theo dõi (nội bộ) = chủ trì cv2, không theo người giao / tham số gửi kèm (v3.31); không thay mặt; cấp nhận Trưởng phòng; tin tới cv2; lich_su giao_viec', async () => {
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.truongphong });
    assertOk(r, 'cv1 giao thẳng'); nv1 = r.data.id;
    // v3.31 (0128): người theo dõi (nội bộ) = chủ trì cv2 — không còn ép = người giao cv1; tham số theo dõi (Trưởng phòng) bị ghi đè
    assert.deepEqual(await doc(nv1), { tao_boi: IDS.cv1, nguoi_theo_doi: IDS.cv2, owner_tai_khoan: IDS.cv2, owner_don_vi_ma: 'QUAN_TRI', giao_thay_mat_cho: null, giao_thay_mat_nhom: null, uu_tien: null, do_khan: 'THUONG', cap_nhan_san_pham: 'TRUONG_PHONG' });
    assert.deepEqual(await nguoiNhanTin(nv1), [IDS.cv2], 'tin giao tới Owner (độ khẩn Thường vẫn báo)');
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv1).eq('cot', 'giao_viec').single()).data;
    assert.match(ls.gia_tri_moi, /^Chuyên viên .* giao, người theo dõi là người giao$/);   // câu lịch sử của giao_viec (0085) giữ nguyên — 0128 không sửa giao_viec
    assert.deepEqual(await daNhan(nv1), [], 'cấu hình 1: chưa ai nhận');
  });

  test('2. cv1 giao cho chính mình: Owner = theo dõi = cv1', async () => {
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r, 'tự giao');
    const d = await doc(r.data.id); assert.deepEqual([d.owner_tai_khoan, d.nguoi_theo_doi, d.tao_boi], [IDS.cv1, IDS.cv1, IDS.cv1]);
  });

  test('3. chuyên viên giao thẳng (không ghi thay mặt) bị chặn: Owner là phòng, lãnh đạo (Trưởng phòng / Chánh VP), đơn vị ngoài → 42501', async () => {
    for (const [p, re, label] of [
      [{ owner_don_vi_ma: 'TONG_HOP' }, /chuyên viên/i, 'phòng'],
      [{ owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.truongphong }, /chuyên viên/i, 'Trưởng phòng'],
      [{ owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp }, /chuyên viên/i, 'Chánh VP'],
      [{ owner_don_vi_ma: 'DANG_UY_UBND' }, /chuyên viên|Văn phòng/, 'đơn vị ngoài'],
    ]) { const r = await giao('demo_cv1', p); ma(r, '42501', label); loi(r, re, label); }
  });

  test('4. phạm vi: cv1 (người giao — người nhập, 0096) và cv2 (Owner) thấy; PCVP2 (khối Quản trị, phòng Owner) thấy; v3.31: Trưởng phòng, PCVP khối Tổng hợp (phòng người giao) không thấy', async () => {
    // v3.31 (0128): người theo dõi = chủ trì cv2 (Quản trị) — phòng Tổng hợp của người giao không còn là "phòng theo dõi"; cv1 thấy nhờ tao_boi (0096)
    for (const [u, mong] of [['demo_cv1', true], ['demo_cv2', true], ['demo_truongphong', false], ['demo_pcvp2', true], ['demo_pcvp', false]]) assert.equal(await thay(u, nv1), mong, `${u} thấy việc`);
  });

  test('5. tầng giao: cv1 sửa thông tin giao được; cv2 (Owner) không; đề nghị sửa của cv2 → cấp duyệt = cv1, cv1 được đếm và duyệt', async () => {
    assertOk(await (await userClient('demo_cv1')).rpc('sua_thong_tin_giao', { p_id: nv1, p_thay_doi: { noi_dung: `${KHOA} demo_cv1 1 (đã sửa)` }, p_ly_do: 'bổ sung yêu cầu' }), 'cv1 sửa thông tin giao');
    ma(await (await userClient('demo_cv2')).rpc('sua_thong_tin_giao', { p_id: nv1, p_thay_doi: { noi_dung: 'x' }, p_ly_do: 'x' }), '42501', 'cv2 không phải tầng giao');
    const dn = await (await userClient('demo_cv2')).rpc('de_nghi_sua_gui', { p_nhiem_vu: nv1, p_thay_doi: { san_pham_mo_ta: 'Báo cáo tổng hợp' }, p_ly_do: 'nêu rõ sản phẩm' });
    assertOk(dn, 'cv2 đề nghị sửa');
    assert.equal((await db().from('de_nghi_sua').select('cap_duyet').eq('id', dn.data).single()).data.cap_duyet, IDS.cv1, 'cấp duyệt = chuyên viên giao');
    const cv1 = await userClient('demo_cv1');
    assert.ok(Number((await cv1.rpc('kl_so_chua_xu_ly')).data?.de_nghi_sua) >= 1, 'cv1 có đề nghị sửa chờ duyệt');
    assertOk(await cv1.rpc('de_nghi_sua_duyet', { p_id: dn.data, p_dong_y: true, p_y_kien: 'đồng ý' }), 'cv1 duyệt');
    assert.equal((await db().from('nhiem_vu').select('san_pham_mo_ta').eq('id', nv1).single()).data.san_pham_mo_ta, 'Báo cáo tổng hợp');
  });

  test('6. cấu hình 2: giao mới → Owner (= người theo dõi nội bộ, v3.31) tự động "đã nhận", viec_moi của Owner = 0, tin tới Owner dù Trưởng phòng giao độ khẩn Thường; giao lại → chủ trì mới tự nhận; từ chối bị chặn; cấu hình 1 → việc cũ vẫn chờ nhận', async () => {
    assertOk(await datCauHinh('2'), 'đặt cấu hình 2');
    const cv1 = await userClient('demo_cv1');
    const viecMoiTruoc = Number((await cv1.rpc('kl_so_chua_xu_ly')).data?.viec_moi);
    const r = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r, 'Trưởng phòng giao cv1');
    // v3.31 (0128): người theo dõi = chủ trì cv1 — Trưởng phòng (người giao) không còn là người theo dõi nên không tự "đã nhận"
    assert.deepEqual(await daNhan(r.data.id), [IDS.cv1], 'chỉ Owner (= theo dõi nội bộ) tự nhận');
    const v = (await db().from('v_nhiem_vu').select('da_xac_nhan_nhan, nguoi_da_nhan').eq('id', r.data.id).single()).data;
    assert.ok(v.da_xac_nhan_nhan && v.nguoi_da_nhan.includes(IDS.cv1), 'v_nhiem_vu đọc được trạng thái đã nhận');
    assert.ok((await nguoiNhanTin(r.data.id)).includes(IDS.cv1), 'cấu hình 2: Owner luôn có tin giao');
    assert.equal(Number((await cv1.rpc('kl_so_chua_xu_ly')).data?.viec_moi), viecMoiTruoc, 'viec_moi của Owner không tăng (đã nhận tự động)');
    assert.equal(Number((await (await userClient('demo_cv2')).from('v_nhiem_vu').select('id').eq('id', r.data.id)).data?.length), 0, 'cv2 không liên quan: không thấy');
    ma(await cv1.rpc('de_nghi_tu_choi', { p_nhiem_vu: r.data.id, p_ly_do: 'x' }), '22023', 'đã nhận → không từ chối');
    assertOk(await (await userClient('demo_cvp')).rpc('chi_dao_gui', { p: { nhiem_vu_id: r.data.id, loai: 'GIAO_LAI', noi_dung: 'đổi người', chu_tri_moi: IDS.cv2 } }), 'Chánh VP giao lại cho cv2');
    assert.ok((await daNhan(r.data.id)).includes(IDS.cv2), 'chủ trì mới tự nhận');
    assert.deepEqual(await daNhan(nv1), [], 'việc giao dưới cấu hình 1 không được điền lại');
    assertOk(await datCauHinh('1'), 'về cấu hình 1');
    const r2 = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r2, 'giao dưới cấu hình 1');
    // v3.31 (0128): Trưởng phòng giao không còn là người theo dõi (= chủ trì cv1) ⇒ không ai "đã nhận" tự động (trước: Trưởng phòng theo dõi, 0090)
    assert.deepEqual(await daNhan(r2.data.id), [], 'cấu hình 1: chuyên viên chủ trì chờ xác nhận, không ai tự nhận');
    const v2 = (await db().from('v_nhiem_vu').select('da_xac_nhan_nhan, khau').eq('id', r2.data.id).single()).data;
    assert.equal(v2.da_xac_nhan_nhan, false, 'chủ trì chưa xác nhận → việc chưa nhận');
  });

  test('7. quản trị KL (cv2 cấp tạm) không chọn thay mặt → giao thẳng (phòng bị chặn); có thay mặt → như trước; giao_viec_nhieu của chuyên viên: theo dõi (nội bộ) = chủ trì từng dòng (v3.31)', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp quan_tri_kl tạm');
    ma(await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP' }), '42501', 'quản trị KL không thay mặt giao phòng');
    assertOk(await giao('demo_cv2', { owner_don_vi_ma: 'TONG_HOP', thay_mat_cho: IDS.cvp, nguoi_theo_doi: IDS.truongphong }), 'quản trị KL thay mặt Chánh VP giao phòng');
    await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
    const nhieu = await (await userClient('demo_cv1')).rpc('giao_viec_nhieu', { p_chung: { van_ban: vb(), nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' },
      p_dong: [{ noi_dung: `${KHOA} nhiều 1`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31' },
        { noi_dung: `${KHOA} nhiều 2`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31' }] });
    assertOk(nhieu, 'chuyên viên giao 2 việc một lượt'); assert.equal(nhieu.data.so, 2);
    // v3.31 (0128): người theo dõi (nội bộ) = chủ trì từng dòng (dòng 1: cv2, dòng 2: cv1) — không còn = người giao cv1
    const ds = await Promise.all(nhieu.data.viec.map((v) => doc(v.id)));
    assert.deepEqual(ds.map((d) => [d.owner_tai_khoan, d.nguoi_theo_doi]), [[IDS.cv2, IDS.cv2], [IDS.cv1, IDS.cv1]], 'theo dõi = chủ trì từng dòng');
  });
});
