// Minh chứng có cấu trúc (GĐ16, migration 0028): đọc bảng minh_chung (RLS theo phạm vi nhiệm vụ); MỌI thao tác ghi đi qua
// hàm SECURITY DEFINER nop_minh_chung / xac_nhan_minh_chung / gan_tep_minh_chung / dong_nhiem_vu — frontend không ghi thẳng bảng, quyền thật trong hàm.
// Đợt D v3.20 (0090, định hướng 8/10/2026: lãnh đạo theo dõi, chuyên viên nhập liệu): nộp minh chứng hợp lệ = TỰ HOÀN THÀNH nhiệm vụ (ngày hoàn
// thành = ngày văn bản minh chứng); người giao việc / người theo dõi / lãnh đạo trong phạm vi được (không bắt buộc) trả lại hoặc đánh giá chất lượng.
import { supabase } from '../supabase.js';
import { COT_MINH_CHUNG, taiTheoTrang } from './cot.js';
import { state, findAccount } from '../state.js';
import { homNayVN } from './ngay.js';
import { laTangGiao } from './sua-tang.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo) => loi(await supabase.rpc(ham, thamSo), 'không thực hiện được');

// Q8 (0057, 0061): việc Thường trực (A0) giao cho Chánh VP chủ trì — thư ký Thường trực (không có: quan_tri_kl còn hạn) xem lại thay mặt Thường trực.
export const laViecTtGiaoCvp = (r) => (findAccount(r.tao_boi)?.role_group === 'A0' || r.giao_thay_mat_nhom === 'THUONG_TRUC')   // 0083: thay mặt Thường trực cũng vậy
  && ((o) => o?.role_group === 'A1' && Boolean(o.is_chief))(findAccount(r.owner_tai_khoan));
export function nghiemThuViecTt(r, nopBoi, me = state.user) {
  const duoc = (a) => a && !a.is_system && !a.bi_khoa && a.role_group !== 'A0' && a.id !== nopBoi && a.id !== r.owner_tai_khoan;
  const thuKy = state.accounts.filter((a) => a.thu_ky_thuong_truc && duoc(a));
  const ds = thuKy.length ? thuKy : state.accounts.filter((a) => a.quan_tri_kl && (!a.quan_tri_kl_het_han || a.quan_tri_kl_het_han >= homNayVN()) && duoc(a));
  return ds.some((a) => a.id === me?.id);
}

const laLanhDao = () => ['A0', 'A1', 'A2'].includes(state.user?.role_group);
const qtklConHan = () => Boolean(state.user?.quan_tri_kl) && (!state.user.quan_tri_kl_het_han || state.user.quan_tri_kl_het_han >= homNayVN());
// Ai nộp được minh chứng (kl_duoc_nop_minh_chung, 0089): Owner, người theo dõi, người tạo việc (chuyên viên nộp thay khi Owner là lãnh đạo),
// lãnh đạo / quản trị nhiệm vụ thấy việc (dòng hiện ra = trong phạm vi). Chuyên viên chỉ xem cả phòng (0086) không nộp việc người khác.
export function duocNopMinhChung(r) {
  const me = state.user?.id;
  return Boolean(me && r) && ([r.owner_tai_khoan, r.nguoi_theo_doi, r.tao_boi].includes(me) || laLanhDao() || qtklConHan());
}
// Ai trả lại / đánh giá được (kl_duoc_xem_lai_minh_chung, 0090): tầng giao (người giao kể cả Thường trực, người tạo việc, quản trị — 0091), như
// nghiệm thu cũ (người theo dõi, lãnh đạo Văn phòng / phòng trong phạm vi; việc Thường trực giao Chánh VP: thư ký Thường trực); không phải minh
// chứng do chính mình nộp; Chánh VP không tự xem lại việc Thường trực giao cho mình (0061).
export function duocXemLaiMinhChung(r, m) {
  const me = state.user?.id;
  if (!me || !r || !m || m.nop_boi === me || (laViecTtGiaoCvp(r) && r.owner_tai_khoan === me)) return false;
  if (laTangGiao(r)) return true;
  if (laViecTtGiaoCvp(r)) return nghiemThuViecTt(r, m.nop_boi);
  return r.nguoi_theo_doi === me || ['A1', 'A2'].includes(state.user?.role_group) || qtklConHan();
}

// Mọi minh chứng của một nhiệm vụ, mới nhất trước.
export async function loadMinhChung(nhiemVuId) {
  return loi(await supabase.from('minh_chung').select(COT_MINH_CHUNG).eq('nhiem_vu_id', nhiemVuId).order('nop_luc', { ascending: false }), 'đọc minh chứng') || [];
}

// Minh chứng của mọi nhiệm vụ trong phạm vi (cây Theo văn bản; v_minh_chung 0046 có thêm tên người nộp / xác nhận / cấp nhận). Cây ghép
// minh chứng vào từng nhiệm vụ nên cần ĐỦ dòng — đọc theo trang (B6), không cắt "Xem thêm" (cắt sẽ làm nút việc thiếu minh chứng).
export function loadMinhChungTatCa() {
  return taiTheoTrang(() => supabase.from('v_minh_chung').select('id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, trich_yeu, hop_le, xac_nhan_boi_ten, nop_luc')
    .order('nop_luc', { ascending: false }).order('id'), 'đọc minh chứng');
}

// p: { nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan?, trich_yeu?, mo_ta_ket_qua?, tep_path?, tep_ten? } → id minh chứng (việc đang mở → hoàn thành).
// PR-2b: trích yếu / mô tả chuẩn hoá NFC trước khi đếm và gửi — tiếng Việt dạng tổ hợp (NFD, dán từ Word/Mac) đếm đúng như char_length của DB.
export const nfc = (s) => (typeof s === 'string' ? s.normalize('NFC') : s);
export const nopMinhChung = (p) => rpc('nop_minh_chung', { p: { ...p, trich_yeu: nfc(p.trich_yeu), mo_ta_ket_qua: nfc(p.mo_ta_ket_qua), tep_ten: nfc(p.tep_ten) } });
export const ganTepMinhChung = (id, path, ten) => rpc('gan_tep_minh_chung', { p_id: id, p_tep_path: path, p_tep_ten: nfc(ten) || null });
// Kiểm phía form dùng chung cho hộp Nộp minh chứng và hộp Cập nhật: trả chuỗi lỗi hoặc null — hàm nop_minh_chung là chốt.
// Đợt C1 (0086): số hiệu + ngày văn bản là đủ; cấp nhận trống = cấp nhận sản phẩm của việc (capViec); trích yếu, mô tả kết quả tuỳ chọn (≤ 600 ký tự).
// Đợt D (0089): cấu hình "Minh chứng phải kèm tệp" = 2 → thiếu tệp báo ngay (batBuoc).
export function loiMinhChung(p, capViec = null, { batBuoc = false, coTep = false } = {}) {
  if (!p.so_hieu || !p.ngay_van_ban) return 'Minh chứng phải có số hiệu và ngày văn bản (cấp nhận lấy theo việc nếu để trống).';
  if (!p.cap_nhan && !capViec) return 'Việc chưa ghi cấp nhận sản phẩm — chọn cấp nhận cho minh chứng.';
  if (nfc(p.mo_ta_ket_qua || '').length > 600) return 'Mô tả kết quả tối đa 600 ký tự.';
  if (batBuoc && !coTep) return 'Minh chứng phải kèm tệp (PDF, Word, Excel hoặc ảnh, tối đa 10 MB).';
  return null;
}
// Trả lại (hopLe = false, lý do bắt buộc — minh chứng hợp lệ cuối cùng bị trả lại thì việc mở lại) hoặc đánh giá chất lượng (hopLe = true + chatLuong:
// KHONG_DAT / DAT / DAT_TOT / DAT_XUAT_SAC). Minh chứng nộp trước 0090 còn chờ: hopLe = true xác nhận và hoàn thành như nghiệm thu cũ.
export const xacNhanMinhChung = (id, hopLe, lyDo = null, chatLuong = null) =>
  rpc('xac_nhan_minh_chung', { p_id: id, p_hop_le: hopLe, p_ly_do: lyDo || null, p_han_nop_lai: null, p_chat_luong: chatLuong || null });
// Đóng nhiệm vụ (MC-4, việc chuyển đổi cũ): DB kiểm lại minh chứng hợp lệ; ngay = null → lấy ngày văn bản của minh chứng hợp lệ mới nhất.
export const dongNhiemVu = (id, ngay = null, chatLuong = null) => rpc('dong_nhiem_vu', { p_id: id, p_ngay_hoan_thanh: ngay || null, p_chat_luong: chatLuong || null });

// Cùng vị từ với minh_chung_la_hop_le() trong 0028: chưa bị trả lại = hợp lệ.
export const mcHopLe = (m) => ['so_hieu', 'chu_cu'].includes(m.loai) && m.hop_le !== false;
export const TEN_LOAI_MC = { so_hieu: 'Số hiệu văn bản', chu_cu: 'Minh chứng cũ', tep: 'Tệp' };
