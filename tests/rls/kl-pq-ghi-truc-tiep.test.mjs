// PQ-2 — hai đường ghi trực tiếp .from() còn lại của frontend (UPDATE nhiem_vu "Cập nhật nhanh" — lib/kl/du-lieu.js; INSERT direct_messages
// — features/messages/chat.js) và ghi thẳng các bảng chỉ-đọc-qua-hàm (tu_choi, canh_bao, chi_dao_da_doc, nhat_ky_he_thong, dm_cap, dm_san_pham):
// vai không được phép không ghi được. N10: thư ký TT, QTHT, lãnh đạo ngoài phạm vi → UPDATE nhiem_vu 0 dòng (RLS lọc); Owner ghi được 1 dòng,
// quan_tri_kl ghi được (đối chứng); Đợt D (0091): lãnh đạo trong phạm vi (CVP, PCVP phụ trách, Trưởng phòng, A0) cập nhật thay được. N8: INSERT/UPDATE/DELETE thẳng 6 bảng bị chặn với MỌI vai kể cả quan_tri_kl và A0.
// Khoá dữ liệu: "KL-PQ2" trong noi_dung / content; tự dọn. Ca độc lập (bị chặn / 0 dòng) chạy songSong giới hạn 4 (D3, PR-2a).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, assertNoRows, IDS, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ2';
const TK = { username: 'demo_e2e_tk', id: '00000000-0000-4000-8000-000000000018' }; // A3 Tổng hợp, cấp cờ thư ký lúc chạy
let fx; let nvId;
const khoiPhucTaiKhoan = async () => {
  await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', TK.id);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('direct_messages').delete().like('content', `${KHOA}%`);
  await khoiPhucTaiKhoan();
};
const capNhat = async (username, patch) => (await userClient(username)).from('nhiem_vu').update(patch).eq('id', nvId).select('id');

describe('PQ-2 — ghi trực tiếp bảng: UPDATE nhiem_vu, INSERT direct_messages, 6 bảng chỉ đọc', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    // Owner = cv1 (Tổng hợp), theo dõi = cv1 → CVP, PCVP (phụ trách Tổng hợp), Trưởng phòng Tổng hợp đều "thấy" nhưng không là Owner/theo dõi.
    const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} việc của cv1`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
      nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong }).select('id').single();
    assertOk(r, 'việc mẫu'); nvId = r.data.id;
    assertOk(await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', TK.id), 'cấp cờ thư ký');
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm quan_tri_kl cho cv2');
  });
  after(don);

  test('1. UPDATE nhiem_vu (Cập nhật nhanh) bởi thư ký TT, QTHT, PCVP ngoài phạm vi → 0 dòng; anon bị chặn; (Đợt D) lãnh đạo trong phạm vi → 1 dòng', async () => {
    const VAI_0 = [TK.username, 'demo_qtht', 'demo_pcvp2'];
    const kq = await songSong([...VAI_0.map((u) => () => capNhat(u, { ghi_chu: `${KHOA} ${u}` })),
      () => anonClient().from('nhiem_vu').update({ ghi_chu: 'x' }).eq('id', nvId).select('id')]);
    VAI_0.forEach((u, i) => assertNoRows(kq[i], `${u} UPDATE nhiem_vu`));
    assertDenied(kq[VAI_0.length], 'anon UPDATE nhiem_vu');
    assert.equal((await db().from('nhiem_vu').select('ghi_chu').eq('id', nvId).single()).data.ghi_chu, null, 'ghi_chu không đổi');
    for (const u of ['demo_truongphong', 'demo_pcvp', 'demo_cvp', 'demo_a0']) {   // tuần tự: cùng một dòng
      const r = await capNhat(u, { ghi_chu: `${KHOA} ${u}` }); assertOk(r, `${u} cập nhật`); assert.equal(r.data.length, 1, `${u}: lãnh đạo trong phạm vi cập nhật thay`);
    }
    assert.equal((await db().from('nhiem_vu').select('ghi_chu').eq('id', nvId).single()).data.ghi_chu, `${KHOA} demo_a0`);
  });

  test('2. Đối chứng: Owner (cv1) sửa cột trong allowlist → 1 dòng; quan_tri_kl (cv2, khác phòng) sửa được', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp quan_tri_kl cho cv2');
    const r1 = await capNhat('demo_cv1', { ghi_chu: `${KHOA} owner` });
    assertOk(r1, 'Owner cập nhật'); assert.equal(r1.data.length, 1);
    const r2 = await capNhat('demo_cv2', { ghi_chu: `${KHOA} quan_tri_kl` });
    assertOk(r2, 'quan_tri_kl cập nhật'); assert.equal(r2.data.length, 1);
    await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
    assertNoRows(await capNhat('demo_cv2', { ghi_chu: `${KHOA} sau thu cờ` }), 'thu cờ → cv2 (khác phòng) 0 dòng ngay');
  });

  test('3. INSERT direct_messages: sender_id giả người khác, loai he_thong, anon → bị chặn; tin thường của chính mình → được', async () => {
    const cv1 = await userClient('demo_cv1');
    assertDenied(await cv1.from('direct_messages').insert({ sender_id: IDS.cv2, receiver_id: IDS.cv1, content: `${KHOA} giả sender`, is_read: false }).select('id'), 'giả sender_id');
    assertDenied(await cv1.from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: `${KHOA} giả hệ thống`, is_read: false, loai: 'he_thong' }).select('id'), 'loai he_thong');
    assertDenied(await cv1.from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: `${KHOA} gắn việc`, is_read: false, loai: 'he_thong', nhiem_vu_id: nvId }).select('id'), 'he_thong gắn nhiem_vu_id');
    assertDenied(await anonClient().from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: `${KHOA} anon`, is_read: false }).select('id'), 'anon');
    const ok = await cv1.from('direct_messages').insert({ sender_id: IDS.cv1, receiver_id: IDS.cv2, content: `${KHOA} tin thường`, is_read: false }).select('id, loai').single();
    assertOk(ok, 'cv1 nhắn cv2'); assert.equal(ok.data.loai, 'nguoi');
    const COT = 'sender_id, receiver_id, content, is_read, loai, nhiem_vu_id';
    const goc = (await db().from('direct_messages').select(COT).eq('id', ok.data.id).single()).data;
    // Người gửi không sửa/xoá tin đã gửi qua bảng: bị chặn (42501 — bảng không cấp UPDATE cho authenticated) hoặc RLS lọc 0 dòng.
    const chanHoac0 = (r, label) => { if (r.error) assertDenied(r, label); else assertNoRows(r, label); };
    chanHoac0(await cv1.from('direct_messages').update({ content: `${KHOA} sửa`, receiver_id: IDS.cvp, loai: 'he_thong', is_read: true }).eq('id', ok.data.id).select('id'), 'người gửi sửa tin');
    chanHoac0(await cv1.from('direct_messages').delete().eq('id', ok.data.id).select('id'), 'người gửi xoá tin');
    // Đọc lại (service_role và JWT người gửi): tin còn nguyên, mọi cột không đổi.
    assert.deepEqual((await db().from('direct_messages').select(COT).eq('id', ok.data.id).single()).data, goc, 'service_role: tin không đổi');
    const doc = await cv1.from('direct_messages').select(COT).eq('id', ok.data.id).single();
    assertOk(doc, 'người gửi đọc lại'); assert.deepEqual(doc.data, goc, 'người gửi: tin không đổi');
  });

  const BANG = [
    ['tu_choi', () => ({ nhiem_vu_id: nvId, nguoi_de_nghi: IDS.cv1, cap_duyet: IDS.truongphong, ly_do: `${KHOA}` })],
    ['canh_bao', () => ({ nhiem_vu_id: nvId, muc: 'VANG', ngay: '2026-09-01', nguoi_nhan: [IDS.cv1] })],
    ['chi_dao_da_doc', (me) => ({ chi_dao_id: fx.d1, nguoi: me })],
    ['nhat_ky_he_thong', () => ({ hanh_dong: `${KHOA}`, chi_tiet: {} })],
    ['dm_cap', () => ({ ma: 'KL_PQ2_CAP', ten: `${KHOA} cấp`, thu_tu: 99 })],
    ['dm_san_pham', () => ({ ma: 'KL_PQ2_SP', ten: `${KHOA} sản phẩm`, thu_tu: 99 })],
  ];
  const VAI = [['demo_cv1', IDS.cv1], ['demo_truongphong', IDS.truongphong], ['demo_cvp', IDS.cvp], ['demo_pcvp', IDS.pcvp], ['demo_a0', IDS.a0], ['demo_qtht', IDS.qtht], ['demo_cv2', IDS.cv2]];

  test('4. INSERT thẳng tu_choi, canh_bao, chi_dao_da_doc, nhat_ky_he_thong, dm_cap, dm_san_pham bị chặn với A3, A2, CVP, PCVP, A0, QTHT, quan_tri_kl, anon', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp quan_tri_kl cho cv2');
    const ca = BANG.flatMap(([bang, dong]) => [...VAI.map(([u, me]) => [`${u} INSERT ${bang}`, async () => (await userClient(u)).from(bang).insert(dong(me)).select()]),
      [`anon INSERT ${bang}`, () => anonClient().from(bang).insert(dong(IDS.cv1)).select()]]);
    (await songSong(ca.map(([, f]) => f))).forEach((r, i) => assertDenied(r, ca[i][0]));
    const rac = await songSong(['dm_cap', 'dm_san_pham'].map((bang) => () => db().from(bang).select('ma').like('ma', 'KL_PQ2%')));
    rac.forEach((r, i) => assert.equal(r.data.length, 0, `${['dm_cap', 'dm_san_pham'][i]} không có dòng rác`));
  });

  test('5. UPDATE / DELETE thẳng 6 bảng đó bị chặn với mọi vai (kể cả quan_tri_kl, QTHT)', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp quan_tri_kl cho cv2');
    const KHONG_CO = '00000000-0000-4000-8000-0000000000ff';
    // [bảng, patch UPDATE, cột lọc, giá trị lọc]
    const CA = [
      ['tu_choi', { ly_do: 'x' }, 'id', KHONG_CO], ['canh_bao', { muc: 'DO' }, 'nhiem_vu_id', nvId], ['chi_dao_da_doc', { luc: '2026-01-01T00:00:00Z' }, 'chi_dao_id', fx.d1],
      ['nhat_ky_he_thong', { hanh_dong: 'x' }, 'hanh_dong', KHOA], ['dm_cap', { ten: `${KHOA} đổi` }, 'ma', 'THUONG_TRUC'], ['dm_san_pham', { ten: `${KHOA} đổi` }, 'ma', 'TO_TRINH'],
    ];
    const ca = CA.flatMap(([bang, patch, cot, gt]) => VAI.flatMap(([u]) => [
      [`${u} UPDATE ${bang}`, async () => (await userClient(u)).from(bang).update(patch).eq(cot, gt).select()],
      [`${u} DELETE ${bang}`, async () => (await userClient(u)).from(bang).delete().eq(cot, gt).select()]]));
    (await songSong(ca.map(([, f]) => f))).forEach((r, i) => assertDenied(r, ca[i][0]));
    assert.equal((await db().from('dm_cap').select('ten').eq('ma', 'THUONG_TRUC').single()).data.ten, 'Thường trực Tỉnh ủy', 'danh mục không đổi');
  });
});
