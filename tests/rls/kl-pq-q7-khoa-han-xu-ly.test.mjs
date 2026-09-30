// Q7 (thiết kế PR-2, chốt 28/9/2026) — DL-5/CB-4: chỉ GIA_HAN đổi hạn. Owner / người theo dõi (không phải quan_tri_kl) chỉ được
// ĐIỀN han_xu_ly khi đang NULL (việc cũ "Cần điền hạn"); đổi hạn đang có phải bị chặn. Hiện guard 0026 để han_xu_ly trong danh
// sách cột được sửa, policy UPDATE cho Owner/người theo dõi ⇒ lỗ hổng. Vá ở 0052 (PR-2a): guard chặn đổi hạn đang có qua API.
// Khoá dữ liệu: "KL-PQ-Q7"; tự dọn ở before lẫn after.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ-Q7';
const HAN = '2026-12-31';
let fx; const id = {};
const them = async (ma, row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: HAN,
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP',
    owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.cvp, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
};
const han = async (ma) => (await db().from('nhiem_vu').select('han_xu_ly').eq('id', id[ma]).single()).data?.han_xu_ly;
// Đổi hạn bằng UPDATE thẳng; "bị chặn" = có lỗi hoặc 0 dòng, và hạn trong DB giữ nguyên.
const doiHan = async (username, ma, gia_tri) => (await userClient(username)).from('nhiem_vu').update({ han_xu_ly: gia_tri }).eq('id', id[ma]).select('id');
const assertChan = async (r, ma, cu, label) => {
  assert.ok(r.error || (r.data || []).length === 0, `${label}: phải bị chặn nhưng UPDATE thành công`);
  assert.equal(await han(ma), cu, `${label}: hạn trong DB phải giữ nguyên`);
};
const don = () => db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);

describe('Q7 — Owner / người theo dõi không tự đổi han_xu_ly (chỉ GIA_HAN)', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them('Q7A', {});
    await them('Q7B', {});
    await them('Q7C', { han_xu_ly: null, ly_do_chua_co_han: `${KHOA} chưa có hạn` });
  });
  after(don);

  test('1. Owner A3 (cv1) lùi han_xu_ly của việc đang có hạn phải bị chặn', async () => {
    await assertChan(await doiHan('demo_cv1', 'Q7A', '2027-06-30'), 'Q7A', HAN, 'Owner cv1 đổi hạn');
  });

  test('2. Người theo dõi (truongphong) đổi han_xu_ly của việc đang có hạn phải bị chặn', async () => {
    await assertChan(await doiHan('demo_truongphong', 'Q7B', '2027-03-31'), 'Q7B', HAN, 'Người theo dõi đổi hạn');
  });

  test('3. Owner điền han_xu_ly khi đang NULL (việc "Cần điền hạn") vẫn được', async () => {
    const r = await doiHan('demo_cv1', 'Q7C', '2026-11-30');
    assertOk(r, 'Owner điền hạn'); assert.equal((r.data || []).length, 1, 'phải cập nhật 1 dòng');
    assert.equal(await han('Q7C'), '2026-11-30');
  });
});
