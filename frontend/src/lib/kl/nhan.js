// Nhãn, màu và thứ tự của các nhóm trạng thái (nhom_dem, muc_canh_bao từ hàm trang_thai — DB tính, frontend chỉ đặt tên).
// Màu là thông tin (DESIGN mục 2): đỏ = phải can thiệp, vàng = sắp/chưa rõ, xanh = trong hạn/xong, xám = còn lại.
export const NHOM = {
  QUA_HAN:        { ten: 'Quá hạn',                     row: 'r-do',   muc: 'muc-do',   stat: 's-do',   thuTu: 2, mo: true },
  DANG_DINH_CHINH:{ ten: 'Quá hạn — đang đính chính',   row: 'r-vang', muc: 'muc-vang', stat: 's-vang', thuTu: 3, mo: true },
  SAP_DEN_HAN:    { ten: 'Sắp đến hạn',                 row: 'r-vang', muc: 'muc-vang', stat: 's-vang', thuTu: 4, mo: true },
  CAN_DIEN_HAN:   { ten: 'Cần điền hạn',                row: 'r-vang', muc: 'muc-vang', stat: 's-vang', thuTu: 5, mo: true },
  DANG_THUC_HIEN: { ten: 'Đang thực hiện',              row: 'r-xanh', muc: 'muc-xanh', stat: '',       thuTu: 6, mo: true },
  CHO_DIEU_KIEN:  { ten: 'Chờ điều kiện',               row: '',       muc: '',         stat: '',       thuTu: 7, mo: true },
  THUONG_XUYEN:   { ten: 'Thường xuyên',                row: '',       muc: '',         stat: '',       thuTu: 8, mo: false },
  HOAN_THANH:     { ten: 'Hoàn thành',                  row: 'r-ht',   muc: 'muc-xanh', stat: 's-xanh', thuTu: 9, mo: false },
};
export const THU_TU_NHOM = Object.keys(NHOM); // thứ tự hiển thị ô số / bộ lọc

export const nhomCua = (ma) => NHOM[ma] || { ten: ma, row: '', muc: '', stat: '', thuTu: 99, mo: true };
export const tenNhom = (ma) => nhomCua(ma).ten;

// Bốn mức cảnh báo 1400 (NT-5, CN-4) — chấm màu trước trạng thái. Tên lớp khai báo NGUYÊN VĂN (Tailwind cắt lớp ghép chuỗi).
export const MUC_CANH_BAO = {
  XANH:          { ten: 'Xanh — trong hạn',            lop: 'cham cham-xanh' },
  VANG:          { ten: 'Vàng — còn ≤ 3 ngày, chưa có sản phẩm', lop: 'cham cham-vang' },
  DO:            { ten: 'Đỏ — quá hạn',                lop: 'cham cham-do' },
  DO_DAC_BIET:   { ten: 'Đỏ đặc biệt — quá hạn ≥ 3 ngày', lop: 'cham cham-dodb' },
  KHONG_AP_DUNG: { ten: 'Không áp dụng cảnh báo',      lop: 'cham cham-khong' },
};
export const chamMuc = (muc) => MUC_CANH_BAO[muc] || MUC_CANH_BAO.KHONG_AP_DUNG;

// Nhãn trạng thái đầy đủ cho một dòng v_nhiem_vu: "Quá hạn · 30 ngày", "Cần điền hạn · 290 ngày", "Hoàn thành đúng hạn"…
export function nhanTrangThai(r) {
  switch (r.nhom_dem) {
    case 'QUA_HAN': return `Quá hạn · ${r.so_ngay_qua} ngày`;
    case 'DANG_DINH_CHINH': return `Quá hạn · ${r.so_ngay_qua} ngày · đang đính chính`;
    case 'CAN_DIEN_HAN': return `Cần điền hạn · ${r.tuoi_ngay} ngày tuổi`;
    case 'HOAN_THANH':
      if (r.ket_qua === 'DUNG_HAN') return 'Hoàn thành đúng hạn';
      if (r.ket_qua === 'TRE') return `Hoàn thành trễ ${r.so_ngay_tre} ngày`;
      return 'Hoàn thành';
    default: return tenNhom(r.nhom_dem);
  }
}

// Tên hiển thị của mã nguồn dòng / nguồn dòng lịch sử.
export const TEN_NGUON = { excel: 'Nhập từ Excel', app: 'Nhập trên hệ thống', dinh_chinh: 'Đính chính đã duyệt' };

// Tên cột nhiem_vu dùng trong ngăn truy vết và lịch sử (0023 đã đổi tên cột cũ trong lịch sử).
export const TEN_COT = {
  han_xu_ly: 'Hạn xử lý', loai_thoi_han_ma: 'Loại thời hạn', tien_do_ma: 'Tiến độ', ngay_hoan_thanh: 'Ngày hoàn thành',
  minh_chung: 'Minh chứng', van_ban_trien_khai: 'Văn bản triển khai', ly_do_chua_co_han: 'Lý do chưa có hạn',
  ghi_chu: 'Ghi chú', nganh_ma: 'Ngành', linh_vuc_ma: 'Lĩnh vực', owner_don_vi_ma: 'Đơn vị chịu trách nhiệm',
  owner_tai_khoan: 'Cán bộ chịu trách nhiệm', nguoi_theo_doi: 'Người theo dõi', noi_dung: 'Nội dung',
  linh_vuc_chi_tiet: 'Lĩnh vực chi tiết', so_lan_gia_han: 'Số lần gia hạn', van_ban_id: 'Văn bản giao việc',
  san_pham_loai: 'Loại sản phẩm', san_pham_mo_ta: 'Mô tả sản phẩm', cap_nhan_san_pham: 'Cấp nhận sản phẩm', cap_quyet_dinh: 'Cấp cần quyết định',
  ngay_nhan_van_ban: 'Ngày nhận văn bản', ngay_nhan_uoc_tinh: 'Ngày nhận ước tính', nhiem_vu_cha: 'Nhiệm vụ cha', theo_1400: 'Theo quy tắc 1400',
  xac_nhan_nhan_viec: 'Xác nhận đã nhận việc', '*': 'Tạo dòng',
};
export const tenCot = (cot) => TEN_COT[cot] || cot;

// "6. Đảng ủy Ủy ban nhân dân tỉnh" → "Đảng ủy Ủy ban nhân dân tỉnh" (bỏ số thứ tự khi hiện trong ô bảng).
export const boSoThuTu = (ten) => (ten || '').replace(/^\d+\.\s*/, '');
