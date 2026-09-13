// Đăng nhập bằng Supabase Auth (SPEC AUTH-1): email quy ước <username>@vptu.caobang.local.
import { supabase } from '../lib/supabase.js';
import { AUTH_EMAIL_DOMAIN } from '../lib/constants.js';
import { $, show, showInlineError } from '../lib/dom.js';
import { state } from '../lib/state.js';
import { loadAccountsCache, enterApp } from './session.js';

function loginErrorMessage(error) {
  // Giới hạn theo IP của Supabase (30 lượt/5 phút): cả cơ quan chung IP nên có thể bị chặn oan giờ cao điểm.
  if (error.code === 'over_request_rate_limit') return 'Hệ thống đang nhận quá nhiều lượt đăng nhập từ mạng cơ quan. Đồng chí vui lòng chờ 5 phút rồi thử lại.';
  // Thông báo khoá 15 phút do hook password_verification_attempt trả về (tiếng Việt).
  if (error.code === 'invalid_credentials' && /khoá/.test(error.message)) return error.message;
  if (error.code === 'invalid_credentials') return 'Sai tên đăng nhập hoặc mật khẩu.';
  return 'Không đăng nhập được. Đồng chí vui lòng thử lại sau.';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = $('loginUsername').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  const btn = $('loginSubmitBtn');
  showInlineError('loginError', '');
  if (!username || !password) {
    // Form có novalidate để thông báo luôn bằng tiếng Việt thay vì câu của trình duyệt.
    showInlineError('loginError', 'Nhập tên đăng nhập và mật khẩu rồi bấm Đăng nhập.');
    return;
  }
  btn.disabled = true;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: `${username}@${AUTH_EMAIL_DOMAIN}`,
      password,
    });
    if (error) {
      showInlineError('loginError', loginErrorMessage(error));
      return;
    }
    await startSession(data.session);
  } finally {
    btn.disabled = false;
  }
}

// Nạp hồ sơ từ accounts_public theo auth.uid(), rồi vào app hoặc bắt đổi mật khẩu (AUTH-2).
export async function startSession(session) {
  const { data: profile, error } = await supabase
    .from('accounts_public').select('*').eq('id', session.user.id).single();
  if (error?.code === 'PGRST116' || (!error && !profile)) {
    // Có tài khoản Auth nhưng không có dòng accounts tương ứng: không cho vào.
    await supabase.auth.signOut();
    showInlineError('loginError', 'Tài khoản chưa được khai báo trong danh mục cán bộ. Đồng chí liên hệ Văn phòng để được hỗ trợ.');
    return;
  }
  if (error) {
    // Lỗi mạng/máy chủ tạm thời: giữ phiên, chỉ báo để thử lại.
    showInlineError('loginError', 'Không tải được hồ sơ cán bộ. Đồng chí vui lòng tải lại trang hoặc thử lại sau.');
    return;
  }
  state.user = profile;
  await loadAccountsCache();
  if (profile.must_change_password) {
    show('loginSection', false);
    show('changePasswordModal', true);
    $('newPassword').focus();
    return;
  }
  enterApp();
}

export function initLogin() {
  $('loginForm').addEventListener('submit', handleLogin);
}
