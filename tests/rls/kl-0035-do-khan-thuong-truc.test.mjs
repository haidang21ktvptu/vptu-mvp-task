// GĐ22 (0035–0037) — độ khẩn 4 cấp: ngưỡng theo cấp (kl_nguong_do_khan), giờ làm việc 7h30–17h VN (gio_lam_viec_sau, có mốc 17–23h UTC),
// Vàng theo cấp trong trang_thai; giao_viec: do_khan, giao thay mặt (bắt buộc với A3 quan_tri_kl, phải là A1/A2 trong phạm vi → cấp duyệt từ chối
// là lãnh đạo đó), nhánh A0 (Owner = lãnh đạo VP / phòng, uu_tien THUONG_TRUC chỉ A0 đặt được, Chánh VP nhận tin, cấp duyệt từ chối của CVP = A0);
// chi_dao_gui: do_khan, hạn phản hồi theo cấp, Hỏa tốc thêm Chánh VP; xac_nhan_da_nhan_chi_dao; canh_bao_quet: HOA_TOC_CHUA_NHAN (mỗi lần quét trong
// giờ làm việc), TT_CHUA_NHAN (hằng ngày); v_dien_bien không lộ lý do từ chối ngoài chuỗi; thứ tự v_ngoai_le; kl_so_chua_xu_ly. Tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {}; let t0; let cdHoaToc; let ttId; let tcId;
const LY_DO = 'KL-0035 lý do riêng tư';
const assertLoi = (r, label) => assert.ok(r.error, `${label}: phải bị từ chối (22023)`);
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ngayLamViecSau = (iso, n) => { let d = iso; while (n > 0) { d = congNgay(d, 1); if (new Date(`${d}T00:00:00Z`).getUTCDay() % 6 !== 0) n--; } return d; };
const giao = (u, p) => rpc(u, 'giao_viec', { p: { van_ban_id: fx.hn, noi_dung: `KL-0035 ${p.ma || ''}`, san_pham_loai: 'TO_TRINH', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH', ...p } });
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `KL-0035 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1,
    nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const nv = async (i) => (await db().from('nhiem_vu').select('*').eq('id', i).single()).data;
const tin = async (nguoi, i, mau) => (await db().from('direct_messages').select('content').eq('receiver_id', nguoi).eq('loai', 'he_thong').eq('nhiem_vu_id', i).gte('created_at', t0)).data.filter((t) => mau.test(t.content));
const canhBao = async (muc, i) => (await db().from('canh_bao').select('id, nguoi_nhan, chi_dao_id').eq('muc', muc).eq('nhiem_vu_id', i).gte('gui_luc', t0)).data;
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', 'KL-0035%');
  await db().from('van_ban_giao_viec').delete().eq('tao_boi', IDS.a0).like('so_ket_luan', 'Thường trực giao %');
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.qtht);
  if (t0) {
    await db().from('canh_bao').delete().gte('gui_luc', t0);
    await db().from('direct_messages').delete().eq('loai', 'he_thong').gte('created_at', t0);
    await db().from('lich_su').delete().eq('cot', 'canh_bao').gte('luc', t0);
  }
};

describe('0035–0037 — độ khẩn, giao thay mặt, Thường trực giao, Đã nhận hỏa tốc, nhắc, diễn biến, thứ tự, đếm', { skip: SKIP }, () => {
  before(async () => { fx = await setupKlFixtures(); await don(); t0 = new Date().toISOString(); });
  after(don);

  test('1. Ngưỡng theo cấp và giờ làm việc (7h30–17h VN, bỏ T7/CN; mốc 17–23h UTC = sáng sớm VN)', async () => {
    const ng = async (c) => (await rpc('demo_cvp', 'kl_nguong_do_khan', { p_do_khan: c })).data;
    assert.deepEqual(await ng('THUONG'), { vang: 3, nhac_lai: 3, han_phan_hoi: 2 });
    assert.deepEqual(await ng('KHAN'), { vang: 5, nhac_lai: 2, han_phan_hoi: 1 });
    assert.deepEqual(await ng('THUONG_KHAN'), { vang: 5, nhac_lai: 1, han_phan_hoi: 0 });
    assert.deepEqual(await ng('HOA_TOC'), { vang: 5, nhac_lai: 1, han_phan_hoi: 0 });
    const g = async (tu, gio) => new Date((await rpc('demo_cvp', 'gio_lam_viec_sau', { p_tu: tu, p_gio: gio })).data).toISOString();
    assert.equal(await g('2026-09-16T02:00:00Z', 2), '2026-09-16T04:00:00.000Z', 'Thứ Tư 9h + 2h = 11h');
    assert.equal(await g('2026-09-16T09:00:00Z', 2), '2026-09-17T01:30:00.000Z', '16h + 2h: 1h còn lại dồn sang 7h30 hôm sau → 8h30');
    assert.equal(await g('2026-09-18T09:00:00Z', 2), '2026-09-21T01:30:00.000Z', 'Thứ Sáu 16h → Thứ Hai 8h30');
    assert.equal(await g('2026-09-19T03:00:00Z', 0), '2026-09-21T00:30:00.000Z', 'Thứ Bảy → Thứ Hai 7h30');
    assert.equal(await g('2026-09-15T23:30:00Z', 2), '2026-09-16T02:30:00.000Z', '23h30 UTC = 6h30 VN → 7h30 + 2h = 9h30 VN');
    assert.equal(await g('2026-09-16T17:30:00Z', 2), '2026-09-17T02:30:00.000Z', '17h30 UTC = 0h30 VN hôm sau → 9h30 VN hôm sau');
  });

  test('2. trang_thai: Vàng theo độ khẩn — còn 4 ngày: Thường XANH, Khẩn VÀNG', async () => {
    await them({ ma: 'NV-T40', han_xu_ly: congNgay(homNayVN(), 4) });
    await them({ ma: 'NV-T41', han_xu_ly: congNgay(homNayVN(), 4), do_khan: 'KHAN' });
    const r = await (await userClient('demo_cvp')).from('v_nhiem_vu').select('id, muc_canh_bao, do_khan, thu_tu_do_khan').in('id', [id['NV-T40'], id['NV-T41']]);
    assertOk(r, 'v_nhiem_vu');
    assert.equal(r.data.find((x) => x.id === id['NV-T40']).muc_canh_bao, 'XANH');
    assert.deepEqual(r.data.find((x) => x.id === id['NV-T41']), { id: id['NV-T41'], muc_canh_bao: 'VANG', do_khan: 'KHAN', thu_tu_do_khan: 3 });
  });

  test('3. giao_viec: độ khẩn ghi vào việc; Hỏa tốc → người nhận + Chánh VP nhận tin; độ khẩn lạ và uu_tien từ A2 bị chặn', async () => {
    assertLoi(await giao('demo_truongphong', { ma: 'sai', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, do_khan: 'RAT_KHAN' }), 'độ khẩn lạ');
    assertDenied(await giao('demo_truongphong', { ma: 'uu tien', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, uu_tien: 'THUONG_TRUC' }), 'A2 đặt uu_tien');
    const r = await giao('demo_truongphong', { ma: 'hoa toc', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, do_khan: 'HOA_TOC' });
    assertOk(r, 'A2 giao Hỏa tốc'); id['NV-T42'] = r.data.id;
    const v = await nv(id['NV-T42']); assert.equal(v.do_khan, 'HOA_TOC'); assert.equal(v.uu_tien, null); assert.equal(v.giao_thay_mat_cho, null);
    assert.equal((await tin(IDS.cv1, v.id, /^Giao việc · Hỏa tốc · NV-/)).length, 1, 'người nhận có tin');
    assert.equal((await tin(IDS.cvp, v.id, /^Giao việc · Hỏa tốc · NV-/)).length, 1, 'Chánh VP có tin (Hỏa tốc)');
    assert.equal((await tin(IDS.pcvp, v.id, /Giao việc/)).length, 0, 'PCVP không nhận');
  });

  test('4. Giao thay mặt: A3 quan_tri_kl phải ghi lãnh đạo A1/A2 trong phạm vi Owner; vết + tin; cấp duyệt từ chối = lãnh đạo đó', async () => {
    await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.qtht);
    assertLoi(await giao('demo_qtht', { ma: 'khong tm', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }), 'thiếu thay mặt');
    assertLoi(await giao('demo_qtht', { ma: 'tm a3', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.cv2 }), 'thay mặt một A3');
    assertLoi(await giao('demo_qtht', { ma: 'tm khac phong', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, thay_mat_cho: IDS.truongphong }), 'Trưởng phòng Tổng hợp không thay mặt cho Owner phòng Quản trị');
    assertLoi(await giao('demo_cvp', { ma: 'a1 tm', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.pcvp }), 'lãnh đạo giao trực tiếp, không thay mặt');
    const r = await giao('demo_qtht', { ma: 'thay mat', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.pcvp });
    assertOk(r, 'quản trị KL giao thay mặt PCVP'); id['NV-T43'] = r.data.id;
    assert.equal((await nv(id['NV-T43'])).giao_thay_mat_cho, IDS.pcvp);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', id['NV-T43']).eq('cot', 'giao_thay_mat')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, /Demo Quản trị hệ thống giao thay mặt Demo Phó Chánh Văn phòng/);
    assert.equal((await tin(IDS.pcvp, id['NV-T43'], /^Giao việc thay mặt Demo Phó Chánh Văn phòng · NV-/)).length, 1, 'lãnh đạo được thay mặt nhận tin ngay');
    assert.equal((await tin(IDS.cv1, id['NV-T43'], /Giao việc thay mặt/)).length, 1, 'Owner nhận tin');
    const tc = await rpc('demo_cv1', 'de_nghi_tu_choi', { p_nhiem_vu: id['NV-T43'], p_ly_do: LY_DO });
    assertOk(tc, 'cv1 đề nghị từ chối'); tcId = tc.data;
    assert.equal((await db().from('tu_choi').select('cap_duyet').eq('id', tcId).single()).data.cap_duyet, IDS.pcvp, 'cấp duyệt = PCVP được thay mặt, không phải Trưởng phòng');
    assert.equal((await tin(IDS.qtht, id['NV-T43'], /Đề nghị từ chối/)).length, 1, 'người giao thay mặt nhận tin đề nghị');
  });

  test('5. Thường trực giao việc: Owner = lãnh đạo VP (theo dõi = chính họ) hoặc phòng (theo dõi = Trưởng phòng); mặc định Khẩn; uu_tien THUONG_TRUC; Chánh VP nhận tin; A3 làm Owner bị chặn; cấp duyệt từ chối của Chánh VP = A0', async () => {
    assertDenied(await giao('demo_a0', { ma: 'a0 cho a3', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }), 'A0 giao cho chuyên viên');
    const r = await rpc('demo_a0', 'giao_viec', { p: { noi_dung: 'KL-0035 TT giao CVP', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31' } });
    assertOk(r, 'A0 giao cho Chánh VP, không văn bản'); ttId = r.data.id;
    const v = await nv(ttId);
    assert.equal(v.uu_tien, 'THUONG_TRUC'); assert.equal(v.do_khan, 'KHAN'); assert.equal(v.nguoi_theo_doi, IDS.cvp); assert.equal(v.tao_boi, IDS.a0);
    assert.equal((await db().from('van_ban_giao_viec').select('loai, co_quan_ban_hanh').eq('id', v.van_ban_id).single()).data.loai, 'KHAC');
    assert.equal((await tin(IDS.cvp, ttId, /^Thường trực giao việc · Khẩn · NV-/)).length, 1, 'Chánh VP nhận tin');
    const r2 = await rpc('demo_a0', 'giao_viec', { p: { noi_dung: 'KL-0035 TT giao phòng', owner_don_vi_ma: 'TONG_HOP', san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', do_khan: 'THUONG_KHAN' } });
    assertOk(r2, 'A0 giao cho phòng Tổng hợp'); id['NV-T45'] = r2.data.id;
    const v2 = await nv(id['NV-T45']); assert.equal(v2.nguoi_theo_doi, IDS.truongphong, 'người theo dõi = Trưởng phòng'); assert.equal(v2.owner_tai_khoan, null);
    assert.equal((await tin(IDS.truongphong, v2.id, /^Thường trực giao việc · Thượng khẩn/)).length, 1, 'Trưởng phòng nhận tin');
    assert.equal((await tin(IDS.cvp, v2.id, /Thường trực giao việc/)).length, 1, 'Chánh VP vẫn nhận tin khi giao cho phòng');
    assertDenied(await (await userClient('demo_qtht')).from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: 'KL-0035 chen uu tien', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
      nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.cv1, uu_tien: 'THUONG_TRUC' }).select('id'), 'quản trị KL chèn thẳng uu_tien');
    const tc = await rpc('demo_cvp', 'de_nghi_tu_choi', { p_nhiem_vu: ttId, p_ly_do: LY_DO });
    assertOk(tc, 'Chánh VP đề nghị từ chối việc Thường trực giao');
    assert.equal((await db().from('tu_choi').select('cap_duyet').eq('id', tc.data).single()).data.cap_duyet, IDS.a0, 'cấp duyệt = Thường trực');
    assertOk(await rpc('demo_a0', 'duyet_tu_choi', { p_id: tc.data, p_dong_y: false, p_y_kien: 'Tiếp tục thực hiện' }), 'A0 duyệt không đồng ý');
  });

  test('6. chi_dao_gui: độ khẩn, hạn phản hồi theo cấp, Hỏa tốc thêm Chánh VP; xac_nhan_da_nhan_chi_dao chỉ người nhận', async () => {
    const r = await rpc('demo_truongphong', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T42'], loai: 'DON_DOC', noi_dung: 'KL-0035 đôn đốc hỏa tốc', do_khan: 'HOA_TOC' } });
    assertOk(r, 'A2 đôn đốc Hỏa tốc'); cdHoaToc = r.data;
    const c = (await db().from('chi_dao').select('do_khan, han_phan_hoi, da_nhan').eq('id', cdHoaToc).single()).data;
    assert.equal(c.do_khan, 'HOA_TOC'); assert.equal(c.han_phan_hoi, ngayLamViecSau(homNayVN(), 0), 'hạn phản hồi trong ngày'); assert.deepEqual(c.da_nhan, []);
    assert.equal((await tin(IDS.cv1, id['NV-T42'], /^Đôn đốc · NV-.*\[Hỏa tốc\]/)).length, 1, 'người nhận có tin kèm cấp');
    assert.equal((await tin(IDS.cvp, id['NV-T42'], /^Đôn đốc · NV-.*\[Hỏa tốc\]/)).length, 1, 'Chánh VP nhận tin (Hỏa tốc)');
    const tt = await rpc('demo_a0', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T42'], loai: 'CHI_DAO_TT', noi_dung: 'KL-0035 TT chỉ đạo' } });
    assertOk(tt, 'A0 CHI_DAO_TT mặc định Khẩn');
    const ct = (await db().from('chi_dao').select('do_khan, han_phan_hoi').eq('id', tt.data).single()).data;
    assert.equal(ct.do_khan, 'KHAN'); assert.equal(ct.han_phan_hoi, ngayLamViecSau(homNayVN(), 1), 'Khẩn: 1 ngày làm việc');
    assertDenied(await rpc('demo_cv2', 'xac_nhan_da_nhan_chi_dao', { p_id: cdHoaToc }), 'người ngoài bấm Đã nhận');
    assertDenied(await rpc('demo_a0', 'xac_nhan_da_nhan_chi_dao', { p_id: cdHoaToc }), 'A0 bấm Đã nhận');
  });

  test('7. canh_bao_quet: Hỏa tốc quá 2 giờ làm việc chưa Đã nhận → nhắc người nhận + cấp trên + Chánh VP mỗi lần quét trong giờ; ngoài giờ không; sau Đã nhận không', async () => {
    await db().from('nhiem_vu').update({ created_at: '2026-09-14T02:00:00Z' }).eq('id', id['NV-T42']);           // Thứ Hai 9h VN
    await db().from('chi_dao').update({ created_at: '2026-09-14T02:00:00Z' }).eq('id', cdHoaToc);
    const q1 = await db().rpc('canh_bao_quet', { p_ngay: homNayVN(), p_luc: '2026-09-16T03:00:00Z' });                 // Thứ Tư 10h VN
    assertOk(q1, 'quét trong giờ'); assert.ok(q1.data.gui.HOA_TOC_CHUA_NHAN >= 2, `việc + chỉ đạo: ${JSON.stringify(q1.data.gui)}`);
    const cb = await canhBao('HOA_TOC_CHUA_NHAN', id['NV-T42']);
    assert.equal(cb.length, 2); for (const x of cb) for (const u of [IDS.cv1, IDS.truongphong, IDS.cvp]) assert.ok(x.nguoi_nhan.includes(u), `người nhận có ${u}`);
    assert.ok(cb.some((x) => x.chi_dao_id === cdHoaToc), 'dòng của chỉ đạo ghi chi_dao_id');
    assert.equal((await tin(IDS.cvp, id['NV-T42'], /^Hỏa tốc chưa Đã nhận · NV-/)).length, 2, 'Chánh VP nhận 2 tin');
    const q2 = await db().rpc('canh_bao_quet', { p_ngay: homNayVN(), p_luc: '2026-09-16T03:10:00Z' });
    assert.equal((await canhBao('HOA_TOC_CHUA_NHAN', id['NV-T42'])).length, 2, 'quét lại trong 50 phút không gửi lặp'); assert.ok(q2.data.bo_qua >= 2);
    const q3 = await db().rpc('canh_bao_quet', { p_ngay: homNayVN(), p_luc: '2026-09-16T15:00:00Z' });                // 22h VN
    assert.equal(q3.data.gui.HOA_TOC_CHUA_NHAN, 0, 'ngoài giờ làm việc không nhắc');
    assert.equal((await rpc('demo_cv1', 'xac_nhan_nhan_viec', { p_id: id['NV-T42'] })).data, true);
    assert.equal((await rpc('demo_cv1', 'xac_nhan_da_nhan_chi_dao', { p_id: cdHoaToc })).data, true, 'cv1 Đã nhận chỉ đạo');
    assert.equal((await rpc('demo_cv1', 'xac_nhan_da_nhan_chi_dao', { p_id: cdHoaToc })).data, false, 'bấm lại không ghi thêm');
    assert.ok((await db().from('chi_dao').select('da_nhan').eq('id', cdHoaToc).single()).data.da_nhan.includes(IDS.cv1));
    assert.equal((await tin(IDS.truongphong, id['NV-T42'], /^Đã nhận chỉ đạo · NV-/)).length, 1, 'người gửi được báo Đã nhận');
    const q4 = await db().rpc('canh_bao_quet', { p_ngay: homNayVN(), p_luc: '2026-09-17T03:00:00Z' });
    assert.equal(q4.data.gui.HOA_TOC_CHUA_NHAN, 0, 'đã nhận cả hai → không nhắc');
  });

  test('8. canh_bao_quet: việc Thường trực giao quá 1 ngày làm việc chưa xác nhận → nhắc người nhận + Chánh VP, một lần mỗi ngày; xác nhận rồi thôi', async () => {
    await db().from('nhiem_vu').update({ created_at: '2026-09-07T02:00:00Z' }).eq('id', ttId);
    const q1 = await db().rpc('canh_bao_quet', { p_ngay: homNayVN() });
    assertOk(q1, 'quét'); assert.ok(q1.data.gui.TT_CHUA_NHAN >= 1);
    const cb = await canhBao('TT_CHUA_NHAN', ttId); assert.equal(cb.length, 1); assert.ok(cb[0].nguoi_nhan.includes(IDS.cvp));
    assert.equal((await tin(IDS.cvp, ttId, /^Việc Thường trực giao chưa xác nhận nhận · NV-/)).length, 1);
    await db().rpc('canh_bao_quet', { p_ngay: homNayVN() });
    assert.equal((await canhBao('TT_CHUA_NHAN', ttId)).length, 1, 'cùng ngày không gửi lặp');
    assertOk(await rpc('demo_cvp', 'xac_nhan_nhan_viec', { p_id: ttId }), 'Chánh VP xác nhận');
    await db().rpc('canh_bao_quet', { p_ngay: congNgay(homNayVN(), 1) });
    assert.equal((await canhBao('TT_CHUA_NHAN', ttId)).length, 1, 'đã xác nhận → hôm sau không nhắc');
  });

  test('9. v_dien_bien: một dòng thời gian; lý do từ chối chỉ người trong chuỗi thấy; A0 ngoài phạm vi tin', async () => {
    const dong = async (u) => (await userClient(u)).from('v_dien_bien').select('nguon, loai, noi_dung').eq('nhiem_vu_id', id['NV-T43']);
    const cv1 = await dong('demo_cv1'); assertOk(cv1, 'cv1 đọc diễn biến');
    assert.ok(cv1.data.some((d) => d.nguon === 'tu_choi_ly_do' && d.noi_dung.includes(LY_DO)), 'người đề nghị thấy lý do');
    assert.ok(cv1.data.some((d) => d.nguon === 'tu_choi' && /đề nghị từ chối/.test(d.noi_dung)), 'vết đề nghị');
    assert.ok(cv1.data.some((d) => d.nguon === 'lich_su' && d.loai === 'giao_thay_mat'), 'vết giao thay mặt');
    const qt = await dong('demo_qtht'); assertOk(qt, 'quản trị KL (người giao thay) đọc');
    assert.ok(qt.data.some((d) => d.nguon === 'tu_choi'), 'thấy sự kiện từ chối');
    assert.ok(!qt.data.some((d) => d.noi_dung.includes(LY_DO)), 'không thấy lý do');
    const cd = await (await userClient('demo_cv1')).from('v_dien_bien').select('nguon, loai, gia_tri_cu').eq('nhiem_vu_id', id['NV-T42']);
    assert.ok(cd.data.some((d) => d.nguon === 'chi_dao' && d.loai === 'DON_DOC' && d.gia_tri_cu === 'Hỏa tốc'), 'chỉ đạo kèm độ khẩn');
    assert.ok(cd.data.some((d) => d.nguon === 'canh_bao'), 'cảnh báo có trong diễn biến');
  });

  test('10. Thứ tự v_ngoai_le: độ khẩn → Thường trực giao → số ngày trễ; kl_so_chua_xu_ly đếm đúng vai', async () => {
    await them({ ma: 'NV-T46', han_xu_ly: '2026-08-15' });                                                       // Thường, trễ nhiều
    await them({ ma: 'NV-T47', han_xu_ly: congNgay(homNayVN(), -1), do_khan: 'KHAN' });                            // Khẩn, trễ 1 ngày
    await them({ ma: 'NV-T48', han_xu_ly: congNgay(homNayVN(), -1), do_khan: 'KHAN', uu_tien: 'THUONG_TRUC', tao_boi: IDS.a0 });
    const nl = await (await userClient('demo_cvp')).from('v_ngoai_le').select('id, thu_tu_do_khan, uu_tien');
    assertOk(nl, 'v_ngoai_le'); const vt = (ma) => nl.data.findIndex((r) => r.id === id[ma]);
    assert.ok(vt('NV-T48') >= 0 && vt('NV-T48') < vt('NV-T47') && vt('NV-T47') < vt('NV-T46'), `thứ tự ${vt('NV-T48')} < ${vt('NV-T47')} < ${vt('NV-T46')}`);
    const so = async (u) => (await rpc(u, 'kl_so_chua_xu_ly', {})).data;
    const cv1 = await so('demo_cv1'); assert.ok(cv1.viec_moi >= 3, `cv1 việc mới chờ xác nhận: ${cv1.viec_moi}`); assert.equal(cv1.hoa_toc_chi_dao, 0);
    const tp = await so('demo_truongphong'); assert.ok(tp.tt_cho_nhan >= 1, 'Trưởng phòng có việc Thường trực giao chờ nhận');
    const pcvp = await so('demo_pcvp'); assert.ok(pcvp.de_nghi_cho_duyet >= 1, 'PCVP có đề nghị từ chối chờ duyệt (giao thay mặt)');
    assert.ok((await so('demo_a0')).can_quyet >= 0);
  });
});
