import { defineConfig, loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DS_TEP } from './src/lib/tuyen.js';
import { chinhSachNoiDung, doanScriptNoiTuyen } from './src/lib/csp.js';

// GitHub Pages phục vụ ở https://<user>.github.io/vptu-mvp-task/ nên mọi đường dẫn
// tài nguyên phải có tiền tố /vptu-mvp-task/. Đổi bằng BASE_PATH khi cần (ví dụ "/").
// v3.29 (chủ dự án 22/10/2026 — CAU-HOI O-7), chỉ ở bản build:
// - chính sách nội dung (CSP, thẻ meta ngay sau charset): chỉ chạy mã của chính hệ thống (cùng nguồn + mã băm của đoạn nội tuyến có sẵn), chỉ kết nối
//   tới máy chủ dữ liệu của bản đó (VITE_SUPABASE_URL), không nhúng đối tượng ngoài, biểu mẫu không gửi ra ngoài (src/lib/csp.js);
// - mỗi đường dẫn chức năng (src/lib/tuyen.js DS_TEP) có sẵn một bản sao index.html (Tong-quan.html, Quan-tri/Tai-khoan.html…): Pages trả "/Tong-quan"
//   từ Tong-quan.html, không chuyển hướng; đường dẫn lạ / sai chữ hoa do 404.html chung của site (.github/actions/build-pages-site) chuyển về app.
const GOC = fileURLToPath(new URL('.', import.meta.url));   // thư mục frontend/ (Vite thay import.meta.url khi gói tệp cấu hình)
const OUT = join(GOC, 'dist');
const bam = (s) => createHash('sha256').update(s, 'utf8').digest('base64');

const META = '<meta charset="UTF-8">';
// supabaseUrl: VITE_SUPABASE_URL của bản build (biến môi trường của CI / deploy, hoặc frontend/.env — loadEnv đọc cả hai). Thiếu địa chỉ hay thiếu thẻ
// charset thì dừng build: bản có connect-src 'self' chặn mọi lời gọi tới máy chủ dữ liệu (lỗi lặng lẽ, khó thấy).
const chinhSach = (supabaseUrl) => ({
  name: 'vptu-chinh-sach-noi-dung',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      if (!supabaseUrl) throw new Error('Thiếu VITE_SUPABASE_URL: chính sách nội dung cần địa chỉ máy chủ dữ liệu (biến môi trường hoặc frontend/.env).');
      if (!html.includes(META)) throw new Error(`index.html thiếu ${META} — không chèn được chính sách nội dung.`);
      const csp = chinhSachNoiDung(supabaseUrl, { bamScript: doanScriptNoiTuyen(html).map(bam) });
      return html.replace(META, `${META}\n  <meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  },
});
// Bản sao index.html cho mỗi đường dẫn; thư mục của đường dẫn có cấp con ("Quan-tri/") có thêm index.html — Pages chuyển "/Quan-tri" sang "/Quan-tri/"
// hay trả "Quan-tri.html" thì cũng vào được app.
const tepDuongDan = (out) => ({
  name: 'vptu-tep-duong-dan',
  apply: 'build',
  closeBundle() {
    const goc = readFileSync(join(out, 'index.html'), 'utf8');
    const thuMuc = [...new Set(DS_TEP.filter((d) => d.includes('/')).map((d) => `${d.split('/')[0]}/index`))];
    [...DS_TEP, ...thuMuc].forEach((d) => { const f = join(out, `${d}.html`); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, goc); });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, GOC, 'VITE_');
  return {
    base: process.env.BASE_PATH || '/vptu-mvp-task/',
    build: { outDir: OUT, emptyOutDir: true },
    plugins: [chinhSach(env.VITE_SUPABASE_URL), tepDuongDan(OUT)],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
