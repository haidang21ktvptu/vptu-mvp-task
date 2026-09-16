// Dashboard (GĐ10 PR 10C "Tổng quan"; GĐ15 "Dashboard" điều hành ngoại lệ, phụ lục 1400 bước 5): cùng nguồn đọc với màn hình
// danh sách (v_nhiem_vu, RLS lọc phạm vi — CVP tất cả, PCVP theo phụ trách/kiêm nhiệm, A2 phòng mình), tổng hợp bằng
// lib/kl/tong-hop.js; hàng 1 = bảng ngoại lệ từ v_ngoai_le (4 trường CN-5.2, nút Chỉ đạo, cấp quyết định tại chỗ);
// hàng 0 chỉ đạo Thường trực (GĐ19, CH-16); hàng 2 tình hình chung; hàng 3 theo Owner (đơn vị) — người theo dõi ghi riêng (CH-2). Mọi con số là nút mở danh sách (openKl).
import { $, setText, formatDateTime } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { setActiveNav, showSection } from '../../shell.js';
import { loadDanhMucKl, loadCauHinhKl, loadKlRows, cauHinhKl } from '../../../lib/kl/du-lieu.js';
import { loadNgoaiLe, loadChiDaoTT } from '../../../lib/kl/dieu-hanh.js';
import { tongHop, theoChuTriMo, theoOwnerMo, theoHoiNghi, theoNganhLinhVuc, chatLuong, kiemBatBien } from '../../../lib/kl/tong-hop.js';
import { openKl } from '../../shared/kl/index.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { klDashboardTemplate } from './template.js';
import { tinhHinhHtml, chatLuongHtml } from './ve-o-so.js';
import { ownerHtml, nguoiTheoDoiHtml, hoiNghiHtml, nganhLinhVucHtml } from './ve-bieu-do.js';
import { ngoaiLeHtml, mountNgoaiLe } from './ngoai-le.js';
import { veChiDaoTT, mountChiDaoTT } from './chi-dao-tt.js';

export const KL_DASHBOARD_NAV = { id: 'navKlDashboard', label: 'Dashboard', action: 'openKlDashboard', data: { section: 'viewKlDashboard' } };
let rows = [];
let ngoaiLe = [];
let chiDaoTT = [];
export const getKlDashboardRows = () => rows;

export async function loadKlDashboard() {
  try {
    await Promise.all([loadDanhMucKl(), loadCauHinhKl()]);
    const [r, nl, tt] = await Promise.all([loadKlRows(), loadNgoaiLe(), loadChiDaoTT()]);
    rows = r.rows; ngoaiLe = nl; chiDaoTT = tt;
    const bb = kiemBatBien(rows);
    if (!bb.dung) notifyError(`Số liệu không khớp: ${bb.tongNhom} theo nhóm, ${bb.tongLV} theo lĩnh vực, ${bb.tong} dòng. Báo người quản trị KL.`);
    // Bất biến DB-5: bảng ngoại lệ = ô Quá hạn + Đang đính chính của cùng lần đọc.
    const t = tongHop(rows);
    if (ngoaiLe.length !== t.nhom.QUA_HAN + t.nhom.DANG_DINH_CHINH) notifyError(`Bảng ngoại lệ ${ngoaiLe.length} dòng khác ô Quá hạn + đang đính chính ${t.nhom.QUA_HAN + t.nhom.DANG_DINH_CHINH}. Báo người quản trị KL.`);
    render(r.luc);
  } catch (e) {
    notifyError('Không đọc được dữ liệu nhiệm vụ: ' + e.message);
  }
}

export function render(luc = new Date()) {
  const t = tongHop(rows);
  const nguongCapNhat = cauHinhKl('nguong_khong_cap_nhat_ngay', 30);
  veChiDaoTT(chiDaoTT); // hàng 0 (GĐ19): chỉ đạo Thường trực — A1 chờ phản hồi, A0 trạng thái
  $('klDbNgoaiLe').innerHTML = ngoaiLeHtml(ngoaiLe);
  $('klDbTinhHinh').innerHTML = tinhHinhHtml(t);
  $('klDbOwner').innerHTML = ownerHtml(theoOwnerMo(rows));
  $('klDbHoiNghi').innerHTML = hoiNghiHtml(theoHoiNghi(rows, 8));
  $('klDbChuTri').innerHTML = nguoiTheoDoiHtml(theoChuTriMo(rows));
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

// Bấm một con số: mở danh sách với bộ lọc ghi trong data-loc (JSON), thay toàn bộ bộ lọc cũ.
function moKlDanhSach({ loc }) {
  let bo;
  try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  openKl({ ...bo, tuTongQuan: true });
}

export function registerKlDashboard() {
  $('viewKlDashboard').innerHTML = klDashboardTemplate;
  mountNgoaiLe(registerActions, loadKlDashboard);
  mountChiDaoTT(registerActions);
  registerActions({ openKlDashboard, loadKlDashboard, moKlDanhSach });
}
