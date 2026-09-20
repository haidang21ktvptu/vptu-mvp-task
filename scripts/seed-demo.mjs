// Nạp tài khoản demo (demo_*, demo_e2e_*, smoke_test) + phân công PCVP phụ trách phòng giả cho kiểm thử RLS/e2e lên MỘT project bất kỳ
// bằng service_role — an toàn khi chạy lại (idempotent), KHÔNG chạm dữ liệu thật: chỉ tạo auth user + dòng accounts còn thiếu (cùng id với
// supabase/seed.sql), không sửa dòng đã có; rồi nạp bộ dữ liệu mẫu E2E-SEED (seed-demo-du-lieu.mjs, idempotent) để e2e chạy được trên DB rỗng.
//
//   node scripts/seed-demo.mjs [--project-ref <ref>] [--dry-run]
//   Key: biến môi trường SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (CI) → hoặc Supabase CLI đã `supabase login` với --project-ref.
//   Project production chỉ chạy khi KIEM_THU_MOI_TRUONG=production (công tắc kiểm thử, docs/KIEM-THU.md).
//
// Mật khẩu chung 123456 gửi dưới dạng bcrypt hash (không qua chính sách độ dài của GoTrue), như scripts/create-auth-users.mjs.
// Phân công phụ trách phòng chỉ chèn khi phòng đó CHƯA có phân công đang hiệu lực (trên production phòng thật có lãnh đạo thật → bỏ qua,
// một số test RLS về phạm vi PCVP sẽ đỏ — chấp nhận, xem docs/KIEM-THU.md).
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { napDuLieuMau, napPhongThu } from './seed-demo-du-lieu.mjs';

const EMAIL_DOMAIN = 'vptu.caobang.local';
const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';
const MAT_KHAU = '123456';
const ID = (n) => `00000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
// Thứ tự = seed.sql (quản lý trước, cấp dưới sau vì manager_id là FK).
const TAI_KHOAN = [
  [1, 'demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'Chánh Văn phòng', null, 'LANH_DAO_VAN_PHONG', true, false, false],
  [2, 'demo_pcvp', 'Demo Phó Chánh Văn phòng', 'A1', 'Phó Chánh Văn phòng (Phụ trách Tổng hợp)', null, 'LANH_DAO_VAN_PHONG', false, false, false],
  [6, 'demo_pcvp2', 'Demo Phó Chánh Văn phòng Hai', 'A1', 'Phó Chánh Văn phòng (Phụ trách Quản trị)', null, 'LANH_DAO_VAN_PHONG', false, false, false],
  [3, 'demo_truongphong', 'Demo Trưởng phòng', 'A2', 'Trưởng phòng', 2, 'TONG_HOP', false, false, false],
  [4, 'demo_cv1', 'Demo Chuyên viên Một', 'A3', 'Chuyên viên', 2, 'TONG_HOP', false, false, false],
  [5, 'demo_cv2', 'Demo Chuyên viên Hai', 'A3', 'Chuyên viên', 6, 'QUAN_TRI', false, false, false],
  [7, 'smoke_test', 'Tài khoản kiểm thử hệ thống', 'A3', 'Kiểm thử hệ thống', null, 'CDS_CY', false, true, false],
  [8, 'demo_qtht', 'Demo Quản trị hệ thống', 'A3', 'Chuyên viên', null, 'CDS_CY', false, false, true],
  [9, 'demo_a0', 'Demo Thường trực Tỉnh ủy', 'A0', 'Thường trực Tỉnh ủy', null, null, false, false, false],
  [10, 'demo_e2e_kl', 'Demo E2E Chuyên viên KL', 'A3', 'Chuyên viên', null, 'TONG_HOP', false, false, false],
  [11, 'demo_e2e_mc', 'Demo E2E Chuyên viên MC', 'A3', 'Chuyên viên', null, 'TONG_HOP', false, false, false],
  [12, 'demo_e2e_nv', 'Demo E2E Chuyên viên NV', 'A3', 'Chuyên viên', null, 'TONG_HOP', false, false, false],
  [13, 'demo_e2e_dh', 'Demo E2E Chuyên viên DH', 'A3', 'Chuyên viên', null, 'TONG_HOP', false, false, false],
  [14, 'demo_e2e_owner', 'Demo E2E Chuyên viên Owner', 'A3', 'Chuyên viên', null, 'TONG_HOP', false, false, false],
  [15, 'demo_e2e_tp', 'Demo E2E Trưởng phòng RT', 'A2', 'Trưởng phòng', null, 'E2E_RT', false, false, false],
  [16, 'demo_e2e_cv', 'Demo E2E Chuyên viên RT', 'A3', 'Chuyên viên', null, 'E2E_RT', false, false, false],
  [17, 'demo_e2e_cv2', 'Demo E2E Chuyên viên GL', 'A3', 'Chuyên viên', null, 'E2E_RT', false, false, false], // giao lại đổi chủ trì (0045): chủ trì mới cùng phòng E2E_RT
];
const PHU_TRACH = [[2, 'TONG_HOP'], [6, 'QUAN_TRI']];

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}
function keys(ref) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  if (!ref) throw new Error('Cần --project-ref <ref> hoặc SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
  const data = runCli(['projects', 'api-keys', '--project-ref', ref, '-o', 'json']);
  const list = Array.isArray(data) ? data : data.keys;
  const svc = list.find((k) => k.id === 'service_role' || k.name === 'service_role');
  if (!svc) throw new Error('Không tìm thấy service_role key qua CLI (đã `supabase login` chưa?).');
  return { url: `https://${ref}.supabase.co`, key: svc.api_key };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const ref = argv.includes('--project-ref') ? argv[argv.indexOf('--project-ref') + 1] : null;
  const k = keys(ref);
  if (k.url.includes(PRODUCTION_REF) && process.env.KIEM_THU_MOI_TRUONG !== 'production') {
    throw new Error('Project production: chỉ nạp khi KIEM_THU_MOI_TRUONG=production (docs/KIEM-THU.md).');
  }
  const db = createClient(k.url, k.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const hash = bcrypt.hashSync(MAT_KHAU, 10);
  const kq = { tao: [], daCo: [], boQua: [] };
  for (const [n, username, full_name, role_group, position_title, ql, department, is_chief, is_system, quan_tri_he_thong] of TAI_KHOAN) {
    const id = ID(n);
    const { data: u } = await db.auth.admin.getUserById(id);
    const { data: acc, error } = await db.from('accounts').select('id, username').or(`id.eq.${id},username.eq.${username}`);
    if (error) throw new Error(`Đọc accounts: ${error.message}`);
    if (u?.user && acc.some((a) => a.id === id)) { kq.daCo.push(username); continue; }
    if (acc.some((a) => a.username === username && a.id !== id)) { kq.boQua.push(`${username} (đã có với id khác — tài khoản thật, không đụng)`); continue; }
    if (dryRun) { kq.tao.push(username); continue; }
    if (!u?.user) {
      const r = await db.auth.admin.createUser({ id, email: `${username}@${EMAIL_DOMAIN}`, password_hash: hash, email_confirm: true, user_metadata: { username, full_name } });
      if (r.error) throw new Error(`Tạo auth ${username}: ${r.error.message}`);
    }
    if (!acc.some((a) => a.id === id)) {
      const r = await db.from('accounts').insert({ id, username, full_name, role_group, position_title, manager_id: ql ? ID(ql) : null, department, is_chief,
        must_change_password: false, is_system, quan_tri_he_thong });
      if (r.error) throw new Error(`Tạo accounts ${username}: ${r.error.message}`);
    }
    kq.tao.push(username);
  }
  const pt = { tao: [], daCo: [], boQua: [] };
  for (const [n, phong] of PHU_TRACH) {
    const { data, error } = await db.from('phu_trach_phong').select('lanh_dao_id').eq('phong', phong).is('den_ngay', null);
    if (error) throw new Error(`Đọc phu_trach_phong: ${error.message}`);
    if (data.some((p) => p.lanh_dao_id === ID(n))) { pt.daCo.push(phong); continue; }
    if (data.length) { pt.boQua.push(`${phong} (đang có lãnh đạo thật phụ trách — không đụng)`); continue; }
    if (!dryRun) {
      const r = await db.from('phu_trach_phong').insert({ lanh_dao_id: ID(n), phong, tu_ngay: '2026-01-01', ly_do: 'seed kiểm thử' });
      if (r.error) throw new Error(`Phân công ${phong}: ${r.error.message}`);
    }
    pt.tao.push(phong);
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}Tài khoản: tạo ${kq.tao.length} [${kq.tao.join(', ')}] · đã có ${kq.daCo.length} · bỏ qua ${kq.boQua.length} ${kq.boQua.join('; ')}`);
  console.log(`Phụ trách phòng: tạo [${pt.tao.join(', ')}] · đã có [${pt.daCo.join(', ')}] · bỏ qua ${pt.boQua.join('; ')}`);
  await napPhongThu(db, dryRun);
  await napDuLieuMau(db, dryRun);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
