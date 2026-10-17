// Giao việc — Đợt C2 v3.19 (0087–0088): ba ô nguồn trong "Thông tin thêm (không bắt buộc)", dùng chung cho mọi nhiệm vụ của lượt (phần chung của
// giao_viec_nhieu): Mức quan trọng (A/B/C), Cơ quan trình (đơn vị ngoài Văn phòng — danh mục đơn vị), Thường trực chỉ đạo (tài khoản A0). Không bắt
// buộc; sửa từng việc sau qua "Sửa thông tin giao". DB là chốt (giao_viec + trigger bf_nhiem_vu_nguon). Thường trực tự giao: DB ghi chính người giao.
import { $, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { MUC_QUAN_TRONG } from '../../../lib/kl/ma-nguon.js';

const opt = (v, t) => `<option value="${escapeHtml(v)}">${escapeHtml(t)}</option>`;
export function dienThongTinNguon() {
  $('klThMucQT').innerHTML = opt('', 'Chưa xếp mức') + MUC_QUAN_TRONG.map(([ma, ten]) => opt(ma, ten)).join('');
  $('klThCoQuanTrinh').innerHTML = opt('', 'Không ghi') + (danhMucKl().donVi || []).filter((d) => !d.trong_van_phong).map((d) => opt(d.ma, d.ten)).join('');
  $('klThTTChiDao').innerHTML = opt('', 'Không ghi') + state.accounts.filter((a) => a.role_group === 'A0' && !a.is_system)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi')).map((a) => opt(a.id, a.full_name)).join('');
}
export const docThongTinNguon = () => ({ muc_quan_trong: $('klThMucQT').value || null, co_quan_trinh: $('klThCoQuanTrinh').value || null,
  thuong_truc_chi_dao: $('klThTTChiDao').value || null });
