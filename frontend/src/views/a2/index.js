// View A2 — Trưởng phòng: gắn markup, 3 tab Giao việc / Theo dõi & duyệt / KPI phòng (DASH-3),
// form giao việc trong phòng (TASK-1/2) qua hàm assign_task (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml, toDatetimeLocalValue, filterRowsByKeyword } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { a2Template } from './template.js';
import { loadA2Data } from './tracking.js';
import { renderKPITab } from './kpi.js';

const ACTIVE_CLS = ['border-red-800', 'text-red-800', 'font-bold'];
const INACTIVE_CLS = ['border-transparent', 'text-slate-500', 'font-semibold'];
const TABS = {
  giaoViec: { btn: 'tabBtnGiaoViec', content: 'tabContentGiaoViec', load: null },
  theoDoi: { btn: 'tabBtnTheoDoi', content: 'tabContentTheoDoi', load: loadA2Data },
  kpi: { btn: 'tabBtnKPI', content: 'tabContentKPI', load: renderKPITab },
};

function switchA2Tab({ tab }) {
  Object.values(TABS).forEach((t) => {
    $(t.btn).classList.remove(...ACTIVE_CLS);
    $(t.btn).classList.add(...INACTIVE_CLS);
    $(t.content).classList.add('hidden');
  });
  const active = TABS[tab];
  if (!active) return;
  $(active.btn).classList.add(...ACTIVE_CLS);
  $(active.btn).classList.remove(...INACTIVE_CLS);
  $(active.content).classList.remove('hidden');
  if (active.load) active.load();
}

// Danh sách cán bộ trong phòng cho form giao việc và mốc V-Office mặc định = hiện tại.
function prepareAssignForm() {
  const me = state.user;
  const myStaffs = state.accounts.filter((a) => a.department === me.department && a.id !== me.id);
  $('taskAssignSelect').innerHTML = myStaffs
    .map((c) => `<option value="${c.id}">${escapeHtml(c.full_name)} (${escapeHtml(c.position_title)})</option>`)
    .join('');
  $('taskVOfficeDate').value = toDatetimeLocalValue(new Date());
}

async function handleA2GiaoViec() {
  const deadlineVal = $('taskDeadline').value;
  if (!deadlineVal || new Date(deadlineVal) <= new Date()) {
    notifyError('Thời hạn hoàn thành phải ở tương lai!');
    return;
  }

  const payload = {
    title: $('taskTitle').value.trim(),
    resolution_code: $('taskResCode').value.trim(),
    assigned_to: $('taskAssignSelect').value,
    leader_in_charge: state.user.id,
    created_by: state.user.id,
    expected_product: $('taskProduct').value.trim(),
    voffice_received_at: new Date($('taskVOfficeDate').value).toISOString(),
    deadline: new Date(deadlineVal).toISOString(),
    critical_overdue_days: parseInt($('taskCriticalDays').value, 10),
    competent_authority: $('taskAuthority').value,
    status: 'CHO_TIEP_NHAN',
    warning_count: 0,
  };

  // RLS-8: hàm assign_task tự kiểm tra phạm vi giao việc (trong phòng), đặt created_by/status.
  const { error } = await supabase.rpc('assign_task', { p: payload });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã phát hành giao việc cho cán bộ thành công!');
  $('formGiaoViec').reset();
  prepareAssignForm();
  switchA2Tab({ tab: 'theoDoi' });
}

function mount() {
  $('viewLanhDaoVP').innerHTML = a2Template;
  $('ldvpTrackSearch').addEventListener('input', (e) => filterRowsByKeyword('trackingTableBody', e.target.value));
  registerActions({ switchA2Tab, handleA2GiaoViec });
}

export function registerA2View() {
  mount();
  registerView('A2', {
    init() {
      prepareAssignForm();
      switchA2Tab({ tab: 'giaoViec' });
      loadA2Data();
    },
    // Sau khi phân công lại: nạp lại bảng theo dõi và KPI như bản cũ.
    reload() {
      loadA2Data();
      renderKPITab();
    },
  });
}
