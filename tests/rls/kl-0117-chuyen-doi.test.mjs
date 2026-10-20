// 0117–0118 (v3.27 — chủ dự án 20/10/2026): cơ quan trình nhận "Văn phòng Tỉnh ủy"; nhập Excel giữ ba ô nguồn (việc đã xong ngoài hệ thống, cập nhật
// theo mã); bo_sung_chuyen_doi — bổ sung dữ liệu chuyển đổi, chỉ tài khoản toàn quyền. Kiểm:
// (A) quyền (chạy cả staging): Chánh VP thật, chuyên viên, Thường trực có cờ toàn quyền, demo_qtht chưa có cờ → bị chặn; cơ quan trình nhận Văn phòng
//     Tỉnh ủy ở giao việc và sửa thông tin giao, phòng trong Văn phòng vẫn bị chặn; hồ sơ ghép cột nhận trường chu_tri;
// (B) logic (CI cục bộ): việc "đã xong ngoài hệ thống" giữ cơ quan trình, mức quan trọng, Thường trực chỉ đạo; cập nhật theo mã ghi cơ quan trình;
//     bo_sung_chuyen_doi — xem trước không ghi gì (trả đúng giá trị sẽ ghi), áp dụng chỉ điền ô trống, kết quả → minh chứng chữ cho việc đã xong chưa có
//     minh chứng (việc đang làm: bỏ qua), đổi loại văn bản, đổi chủ trì / người theo dõi chỉ khi ghi_de, giữ tiến độ và người / giờ cập nhật cuối, diễn
//     biến có lý do, nhật ký hệ thống, không gửi tin, chạy lại → GIU, dòng lỗi không làm hỏng dòng khác, giới hạn và lý do. Khoá dữ liệu "KL-0117"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, CHI_CUC_BO } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0117';
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const coHam = async () => (await goi('demo_cv1', 'kl_co_quan_trinh_hop_le', { p_ma: 'VAN_PHONG_TINH_UY' })).data === true;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coHam()) ? 'Chưa có migration 0117–0118.' : false;
const loi = (r) => r.error?.message || '';
let dem = 0;
const vanBan = () => ({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/CV/${++dem}`, ngay_ban_hanh: '2026-09-01', ngay_nhan: '2026-09-02' });
const giao = (u, p = {}) => goi(u, 'giao_viec', { p: { van_ban_id: null, van_ban: vanBan(), noi_dung: `${KHOA} giao ${u} ${dem + 1}`, owner_don_vi_ma: 'TONG_HOP',
  owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, san_pham_loai: 'BAO_CAO', han_xu_ly: '2026-12-31', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...p } });
const bs = (u, p, ly = `${KHOA} chuyển đổi`, ap = false) => goi(u, 'bo_sung_chuyen_doi', { p, p_ly_do: ly, p_ap: ap });
const datCo = (id, bat) => db().from('accounts').update({ toan_quyen: bat }).eq('id', id);
const viec = async (id) => (await db().from('nhiem_vu').select('*').eq('id', id).single()).data;
const khoiPhuc = async () => { assertOk(await datCo(IDS.qtht, false), 'thu cờ demo_qtht'); assertOk(await datCo(IDS.a0, false), 'thu cờ demo_a0'); };
const don = async () => {
  const nv = (await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data || [];
  if (nv.length) await db().from('direct_messages').delete().in('nhiem_vu_id', nv.map((r) => r.id));
  const lo = (await db().from('lo_nhap').select('id, ma').like('ten_tep', `${KHOA}%`)).data || [];
  for (const l of lo) await db().from('direct_messages').delete().like('content', `Nhập Excel · lô ${l.ma} %`);
  if (lo.length) await db().from('lo_nhap').delete().in('id', lo.map((l) => l.id));   // dong_nhap theo FK CASCADE
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'bo_sung_chuyen_doi').like('chi_tiet->>ly_do', `${KHOA}%`);
  await db().from('ho_so_nhap').delete().like('ten', `${KHOA}%`);
};

describe('0117–0118 — quyền bổ sung dữ liệu chuyển đổi, cơ quan trình Văn phòng Tỉnh ủy', { skip: SKIP }, () => {
  let mot;
  before(async () => { await khoiPhuc(); await don(); const r = await giao('demo_cvp'); assertOk(r, 'giao'); mot = r.data.id; });
  after(async () => { await khoiPhuc(); await don(); });

  test('A1. Chỉ tài khoản toàn quyền gọi được bo_sung_chuyen_doi (Chánh VP thật, chuyên viên, qtht chưa có cờ, Thường trực có cờ → 42501)', async () => {
    const ma = (await viec(mot)).ma; const p = { viec: [{ ma, co_quan_trinh: 'DANG_UY_UBND' }] };
    for (const u of ['demo_cvp', 'demo_cv1', 'demo_qtht']) assert.equal((await bs(u, p)).error?.code, '42501', u);
    assertOk(await datCo(IDS.a0, true), 'bật cờ demo_a0');
    try { assert.equal((await bs('demo_a0', p)).error?.code, '42501', 'Thường trực có cờ vẫn là Thường trực'); } finally { assertOk(await datCo(IDS.a0, false), 'thu cờ'); }
    assert.equal((await viec(mot)).co_quan_trinh, null, 'không ghi gì');
  });

  test('A2. Cơ quan trình nhận Văn phòng Tỉnh ủy (giao việc, sửa thông tin giao); phòng trong Văn phòng vẫn bị chặn', async () => {
    const r = await giao('demo_cvp', { co_quan_trinh: 'VAN_PHONG_TINH_UY' }); assertOk(r, 'giao với cơ quan trình VPTU');
    assert.equal((await viec(r.data.id)).co_quan_trinh, 'VAN_PHONG_TINH_UY');
    assert.match(loi(await giao('demo_cvp', { co_quan_trinh: 'TONG_HOP' })), /Cơ quan trình phải là cơ quan, đơn vị ngoài Văn phòng/);
    assertOk(await goi('demo_cvp', 'sua_thong_tin_giao', { p_id: mot, p_thay_doi: { co_quan_trinh: 'VAN_PHONG_TINH_UY' }, p_ly_do: KHOA }), 'sửa sang VPTU');
    assert.match(loi(await goi('demo_cvp', 'sua_thong_tin_giao', { p_id: mot, p_thay_doi: { co_quan_trinh: 'QUAN_TRI' }, p_ly_do: KHOA })), /Cơ quan trình không hợp lệ/);
    assert.equal((await viec(mot)).co_quan_trinh, 'VAN_PHONG_TINH_UY');
  });

  test('A3. Hồ sơ ghép cột nhận trường "Chủ trì theo dõi" (chu_tri — cột E bảng Phụ lục); trường lạ vẫn bị chặn', async () => {
    assertOk(await goi('demo_cv1', 'ho_so_nhap_luu', { p_ten: `${KHOA} hồ sơ`, p_ten_sheet: 'Nhập liệu', p_dong_tieu_de: 3,
      p_anh_xa: { 'chu tri theo doi': 'chu_tri', 'noi dung ket luan / van ban trinh': 'noi_dung' } }), 'lưu hồ sơ có chu_tri');
    assert.match(loi(await goi('demo_cv1', 'ho_so_nhap_luu', { p_ten: `${KHOA} hồ sơ sai`, p_ten_sheet: null, p_dong_tieu_de: 1, p_anh_xa: { x: 'khong_co' } })),
      /không có trong chuẩn nhập/);
  });
});

describe('0117–0118 — nhập Excel giữ ba ô nguồn; bổ sung dữ liệu chuyển đổi', { skip: SKIP || CHI_CUC_BO }, () => {
  let vbBtv; let xongA; let xongC; let mo; let maMo;
  const NV = { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP',
    loai_thoi_han_ma: 'CO_HAN_CU_THE', tien_do_ma: 'HOAN_THANH', nguon: 'excel', tao_boi: IDS.cvp, san_pham_loai: 'BAO_CAO' };
  const them = async (p) => { const r = await db().from('nhiem_vu').insert(p, { defaultToNull: false }).select('id').single(); assertOk(r, p.ma); return r.data.id; };
  before(async () => {
    await khoiPhuc(); await don();
    const vb = await db().from('van_ban_giao_viec').insert({ loai: 'KL_BTV', so_hoi_nghi: 996, so_ket_luan: `${KHOA}/06-TB`, ngay_ban_hanh: '2026-09-01' }).select('id').single();
    assertOk(vb, 'văn bản KL'); vbBtv = vb.data.id;
    xongA = await them({ ...NV, van_ban_id: vbBtv, ma: 'NV-T117A', noi_dung: `${KHOA} việc xong chưa có hạn, cơ quan trình, kết quả` });
    xongC = await them({ ...NV, van_ban_id: vbBtv, ma: 'NV-T117C', noi_dung: `${KHOA} việc xong đã có cơ quan trình, minh chứng`, co_quan_trinh: 'DANG_UY_UBND', han_xu_ly: '2026-09-30' });
    assertOk(await db().from('minh_chung').insert({ nhiem_vu_id: xongC, loai: 'chu_cu', noi_dung_chu: `${KHOA} minh chứng cũ`, nop_boi: IDS.cvp }), 'minh chứng C');
    const r = await giao('demo_cvp'); assertOk(r, 'việc đang làm'); mo = r.data.id; maMo = (await viec(mo)).ma;
    assertOk(await datCo(IDS.qtht, true), 'bật cờ toàn quyền demo_qtht');
  });
  after(async () => { await khoiPhuc(); await don(); });

  test('B1. Nhập Excel: việc "đã xong ngoài hệ thống" giữ cơ quan trình, mức quan trọng, Thường trực chỉ đạo; cập nhật theo mã ghi cơ quan trình', async () => {
    const lo = await goi('demo_cvp', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-pl.xlsx`, mau: 'CHUAN', che_do_xong: 'DA_XONG_NGOAI', so_dong: 2 } }); assertOk(lo, 'mở lô');
    const r = await goi('demo_cvp', 'nhap_excel_dong', { p_lo: lo.data.id, p_dong: [
      { so_dong: 2, loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/EX`, ngay_ban_hanh: '2026-09-01', noi_dung: `${KHOA} đã xong ngoài hệ thống`, owner_don_vi_ma: 'TONG_HOP',
        owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tien_do_ma: 'HOAN_THANH', kq_mo_ta: 'Đã gửi báo cáo', muc_quan_trong: 'B', co_quan_trinh: 'VAN_PHONG_TINH_UY',
        thuong_truc_chi_dao: IDS.a0, du_lieu_goc: {} },
      { so_dong: 3, ma: maMo, cap_nhat: true, co_quan_trinh: 'BAN_TO_CHUC', du_lieu_goc: {} }] });
    assertOk(r, 'nhập'); assert.deepEqual(r.data.map((x) => x.ket_qua), ['DA_XONG', 'CAP_NHAT'], JSON.stringify(r.data.map((x) => x.ghi_chu)));
    const x = await viec(r.data[0].nhiem_vu_id);
    assert.deepEqual([x.tien_do_ma, x.co_quan_trinh, x.muc_quan_trong, x.thuong_truc_chi_dao], ['HOAN_THANH', 'VAN_PHONG_TINH_UY', 'B', IDS.a0]);
    assert.equal((await viec(mo)).co_quan_trinh, 'BAN_TO_CHUC', 'cập nhật theo mã ghi cơ quan trình (ô tầng giao)');
    assertOk(await db().from('nhiem_vu').update({ co_quan_trinh: null }).eq('id', mo), 'trả lại ô trống cho bài sau');
  });

  test('B1b. Cập nhật theo mã đổi ngành (mẫu Phụ lục không có cột Lĩnh vực): lĩnh vực gợi ý cùng ngành; không gợi ý được → giữ ngành, ô khác vẫn ghi', async () => {
    assertOk(await db().from('nhiem_vu').update({ nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP' }).eq('id', mo), 'đặt ngành, lĩnh vực');
    const nhap = async (ten, dong) => {
      const lo = await goi('demo_cvp', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-${ten}.xlsx`, mau: 'CHUAN', che_do_xong: 'DA_XONG_NGOAI', so_dong: 1 } }); assertOk(lo, ten);
      const r = await goi('demo_cvp', 'nhap_excel_dong', { p_lo: lo.data.id, p_dong: [{ so_dong: 2, ma: maMo, cap_nhat: true, du_lieu_goc: {}, ...dong }] }); assertOk(r, ten);
      return r.data[0];
    };
    const k1 = await nhap('nganh1', { nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_goi_y: 'LV01_THAM_MUU_TONG_HOP', vuong_mac: `${KHOA} vướng` });
    assert.equal(k1.ket_qua, 'CAP_NHAT', k1.ghi_chu); assert.match(k1.ghi_chu || '', /ngành \(lĩnh vực đang có không thuộc ngành mới/);
    let x = await viec(mo);
    assert.deepEqual([x.nganh_ma, x.linh_vuc_ma, x.vuong_mac], ['THAM_MUU_TONG_HOP', 'LV01_THAM_MUU_TONG_HOP', `${KHOA} vướng`], 'gợi ý khác ngành: giữ ngành, vướng mắc vẫn ghi');
    const k2 = await nhap('nganh2', { nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_goi_y: 'LV08_TAI_CHINH' });
    assert.equal(k2.ket_qua, 'CAP_NHAT', k2.ghi_chu);
    x = await viec(mo); assert.deepEqual([x.nganh_ma, x.linh_vuc_ma], ['KINH_TE_TONG_HOP', 'LV08_TAI_CHINH']);
  });

  const P = () => ({ van_ban: [{ so_ket_luan: `${KHOA}/06-TB`, ngay_ban_hanh: '2026-09-01', loai: 'TB_THUONG_TRUC' }], viec: [
    { ma: 'nv-t117a', co_quan_trinh: 'VAN_PHONG_TINH_UY', linh_vuc_chi_tiet: 'Tổ chức cán bộ', han_xu_ly: '2026-10-01', ket_qua: '[Tự điền] Đã ban hành kế hoạch',
      owner_tai_khoan: IDS.cv2 },
    { ma: 'NV-T117C', co_quan_trinh: 'BAN_TO_CHUC', linh_vuc_chi_tiet: 'Đầu tư công', ket_qua: '[Tự điền] khác' },
    { ma: maMo, co_quan_trinh: 'DANG_UY_UBND', ghi_chu: 'Tiến độ theo tệp: đang triển khai', ket_qua: '[Tự điền] chưa xong', han_xu_ly: '2026-11-20' },
    { ma: 'NV-T117-KHONG-CO', co_quan_trinh: 'DANG_UY_UBND' },
    { ma: maMo, co_quan_trinh: 'TONG_HOP' }] });

  test('B2. Xem trước: trả đúng ô sẽ đổi / giữ / bỏ qua, dòng lỗi riêng; không ghi gì (văn bản, việc, minh chứng, diễn biến)', async () => {
    const r = await bs('demo_qtht', P()); assertOk(r, 'xem trước');
    assert.equal(r.data.da_ghi, false);
    const rNull = await bs('demo_qtht', P(), `${KHOA} p_ap null`, null); assertOk(rNull, 'p_ap null');
    assert.equal(rNull.data.da_ghi, false, 'p_ap NULL = xem trước (không ghi, không nhật ký)');
    assert.deepEqual([r.data.van_ban[0].ket_qua, r.data.van_ban[0].cu, r.data.van_ban[0].moi, r.data.van_ban[0].so_viec], ['DOI', 'KL_BTV', 'TB_THUONG_TRUC', 2]);
    const [a, c, d, k, t] = r.data.viec;
    assert.deepEqual([a.ket_qua, a.cu, a.moi], ['DOI', { co_quan_trinh: null, linh_vuc_chi_tiet: null, han_xu_ly: null },
      { co_quan_trinh: 'VAN_PHONG_TINH_UY', linh_vuc_chi_tiet: 'Tổ chức cán bộ', han_xu_ly: '2026-10-01', ket_qua: '[Tự điền] Đã ban hành kế hoạch' }]);
    assert.equal(a.ma, 'NV-T117A'); assert.equal(a.da_xong, true);
    assert.deepEqual([c.ket_qua, Object.keys(c.moi), c.giu.sort()], ['DOI', ['linh_vuc_chi_tiet'], ['co_quan_trinh', 'ket_qua']]);
    assert.deepEqual([d.ket_qua, Object.keys(d.moi).sort(), d.giu, d.bo_qua], ['DOI', ['co_quan_trinh', 'ghi_chu'], ['han_xu_ly'], ['ket_qua']]);
    assert.deepEqual([k.ket_qua, t.ket_qua], ['LOI', 'LOI']); assert.match(k.loi, /Không có nhiệm vụ/); assert.match(t.loi, /không có trong danh mục/);
    assert.deepEqual([r.data.so_viec, r.data.so_doi, r.data.so_loi], [5, 3, 2]);
    const x = await viec(xongA);
    assert.deepEqual([x.co_quan_trinh, x.linh_vuc_chi_tiet, x.han_xu_ly], [null, null, null], 'xem trước không ghi việc');
    assert.equal((await db().from('minh_chung').select('id').eq('nhiem_vu_id', xongA)).data.length, 0, 'không ghi minh chứng');
    assert.equal((await db().from('van_ban_giao_viec').select('loai').eq('id', vbBtv).single()).data.loai, 'KL_BTV', 'không đổi loại văn bản');
    assert.equal((await db().from('lich_su').select('id').in('nhiem_vu_id', [xongA, xongC, mo]).eq('cot', 'bo_sung_chuyen_doi')).data.length, 0, 'không ghi diễn biến');
  });

  test('B3. Áp dụng: chỉ ô trống, minh chứng chữ cho việc đã xong, đổi loại văn bản; giữ tiến độ, người / giờ cập nhật; diễn biến, nhật ký; không gửi tin', async () => {
    const truoc = await viec(xongA); const truocMo = await viec(mo);
    const tin = async () => (await db().from('direct_messages').select('id', { count: 'exact', head: true }).in('nhiem_vu_id', [xongA, xongC, mo])).count;
    const tinTruoc = await tin();
    assert.equal((await bs('demo_qtht', P(), '  ', true)).error?.code, '22023', 'lý do bắt buộc');
    const r = await bs('demo_qtht', P(), `${KHOA} chuyển đổi tệp TUCB`, true); assertOk(r, 'áp dụng');
    assert.deepEqual([r.data.da_ghi, r.data.so_doi, r.data.so_loi], [true, 3, 2]);
    const a = await viec(xongA);
    assert.deepEqual([a.co_quan_trinh, a.linh_vuc_chi_tiet, a.han_xu_ly, a.tien_do_ma, a.ngay_hoan_thanh, a.thieu_minh_chung],
      ['VAN_PHONG_TINH_UY', 'Tổ chức cán bộ', '2026-10-01', 'HOAN_THANH', null, false]);
    assert.deepEqual([a.owner_tai_khoan, a.cap_nhat_luc, a.cap_nhat_boi], [IDS.cv1, truoc.cap_nhat_luc, truoc.cap_nhat_boi], 'không ghi_de: chủ trì giữ; người / giờ cập nhật giữ');
    const mc = (await db().from('minh_chung').select('loai, noi_dung_chu').eq('nhiem_vu_id', xongA)).data;
    assert.deepEqual(mc, [{ loai: 'chu_cu', noi_dung_chu: '[Tự điền] Đã ban hành kế hoạch' }]);
    const c = await viec(xongC);
    assert.deepEqual([c.co_quan_trinh, c.linh_vuc_chi_tiet], ['DANG_UY_UBND', 'Đầu tư công'], 'ô có giá trị giữ nguyên');
    assert.equal((await db().from('minh_chung').select('id').eq('nhiem_vu_id', xongC)).data.length, 1, 'đã có minh chứng: không thêm');
    const m = await viec(mo);
    assert.deepEqual([m.co_quan_trinh, m.ghi_chu, m.han_xu_ly, m.tien_do_ma, m.cap_nhat_luc], ['DANG_UY_UBND', 'Tiến độ theo tệp: đang triển khai', '2026-12-31',
      truocMo.tien_do_ma, truocMo.cap_nhat_luc]);
    assert.equal((await db().from('minh_chung').select('id').eq('nhiem_vu_id', mo)).data.length, 0, 'việc đang làm: không ghi kết quả');
    assert.equal((await db().from('van_ban_giao_viec').select('loai').eq('id', vbBtv).single()).data.loai, 'TB_THUONG_TRUC');
    const ls = (await db().from('lich_su').select('nhiem_vu_id, gia_tri_moi').eq('cot', 'bo_sung_chuyen_doi').in('nhiem_vu_id', [xongA, xongC, mo])).data;
    assert.equal(ls.filter((l) => l.nhiem_vu_id === xongA).length, 2, 'việc A: đổi loại văn bản + bổ sung');
    assert.ok(ls.every((l) => l.gia_tri_moi.includes(`${KHOA} chuyển đổi tệp TUCB`)), 'diễn biến có lý do');
    assert.ok(ls.some((l) => l.nhiem_vu_id === xongA && /cơ quan trình.*kết quả \(minh chứng chữ\)/.test(l.gia_tri_moi)));
    const nk = (await db().from('nhat_ky_he_thong').select('nguoi, chi_tiet').eq('hanh_dong', 'bo_sung_chuyen_doi').like('chi_tiet->>ly_do', `${KHOA}%`)).data;
    assert.equal(nk.length, 1); assert.equal(nk[0].nguoi, IDS.qtht); assert.equal(nk[0].chi_tiet.so_doi, 3);
    assert.equal(await tin(), tinTruoc, 'không gửi tin cho cán bộ');
    const lai = await bs('demo_qtht', P(), `${KHOA} chạy lại`, true); assertOk(lai, 'chạy lại');
    assert.deepEqual([lai.data.van_ban[0].ket_qua, ...lai.data.viec.slice(0, 3).map((x) => x.ket_qua)], ['GIU', 'GIU', 'GIU', 'GIU'], 'chạy lại: không đổi gì');
  });

  test('B4. Chủ trì / người theo dõi chỉ đổi khi ghi_de (đơn vị theo phòng; lãnh đạo Văn phòng → Văn phòng Tỉnh ủy); kiểm giá trị, giới hạn', async () => {
    const r = await bs('demo_qtht', { viec: [{ ma: 'NV-T117A', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2, ghi_de: ['owner_tai_khoan', 'nguoi_theo_doi'] },
      { ma: 'NV-T117C', owner_tai_khoan: IDS.cvp, ghi_de: ['owner_tai_khoan'] }, { ma: 'NV-T117C', nguoi_theo_doi: '00000000-0000-4000-8000-0000000000ff', ghi_de: ['nguoi_theo_doi'] },
      { ma: 'NV-T117A', han_xu_ly: 'không phải ngày' }] }, `${KHOA} đổi chủ trì theo tệp Thường trực`, true);
    assertOk(r, 'đổi chủ trì');
    assert.deepEqual(r.data.viec.map((x) => x.ket_qua), ['DOI', 'DOI', 'LOI', 'LOI'], JSON.stringify(r.data.viec.map((x) => x.loi)));
    const a = await viec(xongA); const c = await viec(xongC);
    assert.deepEqual([a.owner_tai_khoan, a.owner_don_vi_ma, a.nguoi_theo_doi], [IDS.cv2, 'QUAN_TRI', IDS.cv2]);
    assert.deepEqual([c.owner_tai_khoan, c.owner_don_vi_ma, c.tien_do_ma], [IDS.cvp, 'VAN_PHONG_TINH_UY', 'HOAN_THANH']);
    assert.match(r.data.viec[2].loi, /cán bộ Văn phòng/);
    assert.match(r.data.viec[3].loi, /không phải ngày hợp lệ/);
    const nhieu = { viec: Array.from({ length: 301 }, (_, i) => ({ ma: `NV-X${i}` })) };
    assert.match(loi(await bs('demo_qtht', nhieu)), /tối đa 300/);
    assert.match(loi(await bs('demo_qtht', { viec: [] })), /Chưa có dòng nào/);
    const vb = await bs('demo_qtht', { van_ban: [{ so_ket_luan: `${KHOA}/06-TB`, ngay_ban_hanh: '2026-09-01', loai: 'NGHI_DINH' },
      { so_ket_luan: `${KHOA}/KHONG-CO`, ngay_ban_hanh: '2026-09-01', loai: 'KL_BTV' }] });
    assertOk(vb, 'văn bản sai'); assert.deepEqual(vb.data.van_ban.map((x) => x.ket_qua), ['LOI', 'LOI']);
    assert.match(vb.data.van_ban[0].loi, /không hợp lệ/); assert.match(vb.data.van_ban[1].loi, /Không có văn bản/);
    const g = await giao('demo_cvp'); assertOk(g, 'việc công văn chưa có ngành');   // đổi sang Thông báo Thường trực: việc theo 1400 thiếu ngành → lỗi
    const vbCv = (await db().from('van_ban_giao_viec').select('so_ket_luan, ngay_ban_hanh').eq('id', (await viec(g.data.id)).van_ban_id).single()).data;
    const vb2 = await bs('demo_qtht', { van_ban: [{ so_ket_luan: vbCv.so_ket_luan, ngay_ban_hanh: vbCv.ngay_ban_hanh, loai: 'TB_THUONG_TRUC' }] }, `${KHOA} đổi loại`, true);
    assertOk(vb2, 'đổi loại'); assert.equal(vb2.data.van_ban[0].ket_qua, 'LOI'); assert.match(vb2.data.van_ban[0].loi, /chưa có ngành, lĩnh vực cụ thể/);
  });

  test('B5. Chủ trì là đơn vị ("VPTU"): owner_tai_khoan trống + Văn phòng Tỉnh ủy (ghi_de); đơn vị ngoài Văn phòng bị chặn', async () => {
    const r = await bs('demo_qtht', { viec: [{ ma: 'NV-T117A', owner_tai_khoan: '', owner_don_vi_ma: 'VAN_PHONG_TINH_UY', nguoi_theo_doi: IDS.cvp, ghi_de: ['owner_tai_khoan', 'nguoi_theo_doi'] },
      { ma: 'NV-T117C', owner_tai_khoan: '', owner_don_vi_ma: 'DANG_UY_UBND', ghi_de: ['owner_tai_khoan'] }] }, `${KHOA} chủ trì là Văn phòng`, true);
    assertOk(r, 'chủ trì là đơn vị');
    assert.deepEqual(r.data.viec.map((x) => x.ket_qua), ['DOI', 'LOI'], JSON.stringify(r.data.viec.map((x) => x.loi)));
    const a = await viec(xongA);
    assert.deepEqual([a.owner_tai_khoan, a.owner_don_vi_ma, a.nguoi_theo_doi, a.tien_do_ma], [null, 'VAN_PHONG_TINH_UY', IDS.cvp, 'HOAN_THANH']);
    assert.match(r.data.viec[1].loi, /Văn phòng Tỉnh ủy hoặc một phòng/);
  });
});
