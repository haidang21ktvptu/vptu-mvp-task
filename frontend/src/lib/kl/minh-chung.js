// Minh chứng có cấu trúc (GĐ16, migration 0028): đọc bảng minh_chung (RLS theo phạm vi nhiệm vụ); MỌI thao tác ghi đi qua
// hàm SECURITY DEFINER nop_minh_chung / xac_nhan_minh_chung / dong_nhiem_vu — frontend không ghi thẳng bảng, quyền thật trong hàm.
import { supabase } from '../supabase.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo) => loi(await supabase.rpc(ham, thamSo), 'không thực hiện được');

// Mọi minh chứng của một nhiệm vụ, mới nhất trước.
export async function loadMinhChung(nhiemVuId) {
  return loi(await supabase.from('minh_chung').select('*').eq('nhiem_vu_id', nhiemVuId).order('nop_luc', { ascending: false }), 'đọc minh chứng') || [];
}

// Minh chứng của mọi nhiệm vụ trong phạm vi (cây Theo văn bản; v_minh_chung 0046 có thêm tên người nộp / xác nhận / cấp nhận).
export async function loadMinhChungTatCa() {
  return loi(await supabase.from('v_minh_chung').select('id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, trich_yeu, hop_le, xac_nhan_boi_ten, nop_luc')
    .order('nop_luc', { ascending: false }), 'đọc minh chứng') || [];
}

// p: { nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan, trich_yeu, mo_ta_ket_qua } — năm trường bắt buộc (MC-3, 0046) → id minh chứng.
export const nopMinhChung = (p) => rpc('nop_minh_chung', { p });
// Kiểm phía form dùng chung cho hộp Nộp minh chứng và ô nộp tại chỗ (A3): trả chuỗi lỗi hoặc null — hàm nop_minh_chung là chốt.
export function loiMinhChung(p) {
  if (!p.so_hieu || !p.ngay_van_ban || !p.cap_nhan) return 'Minh chứng phải đủ ba trường: số hiệu, ngày văn bản và cấp nhận.';
  if (!p.trich_yeu || !p.mo_ta_ket_qua) return 'Minh chứng phải có trích yếu văn bản và mô tả kết quả (đã làm gì, kết quả, gửi ai).';
  if (p.mo_ta_ket_qua.length > 600) return 'Mô tả kết quả tối đa 600 ký tự.';
  return null;
}
// Xác nhận hợp lệ (true) hoặc không hợp lệ (false, bắt buộc lý do) — hành động ghi vết, không xoá dòng (MC-6).
export const xacNhanMinhChung = (id, hopLe, lyDo = null) => rpc('xac_nhan_minh_chung', { p_id: id, p_hop_le: hopLe, p_ly_do: lyDo || null });
// Đóng nhiệm vụ (MC-4): DB kiểm lại minh chứng hợp lệ; ngay = null → lấy ngày văn bản của minh chứng hợp lệ mới nhất.
export const dongNhiemVu = (id, ngay = null) => rpc('dong_nhiem_vu', { p_id: id, p_ngay_hoan_thanh: ngay || null });

// Cùng vị từ với minh_chung_la_hop_le() trong 0028: chưa bị bác = hợp lệ (nút Đóng sáng ngay khi nộp đủ ba trường).
export const mcHopLe = (m) => ['so_hieu', 'chu_cu'].includes(m.loai) && m.hop_le !== false;
export const TEN_LOAI_MC = { so_hieu: 'Số hiệu văn bản', chu_cu: 'Minh chứng cũ', tep: 'Tệp' };
