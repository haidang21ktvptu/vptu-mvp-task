// Minh chứng có cấu trúc (GĐ16, migration 0028): đọc bảng minh_chung (RLS theo phạm vi nhiệm vụ); MỌI thao tác ghi đi qua
// hàm SECURITY DEFINER nop_minh_chung / xac_nhan_minh_chung / dong_nhiem_vu — frontend không ghi thẳng bảng, quyền thật trong hàm.
import { supabase } from '../supabase.js';
import { COT_MINH_CHUNG, taiTheoTrang } from './cot.js';
import { state, findAccount } from '../state.js';
import { homNayVN } from './ngay.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo) => loi(await supabase.rpc(ham, thamSo), 'không thực hiện được');

// Q8 (0057, 0061): việc Thường trực (A0) giao cho Chánh VP chủ trì — chỉ thư ký Thường trực nghiệm thu; không ai giữ cờ thư ký thì quan_tri_kl còn
// hạn; KHÔNG BAO GIỜ chính Chánh VP. Cùng tập với nguoi_nghiem_thu_chinh (DB là chốt) — để ẩn/hiện nút nghiệm thu.
export const laViecTtGiaoCvp = (r) => (findAccount(r.tao_boi)?.role_group === 'A0' || r.giao_thay_mat_nhom === 'THUONG_TRUC')   // 0083: thay mặt Thường trực cũng vậy
  && ((o) => o?.role_group === 'A1' && Boolean(o.is_chief))(findAccount(r.owner_tai_khoan));
export function nghiemThuViecTt(r, nopBoi, me = state.user) {
  const duoc = (a) => a && !a.is_system && !a.bi_khoa && a.role_group !== 'A0' && a.id !== nopBoi && a.id !== r.owner_tai_khoan;
  const thuKy = state.accounts.filter((a) => a.thu_ky_thuong_truc && duoc(a));
  const ds = thuKy.length ? thuKy : state.accounts.filter((a) => a.quan_tri_kl && (!a.quan_tri_kl_het_han || a.quan_tri_kl_het_han >= homNayVN()) && duoc(a));
  return ds.some((a) => a.id === me?.id);
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

// p: { nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan, trich_yeu, mo_ta_ket_qua } — năm trường bắt buộc (MC-3, 0046) → id minh chứng.
// PR-2b: trích yếu / mô tả chuẩn hoá NFC trước khi đếm và gửi — tiếng Việt dạng tổ hợp (NFD, dán từ Word/Mac) đếm đúng như char_length của DB.
export const nfc = (s) => (typeof s === 'string' ? s.normalize('NFC') : s);
export const nopMinhChung = (p) => rpc('nop_minh_chung', { p: { ...p, trich_yeu: nfc(p.trich_yeu), mo_ta_ket_qua: nfc(p.mo_ta_ket_qua) } });
// Kiểm phía form dùng chung cho hộp Nộp minh chứng và ô nộp tại chỗ (A3): trả chuỗi lỗi hoặc null — hàm nop_minh_chung là chốt.
// Đợt C1 (0086): số hiệu + ngày văn bản là đủ; cấp nhận trống = cấp nhận sản phẩm của việc; trích yếu, mô tả kết quả tuỳ chọn (≤ 600 ký tự).
export function loiMinhChung(p) {
  if (!p.so_hieu || !p.ngay_van_ban) return 'Minh chứng phải có số hiệu và ngày văn bản (cấp nhận lấy theo việc nếu để trống).';
  if (nfc(p.mo_ta_ket_qua || '').length > 600) return 'Mô tả kết quả tối đa 600 ký tự.';
  return null;
}
// Nghiệm thu (true — PR-2b Q2: đóng việc cùng giao dịch, ngày hoàn thành = ngày văn bản minh chứng) hoặc trả lại (false: lý do; 0077 bỏ hạn nộp
// lại — hàm DB vẫn nhận p_han_nop_lai, luôn gửi null). Ghi vết, không xoá dòng (MC-6).
// PR-3 (0063): nghiệm thu đóng việc bắt buộc chất lượng (KHONG_DAT / DAT / DAT_TOT / DAT_XUAT_SAC); trả lại không kèm chất lượng.
export const xacNhanMinhChung = (id, hopLe, lyDo = null, chatLuong = null) =>
  rpc('xac_nhan_minh_chung', { p_id: id, p_hop_le: hopLe, p_ly_do: lyDo || null, p_han_nop_lai: null, p_chat_luong: chatLuong || null });
// Đóng nhiệm vụ (MC-4): DB kiểm lại minh chứng hợp lệ; ngay = null → lấy ngày văn bản của minh chứng hợp lệ mới nhất.
export const dongNhiemVu = (id, ngay = null, chatLuong = null) => rpc('dong_nhiem_vu', { p_id: id, p_ngay_hoan_thanh: ngay || null, p_chat_luong: chatLuong || null });

// Cùng vị từ với minh_chung_la_hop_le() trong 0028: chưa bị bác = hợp lệ (nút Đóng sáng ngay khi nộp đủ ba trường).
export const mcHopLe = (m) => ['so_hieu', 'chu_cu'].includes(m.loai) && m.hop_le !== false;
export const TEN_LOAI_MC = { so_hieu: 'Số hiệu văn bản', chu_cu: 'Minh chứng cũ', tep: 'Tệp' };
