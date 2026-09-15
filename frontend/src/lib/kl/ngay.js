// Ngày cho module KL: mọi phép "hôm nay" lấy theo giờ Việt Nam (Asia/Ho_Chi_Minh) cho khớp kl_hom_nay() ở DB;
// giá trị ngày là chuỗi 'YYYY-MM-DD' (cột date của Postgres), không đi qua Date cục bộ để tránh lệch múi giờ.
const MUI_GIO_VN = 'Asia/Ho_Chi_Minh';

// 'YYYY-MM-DD' của hôm nay theo giờ Việt Nam (máy người dùng ở múi giờ nào cũng ra cùng kết quả).
export function homNayVN(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: MUI_GIO_VN, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const lay = (t) => p.find((x) => x.type === t).value;
  return `${lay('year')}-${lay('month')}-${lay('day')}`;
}

// Số ngày từ a tới b (b − a), hai chuỗi 'YYYY-MM-DD'; tính bằng UTC nên không bị ảnh hưởng đổi giờ.
export function soNgay(a, b) {
  return Math.round((Date.UTC(...tach(b)) - Date.UTC(...tach(a))) / 86400000);
}
const tach = (s) => { const [y, m, d] = s.split('-').map(Number); return [y, m - 1, d]; };

// '2026-09-14' → '14/9/2026' (cách viết ngày trong văn bản); null/rỗng → ''.
export function formatNgay(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

// 'YYYY-MM-DD' + n ngày (n có thể âm).
export function congNgay(s, n) {
  const d = new Date(Date.UTC(...tach(s)));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Ghi chú cạnh ô hạn: "còn N ngày" / "đến hạn hôm nay" / "quá N ngày"; hạn trống → ''.
export function ghiChuHan(han, homNay) {
  if (!han) return '';
  const n = soNgay(homNay, han);
  if (n < 0) return `Quá ${-n} ngày`;
  if (n === 0) return 'Đến hạn hôm nay';
  return `Còn ${n} ngày`;
}

// Số ngày từ một mốc timestamptz tới bây giờ, theo ngày giờ Việt Nam (cho "cập nhật N ngày trước").
export function ngayTruoc(iso, now = new Date()) {
  if (!iso) return null;
  return soNgay(homNayVN(new Date(iso)), homNayVN(now));
}

// Gợi ý ngày hoàn thành từ chuỗi minh chứng dạng "Số 12/CV-VPTU ngày 5/9/2026" → '2026-09-05' (thiết kế 6.8).
export function ngayTrongMinhChung(text) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text || '');
  if (!m) return null;
  const [, d, mo, y] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
