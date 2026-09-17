// Giao việc MỘT KHỐI (GĐ22): một thẻ trắng rộng tối đa 760px, ba phần nối tiếp ngăn bằng đường kẻ mảnh, thanh bước dọc bên trái (chấm 1-2-3
// nối bằng đường thẳng, chấm sáng khi phần đó đã điền đủ): (1) Việc gì — văn bản (ô chọn có tìm), nội dung, độ khẩn 4 nút; (2) Ai làm — Owner,
// người theo dõi (gợi ý theo Owner), ô Thay mặt khi người giao không phải lãnh đạo; (3) Khi nào, sản phẩm gì. Dưới cùng: thanh tóm tắt cố định
// khi cuộn + nút Giao việc (sáng khi đủ 1-1-1) + Huỷ. Dùng chung A0 (bản rút gọn = ẩn phần không áp dụng), A1, A2, A3 giao thay mặt.
// id ô giữ tiền tố klTh* (e2e). Độ khẩn: lib/kl/do-khan.js. Quyền và 1-1-1 kiểm trong hàm giao_viec (0035).
import { nutDoKhanHtml } from '../../../lib/kl/do-khan.js';

const truong = (id, nhan, o, them = '') => `<div class="gv-truong" id="${id}Wrap"${them}><label for="${id}" class="nhan">${nhan}</label>${o}</div>`;
const sel = (id) => `<select id="${id}" class="o-nhap"></select>`;
const inp = (id, type = 'text', them = '') => `<input type="${type}" id="${id}" class="o-nhap"${them}>`;

export const giaoViecTemplate = `
  <div class="dau"><h1>Giao việc</h1><span>một việc = một Owner, một sản phẩm, một hạn; hệ thống tự điền ngày nhận, cấp nhận, người theo dõi — sửa được</span></div>
  <form id="giaoViecForm" class="gv-the" data-submit="luuKlThem" novalidate>
    <ol class="gv-buoc" aria-hidden="true"><li id="gvCham1">1</li><li id="gvCham2">2</li><li id="gvCham3">3</li></ol>
    <div class="gv-noi">
      <section class="gv-phan" id="gvPhan1"><h2>Việc gì</h2>
        <div class="gv-truong" id="klThVanBanWrap"><label for="klThVanBanTim" class="nhan">Văn bản giao việc</label>
          <input type="search" id="klThVanBanTim" class="o-nhap" placeholder="Gõ số hiệu, số hội nghị hoặc loại để lọc danh sách" autocomplete="off" aria-controls="klThVanBan">
          <select id="klThVanBan" class="o-nhap" aria-label="Chọn văn bản giao việc"></select></div>
        <div id="klThVanBanMoi" class="hidden">
          <div class="cot-2">
            ${truong('klThLoaiVB', 'Loại văn bản', sel('klThLoaiVB'))}
            <div class="gv-truong" id="klThSoHNWrap"><label for="klThSoHN" class="nhan">Số hội nghị</label>${inp('klThSoHN', 'number', ' min="1"')}</div>
          </div>
          <div class="cot-3">
            ${truong('klThSoKL', 'Số hiệu', inp('klThSoKL', 'text', ' placeholder="123-KL/TU"'))}
            ${truong('klThNgayBH', 'Ngày ban hành', inp('klThNgayBH', 'date'))}
            ${truong('klThNgayNhanVB', 'Ngày nhận (nếu biết)', inp('klThNgayNhanVB', 'date'))}
          </div>
        </div>
        ${truong('klThNoiDung', 'Nội dung nhiệm vụ', '<textarea id="klThNoiDung" class="o-nhap" rows="3"></textarea>')}
        <div class="gv-truong"><span class="nhan">Độ khẩn</span>${nutDoKhanHtml('do_khan', 'THUONG', 'klThDoKhan')}</div>
      </section>

      <section class="gv-phan" id="gvPhan2"><h2>Ai làm</h2>
        ${truong('klThOwner', 'Chịu trách nhiệm (Owner) — đơn vị, phòng hoặc cán bộ, đúng một', sel('klThOwner'))}
        ${truong('klThNguoiTheoDoi', 'Người theo dõi — gợi ý theo Owner, sửa được', sel('klThNguoiTheoDoi'))}
        ${truong('klThThayMat', 'Thay mặt — lãnh đạo Văn phòng hoặc Trưởng phòng mà đồng chí giao thay (bắt buộc)', sel('klThThayMat'), ' class="gv-truong hidden"')}
        <p class="chu-phu" id="gvGoiYCanBo">Cân tải: xem bức tranh tải việc ở mục Cán bộ trước khi chọn người.</p>
      </section>

      <section class="gv-phan" id="gvPhan3"><h2>Khi nào, sản phẩm gì</h2>
        <div class="cot-3">
          ${truong('klThNgayNhan', 'Ngày nhận văn bản — mốc bắt đầu đếm', inp('klThNgayNhan', 'date'))}
          ${truong('klThLoai', 'Loại thời hạn', sel('klThLoai'))}
          ${truong('klThHan', 'Hạn hoàn thành <span id="klThHanLoai" class="chu-phu"></span>', `${inp('klThHan', 'date')}<small id="klThHanGhiChu" class="chu-phu" aria-live="polite"></small>`)}
        </div>
        <div class="cot-2">
          ${truong('klThSanPham', 'Sản phẩm đầu ra', sel('klThSanPham'))}
          ${truong('klThSanPhamMoTa', 'Mô tả sản phẩm — ví dụ: Tờ trình đề án X', inp('klThSanPhamMoTa'))}
        </div>
        <div class="cot-2">
          ${truong('klThCapNhan', 'Cấp nhận sản phẩm — mặc định = cấp trên Owner', sel('klThCapNhan'))}
          ${truong('klThCapQD', 'Cấp cần quyết định — để mở, điền khi việc Đỏ', sel('klThCapQD'))}
        </div>
        <div class="cot-2" id="gvNganhWrap">
          ${truong('klThNganh', 'Ngành <span id="klThNganhGhiChu" class="chu-phu"></span>', sel('klThNganh'))}
          ${truong('klThLinhVuc', 'Lĩnh vực — theo ngành đã chọn', sel('klThLinhVuc'))}
        </div>
        <div class="cot-2" id="gvPhuWrap">
          ${truong('klThVanBanTK', 'Văn bản triển khai', inp('klThVanBanTK'))}
          ${truong('klThGhiChu', 'Ghi chú / lĩnh vực chi tiết', inp('klThGhiChu'))}
        </div>
      </section>
    </div>

    <div class="gv-tom-tat" id="gvTomTat">
      <p id="gvTomTatChu" aria-live="polite">Giao … cho …, hạn …, sản phẩm …, độ khẩn Thường</p>
      <div>
        <button type="button" data-action="huyKlThem" class="nut">Huỷ</button>
        <button type="button" data-action="luuKlThemTiep" id="klThLuuTiep" class="nut">Giao, nhập tiếp</button>
        <button type="submit" id="klThLuu" class="nut chinh" disabled>Giao việc</button>
      </div>
    </div>
  </form>
`;
