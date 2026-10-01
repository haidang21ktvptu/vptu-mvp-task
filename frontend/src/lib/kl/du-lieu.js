// Đọc dữ liệu module Nhiệm vụ (thực thể thống nhất GĐ14). Nguồn duy nhất của dòng và trạng thái là v_nhiem_vu
// (security_invoker → RLS kl_pham_vi 0025 quyết định ai thấy gì; frontend không lọc theo vai trò/phòng). Danh mục nạp một lần.
import { supabase } from '../supabase.js';
import { state } from '../state.js';
import { COT_VIEC, COT_TU_CHOI, taiTheoTrang } from './cot.js';

let danhMuc = null;   // { nganh, linhVuc, donVi, sanPham, cap, loaiThoiHan, tienDo }
let cauHinh = null;   // { nguong_sap_den_han_ngay: 7, nguong_vang_ngay: 3, ... }

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data || []; };

// Danh mục + cấu hình (B6): MỘT RPC kl_danh_muc() (SECURITY INVOKER — đúng dữ liệu RLS cho người gọi đọc), nhớ sessionStorage 30 phút
// (chỉ danh mục, không phải tài khoản); màn Quản trị ghi danh mục / ngưỡng thì gọi xoaDanhMucDaNho(). Lượt đọc đang bay dùng chung.
const KHOA_NHO = 'vptu.kl_danh_muc';
const HAN_NHO_MS = 30 * 60_000;
let dangDocDanhMuc = null;
function docNho() {
  try {
    const x = JSON.parse(sessionStorage.getItem(KHOA_NHO) || 'null');
    return x && x.uid === state.user?.id && Date.now() - x.luc < HAN_NHO_MS ? x.dm : null;
  } catch { return null; }
}
export function xoaDanhMucDaNho() {
  danhMuc = null; cauHinh = null;
  try { sessionStorage.removeItem(KHOA_NHO); } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
}
function dat(dm) {
  const { cauHinh: ch, ...con } = dm;
  danhMuc = con;
  cauHinh = Object.fromEntries(Object.entries(ch || {}).map(([k, v]) => [k, Number(v)]));
}
export function loadDanhMucKl(lai = false) {
  if (danhMuc && !lai) return Promise.resolve(danhMuc);
  const nho = lai ? null : docNho();
  if (nho) { dat(nho); return Promise.resolve(danhMuc); }
  if (!dangDocDanhMuc) dangDocDanhMuc = docDanhMuc().finally(() => { dangDocDanhMuc = null; });
  return dangDocDanhMuc;
}
async function docDanhMuc() {
  const dm = loi(await supabase.rpc('kl_danh_muc'), 'danh mục');
  dat(dm);
  try { sessionStorage.setItem(KHOA_NHO, JSON.stringify({ uid: state.user?.id, luc: Date.now(), dm })); } catch { /* không lưu được: vẫn dùng bản trong bộ nhớ */ }
  return danhMuc;
}
export const danhMucKl = () => danhMuc || { nganh: [], linhVuc: [], donVi: [], sanPham: [], cap: [], loaiThoiHan: [], tienDo: [] };
export const tenTrongDanhMuc = (bang, ma) => danhMucKl()[bang]?.find((x) => x.ma === ma)?.ten || ma || '';
export const linhVucCuaNganh = (nganhMa) => danhMucKl().linhVuc.filter((l) => l.nganh_ma === nganhMa);

// Cấu hình đi cùng lời gọi danh mục (một RPC).
export async function loadCauHinhKl(lai = false) {
  if (cauHinh && !lai) return cauHinh;
  await loadDanhMucKl(lai);
  return cauHinh;
}
export const cauHinhKl = (khoa, macDinh) => cauHinh?.[khoa] ?? macDinh;

// Toàn bộ dòng trong phạm vi người dùng (RLS) + tập id đã có xác nhận nhận việc, kèm mốc thời gian đọc ("Số liệu tính đến").
let dangDocRows = null;
export function loadKlRows() {
  // Đang có lượt đọc → dùng chung kết quả (không chạy chồng truy vấn nặng); mỗi nơi gọi nhận MẢNG RIÊNG để Điều hành và Nhiệm vụ không
  // cùng trỏ một mảng (nap-lai-viec thay dòng tại chỗ).
  if (!dangDocRows) dangDocRows = docKlRows().finally(() => { dangDocRows = null; });
  return dangDocRows.then((r) => ({ ...r, rows: [...r.rows] }));
}
async function docKlRows() {
  // B6: da_xac_nhan_nhan / nguoi_da_nhan lấy từ v_nhiem_vu (0051, cùng giá trị với lich_su 'xac_nhan_nhan_viec') — bỏ truy vấn lich_su toàn phạm vi.
  // Đề nghị từ chối (0034): RLS chỉ trả dòng người đề nghị / cấp duyệt / cấp trên đọc được; mọi trạng thái, mới nhất trước — dòng đầu mỗi việc
  // là đề nghị mới nhất (GĐ22: người đề nghị thấy "đã đồng ý" / "không đồng ý" ngay trên thẻ).
  const [rows, tcAll] = await Promise.all([
    taiTheoTrang(() => supabase.from('v_nhiem_vu').select(COT_VIEC).order('ma').order('id'), 'đọc nhiệm vụ'),
    taiTheoTrang(() => supabase.from('tu_choi').select(COT_TU_CHOI).order('tao_luc', { ascending: false }).order('id'), 'đọc đề nghị từ chối'),
  ]);
  const tcCho = tcAll.filter((t) => t.trang_thai === 'CHO_DUYET');
  const tcTheoViec = new Map(); tcAll.forEach((t) => { if (!tcTheoViec.has(t.nhiem_vu_id)) tcTheoViec.set(t.nhiem_vu_id, t); });
  const choTheoViec = new Map(); tcCho.forEach((t) => { if (!choTheoViec.has(t.nhiem_vu_id)) choTheoViec.set(t.nhiem_vu_id, t); });
  rows.forEach((r) => ganCo(r, choTheoViec.get(r.id), tcTheoViec.get(r.id)));
  return { rows, luc: new Date(), tuChoiCho: tcCho, tuChoi: tcAll };
}
// Cờ ghép vào một dòng (dùng chung với nap-lai-viec): tôi đã xác nhận nhận (owner và người theo dõi mỗi người tự nhận — cùng
// kl_so_chua_xu_ly.viec_moi), đề nghị từ chối đang chờ / mới nhất.
export function ganCo(r, tcCho, tcMoiNhat) {
  r.toi_da_xac_nhan = (r.nguoi_da_nhan || []).includes(state.user?.id);
  r.tu_choi_cho = tcCho || null; r.tu_choi_moi_nhat = tcMoiNhat || null;
  return r;
}

// "Hôm nay" theo DB (kl_hom_nay, giờ Việt Nam) để giới hạn ô ngày trên form cùng nguồn với trigger.
export async function homNayTheoDb() {
  const r = await supabase.rpc('kl_hom_nay');
  return r.error ? null : r.data;
}

// Lịch sử một nhiệm vụ (RLS: theo phạm vi thấy nhiệm vụ), mới nhất trước.
export async function loadLichSu(nhiemVuId) {
  return loi(await supabase.from('lich_su').select('id, luc, nguoi_sua, nguoi_sua_ghi_chu, cot, gia_tri_cu, gia_tri_moi, nguon, dinh_chinh_id')
    .eq('nhiem_vu_id', nhiemVuId).order('luc', { ascending: false }).order('id', { ascending: false }), 'đọc lịch sử');
}

// Đề nghị đính chính đang chờ của một nhiệm vụ (để ngăn chi tiết nói rõ "đang tra soát cột nào").
export async function loadDinhChinhCho(nhiemVuId) {
  return loi(await supabase.from('dinh_chinh').select('id, cot, gia_tri_cu, gia_tri_moi, ly_do, can_cu, de_nghi_boi, created_at')
    .eq('nhiem_vu_id', nhiemVuId).eq('trang_thai', 'CHO_DUYET').order('created_at'), 'đọc đính chính');
}

// Cập nhật nhanh của người theo dõi / Owner / quan_tri_kl: UPDATE trực tiếp theo policy 0025; cột do guard giới hạn;
// lịch sử do trigger ghi. Chỉ gửi đúng các cột được phép. Việc cũ không bị đòi sản phẩm (CH-5).
const COT_CAP_NHAT = ['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
  'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'vuong_mac'];   // vuong_mac: guard a3 0062
export async function capNhatNhiemVu(id, thayDoi) {
  const patch = Object.fromEntries(Object.entries(thayDoi).filter(([k]) => COT_CAP_NHAT.includes(k)));
  const r = await supabase.from('nhiem_vu').update(patch).eq('id', id).select('id');
  if (r.error) throw new Error(r.error.message);
  if (!r.data || r.data.length === 0) throw new Error('Không có quyền cập nhật nhiệm vụ này.');
}

// Văn bản giao việc (GV-1): danh sách để chọn trên form; văn bản mới tạo trong hàm giao_viec.
const COT_VAN_BAN = 'id, loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh, ngay_nhan, trich_yeu, tao_boi, so_nhiem_vu_du_kien, da_ra_soat_toan_van, ra_soat_boi, ra_soat_luc';
const vanBanTheoThuTu = () => supabase.from('van_ban_giao_viec').select(COT_VAN_BAN).order('ngay_ban_hanh', { ascending: false }).order('so_ket_luan').order('id');
// Đủ mọi văn bản trong phạm vi (cây Theo văn bản ghép theo id) — theo trang.
export const loadVanBan = () => taiTheoTrang(vanBanTheoThuTu, 'đọc văn bản');
// Ô chọn văn bản ở Giao việc (B6): tìm theo số hiệu / trích yếu, 50 dòng mỗi lần ("Xem thêm" lấy trang kế). Trả { ds, conNua }.
export async function timVanBan(tuKhoa = '', trang = 0, co = 50) {
  let q = vanBanTheoThuTu();
  const kw = tuKhoa.trim().replace(/[%_,()*"\\:]/g, ' ').trim();
  if (kw) q = q.or(`so_ket_luan.ilike.*${kw}*,trich_yeu.ilike.*${kw}*`);
  const ds = loi(await q.range(trang * co, trang * co + co), 'đọc văn bản');   // lấy co + 1 dòng để biết còn nữa không
  return { ds: ds.slice(0, co), conNua: ds.length > co };
}
export async function vanBanTheoId(id) {
  return loi(await supabase.from('van_ban_giao_viec').select(COT_VAN_BAN).eq('id', id).maybeSingle(), 'đọc văn bản');
}
// Trích yếu văn bản (0046): đặt sau giao_viec qua hàm có allowlist (người tạo, A1, quan_tri_kl) và ghi vết — không ghi thẳng bảng.
export async function datTrichYeuVanBan(id, trichYeu) {
  const r = await supabase.rpc('van_ban_dat_trich_yeu', { p_id: id, p_trich_yeu: trichYeu });
  if (r.error) throw new Error(r.error.message);
}
// PR-3 (0065): hàm ghi có allowlist — nguồn / đơn vị phối hợp (người giao, quan_tri_kl), vướng mắc (Owner, theo dõi, lãnh đạo trong phạm vi,
// quan_tri_kl), số nhiệm vụ dự kiến + rà soát toàn văn (như trích yếu). kl_van_ban_so_viec: số việc gốc đã nhập — tổng thật, chỉ văn bản xem được.
const goi = async (fn, args) => { const r = await supabase.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; };
export const datThongTinGiao = (id, nguon, phoiHop) => goi('dat_thong_tin_giao', { p_id: id, p_nguon_nhiem_vu_ma: nguon || null, p_don_vi_phoi_hop: phoiHop || null });
export const datVuongMac = (id, noiDung) => goi('dat_vuong_mac', { p_id: id, p_noi_dung: noiDung || null });
export const datRaSoatVanBan = (id, so, daRaSoat) => goi('van_ban_dat_ra_soat', { p_id: id, p_so: so ?? null, p_da_ra_soat: daRaSoat });
export const soViecTheoVanBan = async () => new Map(((await goi('kl_van_ban_so_viec', {})) || []).map((x) => [x.van_ban_id, x.so_viec]));
// Giao việc (GV-2, GV-3): một RPC kiểm quyền và 1-1-1 phía DB (0025). Trả { id, ma, van_ban_id }.
export async function giaoViec(p) {
  const r = await supabase.rpc('giao_viec', { p });
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
// Xác nhận đã nhận việc (GV-5, CN-2.2): chỉ ghi lịch sử. Trả true nếu ghi mới, false nếu đã xác nhận trước đó.
export async function xacNhanNhanViec(id) {
  const r = await supabase.rpc('xac_nhan_nhan_viec', { p_id: id });
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
