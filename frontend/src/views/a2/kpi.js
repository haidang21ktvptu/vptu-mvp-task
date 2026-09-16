// A2 "Cán bộ trong phòng": KPI từng cán bộ từ v_nhiem_vu (GĐ14, CH-2: đánh giá theo Owner tài khoản, việc theo dõi ghi riêng),
// bấm "Chi tiết việc" để bung nhiệm vụ ngay dưới (DASH-3).
import { $, escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../lib/kl/du-lieu.js';
import { calculateGroupKPI } from '../shared/kpi.js';
import { staffDetailButtonHtml } from '../shared/inline-tasks.js';

function staffKpiRowHtml(st) {
  const k = calculateGroupKPI([st.id]);
  return `
    <tr>
      <td class="nguoi">${escapeHtml(st.full_name)}<small>${escapeHtml(st.position_title)}</small></td>
      <td class="so" data-nhan="Owner">${k.owner}</td>
      <td class="so" data-nhan="Đang mở">${k.dangMo}</td>
      <td class="so" data-nhan="Quá hạn">${k.quaHan}</td>
      <td class="so" data-nhan="Đỏ đặc biệt">${k.doDacBiet}</td>
      <td class="so" data-nhan="Hoàn thành">${k.hoanThanh}</td>
      <td class="so chu-phu" data-nhan="Đang theo dõi">${k.theoDoi}</td>
      <td><div class="thao-tac">${staffDetailButtonHtml(`btnA2Kpi-${st.id}`, `a2KpiDetailRow-${st.id}`, st.id)}</div></td>
    </tr>
    <tr id="a2KpiDetailRow-${st.id}" class="hidden"><td colspan="8"></td></tr>
  `;
}

export async function renderKPITab() {
  const me = state.user;
  const myStaffs = state.accounts.filter((a) => a.department === me.department && a.id !== me.id && !a.is_system);
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    state.nhiemVu = (await loadKlRows()).rows;
  } catch (e) {
    notifyError('Không đọc được nhiệm vụ: ' + e.message);
    return;
  }
  // Dòng đầu: việc Owner là chính phòng (chưa giao tiếp cho cá nhân) — cộng vào đánh giá của phòng, không của ai.
  const p = calculateGroupKPI([], state.nhiemVu, me.department);
  const dongPhong = `<tr class="r-ht"><td class="nguoi"><b>Phòng là Owner</b><small>chưa giao tiếp cho cá nhân</small></td>
      <td class="so">${p.owner}</td><td class="so">${p.dangMo}</td><td class="so">${p.quaHan}</td><td class="so">${p.doDacBiet}</td><td class="so">${p.hoanThanh}</td><td class="so chu-phu">—</td><td></td></tr>`;
  const tbody = $('a2KpiTableBody');
  tbody.innerHTML = dongPhong + (myStaffs.length === 0
    ? '<tr><td colspan="8" class="trong">Phòng chưa có cán bộ trực thuộc.</td></tr>'
    : myStaffs.map(staffKpiRowHtml).join(''));
}

registerActions({ renderKPITab });
