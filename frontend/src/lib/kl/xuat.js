// Xuất Excel (PR-3 G): cột TƯỜNG MINH, giá trị đọc từ chính dòng v_nhiem_vu đang hiện (RLS đã giới hạn — A3 chỉ xuất việc của mình).
// Nạp động cùng lib/xlsx.js khi bấm nút (không tăng bundle lúc mở app). Tên tệp theo ngày Việt Nam: vptu-nhiem-vu-<yyyymmdd>.xlsx,
// vptu-bao-cao-<yyyymmdd>.xlsx.
import { taoXlsx, taiXuong } from '../xlsx.js';
import { DEPT_NAMES } from '../constants.js';
import { homNayVN } from './ngay.js';
import { tenNhom, tenChatLuong, tenTienDoHoanThanh, boSoThuTu } from './nhan.js';
import { ngayGiao } from './tong-quan.js';
import { phanLoaiTheoKy, tongHopTheoKy } from './ky.js';

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

// v3.16: xuất theo kỳ (tuần / tháng / quý / năm — lib/kl/ky.js). k = khoangKyChon(...); rows = toàn bộ việc trong phạm vi (hoặc danh sách đang lọc).
// 6 sheet: Kỳ (thông tin), Tổng hợp theo phòng / đơn vị, Giao trong kỳ, Hoàn thành trong kỳ, Đến hạn trong kỳ, Còn mở cuối kỳ (15 cột + Ngày giao, Ngày hoàn thành).
const COT_KY = [COT_NHIEM_VU[0], { nhan: 'Ngày giao', rong: 13, kieu: 'ngay', gt: ngayGiao }, { nhan: 'Ngày hoàn thành', rong: 13, kieu: 'ngay', gt: (r) => r.ngay_hoan_thanh || '' }, ...COT_NHIEM_VU.slice(1)];
export function xuatTheoKy(rows, k, { phamVi = 'Toàn bộ việc trong phạm vi', nguoi = '' } = {}) {
  const pl = phanLoaiTheoKy(rows, k); const th = tongHopTheoKy(rows, k);
  const thongTin = [['Kỳ', k.ten], ['Từ ngày', k.tu], ['Đến ngày', k.den], ['Phạm vi', phamVi], ['Người xuất', nguoi], ['Xuất lúc', new Date().toLocaleString('vi-VN')],
    ['Quy ước', 'Giao = ngày giao nhiệm vụ (hoặc ngày ban hành, ngày tạo); Hoàn thành = ngày hoàn thành; Đến hạn = hạn hoàn thành; Còn mở cuối kỳ = giao không sau ngày cuối kỳ và chưa xong (hoặc xong sau kỳ); Quá hạn = hạn trước ngày cuối kỳ.']];
  const ten = `vptu-nhiem-vu-${k.ma}.xlsx`;
  taiXuong(ten, taoXlsx([
    { ten: 'Kỳ', cot: [{ nhan: 'Mục', rong: 14 }, { nhan: 'Giá trị', rong: 110 }], dong: thongTin },
    { ten: 'Tổng hợp', cot: th.cot.map((nhan, i) => ({ nhan, rong: i === 0 ? 36 : 14 })), dong: th.dong },
    bang('Giao trong kỳ', COT_KY, pl.giao), bang('Hoàn thành trong kỳ', COT_KY, pl.xong), bang('Đến hạn trong kỳ', COT_KY, pl.denHan), bang('Còn mở cuối kỳ', COT_KY, pl.mo),
  ]));
  return { ten, so: { giao: pl.giao.length, xong: pl.xong.length, denHan: pl.denHan.length, mo: pl.mo.length } };
}
