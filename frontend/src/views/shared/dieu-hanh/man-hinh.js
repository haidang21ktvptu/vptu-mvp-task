// Phần chung của màn hình điều hành A0/A1: đầu trang (ngày, giờ số liệu, kết nối realtime, Tải lại), thanh trái + danh sách thẻ việc nghẽn.
// v3.36 (CAU-HOI V-1): bỏ dải 5 ô số (trùng số liệu với Tổng quan) và chế độ Toàn cảnh; lọc bằng ba câu hỏi đầu trang và thanh trái. Mỗi vai truyền
// phần đầu / giữa / cuối trang riêng. v3.36 (CAU-HOI V-13, DESIGN mục 17): danh sách việc nghẽn chỉ hiện SO_THE_DAU việc đầu (đã xếp theo mức khẩn),
// nút cuối danh sách "Xem tất cả N việc" (components/ds-gon.js, danh sách tên "dhThe"); thứ tự xếp ghi ở nút "i" cạnh tiêu đề danh sách, không
// còn câu phụ đề.
import { $, setText, formatDateTime, giuONhap } from '../../../lib/dom.js';
import { dongBoNutDanhGia } from '../chat-luong.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError } from '../../../components/toast.js';
import { veSauNap } from '../../../lib/chuyen-dong.js';
import { nutGoi } from '../../../components/goi.js';
import { apDanhSach, nutHetHtml, dangKyDanhSach } from '../../../components/ds-gon.js';
import { batKlRealtime, hienKetNoi } from '../../../features/kl-realtime.js';
import { setActiveNav, showSection, sectionDangHien } from '../../shell/index.js';
import { dh, napDieuHanh, locThe } from './du-lieu.js';
import { rayHtml, tieuDeDanhSach, NHAN_LOC } from './ray.js';
import { theHtml } from './the-viec.js';
import { giuDienBien } from '../dien-bien.js';
import { datNapLai, mountHanhDongDieuHanh } from './hanh-dong.js';
import { dieuHanhTheoSuKien } from './su-kien.js';

// "Thứ Tư 16 tháng 9" theo giờ Việt Nam.
export function ngayDaiVN(d = new Date()) {
  const s = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Tiêu đề + ngày; `dau` (ba câu hỏi, dải Cần xử lý ngay, khối việc chờ đồng chí); `giua` (A1: hai cột kết quả nộp / chỉ đạo Thường trực); thanh trái
// 300px + tấm danh sách hàng việc nghẽn.
// Thứ tự của locThe() (du-lieu.js): độ khẩn, Thường trực giao, mức cảnh báo (Đỏ đặc biệt trước Đỏ), việc cần người xem quyết, số ngày trễ.
const GHI_CHU_XEP = 'Xếp theo mức khẩn: độ khẩn, việc Thường trực giao, mức cảnh báo, việc cần đồng chí quyết, rồi số ngày trễ.';
export const khungHtml = (tieuDe, phu, dau = '', cuoi = '', giua = '') => `
  <div class="dau"><h1 id="dhTieuDeTrang">${tieuDe}</h1><span id="dhTinhDen">${phu}</span>
    <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span><button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
  ${dau}
  ${giua}
  <div class="dieu-hanh">
    <aside class="ray tam" id="dhRay" aria-label="Lọc theo khâu và đơn vị"></aside>
    <section class="danh-sach tam"><div class="ds-dau tam-dau"><h2 id="dsTieuDe"></h2>${nutGoi(GHI_CHU_XEP)}</div><div id="dsThe"></div></section>
  </div>
  ${cuoi}`;

export const SO_THE_DAU = 10;

let cauHinh = { veThem: () => {}, sauVe: () => {} };   // sauVe: chạy sau khi các ô đang mở đã được trả lại
export function datCauHinhDieuHanh(c) { cauHinh = { ...cauHinh, ...c }; }

export function veDieuHanh() {
  if (!$('dsThe')) { cauHinh.veThem(); return; } // màn hình không có danh sách việc nghẽn (A2, A3) vẽ bằng hàm vai đăng ký — napLaiViec vẫn vẽ lại ngay
  const traNhap = giuONhap($('viewDieuHanh')); // ô đang mở / đang gõ giữ qua lần vẽ lại (nạp lại nền, realtime — PR-2a lỗi đua)
  $('dhRay').innerHTML = rayHtml();
  const traDienBien = giuDienBien($('dsThe')); // khối "Xem diễn biến" đang mở không mất khi danh sách vẽ lại (nạp lại nền / realtime)
  const ds = locThe();
  setText('dsTieuDe', tieuDeDanhSach(ds.length, NHAN_LOC[dh.loc.kpi] || ''));
  $('dsThe').innerHTML = ds.length ? ds.map(theHtml).join('') + nutHetHtml('dhThe', ds.length, SO_THE_DAU) : '<p class="trong">Không có việc nào ở bộ lọc này.</p>';
  traDienBien();
  cauHinh.veThem();
  if (dh.luc) setText('dhTinhDen', `${ngayDaiVN(dh.luc)}, số liệu lúc ${formatDateTime(dh.luc).split(' ')[1]}`);
  traNhap(); dongBoNutDanhGia($('viewDieuHanh'));   // PR-3: nút nghiệm thu theo ô chất lượng đã giữ
  apDanhSach('dhThe');   // V-13: sau khi các ô đang mở đã được trả lại (thẻ đang mở ô nhập / diễn biến không bị ẩn)
  cauHinh.sauVe();
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
  try {
    const daCo = Boolean($('dhBaCau')?.childElementCount);   // v3.36 (V-12): số liệu lượt trước đang hiện (vào lại mục) → vẽ lại sau khi hiệu ứng vào mục chạy xong
    await napDieuHanh();
    veSauNap($('viewDieuHanh'), daCo, veDieuHanh, (e) => notifyError('Không hiển thị được màn Cần xử lý: ' + e.message));
  } catch (e) {
    if (lan < 1) { await new Promise((r) => setTimeout(r, 800)); return napMotLan(lan + 1); }
    notifyError('Không đọc được dữ liệu điều hành: ' + e.message);
  }
}

export function openDieuHanh() {
  showSection('viewDieuHanh');
  setActiveNav('navDieuHanh');
  datNapLai(loadDieuHanh); // Cán bộ / Báo cáo đặt hàm nạp lại riêng khi mở — quay về đây đặt lại
  loadDieuHanh();
  batKlRealtime((su) => { if (sectionDangHien('viewDieuHanh')) dieuHanhTheoSuKien(su, loadDieuHanh, veDieuHanh); }, (m) => hienKetNoi('dhKetNoi', m));
}

const locKhau = ({ khau }) => { dh.loc.khau = dh.loc.khau === khau ? null : khau; veDieuHanh(); };
const locDonVi = ({ dv }) => { dh.loc.dv = dh.loc.dv === dv ? null : dv; veDieuHanh(); };
const locKpi = ({ loc }) => { dh.loc = { khau: null, dv: null, kpi: dh.loc.kpi === loc ? null : loc }; veDieuHanh(); };
const boLocDieuHanh = () => { dh.loc = { khau: null, dv: null, kpi: null }; veDieuHanh(); };

// Hành động dùng chung (đăng ký một lần lúc khởi động). openDieuHanh / loadDieuHanh do từng vai đăng ký ở init() vì mỗi vai một màn hình
// điều hành khác nhau (A0/A1 dùng hàm ở đây; A2 Phòng tôi; A3 Việc của tôi) — đăng ký sớm sẽ bị vai đăng ký sau đè.
export function mountDieuHanh() {
  mountHanhDongDieuHanh();
  registerActions({ locKhau, locDonVi, locKpi, boLocDieuHanh });
  dangKyDanhSach('dhThe', { vung: () => $('dsThe'), chon: '.the', so: SO_THE_DAU });
}
export function dangKyDieuHanhVai() {
  datNapLai(loadDieuHanh);
  registerActions({ openDieuHanh, loadDieuHanh });
}
