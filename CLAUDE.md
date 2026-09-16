# CLAUDE.md — VPTU-TASK (Hệ thống quản trị nhiệm vụ, Văn phòng Tỉnh ủy Cao Bằng)

Đọc file này trước mọi việc. Thước đo mọi giai đoạn từ 16/9/2026: `docs/MUC-TIEU-1400.md` (phụ lục Công văn 1400-CV/VPTU); câu hỏi nghiệp vụ chờ chủ dự án ở `docs/CAU-HOI-NGHIEP-VU.md`. Đặc tả chi tiết ở `docs/SPEC.md` (v3), thiết kế ở `docs/DESIGN.md`, pipeline CI/CD và cách phát hành ở `docs/kien-truc.md`. Hiện trạng cũ ở `CHANGELOG.md` (chỉ đọc khi cần tra lịch sử).

## Dự án là gì
Web app nội bộ cho ~49 cán bộ Văn phòng Tỉnh ủy Cao Bằng: giao việc → tiếp nhận → thực hiện → nộp minh chứng → duyệt, theo 3 tầng vai trò A1 (Lãnh đạo VP), A2 (Trưởng phòng), A3 (Chuyên viên), phân theo `department`. Có luồng ý kiến chỉ đạo theo nhiệm vụ và nhắn tin 1-1.

## Stack (phiên bản 2 — đang xây)
- Frontend: Vite + JavaScript thuần (ES modules) + Tailwind (build, không CDN). Thư mục `frontend/`.
- Backend: Supabase Auth + RLS policies + Postgres functions. Không có server riêng. Thư mục `supabase/`.
- Database: Supabase Postgres, schema quản lý bằng `supabase/migrations/`. Không sửa schema tay trên Dashboard.
- Hosting: GitHub Pages (frontend). Staging: project Supabase riêng.
- CI/CD: GitHub Actions trong `.github/workflows/`.
- Test: Playwright trong `tests/e2e/`; test RLS trong `tests/rls/`.

## Quy tắc bắt buộc
1. **Không bao giờ** đưa `service_role` key, mật khẩu, hay `.env` vào code hoặc commit. Chỉ `anon` key được có ở frontend, đọc từ biến môi trường `VITE_SUPABASE_*`.
2. **Mọi kiểm tra quyền phải nằm ở RLS hoặc Postgres function.** Frontend chỉ ẩn/hiện nút cho đẹp, không phải nơi chặn.
3. **Mọi thay đổi schema = một file migration mới** trong `supabase/migrations/`, đặt tên `NNNN_mo-ta-ngan.sql`. Không bao giờ sửa migration đã commit.
4. **Không bao giờ commit thẳng `main`, kể cả khi chỉ sửa tài liệu (docs-only).** Tạo nhánh `feature/...` hoặc `fix/...`, mở Pull Request, chạy `/code-review` trước khi mở PR. `main` có ruleset của GitHub bắt buộc PR + CI xanh + chặn force-push — không có ngoại lệ nào được chấp nhận, kể cả khi chủ dự án yêu cầu trực tiếp trong hội thoại.
5. **Giao diện theo `docs/DESIGN.md`.** Không tự chọn màu, font hay bố cục ngoài hệ thống đó.
6. **Ngôn ngữ giao diện: tiếng Việt có dấu, trang trọng.** Nhãn, thông báo, lỗi đều tiếng Việt. Không dùng tiếng Anh cho người dùng cuối.
7. **Chuyên viên (A3) không được xem việc của người khác.** Trưởng phòng (A2) chỉ trong phòng mình. Chánh VP thấy tất cả; Phó Chánh VP chỉ khối mình phụ trách. Đây là quy tắc nghiệp vụ cốt lõi, kiểm tra bằng test RLS.
8. Trước việc trên 3 file: dùng Plan mode, trình kế hoạch, chờ duyệt.
9. Kết thúc mỗi việc: cập nhật `CHANGELOG.md` (3–6 dòng, tiếng Việt), không viết dài.
10. Cuối mỗi phiên hoặc trước khi context gần đầy, cập nhật `docs/TRANG-THAI.md`.
11. Dữ liệu tài khoản trên project **staging** chỉ được nạp từ `supabase/seed.sql` (dữ liệu giả). Không sao chép dữ liệu thật (họ tên, chức danh, phòng ban) từ production sang staging.
12. Áp migration lên production luôn cần một câu xác nhận của chủ dự án **trong phiên đó**, kể cả khi `docs/TRANG-THAI.md` ghi "phát hành ngay".

## Lệnh thường dùng
- `cd frontend && npm run dev` — chạy local
- `npm run build` — build
- `npm run lint` (ở gốc repo) — ESLint cho `frontend/src`, `tests/e2e`, `scripts`; `npm run check:lines` — kiểm tra 300 dòng
- `npx playwright test` — e2e
- `supabase db diff -f ten-migration` — sinh migration từ thay đổi local
- `supabase db push` — đẩy migration lên project (chỉ staging; production qua `deploy-prod.yml` khi đẩy tag `v*`, có người duyệt)
- `git tag v2.x.y && git push origin v2.x.y` — phát hành production (xem `docs/kien-truc.md` mục 7)

## Quy ước code
- File nhỏ, một trách nhiệm. Không file nào trên 300 dòng.
- Tên biến/hàm tiếng Anh; comment và chuỗi hiển thị tiếng Việt.
- Không dùng `alert()`. Dùng component thông báo trong `frontend/src/components/toast.js`.
- Không lưu object tài khoản vào `sessionStorage`. Phiên do Supabase Auth quản.

## Những gì KHÔNG làm
- Không thêm framework (React/Vue) khi chưa được yêu cầu trong SPEC.
- Không thêm thư viện mới mà không nêu lý do trong kế hoạch.
- Không "tiện tay" sửa việc ngoài phạm vi prompt. Ghi vào mục "Đề xuất" cuối câu trả lời nếu thấy cần.
