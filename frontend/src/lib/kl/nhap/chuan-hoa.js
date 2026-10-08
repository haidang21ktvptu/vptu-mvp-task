// Chuẩn hoá giá trị ô Excel → mã của hệ thống (nhập Excel, v9 đợt 2). Thứ tự khớp mỗi kiểu: từ điển dùng chung (tu_dien_nhap, người nhập đã
// chọn trước đó) → đúng mã → đúng tên (bỏ số thứ tự "8. ") → gần đúng duy nhất (tên chứa nhau, ≥ 4 ký tự; đánh dấu để người nhập xem lại).
// Không khớp / khớp nhiều → lỗi kèm danh sách chọn ở bước xem trước; người nhập chọn → lưu vào từ điển cho lần sau. Thuần (không DOM, không mạng).
import { chuanChu } from './truong.js';
import { NHOM_THAY_MAT, giaTriNhom } from '../thay-mat.js';
import { MUC_QUAN_TRONG } from '../ma-nguon.js';

export const LOAI_VB = [['KL_BTV', 'Kết luận Hội nghị Ban Thường vụ'], ['TB_THUONG_TRUC', 'Thông báo của Thường trực Tỉnh ủy'], ['NQ_TW', 'Nghị quyết Trung ương'],
  ['CONG_VAN', 'Công văn'], ['KHAC', 'Văn bản khác'], ['KL_BCH', 'Kết luận Ban Chấp hành Đảng bộ tỉnh'], ['NQ_BCH', 'Nghị quyết Ban Chấp hành Đảng bộ tỉnh']];   // 0087: thêm cuối (mẫu nhập giữ thứ tự cũ)
export const DO_KHAN = [['THUONG', 'Thường'], ['KHAN', 'Khẩn'], ['THUONG_KHAN', 'Thượng khẩn'], ['HOA_TOC', 'Hỏa tốc']];
export const TIEN_DO = [['DANG_THUC_HIEN', 'Đang thực hiện'], ['HOAN_THANH', 'Hoàn thành']];
export const CHAT_LUONG = [['KHONG_DAT', 'Không đạt'], ['DAT', 'Đạt'], ['DAT_TOT', 'Đạt tốt'], ['DAT_XUAT_SAC', 'Đạt xuất sắc']];
// Cách gọi khác hay gặp (đã chuẩn hoá) → mã.
const BI_DANH = {
  loai_van_ban: { 'ket luan': 'KL_BTV', 'ket luan btv': 'KL_BTV', 'thong bao': 'TB_THUONG_TRUC', 'thong bao ket luan': 'TB_THUONG_TRUC', 'nghi quyet': 'NQ_TW', 'cong van': 'CONG_VAN', khac: 'KHAC',
    'ket luan bch': 'KL_BCH', 'kl bch': 'KL_BCH', 'ket luan ban chap hanh': 'KL_BCH', 'nghi quyet bch': 'NQ_BCH', 'nq bch': 'NQ_BCH', 'nghi quyet ban chap hanh': 'NQ_BCH' },
  loai_thoi_han: { 'co han': 'CO_HAN_CU_THE', 'ky ban hanh': 'KY_BAN_HANH', 'thuong xuyen': 'THUONG_XUYEN', 'cho quyet dinh': 'CHO_QUYET_DINH' },
  do_khan: { 'binh thuong': 'THUONG', 'hoa toc': 'HOA_TOC', 'thuong khan': 'THUONG_KHAN', khan: 'KHAN', thuong: 'THUONG' },
  tien_do: { 'da hoan thanh': 'HOAN_THANH', xong: 'HOAN_THANH', 'da xong': 'HOAN_THANH', 'hoan thanh': 'HOAN_THANH', 'dang thuc hien': 'DANG_THUC_HIEN',
    'dang lam': 'DANG_THUC_HIEN', 'chua hoan thanh': 'DANG_THUC_HIEN', 'chua thuc hien': 'DANG_THUC_HIEN', 'qua han': 'DANG_THUC_HIEN' },
  chat_luong: { 'khong dat': 'KHONG_DAT', 'xuat sac': 'DAT_XUAT_SAC', 'dat xuat sac': 'DAT_XUAT_SAC', tot: 'DAT_TOT', 'dat tot': 'DAT_TOT', dat: 'DAT' },
  muc_quan_trong: { 'muc a': 'A', 'muc b': 'B', 'muc c': 'C', 'rat quan trong': 'A', 'quan trong': 'B', 'thong thuong': 'C', 'binh thuong': 'C' },   // 0093
};
// Kiểu trường → loại từ điển (khớp CHECK của tu_dien_nhap).
export const LOAI_TU_DIEN = { loaiVanBan: 'loai_van_ban', donVi: 'don_vi', canBo: 'can_bo', lanhDao: 'can_bo', loaiThoiHan: 'loai_thoi_han', sanPham: 'san_pham', cap: 'cap',
  doKhan: 'do_khan', nguon: 'nguon', nganh: 'nganh', linhVuc: 'linh_vuc', tienDo: 'tien_do', chatLuong: 'chat_luong' };

const boSo = (s) => chuanChu(s).replace(/^\d+[.)]\s*/, '');
const pad = (n) => String(n).padStart(2, '0');
const laNgayThat = (y, m, d) => { const x = new Date(Date.UTC(y, m - 1, d)); return y >= 1990 && y <= 2100 && x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };
// Ngày: số ngày Excel, 'YYYY-MM-DD', 'd/m/yyyy' (cả . và -), 'd/m/yy', "ngày 5 tháng 9 năm 2026"; năm ngoài 1990–2100 (ô ngày nhập nhầm 0, 10…)
// coi là không đọc được. → 'YYYY-MM-DD' | null
export function docNgay(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 32874 || v > 73415) return null;   // số ngày Excel của 01/01/1990 … 31/12/2100
    const d = new Date(Math.round((Math.floor(v) - 25569) * 86400) * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = chuanChu(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s); let y; let mo; let d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s))) [d, mo, y] = [+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]];
  else if ((m = /ngay (\d{1,2}) thang (\d{1,2}) nam (\d{4})/.exec(s))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if (/^\d{5}(\.\d+)?$/.test(s)) return docNgay(Number(s));
  else return null;
  return laNgayThat(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
}

// ds: [{ma, ten}] → { ma, hien, gan: 'tu_dien'|'ma'|'ten'|'gan_dung' } | { loi, chon: [{ma, ten}] }
function khopDanhMuc(v, ds, tuDien, biDanh) {
  const c = chuanChu(v); const cs = boSo(v);
  const tim = (ma) => ds.find((x) => x.ma === ma);
  if (tuDien?.has(c) && tim(tuDien.get(c))) return { ma: tuDien.get(c), hien: tim(tuDien.get(c)).ten, gan: 'tu_dien' };
  const theoMa = ds.find((x) => x.ma.toLowerCase() === String(v).trim().toLowerCase());
  if (theoMa) return { ma: theoMa.ma, hien: theoMa.ten, gan: 'ma' };
  const theoTen = ds.filter((x) => boSo(x.ten) === cs || chuanChu(x.ten) === c);
  if (theoTen.length === 1) return { ma: theoTen[0].ma, hien: theoTen[0].ten, gan: 'ten' };
  if (biDanh?.[cs] && tim(biDanh[cs])) return { ma: biDanh[cs], hien: tim(biDanh[cs]).ten, gan: 'ten' };
  const gan = cs.length >= 4 ? ds.filter((x) => { const t = boSo(x.ten); return t.length >= 4 && (t.includes(cs) || cs.includes(t)); }) : [];
  if (gan.length === 1) return { ma: gan[0].ma, hien: gan[0].ten, gan: 'gan_dung' };
  return { loi: theoTen.length > 1 || gan.length > 1 ? 'khớp nhiều mục — chọn đúng mục' : 'không khớp danh mục', chon: (theoTen.length > 1 ? theoTen : gan) };
}

// Cán bộ: từ điển → họ tên đúng (duy nhất) → "Họ tên — Phòng" / "Họ tên (Phòng)" → tên đăng nhập → chức danh lãnh đạo ("Chánh Văn phòng",
// "Trưởng phòng Tổng hợp").
// Cột "Lãnh đạo giao" (v3.18): nhóm "Lãnh đạo Văn phòng" / "Thường trực Tỉnh ủy" (bỏ đuôi "(cả nhóm)" của mẫu xuất) → "nhom:<mã>"; còn lại khớp
// một lãnh đạo A1 / A2 như cán bộ (chuyên viên không nhận — DB cũng từ chối).
const BI_DANH_NHOM = { LANH_DAO_VP: ['lanh dao van phong', 'lanh dao vp', 'ldvp', 'lanh dao van phong tinh uy'], THUONG_TRUC: ['thuong truc', 'thuong truc tinh uy', 'tt tinh uy', 'tttu'] };
function khopLanhDao(v, accounts, tuDien, tenPhong) {
  const c = chuanChu(v).replace(/\s*\(ca nhom\)$/, '');
  const td = tuDien?.get(c); const nhomTd = NHOM_THAY_MAT.find(([ma]) => giaTriNhom(ma) === td);   // người nhập đã chọn nhóm cho chữ này (từ điển can_bo)
  const nhom = nhomTd || NHOM_THAY_MAT.find(([ma, ten]) => chuanChu(ten) === c || BI_DANH_NHOM[ma].includes(c));
  if (nhom) return { ma: giaTriNhom(nhom[0]), hien: `${nhom[1]} (cả nhóm)`, gan: nhomTd ? 'tu_dien' : 'ten' };
  return khopCanBo(v, accounts.filter((a) => ['A1', 'A2'].includes(a.role_group)), tuDien, tenPhong);
}
function khopCanBo(v, accounts, tuDien, tenPhong) {
  const ds = accounts.filter((a) => !a.is_system);
  const c = chuanChu(v); const hien = (a) => `${a.full_name}${a.department ? ` — ${tenPhong(a.department)}` : ''}`;
  const ra = (a, gan) => ({ ma: a.id, hien: hien(a), gan });
  if (tuDien?.has(c)) { const a = ds.find((x) => x.id === tuDien.get(c)); if (a) return ra(a, 'tu_dien'); }
  const [ten, phong] = c.split(/\s+[—–-]\s+|\s*\(/).map((x) => x.replace(/\)$/, '').trim());
  let khop = ds.filter((a) => chuanChu(a.full_name) === ten);
  if (khop.length > 1 && phong) khop = khop.filter((a) => chuanChu(tenPhong(a.department)) === phong || chuanChu(a.department) === phong);
  if (khop.length === 1) return ra(khop[0], 'ten');
  if (khop.length > 1) return { loi: 'trùng tên — chọn đúng người', chon: khop.map((a) => ({ ma: a.id, ten: hien(a) })) };
  const theoTk = ds.find((a) => chuanChu(a.username) === c);
  if (theoTk) return ra(theoTk, 'ma');
  if (c === 'chanh van phong') { const a = ds.find((x) => x.role_group === 'A1' && x.is_chief); if (a) return ra(a, 'gan_dung'); }
  const tp = /^truong phong (.+)$/.exec(c);
  if (tp) { const a = ds.filter((x) => x.role_group === 'A2' && chuanChu(tenPhong(x.department)).includes(tp[1])); if (a.length === 1) return ra(a[0], 'gan_dung'); }
  return { loi: 'không khớp cán bộ nào', chon: [] };
}

// ctx: { dm (danhMucKl), accounts, tuDien: Map<loai, Map<goc, ma>>, tenPhong(ma) }. kieu theo truong.js. → { ma, hien, gan } | { loi, chon } | null (ô trống)
export function chuanGiaTri(kieu, v, ctx, them = {}) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const td = ctx.tuDien?.get(LOAI_TU_DIEN[kieu]);
  const tuDs = (ds) => ds.map(([ma, ten]) => ({ ma, ten }));
  switch (kieu) {
    case 'ngay': { const d = docNgay(v); return d ? { ma: d, hien: d.split('-').reverse().join('/') } : { loi: 'không đọc được ngày (dd/mm/yyyy)', chon: [] }; }
    case 'so': { const n = typeof v === 'number' ? Math.trunc(v) : Number((/\d+/.exec(String(v)) || [])[0]); return n > 0 ? { ma: n, hien: String(n) } : { loi: 'không phải số', chon: [] }; }
    case 'loaiVanBan': return khopDanhMuc(v, tuDs(LOAI_VB), td, BI_DANH.loai_van_ban);
    case 'doKhan': return khopDanhMuc(v, tuDs(DO_KHAN), td, BI_DANH.do_khan);
    case 'tienDo': return khopDanhMuc(v, tuDs(TIEN_DO), td, BI_DANH.tien_do);
    case 'chatLuong': return khopDanhMuc(v, tuDs(CHAT_LUONG), td, BI_DANH.chat_luong);
    case 'loaiThoiHan': return khopDanhMuc(v, ctx.dm.loaiThoiHan || [], td, BI_DANH.loai_thoi_han);
    case 'donVi': return khopDanhMuc(v, ctx.dm.donVi || [], td);
    case 'sanPham': return khopDanhMuc(v, ctx.dm.sanPham || [], td);
    case 'cap': return khopDanhMuc(v, ctx.dm.cap || [], td);
    case 'nguon': return khopDanhMuc(v, ctx.dm.nguonNhiemVu || [], td);
    case 'nganh': return khopDanhMuc(v, ctx.dm.nganh || [], td);
    case 'linhVuc': return khopDanhMuc(v, (ctx.dm.linhVuc || []).filter((l) => !them.nganh || l.nganh_ma === them.nganh), td);
    case 'canBo': return khopCanBo(v, ctx.accounts || [], td, ctx.tenPhong || ((x) => x || ''));
    case 'lanhDao': return khopLanhDao(v, ctx.accounts || [], td, ctx.tenPhong || ((x) => x || ''));
    // 0093: ba ô nguồn — không có từ điển (ô tuỳ chọn: không khớp thì bỏ giá trị, vẫn nhập dòng).
    case 'mucQT': return khopDanhMuc(v, tuDs(MUC_QUAN_TRONG), null, BI_DANH.muc_quan_trong);
    case 'coQuanTrinh': return khopDanhMuc(v, (ctx.dm.donVi || []).filter((d) => !d.trong_van_phong), null);
    case 'thuongTruc': return khopCanBo(v, (ctx.accounts || []).filter((a) => a.role_group === 'A0'), null, ctx.tenPhong || ((x) => x || ''));
    default: { const s = String(v).replace(/\r\n?/g, '\n').trim(); return { ma: s, hien: s }; }
  }
}
