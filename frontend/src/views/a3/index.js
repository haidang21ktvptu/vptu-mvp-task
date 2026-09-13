// View A3 — Chuyên viên: danh sách việc của tôi sắp theo ưu tiên (quá hạn → gần hạn → đang làm →
// xong), thanh thống kê 4 ô (DASH-4), modal bắt buộc tiếp nhận (TASK-3), nộp minh chứng (TASK-7).
import { supabase } from '../../lib/supabase.js';
import { $, show, setText, escapeHtml, formatDateTime, filterRowsByKeyword } from '../../lib/dom.js';
import { taskStatusLabel } from '../../lib/constants.js';
import { state } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { setActiveNav } from '../shell.js';
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

// Ưu tiên → lớp dòng (dải màu bên trái, DESIGN mục 2) và ghi chú hạn.
const PRIORITY = {
  1: { row: 'r-do', note: (d) => `Quá hạn ${d} ngày` },
  2: { row: 'r-vang', note: (d) => `Còn ${d} ngày` },
  3: { row: 'r-xanh', note: () => '' },
  4: { row: 'r-ht', note: () => '' },
};

const STATUS_CLS = { CHO_TIEP_NHAN: 'muc-vang', CHO_DUYET: 'muc-vang', HOAN_THANH: 'muc-xanh', TU_CHOI_TIEP_NHAN: 'muc-do' };

function actionCellHtml(t, hasDirective) {
  const btn = (action, label) => `<button type="button" data-action="${action}" data-task-id="${t.id}" class="btn btn-phu btn-nho">${label}</button>`;
  const directive = directiveToggleBtnHtml(t.id, hasDirective);
  switch (t.status) {
    case 'CHO_TIEP_NHAN': return btn('showMandatoryModal', 'Xác nhận việc');
    case 'DANG_THUC_HIEN': return btn('openEvidenceModal', 'Nộp minh chứng') + directive;
    case 'CHO_DUYET':
    case 'HOAN_THANH': return directive;
    default: return '';
  }
}

function taskRowHtml(t, now) {
  const p = PRIORITY[t.weight];
  const days = Math.ceil(Math.abs(now - t.deadlineTime) / 86400000);
  const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
  const searchData = `${t.title} ${t.resolution_code}`.toLowerCase();
  const note = p.note(days);
  return `
    <tr id="taskRow-${t.id}" data-search="${escapeHtml(searchData)}" class="${p.row}">
      <td class="tieude">${escapeHtml(t.title)}<small>Văn bản: ${escapeHtml(t.resolution_code)}</small></td>
      <td data-nhan="Lãnh đạo phụ trách">${escapeHtml(t.leader?.full_name) || 'Chưa chỉ định'}</td>
      <td data-nhan="Sản phẩm">${escapeHtml(t.expected_product)}</td>
      <td data-nhan="Hạn" class="nguoi whitespace-nowrap">${formatDateTime(t.deadline)}${note ? `<small>${note}</small>` : ''}</td>
      <td data-nhan="Trạng thái"><span class="muc ${STATUS_CLS[t.status] || ''}">${taskStatusLabel(t.status)}</span></td>
      <td><div class="thao-tac">${actionCellHtml(t, hasDirective)}</div></td>
    </tr>
    ${directiveThreadRowHtml(t.id, 6)}
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
    ? `<tr><td colspan="6" class="trong">Đồng chí chưa có nhiệm vụ nào.</td></tr>`
    : sorted.map((t) => taskRowHtml(t, now)).join('');
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
  registerView('A3', {
    nav: [{ id: 'navA3Tasks', label: 'Nhiệm vụ của tôi', action: 'loadChuyenVienData' }],
    init() {
      setActiveNav('navA3Tasks');
      loadChuyenVienData();
    },
    reload: loadChuyenVienData,
  });
}
