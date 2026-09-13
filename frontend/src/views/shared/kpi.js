// Thống kê KPI theo nhóm cán bộ từ state.allTasks (TASK-5, DASH-2/3): tổng, trong hạn,
// gần hạn (≤ 3 ngày), quá hạn, đang làm, hoàn thành.
import { state } from '../../lib/state.js';

export function calculateGroupKPI(staffIds) {
  const kpi = { total: 0, onTime: 0, warningSoon: 0, overdue: 0, inProgress: 0, completed: 0 };
  const now = new Date();

  state.allTasks.forEach((t) => {
    if (!staffIds.includes(t.assigned_to)) return;
    kpi.total++;
    if (t.status === 'HOAN_THANH') {
      kpi.completed++;
      return;
    }
    kpi.inProgress++;
    const dead = new Date(t.deadline);
    if (now > dead) kpi.overdue++;
    else if ((dead - now) / 86400000 <= 3) kpi.warningSoon++;
    else kpi.onTime++;
  });
  return kpi;
}
