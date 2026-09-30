// PR-2b (0054–0056) — Hạn nộp minh chứng: bắt buộc khi giao, khung ngày + lý do việc gấp, ai sửa (dat_han_nop_minh_chung, Q4), gia hạn kèm hạn
// nộp mới, đổi hạn hoàn thành đường khác, Q2 (không đóng khi chưa nghiệm thu). Khối "biên ngày" là logic thuần ⇒ chỉ cục bộ; còn lại cả staging.
// Khoá "KL-0054" trong nội dung việc và số văn bản; tự dọn; cờ tạm (quan_tri_kl cv2, bi_khoa demo_e2e_tp) khôi phục ở before lẫn after.
// 0061: Q4 mở rộng (người giao không còn vai A0/A1/A2); nhắc đặt hạn nộp khi việc vừa có hạn hoàn thành (logic — chỉ cục bộ).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, CHI_CUC_BO, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0054';
const TP_RT = '00000000-0000-4000-8000-000000000015';   // demo_e2e_tp — A2 phòng E2E_RT (seed)
const H = '2026-12-31';
let dem = 0; let k0;
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const vb = (them = {}) => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02', ...them });
const OWNER = {
  demo_a0: { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp },
  demo_cvp: { owner_don_vi_ma: 'TONG_HOP' },
  demo_pcvp: { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 },
  demo_truongphong: { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1 },
  demo_cv2: { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.truongphong },
};
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: {
  van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem}`, san_pham_loai: 'TO_TRINH', han_xu_ly: H,
  han_nop_minh_chung: k0.khong_ly_do_den, nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...OWNER[username], ...p } });
const datHan = async (username, nvId, han, lyDo = 'Điều chỉnh theo tiến độ') => (await userClient(username)).rpc('dat_han_nop_minh_chung', { p_id: nvId, p_han: han, p_ly_do: lyDo });
const doc = async (nvId) => (await db().from('nhiem_vu').select('han_xu_ly, han_nop_minh_chung, ly_do_han_nop_sat, tien_do_ma').eq('id', nvId).single()).data;
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const chan = (r, label) => assert.equal(r.error?.code, '42501', `${label}: ${r.error?.message || 'không bị chặn'}`);
const khoiPhuc = async () => {
  await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.cv2);
  await db().from('accounts').update({ bi_khoa: false }).eq('id', TP_RT);
};
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await khoiPhuc();
};

describe('0054 — hạn nộp minh chứng: giao, sửa, gia hạn, Q2, Q4', { skip: SKIP }, () => {
  before(async () => {
    await don();
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cv2 quan_tri_kl tạm');
    k0 = (await db().rpc('kl_khung_han_nop', { p_han_xu_ly: H })).data;
  });
  after(don);

  test('1. Bắt buộc khi giao: A0 / CVP / PCVP / A2 / quan_tri_kl thay mặt × Có hạn cụ thể / Ký ban hành — thiếu hạn nộp ⇒ 22023; có hạn nộp ⇒ được', { skip: CHI_CUC_BO }, async () => {
    const vai = Object.keys(OWNER);
    const thieu = await Promise.all(vai.flatMap((u) => [giao(u, { han_nop_minh_chung: null }),
      giao(u, { han_nop_minh_chung: null, loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: null, van_ban: vb({ ngay_ban_hanh: '2026-09-25', ngay_nhan: '2026-09-26' }) })]));
    thieu.forEach((r, i) => loi(r, /Phải đặt hạn nộp minh chứng/, `${vai[i >> 1]} ${i % 2 ? 'Ký ban hành' : 'có hạn'}`));
    const co = await Promise.all(vai.map((u) => giao(u)));
    co.forEach((r, i) => assertOk(r, `${vai[i]} giao có hạn nộp`));
    const kbh = (await db().rpc('kl_khung_han_nop', { p_han_xu_ly: null, p_ngay_ban_hanh: '2026-09-25', p_loai_thoi_han: 'KY_BAN_HANH' })).data;
    assertOk(await giao('demo_cvp', { loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: null, han_nop_minh_chung: kbh.goi_y, ly_do_han_nop_sat: 'Việc gấp',
      van_ban: vb({ ngay_ban_hanh: '2026-09-25', ngay_nhan: '2026-09-26' }) }), 'Ký ban hành: hạn nộp theo hạn tự tính');
  });

  test('2. Sửa hạn: người giao được (lý do bắt buộc, lịch sử + tin); chủ trì, người theo dõi, PCVP, CVP, A0, A2 khác, thư ký ⇒ 42501; UPDATE thẳng ⇒ 42501', async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    loi(await datHan('demo_truongphong', nv, cong(k0.khong_ly_do_den, -1), ' '), /lý do/, 'thiếu lý do');
    assertOk(await datHan('demo_truongphong', nv, cong(k0.khong_ly_do_den, -1)), 'người giao sửa');
    assert.equal((await doc(nv)).han_nop_minh_chung, cong(k0.khong_ly_do_den, -1));
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv).eq('cot', 'han_nop_minh_chung_ly_do');
    assert.match(ls.data[0]?.gia_tri_moi || '', /Đổi hạn nộp minh chứng .* — Điều chỉnh theo tiến độ/);
    const tin = await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', nv).like('content', 'Đổi hạn nộp minh chứng%');
    assert.deepEqual(tin.data.map((x) => x.receiver_id), [IDS.cv1]);
    await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', '00000000-0000-4000-8000-000000000018');
    const bi = await Promise.all(['demo_cv1', 'demo_pcvp', 'demo_cvp', 'demo_a0', 'demo_e2e_tp', 'demo_e2e_tk', 'demo_cv2'].map((u) => datHan(u, nv, k0.khong_ly_do_den)));
    await db().from('accounts').update({ thu_ky_thuong_truc: false }).eq('id', '00000000-0000-4000-8000-000000000018');
    bi.forEach((x, i) => chan(x, `vai ${i}`));
    chan(await (await userClient('demo_cv2')).from('nhiem_vu').update({ han_nop_minh_chung: k0.khong_ly_do_den }).eq('id', nv), 'quan_tri_kl UPDATE thẳng');
  });

  test('3. Người được thay mặt là người giao (A3 quan_tri_kl chỉ gõ hộ ⇒ 42501); A0 sửa được việc chính mình giao', async () => {
    const [tm, a0] = await Promise.all([giao('demo_cv2'), giao('demo_a0')]); assertOk(tm, 'giao thay mặt'); assertOk(a0, 'A0 giao');
    chan(await datHan('demo_cv2', tm.data.id, cong(k0.khong_ly_do_den, -2)), 'người gõ hộ');
    assertOk(await datHan('demo_truongphong', tm.data.id, cong(k0.khong_ly_do_den, -2)), 'người được thay mặt');
    assertOk(await datHan('demo_a0', a0.data.id, cong(k0.khong_ly_do_den, -2)), 'A0 người giao');
  });

  test('4. Q4: không có người giao (tao_boi NULL / người giao bị khoá) ⇒ quan_tri_kl sửa được, lịch sử ghi "quản trị sửa thay"; còn người giao ⇒ 42501', async () => {
    const vbr = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} Q4`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    const ins = await db().from('nhiem_vu').insert([
      { van_ban_id: vbr.data.id, noi_dung: `${KHOA} Q4 NULL`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: H, han_nop_minh_chung: k0.khong_ly_do_den, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong },
      { van_ban_id: vbr.data.id, noi_dung: `${KHOA} Q4 KHOA`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: H, han_nop_minh_chung: k0.khong_ly_do_den, owner_don_vi_ma: 'E2E_RT', nguoi_theo_doi: TP_RT, tao_boi: TP_RT },
    ]).select('id, noi_dung');
    assertOk(ins, 'việc Q4'); const [khong, khoa] = ['NULL', 'KHOA'].map((k) => ins.data.find((x) => x.noi_dung.endsWith(k)).id);
    chan(await datHan('demo_cv2', khoa, cong(k0.khong_ly_do_den, -3)), 'người giao còn hoạt động');
    loi(await datHan('demo_cv2', khong, cong(k0.khong_ly_do_den, -3), ''), /lý do/, 'Q4 thiếu lý do');
    assertOk(await datHan('demo_cv2', khong, cong(k0.khong_ly_do_den, -3)), 'Q4 tao_boi NULL');
    chan(await datHan('demo_truongphong', khong, cong(k0.khong_ly_do_den, -4)), 'A2 không phải người giao, không phải quan_tri_kl');
    await db().from('accounts').update({ bi_khoa: true }).eq('id', TP_RT);
    try { assertOk(await datHan('demo_cv2', khoa, cong(k0.khong_ly_do_den, -3)), 'Q4 người giao bị khoá'); }
    finally { await db().from('accounts').update({ bi_khoa: false }).eq('id', TP_RT); }
    const ls = await db().from('lich_su').select('gia_tri_moi').in('nhiem_vu_id', [khong, khoa]).eq('cot', 'han_nop_minh_chung_ly_do');
    assert.equal(ls.data.filter((x) => /quản trị sửa thay — không có người giao/.test(x.gia_tri_moi)).length, 2);
  });

  test('5. Gia hạn: người giao kèm hạn nộp mới; người khác gia hạn giữ hạn nộp, truyền hạn nộp mới ⇒ 42501; đổi hạn hoàn thành làm vi phạm ⇒ 22023', async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    const gh = async (u, p) => (await userClient(u)).rpc('chi_dao_gui', { p: { nhiem_vu_id: nv, loai: 'GIA_HAN', noi_dung: `${KHOA} gia hạn`, ...p } });
    assertOk(await gh('demo_truongphong', { han_moi: '2027-01-29', han_nop_minh_chung_moi: '2027-01-27' }), 'người giao gia hạn kèm hạn nộp');
    assert.deepEqual([(await doc(nv)).han_xu_ly, (await doc(nv)).han_nop_minh_chung], ['2027-01-29', '2027-01-27']);
    chan(await gh('demo_pcvp', { han_moi: '2027-02-26', han_nop_minh_chung_moi: '2027-02-24' }), 'PCVP kèm hạn nộp mới');
    assertOk(await gh('demo_pcvp', { han_moi: '2027-02-26' }), 'PCVP gia hạn');
    assert.equal((await doc(nv)).han_nop_minh_chung, '2027-01-27', 'hạn nộp giữ nguyên');
    loi(await (await userClient('demo_cv2')).from('nhiem_vu').update({ han_xu_ly: '2027-01-27' }).eq('id', nv), /Hạn hoàn thành mới/, 'quan_tri_kl rút hạn hoàn thành');
  });

  test('6. Q2: việc có hạn nộp — minh chứng chưa nghiệm thu thì không đóng (dong_nhiem_vu, Cập nhật nhanh) ⇒ 22023', { skip: CHI_CUC_BO }, async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    assertOk(await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: nv, so_hieu: `${KHOA}/MC`, ngay_van_ban: homNayVN(),
      cap_nhan: 'TRUONG_PHONG', trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'Đã gửi.' } }), 'chủ trì nộp');
    loi(await (await userClient('demo_cv1')).rpc('dong_nhiem_vu', { p_id: nv, p_ngay_hoan_thanh: null }), /nghiệm thu/, 'dong_nhiem_vu');
    loi(await (await userClient('demo_cv1')).from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNayVN() }).eq('id', nv), /nghiệm thu/, 'Cập nhật nhanh');
    assert.equal((await doc(nv)).tien_do_ma !== 'HOAN_THANH', true);
  });

  test('7. Q4 mở rộng (0061): người giao còn hoạt động nhưng không còn vai A0/A1/A2 ⇒ quan_tri_kl sửa; chính người đó ⇒ 42501', async () => {
    const vbr = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} Q4B`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    const ins = await db().from('nhiem_vu').insert({ van_ban_id: vbr.data.id, noi_dung: `${KHOA} Q4 A3`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: H,
      han_nop_minh_chung: k0.khong_ly_do_den, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.cv1 }).select('id').single();
    assertOk(ins, 'việc có người giao là A3');
    chan(await datHan('demo_cv1', ins.data.id, cong(k0.khong_ly_do_den, -3)), 'người giao không còn vai lãnh đạo');
    assertOk(await datHan('demo_cv2', ins.data.id, cong(k0.khong_ly_do_den, -3)), 'quan_tri_kl sửa thay');
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', ins.data.id).eq('cot', 'han_nop_minh_chung_ly_do');
    assert.match(ls.data[0]?.gia_tri_moi || '', /quản trị sửa thay — không có người giao/);
  });

  test('8. (0061) Việc giao khi chưa có hạn, về sau có hạn mà chưa có hạn nộp ⇒ tin hệ thống tới người giao; không còn người giao ⇒ quan_tri_kl', { skip: CHI_CUC_BO }, async () => {
    const vbr = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} NH`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    const ins = await db().from('nhiem_vu').insert(['TP', 'KG'].map((k) => ({ van_ban_id: vbr.data.id, noi_dung: `${KHOA} NH ${k}`, nguon: 'app',
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: null, ly_do_chua_co_han: 'Chờ kế hoạch', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
      tao_boi: k === 'TP' ? IDS.truongphong : null }))).select('id, ma, noi_dung');
    assertOk(ins, 'việc chưa có hạn'); const v = Object.fromEntries(ins.data.map((x) => [x.noi_dung.slice(-2), x]));
    assertOk(await db().from('nhiem_vu').update({ han_xu_ly: H }).in('id', ins.data.map((x) => x.id)), 'điền hạn');
    const tin = async (x) => (await db().from('direct_messages').select('receiver_id, sender_id, content').eq('nhiem_vu_id', x.id).like('content', '%đặt hạn nộp minh chứng')).data;
    const tp = await tin(v.TP);
    assert.deepEqual(tp.map((t) => [t.receiver_id, t.sender_id, t.content]), [[IDS.truongphong, null, `Việc ${v.TP.ma} đã có hạn hoàn thành 31/12/2026 — đặt hạn nộp minh chứng`]]);
    assert.ok((await tin(v.KG)).some((t) => t.receiver_id === IDS.cv2), 'không còn người giao ⇒ quan_tri_kl (cv2) nhận');
    assertOk(await db().from('nhiem_vu').update({ ghi_chu: 'Sửa cột khác' }).eq('id', v.TP.id), 'sửa cột khác');
    assert.equal((await tin(v.TP)).length, 1, 'không gửi lại khi hạn không đổi từ trống');
  });
});

describe('0054 — biên khung ngày (logic)', { skip: SKIP || CHI_CUC_BO }, () => {
  before(don);
  after(don);
  test('1. Có hạn: đúng ngày làm việc liền trước ⇒ được; sát hơn không lý do ⇒ 22023; = H có lý do ⇒ được; > H, < hôm nay ⇒ 22023', async () => {
    assertOk(await giao('demo_cvp', { han_nop_minh_chung: k0.khong_ly_do_den }), 'ngày làm việc liền trước');
    loi(await giao('demo_cvp', { han_nop_minh_chung: H }), /ít nhất một ngày làm việc \(muộn nhất/, 'sát không lý do');
    const r = await giao('demo_cvp', { han_nop_minh_chung: H, ly_do_han_nop_sat: 'Việc gấp theo chỉ đạo' }); assertOk(r, '= H có lý do');
    assert.equal((await doc(r.data.id)).ly_do_han_nop_sat, 'Việc gấp theo chỉ đạo');
    loi(await giao('demo_cvp', { han_nop_minh_chung: cong(H, 1), ly_do_han_nop_sat: 'x' }), /phải từ/, '> H');
    loi(await giao('demo_cvp', { han_nop_minh_chung: cong(homNayVN(), -1), ly_do_han_nop_sat: 'x' }), /phải từ/, '< hôm nay');
  });
  test('2. Hạn đã qua (quyết định 30/9): hạn nộp trong [hôm nay, ngày làm việc thứ 2], không cần lý do; H = hôm nay ⇒ chỉ được khi có lý do', async () => {
    const qua = { han_xu_ly: '2026-09-15' };
    const den = (await db().rpc('ngay_lam_viec_sau', { p_tu: homNayVN(), p_so: 2 })).data;
    assertOk(await giao('demo_cvp', { ...qua, han_nop_minh_chung: homNayVN() }), 'hôm nay');
    assertOk(await giao('demo_cvp', { ...qua, han_nop_minh_chung: den }), 'ngày làm việc thứ 2');
    loi(await giao('demo_cvp', { ...qua, han_nop_minh_chung: cong(den, 1) }), /phải từ/, 'quá ngày làm việc thứ 2');
    loi(await giao('demo_cvp', { han_xu_ly: homNayVN(), han_nop_minh_chung: homNayVN() }), /việc gấp thì ghi lý do/, 'H = hôm nay không lý do');
    assertOk(await giao('demo_cvp', { han_xu_ly: homNayVN(), han_nop_minh_chung: homNayVN(), ly_do_han_nop_sat: 'Hạn hôm nay' }), 'H = hôm nay có lý do');
  });
});
