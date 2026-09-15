// Nhãn, màu và thứ tự của các nhóm trạng thái KL (nhom_dem từ kl_trang_thai — DB tính, frontend chỉ đặt tên).
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

// Nhãn trạng thái đầy đủ cho một dòng v_kl_dashboard: "Quá hạn · 30 ngày", "Cần điền hạn · 290 ngày", "Hoàn thành đúng hạn"…
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

// Tên cột kl_nhiem_vu dùng trong ngăn truy vết và lịch sử.
export const TEN_COT = {
  han_xu_ly: 'Hạn xử lý', loai_thoi_han_ma: 'Loại thời hạn', tien_do_ma: 'Tiến độ', ngay_hoan_thanh: 'Ngày hoàn thành',
  minh_chung: 'Minh chứng', van_ban_trien_khai: 'Văn bản triển khai', ly_do_chua_co_han: 'Lý do chưa có hạn',
  ghi_chu: 'Ghi chú', nganh_ma: 'Ngành', linh_vuc_ma: 'Lĩnh vực', co_quan_trinh_ma: 'Cơ quan trình',
  chu_tri_id: 'Chủ trì', noi_dung: 'Nội dung', linh_vuc_chi_tiet: 'Lĩnh vực chi tiết', so_lan_gia_han: 'Số lần gia hạn',
  hoi_nghi_id: 'Hội nghị', '*': 'Tạo dòng',
};
export const tenCot = (cot) => TEN_COT[cot] || cot;

// "6. Đảng ủy Ủy ban nhân dân tỉnh" → "Đảng ủy Ủy ban nhân dân tỉnh" (bỏ số thứ tự khi hiện trong ô bảng).
export const boSoThuTu = (ten) => (ten || '').replace(/^\d+\.\s*/, '');
