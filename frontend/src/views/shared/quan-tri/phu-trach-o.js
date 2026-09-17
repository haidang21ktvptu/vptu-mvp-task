// Dữ liệu phân công đang hiệu lực (phu_trach_phong, den_ngay NULL) và cách vẽ một ô PCVP × phòng:
// nút "cả phòng" + các chip kiêm nhiệm (ngành, lĩnh vực). Dùng chung cho bảng phụ trách, hộp kiêm nhiệm
// và cảnh báo ở danh mục lĩnh vực.
import { supabase } from '../../../lib/supabase.js';
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { state } from '../../../lib/state.js';
import { nhanNganhLinhVuc } from './danh-muc.js';

export const TOI_DA_PHONG = 2; // mỗi PCVP tối đa 2 phòng "cả phòng" (kiêm nhiệm không tính) — kiểm thật ở admin_phan_cong_phong

let active = []; // { lanh_dao_id, phong, nganh_ma, linh_vuc_ma, tu_ngay }

export async function loadActive() {
  const { data, error } = await supabase.from('phu_trach_phong')
    .select('lanh_dao_id, phong, nganh_ma, linh_vuc_ma, tu_ngay').is('den_ngay', null);
  if (error) throw new Error(error.message);
  active = data;
  return active;
}
export const getActive = () => active;

export const caPhong = (r) => r.nganh_ma === null;
export const dongCaPhong = (lanhDaoId) => active.filter((r) => r.lanh_dao_id === lanhDaoId && caPhong(r));
export const dongKiemNhiem = (lanhDaoId, phong) => active.filter((r) => r.lanh_dao_id === lanhDaoId && r.phong === phong && !caPhong(r));
export const nguoiKiemNhiem = (phong, nganhMa, linhVucMa) => active.find((r) => r.phong === phong && r.nganh_ma === nganhMa && r.linh_vuc_ma === linhVucMa);
export const nguoiPhuTrachCaPhong = (phong) => active.filter((r) => r.phong === phong && caPhong(r));

export const tenNguoi = (id) => state.accounts.find((a) => a.id === id)?.full_name || 'một lãnh đạo';
export const tenPhong = (ma) => (DEPT_NAMES[ma] || ma).replace(/^Phòng /, '');

export function cellHtml(pcvp, phong) {
  const on = dongCaPhong(pcvp.id).some((p) => p.phong === phong);
  const daDu = !on && dongCaPhong(pcvp.id).length >= TOI_DA_PHONG;
  const nut = `<button type="button" class="nut nho ${on ? "lam" : ""}" role="switch" aria-checked="${on}"
      data-action="togglePhuTrach" data-username="${escapeHtml(pcvp.username)}" data-phong="${escapeHtml(phong)}" data-bat="${on ? '0' : '1'}"
      ${daDu ? `disabled title="Đã đủ ${TOI_DA_PHONG} phòng phụ trách — kết thúc một phân công trước"` : ''}
      aria-label="${escapeHtml(pcvp.full_name)} ${on ? 'đang' : 'không'} phụ trách cả ${escapeHtml(tenPhong(phong))}">${on ? 'Cả phòng' : '—'}</button>`;
  const chips = dongKiemNhiem(pcvp.id, phong).map((r) => `<span class="inline-flex items-center gap-1">
      <span class="trang-thai tt-cho" title="Kiêm nhiệm từ ${escapeHtml(r.tu_ngay)}">Kiêm nhiệm: ${escapeHtml(nhanNganhLinhVuc(r.nganh_ma, r.linh_vuc_ma))}</span>
      <button type="button" class="nut nho" data-action="ketThucKiemNhiem" data-username="${escapeHtml(pcvp.username)}"
        data-phong="${escapeHtml(phong)}" data-nganh="${escapeHtml(r.nganh_ma)}" data-linh-vuc="${escapeHtml(r.linh_vuc_ma)}"
        aria-label="Kết thúc kiêm nhiệm ${escapeHtml(nhanNganhLinhVuc(r.nganh_ma, r.linh_vuc_ma))} của ${escapeHtml(pcvp.full_name)}">Kết thúc</button></span>`).join('');
  return `<td data-nhan="${escapeHtml(tenPhong(phong))}" class="so"><div class="chip-kpi justify-center">${nut}${chips}</div></td>`;
}
