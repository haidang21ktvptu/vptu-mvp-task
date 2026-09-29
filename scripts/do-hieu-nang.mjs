// Đo hiệu năng bộ truy vấn CỐ ĐỊNH của màn Điều hành dưới vai thật (thiết kế PR-2 mục B8) — CHỈ Supabase cục bộ (127.0.0.1).
// Mỗi (vai, câu): giao dịch chỉ đọc, SET LOCAL track_functions = 'all', ROLE authenticated + request.jwt.claims,
// EXPLAIN (ANALYZE, BUFFERS, TIMING OFF) câu đã bọc json_agg như PostgREST; đọc pg_stat_xact_user_functions; ROLLBACK.
// 1 lần làm ấm + 5 lần đo, lấy trung vị. Cần dữ liệu tổng hợp (tests/perf/sinh-du-lieu-tong-hop.mjs).
// Dùng: node scripts/do-hieu-nang.mjs --ra "D:\TU 2026\kiem-thu\pr-2\do-truoc.md" [--nhan "0047"]
//       node scripts/do-hieu-nang.mjs --plan <vai> <câu>        (in EXPLAIN ANALYZE VERBOSE dạng chữ, để soi kế hoạch)
import { writeFileSync } from 'node:fs';
import { psql, tachMoc, moVai } from './lib-cuc-bo.mjs';

const SO_LAN = 5;
// Vai đo (B8) → username trong dữ liệu tổng hợp; "A3_IT" chọn động: A3 có ít việc nhất.
const VAI = {
  A0: 'th_a0_01', CVP: 'th_cvp', PCVP: 'th_pcvp_01', PCVP_KIEM_NHIEM: 'th_pcvp_02', A2: 'th_tp_01',
  A3_IT: null, A3_QUAN_TRI_KL: 'th_cv_01', THU_KY: 'th_tp_05',
};
// Câu frontend gửi khi mở Điều hành (views/shared/dieu-hanh/du-lieu.js), cộng các câu liên quan.
const CAU = {
  v_nhiem_vu: 'SELECT * FROM public.v_nhiem_vu ORDER BY ma',
  lich_su_xac_nhan: "SELECT nhiem_vu_id, nguoi_sua FROM public.lich_su WHERE cot = 'xac_nhan_nhan_viec'",
  tu_choi: 'SELECT id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, ly_do, tao_luc, trang_thai, y_kien_duyet, duyet_luc FROM public.tu_choi ORDER BY tao_luc DESC',
  v_ngoai_le: 'SELECT * FROM public.v_ngoai_le',
  v_chi_dao_tt: 'SELECT * FROM public.v_chi_dao_tt',
  minh_chung_cho: 'SELECT id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, cap_nhan, trich_yeu, mo_ta_ket_qua, nop_boi, nop_luc FROM public.minh_chung WHERE hop_le IS NULL ORDER BY nop_luc DESC',
  chi_dao_cho: "SELECT id, nhiem_vu_id, loai, noi_dung, nguoi_gui, nguoi_nhan, han_phan_hoi, created_at, tra_loi_cho FROM public.chi_dao WHERE trang_thai = 'CHO_PHAN_HOI' AND loai <> 'PHAN_HOI' ORDER BY created_at",
  so_lieu_hom_nay: 'SELECT public.kl_so_lieu_tai(p_ngay => public.kl_hom_nay()) AS kq',
  so_lieu_7_ngay: "SELECT public.kl_so_lieu_tai(p_ngay => public.kl_hom_nay() - 7) AS kq",
  // ngoài Điều hành
  kl_so_chua_xu_ly: 'SELECT public.kl_so_chua_xu_ly() AS kq',
  v_ngoai_le_eq_id: "SELECT * FROM public.v_ngoai_le WHERE id = '{ID_NGOAI_LE}'",
  v_minh_chung: 'SELECT * FROM public.v_minh_chung',
};
const DIEU_HANH = ['v_nhiem_vu', 'lich_su_xac_nhan', 'tu_choi', 'v_ngoai_le', 'v_chi_dao_tt', 'minh_chung_cho', 'chi_dao_cho', 'so_lieu_hom_nay', 'so_lieu_7_ngay'];
const HAM_THEO_DOI = ['kl_pham_vi', 'kl_thay_nhiem_vu', 'kl_pham_vi_pcvp', 'trang_thai', 'kl_nguong_do_khan', 'me_role', 'me_quan_tri_kl', 'kl_phong_owner'];

const boc = (sql) => `SELECT coalesce(json_agg(_t), '[]') FROM (${sql}) _t`;
const trungVi = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const tim = (sql) => psql(sql).trim();

function chuanBi() {
  const id = {};
  for (const d of tim("SELECT username, id FROM public.accounts WHERE username LIKE 'th\\_%';").split(/\r?\n/)) { const [u, i] = d.split('|'); id[u] = i; }
  if (!id.th_cvp) { console.error('DỪNG: chưa có dữ liệu tổng hợp — chạy tests/perf/sinh-du-lieu-tong-hop.mjs trước.'); process.exit(1); }
  VAI.A3_IT = tim(`SELECT a.username FROM public.accounts a WHERE a.username LIKE 'th\\_cv\\_%' AND NOT a.quan_tri_kl
    ORDER BY (SELECT count(*) FROM public.nhiem_vu n WHERE a.id IN (n.nguoi_theo_doi, n.owner_tai_khoan)), a.username LIMIT 1;`);
  return id;
}

// id việc ngoại lệ dùng cho v_ngoai_le.eq(id): việc Đỏ mà vai đang đo thấy được (lấy mã nhỏ nhất).
function idNgoaiLe(uid) {
  const out = psql(`${moVai(uid)}\n\\echo @@id\nSELECT id FROM public.v_ngoai_le ORDER BY ma LIMIT 1;\nROLLBACK;`);
  return (tachMoc(out).id || '').trim() || '00000000-0000-0000-0000-000000000000';
}

function doMot(uid, sql) {
  const khoi = [];
  for (let k = 0; k <= SO_LAN; k++) {
    khoi.push(moVai(uid, { thongKeHam: true }), `\\echo @@plan${k}`, `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${boc(sql)};`,
      'RESET ROLE;', `\\echo @@ham${k}`,
      "SELECT coalesce(json_agg(json_build_object('f', funcname, 'c', calls, 't', total_time)), '[]') FROM pg_stat_xact_user_functions;", 'ROLLBACK;');
  }
  const moc = tachMoc(psql(khoi.join('\n')));
  const lan = [];
  for (let k = 1; k <= SO_LAN; k++) {
    const p = JSON.parse(moc[`plan${k}`])[0]; const ham = JSON.parse(moc[`ham${k}`]);
    const goi = Object.fromEntries(ham.map((h) => [h.f, h.c]));
    lan.push({ ms: p['Execution Time'] + p['Planning Time'], hit: p.Plan['Shared Hit Blocks'] + p.Plan['Shared Read Blocks'],
      dong: p.Plan.Plans?.[0]?.['Actual Rows'] ?? p.Plan['Actual Rows'], goi, tongGoi: ham.reduce((s, h) => s + h.c, 0) });
  }
  const goi = Object.fromEntries(HAM_THEO_DOI.map((f) => [f, trungVi(lan.map((l) => l.goi[f] || 0))]));
  return { ms: trungVi(lan.map((l) => l.ms)), hit: trungVi(lan.map((l) => l.hit)), dong: lan[0].dong, tongGoi: trungVi(lan.map((l) => l.tongGoi)), goi };
}

// Mô phỏng kiểm RLS của Realtime: mỗi thay đổi 1 việc → mỗi người đang theo dõi chạy policy SELECT trên đúng dòng đó.
function doRealtime(id) {
  const tk = Object.entries(id).filter(([u]) => /^th_/.test(u));
  const viec = tim("SELECT id FROM public.nhiem_vu WHERE ma = (SELECT min(ma) FROM public.nhiem_vu WHERE ma LIKE 'TH-%' AND tien_do_ma <> 'HOAN_THANH' AND owner_don_vi_ma = 'TONG_HOP');");
  const khoi = tk.flatMap(([, uid], k) => [moVai(uid, { thongKeHam: true }), `\\echo @@p${k}`,
    `EXPLAIN (ANALYZE, TIMING OFF, FORMAT JSON) SELECT 1 FROM public.nhiem_vu WHERE id = '${viec}';`, 'RESET ROLE;', `\\echo @@h${k}`,
    "SELECT coalesce(sum(calls) FILTER (WHERE funcname = 'kl_pham_vi'), 0) FROM pg_stat_xact_user_functions;", 'ROLLBACK;']);
  const moc = tachMoc(psql(khoi.join('\n')));
  let ms = 0; let goi = 0; let thay = 0;
  tk.forEach((_, k) => { const p = JSON.parse(moc[`p${k}`])[0]; ms += p['Execution Time'] + p['Planning Time']; thay += p.Plan['Actual Rows']; goi += Number(moc[`h${k}`].trim()); });
  return { so_nguoi: tk.length, ms, goi_kl_pham_vi: goi, so_nguoi_thay: thay };
}

const f1 = (x) => (x === undefined ? '-' : x.toFixed(1));

function baoCao(nhan, kq, rt, ghiChu) {
  const vai = Object.keys(kq);
  const L = [`# Đo hiệu năng — ${nhan}`, '', ghiChu, '',
    '## Tổng thời gian DB một lần mở Điều hành (9 câu, trung vị mỗi câu, ms)', '',
    `| Vai (tài khoản) | Tổng ms | Số dòng v_nhiem_vu | Lời gọi kl_pham_vi (9 câu) | Lời gọi trang_thai (9 câu) |`, '|---|---:|---:|---:|---:|'];
  for (const v of vai) {
    const c = DIEU_HANH.map((k) => kq[v][k]);
    L.push(`| ${v} (${VAI[v]}) | ${f1(c.reduce((s, x) => s + x.ms, 0))} | ${kq[v].v_nhiem_vu.dong} | ${c.reduce((s, x) => s + x.goi.kl_pham_vi, 0)} | ${c.reduce((s, x) => s + x.goi.trang_thai, 0)} |`);
  }
  L.push('', '## Chi tiết từng câu', '', 'Cột: ms (trung vị 5 lần) · block (shared hit+read) · dòng · lời gọi kl_pham_vi / kl_thay_nhiem_vu / kl_pham_vi_pcvp / trang_thai · tổng lời gọi hàm được theo dõi (track_functions=all).', '');
  for (const v of vai) {
    L.push(`### ${v} (${VAI[v]})`, '', '| Câu | ms | block | dòng | kl_pham_vi | kl_thay_nhiem_vu | kl_pham_vi_pcvp | trang_thai | tổng lời gọi hàm |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const [k, x] of Object.entries(kq[v])) L.push(`| ${k} | ${f1(x.ms)} | ${x.hit} | ${x.dong} | ${x.goi.kl_pham_vi} | ${x.goi.kl_thay_nhiem_vu} | ${x.goi.kl_pham_vi_pcvp} | ${x.goi.trang_thai} | ${x.tongGoi} |`);
    L.push('');
  }
  L.push('## Mô phỏng kiểm RLS của Realtime (1 thay đổi việc, mọi tài khoản tổng hợp)', '',
    `${rt.so_nguoi} người · tổng ${f1(rt.ms)} ms · ${rt.goi_kl_pham_vi} lời gọi kl_pham_vi · ${rt.so_nguoi_thay} người thấy dòng.`, '');
  return L.join('\n');
}

const iPlan = process.argv.indexOf('--plan');
if (iPlan > 0) {
  const id = chuanBi(); const uid = id[VAI[process.argv[iPlan + 1]]]; const sql = CAU[process.argv[iPlan + 2]].replace('{ID_NGOAI_LE}', idNgoaiLe(uid));
  console.log(psql(`${moVai(uid)}\nEXPLAIN (ANALYZE, VERBOSE, BUFFERS, FORMAT TEXT) ${boc(sql)};\nROLLBACK;`));
} else {
  const iRa = process.argv.indexOf('--ra');
  if (iRa < 0) { console.error('Thiếu --ra <tệp .md>.'); process.exit(1); }
  const iNhan = process.argv.indexOf('--nhan'); const nhan = iNhan > 0 ? process.argv[iNhan + 1] : 'migration hiện tại';
  const id = chuanBi(); const kq = {}; const t0 = Date.now();
  for (const [v, u] of Object.entries(VAI)) {
    kq[v] = {}; const eq = idNgoaiLe(id[u]);
    for (const [k, sql] of Object.entries(CAU)) kq[v][k] = doMot(id[u], sql.replace('{ID_NGOAI_LE}', eq));
    console.log(`${v}: xong (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const rt = doRealtime(id);
  const dem = tim("SELECT (SELECT count(*) FROM public.nhiem_vu) || ' việc, ' || (SELECT count(*) FROM public.accounts) || ' tài khoản';");
  const ghiChu = `Supabase cục bộ (Postgres 17), ${dem}; ngày đo ${new Date().toISOString().slice(0, 10)}; ${SO_LAN} lần đo + 1 làm ấm, EXPLAIN ANALYZE TIMING OFF (có chi phí đo, chỉ so tỉ lệ trước/sau).`;
  writeFileSync(process.argv[iRa + 1], baoCao(nhan, kq, rt, ghiChu));
  writeFileSync(process.argv[iRa + 1].replace(/\.md$/, '.json'), JSON.stringify({ nhan, VAI, kq, rt }, null, 1));
  console.log(`Đã ghi ${process.argv[iRa + 1]} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
