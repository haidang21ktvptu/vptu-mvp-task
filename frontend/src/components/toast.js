// Thông báo dạng toast thay cho alert() (CLAUDE.md quy ước code). Kiểu dáng lấy theo
// toast tin nhắn của bản cũ (góc phải trên, thẻ trắng viền trái) để giao diện không đổi.

const TYPE_BORDER = {
  success: 'border-green-600',
  error: 'border-red-600',
  info: 'border-slate-700',
};

const AUTO_CLOSE_MS = 4500;

function container() {
  let box = document.getElementById('toastContainer');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastContainer';
    box.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none';
    document.body.appendChild(box);
  }
  return box;
}

export function notify(message, type = 'info') {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `pointer-events-auto bg-white border-l-4 ${TYPE_BORDER[type] || TYPE_BORDER.info} rounded-lg shadow-2xl p-4 text-xs text-slate-800 flex items-start justify-between gap-3`;
  const text = document.createElement('p');
  text.className = 'font-semibold whitespace-pre-wrap';
  text.innerText = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'text-slate-400 hover:text-slate-600 text-sm font-bold';
  close.innerText = '✕';
  close.addEventListener('click', () => el.remove());
  el.append(text, close);
  container().appendChild(el);
  setTimeout(() => el.remove(), AUTO_CLOSE_MS);
  return el;
}

export const notifySuccess = (message) => notify(message, 'success');
export const notifyError = (message) => notify(message, 'error');
