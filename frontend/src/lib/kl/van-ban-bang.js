// "Theo văn bản" dạng bảng (v3.25, mẫu TheoVanBan 16/10/2026) — phần THUẦN (unit test trong frontend/tests/tinh-hinh.test.mjs): tổng hợp một văn bản
// trên mọi việc của nó trong phạm vi đang xem (số việc, hoàn thành, quá hạn, Đỏ đặc biệt, sắp đến hạn, còn mở), lớp mức của dòng văn bản, cờ
// "chưa nhập đủ / chưa rà soát" (đã nhập x / dự kiến y — x là tổng thật của văn bản, kl_van_ban_so_viec), sáu ô số đếm VĂN BẢN, hai cách sắp xếp.
export const NHOM_QUA = ['QUA_HAN', 'DANG_DINH_CHINH', 'QUA_HAN_NGHIEM_THU'];

export function tongHopVanBan(rows = []) {
  const xong = rows.filter((r) => r.nhom_dem === 'HOAN_THANH').length;
  const qua = rows.filter((r) => NHOM_QUA.includes(r.nhom_dem));
  const ddb = qua.filter((r) => r.muc_canh_bao === 'DO_DAC_BIET').length;
  return { n: rows.length, xong, qua: qua.length, ddb, quaThuong: qua.length - ddb, sap: rows.filter((r) => r.nhom_dem === 'SAP_DEN_HAN').length, mo: rows.length - xong };
}
// Lớp mép trái của dòng văn bản (cùng lớp mức của dòng việc): có Đỏ đặc biệt → tím; quá hạn → đỏ; sắp đến hạn → vàng; xong hết → lục.
export const lopVanBan = (t) => (t.ddb ? 'dac-biet' : t.qua ? 'do' : t.sap ? 'vang' : t.n && t.xong === t.n ? 'luc' : 'lam');
// Rà soát: x = số việc gốc đã nhập (tổng thật), y = dự kiến (null = chưa khai), rs = đã rà soát toàn văn.
export function raSoatVanBan(x, y, rs) {
  const thieuSo = y !== null && y !== undefined && x < y;
  return { canhBao: thieuSo || !rs, chu: [thieuSo ? 'chưa nhập đủ' : '', rs ? '' : 'chưa rà soát'].filter(Boolean).join(', '),
    dong: `đã nhập ${x}${y !== null && y !== undefined ? ` / dự kiến ${y}` : ' · chưa khai số dự kiến'} · ${rs ? 'đã rà soát toàn văn' : 'chưa rà soát toàn văn'}` };
}

// Sáu ô số (đếm văn bản; d = { t: tongHopVanBan, rs: raSoatVanBan }).
export const O_SO_VB = [
  ['tat', 'Tất cả văn bản', () => true],
  ['qua', 'Có việc quá hạn', (d) => d.t.qua > 0],
  ['sap', 'Có việc sắp đến hạn (còn ≤ 7 ngày)', (d) => d.t.sap > 0],
  ['thieu', 'Chưa nhập đủ, chưa rà soát', (d) => d.rs.canhBao],
  ['mo', 'Còn việc đang thực hiện', (d) => d.t.mo > 0],
  ['xong', 'Hoàn thành toàn bộ', (d) => d.t.n > 0 && d.t.xong === d.t.n],
];
const VI_TU = Object.fromEntries(O_SO_VB.map(([k, , f]) => [k, f]));
export const locOVb = (ds, khoa) => ds.filter(VI_TU[khoa] || VI_TU.tat);
export const demOVb = (ds) => Object.fromEntries(O_SO_VB.map(([k, , f]) => [k, ds.filter(f).length]));

// Sắp xếp văn bản (d.vb = dòng đại diện có van_ban_id / so_ket_luan / ngay_ban_hanh; d.h = văn bản đọc từ van_ban_giao_viec): 'moi' — mới nhập lên
// hệ thống trước (created_at), 'nhan' — ngày nhận văn bản mới trước; việc không gắn văn bản cuối cùng.
const soSanhSo = new Intl.Collator('vi', { numeric: true }).compare;
export function sapXepVanBan(ds, sx = 'moi') {
  const moc = (d) => (sx === 'nhan' ? d.h?.ngay_nhan || d.vb?.ngay_ban_hanh || '' : d.h?.created_at || d.vb?.ngay_ban_hanh || '');
  return [...ds].sort((a, b) => (!a.vb?.van_ban_id) - (!b.vb?.van_ban_id) || moc(b).localeCompare(moc(a))
    || (b.vb?.ngay_ban_hanh || '').localeCompare(a.vb?.ngay_ban_hanh || '') || soSanhSo(a.vb?.so_ket_luan || '', b.vb?.so_ket_luan || ''));
}
