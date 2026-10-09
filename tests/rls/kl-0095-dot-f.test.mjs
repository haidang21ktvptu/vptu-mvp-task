// Đợt F v3.21 (0095–0096, quyết định chủ dự án 9/10/2026 — mọi chuyên viên ngang nhau): bỏ quyền "quản trị nhiệm vụ". Chuyên viên KHÔNG giữ cờ
// nào: (1) nhập việc thay mặt một lãnh đạo / nhóm lãnh đạo — Owner phải trong phạm vi của lãnh đạo được thay mặt; lãnh đạo không ghi thay mặt;
// (2) lưu vết chỉ ghi tài khoản thực hiện: lich_su cột giao_viec "Nhập bởi <người nhập>", diễn biến không hiện "thay mặt …" (kể cả vết cũ
// giao_thay_mat trước 0095); (3) người nhập xem lại việc mình nhập ngoài phạm vi (RLS + quy tắc gốc kl_tham_chieu_pham_vi), là tầng giao (sửa
// thông tin giao), không ra chỉ đạo thay lãnh đạo; (4) Thường trực không nhập liệu, không sửa danh mục; (5) 0097 + rà soát: dòng Excel "đã xong
// ngoài hệ thống" kiểm phạm vi như giao_viec, dòng cập nhật theo mã của việc ngoài phạm vi bị bỏ qua không lộ nội dung; thay mặt kiểm người theo
// dõi; văn bản trùng khoá được dùng lại. Khoá "KL-0095"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0095';
// Có 0095: hàm kl_lo_cua_toi tồn tại (lỗi quyền vẫn tính là có; chỉ "không tìm thấy hàm" mới bỏ qua).
const coDotF = async () => !/PGRST202|42883/.test((await db().rpc('kl_lo_cua_toi', { p_lo: '00000000-0000-4000-8000-000000000000' })).error?.code || '');
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coDotF()) ? 'Chưa có migration 0095 (kl_lo_cua_toi).' : false;
let dem = 0;
const vb = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} #${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const CHUNG = { san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' };
const giao = async (username, p = {}) => (await userClient(username)).rpc('giao_viec', { p: { van_ban_id: null, van_ban: vb(), noi_dung: `${KHOA} ${username} ${dem + 1}`, ...CHUNG, ...p } });
const ma = (r, code, label) => assert.equal(r.error?.code, code, `${label}: ${r.error?.message || 'không bị chặn'}`);
const vet = async (id) => (await db().from('lich_su').select('cot, gia_tri_moi, nguoi_sua').eq('nhiem_vu_id', id).in('cot', ['giao_viec', 'giao_thay_mat'])).data;
const thay = async (username, id) => ((await (await userClient(username)).from('v_nhiem_vu').select('id').eq('id', id)).data || []).length === 1;
const don = async () => {
  await db().from('lo_nhap').delete().like('ten_tep', `${KHOA}%`);   // dong_nhap theo FK CASCADE (trước khi xoá việc mà dòng nhập trỏ tới)
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('dm_lich_su').delete().like('ly_do', `${KHOA}%`);
};
const VB = { loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EX`, ngay_ban_hanh: '2026-09-01' };
const nhap = async (u, dong) => {
  const lo = await goi(u, 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-${u}.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: dong.length } });
  assertOk(lo, `${u} mở lô`);
  const r = await goi(u, 'nhap_excel_dong', { p_lo: lo.data.id, p_dong: dong.map((d, i) => ({ so_dong: i + 1, ...VB, tien_do_ma: 'HOAN_THANH', ...d })) });
  assertOk(r, `${u} nhập dòng`); return r.data;
};
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);

describe('0095–0096 — mọi chuyên viên nhập thay mặt, lưu vết người nhập, người nhập xem lại việc mình nhập', { skip: SKIP }, () => {
  before(don);
  after(don);
  let nvTp; let nvNhom;

  test('1. Chuyên viên không cờ thay mặt Trưởng phòng (Owner phòng mình được, phòng khác bị chặn); lãnh đạo ghi thay mặt bị chặn; thay mặt một chuyên viên bị chặn', async () => {
    const [ca, cb, cc, cd] = await Promise.all([
      giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, thay_mat_cho: IDS.truongphong }),
      giao('demo_cv1', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, thay_mat_cho: IDS.truongphong }),
      giao('demo_truongphong', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.pcvp }),
      giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.cv2 })]);
    assertOk(ca, 'cv1 thay mặt Trưởng phòng Tổng hợp'); nvTp = ca.data.id;
    ma(cb, '22023', 'Owner phòng Quản trị ngoài phạm vi Trưởng phòng Tổng hợp'); assert.match(cb.error.message, /chỉ giao cho Owner thuộc phòng mình/);
    ma(cc, '22023', 'lãnh đạo ghi thay mặt'); assert.match(cc.error.message, /Lãnh đạo giao việc trực tiếp/);
    ma(cd, '22023', 'thay mặt một chuyên viên'); assert.match(cd.error.message, /lãnh đạo Văn phòng hoặc Trưởng phòng/);
    const n = (await db().from('nhiem_vu').select('tao_boi, giao_thay_mat_cho, nguoi_theo_doi').eq('id', nvTp).single()).data;
    assert.deepEqual(n, { tao_boi: IDS.cv1, giao_thay_mat_cho: IDS.truongphong, nguoi_theo_doi: IDS.truongphong });
  });

  test('2. Lưu vết: lich_su "Nhập bởi <người nhập>" (không cột giao_thay_mat); diễn biến không ghi "thay mặt"; vết cũ giao_thay_mat hiện như "Nhập bởi"', async () => {
    assert.deepEqual(await vet(nvTp), [{ cot: 'giao_viec', gia_tri_moi: 'Nhập bởi Demo Chuyên viên Một', nguoi_sua: IDS.cv1 }]);
    assertOk(await db().from('lich_su').insert({ nhiem_vu_id: nvTp, nguoi_sua: IDS.cv1, cot: 'giao_thay_mat', gia_tri_moi: 'Demo Chuyên viên Một giao thay mặt Demo Trưởng phòng', nguon: 'app' }), 'vết cũ (trước 0095)');
    const db1 = await (await userClient('demo_truongphong')).from('v_dien_bien').select('nguon, loai, noi_dung').eq('nhiem_vu_id', nvTp);
    assertOk(db1, 'Trưởng phòng đọc diễn biến');
    const ls = db1.data.filter((d) => d.nguon === 'lich_su' && d.loai === 'giao_viec');
    assert.deepEqual(ls.map((d) => d.noi_dung), ['Nhập bởi Demo Chuyên viên Một', 'Nhập bởi Demo Chuyên viên Một'], 'vết mới và vết cũ cùng một dạng');
    assert.ok(!db1.data.some((d) => d.loai === 'giao_thay_mat' || (d.nguon === 'lich_su' && /thay mặt/.test(d.noi_dung || ''))), 'không hiện "thay mặt"');
  });

  test('3. Thay mặt nhóm Lãnh đạo Văn phòng, Owner phòng khác: người nhập (chỉ là người tạo) thấy việc, tham chiếu phạm vi khớp, sửa thông tin giao được, không gia hạn', async () => {
    const r = await giao('demo_cv1', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.pcvp2, thay_mat_nhom: 'LANH_DAO_VP' });
    assertOk(r, 'cv1 thay mặt Lãnh đạo Văn phòng giao phòng Quản trị'); nvNhom = r.data.id;
    assert.deepEqual((await vet(nvNhom)).map((x) => x.gia_tri_moi), ['Nhập bởi Demo Chuyên viên Một']);
    for (const [u, mong] of [['demo_cv1', true], ['demo_cv2', true], ['demo_pcvp2', true], ['demo_truongphong', false]]) assert.equal(await thay(u, nvNhom), mong, `${u} thấy việc`);
    const ref = await db().rpc('kl_tham_chieu_pham_vi', { p_nguoi: IDS.cv1 });
    assertOk(ref, 'tham chiếu cv1');
    const goc = Object.fromEntries(ref.data.map((x) => [x.bang, x.ids || []]));
    assert.ok(goc.nhiem_vu.includes(nvNhom) && goc.v_nhiem_vu.includes(nvNhom), 'quy tắc gốc có việc người nhập');
    const lsId = (await db().from('lich_su').select('id').eq('nhiem_vu_id', nvNhom)).data.map((x) => String(x.id));
    assert.ok(lsId.every((x) => goc.lich_su.includes(x)), 'quy tắc gốc có lịch sử của việc người nhập');
    assertOk(await (await userClient('demo_cv1')).rpc('sua_thong_tin_giao', { p_id: nvNhom, p_thay_doi: { san_pham_mo_ta: `${KHOA} báo cáo` }, p_ly_do: `${KHOA} bổ sung` }), 'người nhập là tầng giao');
    assertDenied(await (await userClient('demo_cv1')).rpc('chi_dao_gui', { p: { nhiem_vu_id: nvNhom, loai: 'GIA_HAN', noi_dung: 'x', han_moi: '2027-02-01' } }), 'người nhập không gia hạn thay lãnh đạo');
    assertDenied(await (await userClient('demo_cv1')).from('nhiem_vu').update({ noi_dung: 'x' }).eq('id', nvNhom).select('id'), 'không ghi thẳng bảng');
  });

  test('4. Thường trực không nhập liệu, không sửa danh mục; chuyên viên thêm lĩnh vực được (nhật ký dm_lich_su ghi người thêm)', async () => {
    const lo = { p: { ten_tep: `${KHOA}.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 1 } };
    assertDenied(await (await userClient('demo_a0')).rpc('nhap_excel_lo_tao', lo), 'Thường trực mở lô');
    assertDenied(await (await userClient('demo_a0')).rpc('admin_them_linh_vuc', { p_nganh_ma: 'KINH_TE_TONG_HOP', p_ten: `${KHOA} lĩnh vực`, p_ly_do: KHOA }), 'Thường trực thêm lĩnh vực');
    const r = await (await userClient('demo_cv1')).rpc('admin_them_linh_vuc', { p_nganh_ma: 'KINH_TE_TONG_HOP', p_ten: `${KHOA} lĩnh vực`, p_ly_do: `${KHOA} thêm` });
    assertOk(r, 'chuyên viên thêm lĩnh vực');
    try {
      const ls = (await db().from('dm_lich_su').select('nguoi, hanh_dong').eq('ma', r.data)).data;
      assert.deepEqual(ls, [{ nguoi: IDS.cv1, hanh_dong: 'them' }]);
    } finally { await db().from('dm_linh_vuc').delete().eq('ma', r.data); }
  });

  test('5. (0097) Excel "đã xong ngoài hệ thống": lãnh đạo theo phạm vi mình (thay mặt bị bỏ), chuyên viên không ghi lãnh đạo = giao thẳng (chủ trì chuyên viên, theo dõi = người nhập), ghi lãnh đạo thì theo phạm vi lãnh đạo đó', async () => {
    const tp = await nhap('demo_truongphong', [{ noi_dung: `${KHOA} TP phòng khác`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, thay_mat_cho: IDS.truongphong }]);
    assert.deepEqual([tp[0].ket_qua, tp[0].ghi_chu], ['CHO_HOAN_THIEN', 'Chủ trì ngoài phạm vi giao của đồng chí.']);
    const cv = await nhap('demo_cv1', [
      { noi_dung: `${KHOA} cv phòng`, owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong },
      { noi_dung: `${KHOA} cv giao thẳng`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cvp },
      { noi_dung: `${KHOA} cv thay mặt ngoài phòng`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.truongphong, thay_mat_cho: IDS.truongphong },
      { noi_dung: `${KHOA} cv theo dõi ngoài`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv2, thay_mat_cho: IDS.truongphong },
      { noi_dung: `${KHOA} cv thay mặt CVP đơn vị ngoài`, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.cvp }]);
    assert.deepEqual(cv.map((x) => x.ket_qua), ['CHO_HOAN_THIEN', 'DA_XONG', 'CHO_HOAN_THIEN', 'CHO_HOAN_THIEN', 'DA_XONG']);
    assert.match(cv[0].ghi_chu, /chủ trì phải là một chuyên viên/); assert.match(cv[2].ghi_chu, /Chủ trì ngoài phạm vi giao của lãnh đạo giao/);
    assert.match(cv[3].ghi_chu, /Người theo dõi ngoài phạm vi giao của lãnh đạo giao/);
    const v = (await db().from('nhiem_vu').select('nguoi_theo_doi, giao_thay_mat_cho, tao_boi, nguon').in('id', [cv[1].nhiem_vu_id, cv[4].nhiem_vu_id]).order('noi_dung')).data;
    assert.deepEqual(v, [{ nguoi_theo_doi: IDS.cv1, giao_thay_mat_cho: null, tao_boi: IDS.cv1, nguon: 'excel' }, { nguoi_theo_doi: IDS.cv1, giao_thay_mat_cho: IDS.cvp, tao_boi: IDS.cv1, nguon: 'excel' }]);
  });

  test('6. Cập nhật theo mã của việc ngoài phạm vi: bỏ qua, không so từng ô; thay mặt có người theo dõi ngoài phạm vi lãnh đạo bị chặn; văn bản trùng khoá (người nhập không thấy) được dùng lại', async () => {
    const vb = (await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/VB`, ngay_ban_hanh: '2026-09-01', tao_boi: IDS.cvp }).select('id').single()).data;
    const ngoai = await db().from('nhiem_vu').insert({ van_ban_id: vb.id, noi_dung: `${KHOA} việc phòng Quản trị`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2,
      nguoi_theo_doi: IDS.cv2, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31' }).select('id, ma').single();
    assertOk(ngoai, 'việc ngoài phạm vi cv1');
    assert.equal(await thay('demo_cv1', ngoai.data.id), false);
    const lo = await goi('demo_cv1', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-do.xlsx`, mau: 'TU_GHEP', che_do_xong: 'CHO_NGHIEM_THU', so_dong: 1 } });
    const r = await goi('demo_cv1', 'nhap_excel_dong', { p_lo: lo.data.id, p_dong: [{ so_dong: 1, ma: ngoai.data.ma, cap_nhat: true, han_xu_ly: '2027-01-31', san_pham_loai: 'TO_TRINH' }] });
    assertOk(r, 'nhập dòng cập nhật');
    assert.deepEqual([r.data[0].ket_qua, r.data[0].nhiem_vu_id], ['BO_QUA', null]);
    assert.match(r.data[0].ghi_chu, /không thuộc các việc đồng chí xem được/); assert.doesNotMatch(r.data[0].ghi_chu, /hạn|chủ trì|thông tin giao/);
    const td = await giao('demo_cv1', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv2, thay_mat_cho: IDS.truongphong });
    ma(td, '22023', 'theo dõi ngoài phạm vi Trưởng phòng'); assert.match(td.error.message, /Người theo dõi phải là đồng chí, lãnh đạo được thay mặt/);
    const lai = await (await userClient('demo_cv1')).rpc('giao_viec', { p: { van_ban: { loai: 'CONG_VAN', so_ket_luan: ` ${KHOA}/VB `, ngay_ban_hanh: '2026-09-01' },
      noi_dung: `${KHOA} dùng lại văn bản`, ...CHUNG, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, thay_mat_cho: IDS.truongphong } });
    assertOk(lai, 'văn bản đã có — dùng lại'); assert.equal(lai.data.van_ban_id, vb.id);
    const sai = await (await userClient('demo_cv1')).rpc('giao_viec', { p: { van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA}/VB`, ngay_ban_hanh: '2026-09-01' },
      noi_dung: `${KHOA} sai`, ...CHUNG, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv2, thay_mat_cho: IDS.truongphong } });
    assert.ok(sai.error, 'lỗi phía sau vẫn huỷ cả giao dịch');
    assert.equal((await db().from('van_ban_giao_viec').select('id').like('so_ket_luan', `${KHOA}/VB%`)).data.length, 1, 'không tạo văn bản trùng');
  });
});
