# Xử lý sự cố — đọc khi đang cuống

**Ba việc làm trước mọi thứ:** (1) mở bản live: `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` — có hiện `phien_ban` không, tag nào; (2) mở GitHub → **Actions** — run nào đỏ, ở bước nào; (3) mở Supabase Dashboard → project **vptu-mvp-task** (`frwyxcmbonjaimziiuqr`) — trạng thái *Healthy* hay *Paused*.
**Hai điều không làm:** không sửa tay bảng trên Dashboard (Table Editor); không xoá tag, không xoá project. **Ghi lại** giờ phát hiện và từng việc đã làm (giấy hay ghi chú điện thoại đều được) — sau này ghi CHANGELOG.

| Địa chỉ nhanh | |
|---|---|
| Bản live | `https://haidang21ktvptu.github.io/vptu-mvp-task/` (phiên bản: `/phien-ban.json`) |
| Actions | `https://github.com/haidang21ktvptu/vptu-mvp-task/actions` |
| Dashboard production | `https://supabase.com/dashboard/project/frwyxcmbonjaimziiuqr` |
| UptimeRobot | `https://dashboard.uptimerobot.com` (monitor `VPTU-TASK bản live`) |
| Backup trên máy | `D:\TU 2026\Project\vptu-backup\` — cách dùng: `docs/sao-luu-khoi-phuc.md` |

Mọi lệnh dưới đây gõ trong **Git Bash** tại thư mục repo: `cd "/d/TU 2026/Project/vptu-mvp-task"`.

## 1. Phát hành báo xanh nhưng bản live không đổi
- **Dấu hiệu:** deploy-prod xanh (job Deploy Pages xong sau vài giây) nhưng `/phien-ban.json` vẫn ghi tag cũ; smoke có thể đỏ. Đã xảy ra với `v2.0.0-rc1` (14/9/2026).
- **Nguyên nhân:** tag gắn lên commit đã từng deploy Pages (commit đã lên `main` sau merge) — GitHub Pages chỉ nhận mỗi commit một lần. Job `kiem-tra` nay chặn sớm việc này.
- **Xử lý:** không tag lại commit cũ. Tạo commit mới rồi tag số mới, làm theo `docs/kien-truc.md` mục 7 (tag lên đầu nhánh PR **trước** khi merge). Nếu cần quay về bản đang chạy tốt: `kien-truc.md` mục 6 "Nguyên tắc".
- **Khôi phục từ backup?** Không — dữ liệu không đổi.

## 2. Workflow đỏ ở bước `supabase/setup-cli`: "rate limit exceeded"
- **Dấu hiệu:** run đỏ ngay bước đầu, log có `rate limit exceeded` khi tải Supabase CLI.
- **Nguyên nhân:** GitHub giới hạn tải file release khi chạy nhiều workflow trong ngày. Không phải lỗi cấu hình.
- **Xử lý:** chờ 30–60 phút → mở run → **Re-run failed jobs**. Không sửa gì trong repo.
- **Khôi phục từ backup?** Không.

## 3. Backup định kỳ ngừng chạy
- **Dấu hiệu:** Actions → *Backup định kỳ production* không có run mới quá 3 ngày, hoặc có dòng "This scheduled workflow is disabled"; `vptu-backup` không có file mới.
- **Nguyên nhân:** GitHub tự tắt lịch sau 60 ngày repo không có commit; hoặc token hết hạn (xem #7).
- **Xử lý:** trang workflow → **Enable workflow** → **Run workflow** (chạy ngay) → đợi xanh → về máy: `bash scripts/tai-backup.sh`. Nếu vẫn đỏ: xem log, thường là #2 hoặc #7.
- **Khôi phục từ backup?** Không — chỉ mất tính liên tục; bản gần nhất vẫn còn trong `vptu-backup`.

## 4. Không ai đăng nhập được, Dashboard báo project "Paused"
- **Dấu hiệu:** giao diện báo lỗi mạng/không đăng nhập được với mọi tài khoản; Dashboard project ghi *Paused*. Thường sau kỳ nghỉ dài.
- **Nguyên nhân:** gói Free tự tạm dừng project sau 7 ngày không có truy vấn.
- **Xử lý:** Dashboard → nút **Restore project** → chờ 2–5 phút tới *Healthy* → mở bản live đăng nhập thử → báo cán bộ. Dữ liệu còn nguyên.
- **Khôi phục từ backup?** Không. Chỉ khi Restore thất bại quá 1 giờ (Dashboard báo lỗi) → #10.

## 5. Cán bộ báo "vui lòng chờ 5 phút"
- **Dấu hiệu:** nhiều người cùng lúc thấy thông báo "Hệ thống đang nhận quá nhiều lượt đăng nhập… chờ 5 phút", nhất là 7h30–8h.
- **Nguyên nhân:** Supabase giới hạn 30 lượt đăng nhập/5 phút cho mỗi địa chỉ IP; cả cơ quan dùng chung một IP (hạn chế tạm của gói Free, SPEC AUTH-3).
- **Xử lý:** bảo mọi người chờ đúng 5 phút, không bấm lại liên tục (mỗi lần bấm là một lượt). Nếu lặp lại hằng ngày: Dashboard → **Authentication → Rate Limits** → nâng *Sign-ins* (ví dụ 100/5 phút); lâu dài: lên gói Pro + bật hook khoá theo tài khoản (`docs/TRANG-THAI.md` mục 6).
- **Khôi phục từ backup?** Không.

## 6. Cán bộ quên mật khẩu

> **CẢNH BÁO — mục duy nhất ghi thẳng vào dữ liệu production.** Chỉ chạy sau khi đã **gọi điện xác minh đúng cán bộ** đang yêu cầu. Kiểm tra kỹ `username` ở bước xem trước **rồi mới** chạy bước ghi — gõ nhầm là đổi mật khẩu của người khác. Không có nút nào trên Dashboard làm việc này; email `@vptu.caobang.local` không nhận thư đặt lại.

- **Dấu hiệu:** cán bộ báo không nhớ mật khẩu, đăng nhập sai nhiều lần.
- **Nguyên nhân:** quên; hoặc đang bị #5 (hỏi trước: có thấy dòng "chờ 5 phút" không).
- **Xử lý:** thay `demo_cv1` bằng username thật (chữ thường, không dấu) ở **cả ba** lệnh.
  Bước 0 — xem trước, phải thấy **đúng 1 dòng** với đúng họ tên, chức danh, phòng:
  ```bash
  supabase db query --linked --project-ref frwyxcmbonjaimziiuqr "select username, full_name, position_title, department from public.accounts where username = 'demo_cv1'"
  ```
  Bước 1 — đặt mật khẩu tạm (sinh ngẫu nhiên phía máy chủ, chỉ hiện một lần, không nằm trong lệnh); kết quả phải là **đúng 1 dòng** với đúng họ tên vừa xem — 0 dòng = sai username (chưa đổi gì), 2 dòng trở lên = dừng ngay, báo người phụ trách:
  ```bash
  supabase db query --linked --project-ref frwyxcmbonjaimziiuqr "with tam as (select 'Tam' || (1000 + floor(random() * 9000))::int || substr(md5(random()::text), 1, 4) as mk) update auth.users u set encrypted_password = extensions.crypt(tam.mk, extensions.gen_salt('bf', 10)), updated_at = now() from tam, public.accounts a where a.id = u.id and a.username = 'demo_cv1' returning a.username, a.full_name, tam.mk as mat_khau_tam"
  ```
  Bước 2 — bắt đổi mật khẩu ở lần đăng nhập kế (chạy **sau** bước 1; kết quả phải là `1`):
  ```bash
  supabase db query --linked --project-ref frwyxcmbonjaimziiuqr "select public.admin_set_must_change_password(array['demo_cv1'])"
  ```
  Đọc mật khẩu tạm cho cán bộ **qua điện thoại**, không nhắn tin/email. Cán bộ đăng nhập → hệ thống bắt đổi mật khẩu mới ngay (≥ 8 ký tự, có chữ và số).
- **Khôi phục từ backup?** Không. Đã thử quy trình này trên Supabase local ngày 14/9/2026.

## 7. Mọi workflow đỏ với lỗi xác thực Supabase
- **Dấu hiệu:** deploy-staging, deploy-prod, backup định kỳ đều đỏ ở bước gọi `supabase …` với `401`, `Unauthorized`, `access token` hoặc `Initialising login role` rồi lỗi.
- **Nguyên nhân:** `SUPABASE_ACCESS_TOKEN` (token cá nhân, 90 ngày) đã hết hạn — dự kiến ~13/12/2026. Phòng ngừa: #11.
- **Xử lý:** supabase.com → ảnh đại diện → **Account → Access Tokens → Generate new token** (tên có ngày) → sao chép → GitHub repo → **Settings → Secrets and variables → Actions → `SUPABASE_ACCESS_TOKEN` → Update** → mở run đỏ → **Re-run failed jobs**. Xoá token cũ ở supabase.com.
- **Khôi phục từ backup?** Không.

## 8. Phát hành production đỏ giữa chừng
- **Dấu hiệu:** run của tag `v*` có job đỏ; job *Hướng dẫn quay lui* in sẵn việc cần làm trong **Summary** — đọc nó trước.
- **Nguyên nhân/Xử lý theo job đỏ:** `kiem-tra` → chưa đổi gì, sửa theo thông báo (CI chưa xanh hoặc tag nhầm commit → #1). `phat-hanh` đỏ **trước** dòng "supabase db push" → chưa đổi gì, sửa rồi tag số mới. Đỏ **tại** `db push` → `supabase migration list --project-ref frwyxcmbonjaimziiuqr` xem migration nào đã áp; ưu tiên sửa tiến bằng migration mới. `deploy` đỏ → **Re-run failed jobs**. `smoke` đỏ → quay lui frontend (`docs/kien-truc.md` mục 6).
- **Khôi phục từ backup?** Chỉ khi migration làm hỏng dữ liệu và không sửa tiến được → #10. Backup của chính lần phát hành đó nằm ở Artifacts của run.

## 9. UptimeRobot báo bản live down
- **Dấu hiệu:** email "VPTU-TASK bản live is DOWN" (404, timeout, hoặc thiếu từ khoá `phien_ban`).
- **Nguyên nhân:** GitHub Pages sự cố ngắn (thường tự hết trong vài phút); hiếm hơn: cấu hình Pages bị đổi, site bị xoá.
- **Xử lý:** mở `/phien-ban.json` tay; xem `https://www.githubstatus.com`. Nếu GitHub báo sự cố → chờ, không làm gì. Nếu GitHub bình thường mà site mất: repo → **Settings → Pages → Source** phải là *GitHub Actions*; rồi mở một PR docs nhỏ (sửa một dòng `CHANGELOG.md`) → merge → deploy-staging dựng lại cả hai bản từ commit mới. **Không** Re-run run cũ (cùng commit, Pages bỏ qua).
- **Khôi phục từ backup?** Không — frontend không chứa dữ liệu.

## 10. Xoá/sửa nhầm dữ liệu hàng loạt
- **Dấu hiệu:** nhiều nhiệm vụ/tài khoản biến mất, số liệu sai đồng loạt, sau một thao tác tay hoặc một lần phát hành.
- **Nguyên nhân:** thao tác nhầm trên Dashboard/SQL; migration lỗi.
- **Xử lý:** ghi giờ phát hiện; báo cán bộ **ngừng nhập liệu** (mọi thứ nhập sau lúc backup sẽ mất khi khôi phục); vài dòng → sửa tay qua giao diện app; hàng loạt → khôi phục: chọn bản backup gần nhất **trước** lúc hỏng (`ls -t "/d/TU 2026/Project/vptu-backup/"*.gpg`), làm theo `docs/sao-luu-khoi-phuc.md` mục 6 (project mới → `restore-db.sh` → đổi secret → phát hành lại). Chấp nhận mất tối đa 3 ngày dữ liệu.
- **Khôi phục từ backup?** **Có** — đây là tình huống backup sinh ra để dùng. Không xoá project cũ cho tới khi project mới chạy tốt.

## 11. `SUPABASE_ACCESS_TOKEN` sắp hết hạn (phòng ngừa — làm đầu tháng 12/2026)
- **Dấu hiệu:** chưa có gì hỏng; lịch ở `docs/TRANG-THAI.md` mục 5 nhắc (token tạo 14/9/2026, hạn 90 ngày ~13/12/2026).
- **Nguyên nhân:** token cá nhân Supabase luôn có hạn; hết hạn thì thành #7 đúng lúc bận.
- **Xử lý:** supabase.com → **Account → Access Tokens → Generate new token** (tên ghi ngày, ví dụ `github-actions-2026-12`) → GitHub → **Settings → Secrets → `SUPABASE_ACCESS_TOKEN` → Update** → Actions → *Backup định kỳ production* → **Run workflow** → xanh → xoá token cũ → ghi ngày hết hạn mới vào `docs/TRANG-THAI.md` mục 5 (qua PR).
- **Khôi phục từ backup?** Không.
