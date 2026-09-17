// GĐ20 (0033) — (1) v_ngoai_le.khau: 4 khâu theo thứ tự ưu tiên CHO_QUYET → CHO_MINH_CHUNG → CHUA_NHAN (chỉ việc theo_1400) → CHUA_SAN_PHAM,
// việc cũ (theo_1400 = false) không bao giờ là CHUA_NHAN; việc Xanh không vào view; (2) kl_so_lieu_tai(p_ngay): cùng ngày, cùng phạm vi (A0, A2, A3) phải bằng đếm trên v_nhiem_vu; anon bị chặn; p_ngay = 14/9/2026
// khớp mốc kl-moc-2026-09-14 (185 dòng Excel = MOC; phần dư ngoài 185 dòng tính bằng tinh_trang_thai). Mã NV-T33x, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, anonClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

// Giữ đồng bộ với kl-moc-2026-09-14.test.mjs (không import để node:test không đăng ký test đó hai lần).
const NGAY_MOC = '2026-09-14';
const MOC = { HOAN_THANH: 146, THUONG_XUYEN: 16, QUA_HAN: 8, DANG_THUC_HIEN: 6, CHO_DIEU_KIEN: 6, CAN_DIEN_HAN: 3 };
const TONG = 185;

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let fx; const id = {};
const them = async (ma, row = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0033 ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ma, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
};
const minhChung = async (ma, hop_le) => assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: id[ma], loai: 'so_hieu', so_hieu: `33/${ma}`,
  ngay_van_ban: '2026-09-01', cap_nhan: 'TRUONG_PHONG', nop_boi: IDS.cv1, hop_le }), `minh_chung ${ma}`);
const daNhan = async (ma) => assertOk(await db().from('lich_su').insert({ nhiem_vu_id: id[ma], nguoi_sua: IDS.cv1, cot: 'xac_nhan_nhan_viec',
  gia_tri_moi: '01/09/2026 08:00', nguon: 'app' }), `lich_su ${ma}`);
const khauCua = async () => {
  const r = await db().from('v_ngoai_le').select('ma, khau').like('ma', 'NV-T33%');
  assertOk(r, 'v_ngoai_le'); return Object.fromEntries(r.data.map((x) => [x.ma, x.khau]));
};
const dem = (rows, cot) => rows.reduce((m, r) => (r[cot] == null ? m : { ...m, [r[cot]]: (m[r[cot]] || 0) + 1 }), {});
const boZero = (o) => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0));
const don = async () => { await db().from('nhiem_vu').delete().like('ma', 'NV-T33%'); };

describe('0033 — v_ngoai_le.khau và kl_so_lieu_tai', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures(); await don();
    await them('NV-T331', { cap_quyet_dinh: 'CHANH_VAN_PHONG' }); await minhChung('NV-T331', null);   // có cả minh chứng chờ → vẫn CHO_QUYET
    await them('NV-T332'); await minhChung('NV-T332', null);
    await them('NV-T333'); await minhChung('NV-T333', true); await daNhan('NV-T333');
    await them('NV-T334');
    await them('NV-T335'); await daNhan('NV-T335');
    await them('NV-T336', { han_xu_ly: '2026-12-31' });                                                  // Xanh → không vào view
    await them('NV-T337', { theo_1400: false });                                                            // việc cũ, không có xác nhận → không phải CHUA_NHAN
  });
  after(don);

  test('khau: 4 khâu đúng thứ tự ưu tiên; việc cũ (theo_1400 = false) chưa xác nhận vẫn là CHUA_SAN_PHAM; việc Xanh không có trong v_ngoai_le', async () => {
    const k = await khauCua();
    assert.deepEqual(k, { 'NV-T331': 'CHO_QUYET', 'NV-T332': 'CHO_MINH_CHUNG', 'NV-T333': 'CHUA_SAN_PHAM', 'NV-T334': 'CHUA_NHAN', 'NV-T335': 'CHUA_SAN_PHAM', 'NV-T337': 'CHUA_SAN_PHAM' });
    assert.notEqual(k['NV-T337'], 'CHUA_NHAN', 'việc cũ nhập Excel không có bước xác nhận nhận việc');
  });

  test('khau: minh chứng đã thẩm định (hop_le = false) không còn là CHO_MINH_CHUNG', async () => {
    assertOk(await db().from('minh_chung').update({ hop_le: false, ly_do_khong_hop_le: 'test' }).eq('nhiem_vu_id', id['NV-T332']), 'bác minh chứng');
    assert.equal((await khauCua())['NV-T332'], 'CHUA_NHAN');
  });

  for (const [vai, username] of [['A0', 'demo_a0'], ['A2', 'demo_truongphong'], ['A3', 'demo_cv1']]) {
    test(`kl_so_lieu_tai hôm nay = đếm trên v_nhiem_vu cùng phạm vi (${vai})`, async () => {
      const u = await userClient(username);
      const rows = await u.from('v_nhiem_vu').select('nhom_dem, muc_canh_bao, ket_qua'); assertOk(rows, 'v_nhiem_vu');
      const r = await u.rpc('kl_so_lieu_tai'); assertOk(r, 'kl_so_lieu_tai');
      assert.equal(r.data.tong, rows.data.length, `${vai}: tong`);
      assert.deepEqual(r.data.nhom_dem, dem(rows.data, 'nhom_dem'), `${vai}: nhom_dem`);
      assert.deepEqual(r.data.muc_canh_bao, dem(rows.data, 'muc_canh_bao'), `${vai}: muc_canh_bao`);
      assert.deepEqual(r.data.ket_qua, dem(rows.data, 'ket_qua'), `${vai}: ket_qua`);
      if (vai === 'A3') assert.ok(r.data.tong >= 6 && r.data.muc_canh_bao.DO_DAC_BIET >= 6, 'A3 thấy 6 việc Đỏ đặc biệt NV-T33x của mình');
    });
  }

  test('kl_so_lieu_tai: A3 không thấy việc của người khác; anon bị chặn', async () => {
    const [a3, a0] = await Promise.all([(await userClient('demo_cv2')).rpc('kl_so_lieu_tai'), (await userClient('demo_a0')).rpc('kl_so_lieu_tai')]);
    assertOk(a3, 'cv2'); assertOk(a0, 'a0');
    assert.ok(a3.data.tong < a0.data.tong, 'A3 (cv2) phải thấy ít hơn A0');
    assert.ok(!a3.data.muc_canh_bao.DO_DAC_BIET || a3.data.muc_canh_bao.DO_DAC_BIET < a0.data.muc_canh_bao.DO_DAC_BIET, 'cv2 không thấy NV-T33x của cv1');
    assertDenied(await anonClient().rpc('kl_so_lieu_tai'), 'anon');
  });

  test(`kl_so_lieu_tai(${NGAY_MOC}) khớp mốc kl-moc-2026-09-14`, async (t) => {
    const excel = await db().from('nhiem_vu').select('id').eq('nguon', 'excel').not('noi_dung', 'like', 'RLS-TEST%'); assertOk(excel, 'excel');
    if (excel.data.length !== TONG) return t.skip(`Project có ${excel.data.length}/${TONG} dòng nguon = excel.`);
    const trong185 = new Set(excel.data.map((r) => r.id));
    const all = await db().from('nhiem_vu').select('id'); assertOk(all, 'all');
    const du = { ...MOC };
    for (const { id: nvId } of all.data.filter((r) => !trong185.has(r.id))) {
      const r = await db().rpc('tinh_trang_thai', { p_id: nvId, p_ngay: NGAY_MOC }); assertOk(r, `tinh_trang_thai ${nvId}`);
      du[r.data.nhom_dem] = (du[r.data.nhom_dem] || 0) + 1;
    }
    const r = await db().rpc('kl_so_lieu_tai', { p_ngay: NGAY_MOC }); assertOk(r, 'kl_so_lieu_tai mốc');
    assert.equal(r.data.tong, all.data.length);
    assert.deepEqual(r.data.nhom_dem, boZero(du), 'nhom_dem tại 14/9 lệch mốc + phần dư');
  });
});
