// Thông báo dạng toast thay cho alert() (CLAUDE.md quy ước code). Kiểu dáng theo DESIGN mục 5:
// góc dưới phải, nền chàm, chữ trắng, tự đóng sau 4 giây, không rung, không trượt vào.

const TYPE_CLASS = {
  success: 'toast-thanh-cong',
  error: 'toast-loi',
  info: '',
};

const AUTO_CLOSE_MS = 4000;

function container() {
  let box = document.getElementById('toastContainer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastContainer';
    box.className = 'fixed bottom-20 md:bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-40px)] pointer-events-none' // ≤768px: nằm trên thanh điều hướng dưới;
    document.body.appendChild(box);
  }
  return box;
}

export function notify(message, type = 'info') {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `pointer-events-auto toast ${TYPE_CLASS[type] || ''}`;
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
