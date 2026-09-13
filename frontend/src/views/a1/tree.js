// A1 Tab 2: cây phân cấp CVP → PCVP → Trưởng phòng → Cán bộ, KPI từng nút, mở chi tiết inline
// (DASH-2). Chỉ những gì RLS cho đọc mới có trong state.allTasks.
import { supabase } from '../../lib/supabase.js';
import { $, setText, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, isChief } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { calculateGroupKPI } from '../shared/kpi.js';
import { generateInlineTasksHtml, staffDetailButtonHtml } from '../shared/inline-tasks.js';

export async function loadA1StaffsTab() {
  const { data: allTasks } = await supabase.from('tasks').select('*');
  state.allTasks = allTasks || [];
  const container = $('a1TreeContainer');

  if (isChief()) {
    setText('a1TreeHeaderTitle', 'Cây Phân Cấp: Khối Các Phó Chánh Văn Phòng Phụ Trách');
    setText('a1TreeHeaderDesc', 'Nhấp vào đồng chí PCVP để xem Trưởng phòng, hoặc bấm nút đỏ để xem việc trực tiếp của PCVP');
    const pcvpList = state.accounts.filter((a) => a.role_group === 'A1' && a.id !== state.user.id);
    container.innerHTML = pcvpList.map(pcvpNodeHtml).join('');
    return;
  }

  setText('a1TreeHeaderTitle', 'Cây Phân Cấp: Các Trưởng Phòng Chuyên Môn Trực Thuộc Khối');
  setText('a1TreeHeaderDesc', 'Nhấp để mở xem cán bộ trong phòng và theo dõi nhiệm vụ trực tiếp');
  const myLeaders = state.accounts.filter((a) => a.role_group === 'A2' && a.manager_id === state.user.id);
  renderDeptLeaderNodes(container, myLeaders);
}

function pcvpNodeHtml(pcvp) {
  const blockStaffs = state.accounts.filter((a) => a.manager_id === pcvp.id);
  const kpiBlock = calculateGroupKPI(blockStaffs.map((s) => s.id));
  const kpiPersonal = calculateGroupKPI([pcvp.id]);

  return `
    <div class="border rounded-lg overflow-hidden bg-white shadow-sm">
      <div class="p-3.5 bg-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-l-4 border-red-800">
        <div data-action="toggleTreeBlock" data-pcvp-id="${pcvp.id}" class="flex items-center gap-2 cursor-pointer flex-1">
          <span id="icon-pcvpBlock-${pcvp.id}" class="text-sm font-bold text-red-800">▶</span>
          <div>
            <span class="font-bold text-slate-900 text-xs">${escapeHtml(pcvp.full_name)}</span>
            <span class="text-[11px] text-slate-600 font-medium"> — ${escapeHtml(pcvp.position_title)}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 text-[10px] items-center">
          <span class="px-2 py-0.5 bg-white rounded border font-bold text-slate-700">Khối: ${kpiBlock.total} việc</span>
          <span class="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded font-semibold">Trong hạn: ${kpiBlock.onTime}</span>
          <span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold">Gần hạn: ${kpiBlock.warningSoon}</span>
          <span class="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded font-bold">Quá hạn: ${kpiBlock.overdue}</span>
          <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold">Xong: ${kpiBlock.completed}</span>
          <!-- NÚT XEM NHIỆM VỤ TRỰC TIẾP CỦA PCVP (BẬT/TẮT INLINE) -->
          <button id="btnPcvpDirect-${pcvp.id}" data-action="toggleInlinePersonalTask" data-staff-id="${pcvp.id}" class="bg-red-800 hover:bg-red-900 text-white font-bold px-2.5 py-1 rounded shadow ml-1">
            📌 Việc trực tiếp PCVP (${kpiPersonal.total})
          </button>
        </div>
      </div>

      <!-- KHUNG NHIỆM VỤ TRỰC TIẾP CỦA Đ/C PCVP (BUNG NGAY DƯỚI) -->
      <div id="pcvpDirectBox-${pcvp.id}" class="hidden p-3 bg-red-50/50 border-t border-red-200"></div>

      <!-- KHUNG DANH SÁCH CÁC TRƯỞNG PHÒNG THUỘC KHỐI PCVP -->
      <div id="pcvpBlock-${pcvp.id}" class="hidden p-3 bg-slate-50 border-t space-y-3"></div>
    </div>
  `;
}

async function toggleInlinePersonalTask({ staffId }) {
  const box = $(`pcvpDirectBox-${staffId}`);
  const btn = $(`btnPcvpDirect-${staffId}`);
  const isHidden = box.classList.contains('hidden');
  box.classList.toggle('hidden');

  if (btn) {
    btn.innerText = isHidden ? '✕ Đóng việc PCVP' : `📌 Việc trực tiếp PCVP (${calculateGroupKPI([staffId]).total})`;
    btn.classList.toggle('bg-slate-700', isHidden);
    btn.classList.toggle('bg-red-800', !isHidden);
  }

  if (isHidden) {
    box.innerHTML = `<p class="text-slate-400 text-center py-2">Đang tải nhiệm vụ trực tiếp của PCVP...</p>`;
    box.innerHTML = await generateInlineTasksHtml(staffId);
  }
}

function toggleTreeBlock({ pcvpId }) {
  const block = $(`pcvpBlock-${pcvpId}`);
  const icon = $(`icon-pcvpBlock-${pcvpId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';

  if (isHidden) {
    const myLeaders = state.accounts.filter((a) => a.role_group === 'A2' && a.manager_id === pcvpId);
    renderDeptLeaderNodes(block, myLeaders);
  }
}

function renderDeptLeaderNodes(targetElement, leadersList) {
  if (!leadersList || leadersList.length === 0) {
    targetElement.innerHTML = `<p class="text-slate-400 py-2 italic">Không có phòng ban phụ trách trực thuộc.</p>`;
    return;
  }

  targetElement.innerHTML = leadersList.map((ld) => {
    const deptStaffs = state.accounts.filter((a) => a.department === ld.department);
    const kpi = calculateGroupKPI(deptStaffs.map((s) => s.id));
    return `
      <div class="border rounded-lg bg-white overflow-hidden shadow-xs">
        <div data-action="toggleDeptStaffBlock" data-leader-id="${ld.id}" data-department="${ld.department}" class="p-3 bg-white hover:bg-slate-100 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-l-4 border-slate-700">
          <div class="flex items-center gap-2">
            <span id="icon-deptBlock-${ld.id}" class="text-xs font-bold text-slate-700">▶</span>
            <div>
              <span class="font-bold text-slate-800 text-xs">${DEPT_NAMES[ld.department]}</span>
              <span class="text-[11px] text-slate-500"> (Trưởng phòng: <b>${escapeHtml(ld.full_name)}</b>)</span>
            </div>
          </div>
          <div class="flex gap-2 text-[10px] items-center">
            <span class="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">Tổng việc: ${kpi.total}</span>
            <span class="px-2 py-0.5 bg-green-50 text-green-700 rounded font-semibold">Trong hạn: ${kpi.onTime}</span>
            <span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-semibold">Gần hạn: ${kpi.warningSoon}</span>
            <span class="px-2 py-0.5 bg-red-50 text-red-700 rounded font-bold">Quá hạn: ${kpi.overdue}</span>
            <span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">Hoàn thành: ${kpi.completed}</span>
          </div>
        </div>
        <div id="deptBlock-${ld.id}" class="hidden p-3 bg-slate-50/50 border-t"></div>
      </div>
    `;
  }).join('');
}

function staffRowHtml(st) {
  const kpi = calculateGroupKPI([st.id]);
  return `
    <tr class="hover:bg-slate-50">
      <td class="p-2 font-bold text-slate-800">${escapeHtml(st.full_name)}</td>
      <td class="p-2 text-slate-500">${escapeHtml(st.position_title)}</td>
      <td class="p-2 text-center font-bold">${kpi.total}</td>
      <td class="p-2 text-center text-green-700 font-semibold">${kpi.onTime}</td>
      <td class="p-2 text-center text-amber-600 font-semibold">${kpi.warningSoon}</td>
      <td class="p-2 text-center text-red-600 font-bold">${kpi.overdue}</td>
      <td class="p-2 text-center text-blue-700 font-bold">${kpi.completed}</td>
      <td class="p-2 text-center">${staffDetailButtonHtml(`btnToggleTree-${st.id}`, `treeDetailRow-${st.id}`, st.id)}</td>
    </tr>
    <!-- DÒNG INLINE BUNG RA NGAY DƯỚI CÁN BỘ ĐÓ -->
    <tr id="treeDetailRow-${st.id}" class="hidden bg-slate-50/80">
      <td colspan="8" class="p-3 border-b" id="treeDetailContainer-${st.id}"></td>
    </tr>
  `;
}

function toggleDeptStaffBlock({ leaderId, department }) {
  const block = $(`deptBlock-${leaderId}`);
  const icon = $(`icon-deptBlock-${leaderId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';
  if (!isHidden) return;

  const staffs = state.accounts.filter((a) => a.department === department);
  block.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse bg-white rounded border">
        <thead>
          <tr class="bg-slate-100 text-slate-600 uppercase text-[11px]">
            <th class="p-2.5 border-b">Cán bộ / Chuyên viên</th>
            <th class="p-2.5 border-b">Chức vụ</th>
            <th class="p-2.5 border-b text-center">Tổng việc</th>
            <th class="p-2.5 border-b text-center text-green-700">Trong hạn</th>
            <th class="p-2.5 border-b text-center text-amber-600">Gần hạn</th>
            <th class="p-2.5 border-b text-center text-red-600 font-bold">Quá hạn</th>
            <th class="p-2.5 border-b text-center text-blue-700 font-bold">Hoàn thành</th>
            <th class="p-2.5 border-b text-center">Hành động</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">${staffs.map(staffRowHtml).join('')}</tbody>
      </table>
    </div>
  `;
}

export function isStaffsTabVisible() {
  return !$('tabContentA1Staffs').classList.contains('hidden');
}

registerActions({ loadA1StaffsTab, toggleInlinePersonalTask, toggleTreeBlock, toggleDeptStaffBlock });
