// Minh chứng có cấu trúc (GĐ16, migration 0028): đọc bảng minh_chung (RLS theo phạm vi nhiệm vụ); MỌI thao tác ghi đi qua
// hàm SECURITY DEFINER nop_minh_chung / xac_nhan_minh_chung / dong_nhiem_vu — frontend không ghi thẳng bảng, quyền thật trong hàm.
import { supabase } from '../supabase.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo) => loi(await supabase.rpc(ham, thamSo), 'không thực hiện được');

// Mọi minh chứng của một nhiệm vụ, mới nhất trước.
export async function loadMinhChung(nhiemVuId) {
  return loi(await supabase.from('minh_chung').select('*').eq('nhiem_vu_id', nhiemVuId).order('nop_luc', { ascending: false }), 'đọc minh chứng') || [];
}

// p: { nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan } — ba trường bắt buộc (MC-3) → id minh chứng.
export const nopMinhChung = (p) => rpc('nop_minh_chung', { p });
// Xác nhận hợp lệ (true) hoặc không hợp lệ (false, bắt buộc lý do) — hành động ghi vết, không xoá dòng (MC-6).
export const xacNhanMinhChung = (id, hopLe, lyDo = null) => rpc('xac_nhan_minh_chung', { p_id: id, p_hop_le: hopLe, p_ly_do: lyDo || null });
// Đóng nhiệm vụ (MC-4): DB kiểm lại minh chứng hợp lệ; ngay = null → lấy ngày văn bản của minh chứng hợp lệ mới nhất.
export const dongNhiemVu = (id, ngay = null) => rpc('dong_nhiem_vu', { p_id: id, p_ngay_hoan_thanh: ngay || null });

// Cùng vị từ với minh_chung_la_hop_le() trong 0028: chưa bị bác = hợp lệ (nút Đóng sáng ngay khi nộp đủ ba trường).
export const mcHopLe = (m) => ['so_hieu', 'chu_cu'].includes(m.loai) && m.hop_le !== false;
export const TEN_LOAI_MC = { so_hieu: 'Số hiệu văn bản', chu_cu: 'Minh chứng cũ', tep: 'Tệp' };
