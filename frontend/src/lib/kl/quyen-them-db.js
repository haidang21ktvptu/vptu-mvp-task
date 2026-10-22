// v3.29 (0123–0126): gọi các hàm ghi mới — điều chỉnh hạn, đổi chủ trì, sửa toàn bộ / mở lại nhiệm vụ, sửa văn bản giao, sửa / gỡ minh chứng. Mọi
// kiểm tra quyền và dữ liệu ở hàm DB (lỗi trả câu tiếng Việt); đây chỉ chuyển tham số và ném lỗi.
import { supabase } from '../supabase.js';

const goi = async (ham, thamSo) => { const r = await supabase.rpc(ham, thamSo); if (r.error) throw new Error(r.error.message); return r.data; };
const nfc = (s) => (typeof s === 'string' ? s.normalize('NFC') : s);
const nfcObj = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, x]) => [k, nfc(x)]));

export const dieuChinhHan = (id, hanMoi, lyDo) => goi('dieu_chinh_han', { p_id: id, p_han_moi: hanMoi, p_ly_do: nfc(lyDo) });
export const doiChuTri = (id, p, lyDo) => goi('doi_chu_tri', { p_id: id, p, p_ly_do: nfc(lyDo) });
export const suaToanBo = (id, thayDoi, lyDo) => goi('sua_toan_bo_nhiem_vu', { p_id: id, p_thay_doi: nfcObj(thayDoi), p_ly_do: nfc(lyDo) });
export const moLaiNhiemVu = (id, lyDo) => goi('mo_lai_nhiem_vu', { p_id: id, p_ly_do: nfc(lyDo) });
export const suaVanBan = (id, thayDoi, lyDo) => goi('van_ban_sua', { p_id: id, p_thay_doi: nfcObj(thayDoi), p_ly_do: nfc(lyDo) });
export const suaMinhChung = (id, thayDoi, lyDo) => goi('sua_minh_chung', { p_id: id, p_thay_doi: nfcObj(thayDoi), p_ly_do: nfc(lyDo) });
export const goMinhChung = (id, lyDo) => goi('go_minh_chung', { p_id: id, p_ly_do: nfc(lyDo) });
// Văn bản giao (đọc theo RLS — người thấy việc thấy văn bản) cho hộp "Sửa văn bản giao".
export async function docVanBan(id) {
  const r = await supabase.from('van_ban_giao_viec').select('id, loai, so_hoi_nghi, so_ket_luan, ngay_ban_hanh, ngay_nhan, trich_yeu').eq('id', id).single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
