// KPI theo nhóm cán bộ từ dòng v_nhiem_vu (GĐ14, CH-2): số ĐÁNH GIÁ tính theo Owner — owner_tai_khoan thuộc nhóm, hoặc
// (khi nhóm là một phòng, phongMa) Owner là chính phòng đó (owner_tai_khoan NULL, owner_don_vi_ma = phongMa) — gồm
// đang mở / quá hạn / đỏ đặc biệt / hoàn thành; việc chỉ THEO DÕI (nguoi_theo_doi thuộc nhóm, Owner không thuộc nhóm) đếm
// riêng, không cộng vào. Màu/mức từ hàm trang_thai (muc_canh_bao) — frontend không tự tính hạn.
// PR-2b (Mới 2): "Đỏ" (quá hạn, đỏ đặc biệt) tính cho người / phòng CHỊU CHẬM do DB tính (nguoi_chiu_cham, phong_chiu_cham): việc quá hạn ở bước
// nghiệm thu thuộc lãnh đạo nghiệm thu, không thuộc chủ trì hay phòng chủ trì.
import { state } from '../../lib/state.js';

const DA_DONG = (r) => r.tien_do_ma === 'HOAN_THANH';
export const laOwnerPhong = (r, phongMa) => Boolean(phongMa) && !r.owner_tai_khoan && r.owner_don_vi_ma === phongMa;

export function calculateGroupKPI(staffIds, rows = state.nhiemVu, phongMa = null) {
  const kpi = { owner: 0, dangMo: 0, quaHan: 0, doDacBiet: 0, hoanThanh: 0, theoDoi: 0 };
  const trong = (id) => Boolean(id) && staffIds.includes(id);
  rows.forEach((r) => {
    if (trong(r.owner_tai_khoan) || laOwnerPhong(r, phongMa)) {
      kpi.owner++;
      if (DA_DONG(r)) kpi.hoanThanh++;
      else kpi.dangMo++;
    } else if (trong(r.nguoi_theo_doi) && !DA_DONG(r)) kpi.theoDoi++;
    if (!DA_DONG(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao) && (trong(r.nguoi_chiu_cham) || (Boolean(phongMa) && r.phong_chiu_cham === phongMa))) {
      kpi.quaHan++;
      if (r.muc_canh_bao === 'DO_DAC_BIET') kpi.doDacBiet++;
    }
  });
  return kpi;
}
