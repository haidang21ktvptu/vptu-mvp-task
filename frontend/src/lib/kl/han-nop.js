// Ngày làm việc, ngày nghỉ (PR-2b, migration 0053–0060; 0077 bỏ hạn nộp minh chứng; Đợt D 0090 bỏ màn "Cần nghiệm thu" — nộp minh chứng hợp lệ
// là hoàn thành). Mọi phép tính ngày làm việc ở DB — client chỉ gọi RPC và hiển thị; quyền thật nằm trong từng hàm ghi.
import { supabase } from '../supabase.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo, viec) => loi(await supabase.rpc(ham, thamSo), viec);

// Danh mục ngày nghỉ (Quản trị › Ngày nghỉ): đọc cho mọi người đăng nhập; ghi qua qt_dat_ngay_nghi (QTHT / Chánh VP, lý do, nhật ký).
export async function dsNgayNghi() {
  return loi(await supabase.from('dm_ngay_nghi').select('ngay, loai, ten, tao_luc').order('ngay'), 'không đọc được danh mục ngày nghỉ') || [];
}
export const datNgayNghi = (ngay, loai, ten, bat, lyDo) =>
  rpc('qt_dat_ngay_nghi', { p_ngay: ngay, p_loai: loai || null, p_ten: ten || null, p_bat: bat, p_ly_do: lyDo }, 'không sửa được danh mục ngày nghỉ');
export const TEN_LOAI_NGAY = { NGHI_LE: 'Nghỉ lễ', NGHI_BU: 'Nghỉ bù', LAM_BU: 'Làm bù (T7/CN đi làm)' };
