/** @type {import('tailwindcss').Config} */
// Token theo docs/ui-ux/mockup-v7.html; giá trị gốc ở src/styles/tokens.css, khai báo lại đây để dùng dạng tiện ích khi cần
// (bg-do, text-chu-phu...). Giao diện chủ yếu dùng lớp thành phần tự viết trong @layer components.
export default {
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {
      colors: {
        do: '#D42018', 'do-dam': '#A8140F', 'do-nhat': '#FBE6E9', vang: '#F2B705', 'vang-nhat': '#FFF6D6', lam: '#0A62C7', 'lam-nhat': '#E7F0FB',
        luc: '#1E8E5A', 'luc-nhat': '#E4F3EA', cam: '#D9711C', 'cam-nhat': '#FBEBDC', nen: '#FFFFFF', 'nen-phu': '#F7F8FA', vien: '#E3E7EC',
        chu: '#1B2430', 'chu-phu': '#606B7A',
      },
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
