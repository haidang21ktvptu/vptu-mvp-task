// Giao việc v8 (đợt 3, mockup 07): biểu mẫu ba khối đánh số trong một tấm — (1) Văn bản giao việc (chọn có sẵn / tạo mới); (2) Nội dung và người
// chịu trách nhiệm (nội dung, Owner, người theo dõi gợi ý, Thay mặt khi người giao không phải lãnh đạo, độ khẩn dạng pill); (3) Sản phẩm và hạn.
// Chấm số 1-2-3 sáng khi khối đó điền đủ; chân tấm: dòng "Còn thiếu: …" cạnh nút Giao việc (mờ khi thiếu) + Huỷ + Giao, nhập tiếp. Cột phụ 340px:
// xem trước thẻ việc (đọc lại các ô) + ba bước sau khi giao. Dùng chung A0 (bản rút gọn = ẩn phần không áp dụng), A1, A2, A3 giao thay mặt.
// id ô giữ tiền tố klTh* và #gvCham1..3, #gvTomTatChu, .gv-the, .gv-phan (e2e). Độ khẩn: lib/kl/do-khan.js. Quyền và 1-1-1 kiểm trong hàm giao_viec (0035).
import { nutDoKhanHtml } from '../../../lib/kl/do-khan.js';

// Nhãn MỘT dòng ngắn; phần giải thích là chú thích nhỏ dưới ô (.gv-chu-thich); dấu * đỏ (.gv-bb) khi bắt buộc — id ô/wrap giữ nguyên (e2e).
const BB = '<b class="gv-bb" aria-hidden="true">*</b>';
const truong = (id, nhan, o, them = '', chuThich = '') => `<div class="gv-truong" id="${id}Wrap"${them}><label for="${id}" class="nhan">${nhan}</label>${o}${chuThich ? `<small class="gv-chu-thich">${chuThich}</small>` : ''}</div>`;
const sel = (id) => `<select id="${id}" class="o-nhap"></select>`;
const inp = (id, type = 'text', them = '') => `<input type="${type}" id="${id}" class="o-nhap"${them}>`;

export const giaoViecTemplate = `
  <div class="dau"><h1>Giao việc</h1><span>một biểu mẫu, ba khối · nút Giao việc chỉ sáng khi đủ văn bản, nội dung, người chịu trách nhiệm, sản phẩm và hạn</span></div>
  <div class="hai-cot" style="--rong-phu:340px">
  <form id="giaoViecForm" class="gv-the tam" data-submit="luuKlThem" novalidate>
    <div class="gv-noi">
      <section class="gv-phan" id="gvPhan1"><h2><i id="gvCham1" class="gv-so">1</i>Văn bản giao việc</h2>
        <p class="chu-phu hidden gv-cha" id="gvCha"></p>
        <div class="gv-truong" id="klThVanBanWrap"><label for="klThVanBanTim" class="nhan">Chọn văn bản có sẵn</label>
          <div class="cot-2 gv-vb"><input type="search" id="klThVanBanTim" class="o-nhap" placeholder="Gõ số hiệu, số hội nghị hoặc loại để lọc" autocomplete="off" aria-controls="klThVanBan">
          <select id="klThVanBan" class="o-nhap" aria-label="Chọn văn bản giao việc"></select></div></div>
        <div id="klThVanBanMoi" class="hidden">
          <div class="cot-2">
            ${truong('klThLoaiVB', 'Loại văn bản', sel('klThLoaiVB'))}
            <div class="gv-truong" id="klThSoHNWrap"><label for="klThSoHN" class="nhan">Số hội nghị${BB}</label>${inp('klThSoHN', 'number', ' min="1"')}</div>
          </div>
          <div class="cot-3">
            ${truong('klThSoKL', `Số hiệu${BB}`, inp('klThSoKL', 'text', ' placeholder="123-KL/TU"'))}
            ${truong('klThNgayBH', `Ngày ban hành${BB}`, inp('klThNgayBH', 'date'))}
            ${truong('klThNgayNhanVB', 'Ngày nhận', inp('klThNgayNhanVB', 'date'), '', 'nếu biết')}
          </div>
          ${truong('klThTrichYeu', 'Trích yếu văn bản', inp('klThTrichYeu', 'text', ' placeholder="Về việc…" maxlength="300" autocomplete="off"'), '', 'không bắt buộc')}
          <p class="chu-phu hidden" id="gvVbA0">Thường trực giao trực tiếp không kèm văn bản: để trống số hiệu và ngày ban hành, hệ thống ghi mốc "Thường trực giao &lt;thời điểm&gt;". Đã điền thì dùng đúng số hiệu, ngày và trích yếu vừa nhập.</p>
        </div>
      </section>

      <section class="gv-phan" id="gvPhan2"><h2><i id="gvCham2" class="gv-so">2</i>Nội dung và người chịu trách nhiệm</h2>
        ${truong('klThNoiDung', `Nội dung nhiệm vụ${BB}`, '<textarea id="klThNoiDung" class="o-nhap" rows="3" placeholder="Ghi rõ việc cần làm, phạm vi, yêu cầu…"></textarea>')}
        <div class="cot-3">
          ${truong('klThOwner', `Chịu trách nhiệm${BB}`, sel('klThOwner'), '', 'một Owner: đơn vị, phòng hoặc cán bộ')}
          ${truong('klThNguoiTheoDoi', `Người theo dõi${BB}`, sel('klThNguoiTheoDoi'), '', 'gợi ý theo người chịu trách nhiệm')}
          ${truong('klThThayMat', `Thay mặt${BB}`, sel('klThThayMat'), ' class="gv-truong hidden"', 'lãnh đạo mà đồng chí giao thay mặt')}
        </div>
        <div class="gv-truong gv-dk"><span class="nhan">Độ khẩn</span>${nutDoKhanHtml('do_khan', 'THUONG', 'klThDoKhan')}</div>
        <p class="chu-phu" id="gvGoiYCanBo">Cân tải: xem bức tranh tải việc ở mục Cán bộ trước khi chọn người.</p>
      </section>

      <section class="gv-phan" id="gvPhan3"><h2><i id="gvCham3" class="gv-so">3</i>Sản phẩm và hạn</h2>
        <div class="cot-3">
          ${truong('klThSanPham', `Sản phẩm đầu ra${BB}`, sel('klThSanPham'))}
          ${truong('klThSanPhamMoTa', 'Mô tả sản phẩm', inp('klThSanPhamMoTa', 'text', ' placeholder="Ví dụ: Tờ trình đề án X"'))}
          ${truong('klThCapNhan', 'Cấp nhận sản phẩm', sel('klThCapNhan'), '', 'mặc định là cấp trên của người chịu trách nhiệm')}
        </div>
        <div class="cot-3">
          ${truong('klThNgayNhan', `Ngày nhận văn bản${BB}`, inp('klThNgayNhan', 'date'), '', 'mốc bắt đầu tính hạn')}
          ${truong('klThLoai', 'Loại thời hạn', sel('klThLoai'))}
          ${truong('klThHan', 'Hạn hoàn thành<b id="klThHanBatBuoc" class="gv-bb" aria-hidden="true">*</b>', inp('klThHan', 'date'), '', '<span id="klThHanLoai"></span><span id="klThHanGhiChu" aria-live="polite"></span>')}
        </div>
        <div class="cot-3" id="gvNganhWrap">
          ${truong('klThCapQD', 'Cấp cần quyết định', sel('klThCapQD'), '', 'để mở, điền khi việc Đỏ')}
          ${truong('klThNganh', 'Ngành<b id="klThNganhBatBuoc" class="gv-bb" aria-hidden="true">*</b>', sel('klThNganh'), '', '<span id="klThNganhGhiChu"></span>')}
          ${truong('klThLinhVuc', 'Lĩnh vực<b id="klThLinhVucBatBuoc" class="gv-bb" aria-hidden="true">*</b>', sel('klThLinhVuc'), '', 'theo ngành đã chọn')}
        </div>
        <div class="cot-2" id="gvPhuWrap">
          ${truong('klThVanBanTK', 'Văn bản triển khai', inp('klThVanBanTK'))}
          ${truong('klThGhiChu', 'Ghi chú / lĩnh vực chi tiết', inp('klThGhiChu'))}
        </div>
      </section>
    </div>

    <div class="gv-tom-tat" id="gvTomTat">
      <p><span id="gvConThieu" class="gv-thieu" aria-live="polite"></span><span id="gvTomTatChu" class="chu-phu">Giao … cho …, hạn …, sản phẩm …, độ khẩn Thường</span></p>
      <div>
        <button type="button" data-action="huyKlThem" class="nut">Huỷ</button>
        <button type="button" data-action="luuKlThemTiep" id="klThLuuTiep" class="nut">Giao, nhập tiếp</button>
        <button type="submit" id="klThLuu" class="nut chinh" disabled>Giao việc</button>
      </div>
    </div>
  </form>
  <aside class="cot-phu">
    <section class="tam"><div class="tam-dau"><h2>Xem trước thẻ việc</h2></div>
      <div class="gv-xem-truoc" id="gvXemTruoc"><div class="ct-nhan"><span class="ma">NV-mới</span><span class="tag" id="gvXtDoKhan">Thường</span></div>
        <b id="gvXtNoiDung">Nội dung nhiệm vụ…</b><span id="gvXtPhu">Chủ trì … · hạn … · sản phẩm …</span></div></section>
    <section class="tam"><div class="tam-dau"><h2>Ba bước sau khi giao</h2></div>
      <ol class="gv-buoc-sau">
        <li><i>1</i><span>Người chịu trách nhiệm và người theo dõi mỗi người tự xác nhận đã nhận việc trong 1 ngày làm việc; từ chối cần lý do, cấp trên duyệt.</span></li>
        <li><i>2</i><span>Hệ thống đếm hạn từ ngày nhận văn bản; sắp đến hạn chuyển Vàng, quá hạn chuyển Đỏ và tự nhắc người liên quan.</span></li>
        <li><i>3</i><span>Việc chỉ đóng khi có minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận) và cấp nhận xác nhận.</span></li>
      </ol></section>
  </aside>
  </div>
`;
