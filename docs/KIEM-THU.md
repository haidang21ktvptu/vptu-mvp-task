# Kiểm thử — công tắc môi trường

Job CI `Kiểm thử RLS + e2e trên staging` (`.github/workflows/ci.yml`) đọc biến kho `vars.KIEM_THU_MOI_TRUONG`:

| Giá trị | Project | Việc job làm |
|---|---|---|
| (trống) hoặc `staging` | `vojmrjezspdftovzinek` | e2e như trước (migration và RLS trên staging do `deploy-staging.yml` lo khi push `main`). |
| `production` | `frwyxcmbonjaimziiuqr` | `supabase db push` migration của nhánh → `scripts/seed-demo.mjs` (tài khoản demo, idempotent) → **chỉ e2e** (không test RLS token thật). |

Summary của job ghi dòng đầu "Môi trường kiểm thử: … (project …)"; với production ghi thêm "production: chỉ e2e". `deploy-staging.yml` và `deploy-prod.yml` không đổi.

**Nguyên tắc: không chạy bộ RLS token thật trên production.** Bộ `tests/rls` giả định seed của staging (id tài khoản cố định, phân công PCVP demo, tổng số dòng như `supabase/seed.sql`, không ai giữ `quan_tri_kl`) nên trên dữ liệu thật đỏ hàng loạt (rls-9/10/11, kl-0025/0026/0028, kl-pham-vi-tong-hop) dù mã đúng. RLS của chính PR đã chạy đủ trên Supabase cục bộ ở job "Áp migration + lint schema"; production chỉ dùng để chạy e2e trên schema và dữ liệu thật. Không viết lại bộ test cho production.

## Secret / biến trên GitHub

- Biến kho `KIEM_THU_MOI_TRUONG` (Settings → Variables → Repository): tạo khi cần `production`; xoá hoặc đặt `staging` để quay về.
- Secret kho đã có và được dùng lại: `VITE_SUPABASE_ANON_KEY` (anon production), `SUPABASE_SERVICE_ROLE_KEY` (service_role production), `SUPABASE_ACCESS_TOKEN`.
- Secret kho cần có thêm ở cấp **kho** (job PR không dùng environment `production`): `PROD_DB_PASSWORD` (hiện chỉ có trong environment `production` của `deploy-prod.yml`).

## Khi nào đổi sang production

Chỉ khi cần kiểm thử trên dữ liệu thật trước go-live (ví dụ bộ mốc `kl-moc-2026-09-14` với 185 nhiệm vụ), trong khung giờ cán bộ không dùng hệ thống, và chủ dự án bật trong phiên đó. Bật biến = xác nhận áp migration của nhánh lên production (quy tắc 12 CLAUDE.md). Tắt ngay sau khi xong.

## Điều gì được ghi lên project khi test

- `scripts/seed-demo.mjs`: **thêm** auth user + dòng `accounts` còn thiếu cho 19 tài khoản `demo_*`, `demo_e2e_*` (có `demo_e2e_cv2` — chủ trì mới khi giao lại, 0045; `demo_e2e_anh` — ảnh hồ sơ, PR-2a), `smoke_test` (cùng id với `supabase/seed.sql`, mật khẩu `123456`); tài khoản đã có, hoặc username đã tồn tại với id khác (tài khoản thật), thì bỏ qua. Phân công `phu_trach_phong` giả chỉ chèn khi phòng chưa có lãnh đạo thật phụ trách. Chạy tay: `KIEM_THU_MOI_TRUONG=production node scripts/seed-demo.mjs --project-ref frwyxcmbonjaimziiuqr` (CLI đã `supabase login`).
- Bộ dữ liệu mẫu `E2E-SEED` (`scripts/seed-demo-du-lieu.mjs`, chạy cuối `seed-demo.mjs`): văn bản `so_ket_luan = E2E-SEED` + 6 nhiệm vụ `noi_dung` bắt đầu `E2E-SEED` (đang thực hiện, quá hạn Đỏ, sắp đến hạn, hoàn thành có minh chứng, việc cũ `theo_1400=false`, việc mới chưa xác nhận) ở phòng `TONG_HOP` (hoặc phòng đầu tiên có PCVP phụ trách), owner/người giao là tài khoản `demo_*` tra theo username. Idempotent: chỉ chèn dòng thiếu, tính lại hạn theo hôm nay; thiếu tài khoản demo nào thì dừng và báo tên. Sau khi nạp, script đọc `v_nhiem_vu` bằng token `demo_cvp` và `demo_a0`, đỏ nếu không thấy đủ 6 dòng. Cần có vì `a0.spec`, `bo-cuc-mobile`, `kl-dashboard` giả định phạm vi A0/A1 có sẵn dòng. Trước đó script tạo đơn vị `E2E_RT` (phòng của `demo_e2e_tp/cv/cv2`, để việc có Owner tài khoản ở đó và giao lại đổi chủ trì) và **phòng thử** `E2E_PT` trong `dm_don_vi` (giữ phân công đang có của `demo_pcvp2`) và phân công `demo_pcvp2` phụ trách (`ly_do = seed kiểm thử`) — spec cần "PCVP phụ trách phòng X" (`chi-dao-tt`) đọc phòng lúc chạy qua `phongPhuTrach()`, không gõ cứng phòng thật.
- Test RLS/e2e tự tạo và tự dọn: văn bản `RLS-TEST`, hội nghị 991–999, nhiệm vụ `NV-T*`, nhiệm vụ có nội dung bắt đầu bằng `E2E-TEST`, đề nghị từ chối, minh chứng, chỉ đạo trên các việc đó.
- Trên production, các file RLS gọi `canh_bao_quet` **tự bỏ qua** (`kl-0029`, `kl-0030`, `kl-0032`, `kl-0034`, `kl-0035`): hàm quét gửi cảnh báo tới mọi việc thật và phần dọn của chúng xoá tin hệ thống sau mốc t0. Vài test phạm vi PCVP (`rls-9/10/11`, `kl-pham-vi-tong-hop`) có thể đỏ nếu phòng thật đã có lãnh đạo phụ trách (seed không chèn phân công giả) — đọc log để phân biệt với lỗi mã.
- Không có gì chạm 185 nhiệm vụ thật hay tài khoản thật.

## Dọn dữ liệu thử trước go-live

1. Tắt biến `KIEM_THU_MOI_TRUONG` (hoặc đặt `staging`).
2. Xoá dữ liệu thử còn sót (bình thường test đã tự dọn): nhiệm vụ `ma LIKE 'NV-T%'` hoặc `noi_dung LIKE 'E2E-TEST%'`, văn bản `so_ket_luan LIKE 'E2E-TEST%'` hoặc `= 'RLS-TEST'`, văn bản `so_hoi_nghi` 991–999, tài khoản `kl0034_a0b` — chạy tay qua Dashboard/CLI với câu lệnh in số dòng trước khi xoá.
3. Tài khoản demo: xoá `demo_*`, `demo_e2e_*` bằng `node scripts/create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --rollback` **chỉ với các id `00000000-0000-4000-8000-0000000000NN`** (kiểm tra danh sách trước), rồi xoá dòng `accounts` tương ứng; giữ `smoke_test` nếu đang dùng cho smoke test sau phát hành.
4. Xoá phân công `phu_trach_phong` có `ly_do = 'seed kiểm thử'`.
5. Xác nhận lại bằng `kl-moc-2026-09-14` (đếm 185 dòng `nguon = excel` không đổi).

## Edge Function `quan-tri-tai-khoan` (GĐ23)

Mã ở `supabase/functions/quan-tri-tai-khoan/index.ts` (Deno). Việc cần `service_role` (tạo tài khoản đăng nhập, đặt mật khẩu tạm, khoá/mở, cờ `quan_tri_he_thong`) chạy ở đây; key `SUPABASE_SERVICE_ROLE_KEY` do Supabase cấp sẵn trong secrets của function, **không** nằm ở frontend hay repo. Người gọi phải đăng nhập và có `accounts.quan_tri_he_thong` (function gọi RPC `me_quan_tri_he_thong` bằng JWT của họ). Mọi hành động ghi `nhat_ky_he_thong` (0041); mật khẩu tạm chỉ trả về một lần trong response.

- Deploy tự động: `deploy-staging.yml` (push `main`) và `deploy-prod.yml` (tag `v*`) chạy `supabase functions deploy quan-tri-tai-khoan --project-ref <ref> --use-api` ngay sau `db push`.
- Deploy tay (khi cần thử trên staging trước khi merge): `supabase functions deploy quan-tri-tai-khoan --project-ref vojmrjezspdftovzinek --use-api` (CLI đã `supabase login`). Không cần đặt secret gì thêm.
- Kiểm thử: màn hình Quản trị → Tài khoản (tài khoản `demo_qtht`): tạo tài khoản thử, đặt lại mật khẩu, khoá/mở; xem dòng tương ứng ở tab Nhật ký hệ thống. Cấp/thu `quan_tri_kl` vẫn qua hàm SQL `admin_dat_co` (e2e `quan-tri.spec.js` không phụ thuộc function).
- **Từ v3.15 — PR đổi `supabase/functions/**`**: job "Kiểm thử RLS + e2e trên staging" của `ci.yml` deploy function **của chính PR** lên staging (output `cham_function` của `phan-loai.sh`, `--use-api`, ~20 giây) trước khi chạy e2e, nên kiểm tay trên `/staging/` trong PR là đúng bản sắp merge; không cần deploy tay nữa. Chỉ staging; production vẫn chỉ qua `deploy-prod.yml`.
- Hành động `reset_hang_loat` (bàn giao tài khoản, QT-7): kiểm tay trên staging bằng `demo_qtht` với **tài khoản thử tạo riêng** (phạm vi *Theo phòng* của tài khoản đó): tài khoản seed đã đổi mật khẩu (`must_change_password = false`) nên bị bỏ qua, không làm hỏng mật khẩu `123456` của e2e; **không** tick "kể cả tài khoản đang dùng" trên staging. Logic chọn phạm vi và dựng tệp có unit test (`frontend/tests/ban-giao.test.mjs`).
- Lỗi thường gặp: HTTP 401/403 = phiên hết hạn hoặc không có cờ; 409 = trùng tên đăng nhập; xem log ở Dashboard → Edge Functions → Logs.

## Cờ đổi mật khẩu lần đầu và dọn dữ liệu (GĐ23)

- Trước go-live: `node scripts/bat-co-doi-mat-khau.mjs --project-ref frwyxcmbonjaimziiuqr` in danh sách tài khoản thật (bỏ `demo_*`, `smoke_test`, `is_system`); chạy lại với `--thuc-hien` để bật cờ; script đếm lại số dòng sau khi ghi.
- Màn hình Dọn dữ liệu (`quan_tri_he_thong`): xem trước số dòng → gõ `XOÁ`. App chỉ cho xoá khi mốc backup (dòng `nhat_ky_he_thong` hành động `backup` mới nhất, do `backup-dinh-ky.yml` và bước backup của `deploy-prod.yml` ghi qua RPC `ghi_moc_backup` bằng `SUPABASE_SERVICE_ROLE_KEY`) trong 24 giờ. Bộ sẵn "dữ liệu thử" xoá NV-T*, E2E-TEST*, **E2E-SEED*** (0043), phòng thử `E2E_*` và phân công vào đó (0044), văn bản RLS-TEST / hội nghị 991–999, tài khoản `demo_*` và mọi thứ gắn với chúng (thay cho mục "Dọn dữ liệu thử trước go-live" ở trên; vẫn giữ `smoke_test`).

## Phân loại thay đổi trong CI/CD (từ 18/9/2026)

Một script dùng chung `.github/scripts/phan-loai.sh` (mẫu khai báo một chỗ) chạy ở job `phan-loai` của `ci.yml` (pull_request và push `main`) và `deploy-staging.yml` (push `main`). Kết luận `khong_anh_huong_app = true` chỉ khi đọc được **đủ** danh sách file (API `pulls/N/files` hoặc `compare/before...sha`, phân trang `per_page=100`, đối chiếu `changed_files`; compare chạm trần 300 file coi là không đủ), có ít nhất một file, và **mọi** file khớp `docs/**`, `*.md`, `.github/workflows/backup-dinh-ky.yml`, `.github/workflows/canh-bao.yml`. Không có ngoại lệ theo tên nhánh: PR release chỉ tài liệu cũng bỏ qua (job `kiem-tra` của `deploy-prod` đọc 4 check theo **tên** nên job rỗng cùng tên vẫn được chấp nhận — `v3.6.0`, `v3.6.1`).

| Loại thay đổi | PR (`ci.yml`) | Push `main` (`ci.yml` + `deploy-staging.yml`) |
|---|---|---|
| Chỉ `docs/**`, `*.md`, workflow backup-dinh-ky / canh-bao | gitleaks chạy; `Áp migration + lint schema`, `Build frontend + giới hạn 300 dòng`, `Kiểm thử RLS + e2e trên staging` = job rỗng cùng tên (xanh) | gitleaks chạy; hai job rỗng (không có e2e khi push main); **deploy-staging bỏ qua cả run** (không db push, không RLS, không dựng Pages) |
| Bất kỳ file khác (`frontend/**`, `supabase/**`, `tests/**`, `scripts/**`, `package*.json`, `ci.yml`, `deploy-*.yml`, chính script phân loại…) | chạy đủ 4 check | chạy đủ; deploy-staging: db push → RLS ‖ build → Pages |
| Không chắc (PR rỗng, API lỗi, lấy không đủ danh sách, push đầu tiên, `workflow_dispatch`) | chạy đủ | chạy đủ |

`ci.yml` có `concurrency` theo nhánh PR (`cancel-in-progress` cho pull_request: push mới huỷ lượt cũ đang chạy; push `main` mỗi sha một nhóm, không huỷ). `deploy-prod.yml` không đổi.

**Phát hành trước go-live — không cần backup tay**: `deploy-prod.yml` đã `pg_dump` (mã hoá, artifact 90 ngày) ngay trước `db push` production và ghi mốc backup; *Backup định kỳ production* vẫn giữ lịch 3 ngày/lần; bản local (`scripts/backup-db.sh`) chỉ chạy khi muốn có bản ngoài GitHub, không phải bước bắt buộc của quy trình tag.

## e2e PR-2a — project `pr2a` (chỉ máy tính)

- `ca-nhan-anh` (tài khoản riêng `demo_e2e_anh`), `id-duy-nhat` (`demo_e2e_mc`), `cap-nhat-nhanh-han` (`demo_e2e_nv`), `giao-viec-kiem-nhiem` (PCVP2, PCVP, Chánh VP, Trưởng phòng — mỗi vai một phiên, đổi 5 loại văn bản trên biểu mẫu, chỉ bấm Giao ở ô đại diện). Chạy sau `gd22` vì đổi phân công PCVP/PCVP2 lúc chạy; `dang-nhap` phụ thuộc `pr2a`. Logic nên không chạy điện thoại. Chạy riêng: `npx playwright test --project=pr2a --no-deps` (kèm biến đích).
- Đếm lời gọi DB mỗi màn (đo tay, không chạy trong CI): spec `tests/e2e/_dem-goi/` nằm ngoài repo (`.git/info/exclude`); kết quả trước/sau ở thư mục bàn giao PR-2a.

## Chạy e2e cục bộ có độ trễ để bắt lỗi đua (PR-2a, từ 30/9/2026)

Supabase cục bộ trả lời gần như tức thì nên che mất lỗi "giao diện cho thao tác trước khi nạp xong" (CI #96: chọn "Văn bản mới" trong lúc biểu mẫu Giao việc còn nạp rồi bị bước khởi tạo ghi đè). Công tắc `E2E_TRE_MS=<ms>` (`tests/e2e/lib/tre.mjs`) làm mọi context Playwright trì hoãn mỗi lời gọi REST/RPC (`/rest/v1/`) và Storage (`/storage/v1/`) đúng số ms đó. **Mặc định tắt** — không đặt biến thì không đăng ký route nào; CI không đặt.

```
E2E_LOCAL=1 E2E_TRE_MS=300 npx playwright test          # toàn bộ, ~3 phút (không trễ ~2 phút)
E2E_LOCAL=1 E2E_TRE_MS=500 npx playwright test nhiem-vu.spec.js --project=desktop --no-deps
```

Nên chạy một vòng có độ trễ trước khi mở PR khi đổi cách nạp dữ liệu (song song, theo trang, realtime). Quy ước để không đua: màn hình khoá ô nhập (`fieldset disabled` + `aria-busy`) cho tới khi nạp xong rồi mới đặt `data-san-sang="1"`; spec chờ cờ đó (`moGiaoViec` trong `lib/app.js`), không dùng "phần tử đã hiện" làm tín hiệu nạp xong; vẽ lại danh sách giữ ô đang mở / đang gõ (`giuONhap` trong `frontend/src/lib/dom.js`).

## Đích kiểm thử phải chọn tường minh (PR-2a, từ 29/9/2026)

`tests/rls/lib.mjs` và `tests/e2e/lib/keys.mjs` **không còn đích mặc định** (trước đây thiếu biến cục bộ là trỏ staging qua Supabase CLI — sự cố 29/9: một file RLS chạy nhầm lên staging). Phải đặt **đúng một**:

| Bộ | Cục bộ | Staging | Production (công tắc) |
|---|---|---|---|
| `tests/rls` | `RLS_LOCAL=1` | `RLS_STAGING=1` | **không chạy** (`KIEM_THU_MOI_TRUONG=production` ⇒ dừng) |
| `tests/e2e` | `E2E_LOCAL=1` | `E2E_STAGING=1` | `KIEM_THU_MOI_TRUONG=production` |

Thiếu hoặc thừa ⇒ dừng mã 2 ngay khi nạp module, trước mọi lời gọi mạng (kể cả Supabase CLI); `tests/rls/dich-tuong-minh.test.mjs` chứng minh (đếm kết nối TCP, `fetch`, tiến trình con = 0). Với staging/production, `SUPABASE_URL` (nếu đặt) phải đúng project của đích. CI: job "Áp migration + lint schema" đặt `RLS_LOCAL=1`; `deploy-staging.yml` job RLS đặt `RLS_STAGING=1`; `ci.yml` job e2e đặt `E2E_STAGING=1` khi `KIEM_THU_MOI_TRUONG` ≠ production. Bỏ `RLS_PROJECT_REF` / `E2E_PROJECT_REF`.

## RLS token thật trên staging (deploy-staging.yml) — từ v8 đợt 3

- Job "Test RLS trên staging (token thật)" **chỉ chạy** khi push lên `main` chạm `supabase/**` hoặc `tests/rls/**` (output `cham_rls` của `.github/scripts/phan-loai.sh`, dùng chung với `ci.yml`; `workflow_dispatch` luôn chạy). PR chỉ frontend/tests e2e/docs không chạy job này.
- Lý do: RLS của mọi PR đã chạy **đủ** trên Supabase cục bộ ở job "Áp migration + lint schema" của `ci.yml`; staging là instance nhỏ, quá tải làm job token thật đỏ ở mọi lần merge gần đây (lần cuối 17 phút 16 giây mới hỏng) — vừa tốn máy chạy vừa che lỗi thật.
- Từ PR-2a (D2): **bỏ `continue-on-error`** — RLS đỏ hoặc quá giờ thì job **đỏ** (thấy ngay trên trang run), nhưng **không chặn Pages**: job `deploy` chỉ `needs: build`, không `needs` job RLS (đã kiểm workflow). Giới hạn: bước test **12 phút**, job **14 phút**. Bước "Ghi cảnh báo" chạy `if: failure()`, ghi annotation `::warning` và một dòng vào Step Summary ("⚠️ RLS staging lỗi — không chặn deploy, xem log").
- Thời lượng bộ trên staging ≈ số lượt khứ hồi tuần tự × độ trễ mỗi lời gọi (≈ 0,25 s, suy từ run Deploy staging #74). Đếm lời gọi từng file: `node scripts/dem-goi-rls.mjs` (Supabase cục bộ; `tests/rls/dem-goi.mjs` bọc `fetch` khi đặt `DEM_GOI`). Mục tiêu cả bộ ≤ 6 phút: test mới gộp truy vấn, dùng `Promise.all` giới hạn ở chỗ độc lập.
- `khong_anh_huong_app` giữ nguyên nghĩa và cách tính (đã kiểm lại với PR #83 → true, #85 → false + cham_rls=true, #88 → false + cham_rls=false).

## RLS: logic thuần chỉ chạy cục bộ — `CHI_CUC_BO` (PR-2b, từ 30/9/2026)

- `tests/rls/lib.mjs` xuất `CHI_CUC_BO`: với `RLS_LOCAL=1` là `false` (chạy), với `RLS_STAGING=1` là lý do bỏ qua. Test chỉ kiểm **logic thuần** (tính ngày làm việc, trạng thái, khâu, mốc, nhắc — không phụ thuộc token thật) gắn `{ skip: CHI_CUC_BO }`; job "Áp migration + lint schema" của `ci.yml` vẫn chạy **toàn bộ** bộ RLS trên Supabase cục bộ, staging chỉ giữ phần kiểm quyền bằng token thật.
- Cả file: `kl-0022-cha-con-owner`, `kl-0024-trang-thai-bi-danh`, `kl-0027-ma-nhiem-vu`, `kl-trang-thai`, `kl-minh-chung-bat-buoc`, `kl-0058-trang-thai-nghiem-thu`, `kl-0060-nhac-nghiem-thu`. Từng khối: `kl-0068-sua-tai-khoan` (bản tin 7h30 mỗi ngày một lần). Từng test: `kl-0028` (8–10), `kl-0029` (2–6), `kl-0032` (1, 7), `kl-0033` (2 test khâu + mốc), `kl-0035` (1–2), `kl-pq-pham-vi-giao` (1, 6), `kl-0053-ngay-lam-viec` (phần logic), `kl-0054-han-nop-minh-chung` (1, 6, khối biên).
- Xem trước tập test staging sẽ chạy ngay trên máy: `RLS_LOCAL=1 RLS_NHU_STAGING=1 node --test tests/rls/`.
- Test mới gọi `giao_viec` qua client bọc sẵn trong `lib.mjs`: thiếu `han_nop_minh_chung` thì tự điền (= hạn hoàn thành nếu chưa qua, không thì hôm nay) để test cũ không phải sửa.

## e2e — tối đa 2 phiên mở cùng lúc (từ 30/9/2026, sau CI #97)

- Một spec e2e **không mở quá 2 phiên trình duyệt cùng lúc**; spec kiểm nhiều vai chạy **tuần tự** — mở phiên một vai, kiểm, đóng rồi mới sang vai sau (`voiPhien` trong `tests/e2e/lib/pr2b.mjs`). Không mở sẵn hàng loạt phiên ở `beforeAll`.
- Spec nặng / nhiều phiên không chạy chồng nhau: xếp thành chuỗi project nối `dependencies` (như `pr2b-*`), sau mọi project nặng khác.
- Lý do: mỗi thao tác ghi → realtime → MỌI trang đang mở cùng gọi `kl_so_chua_xu_ly` và nạp lại `v_nhiem_vu` trong vài giây; nhiều phiên song song làm staging (Nano) chậm 3–16 s rồi `57014 statement timeout` (CI #97 đỏ 2 test, e2e 9 phút 44 giây) — lỗi giả, không phải lỗi logic.

## e2e PR-2b — chuỗi project `pr2b-*` (chỉ máy tính)

- `han-nop-minh-chung` (ma trận 7 vai × 5 loại văn bản, giao thật A2 và A0 từ Kết luận, sửa hạn nộp, nhãn cam), `nghiem-thu` (A3 nộp → A2 trả lại kèm hạn nộp lại → nộp lại → nghiệm thu; thư ký Thường trực), `hanh-trinh-5-loai-van-ban`, `b4-b6-lanh-dao`. Dùng chung `tests/e2e/lib/pr2b.mjs`; dữ liệu theo khoá riêng, cờ tạm (`quan_tri_kl`, `thu_ky_thuong_truc`, phân công kiêm nhiệm) khôi phục ở `beforeAll` lẫn `afterAll`.
- Bốn project nối tiếp `pr2b-han-nop` → `pr2b-nghiem-thu` → `pr2b-hanh-trinh` → `pr2b-b4-b6` (mỗi lúc một spec), sau `pr2a`; `dang-nhap` phụ thuộc `pr2b-b4-b6`. Chạy riêng cả chuỗi: `npx playwright test --project='pr2b-*' --no-deps --workers=1` (kèm biến đích).


## e2e PR-3 — chuỗi project `pr3-*` (chỉ máy tính, từ 1/10/2026)

- `pr3-giao-that` (giao thật một việc mỗi vai — 7 vai tuần tự, cờ `quan_tri_kl` / kiêm nhiệm tạm khôi phục ở `beforeAll` lẫn `afterAll`; nguồn mặc định ở văn bản mới và có sẵn, DB lưu đúng cột), `pr3-vuong-mac` (A3 điền ở Cập nhật nhanh → thẻ Đỏ của Chánh VP trường 5, dải Cần xử lý ngay, Báo cáo → xoá trống tại ngăn), `pr3-hien-thi` (nghiệm thu bắt buộc chất lượng, "Trước hạn n ngày", Xuất Excel đọc lại bằng `tests/e2e/lib/doc-xlsx.mjs`, Báo cáo cột mới, Theo văn bản "đã nhập x / dự kiến y" → rà soát).
- Ma trận ô **Nguồn nhiệm vụ** 7 vai × 5 loại (mặc định, văn bản có sẵn, "Còn thiếu" khi bỏ chọn) **nằm trong** `pr2b-han-nop` (cùng phiên với ô hạn nộp — quyết định 1/10/2026 để e2e staging ≤ 9 phút).
- Nối tiếp `pr2b-b4-b6` → `pr3-giao-that` → `pr3-vuong-mac` → `pr3-hien-thi`; `dang-nhap` phụ thuộc `pr3-hien-thi`. Nghiệm thu trong spec dùng `nghiemThuMc` (`lib/pr2b.mjs`: bấm Nghiệm thu → nút xác nhận mờ → chọn chất lượng → xác nhận). Chạy riêng: `npx playwright test --project='pr3-*' --no-deps --workers=1` (kèm biến đích).
- RLS: `kl-pr3-chat-luong-nguon` (A, B, E; D gắn `CHI_CUC_BO`), `kl-pr3-vuong-mac-ra-soat` (C, F). `lib.mjs` bọc `giao_viec` điền nguồn `NHIEM_VU_PHAT_SINH` khi test cũ không truyền khoá (test PR-3 truyền tường minh, kể cả null).

## e2e PR-4 — project `pr4` (chỉ máy tính, từ 1/10/2026)
- `quan-tri-sua-tai-khoan.spec.js`: một phiên demo_qtht; Sửa demo_e2e_dh (phòng + chức danh, lý do bắt buộc, không đổi thì không lưu) → bảng + nhật ký cấp quyền; ô Phòng theo vai; A2 trùng phòng hiện lỗi DB; trả lại như cũ trong spec (khôi phục giá trị gốc cả `beforeAll` lẫn `afterAll`).
- Nối `pr3-hien-thi` → `pr4`; `dang-nhap` phụ thuộc `pr4`. Chạy riêng: `npx playwright test --project=pr4 --no-deps` (kèm biến đích). RLS: `kl-0068-sua-tai-khoan` (demo_e2e_dh / demo_e2e_mc — không file RLS nào khác dùng).

## e2e giao diện v9 đợt 2 — project `v9-dot2`, `v9-nhap-excel` (chỉ máy tính, từ 2/10/2026)
- `nhap-theo-tang.spec.js` (project `v9-dot2`, sau `pr4`): thẻ "Việc của tôi" A3 → Đề nghị sửa → A2 duyệt ở Cần xử lý; khoá / bút trong ngăn chi tiết; Sửa thông tin giao. Hàm DB gửi tin hệ thống cho demo_e2e_cv nên không chạy song song với `desktop` (realtime.spec đếm huy hiệu).
- `nhap-excel.spec.js` (project `v9-nhap-excel`, sau `v9-dot2`): demo_e2e_tk cấp tạm `quan_tri_kl`; tệp "Phụ lục 2" HƯ CẤU tạo lúc chạy (`lib/xlsx-gia.mjs`, không lưu vào kho) → xem trước → nhập lô → hoàn thiện dòng chờ → dữ liệu gốc (demo_e2e_cv) → hoàn tác. `global-setup` dọn lô / tin / từ điển nhãn `E2E-TEST` còn sót.
- `dang-nhap` phụ thuộc thêm `v9-dot2`, `v9-nhap-excel`. Project chưa áp 0071 / 0072 → spec tự skip (PR chạy e2e trên staging chưa có migration của PR; chạy thật sau khi merge). PR #101: staging được áp tay 0070–0075 ngày 2/10 (trước merge) nên hai spec chạy thật ngay trong PR.
- RLS: `kl-0070-nhap-theo-tang` (lỗi giá trị của sua_thong_tin_giao chỉ chạy cục bộ), `kl-0072-nhap-excel` (test 7 từ điển / hồ sơ gắn `CHI_CUC_BO`); cả hai cấp tạm `quan_tri_kl` cho demo_cv2 và trả lại trong `finally` / `after`.


## Làm việc không cần Docker Desktop (từ 4/10/2026, v3.14.2)

Docker Desktop (WSL2) chiếm nhiều RAM trên laptop; quy tắc 13 trong `CLAUDE.md`: **mặc định không bật**. Nơi kiểm tra migration và RLS là CI — job "Áp migration + lint schema" của `ci.yml` khởi động Supabase cục bộ trên runner, áp toàn bộ migration của PR, lint schema và chạy đủ bộ `tests/rls`; e2e chạy trên staging. Trên laptop chỉ cần Node + Supabase CLI đã `supabase login` và `supabase link` (staging).

| Việc | Không cần Docker | Cần Docker (chỉ khi chủ dự án yêu cầu) |
|---|---|---|
| Viết migration | tạo tay `supabase/migrations/NNNN_*.sql`; xem trước `supabase db push --dry-run` | `supabase db diff` (shadow DB) |
| Áp migration | `supabase db push` (staging); production qua `deploy-prod.yml` | `supabase db reset` (cục bộ) |
| Kiểm tra schema / hàm | `supabase db lint --linked`; `supabase db query --linked "select …"` (chỉ SELECT) | `supabase db lint --local` |
| Test RLS | để CI chạy: mọi PR trên runner (`RLS_LOCAL=1`), sau merge thêm token thật trên staging (`deploy-staging.yml`) | `RLS_LOCAL=1 npm test` sau `supabase start` |
| Test e2e | `E2E_STAGING=1 npx playwright test <spec>` (một spec, không chạy cả bộ liên tục — staging nhỏ) | `E2E_LOCAL=1` (+ `E2E_TRE_MS`) |
| Chạy frontend | `cd frontend && npm run dev` với `.env` trỏ **staging** (anon key) | `.env` trỏ Supabase cục bộ |
| Backup | tải artifact của `deploy-prod` / `backup-dinh-ky` (GitHub Actions) | `scripts/backup-db.sh` (`db dump` chạy pg_dump trong Docker) |
| Edge Function | `supabase functions deploy quan-tri-tai-khoan --use-api --project-ref <staging>` | `supabase functions serve` |
| Danh sách / sửa mốc migration | `supabase migration list`, `supabase migration repair` | — |

Khi vẫn phải dùng Docker: `supabase/config.toml` đã tắt Studio, analytics (Logflare + Vector) và Mailpit — `supabase start` chỉ còn db, kong, auth, rest, realtime, storage, edge-runtime (nhẹ hơn khoảng 1 GB, khởi động nhanh hơn); xong việc chạy `supabase stop` rồi thoát Docker Desktop. Giới hạn RAM của WSL2 đặt ngoài repo, trong `%UserProfile%\.wslconfig` (`[wsl2]` → `memory=3GB`, `swap=0`) rồi `wsl --shutdown`.

## Hết phiên do không thao tác (v3.15.1, NF-14)

Bộ đếm ở `frontend/src/auth/het-phien.js` (logic thuần `lib/het-phien.js`): mặc định 30 phút, nhắc trước 2 phút, kiểm mỗi 15 giây. Khoá kiểm thử `localStorage.vptu-phut-het-phien` = số phút (0,1 = 6 giây) ghi đè mặc định — chỉ dùng trong e2e `het-phien.spec.js` và khi thử tay (gõ `localStorage.setItem('vptu-phut-het-phien','0.1')` ở Console rồi tải lại); xoá khoá để về mặc định. Đăng xuất do hết phiên dùng `signOut({ scope: 'local' })` nên không huỷ phiên máy chủ của tài khoản seed.
