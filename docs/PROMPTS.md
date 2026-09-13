# PROMPTS — Bộ prompt giao việc cho Claude Code

Nguyên tắc: **prompt ngắn, trỏ vào SPEC, bắt lập kế hoạch trước.** Mỗi prompt là một phiên. Xong thì `/clear`.

Cấu trúc chung của một prompt tốt:
```
[Việc]     Làm gì, một câu.
[Nguồn]    Đọc file/mục nào.
[Phạm vi]  Chỉ đụng thư mục/file nào. Không đụng gì.
[Xong khi] Tiêu chí kiểm tra được.
[Cách làm] Plan mode trước, chờ duyệt.
```

---

## Prompt 0 — Khởi động phiên đầu tiên

```
Đọc CLAUDE.md, docs/SPEC.md, docs/DESIGN.md và CHANGELOG.md.
Sau đó trả lời ngắn (dưới 15 dòng):
1. Bạn hiểu dự án là gì.
2. 3 rủi ro lớn nhất của hiện trạng.
3. Bạn cần tôi trả lời câu hỏi mở nào trong SPEC mục 10 trước khi bắt đầu GĐ 0.
Không sửa file nào ở bước này.
```

---

## Giai đoạn 0 — Khởi tạo cấu trúc

```
[Việc] Tạo cấu trúc thư mục đích theo SPEC mục 6 và migration đầu tiên.
[Nguồn] SPEC mục 6, 7 (GĐ 0). Schema hiện tại lấy bằng plugin Supabase từ project frwyxcmbonjaimziiuqr (chỉ đọc).
[Phạm vi] Tạo mới: frontend/ (rỗng, có README), supabase/ (config + migrations/0001_baseline.sql dump đúng schema hiện tại kể cả view), tests/, .github/workflows/ci.yml (lint + gitleaks), scripts/, .gitignore.
Chưa động vào index.html.
[Xong khi] Nhánh feature/gd0-khoi-tao có PR, CI xanh, migration 0001 áp được lên một project Supabase trắng.
[Cách làm] Plan mode. Liệt kê file sẽ tạo, chờ tôi duyệt.
```

## Giai đoạn 1 — Chặn rò rỉ khẩn cấp

```
[Việc] Bật RLS tạm thời trên 5 bảng và ẩn cột password.
[Nguồn] SPEC RLS-1, mục 7 GĐ 1.
[Phạm vi] supabase/migrations/0002_rls_tam_thoi.sql: enable RLS 5 bảng; policy cho phép authenticated đọc/ghi (tạm); view accounts_public không có password. Sửa index.html để đọc danh sách cán bộ từ accounts_public.
Chưa đổi cách đăng nhập.
[Xong khi] Sau khi áp lên staging, Table Editor không còn UNRESTRICTED; app cũ vẫn đăng nhập và giao việc được với 3 vai trò.
[Cách làm] Plan mode. Trình SQL trước, chờ duyệt. KHÔNG áp lên production; chỉ staging.
```

## Giai đoạn 2 — Supabase Auth

```
[Việc] Chuyển đăng nhập sang Supabase Auth, bảo toàn 49 tài khoản.
[Nguồn] SPEC AUTH-1…5, mục 5, mục 9.
[Phạm vi] Migration: tạo auth.users cho 49 username với email username@vptu.caobang.local, mật khẩu tạm ngẫu nhiên, must_change_password=true; liên kết accounts.id; bỏ cột password. Frontend: form đăng nhập gọi supabase.auth.signInWithPassword; màn hình đổi mật khẩu lần đầu.
[Xong khi] Trên staging, 3 tài khoản mẫu (1 mỗi vai trò) đăng nhập, bị bắt đổi mật khẩu, rồi vào đúng view. Không còn truy vấn nào so sánh password ở client.
[Cách làm] Plan mode. Trình cách migrate tài khoản và cách phát mật khẩu tạm cho 49 người, chờ duyệt.
```

## Giai đoạn 3 — RLS đầy đủ và test

```
[Việc] Viết policy RLS theo vai trò và test chứng minh.
[Nguồn] SPEC RLS-2…8, mục 2.
[Phạm vi] supabase/migrations/0004_rls_policies.sql, 0005_functions.sql; tests/rls/*.test.js dùng 4 tài khoản mẫu (CVP, PCVP, A2, A3) chạy bằng anon key + token thật trên staging.
[Xong khi] Mỗi dòng trong RLS-2…7 có ít nhất 1 test "được phép" và 1 test "bị chặn". Tất cả pass.
[Cách làm] Plan mode. Trình bảng policy (bảng × vai trò × SELECT/INSERT/UPDATE/DELETE) trước khi viết SQL.
```

## Giai đoạn 4 — Tách frontend

```
[Việc] Chuyển index.html thành dự án Vite nhiều file, KHÔNG đổi hành vi.
[Nguồn] SPEC mục 6, TASK/DIR/MSG/DASH (tất cả [Giữ]). CLAUDE.md quy ước code.
[Phạm vi] frontend/ theo cây thư mục SPEC 6. Tailwind qua build. Không thay đổi giao diện ở bước này (giữ nguyên trông như cũ).
[Xong khi] tests/e2e/ có 6 kịch bản: đăng nhập 3 vai trò, A2 giao việc, A3 tiếp nhận + nộp minh chứng, A2 duyệt. Tất cả pass trên staging. Không file > 300 dòng.
[Cách làm] Plan mode. Chia thành 3 PR: (a) khung Vite + auth + main.js, (b) views A1/A2/A3, (c) directives + messages + realtime. Trình kế hoạch PR (a) trước.
```

## Giai đoạn 5 — Giao diện mới

```
[Việc] Áp hệ thống thiết kế lên toàn bộ giao diện.
[Nguồn] docs/DESIGN.md toàn bộ; mockup/index.html làm chuẩn.
[Phạm vi] frontend/src/styles/, components/, views/. Không đổi logic nghiệp vụ, không đổi API.
[Xong khi] Checklist DESIGN mục 9 đạt hết; Lighthouse Accessibility ≥ 90; e2e vẫn pass; chụp 4 màn hình (đăng nhập, A1, A2, A3) ở 1280px và 360px đính vào PR.
[Cách làm] Plan mode. Bắt đầu từ tokens.css và trang đăng nhập; tôi duyệt bằng mắt rồi mới làm tiếp.
```

## Giai đoạn 6 — CI/CD

```
[Việc] Pipeline tự động: PR → test → staging → duyệt → production.
[Nguồn] SPEC mục 7 GĐ 6, NF-2.
[Phạm vi] .github/workflows/: ci.yml (lint, build, e2e trên staging, gitleaks), deploy-staging.yml (on push main: build + supabase db push staging + deploy Pages staging), deploy-prod.yml (on tag v*: environment production có người duyệt).
Secrets cần tạo: liệt kê tên, tôi tự nhập trên GitHub.
[Xong khi] Một PR nhỏ đi hết pipeline; tag v2.0.0-rc1 dừng chờ duyệt đúng chỗ.
[Cách làm] Plan mode. Trình sơ đồ pipeline và danh sách secrets trước.
```

## Giai đoạn 7 — Vận hành

```
[Việc] Backup, giám sát, tài liệu vận hành.
[Nguồn] SPEC NF-6, mục 7 GĐ 7. Trả lời Q3 của tôi: [ghi gói Supabase].
[Phạm vi] scripts/backup-db.sh, restore-db.sh (pg_dump qua connection string trong secret); workflow backup hằng đêm đẩy lên [nơi lưu]; docs/xu-ly-su-co.md (10 tình huống thường gặp, mỗi tình huống 5 dòng); hướng dẫn cài uptime monitor ngoài.
[Xong khi] Tôi tự chạy restore-db.sh lên project trắng theo hướng dẫn và thành công.
```

---

## Prompt việc nhỏ (dùng hằng ngày)

**Sửa lỗi:**
```
[Việc] Lỗi: [mô tả 1 câu, kèm bước tái hiện].
[Nguồn] Kịch bản e2e liên quan trong tests/e2e/.
[Phạm vi] Chỉ file gây lỗi. Thêm 1 test tái hiện lỗi trước khi sửa.
[Xong khi] Test mới pass, các test cũ pass.
```

**Thêm tính năng nhỏ:**
```
[Việc] Thêm [mã yêu cầu mới, ví dụ TASK-9] đã ghi vào SPEC mục 3.3.
[Phạm vi] [thư mục].
[Xong khi] Có test; DESIGN checklist đạt; CHANGELOG 3 dòng.
[Cách làm] Plan mode.
```

**Rà soát trước khi mở PR:**
```
/code-review
Sau đó liệt kê các cảnh báo mức cao và cách sửa. Chỉ sửa khi tôi đồng ý.
```

---

## Những câu KHÔNG nên nói với Claude Code (tốn token, kết quả kém)

| Đừng nói | Vì sao | Nói thay bằng |
|---|---|---|
| "Làm cho đẹp hơn" | Không đo được | "Áp DESIGN mục 5 cho bảng nhiệm vụ" |
| "Sửa hết lỗi đi" | Không có phạm vi | "Sửa lỗi X, thêm test tái hiện" |
| Dán cả CHANGELOG vào chat | Lãng phí token, file đã trong repo | "Đọc CHANGELOG mục 6.1" |
| "Làm luôn cả 3 giai đoạn" | Phiên quá dài, dễ lệch | Mỗi phiên một giai đoạn |
| "Bạn nghĩ nên dùng gì?" giữa chừng | Mở lại quyết định đã chốt | Đọc SPEC mục 9 trước |
