// Màn hình đổi mật khẩu bắt buộc (SPEC AUTH-2): chỉ hiện khi accounts.must_change_password = true,
// không có nút đóng; trigger trên auth.users tự tắt cờ khi đổi xong.
import { supabase } from '../lib/supabase.js';
import { $, showInlineError } from '../lib/dom.js';
import { state } from '../lib/state.js';
import { enterApp } from './session.js';

function changePasswordErrorMessage(error) {
  if (error.code === 'weak_password') return 'Mật khẩu chưa đủ mạnh: tối thiểu 8 ký tự và phải có cả chữ lẫn số.';
  if (error.code === 'same_password') return 'Mật khẩu mới phải khác mật khẩu tạm.';
  return 'Không đổi được mật khẩu. Đồng chí vui lòng thử lại.';
}

async function handleChangePassword(e) {
  e.preventDefault();
  const pw = $('newPassword').value;
  const pw2 = $('newPasswordConfirm').value;
  showInlineError('changePasswordError', '');
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    showInlineError('changePasswordError', 'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm cả chữ và số.');
    return;
  }
  if (pw !== pw2) {
    showInlineError('changePasswordError', 'Hai lần nhập mật khẩu không khớp.');
    return;
  }
  const btn = $('changePasswordBtn');
  btn.disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      showInlineError('changePasswordError', changePasswordErrorMessage(error));
      return;
    }
    // Trigger trên auth.users đã xoá cờ must_change_password; nạp lại hồ sơ cho chắc.
    const { data: profile } = await supabase
      .from('accounts_public').select('*').eq('id', state.user.id).single();
    if (profile) state.user = profile;
    enterApp();
  } finally {
    btn.disabled = false;
  }
}

export function initChangePassword() {
  $('changePasswordForm').addEventListener('submit', handleChangePassword);
}
