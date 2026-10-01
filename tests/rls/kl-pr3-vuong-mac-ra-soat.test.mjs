// PR-3 (0062, 0065, 0067) — C. vướng mắc: ai sửa (Owner / người theo dõi qua API; lãnh đạo trong phạm vi qua dat_vuong_mac; A0 và A3 ngoài
// bị chặn), tin hệ thống MỘT lần khi NULL → có (người giao A1/A2 + PCVP phụ trách; không bao giờ A0), kl_so_chua_xu_ly.co_vuong_mac (A1, A2);
// F. van_ban_dat_ra_soat (quyền như van_ban_dat_trich_yeu) và kl_van_ban_so_viec (tổng thật, chỉ văn bản người gọi xem được). Khoá "KL-PR3C".
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PR3C';
const VAI = ['demo_truongphong', 'demo_pcvp', 'demo_cvp', 'demo_cv1', 'demo_a0', 'demo_pcvp2'];
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const rpc = async (u, fn, args) => (await userClient(u)).rpc(fn, args);
const dem = async () => Object.fromEntries(await Promise.all(VAI.map(async (u) => {
  const r = await rpc(u, 'kl_so_chua_xu_ly'); assertOk(r, u); return [u, r.data.co_vuong_mac];
})));
const tin = async (id) => (await db().from('direct_messages').select('sender_id, receiver_id').eq('nhiem_vu_id', id).like('content', 'Vướng mắc%')).data;
const don = async () => {
  await db().from('direct_messages').delete().like('content', `%${KHOA}%`);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};
let nv; let vb; let nvA0; let vbA0; let truoc;

describe('PR-3 C/F — vướng mắc, rà soát văn bản', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await rpc('demo_truongphong', 'giao_viec', { p: { van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA} #1`, ngay_ban_hanh: '2026-09-01',
      ngay_nhan: '2026-09-02', so_nhiem_vu_du_kien: 3 }, noi_dung: `${KHOA} việc A2`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP', nguon_nhiem_vu_ma: 'VAN_BAN_CAN_THEO_DOI' } });
    assertOk(r, 'A2 giao'); nv = r.data.id; vb = r.data.van_ban_id;
    const a = await rpc('demo_a0', 'giao_viec', { p: { noi_dung: `${KHOA} việc A0`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP',
      nganh_ma: 'KINH_TE_TONG_HOP' } });
    assertOk(a, 'A0 giao cho phòng'); nvA0 = a.data.id; vbA0 = a.data.van_ban_id;
    truoc = await dem();
  });
  after(async () => { await don(); if (vbA0) await db().from('van_ban_giao_viec').delete().eq('id', vbA0); });

  test('C1. Owner điền qua API ⇒ tin MỘT lần tới người giao (A2) + PCVP phụ trách; sửa nội dung không gửi lại; co_vuong_mac A1/A2 +1', async () => {
    const cv1 = await userClient('demo_cv1');
    assertOk(await cv1.from('nhiem_vu').update({ vuong_mac: `${KHOA}: chờ ý kiến Sở Tài chính` }).eq('id', nv).select('id'), 'Owner điền (guard a3 cho phép)');
    const t1 = await tin(nv);
    assert.deepEqual(t1.map((x) => x.receiver_id).sort(), [IDS.pcvp, IDS.truongphong].sort());
    assert.ok(t1.every((x) => x.sender_id === IDS.cv1), 'người gửi = người viết');
    assertOk(await rpc('demo_truongphong', 'dat_vuong_mac', { p_id: nv, p_noi_dung: `${KHOA}: chờ Sở Tài chính trả lời trước 15/10` }), 'A2 sửa');
    assertOk(await rpc('demo_pcvp', 'dat_vuong_mac', { p_id: nv, p_noi_dung: `${KHOA}: đề nghị Chánh VP quyết định` }), 'PCVP trong phạm vi sửa');
    assert.equal((await tin(nv)).length, 2, 'sửa nội dung không gửi tin lại');
    const sau = await dem();
    assert.deepEqual(Object.fromEntries(VAI.map((u) => [u, sau[u] - truoc[u]])),
      { demo_truongphong: 1, demo_pcvp: 1, demo_cvp: 1, demo_cv1: 0, demo_a0: 0, demo_pcvp2: 0 });
    const v = (await (await userClient('demo_cvp')).from('v_nhiem_vu').select('vuong_mac').eq('id', nv).single()).data;
    assert.equal(v.vuong_mac, `${KHOA}: đề nghị Chánh VP quyết định`);
    assertOk(await (await userClient('demo_cvp')).from('v_ngoai_le').select('vuong_mac').limit(1), 'v_ngoai_le có cột vuong_mac');
  });

  test('C2. Chặn: A3 ngoài việc, A0 (kể cả đọc được); quá 500 ký tự; xoá trống ⇒ NULL, số về như cũ', async () => {
    const [cv2, a0, dai] = await Promise.all([rpc('demo_cv2', 'dat_vuong_mac', { p_id: nv, p_noi_dung: 'X' }), rpc('demo_a0', 'dat_vuong_mac', { p_id: nv, p_noi_dung: 'X' }),
      rpc('demo_truongphong', 'dat_vuong_mac', { p_id: nv, p_noi_dung: 'x'.repeat(501) })]);
    assertDenied(cv2, 'A3 ngoài việc'); assertDenied(a0, 'A0'); loi(dai, /500 ký tự/, 'quá 500');
    assertOk(await rpc('demo_truongphong', 'dat_vuong_mac', { p_id: nv, p_noi_dung: '   ' }), 'xoá trống = đã giải quyết');
    assert.equal((await db().from('nhiem_vu').select('vuong_mac').eq('id', nv).single()).data.vuong_mac, null);
    assert.deepEqual(await dem(), truoc);
    const ls = (await db().from('lich_su').select('cot').eq('nhiem_vu_id', nv).eq('cot', 'vuong_mac')).data;
    assert.equal(ls.length, 4, 'lịch sử ghi cũ/mới mỗi lần');
  });

  test('C3. Việc Thường trực (A0) giao: tin không tới A0 (A0 chỉ đọc) — chỉ PCVP phụ trách; người viết không tự nhận', async () => {
    const tp = await userClient('demo_truongphong');   // người theo dõi việc A0 giao cho phòng
    assertOk(await tp.from('nhiem_vu').update({ vuong_mac: `${KHOA}: cần Thường trực cho ý kiến` }).eq('id', nvA0).select('id'), 'người theo dõi điền');
    const t = await tin(nvA0);
    assert.deepEqual(t.map((x) => x.receiver_id), [IDS.pcvp]);
    assert.ok(!t.some((x) => x.receiver_id === IDS.a0), 'không gửi A0');
  });

  test('F. van_ban_dat_ra_soat: người tạo, A1 được; A3, A0 không tạo bị chặn; số âm lỗi; kl_van_ban_so_viec đếm tổng thật trong phạm vi xem', async () => {
    const goi = (u, so, rs) => rpc(u, 'van_ban_dat_ra_soat', { p_id: vb, p_so: so, p_da_ra_soat: rs });
    const [cv1, a0, am] = await Promise.all([goi('demo_cv1', 2, true), goi('demo_a0', 2, true), goi('demo_truongphong', -1, false)]);
    assertDenied(cv1, 'A3'); assertDenied(a0, 'A0 không tạo văn bản'); loi(am, /không được âm/, 'số âm');
    assertOk(await goi('demo_truongphong', 2, false), 'người tạo sửa số dự kiến');
    assertOk(await goi('demo_pcvp', 2, true), 'A1 đánh dấu rà soát');
    const r = (await db().from('van_ban_giao_viec').select('so_nhiem_vu_du_kien, da_ra_soat_toan_van, ra_soat_boi, ra_soat_luc').eq('id', vb).single()).data;
    assert.deepEqual([r.so_nhiem_vu_du_kien, r.da_ra_soat_toan_van, r.ra_soat_boi, Boolean(r.ra_soat_luc)], [2, true, IDS.pcvp, true]);
    assert.ok((await db().from('lich_su').select('id').eq('nhiem_vu_id', nv).eq('cot', 'van_ban_ra_soat')).data.length >= 2, 'vết trên việc của văn bản');
    // việc thứ hai của cùng văn bản nằm NGOÀI phạm vi Trưởng phòng TONG_HOP (Owner phòng Quản trị)
    assertOk(await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} ngoài phạm vi`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, theo_1400: false }), 'việc ngoài phạm vi');
    const so = async (u) => { const x = await rpc(u, 'kl_van_ban_so_viec'); assertOk(x, u); return x.data.find((y) => y.van_ban_id === vb)?.so_viec ?? null; };
    const thay = (await (await userClient('demo_truongphong')).from('v_nhiem_vu').select('id').eq('van_ban_id', vb)).data.length;
    assert.deepEqual([await so('demo_truongphong'), thay, await so('demo_cvp'), await so('demo_qtht')], [2, 1, 2, null]);
  });
});
