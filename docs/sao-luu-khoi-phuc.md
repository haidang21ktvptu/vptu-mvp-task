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

## 4. Khôi phục thử lên project trắng (diễn tập — điều kiện xong GĐ7)

Không bao giờ diễn tập trên production hay staging — script **từ chối trong code** hai project đó. Làm trên một project mới:

1. **Tạo project**: supabase.com → *New project* → tên `vptu-restore-test`, Region **Southeast Asia (Singapore)** (cùng production), *Database password*: tự đặt ≥ 16 ký tự **chỉ gồm chữ và số** (ký tự đặc biệt làm hỏng chuỗi kết nối), lưu vào trình quản lý mật khẩu. Đợi ~2 phút tới khi Dashboard hết "Setting up". Gói Free chỉ cho 2 project hoạt động mỗi Organization — nếu bị từ chối, tạo trong một Organization mới (Free) hoặc tạm *Pause* staging rồi *Restore* sau.
2. **Lấy chuỗi kết nối**: nút **Connect** trên đầu Dashboard → *Method: Session pooler* → sao chép dòng `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` → thay `[YOUR-PASSWORD]` bằng mật khẩu vừa đặt. `<ref>` là 20 chữ trong URL Dashboard (`supabase.com/dashboard/project/<ref>`). Không dùng *Direct connection* (`db.<ref>.supabase.co`, chỉ IPv6) hay cổng 6543.
3. **Chạy** (repo ở `main` mới nhất; file backup chọn bản mới nhất trong `vptu-backup`):
   ```bash
   cd "/d/TU 2026/Project/vptu-mvp-task" && git checkout main && git pull && ls -t "/d/TU 2026/Project/vptu-backup/"*.gpg | head -3
   ```
   ```bash
   bash scripts/restore-db.sh "/d/TU 2026/Project/vptu-backup/<tên file>.tar.gz.gpg" --project-ref <ref>
   ```
   Script hỏi lần lượt: passphrase → chuỗi kết nối (dán bằng chuột phải hoặc Shift+Insert; chữ không hiện) → in tóm tắt → gõ `khoi phuc`. Các bước tự chạy: giải mã, đối chiếu migration, kiểm tra quyền, áp toàn bộ migration của repo (`supabase db push`), nạp dữ liệu trong một transaction, kiểm chứng số dòng và khoá ngoại `accounts → auth.users`. Kết thúc phải thấy **`KHÔI PHỤC XONG`** và dòng `Số dòng khớp so-dong.txt`. Mất ~1–2 phút.
4. **Kiểm tra bằng mắt**: Dashboard project mới → *Table Editor* → `accounts` có 49 dòng (48 cán bộ + `smoke_test`); *Authentication → Users* có 49 người. Đăng nhập thử: Dashboard → *Project Settings → API Keys* lấy URL và `anon` key → trong `frontend/` tạo file `.env` theo `.env.example` với hai giá trị đó → `cd frontend && npm run dev` → mở địa chỉ hiện ra, đăng nhập bằng tài khoản của chính mình với **mật khẩu hiện dùng** (hash được nạp lại nên mật khẩu không đổi). Xong thì xoá `.env`.
5. **Ghi biên bản** theo mẫu mục 7 vào `docs/bien-ban-khoi-phuc-<ngày>.md` (qua PR), rồi **xoá project** `vptu-restore-test` (*Project Settings → General → Delete project*) vì nó chứa dữ liệu thật.

Chạy lại được: nếu dừng giữa chừng ở bước nạp dữ liệu, transaction đã huỷ, chạy lại lệnh y hệt; nếu project đã có dữ liệu, thêm `--ghi-de` (script hỏi gõ đúng ref rồi xoá schema `public`, dữ liệu auth và lịch sử migration trong một transaction trước khi áp lại migrations và nạp).

## 5. Khôi phục thật khi production hỏng

Chỉ làm khi không "sửa tiến" được (xem `kien-truc.md` mục 6). Dữ liệu sau thời điểm backup sẽ mất — báo cán bộ trước.

1. Không xoá project cũ. Tạo project mới (mục 4 bước 1–2), khôi phục từ bản backup **mới nhất** (`ls -t`), kiểm tra như bước 4.
2. Project mới trở thành production: cập nhật ref ở mọi nơi bằng một PR — `scripts/lib-sao-luu.sh` (`PRODUCTION_REF`), `.github/workflows/deploy-prod.yml` (`PROD_REF`), `tests/rls/lib.mjs`, `tests/e2e/lib/keys.mjs`, `frontend/.env.example`, `docs/`; GitHub Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, environment `production` → `PROD_DB_PASSWORD`.
3. `supabase config diff --project-ref <ref mới>` → trình diff → `config push` (site_url GitHub Pages, MFA/OTP tắt). Tài khoản `smoke_test` đã nằm trong dữ liệu khôi phục nên `SMOKE_*` giữ nguyên.
4. Phát hành lại bằng tag `v*` (kien-truc.md mục 7); kiểm tra bản live bằng 3 vai trò; ghi CHANGELOG và biên bản.

## 6. Khi nào script từ chối chạy (cố ý)

`restore-db.sh` dừng, chưa đổi gì, nếu: `--project-ref` hoặc chuỗi kết nối trỏ production/staging; chuỗi kết nối không cùng ref với `--project-ref`; còn `[YOUR-PASSWORD]`; cổng 6543 hoặc host `db.<ref>.supabase.co`; sai passphrase; migration trong backup khác repo (→ `git checkout production` rồi chạy lại); Auth của project đích cũ hơn lúc backup; project đích đã có dữ liệu mà không có `--ghi-de`. `backup-db.sh` dừng nếu Docker chưa chạy, chưa `supabase login`, hoặc hai lần passphrase không khớp.

## 7. Mẫu biên bản khôi phục thử

```
# Biên bản khôi phục thử — <ngày>
- Người thực hiện: <họ tên>. Máy: Windows 10, Git Bash, supabase CLI <phiên bản>, psql <phiên bản>.
- File backup: <tên file> (tạo lúc <luc_viet_nam trong thong-tin.txt>, nguồn production, migration 0001–0012).
- Project đích: vptu-restore-test (<ref>), tạo mới, trắng.
- Kết quả: KHÔI PHỤC XONG lúc <giờ>; số dòng khớp so-dong.txt (accounts 49, auth.users 49, tasks <n>, …); FK mồ côi 0.
- Đăng nhập thử bằng <username> trên frontend local: thành công / thất bại (lý do).
- Thời gian từ lúc bắt đầu tới khi đăng nhập được: <phút>.
- Sự cố/ghi chú: <nếu có>. Project đích đã xoá lúc <giờ>.
```
