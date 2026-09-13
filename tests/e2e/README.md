# tests/e2e — Playwright end-to-end trên staging (SPEC GĐ4, NF-4)

6 kịch bản theo `docs/PROMPTS.md` "Giai đoạn 4", chạy trên bản build Vite (`vite preview`) trỏ tới **staging** với 3 tài khoản seed (`demo_cvp`, `demo_truongphong`, `demo_cv1`, mật khẩu `123456`), ở **2 kích thước**: `desktop` 1280×800 và `mobile` 360×740.

| # | Kịch bản | File |
|---|---|---|
| 1–3 | Đăng nhập A1/A2/A3 vào đúng view; sai mật khẩu báo lỗi; tải lại giữ phiên; đăng xuất | `dang-nhap.spec.js` |
| 4–6 | A2 giao việc → A3 tiếp nhận + nộp minh chứng → A2 duyệt hoàn thành | `nhiem-vu.spec.js` (PR b) |

```
cd tests/e2e && npm ci && npx playwright install chromium
npm test                  # cả 2 kích thước
npm run test:desktop      # hoặc test:mobile
npm run report            # mở báo cáo HTML của lần chạy gần nhất
```

- Key lấy qua Supabase CLI đã `supabase login` (`lib/keys.mjs`, như `tests/rls`); không có `.env` chứa key. `E2E_LOCAL=1` để chạy trên Supabase cục bộ.
- `global-setup.mjs` dọn nhiệm vụ `E2E-TEST%` của lần chạy trước bằng service_role.
- Chạy tuần tự (1 worker) vì dùng chung dữ liệu; mỗi lần chạy khoảng 8 lượt đăng nhập — dưới giới hạn 30 lượt/5 phút/IP của Supabase.
- Chưa chạy trong CI (cần secret staging) — đưa vào pipeline ở GĐ6 cùng `tests/rls`.
