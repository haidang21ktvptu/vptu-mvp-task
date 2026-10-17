// 0104 (v3.24, chủ dự án duyệt 16/10/2026): nhật ký đăng nhập và thống kê sử dụng cho quản trị hệ thống.
// Kiểm: (1) ghi_nhan_dang_nhap — mỗi phiên một dòng (gọi lại chỉ cập nhật hoạt động gần nhất), đúng tài khoản người gọi, thời điểm đăng nhập
// không ở tương lai; anon không gọi được; (2) bảng chỉ quản trị hệ thống đọc (chuyên viên, Chánh VP đọc 0 dòng), không ai INSERT / UPDATE /
// DELETE trực tiếp; (3) qt_thong_ke_dang_nhap — người thường bị chặn (42501), quản trị thấy mọi tài khoản trừ tài khoản hệ thống, khoảng sai
// → 22023; (4) qt_thong_ke_nhap_moi — chặn người thường, đơn vị sai → 22023, đếm theo NGÀY GIỜ VIỆT NAM (17:30 UTC = 00:30 hôm sau), tuần bắt
// đầu thứ Hai, tách GIAO_VIEC / TIEP_XUONG / EXCEL (nguon = excel hoặc việc do lô Excel tạo — lô chỉ CẬP NHẬT việc có sẵn thì không tính);
// (5) [chỉ cục bộ] đăng nhập lại = phiên mới = dòng mới.
// Dữ liệu mẫu tháng 3/2025 (trước khi có hệ thống — không đụng việc của test khác), mã NV-Q104x (không trùng vùng mã NV-T… của các test khác), khoá "KL-0104"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { adminClient, anonClient, userClient, assertOk, assertDenied, IDS, CHI_CUC_BO, getKeys, SEED_PASSWORD, EMAIL_DOMAIN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0104';
const coBang = async () => !(await db().from('nhat_ky_dang_nhap').select('id').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0104 (nhat_ky_dang_nhap).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const phienCua = async (c) => {
  const t = (await c.auth.getSession()).data.session.access_token;
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).session_id;
};
const dongCuaPhien = (phien) => db().from('nhat_ky_dang_nhap').select('tai_khoan, luc, hoat_dong_cuoi').eq('phien', phien);
const don = async () => {
  await db().from('lo_nhap').delete().like('ten_tep', `${KHOA}%`);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};
// Đếm của người nhập cv1: khoá "ky|cach" → số việc.
const bang = (rows) => Object.fromEntries((rows || []).filter((r) => r.nguoi_nhap === IDS.cv1).map((r) => [`${r.ky}|${r.cach}`, r.so_viec]));

describe('0104 — nhật ký đăng nhập, thống kê sử dụng (chỉ quản trị hệ thống)', { skip: SKIP }, () => {
  before(don);
  after(don);
  let phienCv1;

  test('1. ghi_nhan_dang_nhap: một phiên một dòng, đúng người gọi; gọi lại chỉ cập nhật hoạt động gần nhất; anon bị chặn', async () => {
    const c = await userClient('demo_cv1');
    phienCv1 = await phienCua(c);
    assert.ok(phienCv1, 'JWT có session_id');
    assertOk(await c.rpc('ghi_nhan_dang_nhap'), 'ghi lần 1');
    const r1 = await dongCuaPhien(phienCv1); assertOk(r1, 'đọc dòng');
    assert.equal(r1.data.length, 1, 'một dòng cho phiên');
    assert.equal(r1.data[0].tai_khoan, IDS.cv1);
    assert.ok(Date.parse(r1.data[0].luc) <= Date.now() + 5000, 'thời điểm đăng nhập không ở tương lai');
    assertOk(await c.rpc('ghi_nhan_dang_nhap'), 'ghi lần 2 (tải lại trang)');
    const r2 = await dongCuaPhien(phienCv1);
    assert.equal(r2.data.length, 1, 'vẫn một dòng');
    assert.equal(r2.data[0].luc, r1.data[0].luc, 'giữ thời điểm đăng nhập');
    assert.ok(Date.parse(r2.data[0].hoat_dong_cuoi) >= Date.parse(r1.data[0].hoat_dong_cuoi), 'hoạt động gần nhất không lùi');
    assertDenied(await anonClient().rpc('ghi_nhan_dang_nhap'), 'anon gọi ghi_nhan_dang_nhap');
  });

  test('2. Bảng chỉ quản trị hệ thống đọc; không ai ghi, sửa, xoá trực tiếp', async () => {
    const [cv1, cvp, qtht] = await Promise.all(['demo_cv1', 'demo_cvp', 'demo_qtht'].map(userClient));
    const doc = (c) => c.from('nhat_ky_dang_nhap').select('phien, tai_khoan');
    const [a, b, q] = await Promise.all([doc(cv1), doc(cvp), doc(qtht)]);
    assertOk(a, 'cv1 đọc'); assertOk(b, 'cvp đọc'); assertOk(q, 'qtht đọc');
    assert.equal(a.data.length, 0, 'chuyên viên không thấy dòng nào (kể cả của mình)');
    assert.equal(b.data.length, 0, 'Chánh VP không thấy dòng nào');
    assert.ok(q.data.some((r) => r.phien === phienCv1), 'quản trị hệ thống thấy dòng của cv1');
    assertDenied(await cv1.from('nhat_ky_dang_nhap').insert({ tai_khoan: IDS.cv1, phien: crypto.randomUUID() }), 'cv1 INSERT');
    assertDenied(await qtht.from('nhat_ky_dang_nhap').update({ dia_chi_ip: 'x' }).eq('phien', phienCv1), 'qtht UPDATE');
    assertDenied(await qtht.from('nhat_ky_dang_nhap').delete().eq('phien', phienCv1), 'qtht DELETE');
  });

  test('3. qt_thong_ke_dang_nhap: chặn người thường; quản trị thấy mọi tài khoản trừ tài khoản hệ thống; khoảng sai bị chặn', async () => {
    const tu = new Date(Date.now() - 86400e3).toISOString(); const den = new Date(Date.now() + 3600e3).toISOString();
    const cv = await goi('demo_cv1', 'qt_thong_ke_dang_nhap', { p_tu: tu, p_den: den });
    assert.equal(cv.error?.code, '42501', 'chuyên viên gọi thống kê');
    const r = await goi('demo_qtht', 'qt_thong_ke_dang_nhap', { p_tu: tu, p_den: den }); assertOk(r, 'quản trị gọi thống kê');
    const tk = (await db().from('accounts').select('id, is_system')).data;
    assert.equal(r.data.length, tk.filter((x) => !x.is_system).length, 'đủ mọi tài khoản không phải hệ thống');
    const heThong = new Set(tk.filter((x) => x.is_system).map((x) => x.id));
    assert.ok(!r.data.some((x) => heThong.has(x.tai_khoan)), 'không có tài khoản hệ thống');
    const cv1 = r.data.find((x) => x.tai_khoan === IDS.cv1);
    assert.ok(cv1.so_lan >= 1 && cv1.lan_cuoi && cv1.lan_cuoi_tong && cv1.hoat_dong_cuoi_tong, 'cv1 có lượt đăng nhập trong kỳ');
    assert.ok(cv1.lan_cuoi_xac_thuc, 'lần đăng nhập gần nhất theo hệ thống xác thực');
    assert.equal((await goi('demo_qtht', 'qt_thong_ke_dang_nhap', { p_tu: den, p_den: tu })).error?.code, '22023', 'đến trước từ');
  });

  test('4. qt_thong_ke_nhap_moi: chặn người thường, đơn vị sai; đếm theo ngày giờ Việt Nam, tuần từ thứ Hai, ba cách nhập', async () => {
    const vb = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} văn bản`, ngay_ban_hanh: '2025-03-01' }).select('id').single();
    assertOk(vb, 'văn bản mẫu');
    const base = { van_ban_id: vb.data.id, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.cv1, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2025-03-31' };
    const them = async (ma, row) => { const r = await db().from('nhiem_vu').insert({ ...base, ma, noi_dung: `${KHOA} ${ma}`, ...row }).select('id').single(); assertOk(r, ma); return r.data.id; };
    const a = await them('NV-Q1041', { created_at: '2025-03-03T17:30:00Z' });                       // 00:30 thứ Ba 04/3 giờ VN — giao việc
    await them('NV-Q1042', { created_at: '2025-03-05T02:00:00Z', nhiem_vu_cha: a });                 // 09:00 05/3 — giao tiếp xuống
    await them('NV-Q1043', { created_at: '2025-03-09T16:59:00Z', nguon: 'excel' });                  // 23:59 Chủ nhật 09/3 — Excel (nguồn cũ)
    const d = await them('NV-Q1044', { created_at: '2025-03-09T17:01:00Z' });                        // 00:01 thứ Hai 10/3 — tuần sau
    const e = await them('NV-Q1045', { created_at: '2025-03-12T03:00:00Z' });                        // 10:00 12/3 — nhập qua lô Excel
    const lo = await db().from('lo_nhap').insert({ ten_tep: `${KHOA}.xlsx`, mau: 'CHUAN', che_do_xong: 'DA_XONG_NGOAI', so_dong: 2, tao_boi: IDS.cv1 }).select('id').single();
    assertOk(lo, 'lô nhập mẫu');
    assertOk(await db().from('dong_nhap').insert({ lo_id: lo.data.id, so_dong: 1, ket_qua: 'GIAO', nhiem_vu_id: e }), 'dòng nhập mẫu');
    // Lô Excel chỉ CẬP NHẬT việc có sẵn (NV-Q1044 giao trên hệ thống) → vẫn tính là giao việc, không tính nhập Excel
    assertOk(await db().from('dong_nhap').insert({ lo_id: lo.data.id, so_dong: 2, ket_qua: 'CAP_NHAT', nhiem_vu_id: d }), 'dòng cập nhật mẫu');

    assert.equal((await goi('demo_cv1', 'qt_thong_ke_nhap_moi', { p_don_vi: 'day', p_tu: '2025-03-01', p_den: '2025-03-31' })).error?.code, '42501', 'chuyên viên');
    assert.equal((await goi('demo_qtht', 'qt_thong_ke_nhap_moi', { p_don_vi: 'quarter', p_tu: '2025-03-01', p_den: '2025-03-31' })).error?.code, '22023', 'đơn vị quý');
    assert.equal((await goi('demo_qtht', 'qt_thong_ke_nhap_moi', { p_don_vi: 'day', p_tu: '2025-03-31', p_den: '2025-03-01' })).error?.code, '22023', 'đến trước từ');
    const lay = async (donVi, tu, den) => { const r = await goi('demo_qtht', 'qt_thong_ke_nhap_moi', { p_don_vi: donVi, p_tu: tu, p_den: den }); assertOk(r, donVi); return bang(r.data); };
    assert.deepEqual(await lay('day', '2025-03-03', '2025-03-12'), {
      '2025-03-04|GIAO_VIEC': 1, '2025-03-05|TIEP_XUONG': 1, '2025-03-09|EXCEL': 1, '2025-03-10|GIAO_VIEC': 1, '2025-03-12|EXCEL': 1 });
    assert.deepEqual(await lay('day', '2025-03-04', '2025-03-04'), { '2025-03-04|GIAO_VIEC': 1 }, 'một ngày: biên đầu, cuối theo giờ VN');
    assert.deepEqual(await lay('week', '2025-03-03', '2025-03-16'), {
      '2025-03-03|EXCEL': 1, '2025-03-03|GIAO_VIEC': 1, '2025-03-03|TIEP_XUONG': 1, '2025-03-10|EXCEL': 1, '2025-03-10|GIAO_VIEC': 1 });
    assert.deepEqual(await lay('month', '2025-03-01', '2025-03-31'), { '2025-03-01|EXCEL': 2, '2025-03-01|GIAO_VIEC': 2, '2025-03-01|TIEP_XUONG': 1 });
    assert.deepEqual(await lay('year', '2025-01-01', '2025-12-31'), { '2025-01-01|EXCEL': 2, '2025-01-01|GIAO_VIEC': 2, '2025-01-01|TIEP_XUONG': 1 });
  });

  test('5. Đăng nhập lại (phiên mới) → dòng mới', { skip: CHI_CUC_BO }, async () => {
    const k = getKeys();
    const c = createClient(k.url, k.anon, { auth: { autoRefreshToken: false, persistSession: false } });
    assertOk(await c.auth.signInWithPassword({ email: `demo_cv2@${EMAIL_DOMAIN}`, password: SEED_PASSWORD }), 'đăng nhập cv2 phiên mới');
    const truoc = (await db().from('nhat_ky_dang_nhap').select('id', { count: 'exact', head: true }).eq('tai_khoan', IDS.cv2)).count;
    assertOk(await c.rpc('ghi_nhan_dang_nhap'), 'ghi phiên mới');
    const sau = (await db().from('nhat_ky_dang_nhap').select('id', { count: 'exact', head: true }).eq('tai_khoan', IDS.cv2)).count;
    assert.equal(sau, truoc + 1, 'thêm đúng một dòng');
    assert.notEqual(await phienCua(c), phienCv1);
    await c.auth.signOut({ scope: 'local' });
  });
});
