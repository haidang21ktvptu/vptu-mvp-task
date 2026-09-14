# tests/e2e — Playwright end-to-end trên staging (SPEC GĐ4, NF-4)

7 kịch bản theo `docs/PROMPTS.md` "Giai đoạn 4", chạy trên bản build Vite (`vite preview`) trỏ tới **staging** với 3 tài khoản seed (`demo_cvp`, `demo_truongphong`, `demo_cv1`, mật khẩu `123456`), ở **2 kích thước**: `desktop` 1280×800 và `mobile` 360×740.

| # | Kịch bản | File |
|---|---|---|
| 1–3 | Đăng nhập A1/A2/A3 vào đúng view; sai mật khẩu báo lỗi; tải lại giữ phiên; đăng xuất | `dang-nhap.spec.js` |
| 4–6 | A2 giao việc → A3 tiếp nhận + nộp minh chứng (URL sai bị chặn) → A2 duyệt, KPI | `nhiem-vu.spec.js` |
| 7 (bổ sung) | Hai phiên song song: A2 gửi ý kiến chỉ đạo và tin nhắn riêng → A3 nhận realtime (huy hiệu, viền dòng, toast) và trả lời | `realtime.spec.js` |

```
cd tests/e2e && npm ci && npx playwright install chromium
npm test                  # 13 test: desktop + mobile (phiên sẵn) rồi dang-nhap (form)
npm run test:desktop      # hoặc test:mobile
npm run report            # mở báo cáo HTML của lần chạy gần nhất
```

- Key lấy theo thứ tự: biến môi trường `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (CI dùng secret **staging**) → `E2E_LOCAL=1` (Supabase cục bộ) → Supabase CLI đã `supabase login` (`lib/keys.mjs`, như `tests/rls`). Không có `.env` chứa key; từ chối chạy nếu URL là project production.
- `global-setup.mjs` dọn nhiệm vụ `E2E-TEST%` của lần chạy trước bằng service_role, rồi đăng nhập A1/A2/A3 qua API (3 lượt) và ghi phiên thành storageState `.auth/<vai trò>.json` (khoá `sb-<ref>-auth-token` của supabase-js).
- Chạy tuần tự (1 worker) vì dùng chung dữ liệu. Project `desktop` và `mobile` mở trang với phiên sẵn (`pageAs`, không tốn lượt đăng nhập); project `dang-nhap` (kịch bản 1–3, đăng nhập thật qua form, A3 ở 360px) chạy **sau cùng** (`dependencies`) vì đăng xuất huỷ phiên toàn cục của tài khoản. Tổng **7 lượt đăng nhập/lần chạy** (giới hạn Supabase 30 lượt/5 phút/IP).
- `realtime.spec.js` tạo nhiệm vụ mẫu bằng service_role và xoá tin nhắn cũ giữa `demo_truongphong` ↔ `demo_cv1` (dữ liệu giả) để huy hiệu bắt đầu từ 0; realtime gói Free có thể trễ vài giây nên các khẳng định realtime chờ tới 20 s.
- Chạy trong CI ở job `Kiểm thử RLS + e2e trên staging` (`ci.yml`, mọi PR) cùng `tests/rls` — tổng 13 lượt đăng nhập; xem `docs/kien-truc.md`.
- `smoke/` + `playwright.smoke.config.js`: smoke test sau phát hành production (`deploy-prod.yml`) — mở bản live, đăng nhập 1 tài khoản (`SMOKE_USERNAME`/`SMOKE_PASSWORD`), vào app, đăng xuất. Chạy tay: `SMOKE_URL=... SMOKE_USERNAME=... SMOKE_PASSWORD=... npx playwright test -c playwright.smoke.config.js`.
