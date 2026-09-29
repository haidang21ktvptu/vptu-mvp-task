// Dòng ngoại lệ dựng ở client từ v_nhiem_vu (PR-2a B6) — thuần, không đọc DB (unit test frontend/tests/ngoai-le.test.mjs).
// v_ngoai_le (0051) = v_nhiem_vu lọc nhom_ngoai_le: dựng lại ở client đúng cột ghép/đổi tên và thứ tự dòng của view (bỏ một truy vấn nặng).
export function dongNgoaiLe(r) {
  if (!r?.nhom_ngoai_le) return null;
  return { ...r, nhom: r.nhom_ngoai_le, owner_ten: r.owner_tai_khoan_ten ?? r.owner_don_vi_ten,
    san_pham_ten: r.san_pham_ten != null ? r.san_pham_ten + (r.san_pham_mo_ta != null ? `: ${r.san_pham_mo_ta}` : '') : 'chưa định nghĩa',
    cap_quyet_dinh_ten: r.cap_quyet_dinh_ten ?? 'chưa xác định' };
}
// ORDER BY của v_ngoai_le: thu_tu_do_khan, Thường trực giao, bi_tu_choi DESC, Đỏ đặc biệt DESC, so_ngay_qua DESC, ma — DESC của Postgres xếp NULL trước.
const giam = (a, b) => (a === b ? 0 : a == null ? -1 : b == null ? 1 : a > b ? -1 : 1);
const tang = (a, b) => (a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1);
export const soSanhNgoaiLe = (a, b) => tang(a.thu_tu_do_khan, b.thu_tu_do_khan) || giam(a.uu_tien === 'THUONG_TRUC', b.uu_tien === 'THUONG_TRUC')
  || giam(a.bi_tu_choi, b.bi_tu_choi) || giam(a.muc_canh_bao == null ? null : a.muc_canh_bao === 'DO_DAC_BIET', b.muc_canh_bao == null ? null : b.muc_canh_bao === 'DO_DAC_BIET')
  || giam(a.so_ngay_qua, b.so_ngay_qua) || tang(a.ma, b.ma);
export const ngoaiLeTu = (rows) => rows.map(dongNgoaiLe).filter(Boolean).sort(soSanhNgoaiLe);
