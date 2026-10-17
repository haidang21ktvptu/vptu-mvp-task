// Nhập Excel (v3.25): tự gắn mục tiêu then chốt cho dòng KHÔNG ghi mục tiêu — ô "Tự gắn mục tiêu then chốt theo quy tắc tích sẵn" của bản xem trước
// (mặc định bật) → du_lieu.tu_gan_muc_tieu = true; khi lô tạo việc, trigger kl_dong_nhap_gan_muc_tieu (0110) chạy bộ nhận diện trên việc vừa tạo (có
// thêm mục tiêu của văn bản). Bản xem trước hiện "dự kiến" theo goi_y_muc_tieu_ds (0111) — cùng bộ nhận diện, chưa biết văn bản đã gắn mục tiêu gì.
// Thuần (không DOM, không mạng) — unit test frontend/tests/nhap-excel.test.mjs.

// Dòng cần dự kiến / được gắn cờ: lô TẠO việc (giao ngay, đã xong ngoài hệ thống, hoàn thành theo minh chứng — như trigger) và tệp không ghi mục tiêu.
// Dòng chờ hoàn thiện được gợi ý ở biểu mẫu Giao việc khi hoàn thiện; dòng cập nhật theo mã không đổi mục tiêu.
const TAO_VIEC = new Set(['GIAO', 'DA_XONG', 'CHO_NGHIEM_THU']);
export const canTuGan = (x) => Boolean(x) && TAO_VIEC.has(x.ket_qua) && !(Array.isArray(x.du_lieu?.muc_tieu_ma) && x.du_lieu.muc_tieu_ma.length);
// Đầu vào bộ nhận diện của một dòng (đã đánh giá — danh-gia.js gt) và khoá nhớ đệm theo nội dung.
export const dauVaoGoiY = (x) => ({ so_hieu_van_ban: x.gt?.so_ket_luan || null, noi_dung: String(x.gt?.noi_dung || ''), nganh: x.gt?.nganh || null, linh_vuc: x.gt?.linh_vuc || null });
export const khoaGoiY = (p) => JSON.stringify([p.so_hieu_van_ban, p.noi_dung, p.nganh, p.linh_vuc]);
// Kết quả goi_y_muc_tieu → mục tích sẵn (bỏ mục chỉ vì "mục tiêu của văn bản") + số hiệu chưa có trong danh mục (hệ thống tự thêm khi nhập).
export function duKienTuGoiY(kq) {
  const ma = (kq?.goi_y || []).filter((g) => g?.muc === 'TU_TICH' && !(g.ly_do || []).every((l) => l.loai === 'VAN_BAN')).map((g) => g.ma);
  return { ma: ma.slice(0, 10), moi: (kq?.so_hieu_moi || []).map((x) => x.so_hieu).filter(Boolean) };
}
// Chữ hiện ở cột ghi chú: "mục tiêu tự gắn (dự kiến): Đột phá…; Nghị quyết 57-NQ/TW; 81-NQ/TW (thêm vào danh mục)". tenMt: (mã) → tên ngắn.
export function chuDuKien(d, tenMt = (m) => m) {
  if (!d || (!d.ma.length && !d.moi.length)) return '';
  return `mục tiêu tự gắn (dự kiến): ${[...d.ma.map(tenMt), ...d.moi.map((s) => `${s} (thêm vào danh mục)`)].join('; ')}`;
}
// Dữ liệu gửi DB của một dòng: thêm / bỏ cờ tu_gan_muc_tieu theo ô của bản xem trước (không đổi đối tượng gốc).
export function duLieuCoCo(x, bat) {
  const d = { ...x.du_lieu };
  if (bat && canTuGan(x)) d.tu_gan_muc_tieu = true; else delete d.tu_gan_muc_tieu;
  return d;
}
