// Sinh dữ liệu TỔNG HỢP (tên giả) cho đo hiệu năng / ảnh chụp phạm vi PR-2a — CHỈ Supabase cục bộ (127.0.0.1).
// Tái tạo y hệt mỗi lần nạp: PRNG seed cố định, uuid = hàm(không gian, chỉ số), mã "TH-xxxx" cố định, id bigint
// (lich_su, canh_bao) đặt tường minh từ 900 000 000; mọi ngày tính từ ngày gốc 05/01/2026 hoặc rơi vào năm 2030,
// nên tập dòng theo vai (kể cả Đỏ / Xanh / "không cập nhật 30 ngày") không đổi theo ngày chạy.
// Hình dạng theo số đếm production 28/9/2026: 51 tài khoản (2 A0, 5 A1, 5 A2, 39 A3), 5 phân công cả phòng, 2 quan_tri_kl;
// thêm 2 kiêm nhiệm lĩnh vực + 1 thư ký Thường trực để đo đủ nhánh. 250 văn bản 5 loại, 1 215 việc (+185 bộ vàng ≈ 1 400).
// Cách nạp: supabase db reset → node scripts/nhap-kl-btvtu.mjs --file tests/rls/du-lieu-vang/kl-btvtu.json --local --ghi
//           → node tests/perf/sinh-du-lieu-tong-hop.mjs
import { psql, q } from '../../scripts/lib-cuc-bo.mjs';
import { sinhCon } from './sinh-con.mjs';
import { rng, chon, khoang, uid, cong, luc } from './tien-ich.mjs';

const SO_VAN_BAN = 250;
const SO_VIEC = 1215;
const GOC = '2026-01-05';
export const PHONG = ['TONG_HOP', 'HC_LT', 'CDS_CY', 'TAI_CHINH_DANG', 'QUAN_TRI'];
const DON_VI_NGOAI = ['BAN_TO_CHUC', 'UY_BAN_KIEM_TRA', 'BAN_NOI_CHINH', 'BAN_TUYEN_GIAO', 'DANG_UY_UBND', 'DANG_UY_HDND',
  'DANG_UY_MTTQ', 'DANG_UY_CONG_AN', 'DANG_UY_QUAN_SU', 'TO_CONG_TAC_BCD', 'BAN_THUONG_VU', 'CO_QUAN_KHAC'];
const SAN_PHAM = ['TO_TRINH', 'DU_THAO_VAN_BAN', 'BAO_CAO', 'KE_HOACH', 'QUYET_DINH', 'CONG_VAN', 'KHAC'];
const CAP = ['THUONG_TRUC', 'BAN_THUONG_VU', 'CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG', 'TRUONG_PHONG'];

const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------- Tài khoản ----------
function sinhTaiKhoan() {
  const tk = []; let n = 0;
  const them = (username, full_name, role_group, position_title, department, x = {}) => {
    const t = { id: uid(1, ++n), username, full_name, role_group, position_title, department, is_chief: false, quan_tri_kl: false, thu_ky_thuong_truc: false, manager_id: null, ...x };
    tk.push(t); return t;
  };
  const a0 = [1, 2].map((i) => them(`th_a0_${pad(i)}`, `Thường trực giả ${pad(i)}`, 'A0', 'Thường trực Tỉnh ủy', null));
  const cvp = them('th_cvp', 'Chánh Văn phòng giả', 'A1', 'Chánh Văn phòng', null, { is_chief: true });
  const pcvp = [1, 2, 3, 4].map((i) => them(`th_pcvp_${pad(i)}`, `Phó Chánh Văn phòng giả ${pad(i)}`, 'A1', 'Phó Chánh Văn phòng', null, { manager_id: cvp.id }));
  const phuTrach = { TONG_HOP: pcvp[0], HC_LT: pcvp[0], CDS_CY: pcvp[1], TAI_CHINH_DANG: pcvp[2], QUAN_TRI: pcvp[3] };
  const a2 = {};
  PHONG.forEach((p, i) => { a2[p] = them(`th_tp_${pad(i + 1)}`, `Trưởng phòng giả ${pad(i + 1)}`, 'A2', 'Trưởng phòng', p, { manager_id: phuTrach[p].id }); });
  a2.QUAN_TRI.thu_ky_thuong_truc = true; // production hiện 0 thư ký — thêm 1 để đo nhánh thư ký
  const a3 = {}; let k = 0;
  PHONG.forEach((p, i) => {
    a3[p] = [];
    for (let j = 0; j < (i < 4 ? 8 : 7); j++) { k++; a3[p].push(them(`th_cv_${pad(k)}`, `Chuyên viên giả ${pad(k)}`, 'A3', 'Chuyên viên', p, { manager_id: a2[p].id })); }
  });
  a3.TONG_HOP[0].quan_tri_kl = true; a3.HC_LT[0].quan_tri_kl = true;
  return { tk, a0, cvp, pcvp, phuTrach, a2, a3 };
}

function sqlTaiKhoan({ tk, pcvp, phuTrach, cvp }) {
  const users = tk.map((t) => `('00000000-0000-0000-0000-000000000000', ${q(t.id)}, 'authenticated', 'authenticated', ${q(`${t.username}@vptu.caobang.local`)}, '', ${q(luc(GOC))}, '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ username: t.username }))}, ${q(luc(GOC))}, ${q(luc(GOC))}, '', '', '', '', '', '', '', '', false, false)`);
  const acc = tk.map((t) => `(${q(t.id)}, ${q(t.username)}, ${q(t.full_name)}, ${q(t.role_group)}, ${q(t.position_title)}, ${q(t.department)}, NULL, false, ${t.is_chief}, ${t.quan_tri_kl}, ${t.thu_ky_thuong_truc}, ${q(luc(GOC))})`);
  const mgr = tk.filter((t) => t.manager_id).map((t) => `(${q(t.id)}::uuid, ${q(t.manager_id)}::uuid)`);
  let n = 0;
  const pt = Object.entries(phuTrach).map(([p, l]) => `(${q(uid(8, ++n))}, ${q(l.id)}, ${q(p)}, '2026-01-01', NULL, 'TH phân công cả phòng', ${q(cvp.id)}, NULL, NULL, ${q(luc(GOC))})`);
  pt.push(`(${q(uid(8, ++n))}, ${q(pcvp[1].id)}, 'TONG_HOP', '2026-01-01', NULL, 'TH kiêm nhiệm lĩnh vực', ${q(cvp.id)}, 'KINH_TE_TONG_HOP', 'LV08_DAU_TU', ${q(luc(GOC))})`);
  pt.push(`(${q(uid(8, ++n))}, ${q(pcvp[2].id)}, 'HC_LT', '2026-01-01', NULL, 'TH kiêm nhiệm lĩnh vực', ${q(cvp.id)}, 'VAN_HOA_XA_HOI', 'LV10_XA_HOI', ${q(luc(GOC))})`);
  return `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous)
VALUES ${users.join(',\n')};
INSERT INTO public.accounts (id, username, full_name, role_group, position_title, department, manager_id, must_change_password, is_chief, quan_tri_kl, thu_ky_thuong_truc, created_at)
VALUES ${acc.join(',\n')};
UPDATE public.accounts a SET manager_id = m.mgr FROM (VALUES ${mgr.join(', ')}) m(id, mgr) WHERE a.id = m.id;
INSERT INTO public.phu_trach_phong (id, lanh_dao_id, phong, tu_ngay, den_ngay, ly_do, phan_cong_boi, nganh_ma, linh_vuc_ma, created_at)
VALUES ${pt.join(',\n')};
`;
}

// ---------- Văn bản ----------
function sinhVanBan(ctx) {
  const loaiTheoTi = [['KL_BTV', 0.3], ['TB_THUONG_TRUC', 0.5], ['NQ_TW', 0.6], ['CONG_VAN', 0.9], ['KHAC', 1]];
  const vb = [];
  for (let i = 1; i <= SO_VAN_BAN; i++) {
    const r = rng(); const loai = loaiTheoTi.find(([, p]) => r < p)[0];
    const bh = cong(GOC, (i * 37) % 150);
    const taoBoi = ['KL_BTV', 'TB_THUONG_TRUC'].includes(loai) ? (rng() < 0.1 ? null : chon(ctx.a0).id) : chon([ctx.cvp, ...ctx.pcvp, ...Object.values(ctx.a2)]).id;
    vb.push({ id: uid(2, i), loai, so_hoi_nghi: loai === 'KL_BTV' ? 5000 + i : null, so_ket_luan: `TH-${loai}-${pad(i, 3)}`, bh, nhan: cong(bh, 2), tao_boi: taoBoi });
  }
  return vb;
}
const sqlVanBan = (vb) => `INSERT INTO public.van_ban_giao_viec (id, loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh, ngay_nhan, trich_yeu, tao_boi, created_at)
VALUES ${vb.map((v, i) => `(${q(v.id)}, ${q(v.loai)}, ${v.so_hoi_nghi ?? 'NULL'}, ${q(v.so_ket_luan)}, ${q(v.bh)}, ${q(v.nhan)}, ${q(`Trích yếu văn bản tổng hợp số ${i + 1}`)}, ${q(v.tao_boi)}, ${q(luc(v.bh))})`).join(',\n')};
`;

// ---------- Nhiệm vụ ----------
function sinhViec(ctx, vb, linhVuc) {
  const nganh = Object.keys(linhVuc).sort();
  const viec = [];
  for (let i = 1; i <= SO_VIEC; i++) {
    const v = vb[i % SO_VAN_BAN]; const loaiViec = rng(); const kind = loaiViec < 0.7 ? 'dong' : loaiViec < 0.9 ? 'mo' : 'khong_han';
    let p = chon(PHONG); let ownerDv = p; let ownerTk = null; let theoDoi;
    const ro = rng();
    if (ro < 0.55) { ownerTk = chon(ctx.a3[p]); theoDoi = rng() < 0.6 ? ownerTk : chon(ctx.a3[p]); ownerTk = ownerTk.id; }
    else if (ro < 0.7) theoDoi = chon(ctx.a3[p]);
    else if (ro < 0.88) { ownerDv = chon(DON_VI_NGOAI); theoDoi = chon(ctx.a3[p]); }
    else { ownerDv = 'VAN_PHONG_TINH_UY'; ownerTk = chon([ctx.cvp, ...ctx.pcvp]).id; theoDoi = chon(ctx.a3[p]); }
    let ng = chon(nganh); let lv = rng() < 0.7 ? chon(linhVuc[ng]) : null;
    const rk = rng();
    if (rk < 0.1 && ownerDv === 'TONG_HOP') { ng = 'KINH_TE_TONG_HOP'; lv = 'LV08_DAU_TU'; }
    else if (rk < 0.1 && p === 'HC_LT') { ng = 'VAN_HOA_XA_HOI'; lv = 'LV10_XA_HOI'; }
    let loaiHan = 'CO_HAN_CU_THE'; let han = null; let lyDo = null; const rh = rng();
    if (kind === 'dong') { if (rh < 0.1) loaiHan = 'KY_BAN_HANH'; else if (rh < 0.15) loaiHan = 'THUONG_XUYEN'; else han = cong(v.bh, khoang(20, 80)); }
    else if (kind === 'mo') { if (rh < 0.1) loaiHan = 'KY_BAN_HANH'; else han = rh < 0.55 ? cong(v.bh, khoang(15, 50)) : cong('2030-01-01', i % 365); }
    else if (rh < 0.4) loaiHan = 'THUONG_XUYEN'; else if (rh < 0.7) loaiHan = 'CHO_QUYET_DINH'; else lyDo = 'Chờ văn bản hướng dẫn (dữ liệu tổng hợp)';
    const excel = kind === 'dong' && rng() < 0.15;
    const rkh = rng();
    viec.push({
      id: uid(3, i), ma: `TH-${pad(i, 4)}`, van_ban_id: v.id, bh: v.bh, nhan: v.nhan, kind, excel, phong: p, theo_doi: theoDoi.id,
      owner_dv: ownerDv, owner_tk: ownerTk, nganh: ng, lv, loai_han: loaiHan, han, ly_do: lyDo, theo_1400: rng() < 0.8,
      do_khan: rkh < 0.9 ? 'THUONG' : rkh < 0.96 ? 'KHAN' : rkh < 0.98 ? 'THUONG_KHAN' : 'HOA_TOC',
      tao_boi: v.tao_boi ?? (rng() < 0.5 ? ctx.a2[p].id : null), san_pham: chon(SAN_PHAM), cap: rng() < 0.6 ? chon(CAP) : null,
      ngay_ht: kind === 'dong' ? cong(v.bh, khoang(10, 100)) : null, tao_luc: luc(cong(v.bh, 3)),
    });
  }
  return viec;
}

function sqlViec(viec) {
  const dong = viec.map((v) => `(${q(v.id)}, ${q(v.ma)}, ${q(v.van_ban_id)}, ${q(v.theo_doi)}, ${q(v.nganh)}, ${q(v.lv)}, ${q(v.owner_dv)}, ${q(v.owner_tk)}, ${q(`Nhiệm vụ tổng hợp ${v.ma}`)}, ${q(v.loai_han)}, ${q(v.han)}, ${q(v.ly_do)}, ${q(v.excel ? 'HOAN_THANH' : 'DANG_THUC_HIEN')}, ${q(v.excel ? v.ngay_ht : null)}, ${q(v.excel ? 'excel' : 'app')}, ${v.theo_1400}, ${q(v.nhan)}, ${q(v.do_khan)}, ${q(v.tao_boi)}, ${q(v.san_pham)}, ${q(v.cap)}, ${q(v.tao_luc)})`);
  const out = [];
  for (let i = 0; i < dong.length; i += 400) {
    out.push(`INSERT INTO public.nhiem_vu (id, ma, van_ban_id, nguoi_theo_doi, nganh_ma, linh_vuc_ma, owner_don_vi_ma, owner_tai_khoan, noi_dung, loai_thoi_han_ma, han_xu_ly, ly_do_chua_co_han, tien_do_ma, ngay_hoan_thanh, nguon, theo_1400, ngay_nhan_van_ban, do_khan, tao_boi, san_pham_loai, cap_quyet_dinh, created_at)
VALUES ${dong.slice(i, i + 400).join(',\n')};`);
  }
  return out.join('\n');
}

// ---------- Chạy ----------
const daCo = psql("SELECT (SELECT count(*) FROM public.nhiem_vu WHERE ma LIKE 'TH-%') + (SELECT count(*) FROM public.accounts WHERE username LIKE 'th\\_%');").trim();
if (daCo !== '0') { console.error('DỪNG: đã có dữ liệu tổng hợp. Chạy `supabase db reset` (cục bộ) rồi nạp lại bộ vàng trước.'); process.exit(1); }
const linhVuc = {};
for (const d of psql('SELECT nganh_ma, string_agg(ma, \',\' ORDER BY thu_tu, ma) FROM public.dm_linh_vuc GROUP BY 1 ORDER BY 1;').trim().split(/\r?\n/)) {
  const [ng, ds] = d.split('|'); linhVuc[ng] = ds.split(',');
}
const ctx = sinhTaiKhoan();
const vb = sinhVanBan(ctx);
const viec = sinhViec(ctx, vb, linhVuc);
const con = sinhCon(ctx, viec);
const sql = ['BEGIN;', sqlTaiKhoan(ctx), sqlVanBan(vb), sqlViec(viec), con.truocDong, con.dong, con.sauDong, 'COMMIT;'].join('\n');
psql(sql);
console.log(psql(`SELECT 'tai_khoan=' || (SELECT count(*) FROM accounts WHERE username LIKE 'th\\_%') || ' van_ban=' || (SELECT count(*) FROM van_ban_giao_viec WHERE so_ket_luan LIKE 'TH-%')
  || ' nhiem_vu=' || (SELECT count(*) FROM nhiem_vu WHERE ma LIKE 'TH-%') || ' (tong ' || (SELECT count(*) FROM nhiem_vu) || ')'
  || ' minh_chung=' || (SELECT count(*) FROM minh_chung m JOIN nhiem_vu n ON n.id = m.nhiem_vu_id WHERE n.ma LIKE 'TH-%')
  || ' lich_su=' || (SELECT count(*) FROM lich_su l JOIN nhiem_vu n ON n.id = l.nhiem_vu_id WHERE n.ma LIKE 'TH-%')
  || ' chi_dao=' || (SELECT count(*) FROM chi_dao c JOIN nhiem_vu n ON n.id = c.nhiem_vu_id WHERE n.ma LIKE 'TH-%')
  || ' canh_bao=' || (SELECT count(*) FROM canh_bao c JOIN nhiem_vu n ON n.id = c.nhiem_vu_id WHERE n.ma LIKE 'TH-%')
  || ' tu_choi=' || (SELECT count(*) FROM tu_choi WHERE id::text LIKE 'ffff0006%') || ' dinh_chinh=' || (SELECT count(*) FROM dinh_chinh WHERE id::text LIKE 'ffff0007%');`).trim());
// Dấu vân tay toàn bộ dòng tổng hợp (mọi cột) — hai lần nạp phải ra cùng md5.
console.log(psql(`WITH n AS (SELECT id FROM nhiem_vu WHERE ma LIKE 'TH-%')
SELECT 'dau_van_tay=' || md5(concat_ws('#',
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM accounts t WHERE username LIKE 'th\\_%'),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM van_ban_giao_viec t WHERE so_ket_luan LIKE 'TH-%'),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM nhiem_vu t WHERE t.id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM minh_chung t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM lich_su t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM chi_dao t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM canh_bao t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM tu_choi t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM dinh_chinh t WHERE t.nhiem_vu_id IN (SELECT id FROM n)),
  (SELECT string_agg(t::text, '|' ORDER BY t.id) FROM phu_trach_phong t WHERE ly_do LIKE 'TH %')));`).trim());
