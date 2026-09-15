// Kiểm tra và ánh xạ dữ liệu KL BTVTU trước khi ghi (thiết kế Phần 2.3/2.4): danh mục đối chiếu TỪNG KÝ TỰ với
// bảng dm_* trong DB (không bí danh), chủ trì đối chiếu họ tên chính xác với accounts.full_name (không đoán;
// không khớp → vi phạm ánh xạ, script dừng), "VPTU" → Trưởng phòng Tổng hợp xác định từ accounts (quyết định 1, 6).
// Vi phạm DỮ LIỆU và vi phạm ÁNH XẠ tách riêng để dry-run trên local (chỉ có tài khoản demo) vẫn kiểm được dữ liệu.

export const LY_DO_CHUA_CO_HAN = 'Phụ thuộc yếu tố bên ngoài (chốt 14/9/2026)';
export const GHI_CHU_VPTU = 'Chuyển từ VPTU (chủ trì gốc trên Excel: VPTU)';
export const TEN_VPTU = 'VPTU';
const MA_RE = /^NV-\d{3}$/;

// Tiêu đề cột nhật ký Excel → cột kl_nhiem_vu (tiêu đề khác giữ nguyên văn, ví dụ "Sửa nhiều ô: B176:B179").
export const COT_NHAT_KY = {
  'Tiến độ': 'tien_do_ma', 'Hạn xử lý': 'han_xu_ly', 'Ngành/lĩnh vực': 'nganh_ma', 'Cơ quan/đơn vị trình': 'co_quan_trinh_ma',
  'Loại thời hạn': 'loai_thoi_han_ma', 'Chủ trì theo dõi': 'chu_tri_id', 'Kết quả thực hiện / Minh chứng': 'minh_chung',
  'Văn bản triển khai': 'van_ban_trien_khai', 'Lĩnh vực chi tiết': 'linh_vuc_chi_tiet', 'Nội dung kết luận / Văn bản trình': 'noi_dung',
  'Ngày cập nhật gần nhất': 'cap_nhat_luc', 'Số hội nghị': 'so_hoi_nghi', 'Số TB/KL': 'so_ket_luan', 'Ngày ban hành': 'ngay_ban_hanh',
  'STT': 'stt', 'Mã nhiệm vụ': 'ma',
};

export function homNayVN() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

async function docBang(db, bang, cot) {
  const { data, error } = await db.from(bang).select(cot);
  if (error) throw new Error(`Không đọc được ${bang}: ${error.message}`);
  return data;
}

// Danh mục từ DB: Map ten → ma cho 4 bảng.
export async function docDanhMuc(db) {
  const dm = {};
  for (const [k, bang] of [['nganh', 'dm_nganh'], ['co_quan', 'dm_co_quan_trinh'], ['loai', 'dm_loai_thoi_han'], ['tien_do', 'dm_tien_do']]) {
    dm[k] = new Map((await docBang(db, bang, 'ma, ten')).map((r) => [r.ten, r.ma]));
  }
  return dm;
}

export async function docTaiKhoan(db) {
  return docBang(db, 'accounts', 'id, username, full_name, role_group, position_title, department, is_system');
}

// Bảng ánh xạ chủ trì: mỗi tên Excel → đúng một tài khoản. Trả về { bang, loi, theoTen }.
export function anhXaChuTri(rows, accounts) {
  const dem = new Map();
  for (const r of rows) if (r.chu_tri_ten) dem.set(r.chu_tri_ten, (dem.get(r.chu_tri_ten) || 0) + 1);
  const bang = [];
  const loi = [];
  for (const ten of [...dem.keys()].sort((a, b) => a.localeCompare(b, 'vi'))) {
    let ung; let ghiChu = '';
    if (ten === TEN_VPTU) {
      ung = accounts.filter((a) => a.department === 'TONG_HOP' && a.role_group === 'A2' && a.position_title === 'Trưởng phòng' && !a.is_system);
      ghiChu = 'Trưởng phòng Tổng hợp (quyết định 1) — ghi_chu "chuyển từ VPTU"';
    } else {
      ung = accounts.filter((a) => a.full_name.trim() === ten && !a.is_system);
    }
    if (ung.length === 1) bang.push({ ten, username: ung[0].username, id: ung[0].id, so_dong: dem.get(ten), ghi_chu: ghiChu });
    else {
      const ly = ung.length === 0 ? 'không có tài khoản nào khớp họ tên' : `khớp ${ung.length} tài khoản (${ung.map((a) => a.username).join(', ')})`;
      loi.push(`"${ten}" (${dem.get(ten)} dòng): ${ly}`);
    }
  }
  return { bang, loi, theoTen: new Map(bang.map((b) => [b.ten, b])) };
}

// Ánh xạ email người sửa nhật ký → tài khoản (file JSON {"email": "username"} ngoài repo). Thiếu → vi phạm ánh xạ.
// Ô "người sửa" không phải địa chỉ email (Apps Script ghi chú "không xác định được") → nguoi_sua NULL, giữ nguyên văn
// ở nguoi_sua_ghi_chu, liệt kê ở khongRo để chủ dự án biết.
export function anhXaEmail(nhatKy, accounts, anhXa) {
  const laEmail = (s) => s.includes('@');
  const emails = [...new Set(nhatKy.map((n) => n.email).filter((e) => e && laEmail(e)))].sort();
  const khongRo = nhatKy.filter((n) => n.email && !laEmail(n.email)).map((n) => `nhật ký dòng ${n.dong_nhat_ky} (${n.ma || 'dòng ' + n.dong}): "${n.email}"`);
  const theoUsername = new Map(accounts.map((a) => [a.username, a]));
  const bang = new Map();
  const loi = [];
  for (const e of emails) {
    const u = anhXa?.[e];
    if (!u) loi.push(`email "${e}" chưa có trong file ánh xạ người sửa (--anh-xa-nguoi-sua)`);
    else if (!theoUsername.has(u)) loi.push(`email "${e}" ánh xạ tới username "${u}" không có trong accounts`);
    else bang.set(e, theoUsername.get(u));
  }
  return { bang, loi, emails, khongRo };
}

const them = (ds, ma, dong, moTa) => ds.push({ ma: ma || '(không mã)', dong, mo_ta: moTa });

export function congNgay(ngay, n) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const COT_BAT_BUOC = [['ma', 'mã'], ['so_hoi_nghi', 'số hội nghị'], ['so_ket_luan', 'số TB/KL'], ['ngay_ban_hanh', 'ngày ban hành'],
  ['chu_tri_ten', 'chủ trì'], ['nganh_ten', 'ngành/lĩnh vực'], ['co_quan_trinh_ten', 'cơ quan trình'], ['noi_dung', 'nội dung'],
  ['loai_thoi_han_ten', 'loại thời hạn'], ['tien_do_ten', 'tiến độ']];
const COT_DANH_MUC = [['nganh_ten', 'nganh', 'ngành'], ['co_quan_trinh_ten', 'co_quan', 'cơ quan trình'],
  ['loai_thoi_han_ten', 'loai', 'loại thời hạn'], ['tien_do_ten', 'tien_do', 'tiến độ']];

// Kiểm tra dữ liệu + nhóm tự xử lý + cảnh báo mềm. Không đụng tới ánh xạ tài khoản (làm riêng ở trên).
export function kiemTraDuLieu(nguon, dm, homNay = homNayVN()) {
  const viPham = [];
  const canhBao = { hoanThanhThieuMinhChung: 0, hoanThanhKhongHan: 0, kyBanHanhHanKhac: [] };
  const tuXuLy = { canLyDo: [], vptu: [], nhatKySuyMa: [] };
  const maDaThay = new Map();
  const hoiNghi = new Map();
  for (const r of nguon.nhiem_vu) {
    for (const [k, nhan] of COT_BAT_BUOC) if (r[k] == null || String(r[k]).trim() === '') them(viPham, r.ma, r.dong, `thiếu ${nhan}`);
    if (r.ma && !MA_RE.test(r.ma)) them(viPham, r.ma, r.dong, 'mã không đúng dạng NV-xxx');
    if (r.ma) { if (maDaThay.has(r.ma)) them(viPham, r.ma, r.dong, `mã trùng với dòng ${maDaThay.get(r.ma)}`); else maDaThay.set(r.ma, r.dong); }
    for (const [k, m, nhan] of COT_DANH_MUC) if (r[k] && !dm[m].has(r[k])) them(viPham, r.ma, r.dong, `${nhan} ngoài danh mục: "${r[k]}"`);
    if (r.ngay_ban_hanh && r.ngay_ban_hanh > homNay) them(viPham, r.ma, r.dong, `ngày ban hành ${r.ngay_ban_hanh} ở tương lai`);
    if (r.han_xu_ly && r.ngay_ban_hanh && r.han_xu_ly < r.ngay_ban_hanh) them(viPham, r.ma, r.dong, `hạn ${r.han_xu_ly} trước ngày ban hành ${r.ngay_ban_hanh}`);
    const khoaHN = `${r.so_hoi_nghi}|${r.so_ket_luan}`;
    if (hoiNghi.has(khoaHN) && hoiNghi.get(khoaHN) !== r.ngay_ban_hanh) them(viPham, r.ma, r.dong, `hội nghị ${khoaHN} có hai ngày ban hành (${hoiNghi.get(khoaHN)} / ${r.ngay_ban_hanh})`);
    hoiNghi.set(khoaHN, r.ngay_ban_hanh);
    const loai = dm.loai.get(r.loai_thoi_han_ten); const td = dm.tien_do.get(r.tien_do_ten);
    if (td === 'HOAN_THANH' && !r.minh_chung) canhBao.hoanThanhThieuMinhChung++;
    if (td === 'HOAN_THANH' && loai === 'CO_HAN_CU_THE' && !r.han_xu_ly) canhBao.hoanThanhKhongHan++;
    if (td !== 'HOAN_THANH' && loai === 'CO_HAN_CU_THE' && !r.han_xu_ly) tuXuLy.canLyDo.push(r.ma);
    if (loai === 'KY_BAN_HANH' && r.han_xu_ly && r.ngay_ban_hanh && r.han_xu_ly !== congNgay(r.ngay_ban_hanh, 10)) canhBao.kyBanHanhHanKhac.push(`${r.ma} (${r.han_xu_ly})`);
    if (r.chu_tri_ten === TEN_VPTU) tuXuLy.vptu.push(r.ma);
  }
  for (const n of nguon.nhat_ky) {
    if (!n.ma) {
      if (n.dong == null) { them(viPham, null, n.dong_nhat_ky, `nhật ký dòng ${n.dong_nhat_ky}: không có mã lẫn số dòng`); continue; }
      n.ma = `NV-${String(n.dong - 3).padStart(3, '0')}`;   // công thức mã của sheet: NV-(dòng − 3), đã đối chiếu 177 dòng có mã
      tuXuLy.nhatKySuyMa.push(`dòng ${n.dong} → ${n.ma} (${n.cot})`);
    }
    if (!maDaThay.has(n.ma)) them(viPham, n.ma, n.dong_nhat_ky, `nhật ký dòng ${n.dong_nhat_ky}: mã ${n.ma} không có trong dữ liệu`);
    if (!n.luc) them(viPham, n.ma, n.dong_nhat_ky, `nhật ký dòng ${n.dong_nhat_ky}: thiếu thời gian`);
    if (!n.cot) them(viPham, n.ma, n.dong_nhat_ky, `nhật ký dòng ${n.dong_nhat_ky}: thiếu tên cột`);
  }
  return { viPham, canhBao, tuXuLy };
}

const demTheo = (rows, f) => {
  const m = {};
  for (const r of rows) { const k = f(r) ?? '(trống)'; m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort(([a], [b]) => String(a).localeCompare(String(b), 'vi', { numeric: true })));
};

// Bảng đối chiếu số thô (KHÔNG tính trạng thái — đó là việc của kl_trang_thai trong DB). an-danh so sánh
// nguyên object này giữa file thật và bản ẩn danh.
export function tongHop(rows) {
  return {
    tong: rows.length,
    hoi_nghi: new Set(rows.map((r) => `${r.so_hoi_nghi}|${r.so_ket_luan}`)).size,
    so_hoi_nghi: new Set(rows.map((r) => r.so_hoi_nghi)).size,
    tien_do: demTheo(rows, (r) => r.tien_do_ten),
    loai_thoi_han: demTheo(rows, (r) => r.loai_thoi_han_ten),
    co_han_theo_tien_do: demTheo(rows, (r) => `${r.tien_do_ten} · ${r.han_xu_ly ? 'có hạn' : 'không hạn'}`),
    theo_hoi_nghi: demTheo(rows, (r) => r.so_hoi_nghi),
    nganh: demTheo(rows, (r) => r.nganh_ten),
    co_quan_trinh: demTheo(rows, (r) => r.co_quan_trinh_ten),
    co_cap_nhat_luc: rows.filter((r) => r.cap_nhat_luc).length,
    han_xu_ly_theo_ngay: demTheo(rows.filter((r) => r.han_xu_ly), (r) => r.han_xu_ly),
  };
}

export function tongHopNhatKy(nhatKy) {
  return { tong: nhatKy.length, theo_cot: demTheo(nhatKy, (n) => n.cot), so_ma: Object.keys(demTheo(nhatKy, (n) => n.ma)).length };
}
