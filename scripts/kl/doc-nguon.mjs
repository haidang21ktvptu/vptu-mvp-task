// Đọc nguồn dữ liệu KL BTVTU thành dòng chuẩn hoá — từ file Excel gốc (ngoài repo, sheet "Phụ lục 2" +
// "NhatKyChinhSua") hoặc từ bộ dữ liệu vàng .json (tests/rls/du-lieu-vang, cùng cấu trúc, đã ẩn danh).
// Mọi ngày trả về dạng 'YYYY-MM-DD'; mốc giờ dạng ISO có múi giờ. Không suy đoán giá trị: ô công thức không có
// kết quả cache (IF(...) trả "") coi là trống; ô lỗi/không đọc được → ném lỗi kèm địa chỉ ô.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const SHEET_CHINH = 'Phụ lục 2';
export const SHEET_NHAT_KY = 'NhatKyChinhSua';
export const DONG_TIEU_DE = 3;
// Thứ tự cột sheet "Phụ lục 2" (16 cột, tiêu đề ở dòng 3). Dòng 4 trở đi là dữ liệu; dừng khi hết nội dung + chủ trì.
export const TIEU_DE = ['STT', 'Số hội nghị', 'Số TB/KL', 'Ngày ban hành', 'Chủ trì theo dõi', 'Ngành/lĩnh vực',
  'Cơ quan/đơn vị trình', 'Lĩnh vực chi tiết', 'Nội dung kết luận / Văn bản trình', 'Loại thời hạn', 'Hạn xử lý',
  'Tiến độ', 'Kết quả thực hiện / Minh chứng', 'Văn bản triển khai', 'Mã nhiệm vụ', 'Ngày cập nhật gần nhất'];
const KHOA = ['stt', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'chu_tri_ten', 'nganh_ten', 'co_quan_trinh_ten',
  'linh_vuc_chi_tiet', 'noi_dung', 'loai_thoi_han_ten', 'han_xu_ly', 'tien_do_ten', 'minh_chung', 'van_ban_trien_khai',
  'ma', 'cap_nhat_luc'];
const COT_NGAY = new Set(['ngay_ban_hanh', 'han_xu_ly']);

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const pad = (n) => String(n).padStart(2, '0');
// exceljs trả Date ở UTC 00:00 cho ô ngày → lấy phần UTC. Ô có giờ (cột 16) là giờ tường Việt Nam.
export function ngayISO(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
export function gioVN(d) { return `${ngayISO(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+07:00`; }
// Số serial Excel (46387 = 31/12/2026) — gặp trong "Giá trị mới" của nhật ký với cột ngày.
export function serialSangNgay(n) { return ngayISO(new Date(Math.round((n - 25569) * 86400) * 1000)); }

// Giá trị "thô" của ô: chuỗi, số, Date hoặc null. richText ghép lại; công thức lấy result (""/undefined → null).
function giaTriO(cell) {
  const v = cell.value;
  if (v == null || v === '') return null;
  if (typeof v !== 'object') return v;
  if (v instanceof Date) return v;
  if (v.richText) return v.richText.map((t) => t.text).join('');
  if ('formula' in v || 'sharedFormula' in v) {
    if (v.result == null || v.result === '') return null;
    if (typeof v.result === 'object' && !(v.result instanceof Date)) throw new Error(`Ô ${cell.address}: công thức trả lỗi ${JSON.stringify(v.result)}`);
    return v.result;
  }
  if (v.text) return String(v.text);
  if (v.error) throw new Error(`Ô ${cell.address}: giá trị lỗi ${v.error}`);
  throw new Error(`Ô ${cell.address}: kiểu giá trị không đọc được ${JSON.stringify(v)}`);
}

const chuoi = (v) => (v == null ? null : typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : v instanceof Date ? ngayISO(v) : String(v));

function docDongChinh(ws) {
  for (let i = 0; i < TIEU_DE.length; i++) {
    const h = chuoi(giaTriO(ws.getRow(DONG_TIEU_DE).getCell(i + 1)));
    if (h !== TIEU_DE[i]) throw new Error(`Tiêu đề cột ${i + 1} là "${h}", kỳ vọng "${TIEU_DE[i]}" (dòng ${DONG_TIEU_DE}).`);
  }
  const rows = [];
  for (let r = DONG_TIEU_DE + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = KHOA.map((_, i) => giaTriO(row.getCell(i + 1)));
    if (raw[8] == null && raw[4] == null) break;   // hết dữ liệu (các dòng sau chỉ còn công thức STT/mã)
    const o = { dong: r };
    KHOA.forEach((k, i) => {
      const v = raw[i];
      if (k === 'cap_nhat_luc') o[k] = v instanceof Date ? gioVN(v) : chuoi(v);
      else if (COT_NGAY.has(k)) {
        if (v != null && !(v instanceof Date)) throw new Error(`Ô ${row.getCell(i + 1).address}: ${TIEU_DE[i]} không phải kiểu ngày (${JSON.stringify(v)})`);
        o[k] = v ? ngayISO(v) : null;
      } else if (k === 'stt' || k === 'so_hoi_nghi') o[k] = v == null ? null : Number(v);
      else o[k] = chuoi(v);
    });
    rows.push(o);
  }
  return rows;
}

// Nhật ký: Thời gian | Email người sửa | Dòng | Mã nhiệm vụ | Cột đã sửa | Giá trị cũ | Giá trị mới (tiêu đề dòng 1).
// Cột Thời gian là chuỗi ISO có hậu tố "Z" nhưng thực chất là GIỜ TƯỜNG VIỆT NAM (Apps Script định dạng theo múi giờ
// của sheet): trùng từng giây với cột 16 của cùng lần sửa và phân bố giờ 9h–18h/22h; nếu hiểu là UTC thì thành 16h–01h.
function gioNhatKy(v) {
  if (v instanceof Date) return gioVN(v);
  const s = chuoi(v);
  if (s == null) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z$/);
  return m ? `${m[1]}+07:00` : s;
}
function docNhatKy(ws) {
  if (!ws) return [];
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = Array.from({ length: 7 }, (_, i) => giaTriO(row.getCell(i + 1)));
    if (raw.every((v) => v == null)) continue;
    const luc = gioNhatKy(raw[0]);
    rows.push({ dong_nhat_ky: r, luc, email: chuoi(raw[1]), dong: raw[2] == null ? null : Number(raw[2]), ma: chuoi(raw[3]),
      cot: chuoi(raw[4]), cu: raw[5], moi: raw[6] });
  }
  return rows;
}

// Trả về { nhiem_vu: [...], nhat_ky: [...], nguon_sha256, loai: 'xlsx' | 'json' }.
export async function docNguon(path) {
  if (path.toLowerCase().endsWith('.json')) {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(j.nhiem_vu)) throw new Error(`${path}: thiếu mảng nhiem_vu.`);
    return { nhiem_vu: j.nhiem_vu, nhat_ky: j.nhat_ky || [], nguon_sha256: sha256File(path), loai: 'json', tong_hop: j.tong_hop || null };
  }
  if (!path.toLowerCase().endsWith('.xlsx')) throw new Error('Chỉ nhận file .xlsx (file gốc ngoài repo) hoặc .json (bộ dữ liệu vàng).');
  const { default: ExcelJS } = await import('exceljs');   // chỉ cần khi đọc Excel
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.getWorksheet(SHEET_CHINH);
  if (!ws) throw new Error(`Không có sheet "${SHEET_CHINH}" trong ${path}.`);
  return { nhiem_vu: docDongChinh(ws), nhat_ky: docNhatKy(wb.getWorksheet(SHEET_NHAT_KY)), nguon_sha256: sha256File(path), loai: 'xlsx', tong_hop: null };
}
