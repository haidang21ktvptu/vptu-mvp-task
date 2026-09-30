// Công tắc ĐỘ TRỄ GIẢ LẬP (PR-2a, sau lỗi đua biểu mẫu Giao việc ở CI #96): E2E_TRE_MS=<ms> ⇒ mọi context trì hoãn mỗi lời gọi REST/RPC
// (/rest/v1/) và Storage (/storage/v1/) của Supabase đúng số ms đó — bắt lỗi "giao diện cho thao tác trước khi nạp xong" mà Supabase cục bộ
// (phản hồi tức thì) che mất. MẶC ĐỊNH TẮT: không đặt biến ⇒ không đăng ký route nào. CI không đặt. Cách dùng: docs/KIEM-THU.md.
import { getKeys } from './keys.mjs';

export const TRE_MS = Number(process.env.E2E_TRE_MS || 0);

export async function ganTre(context) {
  if (!(TRE_MS > 0)) return;
  const goc = getKeys().url.replace(/\/$/, '');
  await context.route((u) => u.href.startsWith(`${goc}/rest/v1/`) || u.href.startsWith(`${goc}/storage/v1/`), async (route) => {
    await new Promise((r) => { setTimeout(r, TRE_MS); });
    await route.fallback();
  });
}
