// Markup màn hình "Nhiệm vụ" (v8 đợt 3, mockup 06): hàng lọc MỘT dòng — pill đếm theo nhóm (bấm để lọc; tổng các ô = tổng dòng) + ô tìm + ô chọn
// Đơn vị (có đếm) + Kết luận, "Thêm bộ lọc" (hội nghị, ngành, lĩnh vực) gập bên dưới; danh sách hàng bên trái, ngăn chi tiết cố định 520px bên phải.
// Dùng chung mọi vai; phạm vi do RLS. Id giữ nguyên (e2e): #klStats .o-so[data-nhom], #klSo-*, #klTimKiem, #klLoc*, #klChipLoc, #klBody, #klChiTiet.
// v3.24: "Thêm bộ lọc" thêm thời gian nhập, người nhập, cấp giao, hạn xử lý (kỳ hoặc khoảng ngày), độ khẩn (nhãn ghi số bộ lọc đang áp dụng),
// nút Xoá bộ lọc; thanh Sắp xếp đầu danh sách (#klSapXep): Mới nhập trước (mặc định, như V-Office) · Hạn gần trước · Mức cảnh báo (thứ tự cũ).
// v3.25 (bảng theo cột, mẫu NhiemVu / ViecTheoDoi 16/10/2026): danh sách là bảng (#klBang — bộ cột cot-nv / cot-td, hàng tiêu đề #klDauBang,
// chân #klSoDong + nút trang #klTrang), chú giải màu mức; ngăn chi tiết chỉ chiếm chỗ khi đang mở một việc (.md.co-ct — chi-tiet.js). Chế độ
// "Việc tôi theo dõi": ô số #klTdSo và nút quan hệ #klTdQh (theo-doi.js).
import { THU_TU_NHOM, NHOM } from '../../../lib/kl/nhan.js';
import { KY_NHAP, KY_HAN, CAP_GIAO, SAP_XEP } from '../../../lib/kl/loc-them.js';
import { CHU_GIAI_MUC } from '../bang/khung.js';

const opts = (ds, dau) => `<option value="">${dau}</option>${ds.map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('')}`;
const oNgay = (id, nhan) => `<input type="date" id="${id}" class="hidden" aria-label="${nhan}" title="${nhan}">`;
const oSo = (ma) => `<button type="button" class="o-so ${NHOM[ma].stat}" data-action="locKlNhom" data-nhom="${ma}" aria-pressed="false"><b id="klSo-${ma}">0</b> ${NHOM[ma].ten.toLowerCase()}</button>`;

export const klTemplate = `
  <div class="dau"><h1 id="klTieuDe">Nhiệm vụ</h1><span id="klPhuDe">trong phạm vi của đồng chí — bấm một dòng để mở ngăn chi tiết bên phải</span>
    <div class="phai-dau"><span id="klTinhDen" class="chu-phu" aria-live="polite"></span><span id="klKetNoi" class="ket-noi" role="status"></span>
      <button type="button" class="nut nho" data-action="loadKl">Tải lại</button>
      <button type="button" id="klXuatExcel" class="nut nho" data-action="klXuatExcel" title="Xuất đúng danh sách đang hiện (sau bộ lọc) ra tệp .xlsx">Xuất Excel</button>
      <button type="button" id="klXuatKy" class="nut nho" data-action="moXuatKy" title="Xuất theo tuần / tháng / quý / năm: tổng hợp theo đơn vị + bốn danh sách của kỳ">Xuất theo kỳ…</button>
      <button type="button" id="klXuatMau" class="nut nho hidden" data-action="klXuatMau" title="Xuất danh sách đang hiện theo Mẫu nhập chuẩn — sửa trong Excel rồi nhập lại để cập nhật theo mã">Xuất theo mẫu nhập</button>
      <button type="button" id="klIn" class="nut nho" data-action="klIn">In / lưu PDF</button>
      <button type="button" id="klRaSoatMt" class="nut nho hidden" data-action="moRaSoatMucTieu" title="Ngành, lĩnh vực và mục tiêu then chốt của các việc đã giao (số liệu các khối mục tiêu then chốt, lĩnh vực trọng tâm của Tổng quan) — hệ thống tự nhận diện, đồng chí kiểm tra rồi chấp nhận; sửa hàng loạt bằng tệp Excel">Rà soát phân loại</button>
      <button type="button" id="klNutThem" class="nut nho chinh hidden" data-action="openGiaoViec">Giao việc</button></div></div>

  <div id="klTdSo" class="bnv-so so-8 hidden" role="group" aria-label="Lọc việc theo dõi theo tình hình"></div>
  <div class="kl-loc">
    <div id="klTdQh" class="pham-vi hidden" role="group" aria-label="Quan hệ của đồng chí với việc"></div>
    <div id="klPhamVi" class="pham-vi hidden" role="group" aria-label="Phạm vi xem" title="Cấu hình của Văn phòng cho phép chuyên viên xem mọi việc của phòng mình (chỉ xem)">
      <button type="button" data-action="klPhamVi" data-pv="toi" aria-pressed="false">Việc của tôi</button>
      <button type="button" data-action="klPhamVi" data-pv="phong" aria-pressed="true">Cả phòng</button></div>
    <div id="klToanBo" class="pham-vi hidden" role="group" aria-label="Phạm vi danh sách" title="Cấu hình của Văn phòng: mọi cán bộ xem toàn bộ nhiệm vụ — việc ngoài phạm vi xử lý chỉ xem">
      <button type="button" data-action="klToanBo" data-tb="0" aria-pressed="true">Phạm vi của tôi</button>
      <button type="button" data-action="klToanBo" data-tb="1" aria-pressed="false">Toàn Văn phòng</button></div>
    <div id="klStats" class="tq" role="group" aria-label="Tổng quan, bấm để lọc">
      <button type="button" class="o-so" data-action="locKlNhom" data-nhom="" aria-pressed="true"><b id="klSo-TONG">0</b> tổng</button>
      ${THU_TU_NHOM.map(oSo).join('')}
    </div>
    <label class="kl-tim"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="klTimKiem" placeholder="Tìm mã nhiệm vụ, nội dung, số TB/KL, người" aria-label="Tìm nhiệm vụ"></label>
    <select id="klLocDonVi" aria-label="Lọc theo đơn vị chủ trì theo dõi"><option value="">Đơn vị chủ trì theo dõi</option></select>
    <select id="klLocKetLuan" aria-label="Lọc theo số TB/KL"><option value="">Mọi số TB/KL</option></select>
    <select id="klLocChuTri" aria-label="Lọc theo chủ trì theo dõi"><option value="">Chủ trì theo dõi</option></select>
    <select id="klLocTheoDoi" aria-label="Lọc theo người theo dõi"><option value="">Người theo dõi</option></select>
    <select id="klLocLdvp" aria-label="Lọc theo lãnh đạo Văn phòng phụ trách"><option value="">Lãnh đạo VP phụ trách</option></select>
    <button type="button" id="klXoaLoc" class="nut nho hidden" data-action="klXoaLoc" title="Bỏ mọi bộ lọc đã chọn ở hàng này (giữ phạm vi xem)">Xoá bộ lọc</button>
    <details class="kl-them"><summary>Thêm bộ lọc<span id="klSoLocThem" class="so-loc"></span></summary><div class="them-loc">
      <select id="klLocNhap" aria-label="Lọc theo thời gian nhập lên hệ thống">${opts(KY_NHAP, 'Mọi thời gian nhập')}</select>
      ${oNgay('klLocNhapTu', 'Nhập từ ngày')}${oNgay('klLocNhapDen', 'Nhập đến ngày')}
      <select id="klLocNguoiNhap" aria-label="Lọc theo người nhập"><option value="">Mọi người nhập</option></select>
      <select id="klLocCapGiao" aria-label="Lọc theo cấp giao">${opts(CAP_GIAO, 'Mọi cấp giao')}</select>
      <select id="klLocHan" aria-label="Lọc theo hạn xử lý">${opts(KY_HAN, 'Mọi hạn xử lý')}</select>
      ${oNgay('klLocHanTu', 'Hạn từ ngày')}${oNgay('klLocHanDen', 'Hạn đến ngày')}
      <select id="klLocDoKhan" aria-label="Lọc theo độ khẩn"><option value="">Mọi độ khẩn</option></select>
      <select id="klLocMucTieu" aria-label="Lọc theo mục tiêu then chốt"><option value="">Mọi mục tiêu then chốt</option></select>
      <select id="klLocHoiNghi" aria-label="Lọc theo hội nghị"><option value="">Mọi hội nghị</option></select>
      <select id="klLocNganh" aria-label="Lọc theo ngành/lĩnh vực"><option value="">Mọi ngành/lĩnh vực</option></select>
      <select id="klLocLinhVuc" aria-label="Lọc theo lĩnh vực"><option value="">Mọi lĩnh vực</option></select>
      <select id="klLocNguon" aria-label="Lọc theo nguồn nhiệm vụ"><option value="">Mọi nguồn nhiệm vụ</option></select>
    </div></details>
  </div>
  <div id="klChipLoc" class="chip-loc hidden" role="status"></div>
  <div class="bnv-chu-giai">${CHU_GIAI_MUC}<span><span class="nhan-trung-tinh nhan-moi">Mới</span> nhập trong 24 giờ</span></div>

  <div class="md">
    <div class="list bnv cot-nv" id="klBang">
      <div class="kl-sap"><span class="chu-phu">Sắp xếp</span><div id="klSapXep" class="pham-vi" role="group" aria-label="Sắp xếp danh sách">${SAP_XEP.map(([ma, ten, goi]) =>
    `<button type="button" data-action="klSapXep" data-sx="${ma}" aria-pressed="${ma === 'moi'}" title="${goi}">${ten}</button>`).join('')}</div></div>
      <div class="bnv-dau" id="klDauBang" aria-hidden="true"></div>
      <div id="klBody"><p class="trong-nho">Đang tải dữ liệu</p></div>
      <div class="ds-chan bnv-chan"><span id="klSoDong"></span><span id="klTrang" class="bnv-trang"></span></div>
    </div>
    <aside class="chi-tiet" id="klChiTiet" aria-label="Chi tiết nhiệm vụ đang chọn"><p class="trong-nho">Chọn một dòng để xem chỉ đạo, minh chứng và lịch sử.</p></aside>
  </div>
`;
