// Xuất Excel (PR-3 G): cột TƯỜNG MINH, giá trị đọc từ chính dòng v_nhiem_vu đang hiện (RLS đã giới hạn — A3 chỉ xuất việc của mình).
// Nạp động cùng lib/xlsx.js khi bấm nút (không tăng bundle lúc mở app). Tên tệp theo ngày Việt Nam: vptu-nhiem-vu-<yyyymmdd>.xlsx,
// vptu-bao-cao-<yyyymmdd>.xlsx.
import { taoXlsx, taiXuong } from '../xlsx.js';
import { DEPT_NAMES } from '../constants.js';
import { homNayVN } from './ngay.js';
import { tenNhom, tenChatLuong, tenTienDoHoanThanh, boSoThuTu } from './nhan.js';

const ngayTep = () => homNayVN().replace(/-/g, '');
const chuTri = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '';
const phong = (r) => DEPT_NAMES[r.owner_phong] || r.owner_phong || (r.owner_trong_van_phong === false ? 'Đơn vị ngoài Văn phòng' : '');
const sanPham = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
const trangThai = (r) => `${tenNhom(r.nhom_dem)}${r.so_ngay_qua ? ` (trễ ${r.so_ngay_qua} ngày)` : ''}`;

// 15 cột màn Nhiệm vụ (thứ tự theo prompt PR-3).
export const COT_NHIEM_VU = [
  { nhan: 'Mã', rong: 10, gt: (r) => r.ma },
  { nhan: 'Nội dung', rong: 60, gt: (r) => r.noi_dung },
  { nhan: 'Văn bản', rong: 22, gt: (r) => r.so_ket_luan || '' },
  { nhan: 'Nguồn nhiệm vụ', rong: 24, gt: (r) => r.nguon_nhiem_vu_ten || '' },
  { nhan: 'Chủ trì', rong: 26, gt: chuTri },
  { nhan: 'Người theo dõi', rong: 22, gt: (r) => r.nguoi_theo_doi_ten || '' },
  { nhan: 'Phòng', rong: 22, gt: phong },
  { nhan: 'Hạn hoàn thành', rong: 13, kieu: 'ngay', gt: (r) => r.han_xu_ly },
  { nhan: 'Hạn nộp minh chứng', rong: 13, kieu: 'ngay', gt: (r) => r.han_nop_hieu_luc || r.han_nop_minh_chung },
  { nhan: 'Trạng thái', rong: 24, gt: trangThai },
  { nhan: 'Chất lượng', rong: 13, gt: (r) => tenChatLuong(r.chat_luong) },
  { nhan: 'Tiến độ hoàn thành', rong: 18, gt: tenTienDoHoanThanh },
  { nhan: 'Vướng mắc', rong: 40, gt: (r) => r.vuong_mac || '' },
  { nhan: 'Sản phẩm', rong: 30, gt: sanPham },
  { nhan: 'Cấp nhận', rong: 20, gt: (r) => r.cap_nhan_san_pham_ten || '' },
];
const bang = (ten, cot, rows) => ({ ten, cot, dong: rows.map((r) => cot.map((c) => c.gt(r))) });

// Đúng danh sách đang hiện sau bộ lọc (thứ tự giữ nguyên).
export function xuatNhiemVu(rows) {
  const ten = `vptu-nhiem-vu-${ngayTep()}.xlsx`;
  taiXuong(ten, taoXlsx([bang('Nhiệm vụ', COT_NHIEM_VU, rows)]));
  return ten;
}

// Báo cáo A1: bảng theo phòng / đơn vị + bảng theo nguồn (mỗi bảng: { cot: [tên cột], dong: [[...]] } đã tính ở màn Báo cáo) + danh sách Đỏ.
export function xuatBaoCao({ theoPhong, theoNguon, rowsDo }) {
  const tuBang = (ten, b) => ({ ten, cot: b.cot.map((nhan, i) => ({ nhan, rong: i === 0 ? 40 : 12 })), dong: b.dong });
  const ten = `vptu-bao-cao-${ngayTep()}.xlsx`;
  taiXuong(ten, taoXlsx([tuBang('Theo phòng', theoPhong), tuBang('Theo nguồn', theoNguon), bang('Danh sách Đỏ', COT_NHIEM_VU, rowsDo)]));
  return ten;
}
