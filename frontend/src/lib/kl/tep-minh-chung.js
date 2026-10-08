// Đợt D v3.20 (0089–0090): tệp minh chứng trong kho riêng tư "minh-chung" — đường dẫn <id nhiệm vụ>/<8 ký tự ngẫu nhiên>-<tên an toàn>.
// Tải lên trước, rồi nop_minh_chung / gan_tep_minh_chung gắn đường dẫn (DB kiểm tệp có thật, đúng việc); nộp lỗi thì xoá tệp vừa tải (policy chỉ
// cho xoá tệp của chính mình chưa gắn minh chứng). Xem tệp: đường dẫn ký 2 phút (policy đọc = ai thấy nhiệm vụ).
import { supabase } from '../supabase.js';
import { cauHinhKl } from './du-lieu.js';
import { tenAnToan, kieuTep } from './tep-ten.js';

export const KHO_MC = 'minh-chung';
export const batBuocTep = () => cauHinhKl('minh_chung_bat_buoc_tep', 1) === 2;   // 0089: cấu hình 2 = nộp minh chứng phải kèm tệp

export async function taiLenTep(nhiemVuId, file) {
  const ngauNhien = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, '').slice(0, 8);
  const path = `${nhiemVuId}/${ngauNhien}-${tenAnToan(file.name)}`;
  const { error } = await supabase.storage.from(KHO_MC).upload(path, file, { contentType: kieuTep(file), upsert: false });
  if (error) throw new Error(`Không tải được tệp lên: ${error.message}`);
  return path;
}

export async function xoaTepChuaGan(path) {
  if (!path) return;
  try { await supabase.storage.from(KHO_MC).remove([path]); } catch { /* tệp mồ côi vô hại — người quản trị dọn sau */ }
}

export async function duongDanXemTep(path) {
  const { data, error } = await supabase.storage.from(KHO_MC).createSignedUrl(path, 120);
  if (error) throw new Error(`Không mở được tệp: ${error.message}`);
  return data.signedUrl;
}
