// Hàng 1–2 và khối chất lượng số liệu của dashboard A1. Mỗi ô là nút data-action="moKlDanhSach" mang bộ lọc (JSON) —
// bấm ra danh sách 10B với đúng dòng tạo nên con số (truy vết 6.3, không có con số "hộp đen").
import { escapeHtml } from '../../../lib/dom.js';
import { NHOM } from '../../../lib/kl/nhan.js';
import { cauHinhKl } from '../../../lib/kl/du-lieu.js';

export const nutLoc = (loc) => `data-action="moKlDanhSach" data-loc="${escapeHtml(JSON.stringify(loc))}"`;

const oSo = (so, nhan, loc, cls = '', phu = '') => `<button type="button" class="o-so ${cls}" ${nutLoc(loc)}><b>${so}</b><span>${nhan}</span>${phu ? `<small>${phu}</small>` : ''}</button>`;

// Hàng 2 "Tình hình chung" (GĐ15 gộp ô đỏ/vàng của hàng 1 cũ vào đây — hàng 1 nay là bảng ngoại lệ): ô Tổng đứng đầu,
// rồi các nhóm đang mở > 0 (đỏ/vàng/xám), Đang thực hiện, Hoàn thành, Thường xuyên. Tổng các ô nhóm = ô Tổng (bất biến DB-5).
export function tinhHinhHtml(t) {
  const nguong = cauHinhKl('nguong_sap_den_han_ngay', 7);
  const canThiep = [
    ['QUA_HAN', 'Quá hạn', ''],
    ['DANG_DINH_CHINH', 'Quá hạn — đang đính chính', ''],
    ['SAP_DEN_HAN', `Sắp đến hạn (${nguong} ngày)`, ''],
    ['CAN_DIEN_HAN', 'Cần điền hạn', t.tuoiLonNhatCanDienHan ? `tuổi lớn nhất ${t.tuoiLonNhatCanDienHan} ngày` : ''],
    ['CHO_DIEU_KIEN', 'Chờ điều kiện', 'chưa có hạn theo bản chất'],
  ].filter(([k]) => t.nhom[k] > 0).map(([k, nhan, phu]) => oSo(t.nhom[k], nhan, { nhom: k }, NHOM[k].stat, phu));
  return [
    oSo(t.tong, 'Tổng nhiệm vụ', {}, '', `${t.dangMo} đang mở`),
    ...canThiep,
    oSo(t.nhom.DANG_THUC_HIEN, 'Đang thực hiện', { nhom: 'DANG_THUC_HIEN' }, '', 'trong hạn, còn trên ngưỡng'),
    oSo(t.nhom.HOAN_THANH, `Hoàn thành · ${t.tyLeHoanThanh}%`, { nhom: 'HOAN_THANH' }, 's-xanh', t.hoanThanhChuaMinhChung ? `${t.hoanThanhChuaMinhChung} chưa có minh chứng` : ''),
    oSo(t.nhom.THUONG_XUYEN, 'Thường xuyên', { nhom: 'THUONG_XUYEN' }, '', 'không tính hạn'),
  ].join('');
}

// Cuối trang (6.7): mỗi dòng có con số bấm được.
export function chatLuongHtml(q, nguongNgay) {
  const dong = (so, nhan, loc, ghiChu = '') => `<li><button type="button" class="bd-so" ${nutLoc(loc)}>${so}</button> ${nhan}${ghiChu ? ` <span class="chu-phu">${ghiChu}</span>` : ''}</li>`;
  const tre = q.soDongCoDoTre
    ? `<li><span class="bd-so bd-so-tinh">${q.doTreTrungBinh}</span> ngày độ trễ nhập liệu trung bình (lớn nhất ${q.doTreLonNhat}) <span class="chu-phu">trên ${q.soDongCoDoTre} việc hoàn thành ghi nhận trên hệ thống</span></li>`
    : '<li><span class="bd-so bd-so-tinh">—</span> độ trễ nhập liệu <span class="chu-phu">chưa có việc nào hoàn thành ghi nhận trên hệ thống để đo</span></li>';
  return [
    dong(q.hoanThanhChuaMinhChung, 'việc Hoàn thành chưa có minh chứng', { nhom: 'HOAN_THANH', thieuMinhChung: true }, 'dữ liệu cũ nhập từ Excel; chủ trì bổ sung được'),
    dong(q.hoanThanhKhongNgayGoc, 'việc Hoàn thành không có ngày hoàn thành gốc', { nhom: 'HOAN_THANH', khongNgayHoanThanh: true }, 'nhập từ Excel — không đánh giá đúng/trễ hạn'),
    dong(q.moKhongCapNhat, `việc đang mở không ai cập nhật quá ${nguongNgay} ngày`, { chiMo: true, khongCapNhatQua: nguongNgay }),
    dong(q.dangDinhChinh, 'việc có đề nghị đính chính đang chờ duyệt', { dangDinhChinh: true }),
    tre,
  ].join('');
}
