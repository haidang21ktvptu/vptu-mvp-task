# frontend/ — VPTU-TASK v2 (Vite + JavaScript thuần + Tailwind)

Tách từ `index.html` gốc ở Giai đoạn 4; giao diện theo `docs/DESIGN.md` từ Giai đoạn 5.

## Chạy

```
cd frontend
npm ci
cp .env.example .env      # điền VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (staging)
npm run dev               # http://127.0.0.1:5173/vptu-mvp-task/
npm run build             # ra dist/ (CI + GitHub Pages)
npm run preview           # phục vụ dist/ ở http://127.0.0.1:4173/vptu-mvp-task/
```

- Chỉ **anon key** được có ở frontend, đọc từ `VITE_SUPABASE_*` (CLAUDE.md quy tắc 1). Production build lấy từ GitHub Secrets trong `.github/workflows/deploy-pages.yml`.
- `base` của Vite là `/vptu-mvp-task/` (GitHub Pages dạng project site); đổi bằng biến `BASE_PATH` khi cần.
- Giao diện theo `docs/DESIGN.md` (GĐ5): token ở `src/styles/tokens.css` và `tailwind.config.js`; lớp thành phần (`.btn`, `.input`, `.muc`, `.the`, `.modal`, `.thocam`…) trong `src/styles/*.css` qua `@layer`; Tailwind 3.4 chỉ dùng cho tiện ích bố cục nhỏ. Phông Noto Serif + Be Vietnam Pro tải từ Google Fonts (`index.html`).
- `@supabase/supabase-js` ghim phiên bản chính xác trong `package.json`.

## Cấu trúc `src/`

```
main.js            điểm vào: nối module, không chứa nghiệp vụ
lib/               supabase.js (client), constants.js, state.js (trạng thái chung), dom.js, actions.js (uỷ quyền sự kiện data-action)
auth/              login.js, change-password.js (AUTH-2), session.js (đăng xuất, khôi phục phiên)
components/        toast.js (thay alert()), modal dùng chung
views/             shell.js (thanh bên theo view.nav + đầu trang + hiện view theo vai trò), registry.js, index.js (gắn view/modal)
                   a1/ (template, dashboard ngoại lệ, cây phân cấp) · a2/ (template, giao việc, theo dõi/duyệt, KPI)
                   a3/ (template, danh sách, modal tiếp nhận, modal minh chứng) · shared/ (KPI nhóm, bảng việc inline)
features/          tasks/reassign (modal phân công lại) · directives/ (render: nút Ý kiến + huy hiệu; index: mở/nạp/gửi luồng)
                   messages/ (template, index: danh bạ + huy hiệu, chat: khung chat + toast) · realtime.js (kênh postgres_changes)
styles/            tokens.css (biến) · fonts.css (@font-face tự host) · base.css (chữ, tiêu điểm, thổ cẩm) · layout.css (đăng nhập, khung, mobile)
                   components.css (nút, input, huy hiệu, modal, toast) · tables.css (thanh số liệu, bảng, thẻ mobile) · features.css (luồng ý kiến, chat, in)
public/            fonts/ (woff2 subset vi + latin) · brand/ (logo tỉnh Cao Bằng, favicon — xem brand/README.md)
```

Quy ước: ESLint sạch (`npm run lint` ở gốc repo, cấu hình tối thiểu `eslint.config.js`); không file nào trên 300 dòng (`node scripts/check-line-limit.mjs`); phần tử sinh động dùng `data-action` thay cho `onclick` inline; chuỗi hiển thị tiếng Việt có dấu.
