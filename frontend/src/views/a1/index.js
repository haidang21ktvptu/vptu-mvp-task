// View A1 — Lãnh đạo Văn phòng: gắn markup, 2 tab (dashboard ngoại lệ, cây phân cấp).
import { $ } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { a1Template } from './template.js';
import { populateA1Selects, loadA1Dashboard, applyA1Filter, toggleA1GiaoViec, handleA1ModeChange, handleA1GiaoViec } from './dashboard.js';
import { loadA1StaffsTab, isStaffsTabVisible } from './tree.js';

const ACTIVE_CLS = ['border-red-800', 'text-red-800', 'font-bold'];
const INACTIVE_CLS = ['border-transparent', 'text-slate-500', 'font-semibold'];
const TABS = {
  dashboard: { btn: 'tabBtnA1Dashboard', content: 'tabContentA1Dashboard', load: loadA1Dashboard },
  staffs: { btn: 'tabBtnA1Staffs', content: 'tabContentA1Staffs', load: loadA1StaffsTab },
};

function switchA1Tab({ tab }) {
  Object.values(TABS).forEach((t) => {
    $(t.btn).classList.remove(...ACTIVE_CLS);
    $(t.btn).classList.add(...INACTIVE_CLS);
    $(t.content).classList.add('hidden');
  });
  const active = TABS[tab];
  if (!active) return;
  $(active.btn).classList.add(...ACTIVE_CLS);
  $(active.btn).classList.remove(...INACTIVE_CLS);
  $(active.content).classList.remove('hidden');
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
