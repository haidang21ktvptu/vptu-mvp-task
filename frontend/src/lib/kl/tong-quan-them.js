// Tổng quan — Đợt C1 v3.19: thanh lọc (phạm vi tôi theo dõi / giao, loại văn bản, phòng, cán bộ chủ trì, độ khẩn, lãnh đạo VP phụ trách),
// khối "Theo loại văn bản", khối "Theo lãnh đạo VP phụ trách" (phân công phu_trach_phong hiệu lực — cùng quy tắc pcvp_phu_trach: kiêm nhiệm
// đúng phòng + ngành + lĩnh vực thắng "cả phòng"; phòng của việc = phòng người theo dõi và phòng chủ trì trong Văn phòng, như kl_pham_vi) và
// thanh tải chồng của bảng KPI. Thuần tổng hợp trên dòng v_nhiem_vu RLS đã trả về — không DOM, không Supabase; unit test tong-quan-them.test.mjs.
import { soLieuChinh, laXong, laMo, mucMo } from './tong-quan.js';
import { THU_TU_DO_KHAN, tenDoKhan } from './do-khan.js';

export const LOC_TRONG = { phamVi: '', loai: '', phong: '', canBo: '', doKhan: '', ldvp: '' };
export const coLoc = (loc) => Object.values(loc || {}).some(Boolean);
export const NGOAI_VP = 'NGOAI';      // ô Phòng: đơn vị ngoài Văn phòng chủ trì
export const CHUA_LDVP = 'CHUA';      // ô Lãnh đạo VP: việc không thuộc phòng nào đang có lãnh đạo phụ trách
export const KHONG_VB = 'KHONG_VB';   // việc không gắn văn bản giao việc

export const phongCuaViec = (r) => [...new Set([r.nguoi_theo_doi_phong, r.owner_trong_van_phong ? r.owner_phong : null].filter(Boolean))];
// phanCong: dòng phu_trach_phong đang hiệu lực { lanh_dao_id, phong, nganh_ma, linh_vuc_ma }.
export function lanhDaoPhuTrach(r, phanCong = []) {
  const ids = new Set();
  phongCuaViec(r).forEach((phong) => {
    const kn = phanCong.find((p) => p.phong === phong && p.nganh_ma != null && p.nganh_ma === r.nganh_ma && p.linh_vuc_ma != null && p.linh_vuc_ma === r.linh_vuc_ma);
    if (kn) { ids.add(kn.lanh_dao_id); return; }
    phanCong.filter((p) => p.phong === phong && p.nganh_ma == null).forEach((p) => ids.add(p.lanh_dao_id));
  });
  return [...ids];
}
const cuaToi = (r, me) => Boolean(me) && [r.nguoi_theo_doi, r.owner_tai_khoan, r.tao_boi, r.giao_thay_mat_cho].includes(me);
export const loaiCua = (r) => r.van_ban_loai || KHONG_VB;

export function locTongQuan(rows, loc, { me = null, phanCong = [] } = {}) {
  const l = { ...LOC_TRONG, ...(loc || {}) };
  if (!coLoc(l)) return rows;
  return rows.filter((r) => (!l.phamVi || cuaToi(r, me))
    && (!l.loai || loaiCua(r) === l.loai)
    && (!l.phong || (l.phong === NGOAI_VP ? !r.owner_trong_van_phong : r.owner_trong_van_phong && r.owner_phong === l.phong))
    && (!l.canBo || r.owner_tai_khoan === l.canBo)
    && (!l.doKhan || (r.do_khan || 'THUONG') === l.doKhan)
    && (!l.ldvp || (l.ldvp === CHUA_LDVP ? lanhDaoPhuTrach(r, phanCong).length === 0 : lanhDaoPhuTrach(r, phanCong).includes(l.ldvp))));
}

// Lựa chọn của từng ô, đếm trên TOÀN BỘ dòng (không theo bộ lọc đang chọn) để người xem thấy đủ; chỉ giá trị có trong dữ liệu.
const dem = (rows, khoa) => { const m = new Map(); rows.forEach((r) => { const k = khoa(r); if (k) m.set(k, (m.get(k) || 0) + 1); }); return m; };
export function tuyChonLoc(rows, { tenPhong = {}, tenCanBo = () => '', lanhDaoVP = [], tenLoai = (m) => m } = {}) {
  const loai = [...dem(rows, loaiCua)].map(([ma, n]) => ({ ma, ten: ma === KHONG_VB ? 'Không có văn bản' : tenLoai(ma), n })).sort((a, b) => b.n - a.n || (a.ma === KHONG_VB) - (b.ma === KHONG_VB) || a.ten.localeCompare(b.ten, 'vi'));
  const phong = [...dem(rows, (r) => (r.owner_trong_van_phong ? r.owner_phong : NGOAI_VP))].map(([ma, n]) => ({ ma, ten: ma === NGOAI_VP ? 'Đơn vị ngoài Văn phòng' : tenPhong[ma] || ma, n }))
    .sort((a, b) => (a.ma === NGOAI_VP) - (b.ma === NGOAI_VP) || a.ten.localeCompare(b.ten, 'vi'));
  const canBo = [...dem(rows, (r) => r.owner_tai_khoan)].map(([ma, n]) => ({ ma, ten: tenCanBo(ma) || rows.find((r) => r.owner_tai_khoan === ma)?.owner_tai_khoan_ten || 'Cán bộ', n }))
    .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
  const dk = dem(rows, (r) => r.do_khan || 'THUONG');
  const doKhan = [...THU_TU_DO_KHAN].reverse().filter((ma) => dk.has(ma)).map((ma) => ({ ma, ten: tenDoKhan(ma), n: dk.get(ma) }));
  const ldvp = lanhDaoVP.map((a) => ({ ma: a.id, ten: a.full_name, n: null }));
  return { loai, phong, canBo, doKhan, ldvp };
}

// Khối "Theo loại văn bản": mỗi loại có trong dữ liệu — tổng, hoàn thành (mọi kỳ), đang làm, cảnh báo; tỷ lệ trên tổng; nhiều việc trước.
export function theoLoaiVanBan(rows) {
  const m = new Map();
  rows.forEach((r) => { const ma = loaiCua(r); if (!m.has(ma)) m.set(ma, []); m.get(ma).push(r); });
  const tong = rows.length;
  return [...m.entries()].map(([ma, ds]) => {
    const mo = ds.filter(laMo);
    return { ma, tong: ds.length, xong: ds.filter(laXong).length, dangMo: mo.length, canhBao: mo.filter((r) => ['vang', 'do', 'ddb'].includes(mucMo(r))).length, tyLe: tong ? Math.round((ds.length / tong) * 100) : 0 };
  }).sort((a, b) => b.tong - a.tong || a.ma.localeCompare(b.ma, 'vi'));
}

// Khối "Theo lãnh đạo VP phụ trách" (A0, Chánh VP): mỗi Phó Chánh VP một dòng (việc thuộc phòng / ngành-lĩnh vực đang phụ trách; một việc có thể
// thuộc hai lãnh đạo khi phòng theo dõi và phòng chủ trì khác nhau), cuối là "Chưa có lãnh đạo phụ trách". Cột như theoNhom + tổng + phòng.
export function theoLanhDaoVP(rows, k, phanCong = [], lanhDaoVP = [], tenPhong = {}) {
  const cua = rows.map((r) => [r, lanhDaoPhuTrach(r, phanCong)]);
  const dong = (ma, ten, ds, phong) => {
    const s = soLieuChinh(ds, k);
    return { ma, ten, phong, tong: ds.length, xong: s.xong, dangMo: s.dangMo, vang: s.mo.vang, do: s.mo.do, ddb: s.mo.ddb, tyLe: s.tyLeDungHan };
  };
  const ds = lanhDaoVP.map((a) => dong(a.id, a.full_name, cua.filter(([, ids]) => ids.includes(a.id)).map(([r]) => r),
    phanCong.filter((p) => p.lanh_dao_id === a.id && p.nganh_ma == null).map((p) => tenPhong[p.phong] || p.phong)));
  const chua = cua.filter(([, ids]) => ids.length === 0).map(([r]) => r);
  if (chua.length) ds.push(dong(CHUA_LDVP, 'Chưa có lãnh đạo phụ trách', chua, []));
  return ds.filter((d) => d.tong > 0);
}

// Thanh tải chồng (bảng KPI): phần trăm của hoàn thành / đang làm trong hạn (kể cả chờ nghiệm thu, không áp dụng) / Vàng / Đỏ / Đỏ đặc biệt trên tổng.
export function phanTai(d) {
  const tong = d.tong || 0; const pct = (n) => (tong ? Math.round((n / tong) * 1000) / 10 : 0);
  const mo = Math.max(0, d.dangMo - d.vang - d.do - d.ddb);
  return { xong: pct(d.xong), mo: pct(mo), vang: pct(d.vang), do: pct(d.do), ddb: pct(d.ddb) };
}
