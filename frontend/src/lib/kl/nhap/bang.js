// Từ ma trận một sheet (xlsx-doc.js) + dòng tiêu đề + ghép cột → các dòng dữ liệu đã chuẩn hoá (nhập Excel, v9 đợt 2). Thuần.
// Dòng dữ liệu = có nội dung, hoặc có mã việc kèm ít nhất một trường khác (bảng Phụ lục 2 để sẵn công thức STT / mã ở các dòng trống cuối bảng).
// Dữ liệu gốc = MỌI ô có giá trị của dòng theo tiêu đề cột (kể cả cột không ghép) — lưu cùng dòng nhập, hiện ở ngăn chi tiết.
import { truong } from './truong.js';
import { chuanGiaTri } from './chuan-hoa.js';

// Giá trị ô để hiển thị (ví dụ ở bước ghép cột, khối "Dữ liệu gốc"): ngày (xlsx-doc trả 'YYYY-MM-DD') → dd/mm/yyyy.
export const hienGoc = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).split('-').reverse().join('/') : String(v ?? ''));

// Tiêu đề cột hiển thị: ô tiêu đề (trống → "Cột AA" theo tên cột Excel), trùng tên thêm " (2)", " (3)"… — luôn khác nhau (khoá của dữ liệu gốc).
const tenCotExcel = (i) => (i >= 26 ? tenCotExcel(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
export function tieuDeCot(sheet, dongTieuDe) {
  const hang = sheet.dong[dongTieuDe] || []; const so = Math.max(hang.length, ...sheet.dong.slice(dongTieuDe + 1, dongTieuDe + 50).map((d) => d?.length || 0));
  const da = new Set();
  return Array.from({ length: so }, (_, i) => {
    const goc = String(hang[i] ?? '').replace(/\s+/g, ' ').trim() || `Cột ${tenCotExcel(i)}`;
    let t = goc; for (let n = 2; da.has(t); n++) t = `${goc} (${n})`;
    da.add(t); return t;
  });
}

// anhXa: { chỉ số cột: mã trường } → [{ soDong (số dòng Excel), raw: {k: giá trị}, goc: {tiêu đề: giá trị} }]
export function layDong(sheet, dongTieuDe, anhXa) {
  const td = tieuDeCot(sheet, dongTieuDe); const ra = [];
  for (let r = dongTieuDe + 1; r < sheet.dong.length; r++) {
    const hang = sheet.dong[r] || []; const raw = {}; const goc = {};
    hang.forEach((v, i) => {
      if (v === null || v === undefined || String(v).trim() === '') return;
      goc[td[i] || `Cột ${i + 1}`] = v;
      const k = anhXa[i]; if (k && raw[k] === undefined) raw[k] = v;
    });
    const khac = Object.keys(raw).filter((k) => k !== 'ma');
    if (raw.noi_dung !== undefined || (raw.ma !== undefined && khac.length > 0)) ra.push({ soDong: r + 1, raw, goc });
  }
  return ra;
}

// Chuẩn hoá một dòng: { soDong, goc, o: { k: {ma, hien, gan} | {loi, chon} } }. Lĩnh vực khớp trong ngành của chính dòng (nếu có).
export function chuanDong(dong, ctx) {
  const o = {};
  const thuTu = Object.keys(dong.raw).sort((a, b) => (a === 'linh_vuc') - (b === 'linh_vuc'));   // ngành trước lĩnh vực
  thuTu.forEach((k) => { o[k] = chuanGiaTri(truong(k)?.kieu, dong.raw[k], ctx, { nganh: o.nganh?.ma }); });
  return { soDong: dong.soDong, goc: dong.goc, raw: dong.raw, o };
}
