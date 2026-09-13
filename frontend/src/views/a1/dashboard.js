// A1 Tab 1: dashboard ngoại lệ (DASH-1) từ view_exception_dashboard + form giao việc của
// Lãnh đạo Văn phòng (TASK-1/2) qua hàm assign_task (RLS-8).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, escapeHtml, formatDateTime, toDatetimeLocalValue } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, isChief } from '../../lib/state.js';
import { notifySuccess, notifyError } from '../../components/toast.js';
import { canAccessDirectiveThread, directiveToggleBtnHtml, directiveThreadRowHtml, loadDirectiveUnreadMap } from '../../features/directives/render.js';

let rawData = []; // dòng dashboard sau khi lọc theo phạm vi (a1DashboardRawData cũ)

export function toggleA1GiaoViec() {
  $('a1GiaoViecBox').classList.toggle('hidden');
  const now = new Date();
  now.setDate(now.getDate() + 5);
  $('a1Deadline').value = toDatetimeLocalValue(now);
}

export function handleA1ModeChange(mode) {
  show('a1LeaderSelectDiv', mode === 'TO_LEADER');
  show('a1StaffSelectDiv', mode === 'TO_STAFF');
}

const optionHtml = (a) => `<option value="${a.id}">${escapeHtml(a.full_name)} (${escapeHtml(a.position_title)} - ${DEPT_NAMES[a.department]})</option>`;

export function populateA1Selects() {
  const chief = isChief();
  const mine = (a) => chief || a.manager_id === state.user.id;
  const leaders = state.accounts.filter((a) => a.role_group === 'A2' && mine(a));
  const staffs = state.accounts.filter((a) => a.role_group === 'A3' && mine(a));
  $('a1LeaderSelect').innerHTML = leaders.map(optionHtml).join('');
  $('a1StaffSelect').innerHTML = staffs.map(optionHtml).join('');
}

export async function handleA1GiaoViec() {
  const deadlineVal = $('a1Deadline').value;
  if (!deadlineVal || new Date(deadlineVal) <= new Date()) {
    notifyError('Thời hạn hoàn thành phải ở tương lai!');
    return;
  }

  const mode = $('a1AssignMode').value;
  let assignedTo = null;
  let leaderInCharge;
  if (mode === 'TO_LEADER') {
    leaderInCharge = $('a1LeaderSelect').value;
  } else {
    assignedTo = $('a1StaffSelect').value;
    const staffObj = state.accounts.find((a) => a.id === assignedTo);
    const deptLeader = state.accounts.find((a) => a.department === staffObj?.department && a.role_group === 'A2');
    leaderInCharge = deptLeader?.id || state.user.id;
  }

  const payload = {
    title: $('a1Title').value.trim(),
    resolution_code: $('a1ResCode').value.trim(),
    assigned_to: assignedTo,
    leader_in_charge: leaderInCharge,
    created_by: state.user.id,
    expected_product: $('a1Product').value.trim(),
    voffice_received_at: new Date().toISOString(),
    deadline: new Date(deadlineVal).toISOString(),
    critical_overdue_days: parseInt($('a1CriticalDays').value, 10),
    competent_authority: 'Lãnh đạo Văn phòng',
    status: assignedTo ? 'CHO_TIEP_NHAN' : 'CHUA_GIAO',
    warning_count: 0,
  };

  // RLS-8: hàm assign_task tự kiểm tra phạm vi giao việc, đặt created_by/status.
  const { error } = await supabase.rpc('assign_task', { p: payload });
  if (error) {
    notifyError('Lỗi: ' + error.message);
    return;
  }
  notifySuccess('Đã phát hành giao nhiệm vụ thành công!');
  toggleA1GiaoViec();
  loadA1Dashboard();
}

export async function loadA1Dashboard() {
  await loadDirectiveUnreadMap();
  const { data, error } = await supabase.from('view_exception_dashboard').select('*');
  if (error) {
    console.error(error);
    return;
  }

  const chief = isChief();
  rawData = (data || []).filter((r) => {
    if (chief) return true;
    const staffObj = state.accounts.find((a) => a.full_name === r.owner_name);
    return staffObj?.manager_id === state.user.id || r.owner_department === state.user.department;
  });

  const count = (level) => rawData.filter((t) => t.alert_level === level).length;
  setText('kpiTotal', rawData.length);
  setText('kpiYellow', count('VANG'));
  setText('kpiRed', count('DO'));
  setText('kpiSpecialRed', count('DO_DAC_BIET'));
  applyA1Filter();
}

export function applyA1Filter() {
  const kw = $('a1SearchInput').value.trim().toLowerCase();
  const alertFilter = $('a1FilterAlert').value;
  const deptFilter = $('a1FilterDept').value;

  const filtered = rawData.filter((r) => {
    const matchKw = !kw || [r.task_title, r.resolution_code, r.owner_name, r.expected_product]
      .some((v) => v && v.toLowerCase().includes(kw));
    const matchAlert = alertFilter === 'ALL' || r.alert_level === alertFilter;
    const matchDept = deptFilter === 'ALL' || r.owner_department === deptFilter;
    return matchKw && matchAlert && matchDept;
  });

  setText('a1FilterCount', `Hiển thị ${filtered.length} / ${rawData.length} nhiệm vụ`);
  renderA1Table(filtered);
}

function alertBadgeHtml(r) {
  switch (r.alert_level) {
    case 'DO': return `<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold">Quá hạn</span>`;
    case 'DO_DAC_BIET': return `<span class="px-2 py-0.5 rounded text-[10px] bg-purple-100 text-purple-900 font-bold animate-pulse">ĐỎ ĐẶC BIỆT</span>`;
    case 'TU_CHOI': return `<span class="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold">Từ chối: ${escapeHtml(r.reject_reason || '')}</span>`;
    case 'CHUA_GIAO': return `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 font-bold">Chưa phân công</span>`;
    case 'XANH': return `<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800">Trong hạn</span>`;
    case 'HOAN_THANH': return `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">Đã hoàn thành</span>`;
    default: return `<span class="px-2 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-800">Sắp đến hạn</span>`;
  }
}

function renderA1Table(list) {
  const tbody = $('exceptionTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Không có nhiệm vụ nào phù hợp điều kiện lọc.</td></tr>`;
    return;
  }

  const now = new Date();
  tbody.innerHTML = list.map((r) => {
    const dead = new Date(r.deadline);
    const daysOverdue = now > dead ? Math.ceil((now - dead) / 86400000) : 0;

    // View chỉ có tên; tra id theo họ tên để xét quyền xem luồng ý kiến.
    state.taskParties[r.task_id] = {
      assigned_to: state.accounts.find((a) => a.full_name === r.owner_name)?.id,
      leader_in_charge: state.accounts.find((a) => a.full_name === r.leader_name)?.id,
      created_by: null,
    };
    const hasDirectiveAccess = canAccessDirectiveThread(state.taskParties[r.task_id]);

    return `
      <tr id="taskRow-${r.task_id}" class="hover:bg-slate-50 border-b">
        <td class="p-3 max-w-[260px]">
          <div class="font-bold text-slate-800 text-xs">${escapeHtml(r.task_title)}</div>
          <div class="text-[10px] text-red-700 font-semibold mt-0.5">Văn bản: ${escapeHtml(r.resolution_code)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">Hạn: ${formatDateTime(r.deadline)}</div>
        </td>
        <td class="p-3 font-semibold">${escapeHtml(r.owner_name)} <br><span class="text-[10px] text-slate-500 font-normal">${DEPT_NAMES[r.owner_department] || escapeHtml(r.owner_org)}</span></td>
        <td class="p-3 font-medium text-slate-700">${escapeHtml(r.leader_name)}</td>
        <td class="p-3 text-center font-bold ${daysOverdue > 0 ? 'text-red-600' : 'text-slate-600'}">${daysOverdue > 0 ? daysOverdue + ' ngày' : 'Trong hạn'}</td>
        <td class="p-3 font-medium text-slate-700 max-w-[180px] truncate" title="${escapeHtml(r.expected_product)}">${escapeHtml(r.expected_product)}</td>
        <td class="p-3 text-center">${alertBadgeHtml(r)}</td>
        <td class="p-3 text-center space-x-1 whitespace-nowrap">
          <button data-action="openReassignModal" data-task-id="${r.task_id}" class="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-[11px]">Can thiệp</button>
          ${directiveToggleBtnHtml(r.task_id, hasDirectiveAccess)}
        </td>
      </tr>
      ${directiveThreadRowHtml(r.task_id, 7)}
    `;
  }).join('');
}
