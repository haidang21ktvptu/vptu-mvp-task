// GĐ14 (0022) — chuỗi cha–con (CH-3: hạn con ≤ hạn cha, không vòng) và Owner tài khoản (NT-1, CH-1, SPEC mục 2: Văn phòng →
// tài khoản A1; phòng → accounts.department = phong; đơn vị ngoài → không tài khoản). Dòng phòng của dm_don_vi chưa có (14C)
// nên test tự tạo một dòng phòng tạm 'TEST_PHONG' rồi xoá. Mã NV-T6x, nội dung 'KL-1400 …', tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {};
const base = () => ({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: 'KL-1400 cha con', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-09-30' });
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ ...base(), ...row }).select('id, ma').single();
  if (!r.error) id[r.data.ma] = r.data.id;
  return r;
};
const sua = (ma, patch) => db().from('nhiem_vu').update(patch).eq('ma', ma).select('id');
const loi = (r) => r.error?.message || '';
const don = async () => {
  await db().from('nhiem_vu').delete().like('ma', 'NV-T6%');
  await db().from('dm_don_vi').delete().eq('ma', 'TEST_PHONG');
};

describe('0022 — cha–con và Owner tài khoản', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    assertOk(await db().from('dm_don_vi').insert({ ma: 'TEST_PHONG', ten: 'KL-1400 Phòng thử', thu_tu: 99, trong_van_phong: true, phong: 'TONG_HOP' }), 'dòng phòng tạm');
  });
  after(don);

  test('1. con có hạn sau cha bị chặn; hạn ≤ cha được phép', async () => {
    assertOk(await them({ ma: 'NV-T60' }), 'cha hạn 30/09');
    assert.match(loi(await them({ ma: 'NV-T61', nhiem_vu_cha: id['NV-T60'], han_xu_ly: '2026-10-05' })), /nhiệm vụ con không được sau hạn/);
    assertOk(await them({ ma: 'NV-T61', nhiem_vu_cha: id['NV-T60'], han_xu_ly: '2026-09-20' }), 'con hạn 20/09');
  });

  test('2. tự tham chiếu (CHECK) và vòng cha ↔ con bị chặn; đổi cha hợp lệ được', async () => {
    assert.ok((await sua('NV-T60', { nhiem_vu_cha: id['NV-T60'] })).error, 'cha = chính mình');
    assert.match(loi(await sua('NV-T60', { nhiem_vu_cha: id['NV-T61'] })), /vòng tham chiếu/);
    assertOk(await them({ ma: 'NV-T62', han_xu_ly: '2026-12-31' }), 'cha khác');
    assertOk(await sua('NV-T61', { nhiem_vu_cha: id['NV-T62'] }), 'đổi sang cha khác');
    assertOk(await sua('NV-T61', { nhiem_vu_cha: id['NV-T60'] }), 'đổi lại');
  });

  test('3. rút hạn cha xuống trước hạn con bị chặn; lùi hạn cha (gia hạn) được', async () => {
    assert.match(loi(await sua('NV-T60', { han_xu_ly: '2026-09-10' })), /Không rút hạn nhiệm vụ cha/);
    assertOk(await sua('NV-T60', { han_xu_ly: '2026-10-15' }), 'gia hạn cha');
    const r = await db().from('nhiem_vu').select('han_xu_ly').eq('ma', 'NV-T60').single();
    assert.equal(r.data.han_xu_ly, '2026-10-15');
  });

  test('4. Owner = Văn phòng Tỉnh ủy: tài khoản A1 được, A3 bị chặn', async () => {
    assert.match(loi(await them({ ma: 'NV-T63', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cv1 })), /Lãnh đạo Văn phòng/);
    assertOk(await them({ ma: 'NV-T63', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp }), 'Chánh VP là Owner');
    assertOk(await them({ ma: 'NV-T64', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp }), 'PCVP là Owner');
  });

  test('5. Owner = phòng: tài khoản đúng phòng được, khác phòng bị chặn (kể cả A2/A1)', async () => {
    assert.match(loi(await them({ ma: 'NV-T65', owner_don_vi_ma: 'TEST_PHONG', owner_tai_khoan: IDS.cv2 })), /phải thuộc phòng TONG_HOP/);
    assert.match(loi(await them({ ma: 'NV-T65', owner_don_vi_ma: 'TEST_PHONG', owner_tai_khoan: IDS.cvp })), /phải thuộc phòng TONG_HOP/);
    assertOk(await them({ ma: 'NV-T65', owner_don_vi_ma: 'TEST_PHONG', owner_tai_khoan: IDS.cv1 }), 'chuyên viên Tổng hợp');
    assertOk(await them({ ma: 'NV-T66', owner_don_vi_ma: 'TEST_PHONG', owner_tai_khoan: IDS.truongphong }), 'Trưởng phòng Tổng hợp');
    assert.match(loi(await sua('NV-T65', { owner_tai_khoan: IDS.cv2 })), /phải thuộc phòng/);   // đổi tài khoản sai phòng
  });

  test('6. Owner = đơn vị ngoài Văn phòng: có tài khoản bị chặn; không tài khoản được; đơn vị NULL có tài khoản bị chặn', async () => {
    assert.match(loi(await them({ ma: 'NV-T67', owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: IDS.cv1 })), /ngoài Văn phòng/);
    assert.match(loi(await them({ ma: 'NV-T67', owner_don_vi_ma: null, owner_tai_khoan: IDS.cv1 })), /ngoài Văn phòng/);
    assertOk(await them({ ma: 'NV-T67', owner_don_vi_ma: 'DANG_UY_UBND' }), 'đơn vị ngoài, không tài khoản');
    assert.match(loi(await sua('NV-T63', { owner_don_vi_ma: 'DANG_UY_UBND' })), /ngoài Văn phòng/);   // đổi đơn vị khi đang có tài khoản
  });
});
