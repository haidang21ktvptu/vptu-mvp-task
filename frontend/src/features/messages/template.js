// Toast tin nhắn, danh bạ và khung chat 1-1 (MSG-1/2), lấy nguyên từ index.html cũ.
export const messagesTemplate = `
<!-- TOAST THÔNG BÁO TIN NHẮN RIÊNG TƯ (DM) -->
<div id="realtimeToast" class="fixed top-5 right-5 z-[100] hidden max-w-sm w-full bg-white border-l-4 border-slate-700 rounded-lg shadow-2xl p-4 transition-all transform duration-300">
  <div class="flex items-start justify-between gap-3">
    <div class="flex items-start gap-2.5">
      <span class="text-xl">✉️</span>
      <div>
        <h4 id="toastSender" class="text-xs font-bold text-slate-800 uppercase">Tin nhắn riêng mới</h4>
        <p id="toastContent" class="text-xs text-slate-600 mt-1 italic bg-slate-50 p-2 rounded border">--</p>
      </div>
    </div>
    <button data-action="closeToast" class="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
  </div>
  <div class="mt-2.5 flex justify-end">
    <button id="toastActionBtn" class="bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded shadow">Mở cuộc trò chuyện</button>
  </div>
</div>

<!-- Mục "Nhắn tin" (#dmBubbleLauncher + huy hiệu #dmBubbleBadge) nằm ở thanh bên, do views/shell.js vẽ. -->

<!-- MODAL DANH BẠ CHỌN NGƯỜI NHẮN TIN -->
<div id="dmPickerModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center hidden p-4">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-3 max-h-[85vh] flex flex-col">
    <div class="flex justify-between items-center border-b pb-2">
      <h3 class="text-xs font-bold text-slate-900 uppercase">Danh Bạ Nhắn Tin Nội Bộ</h3>
      <button data-action="closeDMPicker" class="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
    </div>
    <input type="text" id="dmSearchContact" placeholder="🔍 Tìm tên cán bộ, phòng ban..." class="border rounded p-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-slate-700">
    <div id="dmContactList" class="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs"></div>
  </div>
</div>

<!-- KHUNG CHAT RIÊNG TƯ 1-1 -->
<div id="dmModal" class="fixed bottom-5 right-5 z-50 hidden bg-white rounded-xl shadow-2xl max-w-md w-full sm:w-[420px] p-4 space-y-3 flex flex-col h-[500px] border-2 border-slate-700">
  <div class="flex justify-between items-center border-b pb-2">
    <div class="truncate">
      <h3 id="dmChatHeaderName" class="text-xs font-bold text-slate-800 uppercase truncate">--</h3>
      <p id="dmChatHeaderRole" class="text-[10px] text-slate-500">--</p>
    </div>
    <div class="flex items-center gap-1">
      <button data-action="openDMPicker" title="Đổi người chat" class="p-1 hover:bg-slate-100 rounded text-slate-500 text-xs px-2">Danh bạ</button>
      <button data-action="closeDMModal" title="Đóng" class="p-1 hover:bg-slate-100 rounded text-slate-500 font-bold text-sm px-2">✕</button>
    </div>
  </div>
  <div id="dmChatBox" class="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-50 rounded-lg border text-xs">
    <p class="text-center text-slate-400">Đang tải tin nhắn...</p>
  </div>
  <form data-submit="handleSendDM" class="flex gap-2 pt-2 border-t">
    <input type="text" id="dmInput" required class="flex-1 border rounded-lg p-2 text-xs focus:ring-1 focus:ring-slate-700 focus:outline-none" placeholder="Nhập tin nhắn riêng...">
    <button type="submit" class="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-bold">Gửi</button>
  </form>
</div>

`;
