// Tổng quan cho lãnh đạo (v3.24 — bố cục 9 khối được duyệt 16/10/2026): số liệu của các khối mới, thuần (không DOM, không Supabase; unit test
// tong-quan-lanh-dao.test.mjs). Cùng quy ước với lib/kl/tong-quan.js: trạng thái từng dòng do DB tính; "trong kỳ" = hoàn thành trong kỳ; việc đang
// mở và cảnh báo tính đến hôm nay. Khối 1 điểm nghẽn (bốn thông tin Công văn 1400), 2 mục tiêu then chốt, 3 lĩnh vực trọng tâm (5 khối → 12 ngành),
// 4 xếp hạng (đơn vị chịu trách nhiệm / đồng chí Thường trực chỉ đạo), 5 tỷ lệ đúng hạn theo quý, vướng mắc chờ ý kiến, chất lượng dữ liệu.
import { laXong, laMo, mucMo, xongTrongKy, soLieuChinh, chuaRoNgayXong } from './tong-quan.js';
import { mucTieuCua, mucTieuThat, khongThuocMucTieu, chuaGanMucTieu, mucTieuTheoNhom, khoiCuaDong, KHONG_THUOC } from './muc-tieu.js';
import { boSoThuTu } from './nhan.js';

const tyLe = (a, b) => (b ? Math.round((a / b) * 100) : null);
const pad = (n) => String(n).padStart(2, '0');
const cuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const laDo = (r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r));

// Đoạn trạng thái (khối 3) — mỗi việc vào đúng một đoạn: hoàn thành TRONG KỲ (đúng hạn / chậm / chưa đánh giá); đang mở: trong hạn (kể cả chờ xác
// nhận minh chứng), Vàng, quá hạn (Đỏ + Đỏ đặc biệt), chưa có hạn (không áp dụng cảnh báo, thường xuyên). Hoàn thành ngoài kỳ → null (không tính).
export const DOAN = [['dung', 'Hoàn thành đúng hạn', '--f-tot'], ['cham', 'Hoàn thành chậm', '--f-tre'], ['cdg', 'Hoàn thành, chưa đánh giá', '--vien-o'],
  ['th', 'Đang làm trong hạn', '--du-lieu'], ['vang', 'Sắp đến hạn (Vàng)', '--f-vang'], ['qh', 'Quá hạn (Đỏ, Đỏ đặc biệt)', '--f-do'],
  ['ch', 'Chưa có hạn, thường xuyên, chờ điều kiện', '--chu-mo']];
export function doanCua(r, k) {
  if (laXong(r)) return xongTrongKy(r, k) ? (r.ket_qua === 'DUNG_HAN' ? 'dung' : r.ket_qua === 'TRE' ? 'cham' : 'cdg') : null;
  if (!laMo(r)) return 'ch';
  const m = mucMo(r);
  return m === 'vang' ? 'vang' : m === 'do' || m === 'ddb' ? 'qh' : m === 'khac' ? 'ch' : 'th';
}
function demDoan(rows, k) {
  const dem = Object.fromEntries(DOAN.map(([ma]) => [ma, 0])); let tong = 0;
  rows.forEach((r) => { const d = doanCua(r, k); if (d) { dem[d]++; tong++; } });
  return { tong, dem, tyLe: tyLe(dem.dung, dem.dung + dem.cham), qh: dem.qh };
}

// Khối 3: 5 khối (danh mục khoi, thứ tự) → các ngành có việc; việc không có ngành gom "Chưa phân loại" (cần rà soát); v3.26 (0116): việc chọn
// "Không thuộc ngành, lĩnh vực nào" (khối KHONG_THUOC) gom dòng riêng "Không thuộc lĩnh vực trọng tâm" — đã phân loại, không xếp cùng 5 khối. sap: 'qh'
// (nhiều quá hạn trước, rồi đúng hạn thấp trước) | 'dm' (theo danh mục). Trả { toan: số liệu chung, khoi: [...], khongThuoc, chuaNganh }.
export function theoKhoi(rows, k, { khoi = [], nganh = [], linhVuc = [] } = {}, sap = 'qh') {
  const dsKhoi = khoi.filter((x) => x.ma !== KHONG_THUOC);
  const coKhoi = new Set(dsKhoi.map((x) => x.ma)); const theo = new Map(); const chua = []; const khong = [];   // khối → ngành → dòng (0107: khối theo lĩnh vực nếu có)
  rows.forEach((r) => {
    const kh = r.nganh_ma ? khoiCuaDong(r, nganh, linhVuc) : null;
    if (kh === KHONG_THUOC) { khong.push(r); return; }
    if (!kh || !coKhoi.has(kh)) { chua.push(r); return; }
    if (!theo.has(kh)) theo.set(kh, new Map());
    const m = theo.get(kh); if (!m.has(r.nganh_ma)) m.set(r.nganh_ma, []); m.get(r.nganh_ma).push(r);
  });
  const ds = dsKhoi.map((kh) => {
    const m = theo.get(kh.ma) || new Map();
    const ng = nganh.filter((n) => m.has(n.ma)).map((n) => ({ ma: n.ma, ten: n.ten, thuTu: n.thu_tu, ...demDoan(m.get(n.ma), k) })).filter((n) => n.tong > 0);
    return { ma: kh.ma, ten: kh.ten, thuTu: kh.thu_tu, ...demDoan([...m.values()].flat(), k), nganh: ng };
  });
  const so = (a, b) => (a.tyLe ?? 101) - (b.tyLe ?? 101);
  const xep = sap === 'dm' ? (a, b) => a.thuTu - b.thuTu : (a, b) => b.qh - a.qh || so(a, b) || a.thuTu - b.thuTu;
  ds.sort(xep); ds.forEach((d) => d.nganh.sort(xep));
  const chuaNganh = demDoan(chua, k); const khongThuoc = demDoan(khong, k);
  return { toan: demDoan(rows, k), khoi: ds, khongThuoc: khongThuoc.tong ? khongThuoc : null, chuaNganh: chuaNganh.tong ? chuaNganh : null };
}
// Dòng của một khối / ngành (trong khối khoiCha) / "chưa phân ngành" (bấm xem).
export function dongCuaKhoi(rows, ma, { nganh = [], linhVuc = [] } = {}, loai = 'khoi', khoiCha = null) {
  if (ma === 'TAT') return rows;   // dòng "Toàn bộ" đầu khối
  const kh = (r) => (r.nganh_ma ? khoiCuaDong(r, nganh, linhVuc) : null);
  if (loai === 'nganh') return rows.filter((r) => r.nganh_ma === ma && (!khoiCha || kh(r) === khoiCha));
  if (ma === 'CHUA') return rows.filter((r) => !kh(r));
  return rows.filter((r) => kh(r) === ma);
}

// Khối 1: việc Đỏ / Đỏ đặc biệt đang mở — Đỏ đặc biệt trước, rồi trễ nhiều ngày trước, độ khẩn cao trước.
export const diemNghen = (rows) => rows.filter(laDo)
  .sort((a, b) => (mucMo(b) === 'ddb') - (mucMo(a) === 'ddb') || (b.so_ngay_qua || 0) - (a.so_ngay_qua || 0) || (a.thu_tu_do_khan || 4) - (b.thu_tu_do_khan || 4) || String(a.ma).localeCompare(String(b.ma)));
// Nút lọc theo cấp cần quyết định: mỗi cấp có việc (thứ tự danh mục cấp), cuối là "chưa xác định".
export function capNghen(ds, cap = []) {
  const dem = new Map(); ds.forEach((r) => { const c = r.cap_quyet_dinh || 'CHUA'; dem.set(c, (dem.get(c) || 0) + 1); });
  const co = cap.filter((c) => dem.has(c.ma)).map((c) => ({ ma: c.ma, ten: c.ten, n: dem.get(c.ma) }));
  const la = [...dem.keys()].filter((c) => c !== 'CHUA' && !cap.some((x) => x.ma === c)).map((c) => ({ ma: c, ten: ds.find((r) => r.cap_quyet_dinh === c)?.cap_quyet_dinh_ten || c, n: dem.get(c) }));
  return [...co, ...la, ...(dem.has('CHUA') ? [{ ma: 'CHUA', ten: 'Chưa xác định cấp', n: dem.get('CHUA') }] : [])];
}
export const locCapNghen = (ds, cap) => (!cap ? ds : ds.filter((r) => (r.cap_quyet_dinh || 'CHUA') === cap));

// Khối 2: mỗi mục tiêu của nhóm — tổng việc đã gắn (mọi kỳ), đã hoàn thành, đúng hạn / được đánh giá, đang làm, cảnh báo; văn bản của các việc
// (số hiệu nhiều việc nhất trước — "văn bản cụ thể hóa" ghép từ dữ liệu, không ghi tay).
export function theoMucTieu(rows, dm, nhom) {
  return mucTieuTheoNhom(dm, nhom).filter((m) => m.dang_dung !== false || rows.some((r) => mucTieuCua(r).includes(m.ma))).map((m) => {
    const cua = rows.filter((r) => mucTieuCua(r).includes(m.ma));
    const xong = cua.filter(laXong); const dg = xong.filter((r) => ['DUNG_HAN', 'TRE'].includes(r.ket_qua));
    const mo = cua.filter(laMo); const muc = (x) => mo.filter((r) => mucMo(r) === x).length;
    const vb = new Map(); cua.forEach((r) => { if (r.so_ket_luan) vb.set(r.so_ket_luan, (vb.get(r.so_ket_luan) || 0) + 1); });
    return { ...m, tong: cua.length, xong: xong.length, pct: tyLe(xong.length, cua.length) ?? 0, dung: dg.filter((r) => r.ket_qua === 'DUNG_HAN').length, dg: dg.length,
      mo: mo.length, th: mo.filter((r) => ['trongHan', 'nt'].includes(mucMo(r))).length, ddb: muc('ddb'), do: muc('do'), vang: muc('vang'),
      vanBan: [...vb.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).map(([so]) => so) };
  });
}
export const coGanMucTieu = (rows) => rows.some((r) => mucTieuThat(r).length > 0);
// v3.26: số việc đã gắn mục tiêu then chốt / chọn "Không thuộc" / chưa phân loại (dòng tóm tắt khối 2).
export const phanLoaiMucTieu = (rows) => ({ gan: rows.filter((r) => mucTieuThat(r).length > 0).length, khong: rows.filter(khongThuocMucTieu).length,
  chua: rows.filter(chuaGanMucTieu).length });
// Kết quả chỉ tiêu mới nhất theo mã (kỳ lớn nhất: '2026-Q3' > '2026-09' theo chuỗi không đúng nghĩa — so theo mốc cuối kỳ).
const cuoiKy = (ky) => { const [y, p] = String(ky).split('-'); if (!p) return `${y}-12-31`; if (p[0] === 'Q') { const m = Number(p[1]) * 3; return `${y}-${pad(m)}-${pad(cuoiThang(+y, m))}`; } return `${y}-${p}-${pad(cuoiThang(+y, +p))}`; };
export function ketQuaMoiNhat(ketQua = []) {
  const m = new Map();
  ketQua.forEach((x) => { const cu = m.get(x.muc_tieu_ma); if (!cu || cuoiKy(x.ky) > cuoiKy(cu.ky)) m.set(x.muc_tieu_ma, x); });
  return m;
}
export const tenKy = (ky) => { const [y, p] = String(ky).split('-'); return !p ? `năm ${y}` : p[0] === 'Q' ? `quý ${['I', 'II', 'III', 'IV'][Number(p[1]) - 1]}/${y}` : `tháng ${Number(p)}/${y}`; };

// Khối 4: xếp hạng theo đơn vị chịu trách nhiệm (cơ quan trình; dữ liệu cũ: đơn vị chủ trì ngoài Văn phòng; còn lại Văn phòng) hoặc theo đồng chí
// Thường trực chỉ đạo. Nhiều việc quá hạn trước, rồi đúng hạn thấp trước, rồi nhiều việc giao trước.
export const VP_KHOA = 'VP'; export const KHONG_TT = 'KHONG';
export const khoaXepHang = (cach) => (cach === 'tt'
  ? (r) => (r.thuong_truc_chi_dao ? [r.thuong_truc_chi_dao, r.thuong_truc_chi_dao_ten || 'Đồng chí Thường trực'] : [KHONG_TT, 'Không ghi đồng chí Thường trực chỉ đạo'])
  : (r) => (r.co_quan_trinh ? [r.co_quan_trinh, boSoThuTu(r.co_quan_trinh_ten) || r.co_quan_trinh]
    : !r.owner_trong_van_phong && r.owner_don_vi_ma ? [r.owner_don_vi_ma, boSoThuTu(r.owner_don_vi_ten) || r.owner_don_vi_ma] : [VP_KHOA, 'Văn phòng Tỉnh ủy (các phòng)']));
export function xepHang(rows, k, cach = 'dv') {
  const khoa = khoaXepHang(cach); const m = new Map();
  rows.forEach((r) => { const [ma, ten] = khoa(r); if (!m.has(ma)) m.set(ma, { ma, ten, rows: [] }); m.get(ma).rows.push(r); });
  return [...m.values()].map((g) => { const s = soLieuChinh(g.rows, k); return { ma: g.ma, ten: g.ten, giao: s.giao, xong: s.xong, tyLe: s.tyLeDungHan, dangMo: s.dangMo, ddb: s.mo.ddb, do: s.mo.do, vang: s.mo.vang }; })
    .filter((g) => g.giao + g.xong + g.dangMo > 0)
    .sort((a, b) => (b.ddb + b.do) - (a.ddb + a.do) || (a.tyLe ?? 101) - (b.tyLe ?? 101) || b.giao - a.giao || a.ten.localeCompare(b.ten, 'vi'));
}

// Khối 5: tỷ lệ đúng hạn quý trước và quý này (đến nay) — việc hoàn thành trong quý đã được đánh giá.
export function dungHanQuy(rows, homNay) {
  const [y, m] = homNay.split('-').map(Number); const q = Math.ceil(m / 3);
  const quy = (nam, qq) => { const m1 = qq * 3 - 2; const m3 = qq * 3; return { nam, q: qq, tu: `${nam}-${pad(m1)}-01`, den: `${nam}-${pad(m3)}-${pad(cuoiThang(nam, m3))}` }; };
  return [q === 1 ? quy(y - 1, 4) : quy(y, q - 1), quy(y, q)].map((kq, i) => {
    const dg = rows.filter((r) => xongTrongKy(r, kq) && ['DUNG_HAN', 'TRE'].includes(r.ket_qua));
    const dung = dg.filter((r) => r.ket_qua === 'DUNG_HAN').length;
    return { ...kq, ten: `quý ${['I', 'II', 'III', 'IV'][kq.q - 1]}${kq.nam !== y ? `/${kq.nam}` : ''}${i === 1 ? ' (đến nay)' : ''}`, dung, dg: dg.length, tyLe: tyLe(dung, dg.length) };
  });
}

// Khối 7: việc đang mở có vướng mắc / đề nghị lãnh đạo quyết định. Ghi chú chất lượng dữ liệu: việc chưa gắn mục tiêu, việc chưa có ngành / lĩnh vực,
// việc hoàn thành chưa có ngày hoàn thành (tính theo ngày giao, không xét được đúng hạn — kiểm tay 18/10).
export const vuongMacCho = (rows) => rows.filter((r) => laMo(r) && r.vuong_mac);
export const chatLuongDuLieu = (rows) => ({ chuaMucTieu: rows.filter(chuaGanMucTieu), chuaNganh: rows.filter((r) => !r.nganh_ma || !r.linh_vuc_ma),
  xongChuaNgay: rows.filter(chuaRoNgayXong) });
// v3.26 (kiểm staging 19/10): việc chưa đủ ngành, lĩnh vực = chưa có ngành (dòng "Chưa phân loại" của khối 3 — chưa xếp được vào khối) + có ngành nhưng
// chưa có lĩnh vực (vẫn tính theo ngành). Một câu chung cho khối 3, Chất lượng dữ liệu (cùng số với ô "Chưa có ngành, lĩnh vực" của màn Rà soát).
export const thieuNganh = (rows) => {
  const khongNganh = rows.filter((r) => !r.nganh_ma).length; const thieuLv = rows.filter((r) => r.nganh_ma && !r.linh_vuc_ma).length;
  return { tong: khongNganh + thieuLv, khongNganh, thieuLv };
};
export const chuThieuNganh = ({ tong, khongNganh, thieuLv }) => (!thieuLv ? `${tong} nhiệm vụ chưa có ngành, lĩnh vực`
  : !khongNganh ? `${tong} nhiệm vụ đã có ngành nhưng chưa có lĩnh vực` : `${tong} nhiệm vụ chưa có ngành, lĩnh vực (${khongNganh} chưa có ngành, ${thieuLv} chưa có lĩnh vực)`);
