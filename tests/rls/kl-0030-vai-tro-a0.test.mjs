// GĐ18 (0030) — vai trò A0 Thường trực Tỉnh ủy (CH-11 = A): ĐỌC toàn bộ nhiệm vụ, ngoại lệ, chỉ đạo, minh chứng, cảnh báo;
// mọi hàm GHI từ chối tường minh (42501) trừ chi_dao_gui loại Y_KIEN; A0 không nằm trong nguoi_lien_quan và chỉ nhận tin hệ
// thống là phản hồi vào luồng Y_KIEN do chính mình mở; cảnh báo Đỏ đặc biệt không gửi A0. Mã NV-T88/T89, tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, assertNoRows, IDS } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const NGAY = '2026-08-20';   // hạn 15/08 → quá 5 ngày → Đỏ đặc biệt (cùng ngày quét với kl-0029 để idempotent)
const db = () => adminClient();
let fx; const id = {}; let t0; let mcId; let donDocId; let yKienId;
const them = async (row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0030 ${row.ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    han_xu_ly: '2026-08-15', nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, ...row }).select('id').single();
  assertOk(r, row.ma); id[row.ma] = r.data.id;
};
const a0 = () => userClient('demo_a0');
const rpc = async (username, fn, args) => (await userClient(username)).rpc(fn, args);
const tinA0 = async (ma) => (await db().from('direct_messages').select('content').eq('receiver_id', IDS.a0).eq('loai', 'he_thong').eq('nhiem_vu_id', id[ma])).data;
const don = async () => {
  await db().from('nhiem_vu').delete().in('ma', ['NV-T88', 'NV-T89']);
  if (t0) {
    await db().from('canh_bao').delete().gte('gui_luc', t0);
    await db().from('direct_messages').delete().eq('loai', 'he_thong').is('sender_id', null).gte('created_at', t0);
    await db().from('lich_su').delete().eq('cot', 'canh_bao').gte('luc', t0);
  }
};

describe('0030 — vai trò A0: đọc toàn bộ, ghi bị chặn trừ Y_KIEN, tin hệ thống tối thiểu', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    await them({ ma: 'NV-T88', owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 });          // Owner cv2 (QUAN_TRI), theo dõi cv1 (TONG_HOP)
    await them({ ma: 'NV-T89', owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv2 });      // đơn vị ngoài, theo dõi cv2
    const mc = await db().from('minh_chung').insert({ nhiem_vu_id: id['NV-T88'], loai: 'so_hieu', so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-10', cap_nhan: 'CHANH_VAN_PHONG', nop_boi: IDS.cv1 }).select('id').single();
    assertOk(mc, 'minh chứng mẫu'); mcId = mc.data.id;
    const dd = await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T88'], loai: 'DON_DOC', noi_dung: 'KL-0030 đôn đốc' } });
    assertOk(dd, 'Chánh VP đôn đốc'); donDocId = dd.data;
  });
  after(don);

  test('1. A0 đọc được nhiệm vụ mọi phòng/đơn vị (bằng service_role), v_ngoai_le, chi_dao, lich_su, minh_chung', async () => {
    const me = await a0();
    const tat = await db().from('nhiem_vu').select('id', { count: 'exact', head: true });
    const cua = await me.from('nhiem_vu').select('id', { count: 'exact', head: true });
    assertOk(cua, 'A0 đếm'); assert.equal(cua.count, tat.count, 'A0 thấy đủ số nhiệm vụ như service_role');
    for (const ma of ['NV-T88', 'NV-T89']) {
      const r = await me.from('v_nhiem_vu').select('ma, muc_canh_bao').eq('id', id[ma]).single();
      assertOk(r, `A0 đọc ${ma}`); assert.equal(r.data.ma, ma);
    }
    const nl = await me.from('v_ngoai_le').select('id').in('id', [id['NV-T88'], id['NV-T89']]);
    assertOk(nl, 'A0 đọc v_ngoai_le'); assert.equal(nl.data.length, 2, 'hai việc quá hạn đều trong bảng ngoại lệ của A0');
    const cd = await me.from('chi_dao').select('id').eq('nhiem_vu_id', id['NV-T88']);
    assertOk(cd, 'A0 đọc chi_dao'); assert.equal(cd.data.length, 1);
    const ls = await me.from('lich_su').select('id').eq('nhiem_vu_id', id['NV-T88']);
    assertOk(ls, 'A0 đọc lich_su'); assert.ok(ls.data.length >= 1);
    const mc = await me.from('minh_chung').select('id').eq('nhiem_vu_id', id['NV-T88']);
    assertOk(mc, 'A0 đọc minh_chung'); assert.equal(mc.data.length, 1);
  });

  test('2. Mọi hàm ghi từ chối A0 (42501): giao_viec, chỉ đạo điều hành, cấp quyết định, nhận việc, minh chứng, đóng; ghi bảng trực tiếp 0 dòng', async () => {
    const me = await a0();
    assertDenied(await me.rpc('giao_viec', { p: { noi_dung: 'KL-0030 A0 giao', van_ban_id: fx.hn, owner_tai_khoan: IDS.cv1 } }), 'giao_viec');
    for (const loai of ['DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU']) {
      assertDenied(await me.rpc('chi_dao_gui', { p: { nhiem_vu_id: id['NV-T88'], loai, noi_dung: 'x', han_moi: '2026-12-31', nguoi_theo_doi_moi: IDS.cv2 } }), `chi_dao_gui ${loai}`);
    }
    assertDenied(await me.rpc('dat_cap_quyet_dinh', { p_id: id['NV-T88'], p_cap: 'CHANH_VAN_PHONG' }), 'dat_cap_quyet_dinh');
    assertDenied(await me.rpc('xac_nhan_nhan_viec', { p_id: id['NV-T88'] }), 'xac_nhan_nhan_viec');
    assertDenied(await me.rpc('nop_minh_chung', { p: { nhiem_vu_id: id['NV-T88'], so_hieu: '13/CV-VPTU', ngay_van_ban: '2026-08-20', cap_nhan: 'CHANH_VAN_PHONG' } }), 'nop_minh_chung');
    assertDenied(await me.rpc('xac_nhan_minh_chung', { p_id: mcId, p_hop_le: true, p_ly_do: null }), 'xac_nhan_minh_chung');
    assertDenied(await me.rpc('dong_nhiem_vu', { p_id: id['NV-T88'], p_ngay_hoan_thanh: null }), 'dong_nhiem_vu');
    assertDenied(await me.rpc('chi_dao_dong', { p_id: donDocId }), 'chi_dao_dong chỉ đạo của Chánh VP');
    assertDenied(await me.rpc('chi_dao_phan_hoi', { p: { chi_dao_id: donDocId, noi_dung: 'x' } }), 'chi_dao_phan_hoi');
    assertNoRows(await me.from('nhiem_vu').update({ ghi_chu: 'A0 sửa' }).eq('id', id['NV-T88']).select('id'), 'update nhiem_vu');
    assertDenied(await me.from('minh_chung').insert({ nhiem_vu_id: id['NV-T88'], loai: 'so_hieu', so_hieu: 'x' }).select('id'), 'insert minh_chung');
    assertDenied(await me.from('chi_dao').insert({ nhiem_vu_id: id['NV-T88'], nguoi_gui: IDS.a0, loai: 'Y_KIEN', noi_dung: 'x' }).select('id'), 'insert chi_dao trực tiếp');
    assertOk(await me.from('direct_messages').insert({ sender_id: IDS.a0, receiver_id: IDS.cv1, content: 'KL-0030 A0 nhắn', is_read: false }).select('id'), 'A0 gửi tin nhắn 1-1 (0034 cho phép)');
    await db().from('direct_messages').delete().eq('content', 'KL-0030 A0 nhắn');
    const nv = await db().from('nhiem_vu').select('ghi_chu, tien_do_ma, cap_quyet_dinh').eq('id', id['NV-T88']).single();
    assert.equal(nv.data.ghi_chu, null); assert.equal(nv.data.cap_quyet_dinh, null); assert.notEqual(nv.data.tien_do_ma, 'HOAN_THANH');
  });

  test('3. A0 ghi Y_KIEN được; không nằm trong nguoi_lien_quan; chỉ nhận tin phản hồi vào luồng mình mở, không đóng/phản hồi được', async () => {
    const me = await a0();
    assert.equal((await tinA0('NV-T88')).length, 0, 'đôn đốc của Chánh VP không gửi A0');
    const y = await me.rpc('chi_dao_gui', { p: { nhiem_vu_id: id['NV-T89'], loai: 'Y_KIEN', noi_dung: 'KL-0030 ý kiến Thường trực' } });
    assertOk(y, 'A0 ghi Y_KIEN'); yKienId = y.data;
    const row = await db().from('chi_dao').select('nguoi_gui, loai, trang_thai').eq('id', yKienId).single();
    assert.deepEqual(row.data, { nguoi_gui: IDS.a0, loai: 'Y_KIEN', trang_thai: 'DA_PHAN_HOI' });
    const lq = await db().rpc('nguoi_lien_quan', { p_nhiem_vu: id['NV-T89'] });
    assertOk(lq, 'nguoi_lien_quan'); assert.ok(!lq.data.includes(IDS.a0), 'A0 không trong nguoi_lien_quan dù đã mở luồng');
    assert.equal((await tinA0('NV-T89')).length, 0, 'tự ghi ý kiến không gửi tin cho mình');
    assertOk(await rpc('demo_cv2', 'chi_dao_phan_hoi', { p: { chi_dao_id: yKienId, noi_dung: 'KL-0030 cv2 trả lời' } }), 'người theo dõi trả lời ý kiến');
    const tin = await tinA0('NV-T89');
    assert.equal(tin.length, 1, 'A0 nhận đúng một tin phản hồi vào luồng mình mở'); assert.match(tin[0].content, /^Phản hồi · NV-T89/);
    assertOk(await rpc('demo_cvp', 'chi_dao_gui', { p: { nhiem_vu_id: id['NV-T89'], loai: 'DON_DOC', noi_dung: 'KL-0030 đôn đốc T89' } }), 'Chánh VP đôn đốc T89');
    assert.equal((await tinA0('NV-T89')).length, 1, 'hành động khác trên cùng việc không gửi thêm tin cho A0');
    assertDenied(await me.rpc('chi_dao_phan_hoi', { p: { chi_dao_id: yKienId, noi_dung: 'x' } }), 'A0 phản hồi luồng mình mở');
    assertDenied(await me.rpc('chi_dao_dong', { p_id: yKienId }), 'A0 đóng ý kiến của mình');
  });

  test('4. Cảnh báo Đỏ đặc biệt (canh_bao_quet) không gửi A0; A0 đọc được canh_bao', async () => {
    t0 = new Date().toISOString();
    assertOk(await db().rpc('canh_bao_quet', { p_ngay: NGAY }), 'quét');
    const cb = await db().from('canh_bao').select('muc, nguoi_nhan').eq('nhiem_vu_id', id['NV-T88']).eq('ngay', NGAY).single();
    assertOk(cb, 'canh_bao T88'); assert.equal(cb.data.muc, 'DO_DAC_BIET'); assert.ok(!cb.data.nguoi_nhan.includes(IDS.a0), 'A0 không nhận cảnh báo');
    const cua = await (await a0()).from('canh_bao').select('muc').eq('nhiem_vu_id', id['NV-T88']);
    assertOk(cua, 'A0 đọc canh_bao'); assert.equal(cua.data.length, 1);
    assert.equal((await tinA0('NV-T88')).length, 0, 'không có tin cảnh báo cho A0');
  });
});
