// Báo cáo (v3.29 — chủ dự án 22/10/2026): phần THUẦN (không DOM, không mạng; unit test frontend/tests/bao-cao.test.mjs). Mọi bảng và dải số dùng
// chung sáu cột: Tổng số nhiệm vụ, Quá hạn, Sắp đến hạn (còn ≤ 3 ngày), Đang thực hiện, Hoàn thành, Trước hạn — bỏ 4 cột chất lượng (Không đạt … Đạt
// xuất sắc). Mức xếp như Tổng quan (mucMo, tong-quan.js) để số quá hạn / sắp đến hạn hai màn khớp nhau: quá hạn = mức Đỏ + Đỏ đặc biệt, sắp đến
// hạn = mức Vàng; đang thực hiện = việc chưa hoàn thành còn lại (trong hạn, chờ xác nhận minh chứng, chưa có hạn, thường xuyên, đang tra soát);
// Tổng = Quá hạn + Sắp đến hạn + Đang thực hiện + Hoàn thành; Trước hạn thuộc Hoàn thành.
// Phòng chuyên môn của một việc = phòng của cán bộ chủ trì theo dõi (danh bạ), không thì phòng của đơn vị chủ trì; việc giao chung cho Văn phòng và
// việc do cơ quan, đơn vị ngoài Văn phòng chủ trì mỗi loại một dòng cuối.
// v3.30 (chủ dự án 23/10/2026): xem theo kỳ (tháng, quý, năm, nhiệm kỳ, từ ngày đến ngày) — tính NHƯ TỔNG QUAN (locTheoKy).
import { laXong, laMo, mucMo, xongTrongKy } from './tong-quan.js';
import { CHUA_CO_NGUON } from './tong-hop.js';

export const cotBaoCao = (vang = 3) => [['tong', 'Tổng số nhiệm vụ'], ['qua', 'Quá hạn'], ['sap', `Sắp đến hạn (còn ≤ ${vang} ngày)`], ['dang', 'Đang thực hiện'],
  ['xong', 'Hoàn thành'], ['truoc', 'Trước hạn']];
export const laTruocHan = (r) => laXong(r) && r.tien_do_hoan_thanh === 'TRUOC_HAN';
// Cột (một trong qua / sap / dang / xong) của một việc.
export function cotCua(r) {
  if (laXong(r)) return 'xong';
  const m = mucMo(r);
  return m === 'do' || m === 'ddb' ? 'qua' : m === 'vang' ? 'sap' : 'dang';
}
export function demCot(rows) {
  const d = { tong: rows.length, qua: 0, sap: 0, dang: 0, xong: 0, truoc: 0 };
  rows.forEach((r) => { d[cotCua(r)] += 1; if (laTruocHan(r)) d.truoc += 1; });
  return d;
}
// Việc của kỳ, như Tổng quan: mọi việc chưa hoàn thành (quá hạn, sắp đến hạn, đang thực hiện — tính tới hôm nay) + việc hoàn thành trong kỳ (chưa rõ
// ngày hoàn thành → theo ngày giao). k = khoangKy / khoangTuyChon (tong-quan.js); không có k → mọi việc.
export const locTheoKy = (rows, k) => (k ? rows.filter((r) => laMo(r) || xongTrongKy(r, k)) : rows);
export const locCot = (rows, cot) => (!cot || cot === 'tong' ? rows : cot === 'truoc' ? rows.filter(laTruocHan) : rows.filter((r) => cotCua(r) === cot));

export const PHONG_CHUNG = 'VAN_PHONG'; export const PHONG_NGOAI = 'NGOAI';
const TEN_KHAC = { LANH_DAO_VAN_PHONG: 'Lãnh đạo Văn phòng (trực tiếp chủ trì)', [PHONG_CHUNG]: 'Văn phòng Tỉnh ủy (giao chung)', [PHONG_NGOAI]: 'Cơ quan, đơn vị ngoài Văn phòng' };
const CUOI = ['LANH_DAO_VAN_PHONG', PHONG_CHUNG, PHONG_NGOAI];
export function phongCuaViec(r, phongCua = {}) {
  if (r.owner_tai_khoan && phongCua[r.owner_tai_khoan]) return phongCua[r.owner_tai_khoan];
  if (r.owner_phong) return r.owner_phong;
  return r.owner_trong_van_phong === false ? PHONG_NGOAI : PHONG_CHUNG;
}
// tenPhong: { mã phòng: tên } theo thứ tự danh bạ (DEPT_NAMES). → [{ ma, ten, rows }] — phòng chuyên môn trước (thứ tự danh bạ), rồi Lãnh đạo Văn
// phòng, giao chung, ngoài Văn phòng; phòng lạ (chưa có trong danh bạ) trước ba dòng cuối.
export function theoPhongChuyenMon(rows, { phongCua = {}, tenPhong = {} } = {}) {
  const m = new Map();
  rows.forEach((r) => { const p = phongCuaViec(r, phongCua); if (!m.has(p)) m.set(p, []); m.get(p).push(r); });
  const thuTu = Object.keys(tenPhong).filter((p) => !CUOI.includes(p));
  const hang = (p) => (CUOI.includes(p) ? 100 + CUOI.indexOf(p) : thuTu.includes(p) ? thuTu.indexOf(p) : 50);
  return [...m.entries()].map(([ma, ds]) => ({ ma, ten: TEN_KHAC[ma] || tenPhong[ma] || ma, rows: ds }))
    .sort((a, b) => hang(a.ma) - hang(b.ma) || a.ten.localeCompare(b.ten, 'vi'));
}
// Theo chuyên viên thực hiện: mỗi phòng (như trên) kèm canBo: [{ ma: id cán bộ | '', ten, rows }] — việc chưa giao cán bộ cụ thể một dòng cuối.
export function theoChuyenVien(rows, opts = {}) {
  return theoPhongChuyenMon(rows, opts).map((p) => {
    const m = new Map();
    p.rows.forEach((r) => {
      const k = r.owner_tai_khoan || '';
      if (!m.has(k)) m.set(k, { ma: k, ten: k ? r.owner_tai_khoan_ten || 'Cán bộ' : p.ma === PHONG_CHUNG || p.ma === PHONG_NGOAI ? 'Chưa giao cán bộ cụ thể' : 'Phòng, chưa giao cán bộ', rows: [] });
      m.get(k).rows.push(r);
    });
    return { ...p, canBo: [...m.values()].sort((a, b) => (a.ma === '') - (b.ma === '') || a.ten.localeCompare(b.ten, 'vi')) };
  });
}
export const theoNguon = (rows, dsNguon = []) => {
  const m = new Map();
  rows.forEach((r) => { const k = r.nguon_nhiem_vu_ma || CHUA_CO_NGUON; if (!m.has(k)) m.set(k, { ma: k, ten: r.nguon_nhiem_vu_ten || 'Chưa xác định nguồn', rows: [] }); m.get(k).rows.push(r); });
  const i = (ma) => { const x = dsNguon.findIndex((d) => d.ma === ma); return x < 0 ? 99 : x; };
  return [...m.values()].sort((a, b) => i(a.ma) - i(b.ma));
};
export function theoVanBanBc(rows) {
  const m = new Map();
  rows.forEach((r) => { const k = r.so_ket_luan || ''; if (!m.has(k)) m.set(k, { ma: k, ten: k || '(không có số hiệu)', ngay: r.ngay_ban_hanh, rows: [] }); m.get(k).rows.push(r); });
  return [...m.values()].sort((a, b) => (a.ngay < b.ngay ? 1 : -1));
}
// Bấm một ô số / một dòng: loc = { phong?, canBo?, nguon?, ketLuan?, cot? } (khoá có mặt = lọc đúng giá trị, '' là "không có").
export function locBaoCao(rows, loc = {}, { phongCua = {} } = {}) {
  const co = (k) => Object.prototype.hasOwnProperty.call(loc, k);
  const ds = rows.filter((r) => (!co('phong') || phongCuaViec(r, phongCua) === loc.phong) && (!co('canBo') || (r.owner_tai_khoan || '') === loc.canBo)
    && (!co('nguon') || (r.nguon_nhiem_vu_ma || CHUA_CO_NGUON) === loc.nguon) && (!co('ketLuan') || (r.so_ket_luan || '') === loc.ketLuan));
  return locCot(ds, loc.cot);
}
