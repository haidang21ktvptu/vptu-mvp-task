// Giao việc — PR-3 (B, E, F): ô "Nguồn nhiệm vụ" (bắt buộc; dòng "Còn thiếu"), "Đơn vị phối hợp" (tuỳ chọn) và, khi tạo văn bản mới, "Số nhiệm vụ
// dự kiến" + "Đã rà soát toàn văn" (tuỳ chọn). Nguồn MẶC ĐỊNH theo loại văn bản ĐANG ÁP DỤNG — loại ở ô "Loại văn bản" khi tạo văn bản mới, loại
// của văn bản đã chọn khi dùng văn bản có sẵn (kể cả A0 giao từ Kết luận) — cho tới khi người dùng tự chọn; đổi văn bản / loại thì mặc định đi theo.
// DB là chốt: trigger be_nhiem_vu_pr3 (0062) đòi nguồn với việc tạo mới trong phiên người dùng.
import { $ } from '../../../lib/dom.js';
import { nguonOptionsHtml } from '../kl/thong-tin-giao.js';

export const NGUON_THEO_LOAI = { KL_BTV: 'VAN_BAN_CAN_THEO_DOI', TB_THUONG_TRUC: 'VAN_BAN_CAN_THEO_DOI', NQ_TW: 'VAN_BAN_CAN_THEO_DOI',
  CONG_VAN: 'NHIEM_VU_PHAT_SINH', KHAC: 'NHIEM_VU_PHAT_SINH' };
export const nguonMacDinh = (loai) => NGUON_THEO_LOAI[loai] || 'NHIEM_VU_PHAT_SINH';

let tuChon = false;   // người dùng đã tự chọn (kể cả bỏ chọn) ⇒ không ghi đè bằng mặc định nữa

export function datLaiNguon() {
  tuChon = false;
  $('klThNguon').innerHTML = nguonOptionsHtml('', 'Chọn nguồn nhiệm vụ');
  delete $('klThNguon').dataset.tuChon;
  ['klThPhoiHop', 'gvVbDuKien'].forEach((id) => { $(id).value = ''; });
  $('gvVbRaSoat').checked = false;
}
// Gọi mỗi lần biểu mẫu tính lại (đổi văn bản, loại văn bản, số hiệu…): chưa tự chọn thì đặt theo loại đang áp dụng.
export function apMacDinhNguon(loai) { if (!tuChon) $('klThNguon').value = nguonMacDinh(loai); }
export function nguonDoi() { tuChon = true; $('klThNguon').dataset.tuChon = '1'; }
export const thieuNguon = () => !$('klThNguon').value;
export const loiNguon = () => (thieuNguon() ? 'Chọn nguồn nhiệm vụ.' : null);
export const docNguon = () => ({ nguon_nhiem_vu_ma: $('klThNguon').value || null, don_vi_phoi_hop: $('klThPhoiHop').value.trim() || null });
// Hai ô tuỳ chọn của văn bản mới (van_ban.so_nhiem_vu_du_kien ≥ 0, van_ban.da_ra_soat_toan_van).
export const soNguyenKhongAm = (v) => (String(v ?? '').trim() === '' ? null : Math.max(0, Math.trunc(Number(v)) || 0));   // ô số: 2.5 → 2, chữ → 0
export const docVanBanThem = () => ({ so_nhiem_vu_du_kien: soNguyenKhongAm($('gvVbDuKien').value),
  da_ra_soat_toan_van: $('gvVbRaSoat').checked });
