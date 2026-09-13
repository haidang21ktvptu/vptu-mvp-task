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
    notifyError('Hạn hoàn thành phải sau thời điểm hiện tại. Chọn lại ngày.');
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
  notifySuccess('Đã phát hành giao việc.');
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

// Mức cảnh báo (DESIGN mục 2): nhãn màu mức + dải 4px bên trái dòng (lớp r-*).
const ALERT = {
  DO: { row: 'r-do', cls: 'muc-do', label: (d) => `Quá hạn · ${d} ngày` },
  DO_DAC_BIET: { row: 'r-dodb', cls: 'muc-dodb', label: (d) => `‼ Đỏ đặc biệt · ${d} ngày` },
  TU_CHOI: { row: 'r-do', cls: 'muc-do', label: () => 'Từ chối nhận việc' },
  CHUA_GIAO: { row: '', cls: '', label: () => 'Chưa phân công' },
  XANH: { row: 'r-xanh', cls: 'muc-xanh', label: () => 'Trong hạn' },
  HOAN_THANH: { row: 'r-ht', cls: 'muc-xanh', label: () => 'Đã hoàn thành' },
  VANG: { row: 'r-vang', cls: 'muc-vang', label: () => 'Gần đến hạn' },
};

function alertBadgeHtml(r, daysOverdue) {
  const a = ALERT[r.alert_level] || ALERT.VANG;
  return `<span class="muc ${a.cls}">${a.label(daysOverdue)}</span>`;
}

function renderA1Table(list) {
  const tbody = $('exceptionTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="trong">Không có nhiệm vụ nào phù hợp điều kiện lọc.</td></tr>`;
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

    const rejectHtml = r.alert_level === 'TU_CHOI' && r.reject_reason ? `<small>Lý do: ${escapeHtml(r.reject_reason)}</small>` : '';
    return `
      <tr id="taskRow-${r.task_id}" class="${(ALERT[r.alert_level] || ALERT.VANG).row}">
        <td class="tieude">${escapeHtml(r.task_title)}<small>Văn bản: ${escapeHtml(r.resolution_code)}</small>${rejectHtml}</td>
        <td class="nguoi" data-nhan="Người thực hiện">${escapeHtml(r.owner_name)}<small>${DEPT_NAMES[r.owner_department] || escapeHtml(r.owner_org)}</small></td>
        <td data-nhan="Lãnh đạo phụ trách">${escapeHtml(r.leader_name)}</td>
        <td data-nhan="Hạn" class="whitespace-nowrap">${formatDateTime(r.deadline)}</td>
        <td data-nhan="Sản phẩm">${escapeHtml(r.expected_product)}</td>
        <td data-nhan="Mức">${alertBadgeHtml(r, daysOverdue)}</td>
        <td><div class="thao-tac">
          <button type="button" data-action="openReassignModal" data-task-id="${r.task_id}" class="btn btn-phu btn-nho">Can thiệp</button>
          ${directiveToggleBtnHtml(r.task_id, hasDirectiveAccess)}
        </div></td>
      </tr>
      ${directiveThreadRowHtml(r.task_id, 7)}
    `;
  }).join('');
}
