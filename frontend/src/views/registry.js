// Đăng ký view theo vai trò để shell gọi mà không import chéo.
// Mỗi view: { init(), reload() } — init khi vào app, reload sau thao tác làm đổi dữ liệu.

const views = {};

export function registerView(roleGroup, view) {
  views[roleGroup] = view;
}

export function getView(roleGroup) {
  return views[roleGroup];
}
