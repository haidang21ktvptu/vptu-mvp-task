// 0072–0075 (giao diện v9 đợt 2, B) — NHẬP EXCEL TOÀN TRÌNH, bằng token thật. Người nhập: demo_qtht (quản trị hệ thống) và demo_cv2 (cấp tạm
// quản trị nhiệm vụ); không phải người nhập: demo_cv1 (chủ trì các việc nhập), demo_truongphong, demo_cvp. Kiểm: (1) chỉ người nhập gọi được
// mọi hàm, không ai ghi thẳng bảng; (2) một lô đủ đường đi — GIAO (thay mặt Trưởng phòng, vướng mắc, không tin từng việc), vùng chờ (thiếu /
// lỗi kèm lý do: chủ trì khác phòng, Trưởng phòng thay mặt phòng khác), DA_XONG (nguồn excel, đóng, minh chứng chữ); gửi lại phần cũ không tạo
// thêm; chốt lô gửi MỘT tin cho mỗi người; (3) đọc theo vai: người thấy việc đọc dòng nhập + lô, người khác không; (4) hoàn thiện dòng chờ
// bằng giao_viec + dong_nhap_id, bỏ dòng; (5) lô CHO_NGHIEM_THU (minh chứng chờ nghiệm thu) + cập nhật việc có sẵn theo mã (hạn chỉ báo);
// (6) hoàn tác: chỉ người nhập lô / quản trị hệ thống, việc đã có thao tác giữ lại, cập nhật trả giá trị cũ, quá 24 giờ chặn; (7) từ điển,
// hồ sơ ghép cột, tra mã. Khoá dữ liệu "KL-0072" (nội dung việc, số hiệu văn bản, tên tệp, từ điển, hồ sơ); tự dọn trước và sau.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, songSong, homNayVN, IDS, CHI_CUC_BO } from './lib.mjs';

const KHOA = 'KL-0072';
const HN = 972;   // số hội nghị riêng của file này (fixture dùng 998–999)
const db = () => adminClient();
const coBang = !(await db().from('lo_nhap').select('id').limit(1)).error;
const SKIP = coBang ? false : 'Chưa có migration 0072–0075 (nhập Excel) trên project này.';
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const HOM = homNayVN(); const BH = cong(HOM, -20); const HAN = cong(HOM, 90); const KQ = cong(HOM, -2);
const LV = { nganh_ma: 'THAM_MUU_TONG_HOP', linh_vuc_ma: 'LV01_THAM_MUU_TONG_HOP' };
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const viec = async (id) => (await db().from('nhiem_vu').select('*').eq('id', id).single()).data;
const dongCua = async (lo) => (await db().from('dong_nhap').select('*').eq('lo_id', lo).order('so_dong')).data;

const don = async () => {
  const lo = (await db().from('lo_nhap').select('id, ma').like('ten_tep', `${KHOA}%`)).data || [];
  for (const l of lo) await db().from('direct_messages').delete().like('content', `Nhập Excel · lô ${l.ma} %`);
  const nv = (await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data || [];
  if (nv.length) await db().from('direct_messages').delete().in('nhiem_vu_id', nv.map((r) => r.id));
  if (lo.length) await db().from('lo_nhap').delete().in('id', lo.map((l) => l.id));   // dong_nhap theo FK CASCADE
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('tu_dien_nhap').delete().like('goc', `${KHOA.toLowerCase()}%`);
  await db().from('ho_so_nhap').delete().like('ten', `${KHOA}%`);
  await db().from('accounts').update({ quan_tri_kl: false }).eq('id', IDS.cv2);
};

// Dòng lô 1 (Phụ lục 2, Kết luận BTV hội nghị HN): 4 giao được; 5 thiếu sản phẩm; 6 đã xong ngoài hệ thống; 7 chủ trì khác phòng đơn vị;
// 8 Trưởng phòng Tổng hợp thay mặt giao cho phòng Quản trị.
const VB1 = { loai_van_ban: 'KL_BTV', so_hoi_nghi: HN, so_ket_luan: `${KHOA}/KL`, ngay_ban_hanh: BH };
const DU_GIAO = { loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: HAN, san_pham_loai: 'BAO_CAO', nguon_nhiem_vu_ma: 'VAN_BAN_CAN_THEO_DOI', ...LV };
const LO1 = [
  { so_dong: 4, ...VB1, ...DU_GIAO, noi_dung: `${KHOA} giao: báo cáo quý`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
    thay_mat_cho: IDS.truongphong, vuong_mac: 'Chờ số liệu sở', tien_do_ma: 'DANG_THUC_HIEN', du_lieu_goc: { STT: '1', 'Ngày cập nhật gần nhất': '01/09/2026' } },
  { so_dong: 5, ...VB1, noi_dung: `${KHOA} thiếu sản phẩm`, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thieu: ['san_pham'],
    du_lieu_goc: { STT: '2' } },
  { so_dong: 6, ...VB1, noi_dung: `${KHOA} đã xong ngoài hệ thống`, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, loai_thoi_han_ma: 'THUONG_XUYEN',
    tien_do_ma: 'HOAN_THANH', kq_so_hieu: '12/BC-UBND', kq_ngay: KQ, kq_trich_yeu: 'Báo cáo kết quả', kq_mo_ta: 'Đã gửi Thường trực', chat_luong: 'DAT', du_lieu_goc: { STT: '3' } },
  { so_dong: 7, ...VB1, ...DU_GIAO, noi_dung: `${KHOA} chủ trì khác phòng`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
    thay_mat_cho: IDS.cvp, du_lieu_goc: {} },
  { so_dong: 8, ...VB1, ...DU_GIAO, noi_dung: `${KHOA} thay mặt phòng khác`, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2,
    thay_mat_cho: IDS.truongphong, du_lieu_goc: {} },
];

describe('0072–0075 — nhập Excel toàn trình (lô, vùng chờ, hoàn tác, từ điển)', { skip: SKIP }, () => {
  let lo1; let lo2; let kq1; let coSan; let dong5; let dong8;
  before(async () => {
    await don();
    const vb = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/SAN`, ngay_ban_hanh: BH }).select('id').single();
    assertOk(vb, 'văn bản của việc có sẵn');
    const r = await db().from('nhiem_vu').insert({ van_ban_id: vb.data.id, noi_dung: `${KHOA} việc có sẵn`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: HAN, ...LV,
      theo_1400: true, ngay_nhan_van_ban: BH, ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1,
      tao_boi: IDS.truongphong, san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH' }).select('id, ma').single();
    assertOk(r, 'việc có sẵn'); coSan = r.data;
  });
  after(don);

  test('1. không phải người nhập (A3 thường, A2, A1 không giữ cờ): mọi hàm nhập bị chặn; không ai ghi thẳng bảng', async () => {
    const lo = { p: { ten_tep: `${KHOA}-chan.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 1 } };
    const kq = await songSong([
      () => goi('demo_cv1', 'nhap_excel_lo_tao', lo), () => goi('demo_truongphong', 'nhap_excel_lo_tao', lo), () => goi('demo_cvp', 'nhap_excel_lo_tao', lo),
      () => goi('demo_a0', 'nhap_excel_lo_tao', lo), () => goi('demo_cv1', 'kl_nhap_ma_da_co', { p_ma: [coSan.ma] }),
      () => goi('demo_cv1', 'tu_dien_nhap_luu', { p_muc: [{ loai: 'don_vi', goc: `${KHOA} x`, ma: 'DANG_UY_UBND' }] }),
      () => goi('demo_cv1', 'ho_so_nhap_luu', { p_ten: `${KHOA} chặn`, p_ten_sheet: null, p_dong_tieu_de: 1, p_anh_xa: { 'noi dung': 'noi_dung' } }),
    ]);
    ['cv1', 'truongphong', 'cvp', 'a0', 'cv1 tra mã', 'cv1 từ điển', 'cv1 hồ sơ'].forEach((n, i) => assertDenied(kq[i], `${n}`));
    assert.match(kq[0].error.message, /Chỉ quản trị nhiệm vụ hoặc quản trị hệ thống/);
    const qt = await userClient('demo_qtht');
    const ghi = await songSong([
      () => qt.from('lo_nhap').insert({ ten_tep: `${KHOA}-thang.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 1, tao_boi: IDS.qtht }),
      () => qt.from('tu_dien_nhap').insert({ loai: 'don_vi', goc: `${KHOA} thang`, ma: 'DANG_UY_UBND', tao_boi: IDS.qtht }),
      () => qt.from('ho_so_nhap').insert({ ten: `${KHOA} thang`, anh_xa: {}, tao_boi: IDS.qtht }),
    ]);
    ghi.forEach((r, i) => assertDenied(r, `qtht ghi thẳng bảng ${i}`));
  });

  test('2. qtht nhập lô 1: GIAO / chờ (thiếu, lỗi kèm lý do) / DA_XONG; gửi lại phần cũ không tạo thêm; chốt lô — một tin mỗi người, lô chốt không nhận thêm', async () => {
    const tao = await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-phu-luc-2.xlsx`, mau: 'PHU_LUC_2', che_do_xong: 'DA_XONG_NGOAI', so_dong: 5 } });
    assertOk(tao, 'mở lô'); lo1 = tao.data; assert.match(lo1.ma, /^LO-\d{4,}$/);
    const r = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo1.id, p_dong: LO1 });
    assertOk(r, 'nhập 5 dòng'); kq1 = Object.fromEntries(r.data.map((x) => [x.so_dong, x]));
    assert.deepEqual(r.data.map((x) => x.ket_qua), ['GIAO', 'CHO_HOAN_THIEN', 'DA_XONG', 'CHO_HOAN_THIEN', 'CHO_HOAN_THIEN']);
    assert.match(kq1[7].ghi_chu, /Owner phải thuộc phòng QUAN_TRI/); assert.match(kq1[8].ghi_chu, /Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình/);
    const g = await viec(kq1[4].nhiem_vu_id);
    assert.equal(g.nguon, 'app'); assert.equal(g.theo_1400, true); assert.equal(g.tao_boi, IDS.qtht); assert.equal(g.giao_thay_mat_cho, IDS.truongphong);
    assert.equal(g.ngay_nhan_van_ban, BH); assert.equal(g.ngay_nhan_uoc_tinh, true, 'văn bản không có ngày nhận → ngày ban hành, ghi là ước tính');
    assert.equal(g.vuong_mac, 'Chờ số liệu sở'); assert.ok(g.han_nop_minh_chung, 'hạn nộp minh chứng theo ngày gợi ý');
    const x = await viec(kq1[6].nhiem_vu_id);
    assert.equal(x.nguon, 'excel'); assert.equal(x.theo_1400, false); assert.equal(x.tien_do_ma, 'HOAN_THANH'); assert.equal(x.ngay_hoan_thanh, null); assert.equal(x.chat_luong, 'DAT');
    assert.equal(x.ngay_nhan_uoc_tinh, true);
    const mc = (await db().from('minh_chung').select('loai, noi_dung_chu').eq('nhiem_vu_id', x.id)).data;
    assert.equal(mc.length, 1); assert.equal(mc[0].loai, 'chu_cu'); assert.match(mc[0].noi_dung_chu, /Số 12\/BC-UBND · ngày .* · Báo cáo kết quả · Đã gửi Thường trực/);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', g.id).eq('cot', 'nhap_excel')).data;
    assert.equal(ls.length, 1); assert.match(ls[0].gia_tri_moi, new RegExp(`lô ${lo1.ma}, dòng 4`));
    assert.equal((await db().from('direct_messages').select('id').eq('nhiem_vu_id', g.id)).data.length, 0, 'không tin từng việc khi nhập theo lô');
    const dong = await dongCua(lo1.id);
    assert.deepEqual(dong[0].du_lieu_goc, { STT: '1', 'Ngày cập nhật gần nhất': '01/09/2026' }); assert.equal(dong[0].du_lieu.van_ban_moi, true);
    assert.deepEqual(dong[1].thieu, ['san_pham']); [dong5, dong8] = [dong[1], dong[4]];
    const lai = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo1.id, p_dong: [{ so_dong: 4, noi_dung: 'gửi lại' }] });
    assertOk(lai, 'gửi lại phần cũ'); assert.equal(lai.data[0].nhiem_vu_id, kq1[4].nhiem_vu_id);
    assert.equal((await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data.length, 3, 'việc có sẵn + 2 việc lô 1');
    assertDenied(await goi('demo_cv2', 'nhap_excel_dong', { p_lo: lo1.id, p_dong: [{ so_dong: 9 }] }), 'người khác gửi vào lô');
    const xong = await goi('demo_qtht', 'nhap_excel_lo_xong', { p_lo: lo1.id });
    assertOk(xong, 'chốt lô'); assert.deepEqual(xong.data, { GIAO: 1, DA_XONG: 1, CHO_HOAN_THIEN: 3 });
    const tin = (await db().from('direct_messages').select('receiver_id, content, nhiem_vu_id').like('content', `Nhập Excel · lô ${lo1.ma} (%`)).data;
    assert.deepEqual(tin.map((t) => t.receiver_id).sort(), [IDS.truongphong, IDS.cv1].sort());
    assert.match(tin.find((t) => t.receiver_id === IDS.cv1).content, new RegExp(`1 việc đồng chí chủ trì / theo dõi \\(${g.ma}\\)`));
    assert.match(tin.find((t) => t.receiver_id === IDS.truongphong).content, /1 việc giao thay mặt đồng chí/);
    const sau = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo1.id, p_dong: [{ so_dong: 9 }] });
    assert.ok(sau.error); assert.match(sau.error.message, /đã chốt/);
  });

  test('3. đọc theo vai: chủ trì đọc dòng của việc mình + lô; chuyên viên phòng khác không đọc gì; từ điển chỉ người nhập; người gõ thay không là tầng giao', async () => {
    const [cv1, cv2, tp] = await Promise.all(['demo_cv1', 'demo_cv2', 'demo_truongphong'].map(userClient));
    const [dCv1, lCv1, dCv2, lCv2, dTp, tdCv1] = await songSong([
      () => cv1.from('dong_nhap').select('so_dong, du_lieu_goc').eq('lo_id', lo1.id).order('so_dong'), () => cv1.from('lo_nhap').select('ma').eq('id', lo1.id),
      () => cv2.from('dong_nhap').select('id').eq('lo_id', lo1.id), () => cv2.from('lo_nhap').select('id').eq('id', lo1.id),
      () => tp.from('dong_nhap').select('so_dong').eq('lo_id', lo1.id), () => cv1.from('tu_dien_nhap').select('goc').limit(5),
    ]);
    assert.deepEqual(dCv1.data.map((x) => x.so_dong), [4, 6], 'chủ trì / theo dõi: dòng có việc của mình'); assert.equal(dCv1.data[0].du_lieu_goc.STT, '1');
    assert.equal(lCv1.data.length, 1, 'thấy mã lô của việc mình');
    assert.equal(dCv2.data.length, 0); assert.equal(lCv2.data.length, 0); assert.equal(tdCv1.data.length, 0);
    assert.ok(dTp.data.some((x) => x.so_dong === 4), 'Trưởng phòng thấy dòng của việc phòng mình');
    assert.ok(!dTp.data.some((x) => [5, 7, 8].includes(x.so_dong)), 'dòng chờ (chưa có việc) chỉ người nhập thấy');
    const qt = await userClient('demo_qtht');
    assertDenied(await qt.from('dong_nhap').update({ ket_qua: 'DA_BO' }).eq('lo_id', lo1.id).select('id'), 'người nhập sửa thẳng dòng nhập');
    assert.equal((await qt.from('dong_nhap').select('id').eq('lo_id', lo1.id)).data.length, 5, 'người nhập thấy cả dòng chờ');
    const sua = await goi('demo_qtht', 'sua_thong_tin_giao', { p_id: kq1[4].nhiem_vu_id, p_thay_doi: { do_khan: 'HOA_TOC' }, p_ly_do: `${KHOA} thử` });
    assertDenied(sua, 'người nhập (gõ thay, không phải lãnh đạo, không giữ quan_tri_kl) không là tầng giao của việc mình nhập');
  });

  test('4. hoàn thiện dòng chờ bằng giao_viec + dong_nhap_id (chỉ người nhập, một lần); bỏ dòng chờ', async () => {
    const p = { dong_nhap_id: dong5.id, van_ban_id: (await viec(kq1[4].nhiem_vu_id)).van_ban_id, noi_dung: `${KHOA} thiếu sản phẩm (đã hoàn thiện)`,
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.truongphong, loai_thoi_han_ma: 'CO_HAN_CU_THE',
      han_xu_ly: HAN, san_pham_loai: 'TO_TRINH', nguon_nhiem_vu_ma: 'VAN_BAN_CAN_THEO_DOI', ...LV };
    assertDenied(await goi('demo_cv1', 'giao_viec', { p }), 'chủ trì không phải người nhập hoàn thiện dòng');
    const ok = await goi('demo_qtht', 'giao_viec', { p });
    assertOk(ok, 'qtht hoàn thiện');
    const d = (await db().from('dong_nhap').select('ket_qua, nhiem_vu_id').eq('id', dong5.id).single()).data;
    assert.equal(d.ket_qua, 'DA_HOAN_THIEN'); assert.equal(d.nhiem_vu_id, ok.data.id);
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', ok.data.id).eq('cot', 'nhap_excel')).data;
    assert.match(ls[0]?.gia_tri_moi || '', new RegExp(`Hoàn thiện dòng 5 của lô nhập Excel ${lo1.ma}`));
    const lan2 = await goi('demo_qtht', 'giao_viec', { p: { ...p, noi_dung: `${KHOA} lần hai` } });
    assert.ok(lan2.error); assert.match(lan2.error.message, /Dòng chờ hoàn thiện không còn/);
    assertDenied(await goi('demo_cv1', 'dong_nhap_bo', { p_id: dong8.id }), 'chủ trì bỏ dòng');
    assertOk(await goi('demo_qtht', 'dong_nhap_bo', { p_id: dong8.id }), 'qtht bỏ dòng');
    assert.match((await goi('demo_qtht', 'dong_nhap_bo', { p_id: dong8.id })).error?.message || '', /không còn ở vùng chờ/);
  });

  test('5. quản trị nhiệm vụ (cv2) nhập lô 2 CHO_NGHIEM_THU: việc xong đủ 4 yếu tố → chờ nghiệm thu; cập nhật việc có sẵn theo mã (hạn chỉ báo)', async () => {
    assertOk(await db().from('accounts').update({ quan_tri_kl: true }).eq('id', IDS.cv2), 'cấp tạm quan_tri_kl cho cv2');
    const tao = await goi('demo_cv2', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-mau-chuan.xlsx`, mau: 'CHUAN', che_do_xong: 'CHO_NGHIEM_THU', so_dong: 4 } });
    assertOk(tao, 'cv2 mở lô'); lo2 = tao.data;
    const r = await goi('demo_cv2', 'nhap_excel_dong', { p_lo: lo2.id, p_dong: [
      { so_dong: 2, loai_van_ban: 'CONG_VAN', so_ket_luan: `${KHOA}/CV`, ngay_ban_hanh: BH, noi_dung: `${KHOA} chờ nghiệm thu`, owner_don_vi_ma: 'TONG_HOP',
        owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.truongphong, han_xu_ly: HAN, san_pham_loai: 'BAO_CAO', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH',
        tien_do_ma: 'HOAN_THANH', kq_so_hieu: '45/BC-VPTU', kq_ngay: KQ, kq_trich_yeu: 'Báo cáo kết quả', kq_mo_ta: 'Đã trình Chánh Văn phòng' },
      { so_dong: 3, ma: coSan.ma.toLowerCase(), cap_nhat: true, san_pham_loai: 'TO_TRINH', han_xu_ly: cong(HAN, -10), noi_dung: `${KHOA} việc có sẵn` },
      { so_dong: 4, ma: coSan.ma, do_khan: 'THUONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', noi_dung: `${KHOA} việc có sẵn` },
      { so_dong: 5, ma: coSan.ma, cap_nhat: true, do_khan: 'HOA_TOC' },
    ] });
    assertOk(r, 'nhập lô 2');
    assert.deepEqual(r.data.map((x) => x.ket_qua), ['CHO_NGHIEM_THU', 'CAP_NHAT', 'BO_QUA', 'BO_QUA']);
    assert.match(r.data[1].ghi_chu, /Không đổi qua nhập Excel: hạn hoàn thành \(dùng Gia hạn\)/);
    assert.match(r.data[2].ghi_chu, /bản xem trước coi là việc mới/, 'mã có sẵn mà xem trước coi là việc mới: không ghi đè');
    assert.match(r.data[3].ghi_chu, /Mã việc trùng với một dòng trước/, 'một mã chỉ cập nhật một lần mỗi lô (hoàn tác trả đúng giá trị gốc)');
    const mc = (await db().from('minh_chung').select('loai, hop_le, nop_boi, so_hieu').eq('nhiem_vu_id', r.data[0].nhiem_vu_id)).data;
    assert.deepEqual(mc, [{ loai: 'so_hieu', hop_le: null, nop_boi: IDS.cv1, so_hieu: '45/BC-VPTU' }]);
    assert.equal((await db().from('v_nhiem_vu').select('trang_thai').eq('id', r.data[0].nhiem_vu_id).single()).data.trang_thai, 'CHO_NGHIEM_THU');
    const v = await viec(coSan.id);
    assert.equal(v.san_pham_loai, 'TO_TRINH'); assert.equal(v.han_xu_ly, HAN, 'hạn không đổi qua nhập Excel');
    assert.deepEqual((await dongCua(lo2.id))[1].gia_tri_cu, { san_pham_loai: 'BAO_CAO' });
    assert.equal(v.do_khan, 'THUONG', 'dòng bỏ qua không đổi độ khẩn');
    assertOk(await goi('demo_cv2', 'nhap_excel_lo_xong', { p_lo: lo2.id }), 'chốt lô 2');
    const tin = (await db().from('direct_messages').select('content').eq('receiver_id', IDS.cv1).like('content', `Nhập Excel · lô ${lo2.ma} (%`)).data;
    assert.equal(tin.length, 1); assert.match(tin[0].content, new RegExp(`1 việc đồng chí chủ trì / theo dõi được cập nhật thông tin \\(${coSan.ma}\\)`));
  });

  test('6. hoàn tác: chỉ người nhập lô / quản trị hệ thống; việc đã có thao tác giữ lại; cập nhật trả giá trị cũ; một lần; quá 24 giờ chặn', async () => {
    assertOk(await goi('demo_cv1', 'xac_nhan_nhan_viec', { p_id: kq1[4].nhiem_vu_id }), 'chủ trì xác nhận đã nhận việc dòng 4 (đã thao tác)');
    const chan = await goi('demo_cv2', 'hoan_tac_lo', { p_lo: lo1.id });
    assertDenied(chan, 'quản trị nhiệm vụ hoàn tác lô người khác'); assert.match(chan.error.message, /Chỉ người nhập lô hoặc quản trị hệ thống/);
    assertDenied(await goi('demo_cv1', 'hoan_tac_lo', { p_lo: lo1.id }), 'chủ trì hoàn tác');
    const h1 = await goi('demo_qtht', 'hoan_tac_lo', { p_lo: lo1.id });
    assertOk(h1, 'qtht hoàn tác lô 1'); assert.deepEqual(h1.data, { hoan_tac: 1, giu_lai: [kq1[4].ma] });
    assert.deepEqual((await dongCua(lo1.id)).map((d) => [d.so_dong, d.ket_qua, Boolean(d.nhiem_vu_id)]),
      [[4, 'GIAO', true], [5, 'DA_HOAN_THIEN', true], [6, 'DA_HOAN_TAC', false], [7, 'DA_HOAN_TAC', false], [8, 'DA_BO', false]]);
    assert.equal(await viec(kq1[6].nhiem_vu_id), null, 'việc đã xong ngoài hệ thống (chưa ai đụng) bị xoá');
    assert.equal((await db().from('van_ban_giao_viec').select('id').eq('so_ket_luan', `${KHOA}/KL`)).data.length, 1, 'văn bản còn việc → giữ');
    const h2 = await goi('demo_qtht', 'hoan_tac_lo', { p_lo: lo2.id });
    assertOk(h2, 'qtht hoàn tác lô của cv2'); assert.deepEqual(h2.data, { hoan_tac: 2, giu_lai: [] });
    assert.equal((await viec(coSan.id)).san_pham_loai, 'BAO_CAO', 'cập nhật trả giá trị cũ');
    assert.equal((await db().from('van_ban_giao_viec').select('id').eq('so_ket_luan', `${KHOA}/CV`)).data.length, 0, 'văn bản lô tạo, không còn việc → xoá');
    assert.match((await goi('demo_cv2', 'hoan_tac_lo', { p_lo: lo2.id })).error?.message || '', /đã hoàn tác/);
    const lo3 = (await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-cu.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 1 } })).data;
    assertOk(await db().from('lo_nhap').update({ tao_luc: new Date(Date.now() - 25 * 3600e3).toISOString() }).eq('id', lo3.id), 'lùi giờ tạo lô 3');
    assert.match((await goi('demo_qtht', 'hoan_tac_lo', { p_lo: lo3.id })).error?.message || '', /quá 24 giờ/);
    // Khoá văn bản do client gửi kèm dòng bị bỏ (chỉ máy chủ ghi van_ban_id / van_ban_moi): hoàn tác không xoá được văn bản người khác.
    const rong = (await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA}/RONG`, ngay_ban_hanh: BH, tao_boi: IDS.cvp }).select('id').single()).data;
    const lo4 = (await goi('demo_qtht', 'nhap_excel_lo_tao', { p: { ten_tep: `${KHOA}-gia.xlsx`, mau: 'TU_GHEP', che_do_xong: 'DA_XONG_NGOAI', so_dong: 2 } })).data;
    const r4 = await goi('demo_qtht', 'nhap_excel_dong', { p_lo: lo4.id, p_dong: [{ so_dong: 1, noi_dung: `${KHOA} gài`, thieu: ['san_pham'], van_ban_id: rong.id, van_ban_moi: true },
      { so_dong: 2, ...VB1, noi_dung: `${KHOA} xong, lãnh đạo giao là chuyên viên`, owner_don_vi_ma: 'DANG_UY_UBND', nguoi_theo_doi: IDS.cv1, thay_mat_cho: IDS.cv1,
        tien_do_ma: 'HOAN_THANH' }] });
    assertOk(r4, 'lô 4'); assert.deepEqual(r4.data.map((x) => x.ket_qua), ['CHO_HOAN_THIEN', 'CHO_HOAN_THIEN']);
    assert.match(r4.data[1].ghi_chu, /Lãnh đạo giao phải là lãnh đạo Văn phòng hoặc Trưởng phòng/);
    assert.equal((await dongCua(lo4.id))[0].du_lieu.van_ban_id, undefined, 'không lưu khoá văn bản client gửi');
    assertOk(await goi('demo_qtht', 'hoan_tac_lo', { p_lo: lo4.id }), 'hoàn tác lô 4');
    assert.equal((await db().from('van_ban_giao_viec').select('id').eq('id', rong.id)).data.length, 1, 'văn bản không do lô tạo vẫn còn');
  });

  test('7. từ điển (chuẩn hoá giá trị gốc, kiểm mã đích), hồ sơ ghép cột (ghi đè theo tên, chỉ trường chuẩn), tra mã việc', { skip: CHI_CUC_BO }, async () => {
    const td = await goi('demo_qtht', 'tu_dien_nhap_luu', { p_muc: [{ loai: 'don_vi', goc: `  ${KHOA}   UBND `, ma: 'DANG_UY_UBND' },
      { loai: 'can_bo', goc: `${KHOA} vptu`, ma: IDS.truongphong }] });
    assertOk(td, 'lưu từ điển'); assert.equal(td.data, 2);
    const doc = (await (await userClient('demo_qtht')).from('tu_dien_nhap').select('loai, goc, ma').like('goc', `${KHOA.toLowerCase()}%`).order('loai')).data;
    assert.deepEqual(doc.map((x) => [x.loai, x.goc, x.ma]), [['can_bo', `${KHOA.toLowerCase()} vptu`, IDS.truongphong], ['don_vi', `${KHOA.toLowerCase()} ubnd`, 'DANG_UY_UBND']]);
    for (const muc of [{ loai: 'don_vi', goc: `${KHOA} sai`, ma: 'KHONG_CO' }, { loai: 'can_bo', goc: `${KHOA} he thong`, ma: '00000000-0000-4000-8000-000000000007' },
      { loai: 'khac', goc: `${KHOA} la`, ma: 'X' }]) {
      assert.match((await goi('demo_qtht', 'tu_dien_nhap_luu', { p_muc: [muc] })).error?.message || '', /Mục từ điển không hợp lệ/, JSON.stringify(muc));
    }
    const hs = { p_ten: `${KHOA} Phụ lục 2 (thử)`, p_ten_sheet: 'Phụ lục 2', p_dong_tieu_de: 3, p_anh_xa: { 'so tb/kl': 'so_ket_luan', 'noi dung': 'noi_dung' } };
    const h1 = await goi('demo_qtht', 'ho_so_nhap_luu', hs); assertOk(h1, 'lưu hồ sơ');
    const h2 = await goi('demo_cv2', 'ho_so_nhap_luu', { ...hs, p_dong_tieu_de: 4 }); assertOk(h2, 'người nhập khác ghi đè cùng tên');
    assert.equal(h2.data, h1.data);
    assert.match((await goi('demo_qtht', 'ho_so_nhap_luu', { ...hs, p_anh_xa: { a: 'truong_la' } })).error?.message || '', /không có trong chuẩn nhập/);
    assertOk(await goi('demo_qtht', 'ho_so_nhap_xoa', { p_id: h1.data }), 'xoá hồ sơ');
    const ma = await goi('demo_qtht', 'kl_nhap_ma_da_co', { p_ma: [` ${coSan.ma.toLowerCase()} `, 'NV-KHONG-CO-0072'] });
    assertOk(ma, 'tra mã'); assert.deepEqual(ma.data, [coSan.ma.toUpperCase()]);
  });
});
