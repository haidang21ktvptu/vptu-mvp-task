// GĐ23 (0041, 0042) — quản trị hệ thống: qt_xem_truoc_xoa / qt_xoa_du_lieu chỉ quan_tri_he_thong; sai chữ XOÁ bị chặn, không mất dòng; xoá đúng
// phạm vi (văn bản riêng của test) và ghi nhat_ky_he_thong (chỉ quan_tri_he_thong đọc); xoa_co_doi_mat_khau chỉ chính chủ; qt_dat_cau_hinh chỉ
// Chánh VP / quan_tri_he_thong, ghi nhật ký; a2_uy_quyen: Trưởng phòng cấp có hạn cho chuyên viên phòng mình, hết hạn → quan_tri_kl false trong view.
// Dữ liệu riêng: văn bản so_hoi_nghi 997 / RLS-TEST-0041, nhiệm vụ NV-T41x; tự dọn. Không đụng tài khoản demo (không dùng bộ du_lieu_thu).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
let vb; const id = {}; let nguongGoc;

// Dọn: dữ liệu riêng của file; trả ngưỡng về giá trị đọc được lúc bắt đầu (các file khác kỳ vọng giá trị của migration).
const don = async () => {
  await db().from('nhiem_vu').delete().like('ma', 'NV-T41%');
  await db().from('van_ban_giao_viec').delete().eq('so_ket_luan', 'RLS-TEST-0041');
  await db().from('accounts').update({ quan_tri_kl: false, quan_tri_kl_het_han: null, must_change_password: false }).in('id', [IDS.cv1, IDS.cv2]);
  if (nguongGoc) await db().from('kl_cau_hinh').update({ gia_tri: nguongGoc }).eq('khoa', 'nguong_sap_den_han_ngay');
};

describe('0041/0042 — quản trị hệ thống', { skip: SKIP }, () => {
  before(async () => {
    nguongGoc = (await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'nguong_sap_den_han_ngay').single()).data.gia_tri;
    await don();
    const r = await db().from('van_ban_giao_viec').insert({ so_hoi_nghi: 997, so_ket_luan: 'RLS-TEST-0041', ngay_ban_hanh: '2026-08-01' }).select('id').single();
    assertOk(r, 'văn bản 0041'); vb = r.data.id;
    for (const ma of ['NV-T411', 'NV-T412']) {
      const n = await db().from('nhiem_vu').insert({ ma, van_ban_id: vb, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0041 ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP' }).select('id').single();
      assertOk(n, ma); id[ma] = n.data.id;
    }
    const d = await db().from('direct_messages').insert({ sender_id: null, receiver_id: IDS.cv1, content: `KL-0041 · NV-T411: tin thử`, is_read: false, loai: 'he_thong', nhiem_vu_id: id['NV-T411'] });
    assertOk(d, 'tin hệ thống thử');
  });
  after(don);

  test('A3 thường / A2 / A1 không gọi được xem trước hay xoá (42501)', async () => {
    for (const u of ['demo_cv1', 'demo_truongphong', 'demo_cvp']) {
      const c = await userClient(u);
      assertDenied(await c.rpc('qt_xem_truoc_xoa', { p_pham_vi: { loai: 'nhiem_vu', van_ban_id: vb } }), `${u} xem trước`);
      assertDenied(await c.rpc('qt_xoa_du_lieu', { p_pham_vi: { loai: 'nhiem_vu', van_ban_id: vb }, p_xac_nhan: 'XOÁ' }), `${u} xoá`);
      const nk = await c.from('nhat_ky_he_thong').select('id').limit(1);
      assert.ok(nk.error || nk.data.length === 0, `${u} không đọc được nhật ký hệ thống`);
    }
  });

  test('QTHT: xem trước đếm đúng; gõ sai XOÁ bị chặn và không mất dòng; XOÁ đúng → mất theo phạm vi, nhật ký ghi', async () => {
    const q = await userClient('demo_qtht');
    const xt = await q.rpc('qt_xem_truoc_xoa', { p_pham_vi: { loai: 'nhiem_vu', van_ban_id: vb } });
    assertOk(xt, 'xem trước');
    assert.equal(xt.data.nhiem_vu, 2); assert.equal(xt.data.direct_messages, 1); assert.equal(xt.data.thuc_hien, false);
    const sai = await q.rpc('qt_xoa_du_lieu', { p_pham_vi: { loai: 'nhiem_vu', van_ban_id: vb }, p_xac_nhan: 'xoa' });
    assert.ok(sai.error && /XOÁ/.test(sai.error.message), 'sai chữ XOÁ phải bị chặn');
    assert.equal((await db().from('nhiem_vu').select('id').like('ma', 'NV-T41%')).data.length, 2, 'xem trước và XOÁ sai không xoá gì');
    const thieu = await q.rpc('qt_xem_truoc_xoa', { p_pham_vi: { loai: 'tin_nhan' } });
    assert.ok(thieu.error, 'thiếu phạm vi phải bị chặn');
    const xoa = await q.rpc('qt_xoa_du_lieu', { p_pham_vi: { loai: 'nhiem_vu', van_ban_id: vb }, p_xac_nhan: 'XOÁ' });
    assertOk(xoa, 'xoá');
    assert.equal(xoa.data.nhiem_vu, 2); assert.equal(xoa.data.thuc_hien, true);
    assert.equal((await db().from('nhiem_vu').select('id').like('ma', 'NV-T41%')).data.length, 0);
    assert.equal((await db().from('van_ban_giao_viec').select('id').eq('id', vb)).data.length, 1, 'loại nhiem_vu không xoá văn bản');
    const nk = await q.from('nhat_ky_he_thong').select('nguoi, hanh_dong, doi_tuong, chi_tiet').eq('hanh_dong', 'don_du_lieu').order('id', { ascending: false }).limit(1);
    assertOk(nk, 'đọc nhật ký'); assert.equal(nk.data[0].nguoi, IDS.qtht); assert.equal(nk.data[0].doi_tuong, 'nhiem_vu'); assert.equal(nk.data[0].chi_tiet.ket_qua.nhiem_vu, 2);
  });

  test('xoa_co_doi_mat_khau chỉ xoá cờ của chính chủ', async () => {
    await db().from('accounts').update({ must_change_password: true }).in('id', [IDS.cv1, IDS.cv2]);
    assertOk(await (await userClient('demo_cv2')).rpc('xoa_co_doi_mat_khau'), 'cv2 xoá cờ');
    const co = async (i) => (await db().from('accounts').select('must_change_password').eq('id', i).single()).data.must_change_password;
    assert.equal(await co(IDS.cv2), false); assert.equal(await co(IDS.cv1), true, 'cờ của cv1 giữ nguyên');
    assertOk(await (await userClient('demo_cv1')).rpc('xoa_co_doi_mat_khau'), 'cv1 xoá cờ');
    assert.equal(await co(IDS.cv1), false);
  });

  test('qt_dat_cau_hinh: Chánh VP đổi được (có lý do, ghi nhật ký); Trưởng phòng / PCVP bị chặn; UPDATE thẳng bảng bị chặn', async () => {
    const cvp = await userClient('demo_cvp');
    assert.ok((await cvp.rpc('qt_dat_cau_hinh', { p_khoa: 'nguong_sap_den_han_ngay', p_gia_tri: '5', p_ly_do: '' })).error, 'thiếu lý do');
    assertOk(await cvp.rpc('qt_dat_cau_hinh', { p_khoa: 'nguong_sap_den_han_ngay', p_gia_tri: '5', p_ly_do: 'KL-0041 thử' }), 'CVP đổi');
    assert.equal((await db().from('kl_cau_hinh').select('gia_tri').eq('khoa', 'nguong_sap_den_han_ngay').single()).data.gia_tri, '5');
    assert.ok(nguongGoc !== '5', 'giá trị gốc khác 5 để phép đổi có ý nghĩa');
    assertDenied(await (await userClient('demo_truongphong')).rpc('qt_dat_cau_hinh', { p_khoa: 'nguong_sap_den_han_ngay', p_gia_tri: '6', p_ly_do: 'x' }), 'A2');
    assertDenied(await (await userClient('demo_pcvp')).rpc('qt_dat_cau_hinh', { p_khoa: 'nguong_sap_den_han_ngay', p_gia_tri: '6', p_ly_do: 'x' }), 'PCVP');
    const truc = await cvp.from('kl_cau_hinh').update({ gia_tri: '9' }).eq('khoa', 'nguong_sap_den_han_ngay').select('gia_tri');
    assert.ok(truc.error || truc.data.length === 0, 'không UPDATE thẳng bảng');
    const nk = await (await userClient('demo_qtht')).from('nhat_ky_he_thong').select('hanh_dong, doi_tuong, chi_tiet').eq('hanh_dong', 'cau_hinh').order('id', { ascending: false }).limit(1);
    assert.equal(nk.data[0].doi_tuong, 'nguong_sap_den_han_ngay'); assert.equal(nk.data[0].chi_tiet.moi, '5');
  });

  test('a2_uy_quyen: Trưởng phòng cấp có hạn cho chuyên viên phòng mình; ngoài phòng / A3 gọi bị chặn; hết hạn → view quan_tri_kl false', async () => {
    const tp = await userClient('demo_truongphong');
    const mai = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
    assertDenied(await (await userClient('demo_cv1')).rpc('a2_uy_quyen', { p_nguoi: IDS.cv2, p_den_ngay: mai, p_ly_do: 'x' }), 'A3 ủy quyền');
    assert.ok((await tp.rpc('a2_uy_quyen', { p_nguoi: IDS.cv2, p_den_ngay: mai, p_ly_do: 'KL-0041' })).error, 'cv2 khác phòng (QUAN_TRI)');
    assertOk(await tp.rpc('a2_uy_quyen', { p_nguoi: IDS.cv1, p_den_ngay: mai, p_ly_do: 'KL-0041 đi công tác' }), 'ủy quyền cv1');
    const cv1 = await userClient('demo_cv1');
    assert.equal((await cv1.rpc('me_quan_tri_kl')).data, true);
    assert.equal((await cv1.from('accounts_public').select('quan_tri_kl').eq('id', IDS.cv1).single()).data.quan_tri_kl, true);
    await db().from('accounts').update({ quan_tri_kl_het_han: '2026-01-01' }).eq('id', IDS.cv1);
    assert.equal((await cv1.rpc('me_quan_tri_kl')).data, false, 'hết hạn');
    assert.equal((await cv1.from('accounts_public').select('quan_tri_kl').eq('id', IDS.cv1).single()).data.quan_tri_kl, false);
    await db().from('accounts').update({ quan_tri_kl_het_han: mai }).eq('id', IDS.cv1);
    assertOk(await tp.rpc('a2_thu_uy_quyen', { p_nguoi: IDS.cv1, p_ly_do: 'KL-0041 thu' }), 'thu');
    const acc = (await db().from('accounts').select('quan_tri_kl, quan_tri_kl_het_han').eq('id', IDS.cv1).single()).data;
    assert.equal(acc.quan_tri_kl, false); assert.equal(acc.quan_tri_kl_het_han, null);
    const ls = await db().from('quyen_lich_su').select('bat').eq('tai_khoan', IDS.cv1).like('ly_do', 'KL-0041%').order('id');
    assert.deepEqual(ls.data.map((r) => r.bat), [true, false]);
    await db().from('quyen_lich_su').delete().like('ly_do', 'KL-0041%');
  });
});
