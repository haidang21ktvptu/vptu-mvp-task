// Tổng quan ba tầng (v3.36): đọc thêm cho tầng 1 — bản chụp số liệu hằng ngày (kl_chup_viec, 0140; RLS như nhiệm vụ), chỉ đạo còn chờ phản hồi gửi
// trước mốc đọc chỉ đạo của Tổng quan, và một dòng Nhiệm vụ quý của Ban Thường vụ (phân hệ nvq_*, mọi cán bộ xem toàn bộ — 0133). Mỗi hàm lỗi thì trả
// null / rỗng để Tổng quan vẫn vẽ phần còn lại (thẻ không ghi so sánh, không có dòng Nhiệm vụ quý).
import { supabase } from '../supabase.js';
import { taiTheoTrang } from './cot.js';
import { congNgay } from './ngay.js';

const COT_CHUP = 'nhiem_vu_id, nhom_dem, muc_canh_bao, co_vuong_mac, cap_quyet_dinh';
const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };

// Bản chụp gần nhất trong khoảng hôm nay − 10 đến hôm nay − 7 (workflow có thể trễ hoặc lỡ một ngày): { ngay, rows } hoặc null.
export async function loadChupTuanTruoc(homNay) {
  const den = congNgay(homNay, -7); const tu = congNgay(homNay, -10);
  const ngay = (loi(await supabase.from('kl_chup_viec').select('ngay').gte('ngay', tu).lte('ngay', den).order('ngay', { ascending: false }).limit(1), 'đọc bản chụp số liệu') || [])[0]?.ngay;
  if (!ngay) return null;
  const rows = await taiTheoTrang(() => supabase.from('kl_chup_viec').select(COT_CHUP).eq('ngay', ngay).order('nhiem_vu_id'), 'đọc bản chụp số liệu');
  return { ngay, rows };
}

// Việc quá hạn trong bản chụp các Chủ nhật (xu hướng 12 tuần): Map ngày → Set id. Việc đang đính chính không tính quá hạn (như mucMo).
export async function loadQuaHanChuNhat(ngayDs) {
  if (!ngayDs.length) return new Map();
  const rows = await taiTheoTrang(() => supabase.from('kl_chup_viec').select('ngay, nhiem_vu_id').in('ngay', ngayDs).in('muc_canh_bao', ['DO', 'DO_DAC_BIET'])
    .neq('nhom_dem', 'DANG_DINH_CHINH').order('ngay').order('nhiem_vu_id'), 'đọc bản chụp quá hạn');
  const m = new Map();
  rows.forEach((r) => { if (!m.has(r.ngay)) m.set(r.ngay, new Set()); m.get(r.ngay).add(r.nhiem_vu_id); });
  return m;
}

// Chỉ đạo gốc còn chờ phản hồi gửi TRƯỚC mốc tu (Tổng quan đọc chỉ đạo từ đầu năm — loadChiDaoTu): cùng cột để gộp chung một mảng.
export const loadChiDaoChoTruoc = (tu) => taiTheoTrang(() => supabase.from('chi_dao').select('id, nhiem_vu_id, loai, trang_thai, nguoi_gui, created_at, han_phan_hoi, phan_hoi_luc, tra_loi_cho')
  .neq('loai', 'PHAN_HOI').is('tra_loi_cho', null).eq('trang_thai', 'CHO_PHAN_HOI').lt('created_at', `${tu}T00:00:00+07:00`).order('created_at').order('id'), 'đọc chỉ đạo chờ phản hồi');

// Quý đang diễn ra của phân hệ Nhiệm vụ quý BTV và trạng thái các nhiệm vụ (đủ cho demTheoTrangThai, cauTomTat): { ky, rows } hoặc null.
export async function loadNvqHienTai(homNay) {
  const ky = (loi(await supabase.from('nvq_ky').select('id, nam, quy, tu_ngay, den_ngay').lte('tu_ngay', homNay).gte('den_ngay', homNay)
    .order('nam', { ascending: false }).order('quy', { ascending: false }).limit(1), 'đọc quý') || [])[0];
  if (!ky) return null;
  const rows = await taiTheoTrang(() => supabase.from('v_nvq_nhiem_vu').select('id, trang_thai, ket_qua, cap_nhat_tuan_nay').eq('ky_id', ky.id).order('id'), 'đọc nhiệm vụ quý');
  return { ky, rows };
}
