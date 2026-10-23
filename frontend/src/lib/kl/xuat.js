// Xuất Excel (PR-3 G): cột TƯỜNG MINH, giá trị đọc từ chính dòng v_nhiem_vu đang hiện (RLS đã giới hạn — A3 chỉ xuất việc của mình).
// Nạp động cùng lib/xlsx.js khi bấm nút (không tăng bundle lúc mở app). Tên tệp theo ngày Việt Nam: vptu-nhiem-vu-<yyyymmdd>.xlsx;
// Báo cáo theo kỳ: vptu-bao-cao-<ngày xuất>_<từ ngày>-<đến ngày>.xlsx (tenTepBaoCao).
import { taoXlsx, taiXuong } from '../xlsx.js';
import { DEPT_NAMES } from '../constants.js';
import { homNayVN, formatNgay } from './ngay.js';
import { tenNhom, tenChatLuong, tenTienDoHoanThanh, boSoThuTu } from './nhan.js';
import { ngayGiao } from './tong-quan.js';
import { phanLoaiTheoKy, tongHopTheoKy } from './ky.js';
import { maTheoNguon } from './ma-nguon.js';

const ngayTep = () => homNayVN().replace(/-/g, '');
const chuTri = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '';   // phòng ở cột "Phòng" bên cạnh
const phong = (r) => DEPT_NAMES[r.owner_phong] || r.owner_phong || (r.owner_trong_van_phong === false ? 'Đơn vị ngoài Văn phòng' : '');
const sanPham = (r) => (r.san_pham_ten ? `${r.san_pham_ten}${r.san_pham_mo_ta ? `: ${r.san_pham_mo_ta}` : ''}` : '');
const trangThai = (r) => `${tenNhom(r.nhom_dem)}${r.so_ngay_qua ? ` (trễ ${r.so_ngay_qua} ngày)` : ''}`;

// Cột màn Nhiệm vụ (thứ tự theo prompt PR-3; C2 thêm 4 cột nguồn ở cuối; v3.31 — 0128: bỏ cột "Người theo dõi", chỉ còn "Chủ trì theo dõi").
export const COT_NHIEM_VU = [
  { nhan: 'Mã nhiệm vụ', rong: 12, gt: (r) => r.ma },
  { nhan: 'Nội dung kết luận / Văn bản trình', rong: 60, gt: (r) => r.noi_dung },
  { nhan: 'Số TB/KL', rong: 22, gt: (r) => r.so_ket_luan || '' },
  { nhan: 'Nguồn nhiệm vụ', rong: 24, gt: (r) => r.nguon_nhiem_vu_ten || '' },
  { nhan: 'Chủ trì theo dõi', rong: 26, gt: chuTri },
  { nhan: 'Phòng', rong: 22, gt: phong },
  { nhan: 'Hạn xử lý', rong: 13, kieu: 'ngay', gt: (r) => r.han_xu_ly },
  { nhan: 'Trạng thái', rong: 24, gt: trangThai },
  { nhan: 'Chất lượng', rong: 13, gt: (r) => tenChatLuong(r.chat_luong) },
  { nhan: 'Tiến độ hoàn thành', rong: 18, gt: tenTienDoHoanThanh },
  { nhan: 'Vướng mắc', rong: 40, gt: (r) => r.vuong_mac || '' },
  { nhan: 'Sản phẩm đầu ra', rong: 30, gt: sanPham },
  { nhan: 'Cấp nhận sản phẩm', rong: 20, gt: (r) => r.cap_nhan_san_pham_ten || '' },
  // Đợt C2 (0087): thêm cuối — mẫu cũ đọc theo tên cột không lệch
  { nhan: 'Mã theo nguồn', rong: 20, gt: maTheoNguon },
  { nhan: 'Mức quan trọng', rong: 12, gt: (r) => r.muc_quan_trong || '' },
  { nhan: 'Cơ quan/đơn vị trình', rong: 28, gt: (r) => boSoThuTu(r.co_quan_trinh_ten) || '' },
  { nhan: 'Thường trực chỉ đạo', rong: 24, gt: (r) => r.thuong_truc_chi_dao_ten || '' },
];
const bang = (ten, cot, rows) => ({ ten, cot, dong: rows.map((r) => cot.map((c) => c.gt(r))) });

// Đúng danh sách đang hiện sau bộ lọc (thứ tự giữ nguyên).
export function xuatNhiemVu(rows) {
  const ten = `vptu-nhiem-vu-${ngayTep()}.xlsx`;
  taiXuong(ten, taoXlsx([bang('Nhiệm vụ', COT_NHIEM_VU, rows)]));
  return ten;
}

// Báo cáo A1 (v3.29): theo phòng chuyên môn, theo chuyên viên (cột tên: phòng + cán bộ), theo nguồn (mỗi bảng: { cot: [tên cột], dong: [[...]] } đã tính ở
// màn Báo cáo, cùng sáu cột số) + danh sách quá hạn (cột của màn Nhiệm vụ, bỏ cột Chất lượng — Báo cáo không còn xếp loại chất lượng).
const COT_QUA_HAN = COT_NHIEM_VU.filter((c) => c.nhan !== 'Chất lượng');
// v3.30 — Báo cáo theo kỳ. ky = { ten, tu, den } của kỳ đang xem (tu rỗng: chỉ điền "Đến ngày" — từ đầu dữ liệu). Tên tệp gồm ngày xuất và khoảng ngày
// (cùng kỳ xuất ở hai ngày không trùng tên: quá hạn, đang thực hiện tính tới ngày xuất): vptu-bao-cao-<ngày xuất>_<từ>-<đến>.xlsx, không có "từ" →
// …_den-<đến>.xlsx. Sheet đầu "Kỳ báo cáo" ghi kỳ, khoảng ngày, ngày tính số liệu, phạm vi, người xuất, giờ xuất.
const soNgay = (d) => d.replace(/-/g, '');
export const tenTepBaoCao = (ky, ngayXuat) => `vptu-bao-cao-${soNgay(ngayXuat)}_${ky.tu ? soNgay(ky.tu) : 'den'}-${soNgay(ky.den)}.xlsx`;
export const sheetKyBaoCao = (ky, { phamVi = '', nguoi = '', ngayXuat, luc = '' }) => ({ ten: 'Kỳ báo cáo', cot: [{ nhan: 'Mục', rong: 18 }, { nhan: 'Giá trị', rong: 90 }],
  dong: [['Kỳ', ky.ten], ['Từ ngày', ky.tu ? formatNgay(ky.tu) : 'Từ đầu dữ liệu'], ['Đến ngày', formatNgay(ky.den)],
    ['Số liệu tính tới', `${formatNgay(ngayXuat)} — quá hạn, sắp đến hạn, đang thực hiện tính tới ngày này; hoàn thành tính trong kỳ`],
    ['Phạm vi', phamVi], ['Người xuất', nguoi], ['Xuất lúc', luc]] });
export function xuatBaoCao({ ky, phamVi = '', nguoi = '', theoPhong, theoChuyenVien, theoNguon, rowsQuaHan }) {
  const tuBang = (ten, b, soCotChu = 1) => ({ ten, cot: b.cot.map((nhan, i) => ({ nhan, rong: i < soCotChu ? 36 : 14 })), dong: b.dong });
  const ngayXuat = homNayVN(); const luc = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const ten = ky ? tenTepBaoCao(ky, ngayXuat) : `vptu-bao-cao-${ngayTep()}.xlsx`;
  const thongTin = ky ? [sheetKyBaoCao(ky, { phamVi, nguoi, ngayXuat, luc })] : [];
  taiXuong(ten, taoXlsx([...thongTin, tuBang('Theo phòng chuyên môn', theoPhong), tuBang('Theo chuyên viên', theoChuyenVien, 2), tuBang('Theo nguồn', theoNguon),
    bang('Danh sách quá hạn', COT_QUA_HAN, rowsQuaHan)]));
  return ten;
}

// v3.16: xuất theo kỳ (tuần / tháng / quý / năm — lib/kl/ky.js). k = khoangKyChon(...); rows = toàn bộ việc trong phạm vi (hoặc danh sách đang lọc).
// 6 sheet: Kỳ (thông tin), Tổng hợp theo phòng / đơn vị, Giao trong kỳ, Hoàn thành trong kỳ, Đến hạn trong kỳ, Còn mở cuối kỳ (15 cột + Ngày giao, Ngày hoàn thành).
const COT_KY = [COT_NHIEM_VU[0], { nhan: 'Ngày giao nhiệm vụ', rong: 13, kieu: 'ngay', gt: ngayGiao }, { nhan: 'Ngày hoàn thành', rong: 13, kieu: 'ngay', gt: (r) => r.ngay_hoan_thanh || '' }, ...COT_NHIEM_VU.slice(1)];
export function xuatTheoKy(rows, k, { phamVi = 'Toàn bộ việc trong phạm vi', nguoi = '' } = {}) {
  const pl = phanLoaiTheoKy(rows, k); const th = tongHopTheoKy(rows, k);
  const thongTin = [['Kỳ', k.ten], ['Từ ngày', k.tu], ['Đến ngày', k.den], ['Phạm vi', phamVi], ['Người xuất', nguoi], ['Xuất lúc', new Date().toLocaleString('vi-VN')],
    ['Quy ước', 'Giao = ngày giao nhiệm vụ (hoặc ngày ban hành, ngày tạo); Hoàn thành = ngày hoàn thành; Đến hạn = hạn xử lý; Còn mở cuối kỳ = giao không sau ngày cuối kỳ và chưa xong (hoặc xong sau kỳ); Quá hạn = hạn trước ngày cuối kỳ.']];
  const ten = `vptu-nhiem-vu-${k.ma}.xlsx`;
  taiXuong(ten, taoXlsx([
    { ten: 'Kỳ', cot: [{ nhan: 'Mục', rong: 14 }, { nhan: 'Giá trị', rong: 110 }], dong: thongTin },
    { ten: 'Tổng hợp', cot: th.cot.map((nhan, i) => ({ nhan, rong: i === 0 ? 36 : 14 })), dong: th.dong },
    bang('Giao trong kỳ', COT_KY, pl.giao), bang('Hoàn thành trong kỳ', COT_KY, pl.xong), bang('Đến hạn trong kỳ', COT_KY, pl.denHan), bang('Còn mở cuối kỳ', COT_KY, pl.mo),
  ]));
  return { ten, so: { giao: pl.giao.length, xong: pl.xong.length, denHan: pl.denHan.length, mo: pl.mo.length } };
}
