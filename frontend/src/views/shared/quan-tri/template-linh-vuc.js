// Markup phần lĩnh vực của màn hình Quản trị (thiết kế KL BTVTU 5.4): hộp "Kiêm nhiệm lĩnh vực" cho một PCVP, phần "Danh mục lĩnh vực"
// (chỉ người có quan_tri_kl) và nhật ký danh mục (tab Nhật ký). Quyền thật ở hàm SQL và RLS.

// Hộp kiêm nhiệm: chọn phòng → ngành → lĩnh vực (nhiều, khoá theo ngành) → ngày → lý do → Lưu.
export const quanTriKiemNhiemModalTemplate = `
<div id="qtKiemNhiemModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtKnTitle">
  <form id="qtKiemNhiemForm" class="modal" data-submit="luuKiemNhiem" novalidate>
    <h2 id="qtKnTitle" class="modal-tieu-de">Kiêm nhiệm lĩnh vực</h2>
    <p id="qtKnMoTa" class="chu-phu" style="margin-top:6px"></p>
    <input type="hidden" id="qtKnUsername">
    <label for="qtKnPhong" class="nhan">Phòng</label>
    <select id="qtKnPhong" class="o-nhap"></select>
    <label for="qtKnNganh" class="nhan">Ngành</label>
    <select id="qtKnNganh" class="o-nhap"></select>
    <span class="nhan">Lĩnh vực (chọn một hoặc nhiều)</span>
    <div id="qtKnLinhVuc" class="grid gap-1 text-sm" role="group" aria-label="Lĩnh vực thuộc ngành đã chọn"></div>
    <div id="qtKnCanhBao" class="luong-canh-bao hidden" role="status"></div>
    <label for="qtKnNgay" class="nhan">Ngày hiệu lực</label>
    <input type="date" id="qtKnNgay" class="o-nhap">
    <label for="qtKnLyDo" class="nhan">Lý do (bắt buộc, ghi vào nhật ký)</label>
    <input type="text" id="qtKnLyDo" class="o-nhap" placeholder="Ví dụ: Quyết định số .../QĐ-VPTU ngày ...">
    <div class="modal-chan">
      <button type="button" data-action="dongKiemNhiem" class="nut">Huỷ</button>
      <button type="submit" class="nut chinh">Lưu</button>
    </div>
  </form>
</div>
`;

// Phần danh mục lĩnh vực: chỉ thêm và sửa tên/thứ tự; không xoá, không chuyển ngành (đã có việc tham chiếu).
export const quanTriDanhMucTemplate = `
  <div class="bang">
    <div class="bang-dau"><h2>Danh mục lĩnh vực theo ngành<span class="chu-phu">người có quyền quản trị KL thêm, sửa tên; không xoá</span></h2></div>
    <form class="form-hang" data-submit="themLinhVuc" novalidate>
      <div><label for="qtLvNganh" class="nhan">Ngành</label><select id="qtLvNganh" class="o-nhap nho"></select></div>
      <div class="grow"><label for="qtLvTen" class="nhan">Tên lĩnh vực mới</label><input type="text" id="qtLvTen" class="o-nhap nho" placeholder="Ví dụ: Tài chính công"></div>
      <button type="submit" class="nut nho chinh">Thêm lĩnh vực</button>
    </form>
    <div id="qtLvCanhBao" class="luong-canh-bao hidden" role="status" style="margin:0 16px 12px"></div>
    <div class="bang-cuon"><table>
      <thead><tr><th>Ngành</th><th>Mã</th><th>Tên lĩnh vực</th><th class="so">Thứ tự</th><th class="phai">Thao tác</th></tr></thead>
      <tbody id="qtLvBody"><tr><td colspan="5" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
  </div>
`;

export const quanTriNhatKyDanhMucTemplate = `
  <div class="bang">
    <div class="bang-dau"><h2>Nhật ký danh mục<span class="chu-phu">20 dòng gần nhất, không xoá được</span></h2></div>
    <div class="bang-cuon"><table>
      <thead><tr><th>Lúc</th><th>Người thực hiện</th><th>Hành động</th><th>Mã</th><th>Thay đổi</th><th>Lý do</th></tr></thead>
      <tbody id="qtLvNhatKyBody"><tr><td colspan="6" class="trong">Đang tải dữ liệu</td></tr></tbody></table></div>
  </div>
`;
