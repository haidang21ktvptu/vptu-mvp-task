// 0128 (v3.31, chủ dự án quyết 23/10/2026 — "Bỏ đi → chỉ còn Chủ trì theo dõi"): nhiem_vu.nguoi_theo_doi là trường NỘI BỘ = người đại diện của chủ
// trì theo dõi (kl_dai_dien_chu_tri: cán bộ chủ trì; phòng → Trưởng phòng; Văn phòng Tỉnh ủy → Chánh Văn phòng; đơn vị ngoài / phòng chưa có Trưởng
// phòng → giữ giá trị ghi) — trigger ab_nhiem_vu_theo_doi_chu_tri trên MỌI đường ghi (quyền dịch vụ, giao_viec, chuyên viên giao thẳng, giao lại);
// chủ trì không tự trả lại / đánh giá minh chứng (kl_duoc_nghiem_thu bỏ nhánh người theo dõi), Trưởng phòng vẫn được; Quản trị › "Chuyển việc đang
// chủ trì theo dõi" (admin_chuyen_theo_doi): chuyển chủ trì việc đang mở (đơn vị, cấp nhận theo người mới), việc đã hoàn thành giữ nguyên; lịch sử,
// tin người nhận, nhật ký; người không phải quản trị bị chặn. Khoá "KL-0128"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0128';
const KL = '00000000-0000-4000-8000-000000000010';   // demo_e2e_kl (A3, Tổng hợp)
const MC = '00000000-0000-4000-8000-000000000011';   // demo_e2e_mc (A3, Tổng hợp) — người cũ của hộp chuyển việc (không spec RLS nào khác giao việc)
const coMig = async () => {   // 0128: hàm chuyển việc báo lỗi bằng câu mới "… chuyển việc chủ trì theo dõi"
  const r = await (await userClient('demo_cv1')).rpc('admin_chuyen_theo_doi', { p_tu: MC, p_den: IDS.cv1, p_ly_do: null, p_thuc_hien: false });
  return /chủ trì theo dõi/.test(r.error?.message || '');
};
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coMig()) ? 'Chưa có migration 0128.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let vb = null; const v = {};
const viec = async (k, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(40), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.pcvp,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const td = async (k) => (await db().from('nhiem_vu').select('nguoi_theo_doi').eq('id', v[k].id).single()).data.nguoi_theo_doi;
const gv = async (u, p) => (await userClient(u)).rpc('giao_viec', { p: { van_ban_id: vb, han_xu_ly: cong(30), san_pham_loai: 'TO_TRINH', nganh_ma: 'KINH_TE_TONG_HOP',
  linh_vuc_ma: 'LV08_TAI_CHINH', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...p } });
const don = async () => {
  await db().from('direct_messages').delete().like('content', `%${KHOA}%`);
  await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'chuyen_theo_doi').like('chi_tiet->>ly_do', `${KHOA}%`);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0128 — chỉ còn chủ trì theo dõi: người theo dõi nội bộ theo chủ trì', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} VB`, ngay_ban_hanh: cong(-10), ngay_nhan: cong(-9) }).select('id').single();
    assertOk(r, 'văn bản'); vb = r.data.id;
  });
  after(don);

  test('1. Ghi bằng quyền dịch vụ: người theo dõi luôn = người đại diện của chủ trì; đổi riêng người theo dõi bị trả về; đổi chủ trì → theo chủ trì mới', async () => {
    await viec('CB');   // gửi Trưởng phòng làm người theo dõi
    await viec('PH', { owner_tai_khoan: null, nguoi_theo_doi: IDS.cv1 });
    await viec('PQ', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: null, nguoi_theo_doi: IDS.cv2 });   // phòng chưa có Trưởng phòng (seed)
    await viec('VP', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: null, nguoi_theo_doi: IDS.cv1, cap_nhan_san_pham: 'THUONG_TRUC' });
    await viec('NG', { owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: null, nguoi_theo_doi: IDS.cv1 });   // dữ liệu cũ: đơn vị ngoài Văn phòng
    assert.equal(await td('CB'), IDS.cv1, 'chủ trì cán bộ → chính cán bộ (Trưởng phòng gửi kèm bị ghi đè)');
    assert.equal(await td('PH'), IDS.truongphong, 'chủ trì là phòng → Trưởng phòng');
    assert.equal(await td('PQ'), IDS.cv2, 'phòng chưa có Trưởng phòng → giữ giá trị ghi');
    assert.equal(await td('VP'), IDS.cvp, 'Văn phòng Tỉnh ủy → Chánh Văn phòng');
    assert.equal(await td('NG'), IDS.cv1, 'đơn vị ngoài → giữ cán bộ Văn phòng đang ghi');
    assertOk(await db().from('nhiem_vu').update({ nguoi_theo_doi: IDS.pcvp }).eq('id', v.CB.id), 'đổi riêng người theo dõi');
    assert.equal(await td('CB'), IDS.cv1, 'đổi riêng người theo dõi → trả về chủ trì');
    assertOk(await db().from('nhiem_vu').update({ owner_tai_khoan: IDS.cv2, owner_don_vi_ma: 'QUAN_TRI', cap_nhan_san_pham: 'PHO_CHANH_VAN_PHONG' }).eq('id', v.CB.id), 'đổi chủ trì');
    assert.equal(await td('CB'), IDS.cv2, 'đổi chủ trì → người theo dõi theo chủ trì mới');
    assertOk(await db().from('nhiem_vu').update({ owner_tai_khoan: IDS.cv1 }).eq('id', v.PH.id), 'việc phòng giao cho cán bộ');
    assert.equal(await td('PH'), IDS.cv1);
    assertOk(await db().from('nhiem_vu').update({ ghi_chu: `${KHOA} sửa ô khác` }).eq('id', v.NG.id), 'sửa ô khác');
    assert.equal(await td('NG'), IDS.cv1, 'sửa ô khác không đụng người theo dõi');
  });

  test('2. Giao việc, chuyên viên giao thẳng, lãnh đạo giao cho phòng, giao lại — người theo dõi theo chủ trì (không còn là người giao)', async () => {
    const a = await gv('demo_truongphong', { noi_dung: `${KHOA} TP giao`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });   // không gửi người theo dõi
    assertOk(a, 'Trưởng phòng giao'); v.GA = { id: a.data.id };
    const b = await gv('demo_cv1', { noi_dung: `${KHOA} CV giao thẳng`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.truongphong });
    assertOk(b, 'chuyên viên giao thẳng'); v.GB = { id: b.data.id };
    const c = await gv('demo_cvp', { noi_dung: `${KHOA} CVP giao phòng`, owner_don_vi_ma: 'TONG_HOP' });
    assertOk(c, 'Chánh VP giao cho phòng'); v.GC = { id: c.data.id };
    const doc = async (k) => (await db().from('nhiem_vu').select('nguoi_theo_doi, tao_boi').eq('id', v[k].id).single()).data;
    assert.deepEqual(await doc('GA'), { nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong });
    assert.deepEqual(await doc('GB'), { nguoi_theo_doi: IDS.cv2, tao_boi: IDS.cv1 });
    assert.deepEqual(await doc('GC'), { nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.cvp });
    const gl = await (await userClient('demo_truongphong')).rpc('chi_dao_gui', { p: { nhiem_vu_id: v.GA.id, loai: 'GIAO_LAI', noi_dung: `${KHOA} giao lại`, chu_tri_moi: KL } });
    assertOk(gl, 'giao lại (không gửi người theo dõi mới)');
    assert.deepEqual((await db().from('nhiem_vu').select('owner_tai_khoan, nguoi_theo_doi').eq('id', v.GA.id).single()).data, { owner_tai_khoan: KL, nguoi_theo_doi: KL });
  });

  test('3. Trả lại / đánh giá minh chứng: chủ trì không tự xem lại việc của mình; Trưởng phòng (lãnh đạo trong phạm vi) vẫn được', async () => {
    await viec('NT');
    const hoi = async (u) => (await userClient(u)).rpc('kl_duoc_nghiem_thu', { p_nhiem_vu: v.NT.id });
    const cv = await hoi('demo_cv1'); assertOk(cv, 'chủ trì hỏi'); assert.equal(cv.data, false, 'chủ trì (= người theo dõi nội bộ) không nghiệm thu');
    const tp = await hoi('demo_truongphong'); assertOk(tp, 'Trưởng phòng hỏi'); assert.equal(tp.data, true, 'Trưởng phòng nghiệm thu được');
  });

  test('4. Quản trị › Chuyển việc đang chủ trì theo dõi: chặn người không phải quản trị; xem trước; chuyển chủ trì việc đang mở, giữ việc đã hoàn thành; lịch sử, tin, nhật ký', async () => {
    await viec('CK1', { owner_tai_khoan: MC });
    await viec('CK2', { owner_tai_khoan: MC, tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-1), nguon: 'excel' });
    const goi = async (u, p) => (await userClient(u)).rpc('admin_chuyen_theo_doi', { p_tu: MC, p_den: IDS.cv1, ...p });
    const chan = await goi('demo_truongphong', { p_ly_do: null, p_thuc_hien: false });
    assert.match(chan.error?.message || '', /Chỉ quản trị hệ thống hoặc Chánh Văn phòng mới chuyển việc chủ trì theo dõi/);
    const xem = await goi('demo_qtht', { p_ly_do: null, p_thuc_hien: false }); assertOk(xem, 'xem trước');
    assert.equal(xem.data.so_viec, 1); assert.deepEqual(xem.data.ma, [v.CK1.ma]);
    const lam = await goi('demo_qtht', { p_ly_do: `${KHOA} chuyển công tác`, p_thuc_hien: true }); assertOk(lam, 'thực hiện');
    assert.equal(lam.data.so_viec, 1); assert.deepEqual(lam.data.bo_qua, []);
    const ck1 = (await db().from('nhiem_vu').select('owner_tai_khoan, owner_don_vi_ma, nguoi_theo_doi, cap_nhan_san_pham').eq('id', v.CK1.id).single()).data;
    assert.deepEqual(ck1, { owner_tai_khoan: IDS.cv1, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.cv1, cap_nhan_san_pham: 'TRUONG_PHONG' });
    assert.equal((await db().from('nhiem_vu').select('owner_tai_khoan').eq('id', v.CK2.id).single()).data.owner_tai_khoan, MC, 'việc đã hoàn thành giữ nguyên');
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.CK1.id).eq('cot', 'chuyen_theo_doi')).data;
    assert.ok(ls.some((l) => /^Chuyển chủ trì theo dõi từ .+ sang .+ — lý do: KL-0128 chuyển công tác$/.test(l.gia_tri_moi)), JSON.stringify(ls));
    const tin = (await db().from('direct_messages').select('content').eq('receiver_id', IDS.cv1).like('content', `%${KHOA}%`)).data;
    assert.ok(tin.some((t) => t.content.startsWith('Đồng chí được giao chủ trì theo dõi 1 nhiệm vụ đang mở')), JSON.stringify(tin));
    const nk = (await db().from('nhat_ky_he_thong').select('doi_tuong').eq('hanh_dong', 'chuyen_theo_doi').like('chi_tiet->>ly_do', `${KHOA}%`)).data;
    assert.deepEqual(nk, [{ doi_tuong: 'demo_cv1' }], 'một dòng nhật ký hệ thống');
  });
});
