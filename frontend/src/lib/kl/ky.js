// Xuất Excel theo kỳ (v3.16): khoảng ngày của tuần ISO / tháng / quý / năm do người dùng chọn, phân loại việc theo kỳ và bảng tổng hợp
// theo phòng / đơn vị. Cùng quy ước với màn Tổng quan (lib/kl/tong-quan.js): giao = ngày nhận văn bản (hoặc ngày ban hành, ngày tạo);
// hoàn thành = ngày hoàn thành; đến hạn = hạn hoàn thành; còn mở cuối kỳ = giao không sau ngày cuối kỳ và chưa xong (hoặc xong sau kỳ).
// Thuần, không DOM — unit test frontend/tests/ky.test.mjs.
import { ngayGiao, laXong } from './tong-quan.js';
import { congNgay, formatNgay } from './ngay.js';
import { DEPT_NAMES } from '../constants.js';
import { boSoThuTu } from './nhan.js';

const SO_LA_MA = ['I', 'II', 'III', 'IV'];
const pad = (n) => String(n).padStart(2, '0');
const cuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const tach = (s) => s.split('-').map(Number);
// Thứ trong tuần theo ISO (thứ Hai = 1 … Chủ nhật = 7) của 'YYYY-MM-DD'.
const thuIso = (s) => { const [y, m, d] = tach(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7; };

// Số tuần ISO 8601 (tuần bắt đầu thứ Hai, tuần 1 chứa ngày 4/1) của một ngày → { nam, tuan }.
export function tuanIso(ngay) {
  const [y, m, d] = tach(ngay);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // thứ Năm cùng tuần quyết định năm ISO
  const nam = t.getUTCFullYear();
  const tuan = Math.ceil(((t - Date.UTC(nam, 0, 1)) / 86400000 + 1) / 7);
  return { nam, tuan };
}

// Khoảng ngày của kỳ đã chọn: { ky, tu, den, ten, ma }. tuan: theo một ngày bất kỳ trong tuần; thang/quy/nam: theo số + năm.
export function khoangKyChon({ ky, ngay, nam, thang, quy }) {
  if (ky === 'tuan') {
    const tu = congNgay(ngay, 1 - thuIso(ngay)); const den = congNgay(tu, 6); const { nam: n, tuan } = tuanIso(ngay);
    return { ky, tu, den, ten: `Tuần ${tuan}/${n} (${formatNgay(tu)} – ${formatNgay(den)})`, ma: `tuan-${n}-${pad(tuan)}` };
  }
  const y = Number(nam);
  if (ky === 'thang') { const m = Number(thang); return { ky, tu: `${y}-${pad(m)}-01`, den: `${y}-${pad(m)}-${pad(cuoiThang(y, m))}`, ten: `Tháng ${m}/${y}`, ma: `thang-${y}-${pad(m)}` }; }
  if (ky === 'quy') {
    const q = Number(quy); const m1 = q * 3 - 2; const m3 = q * 3;
    return { ky, tu: `${y}-${pad(m1)}-01`, den: `${y}-${pad(m3)}-${pad(cuoiThang(y, m3))}`, ten: `Quý ${SO_LA_MA[q - 1]}/${y}`, ma: `quy-${y}-${q}` };
  }
  return { ky: 'nam', tu: `${y}-01-01`, den: `${y}-12-31`, ten: `Năm ${y}`, ma: `nam-${y}` };
}

const trong = (d, k) => Boolean(d) && d >= k.tu && d <= k.den;
export const giaoTrongKy = (r, k) => trong(ngayGiao(r), k);
export const xongTrongKy = (r, k) => laXong(r) && trong(r.ngay_hoan_thanh, k);
export const denHanTrongKy = (r, k) => trong(r.han_xu_ly, k);
// Còn mở tại ngày cuối kỳ: đã giao không sau cuối kỳ, và chưa xong hoặc xong sau cuối kỳ (việc xong không ghi ngày hoàn thành coi là đã xong).
export function moCuoiKy(r, k) {
  const g = ngayGiao(r);
  if (!g || g > k.den) return false;
  if (!laXong(r)) return true;
  return Boolean(r.ngay_hoan_thanh) && r.ngay_hoan_thanh > k.den;
}
export const quaHanCuoiKy = (r, k) => moCuoiKy(r, k) && Boolean(r.han_xu_ly) && r.han_xu_ly < k.den;

// Bốn danh sách của kỳ (mỗi việc có thể nằm ở nhiều danh sách), xếp theo mã.
export function phanLoaiTheoKy(rows, k) {
  const sx = (ds) => [...ds].sort((a, b) => String(a.ma).localeCompare(String(b.ma), 'vi', { numeric: true }));
  return {
    giao: sx(rows.filter((r) => giaoTrongKy(r, k))), xong: sx(rows.filter((r) => xongTrongKy(r, k))),
    denHan: sx(rows.filter((r) => denHanTrongKy(r, k))), mo: sx(rows.filter((r) => moCuoiKy(r, k))),
  };
}

const tenDonVi = (r) => (r.owner_trong_van_phong && r.owner_phong ? DEPT_NAMES[r.owner_phong] || r.owner_phong : boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định');
const COT_TH = ['Phòng / đơn vị', 'Giao trong kỳ', 'Hoàn thành trong kỳ', 'Trong đó đúng hạn', 'Trong đó trễ hạn', 'Đến hạn trong kỳ', 'Còn mở cuối kỳ', 'Trong đó quá hạn'];

// Bảng tổng hợp theo phòng / đơn vị chủ trì + dòng Tổng cộng: { cot, dong }.
export function tongHopTheoKy(rows, k) {
  const m = new Map();
  const cong = (ten, cot) => { if (!m.has(ten)) m.set(ten, [0, 0, 0, 0, 0, 0, 0]); m.get(ten)[cot]++; };
  for (const r of rows) {
    const ten = tenDonVi(r);
    if (giaoTrongKy(r, k)) cong(ten, 0);
    if (xongTrongKy(r, k)) { cong(ten, 1); if (r.ket_qua === 'DUNG_HAN') cong(ten, 2); else if (r.ket_qua === 'TRE') cong(ten, 3); }
    if (denHanTrongKy(r, k)) cong(ten, 4);
    if (moCuoiKy(r, k)) { cong(ten, 5); if (quaHanCuoiKy(r, k)) cong(ten, 6); }
  }
  const dong = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([ten, so]) => [ten, ...so]);
  const tong = dong.reduce((t, d) => t.map((v, i) => (i ? v + d[i] : v)), ['Tổng cộng', 0, 0, 0, 0, 0, 0, 0]);
  return { cot: COT_TH, dong: [...dong, tong] };
}
