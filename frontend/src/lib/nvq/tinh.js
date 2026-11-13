// Phân hệ Nhiệm vụ quý BTV: số liệu tổng hợp cho Tổng quan quý, Danh mục, Báo cáo — đếm trên dòng v_nvq_nhiem_vu / v_nvq_san_pham đã đọc (trạng thái,
// mức do CSDL tính). Thuần — unit test frontend/tests/nvq-tinh.test.mjs. Nhiệm vụ "Rút khỏi danh mục" không tính vào tổng (vẫn hiện riêng).
import { THU_TU_CTCB, spXong } from './nhan.js';

const NHOM_THU_TU = { TRONG_CT: 0, NGOAI_CT: 1 };
export const sapXepViTri = (rows) => [...rows].sort((a, b) => a.truc_so - b.truc_so || NHOM_THU_TU[a.nhom] - NHOM_THU_TU[b.nhom] || a.stt - b.stt);
export const trongDanhMuc = (rows) => rows.filter((r) => r.dieu_chinh !== 'RUT');
export const laMo = (r) => r.trang_thai !== 'HOAN_THANH' && r.trang_thai !== 'RUT';

export function spTheoNv(sp) {
  const m = new Map();
  [...sp].sort((a, b) => a.thu_tu - b.thu_tu).forEach((s) => { if (!m.has(s.nhiem_vu_id)) m.set(s.nhiem_vu_id, []); m.get(s.nhiem_vu_id).push(s); });
  return m;
}

// Ô số / câu tóm tắt: tổng (không gồm rút), từng trạng thái, đã / chưa cập nhật tuần này (chỉ việc còn mở).
export function demTheoTrangThai(rows) {
  const d = { tong: 0, HOAN_THANH: 0, DANG_THUC_HIEN: 0, THUONG_XUYEN: 0, CHAM_TIEN_DO: 0, CHUA_TRIEN_KHAI: 0, RUT: 0, hoanThanhCham: 0, mo: 0, daCapNhatTuan: 0 };
  rows.forEach((r) => {
    d[r.trang_thai] = (d[r.trang_thai] || 0) + 1;
    if (r.trang_thai === 'RUT') return;
    d.tong += 1;
    if (r.trang_thai === 'HOAN_THANH' && r.ket_qua === 'CHAM_TIEN_DO') d.hoanThanhCham += 1;
    if (laMo(r)) { d.mo += 1; if (r.cap_nhat_tuan_nay) d.daCapNhatTuan += 1; }
  });
  d.chuaCapNhatTuan = d.mo - d.daCapNhatTuan;
  return d;
}

// Tuần báo cáo chứa một ngày (trước tuần 1 → tuần 1; sau tuần cuối → tuần cuối).
export function tuanCua(tuans, ngay) {
  const ds = [...(tuans || [])].sort((a, b) => a.so - b.so);
  return ds.find((w) => w.tu_ngay <= ngay && ngay <= w.den_ngay) || (ds[0] && ngay < ds[0].tu_ngay ? ds[0] : ds.at(-1)) || null;
}
export const soNgayGiua = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// Câu tóm tắt cho lãnh đạo (một câu, con số luôn kèm danh từ — DESIGN mục 13).
export function cauTomTat(d, ky, homNay) {
  if (!d.tong) return 'Quý này chưa có nhiệm vụ trong danh mục.';
  const pt = (n) => `${Math.round((100 * n) / d.tong)}%`;
  const phan = [`${d.HOAN_THANH} hoàn thành (${pt(d.HOAN_THANH)})`, `${d.DANG_THUC_HIEN + d.THUONG_XUYEN} đang thực hiện`];
  if (d.CHAM_TIEN_DO) phan.push(`${d.CHAM_TIEN_DO} chậm tiến độ`);
  if (d.CHUA_TRIEN_KHAI) phan.push(`${d.CHUA_TRIEN_KHAI} chưa triển khai`);
  const con = ky ? soNgayGiua(homNay, ky.den_ngay) : null;
  const sau = con === null ? '' : con > 0 ? ` Còn ${con} ngày đến hết quý.` : con === 0 ? ' Hôm nay là ngày cuối quý.' : ' Quý đã kết thúc.';
  return `${d.tong} nhiệm vụ: ${phan.join(', ')}.${sau}`;
}

const goiDem = () => ({ tong: 0, hoanThanh: 0, dang: 0, cham: 0, chua: 0, daCapNhatTuan: 0, mo: 0 });
function cong(g, r) {
  g.tong += 1;
  if (r.trang_thai === 'HOAN_THANH') g.hoanThanh += 1;
  else if (r.trang_thai === 'CHAM_TIEN_DO') g.cham += 1;
  else if (r.trang_thai === 'CHUA_TRIEN_KHAI') g.chua += 1;
  else g.dang += 1;
  if (laMo(r)) { g.mo += 1; if (r.cap_nhat_tuan_nay) g.daCapNhatTuan += 1; }
}
const tyLe = (g) => ({ ...g, tyLe: g.tong ? Math.round((100 * g.hoanThanh) / g.tong) : 0 });

export function theoTruc(rows, truc = []) {
  return truc.map((t) => {
    const g = goiDem();
    trongDanhMuc(rows).filter((r) => r.truc_so === t.so).forEach((r) => cong(g, r));
    return tyLe({ so: t.so, ten: t.ten, tenNgan: t.ten_ngan, ...g });
  }).filter((x) => x.tong > 0);
}

// Lãnh đạo phụ trách của một nhiệm vụ (mã cá nhân): mục tập thể ("Thường trực Tỉnh ủy") tính cho từng đồng chí có cờ thuong_truc.
export function lanhDaoCaNhan(maDs, dm = []) {
  const theoMa = new Map(dm.map((l) => [l.ma, l]));
  const ra = new Set();
  (maDs || []).forEach((m) => {
    const l = theoMa.get(m);
    if (l?.tap_the) dm.filter((x) => x.thuong_truc && !x.tap_the).forEach((x) => ra.add(x.ma));
    else if (l) ra.add(m);
  });
  return [...ra];
}
export function theoLanhDao(rows, dm = []) {
  const m = new Map(dm.filter((l) => !l.tap_the).map((l) => [l.ma, { ma: l.ma, ten: l.ten, thuTu: l.thu_tu, ...goiDem() }]));
  trongDanhMuc(rows).forEach((r) => lanhDaoCaNhan(r.lanh_dao_ma, dm).forEach((ma) => { if (m.has(ma)) cong(m.get(ma), r); }));
  return [...m.values()].filter((g) => g.tong > 0).sort((a, b) => a.thuTu - b.thuTu).map(tyLe);
}
// Đơn vị chủ trì đầu tiên của nhiệm vụ (vai trò CHU_TRI) — thống kê "theo đơn vị tham mưu, chủ trì".
export const donViChuTri = (r) => (r.don_vi || []).find((d) => (d.vai_tro || 'CHU_TRI') === 'CHU_TRI')?.ma || null;
export function theoDonVi(rows, dm = []) {
  const m = new Map(dm.map((d) => [d.ma, { ma: d.ma, ten: d.ten, thuTu: d.thu_tu, ...goiDem() }]));
  const khac = { ma: '', ten: 'Chưa xác định đơn vị', thuTu: 999, ...goiDem() };
  trongDanhMuc(rows).forEach((r) => cong(m.get(donViChuTri(r)) || khac, r));
  return [...m.values(), khac].filter((g) => g.tong > 0).sort((a, b) => a.thuTu - b.thuTu).map(tyLe);
}
export function theoChuTri(rows, tenNguoi = (id) => id, tenPhong = (p) => p) {
  const m = new Map();
  trongDanhMuc(rows).forEach((r) => {
    const k = r.chu_tri_theo_doi || (r.phong_theo_doi ? `phong:${r.phong_theo_doi}` : '');
    if (!m.has(k)) m.set(k, { khoa: k, ten: r.chu_tri_theo_doi ? tenNguoi(r.chu_tri_theo_doi) : r.phong_theo_doi ? tenPhong(r.phong_theo_doi) : 'Chưa phân công', ...goiDem() });
    cong(m.get(k), r);
  });
  return [...m.values()].sort((a, b) => (a.khoa === '') - (b.khoa === '') || b.tong - a.tong || a.ten.localeCompare(b.ten, 'vi')).map(tyLe);
}

// Việc cần lãnh đạo quan tâm (CV 1400 CN-5.2): chậm tiến độ, có vướng mắc / đề xuất, chỉ đạo chưa xử lý — đủ 4 thông tin: đơn vị đang chậm, số ngày trễ,
// sản phẩm còn thiếu, lãnh đạo phụ trách (cấp cần quyết định).
export function diemNghen(rows, spMap = new Map()) {
  return trongDanhMuc(rows).filter((r) => laMo(r) && (r.trang_thai === 'CHAM_TIEN_DO' || r.vuong_mac || r.de_xuat || r.so_chi_dao_mo > 0))
    .map((r) => ({ r, conThieu: (spMap.get(r.id) || []).filter((s) => !spXong(s) && s.trang_thai !== 'KHONG_THUC_HIEN') }))
    .sort((a, b) => (b.r.so_ngay_qua || 0) - (a.r.so_ngay_qua || 0) || Boolean(b.r.vuong_mac) - Boolean(a.r.vuong_mac) || a.r.truc_so - b.r.truc_so);
}

// Kết quả / sản phẩm hoàn thành trong khoảng ngày (Kết quả mới trong tuần) — mới nhất trước.
export function ketQuaTrongKhoang(sp, rowsTheoId, tu, den) {
  return sp.filter((s) => s.trang_thai === 'HOAN_THANH' && s.ngay_hoan_thanh && s.ngay_hoan_thanh >= tu && s.ngay_hoan_thanh <= den && rowsTheoId.has(s.nhiem_vu_id))
    .map((s) => ({ s, r: rowsTheoId.get(s.nhiem_vu_id) })).sort((a, b) => (a.s.ngay_hoan_thanh < b.s.ngay_hoan_thanh ? 1 : -1));
}
// Kết quả / sản phẩm chưa xong có mốc trong khoảng (Đến hạn trong tháng).
export function denHanTrongKhoang(sp, rowsTheoId, tu, den) {
  return sp.filter((s) => !spXong(s) && s.trang_thai !== 'KHONG_THUC_HIEN' && s.han && s.han >= tu && s.han <= den && rowsTheoId.has(s.nhiem_vu_id)
    && rowsTheoId.get(s.nhiem_vu_id).trang_thai !== 'RUT')
    .map((s) => ({ s, r: rowsTheoId.get(s.nhiem_vu_id) })).sort((a, b) => (a.s.han > b.s.han ? 1 : a.s.han < b.s.han ? -1 : a.r.truc_so - b.r.truc_so));
}

// 05 chỉ tiêu cơ bản (Ban Tổ chức Trung ương — bắt buộc có con số mục tiêu): mọi kết quả loại chỉ tiêu có mã chỉ tiêu cơ bản, theo thứ tự quy định.
export function chiTieuCoBan(sp, rowsTheoId) {
  return THU_TU_CTCB.map((ma) => ({ ma, ds: sp.filter((s) => s.chi_tieu_co_ban === ma && rowsTheoId.has(s.nhiem_vu_id))
    .map((s) => ({ s, r: rowsTheoId.get(s.nhiem_vu_id) })) }));
}
export function mucChiTieu(s) {
  if (s.thuc_hien === null || s.thuc_hien === undefined) return { ma: 'chua', ten: 'Chưa có số liệu', lop: 'tt-xam' };
  if (s.dat_muc_tieu) return { ma: 'dat', ten: 'Đạt mục tiêu', lop: 'tt-xong' };
  return { ma: 'chua-dat', ten: 'Chưa đạt mục tiêu', lop: 'tt-cho' };
}

// Diễn biến qua các tuần đã chốt (ảnh chụp nvq_tuan.so_lieu).
export const xuHuongTuan = (tuans) => [...(tuans || [])].filter((w) => w.trang_thai === 'DA_CHOT' && w.so_lieu).sort((a, b) => a.so - b.so)
  .map((w) => ({ so: w.so, den: w.den_ngay, tong: w.so_lieu.tong || 0, hoanThanh: w.so_lieu.hoan_thanh || 0, cham: w.so_lieu.cham || 0 }));

// Lọc danh mục: q (chữ, không phân biệt dấu hoa / thường), trangThai, truc, nhom, lanhDao (mã cá nhân, mở rộng tập thể), donVi, chuTri (id / "phong:X" /
// "chua"), thang ("YYYY-MM": có kết quả chưa xong đến mốc trong tháng), cuaToi (id), chuaCapNhat.
const boDau = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
export function locRows(rows, loc = {}, { dmLanhDao = [], spMap = new Map() } = {}) {
  const q = boDau(loc.q).trim();
  return rows.filter((r) => {
    if (loc.trangThai && r.trang_thai !== loc.trangThai) return false;
    if (!loc.trangThai && !loc.coRut && r.trang_thai === 'RUT') return false;
    if (loc.truc && r.truc_so !== Number(loc.truc)) return false;
    if (loc.nhom && r.nhom !== loc.nhom) return false;
    if (loc.lanhDao && !lanhDaoCaNhan(r.lanh_dao_ma, dmLanhDao).includes(loc.lanhDao)) return false;
    if (loc.donVi && donViChuTri(r) !== loc.donVi) return false;
    if (loc.chuTri === 'chua' && (r.chu_tri_theo_doi || r.phong_theo_doi)) return false;
    if (loc.chuTri && loc.chuTri !== 'chua' && (loc.chuTri.startsWith('phong:') ? `phong:${r.phong_theo_doi}` !== loc.chuTri : r.chu_tri_theo_doi !== loc.chuTri)) return false;
    if (loc.cuaToi && !(r.chu_tri_theo_doi === loc.cuaToi || (r.phoi_hop_theo_doi || []).includes(loc.cuaToi) || (loc.phongToi && r.phong_theo_doi === loc.phongToi))) return false;
    if (loc.chuaCapNhat && !(laMo(r) && !r.cap_nhat_tuan_nay)) return false;
    if (loc.canQuanTam && !(laMo(r) && (r.trang_thai === 'CHAM_TIEN_DO' || r.vuong_mac || r.de_xuat || r.so_chi_dao_mo > 0))) return false;
    if (loc.thang && !(spMap.get(r.id) || []).some((s) => !spXong(s) && s.han && s.han.startsWith(loc.thang))) return false;
    if (q && !boDau([r.so_hieu, r.ma, r.noi_dung, r.don_vi_text, r.lanh_dao_text, r.ket_qua_can_dat, r.ket_qua_thuc_hien, r.chu_tri_ten].join(' ')).includes(q)) return false;
    return true;
  });
}
