// ESLint cấu hình tối thiểu (SPEC NF-7 "lint sạch"): bộ quy tắc recommended, không thêm plugin.
// frontend/src chạy trong trình duyệt; tests/e2e và scripts chạy bằng Node.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['**/node_modules/**', 'frontend/dist/**', 'tests/e2e/playwright-report/**', 'tests/e2e/test-results/**'],
  },
  {
    files: ['frontend/src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['frontend/*.js', 'tests/e2e/**/*.{js,mjs}', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
];
