// Ảnh chụp GIÁ TRỊ theo vai (PR-2a, thiết kế §0.4 B): với MỌI tài khoản, dưới vai thật (giao dịch chỉ đọc) xuất
//   - v_nhiem_vu, v_ngoai_le: mọi cột của từng dòng (v_ngoai_le giữ cả THỨ TỰ dòng);
//   - kl_so_lieu_tai tại 14 ngày cố định + hôm nay; kl_so_chua_xu_ly.
// Giá trị được chuẩn hoá để so qua các lần nạp lại: uuid → khoá nghiệp vụ (mã việc, khoá văn bản, username), uuid khác → '#',
// timestamptz → ngày giờ Việt Nam (bộ vàng đặt cap_nhat_luc = now() lúc nạp ⇒ nạp lại và chụp trong cùng ngày).
// So sánh chỉ trên các cột có ở ảnh chụp TRƯỚC (cột mới thêm vào view được bỏ qua). CHỈ Supabase cục bộ (127.0.0.1).
// Dùng: node scripts/anh-chup-gia-tri.mjs --ra "D:\TU 2026\kiem-thu\pr-2\gia-tri-0047"
//       node scripts/anh-chup-gia-tri.mjs --so "<thư mục TRƯỚC>" "<thư mục SAU>"
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { psql, tachMoc, moVai } from './lib-cuc-bo.mjs';

export const NGAY = ['2025-01-01', '2025-07-01', '2025-12-31', '2026-03-15', '2026-06-30', '2026-08-31', '2026-09-14',
  '2026-09-28', '2026-10-15', '2026-11-30', '2026-12-31', '2027-03-31', '2027-06-30', '2027-12-31'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TS = /^(\d{4}-\d\d-\d\d)T(\d\d):\d\d:\d\d(\.\d+)?\+00:00$/;
const md5 = (s) => createHash('md5').update(s).digest('hex');
const bang = (sql) => psql(sql).trim().split(/\r?\n/).filter(Boolean).map((d) => d.split('|'));

function taoChuanHoa() {
  const ma = new Map([
    ...bang('SELECT id, \'NV:\' || ma FROM public.nhiem_vu;'),
    ...bang("SELECT id, 'VB:' || loai || '/' || coalesce(so_hoi_nghi::text, '') || '/' || so_ket_luan FROM public.van_ban_giao_viec;"),
    ...bang("SELECT id, 'TK:' || username FROM public.accounts;"),
  ]);
  const gioVN = (d, h) => { const t = new Date(`${d}T${h}:00:00Z`); t.setUTCHours(t.getUTCHours() + 7); return t.toISOString().slice(0, 13); };
  const ch = (v) => {
    if (Array.isArray(v)) return v.map(ch);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ch(v[k])]));
    if (typeof v !== 'string') return v;
    if (UUID.test(v)) return ma.get(v) ?? '#';
    const m = TS.exec(v);
    return m ? `VN ${gioVN(m[1], m[2]).slice(0, 10)}` : v;
  };
  return ch;
}

function chup(thuMuc) {
  const ch = taoChuanHoa();
  const taiKhoan = bang('SELECT id, username FROM public.accounts ORDER BY username;');
  const tuDien = {}; const theoVai = {}; const t0 = Date.now();
  const luu = (row) => { const j = JSON.stringify(row); const h = md5(j); tuDien[h] = row; return h; };
  const soLieu = [...NGAY.map((d) => `'${d}'::date`), 'public.kl_hom_nay()'];
  for (const [id, username] of taiKhoan) {
    const sql = [moVai(id),
      '\\echo @@v_nhiem_vu', 'SELECT to_jsonb(v) FROM public.v_nhiem_vu v;',
      '\\echo @@v_ngoai_le', 'SELECT to_jsonb(v) FROM public.v_ngoai_le v;',
      '\\echo @@so_lieu', ...soLieu.map((d) => `SELECT public.kl_so_lieu_tai(${d});`),
      '\\echo @@chua_xu_ly', 'SELECT public.kl_so_chua_xu_ly();', 'ROLLBACK;'].join('\n');
    const moc = tachMoc(psql(sql));
    const dong = (k) => (moc[k] || '').split(/\r?\n/).filter(Boolean).map((s) => ch(JSON.parse(s)));
    const nv = dong('v_nhiem_vu'); const nl = dong('v_ngoai_le');
    theoVai[username] = {
      v_nhiem_vu: Object.fromEntries(nv.map((r) => [r.ma, luu(r)])),
      v_ngoai_le: nl.map((r) => [r.ma, luu(r)]),
      so_lieu: Object.fromEntries(dong('so_lieu').map((r, i) => [i < NGAY.length ? NGAY[i] : 'hom_nay', r])),
      chua_xu_ly: dong('chua_xu_ly')[0],
    };
    if (nv.length !== new Set(nv.map((r) => r.ma)).size) console.warn(`CẢNH BÁO ${username}: mã việc trùng trong v_nhiem_vu`);
  }
  mkdirSync(thuMuc, { recursive: true });
  writeFileSync(join(thuMuc, 'tu-dien.json'), JSON.stringify(tuDien));
  writeFileSync(join(thuMuc, 'theo-vai.json'), JSON.stringify(theoVai));
  const giay = ((Date.now() - t0) / 1000).toFixed(0);
  writeFileSync(join(thuMuc, '_tom-tat.json'), JSON.stringify({ so_tai_khoan: taiKhoan.length, so_dong_khac_nhau: Object.keys(tuDien).length, ngay: NGAY, giay }, null, 2));
  console.log(`Đã chụp giá trị ${taiKhoan.length} tài khoản → ${thuMuc} (${giay} s, ${Object.keys(tuDien).length} dòng khác nhau)`);
}

function so(a, b) {
  const doc = (d, f) => JSON.parse(readFileSync(join(d, f), 'utf8'));
  const [ta, tb, va, vb] = [doc(a, 'tu-dien.json'), doc(b, 'tu-dien.json'), doc(a, 'theo-vai.json'), doc(b, 'theo-vai.json')];
  const cot = new Set(Object.values(ta).flatMap(Object.keys));
  const chieu = (r) => JSON.stringify(Object.fromEntries(Object.keys(r).filter((k) => cot.has(k)).map((k) => [k, r[k]])));
  const cotMoi = [...new Set(Object.values(tb).flatMap(Object.keys))].filter((k) => !cot.has(k));
  let khac = 0; const bao = (s) => { khac++; if (khac <= 30) console.log(s); };
  const soDong = (u, ten, x, y) => {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (!x[k] || !y[k]) { bao(`${ten} ${u} ${k}: chỉ có ở ${x[k] ? 'TRƯỚC' : 'SAU'}`); continue; }
      const ra = JSON.parse(chieu(ta[x[k]])); const rb = JSON.parse(chieu(tb[y[k]]));
      const lech = Object.keys(ra).filter((c) => JSON.stringify(ra[c]) !== JSON.stringify(rb[c]));
      if (lech.length) bao(`${ten} ${u} ${k}: lệch ${lech.map((c) => `${c}=${JSON.stringify(ra[c])}→${JSON.stringify(rb[c])}`).join(', ')}`);
    }
  };
  for (const u of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    const x = va[u]; const y = vb[u];
    if (!x || !y) { bao(`${u}: chỉ có ở ${x ? 'TRƯỚC' : 'SAU'}`); continue; }
    soDong(u, 'v_nhiem_vu', x.v_nhiem_vu, y.v_nhiem_vu);
    soDong(u, 'v_ngoai_le', Object.fromEntries(x.v_ngoai_le), Object.fromEntries(y.v_ngoai_le));
    if (x.v_ngoai_le.map((r) => r[0]).join() !== y.v_ngoai_le.map((r) => r[0]).join()) bao(`v_ngoai_le ${u}: THỨ TỰ dòng khác`);
    for (const d of Object.keys(x.so_lieu)) if (JSON.stringify(x.so_lieu[d]) !== JSON.stringify(y.so_lieu[d])) bao(`kl_so_lieu_tai ${u} ${d}: khác`);
    if (JSON.stringify(x.chua_xu_ly) !== JSON.stringify(y.chua_xu_ly)) bao(`kl_so_chua_xu_ly ${u}: khác`);
  }
  if (cotMoi.length) console.log(`Cột mới (bỏ qua khi so): ${cotMoi.join(', ')}`);
  console.log(khac ? `KHÁC: ${khac} điểm.` : `TRÙNG KHỚP GIÁ TRỊ: ${Object.keys(va).length} tài khoản × (v_nhiem_vu, v_ngoai_le + thứ tự, kl_so_lieu_tai ${NGAY.length}+1 ngày, kl_so_chua_xu_ly).`);
  process.exitCode = khac ? 1 : 0;
}

const i = process.argv.indexOf('--so');
if (i > 0) so(process.argv[i + 1], process.argv[i + 2]);
else {
  const j = process.argv.indexOf('--ra');
  if (j < 0) { console.error('Thiếu --ra <thư mục> hoặc --so <TRƯỚC> <SAU>.'); process.exit(1); }
  chup(process.argv[j + 1]);
}
