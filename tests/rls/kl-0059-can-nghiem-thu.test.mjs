// PR-2b (0059) — "Cần nghiệm thu": kl_so_chua_xu_ly.can_nghiem_thu (minh chứng đang chờ mà tôi là người nhận nhắc chính) và kl_can_nghiem_thu()
// (danh sách: cùng hàm chặn kl_duoc_nghiem_thu với xac_nhan_minh_chung; cua_toi = người nhận nhắc chính). Người nộp = 0; A0 không có; ngoài phạm
// vi không thấy; nghiệm thu xong ⇒ về số cũ. Thư ký (việc Chánh VP): kl-0057. Khoá "KL-0059"; tự dọn.
// Đợt D (0090): nộp minh chứng hợp lệ = hoàn thành ⇒ không phát sinh "cần nghiệm thu"; danh sách chỉ còn minh chứng nộp trước 0090 đang chờ
// (giả lập: chèn bằng service_role, hop_le NULL) — xác nhận hợp lệ là hoàn thành như cũ.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0059';
const VAI = ['demo_truongphong', 'demo_cv1', 'demo_pcvp', 'demo_cvp', 'demo_cv2', 'demo_a0'];
let nv; let nv2; let vb; let mc;
const so = async () => Object.fromEntries(await Promise.all(VAI.map(async (u) => {
  const r = await (await userClient(u)).rpc('kl_so_chua_xu_ly'); assertOk(r, u); return [u, r.data.can_nghiem_thu];
})));
const ds = async (u) => { const r = await (await userClient(u)).rpc('kl_can_nghiem_thu'); assertOk(r, u); return r.data.filter((x) => x.nhiem_vu_id === nv); };
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0059 — Cần nghiệm thu theo vai', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await (await userClient('demo_truongphong')).rpc('giao_viec', { p: { van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA} #1`, ngay_ban_hanh: '2026-09-01',
      ngay_nhan: '2026-09-02' }, noi_dung: `${KHOA} việc`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP',
      owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP' } });
    assertOk(r, 'A2 giao'); nv = r.data.id; vb = r.data.van_ban_id;
    const r2 = await (await userClient('demo_truongphong')).rpc('giao_viec', { p: { van_ban_id: vb, noi_dung: `${KHOA} việc cũ`, san_pham_loai: 'TO_TRINH',
      han_xu_ly: '2026-12-31', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP' } });
    assertOk(r2, 'A2 giao việc thứ hai'); nv2 = r2.data.id;
  });
  after(don);

  test('1. (0090) Nộp minh chứng hợp lệ = hoàn thành: không ai có thêm việc "cần nghiệm thu", danh sách rỗng', async () => {
    const truoc = await so();
    const r = await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: nv, so_hieu: `${KHOA}/1`, ngay_van_ban: homNayVN(),
      cap_nhan: 'TRUONG_PHONG', trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'Đã gửi Trưởng phòng.' } });
    assertOk(r, 'chủ trì nộp'); mc = r.data;
    assert.equal((await db().from('nhiem_vu').select('tien_do_ma').eq('id', nv).single()).data.tien_do_ma, 'HOAN_THANH');
    const sau = await so();
    assert.deepEqual(Object.fromEntries(VAI.map((u) => [u, sau[u] - truoc[u]])),
      { demo_truongphong: 0, demo_cv1: 0, demo_pcvp: 0, demo_cvp: 0, demo_cv2: 0, demo_a0: 0 });
    assert.deepEqual((await Promise.all(VAI.map(ds))).map((x) => x.length), [0, 0, 0, 0, 0, 0]);
    assert.ok(mc);
  });

  test('2. Minh chứng cũ đang chờ (trước 0090): người giao +1 "của tôi", PCVP / Chánh VP "trong phạm vi"; người nộp, A3 khác phòng, A0 không có; xác nhận ⇒ hoàn thành, về số cũ', async () => {
    const truoc = await so();
    const cu = await db().from('minh_chung').insert({ nhiem_vu_id: nv2, loai: 'so_hieu', so_hieu: `${KHOA}/2`, ngay_van_ban: homNayVN(), cap_nhan: 'TRUONG_PHONG',
      trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'Đã gửi Trưởng phòng.', nop_boi: IDS.cv1 }).select('id').single();
    assertOk(cu, 'minh chứng cũ đang chờ (service_role)');
    const sau = await so();
    assert.deepEqual(Object.fromEntries(VAI.map((u) => [u, sau[u] - truoc[u]])),
      { demo_truongphong: 1, demo_cv1: 0, demo_pcvp: 0, demo_cvp: 0, demo_cv2: 0, demo_a0: 0 });
    const ds2 = async (u) => { const r = await (await userClient(u)).rpc('kl_can_nghiem_thu'); assertOk(r, u); return r.data.filter((x) => x.nhiem_vu_id === nv2); };
    const [tp, pcvp, cvp, cv1, cv2, a0] = await Promise.all(['demo_truongphong', 'demo_pcvp', 'demo_cvp', 'demo_cv1', 'demo_cv2', 'demo_a0'].map(ds2));
    assert.deepEqual([tp, pcvp, cvp].map((x) => x.map((y) => [y.minh_chung_id, y.cua_toi])), [[[cu.data.id, true]], [[cu.data.id, false]], [[cu.data.id, false]]]);
    assert.deepEqual([cv1.length, cv2.length, a0.length], [0, 0, 0]);
    assertOk(await (await userClient('demo_truongphong')).rpc('xac_nhan_minh_chung', { p_id: cu.data.id, p_hop_le: true, p_chat_luong: 'DAT_TOT' }), 'xác nhận minh chứng cũ');
    const v = (await db().from('nhiem_vu').select('tien_do_ma, chat_luong').eq('id', nv2).single()).data;
    assert.deepEqual([v.tien_do_ma, v.chat_luong], ['HOAN_THANH', 'DAT_TOT']);
    assert.equal((await so()).demo_truongphong, truoc.demo_truongphong);
    assert.equal((await ds2('demo_truongphong')).length, 0);
    assert.ok(vb);
  });
});
