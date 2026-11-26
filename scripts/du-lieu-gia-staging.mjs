// v3.36 (Đợt 1, CAU-HOI V-1 "dữ liệu giả staging: khoảng 500 việc"): nạp / dọn bộ việc GIẢ trên project STAGING để kiểm giao diện, tốc độ với
// khối lượng gần thật (Tổng quan, ma trận đơn vị, Cần xử lý, chuông). CHỈ STAGING: dừng ngay nếu địa chỉ không phải project staging. Không tạo tài khoản
// (CLAUDE.md mục 11 — tài khoản staging chỉ từ seed.sql): dùng tài khoản demo sẵn có (không dùng tài khoản e2e), đơn vị trong dm_don_vi.
// Dấu nhận biết: văn bản so_ket_luan 'DL-GIA-<số>' — mọi việc của bộ gắn các văn bản này; dọn = xoá việc của các văn bản đó (lịch sử, minh chứng, tin
// theo khoá ngoại xoá dây chuyền) rồi xoá văn bản. Tái tạo y hệt mỗi lần (PRNG hạt cố định); nạp lại chỉ thêm phần còn thiếu (theo nội dung).
// Dùng (workflow du-lieu-gia-staging.yml): SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/du-lieu-gia-staging.mjs nap 500 | xoa
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'vojmrjezspdftovzinek';
const TAG = 'DL-GIA';
const [thaoTac = 'nap', soArg = '500'] = process.argv.slice(2);
const url = process.env.SUPABASE_URL || ''; const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url.includes(STAGING_REF)) { console.error(`Dừng: chỉ chạy trên project staging (${STAGING_REF}).`); process.exit(1); }
if (!key) { console.error('Thiếu SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };

// PRNG cố định (mulberry32) — cùng bộ việc mỗi lần chạy.
let hat = 20261126;
const rnd = () => { hat |= 0; hat = (hat + 0x6D2B79F5) | 0; let t = Math.imul(hat ^ (hat >>> 15), 1 | hat); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const chon = (ds) => ds[Math.floor(rnd() * ds.length)];
const homNay = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const nhoHon = (a, b) => (a < b ? a : b);

const VIEC = ['Tham mưu xây dựng báo cáo sơ kết thực hiện nghị quyết về chuyển đổi số trong các cơ quan đảng',
  'Rà soát, bổ sung quy chế làm việc của Văn phòng Tỉnh ủy nhiệm kỳ 2025 - 2030', 'Chuẩn bị nội dung hội nghị Ban Chấp hành Đảng bộ tỉnh cuối năm',
  'Xây dựng kế hoạch số hóa tài liệu lưu trữ của các cơ quan đảng giai đoạn 2026 - 2030', 'Tổng hợp tình hình thực hiện các kết luận của Ban Thường vụ Tỉnh ủy',
  'Theo dõi, đôn đốc tiến độ các đề án trọng điểm của tỉnh', 'Dự thảo báo cáo chuyên đề về công tác cải cách hành chính trong Đảng',
  'Rà soát danh mục văn bản quy phạm của Tỉnh ủy cần sửa đổi, bổ sung', 'Chuẩn bị tài liệu phục vụ đoàn kiểm tra, giám sát của Trung ương',
  'Tham mưu kế hoạch tổ chức các ngày lễ lớn trong năm', 'Xây dựng chương trình công tác tháng của Thường trực Tỉnh ủy',
  'Tổng hợp ý kiến góp ý dự thảo văn kiện', 'Kiểm tra hạ tầng mạng, thiết bị phòng họp trực tuyến của Tỉnh ủy',
  'Đánh giá kết quả thực hiện chương trình kiểm tra, giám sát năm', 'Chuẩn bị báo cáo quyết toán kinh phí hoạt động của Văn phòng'];
const SAN_PHAM = ['BAO_CAO', 'DU_THAO_VAN_BAN', 'KE_HOACH', 'TO_TRINH', 'CONG_VAN'];
const CAP_NHAN = ['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG', 'THUONG_TRUC'];
const DO_KHAN = [...Array(16).fill('THUONG'), 'KHAN', 'KHAN', 'KHAN', 'THUONG_KHAN'];

async function boiCanh() {
  const tk = Object.fromEntries(loi(await db.from('accounts').select('id, username, role_group, department')
    .in('username', ['demo_cvp', 'demo_pcvp', 'demo_pcvp2', 'demo_truongphong', 'demo_cv1', 'demo_cv2', 'demo_qtht']), 'Đọc tài khoản demo').map((a) => [a.username, a]));
  for (const u of ['demo_cvp', 'demo_pcvp', 'demo_truongphong', 'demo_cv1', 'demo_cv2']) if (!tk[u]) throw new Error(`Thiếu tài khoản ${u} (seed.sql).`);
  const dv = loi(await db.from('dm_don_vi').select('ma, trong_van_phong, phong').order('thu_tu'), 'Đọc dm_don_vi').filter((d) => !d.ma.startsWith('E2E'));
  // Kiểu chủ trì: [đơn vị, tài khoản chủ trì | null, người theo dõi khi phải tự ghi, người giao (tao_boi)]
  const kieu = [];
  const phong = (ma) => dv.find((d) => d.ma === ma);
  if (phong('TONG_HOP')) kieu.push(['TONG_HOP', tk.demo_cv1.id, tk.demo_cv1.id, tk.demo_truongphong.id], ['TONG_HOP', null, tk.demo_truongphong.id, tk.demo_pcvp.id]);
  if (phong('QUAN_TRI')) kieu.push(['QUAN_TRI', tk.demo_cv2.id, tk.demo_cv2.id, (tk.demo_pcvp2 || tk.demo_pcvp).id]);
  if (phong('CDS_CY') && tk.demo_qtht) kieu.push(['CDS_CY', tk.demo_qtht.id, tk.demo_qtht.id, tk.demo_cvp.id]);
  for (const ma of ['HC_LT', 'TAI_CHINH_DANG']) if (phong(ma)) kieu.push([ma, null, tk.demo_pcvp.id, tk.demo_cvp.id]);
  if (phong('VAN_PHONG_TINH_UY')) kieu.push(['VAN_PHONG_TINH_UY', tk.demo_pcvp.id, tk.demo_pcvp.id, tk.demo_cvp.id]);
  dv.filter((d) => !d.trong_van_phong).slice(0, 8).forEach((d, i) => kieu.push([d.ma, null, i % 2 ? tk.demo_cv2.id : tk.demo_cv1.id, tk.demo_cvp.id]));
  return { tk, kieu };
}

// Một việc giả (thuần, theo PRNG): ngày giao 1/1–hôm nay; trạng thái theo hạn so với hôm nay.
function sinhViec(i, ctx, vbs) {
  const vb = vbs[i % vbs.length];
  const [donVi, owner, theoDoi, taoBoi] = ctx.kieu[Math.floor(rnd() * ctx.kieu.length)];
  const nhan = nhoHon(cong(vb.ngay_ban_hanh, Math.floor(rnd() * 5)), homNay);
  const loaiHan = rnd() < 0.08 ? 'THUONG_XUYEN' : 'CO_HAN_CU_THE';
  const han = loaiHan === 'CO_HAN_CU_THE' ? cong(nhan, 10 + Math.floor(rnd() * 80)) : null;
  // Tỷ lệ hoàn thành theo độ trễ của hạn (gần thật: việc hạn đã lâu phần lớn xong, việc còn hạn ít xong sớm) — quá hạn chưa xong khoảng 10–15%.
  const tre = han ? Math.round((Date.parse(homNay) - Date.parse(han)) / 864e5) : null;
  const pXong = tre === null ? 0 : tre > 30 ? 0.88 : tre > 0 ? 0.6 : tre > -15 ? 0.15 : 0.05;
  const xong = han && rnd() < pXong;
  const ngayXong = xong ? nhoHon(cong(han, Math.floor(rnd() * 14) - 9), homNay) : null;
  return {
    nv: { van_ban_id: vb.id, noi_dung: `${chon(VIEC)} (${TAG} ${String(i + 1).padStart(3, '0')})`, owner_don_vi_ma: donVi, owner_tai_khoan: owner,
      nguoi_theo_doi: theoDoi, tao_boi: taoBoi, loai_thoi_han_ma: loaiHan, han_xu_ly: han, ly_do_chua_co_han: han ? null : 'Nhiệm vụ thường xuyên',
      ngay_nhan_van_ban: nhan, theo_1400: true, do_khan: chon(DO_KHAN), san_pham_loai: chon(SAN_PHAM), nguon: 'app',
      vuong_mac: !xong && rnd() < 0.05 ? 'Chờ ý kiến của lãnh đạo về phạm vi số liệu' : null },
    xacNhan: rnd() < 0.85,
    xong: ngayXong && ngayXong >= vb.ngay_ban_hanh ? { ngay: ngayXong < nhan ? nhan : ngayXong, cap: chon(CAP_NHAN) } : null,
  };
}

async function vanBan() {
  const co = loi(await db.from('van_ban_giao_viec').select('id, so_ket_luan, ngay_ban_hanh').like('so_ket_luan', `${TAG}-%`).order('so_ket_luan'), 'Đọc văn bản giả');
  if (co.length >= 20) return co;
  const can = Array.from({ length: 20 }, (_, k) => ({ so_ket_luan: `${TAG}-${String(k + 1).padStart(2, '0')}`, loai: k % 4 === 3 ? 'KHAC' : 'CONG_VAN',
    ngay_ban_hanh: nhoHon(cong('2026-01-05', k * 16), cong(homNay, -1)) })).filter((v) => !co.some((c) => c.so_ket_luan === v.so_ket_luan));
  if (can.length) loi(await db.from('van_ban_giao_viec').insert(can), 'Tạo văn bản giả');
  return loi(await db.from('van_ban_giao_viec').select('id, so_ket_luan, ngay_ban_hanh').like('so_ket_luan', `${TAG}-%`).order('so_ket_luan'), 'Đọc văn bản giả');
}

async function nap(so) {
  const ctx = await boiCanh(); const vbs = await vanBan();
  const daCo = new Set(loi(await db.from('nhiem_vu').select('noi_dung').in('van_ban_id', vbs.map((v) => v.id)), 'Đọc việc giả').map((r) => r.noi_dung));
  const kq = { tao: 0, daCo: 0, xong: 0, loi: 0, mau: [] };
  for (let i = 0; i < so; i++) {
    const { nv, xacNhan, xong } = sinhViec(i, ctx, vbs);
    if (daCo.has(nv.noi_dung)) { kq.daCo++; continue; }
    try {
      const id = loi(await db.from('nhiem_vu').insert(nv).select('id').single(), 'Tạo việc').id;
      loi(await db.from('lich_su').insert({ nhiem_vu_id: id, cot: 'giao_viec', nguoi_sua: nv.tao_boi, gia_tri_moi: `${TAG} giao việc`, nguon: 'app' }), 'Lịch sử giao');
      if (xacNhan || xong) loi(await db.from('lich_su').insert({ nhiem_vu_id: id, cot: 'xac_nhan_nhan_viec', nguoi_sua: nv.nguoi_theo_doi, gia_tri_moi: `${TAG} xác nhận`, nguon: 'app' }), 'Xác nhận');
      if (xong) {
        loi(await db.from('minh_chung').insert({ nhiem_vu_id: id, nop_boi: nv.nguoi_theo_doi, loai: 'so_hieu', so_hieu: `${100 + i}/BC-VPTU (${TAG})`,
          ngay_van_ban: xong.ngay, cap_nhan: xong.cap, hop_le: true, xac_nhan_boi: nv.tao_boi, xac_nhan_luc: new Date().toISOString() }), 'Minh chứng');
        loi(await db.from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: xong.ngay }).eq('id', id), 'Hoàn thành');
        kq.xong++;
      }
      kq.tao++;
    } catch (e) { kq.loi++; if (kq.mau.length < 5) kq.mau.push(`${nv.noi_dung.slice(-12)} ${e.message}`); }
  }
  return kq;
}

async function xoa() {
  const vbs = loi(await db.from('van_ban_giao_viec').select('id').like('so_ket_luan', `${TAG}-%`), 'Đọc văn bản giả');
  if (!vbs.length) return { viec: 0, vanBan: 0 };
  const ids = vbs.map((v) => v.id);
  const n = loi(await db.from('nhiem_vu').delete({ count: 'exact' }).in('van_ban_id', ids).select('id'), 'Xoá việc giả').length;
  loi(await db.from('van_ban_giao_viec').delete().in('id', ids), 'Xoá văn bản giả');
  return { viec: n, vanBan: ids.length };
}

const so = Math.max(1, Math.min(800, Number(soArg) || 500));
const kq = thaoTac === 'xoa' ? await xoa() : await nap(so);
console.log(JSON.stringify(kq));
if (kq.loi) process.exitCode = 1;
