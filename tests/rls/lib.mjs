// Tiện ích chung cho test RLS: client theo từng tài khoản seed (token thật), client
// service_role để dựng dữ liệu mẫu, và các hàm khẳng định "bị chặn".
//
// Đích chọn tường minh (DICH bên dưới — không có mặc định). Key: cục bộ từ `supabase status`; staging/production từ biến môi trường
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (CI: GitHub Secrets) hoặc Supabase CLI đã `supabase login`.
// Không có .env chứa service_role; production chỉ khi KIEM_THU_MOI_TRUONG=production.
// Chạy với --test-isolation=none để phiên đăng nhập dùng chung giữa các file
// (tránh vượt giới hạn 30 lượt đăng nhập/5 phút/IP của Supabase).

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import './dem-goi.mjs'; // đếm lời gọi HTTP khi DEM_GOI đặt (PR-2a, D3)
import { createClient } from '@supabase/supabase-js';

export const STAGING_REF = 'vojmrjezspdftovzinek';
export const PRODUCTION_REF = 'frwyxcmbonjaimziiuqr';
export const SEED_PASSWORD = '123456';
// Công tắc kiểm thử (docs/KIEM-THU.md): KIEM_THU_MOI_TRUONG=production cho phép trỏ project production; các file gọi canh_bao_quet / xoá
// tin hệ thống sau mốc t0 tự bỏ qua ở chế độ này (chúng gửi cảnh báo thật, xoá tin thật).
export const LA_PRODUCTION = process.env.KIEM_THU_MOI_TRUONG === 'production';
export const BO_QUA_PRODUCTION = 'Bỏ qua trên production: test gọi canh_bao_quet (gửi cảnh báo tới mọi việc thật) hoặc xoá tin hệ thống sau t0.';
export const EMAIL_DOMAIN = 'vptu.caobang.local';

// Đích kiểm thử phải chọn TƯỜNG MINH, đúng một (PR-2a, sau sự cố 29/9/2026 — chạy nhầm lên staging vì thiếu biến cục bộ):
//   RLS_LOCAL=1 (Supabase cục bộ) | RLS_STAGING=1 (staging) | KIEM_THU_MOI_TRUONG=production (công tắc kiểm thử, docs/KIEM-THU.md).
// Thiếu hoặc thừa ⇒ dừng NGAY khi nạp module, trước mọi lời gọi mạng (kể cả Supabase CLI).
function chonDich() {
  const env = process.env;
  const ds = [env.RLS_LOCAL === '1' && 'local', env.RLS_STAGING === '1' && 'staging', env.KIEM_THU_MOI_TRUONG === 'production' && 'production'].filter(Boolean);
  if (ds.length === 1) return ds[0];
  console.error(`[RLS] ${ds.length ? `Chọn nhiều đích (${ds.join(', ')})` : 'Chưa chọn đích kiểm thử'} — đặt đúng một: RLS_LOCAL=1 (Supabase cục bộ) | `
    + 'RLS_STAGING=1 (staging) | KIEM_THU_MOI_TRUONG=production. Dừng, chưa có lời gọi mạng nào.');
  process.exit(2);
}
export const DICH = chonDich();

// id cố định trong supabase/seed.sql
export const IDS = {
  cvp: '00000000-0000-4000-8000-000000000001',
  pcvp: '00000000-0000-4000-8000-000000000002',
  truongphong: '00000000-0000-4000-8000-000000000003',
  cv1: '00000000-0000-4000-8000-000000000004',
  cv2: '00000000-0000-4000-8000-000000000005',
  pcvp2: '00000000-0000-4000-8000-000000000006',
  qtht: '00000000-0000-4000-8000-000000000008',
  a0: '00000000-0000-4000-8000-000000000009',
};

function runCli(args) {
  const r = spawnSync('supabase', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`supabase ${args.join(' ')} thất bại: ${r.stderr || r.stdout}`);
  const starts = [r.stdout.indexOf('{'), r.stdout.indexOf('[')].filter((i) => i >= 0);
  return JSON.parse(r.stdout.slice(Math.min(...starts)));
}

let keys = null;
export function getKeys() {
  if (keys) return keys;
  const env = process.env;
  if (DICH === 'local') {
    const s = runCli(['status', '-o', 'json']);
    keys = { url: s.API_URL, anon: s.ANON_KEY || s.PUBLISHABLE_KEY, service: s.SERVICE_ROLE_KEY || s.SECRET_KEY };
  } else if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY) {   // CI: GitHub Secrets của đích đã chọn
    keys = { url: env.SUPABASE_URL, anon: env.SUPABASE_ANON_KEY, service: env.SUPABASE_SERVICE_ROLE_KEY };
  } else {   // máy dev: Supabase CLI đã `supabase login`
    const data = runCli(['projects', 'api-keys', '--project-ref', DICH === 'staging' ? STAGING_REF : PRODUCTION_REF, '-o', 'json']);
    const list = Array.isArray(data) ? data : data.keys;
    const pick = (id) => list.find((k) => k.id === id || k.name === id)?.api_key;
    keys = { url: `https://${DICH === 'staging' ? STAGING_REF : PRODUCTION_REF}.supabase.co`, anon: pick('anon'), service: pick('service_role') };
  }
  const ref = { staging: STAGING_REF, production: PRODUCTION_REF }[DICH];
  if (ref && !keys.url.includes(ref)) throw new Error(`Đích ${DICH} nhưng SUPABASE_URL không phải project ${ref}.`);
  if (!keys.anon || !keys.service) throw new Error('Không lấy được anon/service_role key.');
  // Test tạo/xoá dữ liệu bằng service_role nên tuyệt đối không được trỏ vào production.
  if (keys.url.includes(PRODUCTION_REF) && !LA_PRODUCTION) throw new Error('Từ chối chạy test trên project production (đặt KIEM_THU_MOI_TRUONG=production nếu cố ý — docs/KIEM-THU.md).');
  return keys;
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } };

export function anonClient() {
  const k = getKeys();
  return createClient(k.url, k.anon, opts);
}

export function adminClient() {
  const k = getKeys();
  return createClient(k.url, k.service, opts);
}

// Chạy các lời gọi ĐỘC LẬP song song, tối đa gioiHan cùng lúc (mặc định 4), giữ thứ tự kết quả — PR-2a D3: trên staging mỗi lời gọi
// ≈ 0,25 s độ trễ mạng nên gộp lượt khứ hồi rút ngắn cả bộ. Chỉ dùng cho ca không phụ thuộc nhau (đọc, ghi bị chặn, ghi khác dòng).
export async function songSong(ds, gioiHan = 4) {
  const kq = new Array(ds.length); let i = 0;
  const chay = async () => { while (i < ds.length) { const j = i++; kq[j] = await ds[j](); } };
  await Promise.all(Array.from({ length: Math.min(gioiHan, ds.length) }, chay));
  return kq;
}

// Phân công seed dùng chung demo_pcvp2 ↔ E2E_RT (seed.sql / seed-demo.mjs, D1 PR-2a). Ca bật pcvp2 ↔ phòng khác vướng giới hạn 2 phòng nên
// tạm kết thúc dòng này (datPcvp2E2ERT('2026-08-31') — trước kỳ bật) rồi trả GIÁ TRỊ GỐC ghi cứng (datPcvp2E2ERT()) ở before, finally, after.
// Project chưa có dòng này (chưa nạp seed mới) thì không tạo, không đụng.
export const E2E_RT_GOC = { phong: 'E2E_RT', tu_ngay: '2026-01-01', den_ngay: null, ly_do: 'seed kiểm thử' };
export async function datPcvp2E2ERT(denNgay) {
  const db = adminClient();
  const r = await db.from('phu_trach_phong').select('id').eq('lanh_dao_id', IDS.pcvp2).eq('phong', E2E_RT_GOC.phong)
    .eq('tu_ngay', E2E_RT_GOC.tu_ngay).is('nganh_ma', null);
  if (!r.data?.length) return;
  const gt = denNgay === undefined ? { den_ngay: E2E_RT_GOC.den_ngay, ly_do: E2E_RT_GOC.ly_do } : { den_ngay: denNgay };
  assertOk(await db.from('phu_trach_phong').update(gt).in('id', r.data.map((x) => x.id)), 'đặt phân công pcvp2 ↔ E2E_RT');
}

const users = new Map();
// Client đã đăng nhập bằng tài khoản seed (username: demo_cvp, demo_cv1, ...).
export async function userClient(username) {
  // Nhớ PROMISE (không phải client) để các lời gọi song song (songSong) dùng chung một lần đăng nhập.
  if (!users.has(username)) {
    const k = getKeys();
    const c = createClient(k.url, k.anon, opts);
    users.set(username, c.auth.signInWithPassword({ email: `${username}@${EMAIL_DOMAIN}`, password: SEED_PASSWORD }).then(({ error }) => {
      if (error) { users.delete(username); throw new Error(`Đăng nhập ${username} thất bại: ${error.message}`); }
      return c;
    }));
  }
  return users.get(username);
}

// Khẳng định: ghi bị RLS/quyền chặn (PostgREST trả 42501 hoặc lỗi quyền).
export function assertDenied(result, label) {
  assert.ok(result.error, `${label}: phải bị chặn nhưng không có lỗi`);
  assert.ok(
    ['42501', 'PGRST301', '42P01'].includes(result.error.code) || /permission|row-level|policy|not allowed/i.test(result.error.message),
    `${label}: lỗi không phải lỗi quyền: ${result.error.code} ${result.error.message}`,
  );
}

// Khẳng định: UPDATE bị RLS lọc hết (không lỗi, 0 dòng).
export function assertNoRows(result, label) {
  assert.equal(result.error, null, `${label}: lỗi bất ngờ ${result.error?.message}`);
  assert.equal((result.data || []).length, 0, `${label}: phải 0 dòng`);
}

export function assertOk(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message}`);
}

export function ids(rows) {
  return (rows || []).map((r) => r.id ?? r.task_id);
}
