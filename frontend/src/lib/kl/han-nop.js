// Hạn nộp minh chứng, nghiệm thu, ngày nghỉ (PR-2b, migration 0053–0060). Mọi phép tính ngày làm việc / khung hạn nộp ở DB — client chỉ gọi RPC
// và hiển thị: kl_khung_han_nop là CÙNG hàm trigger bd_nhiem_vu_han_nop_mc dùng để chặn; quyền thật nằm trong từng hàm ghi.
import { supabase } from '../supabase.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo, viec) => loi(await supabase.rpc(ham, thamSo), viec);

// Khung hạn nộp cho hạn hoàn thành H (hoặc Ký ban hành: ngày BH + cấu hình): { han_xu_ly, tu, den, khong_ly_do_den, goi_y, qua_han } hoặc null.
export const khungHanNop = (han, ngayBanHanh = null, loaiThoiHan = null) =>
  rpc('kl_khung_han_nop', { p_han_xu_ly: han || null, p_ngay_ban_hanh: ngayBanHanh || null, p_loai_thoi_han: loaiThoiHan || null }, 'không đọc được khung hạn nộp');
// Người giao sửa hạn nộp (lý do bắt buộc; quản trị sửa thay khi không có người giao — Q4).
export const datHanNopMinhChung = (id, han, lyDo) => rpc('dat_han_nop_minh_chung', { p_id: id, p_han: han, p_ly_do: lyDo }, 'không sửa được hạn nộp minh chứng');
// Số ngày làm việc trong (từ, đến] — "còn n ngày làm việc" ở ngăn chi tiết.
export const soNgayLamViec = (tu, den) => rpc('kl_so_ngay_lam_viec', { p_tu: tu, p_den: den }, 'không tính được ngày làm việc');
export const ngayLamViecSau = (tu, so) => rpc('ngay_lam_viec_sau', { p_tu: tu, p_so: so }, 'không tính được ngày làm việc');
// Màn "Cần nghiệm thu": [{ nhiem_vu_id, minh_chung_id, cua_toi }] — cùng hàm chặn với xac_nhan_minh_chung (kl_duoc_nghiem_thu).
export const canNghiemThu = async () => (await rpc('kl_can_nghiem_thu', {}, 'không đọc được danh sách cần nghiệm thu')) || [];

// Danh mục ngày nghỉ (Quản trị › Ngày nghỉ): đọc cho mọi người đăng nhập; ghi qua qt_dat_ngay_nghi (QTHT / Chánh VP, lý do, nhật ký).
export async function dsNgayNghi() {
  return loi(await supabase.from('dm_ngay_nghi').select('ngay, loai, ten, tao_luc').order('ngay'), 'không đọc được danh mục ngày nghỉ') || [];
}
export const datNgayNghi = (ngay, loai, ten, bat, lyDo) =>
  rpc('qt_dat_ngay_nghi', { p_ngay: ngay, p_loai: loai || null, p_ten: ten || null, p_bat: bat, p_ly_do: lyDo }, 'không sửa được danh mục ngày nghỉ');
export const TEN_LOAI_NGAY = { NGHI_LE: 'Nghỉ lễ', NGHI_BU: 'Nghỉ bù', LAM_BU: 'Làm bù (T7/CN đi làm)' };
