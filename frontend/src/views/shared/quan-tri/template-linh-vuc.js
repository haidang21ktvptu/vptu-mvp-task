// Markup phần lĩnh vực của màn hình Quản trị (GĐ9 PR 9A, thiết kế KL BTVTU 5.4): hộp "Kiêm nhiệm lĩnh vực"
// cho một PCVP và phần "Danh mục lĩnh vực" (chỉ người có quan_tri_kl). Quyền thật ở hàm SQL và RLS.

// Hộp kiêm nhiệm: chọn phòng → ngành → lĩnh vực (nhiều, khoá theo ngành) → ngày → lý do → Lưu.
export const quanTriKiemNhiemModalTemplate = `
<div id="qtKiemNhiemModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtKnTitle">
  <form id="qtKiemNhiemForm" class="modal" data-submit="luuKiemNhiem" novalidate>
    <h2 id="qtKnTitle" class="modal-tieu-de mb-1">Kiêm nhiệm lĩnh vực</h2>
    <p id="qtKnMoTa" class="mb-4 text-sm chu-phu"></p>
    <input type="hidden" id="qtKnUsername">
    <label for="qtKnPhong" class="nhan">Phòng</label>
    <select id="qtKnPhong" class="input mb-3"></select>
    <label for="qtKnNganh" class="nhan">Ngành</label>
    <select id="qtKnNganh" class="input mb-3"></select>
    <span class="nhan">Lĩnh vực (chọn một hoặc nhiều)</span>
    <div id="qtKnLinhVuc" class="mb-3 grid gap-1 text-sm" role="group" aria-label="Lĩnh vực thuộc ngành đã chọn"></div>
    <div id="qtKnCanhBao" class="luong-canh-bao mb-3 hidden" role="status"></div>
    <label for="qtKnNgay" class="nhan">Ngày hiệu lực</label>
    <input type="date" id="qtKnNgay" class="input mb-3">
    <label for="qtKnLyDo" class="nhan">Lý do (bắt buộc, ghi vào nhật ký)</label>
    <input type="text" id="qtKnLyDo" class="input" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ...">
    <div class="modal-chan">
      <button type="button" data-action="dongKiemNhiem" class="btn btn-phu">Huỷ</button>
      <button type="submit" class="btn btn-chinh">Lưu</button>
    </div>
  </form>
</div>
`;

// Phần danh mục lĩnh vực: chỉ thêm và sửa tên/thứ tự; không xoá, không chuyển ngành (đã có việc tham chiếu).
export const quanTriDanhMucTemplate = `
  <div class="bang mb-6" id="qtKhuDanhMuc">
    <div class="bang-dau">
      <h2>Danh mục lĩnh vực theo ngành<span class="chu-phu">người có quyền quản trị KL thêm, sửa tên; không xoá</span></h2>
    </div>
    <form class="px-4 pt-4 flex flex-wrap gap-2 items-end" data-submit="themLinhVuc" novalidate>
      <div>
        <label for="qtLvNganh" class="nhan">Ngành</label>
        <select id="qtLvNganh" class="input input-nho"></select>
      </div>
      <div class="grow">
        <label for="qtLvTen" class="nhan">Tên lĩnh vực mới</label>
        <input type="text" id="qtLvTen" class="input input-nho" placeholder="Ví dụ: Tài chính công">
      </div>
      <button type="submit" class="btn btn-nho btn-chinh">Thêm lĩnh vực</button>
    </form>
    <div id="qtLvCanhBao" class="luong-canh-bao mx-4 mt-3 hidden" role="status"></div>
    <div class="bang-cuon">
      <table>
        <thead><tr><th>Ngành</th><th>Mã</th><th>Tên lĩnh vực</th><th class="so">Thứ tự</th><th class="phai">Thao tác</th></tr></thead>
        <tbody id="qtLvBody"><tr><td colspan="5" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="bang mb-6">
    <div class="bang-dau">
      <h2>Nhật ký danh mục<span class="chu-phu">20 dòng gần nhất, không xoá được</span></h2>
    </div>
    <div class="bang-cuon">
      <table>
        <thead><tr><th>Lúc</th><th>Người thực hiện</th><th>Hành động</th><th>Mã</th><th>Thay đổi</th><th>Lý do</th></tr></thead>
        <tbody id="qtLvNhatKyBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody>
      </table>
    </div>
  </div>
`;
