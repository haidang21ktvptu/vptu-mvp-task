// Đọc dữ liệu module KL. Nguồn duy nhất của dòng và trạng thái là v_kl_dashboard (security_invoker → RLS
// kl_pham_vi 0019 quyết định ai thấy gì; frontend không lọc theo vai trò/phòng). Danh mục và cấu hình nạp một lần.
import { supabase } from '../supabase.js';

let danhMuc = null;   // { nganh, linhVuc, coQuanTrinh, loaiThoiHan, tienDo }
let cauHinh = null;   // { nguong_sap_den_han_ngay: 7, nguong_khong_cap_nhat_ngay: 30, ... }

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data || []; };

export async function loadDanhMucKl(lai = false) {
  if (danhMuc && !lai) return danhMuc;
  const [n, l, c, h, t] = await Promise.all([
    supabase.from('dm_nganh').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_linh_vuc').select('ma, nganh_ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_co_quan_trinh').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_loai_thoi_han').select('ma, ten, thu_tu').order('thu_tu'),
    supabase.from('dm_tien_do').select('ma, ten, thu_tu').order('thu_tu'),
  ]);
  danhMuc = { nganh: loi(n, 'ngành'), linhVuc: loi(l, 'lĩnh vực'), coQuanTrinh: loi(c, 'cơ quan trình'), loaiThoiHan: loi(h, 'loại thời hạn'), tienDo: loi(t, 'tiến độ') };
  return danhMuc;
}
export const danhMucKl = () => danhMuc || { nganh: [], linhVuc: [], coQuanTrinh: [], loaiThoiHan: [], tienDo: [] };
export const tenTrongDanhMuc = (bang, ma) => danhMucKl()[bang]?.find((x) => x.ma === ma)?.ten || ma || '';
export const linhVucCuaNganh = (nganhMa) => danhMucKl().linhVuc.filter((l) => l.nganh_ma === nganhMa);

export async function loadCauHinhKl(lai = false) {
  if (cauHinh && !lai) return cauHinh;
  const rows = loi(await supabase.from('kl_cau_hinh').select('khoa, gia_tri'), 'cấu hình KL');
  cauHinh = Object.fromEntries(rows.map((r) => [r.khoa, Number(r.gia_tri)]));
  return cauHinh;
}
export const cauHinhKl = (khoa, macDinh) => cauHinh?.[khoa] ?? macDinh;

// Toàn bộ dòng trong phạm vi người dùng (RLS), kèm mốc thời gian đọc để ghi "Số liệu tính đến".
export async function loadKlRows() {
  const rows = loi(await supabase.from('v_kl_dashboard').select('*').order('ma'), 'đọc nhiệm vụ KL');
  return { rows, luc: new Date() };
}

// "Hôm nay" theo DB (kl_hom_nay, giờ Việt Nam) để giới hạn ô ngày trên form cùng nguồn với trigger.
export async function homNayTheoDb() {
  const r = await supabase.rpc('kl_hom_nay');
  return r.error ? null : r.data;
}

// Lịch sử một nhiệm vụ (RLS: theo phạm vi thấy nhiệm vụ), mới nhất trước.
export async function loadLichSu(nhiemVuId) {
  return loi(await supabase.from('kl_lich_su').select('id, luc, nguoi_sua, nguoi_sua_ghi_chu, cot, gia_tri_cu, gia_tri_moi, nguon, dinh_chinh_id')
    .eq('nhiem_vu_id', nhiemVuId).order('luc', { ascending: false }).order('id', { ascending: false }), 'đọc lịch sử');
}

// Đề nghị đính chính đang chờ của một nhiệm vụ (để ngăn chi tiết nói rõ "đang tra soát cột nào").
export async function loadDinhChinhCho(nhiemVuId) {
  return loi(await supabase.from('kl_dinh_chinh').select('id, cot, gia_tri_cu, gia_tri_moi, ly_do, can_cu, de_nghi_boi, created_at')
    .eq('nhiem_vu_id', nhiemVuId).eq('trang_thai', 'CHO_DUYET').order('created_at'), 'đọc đính chính');
}

// Cập nhật của chủ trì / quan_tri_kl: UPDATE trực tiếp theo policy kl_nhiem_vu_update_* (0016); cột do guard 0015
// giới hạn; lịch sử do trigger ghi. Chỉ gửi đúng các cột được phép.
const COT_CAP_NHAT = ['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu'];
export async function capNhatNhiemVu(id, thayDoi) {
  const patch = Object.fromEntries(Object.entries(thayDoi).filter(([k]) => COT_CAP_NHAT.includes(k)));
  const r = await supabase.from('kl_nhiem_vu').update(patch).eq('id', id).select('id');
  if (r.error) throw new Error(r.error.message);
  if (!r.data || r.data.length === 0) throw new Error('Không có quyền cập nhật nhiệm vụ này.');
}
