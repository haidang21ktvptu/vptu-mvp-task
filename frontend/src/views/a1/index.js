// View A1 — Lãnh đạo Văn phòng: gắn markup, 2 mục thanh bên (dashboard ngoại lệ, cây phân cấp).
import { $ } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { setActiveNav } from '../shell.js';
import { a1Template } from './template.js';
import { populateA1Selects, loadA1Dashboard, applyA1Filter, toggleA1GiaoViec, handleA1ModeChange, handleA1GiaoViec } from './dashboard.js';
import { loadA1StaffsTab, isStaffsTabVisible } from './tree.js';

// Hai "tab" cũ nay là hai mục ở thanh bên (id nút giữ nguyên cho e2e).
const TABS = {
  dashboard: { btn: 'tabBtnA1Dashboard', content: 'tabContentA1Dashboard', load: loadA1Dashboard },
  staffs: { btn: 'tabBtnA1Staffs', content: 'tabContentA1Staffs', load: loadA1StaffsTab },
};
const NAV = [
  { id: TABS.dashboard.btn, label: 'Bảng điều khiển', action: 'switchA1Tab', data: { tab: 'dashboard' } },
  { id: TABS.staffs.btn, label: 'Cán bộ thuộc quyền', action: 'switchA1Tab', data: { tab: 'staffs' } },
];

function switchA1Tab({ tab }) {
  const active = TABS[tab];
  if (!active) return;
  Object.values(TABS).forEach((t) => $(t.content).classList.toggle('hidden', t !== active));
  setActiveNav(active.btn);
  active.load();
}

function mount() {
  $('viewThuongTruc').innerHTML = a1Template;
  $('a1AssignMode').addEventListener('change', (e) => handleA1ModeChange(e.target.value));
  $('a1SearchInput').addEventListener('input', applyA1Filter);
  $('a1FilterAlert').addEventListener('change', applyA1Filter);
  $('a1FilterDept').addEventListener('change', applyA1Filter);
  registerActions({ switchA1Tab, toggleA1GiaoViec, loadA1Dashboard, handleA1GiaoViec });
}

export function registerA1View() {
  mount();
  registerView('A1', {
    nav: NAV,
    init() {
      populateA1Selects();
      switchA1Tab({ tab: 'dashboard' });
    },
    // Sau khi phân công lại: nạp lại dashboard, và cả cây nếu đang mở.
    reload() {
      loadA1Dashboard();
      if (isStaffsTabVisible()) loadA1StaffsTab();
    },
  });
}
