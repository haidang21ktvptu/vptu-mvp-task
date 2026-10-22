// Giá trị một ô của nhiệm vụ để hiện cho người đọc (mã danh mục → tên, ngày ISO → dd/mm/yyyy, tài khoản → họ tên, cờ → có / không) — dùng chung
// cho bảng căn cứ của ngăn chi tiết (kl/chi-tiet.js) và Diễn biến (dien-bien.js). v3.29: tách khỏi chi-tiet.js (tránh vòng import với dien-bien.js).
import { findAccount } from '../state.js';
import { tenTrongDanhMuc } from './du-lieu.js';
import { tenChatLuong } from './nhan.js';
import { tenMucQuanTrong } from './ma-nguon.js';
import { formatNgay } from './ngay.js';

const DANH_MUC_COT = { tien_do_ma: 'tienDo', loai_thoi_han_ma: 'loaiThoiHan', nganh_ma: 'nganh', linh_vuc_ma: 'linhVuc', owner_don_vi_ma: 'donVi',
  san_pham_loai: 'sanPham', cap_nhan_san_pham: 'cap', cap_quyet_dinh: 'cap', nguon_nhiem_vu_ma: 'nguonNhiemVu', co_quan_trinh: 'donVi' };
const COT_NGAY = ['han_xu_ly', 'ngay_hoan_thanh', 'ngay_nhan_van_ban', 'han_nop_minh_chung'];   // han_nop: chỉ còn ở lịch sử cũ (0077)
const COT_TAI_KHOAN = ['nguoi_theo_doi', 'owner_tai_khoan', 'thuong_truc_chi_dao', 'giao_thay_mat_cho'];

export function hienGiaTri(cot, v) {
  if (v === null || v === undefined || v === '') return '(trống)';
  if (DANH_MUC_COT[cot]) return tenTrongDanhMuc(DANH_MUC_COT[cot], v);
  if (cot === 'chat_luong') return tenChatLuong(v) || v;
  if (cot === 'muc_quan_trong') return tenMucQuanTrong(v);   // C2 (0087)
  if (COT_NGAY.includes(cot)) return formatNgay(v);
  if (COT_TAI_KHOAN.includes(cot)) return findAccount(v)?.full_name || v;
  if (cot === 'ngay_nhan_uoc_tinh' || cot === 'theo_1400' || cot === 'bi_tu_choi') return v === 'true' || v === true ? 'có' : 'không';
  return String(v);
}
