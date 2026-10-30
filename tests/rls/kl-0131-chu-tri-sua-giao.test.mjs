// 0131 (v3.34, chủ dự án quyết 30/10/2026 — CAU-HOI T-1, T-2): chủ trì theo dõi tự sửa nhiệm vụ mình chủ trì. Lỗi báo: sau "Đổi chủ trì theo dõi"
// người nhận chủ trì (không phải người nhập việc) không sửa được thông tin giao, không tự điều chỉnh hạn việc quá hạn. Kịch bản: Trưởng phòng giao cho
// cv1 một việc đã quá hạn; thư ký Thường trực (demo_e2e_tk, cờ tạm) đổi chủ trì sang cv2. cv2: sửa thông tin giao (nội dung, mô tả sản phẩm), nguồn /
// đơn vị phối hợp, điều chỉnh hạn việc quá hạn — lịch sử ghi đủ, người giao được báo. Bị chặn: cv1 (chủ trì cũ, không phải người nhập), chuyên viên
// khác, việc đã hoàn thành; hạn mới trước hôm nay. Thêm: việc giao cho phòng (Trưởng phòng — người đại diện chủ trì) do Phó Chánh VP giao, việc từ Kết
// luận Ban Thường vụ (ngành bắt buộc) — chủ trì sửa được, bỏ ngành vẫn lỗi. Khoá "KL-0131"; cờ khôi phục; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0131';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk — thư ký Thường trực (cờ tạm)
const co = (bat) => db().from('accounts').update({ thu_ky_thuong_truc: bat }).eq('id', TK);
const coMig = async () => {   // 0131: câu báo quyền mới có "chủ trì theo dõi"
  const r = await (await userClient('demo_cv2')).rpc('sua_thong_tin_giao', { p_id: '00000000-0000-4000-8000-0000000000ff', p_thay_doi: { noi_dung: 'x' }, p_ly_do: 'x' });
  return /chủ trì theo dõi/.test(r.error?.message || '');
};
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coMig()) ? 'Chưa có migration 0131.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const vn = (iso) => iso.split('-').reverse().join('/');
let vb = null; let vbKl = null; const v = {};
const viec = async (k, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(-3), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const goi = async (u, ham, p) => (await userClient(u)).rpc(ham, p);
const sua = (u, k, p, lyDo = `${KHOA} đính chính`) => goi(u, 'sua_thong_tin_giao', { p_id: v[k].id, p_thay_doi: p, p_ly_do: lyDo });
const doc = async (k, cot) => (await db().from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;
const don = async () => {
  await co(false);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0131 — chủ trì theo dõi (kể cả người được chuyển sang) sửa thông tin giao, điều chỉnh hạn việc quá hạn', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} VB`, ngay_ban_hanh: cong(-40), ngay_nhan: cong(-39) }).select('id').single();
    assertOk(r, 'văn bản'); vb = r.data.id;
    await viec('T');
    await viec('XONG', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-5), nguon: 'excel' });
    await viec('PHONG', { owner_tai_khoan: null, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.pcvp, han_xu_ly: cong(30), cap_nhan_san_pham: 'PHO_CHANH_VAN_PHONG' });
    const k = await db().from('van_ban_giao_viec').insert({ loai: 'KL_BTV', so_hoi_nghi: 131, so_ket_luan: `${KHOA} KL`, ngay_ban_hanh: cong(-40), ngay_nhan: cong(-39) }).select('id').single();
    assertOk(k, 'kết luận BTV'); vbKl = k.data.id;
    await viec('KL', { van_ban_id: vbKl, han_xu_ly: cong(30), tao_boi: IDS.pcvp });
    assertOk(await co(true), 'cấp cờ thư ký');
    assertOk(await goi('demo_e2e_tk', 'doi_chu_tri', { p_id: v.T.id, p: { chu_tri: IDS.cv2 }, p_ly_do: `${KHOA} chủ trì cũ đi công tác` }), 'đổi chủ trì cv1 → cv2');
    assertOk(await co(false), 'thu cờ thư ký');
    assert.equal((await doc('T', 'owner_tai_khoan')).owner_tai_khoan, IDS.cv2);
  });
  after(don);

  test('1. Chủ trì mới (không phải người nhập) sửa ngay thông tin giao: nội dung, mô tả sản phẩm — lịch sử có lý do, người giao được báo', async () => {
    assertOk(await sua('demo_cv2', 'T', { noi_dung: `${KHOA} T (chủ trì mới sửa)`, san_pham_mo_ta: 'Báo cáo kèm phụ lục số liệu' }, 'Theo kết luận giao ban'), 'chủ trì sửa');
    assert.deepEqual(await doc('T', 'noi_dung, san_pham_mo_ta'), { noi_dung: `${KHOA} T (chủ trì mới sửa)`, san_pham_mo_ta: 'Báo cáo kèm phụ lục số liệu' });
    const ls = (await db().from('lich_su').select('gia_tri_moi, nguoi_sua').eq('nhiem_vu_id', v.T.id).eq('cot', 'sua_thong_tin_giao')).data;
    assert.equal(ls.length, 1); assert.equal(ls[0].nguoi_sua, IDS.cv2); assert.match(ls[0].gia_tri_moi, /lý do: Theo kết luận giao ban$/);
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v.T.id).like('content', 'Sửa thông tin giao%')).data.map((x) => x.receiver_id);
    assert.ok(tin.includes(IDS.truongphong), 'người giao việc được báo'); assert.ok(!tin.includes(IDS.cv2), 'người sửa không tự nhận tin');
  });

  test('2. Chủ trì mới sửa nguồn nhiệm vụ, đơn vị phối hợp (hộp Cập nhật)', async () => {
    assertOk(await goi('demo_cv2', 'dat_thong_tin_giao', { p_id: v.T.id, p_nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', p_don_vi_phoi_hop: `${KHOA} Sở Tài chính` }), 'nguồn, phối hợp');
    assert.equal((await doc('T', 'don_vi_phoi_hop')).don_vi_phoi_hop, `${KHOA} Sở Tài chính`);
  });

  test('3. Chủ trì mới tự điều chỉnh hạn việc đã quá hạn: gia hạn lần 1, lưu lịch sử; hạn mới trước hôm nay vẫn bị chặn', async () => {
    const loi = await goi('demo_cv2', 'dieu_chinh_han', { p_id: v.T.id, p_han_moi: cong(-1), p_ly_do: 'x' });
    assert.equal(loi.error?.code, '22023', loi.error?.message); assert.match(loi.error.message, /trước hôm nay/);
    const r = await goi('demo_cv2', 'dieu_chinh_han', { p_id: v.T.id, p_han_moi: cong(15), p_ly_do: 'Chờ số liệu của Sở' });
    assertOk(r, 'chủ trì điều chỉnh việc quá hạn'); assert.deepEqual([r.data.gia_han, r.data.so_lan_gia_han], [true, 1]);
    assert.equal((await doc('T', 'han_xu_ly')).han_xu_ly, cong(15));
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.T.id).eq('cot', 'dieu_chinh_han')).data.map((l) => l.gia_tri_moi);
    assert.deepEqual(ls, [`${vn(cong(-3))} → ${vn(cong(15))} (gia hạn lần 1) — lý do: Chờ số liệu của Sở`]);
  });

  test('4. Bị chặn (42501): chủ trì cũ (không phải người nhập), chuyên viên khác; việc đã hoàn thành — kể cả với chủ trì', async () => {
    for (const u of ['demo_cv1', 'demo_e2e_nv']) {
      assertDenied(await sua(u, 'T', { san_pham_mo_ta: 'x' }), `${u} sửa thông tin giao`);
      assertDenied(await goi(u, 'dat_thong_tin_giao', { p_id: v.T.id, p_nguon_nhiem_vu_ma: null, p_don_vi_phoi_hop: 'x' }), `${u} sửa phối hợp`);
      assertDenied(await goi(u, 'dieu_chinh_han', { p_id: v.T.id, p_han_moi: cong(20), p_ly_do: 'x' }), `${u} điều chỉnh hạn`);
    }
    assertDenied(await sua('demo_cv1', 'XONG', { san_pham_mo_ta: 'x' }), 'chủ trì sửa việc đã hoàn thành');
    assertDenied(await goi('demo_cv1', 'dat_thong_tin_giao', { p_id: v.XONG.id, p_nguon_nhiem_vu_ma: null, p_don_vi_phoi_hop: 'x' }), 'chủ trì sửa phối hợp việc đã hoàn thành');
  });

  test('5. Việc giao cho phòng (Phó Chánh VP giao): Trưởng phòng — người đại diện chủ trì — sửa ngay; việc từ Kết luận BTV: chủ trì sửa được, bỏ ngành vẫn lỗi', async () => {
    assertOk(await sua('demo_truongphong', 'PHONG', { san_pham_mo_ta: 'Báo cáo của phòng' }), 'Trưởng phòng (chủ trì việc của phòng) sửa');
    assertOk(await sua('demo_cv1', 'KL', { noi_dung: `${KHOA} KL (chủ trì sửa)` }), 'chủ trì sửa việc từ Kết luận BTV');
    const r = await sua('demo_cv1', 'KL', { nganh_ma: '' });
    assert.equal(r.error?.code, '22023', r.error?.message); assert.match(r.error.message, /ngành và lĩnh vực/);
    assertDenied(await sua('demo_cv2', 'KL', { san_pham_mo_ta: 'x' }), 'chuyên viên khác sửa việc Kết luận BTV');
  });
});
