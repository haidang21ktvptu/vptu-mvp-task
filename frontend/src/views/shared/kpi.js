// KPI theo nhóm cán bộ từ dòng v_nhiem_vu (GĐ14, CH-2): số ĐÁNH GIÁ tính theo owner_tai_khoan (đang mở / quá hạn /
// đỏ đặc biệt / hoàn thành); việc chỉ THEO DÕI (nguoi_theo_doi thuộc nhóm, Owner không thuộc nhóm) đếm riêng, không cộng vào.
// Màu/mức từ hàm trang_thai (muc_canh_bao, nhom_dem) — frontend không tự tính hạn.
import { state } from '../../lib/state.js';

const DA_DONG = (r) => r.tien_do_ma === 'HOAN_THANH';

export function calculateGroupKPI(staffIds, rows = state.nhiemVu) {
  const kpi = { owner: 0, dangMo: 0, quaHan: 0, doDacBiet: 0, hoanThanh: 0, theoDoi: 0 };
  const trong = (id) => Boolean(id) && staffIds.includes(id);
  rows.forEach((r) => {
    if (trong(r.owner_tai_khoan)) {
      kpi.owner++;
      if (DA_DONG(r)) kpi.hoanThanh++;
      else {
        kpi.dangMo++;
        if (r.muc_canh_bao === 'DO' || r.muc_canh_bao === 'DO_DAC_BIET') kpi.quaHan++;
        if (r.muc_canh_bao === 'DO_DAC_BIET') kpi.doDacBiet++;
      }
    } else if (trong(r.nguoi_theo_doi) && !DA_DONG(r)) kpi.theoDoi++;
  });
  return kpi;
}
