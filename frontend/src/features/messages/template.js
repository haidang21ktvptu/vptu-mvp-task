// Toast tin nhắn mới, danh bạ và khung chat 1-1 (MSG-1/2) theo DESIGN mục 5.
// Mục "Nhắn tin" (#dmBubbleLauncher + huy hiệu #dmBubbleBadge) nằm ở thanh bên, do views/shell.js vẽ.
export const messagesTemplate = `
<!-- TOAST TIN NHẮN MỚI (realtime) -->
<div id="realtimeToast" class="toast toast-tin hidden" role="status">
  <div class="flex-1 min-w-0">
    <b id="toastSender" class="font-medium">Tin nhắn mới</b>
    <p id="toastContent" class="whitespace-pre-wrap">--</p>
    <div class="mt-2"><button type="button" id="toastActionBtn" class="btn btn-phu btn-nho btn-sang">Mở hội thoại</button></div>
  </div>
  <button type="button" data-action="closeToast" class="toast-dong" aria-label="Đóng thông báo">✕</button>
</div>

<!-- DANH BẠ CHỌN NGƯỜI NHẮN TIN -->
<div id="dmPickerModal" class="modal-nen hidden" role="dialog" aria-modal="true" aria-labelledby="dmPickerTitle">
  <div class="modal">
    <div class="flex items-start justify-between gap-3 mb-3">
      <h2 id="dmPickerTitle" class="modal-tieu-de">Danh bạ nhắn tin</h2>
      <button type="button" data-action="closeDMPicker" class="btn btn-phu btn-nho">Đóng</button>
    </div>
    <label for="dmSearchContact" class="nhan">Tìm cán bộ</label>
    <input type="search" id="dmSearchContact" class="input input-nho" placeholder="Tên, chức vụ hoặc phòng">
    <div id="dmContactList" class="danh-ba"></div>
  </div>
</div>

<!-- KHUNG CHAT 1-1 -->
<div id="dmModal" class="khung-chat hidden" role="dialog" aria-labelledby="dmChatHeaderName">
  <div class="chat-dau">
    <div class="nguoi">
      <b id="dmChatHeaderName">--</b>
      <small id="dmChatHeaderRole">--</small>
    </div>
    <div class="flex gap-2 shrink-0">
      <button type="button" data-action="openDMPicker" class="btn btn-phu btn-nho">Danh bạ</button>
      <button type="button" data-action="closeDMModal" class="btn btn-phu btn-nho" aria-label="Đóng khung chat">Đóng</button>
    </div>
  </div>
  <div id="dmChatBox" class="chat-hop" aria-live="polite">
    <p class="chu-phu text-center">Đang tải tin nhắn</p>
  </div>
  <form data-submit="handleSendDM" class="chat-gui">
    <input type="text" id="dmInput" required class="input input-nho" placeholder="Nhập tin nhắn" aria-label="Nội dung tin nhắn">
    <button type="submit" class="btn btn-cham btn-nho">Gửi</button>
  </form>
</div>
`;
