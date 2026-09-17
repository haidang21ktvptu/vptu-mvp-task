// Phần chung của màn hình điều hành A0/A1: đầu trang (ngày, "số liệu tính đến", kết nối realtime, Tải lại), 4 số-lọc, thanh trái + danh sách
// thẻ (hoặc Toàn cảnh N nhiệm vụ khi bấm số hoàn thành). Mỗi vai truyền cấu hình KPI và phần đầu/cuối trang riêng.
import { $, setText, formatDateTime } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { tongHop } from '../../../lib/kl/tong-hop.js';
import { THU_TU_NHOM, tenNhom } from '../../../lib/kl/nhan.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { openKl } from '../kl/index.js';
import { dh, napDieuHanh, locThe, viecDo } from './du-lieu.js';
import { rayHtml, tieuDeDanhSach } from './ray.js';
import { theHtml } from './the-viec.js';
import { giuDienBien } from '../dien-bien.js';
import { kpiHtml, NHAN_KPI } from './kpi.js';
import { datNapLai, mountHanhDongDieuHanh } from './hanh-dong.js';

// "Thứ Tư 16 tháng 9" theo giờ Việt Nam.
export function ngayDaiVN(d = new Date()) {
  const s = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const khungHtml = (tieuDe, phu, dau = '', cuoi = '') => `
  <div class="dau"><h1 id="dhTieuDeTrang">${tieuDe}</h1><span id="dhTinhDen">${phu}</span>
    <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span><button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
  ${dau}
  <div class="kpi" id="dhKpi"></div>
  <div class="dieu-hanh">
    <aside class="ray" id="dhRay" aria-label="Lọc theo khâu và đơn vị"></aside>
    <section class="danh-sach"><div class="ds-dau"><h2 id="dsTieuDe"></h2><span id="dsPhu"></span></div><div id="dsThe"></div></section>
  </div>
  ${cuoi}`;

let cauHinh = { kpi: () => [], veThem: () => {}, phuDe: () => '' };
export function datCauHinhDieuHanh(c) { cauHinh = { ...cauHinh, ...c }; }

// Toàn cảnh: đếm theo nhóm trạng thái, mỗi ô mở danh sách Nhiệm vụ lọc đúng nhóm.
function toanCanhHtml() {
  const t = tongHop(dh.rows);
  return `<div class="toan-canh">${THU_TU_NHOM.filter((k) => t.nhom[k] > 0).map((k) =>
    `<button type="button" data-action="moKlDanhSach" data-loc='${JSON.stringify({ nhom: k })}'><b>${t.nhom[k]}</b> ${tenNhom(k).toLowerCase()}</button>`).join('')}
    <button type="button" data-action="moKlDanhSach" data-loc="{}"><b>${t.tong}</b> tổng · xem đủ trong Nhiệm vụ</button></div>`;
}

export function veDieuHanh() {
  if (!$('dhKpi')) { cauHinh.veThem(); return; } // màn hình không có dải KPI (A3 "Việc của tôi") vẽ bằng hàm vai đăng ký — napLaiViec vẫn vẽ lại thẻ ngay
  const kpi = cauHinh.kpi();
  $('dhKpi').innerHTML = kpiHtml(kpi);
  $('dhKpi').classList.toggle('nam', kpi.length === 5);
  $('dhRay').innerHTML = rayHtml();
  const traDienBien = giuDienBien($('dsThe')); // khối "Xem diễn biến" đang mở không mất khi danh sách vẽ lại (nạp lại nền / realtime)
  if (dh.loc.kpi === 'tat') {
    const t = tongHop(dh.rows);
    setText('dsTieuDe', `Toàn cảnh ${t.tong} nhiệm vụ`);
    setText('dsPhu', `${t.nhom.HOAN_THANH} hoàn thành, ${t.dangMo} đang mở, ${viecDo().length} quá hạn — bấm số quá hạn hoặc bộ lọc bên trái để quay về việc nghẽn`);
    $('dsThe').innerHTML = toanCanhHtml();
  } else {
    const ds = locThe();
    setText('dsTieuDe', tieuDeDanhSach(ds.length, NHAN_KPI[dh.loc.kpi] || ''));
    setText('dsPhu', cauHinh.phuDe());
    $('dsThe').innerHTML = ds.length ? ds.map(theHtml).join('') : '<p class="trong">Không có việc nào ở bộ lọc này.</p>';
    traDienBien();
  }
  cauHinh.veThem();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu ${formatDateTime(dh.luc).split(' ')[1]}, so sánh với tuần trước`);
}

// Lỗi tạm (mạng, staging bận → statement timeout của v_nhiem_vu / v_ngoai_le khi nhiều trang nạp cùng lúc): thử lại MỘT lần sau 800 ms rồi mới báo,
// cùng quy tắc với danh sách Nhiệm vụ (kl/danh-sach.js) — trang không đứng ở "đang nạp số liệu…" vì một lượt đọc lỗi.
// Gộp lượt nạp trùng (mở màn hình + realtime + sau hành động): một lượt tại một thời điểm, lượt tới trong lúc đang nạp chạy một lần sau khi xong.
let dangNap = null; let canNapLai = false;
export function loadDieuHanh() {
  if (dangNap) { canNapLai = true; return dangNap; }
  dangNap = (async () => {
    try { await napMotLan(); } finally { dangNap = null; }
    if (canNapLai) { canNapLai = false; return loadDieuHanh(); }
  })();
  return dangNap;
}
async function napMotLan(lan = 0) {
  try { await napDieuHanh(); veDieuHanh(); } catch (e) {
    if (lan < 1) { await new Promise((r) => setTimeout(r, 800)); return napMotLan(lan + 1); }
    notifyError('Không đọc được dữ liệu điều hành: ' + e.message);
  }
}

export function openDieuHanh() {
  showSection('viewDieuHanh');
  setActiveNav('navDieuHanh');
  datNapLai(loadDieuHanh); // Cán bộ / Báo cáo đặt hàm nạp lại riêng khi mở — quay về đây đặt lại
  loadDieuHanh();
  batKlRealtime(() => { if (sectionDangHien('viewDieuHanh')) loadDieuHanh(); }, (m) => hienKetNoi('dhKetNoi', m));
}

const locKhau = ({ khau }) => { dh.loc.khau = dh.loc.khau === khau ? null : khau; if (dh.loc.kpi === 'tat') dh.loc.kpi = null; veDieuHanh(); };
const locDonVi = ({ dv }) => { dh.loc.dv = dh.loc.dv === dv ? null : dv; if (dh.loc.kpi === 'tat') dh.loc.kpi = null; veDieuHanh(); };
const locKpi = ({ loc }) => { dh.loc = { khau: null, dv: null, kpi: dh.loc.kpi === loc ? null : loc }; veDieuHanh(); };
const boLocDieuHanh = () => { dh.loc = { khau: null, dv: null, kpi: null }; veDieuHanh(); };
function moKlDanhSach({ loc }) {
  let bo; try { bo = JSON.parse(loc || '{}'); } catch { bo = {}; }
  openKl({ ...bo, tuTongQuan: true });
}

// Hành động dùng chung (đăng ký một lần lúc khởi động). openDieuHanh / loadDieuHanh do từng vai đăng ký ở init() vì mỗi vai một màn hình
// điều hành khác nhau (A0/A1 dùng hàm ở đây; A2 Phòng tôi; A3 Việc của tôi) — đăng ký sớm sẽ bị vai đăng ký sau đè.
export function mountDieuHanh() {
  mountHanhDongDieuHanh();
  registerActions({ locKhau, locDonVi, locKpi, boLocDieuHanh, moKlDanhSach });
}
export function dangKyDieuHanhVai() {
  datNapLai(loadDieuHanh);
  registerActions({ openDieuHanh, loadDieuHanh });
}
