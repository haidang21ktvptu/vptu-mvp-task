// Đọc dữ liệu module Nhiệm vụ (thực thể thống nhất GĐ14). Nguồn duy nhất của dòng và trạng thái là v_nhiem_vu
// (security_invoker → RLS kl_pham_vi 0025 quyết định ai thấy gì; frontend không lọc theo vai trò/phòng). Danh mục nạp một lần.
import { supabase } from '../supabase.js';
import { state } from '../state.js';

let danhMuc = null;   // { nganh, linhVuc, donVi, sanPham, cap, loaiThoiHan, tienDo }
let cauHinh = null;   // { nguong_sap_den_han_ngay: 7, nguong_vang_ngay: 3, ... }

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data || []; };

// Danh mục / cấu hình: một lượt đọc đang bay dùng chung (Điều hành và Nhiệm vụ mở gần nhau từng gọi 7 + 1 truy vấn hai lần).
let dangDocDanhMuc = null; let dangDocCauHinh = null;
export function loadDanhMucKl(lai = false) {
  if (danhMuc && !lai) return Promise.resolve(danhMuc);
  if (!dangDocDanhMuc) dangDocDanhMuc = docDanhMuc().finally(() => { dangDocDanhMuc = null; });
  return dangDocDanhMuc;
}
async function docDanhMuc() {
  const [n, l, d, s, c, h, t] = await Promise.all([
    supabase.from('dm_nganh').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_linh_vuc').select('ma, nganh_ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_don_vi').select('ma, ten, thu_tu, trong_van_phong, phong').order('thu_tu'),
    supabase.from('dm_san_pham').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_cap').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_loai_thoi_han').select('ma, ten, thu_tu, cho_phep_tao_moi').order('thu_tu'),
    supabase.from('dm_tien_do').select('ma, ten, thu_tu').order('thu_tu'),
  ]);
  danhMuc = { nganh: loi(n, 'ngành'), linhVuc: loi(l, 'lĩnh vực'), donVi: loi(d, 'đơn vị'), sanPham: loi(s, 'sản phẩm'), cap: loi(c, 'cấp'),
    loaiThoiHan: loi(h, 'loại thời hạn'), tienDo: loi(t, 'tiến độ') };
  return danhMuc;
}
export const danhMucKl = () => danhMuc || { nganh: [], linhVuc: [], donVi: [], sanPham: [], cap: [], loaiThoiHan: [], tienDo: [] };
export const tenTrongDanhMuc = (bang, ma) => danhMucKl()[bang]?.find((x) => x.ma === ma)?.ten || ma || '';
export const linhVucCuaNganh = (nganhMa) => danhMucKl().linhVuc.filter((l) => l.nganh_ma === nganhMa);

export function loadCauHinhKl(lai = false) {
  if (cauHinh && !lai) return Promise.resolve(cauHinh);
  if (!dangDocCauHinh) dangDocCauHinh = docCauHinh().finally(() => { dangDocCauHinh = null; });
  return dangDocCauHinh;
}
async function docCauHinh() {
  const rows = loi(await supabase.from('kl_cau_hinh').select('khoa, gia_tri'), 'cấu hình');
  cauHinh = Object.fromEntries(rows.map((r) => [r.khoa, Number(r.gia_tri)]));
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
  const [rows, xn, tcAll] = await Promise.all([
    loi(await supabase.from('v_nhiem_vu').select('*').order('ma'), 'đọc nhiệm vụ'),
    loi(await supabase.from('lich_su').select('nhiem_vu_id, nguoi_sua').eq('cot', 'xac_nhan_nhan_viec'), 'đọc xác nhận nhận việc'),
    // Đề nghị từ chối (0034): RLS chỉ trả dòng người đề nghị / cấp duyệt / cấp trên đọc được; mọi trạng thái, mới nhất trước — dòng đầu mỗi việc
    // là đề nghị mới nhất (GĐ22: người đề nghị thấy "đã đồng ý" / "không đồng ý" ngay trên thẻ).
    loi(await supabase.from('tu_choi').select('id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, ly_do, tao_luc, trang_thai, y_kien_duyet, duyet_luc').order('tao_luc', { ascending: false }), 'đọc đề nghị từ chối'),
  ]);
  const me = state.user?.id; const daNhan = new Set(xn.map((x) => x.nhiem_vu_id)); const toiNhan = new Set(xn.filter((x) => x.nguoi_sua === me).map((x) => x.nhiem_vu_id));
  const tcCho = tcAll.filter((t) => t.trang_thai === 'CHO_DUYET');
  rows.forEach((r) => {
    r.da_xac_nhan_nhan = daNhan.has(r.id); // có bất kỳ ai (owner / người theo dõi) xác nhận — khâu CHUA_NHAN, chú thích dòng; bi_tu_choi đã có trong v_nhiem_vu (0037)
    r.toi_da_xac_nhan = toiNhan.has(r.id); // CHÍNH TÔI đã xác nhận — quy tắc: owner và người theo dõi mỗi người tự nhận (cùng kl_so_chua_xu_ly.viec_moi)
    r.tu_choi_cho = tcCho.find((t) => t.nhiem_vu_id === r.id) || null; r.tu_choi_moi_nhat = tcAll.find((t) => t.nhiem_vu_id === r.id) || null;
  });
  return { rows, luc: new Date(), tuChoiCho: tcCho, tuChoi: tcAll };
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
  'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban'];
export async function capNhatNhiemVu(id, thayDoi) {
  const patch = Object.fromEntries(Object.entries(thayDoi).filter(([k]) => COT_CAP_NHAT.includes(k)));
  const r = await supabase.from('nhiem_vu').update(patch).eq('id', id).select('id');
  if (r.error) throw new Error(r.error.message);
  if (!r.data || r.data.length === 0) throw new Error('Không có quyền cập nhật nhiệm vụ này.');
}

// Văn bản giao việc (GV-1): danh sách để chọn trên form; văn bản mới tạo trong hàm giao_viec.
export async function loadVanBan() {
  return loi(await supabase.from('van_ban_giao_viec').select('id, loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh, ngay_nhan')
    .order('ngay_ban_hanh', { ascending: false }).order('so_ket_luan'), 'đọc văn bản');
}
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
