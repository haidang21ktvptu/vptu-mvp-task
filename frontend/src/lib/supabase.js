// Client Supabase duy nhất của app. Chỉ anon key (public) được có ở frontend,
// đọc từ biến môi trường VITE_SUPABASE_* (CLAUDE.md quy tắc 1). Phiên đăng nhập
// do Supabase Auth quản trong localStorage, app không tự lưu tài khoản.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY (xem frontend/.env.example).');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Khoá phiên mà supabase-js dùng trong localStorage (sb-<ref>-auth-token).
export function sessionStorageKey() {
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  return `sb-${ref}-auth-token`;
}
