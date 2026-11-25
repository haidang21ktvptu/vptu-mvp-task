/** @type {import('tailwindcss').Config} */
// v3.36 (chủ dự án duyệt 25/11/2026, CAU-HOI V-4): cấu hình đồng bộ token của docs/DESIGN.md — màu, chữ, cỡ chữ đọc thẳng biến CSS ở
// src/styles/tokens.css (một nơi khai báo giá trị). Giao diện chủ yếu dùng lớp thành phần tự viết trong @layer components; tiện ích Tailwind
// chỉ dùng cho ẩn hiện, căn lề. Cỡ chữ thay hẳn thang mặc định (text-xs = 13px, không còn 12px).
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    fontSize: {
      xs: 'var(--chu-nho)', sm: 'var(--chu-bang)', base: 'var(--chu-than)', md: 'var(--chu-o)', lg: 'var(--chu-muc)',
      xl: 'var(--chu-khoi)', '2xl': 'var(--chu-trang)', '3xl': 'var(--chu-so)',
    },
    extend: {
      colors: {
        do: 'var(--do)', 'do-dam': 'var(--do-dam)', 'do-nhat': 'var(--do-nhat)', vang: 'var(--vang)', 'vang-nhat': 'var(--vang-nhat)',
        lam: 'var(--lam)', 'lam-nhat': 'var(--lam-nhat)', luc: 'var(--luc)', 'luc-nhat': 'var(--luc-nhat)', cam: 'var(--cam)', 'cam-nhat': 'var(--cam-nhat)',
        nen: 'var(--nen)', 'nen-phu': 'var(--nen-phu)', vien: 'var(--vien)', chu: 'var(--chu)', 'chu-phu': 'var(--chu-phu)', navy: 'var(--navy)',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        'tieu-de': ['Lexend', '"Source Sans 3"', 'system-ui', 'sans-serif'],
        'van-ban': ['"Noto Serif"', 'Georgia', '"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
};
