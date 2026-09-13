# SPEC — VPTU-TASK v2 (Spec-Driven Development)

Phiên bản 1.0 · Chủ dự án: Văn phòng Tỉnh ủy Cao Bằng · Trạng thái: Đã duyệt để triển khai

> Cách dùng: đây là **nguồn sự thật duy nhất** về "app phải làm gì". Claude Code làm theo file này, không theo trí nhớ hội thoại. Mỗi prompt trỏ tới một mã yêu cầu (ví dụ `AUTH-2`, `RLS-4`). Việc nào không có trong SPEC thì chưa làm.

---

## 1. Mục tiêu và phạm vi

**1.1 Mục tiêu:** Xây lại VPTU-TASK từ bản MVP một file thành ứng dụng có đủ frontend / backend / database, an toàn, có kiểm thử và triển khai tự động, giữ nguyên toàn bộ nghiệp vụ đã có.

**1.2 Trong phạm vi (v2.0):**
- Chuyển đăng nhập sang Supabase Auth, bảo toàn 49 tài khoản.
- Bật RLS toàn bộ bảng với chính sách theo A1/A2/A3 + department.
- Tách `index.html` thành dự án Vite nhiều file.
- Giao diện mới theo `docs/DESIGN.md`.
- Migrations, staging, CI/CD, test tự động, backup.

**1.3 Ngoài phạm vi (không làm ở v2.0):**
- Ứng dụng di động riêng (chỉ responsive web).
- Tích hợp VOffice / hệ thống văn bản điện tử.
- Thông báo qua Zalo/SMS.
- Đính kèm file trực tiếp (vẫn nộp minh chứng bằng đường dẫn).

---

## 2. Người dùng và vai trò

| Mã | Vai trò | Số lượng | Phạm vi nhìn thấy |
|---|---|---|---|
| A1-CVP | Chánh Văn phòng | 1 | Toàn cơ quan |
| A1-PCVP | Phó Chánh Văn phòng | 4 | Các phòng thuộc khối mình phụ trách (qua `accounts.manager_id`) |
| A2 | Trưởng phòng | 5 | Phòng mình (`department`) |
| A3 | Chuyên viên / cán bộ | 39 | Việc của chính mình |

Khối và phòng: TONG_HOP, HC_LT, CDS_CY, TAI_CHINH_DANG, QUAN_TRI. Danh sách 49 người lấy từ bảng `accounts` hiện có, không nhập lại.

---

## 3. Yêu cầu chức năng

Ký hiệu: **[Giữ]** = đã có ở MVP, giữ nguyên hành vi. **[Mới]** = thêm ở v2. **[Sửa]** = thay đổi cách làm nhưng giữ kết quả.

### 3.1 Đăng nhập — AUTH
- **AUTH-1 [Sửa]** Đăng nhập bằng Supabase Auth (email + mật khẩu). Email quy ước `username@vptu.caobang.local` để không đổi username hiện có.
- **AUTH-2 [Mới]** Lần đăng nhập đầu sau nâng cấp bắt buộc đổi mật khẩu. Mật khẩu ≥ 8 ký tự, có chữ và số.
- **AUTH-3 [Mới]** Khoá 15 phút sau 5 lần sai (dùng rate-limit của Supabase Auth).
- **AUTH-4 [Sửa]** Bảng `accounts` không còn cột `password`. Liên kết `accounts.id = auth.users.id`.
- **AUTH-5 [Giữ]** Sau đăng nhập, điều hướng theo vai trò A1/A2/A3.

### 3.2 Phân quyền dữ liệu — RLS
- **RLS-1** Bật RLS trên `accounts`, `tasks`, `task_directives`, `task_evidences`, `direct_messages`. Không có bảng nào UNRESTRICTED.
- **RLS-2** `accounts`: mọi người đã đăng nhập đọc được các cột công khai (họ tên, chức danh, phòng, vai trò). Chỉ A1 sửa được. Không ai đọc được `auth.users`.
- **RLS-3** `tasks` — đọc: A3 chỉ `assigned_to = auth.uid()`; A2 chỉ tasks có `assigned_to` thuộc phòng mình hoặc `leader_in_charge = auth.uid()`; A1-PCVP chỉ tasks thuộc khối mình; A1-CVP tất cả.
- **RLS-4** `tasks` — ghi: A1 và A2 tạo/sửa trong phạm vi đọc của mình; A3 chỉ cập nhật `status` (tiếp nhận/từ chối/nộp) trên task của mình, không sửa trường khác.
- **RLS-5** `task_directives`: đọc/ghi nếu là A1 hoặc là `assigned_to` / `leader_in_charge` / `created_by` của task đó.
- **RLS-6** `direct_messages`: chỉ `sender_id` hoặc `receiver_id` = `auth.uid()`.
- **RLS-7** `task_evidences`: A3 chỉ thêm cho task của mình; A2/A1 đọc và duyệt trong phạm vi.
- **RLS-8** Mọi thao tác nhiều bước (giao việc, duyệt hoàn thành, đánh dấu đã đọc) là Postgres function `security definer`, có kiểm tra quyền bên trong.

### 3.3 Nhiệm vụ — TASK
- **TASK-1 [Giữ]** A1/A2 giao việc: tiêu đề, số/ký hiệu văn bản, sản phẩm đầu ra, hạn, ngưỡng "đỏ đặc biệt", cấp có thẩm quyền, người thực hiện, lãnh đạo phụ trách.
- **TASK-2 [Giữ]** Chặn hạn ở quá khứ hoặc trống.
- **TASK-3 [Giữ]** A3 đăng nhập có việc chờ tiếp nhận → modal bắt buộc, chọn tiếp nhận hoặc từ chối kèm lý do.
- **TASK-4 [Giữ]** Trạng thái: CHUA_GIAO, CHO_TIEP_NHAN, TU_CHOI_TIEP_NHAN, DANG_THUC_HIEN, CHO_DUYET, HOAN_THANH. Default của cột `status` sửa thành `CHUA_GIAO`.
- **TASK-5 [Giữ]** Mức cảnh báo tính từ view: XANH / VANG (≤3 ngày) / DO (quá hạn) / DO_DAC_BIET.
- **TASK-6 [Giữ]** Đôn đốc: tăng `warning_count`, ghi `last_warned_at`.
- **TASK-7 [Giữ]** Nộp minh chứng bằng URL http/https; A2 duyệt → HOAN_THANH, ghi `completed_at`.
- **TASK-8 [Mới]** Lịch sử thay đổi trạng thái: bảng `task_status_log(task_id, from, to, by, at)`.

### 3.4 Ý kiến chỉ đạo — DIR
- **DIR-1 [Giữ]** Luồng bình luận inline dưới mỗi dòng nhiệm vụ, hiển thị cho đúng người liên quan (RLS-5).
- **DIR-2 [Giữ]** A3 chỉ trả lời khi đã có ý kiến từ A1/A2.
- **DIR-3 [Sửa]** Đã đọc theo từng người: bảng `task_directive_reads(directive_id, reader_id, read_at)`. Bỏ cột `is_read` dùng chung.
- **DIR-4 [Giữ]** Huy hiệu số chưa đọc trên nút "Ý kiến" và viền nổi bật dòng nhiệm vụ; realtime.

### 3.5 Nhắn tin — MSG
- **MSG-1 [Giữ]** Nhắn tin 1-1, danh bạ theo quy tắc: A1 thấy tất cả; A2 thấy A1 + phòng mình; A3 thấy phòng mình.
- **MSG-2 [Giữ]** Đếm chưa đọc theo người; realtime.

### 3.6 Dashboard và KPI — DASH
- **DASH-1 [Giữ]** A1: bảng ngoại lệ (đỏ, đỏ đặc biệt, từ chối, chưa giao) từ view `view_exception_dashboard`.
- **DASH-2 [Giữ]** A1 tab 2: cây phân cấp CVP → PCVP → Trưởng phòng → Cán bộ, KPI theo từng nút, mở chi tiết inline.
- **DASH-3 [Giữ]** A2: 3 tab Giao việc / Theo dõi & thẩm tra / KPI phòng.
- **DASH-4 [Giữ]** A3: danh sách việc sắp theo hạn, thanh thống kê 4 ô.
- **DASH-5 [Giữ]** Tìm kiếm nhanh trong bảng (lọc client).

---

## 4. Yêu cầu phi chức năng

| Mã | Yêu cầu | Đo bằng |
|---|---|---|
| NF-1 Bảo mật | Không endpoint nào trả dữ liệu ngoài phạm vi vai trò | `tests/rls/` pass 100% |
| NF-2 Bảo mật | Không secret trong repo | `gitleaks` trong CI = 0 phát hiện |
| NF-3 Hiệu năng | Trang chính tải < 2 giây trên mạng cơ quan | Lighthouse Performance ≥ 85 |
| NF-4 Responsive | Dùng được trên màn hình 360px | Playwright chạy ở 3 kích thước |
| NF-5 Truy cập | Tương phản chữ ≥ 4.5:1, điều hướng bàn phím | Lighthouse Accessibility ≥ 90 |
| NF-6 Vận hành | Có backup hằng đêm, đã khôi phục thử | Biên bản khôi phục trong `docs/` |
| NF-7 Chất lượng | Không file > 300 dòng; lint sạch | CI |
| NF-8 Ngôn ngữ | 100% giao diện tiếng Việt có dấu | Review |

---

## 5. Mô hình dữ liệu (đích)

Giữ 5 bảng hiện có, thay đổi:
- `accounts`: bỏ `password`, `assigned_domain`; `id` = `auth.users.id`; thêm `must_change_password boolean default true`.
  - **Quy ước bắt buộc (từ migration `0002`):** quyền đọc/ghi cột trên `accounts` cho `anon`/`authenticated` cấp theo **cột tường minh** (`GRANT SELECT (danh sách cột)`), không cấp theo bảng. Mọi cột mới thêm vào `accounts` mặc định **không** lộ ra cho tới khi được liệt kê tường minh trong `GRANT`. Tuyệt đối không chạy lại `GRANT ALL`/`GRANT SELECT` không giới hạn cột trên bảng `accounts` — làm vậy sẽ vô hiệu hoá toàn bộ việc chặn `password` của GĐ1.
- `tasks`: bỏ `owner_id` (mồ côi); default `status = 'CHUA_GIAO'` (đã sửa ở migration `0003`). FK `task_directives.task_id` / `task_evidences.task_id` → `tasks.id` (`ON DELETE CASCADE`) đã có sẵn từ baseline `0001`, không cần thêm.
- `task_directives`: bỏ `recipient_id`, `is_read`, `read_at`.
- Thêm `task_directive_reads`, `task_status_log`.
- View `view_exception_dashboard` giữ, thêm `owner_department` (đã có).

Sơ đồ:
```
accounts ─┬─< tasks.assigned_to
          ├─< tasks.leader_in_charge
          ├─< tasks.created_by
          └─< accounts.manager_id (tự tham chiếu)
tasks ────┬─< task_directives ──< task_directive_reads
          ├─< task_evidences
          └─< task_status_log
accounts ─< direct_messages (sender/receiver)
```

---

## 6. Kiến trúc và thư mục đích

```
vptu-mvp-task/
├── CLAUDE.md
├── docs/  SPEC.md · DESIGN.md · PROMPTS.md · kien-truc.md · xu-ly-su-co.md
├── frontend/  index.html · src/{main.js, lib/, auth/, views/{a1,a2,a3}/, features/, components/, styles/} · vite.config.js · .env.example
├── supabase/  config.toml · migrations/ · seed.sql
├── tests/  e2e/ · rls/
├── .github/workflows/  ci.yml · deploy-staging.yml · deploy-prod.yml
├── scripts/  backup-db.sh · restore-db.sh
└── mockup/  index.html  (bản mẫu giao diện, tham chiếu)
```

---

## 7. Lộ trình theo giai đoạn (mỗi giai đoạn = 1 PR hoặc vài PR nhỏ)

| GĐ | Tên | Yêu cầu bao gồm | Điều kiện xong |
|---|---|---|---|
| 0 | Khởi tạo | Cấu trúc thư mục, CLAUDE.md, migration 0001 dump schema hiện tại, CI lint | CI xanh trên PR đầu tiên |
| 1 | Chặn rò rỉ khẩn cấp | RLS-1 tạm (chỉ authenticated), view `accounts_public` | Supabase không còn chữ UNRESTRICTED |
| 2 | Supabase Auth | AUTH-1…5, migration chuyển 49 tài khoản | 3 vai trò đăng nhập được trên staging |
| 3 | RLS đầy đủ | RLS-2…8, `tests/rls/` | Test RLS pass |
| 4 | Tách frontend | Vite, module hoá, giữ nguyên nghiệp vụ (TASK, DIR, MSG, DASH) | Playwright e2e pass; không thay đổi hành vi |
| 5 | Giao diện mới | DESIGN.md áp dụng toàn bộ | Duyệt bằng mắt trên staging + Lighthouse |
| 6 | CI/CD + staging | Workflows, tag phiên bản, migrations tự động | Một PR đi hết pipeline |
| 7 | Vận hành | Backup, uptime monitor, docs xử lý sự cố | Biên bản khôi phục thử |

---

## 8. Tiêu chí nghiệm thu chung

Một giai đoạn được coi là xong khi:
1. Mọi yêu cầu có mã trong giai đoạn đó có test hoặc bằng chứng kiểm tra.
2. `/code-review` không còn cảnh báo mức cao.
3. PR đã được chủ dự án duyệt trên GitHub.
4. `CHANGELOG.md` có mục mới, tối đa 6 dòng.

---

## 9. Quyết định đã chốt (không mở lại)

- Không dùng React/Vue ở v2.0. Lý do: giữ được phần lớn code JS hiện có.
- Không self-host Supabase ở v2.0. Lý do: chưa có yêu cầu dữ liệu nội bộ bằng văn bản.
- Email đăng nhập dạng `username@vptu.caobang.local` không gửi mail thật. Lý do: cơ quan chưa có email nội bộ cho toàn bộ cán bộ.

## 10. Câu hỏi mở (cần chủ dự án trả lời trước GĐ tương ứng)

| # | Câu hỏi | Cần trước GĐ |
|---|---|---|
| Q1 | Dữ liệu nhiệm vụ hiện tại trên production có cần giữ, hay bắt đầu sạch khi lên v2? — **Đã trả lời (2026-09-13): xoá sạch khi lên v2** (chỉ giữ 49 tài khoản; bước xoá làm riêng, không thuộc GĐ2). | 2 |
| Q2 | Ai là người duyệt PR lên production (tên GitHub)? | 6 |
| Q3 | Gói Supabase đang dùng (Free/Pro)? Quyết định cách backup. | 7 |
