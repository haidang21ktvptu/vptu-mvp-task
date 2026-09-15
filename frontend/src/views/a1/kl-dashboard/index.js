// Dashboard "Tổng quan KL BTVTU" của A1 (GĐ10 PR 10C, thiết kế 3.2): cùng nguồn đọc với màn hình danh sách 10B
// (v_kl_dashboard, RLS lọc phạm vi — CVP tất cả, PCVP theo phụ trách/kiêm nhiệm), tổng hợp bằng lib/kl/tong-hop.js;
// mọi con số là nút mở danh sách với bộ lọc tương ứng (openKl). Không có nút chỉ đạo (GĐ11).
import { $, setText, formatDateTime } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, cauHinhKl } from '../../../lib/kl/du-lieu.js';
import { tongHop, theoChuTriMo, theoHoiNghi, theoNganhLinhVuc, chatLuong, kiemBatBien } from '../../../lib/kl/tong-hop.js';
import { openKl } from '../../shared/kl/index.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { klDashboardTemplate } from './template.js';
import { canThiepHtml, tinhHinhHtml, chatLuongHtml } from './ve-o-so.js';
import { chuTriHtml, hoiNghiHtml, nganhLinhVucHtml } from './ve-bieu-do.js';

export const KL_DASHBOARD_NAV = { id: 'navKlDashboard', label: 'Tổng quan KL BTVTU', action: 'openKlDashboard', data: { section: 'viewKlDashboard' } };
let rows = [];
export const getKlDashboardRows = () => rows;

export async function loadKlDashboard() {
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    const r = await loadKlRows();
    rows = r.rows;
    const bb = kiemBatBien(rows);
    if (!bb.dung) notifyError(`Số liệu không khớp: ${bb.tongNhom} theo nhóm, ${bb.tongLV} theo lĩnh vực, ${bb.tong} dòng. Báo người quản trị KL.`);
    render(r.luc);
  } catch (e) {
    notifyError('Không đọc được dữ liệu Kết luận BTVTU: ' + e.message);
  }
}

export function render(luc = new Date()) {
  const t = tongHop(rows);
  const nguongCapNhat = cauHinhKl('nguong_khong_cap_nhat_ngay', 30);
  $('klDbCanThiep').innerHTML = canThiepHtml(t);
  $('klDbTinhHinh').innerHTML = tinhHinhHtml(t);
  $('klDbChuTri').innerHTML = chuTriHtml(theoChuTriMo(rows));
  $('klDbHoiNghi').innerHTML = hoiNghiHtml(theoHoiNghi(rows, 8));
  $('klDbNganh').innerHTML = nganhLinhVucHtml(theoNganhLinhVuc(rows));
  $('klDbChatLuong').innerHTML = chatLuongHtml(chatLuong(rows, nguongCapNhat), nguongCapNhat);
  setText('klDbTinhDen', `Số liệu tính đến ${formatDateTime(luc)}:${String(luc.getSeconds()).padStart(2, '0')}`);
}

export function openKlDashboard() {
  showSection('viewKlDashboard');
  setActiveNav('navKlDashboard');
  loadKlDashboard();
  batKlRealtime(() => { if (!$('viewKlDashboard').classList.contains('hidden')) loadKlDashboard(); }, (m) => hienKetNoi('klDbKetNoi', m));
}

// Bấm một con số: mở danh sách 10B với bộ lọc ghi trong data-loc (JSON), thay toàn bộ bộ lọc cũ.
function moKlDanhSach({ loc }) {
  let bo;
  try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  openKl({ ...bo, tuTongQuan: true });
}

export function registerKlDashboard() {
  $('viewKlDashboard').innerHTML = klDashboardTemplate;
  registerActions({ openKlDashboard, loadKlDashboard, moKlDanhSach });
}
