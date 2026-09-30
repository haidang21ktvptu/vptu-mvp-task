// PR-2b (0056, mục 3.1–3.2) — GIAO_LAI dùng cùng nguồn chặn với giao_viec (kl_duoc_giao_cho_phong). Chỉ hành vi của PCVP đổi; mục 3.1 đổi
// riêng quan_tri_kl HẾT HẠN (trước đọc cờ thô). Không ghi dữ liệu ở ca "được": người theo dõi mới = uuid không tồn tại ⇒ hàm qua bước quyền rồi dừng
// ở 22023 "Người theo dõi mới không hợp lệ"; ca bị chặn ⇒ 42501. Khoá "KL-PQ-GL"; kiêm nhiệm pcvp2 (Tổng hợp / Tài chính) và cờ tạm dọn ở before/after.
//
// | Vai (việc chủ trì cv1 phòng Tổng hợp)                      | 0045 (trước)          | 0056 (sau)               |
// |------------------------------------------------------------|-----------------------|--------------------------|
// | A0                                                         | chặn (chỉ ý kiến/TT)  | chặn                     |
// | Chánh VP → cán bộ phòng khác                               | được                  | được                     |
// | PCVP phụ trách cả phòng → cán bộ Tổng hợp (lĩnh vực thường)| được                  | được                     |
// | PCVP phụ trách cả phòng, việc lĩnh vực người khác kiêm nhiệm | được (phu_trach)    | CHẶN (đổi — như C3)      |
// | PCVP → cán bộ phòng không phụ trách                        | chặn                  | chặn                     |
// | PCVP kiêm nhiệm → cán bộ Tổng hợp, đúng lĩnh vực kiêm nhiệm | chặn (không cả phòng) | ĐƯỢC (đổi — như C3)      |
// | PCVP kiêm nhiệm, người theo dõi mới ngoài phạm vi          | được (không kiểm)     | CHẶN (đổi — như giao_viec)|
// | A2 → cùng phòng / phòng khác                               | được / chặn           | được / chặn              |
// | A3 giữ quan_tri_kl (giao thay mặt) / thư ký Thường trực     | chặn (không chỉ đạo)  | chặn                     |
// | A2 giữ quan_tri_kl còn hạn → phòng khác                     | được                  | được                     |
// | A2 giữ quan_tri_kl HẾT HẠN → phòng khác                     | được (cờ thô)         | chặn (mục 3.1)           |
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, homNayVN } from './lib.mjs';
import { setupKlFixtures, klSchemaReady, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) && (await linhVucReady()) ? false : 'Chưa có migration KL / dm_linh_vuc trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ-GL';
const OWNER_E2E = '00000000-0000-4000-8000-000000000014';   // demo_e2e_owner — A3 Tổng hợp
const TK = '00000000-0000-4000-8000-000000000018';          // demo_e2e_tk — A3, cờ thư ký tạm
const KHONG_CO = '00000000-0000-4000-8000-0000000000ff';
let fx; const id = {};
const hqua = () => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
const them = async (ma, row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true,
    ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
};
const giaoLai = async (username, ma, chuTri, theoDoi = KHONG_CO) => (await userClient(username)).rpc('chi_dao_gui', { p: {
  nhiem_vu_id: id[ma], loai: 'GIAO_LAI', noi_dung: `${KHOA} giao lại`, chu_tri_moi: chuTri, nguoi_theo_doi_moi: theoDoi } });
const duoc = (r, label) => assert.match(r.error?.message || '', /Người theo dõi mới không hợp lệ/, `${label} phải QUA bước quyền: ${r.error?.message}`);
const chan = (r, label) => assert.equal(r.error?.code, '42501', `${label} phải bị chặn: ${r.error?.message || 'không lỗi'}`);
const khoiPhuc = () => Promise.all([
  db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.truongphong),
  db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK),
  db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2)]);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('phu_trach_phong').delete().like('ly_do', `${KHOA}%`);
  await khoiPhuc();
};

describe('0056 — GIAO_LAI theo phạm vi giao (chỉ PCVP đổi hành vi)', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    assertOk(await db().from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH',
      tu_ngay: '2026-01-01', den_ngay: null, ly_do: `${KHOA} kiêm nhiệm`, phan_cong_boi: IDS.qtht }), 'kiêm nhiệm pcvp2');
    await Promise.all([them('DT', { linh_vuc_ma: 'LV08_DAU_TU' }), them('TC', { linh_vuc_ma: 'LV08_TAI_CHINH' }),
      them('TC2', { linh_vuc_ma: 'LV08_TAI_CHINH', nguoi_theo_doi: IDS.pcvp })]);
  });
  after(don);

  test('1. Vai giữ nguyên như 0045: A0, Chánh VP, PCVP cả phòng (lĩnh vực thường / phòng khác), A2 cùng / khác phòng, A3 quan_tri_kl, thư ký', async () => {
    await Promise.all([db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK)]);
    const [a0, cvp, pcvp, pcvpNgoai, a2, a2Ngoai, a3qt, tk] = await Promise.all([
      giaoLai('demo_a0', 'DT', OWNER_E2E), giaoLai('demo_cvp', 'DT', IDS.cv2), giaoLai('demo_pcvp', 'DT', OWNER_E2E), giaoLai('demo_pcvp', 'DT', IDS.cv2),
      giaoLai('demo_truongphong', 'DT', OWNER_E2E), giaoLai('demo_truongphong', 'DT', IDS.cv2), giaoLai('demo_cv2', 'DT', OWNER_E2E), giaoLai('demo_e2e_tk', 'DT', OWNER_E2E)]);
    chan(a0, 'A0'); duoc(cvp, 'Chánh VP'); duoc(pcvp, 'PCVP cả phòng'); chan(pcvpNgoai, 'PCVP → phòng không phụ trách');
    duoc(a2, 'A2 cùng phòng'); chan(a2Ngoai, 'A2 → phòng khác'); chan(a3qt, 'A3 giữ quan_tri_kl'); chan(tk, 'thư ký Thường trực');
    await khoiPhuc();
  });

  test('2. PCVP đổi: kiêm nhiệm được giao lại trong lĩnh vực kiêm nhiệm; cả phòng mất quyền với lĩnh vực người khác kiêm nhiệm; theo dõi mới ngoài phạm vi bị chặn', async () => {
    duoc(await giaoLai('demo_pcvp2', 'TC', OWNER_E2E), 'PCVP2 kiêm nhiệm Tài chính');
    chan(await giaoLai('demo_pcvp', 'TC2', OWNER_E2E), 'PCVP cả phòng, lĩnh vực đã có người kiêm nhiệm (thấy việc vì là người theo dõi)');
    const r = await giaoLai('demo_pcvp2', 'TC', OWNER_E2E, IDS.qtht);   // theo dõi mới phòng CDS_CY — ngoài phạm vi PCVP2
    chan(r, 'PCVP2 chọn người theo dõi ngoài phạm vi'); assert.match(r.error.message, /Người theo dõi phải thuộc phòng/);
  });

  test('3. Mục 3.1: A2 giữ quan_tri_kl còn hạn giao lại sang phòng khác được; hết hạn (cờ chưa thu) ⇒ theo quyền A2, bị chặn', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true, quan_tri_kl_het_han: homNayVN() }).eq('id', IDS.truongphong), 'còn hạn');
    duoc(await giaoLai('demo_truongphong', 'DT', IDS.cv2), 'quan_tri_kl còn hạn');
    assertOk(await db().from('accounts').update({ quan_tri_kl_het_han: hqua() }).eq('id', IDS.truongphong), 'hết hạn');
    chan(await giaoLai('demo_truongphong', 'DT', IDS.cv2), 'quan_tri_kl hết hạn');
    await khoiPhuc();
  });
});
