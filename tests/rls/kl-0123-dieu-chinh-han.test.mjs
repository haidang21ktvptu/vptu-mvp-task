// 0123 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-4): điều chỉnh hạn ngay trên nhiệm vụ — chủ trì theo dõi (việc giao cho phòng: người
// theo dõi) khi việc CHƯA quá hạn, mọi loại văn bản kể cả Kết luận BTV; thư ký Thường trực mọi việc chưa hoàn thành, kể cả quá hạn; tài khoản toàn
// quyền mọi việc. Lùi hạn = gia hạn lần n, rút ngắn không cộng; "theo ngày ký" thành "có hạn cụ thể"; nhật ký (hạn cũ → mới + dòng có lý do), tin
// báo người liên quan (không người làm, không Thường trực). v3.34 (0131 — CAU-HOI T-2): chủ trì điều chỉnh cả việc đã quá hạn. Chặn: người khác, việc đã hoàn thành, lỗi dữ liệu (hạn mới
// trước hôm nay — trừ toàn quyền đính chính, nhưng vẫn không trước ngày ban hành); sửa thẳng hạn vẫn bị chặn (Q7). Ngày tính theo hôm nay (giờ
// Việt Nam). Khoá "KL-0123"; cờ tạm của demo_e2e_tk / demo_e2e_tq khôi phục ở before / after; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0123';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk — thư ký (cờ tạm)
const TQ = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq — toàn quyền (cờ tạm)
const coHam = async () => (await db().rpc('dieu_chinh_han', { p_id: TK, p_han_moi: '2026-12-31', p_ly_do: 'x' })).error?.code !== 'PGRST202';
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0123.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const vn = (iso) => iso.split('-').reverse().join('/');
const BH = cong(-50); const HAN = cong(60);
const vb = {}; const v = {};
const vanBan = async (k, them = {}) => {
  const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} ${k}`, ngay_ban_hanh: BH, ngay_nhan: cong(-49), ...them }).select('id').single();
  assertOk(r, `văn bản ${k}`); vb[k] = r.data.id;
};
const viec = async (k, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb.cv, noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: HAN, nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.pcvp,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma, han_xu_ly').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const dc = async (u, k, han, lyDo = `${KHOA} lý do`) => (await userClient(u)).rpc('dieu_chinh_han', { p_id: v[k].id, p_han_moi: han, p_ly_do: lyDo });
const doc = async (k) => (await db().from('nhiem_vu').select('han_xu_ly, so_lan_gia_han, loai_thoi_han_ma').eq('id', v[k].id).single()).data;
const tin = async (k) => ((await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v[k].id).like('content', 'Điều chỉnh hạn · %')).data || []).map((x) => x.receiver_id);
const co = (id, cot, bat) => db().from('accounts').update({ [cot]: bat }).eq('id', id);
const don = async () => {
  await co(TK, 'thu_ky_thuong_truc', false); await co(TQ, 'toan_quyen', false);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0123 — điều chỉnh hạn: chủ trì theo dõi (v3.34: kể cả quá hạn), thư ký Thường trực, toàn quyền', { skip: SKIP }, () => {
  before(async () => {
    await don();
    await vanBan('cv'); await vanBan('kl', { loai: 'KL_BTV', so_hoi_nghi: 123 }); await vanBan('ky', { ngay_ban_hanh: cong(-3), ngay_nhan: cong(-2) });
    await viec('A'); await viec('PHONG', { owner_tai_khoan: null, nguoi_theo_doi: IDS.cv1 }); await viec('QH', { han_xu_ly: cong(-5) }); await viec('QH2', { han_xu_ly: cong(-4) });
    await viec('KL', { van_ban_id: vb.kl }); await viec('KY', { van_ban_id: vb.ky, loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: null });
    await viec('XONG', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-10), nguon: 'excel' });
    await viec('CHA', { han_xu_ly: cong(40) }); await viec('CON', { han_xu_ly: cong(30), nhiem_vu_cha: v.CHA.id });
  });
  after(don);

  test('1. Chủ trì lùi hạn: gia hạn lần 1, nhật ký có lý do, tin tới người theo dõi, người giao, Chánh VP — không người làm, không Thường trực', async () => {
    const r = await dc('demo_cv1', 'A', cong(75), 'Chờ số liệu quý IV'); assertOk(r, 'chủ trì điều chỉnh');
    assert.deepEqual([r.data.gia_han, r.data.so_lan_gia_han], [true, 1]);
    assert.deepEqual(await doc('A'), { han_xu_ly: cong(75), so_lan_gia_han: 1, loai_thoi_han_ma: 'CO_HAN_CU_THE' });
    const ls = (await db().from('lich_su').select('cot, gia_tri_cu, gia_tri_moi, nguoi_sua').eq('nhiem_vu_id', v.A.id).in('cot', ['han_xu_ly', 'dieu_chinh_han'])).data;
    assert.ok(ls.some((l) => l.cot === 'han_xu_ly' && l.gia_tri_cu === HAN && l.gia_tri_moi === cong(75) && l.nguoi_sua === IDS.cv1), 'trigger lịch sử ghi hạn cũ → mới');
    assert.ok(ls.some((l) => l.cot === 'dieu_chinh_han' && l.gia_tri_moi === `${vn(HAN)} → ${vn(cong(75))} (gia hạn lần 1) — lý do: Chờ số liệu quý IV`), JSON.stringify(ls));
    const nhan = await tin('A');
    for (const id of [IDS.truongphong, IDS.pcvp, IDS.cvp]) assert.ok(nhan.includes(id), `tin tới ${id}`);
    assert.ok(!nhan.includes(IDS.cv1) && !nhan.includes(IDS.a0), 'không gửi người làm, Thường trực');
    const dbien = await (await userClient('demo_cv1')).from('v_dien_bien').select('loai, noi_dung').eq('nhiem_vu_id', v.A.id).eq('loai', 'dieu_chinh_han');
    assert.equal(dbien.data.length, 1, 'Diễn biến có dòng điều chỉnh hạn');
  });

  test('2. Rút ngắn hạn: không cộng lần gia hạn; việc giao cho phòng: Trưởng phòng (người đại diện, 0128) điều chỉnh; Kết luận BTV: chủ trì điều chỉnh được', async () => {
    const r = await dc('demo_cv1', 'A', cong(70)); assertOk(r, 'rút ngắn');
    assert.deepEqual([r.data.gia_han, (await doc('A')).so_lan_gia_han], [false, 1]);
    // v3.31 (0128): người theo dõi (nội bộ) = người đại diện của chủ trì — việc giao cho phòng Tổng hợp: Trưởng phòng; cv1 ghi lúc tạo bị trigger thay
    assertOk(await dc('demo_truongphong', 'PHONG', cong(65)), 'việc giao cho phòng — Trưởng phòng (người đại diện chủ trì)');
    assertDenied(await dc('demo_cv1', 'PHONG', cong(66)), 'chuyên viên ghi làm người theo dõi lúc tạo — không còn quyền');
    assertOk(await dc('demo_cv1', 'KL', cong(65)), 'việc từ Kết luận BTV');
  });

  test('3. Chặn (42501): Trưởng phòng (không phải chủ trì), chuyên viên khác, Thường trực, Phó / Chánh VP (gia hạn ở Chỉ đạo), chưa có cờ thư ký; v3.34: chủ trì điều chỉnh việc đã quá hạn', async () => {
    // v3.31 (0128): người theo dõi (nội bộ) của A = chủ trì cv1 — Trưởng phòng ở đây là lãnh đạo phòng, không phải chủ trì ⇒ vẫn bị chặn
    for (const u of ['demo_truongphong', 'demo_cv2', 'demo_a0', 'demo_pcvp', 'demo_cvp', 'demo_e2e_tk']) assertDenied(await dc(u, 'A', cong(80)), `${u} điều chỉnh`);
    for (const u of ['demo_cv2', 'demo_truongphong']) assertDenied(await dc(u, 'QH2', cong(20)), `${u} điều chỉnh việc quá hạn của người khác`);
    const qh = await dc('demo_cv1', 'QH2', cong(20), 'Chờ ý kiến Thường trực'); assertOk(qh, 'v3.34: chủ trì điều chỉnh việc đã quá hạn');
    assert.deepEqual([qh.data.gia_han, (await doc('QH2')).han_xu_ly], [true, cong(20)]);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.QH2.id).eq('cot', 'dieu_chinh_han')).data;
    assert.deepEqual(ls.map((l) => l.gia_tri_moi), [`${vn(cong(-4))} → ${vn(cong(20))} (gia hạn lần 1) — lý do: Chờ ý kiến Thường trực`], 'lưu lịch sử thay đổi');
  });

  test('4. Thư ký Thường trực (cờ): điều chỉnh việc quá hạn ngoài phạm vi theo dõi cũ; tin tới chủ trì. Thu cờ → hết quyền', async () => {
    assertOk(await co(TK, 'thu_ky_thuong_truc', true), 'cấp cờ thư ký');
    assertOk(await dc('demo_e2e_tk', 'QH', cong(20), 'Thường trực đồng ý lùi hạn'), 'thư ký điều chỉnh');
    assert.equal((await doc('QH')).han_xu_ly, cong(20));
    assert.ok((await tin('QH')).includes(IDS.cv1), 'chủ trì được báo');
    assertOk(await co(TK, 'thu_ky_thuong_truc', false), 'thu cờ');
    assertDenied(await dc('demo_e2e_tk', 'QH', cong(25)), 'hết cờ');
  });

  test('5. Lỗi dữ liệu (22023): thiếu lý do, trùng hạn, trước hôm nay, hạn việc con sau việc cha, rút hạn cha trước con, việc đã hoàn thành', async () => {
    const LOI = [['A', cong(90), ' ', /lý do/i], ['A', cong(70), 'x', /trùng/], ['A', cong(-3), 'x', /trước hôm nay/], ['CON', cong(45), 'x', /nhiệm vụ cha/],
      ['CHA', cong(20), 'x', /nhiệm vụ con/], ['XONG', cong(5), 'x', /hoàn thành/]];
    for (const [k, han, lyDo, re] of LOI) {
      const r = await dc('demo_cv1', k, han, lyDo);
      assert.ok(r.error, `${k} ${han}: phải lỗi`); assert.equal(r.error.code, '22023', `${k}: ${r.error.message}`); assert.match(r.error.message, re);
    }
  });

  test('6. Theo ngày ký ban hành → có hạn cụ thể; toàn quyền điều chỉnh cả việc đã hoàn thành, hạn đã qua (không trước ngày ban hành); sửa thẳng hạn vẫn bị chặn', async () => {
    assertOk(await dc('demo_cv1', 'KY', cong(30)), 'việc theo ngày ký');
    assert.deepEqual(await doc('KY'), { han_xu_ly: cong(30), so_lan_gia_han: 1, loai_thoi_han_ma: 'CO_HAN_CU_THE' });
    assertOk(await co(TQ, 'toan_quyen', true), 'bật toàn quyền');
    const bh = await dc('demo_e2e_tq', 'XONG', cong(-80), 'x');
    assert.equal(bh.error?.code, '22023', 'toàn quyền: hạn trước ngày ban hành'); assert.match(bh.error.message, /ban hành/);
    assertOk(await dc('demo_e2e_tq', 'XONG', cong(-12), 'Sửa hạn nhập sai'), 'toàn quyền, việc đã hoàn thành, hạn đã qua');
    assertOk(await co(TQ, 'toan_quyen', false), 'tắt toàn quyền');
    const r = await (await userClient('demo_cv1')).from('nhiem_vu').update({ han_xu_ly: cong(100) }).eq('id', v.A.id).select('id');
    assertDenied(r, 'chủ trì sửa thẳng hạn xử lý');
  });
});
