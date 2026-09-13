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
    <tr class="hover:bg-slate-50 border-b">
      <td class="p-3 font-semibold">${escapeHtml(st.full_name)} <br><span class="text-[10px] text-slate-500 font-normal">${escapeHtml(st.position_title)}</span></td>
      <td class="p-3 text-center font-bold text-slate-800">${k.total}</td>
      <td class="p-3 text-center font-semibold text-green-700">${k.onTime}</td>
      <td class="p-3 text-center font-semibold text-amber-600">${k.warningSoon}</td>
      <td class="p-3 text-center font-bold text-red-600">${k.overdue}</td>
      <td class="p-3 text-center font-medium">${k.inProgress}</td>
      <td class="p-3 text-center font-bold text-blue-700">${k.completed}</td>
      <td class="p-3 text-center">${staffDetailButtonHtml(`btnA2Kpi-${st.id}`, `a2KpiDetailRow-${st.id}`, st.id)}</td>
    </tr>
    <!-- DÒNG INLINE BUNG CHI TIẾT NGAY DƯỚI CÁN BỘ ĐÓ (TRƯỞNG PHÒNG) -->
    <tr id="a2KpiDetailRow-${st.id}" class="hidden bg-slate-50/80">
      <td colspan="8" class="p-3 border-b"></td>
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
    ? `<tr><td colspan="8" class="p-4 text-center text-slate-400">Phòng chưa có cán bộ trực thuộc.</td></tr>`
    : myStaffs.map(staffKpiRowHtml).join('');
}

registerActions({ renderKPITab });
