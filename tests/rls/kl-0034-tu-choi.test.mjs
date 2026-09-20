// GĐ21 (0034) — từ chối nhận việc theo cấp, có duyệt, kín: chỉ Owner tài khoản / người theo dõi chưa xác nhận nhận việc đề nghị;
// cấp duyệt = lãnh đạo trực tiếp của người đề nghị (A3 → Trưởng phòng cùng phòng; phòng chưa có A2 → PCVP phụ trách), KHÔNG BAO GIỜ là
// người giao thay mặt (chỉ nhận tin); lý do chỉ người đề nghị, cấp duyệt và cấp trên trong chuỗi đọc (A0 tất cả), không vào lich_su hay
// tin hệ thống; chỉ cấp duyệt duyệt; đồng ý → bi_tu_choi, v_ngoai_le khau BI_TU_CHOI (ưu tiên đầu, nhom TU_CHOI khi chưa Đỏ); cờ xoá khi
// GIAO_LAI hoặc giao lại cho Owner khác; canh_bao_quet nhắc cấp duyệt quá 2 ngày làm việc theo ngày Việt Nam (mốc 18h UTC); A0 nhắn 1-1;
// PCVP đề nghị → Chánh VP duyệt; Chánh VP đề nghị → Thường trực, BẤT KỲ A0 nào duyệt được; việc đã đồng ý từ chối không đề nghị lại.
// Mã NV-T92…T97 + một tài khoản A0 tạm (kl0034_a0b), tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, assertNoRows, IDS, EMAIL_DOMAIN, LA_PRODUCTION, BO_QUA_PRODUCTION } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = LA_PRODUCTION ? BO_QUA_PRODUCTION : (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const E2E_KL = '00000000-0000-4000-8000-000000000010'; // demo_e2e_kl, A3 Tổng hợp — người theo dõi / Owner mới khi giao lại
let fx; const id = {}; let t0; let tc92; let tc93; let tc94; let a0b; // a0b: id tài khoản A0 tạm thứ hai
const A0B = 'kl0034_a0b'; const MK_A0B = 'Kl0034tamA0b'; // staging bắt mật khẩu ≥ 8 ký tự có chữ và số
let clientA0B = null;
const rpcA0B = async (fn, args) => {
  if (!clientA0B) { clientA0B = anonClient(); const r = await clientA0B.auth.signInWithPassword({ email: `${A0B}@${EMAIL_DOMAIN}`, password: MK_A0B }); if (r.error) throw new Error(`Đăng nhập ${A0B}: ${r.error.message}`); }
  return clientA0B.rpc(fn, args);
};
const LY_DO = 'KL-0034 lý do riêng tư không được lộ';
const assertLoi = (r, label) => assert.ok(r.error, `${label}: phải bị từ chối (22023)`);
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `KL-0034 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const nv = async (ma) => (await db().from('nhiem_vu').select('bi_tu_choi').eq('id', id[ma]).single()).data;
const tin = async (nguoi, ma) => (await db().from('direct_messages').select('content').eq('receiver_id', nguoi).eq('loai', 'he_thong').eq('nhiem_vu_id', id[ma]).gte('created_at', t0)).data;
const docTuChoi = async (username, tcId) => (await userClient(username)).from('tu_choi').select('id, ly_do').eq('id', tcId);
const don = async () => {
  await db().from('nhiem_vu').delete().in('ma', ['NV-T92', 'NV-T93', 'NV-T94', 'NV-T95', 'NV-T96', 'NV-T97']);
  if (t0) {
    await db().from('canh_bao').delete().gte('gui_luc', t0);
    await db().from('direct_messages').delete().gte('created_at', t0).or('loai.eq.he_thong,content.like.KL-0034%');
    await db().from('lich_su').delete().eq('cot', 'canh_bao').gte('luc', t0);
  }
  const cu = (await db().from('accounts').select('id').eq('username', A0B)).data || [];
  for (const a of cu) { await db().from('accounts').delete().eq('id', a.id); await db().auth.admin.deleteUser(a.id); }
};
// Tài khoản A0 tạm thứ hai (auth + hồ sơ), đăng nhập bằng mật khẩu seed.
const taoA0B = async () => {
  const r = await db().auth.admin.createUser({ email: `${A0B}@${EMAIL_DOMAIN}`, password: MK_A0B, email_confirm: true, user_metadata: { username: A0B, full_name: 'KL-0034 Thường trực B' } });
  if (r.error) throw new Error(`Tạo auth A0 tạm thất bại: ${r.error.message}`);
  const a = await db().from('accounts').upsert({ id: r.data.user.id, username: A0B, full_name: 'KL-0034 Thường trực B', role_group: 'A0', position_title: 'Thường trực Tỉnh ủy (test)',
    department: null, is_chief: false, must_change_password: false, is_system: false, quan_tri_he_thong: false }, { onConflict: 'id' }).select('id').single();
  assertOk(a, 'hồ sơ A0 tạm'); return a.data.id;
};

describe('0034 — từ chối nhận việc: đề nghị, cấp duyệt, riêng tư lý do, duyệt, cờ, nhắc, A0 nhắn 1-1', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    t0 = new Date().toISOString();
    await them({ ma: 'NV-T92', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong }); // Trưởng phòng giao
    await them({ ma: 'NV-T93', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, tao_boi: IDS.qtht });      // phòng Quản trị chưa có A2 → PCVP2
    await them({ ma: 'NV-T94', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.qtht });      // giao thay mặt (quản trị)
    await them({ ma: 'NV-T95', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong });
    await them({ ma: 'NV-T96', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.pcvp, tao_boi: IDS.cvp });   // PCVP theo dõi, Chánh VP giao
    await them({ ma: 'NV-T97', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cvp, tao_boi: IDS.qtht });   // Chánh VP theo dõi
    a0b = await taoA0B();
  });
  after(don);

  test('1. Ai được đề nghị: Owner/người theo dõi chưa xác nhận; người khác, A0, đã xác nhận, thiếu lý do, trùng đề nghị đều bị chặn', async () => {
    assertDenied(await rpc('demo_cv2', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: 'x' }), 'cv2 đề nghị việc của cv1');
    assertDenied(await rpc('demo_a0', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: 'x' }), 'A0 đề nghị');
    assertDenied(await rpc('demo_truongphong', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: 'x' }), 'Trưởng phòng (người giao) đề nghị');
    assertLoi(await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: '   ' }), 'thiếu lý do');
    assertOk(await rpc('demo_cv1', 'xac_nhan_nhan_viec', { p_id: id['NV-T95'] }), 'cv1 xác nhận NV-T95');
    assertLoi(await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T95'], p_ly_do: 'x' }), 'đã xác nhận nhận việc thì không từ chối');
    const r = await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: LY_DO });
    assertOk(r, 'cv1 đề nghị NV-T92'); tc92 = r.data;
    assertLoi(await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T92'], p_ly_do: 'lần hai' }), 'một đề nghị chờ duyệt mỗi việc');
  });

  test('2. Cấp duyệt = lãnh đạo trực tiếp: A3 → Trưởng phòng cùng phòng; người giao thay mặt không phải cấp duyệt, chỉ nhận tin; phòng không có A2 → PCVP phụ trách', async () => {
    const t = (await db().from('tu_choi').select('*').eq('id', tc92).single()).data;
    assert.equal(t.cap_duyet, IDS.truongphong, 'cấp duyệt NV-T92 là Trưởng phòng Tổng hợp'); assert.equal(t.trang_thai, 'CHO_DUYET');
    const r94 = await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T94'], p_ly_do: LY_DO });
    assertOk(r94, 'cv1 đề nghị NV-T94 (giao thay mặt)'); tc94 = r94.data;
    const t94 = (await db().from('tu_choi').select('cap_duyet').eq('id', tc94).single()).data;
    assert.equal(t94.cap_duyet, IDS.truongphong, 'người giao thay mặt (quản trị) KHÔNG là cấp duyệt');
    assert.equal((await tin(IDS.qtht, 'NV-T94')).length, 1, 'người giao thay mặt nhận tin đề nghị');
    assert.equal((await tin(IDS.truongphong, 'NV-T94')).length, 1, 'cấp duyệt nhận tin đề nghị');
    assert.equal((await tin(IDS.cv1, 'NV-T94')).length, 0, 'người đề nghị không tự nhận tin');
    const r93 = await rpc('demo_cv2', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T93'], p_ly_do: LY_DO });
    assertOk(r93, 'cv2 đề nghị NV-T93'); tc93 = r93.data;
    assert.equal((await db().from('tu_choi').select('cap_duyet').eq('id', tc93).single()).data.cap_duyet, IDS.pcvp2, 'phòng Quản trị chưa có A2 → PCVP phụ trách duyệt');
  });

  test('3. Riêng tư lý do: người đề nghị, cấp duyệt, PCVP phụ trách, Chánh VP, A0 đọc; cv2, PCVP2, quản trị (người giao thay mặt) không; lich_su và tin không chứa lý do', async () => {
    for (const u of ['demo_cv1', 'demo_truongphong', 'demo_pcvp', 'demo_cvp', 'demo_a0']) {
      const r = await docTuChoi(u, tc92); assertOk(r, `${u} đọc tu_choi`); assert.equal(r.data.length, 1, `${u} thấy đề nghị`); assert.equal(r.data[0].ly_do, LY_DO);
    }
    for (const u of ['demo_cv2', 'demo_pcvp2', 'demo_qtht']) assertNoRows(await docTuChoi(u, tc92), `${u} không đọc được đề nghị của cv1`);
    assertNoRows(await docTuChoi('demo_qtht', tc94), 'người giao thay mặt không đọc được lý do dù nhận tin');
    const ls = (await db().from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', id['NV-T92']).eq('cot', 'tu_choi')).data;
    assert.equal(ls.length, 1, 'lich_su có đúng một dòng đề nghị'); assert.match(ls[0].gia_tri_moi, /đề nghị từ chối/); assert.doesNotMatch(ls[0].gia_tri_moi, /riêng tư/);
    for (const t of await tin(IDS.truongphong, 'NV-T92')) assert.doesNotMatch(t.content, /riêng tư/, 'tin hệ thống không kèm lý do');
    assertDenied(await (await userClient('demo_cv1')).from('tu_choi').insert({ nhiem_vu_id: id['NV-T95'], nguoi_de_nghi: IDS.cv1, cap_duyet: IDS.truongphong, ly_do: 'chèn thẳng' }).select('id'), 'không INSERT thẳng bảng');
    assertDenied(await (await userClient('demo_truongphong')).from('tu_choi').update({ trang_thai: 'DONG_Y' }).eq('id', tc92).select('id'), 'không UPDATE thẳng bảng');
  });

  test('4. Chỉ cấp duyệt duyệt; đồng ý → bi_tu_choi, khau BI_TU_CHOI ưu tiên đầu (nhom TU_CHOI khi chưa Đỏ); tin cho người đề nghị; duyệt lại bị chặn', async () => {
    assertDenied(await rpc('demo_cv1', 'duyet_tu_choi', { p_id: tc92, p_dong_y: true }), 'người đề nghị tự duyệt');
    assertDenied(await rpc('demo_pcvp', 'duyet_tu_choi', { p_id: tc92, p_dong_y: true }), 'cấp trên (không phải cấp duyệt) duyệt');
    assertDenied(await rpc('demo_a0', 'duyet_tu_choi', { p_id: tc92, p_dong_y: true }), 'A0 duyệt');
    assertDenied(await rpc('demo_qtht', 'duyet_tu_choi', { p_id: tc94, p_dong_y: true }), 'người giao thay mặt duyệt');
    await db().from('nhiem_vu').update({ cap_quyet_dinh: 'TRUONG_PHONG' }).eq('id', id['NV-T92']); // khâu CHO_QUYET sẽ thua BI_TU_CHOI
    assertOk(await rpc('demo_truongphong', 'duyet_tu_choi', { p_id: tc92, p_dong_y: true, p_y_kien: 'Đồng ý, sẽ giao người khác' }), 'Trưởng phòng đồng ý');
    assert.equal((await nv('NV-T92')).bi_tu_choi, true, 'cờ bị từ chối bật');
    const t = (await db().from('tu_choi').select('*').eq('id', tc92).single()).data;
    assert.equal(t.trang_thai, 'DONG_Y'); assert.equal(t.y_kien_duyet, 'Đồng ý, sẽ giao người khác'); assert.ok(t.duyet_luc);
    assert.equal((await tin(IDS.cv1, 'NV-T92')).filter((x) => /Duyệt đề nghị từ chối/.test(x.content)).length, 1, 'người đề nghị nhận tin duyệt');
    const nl = await (await userClient('demo_cvp')).from('v_ngoai_le').select('ma, khau, nhom, bi_tu_choi').eq('id', id['NV-T92']);
    assertOk(nl, 'v_ngoai_le'); assert.equal(nl.data.length, 1, 'việc bị từ chối chưa quá hạn vẫn lên v_ngoai_le');
    assert.deepEqual([nl.data[0].khau, nl.data[0].nhom, nl.data[0].bi_tu_choi], ['BI_TU_CHOI', 'TU_CHOI', true]);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['NV-T92']).eq('cot', 'tu_choi')).data.map((x) => x.gia_tri_moi);
    assert.ok(ls.some((x) => /đã duyệt: đồng ý/.test(x)) && !ls.some((x) => /riêng tư|Đồng ý, sẽ giao/.test(x)), 'lich_su chỉ ghi "đã duyệt", không lý do/ý kiến');
    assertLoi(await rpc('demo_truongphong', 'duyet_tu_choi', { p_id: tc92, p_dong_y: false }), 'duyệt lại');
    await db().from('nhiem_vu').update({ han_xu_ly: '2026-08-01' }).eq('id', id['NV-T92']); // quá hạn → nhom DO nhưng khâu vẫn BI_TU_CHOI
    const nl2 = (await (await userClient('demo_cvp')).from('v_ngoai_le').select('khau, nhom').eq('id', id['NV-T92']).single()).data;
    assert.deepEqual([nl2.khau, nl2.nhom], ['BI_TU_CHOI', 'DO']);
  });

  test('5. Không đồng ý → giữ nguyên (cờ tắt, việc tiếp tục); người đề nghị nhận tin kèm ý kiến', async () => {
    assertOk(await rpc('demo_truongphong', 'duyet_tu_choi', { p_id: tc94, p_dong_y: false, p_y_kien: 'Việc thuộc chuyên môn đồng chí' }), 'không đồng ý');
    assert.equal((await nv('NV-T94')).bi_tu_choi, false);
    assert.equal((await db().from('tu_choi').select('trang_thai').eq('id', tc94).single()).data.trang_thai, 'KHONG_DONG_Y');
    assert.equal((await tin(IDS.cv1, 'NV-T94')).filter((x) => /không đồng ý.*chuyên môn/.test(x.content)).length, 1);
    assertOk(await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T94'], p_ly_do: 'đề nghị lại sau khi bị bác' }), 'sau khi bị bác được đề nghị lại');
  });

  test('6. Cờ tự xoá khi GIAO_LAI (đổi chủ trì, 0045) và khi đổi Owner trực tiếp', async () => {
    assertOk(await rpc('demo_truongphong', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T92'], loai: 'GIAO_LAI', noi_dung: 'giao lại', chu_tri_moi: E2E_KL } }), 'GIAO_LAI');
    assert.equal((await nv('NV-T92')).bi_tu_choi, false, 'GIAO_LAI xoá cờ');
    await db().from('nhiem_vu').update({ bi_tu_choi: true }).eq('id', id['NV-T92']);
    await db().from('nhiem_vu').update({ ghi_chu: 'đổi cột khác' }).eq('id', id['NV-T92']);
    assert.equal((await nv('NV-T92')).bi_tu_choi, true, 'đổi cột khác không xoá cờ');
    assertOk(await db().from('nhiem_vu').update({ owner_tai_khoan: IDS.cv1 }).eq('id', id['NV-T92']).select('id'), 'đổi Owner trực tiếp (E2E_KL → cv1)');
    assert.equal((await nv('NV-T92')).bi_tu_choi, false, 'đổi Owner tài khoản xoá cờ');
  });

  test('7. canh_bao_quet nhắc cấp duyệt quá 2 ngày làm việc theo ngày Việt Nam (đề nghị 18h UTC = hôm sau VN), idempotent', async () => {
    await db().from('tu_choi').update({ tao_luc: '2026-09-10T18:00:00Z' }).eq('id', tc93); // = 01:00 11/9 (Thứ Sáu) giờ VN → hạn duyệt 15/9 (Thứ Hai)
    const q1 = await db().rpc('canh_bao_quet', { p_ngay: '2026-09-15' }); assertOk(q1, 'quét 15/9');
    assert.equal(q1.data.gui.TU_CHOI, 0, '15/9 chưa quá hạn duyệt (tính ngày VN, không phải 10/9 UTC)');
    const q2 = await db().rpc('canh_bao_quet', { p_ngay: '2026-09-16' }); assertOk(q2, 'quét 16/9');
    assert.equal(q2.data.gui.TU_CHOI, 1, '16/9 nhắc một đề nghị');
    const nhac = (await tin(IDS.pcvp2, 'NV-T93')).filter((x) => /chờ duyệt/.test(x.content));
    assert.equal(nhac.length, 1, 'cấp duyệt nhận tin nhắc'); assert.doesNotMatch(nhac[0].content, /riêng tư/, 'tin nhắc không kèm lý do');
    const q3 = await db().rpc('canh_bao_quet', { p_ngay: '2026-09-16' }); assertOk(q3, 'quét lại');
    assert.equal(q3.data.gui.TU_CHOI, 0, 'cùng chu kỳ không nhắc lại');
    assertOk(await rpc('demo_pcvp2', 'duyet_tu_choi', { p_id: tc93, p_dong_y: true }), 'PCVP2 duyệt NV-T93');
  });

  test('9. PCVP đề nghị → cấp duyệt là Chánh VP; Chánh VP đề nghị → Thường trực, A0 thứ hai (không phải cap_duyet ghi) vẫn duyệt được', async () => {
    const r96 = await rpc('demo_pcvp', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T96'], p_ly_do: LY_DO }); assertOk(r96, 'PCVP đề nghị');
    assert.equal((await db().from('tu_choi').select('cap_duyet').eq('id', r96.data).single()).data.cap_duyet, IDS.cvp, 'PCVP → Chánh VP duyệt');
    const r97 = await rpc('demo_cvp', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T97'], p_ly_do: LY_DO }); assertOk(r97, 'Chánh VP đề nghị');
    const t97 = (await db().from('tu_choi').select('cap_duyet').eq('id', r97.data).single()).data;
    assert.equal((await db().from('accounts').select('role_group').eq('id', t97.cap_duyet).single()).data.role_group, 'A0', 'Chánh VP → Thường trực duyệt');
    assert.notEqual(t97.cap_duyet, a0b, 'cấp duyệt ghi là A0 khác tài khoản tạm');
    assertDenied(await rpc('demo_pcvp2', 'duyet_tu_choi', { p_id: r97.data, p_dong_y: true }), 'PCVP không duyệt đề nghị của Chánh VP');
    assertDenied(await rpcA0B('duyet_tu_choi', { p_id: r96.data, p_dong_y: true }), 'A0 không duyệt thay Chánh VP (cấp duyệt không phải A0)');
    assertOk(await rpcA0B('duyet_tu_choi', { p_id: r97.data, p_dong_y: true, p_y_kien: 'Thường trực B duyệt' }), 'A0 thứ hai duyệt đề nghị của Chánh VP');
    assert.equal((await nv('NV-T97')).bi_tu_choi, true);
    assert.equal((await tin(IDS.cvp, 'NV-T97')).filter((x) => /Thường trực B duyệt/.test(x.content)).length, 1, 'Chánh VP nhận tin duyệt');
  });

  test('10. Việc đã được đồng ý từ chối (bi_tu_choi) không đề nghị lại được cho tới khi giao lại', async () => {
    assertLoi(await rpc('demo_cv2', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T93'], p_ly_do: 'lần hai' }), 'đề nghị lại khi đang chờ giao lại');
    assert.equal((await db().from('tu_choi').select('id').eq('nhiem_vu_id', id['NV-T93'])).data.length, 1, 'không thêm dòng đề nghị');
  });

  test('8. A0 nhắn tin 1-1 được; tin he_thong vẫn không chèn thẳng', async () => {
    const a0 = await userClient('demo_a0');
    assertOk(await a0.from('direct_messages').insert({ sender_id: IDS.a0, receiver_id: IDS.cvp, content: 'KL-0034 Thường trực nhắn', is_read: false }).select('id'), 'A0 gửi tin 1-1');
    assertDenied(await a0.from('direct_messages').insert({ sender_id: IDS.a0, receiver_id: IDS.cvp, content: 'KL-0034 giả hệ thống', is_read: false, loai: 'he_thong' }).select('id'), 'A0 chèn tin he_thong');
    assertDenied(await a0.from('direct_messages').insert({ sender_id: IDS.cvp, receiver_id: IDS.a0, content: 'KL-0034 giả người khác', is_read: false }).select('id'), 'A0 giả người gửi');
  });
});
