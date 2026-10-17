// Quản trị › Thống kê sử dụng (0104, v3.24; chỉ quản trị hệ thống — quyền thật ở hàm qt_thong_ke_* và RLS của nhat_ky_dang_nhap): chọn phần
// Đăng nhập / Nhiệm vụ nhập mới; chỉ phần đang mở được nạp (mở khu, bấm Tải lại hoặc đổi phần thì nạp lại phần đó).
import { $, show } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { renderThongKeDangNhap, hanhDongDangNhap, ganLocDangNhap } from './thong-ke-dang-nhap.js';
import { renderThongKeNhapMoi, hanhDongNhapMoi, ganLocNhapMoi } from './thong-ke-nhap-moi.js';

const PHAN = {
  'dang-nhap': { khu: 'tkPhanDangNhap', nut: 'tkNutDangNhap', ve: renderThongKeDangNhap },
  'nhap-moi': { khu: 'tkPhanNhapMoi', nut: 'tkNutNhapMoi', ve: renderThongKeNhapMoi },
};
let phanDangMo = 'dang-nhap';

export function renderThongKe() {
  Object.entries(PHAN).forEach(([k, p]) => { show(p.khu, k === phanDangMo); $(p.nut).setAttribute('aria-pressed', String(k === phanDangMo)); });
  return PHAN[phanDangMo].ve();
}

export function mountThongKe() {
  ganLocDangNhap();
  ganLocNhapMoi();
  registerActions({
    tkChonPhan: ({ phan }) => { if (PHAN[phan]) { phanDangMo = phan; renderThongKe(); } },
    ...hanhDongDangNhap,
    ...hanhDongNhapMoi,
  });
}
