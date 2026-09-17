// Gọi Edge Function quan-tri-tai-khoan (supabase/functions): việc cần service_role (tạo tài khoản, mật khẩu tạm, khoá/mở, cờ quan_tri_he_thong).
// JWT của người gọi đi kèm tự động; function kiểm quan_tri_he_thong. Lỗi trả về tiếng Việt từ function (trường error).
import { supabase } from './supabase.js';

export async function goiQuanTriTaiKhoan(body) {
  const { data, error } = await supabase.functions.invoke('quan-tri-tai-khoan', { body });
  if (error) {
    let msg = error.message || 'Không gọi được dịch vụ quản trị tài khoản.';
    try { const j = await error.context?.json(); if (j?.error) msg = j.error; } catch { /* giữ thông báo mặc định */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || 'Không thực hiện được.');
  return data;
}
