// 0087–0088 (Đợt C2 v3.19): thông tin nguồn của nhiệm vụ — loại văn bản KL_BCH / NQ_BCH; muc_quan_trong (A/B/C), co_quan_trinh (đơn vị ngoài Văn
// phòng), thuong_truc_chi_dao (tài khoản A0) qua giao_viec / giao_viec_nhieu (phần chung), giao tiếp xuống kế thừa, Thường trực giao → chính mình;
// stt_van_ban tự tăng trong văn bản; ba ô là ô tầng giao (sửa thông tin giao, đề nghị sửa), Owner không UPDATE trực tiếp; nop_minh_chung báo riêng khi
// việc chưa có cấp nhận; cấu hình so bằng số ('02' = 2). Khoá "KL-0087"; cấu hình khôi phục; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0087';
const co0087 = async () => !(await db().from('nhiem_vu').select('stt_van_ban').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await co0087()) ? 'Chưa có migration 0087 (nhiem_vu.stt_van_ban).' : false;
let dem = 0; let cauHinhCu = '1';
const vb = (loai = 'CONG_VAN', them = {}) => ({ loai, so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02', ...them });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 };
const giao = async (username, p) => (await userClient(username)).rpc('giao_viec', { p: { noi_dung: `${KHOA} ${username} ${++dem}`, ...CHUNG, ...p } });
const doc = async (id) => (await db().from('v_nhiem_vu').select('stt_van_ban, muc_quan_trong, co_quan_trinh, co_quan_trinh_ten, thuong_truc_chi_dao, thuong_truc_chi_dao_ten, van_ban_loai').eq('id', id).single()).data;
const loi = (r, re, label) => { assert.ok(r.error, `${label}: phải bị chặn`); assert.match(r.error.message, re, `${label}: ${r.error.message}`); };
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`).not('nhiem_vu_cha', 'is', null);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0087–0088 — thông tin nguồn, mã theo nguồn (STT), loại văn bản Ban Chấp hành', { skip: SKIP }, () => {
  before(async () => { cauHinhCu = (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'pham_vi_chuyen_vien').single()).data.gia_tri; await don(); });
  after(async () => { await don(); await db().from('kl_cau_hinh').update({ gia_tri: cauHinhCu }).eq('khoa', 'pham_vi_chuyen_vien'); });
  let d1; let vb1;

  test('1. Chánh VP giao (Nghị quyết BCH) kèm ba ô nguồn — mức "b" → B; STT 1; giao thêm vào cùng văn bản → STT 2, không kế thừa ô nguồn', async () => {
    const r = await giao('demo_cvp', { van_ban: vb('NQ_BCH', { so_hoi_nghi: 5 }), nguoi_theo_doi: IDS.truongphong, muc_quan_trong: 'b', co_quan_trinh: 'DANG_UY_UBND', thuong_truc_chi_dao: IDS.a0 });
    assertOk(r, 'giao NQ_BCH'); d1 = r.data.id; vb1 = r.data.van_ban_id;
    const x = await doc(d1);
    assert.deepEqual([x.van_ban_loai, x.stt_van_ban, x.muc_quan_trong, x.co_quan_trinh, x.thuong_truc_chi_dao], ['NQ_BCH', 1, 'B', 'DANG_UY_UBND', IDS.a0]);
    assert.ok(x.co_quan_trinh_ten && x.thuong_truc_chi_dao_ten, 'view có tên đơn vị, tên Thường trực');
    const r2 = await giao('demo_cvp', { van_ban_id: vb1, nguoi_theo_doi: IDS.truongphong });
    assertOk(r2, 'giao thêm'); const y = await doc(r2.data.id);
    assert.deepEqual([y.stt_van_ban, y.muc_quan_trong, y.co_quan_trinh, y.thuong_truc_chi_dao], [2, null, null, null]);
  });

  test('2. Sai giá trị bị chặn với câu tiếng Việt: mức D; cơ quan trình là phòng của Văn phòng; Thường trực chỉ đạo không phải tài khoản A0', async () => {
    loi(await giao('demo_cvp', { van_ban: vb(), muc_quan_trong: 'D' }), /Mức quan trọng chỉ nhận A, B hoặc C/, 'mức D');
    loi(await giao('demo_cvp', { van_ban: vb(), co_quan_trinh: 'TONG_HOP' }), /Cơ quan trình phải là cơ quan, đơn vị ngoài Văn phòng/, 'cơ quan trình trong VP');
    loi(await giao('demo_cvp', { van_ban: vb(), thuong_truc_chi_dao: IDS.cvp }), /Thường trực chỉ đạo phải là tài khoản/, 'TT chỉ đạo là CVP');
    assert.equal((await db().from('van_ban_giao_viec').select('id').like('so_ket_luan', `${KHOA}%`)).data.length, 1, 'không tạo văn bản khi bị chặn');
  });

  test('3. giao_viec_nhieu (Kết luận BCH): phần chung có cơ quan trình → mọi dòng; dòng ghi đè mức; STT 1..3 theo thứ tự dòng', async () => {
    const r = await (await userClient('demo_cvp')).rpc('giao_viec_nhieu', { p_chung: { van_ban: vb('KL_BCH'), ...CHUNG, nguoi_theo_doi: IDS.truongphong, co_quan_trinh: 'BAN_TO_CHUC' },
      p_dong: [{ noi_dung: `${KHOA} lô a` }, { noi_dung: `${KHOA} lô b`, muc_quan_trong: 'A' }, { noi_dung: `${KHOA} lô c` }] });
    assertOk(r, 'giao lô');
    const ds = await Promise.all(r.data.viec.map((v) => doc(v.id)));
    assert.deepEqual(ds.map((x) => [x.stt_van_ban, x.muc_quan_trong, x.co_quan_trinh, x.van_ban_loai]),
      [[1, null, 'BAN_TO_CHUC', 'KL_BCH'], [2, 'A', 'BAN_TO_CHUC', 'KL_BCH'], [3, null, 'BAN_TO_CHUC', 'KL_BCH']]);
  });

  test('4. Giao tiếp xuống kế thừa ba ô nguồn của việc cha (chỉ việc thấy được); Thường trực giao → Thường trực chỉ đạo là chính người giao', async () => {
    const r = await giao('demo_truongphong', { van_ban_id: vb1, nhiem_vu_cha: d1 });
    assertOk(r, 'giao tiếp xuống'); const x = await doc(r.data.id);
    assert.deepEqual([x.stt_van_ban, x.muc_quan_trong, x.co_quan_trinh, x.thuong_truc_chi_dao], [3, 'B', 'DANG_UY_UBND', IDS.a0]);
    const an = await giao('demo_cv2', { van_ban: vb(), owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nhiem_vu_cha: d1 });   // cv2 không thấy việc cha
    assertOk(an, 'giao với việc cha không thấy được'); const z = await doc(an.data.id);
    assert.deepEqual([z.muc_quan_trong, z.co_quan_trinh, z.thuong_truc_chi_dao], [null, null, null], 'không kế thừa từ việc không thấy được');
    const a = await giao('demo_a0', { van_ban: vb('KHAC'), owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp });
    assertOk(a, 'Thường trực giao'); assert.equal((await doc(a.data.id)).thuong_truc_chi_dao, IDS.a0);
  });

  test('5. Ô tầng giao: người giao sửa mức + cơ quan trình (lịch sử từng cột), sai giá trị bị chặn, bỏ Thường trực chỉ đạo; Trưởng phòng không phải người giao bị chặn; Owner không UPDATE trực tiếp', async () => {
    const cvp = await userClient('demo_cvp');
    assertOk(await cvp.rpc('sua_thong_tin_giao', { p_id: d1, p_thay_doi: { muc_quan_trong: 'A', co_quan_trinh: 'BAN_NOI_CHINH' }, p_ly_do: 'theo giao ban' }), 'sửa');
    loi(await cvp.rpc('sua_thong_tin_giao', { p_id: d1, p_thay_doi: { co_quan_trinh: 'TONG_HOP' }, p_ly_do: 'x' }), /Cơ quan trình không hợp lệ/, 'sửa cơ quan trình trong VP');
    loi(await cvp.rpc('sua_thong_tin_giao', { p_id: d1, p_thay_doi: { thuong_truc_chi_dao: IDS.truongphong }, p_ly_do: 'x' }), /Thường trực chỉ đạo không hợp lệ/, 'sửa TT chỉ đạo');
    assertOk(await cvp.rpc('sua_thong_tin_giao', { p_id: d1, p_thay_doi: { thuong_truc_chi_dao: null }, p_ly_do: 'bỏ' }), 'bỏ TT chỉ đạo');
    const ls = (await db().from('lich_su').select('cot, gia_tri_cu, gia_tri_moi').eq('nhiem_vu_id', d1).in('cot', ['muc_quan_trong', 'co_quan_trinh', 'thuong_truc_chi_dao'])).data;
    assert.deepEqual(ls.map((l) => [l.cot, l.gia_tri_cu, l.gia_tri_moi]).sort(), [['co_quan_trinh', 'DANG_UY_UBND', 'BAN_NOI_CHINH'], ['muc_quan_trong', 'B', 'A'], ['thuong_truc_chi_dao', IDS.a0, null]]);
    assertDenied(await (await userClient('demo_truongphong')).rpc('sua_thong_tin_giao', { p_id: d1, p_thay_doi: { muc_quan_trong: 'C' }, p_ly_do: 'x' }), 'Trưởng phòng không phải người giao');
    const upd = await (await userClient('demo_cv1')).from('nhiem_vu').update({ muc_quan_trong: 'C' }).eq('id', d1).select('id');
    assert.ok(upd.error || (upd.data || []).length === 0, 'Owner UPDATE trực tiếp phải bị chặn');
    assert.equal((await doc(d1)).muc_quan_trong, 'A');
  });

  test('6. Owner đề nghị sửa Mức quan trọng → người giao chấp nhận → áp; nop_minh_chung: việc chưa có cấp nhận báo riêng', async () => {
    const g = await (await userClient('demo_cv1')).rpc('de_nghi_sua_gui', { p_nhiem_vu: d1, p_thay_doi: { muc_quan_trong: 'C' }, p_ly_do: 'việc thường kỳ' });
    assertOk(g, 'gửi đề nghị');
    assertOk(await (await userClient('demo_cvp')).rpc('de_nghi_sua_duyet', { p_id: g.data, p_dong_y: true }), 'chấp nhận');
    assert.equal((await doc(d1)).muc_quan_trong, 'C');
    assertOk(await db().from('nhiem_vu').update({ cap_nhan_san_pham: null }).eq('id', d1), 'dữ liệu cũ: bỏ cấp nhận');
    loi(await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: d1, so_hieu: '1/BC', ngay_van_ban: '2026-10-05' } }), /chưa ghi cấp nhận sản phẩm/, 'thiếu cấp nhận');
  });

  test('7. Cấu hình so bằng số: "02" = 2 (chuyên viên xem cả phòng), khôi phục', async () => {
    assertOk(await db().from('kl_cau_hinh').update({ gia_tri: '02' }).eq('khoa', 'pham_vi_chuyen_vien'), 'đặt 02');
    assert.equal((await (await userClient('demo_cv1')).rpc('kl_chuyen_vien_xem_phong')).data, true);
    assertOk(await db().from('kl_cau_hinh').update({ gia_tri: '1' }).eq('khoa', 'pham_vi_chuyen_vien'), 'đặt 1');
    assert.equal((await (await userClient('demo_cv1')).rpc('kl_chuyen_vien_xem_phong')).data, false);
  });
});
