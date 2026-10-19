// Dữ liệu hư cấu dùng chung cho unit test nhập Excel (nhap-excel.test.mjs, nhap-excel-khong-thuoc.test.mjs): danh mục rút gọn, cán bộ (có trùng tên,
// tài khoản hệ thống), ngữ cảnh chuẩn hoá (từ điển), ngữ cảnh đánh giá và một dòng đủ mức 1 của Kết luận BTV.
export const DM = {
  donVi: [{ ma: 'VAN_PHONG_TINH_UY', ten: '1. Văn phòng Tỉnh ủy', trong_van_phong: true, phong: null }, { ma: 'DANG_UY_UBND', ten: '6. Đảng ủy Ủy ban nhân dân tỉnh', trong_van_phong: false, phong: null },
    { ma: 'TONG_HOP', ten: 'Phòng Tổng hợp', trong_van_phong: true, phong: 'TONG_HOP' }, { ma: 'QUAN_TRI', ten: 'Phòng Quản trị', trong_van_phong: true, phong: 'QUAN_TRI' }],
  nganh: [{ ma: 'KTTH', ten: '8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách' }, { ma: 'NOI_CHINH', ten: '3. Nội chính - ANQP - Tư pháp' }],
  linhVuc: [{ ma: 'LV_TC', ten: 'Tài chính', nganh_ma: 'KTTH' }, { ma: 'LV_DT', ten: 'Đầu tư công', nganh_ma: 'KTTH' }, { ma: 'LV_TP', ten: 'Tư pháp', nganh_ma: 'NOI_CHINH' }],
  sanPham: [{ ma: 'BAO_CAO', ten: 'Báo cáo' }, { ma: 'TO_TRINH', ten: 'Tờ trình' }],
  cap: [{ ma: 'TRUONG_PHONG', ten: 'Trưởng phòng' }, { ma: 'CHANH_VAN_PHONG', ten: 'Chánh Văn phòng' }],
  loaiThoiHan: [{ ma: 'CO_HAN_CU_THE', ten: 'Có hạn cụ thể', cho_phep_tao_moi: true }, { ma: 'KY_BAN_HANH', ten: 'Ký ban hành (trong 10 ngày)', cho_phep_tao_moi: true },
    { ma: 'THUONG_XUYEN', ten: 'Nhiệm vụ thường xuyên', cho_phep_tao_moi: false }],
  nguonNhiemVu: [{ ma: 'VAN_BAN_CAN_THEO_DOI', ten: 'Văn bản cần theo dõi', dang_dung: true }, { ma: 'NHIEM_VU_PHAT_SINH', ten: 'Nhiệm vụ phát sinh', dang_dung: true }],
  mucTieu: [{ ma: 'DP_CAN_BO', nhom: 'DOT_PHA', ten: 'Nâng cao chất lượng đội ngũ cán bộ', ten_ngan: 'Đột phá cán bộ, nguồn nhân lực', dang_dung: true },
    { ma: 'CTR_DU_LICH', nhom: 'CHUONG_TRINH', ten: 'Phát triển du lịch bền vững', ten_ngan: 'Du lịch bền vững', dang_dung: true },
    { ma: 'NQ_57', nhom: 'NQ_TW', ten: 'Nghị quyết số 57-NQ/TW', ten_ngan: 'Nghị quyết 57-NQ/TW', dang_dung: true },
    { ma: 'NQ_59', nhom: 'NQ_TW', ten: 'Nghị quyết số 59-NQ/TW', ten_ngan: 'Nghị quyết 59-NQ/TW', dang_dung: true },
    { ma: 'CHT_CU', nhom: 'CHI_TIEU', ten: 'Chỉ tiêu cũ', ten_ngan: 'Chỉ tiêu cũ', dang_dung: false }],   // v3.24 (0105)
};
export const ACC = [
  { id: 'cvp', full_name: 'Hoàng Văn Bình', role_group: 'A1', is_chief: true, department: 'LANH_DAO_VAN_PHONG', username: 'binh.cvp' },
  { id: 'tp', full_name: 'Nông Thị Lan', role_group: 'A2', department: 'TONG_HOP', username: 'lan.tp' },
  { id: 'cv1', full_name: 'Lý Văn Phúc', role_group: 'A3', department: 'TONG_HOP', username: 'phuc' },
  { id: 'cv2', full_name: 'Lý Văn Phúc', role_group: 'A3', department: 'QUAN_TRI', username: 'phuc.qt' },
  { id: 'tpqt', full_name: 'Đàm Văn Sơn', role_group: 'A2', department: 'QUAN_TRI', username: 'son' },
  { id: 'sys', full_name: 'Hệ thống', is_system: true, role_group: 'A3', department: 'CDS_CY', username: 'he.thong' },
];
export const TEN_PHONG = { TONG_HOP: 'Phòng Tổng hợp', QUAN_TRI: 'Phòng Quản trị', LANH_DAO_VAN_PHONG: 'Lãnh đạo Văn phòng' };
export const CTX = { dm: DM, accounts: ACC, tenPhong: (m) => TEN_PHONG[m] || m,
  tuDien: new Map([['don_vi', new Map([['ubnd tinh', 'DANG_UY_UBND']])], ['can_bo', new Map([['vptu', 'tp']])]]) };
export const DG = { me: { id: 'qtkl', role_group: 'A3' }, dm: DM, accounts: ACC, cheDoXong: 'DA_XONG_NGOAI', homNay: '2026-10-02', maDaCo: new Set(['NV-9']) };
export const DU = { so_hoi_nghi: 45, so_ket_luan: '45-KL/TU', ngay_ban_hanh: '01/08/2026', noi_dung: 'Báo cáo quý', don_vi: 'Phòng Tổng hợp', san_pham: 'Báo cáo',
  han_xu_ly: '31/12/2026', nganh: 'Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách', linh_vuc: 'Tài chính' };
