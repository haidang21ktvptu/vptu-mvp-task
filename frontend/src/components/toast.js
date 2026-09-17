// Thông báo dạng toast thay cho alert() (CLAUDE.md). Kiểu theo mockup v7: giữa dưới, nền tối, chữ trắng, tự đóng sau 4 giây, không rung.
const TYPE_CLASS = { success: 'toast-thanh-cong', error: 'toast-loi', info: '' };
const AUTO_CLOSE_MS = 4000;

function container() {
  let box = document.getElementById('toastContainer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastContainer';
    box.className = 'toast-hop';
    document.body.appendChild(box);
  }
  return box;
}

export function notify(message, type = 'info') {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `toast ${TYPE_CLASS[type] || ''}`;
  const text = document.createElement('p');
  text.className = 'flex-1 whitespace-pre-wrap';
  text.innerText = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-dong';
  close.setAttribute('aria-label', 'Đóng thông báo');
  close.innerText = '✕';
  close.addEventListener('click', () => el.remove());
  el.append(text, close);
  container().appendChild(el);
  setTimeout(() => el.remove(), AUTO_CLOSE_MS);
  return el;
}

export const notifySuccess = (message) => notify(message, 'success');
export const notifyError = (message) => notify(message, 'error');
