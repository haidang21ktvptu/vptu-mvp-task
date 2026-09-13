# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ4 (tách frontend Vite) hoàn thành (2026-09-13)** — PR #13/#14/#15/#16 merge, `main` = `b9808a4`; Pages nguồn GitHub Actions, bản live là build Vite từ `main` (kiểm tra 3 vai trò, không lỗi console); `index.html` gốc đã xoá; ESLint + giới hạn 300 dòng trong CI; 4 nhánh `feature/gd4*` đã xoá. Sẵn sàng **GĐ5 (giao diện mới theo DESIGN.md, Plan mode)**.

## Nhánh & PR đang mở
- Không có.

## Đã xong
- GĐ1: RLS tạm + chặn `accounts.password`. GĐ2: Supabase Auth (0004–0006). GĐ3: RLS đầy đủ (0007–0010), 48 test RLS pass.
- GĐ4: `frontend/` Vite + JS thuần + Tailwind build, 57 file ≤ 185 dòng, `data-action` thay onclick, toast thay `alert()`; 0011 FK `accounts.id → auth.users.id` (staging + production); seed tạo auth user; e2e 16/16 (7 kịch bản × 1280/360px); `deploy-pages.yml` (secrets `VITE_SUPABASE_*`); production live = Vite.

## Đang dở
- GĐ5: giao diện mới theo `docs/DESIGN.md` (bắt đầu từ tokens.css + trang đăng nhập, duyệt bằng mắt); tiện thể bỏ gọi `loadA2Data` 2 lần khi A2 vào app.
- GĐ6: đưa `tests/rls` + `tests/e2e` vào CI với secret staging (quyết định 2026-09-13). GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Không còn câu hỏi mở của GĐ4.

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)** — 0011 đã áp production sau xác nhận. Backup mới nhất: `vptu-backup/prod-20260913-2206-gd4-*` (ngoài git).

## 3 lệnh để tiếp tục
```
cd tests/e2e && npm test          # 7 kịch bản × 2 kích thước trên staging (build + preview tự chạy); npm run lint ở gốc repo
```
```
cd tests/rls && npm test          # 48 test RLS trên staging
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/DESIGN.md, docs/PROMPTS.md "Giai đoạn 5" rồi làm GĐ5 bằng Plan mode.
```
