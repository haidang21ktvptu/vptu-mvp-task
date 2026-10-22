import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DS_TEP } from './src/lib/tuyen.js';
import { chinhSachNoiDung, doanScriptNoiTuyen } from './src/lib/csp.js';

// GitHub Pages phục vụ ở https://<user>.github.io/vptu-mvp-task/ nên mọi đường dẫn
// tài nguyên phải có tiền tố /vptu-mvp-task/. Đổi bằng BASE_PATH khi cần (ví dụ "/").
// v3.29 (chủ dự án 22/10/2026 — CAU-HOI O-7), chỉ ở bản build:
// - chính sách nội dung (CSP, thẻ meta ngay sau charset): chỉ chạy mã của chính hệ thống (cùng nguồn + mã băm của đoạn nội tuyến có sẵn), chỉ kết nối
//   tới máy chủ dữ liệu của bản đó (VITE_SUPABASE_URL), không nhúng đối tượng ngoài, biểu mẫu không gửi ra ngoài (src/lib/csp.js);
// - mỗi đường dẫn chức năng (src/lib/tuyen.js DS_TEP) có sẵn một bản sao index.html (Tong-quan.html, Quan-tri/Tai-khoan.html…): Pages trả "/Tong-quan"
//   từ Tong-quan.html, không chuyển hướng; đường dẫn lạ / sai chữ hoa do 404.html chung của site (.github/actions/build-pages-site) chuyển về app.
const OUT = resolve(import.meta.dirname, 'dist');
const bam = (s) => createHash('sha256').update(s, 'utf8').digest('base64');

const chinhSach = () => ({
  name: 'vptu-chinh-sach-noi-dung',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      const csp = chinhSachNoiDung(process.env.VITE_SUPABASE_URL, { bamScript: doanScriptNoiTuyen(html).map(bam) });
      return html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  },
});
const tepDuongDan = () => ({
  name: 'vptu-tep-duong-dan',
  apply: 'build',
  closeBundle() {
    const goc = readFileSync(join(OUT, 'index.html'), 'utf8');
    DS_TEP.forEach((d) => { const f = join(OUT, `${d}.html`); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, goc); });
  },
});

export default defineConfig({
  base: process.env.BASE_PATH || '/vptu-mvp-task/',
  build: { outDir: OUT, emptyOutDir: true },
  plugins: [chinhSach(), tepDuongDan()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
