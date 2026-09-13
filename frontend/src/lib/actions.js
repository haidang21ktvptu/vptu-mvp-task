// Uỷ quyền sự kiện cho phần tử sinh động (thay cho onclick="..." inline của bản cũ).
// Phần tử khai báo data-action="tenHanhDong" (click) hoặc data-submit="tenHanhDong" (form);
// tham số truyền qua data-* và nhận ở handler dưới dạng dataset.

const registry = {};

export function registerActions(actions) {
  Object.assign(registry, actions);
}

function dispatch(name, el, event) {
  const handler = registry[name];
  if (!handler) {
    console.warn(`Chưa đăng ký hành động: ${name}`);
    return;
  }
  event.preventDefault();
  handler(el.dataset, el, event);
}

export function initActionDelegation(root = document.body) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (el && root.contains(el)) dispatch(el.dataset.action, el, event);
  });
  root.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-submit]');
    if (form && root.contains(form)) dispatch(form.dataset.submit, form, event);
  });
}
