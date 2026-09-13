// A2 Tab 3: KPI từng cán bộ trong phòng, bấm "Chi tiết việc" để bung nhiệm vụ ngay dưới (DASH-3).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { calculateGroupKPI } from '../shared/kpi.js';
import { staffDetailButtonHtml } from '../shared/inline-tasks.js';

function staffKpiRowHtml(st) {
  const k = calculateGroupKPI([st.id]);
  return `
    <tr>
      <td class="nguoi">${escapeHtml(st.full_name)}<small>${escapeHtml(st.position_title)}</small></td>
      <td class="so" data-nhan="Tổng nhận">${k.total}</td>
      <td class="so" data-nhan="Trong hạn">${k.onTime}</td>
      <td class="so" data-nhan="Gần hạn">${k.warningSoon}</td>
      <td class="so" data-nhan="Quá hạn">${k.overdue}</td>
      <td class="so" data-nhan="Đang làm">${k.inProgress}</td>
      <td class="so" data-nhan="Đã hoàn thành">${k.completed}</td>
      <td><div class="thao-tac">${staffDetailButtonHtml(`btnA2Kpi-${st.id}`, `a2KpiDetailRow-${st.id}`, st.id)}</div></td>
    </tr>
    <!-- Dòng chi tiết bung ngay dưới cán bộ đó -->
    <tr id="a2KpiDetailRow-${st.id}" class="hidden">
      <td colspan="8"></td>
    </tr>
  `;
}

export async function renderKPITab() {
  const me = state.user;
  const myStaffs = state.accounts.filter((a) => a.department === me.department && a.id !== me.id);
  const { data: allTasks } = await supabase.from('tasks').select('*');
  state.allTasks = allTasks || [];

  const tbody = $('a2KpiTableBody');
  tbody.innerHTML = myStaffs.length === 0
    ? `<tr><td colspan="8" class="trong">Phòng chưa có cán bộ trực thuộc.</td></tr>`
    : myStaffs.map(staffKpiRowHtml).join('');
}

registerActions({ renderKPITab });
