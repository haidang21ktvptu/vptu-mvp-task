// View A3 — Chuyên viên: danh sách việc của tôi sắp theo ưu tiên (quá hạn → gần hạn → đang làm →
// xong), thanh thống kê 4 ô (DASH-4), modal bắt buộc tiếp nhận (TASK-3), nộp minh chứng (TASK-7).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, escapeHtml, formatDateTime, filterRowsByKeyword } from '../../lib/dom.js';
import { taskStatusLabel } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { canAccessDirectiveThread, rememberTaskParties, directiveToggleBtnHtml, directiveThreadRowHtml, loadDirectiveUnreadMap } from '../../features/directives/render.js';
import { a3Template } from './template.js';
import { mountAcceptModal, showMandatoryModal } from './accept-modal.js';
import { mountEvidenceModal } from './evidence-modal.js';

const myTasks = new Map(); // id -> task, để modal tiếp nhận đọc lại theo data-task-id

// Trọng số ưu tiên: 1 quá hạn, 2 gần hạn (≤ 72 giờ), 3 đang làm, 4 hoàn thành.
function withPriority(t, now) {
  const dead = new Date(t.deadline);
  let weight = 3;
  if (t.status === 'HOAN_THANH') weight = 4;
  else if (now > dead) weight = 1;
  else if ((dead - now) / 3600000 <= 72) weight = 2;
  return { ...t, weight, deadlineTime: dead.getTime() };
}

const PRIORITY = {
  1: { badge: `<span class="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white font-bold animate-pulse">🚨 QUÁ HẠN</span>`, row: 'border-b bg-red-50/50 hover:bg-red-50', deadline: 'text-red-700' },
  2: { badge: `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500 text-white font-bold">⚡ GẦN ĐẾN HẠN</span>`, row: 'border-b bg-yellow-50/40 hover:bg-yellow-50', deadline: 'text-amber-700' },
  3: { badge: `<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-semibold">Đang làm</span>`, row: 'border-b hover:bg-slate-50', deadline: 'text-slate-700' },
  4: { badge: `<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium">Hoàn tất</span>`, row: 'border-b hover:bg-slate-50', deadline: 'text-slate-700' },
};

function actionCellHtml(t, hasDirective) {
  const directive = directiveToggleBtnHtml(t.id, hasDirective);
  switch (t.status) {
    case 'CHO_TIEP_NHAN': return `<button data-action="showMandatoryModal" data-task-id="${t.id}" class="bg-amber-600 text-white px-2 py-1 rounded font-bold">Xác nhận việc</button>`;
    case 'DANG_THUC_HIEN': return `<button data-action="openEvidenceModal" data-task-id="${t.id}" class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-semibold">Nộp Minh Chứng</button> ${directive}`;
    case 'CHO_DUYET': return `<span class="text-purple-600 font-semibold">Chờ duyệt</span> ${directive}`;
    case 'HOAN_THANH': return `<span class="text-green-600 font-bold">✓ Hoàn thành</span> ${directive}`;
    case 'TU_CHOI_TIEP_NHAN': return `<span class="text-rose-600 font-semibold">Đã từ chối</span>`;
    default: return '';
  }
}

function taskRowHtml(t) {
  const p = PRIORITY[t.weight];
  const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
  const searchData = `${t.title} ${t.resolution_code}`.toLowerCase();
  const statusCls = t.status === 'DANG_THUC_HIEN' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700';
  return `
    <tr id="taskRow-${t.id}" data-search="${escapeHtml(searchData)}" class="${p.row}">
      <td class="p-3 text-center">${p.badge}</td>
      <td class="p-3 font-medium text-slate-800">${escapeHtml(t.title)} <br><span class="text-[10px] text-slate-500">${escapeHtml(t.resolution_code)}</span></td>
      <td class="p-3 font-medium text-slate-700">${escapeHtml(t.leader?.full_name) || 'Chưa chỉ định'}</td>
      <td class="p-3 text-slate-600">${escapeHtml(t.expected_product)}</td>
      <td class="p-3 font-bold ${p.deadline}">${formatDateTime(t.deadline)}</td>
      <td class="p-3 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusCls}">${taskStatusLabel(t.status)}</span></td>
      <td class="p-3 text-center space-x-1">${actionCellHtml(t, hasDirective)}</td>
    </tr>
    ${directiveThreadRowHtml(t.id, 7)}
  `;
}

export async function loadChuyenVienData() {
  await loadDirectiveUnreadMap();
  const { data } = await supabase.from('tasks')
    .select('*, leader:leader_in_charge(full_name)')
    .eq('assigned_to', state.user.id);
  const tasks = data || [];
  myTasks.clear();
  tasks.forEach((t) => myTasks.set(t.id, t));

  const pendingTask = tasks.find((t) => t.status === 'CHO_TIEP_NHAN');
  if (pendingTask) showMandatoryModal(pendingTask);
  else show('mandatoryAcceptModal', false);

  const now = new Date();
  const sorted = tasks.map((t) => withPriority(t, now))
    .sort((a, b) => (a.weight !== b.weight ? a.weight - b.weight : a.deadlineTime - b.deadlineTime));

  setText('cvStatTotal', tasks.length);
  setText('cvStatOverdue', sorted.filter((t) => t.weight === 1).length);
  setText('cvStatWarning', sorted.filter((t) => t.weight === 2).length);
  setText('cvStatCompleted', sorted.filter((t) => t.weight === 4).length);

  const tbody = $('chuyenVienTableBody');
  tbody.innerHTML = sorted.length === 0
    ? `<tr><td colspan="7" class="p-4 text-center text-slate-400">Đồng chí chưa có nhiệm vụ nào.</td></tr>`
    : sorted.map(taskRowHtml).join('');
}

function mount() {
  $('viewChuyenVien').innerHTML = a3Template;
  mountAcceptModal(loadChuyenVienData);
  mountEvidenceModal(loadChuyenVienData);
  $('cvTaskSearch').addEventListener('input', (e) => filterRowsByKeyword('chuyenVienTableBody', e.target.value));
  registerActions({
    loadChuyenVienData,
    showMandatoryModal: ({ taskId }) => showMandatoryModal(myTasks.get(taskId)),
  });
}

export function registerA3View() {
  mount();
  registerView('A3', { init: loadChuyenVienData, reload: loadChuyenVienData });
}
