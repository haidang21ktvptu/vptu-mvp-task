// Trang "Đặt mật khẩu mới" (SPEC AUTH-2, GĐ23): bắt buộc khi accounts.must_change_password = true (chặn toàn màn hình, không có nút quay lại;
// trigger trên auth.users tắt cờ khi đổi, RPC xoa_co_doi_mat_khau() chính chủ xoá thêm cho chắc), hoặc tự nguyện từ menu bánh răng (có Quay lại).
// Lối ra khi bị chặn: nút "Đăng xuất" (#dmkDangXuatBtn, action dangXuat của shell/banh-rang.js → handleLogout) — huỷ phiên, về đăng nhập, cờ giữ nguyên.
// Mật khẩu mới ≥ 8 ký tự, có chữ và số, khác mật khẩu tạm (giữ trong bộ nhớ module từ lúc đăng nhập, không lưu storage).
import { supabase } from '../lib/supabase.js';
import { $, show, setText, showInlineError } from '../lib/dom.js';
import { state } from '../lib/state.js';
import { registerActions } from '../lib/actions.js';
import { notifySuccess } from '../components/toast.js';
import { enterApp } from './session.js';

let matKhauTam = null;
let batBuoc = false;

export const datMatKhauTam = (pw) => { matKhauTam = pw || null; };

export function moTrangDoiMatKhau(bat) {
  batBuoc = bat;
  show('loginSection', false);
  show('changePasswordModal', true);
  show('changePasswordHuy', !bat);
  show('dmkDangXuatBtn', bat); // bắt buộc: lối ra duy nhất là Đăng xuất; tự nguyện: chỉ Quay lại
  setText('changePasswordMoTa', bat ? 'Đồng chí đang dùng mật khẩu tạm do quản trị cấp. Đặt mật khẩu mới để tiếp tục.' : 'Đặt mật khẩu mới cho tài khoản của đồng chí.');
  showInlineError('changePasswordError', '');
  $('newPassword').value = ''; $('newPasswordConfirm').value = '';
  $('newPassword').focus();
}

function dongDoiMatKhau() {
  if (batBuoc) return;
  show('changePasswordModal', false);
}

function changePasswordErrorMessage(error) {
  if (error.code === 'weak_password') return 'Mật khẩu chưa đủ mạnh: tối thiểu 8 ký tự và phải có cả chữ lẫn số.';
  if (error.code === 'same_password') return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  return 'Không đổi được mật khẩu. Đồng chí vui lòng thử lại.';
}

export function loiMatKhauMoi(pw, pw2, tam = matKhauTam) {
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm cả chữ và số.';
  if (tam && pw === tam) return 'Mật khẩu mới phải khác mật khẩu tạm.';
  if (pw !== pw2) return 'Hai lần nhập mật khẩu không khớp.';
  return '';
}

async function handleChangePassword(e) {
  e.preventDefault();
  const pw = $('newPassword').value;
  const loi = loiMatKhauMoi(pw, $('newPasswordConfirm').value);
  showInlineError('changePasswordError', loi);
  if (loi) return;
  const btn = $('changePasswordBtn');
  btn.disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { showInlineError('changePasswordError', changePasswordErrorMessage(error)); return; }
    await supabase.rpc('xoa_co_doi_mat_khau');
    const { data: profile } = await supabase.from('accounts_public').select('*').eq('id', state.user.id).single();
    if (profile) state.user = profile;
    matKhauTam = null;
    if (batBuoc) { batBuoc = false; show('changePasswordModal', false); enterApp(); return; }
    show('changePasswordModal', false);
    notifySuccess('Đã đổi mật khẩu.');
  } finally {
    btn.disabled = false;
  }
}

export function initChangePassword() {
  $('changePasswordForm').addEventListener('submit', handleChangePassword);
  registerActions({ dongDoiMatKhau, moDoiMatKhau: () => moTrangDoiMatKhau(false) });
}
