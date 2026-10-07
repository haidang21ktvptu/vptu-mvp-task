// 0077 (Đợt A v3.17) — Bỏ hạn nộp minh chứng: mọi đường ghi (giao_viec, INSERT service_role, GIA_HAN kèm hạn nộp mới) đều về NULL; giao không cần
// hạn nộp; dat_han_nop_minh_chung báo "đã bỏ"; Hoàn thành việc theo_1400 chỉ khi lãnh đạo nghiệm thu (dong_nhiem_vu / Cập nhật nhanh ⇒ 22023);
// trả lại chỉ cần lý do (han_nop_lai luôn NULL, tin "nộp lại trước hạn hoàn thành"). Khối bảng trạng thái tại ngày cố định (thay 0058) = logic
// thuần ⇒ chỉ cục bộ: không còn CHAM_NOP_MINH_CHUNG / Vàng theo hạn nộp; Q9 nộp đúng hạn theo hạn hoàn thành. Khoá "KL-0077"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, CHI_CUC_BO, homNayVN } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0077';
const H = '2026-12-31';
let dem = 0;
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: {
  van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem}`, san_pham_loai: 'TO_TRINH', han_xu_ly: H, nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH',
  owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, ...p } });
const doc = async (nvId) => (await db().from('nhiem_vu').select('han_xu_ly, han_nop_minh_chung, ly_do_han_nop_sat, tien_do_ma').eq('id', nvId).single()).data;
const loi = (r, re, label) => assert.match(r.error?.message || '', re, `${label}: ${r.error?.message || 'không có lỗi'}`);
const nop = async (nv, so) => assertOk(await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: nv, so_hieu: `${KHOA}/${so}`, ngay_van_ban: homNayVN(),
  cap_nhan: 'TRUONG_PHONG', trich_yeu: 'Báo cáo', mo_ta_ket_qua: 'Đã gửi.' } }), `nộp ${so}`);
const mcCua = async (nv) => (await db().from('minh_chung').select('id, han_nop_lai').eq('nhiem_vu_id', nv).order('nop_luc', { ascending: false }).limit(1).single()).data;
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0077 — bỏ hạn nộp minh chứng: ghi, giao, nghiệm thu, trả lại', { skip: SKIP }, () => {
  before(don);
  after(don);

  test('1. Mọi đường ghi về NULL: giao_viec kèm hạn nộp + lý do; A2 giao không hạn nộp vẫn được; INSERT service_role; GIA_HAN kèm hạn nộp mới', async () => {
    const r1 = await giao('demo_truongphong', { han_nop_minh_chung: '2026-12-30', ly_do_han_nop_sat: 'Việc gấp' }); assertOk(r1, 'A2 giao kèm hạn nộp');
    assert.deepEqual([(await doc(r1.data.id)).han_nop_minh_chung, (await doc(r1.data.id)).ly_do_han_nop_sat], [null, null], 'trigger đưa về NULL');
    const r2 = await giao('demo_cvp', { owner_tai_khoan: null, nguoi_theo_doi: null }); assertOk(r2, 'CVP giao không hạn nộp (0054 từng đòi)');
    const vbr = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} SR`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    const ins = await db().from('nhiem_vu').insert({ van_ban_id: vbr.data.id, noi_dung: `${KHOA} service_role`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: H,
      han_nop_minh_chung: '2026-12-30', owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong }).select('id, han_nop_minh_chung').single();
    assertOk(ins, 'INSERT service_role'); assert.equal(ins.data.han_nop_minh_chung, null);
    const gh = await (await userClient('demo_truongphong')).rpc('chi_dao_gui', { p: { nhiem_vu_id: r1.data.id, loai: 'GIA_HAN', noi_dung: `${KHOA} gia hạn`, han_moi: '2027-01-29', han_nop_minh_chung_moi: '2027-01-27' } });
    assertOk(gh, 'người giao gia hạn kèm hạn nộp mới');
    assert.deepEqual([(await doc(r1.data.id)).han_xu_ly, (await doc(r1.data.id)).han_nop_minh_chung], ['2027-01-29', null]);
  });

  test('2. dat_han_nop_minh_chung ⇒ 22023 "đã được bỏ"; quan_tri_kl rút hạn hoàn thành không còn bị khung hạn nộp chặn', async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    const dh = await (await userClient('demo_truongphong')).rpc('dat_han_nop_minh_chung', { p_id: nv, p_han: '2026-12-30', p_ly_do: 'Thử' });
    assert.equal(dh.error?.code, '22023'); loi(dh, /đã được bỏ/, 'dat_han_nop');
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cv2 quan_tri_kl tạm');
    try { assertOk(await (await userClient('demo_cv2')).from('nhiem_vu').update({ han_xu_ly: '2026-12-15' }).eq('id', nv).select('id'), 'rút hạn hoàn thành'); }
    finally { await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.cv2); }
    assert.equal((await doc(nv)).han_xu_ly, '2026-12-15');
  });

  test('3. Hoàn thành chỉ khi nghiệm thu (mọi việc theo_1400): nộp rồi dong_nhiem_vu / Cập nhật nhanh ⇒ 22023; A2 nghiệm thu ⇒ HOAN_THANH', async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    await nop(nv, 'Q2');
    loi(await (await userClient('demo_cv1')).rpc('dong_nhiem_vu', { p_id: nv, p_ngay_hoan_thanh: null }), /nghiệm thu/, 'dong_nhiem_vu');
    loi(await (await userClient('demo_cv1')).from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: homNayVN() }).eq('id', nv), /nghiệm thu/, 'Cập nhật nhanh');
    assert.equal((await doc(nv)).tien_do_ma !== 'HOAN_THANH', true);
    const mc = await mcCua(nv);
    assertOk(await (await userClient('demo_truongphong')).rpc('xac_nhan_minh_chung', { p_id: mc.id, p_hop_le: true, p_chat_luong: 'DAT' }), 'A2 nghiệm thu');
    assert.equal((await doc(nv)).tien_do_ma, 'HOAN_THANH');
  });

  test('4. Trả lại chỉ cần lý do: không hạn nộp lại ⇒ được, han_nop_lai NULL kể cả khi truyền; tin "nộp lại trước hạn hoàn thành"; thiếu lý do ⇒ 22023', async () => {
    const r = await giao('demo_truongphong'); assertOk(r, 'A2 giao'); const nv = r.data.id;
    await nop(nv, 'TL1'); const m1 = await mcCua(nv);
    const tp = await userClient('demo_truongphong');
    loi(await tp.rpc('xac_nhan_minh_chung', { p_id: m1.id, p_hop_le: false }), /lý do/, 'thiếu lý do');
    assertOk(await tp.rpc('xac_nhan_minh_chung', { p_id: m1.id, p_hop_le: false, p_ly_do: 'Thiếu số liệu' }), 'trả lại không hạn nộp lại');
    assert.equal((await mcCua(nv)).han_nop_lai, null);
    const tin = await db().from('direct_messages').select('content').eq('nhiem_vu_id', nv).like('content', 'Minh chứng bị trả lại%');
    assert.match(tin.data[0]?.content || '', /Thiếu số liệu — nộp lại trước hạn hoàn thành 31\/12\/2026/);
    await nop(nv, 'TL2'); const m2 = await mcCua(nv);
    assertOk(await tp.rpc('xac_nhan_minh_chung', { p_id: m2.id, p_hop_le: false, p_ly_do: 'Nộp trùng', p_han_nop_lai: homNayVN() }), 'trả lại kèm hạn nộp lại (bỏ qua)');
    assert.equal((await mcCua(nv)).han_nop_lai, null, 'han_nop_lai luôn NULL');
  });
});

// Bảng trạng thái tại ngày cố định (thay 0058): H = 20/08/2026 (T5), ngưỡng vàng 3, sắp đến hạn 7, Đỏ đặc biệt 3. Minh chứng chèn bằng service_role
// với nop_luc / xac_nhan_luc đặt tay (một số ở khung 17–24h UTC = sáng hôm sau giờ VN).
describe('0077 — trạng thái không còn hạn nộp (logic)', { skip: SKIP || CHI_CUC_BO }, () => {
  let fx; const id = {};
  const them = async (ma, row = {}) => {
    const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} TT ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-20',
      nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.truongphong, theo_1400: true,
      ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
    assertOk(r, ma); id[ma] = r.data.id;
  };
  const mc = async (ma, nopLuc, them_ = {}) => assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: id[ma], loai: 'so_hieu', so_hieu: `${KHOA}/${ma}/${nopLuc}`,
    ngay_van_ban: '2026-08-10', cap_nhan: 'TRUONG_PHONG', nop_boi: IDS.cv1, nop_luc: nopLuc, ...them_ }), `mc ${ma}`);
  const kt = async (ma, ngay, trangThai, muc, them_ = {}) => {
    const r = await db().rpc('tinh_trang_thai', { p_id: id[ma], p_ngay: ngay }); assertOk(r, `${ma} ${ngay}`); const t = r.data;
    assert.deepEqual({ trang_thai: t.trang_thai, muc: t.muc_canh_bao, ...Object.fromEntries(Object.keys(them_).map((k) => [k, t[k]])) },
      { trang_thai: trangThai, muc, ...them_ }, `${ma} tại ${ngay}`);
  };
  before(async () => {
    fx = await setupKlFixtures();
    await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA} TT%`);
    await Promise.all([them('A'), them('B'), them('D2'), them('D3'), them('D4', { minh_chung: 'Công văn 5/CV' }), them('D5'), them('F'), them('Z'), them('G'), them('G2'), them('G3'),
      them('X', { han_xu_ly: null, ly_do_chua_co_han: 'Chờ' }), them('R8', { han_xu_ly: '2026-09-01' }), them('Q5', { han_xu_ly: '2026-09-15' })]);
    await Promise.all([
      mc('A', '2026-08-17T03:00:00Z'), mc('D2', '2026-08-01T03:00:00Z', { loai: 'chu_cu', so_hieu: null, noi_dung_chu: 'CV 1' }),
      mc('D3', '2026-08-03T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-05T03:00:00Z' }),
      mc('D5', '2026-08-10T03:00:00Z'), mc('Z', '2026-08-17T18:30:00Z'), mc('X', '2026-08-10T03:00:00Z'), mc('Q5', new Date().toISOString()),
      mc('F', '2026-08-17T03:00:00Z', { hop_le: false, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-18T20:00:00Z', ly_do_khong_hop_le: 'x' }),
      mc('G', '2026-08-17T03:00:00Z', { hop_le: false, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-18T03:00:00Z', ly_do_khong_hop_le: 'x' })]);
    await Promise.all([mc('G', '2026-08-19T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-21T03:00:00Z' }),
      mc('G2', '2026-08-21T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-21T05:00:00Z' }),
      mc('G3', '2026-08-19T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-20T03:00:00Z' })]);
    for (const [ma, ngay] of [['G', '2026-08-19'], ['G2', '2026-08-19'], ['G3', '2026-08-19']]) {
      assertOk(await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: ngay }).eq('id', id[ma]), `đóng ${ma}`);
    }
  });
  after(() => db().from('nhiem_vu').delete().like('noi_dung', `${KHOA} TT%`));

  test('1. Chờ nghiệm thu / quá hạn ở bước nghiệm thu / quá hạn / sắp đến hạn (Vàng chỉ theo hạn hoàn thành, không còn Chậm nộp)', async () => {
    await kt('A', '2026-08-21', 'QUA_HAN_NGHIEM_THU', 'DO', { so_ngay_qua: 1, minh_chung_buoc: 'CHO_NGHIEM_THU' });
    await kt('A', '2026-08-24', 'QUA_HAN_NGHIEM_THU', 'DO_DAC_BIET');
    await kt('A', '2026-08-19', 'CHO_NGHIEM_THU', 'XANH', { nop_dung_han: 'DUNG_HAN', nghiem_thu_dung_han: 'CHUA', han_nop_hieu_luc: null });
    await kt('A', '2026-08-16', 'SAP_DEN_HAN', 'XANH', { minh_chung_buoc: 'CHUA_NOP' });   // bỏ minh chứng nộp 17/08; còn 4 ngày > ngưỡng vàng 3
    await kt('A', '2026-08-17', 'CHO_NGHIEM_THU', 'XANH');   // nộp 17/08 10:00 giờ VN: tính tại ngày 17/08 đã là đang chờ
    await kt('B', '2026-08-21', 'QUA_HAN', 'DO');
    await kt('B', '2026-08-19', 'SAP_DEN_HAN', 'VANG', { nop_dung_han: 'CHUA_NOP' });   // 0058 từng là CHAM_NOP_MINH_CHUNG
    await kt('B', '2026-08-13', 'SAP_DEN_HAN', 'XANH');
    await kt('B', '2026-08-12', 'DANG_THUC_HIEN', 'XANH');
  });

  test('2. Minh chứng cũ / đã nghiệm thu / cột chữ / đang chờ; việc chưa có hạn', async () => {
    await kt('D2', '2026-08-18', 'SAP_DEN_HAN', 'XANH', { minh_chung_buoc: 'CHU_CU' });   // chu_cu: hợp lệ, không phải "đang chờ"
    await kt('D3', '2026-08-18', 'SAP_DEN_HAN', 'XANH', { minh_chung_buoc: 'DA_NGHIEM_THU' });
    await kt('D4', '2026-08-18', 'SAP_DEN_HAN', 'XANH');
    await kt('D5', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');
    await kt('X', '2026-08-18', 'CAN_DIEN_HAN', 'KHONG_AP_DUNG', { minh_chung_buoc: 'CHO_NGHIEM_THU', nop_dung_han: 'KHONG_DANH_GIA' });
  });

  test('3. Trả lại: BI_TRA_LAI, đếm số lần, Vàng theo hạn hoàn thành; qua H ⇒ Quá hạn. Múi giờ: nộp 18:30 UTC 17/08 = 18/08 giờ VN', async () => {
    await kt('F', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');   // trả lại lúc 20:00 UTC 18/08 = 19/08 giờ VN
    await kt('F', '2026-08-19', 'SAP_DEN_HAN', 'VANG', { minh_chung_buoc: 'BI_TRA_LAI', han_nop_hieu_luc: null, so_lan_tra_lai: 1 });
    await kt('F', '2026-08-21', 'QUA_HAN', 'DO');
    await kt('Z', '2026-08-17', 'SAP_DEN_HAN', 'VANG', { minh_chung_buoc: 'CHUA_NOP' });
    await kt('Z', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');
  });

  test('4. Q9 theo hạn hoàn thành: nộp đúng hạn = ngày nộp lượt được nghiệm thu ≤ H; nghiệm thu đúng hạn = ngày xác nhận ≤ H', async () => {
    await kt('G', '2026-08-31', 'HOAN_THANH', 'KHONG_AP_DUNG', { nop_dung_han: 'DUNG_HAN', nghiem_thu_dung_han: 'TRE', so_lan_tra_lai: 1, ket_qua: 'DUNG_HAN' });
    await kt('G2', '2026-08-31', 'HOAN_THANH', 'KHONG_AP_DUNG', { nop_dung_han: 'TRE', nghiem_thu_dung_han: 'TRE', so_lan_tra_lai: 0 });   // nộp và nghiệm thu sau H
    await kt('G3', '2026-08-31', 'HOAN_THANH', 'KHONG_AP_DUNG', { nop_dung_han: 'DUNG_HAN', nghiem_thu_dung_han: 'DUNG_HAN', so_lan_tra_lai: 0 });
  });

  test('5. v_nhiem_vu hôm nay: nguoi_chiu_cham dòng 5 (người nhận nhắc chính) và dòng 7 (chủ trì); không dòng nào CHAM_NOP_MINH_CHUNG', async () => {
    const v = async (m) => (await db().from('v_nhiem_vu').select('trang_thai, han_nop_hieu_luc, nguoi_chiu_cham, phong_chiu_cham').eq('id', id[m]).single()).data;
    assert.deepEqual(await v('Q5'), { trang_thai: 'QUA_HAN_NGHIEM_THU', han_nop_hieu_luc: null, nguoi_chiu_cham: IDS.truongphong, phong_chiu_cham: 'TONG_HOP' });
    assert.deepEqual(await v('R8'), { trang_thai: 'QUA_HAN', han_nop_hieu_luc: null, nguoi_chiu_cham: IDS.cv1, phong_chiu_cham: 'TONG_HOP' });
    const cham = await db().from('v_nhiem_vu').select('id').eq('trang_thai', 'CHAM_NOP_MINH_CHUNG');
    assert.equal((cham.data || []).length, 0);
  });
});
