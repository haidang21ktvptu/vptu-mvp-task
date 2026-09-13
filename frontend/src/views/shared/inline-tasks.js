// Bảng nhiệm vụ của một cán bộ bung ngay dưới dòng cán bộ (accordion), dùng chung cho
// cây phân cấp A1 và tab KPI A2 (DASH-2/3).
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { DEPT_NAMES, taskStatusLabel } from '../../lib/constants.js';
import { findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { canAccessDirectiveThread, rememberTaskParties, directiveToggleBtnHtml, directiveThreadRowHtml } from '../../features/directives/render.js';

function progressBadgeHtml(task, now) {
  const dead = new Date(task.deadline);
  if (task.status === 'HOAN_THANH') {
    return `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 font-bold">Đã hoàn thành</span>`;
  }
  if (now > dead) {
    const diffDays = Math.ceil((now - dead) / 86400000);
    return `<span class="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-800 font-bold">Quá hạn ${diffDays} ngày</span>`;
  }
  const diffDays = Math.ceil((dead - now) / 86400000);
  if (diffDays <= 3) return `<span class="px-2 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-800 font-semibold">Còn ${diffDays} ngày</span>`;
  return `<span class="px-2 py-0.5 rounded text-[10px] bg-green-100 text-green-800">Trong hạn (còn ${diffDays} ngày)</span>`;
}

export async function generateInlineTasksHtml(staffId) {
  const staff = findAccount(staffId) || {};
  const { data: tasks } = await supabase.from('tasks').select('*')
    .eq('assigned_to', staffId).order('deadline', { ascending: true });
  if (!tasks || tasks.length === 0) {
    return `<p class="text-slate-400 text-center py-3 italic bg-white rounded border">Cán bộ hiện chưa có nhiệm vụ nào được phân công.</p>`;
  }

  const now = new Date();
  const rows = tasks.map((t) => {
    const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
    return `
      <tr id="taskRow-${t.id}" class="hover:bg-slate-50 border-b">
        <td class="p-2.5 max-w-[260px]">
          <div class="font-bold text-slate-800 text-xs">${escapeHtml(t.title)}</div>
          <div class="text-[10px] text-red-700 font-semibold mt-0.5">Số hiệu: ${escapeHtml(t.resolution_code)}</div>
        </td>
        <td class="p-2.5 text-slate-700 max-w-[200px] truncate" title="${escapeHtml(t.expected_product)}">${escapeHtml(t.expected_product)}</td>
        <td class="p-2.5 text-slate-600 font-semibold">${formatDateTime(t.deadline)}</td>
        <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">${taskStatusLabel(t.status)}</span></td>
        <td class="p-2.5 text-center">${progressBadgeHtml(t, now)}</td>
        <td class="p-2.5 text-center space-x-1 whitespace-nowrap">
          <button data-action="openReassignModal" data-task-id="${t.id}" class="bg-slate-700 hover:bg-slate-800 text-white px-2 py-1 rounded text-[11px]">Can thiệp</button>
          ${directiveToggleBtnHtml(t.id, hasDirective)}
        </td>
      </tr>
      ${directiveThreadRowHtml(t.id, 6)}
    `;
  }).join('');

  return `
    <div class="overflow-x-auto bg-white rounded border p-2 shadow-inner">
      <div class="text-[11px] font-bold text-slate-700 uppercase mb-1.5 flex justify-between items-center">
        <span>Danh sách nhiệm vụ: <b class="text-red-800">${escapeHtml(staff.full_name)}</b> (${escapeHtml(staff.position_title)} - ${DEPT_NAMES[staff.department] || ''})</span>
        <span class="text-slate-500 font-normal">Tổng: ${tasks.length} nhiệm vụ</span>
      </div>
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-600 uppercase text-[10px]">
            <th class="p-2 border-b">Nhiệm vụ & Văn bản</th>
            <th class="p-2 border-b">Sản phẩm đầu ra</th>
            <th class="p-2 border-b">Hạn chót</th>
            <th class="p-2 border-b text-center">Trạng thái</th>
            <th class="p-2 border-b text-center">Tiến độ hạn</th>
            <th class="p-2 border-b text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">${rows}</tbody>
      </table>
    </div>
  `;
}

// Nút "Chi tiết việc" trên bảng cán bộ: mở/đóng dòng chi tiết ngay dưới (A1 cây + A2 KPI).
export async function toggleTableRowAccordion({ rowId, staffId }, btn) {
  const row = $(rowId);
  const isHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden');

  if (btn) {
    btn.innerText = isHidden ? '✕ Đóng việc' : 'Chi tiết việc';
    btn.classList.toggle('bg-red-800', isHidden);
    btn.classList.toggle('bg-slate-700', !isHidden);
  }

  if (isHidden) {
    const container = row.querySelector('td');
    container.innerHTML = `<p class="text-slate-400 text-center py-2">Đang tải nhiệm vụ của cán bộ...</p>`;
    container.innerHTML = await generateInlineTasksHtml(staffId);
  }
}

export function staffDetailButtonHtml(btnId, rowId, staffId) {
  return `<button id="${btnId}" data-action="toggleTableRowAccordion" data-row-id="${rowId}" data-staff-id="${staffId}" class="bg-slate-700 hover:bg-slate-800 text-white px-2.5 py-1 rounded text-[11px] font-semibold">Chi tiết việc</button>`;
}

registerActions({ toggleTableRowAccordion });
