// 0112 (v3.25): cấu hình trợ lý AI, nhật ký AI, hàm chỉ service_role. Kiểm:
// (1) cau_hinh_ai — mọi tài khoản đọc (biết AI bật / tắt, nhà cung cấp), không ai ghi thẳng; qt_dat_cau_hinh_ai chỉ quản trị hệ thống, bắt buộc lý do,
//     'gia_lap' bị từ chối, 'khac' phải có địa chỉ https; nhật ký hệ thống ghi 'cau_hinh_ai'; bảng không có cột tên khoá (khoá API không nằm trong CSDL);
// (2) nhat_ky_ai — quản trị hệ thống đọc, chuyên viên không thấy dòng nào, không ai ghi thẳng;
// (3) ai_dem_luot / ai_giu_luot / ai_xong_luot / ai_du_lieu_hoc / ai_ghi_quy_tac / ai_can_hoc — tài khoản đăng nhập bị chặn, service_role gọi được:
//     giữ lượt ghi dòng DANG (tính vào lượt) rồi xong lượt ghi OK; quy tắc AI soạn vào tự kiểm (bật mức gợi ý hoặc tắt) — từ loại trừ không trúng gì
//     thì bật, nằm trong từ khoá của chính mục tiêu thì tắt; giá trị sai bị bỏ qua, ghi hoc_ai_luc; ai_du_lieu_hoc tôn trọng gui_noi_dung.
// Cấu hình trả lại như cũ; khoá dữ liệu "KL0112"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const coBang = async () => !(await db().from('cau_hinh_ai').select('id').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0112 (cau_hinh_ai).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const ma = (r, label) => { assert.ok(r.error, `${label}: phải lỗi`); return r.error.code; };
let cu = null; let hocCu; const luotTao = [];
const don = async () => {
  const q = (await db().from('quy_tac_muc_tieu').select('id').or('gia_tri.like.KL0112%,gia_tri.like.kl0112%')).data || [];
  if (q.length) { await db().from('dm_lich_su').delete().eq('bang', 'quy_tac_muc_tieu').in('ma', q.map((x) => x.id)); await db().from('quy_tac_muc_tieu').delete().in('id', q.map((x) => x.id)); }
  await db().from('nhat_ky_ai').delete().eq('loi', 'KL0112');
  if (luotTao.length) await db().from('nhat_ky_ai').delete().in('id', luotTao.splice(0));
  await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'cau_hinh_ai').filter('chi_tiet->>ly_do', 'like', 'KL0112%');
  if (cu) await db().from('cau_hinh_ai').update(cu).eq('id', 1);
  if (hocCu !== undefined) await db().from('dm_muc_tieu').update({ hoc_ai_luc: hocCu }).eq('ma', 'NQ_57');
};

describe('0112 — cấu hình trợ lý AI, nhật ký AI, hàm service_role', { skip: SKIP }, () => {
  before(async () => { hocCu = (await db().from('dm_muc_tieu').select('hoc_ai_luc').eq('ma', 'NQ_57').single()).data?.hoc_ai_luc ?? null; cu = (await db().from('cau_hinh_ai').select('nha_cung_cap, mo_hinh, dia_chi, muc_suy_nghi, bat, gui_noi_dung, gioi_han_ngay, gioi_han_nguoi').eq('id', 1).single()).data; await don(); });
  after(don);

  test('1. cau_hinh_ai: mọi tài khoản đọc; chỉ quản trị đổi qua hàm, có lý do; giả lập bị từ chối; dịch vụ khác cần địa chỉ; không có cột tên khoá', async () => {
    const r = await (await userClient('demo_cv1')).from('cau_hinh_ai').select('*').single();
    assertOk(r, 'cv1 đọc'); assert.ok(!('ten_khoa' in r.data) && !Object.keys(r.data).some((k) => /khoa|key|secret/i.test(k)), 'không lưu tên / giá trị khoá');
    assertDenied(await (await userClient('demo_qtht')).from('cau_hinh_ai').update({ bat: false }).eq('id', 1).select('id'), 'qtht ghi thẳng');
    assert.equal(ma(await goi('demo_cvp', 'qt_dat_cau_hinh_ai', { p: { bat: false }, p_ly_do: 'KL0112 x' }), 'Chánh VP'), '42501');
    assert.equal(ma(await goi('demo_qtht', 'qt_dat_cau_hinh_ai', { p: { bat: false }, p_ly_do: ' ' }), 'thiếu lý do'), '22023');
    assert.equal(ma(await goi('demo_qtht', 'qt_dat_cau_hinh_ai', { p: { nha_cung_cap: 'gia_lap' }, p_ly_do: 'KL0112 x' }), 'giả lập'), '22023');
    assert.equal(ma(await goi('demo_qtht', 'qt_dat_cau_hinh_ai', { p: { nha_cung_cap: 'khac', dia_chi: null }, p_ly_do: 'KL0112 x' }), 'khác thiếu địa chỉ'), '23514');
    assert.equal(ma(await goi('demo_qtht', 'qt_dat_cau_hinh_ai', { p: { nha_cung_cap: 'khac', dia_chi: 'http://x.vn/v1' }, p_ly_do: 'KL0112 x' }), 'không https'), '23514');
    assertOk(await goi('demo_qtht', 'qt_dat_cau_hinh_ai', { p: { nha_cung_cap: 'khac', dia_chi: 'https://ai.vi-du.vn/v1', mo_hinh: 'mo-hinh-thu' }, p_ly_do: 'KL0112 đổi' }), 'đổi sang dịch vụ khác');
    const d = (await db().from('cau_hinh_ai').select('nha_cung_cap, dia_chi, mo_hinh').eq('id', 1).single()).data;
    assert.deepEqual(d, { nha_cung_cap: 'khac', dia_chi: 'https://ai.vi-du.vn/v1', mo_hinh: 'mo-hinh-thu' });
    const nk = await db().from('nhat_ky_he_thong').select('chi_tiet').eq('hanh_dong', 'cau_hinh_ai').order('id', { ascending: false }).limit(1).single();
    assert.equal(nk.data.chi_tiet.moi.nha_cung_cap, 'khac');
  });

  test('2. nhat_ky_ai: quản trị hệ thống đọc, chuyên viên không thấy, không ai ghi thẳng', async () => {
    assertOk(await db().from('nhat_ky_ai').insert({ hanh_dong: 'KIEM_TRA', ket_qua: 'LOI', loi: 'KL0112' }), 'service ghi');
    const qt = await (await userClient('demo_qtht')).from('nhat_ky_ai').select('id').eq('loi', 'KL0112');
    assertOk(qt, 'qtht đọc'); assert.equal(qt.data.length, 1);
    const cv = await (await userClient('demo_cv1')).from('nhat_ky_ai').select('id').eq('loi', 'KL0112');
    assert.equal((cv.data || []).length, 0, 'chuyên viên không thấy');
    assertDenied(await (await userClient('demo_qtht')).from('nhat_ky_ai').insert({ hanh_dong: 'KIEM_TRA', ket_qua: 'OK' }).select('id'), 'qtht ghi thẳng');
  });

  test('3. Hàm của Edge Function chỉ service_role: giữ / xong lượt, tự kiểm quy tắc AI (từ khoá, loại trừ), giá trị sai bỏ qua, mẫu học theo gui_noi_dung', async () => {
    for (const [ham, ts] of [['ai_dem_luot', { p_nguoi: null }], ['ai_giu_luot', { p_nguoi: null, p_hanh_dong: 'KIEM_TRA', p: {} }], ['ai_xong_luot', { p_id: 1, p: {} }],
      ['ai_can_hoc', { p_gioi_han: 3 }], ['ai_du_lieu_hoc', { p_ma: 'NQ_57' }], ['ai_ghi_quy_tac', { p_ma: 'NQ_57', p_ds: [] }]]) {
      assert.ok((await goi('demo_qtht', ham, ts)).error, `${ham}: tài khoản đăng nhập bị chặn`);
    }
    const dl = await db().rpc('ai_dem_luot', { p_nguoi: null }); assertOk(dl, 'đếm lượt'); assert.ok(Number.isInteger(dl.data.ngay));
    const giu = await db().rpc('ai_giu_luot', { p_nguoi: null, p_hanh_dong: 'KIEM_TRA', p: { so_trang: 2, so_ky_tu: 900 } }); assertOk(giu, 'giữ lượt');
    luotTao.push(giu.data.id);
    if (giu.data.duoc) {
      const d1 = (await db().rpc('ai_dem_luot', { p_nguoi: null })).data;
      assert.equal(d1.ngay, dl.data.ngay + 1, 'lượt đang chạy (DANG) tính vào lượt ngày');
      assertOk(await db().rpc('ai_xong_luot', { p_id: giu.data.id, p: { ket_qua: 'OK', token_vao: 10, token_ra: 5, thoi_gian_ms: 1200 } }), 'xong lượt');
      const r = (await db().from('nhat_ky_ai').select('ket_qua, so_trang, token_vao, thoi_gian_ms').eq('id', giu.data.id).single()).data;
      assert.deepEqual(r, { ket_qua: 'OK', so_trang: 2, token_vao: 10, thoi_gian_ms: 1200 });
    }
    const g = await db().rpc('ai_ghi_quy_tac', { p_ma: 'NQ_57', p_ds: [{ loai: 'TU_KHOA', gia_tri: 'KL0112 đổi mới sáng tạo vùng biên' }, { loai: 'LOAI_TRU', gia_tri: 'KL0112 loại trừ thử' },
      { loai: 'LOAI_TRU', gia_tri: 'KL0112 đổi mới' }, { loai: 'TU_KHOA', gia_tri: 'ab' }, { loai: 'XYZ', gia_tri: 'KL0112 sai loại' }] });
    assertOk(g, 'ghi quy tắc'); assert.equal(g.data.them, 3);
    const tk = g.data.quy_tac.find((x) => x.loai === 'TU_KHOA');
    assert.ok(tk.trang_thai === 'BAT' && Number.isInteger(tk.tong) && /Tự kiểm/.test(tk.ly_do), 'tự kiểm từ khoá: không trúng việc nào → bật mức gợi ý');
    const lt = Object.fromEntries(((await db().from('quy_tac_muc_tieu').select('gia_tri, trang_thai, nguon, muc').eq('muc_tieu_ma', 'NQ_57').eq('loai', 'LOAI_TRU')
      .like('gia_tri', 'KL0112%')).data || []).map(({ gia_tri: gt, ...x }) => [gt, x]));
    assert.deepEqual(lt, { 'KL0112 loại trừ thử': { trang_thai: 'BAT', nguon: 'AI', muc: 'GOI_Y' }, 'KL0112 đổi mới': { trang_thai: 'TAT', nguon: 'AI', muc: 'GOI_Y' } },
      'loại trừ không trúng gì → bật; nằm trong từ khoá của chính mục tiêu → tắt');
    assert.ok((await db().from('dm_muc_tieu').select('hoc_ai_luc').eq('ma', 'NQ_57').single()).data.hoc_ai_luc, 'ghi lúc học');
    assertOk(await db().from('cau_hinh_ai').update({ gui_noi_dung: false }).eq('id', 1), 'tắt gửi nội dung');
    const h = await db().rpc('ai_du_lieu_hoc', { p_ma: 'NQ_57', p_gioi_han: 5 }); assertOk(h, 'mẫu học');
    assert.equal(h.data.gui_noi_dung, false); assert.deepEqual(h.data.viec_dung, []); assert.ok(h.data.quy_tac.length > 0, 'quy tắc hiện có vẫn gửi');
    const ch = await db().rpc('ai_can_hoc', { p_gioi_han: 50 }); assertOk(ch, 'cần học'); assert.ok(!ch.data.includes('NQ_57'), 'vừa học xong không cần học lại');
  });
});
