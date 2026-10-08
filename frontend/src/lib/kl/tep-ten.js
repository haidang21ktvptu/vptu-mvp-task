// Đợt D v3.20 (0089): quy tắc tệp minh chứng phía giao diện — loại, cỡ (≤ 10 MB, như kho "minh-chung"), tên an toàn cho đường dẫn kho tệp.
// Hàm thuần (unit test frontend/tests/doc-van-ban.test.mjs). Kho tệp từ chối loại / cỡ sai — đây chỉ để báo sớm bằng tiếng Việt.
export const TOI_DA_TEP = 10 * 1024 * 1024;
const KIEU = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};
export const NHAN_TEP = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
const duoi = (ten) => (String(ten || '').match(/\.([A-Za-z0-9]{2,5})$/)?.[1] || '').toLowerCase();

// Kiểu MIME gửi lên kho: theo đuôi tệp (trình duyệt có khi để trống với .doc/.xls).
export const kieuTep = (f) => KIEU[duoi(f?.name)] || f?.type || '';
export const laPdf = (f) => kieuTep(f) === 'application/pdf';

export function loiTep(f) {
  if (!f) return null;
  if (!KIEU[duoi(f.name)]) return 'Chỉ nhận tệp PDF, Word, Excel hoặc ảnh (JPG, PNG).';
  if (f.size > TOI_DA_TEP) return 'Tệp vượt 10 MB — chọn tệp nhỏ hơn hoặc nén lại.';
  return null;
}

// Tên trong đường dẫn kho: bỏ dấu tiếng Việt, ký tự khác chữ / số / . _ - thành "-", giữ đuôi, tối đa 80 ký tự (tên gốc lưu ở tep_ten).
export function tenAnToan(ten) {
  const d = duoi(ten);
  const goc = String(ten || '').replace(/\.[A-Za-z0-9]{2,5}$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 70) || 'tep';
  return d ? `${goc}.${d}` : goc;
}
