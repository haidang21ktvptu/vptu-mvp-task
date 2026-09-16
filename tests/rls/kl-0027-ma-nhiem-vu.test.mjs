// GĐ15 (0027, PR 15D) — mặc định mã nhiệm vụ không cắt số: đặt sequence tới 999 rồi chèn hai dòng → NV-1000, NV-1001 (4 chữ số,
// không trùng NV-100/NV-101 như lpad cũ); mã ≤ 999 vẫn đệm 3 chữ số. setval đi qua `supabase db query` (không có RPC chạy SQL);
// không có CLI/quyền → bỏ qua, không đỏ. Sequence được trả về giá trị cũ sau test; dòng thử tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { adminClient, assertOk, IDS, STAGING_REF } from './lib.mjs';
import { setupKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) ? false : 'Chưa có migration KL trên project này.';
const db = () => adminClient();
const dich = process.env.RLS_LOCAL === '1' ? ['--local'] : ['--linked', '--project-ref', process.env.RLS_PROJECT_REF || STAGING_REF];

// Chạy một câu SQL qua CLI; trả chuỗi kết quả thô (JSON) hoặc null khi CLI không chạy được.
function sql(cau) {
  // Windows chạy qua shell (không tự thoát đối số) → bọc SQL trong dấu nháy kép; SQL chỉ dùng nháy đơn.
  const win = process.platform === 'win32';
  const r = spawnSync('supabase', ['db', 'query', ...dich, win ? `"${cau}"` : cau], { encoding: 'utf8', shell: win });
  return r.status === 0 ? r.stdout : null;
}
// Đọc số theo tên cột: CLI có bản in JSON ({"khoa": 217}) và bản in bảng kẻ ô (│ khoa │ … │ 217 │) — giữa tên cột và giá trị không có chữ số.
const docSo = (raw, khoa) => Number((raw || '').match(new RegExp(`${khoa}[^\\d]*(\\d+)`))?.[1]);

let fx; let cu = null; const ids = [];
const chen = async (noiDung) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, nguoi_theo_doi: IDS.cv1, noi_dung: `KL-0027 ${noiDung}`, loai_thoi_han_ma: 'CO_HAN_CU_THE',
    han_xu_ly: '2026-12-31', owner_don_vi_ma: 'DANG_UY_UBND' }).select('id, ma').single();
  assertOk(r, noiDung); ids.push(r.data.id); return r.data.ma;
};

describe('0027 — mã nhiệm vụ không cắt số khi sequence vượt 999', { skip: SKIP }, () => {
  before(async () => { fx = await setupKlFixtures(); });
  after(async () => {
    if (ids.length) await db().from('nhiem_vu').delete().in('id', ids);
    if (cu) sql(`SELECT setval('public.nhiem_vu_ma_seq', ${cu}, true)`);
  });

  test('sequence 999 → chèn hai dòng được NV-1000, NV-1001; mã 3 chữ số vẫn đệm 0', async (t) => {
    const raw = sql('SELECT last_value AS gia_tri FROM public.nhiem_vu_ma_seq');
    if (raw === null) { t.skip('Không chạy được `supabase db query` (CLI chưa login hoặc chưa link) — bỏ qua case sequence.'); return; }
    cu = docSo(raw, 'gia_tri');
    assert.ok(cu > 0, `đọc last_value: ${raw.slice(0, 200)}`);
    assert.ok(sql("SELECT setval('public.nhiem_vu_ma_seq', 999, true)") !== null, 'setval 999');
    assert.equal(await chen('1000'), 'NV-1000');
    assert.equal(await chen('1001'), 'NV-1001');
    // Về dưới 999 sau khi dọn: mã ngắn vẫn đệm đủ 3 chữ số (không đổi so với 0014).
    await db().from('nhiem_vu').delete().in('id', ids.splice(0));
    assert.ok(sql(`SELECT setval('public.nhiem_vu_ma_seq', ${Math.max(cu, 185)}, true)`) !== null, 'setval về giá trị cũ');
    assert.match(await chen('sau'), /^NV-\d{3,}$/);
  });
});
