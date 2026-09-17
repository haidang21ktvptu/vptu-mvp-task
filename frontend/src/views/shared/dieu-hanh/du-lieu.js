// Dữ liệu và bộ lọc của Trung tâm điều hành (A0) / Điều hành hôm nay (A1) / Phòng tôi (A2): một lần nạp gồm v_nhiem_vu (tình hình
// chung), v_ngoai_le (việc Đỏ + khâu), v_chi_dao_tt, kl_so_lieu_tai(hôm nay) và (hôm nay − 7) cho xu hướng, minh chứng chờ, chỉ đạo chờ.
// Thuần tổng hợp trên dòng RLS trả về (DB-5): đếm theo khâu / đơn vị làm ở đây, không thêm hàm DB.
import { state } from '../../../lib/state.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../../lib/kl/du-lieu.js';
import { loadNgoaiLe, loadChiDaoTT, loadSoLieuTai, loadMinhChungCho, loadChiDaoCho } from '../../../lib/kl/dieu-hanh.js';
import { homNayVN, congNgay } from '../../../lib/kl/ngay.js';
import { THU_TU_KHAU, boSoThuTu } from '../../../lib/kl/nhan.js';

export const dh = { rows: [], ngoaiLe: [], chiDaoTT: [], soLieu: null, soLieuTuanTruoc: null, mcCho: [], chiDaoCho: [], luc: null, loc: { khau: null, dv: null, kpi: null } };

export async function napDieuHanh() {
  await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
  const homNay = homNayVN();
  const [r, nl, tt, sl, sl7, mc, cd] = await Promise.all([loadKlRows(), loadNgoaiLe(), loadChiDaoTT(), loadSoLieuTai(homNay), loadSoLieuTai(congNgay(homNay, -7)),
    loadMinhChungCho(), loadChiDaoCho()]);
  Object.assign(dh, { rows: r.rows, ngoaiLe: nl, chiDaoTT: tt, soLieu: sl, soLieuTuanTruoc: sl7, mcCho: mc, chiDaoCho: cd, luc: r.luc });
  return dh;
}

export const timRow = (id) => dh.rows.find((r) => r.id === id);
const me = () => state.user?.id;

// Chỉ đạo Thường trực liên quan tới tôi: A0 = mình gửi; A1 = mình là người nhận.
export function chiDaoTTCuaToi() {
  if (state.user?.role_group === 'A0') return dh.chiDaoTT.filter((c) => c.nguoi_gui === me());
  return dh.chiDaoTT.filter((c) => (c.nguoi_nhan || []).includes(me()));
}
export const ttCuaViec = (nhiemVuId) => chiDaoTTCuaToi().filter((c) => c.nhiem_vu_id === nhiemVuId);
export const ttCho = () => chiDaoTTCuaToi().filter((c) => c.trang_thai === 'CHO_PHAN_HOI');

// Việc Đỏ (nhóm DO của v_ngoai_le; việc đang tra soát tách riêng).
export const viecDo = () => dh.ngoaiLe.filter((r) => r.nhom === 'DO');
export const CAP_CUA_VAI = { A0: ['THUONG_TRUC', 'BAN_THUONG_VU'], A1: ['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG'], A2: ['TRUONG_PHONG'] };
export const canToiQuyet = (r) => (CAP_CUA_VAI[state.user?.role_group] || []).includes(r.cap_quyet_dinh);

// Đếm theo khâu (đủ 4 khoá, thứ tự cố định) và theo đơn vị Owner (số việc, tổng ngày trễ; nhiều việc trước).
export function theoKhau(rows = viecDo()) {
  return THU_TU_KHAU.map((k) => ({ khau: k, so: rows.filter((r) => r.khau === k).length }));
}
export function theoDonVi(rows = viecDo()) {
  const m = new Map();
  rows.forEach((r) => {
    const k = r.owner_don_vi_ma || '';
    if (!m.has(k)) m.set(k, { ma: k, ten: boSoThuTu(r.owner_don_vi_ten) || '(chưa xác định)', trongVP: Boolean(r.owner_trong_van_phong), so: 0, ngay: 0 });
    const c = m.get(k); c.so++; c.ngay += r.so_ngay_qua || 0;
  });
  return [...m.values()].sort((a, b) => b.so - a.so || b.ngay - a.ngay);
}

// Lọc danh sách thẻ theo bộ lọc hiện tại: khâu, đơn vị, số-lọc (quyet | nghen | cho | tt | mc | tat).
export function locThe() {
  const { khau, dv, kpi } = dh.loc;
  return viecDo().filter((r) => (!khau || r.khau === khau) && (!dv || (r.owner_don_vi_ma || '') === dv)
    && (kpi !== 'quyet' || canToiQuyet(r)) && (kpi !== 'cho' && kpi !== 'tt' || ttCuaViec(r.id).some((c) => c.trang_thai === 'CHO_PHAN_HOI'))
    && (kpi !== 'mc' || r.khau === 'CHO_MINH_CHUNG'))
    .sort((a, b) => (canToiQuyet(b) ? 1 : 0) - (canToiQuyet(a) ? 1 : 0) || b.so_ngay_qua - a.so_ngay_qua);
}

// Xu hướng so với tuần trước từ kl_so_lieu_tai: { hienTai, truoc, chenh } cho một tập khoá của muc_canh_bao hoặc nhom_dem.
export function xuHuong(bang, khoa) {
  const dem = (s) => khoa.reduce((t, k) => t + Number(s?.[bang]?.[k] || 0), 0);
  const hienTai = dem(dh.soLieu); const truoc = dem(dh.soLieuTuanTruoc);
  return { hienTai, truoc, chenh: hienTai - truoc };
}
// "tăng 1 so với tuần trước" / "giảm 2 so với tuần trước" / "không đổi so với tuần trước"; tot = tăng là tốt (hoàn thành).
export function chuXuHuong(chenh, tot = false) {
  if (!dh.soLieuTuanTruoc) return { chu: '', lop: '' };
  if (chenh === 0) return { chu: 'không đổi so với tuần trước', lop: '' };
  const tang = chenh > 0;
  return { chu: `${tang ? 'tăng' : 'giảm'} ${Math.abs(chenh)} so với tuần trước`, lop: `${tang ? 'tang' : 'giam'}${tot ? ' tot' : ''}` };
}
