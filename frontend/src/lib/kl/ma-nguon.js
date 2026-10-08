// Đợt C2 v3.19 (0087): thông tin nguồn của nhiệm vụ — mức quan trọng A/B/C, mã theo nguồn (vd KL-BTV·HN39·671·04 = loại văn bản · số hội nghị ·
// số hiệu văn bản · số thứ tự nhiệm vụ trong văn bản). Mã theo nguồn KHÔNG lưu: dựng từ cột của v_nhiem_vu (van_ban_loai, so_hoi_nghi, so_ket_luan,
// stt_van_ban — STT do DB cấp khi tạo việc). Thuần (không DOM); unit test ở frontend/tests/ma-nguon.test.mjs.

export const MUC_QUAN_TRONG = [['A', 'A — rất quan trọng'], ['B', 'B — quan trọng'], ['C', 'C — thông thường']];
export const tenMucQuanTrong = (m) => MUC_QUAN_TRONG.find(([k]) => k === m)?.[1] || m || '';

const VIET_TAT = { KL_BTV: 'KL-BTV', TB_THUONG_TRUC: 'TB-TT', KL_BCH: 'KL-BCH', NQ_BCH: 'NQ-BCH', NQ_TW: 'NQ-TW', CONG_VAN: 'CV', KHAC: 'VB' };
// Phần số đứng đầu số hiệu ("671-KL/TU" → "671"); số hiệu không mở đầu bằng số (mốc "Thường trực giao …") → bỏ phần này.
export const soDauSoHieu = (so) => String(so || '').trim().match(/^(\d+)/)?.[1] || '';

export function maTheoNguon(r) {
  if (!r || !r.stt_van_ban) return '';
  return [VIET_TAT[r.van_ban_loai] || 'VB', r.so_hoi_nghi ? `HN${r.so_hoi_nghi}` : '', soDauSoHieu(r.so_ket_luan), String(r.stt_van_ban).padStart(2, '0')]
    .filter(Boolean).join('·');
}
