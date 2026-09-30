// PR-2b (0058–0059) — Bảng trạng thái A5 tại ngày cố định (tinh_trang_thai(id, ngày)), CHỈ chạy cục bộ (logic thuần, quyết định 30/9).
// Mốc: H = 20/08/2026 (T5), hạn nộp N = 18/08 (T3), ngưỡng vàng 3, sắp đến hạn 7, Đỏ đặc biệt 3. Minh chứng chèn bằng service_role với nop_luc /
// xac_nhan_luc đặt tay (một số ở khung 17–24h UTC = sáng hôm sau giờ VN). Ca: 12 dòng; tính tại ngày quá khứ bỏ minh chứng nộp sau; trả lại ⇒ N* =
// hạn nộp lại; Q9 (nộp / nghiệm thu đúng hạn, số lần trả lại); Q-2 (bảng minh chứng, chu_cu, cột chữ); Q3 (khung hạn nộp lại qua RPC); nguoi_chiu_cham.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, CHI_CUC_BO, homNayVN } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const KHOA = 'KL-0058';
let fx; const id = {};
const them = async (ma, row = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-20',
    han_nop_minh_chung: '2026-08-18', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
    tao_boi: IDS.truongphong, theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
};
const mc = async (ma, nop, them_ = {}) => assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: id[ma], loai: 'so_hieu', so_hieu: `${KHOA}/${ma}/${nop}`,
  ngay_van_ban: '2026-08-10', cap_nhan: 'TRUONG_PHONG', nop_boi: IDS.cv1, nop_luc: nop, ...them_ }), `mc ${ma}`);
const tt = async (ma, ngay) => { const r = await db().rpc('tinh_trang_thai', { p_id: id[ma], p_ngay: ngay }); assertOk(r, `${ma} ${ngay}`); return r.data; };
const kt = async (ma, ngay, trangThai, muc, them_ = {}) => {
  const t = await tt(ma, ngay);
  assert.deepEqual({ trang_thai: t.trang_thai, muc: t.muc_canh_bao, ...Object.fromEntries(Object.keys(them_).map((k) => [k, t[k]])) },
    { trang_thai: trangThai, muc, ...them_ }, `${ma} tại ${ngay}`);
};

describe('0058 — trạng thái theo hạn nộp minh chứng (12 dòng A5, Q3, Q9, Q-2)', { skip: SKIP || CHI_CUC_BO }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
    await Promise.all([them('A'), them('B'), them('C', { han_xu_ly: '2026-08-31' }), them('E', { han_xu_ly: '2026-08-31', han_nop_minh_chung: '2026-08-28' }),
      them('D', { han_nop_minh_chung: null }), them('D2', { han_nop_minh_chung: null }), them('D3', { han_nop_minh_chung: null }),
      them('D4', { han_nop_minh_chung: null, minh_chung: 'Công văn 5/CV' }), them('D5', { han_nop_minh_chung: null }), them('A2'),
      them('F'), them('G'), them('G2'), them('Z'), them('X', { han_xu_ly: null, han_nop_minh_chung: null, ly_do_chua_co_han: 'Chờ' })]);
    await Promise.all([
      mc('A', '2026-08-17T03:00:00Z'), mc('D2', '2026-08-01T03:00:00Z', { loai: 'chu_cu', so_hieu: null, noi_dung_chu: 'CV 1' }),
      mc('D3', '2026-08-03T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-05T03:00:00Z' }),
      mc('D5', '2026-08-10T03:00:00Z'), mc('A2', '2026-08-17T03:00:00Z', { loai: 'chu_cu', so_hieu: null, noi_dung_chu: 'CV 2' }),
      mc('F', '2026-08-17T03:00:00Z', { hop_le: false, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-18T20:00:00Z', ly_do_khong_hop_le: 'x', han_nop_lai: '2026-08-20' }),
      mc('Z', '2026-08-17T18:30:00Z'), mc('X', '2026-08-10T03:00:00Z'),
      mc('G', '2026-08-17T03:00:00Z', { hop_le: false, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-18T03:00:00Z', ly_do_khong_hop_le: 'x', han_nop_lai: '2026-08-19' })]);
    await Promise.all([mc('G', '2026-08-19T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-21T03:00:00Z' }),
      mc('G2', '2026-08-19T03:00:00Z', { hop_le: true, xac_nhan_boi: IDS.truongphong, xac_nhan_luc: '2026-08-20T03:00:00Z' })]);
    for (const [ma, ngay] of [['G', '2026-08-19'], ['G2', '2026-08-19']]) {
      assertOk(await db().from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: ngay }).eq('id', id[ma]), `đóng ${ma}`);
    }
  });
  after(() => db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`));

  test('1. Dòng 5–9, 11–12: chờ nghiệm thu / quá hạn ở bước nghiệm thu / quá hạn / chậm nộp / vàng theo hạn nộp / xanh', async () => {
    await kt('A', '2026-08-21', 'QUA_HAN_NGHIEM_THU', 'DO', { so_ngay_qua: 1, minh_chung_buoc: 'CHO_NGHIEM_THU' });
    await kt('A', '2026-08-24', 'QUA_HAN_NGHIEM_THU', 'DO_DAC_BIET');
    await kt('A', '2026-08-19', 'CHO_NGHIEM_THU', 'XANH', { nop_dung_han: 'DUNG_HAN', nghiem_thu_dung_han: 'CHUA' });
    await kt('A', '2026-08-16', 'SAP_DEN_HAN', 'VANG', { minh_chung_buoc: 'CHUA_NOP', han_nop_hieu_luc: '2026-08-18' });   // bỏ minh chứng nộp 17/08
    await kt('B', '2026-08-21', 'QUA_HAN', 'DO');
    await kt('B', '2026-08-19', 'CHAM_NOP_MINH_CHUNG', 'VANG', { nop_dung_han: 'CHUA_NOP' });
    await kt('C', '2026-08-16', 'DANG_THUC_HIEN', 'VANG');
    await kt('E', '2026-08-24', 'SAP_DEN_HAN', 'XANH');
    await kt('E', '2026-08-10', 'DANG_THUC_HIEN', 'XANH');
  });

  test('2. Việc không hạn nộp (dòng 2–4, 10) và Q-2: Vàng chỉ khi không có minh chứng hợp lệ trong bảng lẫn cột chữ; so_hieu đang chờ vẫn là chờ nghiệm thu', async () => {
    await kt('D', '2026-08-18', 'SAP_DEN_HAN', 'VANG', { han_nop_hieu_luc: null, nop_dung_han: 'KHONG_DANH_GIA' });
    await kt('D2', '2026-08-18', 'SAP_DEN_HAN', 'XANH', { minh_chung_buoc: 'CHU_CU' });   // chu_cu trong bảng, cột chữ trống
    await kt('D3', '2026-08-18', 'SAP_DEN_HAN', 'XANH', { minh_chung_buoc: 'DA_NGHIEM_THU' });
    await kt('D4', '2026-08-18', 'SAP_DEN_HAN', 'XANH');
    await kt('D5', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');
    await kt('A2', '2026-08-19', 'CHO_NGHIEM_THU', 'XANH');   // chu_cu chưa xác nhận ở việc CÓ hạn nộp = đang chờ
    await kt('X', '2026-08-18', 'CAN_DIEN_HAN', 'KHONG_AP_DUNG', { minh_chung_buoc: 'CHO_NGHIEM_THU' });
  });

  test('3. Trả lại: N* = hạn nộp lại, đếm số lần; trước khi xác nhận vẫn là chờ; qua H ⇒ Quá hạn. Múi giờ: nộp 18:30 UTC 17/08 = 18/08 giờ VN', async () => {
    await kt('F', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');   // trả lại lúc 20:00 UTC 18/08 = 19/08 giờ VN
    await kt('F', '2026-08-19', 'SAP_DEN_HAN', 'VANG', { minh_chung_buoc: 'BI_TRA_LAI', han_nop_hieu_luc: '2026-08-20', so_lan_tra_lai: 1 });
    await kt('F', '2026-08-21', 'QUA_HAN', 'DO');
    await kt('Z', '2026-08-17', 'SAP_DEN_HAN', 'VANG', { minh_chung_buoc: 'CHUA_NOP' });
    await kt('Z', '2026-08-18', 'CHO_NGHIEM_THU', 'XANH');
  });

  test('4. Q9: nộp đúng hạn theo hạn áp dụng cho lượt đó (hạn nộp lại của lần trả lại liền trước); nghiệm thu đúng hạn theo H', async () => {
    await kt('G', '2026-08-31', 'HOAN_THANH', 'KHONG_AP_DUNG', { nop_dung_han: 'DUNG_HAN', nghiem_thu_dung_han: 'TRE', so_lan_tra_lai: 1, ket_qua: 'DUNG_HAN' });
    await kt('G2', '2026-08-31', 'HOAN_THANH', 'KHONG_AP_DUNG', { nop_dung_han: 'TRE', nghiem_thu_dung_han: 'DUNG_HAN', so_lan_tra_lai: 0 });
  });

  test('5. Q3 (RPC): trả lại chưa qua H ⇒ hạn nộp lại ≤ H; đã qua H ⇒ ≤ ngày làm việc thứ 2 sau hôm nay, việc về Quá hạn; nguoi_chiu_cham dòng 5/7/8', async () => {
    await Promise.all([them('Q3A', { han_xu_ly: '2026-12-31', han_nop_minh_chung: '2026-12-30' }), them('Q3B', { han_xu_ly: '2026-09-15', han_nop_minh_chung: '2026-09-14' }),
      them('R8', { han_xu_ly: '2026-12-31', han_nop_minh_chung: '2026-09-01' })]);
    await Promise.all([mc('Q3A', new Date().toISOString()), mc('Q3B', new Date().toISOString())]);
    const [ma, mb] = await Promise.all(['Q3A', 'Q3B'].map(async (m) => (await db().from('minh_chung').select('id').eq('nhiem_vu_id', id[m]).single()).data.id));
    const tp = await userClient('demo_truongphong');
    const tra = (m, han) => tp.rpc('xac_nhan_minh_chung', { p_id: m, p_hop_le: false, p_ly_do: 'Thiếu số liệu', p_han_nop_lai: han });
    const den = (await db().rpc('ngay_lam_viec_sau', { p_tu: homNayVN(), p_so: 2 })).data;
    const v = async (m) => (await db().from('v_nhiem_vu').select('trang_thai, han_nop_hieu_luc, nguoi_chiu_cham, phong_chiu_cham').eq('id', id[m]).single()).data;
    assert.equal((await v('Q3B')).nguoi_chiu_cham, IDS.truongphong, 'dòng 5: người nhận nhắc chính (người giao A2)');
    assert.match((await tra(ma, '2027-01-01')).error?.message || '', /Hạn nộp lại phải từ/, 'Q3A > H');
    assertOk(await tra(ma, '2026-12-31'), 'Q3A = H');
    const qua = new Date(`${den}T00:00:00Z`); qua.setUTCDate(qua.getUTCDate() + 1);
    assert.match((await tra(mb, qua.toISOString().slice(0, 10))).error?.message || '', /Hạn nộp lại phải từ/, 'Q3B quá ngày làm việc thứ 2');
    assertOk(await tra(mb, den), 'Q3B = ngày làm việc thứ 2');
    assert.deepEqual(await v('Q3B'), { trang_thai: 'QUA_HAN', han_nop_hieu_luc: den, nguoi_chiu_cham: IDS.cv1, phong_chiu_cham: 'TONG_HOP' });
    assert.deepEqual([(await v('R8')).trang_thai, (await v('R8')).nguoi_chiu_cham], ['CHAM_NOP_MINH_CHUNG', IDS.cv1]);
  });
});
