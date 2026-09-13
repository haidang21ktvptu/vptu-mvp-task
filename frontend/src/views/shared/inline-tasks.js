// Bảng nhiệm vụ của một cán bộ bung ngay dưới dòng cán bộ (accordion), dùng chung cho
// cây phân cấp A1 và tab KPI A2 (DASH-2/3). Kèm chip KPI nhóm dùng ở cây phân cấp.
import { supabase } from '../../lib/supabase.js';
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { DEPT_NAMES, taskStatusLabel } from '../../lib/constants.js';
import { findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { canAccessDirectiveThread, rememberTaskParties, directiveToggleBtnHtml, directiveThreadRowHtml } from '../../features/directives/render.js';

// Chip KPI theo màu mức (DESIGN mục 2): tổng · trong hạn · gần hạn · quá hạn · hoàn thành.
// Màu là thông tin: chỉ tô màu mức khi số lớn hơn 0.
export function kpiChipsHtml(kpi, totalLabel = 'Tổng') {
  const chip = (label, n, cls) => `<span class="muc ${n > 0 ? cls : ''}">${label}: ${n}</span>`;
  return [
    chip(totalLabel, kpi.total, ''),
    chip('Trong hạn', kpi.onTime, 'muc-xanh'),
    chip('Gần hạn', kpi.warningSoon, 'muc-vang'),
    chip('Quá hạn', kpi.overdue, 'muc-do'),
    chip('Hoàn thành', kpi.completed, ''),
  ].join('');
}

// Tiến độ theo hạn: lớp dòng (dải màu bên trái) + nhãn mức.
export function progressOf(task, now) {
  const dead = new Date(task.deadline);
  if (task.status === 'HOAN_THANH') return { row: 'r-ht', badge: `<span class="muc muc-xanh">Đã hoàn thành</span>` };
  if (now > dead) {
    const d = Math.ceil((now - dead) / 86400000);
    return { row: 'r-do', badge: `<span class="muc muc-do">Quá hạn · ${d} ngày</span>` };
  }
  const d = Math.ceil((dead - now) / 86400000);
  if (d <= 3) return { row: 'r-vang', badge: `<span class="muc muc-vang">Còn ${d} ngày</span>` };
  return { row: 'r-xanh', badge: `<span class="muc muc-xanh">Trong hạn · còn ${d} ngày</span>` };
}

export async function generateInlineTasksHtml(staffId) {
  const staff = findAccount(staffId) || {};
  const { data: tasks } = await supabase.from('tasks').select('*')
    .eq('assigned_to', staffId).order('deadline', { ascending: true });
  if (!tasks || tasks.length === 0) {
    return `<p class="chu-phu text-center py-3">Cán bộ chưa có nhiệm vụ nào được phân công.</p>`;
  }

  const now = new Date();
  const rows = tasks.map((t) => {
    const hasDirective = canAccessDirectiveThread(rememberTaskParties(t));
    const p = progressOf(t, now);
    return `
      <tr id="taskRow-${t.id}" class="${p.row}">
        <td class="tieude">${escapeHtml(t.title)}<small>Văn bản: ${escapeHtml(t.resolution_code)}</small></td>
        <td data-nhan="Sản phẩm">${escapeHtml(t.expected_product)}</td>
        <td data-nhan="Hạn" class="whitespace-nowrap">${formatDateTime(t.deadline)}</td>
        <td data-nhan="Trạng thái"><span class="muc">${taskStatusLabel(t.status)}</span></td>
        <td data-nhan="Tiến độ">${p.badge}</td>
        <td><div class="thao-tac">
          <button type="button" data-action="openReassignModal" data-task-id="${t.id}" class="btn btn-phu btn-nho">Can thiệp</button>
          ${directiveToggleBtnHtml(t.id, hasDirective)}
        </div></td>
      </tr>
      ${directiveThreadRowHtml(t.id, 6)}
    `;
  }).join('');

  return `
    <div class="bang">
      <div class="bang-dau">
        <h2 class="text-[15px]">Nhiệm vụ của ${escapeHtml(staff.full_name)}<span class="chu-phu">${escapeHtml(staff.position_title)} · ${DEPT_NAMES[staff.department] || ''}</span></h2>
        <span class="chu-phu">${tasks.length} nhiệm vụ</span>
      </div>
      <div class="bang-cuon">
        <table>
          <thead>
            <tr>
              <th>Nhiệm vụ</th>
              <th>Sản phẩm</th>
              <th>Hạn</th>
              <th>Trạng thái</th>
              <th>Tiến độ</th>
              <th class="phai">Thao tác</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// Nút "Chi tiết việc" trên bảng cán bộ: mở/đóng dòng chi tiết ngay dưới (A1 cây + A2 KPI).
export async function toggleTableRowAccordion({ rowId, staffId }, btn) {
  const row = $(rowId);
  const isHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden');
  if (btn) {
    btn.innerText = isHidden ? 'Đóng chi tiết' : 'Chi tiết việc';
    btn.setAttribute('aria-expanded', String(isHidden));
  }

  if (isHidden) {
    const container = row.querySelector('td');
    container.innerHTML = `<p class="chu-phu text-center py-2">Đang tải nhiệm vụ của cán bộ</p>`;
    container.innerHTML = await generateInlineTasksHtml(staffId);
  }
}

export function staffDetailButtonHtml(btnId, rowId, staffId) {
  return `<button type="button" id="${btnId}" data-action="toggleTableRowAccordion" data-row-id="${rowId}" data-staff-id="${staffId}" class="btn btn-phu btn-nho" aria-expanded="false">Chi tiết việc</button>`;
}

registerActions({ toggleTableRowAccordion });
