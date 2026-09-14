# Biên bản khôi phục thử — 2026-09-14

Diễn tập theo `docs/sao-luu-khoi-phuc.md` mục 4 (SPEC NF-6, điều kiện xong GĐ7). PR #29, nhánh `feature/gd7-backup-restore`.

- **Người thực hiện:** Bùi Bá Hải Đăng (chủ dự án, tự chạy theo hướng dẫn). Máy: Windows 10, Git Bash, Docker Desktop, supabase CLI 2.117.0, psql 18.6 (scoop).
- **File backup:** `prod-20260914-0820-tay.tar.gz.gpg` — tạo bằng `scripts/backup-db.sh --project-ref frwyxcmbonjaimziiuqr` lúc 08:20 UTC (15:20 giờ Việt Nam) ngày 2026-09-14, nguồn **production** (bản live `v2.0.0-rc2`), migration 0001–0012, lưu tại `D:\TU 2026\Project\vptu-backup\`.
- **Đích:** Supabase **LOCAL** (`supabase start`, Docker trên máy cá nhân) — **KHÔNG phải project hosted**: gói Free chỉ cho 2 project hoạt động (production + staging đã dùng hết) nên không tạo được project trắng. Khác biệt local/hosted và điều kiện thử lại trên hosted: `docs/sao-luu-khoi-phuc.md` mục 5.
- **Lệnh:** `bash scripts/restore-db.sh "<file>" --local --ghi-de` (xác nhận gõ `local` rồi `khoi phuc`).
- **Kết quả:** `KHÔI PHỤC XONG lên local`. 12 migration áp đủ (`supabase db push --local`, đối chiếu `migration list` khớp repo). Số dòng khớp `so-dong.txt`: `auth.users 49`, `auth.identities 49`, `public.accounts 49` (48 cán bộ + `smoke_test`). FK `accounts → auth.users`: 0 dòng mồ côi.
- **Đăng nhập thử:** frontend local (`npm run dev`, `.env` trỏ `http://127.0.0.1:54321`) — tài khoản thật `buibahaidang` với **mật khẩu đang dùng trên production**: thành công; giao diện đúng vai trò A3, tiếng Việt có dấu hiển thị đúng.
- **Dọn sau diễn tập:** đã xoá `frontend/.env`; `supabase db reset` trả local về 7 tài khoản giả từ `seed.sql`. Không còn dữ liệu thật ngoài file backup đã mã hoá.
- **Sự cố/ghi chú:** không có sự cố. Chưa kiểm chứng trên hosted ba điểm: quyền `postgres` không superuser (`SET session_replication_role`, `TRUNCATE auth.*`), kết nối qua Session pooler + SSL, phiên bản GoTrue của project đích — sẽ diễn tập lại khi lên gói Pro (AUTH-3) hoặc có project trắng.

**Kết luận:** quy trình sao lưu (`backup-db.sh`) → khôi phục (`restore-db.sh`) hoạt động đầu-cuối trên máy của chủ dự án với dữ liệu production thật; mật khẩu cán bộ giữ nguyên sau khôi phục. Cửa sổ mất dữ liệu tối đa theo chính sách: 3 ngày (backup định kỳ, PR B).
