import { defineConfig } from 'vite';

// GitHub Pages phục vụ ở https://<user>.github.io/vptu-mvp-task/ nên mọi đường dẫn
// tài nguyên phải có tiền tố /vptu-mvp-task/. Đổi bằng BASE_PATH khi cần (ví dụ "/").
export default defineConfig({
  base: process.env.BASE_PATH || '/vptu-mvp-task/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
