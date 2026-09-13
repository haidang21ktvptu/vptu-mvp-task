/** @type {import('tailwindcss').Config} */
// Hệ màu/phông theo docs/DESIGN.md (GĐ5). Giá trị gốc nằm ở src/styles/tokens.css; khai báo
// lại ở đây để dùng được dạng tiện ích (bg-cb-cham, text-cb-muc-nhat, font-serif...).
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        cb: {
          do: '#A6192E', 'do-dam': '#8E1527', vang: '#C9A227', cham: '#1C2A44', 'cham-sang': '#26375A',
          ngoc: '#2E7D6E', da: '#F4F2ED', giay: '#FFFFFF', muc: '#1D2433', 'muc-nhat': '#5B6474', vien: '#DDD8CE',
        },
        muc: {
          xanh: '#2E7D6E', 'xanh-bg': '#E6F2EF', vang: '#8A6512', 'vang-bg': '#FBF3DF',
          do: '#B42318', 'do-bg': '#FBE9E7', dodb: '#7A0C1E', 'dodb-bg': '#F6DCE0',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        serif: ['"Noto Serif"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      borderRadius: { input: '4px', card: '6px' },
      boxShadow: { modal: '0 8px 24px rgba(28,42,68,.18)' },
    },
  },
  plugins: [],
};
