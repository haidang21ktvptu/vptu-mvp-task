// PR-3 (0062–0067) — A. chất lượng hoàn thành khi nghiệm thu / đóng việc; B. nguồn nhiệm vụ (ép ở phiên người dùng, service_role không ép,
// ai đổi được); E. đơn vị phối hợp; D. tiến độ hoàn thành "Trước hạn" (logic thuần — chỉ cục bộ). Khoá "KL-PR3A"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, anonClient, assertOk, assertDenied, IDS, homNayVN, CHI_CUC_BO } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PR3A';
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const rpc = async (u, fn, args) => (await userClient(u)).rpc(fn, args);
const P = (p = {}) => ({ van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA} #1`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' },
  noi_dung: `${KHOA} việc`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
  nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP', ...p });
const nvRow = async (id) => (await db().from('nhiem_vu').select('*').eq('id', id).single()).data;
const nopMc = async (nv, so) => {
  const r = await rpc('demo_cv1', 'nop_minh_chung', { p: { nhiem_vu_id: nv, so_hieu: `${KHOA}/${so}`, ngay_van_ban: homNayVN(), cap_nhan: 'TRUONG_PHONG',
    trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'Đã gửi Trưởng phòng.' } });
  assertOk(r, `nộp ${so}`); return r.data;
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};
let nv; let vb;

describe('PR-3 A/B/E — chất lượng, nguồn nhiệm vụ, đơn vị phối hợp', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await rpc('demo_truongphong', 'giao_viec', { p: P({ nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', don_vi_phoi_hop: ' Phòng Quản trị; Sở Tài chính ' }) });
    assertOk(r, 'A2 giao'); nv = r.data.id; vb = r.data.van_ban_id;
  });
  after(don);

  test('B1. Phiên người dùng: thiếu / sai nguồn ⇒ lỗi; có nguồn ⇒ lưu đúng cột; service_role chèn không nguồn được; danh mục 6 dòng', async () => {
    const [thieu, sai] = await Promise.all([
      rpc('demo_truongphong', 'giao_viec', { p: P({ van_ban_id: vb, van_ban: undefined, nguon_nhiem_vu_ma: null }) }),
      rpc('demo_truongphong', 'giao_viec', { p: P({ van_ban_id: vb, van_ban: undefined, nguon_nhiem_vu_ma: 'KHONG_CO' }) })]);
    loi(thieu, /Phải chọn nguồn nhiệm vụ/, 'thiếu nguồn'); loi(sai, /không hợp lệ|violates foreign key/, 'mã lạ');
    const v = await nvRow(nv);
    assert.deepEqual([v.nguon_nhiem_vu_ma, v.don_vi_phoi_hop, v.nguon, v.chat_luong, v.vuong_mac], ['NHIEM_VU_PHAT_SINH', 'Phòng Quản trị; Sở Tài chính', 'app', null, null]);
    const sr = await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} service_role`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, theo_1400: false }).select('nguon, nguon_nhiem_vu_ma').single();
    assertOk(sr, 'service_role không bị ép'); assert.deepEqual([sr.data.nguon, sr.data.nguon_nhiem_vu_ma], ['app', null]);
    const dm = await rpc('demo_cv1', 'kl_danh_muc');
    assertOk(dm, 'kl_danh_muc');
    assert.deepEqual(dm.data.nguonNhiemVu.map((x) => x.ma), ['CHUONG_TRINH_CONG_TAC', 'NHIEM_VU_DINH_KY', 'LINH_VUC_TRONG_TAM', 'VAN_BAN_CAN_THEO_DOI',
      'NHIEM_VU_DA_BIET_TRUOC', 'NHIEM_VU_PHAT_SINH']);
    const an = await anonClient().from('dm_nguon_nhiem_vu').select('ma');
    assert.ok(an.error || an.data.length === 0, 'anon không đọc danh mục');
    const vbRow = (await db().from('van_ban_giao_viec').select('so_nhiem_vu_du_kien, da_ra_soat_toan_van, ra_soat_boi').eq('id', vb).single()).data;
    assert.deepEqual(vbRow, { so_nhiem_vu_du_kien: null, da_ra_soat_toan_van: false, ra_soat_boi: null });
  });

  test('B2. Ai đổi nguồn / đơn vị phối hợp: người giao (A2) và quan_tri_kl được; Owner, PCVP không phải người giao, A0 bị chặn; không bỏ nguồn', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('nhiem_vu').update({ nguon_nhiem_vu_ma: 'NHIEM_VU_DINH_KY' }).eq('id', nv).select('id'), 'Owner UPDATE nguồn (guard a3)');
    assertDenied(await cv1.from('nhiem_vu').update({ don_vi_phoi_hop: 'X' }).eq('id', nv).select('id'), 'Owner UPDATE đơn vị phối hợp (guard a3)');
    const goi = (u, ma, ph) => rpc(u, 'dat_thong_tin_giao', { p_id: nv, p_nguon_nhiem_vu_ma: ma, p_don_vi_phoi_hop: ph });
    const [ow, pc, a0] = await Promise.all([goi('demo_cv1', 'NHIEM_VU_DINH_KY', null), goi('demo_pcvp', 'NHIEM_VU_DINH_KY', null), goi('demo_a0', 'NHIEM_VU_DINH_KY', null)]);
    assertDenied(ow, 'Owner'); assertDenied(pc, 'PCVP không phải người giao'); assertDenied(a0, 'A0 không phải người giao');
    assertOk(await goi('demo_truongphong', 'LINH_VUC_TRONG_TAM', 'Sở Nội vụ'), 'người giao đổi');
    loi(await goi('demo_truongphong', null, 'Sở Nội vụ'), /Không bỏ nguồn/, 'bỏ nguồn');
    await db().from('accounts').update({ quan_tri_kl: true, quan_tri_kl_het_han: null }).eq('id', IDS.cv2);
    try { assertOk(await goi('demo_cv2', 'CHUONG_TRINH_CONG_TAC', ''), 'quan_tri_kl đổi'); } finally {
      await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
    }
    const v = await nvRow(nv); assert.deepEqual([v.nguon_nhiem_vu_ma, v.don_vi_phoi_hop], ['CHUONG_TRINH_CONG_TAC', null]);
    const ls = (await db().from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', nv).in('cot', ['nguon_nhiem_vu_ma', 'don_vi_phoi_hop'])).data;
    assert.equal(ls.filter((x) => x.cot === 'nguon_nhiem_vu_ma').length, 2, 'lịch sử ghi mỗi lần đổi nguồn');
  });

  test('A1. Nghiệm thu: bắt buộc chất lượng khi đóng việc; mã lạ / trả lại kèm chất lượng ⇒ lỗi; ghi cột + lịch sử "Nghiệm thu: Đạt tốt"', async () => {
    const m1 = await nopMc(nv, 1); const m2 = await nopMc(nv, 2);   // m2 còn chờ sau khi m1 đóng việc
    const xac = (p) => rpc('demo_truongphong', 'xac_nhan_minh_chung', { p_id: m1, ...p });
    const [thieu, la, traLai] = await Promise.all([xac({ p_hop_le: true }), xac({ p_hop_le: true, p_chat_luong: 'TOT' }),
      xac({ p_hop_le: false, p_ly_do: 'Thiếu', p_han_nop_lai: homNayVN(), p_chat_luong: 'DAT' })]);
    loi(thieu, /phải chọn chất lượng/, 'thiếu chất lượng'); loi(la, /không hợp lệ/, 'mã lạ'); loi(traLai, /không ghi chất lượng/, 'trả lại kèm chất lượng');
    assertDenied(await (await userClient('demo_cv1')).from('nhiem_vu').update({ chat_luong: 'DAT_XUAT_SAC' }).eq('id', nv).select('id'), 'Owner tự chấm qua API');
    assertOk(await xac({ p_hop_le: true, p_chat_luong: 'DAT_TOT' }), 'nghiệm thu Đạt tốt');
    const v = await nvRow(nv); assert.deepEqual([v.tien_do_ma, v.chat_luong], ['HOAN_THANH', 'DAT_TOT']);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv).eq('cot', 'dong_nhiem_vu')).data;
    assert.match(ls[0].gia_tri_moi, /Nghiệm thu: Đạt tốt/);
    const vv = (await (await userClient('demo_cv1')).from('v_nhiem_vu').select('chat_luong, nguon_nhiem_vu_ten').eq('id', nv).single()).data;
    assert.deepEqual(vv, { chat_luong: 'DAT_TOT', nguon_nhiem_vu_ten: 'Chương trình công tác năm' });
    loi(await rpc('demo_truongphong', 'xac_nhan_minh_chung', { p_id: m2, p_hop_le: true, p_chat_luong: 'DAT' }), /khi nghiệm thu đóng/, 'việc đã đóng');
    assertOk(await db().from('nhiem_vu').update({ tien_do_ma: 'DANG_THUC_HIEN', ngay_hoan_thanh: null }).eq('id', nv), 'mở lại (service_role)');
    assert.equal((await nvRow(nv)).chat_luong, null, 'mở lại ⇒ bỏ chất lượng');
  });

  test('A2. dong_nhiem_vu: Owner tự đóng kèm chất lượng ⇒ 42501; lãnh đạo trong phạm vi đóng kèm chất lượng được', async () => {
    const t = await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} đóng cũ`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, nguon_nhiem_vu_ma: 'NHIEM_VU_DINH_KY', theo_1400: false }).select('id').single();
    assertOk(t, 'việc không hạn nộp');
    assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: t.data.id, loai: 'so_hieu', so_hieu: `${KHOA}/D`, ngay_van_ban: '2026-09-10', cap_nhan: 'TRUONG_PHONG',
      nop_boi: IDS.cv1 }), 'minh chứng cũ');
    const dong = (u, cl) => rpc(u, 'dong_nhiem_vu', { p_id: t.data.id, p_ngay_hoan_thanh: null, p_chat_luong: cl });
    assertDenied(await dong('demo_cv1', 'DAT'), 'Owner tự chấm');
    loi(await dong('demo_truongphong', 'XYZ'), /không hợp lệ/, 'mã lạ');
    assertOk(await dong('demo_truongphong', 'DAT_XUAT_SAC'), 'Trưởng phòng đóng kèm chất lượng');
    const v = await nvRow(t.data.id); assert.deepEqual([v.tien_do_ma, v.ngay_hoan_thanh, v.chat_luong], ['HOAN_THANH', '2026-09-10', 'DAT_XUAT_SAC']);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', t.data.id).eq('cot', 'dong_nhiem_vu')).data;
    assert.match(ls[0].gia_tri_moi, /Nghiệm thu: Đạt xuất sắc/);
  });

  test('D. Tiến độ hoàn thành: Trước hạn / Đúng hạn / Trễ; ket_qua giữ DUNG_HAN cho cả trước hạn', { skip: CHI_CUC_BO }, async () => {
    const tao = (ht) => ({ van_ban_id: vb, noi_dung: `${KHOA} tiến độ ${ht}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-09-20', tien_do_ma: 'HOAN_THANH',
      ngay_hoan_thanh: ht, minh_chung: `${KHOA}/MC`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, theo_1400: false });
    const r = await db().from('nhiem_vu').insert(['2026-09-15', '2026-09-20', '2026-09-23'].map(tao)).select('id, ngay_hoan_thanh');
    assertOk(r, 'chèn 3 việc đã đóng');
    const v = (await db().from('v_nhiem_vu').select('ngay_hoan_thanh, tien_do_hoan_thanh, ket_qua').in('id', r.data.map((x) => x.id)).order('ngay_hoan_thanh')).data;
    assert.deepEqual(v.map((x) => [x.tien_do_hoan_thanh, x.ket_qua]), [['TRUOC_HAN', 'DUNG_HAN'], ['DUNG_HAN', 'DUNG_HAN'], ['TRE', 'TRE']]);
    const mo = (await db().from('v_nhiem_vu').select('tien_do_hoan_thanh').like('noi_dung', `${KHOA} service_role`).single()).data;
    assert.equal(mo.tien_do_hoan_thanh, null, 'việc chưa đóng');
  });
});
