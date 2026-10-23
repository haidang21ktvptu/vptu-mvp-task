// Khung trang "Việc của tôi" (v3.25, mẫu Main 16/10/2026) — dựng mỗi lần vào vai; nội dung do index.js và bang-viec.js vẽ. Giữ id e2e: h1 "Việc
// của tôi", #dhTinhDen, #dhKetNoi, MỘT nút [data-action=loadDieuHanh] (Tải lại), MỘT nút [data-action=openKl] ("Lọc chi tiết, in" — nav() của
// e2e dùng để sang màn Nhiệm vụ, kể cả trên điện thoại), #vctTom, #dhCanXuLy, #vctKhoi, #vctSo, #vctTim, #vctBang[data-nap], #vctChan, #vctTrang (nút
// trang). Lớp viết nguyên văn.
import { CHU_GIAI_MUC, dauBangHtml } from '../shared/bang/khung.js';
import { SAP_XEP_VIEC } from '../../lib/kl/viec-toi.js';

const COT = [['STT', 'bnv-c-stt'], ['Nhiệm vụ'], ['Văn bản giao'], ['Thời gian giao', 'bnv-c-tg'], ['Hạn xử lý'], ['Trạng thái'], ['Việc cần làm', 'bnv-c-viec']];
const TIM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

export const vctTemplate = (ngay, giao) => `
  <div class="dau"><h1>Việc của tôi</h1><span id="dhTinhDen">${ngay}, đang nạp…</span>
    <div class="phai-dau"><span id="dhKetNoi" class="ket-noi" role="status"></span>
      <button type="button" class="nut nho" data-action="vctXuatExcel" title="Xuất đúng danh sách đang hiện ra tệp .xlsx">Xuất Excel</button>
      <button type="button" class="nut nho" data-action="openKl" title="Danh sách đầy đủ ở màn Nhiệm vụ: thêm bộ lọc, in / lưu PDF">Lọc chi tiết, in</button>
      ${giao ? '<button type="button" class="nut nho chinh" data-action="openGiaoViec">Giao việc</button>' : ''}
      <button type="button" class="nut nho" data-action="loadDieuHanh">Tải lại</button></div></div>
  <p class="bnv-mo-ta">Việc đồng chí chủ trì theo dõi. Bấm nội dung việc để xem chi tiết; nút ở cột Việc cần làm mở thao tác ngay dưới dòng.
    <span id="vctTom"></span></p>
  <div id="dhCanXuLy"></div>
  <section class="tam vct-khoi hidden" id="vctKhoi" aria-label="Đề nghị từ chối và việc bị từ chối"></section>
  <div class="vct-trang">
    <div id="vctSo" class="bnv-so so-8" role="group" aria-label="Lọc theo tình hình xử lý"></div>
    <div class="kl-loc bnv-loc">
      <div id="vctPhamVi" class="pham-vi hidden" role="group" aria-label="Phạm vi"></div>
      <label class="kl-tim">${TIM}<input type="search" id="vctTim" placeholder="Tìm mã, nội dung, số văn bản, người" aria-label="Tìm trong việc của tôi" autocomplete="off"></label>
      <span id="vctCanBo" class="bnv-chon hidden"></span>
      <select id="vctSapXep" aria-label="Sắp xếp">${SAP_XEP_VIEC.map(([k, t]) => `<option value="${k}">Sắp xếp: ${t}</option>`).join('')}</select>
      <label class="bnv-gat"><input type="checkbox" id="vctNhomVb"> Nhóm theo văn bản giao</label></div>
    <div class="bnv-chu-giai">${CHU_GIAI_MUC}<span><b>Chữ đậm</b>: chưa xác nhận nhận việc</span><span><span class="bnv-nhan moi">Mới</span> giao trong 24 giờ</span></div>
    <div class="bnv cot-vct" role="region" aria-label="Danh sách việc của tôi">
      <div class="bnv-dau" aria-hidden="true">${dauBangHtml(COT)}</div>
      <div id="vctBang" class="bnv-than"><p class="bnv-trong">Đang nạp việc của đồng chí…</p></div>
      <div class="bnv-chan"><span id="vctChan"></span><span id="vctTrang" class="bnv-trang"></span></div></div></div>`;
