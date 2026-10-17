// Trợ lý AI (v3.25 — Edge Function tro-ly-ai, migration 0112): gọi từ trình duyệt bằng JWT của người dùng (supabase.functions.invoke); khoá API của
// nhà cung cấp chỉ nằm trong secrets của function, không bao giờ tới trình duyệt. trangThaiAi nhớ 5 phút (ẩn / hiện nút "Đọc văn bản"); function
// chưa triển khai / lỗi mạng → coi như tắt. Lỗi → Error tiếng Việt (trường error của function) kèm ma (CHUA_KHOA, TAT, HET_LUOT, QUA_DAI…).
import { supabase } from '../supabase.js';

const HAN_NHO_MS = 5 * 60_000;
let nho = null; let luc = 0;

async function goi(body) {
  const { data, error } = await supabase.functions.invoke('tro-ly-ai', { body });
  if (error) {
    let msg = 'Không gọi được trợ lý AI — kiểm tra mạng rồi thử lại.'; let ma = 'KET_NOI';
    try { const j = await error.context?.json(); if (j?.error) { msg = j.error; ma = j.ma || 'LOI'; } } catch { /* giữ thông báo mặc định */ }
    if (ma === 'KET_NOI' && error.context?.status === 404) { msg = 'Trợ lý AI chưa được triển khai trên máy chủ.'; ma = 'CHUA_CO'; }
    throw Object.assign(new Error(msg), { ma });
  }
  if (!data?.ok) throw Object.assign(new Error(data?.error || 'Trợ lý AI không thực hiện được yêu cầu.'), { ma: data?.ma || 'LOI' });
  return data;
}

// → { bat, nha_cung_cap, ten, mo_hinh, co_khoa, gui_noi_dung } | { bat: false, loi }.
export async function trangThaiAi(lai = false) {
  if (!lai && nho && Date.now() - luc < HAN_NHO_MS) return nho;
  try { nho = await goi({ hanh_dong: 'trang_thai' }); } catch (e) { nho = { bat: false, loi: e.message, ma: e.ma }; }
  luc = Date.now();
  return nho;
}
export const xoaNhoAi = () => { nho = null; };
// Dùng được để đọc văn bản: đang bật, có khoá, cấu hình cho gửi nội dung.
export const aiDocDuoc = (t) => Boolean(t?.bat && t?.co_khoa && t?.gui_noi_dung);
// p = { ten_tep, chu, anh?: [{ media, data }], so_trang } → { ket_qua (đã xác minh ở máy chủ), mo_hinh, nha_cung_cap, thoi_gian_ms }.
export const docVanBanAi = (p) => goi({ hanh_dong: 'doc_van_ban', ...p });
export const soanQuyTacAi = (ma) => goi({ hanh_dong: 'soan_quy_tac', ma });
export const kiemTraAi = () => goi({ hanh_dong: 'kiem_tra' });
