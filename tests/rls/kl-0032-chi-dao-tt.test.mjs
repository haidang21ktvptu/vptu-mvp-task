// GĐ19 (0032, CH-16) — chỉ đạo Thường trực CHI_DAO_TT: chỉ A0 gửi; người nhận tự tính (Chánh VP + PCVP phụ trách phòng
// Owner/theo dõi + lãnh đạo VP phụ trách đơn vị ngoài, không trùng); hạn mặc định 2 ngày làm việc theo ngày Việt Nam; chỉ
// người nhận phản hồi hoặc chuyển thành chỉ đạo con; A0 đóng đúng luồng TT của mình (Y_KIEN vẫn không), người nhận không
// đóng; quá hạn phản hồi → canh_bao_quet gửi tin người nhận chưa phản hồi, idempotent. Mã NV-T90/T91, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {}; let t0; let tt1; let tt2; let tt3; let conId;
const assertLoi = (r, label) => assert.ok(r.error, `${label}: phải bị từ chối (22023)`);
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `KL-0032 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const tin = async (nguoi, ma, mau) => (await db().from('direct_messages').select('content, sender_id').eq('receiver_id', nguoi).eq('loai', 'he_thong')
  .eq('nhiem_vu_id', id[ma])).data.filter((t) => mau.test(t.content));
const row = async (cid) => (await db().from('chi_dao').select('*').eq('id', cid).single()).data;
// Ngày hôm nay theo giờ Việt Nam và ngày làm việc thứ N sau đó (bỏ T7/CN) — đối chiếu độc lập với hàm SQL.
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ngayLamViecSau = (iso, n) => { let d = iso; while (n > 0) { d = congNgay(d, 1); if (new Date(`${d}T00:00:00Z`).getUTCDay() % 6 !== 0) n--; } return d; };
const don = async () => {
  await db().from('nhiem_vu').delete().in('ma', ['NV-T90', 'NV-T91']);
  await db().from('dm_don_vi').update({ lanh_dao_phu_trach: null }).eq('ma', 'DANG_UY_UBND');
  if (t0) {
    await db().from('canh_bao').delete().gte('gui_luc', t0);
    await db().from('direct_messages').delete().eq('loai', 'he_thong').is('sender_id', null).gte('created_at', t0);
    await db().from('lich_su').delete().eq('cot', 'canh_bao').gte('luc', t0);
  }
};

describe('0032 — chỉ đạo Thường trực: người gửi, người nhận, hạn, phản hồi, chỉ đạo con, đóng, quá hạn', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    t0 = new Date().toISOString();
    await them({ ma: 'NV-T90', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2 });   // phòng Quản trị → PCVP2
    await them({ ma: 'NV-T91', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1 });                        // đơn vị ngoài + theo dõi Tổng hợp → PCVP
    await db().from('dm_don_vi').update({ lanh_dao_phu_trach: IDS.pcvp }).eq('ma', 'DANG_UY_UBND');                // trùng PCVP → phải khử trùng
  });
  after(don);

  test('1. ngay_lam_viec_sau bỏ Thứ Bảy/Chủ nhật', async () => {
    const f = async (tu, n) => (await rpc('demo_cvp', 'ngay_lam_viec_sau', { p_tu: tu, p_so: n })).data;
    assert.equal(await f('2026-09-16', 2), '2026-09-18', 'Thứ Tư + 2 = Thứ Sáu');
    assert.equal(await f('2026-09-17', 2), '2026-09-21', 'Thứ Năm + 2 = Thứ Hai (qua cuối tuần)');
    assert.equal(await f('2026-09-18', 2), '2026-09-22', 'Thứ Sáu + 2 = Thứ Ba');
    assert.equal(await f('2026-09-19', 1), '2026-09-21', 'Thứ Bảy + 1 = Thứ Hai');
    assert.equal(await f('2026-09-16', 0), '2026-09-16', '0 ngày = chính ngày đó');
  });

  test('2. Chỉ A0 gửi CHI_DAO_TT; người nhận = Chánh VP + PCVP phụ trách phòng; hạn mặc định 2 ngày làm việc theo ngày Việt Nam; tin chỉ tới người nhận', async () => {
    for (const u of ['demo_cvp', 'demo_pcvp2', 'demo_truongphong', 'demo_cv2']) {
      assertDenied(await rpc(u, 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'CHI_DAO_TT', noi_dung: 'x' } }), `${u} gửi CHI_DAO_TT`);
    }
    assertLoi(await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'CHI_DAO_TT', noi_dung: 'x', han_phan_hoi: congNgay(homNayVN(), -1) } }), 'hạn phản hồi trong quá khứ');
    const r = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'CHI_DAO_TT', noi_dung: 'KL-0032 Thường trực yêu cầu báo cáo' } });
    assertOk(r, 'A0 gửi CHI_DAO_TT'); tt1 = r.data;
    const c = await row(tt1);
    assert.equal(c.loai, 'CHI_DAO_TT'); assert.equal(c.trang_thai, 'CHO_PHAN_HOI'); assert.equal(c.tra_loi_cho, null);
    assert.deepEqual([...c.nguoi_nhan].sort(), [IDS.cvp, IDS.pcvp2].sort(), 'người nhận: Chánh VP + PCVP phụ trách Quản trị');
    assert.equal(c.han_phan_hoi, ngayLamViecSau(homNayVN(), 2), 'hạn = 2 ngày làm việc sau hôm nay (giờ Việt Nam)');
    const mau = /^Chỉ đạo Thường trực · NV-T90/;
    assert.equal((await tin(IDS.cvp, 'NV-T90', mau)).length, 1, 'Chánh VP nhận tin');
    assert.equal((await tin(IDS.pcvp2, 'NV-T90', mau)).length, 1, 'PCVP2 nhận tin');
    for (const u of [IDS.cv2, IDS.truongphong, IDS.pcvp, IDS.a0]) assert.equal((await tin(u, 'NV-T90', mau)).length, 0, `${u} không nhận tin`);
    const ls = await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['NV-T90']).eq('cot', 'chi_dao');
    assert.ok(ls.data.some((l) => mau.test(l.gia_tri_moi)), 'lịch sử ghi vết');
  });

  test('3. Đơn vị ngoài: + lãnh đạo VP phụ trách đơn vị, khử trùng với PCVP phụ trách phòng theo dõi', async () => {
    const r = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T91'], loai: 'CHI_DAO_TT', noi_dung: 'KL-0032 TT trên đơn vị ngoài' } });
    assertOk(r, 'A0 gửi CHI_DAO_TT T91'); tt2 = r.data;
    assert.deepEqual([...(await row(tt2)).nguoi_nhan].sort(), [IDS.cvp, IDS.pcvp].sort(), 'Chánh VP + PCVP (phòng Tổng hợp = lãnh đạo phụ trách đơn vị, chỉ một lần)');
  });

  test('4. Phản hồi: chỉ người nhận; A3 (Owner/theo dõi), A2, A1 ngoài danh sách, A0 bị chặn; tin tới A0 + người nhận khác', async () => {
    for (const u of ['demo_cv2', 'demo_truongphong', 'demo_pcvp', 'demo_a0']) {
      assertDenied(await rpc(u, 'chi_dao_phan_hoi', { p: { chi_dao_id: tt1, noi_dung: 'x' } }), `${u} phản hồi luồng TT`);
    }
    assertOk(await rpc('demo_pcvp2', 'chi_dao_phan_hoi', { p: { chi_dao_id: tt1, noi_dung: 'KL-0032 PCVP2 đã chỉ đạo phòng' } }), 'PCVP2 phản hồi');
    const c = await row(tt1);
    assert.equal(c.trang_thai, 'DA_PHAN_HOI'); assert.equal(c.phan_hoi_boi, IDS.pcvp2);
    const mau = /^Phản hồi chỉ đạo Thường trực · NV-T90/;
    assert.equal((await tin(IDS.a0, 'NV-T90', mau)).length, 1, 'A0 nhận tin phản hồi');
    assert.equal((await tin(IDS.cvp, 'NV-T90', mau)).length, 1, 'người nhận khác (Chánh VP) nhận tin');
    assert.equal((await tin(IDS.pcvp2, 'NV-T90', mau)).length, 0, 'người phản hồi không tự nhận');
    assert.equal((await tin(IDS.cv2, 'NV-T90', mau)).length, 0, 'Owner/theo dõi không nhận tin luồng TT');
    assertOk(await rpc('demo_cvp', 'chi_dao_phan_hoi', { p: { chi_dao_id: tt1, noi_dung: 'KL-0032 Chánh VP bổ sung' } }), 'người nhận khác vẫn phản hồi được');
    assert.equal((await db().from('chi_dao').select('id').eq('tra_loi_cho', tt1).eq('loai', 'PHAN_HOI')).data.length, 2);
  });

  test('5. Chuyển thành chỉ đạo con: người nhận gửi DON_DOC có tra_loi_cho = luồng TT → luồng TT DA_PHAN_HOI, A0 nhận tin; ngoài danh sách / sai gốc bị chặn', async () => {
    assertDenied(await rpc('demo_pcvp2', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T91'], loai: 'DON_DOC', noi_dung: 'x', tra_loi_cho: tt2 } }), 'A1 không phải người nhận');
    assertLoi(await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'DON_DOC', noi_dung: 'x', tra_loi_cho: tt2 } }), 'khác nhiệm vụ');
    assertLoi(await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T91'], loai: 'Y_KIEN', noi_dung: 'x', tra_loi_cho: tt2 } }), 'Y_KIEN không làm chỉ đạo con');
    const r = await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T91'], loai: 'DON_DOC', noi_dung: 'KL-0032 đôn đốc theo chỉ đạo TT', tra_loi_cho: tt2 } });
    assertOk(r, 'Chánh VP chuyển thành đôn đốc'); conId = r.data;
    const con = await row(conId); const goc = await row(tt2);
    assert.equal(con.tra_loi_cho, tt2); assert.equal(con.trang_thai, 'CHO_PHAN_HOI'); assert.equal(con.loai, 'DON_DOC');
    assert.equal(goc.trang_thai, 'DA_PHAN_HOI'); assert.match(goc.phan_hoi, /^Chuyển thành Đôn đốc/); assert.equal(goc.phan_hoi_boi, IDS.cvp);
    assert.equal((await tin(IDS.a0, 'NV-T91', /^Phản hồi chỉ đạo Thường trực · NV-T91: Chuyển thành Đôn đốc/)).length, 1, 'A0 nhận tin');
    assert.equal((await tin(IDS.cv1, 'NV-T91', /^Đôn đốc · NV-T91/)).length, 1, 'người theo dõi nhận tin đôn đốc như thường');
    assertLoi(await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T91'], loai: 'DON_DOC', noi_dung: 'x', tra_loi_cho: conId } }), 'gốc không phải CHI_DAO_TT');
    // Phản hồi chỉ đạo con đi vào luồng con (gốc = chính nó), không đụng luồng TT.
    assertOk(await rpc('demo_cv1', 'chi_dao_phan_hoi', { p: { chi_dao_id: conId, noi_dung: 'KL-0032 cv1 trả lời đôn đốc' } }), 'cv1 phản hồi chỉ đạo con');
    assert.equal((await row(conId)).trang_thai, 'DA_PHAN_HOI'); assert.equal((await row(tt2)).phan_hoi_boi, IDS.cvp, 'luồng TT giữ nguyên');
  });

  test('6. Đóng: người nhận và quản trị không đóng luồng TT; A0 đóng đúng luồng mình mở, không đóng Y_KIEN hay chỉ đạo con; sau đóng không phản hồi', async () => {
    for (const u of ['demo_pcvp2', 'demo_cvp', 'demo_qtht']) assertDenied(await rpc(u, 'chi_dao_dong', { p_id: tt1 }), `${u} đóng luồng TT`);
    const y = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'Y_KIEN', noi_dung: 'KL-0032 ý kiến' } });
    assertOk(y, 'A0 ghi Y_KIEN');
    assertDenied(await rpc('demo_a0', 'chi_dao_dong', { p_id: y.data }), 'A0 đóng Y_KIEN');
    assertDenied(await rpc('demo_a0', 'chi_dao_dong', { p_id: conId }), 'A0 đóng chỉ đạo con của Chánh VP');
    assertOk(await rpc('demo_a0', 'chi_dao_dong', { p_id: tt1 }), 'A0 đóng luồng TT của mình');
    assert.equal((await row(tt1)).trang_thai, 'DA_DONG');
    const mau = /^Đóng chỉ đạo Thường trực · NV-T90/;
    assert.equal((await tin(IDS.cvp, 'NV-T90', mau)).length, 1); assert.equal((await tin(IDS.pcvp2, 'NV-T90', mau)).length, 1);
    assertLoi(await rpc('demo_pcvp2', 'chi_dao_phan_hoi', { p: { chi_dao_id: tt1, noi_dung: 'x' } }), 'phản hồi luồng đã đóng');
    assertOk(await rpc('demo_cvp', 'chi_dao_dong', { p_id: conId }), 'Chánh VP đóng chỉ đạo con của mình');
  });

  test('7. Quá hạn phản hồi: canh_bao_quet gửi tin người nhận chưa phản hồi (muc CHI_DAO_TT), idempotent; không gửi khi chưa quá hạn hay đã phản hồi; v_chi_dao_tt cờ quá hạn theo ngày Việt Nam', async () => {
    const r = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T90'], loai: 'CHI_DAO_TT', noi_dung: 'KL-0032 TT chờ quá hạn' } });
    assertOk(r, 'A0 gửi TT3'); tt3 = r.data;
    assertOk(await db().from('chi_dao').update({ han_phan_hoi: '2026-08-18' }).eq('id', tt3), 'đặt hạn về quá khứ (service_role)');
    const quet = async (ngay) => { const q = await db().rpc('canh_bao_quet', { p_ngay: ngay }); assertOk(q, `quét ${ngay}`); return q.data; };
    const cb = async () => (await db().from('canh_bao').select('muc, ngay, nguoi_nhan').eq('chi_dao_id', tt3)).data;
    assert.equal((await quet('2026-08-18')).gui.CHI_DAO_TT, 0, 'đúng ngày hạn: chưa quá hạn');
    assert.equal((await cb()).length, 0);
    const k1 = await quet('2026-08-19');
    assert.equal(k1.gui.CHI_DAO_TT, 1, 'quá 1 ngày → gửi');
    const c1 = await cb();
    assert.equal(c1.length, 1); assert.equal(c1[0].muc, 'CHI_DAO_TT'); assert.deepEqual([...c1[0].nguoi_nhan].sort(), [IDS.cvp, IDS.pcvp2].sort());
    const mau = /^Chỉ đạo Thường trực quá hạn phản hồi · NV-T90: quá 1 ngày \(hạn 18\/08\/2026\)/;
    for (const u of [IDS.cvp, IDS.pcvp2]) {
      const t = await tin(u, 'NV-T90', mau);
      assert.equal(t.length, 1, `${u} nhận tin quá hạn`); assert.equal(t[0].sender_id, null, 'tin hệ thống không người gửi');
    }
    assert.equal((await tin(IDS.a0, 'NV-T90', mau)).length, 0, 'A0 không nhận tin quá hạn');
    assert.equal((await tin(IDS.cv2, 'NV-T90', mau)).length, 0, 'Owner không nhận (không leo thang)');
    const k2 = await quet('2026-08-19');
    assert.equal(k2.gui.CHI_DAO_TT, 0, 'quét lại cùng ngày: bỏ qua'); assert.equal((await cb()).length, 1);
    const v = await (await userClient('demo_a0')).from('v_chi_dao_tt').select('id, ma, trang_thai, qua_han_phan_hoi, nguoi_nhan_ten').in('id', [tt2, tt3]);
    assertOk(v, 'A0 đọc v_chi_dao_tt');
    assert.equal(v.data.find((x) => x.id === tt3).qua_han_phan_hoi, true, 'hạn 18/08 đã qua');
    assert.equal(v.data.find((x) => x.id === tt2).qua_han_phan_hoi, false, 'đã phản hồi → không quá hạn');
    assert.equal(v.data.find((x) => x.id === tt3).nguoi_nhan_ten.length, 2);
    // Nhạy múi giờ: hạn = hôm qua theo giờ Việt Nam phải là quá hạn kể cả khi chạy trong khung 17–24h UTC (ngày UTC còn là hôm qua).
    assertOk(await db().from('chi_dao').update({ han_phan_hoi: congNgay(homNayVN(), -1) }).eq('id', tt3), 'hạn = hôm qua giờ Việt Nam');
    const v2 = await (await userClient('demo_pcvp2')).from('v_chi_dao_tt').select('id, qua_han_phan_hoi').eq('id', tt3).single();
    assertOk(v2, 'PCVP2 đọc v_chi_dao_tt trong phạm vi'); assert.equal(v2.data.qua_han_phan_hoi, true, 'quá hạn theo kl_hom_nay()');
    assertOk(await rpc('demo_cvp', 'chi_dao_phan_hoi', { p: { chi_dao_id: tt3, noi_dung: 'KL-0032 trả lời muộn' } }), 'Chánh VP phản hồi');
    assert.equal((await quet('2026-08-25')).gui.CHI_DAO_TT, 0, 'đã phản hồi → không gửi nữa');
  });
});
