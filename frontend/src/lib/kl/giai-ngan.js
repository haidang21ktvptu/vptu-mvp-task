// Giải ngân vốn đầu tư công (v3.28, migration 0119): phép tính dùng chung cho Tổng quan và ngăn chi tiết — tỷ lệ %, tiến độ đều tới mục tiêu riêng của
// nhiệm vụ, mức (đạt / đúng tiến độ / chậm / chậm nhiều), số liệu cũ, kiểm tra một kỳ (lệch tổng, lũy kế giảm…), số của nhiệm vụ lấy từ kỳ mới nhất có
// đối tượng đó. Hàm thuần, không gọi DB, không DOM. Mức tính theo NGÀY SỐ LIỆU (số liệu cũ không bị coi là chậm hơn thực tế); chưa đạt khi số liệu đã
// tới mốc = chậm nhiều. Số tiền tính bằng tỷ đồng (như DB).
import { soNgay, formatNgay } from './ngay.js';

export const NGUONG_CHAM = 10;         // thiếu hơn 10 điểm % so với tiến độ đều → chậm
export const NGUONG_CHAM_NHIEU = 20;   // thiếu hơn 20 điểm %, hoặc số liệu đã tới mốc mà chưa đạt → chậm nhiều
export const NGAY_CU = 45;             // báo cáo tháng thường có sau 5–10 ngày: quá 45 ngày = đã thiếu một kỳ báo cáo → nhắc cập nhật
export const TEN_LOAI = { TOAN_TINH: 'Số liệu toàn tỉnh', NGUON: 'Nguồn vốn', CHU_DAU_TU: 'Chủ đầu tư, đơn vị' };
export const LOP_MUC = { DAT: 'gn-dat', DUNG: 'gn-dung', CHAM: 'gn-cham', CHAM_NHIEU: 'gn-cham-nhieu', CHUA_CO: 'gn-chua' };
const THU_TU_MUC = { CHAM_NHIEU: 0, CHAM: 1, CHUA_CO: 2, DUNG: 3, DAT: 4 };
const coSo = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const tron1 = (x) => Math.round(x * 10) / 10;
const tron3 = (x) => Math.round(x * 1000) / 1000;
const theoNgay = (a, b) => (a.ngay_so_lieu < b.ngay_so_lieu ? -1 : a.ngay_so_lieu > b.ngay_so_lieu ? 1 : 0);
export const khoaDoiTuong = (loai, tenChuan) => `${loai}|${tenChuan || ''}`;
export const mocMacDinh = (nam) => `${nam}-12-31`;

// Số kiểu Việt Nam: 2054.516 → '2.054,516' (tối đa `le` chữ số thập phân); không phải số → '—'. soCoDau: +12,5 / −3,2 (chênh lệch).
export const soVN = (x, le = 3) => (coSo(x) ? Number(x).toLocaleString('vi-VN', { maximumFractionDigits: le }) : '—');
export const soCoDau = (x, le = 3) => (Number(x) > 0 ? `+${soVN(x, le)}` : Number(x) < 0 ? `−${soVN(-Number(x), le)}` : '0');
export const ptVN = (p) => (coSo(p) ? `${soVN(p, 1)}%` : '—');
// Tỷ lệ % (một chữ số thập phân); kế hoạch không dương hoặc thiếu số → null.
export const tyLe = (da, kh) => (coSo(da) && Number(kh) > 0 ? tron1((Number(da) / Number(kh)) * 100) : null);

// Người được ghi (như kl_nguoi_nhap: không Thường trực, không tài khoản khoá / hệ thống) — chỉ để ẩn / hiện nút; hàm DB là chốt.
export const nguoiNhap = (u) => Boolean(u) && u.role_group !== 'A0' && !u.bi_khoa && !u.is_system;
// Nhập / xoá kỳ số liệu (gn_duoc_nhap_ky): lãnh đạo Văn phòng (cả toàn quyền), hoặc chủ trì / người theo dõi việc "Số liệu toàn tỉnh" của năm.
export const duocNhapKy = (u, rowTt) => nguoiNhap(u) && (u.role_group === 'A1' || (Boolean(rowTt) && [rowTt.owner_tai_khoan, rowTt.nguoi_theo_doi].includes(u.id)));

// Năm kế hoạch vốn hiển thị: tháng 1 vẫn là năm trước (kế hoạch vốn năm được giải ngân tới 31/1 năm sau).
export function namHienThi(homNay) {
  const [y, m] = homNay.split('-').map(Number);
  return m === 1 ? y - 1 : y;
}

// Tiến độ đều tại `ngay` (số liệu "đến hết ngày" — tính cả ngày đầu, ngày cuối): mục tiêu × số ngày từ 1/1 / số ngày từ 1/1 tới mốc; từ mốc: = mục tiêu.
export function canDatTai(ngay, { nam, mucTieuPt = 100, mucTieuNgay }) {
  const dau = `${nam}-01-01`; const tong = soNgay(dau, mucTieuNgay || mocMacDinh(nam)) + 1; const da = soNgay(dau, ngay) + 1;
  if (da >= tong) return Number(mucTieuPt);
  return da <= 0 ? 0 : (Number(mucTieuPt) * da) / tong;
}

// Mức của một đối tượng → { muc, pt, canDat, thieu (điểm %), quaMoc, moc, mucTieu, cu, soNgayCu }; muc: CHUA_CO | DAT | DUNG | CHAM | CHAM_NHIEU.
// Mọi phép so trên số đã làm tròn một chữ số như số hiện ra (tiến độ đều 58,1% − đạt 24,2% = thiếu 33,9 điểm) để người đọc tự cộng trừ khớp.
export function mucGiaiNgan({ da, kh, ngaySoLieu, nam, mucTieuPt = 100, mucTieuNgay, homNay }) {
  if (!coSo(da) || !(Number(kh) > 0) || !ngaySoLieu) return { muc: 'CHUA_CO', pt: null };
  const pt = tron1((Number(da) / Number(kh)) * 100); const mucTieu = Number(mucTieuPt) || 100; const moc = mucTieuNgay || mocMacDinh(nam);
  const soNgayCu = homNay ? Math.max(0, soNgay(ngaySoLieu, homNay)) : 0;
  const canDat = tron1(canDatTai(ngaySoLieu, { nam, mucTieuPt: mucTieu, mucTieuNgay: moc }));
  // Nhắc "cần kỳ mới" chỉ khi còn kỳ để nhập: số liệu chưa tới mốc và chưa qua hạn giải ngân kế hoạch vốn năm (31/1 năm sau).
  const conKy = ngaySoLieu < moc && (!homNay || homNay <= `${Number(nam) + 1}-01-31`);
  const chung = { pt, canDat, mucTieu, moc, ngay: ngaySoLieu, cu: soNgayCu > NGAY_CU && conKy, soNgayCu };
  if (pt >= mucTieu) return { ...chung, muc: 'DAT', thieu: 0, quaMoc: false };
  const quaMoc = ngaySoLieu >= moc; const thieu = tron1(canDat - pt);
  const muc = quaMoc || thieu > NGUONG_CHAM_NHIEU ? 'CHAM_NHIEU' : thieu > NGUONG_CHAM ? 'CHAM' : 'DUNG';
  return { ...chung, muc, thieu: Math.max(0, thieu), quaMoc };
}

// Chữ của mức — không dùng "Vàng / Đỏ" (đã là cảnh báo hạn của nhiệm vụ).
export function nhanMuc(m) {
  const so = soVN(m?.thieu ?? 0, 1);
  switch (m?.muc) {
    case 'DAT': return 'Đạt mục tiêu';
    case 'DUNG': return 'Đúng tiến độ';
    case 'CHAM': return `Chậm ${so} điểm %`;
    case 'CHAM_NHIEU': return m.quaMoc ? `Đến mốc ${formatNgay(m.moc)} còn thiếu ${so} điểm %` : `Chậm nhiều ${so} điểm %`;
    default: return 'Chưa có số liệu';
  }
}
// Câu giải thích mức (dưới chip): tiến độ đều tại ngày số liệu và mục tiêu.
export const moTaMuc = (m) => (m?.muc && m.muc !== 'CHUA_CO'
  ? `Tiến độ đều đến ${formatNgay(m.ngay)}: ${ptVN(m.canDat)} — mục tiêu ${ptVN(m.mucTieu)} kế hoạch vốn trước ${formatNgay(m.moc)}` : '');

const lechCua = (ky, ds) => {
  const tongKh = tron3(ds.reduce((t, d) => t + (Number(d.ke_hoach) || 0), 0)); const tongDa = tron3(ds.reduce((t, d) => t + (Number(d.da_giai_ngan) || 0), 0));
  const lechKh = tron3(tongKh - Number(ky.ke_hoach || 0)); const lechDa = tron3(tongDa - Number(ky.da_giai_ngan || 0));
  const choPhep = Math.max(0.001, 0.0005 * ds.length);   // báo cáo làm tròn từng dòng
  return { soDong: ds.length, tongKh, tongDa, lechKh, lechDa, choPhep, lech: Math.abs(lechKh) > choPhep || Math.abs(lechDa) > choPhep };
};
// Lệch giữa tổng các dòng một loại và số tổng của kỳ; null khi kỳ không có dòng loại đó.
export function lechTong(ky, dong, loai) {
  const ds = dong.filter((d) => d.loai === loai);
  return ds.length ? lechCua(ky, ds) : null;
}

// Kiểm tra một kỳ (đang nhập hoặc đã lưu) so với các kỳ khác cùng năm → cảnh báo (vẫn cho ghi): lệch tổng theo loại, đã giải ngân vượt kế hoạch,
// lũy kế thấp hơn kỳ trước / cao hơn kỳ sau, kế hoạch vốn đổi so với kỳ trước (ghi chú để đọc đúng tỷ lệ).
export function kiemTraKy(ky, dong, dsKy = []) {
  const kq = [];
  for (const [loai, ten] of [['NGUON', 'các nguồn vốn'], ['CHU_DAU_TU', 'các chủ đầu tư, đơn vị']]) {
    const l = lechTong(ky, dong, loai);
    const phan = l?.lech ? [Math.abs(l.lechKh) > l.choPhep ? `kế hoạch ${soCoDau(l.lechKh)}` : '', Math.abs(l.lechDa) > l.choPhep ? `đã giải ngân ${soCoDau(l.lechDa)}` : ''].filter(Boolean) : [];
    if (phan.length) kq.push(`Tổng ${ten} (${l.soDong} dòng) lệch số tổng của kỳ: ${phan.join(', ')} tỷ đồng.`);
  }
  if (Number(ky.da_giai_ngan) > Number(ky.ke_hoach)) kq.push('Số đã giải ngân lớn hơn kế hoạch vốn năm — kiểm tra lại hai số tổng.');
  const khac = dsKy.filter((k) => k.ngay_so_lieu !== ky.ngay_so_lieu).sort(theoNgay);
  const truoc = khac.filter((k) => k.ngay_so_lieu < ky.ngay_so_lieu).at(-1); const sau = khac.find((k) => k.ngay_so_lieu > ky.ngay_so_lieu);
  if (truoc && Number(ky.da_giai_ngan) < Number(truoc.da_giai_ngan)) kq.push(`Lũy kế đã giải ngân thấp hơn kỳ đến ${formatNgay(truoc.ngay_so_lieu)} (${soVN(truoc.da_giai_ngan)} tỷ đồng) — kiểm tra lại số hoặc căn cứ.`);
  if (sau && Number(ky.da_giai_ngan) > Number(sau.da_giai_ngan)) kq.push(`Lũy kế đã giải ngân cao hơn kỳ sau đến ${formatNgay(sau.ngay_so_lieu)} (${soVN(sau.da_giai_ngan)} tỷ đồng).`);
  if (truoc && Math.abs(Number(ky.ke_hoach) - Number(truoc.ke_hoach)) >= 0.001) kq.push(`Kế hoạch vốn năm đổi từ ${soVN(truoc.ke_hoach)} thành ${soVN(ky.ke_hoach)} tỷ đồng so với kỳ đến ${formatNgay(truoc.ngay_so_lieu)} — tỷ lệ hai kỳ tính trên hai mẫu số khác nhau.`);
  return kq;
}

// Cả năm cho Tổng quan / ngăn chi tiết: d = { nam, ky, dong, gan } (giai-ngan-db.js docNam) → kỳ mới nhất, mức toàn tỉnh theo mục tiêu của việc
// "Số liệu toàn tỉnh" (không có: 100% trước 31/12), điểm biểu đồ, bảng nguồn vốn / chủ đầu tư của kỳ mới nhất (chủ đầu tư: tỷ lệ thấp trước), số mới
// nhất của từng đối tượng (kỳ mới nhất có dòng đó), cảnh báo của kỳ mới nhất.
export function tongHopNam({ nam, ky = [], dong = [], gan = [] }, homNay) {
  const dsKy = [...ky].sort(theoNgay); const moi = dsKy.at(-1) || null;
  const tt = gan.find((g) => g.loai === 'TOAN_TINH' && g.nam === nam) || null;
  const mucTieu = { nam, mucTieuPt: tt?.muc_tieu_pt ?? 100, mucTieuNgay: tt?.muc_tieu_ngay || mocMacDinh(nam) };
  const muc = moi ? mucGiaiNgan({ da: moi.da_giai_ngan, kh: moi.ke_hoach, ngaySoLieu: moi.ngay_so_lieu, ...mucTieu, homNay }) : { muc: 'CHUA_CO', pt: null };
  const diem = dsKy.map((k) => ({ id: k.id, ngay: k.ngay_so_lieu, pt: tyLe(k.da_giai_ngan, k.ke_hoach), uoc: Boolean(k.uoc_tinh), da: k.da_giai_ngan, kh: k.ke_hoach,
    canDat: tron1(canDatTai(k.ngay_so_lieu, mucTieu)) }));
  const dongMoi = moi ? dong.filter((x) => x.ky_id === moi.id) : [];
  const ptCua = (x) => tyLe(x.da_giai_ngan, x.ke_hoach) ?? Infinity;
  const nguon = dongMoi.filter((x) => x.loai === 'NGUON').sort((a, b) => a.thu_tu - b.thu_tu);
  const chuDauTu = dongMoi.filter((x) => x.loai === 'CHU_DAU_TU').sort((a, b) => ptCua(a) - ptCua(b) || a.thu_tu - b.thu_tu);
  const theoId = new Map(dsKy.map((k) => [k.id, k])); const doiTuong = new Map();
  for (const x of dong) {
    const k = theoId.get(x.ky_id); const key = khoaDoiTuong(x.loai, x.ten_chuan); const cu = doiTuong.get(key);
    if (k && (!cu || cu.ky.ngay_so_lieu < k.ngay_so_lieu)) doiTuong.set(key, { dong: x, ky: k });
  }
  return { nam, ky: dsKy, moi, tt, mucTieu, muc, diem, nguon, chuDauTu, doiTuong, canhBao: moi ? kiemTraKy(moi, dongMoi, dsKy) : [] };
}

// Số của một nhiệm vụ theo dõi (gn_nhiem_vu) trong tổng hợp năm: toàn tỉnh = số tổng kỳ mới nhất; nguồn vốn / chủ đầu tư = dòng mới nhất cùng tên.
export function soCuaNhiemVu(g, th) {
  if (!g || !th || g.nam !== th.nam) return null;
  if (g.loai === 'TOAN_TINH') return th.moi ? { da: th.moi.da_giai_ngan, kh: th.moi.ke_hoach, ngay: th.moi.ngay_so_lieu, ky: th.moi } : null;
  const x = th.doiTuong.get(khoaDoiTuong(g.loai, g.ten_chuan));
  return x ? { da: x.dong.da_giai_ngan, kh: x.dong.ke_hoach, ngay: x.ky.ngay_so_lieu, ky: x.ky, ten: x.dong.ten } : null;
}
// Mức của nhiệm vụ theo dõi (mục tiêu riêng của nó).
export function mucCuaNhiemVu(g, th, homNay) {
  const s = soCuaNhiemVu(g, th);
  return s ? mucGiaiNgan({ da: s.da, kh: s.kh, ngaySoLieu: s.ngay, nam: g.nam, mucTieuPt: g.muc_tieu_pt, mucTieuNgay: g.muc_tieu_ngay, homNay }) : { muc: 'CHUA_CO', pt: null };
}
// Diễn biến của đối tượng qua các kỳ (cũ trước): [{ ky, da, kh, pt, canDat }].
export function dienBienDoiTuong(g, th, dong = []) {
  if (!g || !th) return [];
  const mt = { nam: g.nam, mucTieuPt: g.muc_tieu_pt, mucTieuNgay: g.muc_tieu_ngay };
  const ds = g.loai === 'TOAN_TINH' ? th.ky.map((k) => ({ ky: k, da: k.da_giai_ngan, kh: k.ke_hoach }))
    : th.ky.map((k) => { const x = dong.find((d) => d.ky_id === k.id && d.loai === g.loai && d.ten_chuan === g.ten_chuan); return x && { ky: k, da: x.da_giai_ngan, kh: x.ke_hoach }; }).filter(Boolean);
  return ds.map((x) => ({ ...x, pt: tyLe(x.da, x.kh), canDat: tron1(canDatTai(x.ky.ngay_so_lieu, mt)) }));
}

// Nhiệm vụ theo dõi giải ngân trong tập việc đang xem (rows, đã qua thanh lọc) → [{ r, g, s, m }], chậm nặng trước.
export function viecTheoDoi(rows, gan, th, homNay) {
  const theoViec = new Map(gan.filter((g) => g.nam === th.nam).map((g) => [g.nhiem_vu_id, g]));
  return rows.filter((r) => theoViec.has(r.id)).map((r) => { const g = theoViec.get(r.id); return { r, g, s: soCuaNhiemVu(g, th), m: mucCuaNhiemVu(g, th, homNay) }; })
    .sort((a, b) => THU_TU_MUC[a.m.muc] - THU_TU_MUC[b.m.muc] || (b.m.thieu || 0) - (a.m.thieu || 0) || String(a.r.ma).localeCompare(String(b.r.ma), 'vi', { numeric: true }));
}
// Đơn vị dưới mức chung của tỉnh (tô màu ở bảng chủ đầu tư).
export const duoiMucChung = (d, ptTinh) => ptTinh !== null && ptTinh !== undefined && (tyLe(d.da_giai_ngan, d.ke_hoach) ?? Infinity) < ptTinh;
