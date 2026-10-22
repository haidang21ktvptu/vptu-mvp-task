// Tổng quan (giao diện v9 đợt 2): bấm một số / cột / đoạn / dòng → danh sách đúng các việc làm nên con số đó, mở ngay trong ngăn chi tiết
// dùng chung (views/shared/ngan-chi-tiet.js) — cùng quy ước đếm với lib/kl/tong-quan.js nên tổng của danh sách luôn bằng con số đã bấm.
// ct (chỉ tiêu, do template gắn vào data-ct): { t: 'giao'|'xong'|'mo'|'canh'|'do'|'muc'|'dg'|'thang'|'nhom'|'vb'|'lv'|'cl'|'traLai'|'cd', … }.
// v3.24 (bố cục 9 khối): + 'nghen' (cấp), 'mt' / 'mtm' (mục tiêu, mức), 'khoi' (khối / ngành / chưa phân ngành), 'xh' (xếp hạng), 'quy', 'vm', 'cldl', 'loc'.
// Trả { tieuDe, rows } hoặc { tieuDe, nhom: [{ ten, rows }] }. Thuần (không DOM, không Supabase); unit test ở frontend/tests/tong-quan.test.mjs.
import { ngayGiao, ngayXong, laMo, laXong, laViecGoc, xongTrongKy, mucMo, chiDaoPhan } from './tong-quan.js';
import { loaiCua } from './tong-quan-them.js';
import { CHUA_PHAN_LOAI } from './tong-hop.js';
import { tenMuc } from './nhan.js';
import { mucTieuCua, HIEN_MUC_TIEU } from './muc-tieu.js';
import { doanCua, DOAN, dongCuaKhoi, diemNghen, locCapNghen, khoaXepHang, vuongMacCho, chatLuongDuLieu } from './tong-quan-lanh-dao.js';

// v3.29: mức cảnh báo ghi bằng nghĩa (tenMuc — số ngày theo cấu hình đã nạp, nên đọc lúc dùng).
export const TEN_MUC = { trongHan: 'Đang thực hiện, trong hạn', nt: 'Chờ xác nhận minh chứng (nộp trước v3.20)', get vang() { return `Nhiệm vụ ${tenMuc('vang')}`; },
  get do() { return `Nhiệm vụ ${tenMuc('do')}`; }, get ddb() { return `Nhiệm vụ ${tenMuc('ddb')}`; },
  khac: 'Không áp dụng cảnh báo (thường xuyên, cần điền hạn, chờ điều kiện, đang đính chính)' };
const TEN_DG = { DUNG_HAN: 'Hoàn thành đúng hạn', TRE: 'Hoàn thành trễ hạn', chua: 'Hoàn thành, chưa xét được đúng hạn (thiếu hạn hoặc ngày hoàn thành)' };
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
export function locChiTieu(rows, ct, k, { khoa = null, cds = [], ctxCd = {}, homNay = k.tu, nganhDm = [], linhVucDm = [] } = {}) {
  const xong = () => rows.filter((r) => xongTrongKy(r, k));
  switch (ct.t) {
    case 'giao': return { tieuDe: `Nhiệm vụ giao ${k.trong}`, rows: rows.filter((r) => trongKy(ngayGiao(r), k)) };
    case 'xong': return { tieuDe: `Hoàn thành ${k.trong}`, rows: xong() };
    case 'mo': return { tieuDe: 'Nhiệm vụ đang thực hiện', rows: rows.filter(laMo) };
    case 'canh': return { tieuDe: `Nhiệm vụ có cảnh báo: ${tenMuc('vang')}, quá hạn`, rows: rows.filter((r) => laMo(r) && ['vang', 'do', 'ddb'].includes(mucMo(r))) };
    case 'do': return { tieuDe: 'Nhiệm vụ quá hạn cần chỉ đạo', rows: rows.filter((r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r))) };
    case 'muc': return { tieuDe: TEN_MUC[ct.m] || 'Nhiệm vụ đang thực hiện', rows: rows.filter((r) => laMo(r) && mucMo(r) === ct.m) };
    case 'dg': {
      const x = xong();
      if (!ct.kq) return { tieuDe: `Hoàn thành xét được đúng hạn ${k.trong}`, nhom: [{ ten: 'Trễ hạn', rows: x.filter((r) => r.ket_qua === 'TRE') }, { ten: 'Đúng hạn', rows: x.filter((r) => r.ket_qua === 'DUNG_HAN') }] };
      return { tieuDe: `${TEN_DG[ct.kq] || TEN_DG.DUNG_HAN} ${k.trong}`, rows: ct.kq === 'chua' ? x.filter((r) => !coDanhGia(r)) : x.filter((r) => r.ket_qua === ct.kq) };
    }
    case 'thang': {
      const y = Number(String(homNay).slice(0, 4));
      return { tieuDe: `Tháng ${ct.th}/${y}`, nhom: [
        { ten: 'Giao mới', rows: rows.filter((r) => trongThang(ngayGiao(r), y, ct.th)) },
        { ten: 'Hoàn thành', rows: rows.filter((r) => laXong(r) && trongThang(ngayXong(r), y, ct.th)) }] };
    }
    case 'nhom': {
      const cua = khoa ? rows.filter((r) => khoa(r)[0] === ct.ma) : [];
      if (ct.m === 'qh') return { tieuDe: `${ct.ten || 'Nhóm'} — Quá hạn`, rows: cua.filter((r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r))) };   // v3.27: khối 2
      if (ct.m) return { tieuDe: `${ct.ten || 'Nhóm'} — ${TEN_MUC[ct.m] || ''}`, rows: cua.filter((r) => laMo(r) && mucMo(r) === ct.m) };
      return { tieuDe: ct.ten || 'Nhóm', nhom: moVaXong(cua, k) };
    }
    case 'vb': {
      const cua = rows.filter((r) => r.van_ban_id === ct.id && laViecGoc(r));   // như khối 6: chỉ việc giao từ văn bản
      return { tieuDe: `Văn bản ${ct.ten || ''}`.trim(), nhom: [{ ten: 'Đang thực hiện', rows: cua.filter(laMo) }, { ten: 'Đã hoàn thành', rows: cua.filter(laXong) }] };
    }
    case 'loai': {   // Đợt C1: khối Theo loại văn bản — số bấm là TỔNG mọi kỳ nên danh sách gồm cả việc không mở, không xong (thường xuyên, chờ điều kiện…)
      const cua = rows.filter((r) => laViecGoc(r) && loaiCua(r) === ct.ma);   // việc gốc — như số trên thẻ (theoLoaiVanBan)
      return { tieuDe: `Loại văn bản: ${ct.ten || ''}`.trim(), nhom: [{ ten: 'Đang thực hiện', rows: cua.filter(laMo) }, { ten: 'Đã hoàn thành (mọi kỳ)', rows: cua.filter(laXong) }] };
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
    case 'nghen': return { tieuDe: `Điểm nghẽn cần chỉ đạo${ct.ten ? ` — ${ct.ten}` : ''}`, rows: locCapNghen(diemNghen(rows), ct.cap) };
    case 'mt': {   // mục tiêu then chốt: mọi kỳ — đang làm, đã hoàn thành, còn lại
      const cua = rows.filter((r) => mucTieuCua(r).includes(ct.ma));
      return { tieuDe: ct.ten || 'Mục tiêu then chốt', nhom: [{ ten: 'Đang thực hiện', rows: cua.filter(laMo) }, { ten: 'Đã hoàn thành', rows: cua.filter(laXong) }] };
    }
    case 'mtm': {   // m: 'qh' = Đỏ + Đỏ đặc biệt (ô Quá hạn của bảng nghị quyết), còn lại một mức
      const muc = ct.m === 'qh' ? ['do', 'ddb'] : [ct.m];
      return { tieuDe: `${ct.ten || 'Mục tiêu'} — ${ct.m === 'qh' ? 'Quá hạn' : TEN_MUC[ct.m] || ''}`, rows: rows.filter((r) => mucTieuCua(r).includes(ct.ma) && laMo(r) && muc.includes(mucMo(r))) };
    }
    case 'khoi': {   // khối / ngành của khối 3: tách theo đoạn trạng thái (cùng cách đếm thanh xếp chồng)
      const cua = dongCuaKhoi(rows, ct.ma, { nganh: nganhDm, linhVuc: linhVucDm }, ct.loai, ct.kh || null);
      const ds = DOAN.filter(([ma]) => !ct.d || ma === ct.d).map(([ma, ten]) => ({ ten, rows: cua.filter((r) => doanCua(r, k) === ma) }));
      return { tieuDe: `${ct.ten || 'Lĩnh vực'}${ct.d ? ` — ${DOAN.find(([ma]) => ma === ct.d)?.[1] || ''}` : ''}`, nhom: ds };
    }
    case 'xh': {
      const cua = rows.filter((r) => khoaXepHang(ct.cach)(r)[0] === ct.ma);
      if (ct.m) return { tieuDe: `${ct.ten || ''} — ${TEN_MUC[ct.m] || ''}`, rows: cua.filter((r) => laMo(r) && mucMo(r) === ct.m) };
      return { tieuDe: ct.ten || 'Xếp hạng', nhom: moVaXong(cua, k) };
    }
    case 'quy': {
      const kq = { tu: ct.tu, den: ct.den }; const x = rows.filter((r) => xongTrongKy(r, kq));
      return { tieuDe: `Hoàn thành ${ct.ten || ''}`.trim(), nhom: [{ ten: 'Trễ hạn', rows: x.filter((r) => r.ket_qua === 'TRE') }, { ten: 'Đúng hạn', rows: x.filter((r) => r.ket_qua === 'DUNG_HAN') }] };
    }
    case 'vm': return { tieuDe: 'Vướng mắc chờ lãnh đạo cho ý kiến', rows: vuongMacCho(rows) };
    case 'cldl': {
      const c = chatLuongDuLieu(rows);
      return { tieuDe: 'Nhiệm vụ cần bổ sung thông tin', nhom: [...(HIEN_MUC_TIEU ? [{ ten: 'Chưa phân loại mục tiêu then chốt', rows: c.chuaMucTieu }] : []),   // v3.27: tạm ẩn
        { ten: 'Chưa có ngành/lĩnh vực', rows: c.chuaNganh }, { ten: 'Hoàn thành chưa có ngày hoàn thành', rows: c.xongChuaNgay }] };
    }
    case 'loc': return { tieuDe: 'Nhiệm vụ theo bộ lọc', nhom: [{ ten: 'Đang thực hiện', rows: rows.filter(laMo) }, { ten: 'Đã hoàn thành', rows: rows.filter(laXong) }] };
    default: return { tieuDe: 'Nhiệm vụ', rows: [] };
  }
}
