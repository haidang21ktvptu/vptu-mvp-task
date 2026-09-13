// Gắn markup từng view/modal vào trang và đăng ký view theo vai trò (gọi một lần lúc khởi động).
import { registerA1View } from './a1/index.js';
import { registerA2View } from './a2/index.js';
import { registerA3View } from './a3/index.js';
import { mountReassignModal } from '../features/tasks/reassign.js';

export function registerViews() {
  registerA1View();
  registerA2View();
  registerA3View();
  mountReassignModal();
}
