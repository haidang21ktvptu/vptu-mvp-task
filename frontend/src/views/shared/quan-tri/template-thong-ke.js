// Markup khu "Thống kê sử dụng" (0104, v3.24; chỉ quản trị hệ thống): hai phần chọn bằng nút.
// Đăng nhập — kỳ (Hôm nay … Từ khi có nhật ký, hoặc khoảng ngày), dải số = bộ lọc, xem theo cán bộ (mở từng người xem từng lần đăng nhập) / theo
// thời gian, lọc phòng / vai trò / tìm tên, xuất Excel. Nhiệm vụ nhập mới — đơn vị ngày / tuần / tháng / năm, khoảng ngày, lọc người nhập / cách
// nhập, biểu đồ cột chồng (bấm cột = chọn kỳ), bảng theo kỳ, theo người nhập, danh sách việc của kỳ đang chọn. Quyền thật ở hàm SQL / RLS.
import { KY_DANG_NHAP, CACH_NHAP } from '../../../lib/thong-ke.js';
import { DEPT_NAMES } from '../../../lib/constants.js';

const nutKy = KY_DANG_NHAP.map(([ma, ten]) => `<button type="button" data-action="tkDnKy" data-ky="${ma}" aria-pressed="${ma === '30-ngay'}">${ten}</button>`).join('');
const optPhong = Object.entries(DEPT_NAMES).map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('');
const optCach = Object.entries(CACH_NHAP).map(([ma, ten]) => `<option value="${ma}">${ten}</option>`).join('');
const oSo = (loc, nhan, lop = '') => `<button type="button" class="o-dai ${lop}" data-action="tkDnLoc" data-loc="${loc}" aria-pressed="${loc === 'tat'}"><span>${nhan}</span><b id="tkDnSo-${loc}">0</b></button>`;
const oTong = (k, nhan) => `<div class="o-dai"><span>${nhan}</span><b id="tkNmSo-${k}">0</b></div>`;
const nutDonVi = [['ngay', 'Ngày'], ['tuan', 'Tuần'], ['thang', 'Tháng'], ['nam', 'Năm']]
  .map(([ma, ten]) => `<button type="button" data-action="tkNmDonVi" data-don-vi="${ma}" aria-pressed="${ma === 'ngay'}">${ten}</button>`).join('');

export const quanTriThongKeTemplate = `
  <div id="qtKhuThongKe" class="qt-khu hidden">
    <div class="tk-dau">
      <div class="pham-vi" role="group" aria-label="Loại thống kê">
        <button type="button" id="tkNutDangNhap" data-action="tkChonPhan" data-phan="dang-nhap" aria-pressed="true">Đăng nhập</button>
        <button type="button" id="tkNutNhapMoi" data-action="tkChonPhan" data-phan="nhap-moi" aria-pressed="false">Nhiệm vụ nhập mới</button></div>
      <span class="chu-phu">Chỉ tài khoản quản trị hệ thống xem được. Giờ theo giờ Việt Nam.</span>
    </div>

    <section id="tkPhanDangNhap" aria-label="Thống kê đăng nhập">
      <div class="tk-loc">
        <div class="pham-vi" role="group" aria-label="Kỳ thống kê đăng nhập">${nutKy}</div>
        <label>Từ ngày <input type="date" id="tkDnTu" class="o-nhap nho"></label>
        <label>Đến ngày <input type="date" id="tkDnDen" class="o-nhap nho"></label>
        <button type="button" class="nut nho" data-action="tkDnXemKhoang">Xem khoảng này</button>
        <span id="tkDnLoi" class="loi-inline hidden" role="alert"></span>
      </div>
      <div class="dai-so" role="group" aria-label="Tóm tắt đăng nhập trong kỳ, bấm để lọc danh sách">
        ${oSo('da', 'Tài khoản đã đăng nhập trong kỳ', 'luc')}${oSo('tat', 'Lượt đăng nhập trong kỳ')}${oSo('chua', 'Chưa đăng nhập trong kỳ', 'vang')}
        ${oSo('homNay', 'Đăng nhập hôm nay')}${oSo('dangHd', 'Đang hoạt động (15 phút qua)')}
      </div>
      <div class="bang">
        <div class="bang-dau"><h2>Nhật ký đăng nhập<span class="chu-phu" id="tkDnTomTat"></span></h2>
          <div class="bo-loc">
            <div class="pham-vi" role="group" aria-label="Cách xem">
              <button type="button" data-action="tkDnXem" data-xem="can-bo" aria-pressed="true">Theo cán bộ</button>
              <button type="button" data-action="tkDnXem" data-xem="thoi-gian" aria-pressed="false">Theo thời gian</button></div>
            <input type="search" id="tkDnTim" class="o-nhap nho" placeholder="Tìm họ tên, tên đăng nhập" aria-label="Tìm cán bộ" autocomplete="off">
            <select id="tkDnPhong" class="o-nhap nho" aria-label="Lọc theo phòng"><option value="">Mọi phòng</option>${optPhong}</select>
            <select id="tkDnVai" class="o-nhap nho" aria-label="Lọc theo vai trò"><option value="">Mọi vai trò</option><option value="A0">Thường trực Tỉnh ủy</option>
              <option value="A1">Lãnh đạo Văn phòng</option><option value="A2">Trưởng phòng</option><option value="A3">Chuyên viên</option></select>
            <button type="button" class="nut nho" data-action="tkDnXuat">Xuất Excel</button></div></div>
        <div class="bang-cuon"><table><thead id="tkDnDau"></thead><tbody id="tkDnBody"><tr><td class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
        <div class="ds-chan"><span id="tkDnChan"></span><button type="button" id="tkDnThem" class="nut nho hidden" data-action="tkDnThem">Xem thêm 100 lượt</button></div>
      </div>
    </section>

    <section id="tkPhanNhapMoi" class="hidden" aria-label="Thống kê nhiệm vụ nhập mới">
      <div class="tk-loc">
        <span class="chu-phu">Xem theo</span><div class="pham-vi" role="group" aria-label="Đơn vị thời gian">${nutDonVi}</div>
        <label>Từ ngày <input type="date" id="tkNmTu" class="o-nhap nho"></label>
        <label>Đến ngày <input type="date" id="tkNmDen" class="o-nhap nho"></label>
        <button type="button" class="nut nho" data-action="tkNmXemKhoang">Xem khoảng này</button>
        <select id="tkNmNguoi" class="o-nhap nho" aria-label="Lọc theo người nhập"><option value="">Mọi người nhập</option></select>
        <select id="tkNmCach" class="o-nhap nho" aria-label="Lọc theo cách nhập"><option value="">Mọi cách nhập</option>${optCach}</select>
        <span id="tkNmLoi" class="loi-inline hidden" role="alert"></span>
      </div>
      <div class="dai-so" aria-label="Tổng hợp trong khoảng đang xem">
        ${oTong('tong', 'Nhiệm vụ nhập mới trong khoảng')}${oTong('GIAO_VIEC', 'Giao việc trên hệ thống')}${oTong('TIEP_XUONG', 'Giao tiếp xuống')}
        ${oTong('EXCEL', 'Nhập từ Excel')}${oTong('soNguoi', 'Số cán bộ đã nhập')}${oTong('homNay', 'Nhập hôm nay')}
      </div>
      <div class="bang">
        <div class="bang-dau"><h2>Nhiệm vụ nhập lên hệ thống theo <span id="tkNmDonViChu">ngày</span>
          <span class="chu-phu">theo thời điểm nhập (giờ Việt Nam), không theo ngày ký văn bản; bấm một cột để xem các việc của kỳ</span></h2></div>
        <div id="tkNmBieu" class="tk-bieu" role="group" aria-label="Biểu đồ nhiệm vụ nhập mới"></div>
        <ul class="tk-chu-giai"><li><i class="c-gv"></i>Giao việc trên hệ thống</li><li><i class="c-tx"></i>Giao tiếp xuống</li><li><i class="c-ex"></i>Nhập từ Excel (theo lô)</li></ul>
      </div>
      <div class="tk-hai-cot">
        <div class="bang"><div class="bang-dau"><h2>Theo kỳ<span class="chu-phu">mới nhất trước</span></h2></div>
          <div class="bang-cuon"><table><thead><tr><th>Kỳ</th><th class="phai">Tổng</th><th class="phai">Giao việc</th><th class="phai">Giao tiếp xuống</th><th class="phai">Nhập Excel</th><th>Người nhập nhiều nhất</th></tr></thead>
            <tbody id="tkNmKyBody"></tbody></table></div></div>
        <div class="bang"><div class="bang-dau"><h2>Theo người nhập</h2></div>
          <div class="bang-cuon"><table><thead><tr><th>Người nhập</th><th class="phai">Tổng</th><th class="phai">Giao việc</th><th class="phai">Giao tiếp xuống</th><th class="phai">Nhập Excel</th></tr></thead>
            <tbody id="tkNmNguoiBody"></tbody></table></div></div>
      </div>
      <div class="bang">
        <div class="bang-dau"><h2 id="tkNmCtTieuDe">Nhiệm vụ nhập trong kỳ</h2><button type="button" class="nut nho" data-action="tkNmXuat">Xuất Excel</button></div>
        <div class="bang-cuon"><table><thead><tr><th>Thời gian nhập</th><th>Nhiệm vụ</th><th>Văn bản giao</th><th>Cách nhập</th><th>Người nhập</th></tr></thead>
          <tbody id="tkNmCtBody"><tr><td colspan="5" class="trong">Chọn một kỳ trên biểu đồ.</td></tr></tbody></table></div>
        <div class="ds-chan"><span id="tkNmCtChan"></span></div>
      </div>
    </section>
  </div>
`;
