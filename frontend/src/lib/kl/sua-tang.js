// Nhập theo tầng (0070–0071, giao diện v9 đợt 2): 10 ô "thông tin giao" do cấp giao điền — cấp giao sửa ngay (sua_thong_tin_giao, lý do bắt buộc),
// cấp nhận việc gửi "Đề nghị sửa" (de_nghi_sua_gui) để người giao duyệt (de_nghi_sua_duyet) hoặc tự rút (de_nghi_sua_huy). Quyền thật ở hàm DB;
// laTangGiao chỉ để ẩn / hiện nút cho đúng (cùng quy tắc kl_la_tang_giao). Đọc de_nghi_sua theo RLS (người gửi, người duyệt, người thấy việc).
import { supabase } from '../supabase.js';
import { state, findAccount } from '../state.js';
import { homNayVN } from './ngay.js';

// [cột, nhãn, kiểu ô]: vb = đoạn chữ, chu = một dòng, còn lại = khoá danh mục (danhMucKl) hoặc doKhan.
export const O_GIAO = [['noi_dung', 'Nội dung', 'vb'], ['san_pham_loai', 'Sản phẩm', 'sanPham'], ['san_pham_mo_ta', 'Mô tả sản phẩm', 'chu'],
  ['cap_nhan_san_pham', 'Cấp nhận sản phẩm', 'cap'], ['do_khan', 'Độ khẩn', 'doKhan'], ['nganh_ma', 'Ngành', 'nganh'], ['linh_vuc_ma', 'Lĩnh vực', 'linhVuc'],
  ['linh_vuc_chi_tiet', 'Lĩnh vực chi tiết', 'chu'], ['nguon_nhiem_vu_ma', 'Nguồn nhiệm vụ', 'nguonNhiemVu'], ['don_vi_phoi_hop', 'Đơn vị phối hợp', 'chu']];
export const tenOGiao = (cot) => O_GIAO.find(([c]) => c === cot)?.[1] || cot;

const qtklConHan = () => Boolean(state.user?.quan_tri_kl) && (!state.user.quan_tri_kl_het_han || state.user.quan_tri_kl_het_han >= homNayVN())
  && state.user?.role_group !== 'A0';
// Người gọi là tầng giao của việc: người giao = người được thay mặt, không có thì người tạo (vai lãnh đạo A0/A1/A2, tài khoản còn hoạt động);
// hoặc quản trị nhiệm vụ còn hạn. Người gõ thay (chuyên viên, người nhập Excel) hết ủy quyền thì không còn quyền này.
export function laTangGiao(r) {
  const me = state.user?.id;
  if (!me || !r) return false;
  if (qtklConHan()) return true;
  const a = findAccount(me) || state.user;
  return (r.giao_thay_mat_cho || r.tao_boi) === me && ['A0', 'A1', 'A2'].includes(a?.role_group) && !a?.bi_khoa;
}
const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
const laBenTrong = (r) => r.nguoi_theo_doi === state.user?.id || (r.owner_tai_khoan && r.owner_tai_khoan === state.user?.id);
// 'sua' = bút (sửa ngay), 'de-nghi' = khoá (đề nghị sửa), '' = chỉ xem.
export function cheDoTang(r) {
  if (laTangGiao(r) && (mo(r) || qtklConHan())) return 'sua';
  if (mo(r) && laBenTrong(r) && state.user?.role_group !== 'A0') return 'de-nghi';
  return '';
}

const goi = async (fn, args) => { const r = await supabase.rpc(fn, args); if (r.error) throw new Error(r.error.message); return r.data; };
export const suaThongTinGiao = (id, thayDoi, lyDo) => goi('sua_thong_tin_giao', { p_id: id, p_thay_doi: thayDoi, p_ly_do: lyDo });
export const guiDeNghiSua = (id, thayDoi, lyDo) => goi('de_nghi_sua_gui', { p_nhiem_vu: id, p_thay_doi: thayDoi, p_ly_do: lyDo });
export const duyetDeNghiSua = (id, dongY, yKien) => goi('de_nghi_sua_duyet', { p_id: id, p_dong_y: dongY, p_y_kien: yKien || null });
export const rutDeNghiSua = (id) => goi('de_nghi_sua_huy', { p_id: id });

const COT_DNS = 'id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, thay_doi, gia_tri_cu, ly_do, trang_thai, y_kien_duyet, duyet_boi, tao_luc, duyet_luc';
// Đề nghị đang chờ của một việc (null nếu không có hoặc bảng chưa có — project chưa áp 0071).
export async function deNghiChoCuaViec(nhiemVuId) {
  const r = await supabase.from('de_nghi_sua').select(COT_DNS).eq('nhiem_vu_id', nhiemVuId).eq('trang_thai', 'CHO_DUYET').maybeSingle();
  if (r.error) return null;
  return r.data;
}
// Đề nghị chờ CHÍNH TÔI duyệt (A0: mọi đề nghị có người duyệt là A0), kèm mã / nội dung việc nếu RLS cho đọc việc.
export async function deNghiChoToiDuyet() {
  const r = await supabase.from('de_nghi_sua').select(`${COT_DNS}, nhiem_vu(ma, noi_dung)`).eq('trang_thai', 'CHO_DUYET').order('tao_luc');
  if (r.error) throw new Error(r.error.message);
  const me = state.user?.id; const a0 = state.user?.role_group === 'A0';
  return (r.data || []).filter((d) => d.cap_duyet === me || (a0 && findAccount(d.cap_duyet)?.role_group === 'A0'));
}
// Đề nghị đang chờ do CHÍNH TÔI gửi (thẻ "Việc của tôi": dòng "chờ … duyệt" + Rút đề nghị); lỗi / bảng chưa có (chưa áp 0071) → rỗng.
export async function deNghiToiGuiDangCho() {
  const r = await supabase.from('de_nghi_sua').select(COT_DNS).eq('nguoi_de_nghi', state.user?.id).eq('trang_thai', 'CHO_DUYET');
  return r.error ? [] : r.data || [];
}
