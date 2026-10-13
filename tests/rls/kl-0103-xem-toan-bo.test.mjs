// 0103 (v3.23, chủ dự án duyệt 13/10/2026): cấu hình xem_toan_bo — 1 (mặc định) như cũ; 2 = mọi cán bộ ĐỌC được mọi nhiệm vụ (view, lịch sử,
// văn bản), cột trong_pham_vi đánh dấu việc thuộc phạm vi xử lý; mọi chốt GHI không đổi (sửa thẳng, vướng mắc, nộp minh chứng, chỉ đạo, tầng
// giao). Vướng mắc ghi người nhận đề nghị xử lý → đúng một tin hệ thống cho người đó (không kèm tin tự động 0062); người nhận chỉ người giao /
// lãnh đạo VP / Trưởng phòng (không Thường trực); ghi vướng mắc ngoài hàm xoá người nhận; xoá vướng mắc xoá người nhận.
// Hai hàm đếm theo RLS (kl_so_chua_xu_ly, kl_so_lieu_cac_moc) giữ nghĩa "trong phạm vi" khi bật cấu hình.
// Khoá "KL-0103"; cấu hình khôi phục ở before / after; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0103';
const cauHinh = async () => (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xem_toan_bo').maybeSingle()).data?.gia_tri;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : (await cauHinh()) === undefined ? 'Chưa có migration 0103 (kl_cau_hinh xem_toan_bo).' : false;
let dem = 0; let cu = '1';
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const goi = async (u, ham, p) => (await userClient(u)).rpc(ham, p);
const giao = (u, p) => goi(u, 'giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${u} ${dem + 1}`, ...CHUNG, ...p } });
const dat = (v) => db().from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'xem_toan_bo');
const doc = async (u) => ((await (await userClient(u)).from('v_nhiem_vu').select('id, trong_pham_vi').like('noi_dung', `${KHOA}%`)).data || []);
const don = async () => {
  await db().from('direct_messages').delete().like('content', `%${KHOA}%`);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0103 — mọi cán bộ xem toàn bộ (chỉ xem, cấu hình); vướng mắc gửi tới người được chọn', { skip: SKIP }, () => {
  before(async () => { cu = (await cauHinh()) || '1'; assertOk(await dat('1'), 'đặt 1'); await don(); });
  after(async () => { await dat(cu); await don(); });
  let a; let b;   // a: cv1 tự giao (Tổng hợp); b: Chánh VP giao cv2 (Quản trị)

  test('1. Cấu hình 1: cv2 chỉ thấy việc mình (trong_pham_vi = true), không thấy việc cv1', async () => {
    const ra = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 }); assertOk(ra, 'cv1 tự giao'); a = ra.data.id;
    const rb = await giao('demo_cvp', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 }); assertOk(rb, 'CVP giao cv2'); b = rb.data.id;
    assert.deepEqual(await doc('demo_cv2'), [{ id: b, trong_pham_vi: true }]);
  });

  test('2. Cấu hình 2: cv2, Trưởng phòng thấy mọi việc (việc ngoài phạm vi trong_pham_vi = false), đọc được lịch sử, văn bản', async () => {
    assertOk(await dat('2'), 'đặt 2');
    const thay = new Map((await doc('demo_cv2')).map((r) => [r.id, r.trong_pham_vi]));
    assert.equal(thay.get(a), false); assert.equal(thay.get(b), true);
    assert.equal(new Map((await doc('demo_truongphong')).map((r) => [r.id, r.trong_pham_vi])).get(b), false, 'TP Tổng hợp thấy việc phòng Quản trị, ngoài phạm vi');
    const cv2 = await userClient('demo_cv2');
    assert.ok(((await cv2.from('lich_su').select('id').eq('nhiem_vu_id', a)).data || []).length >= 1, 'lịch sử việc cv1');
    assert.equal(((await cv2.from('van_ban_giao_viec').select('id').like('so_ket_luan', `${KHOA}%`)).data || []).length, 2, 'cả hai văn bản');
    assert.equal((await cv2.rpc('kl_thay_nhiem_vu', { p_id: a })).data, false, 'phạm vi xử lý không đổi');
  });

  test('3. Cấu hình 2 chỉ xem: cv2 không sửa thẳng / ghi vướng mắc / nộp minh chứng việc cv1; Trưởng phòng Tổng hợp không đôn đốc việc phòng Quản trị', async () => {
    const cv2 = await userClient('demo_cv2');
    const upd = await cv2.from('nhiem_vu').update({ vuong_mac: 'x' }).eq('id', a).select('id');
    assert.ok(upd.error || (upd.data || []).length === 0, 'UPDATE phải 0 dòng hoặc bị chặn');
    assertDenied(await goi('demo_cv2', 'dat_vuong_mac', { p_id: a, p_noi_dung: 'x' }), 'vướng mắc');
    assertDenied(await goi('demo_cv2', 'nop_minh_chung', { p: { nhiem_vu_id: a, so_hieu: '1/BC', ngay_van_ban: '2026-10-01' } }), 'nộp minh chứng');
    assertDenied(await goi('demo_truongphong', 'chi_dao_gui', { p: { nhiem_vu_id: b, loai: 'DON_DOC', noi_dung: `${KHOA} đôn đốc` } }), 'đôn đốc ngoài phạm vi');
    assert.equal((await db().from('nhiem_vu').select('vuong_mac').eq('id', a).single()).data.vuong_mac, null);
  });

  test('4. Vướng mắc gửi tới người được chọn: một tin cho đúng người; tự gửi mình bị chặn; xoá vướng mắc xoá người nhận', async () => {
    assertOk(await goi('demo_cv2', 'dat_vuong_mac', { p_id: b, p_noi_dung: `${KHOA} chờ ý kiến`, p_gui_cho: IDS.pcvp2 }), 'gửi Phó Chánh VP 2');
    const tin = (await db().from('direct_messages').select('receiver_id, content').eq('nhiem_vu_id', b).ilike('content', '%vướng mắc%')).data;   // cả tin tự động 0062
    assert.equal(tin.length, 1, JSON.stringify(tin)); assert.equal(tin[0].receiver_id, IDS.pcvp2);
    assert.equal((await db().from('nhiem_vu').select('vuong_mac_gui_cho').eq('id', b).single()).data.vuong_mac_gui_cho, IDS.pcvp2);
    const loi = await goi('demo_cv2', 'dat_vuong_mac', { p_id: b, p_noi_dung: 'đổi', p_gui_cho: IDS.cv2 });
    assert.equal(loi.error?.code, '22023', 'tự gửi mình');
    assert.equal((await goi('demo_cv2', 'dat_vuong_mac', { p_id: b, p_noi_dung: 'đổi', p_gui_cho: IDS.a0 })).error?.code, '22023', 'không gửi Thường trực');
    assert.equal((await goi('demo_cv2', 'dat_vuong_mac', { p_id: b, p_noi_dung: 'đổi', p_gui_cho: IDS.cv1 })).error?.code, '22023', 'chuyên viên không phải người giao');
    assertOk(await db().from('nhiem_vu').update({ vuong_mac: `${KHOA} ghi thẳng` }).eq('id', b), 'ghi thẳng (như nhập Excel)');
    assert.equal((await db().from('nhiem_vu').select('vuong_mac_gui_cho').eq('id', b).single()).data.vuong_mac_gui_cho, null, 'ghi ngoài dat_vuong_mac xoá người nhận');
    assertOk(await goi('demo_cv2', 'dat_vuong_mac', { p_id: b, p_noi_dung: ' ' }), 'xoá');
    assert.deepEqual((await db().from('nhiem_vu').select('vuong_mac, vuong_mac_gui_cho').eq('id', b).single()).data, { vuong_mac: null, vuong_mac_gui_cho: null });
    assertOk(await dat('1'), 'trả 1');
    assert.deepEqual((await doc('demo_cv2')).map((r) => r.id), [b], 'về cấu hình 1');
  });

  test('5. Số liệu theo phạm vi xử lý không đổi khi bật xem toàn bộ: kl_so_chua_xu_ly (menu, Cần xử lý ngay), kl_so_lieu_cac_moc (ô số)', async () => {
    assertOk(await (await userClient('demo_cv2')).rpc('dat_vuong_mac', { p_id: b, p_noi_dung: `${KHOA} để đếm` }), 'vướng mắc việc cv2');
    const so = async (u) => {
      const c = await userClient(u);
      const [x, y] = await Promise.all([c.rpc('kl_so_chua_xu_ly'), c.rpc('kl_so_lieu_cac_moc', { p_ngay: ['2026-10-13'] })]);
      assertOk(x, `kl_so_chua_xu_ly ${u}`); assertOk(y, `kl_so_lieu_cac_moc ${u}`);
      const { hoa_toc: _bo, ...dem } = x.data; return { dem, so: y.data };
    };
    const truoc = { tp: await so('demo_truongphong'), cv: await so('demo_cv2'), pc: await so('demo_pcvp2') };
    assertOk(await dat('2'), 'đặt 2');
    assert.deepEqual(await so('demo_truongphong'), truoc.tp, 'Trưởng phòng Tổng hợp');
    assert.deepEqual(await so('demo_cv2'), truoc.cv, 'chuyên viên');
    assert.deepEqual(await so('demo_pcvp2'), truoc.pc, 'Phó Chánh VP');
    assertOk(await dat('1'), 'trả 1');
  });
});
