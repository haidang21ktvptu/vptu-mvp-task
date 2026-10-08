// PR-2b (0057, Q8) — Việc Thường trực (A0) giao cho Chánh VP: thư ký Thường trực thấy việc và nghiệm thu thay mặt (lịch sử "thay mặt Thường
// trực — <tên>"); thư ký không nghiệm thu việc khác (42501); thu cờ ⇒ mất quyền ngay; không ai giữ cờ ⇒ quan_tri_kl nghiệm thu (và đóng việc, Q2);
// A0 và Chánh VP (người nộp) bị chặn. Tài khoản: demo_e2e_tk (A3, cấp cờ thư ký lúc chạy), demo_cv2 (quan_tri_kl tạm). Khoá "KL-0057"; tự dọn,
// cờ khôi phục ở before lẫn after. 0061: Chánh VP (chủ trì, người theo dõi) không bao giờ nghiệm thu việc này, kể cả khi giữ quan_tri_kl.
// Đợt D (0090): nộp minh chứng hợp lệ = hoàn thành; "nghiệm thu" thành xem lại tuỳ chọn (trả lại / đánh giá chất lượng); Thường trực — người giao
// việc — đánh giá được; Chánh VP chủ trì vẫn không tự xem lại.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0057';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk
const nv = {}; const vbIds = [];
const giaoA0 = async (ma, owner) => {
  const r = await (await userClient('demo_a0')).rpc('giao_viec', { p: { noi_dung: `${KHOA} ${ma}`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31',
    owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: owner } });
  assertOk(r, `A0 giao ${ma}`); nv[ma] = r.data.id; vbIds.push(r.data.van_ban_id);
};
const nop = async (username, ma, so) => {
  const r = await (await userClient(username)).rpc('nop_minh_chung', { p: { nhiem_vu_id: nv[ma], so_hieu: `${KHOA}/${so}`, ngay_van_ban: homNayVN(),
    cap_nhan: 'THUONG_TRUC', trich_yeu: 'Báo cáo kết quả', mo_ta_ket_qua: 'Đã báo cáo Thường trực.' } });
  assertOk(r, `${username} nộp ${ma}`); return r.data;
};
const xac = async (username, mc, hopLe, lyDo = null) => (await userClient(username)).rpc('xac_nhan_minh_chung',   // 0090: "hợp lệ" = đánh giá ⇒ kèm chất lượng
  { p_id: mc, p_hop_le: hopLe, p_ly_do: lyDo, p_chat_luong: hopLe ? 'DAT' : null });
const chan = (r, label) => assert.equal(r.error?.code, '42501', `${label}: ${r.error?.message || 'không bị chặn'}`);
const co = (thuKy, qtkl) => Promise.all([
  db().from('accounts').update({ thu_ky_thuong_truc: thuKy }).eq('id', TK),
  db().from('accounts').update({ quan_tri_kl: qtkl, quan_tri_kl_het_han: null }).eq('id', IDS.cv2)]);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  if (vbIds.length) await db().from('van_ban_giao_viec').delete().in('id', vbIds);
  await co(false, false);
  await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.cvp);
};

describe('0057 — nghiệm thu thay mặt Thường trực (Q8)', { skip: SKIP }, () => {
  before(async () => { await don(); await giaoA0('CVP', IDS.cvp); await giaoA0('PCVP', IDS.pcvp); });
  after(don);

  test('1. Thư ký thấy việc Chánh VP và trả lại thay mặt (việc mở lại); không xem lại việc khác; Chánh VP (người nộp) bị chặn; Thường trực (người giao) đánh giá được', async () => {
    const [m1, m2] = [await nop('demo_cvp', 'CVP', 1), await nop('demo_pcvp', 'PCVP', 1)];
    await co(true, false);
    const tk = await userClient('demo_e2e_tk');
    assert.equal((await tk.from('v_nhiem_vu').select('id').eq('id', nv.CVP)).data.length, 1, 'thư ký thấy việc Chánh VP');
    assert.equal((await tk.from('nhiem_vu').select('id').eq('id', nv.PCVP)).data.length, 0, 'thư ký không thấy việc PCVP');
    chan(await xac('demo_e2e_tk', m2, true), 'thư ký nghiệm thu việc PCVP');
    chan(await xac('demo_cvp', m1, true), 'Chánh VP tự đánh giá');
    assert.equal((await db().from('nhiem_vu').select('tien_do_ma').eq('id', nv.CVP).single()).data.tien_do_ma, 'HOAN_THANH', 'nộp là hoàn thành');
    assertOk(await xac('demo_a0', m1, true), 'Thường trực (người giao việc) đánh giá chất lượng — tuỳ chọn');
    assertOk(await xac('demo_e2e_tk', m1, false, 'Bổ sung số liệu'), 'thư ký trả lại');
    const v = (await db().from('nhiem_vu').select('tien_do_ma, chat_luong').eq('id', nv.CVP).single()).data;
    assert.deepEqual([v.tien_do_ma, v.chat_luong], ['DANG_THUC_HIEN', null], 'minh chứng hợp lệ duy nhất bị trả lại ⇒ mở lại, xoá đánh giá');
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.CVP).eq('cot', 'minh_chung_xac_nhan');
    assert.match(ls.data[0].gia_tri_moi, /Minh chứng bị trả lại .* — thay mặt Thường trực — Demo E2E Thư ký TT/);
    const tin = await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', nv.CVP).like('content', 'Minh chứng bị trả lại%');
    assert.ok(tin.data.some((x) => x.receiver_id === IDS.cvp), 'Chánh VP nhận tin trả lại');
  });

  test('2. Thu cờ ⇒ mất quyền ngay; nộp lại là hoàn thành; không ai giữ cờ ⇒ quan_tri_kl đánh giá thay mặt', async () => {
    const m3 = await nop('demo_cvp', 'CVP', 2);
    await co(false, true);
    chan(await xac('demo_e2e_tk', m3, true), 'đã thu cờ thư ký');
    assert.equal((await (await userClient('demo_e2e_tk')).from('nhiem_vu').select('id').eq('id', nv.CVP)).data.length, 0, 'thu cờ ⇒ không còn thấy');
    assertOk(await xac('demo_cv2', m3, true), 'quan_tri_kl đánh giá');
    const v = (await db().from('nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, chat_luong').eq('id', nv.CVP).single()).data;
    assert.deepEqual([v.tien_do_ma, v.ngay_hoan_thanh, v.chat_luong], ['HOAN_THANH', homNayVN(), 'DAT']);
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.CVP).eq('cot', 'dong_nhiem_vu');
    assert.ok(ls.data.some((x) => /^Hoàn thành nhiệm vụ · .*: theo minh chứng số KL-0057\/2, ngày hoàn thành .* \(tự động khi nộp minh chứng hợp lệ\)$/.test(x.gia_tri_moi)),
      'lịch sử hoàn thành theo minh chứng nộp lại');
  });

  test('3. (0061) Chánh VP không nghiệm thu việc Thường trực giao cho mình — kể cả là người theo dõi, hay giữ quan_tri_kl khi không ai giữ cờ thư ký; danh sách khớp', async () => {
    await giaoA0('CVP3', IDS.cvp);
    const mc = await db().from('minh_chung').insert({ nhiem_vu_id: nv.CVP3, loai: 'so_hieu', so_hieu: `${KHOA}/3`, ngay_van_ban: homNayVN(), cap_nhan: 'THUONG_TRUC',
      trich_yeu: 'Báo cáo kết quả', mo_ta_ket_qua: 'Đã báo cáo Thường trực.', nop_boi: IDS.pcvp }).select('id').single();
    assertOk(mc, 'minh chứng do PCVP nộp (service_role)');
    const ds = async (u) => ((await (await userClient(u)).rpc('kl_can_nghiem_thu')).data || []).filter((x) => x.nhiem_vu_id === nv.CVP3).map((x) => x.cua_toi);
    await co(true, false);
    chan(await xac('demo_cvp', mc.data.id, true), 'Chánh VP (người theo dõi) khi có thư ký');
    assert.deepEqual(await ds('demo_cvp'), [], 'Chánh VP không có trong Cần nghiệm thu');
    assert.deepEqual(await ds('demo_e2e_tk'), [true], 'thư ký: Của tôi');
    await co(false, true);
    assertOk(await db().from('accounts').update({ quan_tri_kl: true, quan_tri_kl_het_han: null }).eq('id', IDS.cvp), 'Chánh VP giữ quan_tri_kl tạm');
    try {
      chan(await xac('demo_cvp', mc.data.id, true), 'Chánh VP giữ quan_tri_kl, không ai giữ cờ thư ký');
      assert.deepEqual(await ds('demo_cvp'), []);
      assert.deepEqual(await ds('demo_cv2'), [true], 'quan_tri_kl khác: Của tôi');
    } finally { await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cvp); }
    assertOk(await xac('demo_cv2', mc.data.id, true), 'quan_tri_kl nghiệm thu thay mặt');
  });
});
