// View A2 — Trưởng phòng: gắn markup, 3 mục thanh bên Giao việc / Theo dõi và duyệt / Cán bộ trong
// phòng (DASH-3), form giao việc trong phòng (TASK-1/2) qua hàm assign_task (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml, toDatetimeLocalValue, filterRowsByKeyword } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { registerView } from '../registry.js';
import { setActiveNav } from '../shell.js';
import { a2Template } from './template.js';
import { loadA2Data } from './tracking.js';
import { renderKPITab } from './kpi.js';

// Ba "tab" cũ nay là ba mục ở thanh bên (id nút giữ nguyên cho e2e).
const TABS = {
  giaoViec: { btn: 'tabBtnGiaoViec', content: 'tabContentGiaoViec', load: null },
  theoDoi: { btn: 'tabBtnTheoDoi', content: 'tabContentTheoDoi', load: loadA2Data },
  kpi: { btn: 'tabBtnKPI', content: 'tabContentKPI', load: renderKPITab },
};
const NAV = [
  { id: TABS.theoDoi.btn, label: 'Theo dõi và duyệt', action: 'switchA2Tab', data: { tab: 'theoDoi' } },
  { id: TABS.giaoViec.btn, label: 'Giao việc', action: 'switchA2Tab', data: { tab: 'giaoViec' } },
  { id: TABS.kpi.btn, label: 'Cán bộ trong phòng', action: 'switchA2Tab', data: { tab: 'kpi' } },
];

function switchA2Tab({ tab }) {
  const active = TABS[tab];
  if (!active) return;
  Object.values(TABS).forEach((t) => $(t.content).classList.toggle('hidden', t !== active));
  setActiveNav(active.btn);
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
    notifyError('Hạn hoàn thành phải sau thời điểm hiện tại. Chọn lại ngày.');
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
  notifySuccess('Đã phát hành giao việc cho cán bộ.');
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
    nav: NAV,
    // Vào app mở thẳng "Theo dõi và duyệt": loadA2Data chạy đúng một lần (trước đây gọi khi vào app
    // rồi lại gọi khi bấm tab Theo dõi).
    init() {
      prepareAssignForm();
      switchA2Tab({ tab: 'theoDoi' });
    },
    // Sau khi phân công lại: nạp lại bảng theo dõi và KPI như bản cũ.
    reload() {
      loadA2Data();
      renderKPITab();
    },
  });
}
