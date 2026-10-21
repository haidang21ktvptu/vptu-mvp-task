// 0119 (v3.28 — giải ngân vốn đầu tư công, chủ dự án duyệt 21/10/2026). Kiểm bằng token thật (chạy cả staging), năm 1999 để không đụng số liệu thật:
// (1) chưa có việc "Số liệu toàn tỉnh" → không nhận kỳ; chọn việc toàn tỉnh: chuyên viên chủ trì, Trưởng phòng, Thường trực bị chặn, Chánh VP được;
//     mỗi năm một việc toàn tỉnh (Phó Chánh VP chọn việc thứ hai → 22023);
// (2) nhập kỳ: chủ trì việc toàn tỉnh và Phó Chánh VP được; chuyên viên khác, quản trị hệ thống, Thường trực bị chặn; ghi lại cùng ngày = thay kỳ
//     (dòng chi tiết thay hết); số âm, ngày ngoài năm kế hoạch vốn, căn cứ trống, hai dòng cùng tên → 22023; diễn biến ghi vào việc toàn tỉnh;
// (3) gắn việc với chủ đầu tư: chủ trì gắn được (mục tiêu mặc định 100% trước 31/12), không tự đổi mục tiêu; Chánh VP đổi được; người ngoài phạm vi,
//     Thường trực bị chặn; gắn lại y hệt không ghi diễn biến;
// (3b, 0120) việc lãnh đạo đã đặt mục tiêu: chủ trì không bỏ theo dõi, không đổi đối tượng / năm; người tự gắn với mục tiêu mặc định tự sửa, tự bỏ được;
//     mục tiêu NaN, số tổng NaN / quá numeric(16,3), dòng NaN, "dong" không phải danh sách, tên trùng sau khi cắt khoảng trắng → 22023 (lỗi tiếng Việt);
// (3c, 0121–0122) chuyên viên tự giao việc cho mình không hạ mục tiêu / không bỏ việc Trưởng phòng gắn; việc giao cho phòng (chưa giao cán bộ): Trưởng
//     phòng là chủ trì — không hạ / bỏ việc Chánh VP gắn; Phó Chánh VP ngoài phạm vi không đổi việc đang gắn chủ đầu tư sang "Số liệu toàn tỉnh" (đường vòng),
//     không bỏ; số làm tròn 3 chữ số trước khi kiểm (0,0004 → 22023);
// (4) xem: kỳ, dòng mọi tài khoản đọc; việc toàn tỉnh mọi người thấy, việc gắn khác theo phạm vi (bỏ qua khi cấu hình xem toàn bộ đang bật); anon
//     không đọc; không ai ghi thẳng ba bảng; (5) xoá kỳ: người ngoài bị chặn, chủ trì xoá được (có diễn biến); bỏ chọn việc toàn tỉnh chỉ lãnh đạo VP.
// Khoá dữ liệu "KL-0119"; tự dọn (cả kỳ năm 1999 của lần chạy dở trước).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0119';
const NAM = 1999;
const coBang = async () => !(await db().from('gn_ky').select('id').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0119 (gn_ky).' : false;
const goi = async (u, ham, p) => (await userClient(u)).rpc(ham, p);
let dem = 0;
const giao = (u, p) => goi(u, 'giao_viec', { p: { van_ban_id: null, van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA}/${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' },
  noi_dung: `${KHOA} ${u} ${dem}`, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...p } });
const chan = (r, ma, nhan) => { assert.ok(r.error, `${nhan}: phải bị chặn`); assert.equal(r.error.code, ma, `${nhan}: ${r.error.message}`); };
const ky = (o = {}) => ({ nam: NAM, ngay_so_lieu: `${NAM}-07-31`, can_cu: `${KHOA} Báo cáo số 1/BC-UBND`, uoc_tinh: false, ke_hoach: 8473.913, da_giai_ngan: 2054.516,
  dong: [{ loai: 'NGUON', ten: 'Vốn kéo dài', ten_chuan: 'vốn kéo dài', ke_hoach: 667.417, da_giai_ngan: 213.573 },
    { loai: 'CHU_DAU_TU', ten: 'Ban QLDA tỉnh', ten_chuan: 'ban qlda tỉnh', ke_hoach: 3000, da_giai_ngan: 900 }], ...o });
const ls = async (id) => ((await db().from('lich_su').select('gia_tri_cu, gia_tri_moi').eq('nhiem_vu_id', id).eq('cot', 'giai_ngan').order('luc')).data || []);
const xemToanBo = async () => (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xem_toan_bo').maybeSingle()).data?.gia_tri === '2';
const don = async () => {
  await db().from('gn_ky').delete().eq('nam', NAM);
  await db().from('gn_nhiem_vu').delete().eq('nam', NAM);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0119 — giải ngân vốn đầu tư công: quyền, kiểm số, xem', { skip: SKIP }, () => {
  let tt; let cdt; let kyId;
  before(async () => {
    await don();
    const a = await giao('demo_cvp', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong }); assertOk(a, 'giao việc toàn tỉnh'); tt = a.data.id;
    const b = await giao('demo_cvp', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong }); assertOk(b, 'giao việc chủ đầu tư'); cdt = b.data.id;
  });
  after(don);

  test('1. Chưa có việc toàn tỉnh → không nhận kỳ; chọn việc toàn tỉnh chỉ lãnh đạo Văn phòng; mỗi năm một việc', async () => {
    const r0 = await goi('demo_cvp', 'gn_ghi_ky', { p: ky() }); chan(r0, '22023', 'chưa có việc toàn tỉnh'); assert.match(r0.error.message, /chưa có nhiệm vụ "Số liệu toàn tỉnh"/);
    for (const u of ['demo_cv1', 'demo_truongphong', 'demo_a0']) chan(await goi(u, 'gn_gan_nhiem_vu', { p_nv: tt, p: { loai: 'TOAN_TINH', nam: NAM } }), '42501', u);
    const r = await goi('demo_cvp', 'gn_gan_nhiem_vu', { p_nv: tt, p: { loai: 'TOAN_TINH', nam: NAM } }); assertOk(r, 'CVP chọn'); assert.equal(r.data.doi, true);
    const g = (await db().from('gn_nhiem_vu').select('loai, ten_chuan, muc_tieu_pt, muc_tieu_ngay').eq('nhiem_vu_id', tt).single()).data;
    assert.deepEqual(g, { loai: 'TOAN_TINH', ten_chuan: null, muc_tieu_pt: 100, muc_tieu_ngay: `${NAM}-12-31` });
    const hai = await goi('demo_pcvp', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { loai: 'TOAN_TINH', nam: NAM } }); chan(hai, '22023', 'việc toàn tỉnh thứ hai'); assert.match(hai.error.message, /đã có nhiệm vụ "Số liệu toàn tỉnh"/);
    assert.equal((await ls(tt)).length, 1, 'diễn biến chọn việc toàn tỉnh');
  });

  test('2. Nhập kỳ: chủ trì việc toàn tỉnh và Phó Chánh VP được; người khác bị chặn; ghi lại cùng ngày = thay; kiểm số', async () => {
    for (const u of ['demo_cv2', 'demo_qtht', 'demo_a0']) chan(await goi(u, 'gn_ghi_ky', { p: ky() }), '42501', u);
    const r = await goi('demo_cv1', 'gn_ghi_ky', { p: ky() }); assertOk(r, 'chủ trì nhập'); assert.equal(r.data.thay, false); assert.equal(r.data.so_dong, 2); kyId = r.data.id;
    const thay = await goi('demo_cv1', 'gn_ghi_ky', { p: ky({ da_giai_ngan: 2100, dong: [{ loai: 'NGUON', ten: 'Vốn kéo dài', ten_chuan: 'vốn kéo dài', ke_hoach: 667.417, da_giai_ngan: 250 }] }) });
    assertOk(thay, 'ghi lại cùng ngày'); assert.equal(thay.data.thay, true); assert.equal(thay.data.id, kyId);
    const dong = (await db().from('gn_ky_dong').select('loai, da_giai_ngan').eq('ky_id', kyId)).data;
    assert.deepEqual(dong.map((x) => [x.loai, Number(x.da_giai_ngan)]), [['NGUON', 250]], 'dòng chi tiết thay hết');
    assertOk(await goi('demo_pcvp', 'gn_ghi_ky', { p: ky({ ngay_so_lieu: `${NAM}-06-30`, da_giai_ngan: 1249.896, dong: [] }) }), 'Phó Chánh VP nhập bù kỳ 30/6');
    const sai = [['số âm', { da_giai_ngan: -1 }], ['ngày ngoài năm', { ngay_so_lieu: `${NAM + 1}-02-01` }], ['căn cứ trống', { can_cu: '  ' }], ['kế hoạch 0', { ke_hoach: 0 }],
      ['trùng tên', { dong: [{ loai: 'CHU_DAU_TU', ten: 'A', ten_chuan: 'a' }, { loai: 'CHU_DAU_TU', ten: 'A ', ten_chuan: 'a' }] }], ['dòng âm', { dong: [{ loai: 'NGUON', ten: 'B', ten_chuan: 'b', ke_hoach: -5 }] }]];
    for (const [nhan, o] of sai) chan(await goi('demo_cv1', 'gn_ghi_ky', { p: ky(o) }), '22023', nhan);
    const d = await ls(tt);
    assert.ok(d.some((x) => /Kỳ số liệu đến 31\/07\/1999: đã giải ngân 2\.100\/8\.473,913 tỷ đồng \(24,8%\)/.test(x.gia_tri_moi) && /Kỳ đến 31\/07\/1999: 2\.054,516/.test(x.gia_tri_cu || '')), 'diễn biến ghi thay');
  });

  test('3. Gắn việc với chủ đầu tư: chủ trì gắn (mục tiêu mặc định), không tự đổi mục tiêu; Chánh VP đổi; người ngoài, Thường trực bị chặn', async () => {
    const p = { loai: 'CHU_DAU_TU', nam: NAM, ten: 'Ban QLDA tỉnh', ten_chuan: 'ban qlda tỉnh' };
    assertOk(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p }), 'chủ trì gắn');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { ...p, muc_tieu_pt: 50 } }), '42501', 'chủ trì hạ mục tiêu');
    assertOk(await goi('demo_cvp', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { ...p, muc_tieu_pt: 80, muc_tieu_ngay: `${NAM}-11-30` } }), 'Chánh VP đổi mục tiêu');
    const lai = await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p }); assertOk(lai, 'chủ trì gắn lại (giữ mục tiêu lãnh đạo đặt)'); assert.equal(lai.data.doi, false);
    const g = (await db().from('gn_nhiem_vu').select('muc_tieu_pt, muc_tieu_ngay').eq('nhiem_vu_id', cdt).single()).data;
    assert.deepEqual(g, { muc_tieu_pt: 80, muc_tieu_ngay: `${NAM}-11-30` });
    for (const u of ['demo_cv2', 'demo_a0']) chan(await goi(u, 'gn_gan_nhiem_vu', { p_nv: cdt, p }), '42501', u);
    assert.equal((await ls(cdt)).length, 2, 'diễn biến: gắn, đổi mục tiêu (gắn lại y hệt không ghi)');
  });

  test('3b. (0120) Việc lãnh đạo đặt mục tiêu: chủ trì không bỏ / đổi; người tự gắn (mục tiêu mặc định) tự sửa, tự bỏ; NaN, số quá lớn, tên trùng → 22023', async () => {
    const p = { loai: 'CHU_DAU_TU', nam: NAM, ten: 'Ban QLDA tỉnh', ten_chuan: 'ban qlda tỉnh' }; const xa = { ten: 'UBND xã A', ten_chuan: 'ubnd xã a' };
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { loai: null } }), '42501', 'chủ trì bỏ theo dõi việc lãnh đạo đặt mục tiêu');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { ...p, ...xa } }), '42501', 'chủ trì đổi đối tượng');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { ...p, nam: NAM - 1, muc_tieu_pt: 100, muc_tieu_ngay: `${NAM - 1}-12-31` } }), '42501', 'chủ trì đổi năm (về mục tiêu mặc định, như giao diện gửi)');
    chan(await goi('demo_cvp', 'gn_gan_nhiem_vu', { p_nv: cdt, p: { ...p, muc_tieu_pt: 'NaN' } }), '22023', 'mục tiêu NaN');
    const g = (await db().from('gn_nhiem_vu').select('nam, ten_chuan, muc_tieu_pt').eq('nhiem_vu_id', cdt).single()).data;
    assert.deepEqual(g, { nam: NAM, ten_chuan: 'ban qlda tỉnh', muc_tieu_pt: 80 }, 'việc gắn giữ nguyên');
    const c = await giao('demo_cvp', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong }); assertOk(c, 'giao việc tự gắn');
    assertOk(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: c.data.id, p }), 'chủ trì tự gắn');
    assertOk(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: c.data.id, p: { ...p, ...xa } }), 'tự sửa đối tượng (mục tiêu mặc định)');
    const bo = await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: c.data.id, p: { loai: null } }); assertOk(bo, 'tự bỏ theo dõi'); assert.equal(bo.data.doi, true);
    const sai = [['kế hoạch NaN', { ke_hoach: 'NaN' }, /Kế hoạch vốn phải lớn hơn 0/], ['lũy kế quá lớn', { da_giai_ngan: 1e13 }, /Kế hoạch vốn phải lớn hơn 0/],
      ['dòng NaN', { dong: [{ loai: 'NGUON', ten: 'B', ten_chuan: 'b', da_giai_ngan: 'NaN' }] }, /Dòng chi tiết có số không hợp lệ/],
      ['"dong" không phải danh sách', { dong: { loai: 'NGUON' } }, /phải là một danh sách/],
      ['tên trùng sau khi cắt khoảng trắng', { dong: [{ loai: 'NGUON', ten: 'C', ten_chuan: 'c' }, { loai: 'NGUON', ten: 'C', ten_chuan: 'c ' }] }, /hai dòng cùng tên/]];
    for (const [nhan, o, m] of sai) { const r = await goi('demo_cv1', 'gn_ghi_ky', { p: ky(o) }); chan(r, '22023', nhan); assert.match(r.error.message, m, nhan); }
  });

  test('3c. (0121–0122) Chủ trì (tự giao cho mình, Trưởng phòng của việc giao phòng) không hạ / bỏ việc cấp trên gắn; Phó Chánh VP ngoài phạm vi không đi vòng qua "Số liệu toàn tỉnh"', async () => {
    const p = { loai: 'CHU_DAU_TU', nam: NAM, ten: 'Ban QLDA tỉnh', ten_chuan: 'ban qlda tỉnh' };
    const s = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1 }); assertOk(s, 'chuyên viên tự giao việc cho mình');
    assertOk(await goi('demo_truongphong', 'gn_gan_nhiem_vu', { p_nv: s.data.id, p: { ...p, muc_tieu_pt: 80, muc_tieu_ngay: `${NAM}-09-30` } }), 'Trưởng phòng gắn, mục tiêu 80%');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: s.data.id, p: { ...p, muc_tieu_pt: 10 } }), '42501', 'chủ trì (tự giao) hạ mục tiêu');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: s.data.id, p: { loai: null } }), '42501', 'chủ trì (tự giao) bỏ theo dõi');
    const f = await giao('demo_pcvp', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong }); assertOk(f, 'Phó Chánh VP giao cho phòng (chưa giao cán bộ)');
    assertOk(await goi('demo_cvp', 'gn_gan_nhiem_vu', { p_nv: f.data.id, p: { ...p, muc_tieu_pt: 80, muc_tieu_ngay: `${NAM}-09-30` } }), 'Chánh VP gắn việc của phòng, 80%');
    chan(await goi('demo_truongphong', 'gn_gan_nhiem_vu', { p_nv: f.data.id, p: { ...p, muc_tieu_pt: 10 } }), '42501', 'Trưởng phòng (chủ trì việc của phòng) hạ mục tiêu');
    chan(await goi('demo_truongphong', 'gn_gan_nhiem_vu', { p_nv: f.data.id, p: { loai: null } }), '42501', 'Trưởng phòng bỏ theo dõi việc Chánh VP gắn');
    for (const q of [{ loai: 'TOAN_TINH', nam: NAM - 1, muc_tieu_pt: 10 }, { loai: 'TOAN_TINH', nam: 2099 }, { loai: null }]) {
      chan(await goi('demo_pcvp2', 'gn_gan_nhiem_vu', { p_nv: cdt, p: q }), '42501', `Phó Chánh VP ngoài phạm vi: ${JSON.stringify(q)}`);
    }
    const g = (await db().from('gn_nhiem_vu').select('nhiem_vu_id, nam, loai, muc_tieu_pt').in('nhiem_vu_id', [s.data.id, f.data.id, cdt]).order('muc_tieu_pt')).data;
    assert.deepEqual(g.map((x) => [x.nam, x.loai, Number(x.muc_tieu_pt)]), [[NAM, 'CHU_DAU_TU', 80], [NAM, 'CHU_DAU_TU', 80], [NAM, 'CHU_DAU_TU', 80]], 'ba việc gắn giữ nguyên');
    const r = await goi('demo_cv1', 'gn_ghi_ky', { p: ky({ ke_hoach: '0.0004' }) }); chan(r, '22023', 'kế hoạch 0,0004 (làm tròn thành 0)');
  });

  test('4. Xem: kỳ và dòng mọi tài khoản; việc toàn tỉnh mọi người, việc khác theo phạm vi; anon không đọc; không ghi thẳng bảng', async () => {
    const cv2 = await userClient('demo_cv2');
    assert.equal(((await cv2.from('gn_ky').select('id').eq('nam', NAM)).data || []).length, 2, 'cv2 đọc kỳ');
    assert.equal(((await cv2.from('gn_ky_dong').select('ky_id').eq('ky_id', kyId)).data || []).length, 1, 'cv2 đọc dòng');
    const thay = ((await cv2.from('gn_nhiem_vu').select('nhiem_vu_id').eq('nam', NAM)).data || []).map((x) => x.nhiem_vu_id);
    assert.ok(thay.includes(tt), 'việc toàn tỉnh: mọi người thấy');
    if (!(await xemToanBo())) assert.ok(!thay.includes(cdt), 'việc gắn chủ đầu tư của phòng khác: cv2 không thấy');
    assert.ok(((await (await userClient('demo_truongphong')).from('gn_nhiem_vu').select('nhiem_vu_id').eq('nam', NAM)).data || []).some((x) => x.nhiem_vu_id === cdt), 'Trưởng phòng thấy việc của phòng');
    assert.equal(((await anonClient().from('gn_ky').select('id').eq('nam', NAM)).data || []).length, 0, 'anon');
    const cv1 = await userClient('demo_cv1');
    assert.ok((await cv1.from('gn_ky').insert({ nam: NAM, ngay_so_lieu: `${NAM}-08-31`, can_cu: KHOA, ke_hoach: 1, da_giai_ngan: 0 })).error, 'insert gn_ky');
    await cv1.from('gn_nhiem_vu').update({ muc_tieu_pt: 1 }).eq('nhiem_vu_id', cdt);
    await cv1.from('gn_ky_dong').delete().eq('ky_id', kyId);
    assert.equal(Number((await db().from('gn_nhiem_vu').select('muc_tieu_pt').eq('nhiem_vu_id', cdt).single()).data.muc_tieu_pt), 80, 'update thẳng không có tác dụng');
    assert.equal(((await db().from('gn_ky_dong').select('ky_id').eq('ky_id', kyId)).data || []).length, 1, 'delete thẳng không có tác dụng');
  });

  test('5. Xoá kỳ: người ngoài bị chặn, chủ trì xoá được (có diễn biến); bỏ chọn việc toàn tỉnh chỉ lãnh đạo Văn phòng', async () => {
    chan(await goi('demo_cv2', 'gn_xoa_ky', { p_id: kyId }), '42501', 'cv2 xoá');
    assertOk(await goi('demo_cv1', 'gn_xoa_ky', { p_id: kyId }), 'chủ trì xoá');
    assert.equal(((await db().from('gn_ky').select('id').eq('id', kyId)).data || []).length, 0);
    assert.ok((await ls(tt)).some((x) => x.gia_tri_moi === 'Xoá kỳ số liệu'), 'diễn biến xoá');
    chan(await goi('demo_cv1', 'gn_gan_nhiem_vu', { p_nv: tt, p: { loai: null } }), '42501', 'chủ trì bỏ chọn việc toàn tỉnh');
    const bo = await goi('demo_cvp', 'gn_gan_nhiem_vu', { p_nv: tt, p: { loai: null } }); assertOk(bo, 'CVP bỏ chọn'); assert.equal(bo.data.doi, true);
  });
});
