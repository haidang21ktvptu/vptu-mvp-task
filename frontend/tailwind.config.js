/** @type {import('tailwindcss').Config} */
// Cấu hình mặc định (trùng bản Play CDN mà index.html cũ dùng) để giữ nguyên giao diện ở GĐ4.
// Hệ màu/phông theo docs/DESIGN.md sẽ đưa vào ở GĐ5.
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: { extend: {} },
  plugins: [],
};
