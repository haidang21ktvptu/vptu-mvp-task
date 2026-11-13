// Phân hệ Nhiệm vụ quý BTV (v3.35 — CAU-HOI nhóm U): nhãn tiếng Việt, lớp màu (viết nguyên văn — Tailwind cắt lớp ghép chuỗi), số La Mã, tên quý,
// định dạng số. Thuần (không DOM, không mạng) — unit test frontend/tests/nvq-tinh.test.mjs. Trạng thái nhiệm vụ do CSDL tính (nvq_trang_thai, 0134).

export const LA_MA = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const laMa = (n) => LA_MA[n] || String(n ?? '');
export const tenKy = (k) => (k ? `Quý ${laMa(k.quy)} năm ${k.nam}` : '');
export const tenKyNgan = (k) => (k ? `Quý ${laMa(k.quy)}/${k.nam}` : '');

// Trạng thái nhiệm vụ (v_nvq_nhiem_vu.trang_thai) — thứ tự hiển thị trên ô số / chú giải.
export const TRANG_THAI = {
  HOAN_THANH: { ten: 'Hoàn thành', lop: 'tt-xong' },
  DANG_THUC_HIEN: { ten: 'Đang thực hiện', lop: 'nq-tt-dang' },
  THUONG_XUYEN: { ten: 'Thường xuyên', lop: 'nq-tt-dang' },
  CHAM_TIEN_DO: { ten: 'Chậm tiến độ', lop: 'tt-qua' },
  CHUA_TRIEN_KHAI: { ten: 'Chưa triển khai', lop: 'tt-xam' },
  RUT: { ten: 'Rút khỏi danh mục', lop: 'tt-xam' },
};
export const THU_TU_TT = ['HOAN_THANH', 'DANG_THUC_HIEN', 'THUONG_XUYEN', 'CHAM_TIEN_DO', 'CHUA_TRIEN_KHAI', 'RUT'];
export const tenTrangThai = (r) => {
  if (!r) return '';
  if (r.trang_thai === 'HOAN_THANH' && r.ket_qua === 'CHAM_TIEN_DO') return 'Hoàn thành (chậm tiến độ)';
  return TRANG_THAI[r.trang_thai]?.ten || r.trang_thai || '';
};
// Lớp nhãn trạng thái: chậm tiến độ từ ngưỡng Đỏ đặc biệt dùng tím (DESIGN mục 2, v3.23.2).
export const lopTrangThai = (r) => (r?.trang_thai === 'CHAM_TIEN_DO' && r.muc === 'DO_DAC_BIET' ? 'tt-ddb' : TRANG_THAI[r?.trang_thai]?.lop || 'tt-xam');
// Mép trái dòng theo mức (như bảng nhiệm vụ phân hệ cũ).
export const lopMep = (r) => ({ DO_DAC_BIET: 'nq-mep-ddb', DO: 'nq-mep-do', VANG: 'nq-mep-vang', XANH: 'nq-mep-lam' }[r?.muc]
  || (r?.trang_thai === 'HOAN_THANH' ? 'nq-mep-luc' : 'nq-mep-xam'));

export const NHOM = { TRONG_CT: 'Nhiệm vụ được phê duyệt theo chương trình, kế hoạch công tác', NGOAI_CT: 'Nhiệm vụ được giao ngoài chương trình, kế hoạch công tác' };
export const NHOM_NGAN = { TRONG_CT: 'Theo chương trình, kế hoạch', NGOAI_CT: 'Ngoài chương trình, kế hoạch' };
export const TINH_CHAT = { CO_MOC: 'Có mốc hoàn thành', DINH_KY: 'Định kỳ', THUONG_XUYEN: 'Thường xuyên', KHI_PHAT_SINH: 'Khi phát sinh', CHO_DIEU_KIEN: 'Chờ điều kiện' };

// Kết quả / sản phẩm.
export const LOAI_SP = { VAN_BAN: 'Văn bản', CHI_TIEU: 'Chỉ tiêu', HOAT_DONG: 'Hoạt động', DINH_KY: 'Định kỳ', KHAC: 'Khác' };
const TT_SP = { CHUA: 'Chưa triển khai', DANG: 'Đang thực hiện', DA_TRINH: 'Đã trình', HOAN_THANH: 'Hoàn thành', KHONG_PHAT_SINH: 'Không phát sinh', KHONG_THUC_HIEN: 'Không thực hiện' };
const TT_SP_THEO_LOAI = {
  VAN_BAN: { DANG: 'Đang xây dựng', HOAN_THANH: 'Đã ban hành' },
  HOAT_DONG: { DANG: 'Đang chuẩn bị', HOAN_THANH: 'Đã tổ chức' },
  DINH_KY: { HOAN_THANH: 'Đã thực hiện' },
  CHI_TIEU: { HOAN_THANH: 'Đạt, hoàn thành' },
};
export const tenTrangThaiSp = (loai, tt) => TT_SP_THEO_LOAI[loai]?.[tt] || TT_SP[tt] || tt || '';
// Lựa chọn trạng thái hợp lệ theo loại (biểu mẫu cập nhật). "Không thực hiện" chỉ đầu mối (điều chỉnh danh mục).
export function luaChonTrangThaiSp(loai, { quanLy = false } = {}) {
  const ds = loai === 'VAN_BAN' ? ['CHUA', 'DANG', 'DA_TRINH', 'HOAN_THANH'] : loai === 'DINH_KY' || loai === 'KHAC' ? ['CHUA', 'DANG', 'HOAN_THANH', 'KHONG_PHAT_SINH']
    : ['CHUA', 'DANG', 'HOAN_THANH'];
  return quanLy ? [...ds, 'KHONG_THUC_HIEN'] : ds;
}
export const spXong = (s) => s?.trang_thai === 'HOAN_THANH' || s?.trang_thai === 'KHONG_PHAT_SINH';
export const lopTrangThaiSp = (s) => (spXong(s) ? 'tt-xong' : s?.so_ngay_qua > 0 ? 'tt-qua' : s?.trang_thai === 'CHUA' ? 'tt-xam' : 'nq-tt-dang');

export const CHI_TIEU_CO_BAN = {
  GRDP: 'Tăng trưởng GRDP', THU_NSNN: 'Thu ngân sách nhà nước', GIAI_NGAN: 'Giải ngân vốn đầu tư công', THU_NHAP: 'Thu nhập bình quân đầu người',
  GIAM_NGHEO: 'Giảm tỷ lệ hộ nghèo đa chiều',
};
export const THU_TU_CTCB = ['GRDP', 'THU_NSNN', 'GIAI_NGAN', 'THU_NHAP', 'GIAM_NGHEO'];

export const DANH_GIA = {
  HOAN_THANH: 'Hoàn thành', HOAN_THANH_CHAM: 'Hoàn thành nhưng chậm tiến độ', CHUA_HOAN_THANH: 'Chưa hoàn thành', KHONG_DANH_GIA: 'Không đánh giá',
};
export const VAI_TRO_DON_VI = { CHU_TRI: 'chủ trì', PHOI_HOP: 'phối hợp', THAM_DINH: 'thẩm định', THAM_TRA: 'thẩm tra' };

// Số kiểu Việt Nam: 3.530; 14,86. Không hiện phần thập phân thừa.
export function soVN(n, toiDa = 2) {
  if (n === null || n === undefined || n === '' || !Number.isFinite(Number(n))) return '';
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: toiDa });
}
// Phần trăm của phần trên tổng (làm tròn) — "0%" khi tổng 0.
export const phanTram = (phan, tong) => (tong ? Math.round((100 * phan) / tong) : 0);
// Mức thời gian: "chậm 5 ngày" / "còn 3 ngày" / "".
export function ghiMoc(r) {
  if (r?.so_ngay_qua > 0) return `chậm ${r.so_ngay_qua} ngày`;
  if (Number.isFinite(r?.so_ngay_con) && r.so_ngay_con >= 0) return r.so_ngay_con === 0 ? 'đến mốc hôm nay' : `còn ${r.so_ngay_con} ngày`;
  return '';
}
