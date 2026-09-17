// Điều hành ngoại lệ (GĐ15, migration 0026; GĐ20 0033): đọc v_ngoai_le (có cột khau), luồng chỉ đạo, tin hệ thống, số liệu tại ngày.
// MỌI thao tác ghi đi qua hàm SECURITY DEFINER của 0026/0032 (chi_dao_gui / chi_dao_phan_hoi / chi_dao_dong / dat_cap_quyet_dinh /
// đánh dấu đã đọc) — frontend không INSERT/UPDATE thẳng bảng chi_dao hay direct_messages loại hệ thống; quyền thật nằm trong hàm.
import { supabase } from '../supabase.js';

const loi = (r, viec) => { if (r.error) throw new Error(`${viec}: ${r.error.message}`); return r.data; };
const rpc = async (ham, thamSo) => loi(await supabase.rpc(ham, thamSo), 'không thực hiện được');

// Việc Đỏ / Đỏ đặc biệt trong phạm vi (RLS), đã sắp số ngày trễ giảm dần; nhom = DO | DANG_TRA_SOAT; khau (0033).
export async function loadNgoaiLe() {
  return loi(await supabase.from('v_ngoai_le').select('*'), 'đọc việc ngoại lệ') || [];
}

// Số liệu trong phạm vi tại một ngày (kl_so_lieu_tai 0033, SECURITY INVOKER): {ngay, tong, nhom_dem, muc_canh_bao, ket_qua}.
// Gọi hai lần (hôm nay, hôm nay − 7) để hiện "tăng/giảm N so với tuần trước" — không tính xu hướng ở client (không có lịch sử).
export async function loadSoLieuTai(ngay = null) {
  const r = await supabase.rpc('kl_so_lieu_tai', ngay ? { p_ngay: ngay } : {});
  return loi(r, 'đọc số liệu tại ngày') || { tong: 0, nhom_dem: {}, muc_canh_bao: {}, ket_qua: {} };
}

// Minh chứng chưa thẩm định (hop_le NULL) trong phạm vi (RLS minh_chung theo phạm vi nhiệm vụ) — khối "chờ xác nhận" A1/A2.
export async function loadMinhChungCho() {
  return loi(await supabase.from('minh_chung').select('id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, cap_nhan, nop_boi, nop_luc')
    .is('hop_le', null).order('nop_luc', { ascending: false }), 'đọc minh chứng chờ xác nhận') || [];
}

// Chỉ đạo đang chờ phản hồi trong phạm vi (mọi loại gốc, trừ PHAN_HOI) — A2 "chỉ đạo từ Văn phòng chờ phòng", A3 "chỉ đạo cần trả lời".
export async function loadChiDaoCho() {
  return loi(await supabase.from('chi_dao').select('id, nhiem_vu_id, loai, noi_dung, nguoi_gui, nguoi_nhan, han_phan_hoi, created_at, tra_loi_cho')
    .eq('trang_thai', 'CHO_PHAN_HOI').neq('loai', 'PHAN_HOI').order('created_at'), 'đọc chỉ đạo chờ phản hồi') || [];
}

// Luồng chỉ đạo của một nhiệm vụ: mọi dòng chi_dao (gốc + phản hồi, theo thời gian) và tập id tôi đã đọc.
export async function loadChiDao(nhiemVuId) {
  const rows = loi(await supabase.from('chi_dao').select('*').eq('nhiem_vu_id', nhiemVuId).order('created_at').order('id'), 'đọc chỉ đạo') || [];
  if (rows.length === 0) return { rows, daDoc: new Set() };
  const dd = loi(await supabase.from('chi_dao_da_doc').select('chi_dao_id').in('chi_dao_id', rows.map((c) => c.id)), 'đọc trạng thái đã đọc') || [];
  return { rows, daDoc: new Set(dd.map((x) => x.chi_dao_id)) };
}

// p: { nhiem_vu_id, loai, noi_dung, han_phan_hoi?, han_moi? (GIA_HAN), nguoi_theo_doi_moi? (GIAO_LAI), tra_loi_cho? } → id chỉ đạo.
export const chiDaoGui = (p) => rpc('chi_dao_gui', { p });
// p: { chi_dao_id (gốc hoặc một phản hồi), noi_dung } → id phản hồi.
export const chiDaoPhanHoi = (p) => rpc('chi_dao_phan_hoi', { p });
export const chiDaoDong = (id) => rpc('chi_dao_dong', { p_id: id });
// Ghi "đã đọc" cho mọi dòng của luồng (gọi khi mở ngăn chi tiết); lỗi không chặn màn hình.
export const chiDaoDanhDauDoc = (nhiemVuId) => supabase.rpc('chi_dao_danh_dau_doc', { p_nhiem_vu: nhiemVuId });
// Cấp cần quyết định điền tại chỗ (CN-5.2(4)); '' = bỏ trống.
export const datCapQuyetDinh = (id, cap) => rpc('dat_cap_quyet_dinh', { p_id: id, p_cap: cap || null });

// Tin hệ thống của tôi (chuông), mới nhất trước.
export async function loadTinHeThong(gioiHan = 60) {
  return loi(await supabase.from('direct_messages').select('id, sender_id, content, is_read, created_at, nhiem_vu_id')
    .eq('loai', 'he_thong').order('created_at', { ascending: false }).limit(gioiHan), 'đọc thông báo') || [];
}
export const tinHeThongDaDoc = (nhiemVuId = null) => rpc('tin_he_thong_da_doc', { p_nhiem_vu: nhiemVuId });

// Nhãn loại chỉ đạo (cùng bảng với chi_dao_ten_loai trong 0026).
export const TEN_LOAI_CHI_DAO = {
  DON_DOC: 'Đôn đốc', GIA_HAN: 'Gia hạn', GIAO_LAI: 'Giao lại', YEU_CAU_MINH_CHUNG: 'Yêu cầu minh chứng',
  KIEM_TRA_SO_LIEU: 'Kiểm tra số liệu', Y_KIEN: 'Ý kiến', PHAN_HOI: 'Phản hồi', CHI_DAO_TT: 'Chỉ đạo Thường trực',
};
export const TEN_TRANG_THAI_CHI_DAO = { CHO_PHAN_HOI: 'Chờ phản hồi', DA_PHAN_HOI: 'Đã phản hồi', DA_DONG: 'Đã đóng' };
// Chỉ đạo Thường trực (GĐ19, 0032 v_chi_dao_tt, RLS lọc phạm vi): A1 lọc dòng mình là người nhận, A0 dòng mình gửi.
export async function loadChiDaoTT() {
  return loi(await supabase.from('v_chi_dao_tt').select('*'), 'đọc chỉ đạo Thường trực') || [];
}
