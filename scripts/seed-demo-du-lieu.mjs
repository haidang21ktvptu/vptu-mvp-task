// Bộ dữ liệu mẫu E2E-SEED (gọi từ seed-demo.mjs): một văn bản giao việc + 6 nhiệm vụ đủ trạng thái mà bộ e2e cần có sẵn trên một DB rỗng
// (a0.spec, bo-cuc-mobile, kl-dashboard cần "có dòng" trong phạm vi A0/A1; các spec khác tự tạo dữ liệu riêng E2E-TEST*).
// Idempotent: tìm văn bản theo so_ket_luan = 'E2E-SEED', nhiệm vụ theo noi_dung (bắt đầu 'E2E-SEED'), chỉ chèn dòng thiếu (nhiệm vụ, lich_su giao việc / xác
// nhận nhận việc / cảnh báo, canh_bao việc Đỏ, minh_chung); hạn/ngày nhận tính lại theo hôm nay (giờ Việt Nam) cho đúng dòng tag để trạng thái không trôi. KHÔNG đụng gì ngoài tag.
// Tài khoản lấy theo username demo_* (không gán id cứng) — thiếu tài khoản nào thì báo rõ tên, không chèn nửa vời. Phòng: TONG_HOP nếu đang có
// PCVP phụ trách (thật hoặc demo do seed-demo chèn), nếu không thì phòng đầu tiên có phân công thật. Sau khi nạp, đọc v_nhiem_vu dưới token của
// demo_cvp và demo_a0 để chắc chắn bộ mẫu nằm trong phạm vi nhìn thấy. Dọn: màn hình Dọn dữ liệu → bộ sẵn "dữ liệu thử" (0043).
import { createClient } from '@supabase/supabase-js';

export const SEED_TAG = 'E2E-SEED';
const CAN = ['demo_truongphong', 'demo_cv1', 'demo_e2e_kl', 'demo_cvp', 'demo_a0'];
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };

// Sáu việc mẫu (hạn/ngày nhận tương đối so với hôm nay); xacNhan = có dòng lich_su xác nhận nhận việc, minhChung = một minh chứng.
function danhSach(tk, homNay, phong) {
  const chung = (owner) => ({ owner_don_vi_ma: phong, owner_tai_khoan: tk[owner], nguoi_theo_doi: tk.demo_truongphong, tao_boi: tk.demo_truongphong,
    loai_thoi_han_ma: 'CO_HAN_CU_THE', san_pham_loai: 'BAO_CAO', nguon: 'app' });
  return [
    { noi_dung: `${SEED_TAG} đang thực hiện, còn thời gian`, ...chung('demo_cv1'), han_xu_ly: congNgay(homNay, 20), ngay_nhan_van_ban: congNgay(homNay, -5), theo_1400: true, do_khan: 'THUONG', xacNhan: true },
    { noi_dung: `${SEED_TAG} quá hạn Đỏ, chưa có minh chứng`, ...chung('demo_cv1'), han_xu_ly: congNgay(homNay, -10), ngay_nhan_van_ban: congNgay(homNay, -20), theo_1400: true, do_khan: 'KHAN', xacNhan: true, canhBao: true },
    { noi_dung: `${SEED_TAG} sắp đến hạn`, ...chung('demo_cv1'), han_xu_ly: congNgay(homNay, 2), ngay_nhan_van_ban: congNgay(homNay, -8), theo_1400: true, do_khan: 'THUONG', xacNhan: true },
    { noi_dung: `${SEED_TAG} hoàn thành có minh chứng hợp lệ`, ...chung('demo_cv1'), han_xu_ly: congNgay(homNay, -3), ngay_nhan_van_ban: congNgay(homNay, -15), theo_1400: true, do_khan: 'THUONG',
      hoanThanh: congNgay(homNay, -4), xacNhan: true, // chuyển Hoàn thành sau khi đã có minh chứng (trigger 0028 bắt buộc)
      minhChung: { loai: 'so_hieu', so_hieu: `12/CV-VPTU (${SEED_TAG})`, ngay_van_ban: congNgay(homNay, -4), cap_nhan: 'CHANH_VAN_PHONG', hop_le: true } },
    { noi_dung: `${SEED_TAG} việc cũ trước 1400, minh chứng chữ`, ...chung('demo_cv1'), han_xu_ly: congNgay(homNay, 30), ngay_nhan_van_ban: null, theo_1400: false, do_khan: 'THUONG',
      minhChung: { loai: 'chu_cu', noi_dung_chu: `Công văn 08/CV-VPTU ngày 10/08/2026 (${SEED_TAG})`, so_hieu: '08/CV-VPTU', ngay_van_ban: '2026-08-10' } },
    { noi_dung: `${SEED_TAG} việc mới giao, chưa xác nhận nhận`, ...chung('demo_e2e_kl'), han_xu_ly: congNgay(homNay, 12), ngay_nhan_van_ban: homNay, theo_1400: true, do_khan: 'KHAN' },
  ];
}

async function taiKhoan(db) {
  const rows = loi(await db.from('accounts').select('id, username').in('username', CAN), 'Đọc accounts');
  const thieu = CAN.filter((u) => !rows.some((r) => r.username === u));
  if (thieu.length) throw new Error(`Thiếu tài khoản demo cho bộ ${SEED_TAG}: ${thieu.join(', ')} — chạy lại bước tài khoản trước, không nạp dữ liệu nửa vời.`);
  return Object.fromEntries(rows.map((r) => [r.username, r.id]));
}

// Phòng của bộ mẫu: TONG_HOP (phòng của demo_truongphong / demo_cv1) khi đang có PCVP phụ trách; nếu không, phòng đầu tiên có phân công thật.
async function chonPhong(db) {
  const pt = loi(await db.from('phu_trach_phong').select('phong, lanh_dao_id').is('den_ngay', null).order('phong'), 'Đọc phu_trach_phong');
  const dv = loi(await db.from('dm_don_vi').select('ma'), 'Đọc dm_don_vi').map((d) => d.ma);
  const coPT = pt.map((p) => p.phong).filter((p) => dv.includes(p));
  if (coPT.includes('TONG_HOP')) return 'TONG_HOP';
  if (!coPT.length) throw new Error(`Không có phòng nào có phân công PCVP phụ trách trong danh mục đơn vị — không nạp bộ ${SEED_TAG}.`);
  console.warn(`TONG_HOP không có PCVP phụ trách → bộ ${SEED_TAG} đặt ở phòng ${coPT[0]} (Trưởng phòng demo ở TONG_HOP sẽ không thấy).`);
  return coPT[0];
}

export async function napDuLieuMau(db, dryRun) {
  const tk = await taiKhoan(db);
  const phong = await chonPhong(db);
  const homNay = homNayVN();
  const kq = { tao: 0, capNhat: 0, daCo: 0 };
  let vb = loi(await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', SEED_TAG).maybeSingle(), 'Đọc văn bản mẫu');
  if (!vb && !dryRun) vb = loi(await db.from('van_ban_giao_viec').insert({ so_ket_luan: SEED_TAG, loai: 'CONG_VAN', ngay_ban_hanh: congNgay(homNay, -30), tao_boi: tk.demo_truongphong }).select('id').single(), 'Tạo văn bản mẫu');
  for (const { xacNhan, minhChung, hoanThanh, canhBao, ...nv } of danhSach(tk, homNay, phong)) {
    const cu = loi(await db.from('nhiem_vu').select('id').eq('noi_dung', nv.noi_dung).maybeSingle(), 'Đọc nhiệm vụ mẫu');
    if (dryRun) { cu ? kq.daCo++ : kq.tao++; continue; }
    let id = cu?.id;
    if (id) {
      loi(await db.from('nhiem_vu').update({ han_xu_ly: nv.han_xu_ly, ngay_nhan_van_ban: nv.ngay_nhan_van_ban, cap_nhat_boi: tk.demo_truongphong }).eq('id', id), 'Cập nhật hạn việc mẫu');
      kq.capNhat++;
    } else {
      id = loi(await db.from('nhiem_vu').insert({ ...nv, van_ban_id: vb.id }).select('id').single(), `Tạo "${nv.noi_dung}"`).id;
      kq.tao++;
    }
    // Diễn biến tối thiểu: mọi việc có dòng "giao việc" (v_dien_bien ≥ 1 dòng — a0.spec mở khối Xem diễn biến); xác nhận nhận; việc Đỏ có cảnh báo.
    await lichSuNeuThieu(db, id, 'giao_viec', { nguoi_sua: nv.tao_boi, gia_tri_moi: `${SEED_TAG} giao việc, người nhận demo` });
    if (xacNhan) await lichSuNeuThieu(db, id, 'xac_nhan_nhan_viec', { nguoi_sua: nv.owner_tai_khoan, gia_tri_moi: `${SEED_TAG} xác nhận` });
    if (canhBao) {
      const co = loi(await db.from('canh_bao').select('id').eq('nhiem_vu_id', id).eq('muc', 'DO_DAC_BIET').limit(1), 'Đọc canh_bao');
      if (!co.length) loi(await db.from('canh_bao').insert({ nhiem_vu_id: id, muc: 'DO_DAC_BIET', ngay: homNay, nguoi_nhan: [nv.owner_tai_khoan, nv.nguoi_theo_doi] }), 'Ghi canh_bao');
      await lichSuNeuThieu(db, id, 'canh_bao', { nguoi_sua: null, nguoi_sua_ghi_chu: 'Hệ thống — cảnh báo tự động', gia_tri_moi: `${SEED_TAG} cảnh báo Đỏ đặc biệt: quá hạn, chưa có minh chứng` });
    }
    if (minhChung) {
      const co = loi(await db.from('minh_chung').select('id').eq('nhiem_vu_id', id).limit(1), 'Đọc minh_chung');
      if (!co.length) loi(await db.from('minh_chung').insert({ nhiem_vu_id: id, nop_boi: nv.owner_tai_khoan, ...minhChung, ...(minhChung.hop_le ? { xac_nhan_boi: tk.demo_truongphong, xac_nhan_luc: new Date().toISOString() } : {}) }), 'Ghi minh chứng');
    }
    if (hoanThanh) loi(await db.from('nhiem_vu').update({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: hoanThanh, cap_nhat_boi: tk.demo_truongphong }).eq('id', id), 'Chuyển Hoàn thành');
  }
  console.log(`${dryRun ? '[dry-run] ' : ''}Bộ ${SEED_TAG} (phòng ${phong}): tạo ${kq.tao} · cập nhật hạn ${kq.capNhat} · đã có ${kq.daCo}`);
  if (!dryRun) await kiemPhamVi(db, ['demo_cvp', 'demo_a0']);
}

// Một dòng lich_su theo (việc, cột) nếu chưa có — cùng khoá chống trùng cho mọi lần chạy lại.
async function lichSuNeuThieu(db, id, cot, them) {
  const co = loi(await db.from('lich_su').select('id').eq('nhiem_vu_id', id).eq('cot', cot).limit(1), `Đọc lich_su ${cot}`);
  if (!co.length) loi(await db.from('lich_su').insert({ nhiem_vu_id: id, cot, nguon: 'app', ...them }), `Ghi lich_su ${cot}`);
}

// Đọc v_nhiem_vu bằng JWT của từng vai (apikey service_role chỉ để gọi GoTrue; PostgREST lấy vai từ Authorization) — phải thấy đủ 6 dòng tag.
async function kiemPhamVi(db, usernames) {
  const url = db.supabaseUrl; const key = db.supabaseKey;
  for (const u of usernames) {
    const dangNhap = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); // client riêng: không để phiên người dùng dính vào client service_role
    const s = await dangNhap.auth.signInWithPassword({ email: `${u}@vptu.caobang.local`, password: '123456' });
    if (s.error) throw new Error(`Đăng nhập ${u} để kiểm phạm vi: ${s.error.message}`);
    const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${s.data.session.access_token}` } } });
    const rows = loi(await c.from('v_nhiem_vu').select('id').like('noi_dung', `${SEED_TAG}%`), `Đọc v_nhiem_vu bằng ${u}`);
    if (rows.length < 6) throw new Error(`${u} chỉ thấy ${rows.length}/6 việc ${SEED_TAG} trên v_nhiem_vu — kiểm phân công phụ trách / RLS.`);
    console.log(`Phạm vi ${u}: thấy ${rows.length}/6 việc ${SEED_TAG}.`);
  }
}
