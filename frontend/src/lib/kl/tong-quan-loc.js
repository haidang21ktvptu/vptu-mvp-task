// Tổng quan (giao diện v9 đợt 2): bấm một số / cột / đoạn / dòng → danh sách đúng các việc làm nên con số đó, mở ngay trong ngăn chi tiết
// dùng chung (views/shared/ngan-chi-tiet.js) — cùng quy ước đếm với lib/kl/tong-quan.js nên tổng của danh sách luôn bằng con số đã bấm.
// ct (chỉ tiêu, do template gắn vào data-ct): { t: 'giao'|'xong'|'mo'|'canh'|'do'|'muc'|'dg'|'thang'|'nhom'|'vb'|'lv'|'cl'|'traLai'|'cd', … }.
// Trả { tieuDe, rows } hoặc { tieuDe, nhom: [{ ten, rows }] }. Thuần (không DOM, không Supabase); unit test ở frontend/tests/tong-quan.test.mjs.
import { ngayGiao, laMo, laXong, xongTrongKy, mucMo, chiDaoPhan } from './tong-quan.js';
import { loaiCua } from './tong-quan-them.js';
import { CHUA_PHAN_LOAI } from './tong-hop.js';

export const TEN_MUC = { trongHan: 'Đang thực hiện, trong hạn', nt: 'Chờ nghiệm thu', vang: 'Cảnh báo Vàng', do: 'Cảnh báo Đỏ', ddb: 'Cảnh báo Đỏ đặc biệt',
  khac: 'Không áp dụng cảnh báo (cần điền hạn, chờ điều kiện, đang đính chính)' };
const TEN_DG = { DUNG_HAN: 'Hoàn thành đúng hạn', TRE: 'Hoàn thành trễ hạn', chua: 'Hoàn thành, chưa đánh giá đúng hạn' };
const TEN_CL = { DAT_XUAT_SAC: 'Xuất sắc', DAT_TOT: 'Đạt tốt', DAT: 'Đạt', KHONG_DAT: 'Không đạt' };
const TEN_CD = { banHanh: 'Việc có ý kiến chỉ đạo', daPhanHoi: 'Việc có chỉ đạo đã phản hồi', dangCho: 'Việc có chỉ đạo đang chờ phản hồi',
  quaHan: 'Việc có chỉ đạo quá hạn phản hồi' };
const pad = (n) => String(n).padStart(2, '0');
const coDanhGia = (r) => r.ket_qua === 'DUNG_HAN' || r.ket_qua === 'TRE';
const trongKy = (d, k) => Boolean(d) && d >= k.tu && d <= k.den;
const trongThang = (d, y, m) => Boolean(d) && d.slice(0, 7) === `${y}-${pad(m)}`;
const moVaXong = (ds, k) => [{ ten: 'Đang thực hiện', rows: ds.filter(laMo) }, { ten: `Hoàn thành ${k.trong}`, rows: ds.filter((r) => xongTrongKy(r, k)) }];

// khoa: hàm gom nhóm của bảng theo phòng / đơn vị / cán bộ (khoaNhom); cds + ctxCd: chỉ đạo và vai (chiDaoPhan); homNay 'YYYY-MM-DD' (năm của
// biểu đồ tháng, mốc "quá hạn phản hồi") — màn hình truyền homNayVN().
export function locChiTieu(rows, ct, k, { khoa = null, cds = [], ctxCd = {}, homNay = k.tu } = {}) {
  const xong = () => rows.filter((r) => xongTrongKy(r, k));
  switch (ct.t) {
    case 'giao': return { tieuDe: `Nhiệm vụ giao ${k.trong}`, rows: rows.filter((r) => trongKy(ngayGiao(r), k)) };
    case 'xong': return { tieuDe: `Hoàn thành ${k.trong}`, rows: xong() };
    case 'mo': return { tieuDe: 'Nhiệm vụ đang thực hiện', rows: rows.filter(laMo) };
    case 'canh': return { tieuDe: 'Việc có cảnh báo Vàng, Đỏ, Đỏ đặc biệt', rows: rows.filter((r) => laMo(r) && ['vang', 'do', 'ddb'].includes(mucMo(r))) };
    case 'do': return { tieuDe: 'Việc Đỏ, Đỏ đặc biệt cần chỉ đạo', rows: rows.filter((r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r))) };
    case 'muc': return { tieuDe: TEN_MUC[ct.m] || 'Nhiệm vụ đang thực hiện', rows: rows.filter((r) => laMo(r) && mucMo(r) === ct.m) };
    case 'dg': {
      const x = xong();
      if (!ct.kq) return { tieuDe: `Hoàn thành được đánh giá ${k.trong}`, nhom: [{ ten: 'Trễ hạn', rows: x.filter((r) => r.ket_qua === 'TRE') }, { ten: 'Đúng hạn', rows: x.filter((r) => r.ket_qua === 'DUNG_HAN') }] };
      return { tieuDe: `${TEN_DG[ct.kq] || TEN_DG.DUNG_HAN} ${k.trong}`, rows: ct.kq === 'chua' ? x.filter((r) => !coDanhGia(r)) : x.filter((r) => r.ket_qua === ct.kq) };
    }
    case 'thang': {
      const y = Number(String(homNay).slice(0, 4));
      return { tieuDe: `Tháng ${ct.th}/${y}`, nhom: [
        { ten: 'Giao mới', rows: rows.filter((r) => trongThang(ngayGiao(r), y, ct.th)) },
        { ten: 'Hoàn thành', rows: rows.filter((r) => r.nhom_dem === 'HOAN_THANH' && trongThang(r.ngay_hoan_thanh, y, ct.th)) }] };
    }
    case 'nhom': {
      const cua = khoa ? rows.filter((r) => khoa(r)[0] === ct.ma) : [];
      if (ct.m) return { tieuDe: `${ct.ten || 'Nhóm'} — ${TEN_MUC[ct.m] || ''}`, rows: cua.filter((r) => laMo(r) && mucMo(r) === ct.m) };
      return { tieuDe: ct.ten || 'Nhóm', nhom: moVaXong(cua, k) };
    }
    case 'vb': {
      const cua = rows.filter((r) => r.van_ban_id === ct.id);
      return { tieuDe: `Văn bản ${ct.ten || ''}`.trim(), nhom: [{ ten: 'Đang thực hiện', rows: cua.filter(laMo) }, { ten: 'Đã hoàn thành', rows: cua.filter((r) => r.nhom_dem === 'HOAN_THANH') }] };
    }
    case 'loai': {   // Đợt C1: khối Theo loại văn bản — số bấm là TỔNG mọi kỳ nên danh sách gồm cả việc không mở, không xong (thường xuyên, chờ điều kiện…)
      const cua = rows.filter((r) => loaiCua(r) === ct.ma);
      return { tieuDe: `Loại văn bản: ${ct.ten || ''}`.trim(), nhom: [{ ten: 'Đang thực hiện', rows: cua.filter(laMo) }, { ten: 'Đã hoàn thành (mọi kỳ)', rows: cua.filter(laXong) },
        { ten: 'Khác (thường xuyên, chờ điều kiện, không áp dụng)', rows: cua.filter((r) => !laMo(r) && !laXong(r)) }] };
    }
    case 'lv': return { tieuDe: `Lĩnh vực ${ct.ten || ''} — đang thực hiện`, rows: rows.filter((r) => laMo(r) && (ct.ma === CHUA_PHAN_LOAI ? !r.linh_vuc_ma : r.linh_vuc_ma === ct.ma)) };
    case 'cl': return { tieuDe: `Nghiệm thu “${TEN_CL[ct.cl] || ''}” ${k.trong}`, rows: xong().filter((r) => r.chat_luong === ct.cl) };
    case 'traLai': return { tieuDe: `Việc bị trả lại để bổ sung ${k.trong}`, rows: xong().filter((r) => (r.so_lan_tra_lai || 0) > 0) };
    case 'cd': {   // một việc có thể có nhiều ý kiến chỉ đạo: danh sách là các VIỆC, tách phần để thấy ngay việc nào quá hạn / chưa phản hồi
      const p = chiDaoPhan(cds, k, ctxCd, new Date(`${homNay}T05:00:00Z`));   // "quá hạn phản hồi" tính tới hôm nay (12 giờ trưa giờ Việt Nam)
      const cua = (ds) => { const ids = new Set(ds.map((c) => c.nhiem_vu_id)); return rows.filter((r) => ids.has(r.id)); };
      const tieuDe = `${TEN_CD[ct.loai] || TEN_CD.banHanh} ${k.trong}`;
      if (ct.loai === 'dangCho') {
        const qh = new Set(p.quaHan);
        return { tieuDe, nhom: [{ ten: 'Quá hạn phản hồi', rows: cua(p.quaHan) }, { ten: 'Trong hạn phản hồi', rows: cua(p.dangCho.filter((c) => !qh.has(c))) }] };
      }
      if (ct.loai === 'banHanh') {
        const cho = new Set(p.dangCho);
        return { tieuDe, nhom: [{ ten: 'Đang chờ phản hồi', rows: cua(p.dangCho) }, { ten: 'Đã phản hồi hoặc đã đóng', rows: cua(p.banHanh.filter((c) => !cho.has(c))) }] };
      }
      return { tieuDe, rows: cua(p[ct.loai] || []) };
    }
    default: return { tieuDe: 'Nhiệm vụ', rows: [] };
  }
}
