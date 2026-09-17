// Nhãn, màu và thứ tự của các nhóm trạng thái (nhom_dem, muc_canh_bao từ hàm trang_thai — DB tính, frontend chỉ đặt tên) và
// bốn khâu nghẽn (v_ngoai_le.khau, 0033). Màu là thông tin (mockup): đỏ = phải can thiệp, vàng = sắp/chưa rõ, lục = xong, lam = cấu trúc.
// Tên lớp khai báo NGUYÊN VĂN (Tailwind cắt lớp ghép chuỗi khỏi bản build).
export const NHOM = {
  QUA_HAN:        { ten: 'Quá hạn',                     lop: 'do',   stat: 's-do',   thuTu: 2, mo: true },
  DANG_DINH_CHINH:{ ten: 'Quá hạn — đang đính chính',   lop: 'vang', stat: 's-vang', thuTu: 3, mo: true },
  SAP_DEN_HAN:    { ten: 'Sắp đến hạn',                 lop: 'vang', stat: 's-vang', thuTu: 4, mo: true },
  CAN_DIEN_HAN:   { ten: 'Cần điền hạn',                lop: 'vang', stat: 's-vang', thuTu: 5, mo: true },
  DANG_THUC_HIEN: { ten: 'Đang thực hiện',              lop: 'lam',  stat: 's-lam',  thuTu: 6, mo: true },
  CHO_DIEU_KIEN:  { ten: 'Chờ điều kiện',               lop: '',     stat: '',       thuTu: 7, mo: true },
  THUONG_XUYEN:   { ten: 'Thường xuyên',                lop: '',     stat: '',       thuTu: 8, mo: false },
  HOAN_THANH:     { ten: 'Hoàn thành',                  lop: 'luc',  stat: 's-luc',  thuTu: 9, mo: false },
};
export const THU_TU_NHOM = Object.keys(NHOM); // thứ tự hiển thị ô số / bộ lọc

export const nhomCua = (ma) => NHOM[ma] || { ten: ma, lop: '', stat: '', thuTu: 99, mo: true };
export const tenNhom = (ma) => nhomCua(ma).ten;

// Bốn mức cảnh báo 1400 (NT-5, CN-4) → lớp mép trái (the/hang-nv/muc) và tên.
export const MUC_CANH_BAO = {
  XANH:          { ten: 'Xanh — trong hạn',                     lop: 'lam' },
  VANG:          { ten: 'Vàng — còn ≤ 3 ngày, chưa có sản phẩm', lop: 'vang' },
  DO:            { ten: 'Đỏ — quá hạn',                         lop: 'do' },
  DO_DAC_BIET:   { ten: 'Đỏ đặc biệt — quá hạn ≥ 3 ngày',       lop: 'dac-biet' },
  KHONG_AP_DUNG: { ten: 'Không áp dụng cảnh báo',               lop: '' },
};
export const mucCua = (muc) => MUC_CANH_BAO[muc] || MUC_CANH_BAO.KHONG_AP_DUNG;
// Lớp mép trái của một dòng v_nhiem_vu: hoàn thành → lục; còn lại theo mức cảnh báo.
export const lopMep = (r) => (r.nhom_dem === 'HOAN_THANH' ? 'luc' : mucCua(r.muc_canh_bao).lop);

// Bốn khâu nghẽn của việc Đỏ (v_ngoai_le.khau, thứ tự ưu tiên trong 0033); mau = màu thanh tỉ lệ ở thanh trái.
export const KHAU = {
  BI_TU_CHOI:     { ten: 'Bị từ chối, chờ giao lại',  phu: 'đề nghị từ chối đã duyệt',  mau: 'do' },
  CHO_QUYET:      { ten: 'Chờ cấp trên quyết',        phu: 'đã trình, chưa có ý kiến',  mau: 'cam' },
  CHUA_SAN_PHAM:  { ten: 'Chưa có sản phẩm',          phu: 'đang làm, đã quá hạn',      mau: 'cam' },
  CHO_MINH_CHUNG: { ten: 'Chờ xác nhận minh chứng',   phu: 'đã nộp, chờ Văn phòng',     mau: 'lam' },
  CHUA_NHAN:      { ten: 'Chưa nhận việc',            phu: 'giao rồi, chưa xác nhận',   mau: 'cam' },
};
export const THU_TU_KHAU = Object.keys(KHAU);
export const tenKhau = (ma) => KHAU[ma]?.ten || ma || '';

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
  xac_nhan_nhan_viec: 'Xác nhận đã nhận việc', chi_dao: 'Chỉ đạo', '*': 'Tạo dòng', tu_choi: 'Từ chối nhận việc', bi_tu_choi: 'Bị từ chối, chờ giao lại',
  minh_chung_nop: 'Nộp minh chứng', minh_chung_xac_nhan: 'Xác nhận minh chứng', dong_nhiem_vu: 'Đóng nhiệm vụ',
  giao_thay_mat: 'Giao thay mặt', giao_viec: 'Giao việc', canh_bao: 'Cảnh báo', do_khan: 'Độ khẩn', uu_tien: 'Ưu tiên', giao_thay_mat_cho: 'Giao thay mặt cho',
};
export const tenCot = (cot) => TEN_COT[cot] || cot;

// "6. Đảng ủy Ủy ban nhân dân tỉnh" → "Đảng ủy Ủy ban nhân dân tỉnh" (bỏ số thứ tự khi hiện trong ô).
export const boSoThuTu = (ten) => (ten || '').replace(/^\d+\.\s*/, '');
