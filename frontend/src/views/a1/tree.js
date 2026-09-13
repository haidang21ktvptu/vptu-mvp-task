// A1 Tab 2: cây phân cấp CVP → PCVP → Trưởng phòng → Cán bộ, KPI từng nút, mở chi tiết inline
// (DASH-2). Chỉ những gì RLS cho đọc mới có trong state.allTasks.
import { supabase } from '../../lib/supabase.js';
import { $, setText, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, isChief } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { calculateGroupKPI } from '../shared/kpi.js';
import { generateInlineTasksHtml, staffDetailButtonHtml, kpiChipsHtml } from '../shared/inline-tasks.js';

export async function loadA1StaffsTab() {
  const { data: allTasks } = await supabase.from('tasks').select('*');
  state.allTasks = allTasks || [];
  const container = $('a1TreeContainer');

  if (isChief()) {
    setText('a1TreeHeaderTitle', 'Khối các Phó Chánh Văn phòng phụ trách');
    setText('a1TreeHeaderDesc', 'Bấm vào đồng chí Phó Chánh Văn phòng để xem các phòng, hoặc mở việc trực tiếp của đồng chí đó');
    const pcvpList = state.accounts.filter((a) => a.role_group === 'A1' && a.id !== state.user.id);
    container.innerHTML = pcvpList.map(pcvpNodeHtml).join('');
    return;
  }

  setText('a1TreeHeaderTitle', 'Các phòng thuộc khối phụ trách');
  setText('a1TreeHeaderDesc', 'Bấm vào phòng để xem cán bộ và nhiệm vụ của từng người');
  const myLeaders = state.accounts.filter((a) => a.role_group === 'A2' && a.manager_id === state.user.id);
  renderDeptLeaderNodes(container, myLeaders);
}

function pcvpNodeHtml(pcvp) {
  const blockStaffs = state.accounts.filter((a) => a.manager_id === pcvp.id);
  const kpiBlock = calculateGroupKPI(blockStaffs.map((s) => s.id));
  const kpiPersonal = calculateGroupKPI([pcvp.id]);

  return `
    <div class="the overflow-hidden">
      <div class="nut-dau">
        <button type="button" data-action="toggleTreeBlock" data-pcvp-id="${pcvp.id}" class="flex items-center gap-2 text-left" aria-expanded="false">
          <span id="icon-pcvpBlock-${pcvp.id}" class="mui" aria-hidden="true">▶</span>
          <span class="nguoi"><b class="font-medium">${escapeHtml(pcvp.full_name)}</b><small>${escapeHtml(pcvp.position_title)}</small></span>
        </button>
        <div class="chip-kpi">
          ${kpiChipsHtml(kpiBlock, 'Khối')}
          <button type="button" id="btnPcvpDirect-${pcvp.id}" data-action="toggleInlinePersonalTask" data-staff-id="${pcvp.id}" class="btn btn-phu btn-nho">
            Việc trực tiếp (${kpiPersonal.total})
          </button>
        </div>
      </div>
      <!-- Nhiệm vụ trực tiếp của PCVP (bung ngay dưới) -->
      <div id="pcvpDirectBox-${pcvp.id}" class="hidden nut-con"></div>
      <!-- Các Trưởng phòng thuộc khối -->
      <div id="pcvpBlock-${pcvp.id}" class="hidden nut-con space-y-3"></div>
    </div>
  `;
}

async function toggleInlinePersonalTask({ staffId }) {
  const box = $(`pcvpDirectBox-${staffId}`);
  const btn = $(`btnPcvpDirect-${staffId}`);
  const isHidden = box.classList.contains('hidden');
  box.classList.toggle('hidden');
  if (btn) btn.innerText = isHidden ? 'Đóng việc trực tiếp' : `Việc trực tiếp (${calculateGroupKPI([staffId]).total})`;

  if (isHidden) {
    box.innerHTML = `<p class="chu-phu text-center py-2">Đang tải nhiệm vụ trực tiếp</p>`;
    box.innerHTML = await generateInlineTasksHtml(staffId);
  }
}

function toggleTreeBlock({ pcvpId }, btn) {
  const block = $(`pcvpBlock-${pcvpId}`);
  const icon = $(`icon-pcvpBlock-${pcvpId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';
  btn?.setAttribute('aria-expanded', String(isHidden));

  if (isHidden) {
    const myLeaders = state.accounts.filter((a) => a.role_group === 'A2' && a.manager_id === pcvpId);
    renderDeptLeaderNodes(block, myLeaders);
  }
}

function renderDeptLeaderNodes(targetElement, leadersList) {
  if (!leadersList || leadersList.length === 0) {
    targetElement.innerHTML = `<p class="chu-phu py-2">Không có phòng trực thuộc.</p>`;
    return;
  }

  targetElement.innerHTML = leadersList.map((ld) => {
    const deptStaffs = state.accounts.filter((a) => a.department === ld.department);
    const kpi = calculateGroupKPI(deptStaffs.map((s) => s.id));
    return `
      <div class="the overflow-hidden">
        <div class="nut-dau">
          <button type="button" data-action="toggleDeptStaffBlock" data-leader-id="${ld.id}" data-department="${ld.department}" class="flex items-center gap-2 text-left" aria-expanded="false">
            <span id="icon-deptBlock-${ld.id}" class="mui" aria-hidden="true">▶</span>
            <span class="nguoi"><b class="font-medium">${DEPT_NAMES[ld.department]}</b><small>Trưởng phòng: ${escapeHtml(ld.full_name)}</small></span>
          </button>
          <div class="chip-kpi">${kpiChipsHtml(kpi, 'Tổng')}</div>
        </div>
        <div id="deptBlock-${ld.id}" class="hidden nut-con"></div>
      </div>
    `;
  }).join('');
}

function staffRowHtml(st) {
  const kpi = calculateGroupKPI([st.id]);
  return `
    <tr>
      <td class="nguoi">${escapeHtml(st.full_name)}<small>${escapeHtml(st.position_title)}</small></td>
      <td class="so" data-nhan="Tổng việc">${kpi.total}</td>
      <td class="so" data-nhan="Trong hạn">${kpi.onTime}</td>
      <td class="so" data-nhan="Gần hạn">${kpi.warningSoon}</td>
      <td class="so" data-nhan="Quá hạn">${kpi.overdue}</td>
      <td class="so" data-nhan="Hoàn thành">${kpi.completed}</td>
      <td><div class="thao-tac">${staffDetailButtonHtml(`btnToggleTree-${st.id}`, `treeDetailRow-${st.id}`, st.id)}</div></td>
    </tr>
    <!-- Dòng chi tiết bung ngay dưới cán bộ đó -->
    <tr id="treeDetailRow-${st.id}" class="hidden">
      <td colspan="7" id="treeDetailContainer-${st.id}"></td>
    </tr>
  `;
}

function toggleDeptStaffBlock({ leaderId, department }, btn) {
  const block = $(`deptBlock-${leaderId}`);
  const icon = $(`icon-deptBlock-${leaderId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';
  btn?.setAttribute('aria-expanded', String(isHidden));
  if (!isHidden) return;

  const staffs = state.accounts.filter((a) => a.department === department);
  block.innerHTML = `
    <div class="bang"><div class="bang-cuon">
      <table>
        <thead>
          <tr>
            <th>Cán bộ</th>
            <th class="so">Tổng việc</th>
            <th class="so">Trong hạn</th>
            <th class="so">Gần hạn</th>
            <th class="so">Quá hạn</th>
            <th class="so">Hoàn thành</th>
            <th class="phai">Thao tác</th>
          </tr>
        </thead>
        <tbody>${staffs.map(staffRowHtml).join('')}</tbody>
      </table>
    </div></div>
  `;
}

export function isStaffsTabVisible() {
  return !$('tabContentA1Staffs').classList.contains('hidden');
}

registerActions({ loadA1StaffsTab, toggleInlinePersonalTask, toggleTreeBlock, toggleDeptStaffBlock });
