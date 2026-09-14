# Kiến trúc triển khai và pipeline CI/CD (GĐ6)

Tài liệu này mô tả cách mã đi từ PR tới production. Đặc tả nghiệp vụ ở `SPEC.md`; quy tắc phát hành ở `CLAUDE.md` (rule 4, 12).

## 1. Môi trường

| Môi trường | Supabase project | Frontend | Dữ liệu | Ai được ghi |
|---|---|---|---|---|
| Local | `supabase start` (Docker) | `npm run dev` | `supabase/seed.sql` | Dev |
| Staging | `vojmrjezspdftovzinek` (vptu-task-staging) | `https://haidang21ktvptu.github.io/vptu-mvp-task/staging/` | 7 tài khoản giả từ `seed.sql` (6 demo + `smoke_test`); test RLS/e2e tự tạo và tự dọn | `deploy-staging.yml` (push main); test trong CI |
| Production | `frwyxcmbonjaimziiuqr` (vptu-mvp-task) | `https://haidang21ktvptu.github.io/vptu-mvp-task/` | 48 tài khoản thật + `smoke_test` (is_system) | Chỉ `deploy-prod.yml` sau khi haidang21ktvptu duyệt |

Cả hai frontend nằm trong **một** artifact GitHub Pages (repo chỉ có một site) — xem mục 4.

## 2. Sơ đồ pipeline

```mermaid
flowchart LR
  subgraph PR["Pull request → main  (ci.yml)"]
    A1[Quét rò rỉ bí mật<br/>gitleaks] 
    A2[Áp migration + lint schema<br/>supabase start · db lint · RLS local]
    A3[Build frontend + 300 dòng<br/>vite build · eslint]
    A4[Kiểm thử RLS + e2e trên staging<br/>48 test RLS · 13 test e2e<br/>13 lượt đăng nhập]
  end
  PR -->|merge (merge commit, SAU khi phát hành)| M((main))
  M --> S1
  subgraph ST["push main  (deploy-staging.yml)"]
    S1[db push → staging] --> S2[build 2 bản:<br/>production = tag `production`<br/>staging = main] --> S3[deploy Pages<br/>actions/deploy-pages<br/>kiểm tra /staging/phien-ban.json]
  end
  PR -->|git tag v* lên commit ĐẦU NHÁNH<br/>khi CI xanh, chưa merge| T((tag v2.x))
  T --> PK
  subgraph PD["tag v*  (deploy-prod.yml)"]
    PK[kiem-tra: CI của commit xanh đủ 4 check<br/>sha chưa có Pages deployment] --> P0{{environment production<br/>haidang21ktvptu duyệt}} --> P1[backup pg_dump<br/>mã hoá → artifact 90 ngày] --> P2[db push → production] --> P3[build 2 bản] --> P4[deploy Pages<br/>actions/deploy-pages] --> P5[smoke: đăng nhập 1 tài khoản<br/>trên bản live] --> P6[gắn tag `production`]
    P5 -.lỗi.-> P7[quay-lui: hướng dẫn trong Summary]
  end
```

Hai nguyên tắc cố định: (1) **migration luôn chạy trước deploy frontend** trong cùng workflow (bài học GĐ1: frontend mới gọi hàm chưa có trong DB → toàn bộ cán bộ không đăng nhập được); (2) **tag `v*` gắn lên commit đầu nhánh phát hành khi PR đã CI xanh nhưng chưa merge** — vì GitHub Pages chỉ nhận mỗi commit một lần (mục 3, "Vì sao tag trước khi merge").

## 3. Từng workflow

### `ci.yml` — mọi pull request (và push main, trừ job staging)
| Job (tên check) | Làm gì |
|---|---|
| Quét rò rỉ bí mật | gitleaks toàn bộ lịch sử |
| Áp migration + lint schema | `supabase start` trên Postgres trắng (áp đủ migrations + `seed.sql`) + `supabase db lint --fail-on error` + **`tests/rls` với `RLS_LOCAL=1`** (kiểm tra RLS trên migration của chính PR, không tốn lượt đăng nhập hosted) |
| Build frontend + giới hạn 300 dòng | `vite build` với giá trị giả, ESLint, `scripts/check-line-limit.mjs` |
| Kiểm thử RLS + e2e trên staging | *Chỉ pull_request.* Một job: `tests/rls` (48 test, token thật của 6 tài khoản seed) rồi `tests/e2e` (Playwright, build Vite trỏ staging, 13 test ở 2 kích thước). Dọn dữ liệu bằng service_role **của staging** (secret). |

**Ngân sách đăng nhập** (Supabase Auth giới hạn 30 lượt/5 phút/IP): RLS 6 lượt (một tiến trình, `--test-isolation=none`) + e2e 7 lượt = **13 lượt/lần chạy**. e2e đạt 7 lượt nhờ `global-setup.mjs` đăng nhập A1/A2/A3 qua API (3 lượt) và ghi phiên thành storageState (`.auth/*.json`, khoá `sb-<ref>-auth-token` trong localStorage); project `desktop`/`mobile` mở trang với phiên sẵn; chỉ project `dang-nhap` (chạy sau cùng, vì đăng xuất huỷ phiên toàn cục) đăng nhập thật qua form (4 lượt). Job có `concurrency: kiem-thu-staging` nên hai PR không chạy chồng nhau; nếu vẫn gặp `over_request_rate_limit` (3 PR trong 5 phút, cùng IP runner) — chờ 5 phút rồi Re-run job. Cả hai bộ test từ chối chạy khi URL chứa ref production.

### `deploy-staging.yml` — push main
1. `supabase db push --project-ref <staging>` (dry-run trước, rồi `--yes`), ghi `migration list` vào Summary.
2. Build hai bản (composite action `.github/actions/build-pages-site`): **production** từ commit của tag `production` (commit phát hành gần nhất — chưa có tag thì lấy `main`, kèm cảnh báo), **staging** từ `main` với `BASE_PATH=/vptu-mvp-task/staging/` và anon key staging. Mỗi bản có `phien-ban.json` (`{moi_truong, phien_ban, commit, build_luc}`).
3. `actions/deploy-pages@v4`, rồi curl `/staging/phien-ban.json` tới khi thấy đúng commit (tối đa 3 phút). Mỗi push main là một sha mới nên luôn deploy được; re-run cùng commit sẽ "thành công" nhưng không đổi gì (xem dưới).

**Vì sao tag trước khi merge — kết luận sau sự cố `v2.0.0-rc1` (2026-09-14):** `actions/deploy-pages` gửi `pages_build_version = GITHUB_SHA` và **GitHub Pages bắt version này phải bằng claim `sha` trong OIDC token của job** (không đặt tuỳ ý được), đồng thời dùng nó làm khoá idempotent: POST lại cùng sha → trả deployment cũ, không thay artifact. Hệ quả: một commit chỉ deploy Pages được **đúng một lần**. Tag rc1 gắn lên commit đã lên `main` (deploy-staging đã deploy sha đó) nên job deploy "xanh" sau 5 giây mà bản live không đổi. Ba vòng thử để đi tới kết luận: PR #24 composite tự gọi REST với version `<tag>-<run>` → 404; PR #25 in HTTP code + body → `{"message":"Not Found"}` (route đúng); PR #26 chẩn đoán trong một run: version tuỳ ý 404, **version = GITHUB_SHA thành công**, deploy-pages thành công ⇒ H1. Cách giải: tag lên commit đầu nhánh phát hành (chưa từng deploy vì deploy-staging chỉ chạy trên main), deploy-prod dùng `actions/deploy-pages` nguyên bản; merge sau. Job `kiem-tra` chặn tag gắn nhầm lên commit đã deploy.

### `deploy-prod.yml` — tag `v*`
| Job | Nội dung |
|---|---|
| `kiem-tra` (không cần duyệt) | (a) commit của tag có đủ 4 check CI `success` (đọc `check-runs`, cần `checks: read`); (b) `GET /pages/deployments/<sha>` — in HTTP code + body; chỉ cho qua khi **200 và `status` rỗng** (quan sát: chưa có deployment), **200 và `status` có giá trị** → dừng "commit đã deploy, tag nhầm lên main?"; mọi dạng khác (không 200, không JSON, thiếu trường) → dừng "phản hồi ngoài dự kiến", không tự cho qua. |
| `phat-hanh` (environment **production**) | **Dừng chờ duyệt** (required reviewer haidang21ktvptu). Sau khi duyệt: `scripts/backup-db.sh` (cùng script với `backup-dinh-ky.yml`: schema + data + `migrations.txt`/`so-dong.txt`/`thong-tin.txt`, gpg AES-256 bằng `BACKUP_PASSPHRASE`, login role qua token) → artifact `prod-<ngày>-<tag>.tar.gz.gpg` (90 ngày; phải mã hoá vì artifact của repo public tải được công khai) → `db push --dry-run` (vào Summary) → `db push --yes` → build hai bản (production = tag, staging = main). |
| `deploy` (environment github-pages) | `actions/deploy-pages@v4` — deploy được vì sha của tag chưa từng deploy (tag trước khi merge). |
| `smoke` | Đợi `phien-ban.json` bản live ghi đúng tag (≤ 3 phút) → Playwright `tests/e2e/smoke/` đăng nhập tài khoản hệ thống `smoke_test` (`SMOKE_USERNAME/PASSWORD`), vào app, không lỗi console, đăng xuất → **gắn tag `production`** vào commit vừa phát hành. Tài khoản này là A3 thật về quyền (RLS không đổi) nhưng `is_system = true` nên frontend không hiện ở danh bạ/cây/KPI; trên staging do `seed.sql` tạo (mật khẩu `123456`), trên production do script tạo với mật khẩu ngẫu nhiên. |
| `quay-lui` (chỉ khi lỗi) | Ghi hướng dẫn quay lui vào Summary theo bước bị lỗi (mục 6). |

### `backup-dinh-ky.yml` — cron `0 20 */3 * *` (03:00 giờ VN, ngày 1, 4, …, 31) + `workflow_dispatch`
Job `sao-luu`: `scripts/backup-db.sh --project-ref <prod> --nhan dinh-ky` → artifact `prod-<ngày>-dinh-ky` 90 ngày. Dùng repository secret `BACKUP_PASSPHRASE` (không dùng environment `production` vì có required reviewer). Hạn chế cron và cách tải về máy (`scripts/tai-backup.sh`, Task Scheduler): `docs/sao-luu-khoi-phuc.md` mục 3. GitHub tự tắt schedule sau 60 ngày repo không có commit.

Cấu hình Auth (`supabase config push`) **không** nằm trong pipeline — vẫn làm tay sau khi trình `config diff` (quy tắc phát hành hiện hành).

## 4. Vì sao staging frontend nằm ở `/staging/` cùng artifact

GitHub Pages chỉ phục vụ **một** site cho mỗi repo và mỗi lần deploy thay toàn bộ site, nên mọi lần deploy đều phải đẩy đủ cả hai bản. Composite action build **cả hai** ở mọi workflow; bản production được build lại từ commit của tag `production` (không phải `main`) nên push main không làm đổi production.

| Phương án | Ưu | Nhược |
|---|---|---|
| **A. `/staging/` cùng artifact (đã chọn)** | Không thêm repo, secret hay dịch vụ; một URL quen thuộc; cùng workflow Pages đã dùng | Mỗi push main build lại bản production (từ tag, không từ main — build Vite tất định nên kết quả như cũ); hai workflow phải xếp hàng chung (`concurrency: pages`) — trong lúc tag v* chờ duyệt, deploy staging chờ theo, nên **duyệt hoặc từ chối sớm**; staging công khai trên Internet (dữ liệu giả, tài khoản `demo_*` đã công khai trong repo) |
| B. Repo riêng `vptu-mvp-task-staging` (push `dist` bằng deploy key) | Tách hẳn, push main không đụng artifact production | Thêm repo + deploy key/PAT (secret có quyền ghi repo khác), base path khác, hai nơi cấu hình Pages |
| C. Dịch vụ khác (Cloudflare Pages/Netlify) cho staging | Preview theo từng PR, không đụng Pages | Thêm nhà cung cấp, tài khoản, token; ngoài stack đã chốt trong SPEC |

Nếu sau này cần preview theo PR, chuyển sang B hoặc C; hiện tại A đủ cho một người bảo trì.

## 5. Secrets và cấu hình GitHub cần tạo (chủ dự án tự nhập)

**Repository secrets** (Settings → Secrets and variables → Actions → Repository secrets):

| Tên | Lấy ở đâu | Dùng ở |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate new token (token cá nhân, dùng được cả hai project) | deploy-staging, deploy-prod (CLI `db push`, `db dump`) |
| `STAGING_DB_PASSWORD` | Dashboard staging → Project Settings → Database → Database password (Reset nếu không nhớ) | deploy-staging |
| `STAGING_SUPABASE_ANON_KEY` | Dashboard staging → Project Settings → API Keys → `anon` (hoặc `supabase projects api-keys --project-ref vojmrjezspdftovzinek`) | ci (e2e), build bản staging |
| `STAGING_SUPABASE_SERVICE_ROLE_KEY` | cùng trang, `service_role` — **chỉ staging**, dùng dọn dữ liệu test | ci |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | *đã có* (production, chỉ anon key) | build bản production (ở cả hai workflow deploy) |
| `SMOKE_USERNAME`, `SMOKE_PASSWORD` | `smoke_test` — tài khoản hệ thống (`accounts.is_system = true`, A3, phòng CDS_CY, ẩn khỏi mọi danh sách cán bộ) tạo bằng `scripts/create-system-account.mjs --project-ref <ref>`; script in mật khẩu ngẫu nhiên đúng một lần | deploy-prod job smoke |

**Environment `production`** (Settings → Environments → New environment): Required reviewers = `haidang21ktvptu`; Deployment branches and tags → *Selected* → thêm tag pattern `v*`. Secrets của environment:

| Tên | Lấy ở đâu |
|---|---|
| `PROD_DB_PASSWORD` | Dashboard production → Project Settings → Database |
| `BACKUP_PASSPHRASE` | Tự sinh, ví dụ `openssl rand -base64 32`; **lưu vào trình quản lý mật khẩu** — không có nó không giải mã được backup. **Cùng giá trị cũng đặt ở Repository secrets** (cho `backup-dinh-ky.yml`); đổi thì đổi cả hai |

**Environment `github-pages`** (đã có, đang chỉ cho nhánh `main`): Deployment branches and tags → thêm tag pattern `v*` để `deploy-prod` được phép deploy từ tag.

**Ruleset `main`** (Settings → Rules → main → Require status checks): thêm check **`Kiểm thử RLS + e2e trên staging`** bên cạnh 3 check hiện có (`Quét rò rỉ bí mật`, `Áp migration + lint schema`, `Build frontend + giới hạn 300 dòng`).

`SMOKE_*` để ở repository (không phải environment) vì job smoke chạy *sau* job deploy; nếu đặt trong environment production thì GitHub yêu cầu duyệt lần thứ hai trước smoke (chủ dự án chấp nhận, 2026-09-14). Tài khoản `smoke_test` chỉ là A3 không có nhiệm vụ nào — lộ mật khẩu chỉ cho phép đăng nhập xem màn hình trống.

## 6. Quay lui

Sự cố cụ thể (11 tình huống, lệnh copy-paste): `docs/xu-ly-su-co.md`.

- **Nguyên tắc:** production luôn là một tag `v*`; tag `production` (di động) đánh dấu commit đang chạy. Quay lui frontend **không phải** tag lại commit cũ (sha đó đã deploy Pages → bị bỏ qua) mà là một commit mới có cùng nội dung: `git checkout -b hotfix/quay-lui-v2.0.1 v2.0.1 && git commit --allow-empty -m "Quay lui về v2.0.1" && git push -u origin HEAD` → mở PR (CI xanh) → `git tag v2.0.2 && git push origin v2.0.2` → deploy-prod chạy lại, chờ duyệt; migration không áp gì thêm → merge PR sau. Không xoá/đổi tag cũ.
- **Lỗi trước `db push`** (backup, secrets): production chưa đổi gì.
- **Lỗi ở `db push`:** `supabase migration list --project-ref frwyxcmbonjaimziiuqr` xem migration nào đã áp; ưu tiên sửa tiến bằng migration mới; chỉ khôi phục từ backup khi không sửa tiến được.
- **Tag bị chặn ở `kiem-tra`:** chưa đổi gì; sửa theo thông báo (CI chưa xanh, hoặc tag nhầm lên commit đã deploy → nhánh mới + commit rỗng + tag mới như trên).
- **Lỗi ở deploy:** DB đã mới, frontend cũ — Re-run failed jobs (job deploy chưa tạo được deployment nên sha vẫn chưa "dùng"; nếu deployment đã tạo rồi mới lỗi thì sha đã bị dùng → cần commit mới như quay lui).
- **Smoke lỗi:** frontend mới đã lên — quay lui frontend như trên; nếu do migration, khôi phục DB.
- **Khôi phục từ backup:** lấy bản mới nhất trong `D:\TU 2026\Project\vptu-backup\` (hoặc tải artifact `prod-<ngày>-<tag>.tar.gz.gpg`) → tạo project trắng → `bash scripts/restore-db.sh <file> --project-ref <ref mới>` (script tự giải mã, áp migrations, nạp dữ liệu, kiểm chứng; từ chối production/staging) — chi tiết `docs/sao-luu-khoi-phuc.md` mục 6. Dữ liệu ghi sau lúc backup sẽ mất (tối đa 3 ngày với backup định kỳ).

## 7. Cách phát hành một phiên bản

Thứ tự bắt buộc — tag gắn lên **commit đầu nhánh phát hành**, trước khi merge:

```
git checkout feature/ten-nhanh && git pull           # (1) ĐÚNG NHÁNH PHÁT HÀNH — không đứng ở main
gh pr checks                                         # (2) PR đã mở, CI xanh đủ 4 check trên commit đầu nhánh
git tag v2.0.0-rc2 && git push origin v2.0.0-rc2     # (3) tag lên HEAD của nhánh → deploy-prod chạy: kiem-tra → chờ duyệt
```
(4) Actions → run của tag → *Review deployments* → duyệt → theo dõi Summary (kiem-tra, backup, migration, smoke). (5) Bản live `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi tag vừa phát hành; tag `production` được gắn. (6) **Merge PR bằng merge commit** (không squash/rebase, để commit tag là tổ tiên của `main`) → deploy-staging dựng bản production từ tag `production` (nội dung không đổi, nhãn vẫn là tag).

Cảnh báo:
- **Không gắn tag khi đang ở `main`** (commit đã lên main thì deploy-staging đã deploy sha đó — `kiem-tra` sẽ chặn; nếu lọt, bản live không đổi như sự cố rc1).
- **Sau khi đã gắn tag, KHÔNG push thêm commit lên nhánh đó cho tới khi phát hành xong** — nếu không, commit được phát hành (tag) sẽ khác commit được merge, và bản production dựng từ tag `production` sẽ không khớp với `main`. Cần sửa gì thì huỷ phát hành (từ chối ở Review deployments), push, đợi CI, tag số mới.
- Tag đã đẩy thì không xoá/đổi; sai thì tag số mới.
