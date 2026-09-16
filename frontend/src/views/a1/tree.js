// A1 "Cán bộ thuộc quyền": cây CVP → PCVP → Trưởng phòng → Cán bộ, KPI từng nút, mở chi tiết inline (DASH-2).
// GĐ14: số liệu từ v_nhiem_vu (RLS lọc phạm vi) — KPI đánh giá theo Owner tài khoản, việc theo dõi ghi riêng (CH-2).
// Cấu trúc cây vẫn theo manager_id (thông tin tổ chức; phạm vi thật do RLS/phu_trach_phong quyết định).
import { $, setText, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, isChief } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { notifyError } from '../../components/toast.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows } from '../../lib/kl/du-lieu.js';
import { calculateGroupKPI } from '../shared/kpi.js';
import { generateInlineTasksHtml, staffDetailButtonHtml, kpiChipsHtml } from '../shared/inline-tasks.js';
import { showSection } from '../shell.js';

export async function loadA1StaffsTab() {
  showSection('viewThuongTruc');
  const container = $('a1TreeContainer');
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    state.nhiemVu = (await loadKlRows()).rows;
  } catch (e) {
    notifyError('Không đọc được nhiệm vụ: ' + e.message);
    return;
  }

  if (isChief()) {
    setText('a1TreeHeaderTitle', 'Khối các Phó Chánh Văn phòng phụ trách');
    const pcvpList = state.accounts.filter((a) => a.role_group === 'A1' && a.id !== state.user.id);
    container.innerHTML = pcvpList.map(pcvpNodeHtml).join('');
    return;
  }
  setText('a1TreeHeaderTitle', 'Các phòng thuộc khối phụ trách');
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
          ${kpiChipsHtml(kpiBlock, 'Khối là Owner')}
          <button type="button" id="btnPcvpDirect-${pcvp.id}" data-action="toggleInlinePersonalTask" data-staff-id="${pcvp.id}" class="btn btn-phu btn-nho">
            Việc trực tiếp (Owner ${kpiPersonal.owner} · theo dõi ${kpiPersonal.theoDoi})
          </button>
        </div>
      </div>
      <div id="pcvpDirectBox-${pcvp.id}" class="hidden nut-con"></div>
      <div id="pcvpBlock-${pcvp.id}" class="hidden nut-con space-y-3"></div>
    </div>
  `;
}

function toggleInlinePersonalTask({ staffId }) {
  const box = $(`pcvpDirectBox-${staffId}`);
  const btn = $(`btnPcvpDirect-${staffId}`);
  const isHidden = box.classList.contains('hidden');
  box.classList.toggle('hidden');
  const k = calculateGroupKPI([staffId]);
  if (btn) btn.innerText = isHidden ? 'Đóng việc trực tiếp' : `Việc trực tiếp (Owner ${k.owner} · theo dõi ${k.theoDoi})`;
  if (isHidden) box.innerHTML = generateInlineTasksHtml(staffId);
}

function toggleTreeBlock({ pcvpId }, btn) {
  const block = $(`pcvpBlock-${pcvpId}`);
  const icon = $(`icon-pcvpBlock-${pcvpId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';
  btn?.setAttribute('aria-expanded', String(isHidden));
  if (isHidden) renderDeptLeaderNodes(block, state.accounts.filter((a) => a.role_group === 'A2' && a.manager_id === pcvpId));
}

function renderDeptLeaderNodes(targetElement, leadersList) {
  if (!leadersList || leadersList.length === 0) {
    targetElement.innerHTML = '<p class="chu-phu py-2">Không có phòng trực thuộc.</p>';
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
          <div class="chip-kpi">${kpiChipsHtml(kpi, 'Phòng là Owner')}</div>
        </div>
        <div id="deptBlock-${ld.id}" class="hidden nut-con"></div>
      </div>
    `;
  }).join('');
}

function staffRowHtml(st) {
  const k = calculateGroupKPI([st.id]);
  return `
    <tr>
      <td class="nguoi">${escapeHtml(st.full_name)}<small>${escapeHtml(st.position_title)}</small></td>
      <td class="so" data-nhan="Owner">${k.owner}</td>
      <td class="so" data-nhan="Đang mở">${k.dangMo}</td>
      <td class="so" data-nhan="Quá hạn">${k.quaHan}</td>
      <td class="so" data-nhan="Đỏ đặc biệt">${k.doDacBiet}</td>
      <td class="so" data-nhan="Hoàn thành">${k.hoanThanh}</td>
      <td class="so chu-phu" data-nhan="Theo dõi">${k.theoDoi}</td>
      <td><div class="thao-tac">${staffDetailButtonHtml(`btnToggleTree-${st.id}`, `treeDetailRow-${st.id}`, st.id)}</div></td>
    </tr>
    <tr id="treeDetailRow-${st.id}" class="hidden"><td colspan="8" id="treeDetailContainer-${st.id}"></td></tr>
  `;
}

export const BANG_CAN_BO_DAU = `<thead><tr><th>Cán bộ</th><th class="so">Owner</th><th class="so">Đang mở</th><th class="so">Quá hạn</th>
  <th class="so">Đỏ đặc biệt</th><th class="so">Hoàn thành</th><th class="so">Đang theo dõi</th><th class="phai">Thao tác</th></tr></thead>`;

function toggleDeptStaffBlock({ leaderId, department }, btn) {
  const block = $(`deptBlock-${leaderId}`);
  const icon = $(`icon-deptBlock-${leaderId}`);
  const isHidden = block.classList.contains('hidden');
  block.classList.toggle('hidden');
  icon.innerText = isHidden ? '▼' : '▶';
  btn?.setAttribute('aria-expanded', String(isHidden));
  if (!isHidden) return;
  const staffs = state.accounts.filter((a) => a.department === department && !a.is_system);
  block.innerHTML = `<div class="bang"><div class="bang-cuon"><table>${BANG_CAN_BO_DAU}<tbody>${staffs.map(staffRowHtml).join('')}</tbody></table></div></div>`;
}

export function isStaffsTabVisible() {
  return !$('viewThuongTruc').classList.contains('hidden');
}

registerActions({ loadA1StaffsTab, toggleInlinePersonalTask, toggleTreeBlock, toggleDeptStaffBlock });
