// Vòng đời phiên: nạp danh bạ, vào app, đăng xuất, khôi phục phiên khi tải lại trang.
import { supabase, sessionStorageKey } from '../lib/supabase.js';
import { show } from '../lib/dom.js';
import { state } from '../lib/state.js';
import { initUserInterface } from '../views/shell.js';

// Hook cho các tính năng gắn thêm khi phiên bắt đầu/kết thúc (realtime ở PR c của GĐ4).
const hooks = { onEnter: [], onLeave: [] };
export function onSessionEnter(fn) { hooks.onEnter.push(fn); }
export function onSessionLeave(fn) { hooks.onLeave.push(fn); }

// Danh bạ dùng cho mọi danh sách cán bộ (chọn người, cây phân cấp, KPI, nhắn tin). Tài khoản hệ thống
// (is_system, ví dụ smoke_test sau phát hành) bị lọc ngay tại đây nên không xuất hiện ở đâu cả.
export async function loadAccountsCache() {
  const { data } = await supabase.from('accounts_public').select('*');
  if (data) state.accounts = data.filter((a) => !a.is_system);
}

export function enterApp() {
  show('changePasswordModal', false);
  initUserInterface();
  hooks.onEnter.forEach((fn) => fn());
}

export async function handleLogout() {
  hooks.onLeave.forEach((fn) => fn());
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Mất mạng: supabase-js giữ nguyên phiên cục bộ khi máy chủ không huỷ được.
    // Tự xoá khoá phiên để máy dùng chung không còn đăng nhập.
    localStorage.removeItem(sessionStorageKey());
  }
  location.reload();
}

// Khôi phục phiên do Supabase Auth lưu (localStorage) khi tải lại trang.
export async function restoreSession(startSession) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await startSession(session);
}
