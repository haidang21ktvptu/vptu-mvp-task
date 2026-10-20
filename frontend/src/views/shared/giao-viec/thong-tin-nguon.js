// Giao việc — Đợt C2 v3.19 (0087–0088): ba ô nguồn: Mức quan trọng (A/B/C), Thường trực chỉ đạo (tài khoản A0) — trong "Thông tin thêm (không bắt
// buộc)", dùng chung cho mọi nhiệm vụ của lượt; Cơ quan/đơn vị trình — v3.27: ô của thẻ nhiệm vụ 1 (cột G bảng Phụ lục; thẻ thêm có ô riêng, gồm cả
// "1. Văn phòng Tỉnh ủy" — 0117). Không bắt buộc; sửa từng việc sau qua "Sửa thông tin giao". DB là chốt (giao_viec + trigger bf_nhiem_vu_nguon).
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { dsCoQuanTrinh } from '../../../lib/kl/nhap/chuan-hoa.js';
import { MUC_QUAN_TRONG } from '../../../lib/kl/ma-nguon.js';

const opt = (v, t) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`;
export const coQuanTrinhOptions = () => opt('', 'Không ghi') + dsCoQuanTrinh(danhMucKl())
  .sort((a, b) => (a.thu_tu ?? 99) - (b.thu_tu ?? 99) || a.ten.localeCompare(b.ten, 'vi', { numeric: true })).map((d) => opt(d.ma, d.ten)).join('');
export function dienThongTinNguon() {
  $('klThMucQT').innerHTML = opt('', 'Chưa xếp mức') + MUC_QUAN_TRONG.map(([ma, ten]) => opt(ma, ten)).join('');
  $('klThCoQuanTrinh').innerHTML = coQuanTrinhOptions();
  $('klThTTChiDao').innerHTML = opt('', 'Không ghi') + state.accounts.filter((a) => a.role_group === 'A0' && !a.is_system)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi')).map((a) => opt(a.id, a.full_name)).join('');
}
export const docThongTinNguon = () => ({ muc_quan_trong: $('klThMucQT').value || null, co_quan_trinh: $('klThCoQuanTrinh').value || null,
  thuong_truc_chi_dao: $('klThTTChiDao').value || null });
