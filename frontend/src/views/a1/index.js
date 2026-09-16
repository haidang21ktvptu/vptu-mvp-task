// View A1 — Lãnh đạo Văn phòng (GĐ14): mặc định sau đăng nhập = Tổng quan nhiệm vụ (10C); mục "Cán bộ thuộc quyền" =
// cây phân cấp đọc v_nhiem_vu; giao việc bằng form thống nhất trên màn hình Nhiệm vụ (14C). Bảng điều khiển ngoại lệ
// theo luồng tasks cũ đã bỏ (dashboard ngoại lệ 4 trường của 1400 → GĐ17).
import { $ } from '../../lib/dom.js';
import { registerActions } from '../../lib/actions.js';
import { registerView } from '../registry.js';
import { setActiveNav } from '../shell.js';
import { a1Template } from './template.js';
import { loadA1StaffsTab, isStaffsTabVisible } from './tree.js';
import { KL_DASHBOARD_NAV, openKlDashboard } from './kl-dashboard/index.js';

const NAV = [
  KL_DASHBOARD_NAV, // Tổng quan nhiệm vụ (GĐ10) — section dùng chung, phạm vi do RLS
  { id: 'tabBtnA1Staffs', label: 'Cán bộ thuộc quyền', action: 'switchA1Tab', data: { tab: 'staffs' } },
];

function switchA1Tab() {
  setActiveNav('tabBtnA1Staffs');
  loadA1StaffsTab();
}

export function registerA1View() {
  $('viewThuongTruc').innerHTML = a1Template;
  registerActions({ switchA1Tab });
  registerView('A1', {
    nav: NAV,
    init() { openKlDashboard(); },
    reload() { if (isStaffsTabVisible()) loadA1StaffsTab(); },
  });
}
