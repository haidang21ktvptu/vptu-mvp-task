// Ảnh hồ sơ (PR-2a C2, 0052): bucket anh-ho-so RIÊNG TƯ; accounts.anh_url lưu ĐƯỜNG DẪN tệp '<uid>/anh-<thời điểm>.<đuôi>' (cap_nhat_ho_so
// chỉ nhận đường dẫn trong thư mục của chính mình). Hiển thị bằng signed URL 1 giờ — mọi người đã đăng nhập xem được (Q5 a), người chưa
// đăng nhập thì không. Signed URL nhớ trong bộ nhớ (không lưu storage) tới 5 phút trước khi hết hạn; tên tệp đổi mỗi lần tải nên không cần ?v=.
import { supabase } from './supabase.js';
import { escapeHtml } from './dom.js';

const BUCKET = 'anh-ho-so';
const HAN_GIAY = 3600;
const DU_PHONG_MS = 5 * 60_000;
const nho = new Map();   // đường dẫn → { url, het }
const conHan = (x) => x && x.het - DU_PHONG_MS > Date.now();

// Signed URL cho nhiều ảnh trong một lời gọi (createSignedUrls); đường dẫn đã nhớ còn hạn thì không gọi.
export async function urlAnhNhieu(paths) {
  const can = [...new Set(paths.filter((p) => p && !conHan(nho.get(p))))];
  if (can.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(can, HAN_GIAY);
    if (!error) (data || []).forEach((d) => { if (d.signedUrl && !d.error) nho.set(d.path, { url: d.signedUrl, het: Date.now() + HAN_GIAY * 1000 }); });
  }
  return Object.fromEntries(paths.filter(Boolean).map((p) => [p, conHan(nho.get(p)) ? nho.get(p).url : null]));
}
export const urlAnh = async (path) => (path ? (await urlAnhNhieu([path]))[path] : null);

// Vẽ ô ảnh: chữ cái đầu của tên ngay, thay bằng ảnh khi có signed URL (lỗi / chưa có ảnh → giữ chữ cái).
export async function veAnh(el, user) {
  if (!el || !user) return;
  const chu = ((user.full_name || '').trim().split(/\s+/).pop() || '?').charAt(0).toUpperCase();
  el.textContent = chu;
  const path = user.anh_url;
  if (!path) return;
  const url = await urlAnh(path);
  if (url && user.anh_url === path) el.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
}

// Tải ảnh mới vào <uid>/anh-<thời điểm>.<đuôi> (tên mới mỗi lần, không ghi đè); trả đường dẫn.
export async function taiAnhHoSo(file, uid) {
  if (file.size > 2 * 1024 * 1024) throw new Error('Ảnh vượt 2 MB.');
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
  if (!ext) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  const path = `${uid}/anh-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw new Error('Không tải được ảnh: ' + error.message);
  return path;
}

// Xoá tệp ảnh của chính mình (ảnh cũ sau khi đã lưu ảnh mới, hoặc ảnh vừa tải khi lưu hồ sơ lỗi). Lỗi không chặn luồng.
export async function xoaAnhHoSo(path, uid) {
  if (!path || !path.startsWith(`${uid}/`)) return;
  nho.delete(path);
  await supabase.storage.from(BUCKET).remove([path]);
}
