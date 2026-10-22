// Markup màn "Rà soát mục tiêu then chốt" (v3.25): đầu trang, hàng lọc (chưa gắn / có gợi ý chưa xử lý / tất cả · tìm · phòng · văn bản · nhóm mục tiêu
// được gợi ý), thanh trạng thái + nút chấp nhận hàng loạt (xác nhận tại chỗ, không hộp thoại trình duyệt), danh sách #rsDs (data-nap khi nạp xong — e2e
// chờ), phân trang #rsTrang. Dòng vẽ ở dong.js. Tên lớp viết nguyên văn (Tailwind giữ lớp có trong mã). v3.26: ô "Chưa phân loại ngành – lĩnh vực",
// "Không thuộc" và khối "Rà soát phân loại bằng tệp Excel" (nhap-tep.js).
import { tepHtml } from './nhap-tep.js';

// v3.27: mục tiêu then chốt tạm ẩn (coMt = false) — chỉ còn ngành, lĩnh vực: bỏ hai ô lọc theo mục tiêu, ô nhóm, nút chấp nhận hàng loạt.
const AN = (coMt) => (coMt ? '' : ' hidden');
export const raSoatTemplate = (coMt = true) => `
  <div class="dau"><h1>Rà soát phân loại nhiệm vụ</h1>
    <span${coMt ? '' : ' hidden'}>mục tiêu then chốt (khối "Thực hiện các mục tiêu then chốt" của Tổng quan) và ngành, lĩnh vực (khối "Thực hiện theo lĩnh vực trọng tâm") — hệ thống tự nhận diện mục tiêu theo văn bản, nội dung, ngành, lĩnh vực; mục tích sẵn có căn cứ chắc, mục gợi ý bấm để thêm; việc không phục vụ mục tiêu nào tích "Không thuộc"; đồng chí kiểm tra rồi bấm Chấp nhận</span>${coMt ? '' : '<span>ngành, lĩnh vực của các việc đã giao (số liệu "Thực hiện theo lĩnh vực trọng tâm" của Tổng quan) — việc đang mở sửa ở ngăn chi tiết, việc đã hoàn thành sửa hàng loạt bằng tệp rà soát</span>'}
    <div class="phai-dau"><button type="button" class="nut nho" data-action="rsNapLai">Tải lại</button>
      <button type="button" class="nut nho" data-action="openKl">Về danh sách nhiệm vụ</button></div></div>
  <div class="kl-loc rs-loc">
    <div id="rsChe" class="pham-vi" role="group" aria-label="Việc cần rà soát">
      <button type="button" data-action="rsChe" data-che="chua" aria-pressed="true"${AN(coMt)}>Chưa phân loại mục tiêu <b id="rsDem-chua">0</b></button>
      <button type="button" data-action="rsChe" data-che="cho" aria-pressed="false"${AN(coMt)}>Có gợi ý chưa xử lý <b id="rsDem-cho">…</b></button>
      <button type="button" data-action="rsChe" data-che="nganh" aria-pressed="false">Chưa có ngành, lĩnh vực <b id="rsDem-nganh">0</b></button>
      <button type="button" data-action="rsChe" data-che="khong" aria-pressed="false">Không thuộc <b id="rsDem-khong">0</b></button>
      <button type="button" data-action="rsChe" data-che="tat" aria-pressed="false">Tất cả <b id="rsDem-tat">0</b></button></div>
    <label class="kl-tim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="rsTim" placeholder="Tìm mã, nội dung, số hiệu văn bản" aria-label="Tìm nhiệm vụ cần rà soát" autocomplete="off"></label>
    <select id="rsPhong" aria-label="Lọc theo đơn vị chủ trì theo dõi"><option value="">Mọi phòng</option></select>
    <select id="rsVanBan" aria-label="Lọc theo văn bản giao việc"><option value="">Mọi văn bản</option></select>
    <select id="rsNhom" aria-label="Lọc theo nhóm mục tiêu được gợi ý"${AN(coMt)}><option value="">Mọi nhóm mục tiêu gợi ý</option></select>
  </div>
  ${tepHtml()}
  <div class="rs-thanh">
    <span id="rsTrangThai" class="chu-phu" aria-live="polite"></span>
    <button type="button" id="rsNutHangLoat" class="nut nho chinh${AN(coMt) ? ' hidden' : ''}" data-action="rsHangLoat" disabled>Chấp nhận các mục đã tích sẵn</button>
  </div>
  <div id="rsXacNhan" class="rs-xac-nhan hidden" role="group" aria-labelledby="rsXacNhanChu">
    <p id="rsXacNhanChu"></p>
    <div><button type="button" class="nut chinh" id="rsXacNhanNut" data-action="rsHangLoatXacNhan">Xác nhận gắn</button>
      <button type="button" class="nut" data-action="rsHangLoatHuy">Huỷ</button></div>
  </div>
  <div id="rsDs" class="rs-ds"><p class="trong-nho">Đang tải dữ liệu…</p></div>
  <nav id="rsTrang" class="rs-trang" aria-label="Phân trang danh sách rà soát"></nav>
`;
