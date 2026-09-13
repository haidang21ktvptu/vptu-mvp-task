// Trạng thái dùng chung giữa các module (thay cho các biến toàn cục của index.html cũ).
// Không lưu xuống sessionStorage/localStorage: phiên do Supabase Auth quản.

export const state = {
  user: null,            // hồ sơ accounts_public của người đang đăng nhập
  accounts: [],          // toàn bộ accounts_public (danh bạ)
  allTasks: [],          // tasks đọc được (dùng tính KPI)
  taskParties: {},       // task_id -> { assigned_to, leader_in_charge, created_by }
  directiveUnread: {},   // task_id -> số ý kiến chưa đọc
  dmUnread: {},          // sender_id -> số tin nhắn chưa đọc
  currentDMPeerId: null, // người đang trò chuyện 1-1
};

export function isChief() {
  return state.user?.is_chief === true; // cùng nguồn với RLS (accounts.is_chief)
}

export function findAccount(id) {
  return state.accounts.find((a) => a.id === id);
}
