// Mức của tin hệ thống (v3.36, 0142 — CAU-HOI V-10): cơ sở dữ liệu phân mức lúc tạo tin (kl_phan_muc_tin) vào direct_messages.muc_tin.
// XU_LY = cần đồng chí xử lý (đếm trên huy hiệu chuông, toast, âm chuông); BIET = để biết (thẻ riêng, không toast). Tin chưa có cột mức
// (dữ liệu trước 0142) coi như cần xử lý, như cách chuông đếm trước đây.
export const MUC_TIN = ['XU_LY', 'BIET'];
export const mucCua = (t) => (t?.muc_tin === 'BIET' ? 'BIET' : 'XU_LY');

// Số tin chưa đọc theo mức trên danh sách tin đang nạp.
export function demChuaDoc(ds) {
  const so = { XU_LY: 0, BIET: 0 };
  (ds || []).forEach((t) => { if (!t.is_read) so[mucCua(t)]++; });
  return so;
}

// Tin mới tới qua realtime: chỉ tin cần xử lý mới bật toast / âm chuông.
export const canBaoNgay = (t) => mucCua(t) === 'XU_LY';
