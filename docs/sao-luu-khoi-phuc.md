# Sao lưu và khôi phục cơ sở dữ liệu (GĐ7)

Hướng dẫn cho chủ dự án tự làm trên máy Windows bằng **Git Bash** (chuột phải trong thư mục → *Open Git Bash here*, hoặc mở Git Bash rồi `cd`). Mọi lệnh dưới đây gõ trong Git Bash, không phải PowerShell/CMD. Hai script: `scripts/backup-db.sh` (sao lưu) và `scripts/restore-db.sh` (khôi phục); chi tiết kỹ thuật ở đầu mỗi file.

**Chính sách đã chốt:** backup tự động **3 ngày/lần** (workflow ở PR B) → **cửa sổ mất dữ liệu tối đa là 3 ngày**; ngoài ra mỗi lần phát hành production có một bản (deploy-prod). Artifact trên GitHub giữ 90 ngày; bản trên máy cá nhân giữ ít nhất 2 bản gần nhất, chỉ xoá tay.

## 1. Chuẩn bị máy (một lần)

| Cần gì | Để làm gì | Cách kiểm tra / cài |
|---|---|---|
| Git Bash, `gpg`, `tar` | chạy script, mã hoá/giải mã | có sẵn cùng Git for Windows: `gpg --version` |
| Docker Desktop **đang mở** | `supabase db dump` chạy pg_dump trong Docker | biểu tượng cá voi ở khay hệ thống ổn định; `docker info` không báo lỗi |
| Supabase CLI đã đăng nhập | dump, áp migration (không cần mật khẩu DB) | `supabase --version` (đã có qua scoop); `supabase login` nếu chưa |
| `psql` (chỉ khi khôi phục) | nạp dữ liệu vào project đích | **PowerShell**: `scoop install postgresql` → mở Git Bash **mới** → `psql --version` |
| Passphrase backup | mở mọi file backup | cùng giá trị với secret `BACKUP_PASSPHRASE` trên GitHub; **lưu trong trình quản lý mật khẩu — mất passphrase là mất toàn bộ backup** |

## 2. Sao lưu về máy cá nhân (cơ chế lưu local chính)

Đây chính là cách lưu bản backup trên máy: chạy trực tiếp từ Git Bash, file ghi thẳng vào `D:\TU 2026\Project\vptu-backup\` (ngoài git). Ưu điểm so với tải artifact từ GitHub: **mới hơn** (chụp đúng lúc chạy, không phải bản 3 ngày trước), **không phụ thuộc mạng tới GitHub**, và **dùng thẳng được với `restore-db.sh`** không cần giải nén hay đổi tên.

```bash
cd "/d/TU 2026/Project/vptu-mvp-task" && bash scripts/backup-db.sh --project-ref frwyxcmbonjaimziiuqr --thu-muc "/d/TU 2026/Project/vptu-backup"
```

Script hỏi passphrase hai lần (chữ không hiện khi gõ), mất ~30 giây, in ra tên file `prod-<ngày giờ UTC>-tay.tar.gz.gpg`, kích thước, mã sha256 và thông tin kèm (số dòng từng bảng, danh sách migration). Thêm `--nhan truoc-nang-cap` (chữ thường, số, `-`, `.`) để đặt nhãn dễ nhớ. Nên chạy **trước mỗi việc rủi ro** (áp migration tay, sửa dữ liệu hàng loạt) và mỗi tuần một lần.

Trong file có: `schema.sql` (tham khảo), `data.sql` (dữ liệu, không gồm bảng phiên/nhật ký đăng nhập), `migrations.txt`, `so-dong.txt`, `thong-tin.txt`. File đã mã hoá AES-256 — để trên ổ D hoặc chép sang USB đều an toàn nếu passphrase không đi kèm.

## 3. Bản dự phòng thứ hai: artifact trên GitHub

Mỗi lần phát hành (`deploy-prod.yml`) và mỗi 3 ngày (PR B) có một artifact `prod-…tar.gz.gpg` giữ 90 ngày: GitHub → **Actions** → chọn run → cuộn xuống **Artifacts** → tải về (file zip, giải nén ra `.tar.gz.gpg`). Script tải tự động + lịch Task Scheduler làm ở PR B. Cùng passphrase, cùng cách khôi phục.

## 4. Khôi phục thử lên Supabase local (diễn tập — điều kiện xong GĐ7)

Gói Free chỉ cho 2 project hoạt động (production + staging đã dùng hết) nên diễn tập trên **Supabase local** — bản Postgres + Auth chạy trong Docker trên chính máy này bằng `supabase start`. Không bao giờ diễn tập trên production hay staging — script **từ chối trong code** hai project đó, kể cả khi gõ nhầm.

1. **Mở Docker Desktop**, đợi biểu tượng cá voi ổn định. Mở Git Bash và khởi động Supabase local (lần đầu tải image ~2–5 phút; đã chạy rồi thì báo "already running", cứ tiếp tục):
   ```bash
   cd "/d/TU 2026/Project/vptu-mvp-task" && git checkout main && git pull && supabase start
   ```
   Xong thì hiện `Started supabase local development setup`. Script đã biết sẵn chuỗi kết nối local (`127.0.0.1:54322`) nên **không phải dán gì**.
2. **Chọn file backup** mới nhất trong `vptu-backup` (bản do mục 2 tạo):
   ```bash
   ls -t "/d/TU 2026/Project/vptu-backup/"*.gpg | head -3
   ```
3. **Chạy khôi phục** (`--ghi-de` vì local đang có 7 tài khoản giả từ `seed.sql`):
   ```bash
   bash scripts/restore-db.sh "/d/TU 2026/Project/vptu-backup/<tên file>.tar.gz.gpg" --local --ghi-de
   ```
   Script hỏi lần lượt: passphrase (chữ không hiện) → liệt kê dữ liệu giả sắp xoá và bắt gõ `local` → in tóm tắt → gõ `khoi phuc`. Các bước tự chạy: giải mã, đối chiếu migration, kiểm tra quyền, xoá schema `public` + dữ liệu auth + lịch sử migration trong một transaction, áp toàn bộ migration của repo (`supabase db push --local`), nạp dữ liệu trong một transaction, kiểm chứng số dòng và khoá ngoại `accounts → auth.users`. Kết thúc phải thấy **`KHÔI PHỤC XONG lên local`** và dòng `Số dòng khớp so-dong.txt` với `public.accounts 49`, `auth.users 49`. Mất ~1–2 phút.
4. **Đăng nhập thử bằng tài khoản thật**: lấy địa chỉ và anon key của local:
   ```bash
   supabase status -o env | grep -E '^(API_URL|ANON_KEY)='
   ```
   Trong thư mục `frontend/` tạo file `.env` (đã bị .gitignore) gồm hai dòng `VITE_SUPABASE_URL=http://127.0.0.1:54321` và `VITE_SUPABASE_ANON_KEY=<giá trị ANON_KEY, bắt đầu bằng eyJ>`, rồi:
   ```bash
   cd "/d/TU 2026/Project/vptu-mvp-task/frontend" && npm install && npm run dev
   ```
   Mở địa chỉ hiện ra (`http://localhost:5173/vptu-mvp-task/`), đăng nhập bằng tài khoản của chính mình với **mật khẩu hiện dùng** (hash được nạp lại nên mật khẩu không đổi), xem danh bạ/nhiệm vụ có đúng dữ liệu thật không. Nhấn Ctrl+C để dừng.
5. **Ghi biên bản** theo mẫu mục 8 (ghi rõ đích là **local**) vào `docs/bien-ban-khoi-phuc-<ngày>.md` qua PR; rồi **dọn dữ liệu thật khỏi máy**: xoá `frontend/.env` và trả local về dữ liệu giả:
   ```bash
   cd "/d/TU 2026/Project/vptu-mvp-task" && supabase db reset
   ```

Chạy lại được: dừng giữa chừng ở bước nạp thì transaction đã huỷ, chạy lại lệnh y hệt (vẫn `--ghi-de`). Với project hosted trắng (khi có), lệnh là `--project-ref <ref>` và script hỏi thêm chuỗi kết nối Session pooler (Dashboard → Connect, thay `[YOUR-PASSWORD]`, cổng 5432, mật khẩu DB chỉ chữ và số).

## 5. Local khác hosted ở đâu — khi nào thử lại trên hosted

Diễn tập local chứng minh: file backup đọc được, migrations + dữ liệu + mật khẩu khôi phục đúng, các chốt an toàn hoạt động. Nó **chưa** chứng minh những điểm chỉ có trên hosted:

| Khác biệt | Local | Hosted | Script xử lý |
|---|---|---|---|
| Quyền user `postgres` | superuser, lệnh nào cũng qua | không superuser; `SET session_replication_role`, `TRUNCATE auth.*`, `DROP SCHEMA public` dựa vào grant của Supabase | preflight `SET … ROLLBACK` trước khi ghi; bước xoá sạch trong một transaction — lỗi thì chưa đổi gì |
| Kết nối | `127.0.0.1:54322`, không SSL, script tự biết | Session pooler + SSL, phải dán chuỗi kết nối; mạng/mã hoá ký tự có thể sai | từ chối cổng 6543, IPv6, `[YOUR-PASSWORD]`; dừng ngay nếu `select 1` không chạy |
| Phiên bản Auth (GoTrue, `auth.schema_migrations`) | theo image của CLI trên máy | theo project, có thể cũ/mới hơn lúc backup | so `auth_schema_version` trong `thong-tin.txt`; đích cũ hơn thì dừng |
| Áp migrations | `db push --local` | `db push --project-ref` qua login role (cần `supabase login`) | đã thử `--dry-run` lên project chưa link: chạy được |

Nên diễn tập lại trên hosted khi: (a) nâng gói Pro để bật AUTH-3 — lúc đó tạo project tạm `vptu-restore-test`, làm theo đoạn cuối mục 4, xoá project ngay sau; (b) có một project trắng dùng được (Organization khác); (c) Supabase nâng phiên bản Postgres/Auth lớn. Mỗi lần đều ghi biên bản mới.

## 6. Khôi phục thật khi production hỏng

Chỉ làm khi không "sửa tiến" được (xem `kien-truc.md` mục 6). Dữ liệu sau thời điểm backup sẽ mất — báo cán bộ trước.

1. Không xoá project cũ. Tạo project mới trên supabase.com (tên tuỳ ý, Region Southeast Asia (Singapore) như production, mật khẩu DB ≥ 16 ký tự chỉ chữ và số), lấy chuỗi kết nối Session pooler (Connect → Session pooler, thay `[YOUR-PASSWORD]`), rồi `bash scripts/restore-db.sh <bản backup mới nhất> --project-ref <ref mới>`; kiểm tra như mục 4 bước 4 nhưng trỏ `.env` vào URL/anon key của project mới (Project Settings → API Keys).
2. Project mới trở thành production: cập nhật ref ở mọi nơi bằng một PR — `scripts/lib-sao-luu.sh` (`PRODUCTION_REF`), `.github/workflows/deploy-prod.yml` (`PROD_REF`), `tests/rls/lib.mjs`, `tests/e2e/lib/keys.mjs`, `frontend/.env.example`, `docs/`; GitHub Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, environment `production` → `PROD_DB_PASSWORD`.
3. `supabase config diff --project-ref <ref mới>` → trình diff → `config push` (site_url GitHub Pages, MFA/OTP tắt). Tài khoản `smoke_test` đã nằm trong dữ liệu khôi phục nên `SMOKE_*` giữ nguyên.
4. Phát hành lại bằng tag `v*` (kien-truc.md mục 7); kiểm tra bản live bằng 3 vai trò; ghi CHANGELOG và biên bản.

## 7. Khi nào script từ chối chạy (cố ý)

`restore-db.sh` dừng, chưa đổi gì, nếu: `--project-ref` hoặc chuỗi kết nối trỏ production/staging; chuỗi kết nối không cùng ref với `--project-ref`; còn `[YOUR-PASSWORD]`; cổng 6543 hoặc host `db.<ref>.supabase.co`; sai passphrase; migration trong backup khác repo (→ `git checkout production` rồi chạy lại); Auth của project đích cũ hơn lúc backup; project đích đã có dữ liệu mà không có `--ghi-de`. `backup-db.sh` dừng nếu Docker chưa chạy, chưa `supabase login`, hoặc hai lần passphrase không khớp.

## 8. Mẫu biên bản khôi phục thử

```
# Biên bản khôi phục thử — <ngày>
- Người thực hiện: <họ tên>. Máy: Windows 10, Git Bash, supabase CLI <phiên bản>, psql <phiên bản>.
- File backup: <tên file> (tạo lúc <luc_viet_nam trong thong-tin.txt>, nguồn production, migration 0001–0012).
- Đích: Supabase LOCAL (`supabase start`, Docker trên máy cá nhân) — KHÔNG phải project hosted; xem mục 5 về khác biệt.
- Kết quả: KHÔI PHỤC XONG lúc <giờ>; số dòng khớp so-dong.txt (accounts 49, auth.users 49, tasks <n>, …); FK mồ côi 0.
- Đăng nhập thử bằng <username> trên frontend local: thành công / thất bại (lý do).
- Thời gian từ lúc bắt đầu tới khi đăng nhập được: <phút>.
- Sự cố/ghi chú: <nếu có>. Đã `supabase db reset` trả local về dữ liệu giả và xoá `frontend/.env` lúc <giờ>.
```
