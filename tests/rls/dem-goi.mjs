// Đếm lời gọi HTTP (PR-2a, D3) — chỉ bật khi DEM_GOI=<file ghi>. Bọc globalThis.fetch (supabase-js dùng fetch toàn cục lúc gọi),
// phân loại theo đích: auth/<đường>, rest/<bảng>, rpc/<hàm>, storage, khác. Khi thoát, ghi thêm một dòng JSON
// { nhan: DEM_NHAN, tong, luot, loai } vào file. "luot" = số lời gọi bắt đầu khi không có lời gọi nào đang chờ ≈ số lượt khứ hồi
// tuần tự (Promise.all 4 lời gọi tính 1 lượt) — thời gian staging ≈ luot × độ trễ mỗi lời gọi. Không in URL/khoá. Dùng qua scripts/dem-goi-rls.mjs.
import { appendFileSync } from 'node:fs';

const FILE = process.env.DEM_GOI;
if (FILE && !globalThis.__demGoi) {
  const dem = new Map(); let dangCho = 0; let luot = 0;
  const goc = globalThis.fetch;
  globalThis.__demGoi = dem;
  globalThis.fetch = (input, init) => {
    const p = new URL(typeof input === 'string' ? input : input.url).pathname;
    const m = p.match(/^\/(auth|rest|storage|functions)\/v1\/(rpc\/)?([^/?]*)/);
    const loai = !m ? 'khac' : m[1] === 'rest' ? (m[2] ? `rpc/${m[3]}` : `rest/${m[3]}`) : m[1] === 'auth' ? `auth/${m[3]}` : m[1];
    dem.set(loai, (dem.get(loai) || 0) + 1);
    if (dangCho++ === 0) luot++;
    return goc(input, init).finally(() => { dangCho--; });
  };
  process.on('exit', () => {
    const loai = Object.fromEntries([...dem].sort((a, b) => b[1] - a[1]));
    const tong = [...dem.values()].reduce((a, b) => a + b, 0);
    appendFileSync(FILE, `${JSON.stringify({ nhan: process.env.DEM_NHAN || 'ca-bo', tong, luot, loai })}\n`);
  });
}
