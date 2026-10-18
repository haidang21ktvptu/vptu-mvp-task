// 0114 (v3.25 đợt sửa sau kiểm tay 18/10): người tự giao việc cho chính mình được tính "đã nhận" ngay khi giao (cấu hình xac_nhan_nhan_viec = 1);
// người giao chỉ là NGƯỜI THEO DÕI (giao cho chuyên viên khác) thì không — việc vẫn chờ Owner nhận. Khoá "KL-0114"; cấu hình khôi phục; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0114';
const cauHinh = async () => (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xac_nhan_nhan_viec').maybeSingle()).data?.gia_tri;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : (await cauHinh()) === undefined ? 'Chưa có migration 0085.' : false;
let dem = 0; let cu = '1';
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem + 1}`,
  san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...p } });
const nhan = async (id) => (await db().from('lich_su').select('nguoi_sua, gia_tri_moi').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec')).data;
const daNhanView = async (username, id) => (await (await userClient(username)).from('v_nhiem_vu').select('da_xac_nhan_nhan').eq('id', id).single()).data?.da_xac_nhan_nhan;
const datCauHinh = (v) => db().from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'xac_nhan_nhan_viec');
const don = async () => { await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`); await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`); };

describe('0114 — tự giao cho chính mình thì đã nhận ngay', { skip: SKIP }, () => {
  before(async () => { cu = (await cauHinh()) || '1'; assertOk(await datCauHinh('1'), 'đặt cấu hình 1'); await don(); });
  after(async () => { await don(); await datCauHinh(cu); });

  test('1. cấu hình 1: cv1 tự giao → một dòng "đã nhận" của cv1 (người giao tự nhận), v_nhiem_vu.da_xac_nhan_nhan = true', async () => {
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r, 'cv1 tự giao');
    const ds = await nhan(r.data.id);
    assert.equal(ds.length, 1, 'một dòng (Owner = theo dõi = cv1, không ghi trùng)');
    assert.equal(ds[0].nguoi_sua, IDS.cv1);
    assert.match(ds[0].gia_tri_moi, /^tự động khi giao \(người giao tự nhận việc của mình\)/);
    assert.equal(await daNhanView('demo_cv1', r.data.id), true);
  });

  test('2. cấu hình 1: cv1 giao cho cv2 → không ai "đã nhận" (cv1 chỉ là người theo dõi), việc vẫn chờ cv2 nhận', async () => {
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2 });
    assertOk(r, 'cv1 giao cho cv2');
    assert.deepEqual(await nhan(r.data.id), []);
    assert.equal(await daNhanView('demo_cv2', r.data.id), false);
  });

  test('3. Trưởng phòng giao cho cv1; cv1 cập nhật việc gửi lại chính Owner của mình → không ghi "tự nhận" (chỉ khi tạo việc / đổi Owner)', async () => {
    const r = await giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r, 'Trưởng phòng giao cho cv1');
    await (await userClient('demo_cv1')).from('nhiem_vu').update({ owner_tai_khoan: IDS.cv1 }).eq('id', r.data.id);   // RLS cho hay chặn: đều không được ghi
    assert.deepEqual((await nhan(r.data.id)).filter((x) => x.nguoi_sua === IDS.cv1), []);
    assert.equal(await daNhanView('demo_cv1', r.data.id), false, 'việc vẫn chờ cv1 xác nhận');
  });

  test('4. cấu hình 2: tự giao vẫn ghi theo câu của cấu hình (như 0085)', async () => {
    assertOk(await datCauHinh('2'), 'đặt cấu hình 2');
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1 });
    assertOk(r, 'cv1 tự giao (cấu hình 2)');
    const ds = await nhan(r.data.id);
    assert.equal(ds.length, 1);
    assert.match(ds[0].gia_tri_moi, /^tự động khi giao \(cấu hình không yêu cầu xác nhận\)/);
    assertOk(await datCauHinh('1'), 'trả cấu hình 1');
  });
});
