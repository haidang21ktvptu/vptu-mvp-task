// Markup hai khu Quản trị của v3.25: "Danh mục mục tiêu" (mục tiêu then chốt theo nhóm, quy tắc nhận diện, nhóm, khối lĩnh vực — thêm nhanh, sửa có
// kiểm soát, không xoá; migration 0107–0111) và "Cấu hình AI" (nhà cung cấp, mô hình, bật / tắt, giới hạn lượt, nhật ký dùng — 0112). Phần đổi vẽ ở
// muc-tieu-dm.js, muc-tieu-quy-tac.js, muc-tieu-nhom-khoi.js, cau-hinh-ai.js. Quyền thật ở hàm SQL / Edge Function; ở đây chỉ ẩn / hiện.
import { LOC_TRANG_THAI, MUC_SUY_NGHI } from './muc-tieu-thuan.js';

const o = (ma, ten) => `<option value="${ma}">${ten}</option>`;
const truong = (id, nhan, oHtml, chu = '', lop = '') => `<div class="qt-mt-truong${lop ? ` ${lop}` : ''}" id="${id}Wrap"><label for="${id}" class="nhan">${nhan}</label>${oHtml}${chu ? `<small class="chu-phu">${chu}</small>` : ''}</div>`;

export const quanTriMucTieuTemplate = `
  <div id="qtKhuMucTieu" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Danh mục mục tiêu then chốt<span class="chu-phu">thêm nhanh, sửa có kiểm soát, không xoá — mọi thay đổi ghi nhật ký, khôi phục được</span></h2>
        <div class="bo-loc qt-mt-loc">
          <input type="search" id="qtMtTim" class="o-nhap nho" placeholder="Tìm tên, số hiệu (không cần dấu)" aria-label="Tìm mục tiêu" autocomplete="off">
          <select id="qtMtLocNhom" class="o-nhap nho" aria-label="Lọc theo nhóm mục tiêu"></select>
          <select id="qtMtLocTT" class="o-nhap nho" aria-label="Lọc theo trạng thái">${LOC_TRANG_THAI.map(([ma, ten]) => o(ma, ten)).join('')}</select>
          <button type="button" class="nut nho chinh" id="qtMtNutThem" data-action="qtMtMoThem">+ Thêm mục tiêu</button></div></div>
      <p class="chu-phu qt-mt-giai" id="qtMtGiai"></p>
      <form id="qtMtForm" class="qt-mt-form hidden" data-submit="qtMtLuu" novalidate aria-labelledby="qtMtFormTieuDe">
        <h3 id="qtMtFormTieuDe">Thêm mục tiêu</h3>
        <div class="qt-mt-luoi">
          ${truong('qtMtNhom', 'Nhóm', '<select id="qtMtNhom" class="o-nhap nho"></select>')}
          ${truong('qtMtSoHieu', 'Số hiệu', '<input type="text" id="qtMtSoHieu" class="o-nhap nho" maxlength="20" placeholder="Ví dụ 81-NQ/TW" autocomplete="off">', '<span id="qtMtSoHieuChu">nếu có — trùng số hiệu sẽ bị chặn</span>')}
          ${truong('qtMtTenNgan', 'Tên ngắn', '<input type="text" id="qtMtTenNgan" class="o-nhap nho" maxlength="120" placeholder="Hiện trên thẻ, chip" autocomplete="off">', 'để trống = theo tên')}
          ${truong('qtMtThuTu', 'Thứ tự', '<input type="number" id="qtMtThuTu" class="o-nhap nho" min="1" step="1">', 'trong nhóm')}
        </div>
        ${truong('qtMtTen', 'Tên mục tiêu<b class="gv-bb" aria-hidden="true">*</b>', '<input type="text" id="qtMtTen" class="o-nhap nho" maxlength="300" placeholder="Ghi đúng tên trong nghị quyết, chương trình" autocomplete="off">')}
        <div class="qt-mt-luoi hai">
          ${truong('qtMtMoTa', 'Nội dung', '<input type="text" id="qtMtMoTa" class="o-nhap nho" maxlength="300" autocomplete="off">', 'một câu ngắn — trợ lý AI dùng để nhận diện')}
          ${truong('qtMtCanCu', 'Căn cứ', '<input type="text" id="qtMtCanCu" class="o-nhap nho" maxlength="300" placeholder="Ví dụ Nghị quyết Đại hội XX Đảng bộ tỉnh" autocomplete="off">')}
        </div>
        ${truong('qtMtChiTieu', 'Chỉ tiêu đến năm 2030', '<input type="text" id="qtMtChiTieu" class="o-nhap nho" maxlength="200" autocomplete="off">', 'chỉ với nhóm chỉ tiêu chủ yếu')}
        ${truong('qtMtLyDoThem', 'Ghi chú khi thêm', '<input type="text" id="qtMtLyDoThem" class="o-nhap nho" maxlength="300" placeholder="Ví dụ: theo Kết luận số …" autocomplete="off">', 'không bắt buộc — ghi vào nhật ký danh mục')}
        <div class="qt-mt-chan"><button type="submit" class="nut nho chinh" id="qtMtLuuNut">Thêm vào danh mục</button><button type="button" class="nut nho" data-action="qtMtHuyForm">Huỷ</button>
          <small class="chu-phu" id="qtMtFormChu">Mục mới dùng được ngay cho mọi cán bộ; quản trị hệ thống đối chiếu văn bản gốc rồi khoá nội dung.</small></div>
      </form>
      <div class="bang-cuon"><table class="qt-mt-bang">
        <thead><tr><th>Mục tiêu</th><th>Số hiệu</th><th>Nhóm</th><th>Trạng thái</th><th>Nguồn</th><th class="so">Quy tắc</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtMtBody"><tr><td colspan="7" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
      <p class="chu-phu qt-mt-dem" id="qtMtDem" aria-live="polite"></p>
    </div>
    <div class="bang" id="qtMtNhomKhu"><div class="bang-dau"><h2>Nhóm mục tiêu<span class="chu-phu">mỗi nhóm là một thẻ ở khối "Thực hiện các mục tiêu then chốt" của Tổng quan; nhóm có dạng số hiệu nhận diện văn bản để tự thêm mục tiêu</span></h2></div>
      <div id="qtMtNhomThem"></div>
      <div class="bang-cuon"><table><thead><tr><th>Tên nhóm</th><th>Nhãn thẻ</th><th>Dạng số hiệu</th><th class="so">Thứ tự</th><th>Đang dùng</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtMtNhomBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div></div>
    <div class="bang" id="qtMtKhoiKhu"><div class="bang-dau"><h2>Khối lĩnh vực<span class="chu-phu">khối "Thực hiện theo lĩnh vực trọng tâm" của Tổng quan gom ngành vào khối; một lĩnh vực có thể thuộc khối riêng</span></h2></div>
      <div id="qtMtKhoiThem"></div>
      <div class="bang-cuon"><table><thead><tr><th>Tên khối</th><th class="so">Thứ tự</th><th>Đang dùng</th><th class="so">Số ngành</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtMtKhoiBody"><tr><td colspan="5" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
      <div id="qtMtGanKhoi" class="qt-mt-gan-khoi"></div></div>
  </div>

  <div id="qtKhuAi" class="qt-khu hidden">
    <div class="bang">
      <div class="bang-dau"><h2>Trợ lý AI<span class="chu-phu">đọc văn bản giao việc để điền sẵn, soạn quy tắc nhận diện mục tiêu — khoá API chỉ nằm trong Edge Function, không qua giao diện này</span></h2>
        <div class="bo-loc"><button type="button" class="nut nho" data-action="qtAiKiemTra" id="qtAiKiemTraNut">Kiểm tra kết nối</button></div></div>
      <div id="qtAiTrangThai" class="qt-ai-tt" aria-live="polite"><p class="chu-phu">Đang đọc trạng thái…</p></div>
      <form id="qtAiForm" class="qt-ai-form" data-submit="qtAiLuu" novalidate>
        <fieldset class="qt-ai-ncc"><legend class="nhan">Nhà cung cấp — đổi ở đây rồi Lưu; không cần sửa mã nguồn hay triển khai lại</legend><div id="qtAiNccDs" class="qt-ai-ncc-ds"></div></fieldset>
        <div class="qt-mt-luoi">
          ${truong('qtAiMoHinh', 'Mô hình', '<input type="text" id="qtAiMoHinh" class="o-nhap nho" list="qtAiMoHinhDs" maxlength="100" autocomplete="off"><datalist id="qtAiMoHinhDs"></datalist>', '<span id="qtAiMoHinhChu">tên mô hình đúng như nhà cung cấp công bố</span>')}
          ${truong('qtAiMuc', 'Mức suy nghĩ', `<select id="qtAiMuc" class="o-nhap nho">${MUC_SUY_NGHI.map(([ma, ten]) => o(ma, ten)).join('')}</select>`, 'mô hình không hỗ trợ thì bỏ qua')}
          ${truong('qtAiNgay', 'Lượt mỗi ngày (toàn hệ thống)', '<input type="number" id="qtAiNgay" class="o-nhap nho" min="1" max="100000" step="1">')}
          ${truong('qtAiNguoi', 'Lượt mỗi người mỗi ngày', '<input type="number" id="qtAiNguoi" class="o-nhap nho" min="1" max="10000" step="1">')}
        </div>
        ${truong('qtAiDiaChi', 'Địa chỉ dịch vụ (https)', '<input type="url" id="qtAiDiaChi" class="o-nhap nho" maxlength="200" placeholder="https://api.dichvu.vn/v1" autocomplete="off">', 'chỉ với dịch vụ khác theo chuẩn OpenAI — hệ thống gọi {địa chỉ}/chat/completions', 'hidden')}
        <div class="qt-ai-co">
          <label class="nhan-checkbox"><input type="checkbox" id="qtAiBat"> Bật trợ lý AI (tắt: mọi nút AI ẩn, giao việc vẫn dùng quy tắc của hệ thống)</label>
          <label class="nhan-checkbox"><input type="checkbox" id="qtAiGui"> Cho gửi nội dung văn bản giao việc, nhiệm vụ tới dịch vụ AI (văn bản không mật, đã công khai trên V-Office — phương án chủ dự án chọn)</label>
        </div>
        <div class="qt-mt-chan"><button type="submit" class="nut nho chinh">Lưu cấu hình</button><small class="chu-phu" id="qtAiDoiChu" aria-live="polite">Lưu cần ghi lý do; thay đổi ghi vào Nhật ký hệ thống.</small></div>
      </form>
      <div class="qt-ai-khoa" id="qtAiKhoa"></div>
    </div>
    <div class="bang">
      <div class="bang-dau"><h2>Nhật ký dùng trợ lý AI<span class="chu-phu" id="qtAiDem">50 lượt gần nhất — không lưu nội dung văn bản hay kết quả</span></h2>
        <div class="bo-loc"><button type="button" class="nut nho" data-action="qtAiTaiLai">Tải lại</button></div></div>
      <div class="bang-cuon"><table class="qt-ai-nk">
        <thead><tr><th>Lúc</th><th>Người</th><th>Việc</th><th>Nhà cung cấp · mô hình</th><th class="so">Token vào / ra</th><th class="so">Thời gian</th><th>Kết quả</th></tr></thead>
        <tbody id="qtAiNhatKyBody"><tr><td colspan="7" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
    </div>
  </div>
`;
