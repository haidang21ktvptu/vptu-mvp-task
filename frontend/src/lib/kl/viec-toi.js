// "Việc của tôi" dạng bảng (v3.25, mẫu Main 16/10/2026) — phần THUẦN (unit test frontend/tests/viec-toi.test.mjs): tám ô số (chọn một ô một
// lúc), "Việc cần làm" của từng dòng (việc đầu tiên áp dụng: xác nhận nhận việc → trả lời chỉ đạo → nộp minh chứng → cập nhật tiến độ), ba cách
// sắp xếp, nhóm theo văn bản giao (giữ thứ tự đang sắp). ctx = { me, chiDao(id) → chỉ đạo đang chờ tôi trả lời, deNghi(id) → đề nghị từ chối
// của tôi đang chờ duyệt }. Quyền thật ở DB — vị từ ở đây chỉ để đếm và hiện nút.
import { sapXepMoiNhap, sapXepHan } from './loc-them.js';

export const mo = (r) => r.tien_do_ma !== 'HOAN_THANH';
export const GAP = ['VANG', 'DO', 'DO_DAC_BIET'];   // Vàng / Đỏ / Đỏ đặc biệt
export const laCuaToi = (r, me) => Boolean(me) && (r.owner_tai_khoan === me || r.nguoi_theo_doi === me);
export const choNghiemThu = (r) => ['CHO_NGHIEM_THU', 'QUA_HAN_NGHIEM_THU'].includes(r.nhom_dem);
// Chính tôi chưa xác nhận nhận việc (chủ trì và người theo dõi mỗi người tự nhận; chỉ việc theo Công văn 1400).
export const chuaNhan = (r, me) => Boolean(r.theo_1400) && mo(r) && !r.toi_da_xac_nhan && laCuaToi(r, me) && !r.bi_tu_choi;
// Còn phải nộp minh chứng: việc theo 1400 đang mở, chưa có minh chứng hợp lệ, không chờ xác nhận minh chứng nộp trước v3.20.
export const canMinhChung = (r) => mo(r) && Boolean(r.theo_1400) && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r);
export const vaiCua = (r, me) => (r.owner_tai_khoan === me ? 'Chủ trì' : r.nguoi_theo_doi === me ? 'Theo dõi' : '');
const coChiDao = (r, c) => mo(r) && (c.chiDao?.(r.id) || []).length > 0;
const can = (r, c) => laCuaToi(r, c.me) && mo(r) && (Boolean(r.bi_tu_choi) || chuaNhan(r, c.me) || coChiDao(r, c)
  || r.minh_chung_buoc === 'BI_TRA_LAI' || (GAP.includes(r.muc_canh_bao) && !choNghiemThu(r)));

// Tám ô số theo mẫu: [khoá, tên, vị từ(dòng, ctx)]. "Cần xử lý" (mặc định): việc của tôi đang mở mà chưa nhận, có chỉ đạo chờ trả lời, minh
// chứng bị trả lại, Vàng / Đỏ / Đỏ đặc biệt, hoặc bị từ chối chờ giao lại.
export const O_SO = [
  ['can', 'Cần xử lý', can],
  ['nhan', 'Chưa xác nhận nhận việc', (r, c) => chuaNhan(r, c.me)],
  ['chiDao', 'Chỉ đạo chờ trả lời', coChiDao],
  ['sap', 'Sắp đến hạn', (r) => mo(r) && r.muc_canh_bao === 'VANG'],
  ['qua', 'Quá hạn', (r) => mo(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao)],
  ['mo', 'Đang thực hiện', (r) => mo(r)],
  ['xong', 'Đã hoàn thành', (r) => !mo(r)],
  ['tat', 'Tất cả', () => true],
];
const VI_TU = Object.fromEntries(O_SO.map(([k, , f]) => [k, f]));
export const locO = (rows, khoa, c) => rows.filter((r) => (VI_TU[khoa] || VI_TU.tat)(r, c));
export const demO = (rows, c) => Object.fromEntries(O_SO.map(([k, , f]) => [k, rows.filter((r) => f(r, c)).length]));

// Việc cần làm của một dòng: { ma, chinh } — ma: nhan | tra-loi | nop | cap-nhat | cho-giao-lai | cho-duyet | '' (không có việc chờ / không
// phải việc của tôi — chỉ xem); chinh = nút màu chính (việc gấp). Việc ngoài phạm vi xử lý (chỉ xem) do màn hình loại trước.
export function viecCanLam(r, c) {
  if (!mo(r) || !laCuaToi(r, c.me)) return { ma: '', chinh: false };
  if (r.bi_tu_choi) return { ma: 'cho-giao-lai', chinh: false };
  if (c.deNghi?.(r.id)) return { ma: 'cho-duyet', chinh: false };
  if (chuaNhan(r, c.me)) return { ma: 'nhan', chinh: true };
  if (coChiDao(r, c)) return { ma: 'tra-loi', chinh: true };
  if (canMinhChung(r)) return { ma: 'nop', chinh: GAP.includes(r.muc_canh_bao) || r.minh_chung_buoc === 'BI_TRA_LAI' };
  return { ma: 'cap-nhat', chinh: false };
}

// Sắp xếp: mới giao trước (thời điểm lên hệ thống — như màn Nhiệm vụ), hạn gần trước, mức cảnh báo (Đỏ đặc biệt → Đỏ → Vàng → trong hạn; việc
// đã hoàn thành cuối; cùng mức thì hạn gần trước, rồi theo mã).
const HANG = { DO_DAC_BIET: 0, DO: 1, VANG: 2, XANH: 3 };
const soMa = new Intl.Collator('vi', { numeric: true }).compare;
export function sapXepMuc(rows) {
  const khoa = (r) => [mo(r) ? 0 : 1, HANG[r.muc_canh_bao] ?? 4, r.han_xu_ly ? 0 : 1, r.han_xu_ly || ''];
  return [...rows].map((r) => [khoa(r), r]).sort(([a, ra], [b, rb]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return soMa(ra.ma || '', rb.ma || '');
  }).map(([, r]) => r);
}
export const SAP_XEP_VIEC = [['moi', 'mới giao trước', sapXepMoiNhap], ['han', 'hạn gần trước', sapXepHan], ['muc', 'mức cảnh báo', sapXepMuc]];
export const sapXepViec = (rows, sx) => (SAP_XEP_VIEC.find(([k]) => k === sx)?.[2] || sapXepMoiNhap)(rows);

// Nhóm theo văn bản giao, giữ thứ tự đang sắp (văn bản của dòng đầu tiên lên trước): [{ khoa, r (dòng đại diện), rows }].
export function nhomGiuThuTu(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.van_ban_id || 'khong'; if (!m.has(k)) m.set(k, { khoa: k, r, rows: [] }); m.get(k).rows.push(r); });
  return [...m.values()];
}
