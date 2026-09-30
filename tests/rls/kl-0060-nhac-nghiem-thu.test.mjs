// PR-2b (0060) — canh_bao_quet theo hạn nộp minh chứng, CHỈ chạy cục bộ (logic thuần; canh-bao.yml quét một lần/ngày 07:30 giờ VN).
// Ca: người nhận từng mức (NGHIEM_THU, NGHIEM_THU_QUA_HAN, CHAM_NOP_MC, VANG việc có hạn nộp); người nộp không nhận khi chờ / quá hạn nghiệm thu;
// CHAM_NOP_MC không tới thủ trưởng / Chánh VP; quét hai lần cùng ngày = một; ngày nghỉ (T7) không nhắc quá hạn nghiệm thu; người nhận nhắc chính
// của 7 loại chủ trì (bảng A6), kể cả việc Thường trực giao cho Chánh VP (thư ký; không có thì quan_tri_kl). Ngày quét tháng 8/2026 (test khác
// dùng tháng 9); dọn cảnh báo của các ngày này ở after. Khoá "KL-0060".
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, assertOk, IDS, CHI_CUC_BO } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0060';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk — thư ký tạm
const NGAY = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-21', '2026-08-22', '2026-08-24'];
let fx; const id = {};
const them = async (ma, row = {}, nop = IDS.cv1) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-20',
    han_nop_minh_chung: '2026-08-18', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
    tao_boi: IDS.truongphong, theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
  if (nop) assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: id[ma], loai: 'so_hieu', so_hieu: `${KHOA}/${ma}`, ngay_van_ban: '2026-08-10',
    cap_nhan: 'TRUONG_PHONG', nop_boi: nop, nop_luc: '2026-08-17T03:00:00Z' }), `mc ${ma}`);
};
const quet = async (ngay) => { const r = await db().rpc('canh_bao_quet', { p_ngay: ngay, p_luc: `${ngay}T01:00:00Z` }); assertOk(r, `quét ${ngay}`); return r.data; };
const cb = async (ma, muc, ngay) => {
  let q = db().from('canh_bao').select('nguoi_nhan, ngay').eq('nhiem_vu_id', id[ma]).eq('muc', muc);
  if (ngay) q = q.eq('ngay', ngay);
  return (await q).data;
};
const nhan = async (ma, muc, ngay) => (await cb(ma, muc, ngay)).flatMap((x) => x.nguoi_nhan).sort();
const co = (thuKy, qtkl) => Promise.all([db().from('accounts').update({ thu_ky_thuong_truc: thuKy }).eq('id', TK),
  db().from('accounts').update({ quan_tri_kl: qtkl, quan_tri_kl_het_han: null }).eq('id', IDS.cv2)]);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('canh_bao').delete().in('ngay', NGAY);
  await co(false, false);
};

describe('0060 — nhắc theo hạn nộp minh chứng và nghiệm thu', { skip: SKIP || CHI_CUC_BO }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await co(true, false);
    await Promise.all([
      them('A3'),                                                                                     // chủ trì A3, A2 giao → A2
      them('A2', { owner_tai_khoan: IDS.truongphong, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.a0 }, IDS.truongphong),   // chủ trì A2 → PCVP phụ trách
      them('PH', { owner_tai_khoan: null, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.a0 }, IDS.truongphong),             // phòng (A0 giao) → PCVP
      them('PC', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.pcvp, nguoi_theo_doi: IDS.pcvp, tao_boi: IDS.a0 }, IDS.pcvp),   // PCVP → CVP
      them('CV', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp, nguoi_theo_doi: IDS.cvp, tao_boi: IDS.a0 }, IDS.cvp),      // CVP → thư ký
      them('NG', { owner_don_vi_ma: 'DANG_UY_UBND', owner_tai_khoan: null, tao_boi: null }),        // đơn vị ngoài, không thay mặt → lãnh đạo trực tiếp theo dõi
      them('P1', { tao_boi: IDS.pcvp }),                                                              // PCVP giao cho cán bộ → PCVP
      them('TD', { nguoi_theo_doi: IDS.truongphong }),                                                // A2 giao, tự theo dõi → A2 (vẫn nhận khi quá hạn nghiệm thu)
      them('CN', { han_xu_ly: '2026-08-31' }, null),                                                  // chậm nộp từ 19/08
      them('VG', { han_xu_ly: '2026-08-31', han_nop_minh_chung: '2026-08-21', nguoi_theo_doi: IDS.truongphong }, null)]);   // Vàng; theo dõi = người giao
  });
  after(don);

  test('1. NGHIEM_THU: chờ ≥ 1 ngày làm việc; chỉ người nhận nhắc chính theo 7 loại chủ trì; người nộp không nhận', async () => {
    await quet('2026-08-17');
    assert.equal((await cb('A3', 'NGHIEM_THU')).length, 0, 'nộp 17/08, quét 17/08 ⇒ chưa đủ 1 ngày làm việc');
    await quet('2026-08-18');
    const kq = Object.fromEntries(await Promise.all(['A3', 'A2', 'PH', 'PC', 'CV', 'NG', 'P1'].map(async (m) => [m, await nhan(m, 'NGHIEM_THU', '2026-08-18')])));
    assert.deepEqual(kq, { A3: [IDS.truongphong], A2: [IDS.pcvp], PH: [IDS.pcvp], PC: [IDS.cvp], CV: [TK], NG: [IDS.truongphong], P1: [IDS.pcvp] });
  });

  test('2. VANG việc có hạn nộp: người nộp trừ người giao; CHAM_NOP_MC: người nộp + người nhận nhắc chính, không thủ trưởng / Chánh VP', async () => {
    await quet('2026-08-19');
    assert.deepEqual(await nhan('VG', 'VANG'), [IDS.cv1], 'Vàng (gửi từ lần quét 18/08: còn 3 ngày tới hạn nộp 21/08) — không gửi người giao');
    assert.deepEqual(await nhan('CN', 'CHAM_NOP_MC', '2026-08-19'), [IDS.truongphong, IDS.cv1].sort());
  });

  test('3. NGHIEM_THU_QUA_HAN: người nhận nhắc chính + lãnh đạo trực tiếp, không chủ trì / người nộp; quét 2 lần = 1; T7 bỏ qua; Đỏ đặc biệt thêm CVP', async () => {
    await quet('2026-08-21'); await quet('2026-08-21');
    assert.deepEqual(await nhan('A3', 'NGHIEM_THU_QUA_HAN', '2026-08-21'), [IDS.pcvp, IDS.truongphong].sort());
    assert.equal((await cb('A3', 'NGHIEM_THU_QUA_HAN', '2026-08-21')).length, 1, 'idempotent');
    assert.deepEqual(await nhan('TD', 'NGHIEM_THU_QUA_HAN', '2026-08-21'), [IDS.pcvp, IDS.truongphong].sort(), 'người nhận nhắc chính là người theo dõi vẫn nhận');
    assert.deepEqual(await nhan('CV', 'NGHIEM_THU_QUA_HAN', '2026-08-21'), [TK], 'việc Chánh VP: chỉ thư ký, không Chánh VP, không A0');
    assert.equal((await cb('A3', 'DO')).length, 0, 'dòng 5 không đi nhánh Đỏ nhắc chủ trì');
    await quet('2026-08-22');
    assert.equal((await cb('A3', 'NGHIEM_THU_QUA_HAN', '2026-08-22')).length, 0, 'Thứ Bảy không nhắc');
    await quet('2026-08-24');
    assert.deepEqual(await nhan('A3', 'NGHIEM_THU_QUA_HAN', '2026-08-24'), [IDS.cvp, IDS.pcvp, IDS.truongphong].sort());
  });

  test('4. Việc Chánh VP khi không ai giữ cờ thư ký ⇒ quan_tri_kl nhận nhắc', async () => {
    await co(false, true);
    await them('CV2', { owner_don_vi_ma: 'VAN_PHONG_TINH_UY', owner_tai_khoan: IDS.cvp, nguoi_theo_doi: IDS.cvp, tao_boi: IDS.a0 }, IDS.cvp);
    await quet('2026-08-18');
    assert.deepEqual(await nhan('CV2', 'NGHIEM_THU', '2026-08-18'), [IDS.cv2]);
  });
});
