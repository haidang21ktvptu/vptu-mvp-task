// Đọc bảng duyệt ánh xạ lĩnh vực từ file Excel (.xlsx) do người quản trị sheet điền (GĐ9 PR 9B, bổ sung 15/9/2026:
// Excel theo vùng dùng dấu phẩy mở CSV ";" bị gộp cột). Sheet "Đối chiếu lĩnh vực": tiêu đề dòng 5, dữ liệu từ dòng 6,
// cột A gia_tri_goc · B tên ngành hiển thị ("8. Kinh tế tổng hợp - Tài chính…") · C so_dong · D linh_vuc_de_xuat ·
// E linh_vuc_chot (cột cần đọc) · F ghi_chu. Sheet "DanhMuc" chỉ là nguồn dropdown, bỏ qua.
// Trả về cùng cấu trúc với docCsv (nganh = MÃ ngành) để phần còn lại (docChot, chốt an toàn) không đổi.
import { giaTriO } from './doc-nguon.mjs';
import { chuanHoa } from './anh-xa-linh-vuc.mjs';

export const SHEET_DOI_CHIEU = 'Đối chiếu lĩnh vực';
export const DONG_TIEU_DE_XLSX = 5;
const COT = ['gia_tri_goc', 'nganh', 'so_dong', 'linh_vuc_de_xuat', 'linh_vuc_chot', 'ghi_chu'];

const chuoi = (v) => (v == null ? '' : String(v).trim());

// Tên ngành hiển thị → mã: ưu tiên số thứ tự đầu chuỗi ("8. …" → ngành có thu_tu 8), không có số thì so tên đã chuẩn hoá
// (kể cả tên bị cắt ngắn: tên hiển thị là tiền tố của tên đầy đủ hoặc ngược lại). Không nhận diện được → null (báo lỗi ở caller).
export function maNganhTuTen(hienThi, nganh) {
  const s = chuoi(hienThi);
  if (!s) return null;
  const so = s.match(/^\s*(\d{1,2})\s*[.)]/);
  if (so) return nganh.find((n) => n.thu_tu === Number(so[1]))?.ma ?? null;
  const ch = chuanHoa(s);
  const tenKhongSo = (n) => chuanHoa(n.ten.replace(/^\s*\d{1,2}\s*[.)]\s*/, ''));   // bỏ tiền tố "8. " của tên đầy đủ
  return nganh.find((n) => n.ma === s || tenKhongSo(n) === ch || tenKhongSo(n).startsWith(ch) || ch.startsWith(tenKhongSo(n)))?.ma ?? null;
}

// Đọc file đã duyệt. Dòng trống hoàn toàn (A và E rỗng) bỏ qua. Tên ngành không nhận diện được → gom vào loi, không đoán.
export async function docXlsxDuyet(path, nganh) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets.find((w) => chuanHoa(w.name) === chuanHoa(SHEET_DOI_CHIEU));
  if (!ws) throw new Error(`File không có sheet "${SHEET_DOI_CHIEU}" (có: ${wb.worksheets.map((w) => w.name).join(', ')}).`);
  const rows = []; const loi = [];
  ws.eachRow((row, so) => {
    if (so <= DONG_TIEU_DE_XLSX) return;
    const raw = COT.map((_, i) => chuoi(giaTriO(row.getCell(i + 1))));
    if (!raw[0] && !raw[4]) return;
    const ma = maNganhTuTen(raw[1], nganh);
    if (!ma) { loi.push(`Dòng ${so}: không nhận diện được ngành "${raw[1]}" cho giá trị "${raw[0]}".`); return; }
    rows.push({ gia_tri_goc: raw[0], nganh: ma, so_dong: raw[2], linh_vuc_de_xuat: raw[3], linh_vuc_chot: raw[4], ghi_chu: raw[5] });
  });
  return { rows, loi };
}

// Ghi file mẫu cùng bố cục (cho test và để tạo file duyệt từ bảng dry-run khi người duyệt cần .xlsx).
// rows dùng nganh = MÃ ngành; cột B ghi tên ngành đầy đủ từ danh mục.
export async function ghiXlsxDuyet(path, rows, nganh) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(SHEET_DOI_CHIEU);
  ws.getCell('A1').value = 'Đối chiếu lĩnh vực chi tiết (Excel cũ) với danh mục lĩnh vực — điền cột E, để trống = giữ NULL';
  ws.getRow(DONG_TIEU_DE_XLSX).values = ['Giá trị gốc', 'Ngành', 'Số dòng', 'Lĩnh vực đề xuất', 'Lĩnh vực chốt', 'Ghi chú'];
  for (const r of rows) {
    const n = nganh.find((x) => x.ma === r.nganh);
    ws.addRow([r.gia_tri_goc, n ? n.ten : r.nganh, Number(r.so_dong) || r.so_dong, r.linh_vuc_de_xuat, r.linh_vuc_chot, r.ghi_chu]);
  }
  const dm = wb.addWorksheet('DanhMuc');
  dm.addRow(['Mã ngành', 'Tên ngành']);
  for (const n of nganh) dm.addRow([n.ma, n.ten]);
  await wb.xlsx.writeFile(path);
}
