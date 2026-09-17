// Màn hình Nhắn tin (mockup): danh bạ xếp theo phòng ở trái, hội thoại ở giữa; tin hệ thống về một việc gom thành hội thoại của việc đó
// (có nút Mở việc), không lẫn với tin người. Toast tin mới (realtime) dùng chung với chuông.
export const messagesTemplate = `
  <div class="dau"><h1>Nhắn tin</h1><span>danh bạ theo phòng; tin hệ thống về một việc gom thành một hội thoại của việc đó — người trong phạm vi đều thấy</span></div>
  <div class="nt">
    <div class="ds-ht">
      <div class="tim"><input type="search" id="dmSearchContact" placeholder="Tìm người hoặc mã việc" aria-label="Tìm hội thoại"></div>
      <div id="dmViecKhoi"><h3>Việc có diễn biến</h3><div id="dmViecList"></div></div>
      <h3>Cán bộ</h3><div id="dmContactList"></div>
    </div>
    <div class="hoi" id="dmModal">
      <div class="dau-ht"><b id="dmChatHeaderName">Chọn một hội thoại</b><small id="dmChatHeaderRole" class="chu-phu"></small><span id="dmChatHeaderPhu"></span></div>
      <div id="dmChatBox" class="tin" aria-live="polite"><p class="trong-nho">Chọn cán bộ hoặc việc ở bên trái để xem hội thoại.</p></div>
      <form id="dmGuiForm" data-submit="handleSendDM" class="go hidden">
        <input type="text" id="dmInput" required placeholder="Nhập tin nhắn" aria-label="Nội dung tin nhắn" autocomplete="off">
        <button type="submit" class="nut lam">Gửi</button>
      </form>
      <div id="dmMoViec" class="go hidden"><span class="chu-phu" style="flex:1">Hội thoại của việc: chỉ đạo, cảnh báo, phản hồi — trả lời ngay trên việc.</span>
        <button type="button" class="nut" data-action="moViecTuHoiThoai">Mở việc</button></div>
    </div>
  </div>
`;

export const toastTinTemplate = `
<div id="realtimeToast" class="toast toast-tin hidden" role="status">
  <div class="flex-1 min-w-0">
    <b id="toastSender">Tin nhắn mới</b>
    <p id="toastContent" class="whitespace-pre-wrap">--</p>
    <div class="mt-2"><button type="button" id="toastActionBtn" class="nut nho sang">Mở hội thoại</button></div>
  </div>
  <button type="button" data-action="closeToast" class="toast-dong" aria-label="Đóng thông báo">✕</button>
</div>
`;
