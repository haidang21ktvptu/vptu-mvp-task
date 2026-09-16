// View A2 — Trưởng phòng (GĐ14): mặc định sau đăng nhập = màn hình Nhiệm vụ dùng chung (RLS lọc phòng mình; nút "Giao việc"
// mở form thống nhất 14C); mục riêng "Cán bộ trong phòng" = KPI từng người đọc v_nhiem_vu. Form giao việc và "duyệt hoàn
// thành" của luồng tasks cũ đã bỏ (xác nhận minh chứng có cấu trúc → GĐ15).
import { $ } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { setActiveNav, showSection } from '../shell.js';
import { openKl } from '../shared/kl/index.js';
import { a2Template } from './template.js';
import { renderKPITab } from './kpi.js';

const NAV = [{ id: 'tabBtnKPI', label: 'Cán bộ trong phòng', action: 'switchA2Tab', data: { tab: 'kpi' } }];

function switchA2Tab() {
  showSection('viewLanhDaoVP');
  setActiveNav('tabBtnKPI');
  renderKPITab();
}

export function registerA2View() {
  $('viewLanhDaoVP').innerHTML = a2Template;
  registerActions({ switchA2Tab });
  registerView('A2', {
    nav: NAV,
    init() { openKl({}); },
    reload() { if (!$('viewLanhDaoVP').classList.contains('hidden')) renderKPITab(); },
  });
}
