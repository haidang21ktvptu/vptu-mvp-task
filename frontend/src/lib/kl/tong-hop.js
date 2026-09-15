// Tổng hợp thuần (không DOM, không Supabase) trên các dòng v_kl_dashboard mà RLS đã trả về cho người dùng.
// Nguyên tắc GĐ10: trạng thái từng dòng do DB tính (nhom_dem của kl_trang_thai); ở đây CHỈ đếm và nhóm, không tính
// lại hạn. Ô số và danh sách sinh từ cùng một mảng nên "tổng các nhóm = tổng dòng" và "bấm ô ra đúng danh sách"
// là bất biến cấu trúc. Có unit test ở frontend/tests/tong-hop.test.mjs.
import { NHOM, THU_TU_NHOM, nhomCua } from './nhan.js';
import { ngayTruoc } from './ngay.js';

export const CHUA_PHAN_LOAI = 'CHUA_PHAN_LOAI'; // lĩnh vực NULL (134 dòng production 15/9) — nhóm hiển thị, không bị lọc mất
export const CHUA_CO_NGANH = 'CHUA_CO_NGANH';

const demTrong = () => Object.fromEntries(THU_TU_NHOM.map((k) => [k, 0]));
const laMo = (r) => nhomCua(r.nhom_dem).mo;

// Đếm theo nhom_dem, đủ mọi khoá (0 khi không có) để ô số luôn vẽ được.
export function demTheoNhom(rows) {
  const d = demTrong();
  rows.forEach((r) => { d[r.nhom_dem] = (d[r.nhom_dem] || 0) + 1; });
  return d;
}

// Số tổng quan cho thanh số liệu / hàng 1–2 dashboard.
export function tongHop(rows) {
  const nhom = demTheoNhom(rows);
  const tong = rows.length;
  const hoanThanh = nhom.HOAN_THANH;
  return {
    tong, nhom,
    dangMo: rows.filter(laMo).length,
    tyLeHoanThanh: tong ? Math.round((hoanThanh / tong) * 100) : 0,
    hoanThanhChuaMinhChung: rows.filter((r) => r.nhom_dem === 'HOAN_THANH' && r.thieu_minh_chung).length,
    tuoiLonNhatCanDienHan: Math.max(0, ...rows.filter((r) => r.nhom_dem === 'CAN_DIEN_HAN').map((r) => r.tuoi_ngay || 0)),
    chiDaoChoPhanHoi: rows.reduce((s, r) => s + (r.so_chi_dao_cho_phan_hoi || 0), 0),
  };
}

// Thứ tự danh sách (thiết kế 3.4): có chỉ đạo chờ phản hồi → quá hạn (quá nhiều ngày trước) → sắp hạn (hạn gần trước)
// → cần điền hạn (tuổi lớn trước) → đang làm → chờ điều kiện → thường xuyên → hoàn thành (mới nhất trước).
export function sapXep(rows) {
  const khoa = (r) => {
    const n = nhomCua(r.nhom_dem);
    let phu;
    if (r.nhom_dem === 'QUA_HAN' || r.nhom_dem === 'DANG_DINH_CHINH') phu = -(r.so_ngay_qua || 0);
    else if (r.nhom_dem === 'CAN_DIEN_HAN') phu = -(r.tuoi_ngay || 0);
    else if (r.nhom_dem === 'HOAN_THANH') phu = -(Date.parse(r.ngay_hoan_thanh || r.cap_nhat_luc || 0) || 0);
    else phu = r.han_xu_ly ? Date.parse(r.han_xu_ly) : Number.MAX_SAFE_INTEGER;
    return [r.so_chi_dao_cho_phan_hoi > 0 ? 0 : 1, n.thuTu, phu, r.ma || ''];
  };
  return [...rows].map((r) => [khoa(r), r]).sort(([a], [b]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
  }).map(([, r]) => r);
}

// Bộ lọc danh sách: mọi khoá đều tuỳ chọn; '' hoặc null = không lọc. linhVuc nhận mã hoặc CHUA_PHAN_LOAI.
export function locRows(rows, f = {}) {
  const kw = (f.tuKhoa || '').trim().toLowerCase();
  return rows.filter((r) =>
    (!f.nhom || r.nhom_dem === f.nhom)
    && (!f.hoiNghi || String(r.so_hoi_nghi) === String(f.hoiNghi))
    && (!f.nganh || (f.nganh === CHUA_CO_NGANH ? !r.nganh_ma : r.nganh_ma === f.nganh))
    && (!f.linhVuc || (f.linhVuc === CHUA_PHAN_LOAI ? !r.linh_vuc_ma : r.linh_vuc_ma === f.linhVuc))
    && (!f.chuTri || r.chu_tri_id === f.chuTri)
    && (!f.coQuanTrinh || r.co_quan_trinh_ma === f.coQuanTrinh)
    && (!f.chiMo || laMo(r))
    && (!f.thieuMinhChung || (r.nhom_dem === 'HOAN_THANH' && r.thieu_minh_chung))
    && (!f.khongNgayHoanThanh || (r.nhom_dem === 'HOAN_THANH' && !r.ngay_hoan_thanh))
    && (!f.nhomTrong || f.nhomTrong.includes(r.nhom_dem))
    && (!f.dangDinhChinh || r.dang_dinh_chinh)
    && (!f.khongCapNhatQua || (laMo(r) && (ngayTruoc(r.cap_nhat_luc, f.now) ?? 0) > f.khongCapNhatQua))
    && (!kw || `${r.ma} ${r.noi_dung} ${r.chu_tri_ten || ''} ${r.co_quan_trinh_ten || ''}`.toLowerCase().includes(kw)));
}

// Hàng 4 dashboard: ngành → lĩnh vực, có nhóm "Chưa phân loại" (lĩnh vực NULL) trong mỗi ngành và "Chưa có ngành".
export function theoNganhLinhVuc(rows) {
  const nganh = new Map();
  rows.forEach((r) => {
    const nk = r.nganh_ma || CHUA_CO_NGANH;
    if (!nganh.has(nk)) nganh.set(nk, { ma: nk, ten: r.nganh_ten || 'Chưa có ngành', so: 0, nhom: demTrong(), linhVuc: new Map() });
    const n = nganh.get(nk);
    n.so++; n.nhom[r.nhom_dem] = (n.nhom[r.nhom_dem] || 0) + 1;
    const lk = r.linh_vuc_ma || CHUA_PHAN_LOAI;
    if (!n.linhVuc.has(lk)) n.linhVuc.set(lk, { ma: lk, ten: r.linh_vuc_ten || 'Chưa phân loại', so: 0, nhom: demTrong() });
    const l = n.linhVuc.get(lk);
    l.so++; l.nhom[r.nhom_dem] = (l.nhom[r.nhom_dem] || 0) + 1;
  });
  const sapLV = (a, b) => (a.ma === CHUA_PHAN_LOAI) - (b.ma === CHUA_PHAN_LOAI) || a.ten.localeCompare(b.ten, 'vi');
  return [...nganh.values()]
    .map((n) => ({ ...n, linhVuc: [...n.linhVuc.values()].sort(sapLV) }))
    .sort((a, b) => (a.ma === CHUA_CO_NGANH) - (b.ma === CHUA_CO_NGANH) || a.ten.localeCompare(b.ten, 'vi', { numeric: true }));
}

// Hàng 3a: theo chủ trì, CHỈ việc đang mở, phân theo nhóm (quá hạn / sắp hạn / cần điền hạn / đang làm / chờ điều kiện).
export function theoChuTriMo(rows) {
  const m = new Map();
  rows.filter(laMo).forEach((r) => {
    if (!m.has(r.chu_tri_id)) m.set(r.chu_tri_id, { chu_tri_id: r.chu_tri_id, ten: r.chu_tri_ten || '(không rõ)', phong: r.chu_tri_phong, so: 0, nhom: demTrong() });
    const c = m.get(r.chu_tri_id);
    c.so++; c.nhom[r.nhom_dem] = (c.nhom[r.nhom_dem] || 0) + 1;
  });
  return [...m.values()].sort((a, b) => b.so - a.so || a.ten.localeCompare(b.ten, 'vi'));
}

// Hàng 3b: n hội nghị gần nhất (số hội nghị lớn nhất), tỷ lệ hoàn thành từng hội nghị.
export function theoHoiNghi(rows, n = 8) {
  const m = new Map();
  rows.forEach((r) => {
    if (!m.has(r.so_hoi_nghi)) m.set(r.so_hoi_nghi, { so_hoi_nghi: r.so_hoi_nghi, ngay_ban_hanh: r.ngay_ban_hanh, tong: 0, hoanThanh: 0, nhom: demTrong() });
    const h = m.get(r.so_hoi_nghi);
    h.tong++; h.nhom[r.nhom_dem] = (h.nhom[r.nhom_dem] || 0) + 1;
    if (r.nhom_dem === 'HOAN_THANH') h.hoanThanh++;
    if (r.ngay_ban_hanh < h.ngay_ban_hanh) h.ngay_ban_hanh = r.ngay_ban_hanh;
  });
  return [...m.values()].sort((a, b) => b.so_hoi_nghi - a.so_hoi_nghi).slice(0, n)
    .map((h) => ({ ...h, tyLe: h.tong ? Math.round((h.hoanThanh / h.tong) * 100) : 0 }));
}

// Cuối trang: chỉ số chất lượng dữ liệu (thiết kế 6.7). nguongNgay đọc từ kl_cau_hinh (mặc định 30).
export function chatLuong(rows, nguongNgay = 30, now = new Date()) {
  const tre = rows.map((r) => r.do_tre_nhap_lieu).filter((x) => x !== null && x !== undefined);
  return {
    hoanThanhChuaMinhChung: locRows(rows, { thieuMinhChung: true }).length,
    hoanThanhKhongNgayGoc: locRows(rows, { khongNgayHoanThanh: true }).length,
    moKhongCapNhat: locRows(rows, { khongCapNhatQua: nguongNgay, now }).length,
    doTreTrungBinh: tre.length ? Math.round((tre.reduce((a, b) => a + b, 0) / tre.length) * 10) / 10 : null,
    doTreLonNhat: tre.length ? Math.max(...tre) : null,
    soDongCoDoTre: tre.length,
    dangDinhChinh: rows.filter((r) => r.dang_dinh_chinh).length,
  };
}

// Bất biến kiểm tra tại chỗ (dùng trong test và có thể bật cảnh báo ở giao diện): tổng các nhóm = tổng dòng.
export function kiemBatBien(rows) {
  const nhom = demTheoNhom(rows);
  const tongNhom = Object.values(nhom).reduce((a, b) => a + b, 0);
  const tongLV = theoNganhLinhVuc(rows).reduce((s, n) => s + n.linhVuc.reduce((t, l) => t + l.so, 0), 0);
  return { dung: tongNhom === rows.length && tongLV === rows.length, tongNhom, tongLV, tong: rows.length, nhomLa: Object.keys(nhom).filter((k) => !NHOM[k]) };
}
