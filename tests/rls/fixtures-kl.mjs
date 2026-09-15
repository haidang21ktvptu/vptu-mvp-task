// Dữ liệu mẫu module KL BTVTU (GĐ8), tạo bằng service_role, dọn ở zz-teardown và đầu lần chạy sau.
// Hội nghị 999 (ngày ban hành 01/08/2026) và 7 nhiệm vụ phủ đủ nhánh của kl_trang_thai (Phần 2.2):
//   N1 cv1 (TONG_HOP)  Có hạn cụ thể, hạn 15/08, đang làm        → QUA_HAN (tại 14/09: 30 ngày)
//   N2 cv1             Có hạn cụ thể, hạn 20/08, Hoàn thành 25/08 → HOAN_THANH, ket_qua TRE 5 ngày
//   N3 truongphong (A2) Ký ban hành, hạn nhập tay 31/12 bị ghi đè → hạn = 11/08 → QUA_HAN
//   N4 cv2 (QUAN_TRI)  Có hạn cụ thể, không hạn, có lý do       → CAN_DIEN_HAN (khác phòng để test ranh giới)
//   N5 cv1             Chờ quyết định, không hạn                 → CHO_DIEU_KIEN
//   N6 cv1             Thường xuyên (có hạn 15/08 vẫn là TX)     → THUONG_XUYEN
//   N7 cv1             Excel, Hoàn thành, không ngày, không hạn  → HOAN_THANH, ket_qua KHONG_DANH_GIA
//   Lĩnh vực (0018, cho rls-11): N1, N3, N4 = LV08_TAI_CHINH; N2 = LV08_DAU_TU; N5–N7 NULL (thuộc PCVP phụ trách phòng).
//   D1: chỉ đạo của truongphong trên N1.
import { adminClient, IDS } from './lib.mjs';

export const SO_HOI_NGHI_TEST = 999;
const NGAY_BH = '2026-08-01';

let cached = null;
export function setupKlFixtures() {
  if (!cached) cached = createKlFixtures();
  return cached;
}

// Trên staging trước khi merge 0014–0016 chưa có bảng → trả về null để test tự bỏ qua.
export async function klSchemaReady() {
  const r = await adminClient().from('kl_nhiem_vu').select('id').limit(1);
  return !r.error;
}
// Trên staging trước khi merge 0018 chưa có dm_linh_vuc → fixture bỏ cột linh_vuc_ma, rls-11 tự bỏ qua.
export async function linhVucReady() {
  const r = await adminClient().from('dm_linh_vuc').select('ma').limit(1);
  return !r.error;
}

async function createKlFixtures() {
  const db = adminClient();
  await teardownKlFixtures();

  const { data: hn, error: e1 } = await db.from('kl_hoi_nghi')
    .insert({ so_hoi_nghi: SO_HOI_NGHI_TEST, so_ket_luan: 'RLS-TEST', ngay_ban_hanh: NGAY_BH }).select('id').single();
  if (e1) throw new Error(`Tạo hội nghị mẫu thất bại: ${e1.message}`);

  const base = { hoi_nghi_id: hn.id, nganh_ma: 'KINH_TE_TONG_HOP', co_quan_trinh_ma: 'DANG_UY_UBND' };
  const rows = [
    { ...base, ma: 'NV-T01', chu_tri_id: IDS.cv1, noi_dung: 'RLS-TEST N1 quá hạn', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-15', linh_vuc_ma: 'LV08_TAI_CHINH' },
    { ...base, ma: 'NV-T02', chu_tri_id: IDS.cv1, noi_dung: 'RLS-TEST N2 hoàn thành trễ', loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-08-20', linh_vuc_ma: 'LV08_DAU_TU',
      tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-25', minh_chung: 'Công văn 12/CV-VPTU' },
    { ...base, ma: 'NV-T03', chu_tri_id: IDS.truongphong, noi_dung: 'RLS-TEST N3 ký ban hành', loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: '2026-12-31', linh_vuc_ma: 'LV08_TAI_CHINH' },
    { ...base, ma: 'NV-T04', chu_tri_id: IDS.cv2, noi_dung: 'RLS-TEST N4 cần điền hạn', loai_thoi_han_ma: 'CO_HAN_CU_THE', ly_do_chua_co_han: 'Phụ thuộc yếu tố bên ngoài', linh_vuc_ma: 'LV08_TAI_CHINH' },
    { ...base, ma: 'NV-T05', chu_tri_id: IDS.cv1, noi_dung: 'RLS-TEST N5 chờ điều kiện', loai_thoi_han_ma: 'CHO_QUYET_DINH' },
    { ...base, ma: 'NV-T06', chu_tri_id: IDS.cv1, noi_dung: 'RLS-TEST N6 thường xuyên', loai_thoi_han_ma: 'THUONG_XUYEN', han_xu_ly: '2026-08-15' },
    { ...base, ma: 'NV-T07', chu_tri_id: IDS.cv1, noi_dung: 'RLS-TEST N7 excel không ngày', loai_thoi_han_ma: 'CO_HAN_CU_THE',
      tien_do_ma: 'HOAN_THANH', nguon: 'excel', cap_nhat_luc: '2026-09-01T18:03:00+07:00' },
  ];
  if (!(await linhVucReady())) rows.forEach((r) => delete r.linh_vuc_ma);
  // defaultToNull: false — khoá thiếu ở một số dòng (tien_do_ma, nguon...) lấy DEFAULT của bảng thay vì NULL.
  const { data: nv, error: e2 } = await db.from('kl_nhiem_vu').insert(rows, { defaultToNull: false }).select('id, ma');
  if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
  const id = (ma) => nv.find((r) => r.ma === ma).id;

  const { data: d1, error: e3 } = await db.from('kl_chi_dao')
    .insert({ nhiem_vu_id: id('NV-T01'), nguoi_gui: IDS.truongphong, loai: 'DON_DOC', noi_dung: 'RLS-TEST D1', han_phan_hoi: '2026-09-16' })
    .select('id').single();
  if (e3) throw new Error(`Tạo chỉ đạo mẫu thất bại: ${e3.message}`);

  return { hn: hn.id, n1: id('NV-T01'), n2: id('NV-T02'), n3: id('NV-T03'), n4: id('NV-T04'), n5: id('NV-T05'), n6: id('NV-T06'), n7: id('NV-T07'), d1: d1.id };
}

export async function teardownKlFixtures() {
  const db = adminClient();
  const { data: hns } = await db.from('kl_hoi_nghi').select('id').in('so_hoi_nghi', [SO_HOI_NGHI_TEST, SO_HOI_NGHI_TEST - 1]);
  const ids = (hns || []).map((h) => h.id);
  if (ids.length === 0) return;
  // kl_lich_su / kl_chi_dao / kl_dinh_chinh xoá theo FK ON DELETE CASCADE từ kl_nhiem_vu; hội nghị xoá sau.
  await db.from('kl_nhiem_vu').delete().in('hoi_nghi_id', ids);
  await db.from('kl_hoi_nghi').delete().in('id', ids);
}
