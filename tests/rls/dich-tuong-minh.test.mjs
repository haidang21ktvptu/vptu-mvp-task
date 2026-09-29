// Chốt chặn đích kiểm thử (PR-2a, sau sự cố 29/9/2026): nạp tests/rls/lib.mjs hoặc tests/e2e/lib/keys.mjs khi KHÔNG chọn đích (hoặc chọn
// hai đích) ⇒ tiến trình dừng mã 2 với thông báo rõ, và KHÔNG có lời gọi mạng nào — đếm bằng một tệp nạp trước (--import) bọc
// net.Socket#connect (mọi kết nối TCP: http, https, websocket), fetch và child_process (Supabase CLI). Không import lib.mjs ở tiến trình này.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const NAP_TRUOC = `import net from 'node:net'; import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
let n = 0;
const goc = net.Socket.prototype.connect; net.Socket.prototype.connect = function (...a) { n++; return goc.apply(this, a); };
for (const k of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) { const f = cp[k]; cp[k] = (...a) => { n++; return f(...a); }; }
syncBuiltinESMExports();
const f = globalThis.fetch; globalThis.fetch = (...a) => { n++; return f(...a); };
process.on('exit', () => process.stderr.write('\\nLOI_GOI_MANG=' + n + '\\n'));`;
const BIEN = ['RLS_LOCAL', 'RLS_STAGING', 'E2E_LOCAL', 'E2E_STAGING', 'KIEM_THU_MOI_TRUONG', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function napKhong(tep, them = {}) {
  const env = { ...process.env, ...them };
  for (const b of BIEN) if (!(b in them)) delete env[b];
  const url = new URL(tep, import.meta.url).href;
  const r = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(NAP_TRUOC)}`, '--input-type=module',
    '-e', `const m = await import(${JSON.stringify(url)}); m.getKeys(); console.log('KHONG_DUNG');`], { encoding: 'utf8', env, timeout: 30000 });
  return { ma: r.status, loi: r.stderr, ra: r.stdout, goi: Number(/LOI_GOI_MANG=(\d+)/.exec(r.stderr)?.[1]) };
}

describe('Đích kiểm thử phải chọn tường minh — thiếu/thừa thì dừng trước mọi lời gọi mạng', () => {
  for (const [bo, tep, B] of [['tests/rls', './lib.mjs', 'RLS'], ['tests/e2e', '../e2e/lib/keys.mjs', 'E2E']]) {
    test(`${bo}: không đặt biến đích ⇒ dừng mã 2, 0 lời gọi mạng`, () => {
      const r = napKhong(tep);
      assert.equal(r.ma, 2, r.loi);
      assert.match(r.loi, new RegExp(`\\[${B}\\] Chưa chọn đích kiểm thử`));
      assert.doesNotMatch(r.ra, /KHONG_DUNG/);
      assert.equal(r.goi, 0, 'không có lời gọi mạng / CLI nào');
    });
    test(`${bo}: chọn hai đích (${B}_LOCAL + ${B}_STAGING) ⇒ dừng mã 2, 0 lời gọi mạng`, () => {
      const r = napKhong(tep, { [`${B}_LOCAL`]: '1', [`${B}_STAGING`]: '1' });
      assert.equal(r.ma, 2, r.loi);
      assert.match(r.loi, /Chọn nhiều đích \(local, staging\)/);
      assert.equal(r.goi, 0);
    });
  }
});
