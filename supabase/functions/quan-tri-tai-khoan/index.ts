// Edge Function quan-tri-tai-khoan (GĐ23): việc cần service_role (tạo auth user, đặt mật khẩu tạm, khoá/mở) — key chỉ nằm trong secrets
// của function (SUPABASE_SERVICE_ROLE_KEY do Supabase cấp sẵn). Người gọi phải đăng nhập và có accounts.quan_tri_he_thong (kiểm bằng RPC
// me_quan_tri_he_thong với JWT của chính họ). Mọi hành động ghi nhat_ky_he_thong (0041). Mật khẩu tạm chỉ trả về MỘT lần trong response.
//   POST { hanh_dong: 'tao' | 'reset_mat_khau' | 'khoa' | 'mo' | 'cap_co', ... }  →  { ok, mat_khau_tam?, id? }
// Deploy: supabase functions deploy quan-tri-tai-khoan --project-ref <ref> (docs/KIEM-THU.md).
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMAIL_DOMAIN = 'vptu.caobang.local';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const loi = (message: string, status = 400) => json({ ok: false, error: message }, status);

// Mật khẩu tạm 10 ký tự: chữ hoa, chữ thường, số; bỏ ký tự dễ nhầm (0/O, 1/l/I).
function matKhauTam(): string {
  const bo = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const so = '23456789'; const chu = 'abcdefghijkmnpqrstuvwxyz';
  const rnd = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length];
  const mang = [rnd(so), rnd(chu), ...Array.from({ length: 8 }, () => rnd(bo))];
  for (let i = mang.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [mang[i], mang[j]] = [mang[j], mang[i]]; }
  return mang.join('');
}

const VAI = ['A0', 'A1', 'A2', 'A3'];
const USERNAME = /^[a-z0-9_.]{3,40}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return loi('Chỉ nhận POST.', 405);
  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return loi('Chưa đăng nhập.', 401);

  // 1. Người gọi: JWT của họ → RPC me_quan_tri_he_thong (RLS/hàm SQL là chốt, không tin frontend)
  const nguoiGoi = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: me, error: eMe } = await nguoiGoi.auth.getUser();
  if (eMe || !me?.user) return loi('Phiên không hợp lệ.', 401);
  const { data: laQtht, error: eQt } = await nguoiGoi.rpc('me_quan_tri_he_thong');
  if (eQt || laQtht !== true) return loi('Chỉ người có quyền quản trị hệ thống mới được thực hiện.', 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const ghiNhatKy = (hanh_dong: string, doi_tuong: string, chi_tiet: Record<string, unknown> = {}) =>
    admin.from('nhat_ky_he_thong').insert({ nguoi: me.user.id, hanh_dong, doi_tuong, chi_tiet });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return loi('Nội dung yêu cầu không phải JSON.'); }
  const hanhDong = String(body.hanh_dong || '');
  if (!['tao', 'reset_mat_khau', 'khoa', 'mo', 'cap_co'].includes(hanhDong)) return loi(`Hành động không hợp lệ: "${hanhDong}".`);
  const id = typeof body.id === 'string' ? body.id : '';
  const taiKhoan = id ? (await admin.from('accounts').select('id, username, full_name, is_system, quan_tri_he_thong').eq('id', id).maybeSingle()).data : null;
  if (hanhDong !== 'tao' && !taiKhoan) return loi('Không tìm thấy tài khoản.', 404);

  try {
    if (hanhDong === 'tao') {
      const username = String(body.username || '').trim().toLowerCase();
      const full_name = String(body.full_name || '').trim();
      const role_group = String(body.role_group || '');
      const position_title = String(body.position_title || '').trim();
      const department = body.department ? String(body.department) : null;
      const manager_id = body.manager_id ? String(body.manager_id) : null;
      if (!USERNAME.test(username)) return loi('Tên đăng nhập: 3–40 ký tự chữ thường, số, gạch dưới hoặc dấu chấm.');
      if (!full_name || !position_title) return loi('Thiếu họ tên hoặc chức danh.');
      if (!VAI.includes(role_group)) return loi('Vai trò không hợp lệ.');
      if (role_group !== 'A0' && !department) return loi('Phải chọn phòng cho vai A1/A2/A3.');
      const { data: trung } = await admin.from('accounts').select('id').eq('username', username).maybeSingle();
      if (trung) return loi(`Tên đăng nhập "${username}" đã có.`, 409);
      const mk = matKhauTam();
      const { data: u, error: eU } = await admin.auth.admin.createUser({ email: `${username}@${EMAIL_DOMAIN}`, password: mk, email_confirm: true });
      if (eU || !u.user) return loi(`Không tạo được tài khoản đăng nhập: ${eU?.message || ''}`, 500);
      const { error: eA } = await admin.from('accounts').insert({
        id: u.user.id, username, full_name, role_group, position_title, department: role_group === 'A0' ? null : department,
        manager_id, is_chief: body.is_chief === true && role_group === 'A1', must_change_password: true,
      });
      if (eA) { await admin.auth.admin.deleteUser(u.user.id); return loi(`Không ghi được hồ sơ cán bộ: ${eA.message}`, 500); }
      await ghiNhatKy('tao_tai_khoan', username, { full_name, role_group, department });
      return json({ ok: true, id: u.user.id, mat_khau_tam: mk });
    }
    if (hanhDong === 'reset_mat_khau') {
      const mk = matKhauTam();
      const { error } = await admin.auth.admin.updateUserById(id, { password: mk });
      if (error) return loi(`Không đặt được mật khẩu tạm: ${error.message}`, 500);
      await admin.from('accounts').update({ must_change_password: true }).eq('id', id);
      await ghiNhatKy('reset_mat_khau', taiKhoan!.username);
      return json({ ok: true, mat_khau_tam: mk });
    }
    if (hanhDong === 'khoa' || hanhDong === 'mo') {
      if (id === me.user.id) return loi('Không tự khoá tài khoản của mình.');
      if (hanhDong === 'khoa' && taiKhoan!.quan_tri_he_thong) return loi('Không khoá tài khoản quản trị hệ thống.');
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: hanhDong === 'khoa' ? '876000h' : 'none' });
      if (error) return loi(`Không ${hanhDong === 'khoa' ? 'khoá' : 'mở'} được: ${error.message}`, 500);
      await admin.from('accounts').update({ bi_khoa: hanhDong === 'khoa' }).eq('id', id);
      await ghiNhatKy(hanhDong === 'khoa' ? 'khoa_tai_khoan' : 'mo_tai_khoan', taiKhoan!.username, { ly_do: String(body.ly_do || '') });
      return json({ ok: true });
    }
    if (hanhDong === 'cap_co') {
      const co = String(body.co || ''); const bat = body.bat === true; const ly_do = String(body.ly_do || '').trim();
      if (!['quan_tri_kl', 'quan_tri_he_thong'].includes(co)) return loi('Cờ không hợp lệ.');
      if (!ly_do) return loi('Phải ghi lý do cấp/thu cờ.');
      if (co === 'quan_tri_he_thong' && id === me.user.id && !bat) return loi('Không tự thu quyền quản trị hệ thống của mình.');
      const doi: Record<string, unknown> = { [co]: bat };
      if (co === 'quan_tri_kl') doi.quan_tri_kl_het_han = null; // cấp thường trực: xoá hạn ủy quyền cũ (nếu có)
      const { error } = await admin.from('accounts').update(doi).eq('id', id);
      if (error) return loi(`Không đổi được cờ: ${error.message}`, 500);
      await admin.from('quyen_lich_su').insert({ cap_boi: me.user.id, cap_boi_ghi_chu: 'Edge Function quan-tri-tai-khoan', tai_khoan: id, co, bat, ly_do });
      await ghiNhatKy(bat ? 'cap_co' : 'thu_co', taiKhoan!.username, { co, ly_do });
      return json({ ok: true });
    }
    return loi(`Hành động không hợp lệ: "${hanhDong}".`);
  } catch (e) {
    return loi(`Lỗi xử lý: ${(e as Error).message}`, 500);
  }
});
