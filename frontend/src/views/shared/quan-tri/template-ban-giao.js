// Hai hộp của "Bàn giao tài khoản" (v3.15): chọn phạm vi + xác nhận; kết quả một lần với Tải Excel / In phiếu. Logic ở ban-giao.js.
export const banGiaoModalTemplate = `
<div id="qtBgModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtBgTitle">
  <form id="qtBgForm" class="modal" data-submit="thucHienBanGiao" novalidate>
    <h2 id="qtBgTitle" class="modal-tieu-de">Bàn giao tài khoản — đặt lại mật khẩu tạm hàng loạt</h2>
    <p class="chu-phu" style="margin-top:6px">Mỗi tài khoản trong phạm vi nhận một mật khẩu tạm mới và phải đổi khi đăng nhập lần đầu. Mật khẩu chỉ hiện một lần ở bước sau để tải tệp Excel hoặc in phiếu từng người; hệ thống không lưu lại.</p>
    <label class="nhan" for="qtBgPhamVi">Phạm vi</label>
    <select id="qtBgPhamVi" class="o-nhap"><option value="toan_bo">Toàn bộ tài khoản</option><option value="phong">Theo phòng / đơn vị</option><option value="vai">Theo vai trò</option></select>
    <div id="qtBgPhongWrap" class="hidden"><label class="nhan" for="qtBgPhong">Phòng / đơn vị</label><select id="qtBgPhong" class="o-nhap"></select></div>
    <div id="qtBgVaiWrap" class="hidden"><label class="nhan" for="qtBgVai">Vai trò</label><select id="qtBgVai" class="o-nhap"></select></div>
    <label class="cn-o" style="margin-top:10px"><input type="checkbox" id="qtBgKeCa"><span><b>Kể cả tài khoản đã đổi mật khẩu (đang dùng)</b><small>Mặc định chỉ đặt lại tài khoản chưa đăng nhập lần đầu; tài khoản hệ thống, đang khoá và chính đồng chí luôn được bỏ qua.</small></span></label>
    <div id="qtBgCanhBaoKeCa" class="luong-canh-bao hidden">Người đang dùng sẽ không đăng nhập được bằng mật khẩu hiện có và phải nhận mật khẩu tạm mới — chỉ dùng khi thật cần.</div>
    <p id="qtBgSoChon" class="luong-ok" style="margin-top:12px"></p>
    <details id="qtBgBoQua" class="chu-phu hidden"></details>
    <label class="nhan" for="qtBgLyDo">Lý do (ghi nhật ký)</label><input type="text" id="qtBgLyDo" class="o-nhap" placeholder="Bàn giao tài khoản đợt go-live tháng 10/2026">
    <label class="nhan" for="qtBgXacNhan">Gõ chữ <b>BÀN GIAO</b> để xác nhận</label><input type="text" id="qtBgXacNhan" class="o-nhap" autocomplete="off" placeholder="BÀN GIAO">
    <div id="qtBgError" class="loi-inline hidden" role="alert"></div>
    <div class="modal-chan"><button type="button" class="nut" data-action="dongHopBanGiao">Huỷ</button><button type="submit" id="qtBgThucHien" class="nut nguy-hiem" disabled>Đặt lại và xuất tệp</button></div>
  </form>
</div>
<div id="qtBgKqModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="qtBgKqTitle">
  <div class="modal modal-bat-buoc">
    <h2 id="qtBgKqTitle" class="modal-tieu-de">Kết quả bàn giao — chỉ hiện một lần</h2>
    <p id="qtBgKqMoTa" class="chu-phu" style="margin-top:6px"></p>
    <p class="mk-tam"><button type="button" class="nut chinh" data-action="taiExcelBanGiao">Tải Excel bàn giao</button><button type="button" class="nut" data-action="inPhieuBanGiao">In phiếu từng người</button></p>
    <ul id="qtBgKqDanhSach" class="bg-danh-sach"></ul>
    <label class="cn-o" style="margin-top:10px"><input type="checkbox" id="qtBgKqDaGhi"><span><b>Tôi đã ghi lại theo cách khác</b><small>chỉ tick khi không tải được tệp và không in được</small></span></label>
    <div class="modal-chan"><button type="button" id="qtBgKqDong" class="nut chinh" data-action="dongKetQuaBanGiao" disabled>Đã tải / in xong, đóng</button></div>
  </div>
</div>
`;
