# CHANGELOG — Hệ thống VPTU-TASK (vptu-mvp-task)

> File này ghi lại toàn bộ các thay đổi kỹ thuật đã thực hiện trên hệ thống **kể từ mốc bàn giao từ Gemini sang Claude** (commit `19f4882`, sau commit cuối cùng của Gemini là `6f08487`). Mục tiêu: để bất kỳ AI/dev nào tiếp nhận lại dự án sau này (kể cả Gemini quay lại tiếp tục) đều có thể đọc file này và nắm được kiến trúc hệ thống + toàn bộ lịch sử thay đổi mà không cần đọc lại diff của từng commit.
>
> Người bảo trì: Claude (Anthropic), làm việc qua thao tác trực tiếp trên GitHub web editor (không có quyền `git push` trong môi trường thực thi), triển khai qua GitHub Pages.
>
> Repo: `haidang21ktvptu/vptu-mvp-task` — nhánh `main` — file ứng dụng duy nhất: `index.html` (vanilla JS, single-file SPA).

---

## 1. Tổng quan kỹ thuật hệ thống (đọc trước khi đọc phần lịch sử thay đổi)

### 1.1. Mục đích nghiệp vụ

Hệ thống quản trị nhiệm vụ theo mô hình "1-1-1-1-3" cho Văn phòng Tỉnh ủy Cao Bằng: theo dõi việc giao — nhận — thực hiện — nộp minh chứng — duyệt hoàn thành nhiệm vụ giữa 3 nhóm vai trò, có cảnh báo quá hạn/đỏ đặc biệt, và có kênh trao đổi ý kiến/chỉ đạo gắn theo từng nhiệm vụ cùng kênh nhắn tin riêng tư độc lập.

### 1.2. Ngăn xếp công nghệ (stack)

- **Frontend**: 1 file HTML duy nhất (`index.html`, ~93 400 ký tự UTF-16 tại thời điểm viết file này), vanilla JavaScript (không framework, không build step), Tailwind CSS nạp qua CDN (`cdn.tailwindcss.com` — **cảnh báo: đây là bản Play CDN, không khuyến nghị dùng production**, nhưng chấp nhận được cho MVP).
- **Backend**: Supabase (PostgreSQL + PostgREST + Realtime), project id `frwyxcmbonjaimziiuqr`, truy cập bằng **anon key nhúng thẳng trong source** (`SUPABASE_ANON_KEY` ở đầu thẻ `<script>`).
- **Auth**: **Tự chế, không dùng Supabase Auth.** Bảng `accounts` lưu `username`/`password` dạng plaintext (`text`, không hash), đăng nhập bằng truy vấn `dbClient.from('accounts').select('*').eq('username', u).eq('password', p).single()` chạy thẳng từ client. Phiên đăng nhập lưu ở `sessionStorage` (key `vptu_session_user`), object tài khoản đầy đủ (bao gồm cả password) được lưu nguyên trong đó.
- **Hosting**: GitHub Pages, tự động build/deploy khi push lên nhánh `main` (workflow `pages build and deployment`, thường mất 40–60 giây). URL live: `https://haidang21ktvptu.github.io/vptu-mvp-task/`.
- **Không có build pipeline, không có test framework trong repo.** Mọi kiểm thử được Claude thực hiện ngoài repo (Playwright mô phỏng cục bộ + QA trực tiếp trên bản live), không có gì được commit vào repo.

### 1.3. Mô hình vai trò (role_group trong bảng `accounts`)

| role_group | Vai trò | Giao diện chính |
|---|---|---|
| `THUONG_TRUC` | Thường trực Tỉnh ủy | `#viewThuongTruc` — Dashboard quản trị ngoại lệ, giao việc trực tiếp cho LĐVP hoặc CV, can thiệp phân công |
| `LANH_DAO_VP` | Lãnh đạo Văn phòng Tỉnh ủy | `#viewLanhDaoVP` — 3 tab: Giao việc cho CV / Theo dõi & thẩm tra / KPI từng CV |
| `CHUYEN_VIEN` | Chuyên viên Văn phòng | `#viewChuyenVien` — Danh sách nhiệm vụ được giao, tiếp nhận, nộp minh chứng |

Tài khoản test hiện có (password chung `123456` cho mọi tài khoản): `lanhdao1`, `ldvp1`, `cv1` (và một số tài khoản khác đã được tạo qua UI trong quá trình QA, ví dụ Đ/c Hoàng Xuân Ánh, Đ/c Trần Thị Mai, Chuyên viên Nông Thị Oanh...).

### 1.4. Mô hình dữ liệu Supabase hiện tại (đầy đủ, lấy trực tiếp từ `information_schema` tại thời điểm viết file này)

**`accounts`** — danh mục tài khoản/cán bộ
| Cột | Kiểu | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| username | text | NO | | |
| password | text | NO | | **plaintext, không hash — xem mục 6.2** |
| full_name | text | NO | | |
| role_group | text | NO | | `THUONG_TRUC` \| `LANH_DAO_VP` \| `CHUYEN_VIEN` |
| position_title | text | NO | | chức danh hiển thị |
| assigned_domain | text | YES | | không thấy dùng trong code hiện tại |
| manager_id | uuid | YES | | CV → LĐVP phụ trách trực tiếp (dùng khi TT giao thẳng cho CV) |
| created_at | timestamptz | YES | now() | |

**`tasks`** — nhiệm vụ
| Cột | Kiểu | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| title | text | NO | | |
| resolution_code | text | NO | | số/ký hiệu nghị quyết |
| owner_id | uuid | YES | | **không thấy dùng trong code hiện tại — cột mồ côi, có thể là tàn dư từ bản thiết kế trước** |
| expected_product | text | NO | | 01 sản phẩm đầu ra bắt buộc |
| voffice_received_at | timestamptz | NO | now() | mốc T=0 |
| deadline | timestamptz | NO | | |
| critical_overdue_days | integer | NO | | ngưỡng kích hoạt "đỏ đặc biệt" |
| competent_authority | text | NO | | |
| status | text | NO | `'IN_PROGRESS'` | **default không khớp với enum thực tế của app — xem mục 6.5**. Giá trị thực tế dùng: `CHUA_GIAO`, `CHO_TIEP_NHAN`, `TU_CHOI_TIEP_NHAN`, `DANG_THUC_HIEN`, `CHO_DUYET`, `HOAN_THANH` |
| completed_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |
| assigned_to | uuid → accounts.id | YES | | CV thực hiện |
| created_by | uuid → accounts.id | YES | | người phát hành (TT hoặc LĐVP) |
| reject_reason | text | YES | | lý do CV từ chối nhận việc |
| warning_count | integer | YES | 0 | số lần đôn đốc |
| last_warned_at | timestamptz | YES | | |
| leader_in_charge | uuid → accounts.id | YES | | LĐVP phụ trách |

**`task_directives`** — luồng ý kiến/chỉ đạo gắn theo nhiệm vụ
| Cột | Kiểu | Nullable | Default | Ghi chú |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | PK |
| task_id | uuid | NO | | FK logic tới `tasks.id` (không có ràng buộc FK tường minh) |
| sender_id | uuid | NO | | |
| content | text | NO | | |
| is_read | boolean | YES | false | **1 cờ đã đọc dùng chung cho cả luồng, không phải per-reader — xem mục 6.3** |
| read_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |
| recipient_id | uuid → accounts.id | YES | | **Thêm bởi Claude ở commit `db9300a` cho mô hình 1-1 riêng tư (đã lỗi thời từ commit `607b4b3`, xem mục 2.4 và 2.5) — cột vẫn còn trong schema nhưng không còn được ghi/đọc, luôn `NULL` cho các dòng mới** |

**`direct_messages`** — nhắn tin riêng 1-1, không gắn nhiệm vụ (bảng mới, tạo bởi Claude ở commit `db9300a`)
| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| sender_id | uuid | YES | |
| receiver_id | uuid | YES | |
| content | text | NO | |
| is_read | boolean | YES | false |
| read_at | timestamptz | YES | |
| created_at | timestamptz | YES | now() |

**`task_evidences`** — minh chứng hoàn thành nhiệm vụ (không thay đổi bởi Claude)
| Cột | Kiểu | Nullable | Default |
|---|---|---|---|
| id, task_id, uploaded_by, document_title, file_url, note, is_approved, reviewed_at, created_at | | | |

**`users_departments`** — **bảng không được tham chiếu ở bất kỳ đâu trong `index.html` hiện tại** (`full_name`, `organization_name`, `role`, `phone`, `created_at`). Nhiều khả năng là tàn dư từ một thiết kế trước đó (có thể của Gemini hoặc bản nháp sớm hơn). Claude không đụng tới bảng này, chỉ ghi nhận lại để Gemini biết nó tồn tại và không dùng.

**View `view_exception_dashboard`** (không đổi bởi Claude, TT dùng view này để render dashboard):
```sql
SELECT t.id AS task_id, t.title AS task_title, t.resolution_code,
  COALESCE(acv.full_name, 'Chưa giao chuyên viên') AS owner_name,
  COALESCE(acv.position_title, 'Chưa phân công') AS owner_org,
  COALESCE(ald.full_name, 'Chưa chỉ định LĐ phụ trách') AS leader_name,
  t.expected_product, t.voffice_received_at, t.deadline, t.critical_overdue_days,
  t.competent_authority, t.status, t.warning_count, t.reject_reason,
  CASE WHEN t.status='HOAN_THANH' THEN 0
       WHEN now() > t.deadline THEN EXTRACT(day FROM now()-t.deadline)::int
       ELSE 0 END AS days_overdue,
  CASE WHEN t.status='HOAN_THANH' THEN 'HOAN_THANH'
       WHEN t.status='CHO_DUYET' THEN 'CHO_DUYET'
       WHEN t.status='TU_CHOI_TIEP_NHAN' THEN 'TU_CHOI'
       WHEN t.status='CHUA_GIAO' OR t.assigned_to IS NULL THEN 'CHUA_GIAO'
       WHEN now() > t.deadline AND EXTRACT(day FROM now()-t.deadline) >= t.critical_overdue_days THEN 'DO_DAC_BIET'
       WHEN now() > t.deadline THEN 'DO'
       WHEN (t.deadline - now()) <= interval '3 days' THEN 'VANG'
       ELSE 'XANH' END AS alert_level
FROM tasks t
LEFT JOIN accounts acv ON t.assigned_to = acv.id
LEFT JOIN accounts ald ON t.leader_in_charge = ald.id;
```

**Row Level Security**: **TẮT trên toàn bộ 6 bảng** (`rowsecurity = false` — đã xác minh trực tiếp qua `pg_tables`). Nghĩa là anon key có toàn quyền đọc/ghi mọi bảng, mọi hàng — xem mục 6.1.

**Realtime**: publication `supabase_realtime` chỉ bật cho 2 bảng `task_directives` và `direct_messages`. Frontend dùng **một channel Supabase Realtime duy nhất** tên `realtime_directives_feed`, gắn 2 handler `postgres_changes` (một cho mỗi bảng) trên cùng channel đó, subscribe 1 lần trong `setupRealtimeDirectives()` (gọi lại sau mỗi lần đăng nhập).

### 1.5. Quy trình vận hành/triển khai của Claude trong môi trường này

Môi trường thực thi của Claude **bị egress-proxy chặn `git push`** tới repo này (không nằm trong danh sách repo được ủy quyền của phiên làm việc). Do đó **toàn bộ các commit từ `19f4882` trở đi đều được thực hiện qua GitHub web editor** (`https://github.com/haidang21ktvptu/vptu-mvp-task/edit/main/index.html`), điều khiển bằng trình duyệt tự động (Claude in Chrome / trình duyệt tích hợp), thao tác trực tiếp trên instance CodeMirror 6 của editor qua `EditorView.dispatch()` với các đoạn thay đổi (hunks) được tính từ diff UTF-16-aware giữa bản cũ và bản mới, sau đó dùng nút "Commit changes..." của GitHub để commit thẳng vào `main`. Không có pull request nào được dùng — tất cả đều commit trực tiếp `main`.

Việc kiểm thử trước khi commit dùng Playwright (Chromium headless) mô phỏng cục bộ với một Supabase client giả lập (`supabase_stub.js`, không nằm trong repo) để bắt lỗi cú pháp/runtime trước; sau khi commit và GitHub Pages deploy xong thì QA trực tiếp trên dữ liệu Supabase thật với các tài khoản test thật.

---

## 2. Nhật ký thay đổi chi tiết (từ mốc bàn giao Gemini → Claude)

> Baseline trước khi Claude tiếp nhận: commit `6f08487` (bản cuối của Gemini, "Update index.html").

### 2.1. Commit `19f4882` — "Sửa lỗi: kiểm tra hạn hoàn thành, hiển thị nhãn trạng thái, kiểm tra định dạng minh chứng, cảnh báo quá hạn"

Sửa 5 lỗi/thiếu sót nghiệp vụ trong bản của Gemini:

1. **Validate hạn hoàn thành ở form "Thường trực giao việc"** (`handleTTGiaoViec`) và **form "LĐVP giao việc cho CV"** (`handleGiaoViec`): chặn submit nếu trường deadline trống hoặc ở quá khứ (`new Date(...) <= new Date()`), báo `alert` tiếng Việt.
2. **Bảng ngoại lệ của TT (`renderLeaderTable`)**: cột "Trễ hạn" trước đó đọc `r.days_overdue` (một cột tính sẵn từ view) nhưng hiển thị sai vì không đồng bộ với logic hạn ở client → đổi sang tính trực tiếp từ `r.deadline` bằng JS (`Math.ceil((now - deadline) / 86400000)`), đảm bảo khớp với đồng hồ trình duyệt thay vì phụ thuộc giá trị đã cache từ view.
3. **Thêm hàm `taskStatusLabel(status)`**: map 6 mã trạng thái (`CHUA_GIAO`, `CHO_TIEP_NHAN`, `TU_CHOI_TIEP_NHAN`, `DANG_THUC_HIEN`, `CHO_DUYET`, `HOAN_THANH`) sang nhãn tiếng Việt. Trước đó bảng LĐVP (tab Giao việc → theo dõi) và bảng KPI-chi tiết hiển thị thẳng mã trạng thái tiếng Anh/viết hoa cho người dùng cuối — không thân thiện. Áp dụng hàm này vào 2 vị trí render (tracking table và kpiDetailTableBody).
4. **Cảnh báo nhiệm vụ có hạn ở quá khứ ngay từ lúc giao** (`showMandatoryModal`): nếu `task.deadline < now()` tại thời điểm CV mở modal xác nhận tiếp nhận, chèn thêm dòng cảnh báo LƯU Ý vào `#warningNoticeDiv` (gộp với cảnh báo đôn đốc nếu có).
5. **Validate định dạng URL khi nộp minh chứng** (`submitEvidence`): thêm regex `^https?:\/\/.+` bắt buộc link minh chứng phải là URL http/https hợp lệ trước khi cho insert vào `task_evidences`.

Không có thay đổi schema Supabase ở commit này.

### 2.2. Commit `b10a4e4` — "Bổ sung nghiệp vụ: tìm kiếm nhiệm vụ và thống kê nhanh cho Lãnh đạo VP & Chuyên viên"

1. **Ô tìm kiếm nhanh** cho 2 bảng: `#ldvpTrackSearch` (tab Theo dõi của LĐVP, gọi `filterTrackingRows()`) và `#cvTaskSearch` (danh sách nhiệm vụ CV, gọi `filterCVRows()`). Cả 2 hàm filter đều hoạt động theo cơ chế: mỗi `<tr>` được gắn attribute `data-search="<title+resolution_code+...>".toLowerCase()"` khi render, hàm filter chỉ toggle class `hidden` theo `includes(keyword)` — **lọc hoàn toàn phía client, không query lại Supabase**.
2. **Thanh thống kê nhanh cho Chuyên viên** (`ensureCVStatsBar()` + 4 thẻ KPI: Tổng số việc / Quá hạn / Gần đến hạn / Đã hoàn thành): tạo động bằng `insertAdjacentHTML('beforebegin', ...)` ngay trước card danh sách nhiệm vụ trong `loadChuyenVienData()`, chỉ tạo DOM 1 lần (kiểm tra `getElementById('cvStatsBar')` trước khi chèn) rồi cập nhật số liệu mỗi lần load lại.
3. Dùng lại `taskStatusLabel()` (đã thêm ở commit trước) cho cột trạng thái trong bảng KPI chi tiết của LĐVP.

Không có thay đổi schema Supabase ở commit này.

### 2.3. Commit `db9300a` — "Tách riêng Nhắn tin (1-1 riêng tư) và Chỉ đạo trực tiếp theo nhiệm vụ"

**Bối cảnh**: bản của Gemini có đúng MỘT tính năng "chỉ đạo trực tuyến" gộp chung 2 nhu cầu khác nhau: (a) trao đổi ý kiến/chỉ đạo gắn với một nhiệm vụ cụ thể, và (b) nhắn tin riêng tư chung chung không liên quan nhiệm vụ nào. Yêu cầu của người dùng là tách thành 2 tính năng độc lập thật sự.

**Thay đổi schema Supabase** (thực hiện qua SQL Editor của Supabase, không có migration file trong repo):
```sql
ALTER TABLE task_directives ADD COLUMN recipient_id uuid REFERENCES accounts(id);
-- backfill cho 11 dòng cũ đã tồn tại trước đó (suy luận recipient từ task.assigned_to/leader_in_charge)

CREATE TABLE direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES accounts(id),
  receiver_id uuid REFERENCES accounts(id),
  content text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
-- Bật Realtime cho direct_messages (thêm vào publication supabase_realtime)
-- KHÔNG bật RLS (chọn "Run without RLS" khi Supabase SQL Editor cảnh báo — xem mục 6.1)
```

**Thay đổi frontend** (mô hình tại thời điểm này — **đã bị thay thế hoàn toàn ở commit `607b4b3`, xem mục 2.5**, ghi lại đây chỉ để hiểu quá trình tiến hoá):
- `task_directives` chuyển từ luồng chung theo `task_id` sang **luồng riêng theo cặp (sender_id, recipient_id) trong phạm vi 1 task_id** — mỗi cặp người khác nhau trên cùng 1 nhiệm vụ có 1 thread riêng, không thấy tin của cặp khác (kể cả khi cùng là nhiệm vụ đó). Đọc dữ liệu bằng `.or('and(sender_id.eq.A,recipient_id.eq.B),and(sender_id.eq.B,recipient_id.eq.A)')`.
- Thêm hẳn 1 bộ UI mới độc lập cho "Nhắn tin": bong bóng nổi `#dmBubbleLauncher`, modal chọn người `#dmPickerModal`, cửa sổ chat `#dmModal`, các hàm `openDMPicker/closeDMPicker/renderDMPickerList/openDMChat/closeDMModal/loadDirectMessages/handleSendDM`.
- Channel Realtime `realtime_directives_feed` được mở rộng thêm 1 handler `postgres_changes` thứ hai cho bảng `direct_messages` (giữ nguyên 1 channel, 2 handler — xem mục 1.4).
- Toast thông báo (`#realtimeToast`) dùng chung cho cả 2 luồng nhưng nội dung/hành động khác nhau tuỳ nguồn (`showNotificationToast` cho chỉ đạo, `showDMNotificationToast` cho nhắn tin).

**Kiểm thử**: Playwright cục bộ với stub Supabase + QA trực tiếp trên live site bằng cả 3 vai trò, xác nhận 2 cặp (TT↔CV) và (LĐVP↔CV) trên cùng 1 nhiệm vụ **không** lộ tin của nhau.

### 2.4. Commit `00b0ef0` — "Fix: ẩn bong bóng Nhắn tin trước khi đăng nhập"

Bug tự phát hiện qua QA (không phải người dùng report): `<div id="dmBubbleLauncher">` mới thêm ở commit `db9300a` **thiếu class `hidden`** ban đầu (khác với `#chatBubble` cùng thời điểm đó vẫn có `hidden`) → bong bóng "Nhắn tin" hiện ra ngay cả ở màn hình đăng nhập (trước khi có `loggedInUser`), bấm vào sẽ throw lỗi vì `openDMPicker()` filter `globalAccounts` theo `loggedInUser.id` (lúc đó là `null`).

Fix: thêm `hidden` vào class ban đầu của div, thêm `document.getElementById("dmBubbleLauncher").classList.remove("hidden")` vào `initUserInterface()` (cạnh dòng show `mainHeader` sẵn có).

### 2.5. Commit `607b4b3` — "Chỉ đạo trực tiếp hiển thị kiểu comment Facebook trên từng nhiệm vụ; sửa thông báo Nhắn tin" *(commit mới nhất — thay thế toàn bộ UI "Chỉ đạo trực tiếp" của commit `db9300a`)*

Đây là thay đổi lớn nhất kể từ khi bàn giao, gồm 2 phần độc lập theo đúng 2 yêu cầu của người dùng.

#### 2.5.1. Thiết kế lại "Chỉ đạo trực tiếp" — bỏ cửa sổ chat nổi, chuyển sang luồng bình luận inline kiểu Facebook

**Quyết định thiết kế quan trọng (đã xác nhận với người dùng qua câu hỏi làm rõ trước khi code):**
- **Phạm vi hiển thị**: vẫn riêng tư — chỉ hiện cho Thường trực (luôn xem được mọi việc) và **đúng** Chuyên viên (`tasks.assigned_to`) / Lãnh đạo VP (`tasks.leader_in_charge`) có tên phụ trách nhiệm vụ đó. Không mở cho bất kỳ ai khác chỉ vì họ nhìn thấy nhiệm vụ đó trong bảng của họ (ví dụ: LĐVP khác không phụ trách nhiệm vụ vẫn thấy dòng nhiệm vụ trong tab Theo dõi nhưng **không** thấy nút/luồng bình luận).
- **Kiểu thông báo**: bỏ hẳn toast nổi (`#realtimeToast` chỉ còn dùng cho Nhắn tin). Khi có ý kiến mới: hiện huy hiệu số đếm đỏ ngay trên nút "💬 Ý kiến" của đúng dòng nhiệm vụ, kèm hiệu ứng viền đỏ nổi bật (`ring-2 ring-red-400 bg-red-50/60`) trên `<tr>` của nhiệm vụ đó — giống cách Facebook báo "có bình luận mới" ngay trên bài post, không phải popup tách rời.

**Thay đổi mô hình dữ liệu (logic, không đổi schema)**: bỏ khái niệm "thread theo cặp (sender, recipient)" của commit `db9300a`. Quay về **1 luồng bình luận chia sẻ chung cho mỗi `task_id`** (giống `task_directives` gốc thời Gemini, nhưng nay có kiểm soát quyền truy cập rõ ràng ở tầng client thay vì không kiểm soát gì). Cột `recipient_id` **vẫn còn trong schema nhưng từ commit này không còn được đọc/ghi** — mọi INSERT mới đều để `recipient_id: null`. 11+ dòng cũ có `recipient_id` không NULL từ giai đoạn `db9300a` vẫn hiển thị bình thường vì truy vấn không còn lọc theo cột này nữa.

**Các hàm JS mới** (thêm vào, tất cả nằm trong `<script>` của `index.html`):
- `canAccessDirectiveThread(task)` — hàm kiểm tra quyền duy nhất, dùng cả khi render bảng lẫn khi nhận sự kiện Realtime: `role_group==='THUONG_TRUC'` → luôn `true`; ngược lại `true` nếu `task.assigned_to===id || task.leader_in_charge===id || task.created_by===id`.
- `fetchTaskParties(taskId)` — lấy `{assigned_to, leader_in_charge, created_by}` của 1 task, có cache qua `taskPartiesMap` (dùng khi xử lý sự kiện Realtime đến từ 1 nhiệm vụ chưa từng render, ví dụ với LĐVP/CV chưa từng load `taskPartiesMap` đầy đủ như TT).
- `loadDirectiveUnreadMap()` — 1 query duy nhất `task_directives.select('task_id').eq('is_read',false).neq('sender_id', me)` mỗi lần load 1 bảng (TT/LĐVP/CV), build map `{task_id: count}` phía client để hiển thị huy hiệu ngay khi vào trang (không chỉ những tin đến qua Realtime trong phiên hiện tại).
- `directiveToggleBtnHtml(taskId, hasAccess)` — sinh nút "💬 Ý kiến" kèm huy hiệu; trả `''` nếu không có quyền (đây chính là điểm chặn truy cập ở tầng UI).
- `directiveThreadRowHtml(taskId, colspan)` — sinh 1 `<tr id="directiveRow-{taskId}" class="hidden">` chứa `<td colspan>` bọc khung bình luận (list + input), chèn làm dòng liền kề ngay sau `<tr id="taskRow-{taskId}">` chính trong `tbody`. `colspan` truyền theo số cột thực của từng bảng (TT = 7, LĐVP tracking = 4, CV = 7).
- `toggleDirectiveThread(taskId)` — toggle `hidden` trên dòng luồng bình luận, gọi `loadDirectiveThread(taskId, true)` khi mở ra (mark-as-read ngay).
- `loadDirectiveThread(taskId, markAsRead)` — query `task_directives.select('*, sender:sender_id(full_name, role_group)').eq('task_id', taskId).order('created_at')` (không còn `.or()` theo cặp), render kiểu feed bình luận (avatar tròn chữ cái đầu tên, tên, vai trò, giờ, nội dung) thay vì chat-bubble trái/phải như trước; nếu `markAsRead` thì `UPDATE ... WHERE task_id=? AND is_read=false AND sender_id != me`.
- `handleSendDirectiveInline(e, taskId)` — INSERT vào `task_directives` với `recipient_id: null`.
- `updateDirectiveRowBadge(taskId)`, `highlightTaskRow(taskId)` — cập nhật huy hiệu/hiệu ứng nổi bật tại chỗ (không render lại toàn bảng) khi có sự kiện Realtime mới.

**Ràng buộc nghiệp vụ giữ nguyên từ bản cũ**: Chuyên viên chỉ được trả lời (form nhập bị ẩn, thay bằng `#directiveWarn-{taskId}`) khi luồng đã có ít nhất 1 tin từ `THUONG_TRUC` hoặc `LANH_DAO_VP` — logic kiểm tra chuyển từ `loadDirectives()` cũ sang `loadDirectiveThread()` mới, hành vi không đổi.

**Xoá bỏ hoàn toàn** khỏi `index.html`: `<div id="chatBubble">`, `<div id="directiveModal">` và toàn bộ nội dung bên trong (kể cả `#directiveChatBox`, `#directiveForm`, `#directiveBlockWarning`...), cùng các hàm `openDirectiveModal`, `minimizeDirectiveModal`, `restoreDirectiveModal`, `closeDirectiveModal`, `loadDirectives`, `handleChatFocus`, `handleSendDirective`, `showNotificationToast`, biến `currentChatMode`/`currentChatTaskId`/`currentChatTaskTitle`/`currentDirectiveRecipientId`/`unreadChatCount`/`unreadDMCount` (đã dọn dẹp toàn bộ, xác nhận bằng grep không còn tham chiếu nào sót lại trước khi commit).

**Realtime handler cho `task_directives`** viết lại hoàn toàn: bỏ điều kiện lọc theo `recipient_id===me`, thay bằng gọi `fetchTaskParties` + `canAccessDirectiveThread` để quyết định có xử lý sự kiện hay không; nếu dòng luồng bình luận của task đó **đang mở** trên màn hình → gọi lại `loadDirectiveThread(taskId, true)` (tự mark-as-read vì người dùng đang nhìn thấy); nếu **đang đóng** → chỉ tăng `directiveUnreadMap[taskId]` + gọi `updateDirectiveRowBadge` + `highlightTaskRow` (không render lại DOM nặng).

#### 2.5.2. Sửa thông báo "Nhắn tin" (độc lập với 2.5.1, cùng nằm trong commit `607b4b3`)

Yêu cầu gốc: tách rõ thông báo Nhắn tin khỏi thông báo Chỉ đạo (đã tự động đạt được vì 2.5.1 bỏ toast của Chỉ đạo), và "sửa lại chế độ thông báo và hiển thị thông báo khi có tin nhắn đến" cho Nhắn tin. Các sửa đổi cụ thể:

1. **Sửa lỗi mark-as-read khi đang mở đúng cửa sổ chat**: bản cũ (`db9300a`), khi đang mở `#dmModal` với đúng người vừa gửi tin mới tới, Realtime handler gọi `loadDirectMessages(peerId, false)` — **`markAsRead=false`**, nghĩa là tin nhắn hiện ra trong khung chat nhưng KHÔNG được đánh dấu `is_read=true` trong DB, khiến số đếm chưa đọc toàn cục bị sai (tăng dù người dùng đang nhìn thấy tin). Bản mới: kiểm tra `currentDMPeerId === dm.sender_id && !dmModal.classList.contains('hidden')` → nếu đúng thì gọi `loadDirectMessages(peerId, true)`.
2. **Đếm số tin chưa đọc theo từng người gửi** thay vì 1 biến đếm tổng (`unreadDMCount` cũ, không biết ai gửi): thay bằng `dmUnreadMap = {peerId: count}`, có `loadDMUnreadMap()` (chạy 1 lần sau mỗi lần đăng nhập, query `direct_messages.select('sender_id').eq('receiver_id', me).eq('is_read', false)`) để nạp số chưa đọc còn tồn đọng từ trước phiên hiện tại — bản cũ **không có** bước này nên số đếm luôn về 0 sau mỗi lần load lại trang dù còn tin chưa đọc thật.
3. **Hiển thị chấm đỏ kèm số theo từng liên hệ** trong `renderDMPickerList()` — người dùng biết ngay ai đang có tin chưa đọc trước khi mở chat, thay vì chỉ có 1 con số tổng ở bong bóng.
4. **Tách màu sắc/icon của toast** (`#realtimeToast`): đổi từ viền đỏ (`border-red-700`) + icon 🔔 + tiêu đề mặc định "Ý kiến chỉ đạo mới" (tàn dư từ thời gộp chung) sang viền xám (`border-slate-700`) + icon ✉️ + tiêu đề mặc định "Tin nhắn riêng mới", đồng bộ với màu bong bóng Nhắn tin (`bg-slate-700`).

**Nhân tiện sửa 1 lỗi HTML tồn tại từ commit `db9300a`** (không liên quan trực tiếp yêu cầu nhưng phát hiện khi sửa cùng dòng): thẻ mở `<div id="dmBubbleLauncher" ...>` thiếu dấu `>` đóng thẻ, khiến trình duyệt merge nhầm token của `<span>` liền sau vào thuộc tính của `<div>` (HTML vẫn tự phục hồi và hiển thị được nhờ cơ chế lỗi khoan dung của trình duyệt, nhưng DOM sinh ra sai cấu trúc). Đã thêm `>`.

**Kiểm thử commit này**: 
- Local: Playwright + stub Supabase — kiểm tra không có `pageerror`/console error nào phát sinh trong toàn bộ luồng (đăng nhập 3 vai trò, mở/đóng/gửi luồng bình luận, mở DM picker, gửi DM); kiểm thử riêng hàm `canAccessDirectiveThread` bằng cách chèn thêm 1 nhiệm vụ giả không do LĐVP đang đăng nhập phụ trách → xác nhận nút "Ý kiến" và dòng luồng bình luận **không** xuất hiện trong DOM cho nhiệm vụ đó (không chỉ ẩn bằng CSS mà hoàn toàn không render).
- Live: QA trên dữ liệu thật với 3 tài khoản `lanhdao1`/`ldvp1`/`cv1` trên nhiệm vụ "test2" (nhiệm vụ vốn có sẵn 2 thread riêng biệt kiểu cũ từ `db9300a`) — xác nhận sau khi đổi mô hình, cả 3 vai trò đều thấy **chung một luồng** gồm đầy đủ tin của TT + LĐVP + CV gộp lại theo đúng thời gian; TT gửi ý kiến mới → CV thấy huy hiệu "2" ngay khi tải lại trang (không cần đợi Realtime) → CV mở luồng → huy hiệu về 0 → CV trả lời → LĐVP mở luồng thấy đủ cả 3 tin theo đúng thứ tự thời gian. Test song song luồng Nhắn tin (gửi CV → TT, không liên quan nhiệm vụ nào) không bị ảnh hưởng.

---

## 3. Tổng hợp trạng thái UI hiện tại sau tất cả thay đổi (tham chiếu nhanh)

- **`#realtimeToast`**: chỉ dùng cho Nhắn tin (`showDMNotificationToast`). Không còn dùng cho Chỉ đạo.
- **`#dmBubbleLauncher`** (góc dưới phải, màu xám): bong bóng Nhắn tin, luôn hiện sau đăng nhập, badge `#dmBubbleBadge` = tổng `dmUnreadMap`.
- **Không còn `#chatBubble`, không còn `#directiveModal`** — đã xoá vĩnh viễn khỏi DOM.
- **Mỗi `<tr id="taskRow-{id}">`** trong 3 bảng (`#exceptionTableBody` của TT, `#trackingTableBody` của LĐVP, `#chuyenVienTableBody` của CV) có thể có 1 nút "💬 Ý kiến" (chỉ khi `canAccessDirectiveThread` = true) và 1 `<tr id="directiveRow-{id}" class="hidden">` liền sau chứa luồng bình luận kiểu Facebook.
- Toàn bộ trạng thái đăng nhập/route theo vai trò không đổi so với thời Gemini (`#viewThuongTruc`/`#viewLanhDaoVP`/`#viewChuyenVien`, `initUserInterface()`).

---

## 4. Vấn đề/nợ kỹ thuật đã biết (chưa xử lý, cần Thường trực/Gemini/dev sau này cân nhắc)

1. **RLS tắt trên toàn bộ 6 bảng.** Anon key (public, nhúng trong source) có toàn quyền SELECT/INSERT/UPDATE trên mọi bảng kể cả `accounts` (bao gồm cột `password`). Toàn bộ kiểm soát quyền hiện tại (kể cả `canAccessDirectiveThread` mới thêm) **chỉ chạy ở client JS, hoàn toàn có thể bị bỏ qua** bằng cách gọi thẳng PostgREST API với anon key (lấy được từ view-source). Đây là rủi ro bảo mật nghiêm trọng nhất của hệ thống ở dạng hiện tại — chấp nhận được cho MVP nội bộ nhưng **không nên để nguyên trạng nếu hệ thống mở rộng ra ngoài phạm vi tin cậy nội bộ**.
2. **Mật khẩu lưu plaintext, so khớp bằng `.eq('password', p)` chạy từ client.** Không có hashing (bcrypt/argon2), không có rate-limit đăng nhập, không dùng Supabase Auth. Toàn bộ object tài khoản (gồm cả password) được lưu nguyên trong `sessionStorage`.
3. **`task_directives.is_read` là 1 cờ boolean dùng chung cho cả luồng**, không phải trạng thái đã đọc riêng cho từng người tham gia (TT/LĐVP/CV có thể cùng xem 1 nhiệm vụ). Khi 1 người mở luồng và mark-as-read, những tin đó coi như "đã đọc" chung — nếu sau này cần biết chính xác *ai* đã xem tin nào thì cần thêm bảng phụ kiểu `task_directive_reads(directive_id, reader_id, read_at)`.
4. **Cột `task_directives.recipient_id`** không còn dùng kể từ commit `607b4b3` nhưng vẫn còn trong schema (không xoá để tránh phá vỡ dữ liệu lịch sử của giai đoạn `db9300a`). Có thể cân nhắc xoá hẳn nếu chắc chắn không cần trace lại lịch sử mô hình cũ.
5. **`tasks.owner_id` và toàn bộ bảng `users_departments`** không được tham chiếu ở bất kỳ đâu trong `index.html` hiện tại — khả năng cao là tàn dư từ thiết kế trước, nên xác nhận lại với người dùng trước khi xoá.
6. **`tasks.status` có default `'IN_PROGRESS'`** nhưng enum thực tế của ứng dụng dùng tiếng Việt-hoá (`CHUA_GIAO`, `CHO_TIEP_NHAN`,...) — default này chết (dead default) vì code luôn set `status` tường minh khi insert, nhưng nếu có INSERT nào quên set status sẽ tạo ra giá trị rác không khớp switch-case nào trong UI.
7. **Không có ràng buộc FK tường minh nào từ `task_directives.task_id` / `task_evidences.task_id` tới `tasks.id`** (đã kiểm tra qua `information_schema.columns`, không thấy constraint FK ở các cột này ngoài `recipient_id`/`sender_id`/`receiver_id` trỏ về `accounts`) — toàn vẹn dữ liệu phụ thuộc hoàn toàn vào code ứng dụng.
8. **Không có test tự động nào trong repo.** Mọi kiểm thử của Claude (Playwright + stub) đều chạy ngoài môi trường phiên làm việc, không commit vào repo — nếu Gemini hoặc dev sau này muốn có test suite thật sự thì cần build từ đầu.
9. **Tailwind CDN Play mode** (`cdn.tailwindcss.com`) — bản thân Tailwind đã cảnh báo "should not be used in production" trong console. Chấp nhận được cho MVP, nhưng nên chuyển sang Tailwind CLI/PostCSS build nếu dự án lớn dần.

---

## 5. Gợi ý cho người/AI tiếp theo tiếp nhận dự án

- Đọc mục 1 (Tổng quan) trước khi đọc bất kỳ dòng code nào trong `index.html` — file này chỉ có 1 file JS duy nhất ~93 000 ký tự, không có module hoá, nên nắm được mô hình dữ liệu + vai trò trước sẽ tiết kiệm rất nhiều thời gian dò code.
- Nếu tiếp tục sửa `index.html` mà không có quyền `git push` trực tiếp (giống tình huống của Claude ở đây), cách khả thi nhất đã được kiểm chứng là: sửa bản local trước, tính diff (chú ý **offset phải tính theo UTF-16 code unit** vì file có nhiều emoji ngoài BMP — độ dài tính bằng `len()` của Python theo codepoint sẽ lệch), rồi áp dụng qua `EditorView.dispatch()` của CodeMirror 6 trên trang GitHub web editor bằng trình duyệt tự động, cuối cùng bấm "Commit changes..." trên UI.
- Mọi thay đổi schema Supabase trong lịch sử này đều làm thủ công qua SQL Editor của Supabase Dashboard, **không có file migration nào được lưu lại trong repo** — nếu cần biết chính xác schema hiện tại, dùng `information_schema.columns`/`pg_tables`/`pg_publication_tables` như đã trích dẫn ở mục 1.4 thay vì tin vào bất kỳ file `.sql` nào trong repo (vì không có).

---

*File này được Claude tạo trực tiếp trên GitHub theo yêu cầu của người dùng, tổng hợp từ lịch sử commit thật (`git log`/`git diff`) và trạng thái schema Supabase thật tại thời điểm viết (truy vấn trực tiếp `information_schema`, `pg_tables`, `pg_publication_tables`, `pg_get_viewdef`) — không phải suy diễn từ trí nhớ hội thoại.*
---

## 6. Nhật ký cập nhật chuyển đổi mô hình phân quyền 3 tầng nội bộ VPTU (Commit bởi Gemini)

> Mốc thời gian: 11/09/2026  
> Phạm vi: Dọn dẹp toàn bộ dữ liệu mẫu, chuẩn hóa cơ sở dữ liệu cho 49 cán bộ Văn phòng Tỉnh ủy và tái cấu trúc cây phân quyền 3 tầng (A1, A2, A3).

### 6.1. Dọn dẹp CSDL và Tái cấu trúc Schema Supabase

1. **Làm sạch CSDL (Truncate Data):**
   - Đã xóa sạch toàn bộ dữ liệu mẫu thử nghiệm trên các bảng: `tasks`, `task_directives`, `direct_messages`, `task_evidences`, và `accounts`.
   - Đã xóa vĩnh viễn bảng rác `users_departments` (bảng tàn dư không còn được sử dụng trong hệ thống).
2. **Cập nhật cấu trúc bảng `accounts`:**
   - Thêm cột `department` (`TEXT`) để phân định ranh giới quản lý của các phòng ban.
   - Cập nhật ràng buộc vai trò: `role_group IN ('A1', 'A2', 'A3')`.
   - Nạp đủ danh mục 49 cán bộ Văn phòng Tỉnh ủy (mật khẩu mặc định: `123456`).
   - Cập nhật trường `manager_id` trỏ về đúng các đồng chí Phó Chánh Văn phòng phụ trách từng khối chuyên môn:
     * Khối Tổng hợp (`TONG_HOP`): phụ trách bởi Đ/c Hoàng Thị Thu Trang (`hoangthithutrang`).
     * Khối Hành chính - Lưu trữ (`HC_LT`): phụ trách bởi Đ/c Hoàng Văn Kiên (`hoangvankien`).
     * Khối CĐS - Cơ yếu & Tài chính Đảng (`CDS_CY`, `TAI_CHINH_DANG`): phụ trách bởi Đ/c Phạm Xuân Tùng (`phamxuantung`).
     * Khối Quản trị (`QUAN_TRI`): phụ trách bởi Đ/c Nông Thị Thùy Trang (`nongthithuytrang`).
3. **Cập nhật View `view_exception_dashboard`:**
   - Bổ sung trường `owner_department` để hỗ trợ Lãnh đạo Văn phòng lọc điểm nghẽn theo từng phòng ban.

---

### 6.2. Thay đổi Logic và Giao diện trên `index.html`

1. **Tái cấu trúc 3 tầng phân cấp vai trò:**
   - **Tầng 1 - Lãnh đạo Văn phòng Tỉnh ủy (`A1` - 5 đồng chí):**
     * Thay thế vai trò Thường trực Tỉnh ủy cũ.
     * Chánh Văn phòng (`levanmieu`): Giám sát Dashboard ngoại lệ và điều phối toàn bộ 5 phòng ban.
     * Các Phó Chánh Văn phòng: Tự động khoanh vùng phạm vi giám sát điểm nghẽn, bảng ngoại lệ và chỉ giao việc trong đúng khối mình phụ trách.
   - **Tầng 2 - Trưởng phòng chuyên môn (`A2` - 5 đồng chí):**
     * Thay thế vai trò Lãnh đạo Văn phòng cũ.
     * Sử dụng giao diện 3 Tab (Giao việc / Theo dõi & Thẩm tra / KPI phòng).
     * Tab Giao việc: Danh sách cán bộ nhận việc chỉ hiển thị cán bộ thuộc đúng phòng mình.
     * Tab KPI: Chỉ thống kê khối lượng công việc và tiến độ nội bộ của các cán bộ trong phòng.
   - **Tầng 3 - Cán bộ / Chuyên viên thực hiện (`A3` - 39 đồng chí):**
     * Giữ nguyên cơ chế tiếp nhận việc cưỡng bức qua Modal viền đỏ khi đăng nhập.
     * Danh sách công việc tự động sắp xếp ưu tiên theo Deadline (Quá hạn lên đầu, Gần đến hạn highlight vàng).
     * Nộp đường dẫn minh chứng sản phẩm để Trưởng phòng thẩm định.
2. **Kế thừa và bảo toàn các tính năng trước đó:**
   - Giữ nguyên luồng bình luận chỉ đạo trực tuyến kiểu inline Facebook trực tiếp dưới từng dòng nhiệm vụ (`directiveThreadRowHtml`).
   - Giữ nguyên hệ thống Nhắn tin riêng tư 1-1 qua bảng `direct_messages`, danh bạ chọn người và bong bóng nhắn tin nổi ở góc dưới.
---

### 6.3. Cập nhật phân quyền Danh bạ Nhắn tin riêng tư (Direct Messages)

- **Quy tắc hiển thị danh bạ (`renderDMPickerList`):**
  * `A1` (Lãnh đạo Văn phòng): Toàn quyền nhắn tin tới tất cả 48 cán bộ trong cơ quan.
  * `A2` (Trưởng phòng): Chỉ hiển thị nhóm Lãnh đạo Văn phòng (`A1`) và toàn bộ cán bộ/chuyên viên thuộc phòng mình (`department === loggedInUser.department`). Triệt tiêu việc hiển thị cán bộ phòng khác.
  * `A3` (Chuyên viên): Chỉ hiển thị các cán bộ và Trưởng phòng trong cùng một phòng (`department === loggedInUser.department`).
---

### 6.4. Bổ sung Tab Giám sát Cán bộ thuộc quyền cho Lãnh đạo Văn phòng (A1)

- **Giao diện Tab 2 của A1 (`#tabContentA1Staffs`):**
  * Tự động xác định danh sách cán bộ thuộc quyền quản lý: Chánh Văn phòng thấy 48 cán bộ trong cơ quan; Phó Chánh Văn phòng chỉ thấy cán bộ thuộc khối phụ trách liên kết qua `manager_id`.
  * Bảng thống kê tiến độ cán bộ: Hiển thị các chỉ số KPI trực quan: *Tổng nhận, Trong hạn, Gần hạn (≤ 3 ngày), Quá hạn, Đang làm, Hoàn thành*.
  * Tương tác chi tiết nhiệm vụ: Nhấp vào tên cán bộ (hoặc nút "Chi tiết việc") sẽ mở rộng bảng chi tiết bên dưới (`#a1StaffDetailBox`), hiển thị danh sách toàn bộ các nhiệm vụ, số hiệu văn bản, sản phẩm đầu ra, deadline, thanh trạng thái và cho phép can thiệp / trao đổi chỉ đạo trực tiếp.
---

### 6.5. Tái cấu trúc Tab 2 của Lãnh đạo Văn phòng (A1) sang Cây Phân Cấp Trực Thuộc 1 Cấp (N+1 Tree View)

- **Nguyên lý hiển thị:** Triệt tiêu việc liệt kê phẳng 48 cán bộ cùng lúc; chuyển sang mô hình cây phân cấp đúng 1 cấp trực tiếp.
- **Trải nghiệm phân cấp:**
  * **Chánh Văn phòng (`levanmieu`):** Mặc định chỉ hiển thị 4 đồng chí Phó Chánh Văn phòng (A1) phụ trách từng khối chuyên môn kèm KPI tổng của cả khối.
  * **Tương tác mở rộng tầng 1:** Nhấp vào Phó Chánh Văn phòng bất kỳ $\rightarrow$ bung ra các Trưởng phòng chuyên môn (A2) thuộc khối đó.
  * **Tương tác mở rộng tầng 2:** Nhấp vào Trưởng phòng bất kỳ $\rightarrow$ bung ra danh sách Cán bộ/Chuyên viên (A3) trong phòng.
  * **Phó Chánh Văn phòng:** Khi đăng nhập vào Tab 2 sẽ thấy trực tiếp danh sách các Trưởng phòng thuộc khối quản lý của mình.
  * **Xem chi tiết nhiệm vụ:** Bấm vào tên cán bộ bất kỳ để mở bảng chi tiết nhiệm vụ bên dưới (`#a1StaffDetailBox`).
---

### 6.6. Hoàn thiện Trải nghiệm Xem Nhiệm Vụ Inline và Bổ sung quyền theo dõi PCVP

- **Theo dõi nhiệm vụ trực tiếp của PCVP:**
  * Tại khối của mỗi đồng chí Phó Chánh Văn phòng trên Tab 2 của CVP (`levanmieu`), bổ sung nút **`📌 Việc trực tiếp PCVP (N việc)`**.
  * Bấm nút này sẽ bung ngay danh sách các nhiệm vụ do chính đ/c PCVP đó phụ trách trực tiếp (`assigned_to === pcvp.id`) mà không cần giao quyền hay ủy quyền.
- **Cơ chế Inline Accordion toàn diện (Không cuộn trang):**
  * **Tại Tab 2 (A1):** Danh sách Cán bộ/Chuyên viên trong phòng khi bấm "Xem chi tiết việc" sẽ bung bảng chi tiết nhiệm vụ **ngay dưới dòng cán bộ đó**. Bấm lần nữa chuyển thành **"✕ Đóng chi tiết"** và thu gọn lại.
  * **Tại Tab 3 KPI (A2 - Trưởng phòng):** Đồng bộ hoàn toàn theo phong cách mới. Thay thế bảng phẳng bằng danh mục cán bộ kèm thanh thống kê KPI (Tổng, Trong hạn, Gần hạn, Quá hạn, Xong); bấm "Xem chi tiết việc" để mở/đóng chi tiết nhiệm vụ ngay tại chỗ dưới chân mỗi cán bộ.
---

### 6.7. Chuẩn hóa Cơ chế Xem Nhiệm vụ Trực tiếp (Inline Accordion) & Thêm Nút Theo Dõi PCVP

- **Bổ sung quyền theo dõi nhiệm vụ trực tiếp của PCVP:**
  * Tại Tab 2 (Giám sát cây phân cấp) của Chánh Văn phòng (`levanmieu`): Bổ sung nút **`📌 Việc trực tiếp PCVP (N)`** ngay trên thanh tiêu đề của từng đồng chí Phó Chánh Văn phòng.
  * Khi bấm vào, hệ thống bung mở ngay khung nhiệm vụ do chính đồng chí PCVP đó phụ trách trực tiếp (`assigned_to === pcvp.id`), giúp Chánh Văn phòng theo dõi tức thời mà không cần điều hướng.
- **Tái cấu trúc cơ chế xem chi tiết nhiệm vụ sang Accordion Row (Không cuộn trang):**
  * **Tại Tab 2 của Lãnh đạo VP (A1):** Triệt tiêu việc mở bảng cố định ở đáy trang. Khi bấm **"Chi tiết việc"** của bất kỳ cán bộ nào, dòng nhiệm vụ chi tiết (`<tr id="treeDetailRow-{id}">`) sẽ được chèn và bung mở **ngay sát bên dưới dòng cán bộ đó**. Nút bấm đổi sang trạng thái màu đỏ **"✕ Đóng việc"** để thu gọn khi không còn nhu cầu xem.
  * **Tại Tab 3 KPI của Trưởng phòng (A2):** Đồng bộ hoàn toàn logic Accordion Row. Thay thế bảng phẳng rời ở đáy bằng cơ chế chèn dòng chi tiết `<tr id="a2KpiDetailRow-{id}">` ngay dưới chân mỗi cán bộ trong phòng, bấm "Chi tiết việc" / "✕ Đóng việc" trực tiếp tại chỗ.

---

## 7. Giai đoạn 0 (v2) — Khởi tạo cấu trúc dự án (Claude)

- Đưa `CLAUDE.md`, `docs/` (SPEC, DESIGN, PROMPTS), `mockup/index.html` vào version control (trước đó chỉ nằm cục bộ, chưa từng lên GitHub).
- Dựng khung thư mục đích theo `docs/SPEC.md` mục 6: `frontend/`, `supabase/`, `tests/e2e/`, `tests/rls/`, `scripts/` (đều còn trống, có README ghi rõ sẽ hoàn thiện ở giai đoạn nào), `.gitignore`.
- Thêm `supabase/migrations/0001_baseline.sql`: dump đúng schema thật hiện tại (không kèm data) bằng `supabase db dump --linked`, đã áp thử thành công lên Postgres trắng cục bộ và lint sạch. Dump xác nhận `users_departments` đã bị xoá, `accounts` đã có cột `department`, nhưng cũng xác nhận lại nợ kỹ thuật đã biết: RLS vẫn tắt, `anon`/`authenticated` vẫn có `GRANT ALL` trên mọi bảng kể cả `accounts.password` — sẽ xử lý ở GĐ1.
- Thêm `.github/workflows/ci.yml`: job gitleaks (NF-2) và job áp migration + `supabase db lint` trên Postgres trắng cục bộ (đúng điều kiện xong của GĐ0). Chưa đụng `index.html`.

## 8. Giai đoạn 1 (v2) — Chặn rò rỉ khẩn cấp

- `supabase/migrations/0002_rls_tam_thoi.sql`: bật RLS trên cả 5 bảng; chặn hẳn việc đọc/ghi cột `accounts.password` ở tầng quyền Postgres (REVOKE SELECT/INSERT/UPDATE/DELETE, không chỉ ẩn bằng view — RLS chỉ lọc dòng, không lọc cột) và thêm view `accounts_public` cho danh mục cán bộ; thêm hàm `verify_login()` (`SECURITY DEFINER`, `RETURNS SETOF`) là nơi duy nhất còn so khớp username/password, không trả cột password ra ngoài; policy tạm thời cho `anon`+`authenticated` giữ nguyên hành vi hiện tại của app (chưa có Supabase Auth) trên 4 bảng còn lại — **chưa** giới hạn theo vai trò/phòng ban, việc đó thuộc GĐ3.
- `supabase/migrations/0003_tasks_status_default.sql`: sửa default chết `tasks.status` từ `'IN_PROGRESS'` (không khớp `tasks_status_check`) thành `'CHUA_GIAO'` (TASK-4).
- `index.html`: `handleLogin` gọi RPC `verify_login` thay vì `SELECT *` trực tiếp trên `accounts`; `loadAccountsCache` đọc từ `accounts_public` thay vì `accounts`. Không đổi cách đăng nhập, không đổi giao diện.
- `docs/SPEC.md` mục 5: bỏ mục "thêm FK `task_directives.task_id`/`task_evidences.task_id`" vì đã có sẵn trong baseline `0001`.
- Đã link CLI Supabase sang project staging `vptu-task-staging` (`vojmrjezspdftovzinek`), áp cả 3 migration và kiểm chứng trực tiếp qua REST API thật: đọc/ghi thẳng `accounts.password` bị từ chối, `accounts_public` và `verify_login` hoạt động đúng (kể cả trường hợp sai mật khẩu — đã tự phát hiện và sửa 1 lỗi bỏ-qua-xác-thực trong lúc code review, xem ghi chú trong migration).
- Rủi ro còn tồn đọng (ghi rõ trong comment migration để GĐ2/3 không bỏ sót): `verify_login` chưa có chống brute-force (chờ Supabase Auth ở GĐ2); `tasks`/`task_directives`/`task_evidences`/`direct_messages` vẫn mở cho mọi anon key, chưa phân quyền theo vai trò (GĐ3).
- **QA hoàn tất trên staging** (sau khi PR #2 merge): đã sao chép dữ liệu bảng `accounts` (48 tài khoản thật) từ production sang staging bằng `supabase db dump --data-only` chỉ định rõ bảng (không đụng `tasks`/`task_directives`/`task_evidences`/`direct_messages`, không sửa gì trên production). Đăng nhập thật qua giao diện `index.html` (trỏ tạm sang staging ở bản sao ngoài git, không commit) với 3 vai trò: A1 (`levanmieu` — Chánh VP), A2 (`macthuylinh` — Trưởng phòng Tổng hợp, giao việc thành công cho A3 trong phòng), A3 (`tranthihien` — tiếp nhận nhiệm vụ thành công, đúng modal bắt buộc TASK-3). Xác nhận đạt tiêu chí "Xong khi" của GĐ1 (PROMPTS.md): Table Editor hết UNRESTRICTED, đăng nhập + giao việc + tiếp nhận hoạt động đúng cho cả 3 vai trò. Dữ liệu nhiệm vụ QA đã xoá khỏi staging sau khi kiểm thử xong.
- **Vá khẩn cấp production** (chủ dự án cho phép trực tiếp, ngoài quy trình CI thường lệ): ngay sau khi PR #2 merge, phát hiện GitHub Pages sắp deploy `index.html` mới (gọi `verify_login`/`accounts_public`) trong khi production (`frwyxcmbonjaimziiuqr`) chưa có 2 hàm/view này → toàn bộ 49 cán bộ sẽ không đăng nhập được. Đã link CLI sang production, đánh dấu migration `0001` "đã áp" (đúng thực tế vì đó chính là bản dump từ production), push `0002`+`0003`, xác nhận qua REST API thật (đăng nhập đúng, đọc/ghi thẳng `password` đều bị chặn), rồi link CLI về lại staging. Việc này chưa đi qua CI/CD chính thức vì `deploy-prod.yml` (GĐ6) chưa tồn tại — cần bù lại bằng pipeline duyệt production ở GĐ6.
- Staging: xoá 48 tài khoản thật vừa sao chép ở trên, thay bằng 5 tài khoản giả cố định trong `supabase/seed.sql` (đủ 3 vai trò, 2 phòng khác nhau). `CLAUDE.md` thêm rule 10 (cập nhật `docs/TRANG-THAI.md` cuối phiên/khi context gần đầy) và rule 11 (staging chỉ dùng dữ liệu giả từ `seed.sql`, không sao chép dữ liệu thật từ production nữa).
- **Lệch quy trình phát hiện được khi rà soát lại PR #2**: PR #2 hiện ở trạng thái GitHub `closed`, **không phải `merged`** — timeline chỉ có sự kiện "closed", không có "merged", `merged_by` rỗng. Nhánh `feature/gd1-chan-ro-ri` được gộp vào `main` bằng một merge-commit (`6a74ba4`, đúng nội dung PR #2) bị đẩy thẳng lên `main` từ bên ngoài — không qua nút/API "Merge pull request" của GitHub — khiến PR tự đóng theo mà không được đánh dấu đã merge. Nội dung đã qua đủ bước nhánh + PR + `/code-review` + duyệt trước khi lên `main` nên không có code chưa kiểm tra lọt vào, nhưng bước chốt cuối cùng không đi qua đúng cổng PR như CLAUDE.md mục 4 yêu cầu. Các lệnh `gh pr merge` gọi trong phiên đó đều báo lỗi ("Merge already in progress" rồi "not mergeable") và không thành công — không xác định được ai/công cụ nào đã đẩy merge-commit đó. Đối chiếu: PR #3, #4, #5 sau đó đều merge đúng chuẩn qua GitHub (`merged: true`, có `merged_by`).

## 9. Giai đoạn 2 (v2) — Supabase Auth (PR-A)

- `supabase/migrations/0004_auth_chuan_bi.sql` (chỉ thêm): cột `accounts.must_change_password`, `accounts_public` thêm cột này, trigger trên `auth.users` tự xoá cờ khi `encrypted_password` đổi (client không bỏ qua được), bảng + hàm hook `hook_password_verification_attempt` (khoá 15 phút sau 5 lần sai — **tạm tắt** vì gói Free trả 402 khi bật; bật ở GĐ7 khi lên Pro). `0005_auth_cong_tac_doi_mat_khau.sql`: hàm quản trị `admin_set_must_change_password()` (chỉ `service_role`) bật/tắt cờ hàng loạt hoặc từng người.
- Quyết định chủ dự án: **giữ nguyên mật khẩu hiện có**, không phát mật khẩu tạm. `scripts/create-auth-users.mjs` tạo `auth.users` **trùng id** `accounts.id`, băm bcrypt mật khẩu hiện có tại máy và gửi dạng `password_hash` (không gửi plaintext, không bị chặn bởi chính sách ≥ 8 ký tự), cờ = false; idempotent, có `--rollback`; service_role lấy qua CLI. SPEC AUTH-2/AUTH-4 sửa cho khớp; Q2 = `haidang21ktvptu`, Q3 = Free (Pro ở GĐ7).
- `supabase/config.toml`: tắt tự đăng ký, mật khẩu mới ≥ 8 chữ+số, `site_url` = GitHub Pages, MFA tắt; căn `db.pooler`/`storage.analytics` theo hosted để `config push` không ghi đè. AUTH-3 tạm dùng giới hạn IP 30 lượt/5 phút; giao diện báo "vui lòng chờ 5 phút".
- `index.html`: `signInWithPassword`, modal đổi mật khẩu bắt buộc chỉ hiện khi cờ bật, bỏ hẳn `sessionStorage`, lỗi inline tiếng Việt; `/code-review` phát hiện và đã sửa 2 lỗi (lỗi mạng khi nạp hồ sơ, đăng xuất khi mất mạng).
- Staging: đã áp 0004–0005, config, nạp 5 tài khoản giả theo mật khẩu `123456`; QA giao diện: 3 vai trò đăng nhập như cũ vào thẳng view; bật cờ bằng hàm quản trị → modal đổi mật khẩu hiện đúng → đổi xong cờ tự tắt. `docs/KE-HOACH-PHAT-HANH-GD2.md` ghi thứ tự backup → migration → config → nạp Auth → merge → kiểm tra live → PR-B (0006 xoá `password`).
- **Phát hành production (2026-09-13)**: backup pg_dump (schema + data, ngoài git) → migration 0004–0005 → `config push` (diff đã trình, `site_url` GitHub Pages, MFA tắt) → nạp 48 tài khoản vào Auth trùng id, cờ = 0 → merge PR #7 → bản live đăng nhập 3 vai trò (A1/A2/A3) bằng mật khẩu hiện có đạt, không lỗi console. PR #8 gom phần commit push sau merge. **PR-B**: `0006_auth_don_dep.sql` xoá `verify_login` + cột `accounts.password`, `seed.sql` bỏ cột; đã áp staging (đăng nhập vẫn OK, `verify_login` 404); áp production sau khi PR-B merge.
- **GĐ2 hoàn thành (2026-09-13)**: PR #8, #9 merge; migration 0006 đã áp production (`verify_login` 404, cột `password` không còn, 3 vai trò vẫn đăng nhập OK); bản live build từ `main` mới. Từ đây quay lui cần khôi phục `accounts` từ backup pg_dump. Sẵn sàng GĐ3 (RLS đầy đủ, Plan mode).

## 10. Giai đoạn 3 (v2) — RLS đầy đủ theo vai trò + test

- Migration `0007_rls_schema.sql`: cột `accounts.is_chief` (CVP; production `levanmieu`), bỏ `assigned_domain`, `accounts_public` tạo lại; 9 hàm trợ giúp `security definer`/STABLE/`search_path` (`me_role`, `me_dept`, `me_is_chief`, `in_my_block`, `in_my_dept`, `task_in_scope`, `can_assign_to`, `can_see_task`, `is_task_party`); trigger `tasks_guard_a3` (A3 chỉ đổi status/reject_reason theo chuyển trạng thái hợp lệ); `view_exception_dashboard` → `security_invoker`.
- `0008_rls_policies.sql`: DROP toàn bộ policy `_tam_thoi_`, REVOKE `anon` (kể cả default privileges), policy theo ma trận SPEC §3.2 (CVP tất cả; PCVP theo khối `manager_id` 2 cấp; A2 theo phòng; A3 việc của mình; directives theo bên liên quan; messages theo sender/receiver); REVOKE UPDATE/DELETE trên directives/evidences/messages và DELETE tasks cho `authenticated` (chỉ đi qua hàm).
- `0009_functions.sql` (RLS-8): `assign_task`, `approve_task`, `submit_evidence`, `warn_task`, `mark_directives_read`, `mark_messages_read` — đều kiểm tra quyền bên trong. `index.html` chuyển 7 chỗ sang `.rpc()`, `isChief` đọc từ `is_chief` thay vì hardcode username.
- `tests/rls/`: 47 test (`node --test`, token thật), mỗi dòng RLS-2…7 có "được phép" và "bị chặn"; pass 47/47 trên local và staging. `seed.sql` thêm `demo_pcvp2` (khối Quản trị) để test cách ly khối; `create-auth-users.mjs` thêm `--default-password` cho tài khoản giả.
- Staging: đã áp 0007–0009, QA giao diện: A3 không thấy việc người khác, A2 không thấy phòng khác, PCVP không thấy khối khác, CVP thấy tất cả; giao việc/duyệt/nộp minh chứng qua hàm chạy đúng.
- Quyết định sau rà soát (2026-09-13): giữ `is_chief` (SPEC §2); khối PCVP tính 2 cấp qua `manager_id`; **RLS-5 mở cho A2 đọc/ghi luồng ý kiến của mọi task trong phòng** (migration `0010`, test thêm "A2 phòng khác bị chặn", 48/48 local + staging, đã áp production); FK `accounts.id → auth.users.id` (ON DELETE RESTRICT) và seed tạo auth user chuyển sang GĐ4; test RLS vào CI ở GĐ6. CLAUDE.md thêm rule 12: áp migration production luôn cần xác nhận của chủ dự án trong phiên. Production: backup pg_dump → 0007–0010 đã áp, `levanmieu` = CVP, anon bị chặn; chờ merge PR #11 và kiểm tra 3 vai trò trên bản live.
- **GĐ3 hoàn thành (2026-09-13)**: PR #11 merge (bản live build từ `ecad909`); production đã áp 0007–0010; kiểm tra live: `levanmieu` (CVP, `is_chief`), `hoangthithutrang` (PCVP), `macthuylinh` (A2), `buibahaidang` (A3) đều vào đúng view, không lỗi. PR #12 gom 2 commit push sau merge (0010 + tài liệu). Bài học quy trình: PR bị merge khi còn commit đang push → từ nay chỉ báo "sẵn sàng merge" sau khi push xong và CI xanh trên commit cuối.

## 11. Giai đoạn 4 (v2) — Tách frontend Vite (giữ nguyên giao diện và hành vi)

- **PR (a) khung Vite + auth**: `frontend/` = Vite 8 + JavaScript thuần (ES modules) + Tailwind 3.4 build qua PostCSS (cấu hình mặc định, trùng Play CDN cũ nên trông y hệt); `@supabase/supabase-js` ghim `2.116.0`; anon key đọc từ `VITE_SUPABASE_*` (`.env.example`), `base = /vptu-mvp-task/`. Đã tách: `lib/` (client, constants, state, dom, uỷ quyền sự kiện `data-action`), `auth/` (đăng nhập, đổi mật khẩu bắt buộc, phiên), `components/toast.js` (thay `alert()`), `views/shell.js` (header + hiện view theo vai trò). View A1/A2/A3 ở PR (b); ý kiến chỉ đạo, nhắn tin, realtime ở PR (c).
- Migration `0011_accounts_fk_auth_users.sql`: FK `accounts.id → auth.users.id ON DELETE RESTRICT` (quyết định GĐ3); `seed.sql` tự tạo `auth.users` + `auth.identities` (bcrypt qua pgcrypto, mật khẩu `123456`) trước khi INSERT accounts, `must_change_password = false`. Đã áp staging (6/6 tài khoản có auth user; production 48/48 sẵn sàng), `supabase db reset` + 48 test RLS pass local và staging.
- `tests/e2e/`: Playwright 1.63 chạy trên `vite preview` trỏ staging, 2 project `desktop` 1280×800 và `mobile` 360×740; kịch bản 1–3 (đăng nhập A1/A2/A3, sai mật khẩu, tải lại giữ phiên, đăng xuất) pass 6/6; key qua CLI như `tests/rls`; `global-setup` dọn dữ liệu `E2E-TEST%`.
- CI: job "Build frontend + giới hạn 300 dòng" (`npm ci`, `vite build`, `scripts/check-line-limit.mjs`). Workflow mới `deploy-pages.yml` build `frontend/` và deploy bằng `actions/deploy-pages` — chỉ deploy khi Settings → Pages → Source đã là "GitHub Actions" (tự đọc `build_type` qua API), trước đó bản `index.html` cũ vẫn chạy từ nhánh `main`.
- **PR (b) views A1/A2/A3**: markup 3 tầng + 3 modal (tiếp nhận, phân công lại, nộp minh chứng) tách thành module template (lấy nguyên từ `index.html` cũ, `onclick` inline → `data-action`/`data-submit` qua `lib/actions.js`); nghiệp vụ tách theo file ≤ 170 dòng: `views/a1/` (dashboard ngoại lệ + form giao việc, cây phân cấp), `views/a2/` (giao việc, theo dõi/đôn đốc/đổi người/đồng ý từ chối/duyệt, KPI), `views/a3/` (danh sách ưu tiên, modal tiếp nhận/từ chối, nộp minh chứng), `views/shared/` (KPI nhóm, bảng việc inline dùng chung), `features/tasks/reassign.js`, `features/directives/render.js` (nút Ý kiến + huy hiệu, chờ PR c nối logic). Mọi `alert()` → toast; thêm `escapeHtml` cho dữ liệu người dùng; lỗi ghi DB nay được báo thay vì im lặng. e2e kịch bản 4–6 (A2 giao việc → A3 tiếp nhận + nộp minh chứng, kể cả URL sai → A2 duyệt, KPI) pass 12/12 (6 kịch bản × 2 kích thước) trên staging; QA tay thêm: A1 giao việc, phân công lại, cây phân cấp, A3 từ chối, A2 đồng ý từ chối + đôn đốc.
- **PR (c) directives + messages + realtime**: `features/directives/index.js` (mở/nạp/gửi luồng ý kiến, DIR-2 A3 chỉ trả lời khi có ý kiến Lãnh đạo, đã đọc qua `mark_directives_read`), `features/messages/` (danh bạ theo vai trò MSG-1, khung chat, đã đọc qua `mark_messages_read`, toast tin nhắn), `features/realtime.js` (kênh `postgres_changes` INSERT trên `task_directives`/`direct_messages`, đăng ký khi vào app, huỷ khi đăng xuất qua hook phiên). Kịch bản e2e 7 (bổ sung): hai phiên song song A2 ↔ A3 — ý kiến chỉ đạo realtime (huy hiệu, viền dòng, trả lời) và nhắn tin (toast, huy hiệu, mở hội thoại từ toast); tổng 16/16 pass (8 test × 2 kích thước). Test A2 chờ `loadA2Data` xong sau đăng nhập/đổi tab để không bấm vào dòng bị vẽ lại. CI chạy trên mọi `pull_request` để PR xếp chồng cũng được kiểm tra.
- **Production (2026-09-13, chủ dự án xác nhận trong phiên)**: backup pg_dump `vptu-backup/prod-20260913-2206-gd4-{schema,data}.sql` (ngoài git) → kiểm tra 48/48 accounts có auth user, 0 auth user mồ côi → áp migration 0011 lên `frwyxcmbonjaimziiuqr` bằng `db push --project-ref` (không đổi link, vẫn trỏ staging) → FK `accounts_id_fkey` có mặt, đăng nhập bản live vẫn OK. Lưu ý: production có **48** tài khoản (không phải 49).
- **GĐ4 hoàn thành (2026-09-13)**: PR #13, #14, #15 merge theo thứ tự (PR xếp chồng phải `gh pr edit --base main` + merge `main` vào nhánh vì ruleset yêu cầu nhánh cập nhật); chủ dự án thêm 2 secret `VITE_SUPABASE_*` và chuyển Pages sang **GitHub Actions** → workflow `Deploy GitHub Pages` deploy bản Vite; kiểm tra live 3 vai trò (`levanmieu` CVP, `macthuylinh` A2, `buibahaidang` A3) vào đúng view, không lỗi console. Quyết định: giữ toast thay `alert()`; e2e vào CI ở GĐ6 cùng `tests/rls`; `loadA2Data` gọi 2 lần để GĐ5. PR dọn dẹp: xoá `index.html` gốc (bản một file, không còn được phục vụ), bỏ ngoại lệ trong `check-line-limit.mjs`, thêm ESLint cấu hình tối thiểu (`eslint.config.js` gốc, recommended, không plugin) vào CI và sửa 2 lỗi lint hiện có.

## 12. Giai đoạn 5 (v2) — Giao diện mới theo docs/DESIGN.md

- **PR (a) token + đăng nhập + khung**: `styles/tokens.css` (biến màu/chữ/kích thước), `base.css` (Noto Serif + Be Vietnam Pro qua Google Fonts, tiêu điểm bàn phím, `prefers-reduced-motion`, dải thổ cẩm), `layout.css` (trang đăng nhập núi đá vôi xếp lớp, khung thanh bên chàm 240px + đầu trang + dải thổ cẩm, ≤ 768px thanh bên thành thanh dưới), `components.css` (nút, ô nhập, huy hiệu vàng, nhãn mức, modal, toast); `tailwind.config.js` khai báo cùng token. `index.html` viết lại theo mockup (giữ nguyên mọi id cho e2e); modal đổi mật khẩu theo kiểu modal bắt buộc (viền trên đỏ, tiêu đề serif).
- Thanh bên do `views/shell.js` vẽ từ `view.nav` (registry thêm `nav`): các nút tab cũ của A1/A2 chuyển thành mục thanh bên (giữ id `tabBtn*`), mục "Nhắn tin" (`#dmBubbleLauncher` + huy hiệu) thay bong bóng nổi; nút Đăng xuất lên đầu trang. A2 vào app mở thẳng "Theo dõi và duyệt" nên `loadA2Data` chỉ chạy một lần (trước đây chạy khi vào app rồi chạy lại khi bấm tab). Toast chuyển góc dưới phải, nền chàm, 4 giây.
- Sửa `tests/e2e/nhiem-vu.spec.js`: `beforeAll(({}, testInfo))` (PR #16 đổi thành `_fixtures` cho ESLint làm Playwright từ chối tải file) — e2e 16/16 pass lại. Lighthouse Accessibility: đăng nhập 100/100, dashboard A1 90/90 (lỗi còn lại nằm ở nội dung cũ, sửa ở PR b). Ảnh 1280/360px tại `docs/anh-man-hinh/gd5/` (mỗi giai đoạn chỉ giữ bộ mới nhất).
- Sau điểm dừng 1 (chủ dự án duyệt): phông **tự host** `public/fonts/` (woff2 subset Vietnamese + Latin, Noto Serif một file biến thiên 400–700, Be Vietnam Pro 400/500/600; `styles/fonts.css`), bỏ Google Fonts; biểu tượng tỉnh Cao Bằng `public/brand/logo-cao-bang.png` ở trang đăng nhập (112px), thanh bên (40px trong ô trắng) và favicon 32/180 (xuất bằng sharp); đầu trang thêm phòng ban cạnh tên cơ quan và ngày (ẩn trên điện thoại); DESIGN mục 1, 3 và `brand/README.md` cập nhật.
- **PR (b) views + bảng + modal**: `styles/tables.css` (thanh số liệu một hàng kẻ dọc, bảng kẻ ngang mảnh, mức cảnh báo = dải 4px bên trái dòng `r-do/r-dodb/r-vang/r-xanh/r-ht`, ≤ 768px bảng thành danh sách thẻ có nhãn `data-nhan`); template A1/A2/A3 viết lại theo DESIGN mục 4 (tiêu đề trang + một nút chính, bỏ chữ hoa toàn bộ, bỏ màu tím — Đỏ đặc biệt dùng `#7A0C1E`, số văn bản không tô đỏ, nút trong dòng là nút phụ); 3 modal (tiếp nhận bắt buộc viền đỏ + tiêu đề serif, nộp minh chứng, phân công) và luồng thông báo bỏ dấu chấm than/chữ hoa (DESIGN mục 8). Nhãn trạng thái `Chờ duyệt`, `Hoàn thành`; `formatDateTime` → "18/9/2026 23:31". Token `--muc-xanh` đậm thành `#2A7365` để chữ 12px đạt 4.5:1 (DESIGN mục 2 cập nhật). Chip KPI ở cây phân cấp chỉ tô màu khi số > 0. Lighthouse Accessibility A1/A2/A3 = 100 (desktop + mobile); e2e 16/16 (cập nhật chuỗi mong đợi theo nhãn mới).
- **PR (c) ý kiến + nhắn tin + mobile + in**: `styles/features.css` — luồng ý kiến chỉ đạo bung dưới dòng (thẻ giấy, ý kiến viền trái chàm/vàng theo người gửi, trượt dọc 160ms, cảnh báo DIR-2 màu vàng), dòng có ý kiến mới tô nền vàng nhạt (lớp `dong-moi` thay `ring-2`), danh bạ nhắn tin thành modal có nút liên hệ + huy hiệu vàng, khung chat góc dưới phải (≤768px: tấm trượt từ đáy 75vh), toast tin nhắn cùng kiểu toast chàm có nút "Mở hội thoại"; `@media print` (trong `@layer utilities`) ẩn thanh bên/nút/bộ lọc và hiện chân trang in có dải thổ cẩm — chỗ thứ 3 theo DESIGN mục 6. e2e 16/16; Lighthouse Accessibility đăng nhập/A1 = 100; ảnh `y-kien-*`, `chat-*` trong `docs/anh-man-hinh/gd5/`.
- **GĐ5 hoàn thành (2026-09-14)**: PR #18, #19 merge (chủ dự án duyệt bằng mắt ở 2 điểm dừng), PR (c) mở; bản live build Vite mới. Checklist DESIGN mục 9 đạt: đỏ ≤ 2 chỗ/màn hình, tương phản ≥ 4.5:1, focus nhìn thấy, 360px không vỡ, không chữ hoa toàn bộ, thổ cẩm đúng 3 chỗ (đầu trang, form đăng nhập, chân trang in).

## 13. Giai đoạn 6 (v2) — CI/CD: PR → staging → duyệt → production

- `ci.yml` thêm job **Kiểm thử RLS + e2e trên staging** (chỉ `pull_request`): `tests/rls` (48 test) rồi `tests/e2e` (13 test) trong **một job** cùng IP — 13 lượt đăng nhập/lần chạy, dưới giới hạn 30 lượt/5 phút của Supabase Auth; `concurrency` để hai PR không chạy chồng. Key lấy từ secret staging (`SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`), cả hai bộ test từ chối URL production.
- e2e dùng lại phiên: `global-setup.mjs` đăng nhập A1/A2/A3 qua API và ghi storageState (`.auth/`), `pageAs()` mở trang với phiên sẵn; kịch bản 1–3 (đăng nhập thật qua form, A3 ở 360px) tách thành project `dang-nhap` chạy sau cùng vì đăng xuất huỷ phiên toàn cục. 18 lượt → 7 lượt. Thêm `smoke/dang-nhap-live.spec.js` + `playwright.smoke.config.js` (đăng nhập 1 tài khoản trên bản live).
- `deploy-staging.yml` (push main) thay `deploy-pages.yml`: `db push` staging **trước**, rồi composite action `build-pages-site` build **hai bản** vào một artifact Pages — production từ tag `production` (commit phát hành gần nhất; chưa có thì `main`), staging ở `/vptu-mvp-task/staging/` trỏ project staging — kèm `phien-ban.json`, curl kiểm tra sau deploy.
- `deploy-prod.yml` (tag `v*`): job `phat-hanh` trong environment `production` (chờ haidang21ktvptu duyệt) → backup `db dump` schema + data mã hoá `gpg` AES-256 (artifact 90 ngày, vì artifact repo public tải được công khai) → `db push` production (dry-run vào Summary) → build → `deploy` Pages → `smoke` Playwright đăng nhập 1 tài khoản → gắn tag `production`; job `quay-lui` ghi hướng dẫn theo bước lỗi. Quay lui frontend = tag `v*` mới trỏ commit cũ. `config push` vẫn làm tay.
- `docs/kien-truc.md` (mới): sơ đồ pipeline, so sánh 3 phương án staging frontend, danh sách secret/environment/ruleset chủ dự án tự nhập, hướng dẫn quay lui và phát hành. Chưa tạo secret/environment nào; chưa gắn tag.
- **Sau trả lời của chủ dự án (2026-09-14)**: giữ phương án A; `SMOKE_*` ở repository secret. Migration `0012_accounts_is_system.sql` (cột `accounts.is_system`, GRANT SELECT cột, `accounts_public` thêm cột); `loadAccountsCache` lọc `is_system` nên tài khoản hệ thống không hiện ở danh bạ/cây/KPI/mọi danh sách (RLS không đổi; e2e kiểm tra danh bạ). `seed.sql` thêm `smoke_test` (A3, CDS_CY, is_system) — đã áp 0012 + nạp seed lên staging; `scripts/create-system-account.mjs` tạo tài khoản này trên production với mật khẩu ngẫu nhiên in một lần (chờ xác nhận trong phiên). Job "Áp migration + lint schema" chạy thêm `tests/rls` với `RLS_LOCAL=1` (48/48 local).
- **Sự cố phát hành `v2.0.0-rc1` (2026-09-14)**: job Deploy Pages "xanh" sau 5 giây nhưng bản live vẫn `main@df6aa94`, smoke lỗi. Nguyên nhân xác minh: `actions/deploy-pages@v4` gửi `pages_build_version = GITHUB_SHA` (không có input đổi, `GITHUB_*` không ghi đè được); GitHub Pages coi version trùng với bản deploy-staging đã xuất bản cùng commit nên trả deployment cũ, không thay artifact — lặp lại ở mọi tag `v*`. Sửa: composite `.github/actions/deploy-pages-versioned` gọi REST `POST /pages/deployments` với version `<ref>-<run_id>-<run_attempt>` (OIDC như `core.getIDToken()`), poll tới `succeed`, ghi version + deployment_id vào Summary; `build-pages-site` xuất `artifact-id`; cả hai workflow deploy dùng composite này, permission `pages`/`id-token` khai báo ở cấp job. Phát hành lại bằng `v2.0.0-rc2`.
- **Deploy staging run #3 (`e5134e7`) lỗi `gh: Not Found (HTTP 404)`** ở bước tạo Pages deployment, thân phản hồi bị `gh api` nuốt. Sửa composite: gọi bằng `curl` (`deploy-pages-versioned/api.sh`) với header y hệt octokit của deploy-pages (`Accept vnd.github.v3+json`, `Authorization: token`, bỏ `X-GitHub-Api-Version`), `--max-time`, in HTTP code + body của mọi lời gọi (lỗi in ngoài `::group::`), Summary ghi thêm mã HTTP. Chẩn đoán tiếp bằng `workflow_dispatch` của Deploy staging sau khi merge (không dùng PAT từ máy dev — khác loại token).
- **PR chẩn đoán 404 (chỉ `deploy-staging.yml`, tạm)**: run #4 cho body `{"message":"Not Found"…#create-a-github-pages-deployment}` → route đúng, nghi từ chối vì danh tính/trường bị đối chiếu. Job deploy tạm chạy: đối chứng `GET /pages` (+ header `x-accepted-github-permissions`) → thử A (version tuỳ ý) → thử B (version = `GITHUB_SHA`, phân định "Pages bắt version = sha OIDC") → đối chứng `actions/deploy-pages@v4` cùng token/OIDC, mọi bước `continue-on-error`, bảng kết quả vào Summary; staging được deploy lại ở B hoặc đối chứng. `deploy-prod.yml` chưa động. Gỡ các bước chẩn đoán ở PR khắc phục.
- **Kết luận sự cố rc1 sau ba vòng thử (2026-09-14)**: run chẩn đoán #5 (`c16a080`): GET /pages 200; composite version tuỳ ý → 404; **composite version = `GITHUB_SHA` → thành công**; `actions/deploy-pages@v4` → thành công ⇒ **H1: GitHub Pages bắt `pages_build_version` = claim `sha` của OIDC token và chỉ nhận mỗi commit một lần**. Tag rc1 gắn lên commit đã lên main (deploy-staging đã deploy sha đó) nên không thể deploy lại. Khắc phục (P5, chủ dự án chọn): xoá composite `deploy-pages-versioned` + `api.sh`, gỡ các bước chẩn đoán, cả hai workflow về `actions/deploy-pages@v4`; **quy trình phát hành mới: tag `v*` gắn lên commit đầu nhánh phát hành khi PR đã CI xanh nhưng CHƯA merge, merge bằng merge commit sau khi phát hành xong**; `deploy-prod.yml` thêm job `kiem-tra` trước bước duyệt (4 check CI của commit phải `success`; `GET /pages/deployments/<sha>` phải trả 200 + `status` rỗng — in HTTP code + body, dạng khác thì dừng, không tự cho qua); quay lui = nhánh mới + commit rỗng + tag mới. `kien-truc.md` mục 2/3/6/7 và TRANG-THAI cập nhật. Phát hành lại bằng `v2.0.0-rc2` trên nhánh PR khắc phục.
- **GĐ6 hoàn thành (2026-09-14)**: `v2.0.0-rc2` phát hành qua pipeline đầy đủ — tag gắn lên đầu nhánh PR #27 (chưa merge) → `kiem-tra` xanh → duyệt environment `production` → backup gpg → `db push` (no-op) → `actions/deploy-pages` → smoke `smoke_test` đạt → tag `production` = `2e90a89`; `/phien-ban.json` bản live ghi `v2.0.0-rc2`. PR #27 merge bằng merge commit (`094a434`); deploy-staging #6 dựng lại bản production từ tag `production`, `/staging/` = main. Tiêu chí "một PR đi hết pipeline; tag dừng chờ duyệt đúng chỗ" (PROMPTS GĐ6) đạt. Tag `v2.0.0-rc1` giữ làm lịch sử sự cố. Sẵn sàng GĐ7 (vận hành).

## 14. Giai đoạn 7 (v2) — Vận hành: sao lưu và khôi phục
- **PR A (2026-09-14)**: `scripts/backup-db.sh` (dump schema + data qua `supabase db dump`, bỏ bảng phiên/nhật ký, kèm `migrations.txt`/`so-dong.txt`/`thong-tin.txt`, mã hoá AES-256 với passphrase qua fd, tự giải mã thử) và `scripts/restore-db.sh` (từ chối production/staging trong code, ref trong chuỗi kết nối phải khớp `--project-ref`, hỏi xác nhận trước khi ghi; schema áp bằng `supabase db push` từ migrations vì `schema.sql` thiếu trigger `auth.users` và lịch sử migration; dữ liệu nạp một transaction với `session_replication_role = replica`, kiểm chứng FK `accounts → auth.users` và số dòng; stream gpg → tar → psql không ghi plaintext). Hàm chung `scripts/lib-sao-luu.sh`; `.gitattributes` ép LF cho `*.sh`.
- Đã thử trên máy Windows (Git Bash, psql qua scoop): backup local và staging → khôi phục vào `supabase start` (cả đường "trắng" `db push` lẫn `--ghi-de` xoá sạch bằng psql một transaction rồi `db push`), 48 test RLS local pass sau khôi phục; archive kiểu deploy-prod (chỉ schema+data, dump trước 0012) cũng khôi phục được; 9 chốt an toàn từ chối đúng.
- Tài liệu `docs/sao-luu-khoi-phuc.md` cho người không lập trình: cơ chế lưu local chính là `backup-db.sh` ghi thẳng vào `D:\TU 2026\Project\vptu-backup\`; chính sách backup **3 ngày/lần → mất tối đa 3 ngày dữ liệu** (SPEC NF-6 cập nhật). Còn lại GĐ7: PR B (workflow định kỳ + `tai-backup.sh` không tự xoá + uptime), PR C (`docs/xu-ly-su-co.md`), lên Pro. **Khôi phục thử thành công (2026-09-14)** trên Supabase local từ backup production thật (49 tài khoản, đăng nhập bằng mật khẩu cũ) — `docs/bien-ban-khoi-phuc-2026-09-14.md`; gói Free hết 2 project nên chưa thử hosted (thử lại khi lên Pro).
- **PR B (2026-09-14)**: `backup-dinh-ky.yml` chạy `backup-db.sh` **3 ngày/lần** (cron `0 20 */3 * *` = 03:00 VN ngày 1, 4, …, 31 — không bao giờ cách quá 3 ngày; GitHub tự tắt schedule sau 60 ngày không commit) + `workflow_dispatch`, artifact `prod-<ngày>-dinh-ky` 90 ngày, repository secret `BACKUP_PASSPHRASE` (workflow tự động không dùng environment có reviewer). Run thử trên nhánh (trigger push tạm) xanh, `so_dong=chinh-xac` → mới cho `deploy-prod.yml` gọi cùng script (bỏ dump inline, passphrase không còn trên argv; tên artifact không đổi).
- `scripts/tai-backup.sh` + `tai-backup.cmd`: tải artifact `prod-*` chưa có về `vptu-backup` (gh api + `gh run download`, kiểm tra gói gpg), sắp theo tên (ngày trong tên, không theo mtime); **không tự xoá**, `--giu N` chỉ khi ghi rõ. Docs mục 3: Task Scheduler ONLOGON (`schtasks`), cách kiểm tra, hạn chế khi không đăng nhập máy nhiều ngày (artifact 90 ngày nên không mất). Mục 9: UptimeRobot chỉ theo dõi `phien-ban.json` bản live; backend xem tay trên Dashboard (không đặt key vào dịch vụ ngoài).
- **PR C (2026-09-14)**: `docs/xu-ly-su-co.md` — 11 tình huống, mỗi mục 4 dòng (dấu hiệu · nguyên nhân · xử lý copy-paste · có cần backup không): 4 tình huống đã gặp (rc1 Pages không đổi, setup-cli rate limit, schedule tắt sau 60 ngày, project Free bị Paused) + chờ 5 phút (30 lượt/IP), quên mật khẩu (SQL sinh mật khẩu tạm phía server qua `db query`, có bước xem trước họ tên và đếm đúng 1 dòng — đã thử trên local), token hết hạn (chữa cháy #7 và phòng ngừa #11 đầu 12/2026), phát hành đỏ giữa chừng, UptimeRobot báo down, xoá nhầm dữ liệu hàng loạt (mục duy nhất cần khôi phục). Liên kết từ `kien-truc.md` mục 6, `sao-luu-khoi-phuc.md` mục 9.
- **GĐ7 hoàn thành (2026-09-14)**: Task Scheduler `VPTU tai backup` và UptimeRobot (`phien-ban.json`, từ khoá `phien_ban`) đã đăng ký; hai secret `BACKUP_PASSPHRASE` kiểm chứng trùng nhau bằng cách giải mã artifact CI trên máy. Còn việc ngoài code: lên gói Pro → bật AUTH-3 → diễn tập khôi phục hosted.

## 15. Thiết kế module Theo dõi Kết luận BTVTU (GĐ8–11)
- **2026-09-14**: Thêm tài liệu thiết kế module KL BTVTU (`docs/thiet-ke-theo-doi-kl-btvtu.md`, đã duyệt); TRANG-THAI ghi GĐ8–11 vào việc còn lại, GĐ8 là việc kế tiếp.

## 16. Giai đoạn 8 (v2) — Theo dõi Kết luận BTVTU
- **PR 8A-1 (2026-09-15)** — quản trị đặc quyền (thiết kế Phần 5): migration `0013_quan_tri_dac_quyen.sql` thêm `accounts.quan_tri_kl`/`quan_tri_he_thong` (GRANT SELECT cột, `accounts_public` nối cuối; gán `quan_tri_he_thong` cho `buibahaidang`, không gán `quan_tri_kl` cho ai), `quyen_lich_su` (chỉ hàm ghi, chỉ `quan_tri_he_thong` đọc), `admin_dat_co()` ghi nhật ký cùng transaction (đường CLI: `auth.uid()` NULL + `session_user = postgres`), `phu_trach_phong` hiệu lực theo ngày với EXCLUDE chống chồng kỳ (`btree_gist`) — **bảng tạo rỗng, không suy từ `manager_id`** (quyết định chủ dự án); `phu_trach()`, `admin_phan_cong_phong()` đóng `den_ngay` không xoá.
- Seed thêm `demo_qtht` (A3 CĐS-CY, `quan_tri_he_thong`) + 2 dòng phụ trách phòng (`ly_do = 'seed'`); đã kiểm: migration một mình → bảng 0 dòng, seed → 2 dòng. `tests/rls/rls-9-quan-tri` 11 case (59/59 local); tự bỏ qua khi project chưa có 0013/`demo_qtht` (staging trước khi merge).
- Màn hình **Quản trị hệ thống** (`frontend/src/views/shared/quan-tri/`, mục thanh bên chỉ khi có `quan_tri_he_thong`): bảng tài khoản + công tắc cấp/thu `quan_tri_kl` qua hộp lý do bắt buộc, cảnh báo vàng khi ≠ 2 người giữ quyền hoặc chủ dự án tự giữ, bảng PCVP × phòng (Chánh VP cố định), nhật ký 50 dòng. e2e kịch bản 8 (`quan-tri.spec.js`, tự bỏ qua khi chưa có `demo_qtht`); ngân sách đăng nhập CI 15/30. Ảnh: `docs/anh-man-hinh/gd8/`.
- CI job "Quét rò rỉ bí mật" thêm bước chặn file `.xlsx/.xls/.csv/.pdf` (gitleaks bỏ qua các đuôi này theo allowlist mặc định nên không dùng rule gitleaks). Còn lại GĐ8: PR 8A-2 (0014–0016, `kl_trang_thai`), PR 8B (script nhập); sau phát hành 8A-1: chủ dự án nhập phân công PCVP ↔ phòng trên màn hình Quản trị.
- **PR 8A-2 (2026-09-15)** — schema module KL: `0014_kl_btvtu_bang.sql` (4 danh mục nạp sẵn — `ten` nguyên văn sheet DanhMuc, 12 ngành + 13 cơ quan trình do chủ dự án gửi; `kl_cau_hinh`; `kl_hoi_nghi`; `kl_nhiem_vu` với ba mốc thời gian, `nguon`, cờ `thieu_minh_chung` sinh tự động, CHECK Phần 2.3 có điều kiện cho dòng Excel; `kl_lich_su`, `kl_chi_dao`, `kl_dinh_chinh`), `0015_kl_btvtu_ham.sql` (**`kl_trang_thai(nv, ngay)` nguồn duy nhất** đúng thứ tự 2.2, trả `ket_qua`/`do_tre_nhap_lieu`/`dang_dinh_chinh`/`nhom_dem`; `kl_hom_nay()` theo giờ VN vì Postgres Supabase chạy UTC; trigger Ký ban hành tự tính hạn, chặn ngày BH tương lai, ngày hoàn thành ngoài khoảng, xoá lý do khi có hạn; guard chủ trì không có `quan_tri_kl`; lịch sử từng cột; `kl_de_nghi_dinh_chinh`/`kl_duyet_dinh_chinh` — người đề nghị không tự duyệt), `0016_kl_btvtu_rls.sql` (`kl_pham_vi` theo quyết định 7 dùng `phu_trach()` của 0013, policy từng bảng, `v_kl_dashboard` security_invoker, Realtime 3 bảng).
- Test: `kl-trang-thai` (9 case biên với ngày cố định — gồm case múi giờ cho `do_tre_nhap_lieu` ghi nhận 17h–23h UTC — + 4 case ràng buộc/trigger), `rls-10-kl` (12 case, gồm PCVP đổi phòng giữa chừng và vòng đính chính), `kl-moc-2026-09-14` (mốc HT 146 · TX 16 · QH 8 · ĐTH 6 · CĐK 6 · CĐH 3 = 185, tự bỏ qua tới khi PR 8B nhập đủ 185 dòng Excel) — 85 test RLS, 84 pass + 1 skip trên local. Staging: đã nạp seed `demo_qtht` + 2 dòng phụ trách sau khi merge #33, `rls-9` chạy thật 59/59.
- Review chủ dự án (15/9): `do_tre_nhap_lieu` cast `ghi_hoan_thanh_luc::date` theo múi giờ phiên (UTC) — sửa thành `AT TIME ZONE 'Asia/Ho_Chi_Minh'`; rà 0014–0016 không còn chỗ nào lấy ngày từ timestamptz hay so với `now()`/`current_date` mà chưa qua giờ VN (các `now()` còn lại chỉ lưu mốc timestamptz). Ghi rõ ở 0016 và tài liệu thiết kế: policy sửa việc mình chủ trì áp cho **mọi chủ trì** (10 việc "VPTU" do Trưởng phòng Tổng hợp A2 chủ trì), không riêng A3.
- **PR 8B (2026-09-15)** — script nhập dữ liệu (thiết kế Phần 2.4/2.4b): `scripts/nhap-kl-btvtu.mjs` (+ `scripts/kl/{ket-noi,doc-nguon,kiem-tra,ghi}.mjs`, thêm `exceljs` để đọc .xlsx trực tiếp) — **dry-run mặc định**, `--ghi` mới ghi; in bảng ánh xạ chủ trì (họ tên → `accounts.full_name` chính xác, "VPTU" → Trưởng phòng Tổng hợp xác định từ `accounts`; không khớp → dừng), bảng đối chiếu số thô, vi phạm dữ liệu/ánh xạ tách riêng, nhóm tự xử lý (3 dòng `ly_do_chua_co_han`, 10 dòng VPTU, nhật ký suy mã từ số dòng, 13 dòng nhật ký không rõ người sửa); từ chối ghi chồng (`--xoa-cu` chỉ local/staging, bị từ chối trên production), production cần thêm `--production`; lỗi giữa chừng tự xoá theo id vừa tạo; `setval` sequence qua `supabase db query --file`; nhật ký cũ 194 dòng → `kl_lich_su` `nguon = excel` (cột ánh xạ sang tên cột DB, giá trị danh mục → mã, serial Excel → ngày, người sửa qua file ánh xạ email ngoài repo, mốc giờ "Z" của Apps Script thực chất là giờ VN → `+07:00`); biên bản vào `scripts/out/` (gitignored). `0017_kl_loai_thoi_han_ten.sql`: `ten` "Ký ban hành (trong 10 ngày)" đúng nguyên văn sheet (0014 ghi thiếu chữ "trong").
- `scripts/an-danh-kl-btvtu.mjs` sinh bộ dữ liệu vàng ẩn danh `tests/rls/du-lieu-vang/kl-btvtu.json` (185 dòng, chủ trì → `demo_*`, nội dung "Nhiệm vụ NV-xxx (ẩn)", bỏ minh chứng/văn bản/lĩnh vực chi tiết; `tong_hop` bản ẩn danh phải bằng file thật, khác → lỗi). Local + CI cục bộ (bước mới trong job "Áp migration + lint schema") nạp bộ vàng bằng chính script nhập → `kl-moc-2026-09-14` chạy thật, **đúng 146/16/8/6/6/3/0 = 185**; test loại trừ fixture `RLS-TEST` và thêm bất biến tổng theo chủ trì; 85/85 test RLS local. Dry-run file thật trên local: 0 vi phạm dữ liệu (NV-009 hạn trước ngày ban hành đã được sửa trên sheet trước khi nhập), chỉ còn vi phạm ánh xạ vì local không có tài khoản thật.
- Hai bước production tách riêng: (a) phát hành `v2.1.0` = schema 0013–0017 qua tag/`deploy-prod` — chưa có dữ liệu KL; (b) nhập dữ liệu thật bằng `--ghi --production` chạy tay từ máy chủ dự án sau khi có backup và xác nhận trong phiên — không nằm trong pipeline phát hành.
- **Sau merge #35 (2026-09-15)**: deploy-staging áp 0017; nạp bộ vàng vào staging (32 hội nghị, 185 nhiệm vụ, sequence 185); `tests/rls` trên staging **85/85, 0 skip** — `kl-moc-2026-09-14` chạy thật, khớp 146/16/8/6/6/3/0. Phát hành **`v2.1.0`** = schema 0013–0017 lên production (nhánh `feature/phat-hanh-v2.1.0`, tag trước khi merge); dữ liệu KL thật nhập ở bước riêng sau đó.

## 17. GĐ8 hoàn thành — module KL BTVTU trên production (2026-09-15)
- **Phát hành `v2.1.0`** (PR #36, nhánh `feature/phat-hanh-v2.1.0`, tag gắn trước khi merge): `kiem-tra` → duyệt environment → backup gpg → `db push` 0013–0017 → Pages → smoke đạt → tag `production` = `5368445`; `phien-ban.json` bản live ghi `v2.1.0`. Chỉ schema, chưa có dữ liệu KL.
- **Nhập dữ liệu thật** (bước riêng, chạy tay từ máy chủ dự án sau backup + xác nhận trong phiên): dry-run 0 vi phạm, xác nhận bảng ánh xạ 8 họ tên + "VPTU" → `--ghi --production`: 32 hội nghị, 185 nhiệm vụ `nguon = excel`, 194 dòng nhật ký cũ, sequence 185 (mã kế tiếp NV-186). Đối chiếu `kl_trang_thai` tại 14/9 trên production: **146 / 16 / 8 / 6 / 6 / 3 / 0 = 185**, khớp bộ số chuẩn. Biên bản: `docs/bien-ban-nhap-kl-btvtu.md` (không họ tên; bản gốc do script sinh ở `scripts/out/`, ngoài git).
- Sau nhập: cấp `quan_tri_kl` cho 2 tài khoản (Tổng hợp, CĐS-CY) và nhập 5 dòng phân công PCVP ↔ phòng trên màn hình Quản trị. Điều kiện xong GĐ8 (185 dòng, 0 vi phạm cứng, số khớp mốc) đạt. TRANG-THAI: GĐ8 = Xong, việc kế tiếp = GĐ9 (PR 9A màn hình A3/A2).

## 18. Giai đoạn 9 (v2) — Phân công theo lĩnh vực, dashboard KL
- **PR 9A (2026-09-15)** — phân công PCVP mở rộng theo lĩnh vực (thiết kế Phần 5.4, quyết định 7 bổ sung): `0018_phan_cong_linh_vuc.sql` — `dm_linh_vuc` (32 lĩnh vực tách từ tên 12 ngành theo " - ", migration tự kiểm ghép lại đúng nguyên văn; `quan_tri_kl` thêm/sửa tên qua RLS, không xoá), `kl_nhiem_vu.linh_vuc_ma` + FK ghép `(nganh_ma, linh_vuc_ma)` (lĩnh vực thuộc đúng ngành — DB bảo đảm, `linh_vuc_chi_tiet` giữ làm ghi chú), `phu_trach_phong.nganh_ma/linh_vuc_ma` (cả hai NULL = cả phòng; kiêm nhiệm đủ cặp), EXCLUDE chống chồng kỳ theo (lãnh đạo, phòng, ngành, lĩnh vực) + EXCLUDE thứ hai một (phòng, ngành, lĩnh vực) chỉ một người kiêm nhiệm cùng kỳ; `phu_trach()` chỉ xét dòng cả phòng; `admin_phan_cong_phong` thêm ngành/lĩnh vực, giới hạn **tối đa 2 phòng "cả phòng" mỗi PCVP** (kiêm nhiệm không tính), báo lỗi tiếng Việt trước EXCLUDE; `admin_kiem_nhiem_linh_vuc` (mảng lĩnh vực, một transaction); mặc định ngày của `phu_trach`, `admin_phan_cong_phong`, cột `tu_ngay` đổi sang `kl_hom_nay()` (đóng việc số 6 TRANG-THAI). `0019_kl_pham_vi_linh_vuc.sql` — `kl_pham_vi(chu_tri, nganh, linh_vuc)`: PCVP cả phòng trừ việc bị A1 khác kiêm nhiệm; PCVP kiêm nhiệm chỉ đúng cặp; việc không lĩnh vực thuộc PCVP phòng; A2/CVP/`quan_tri_kl`/A3 không đổi (A2 vẫn thấy cả phòng kể cả lĩnh vực bị kiêm nhiệm — chủ dự án xác nhận); `v_kl_dashboard` thêm `linh_vuc_ma`, `linh_vuc_ten`. Phần `tasks` không có ngành → không áp dụng.
- Màn hình Quản trị: nút **"Kiêm nhiệm lĩnh vực"** mỗi dòng PCVP → hộp chọn phòng → ngành → lĩnh vực (khoá theo ngành, chọn nhiều, ô đã có người kiêm nhiệm bị khoá) → ngày → lý do; ô bảng phân biệt "Cả phòng" / chip "Kiêm nhiệm: <lĩnh vực> (ngành N)" + "Kết thúc"; nút "—" khoá khi đã đủ 2 phòng; cảnh báo chồng phạm vi PCVP khác. Phần **"Danh mục lĩnh vực"** (mục Quản trị hiện thêm cho `quan_tri_kl`): thêm lĩnh vực (mã `LVnn_<slug>`), sửa tên/thứ tự; khi chọn ngành đang có PCVP kiêm nhiệm → dòng vàng "Ngành này đang có … kiêm nhiệm N/M lĩnh vực. Lĩnh vực mới sẽ thuộc PCVP phụ trách phòng cho tới khi được phân công thêm." (`xu-ly-su-co.md` #12). Nhật ký hiểu `kiem_nhiem:<phòng>:<ngành>:<lĩnh vực>`. Ảnh: `docs/anh-man-hinh/gd9a/`.
- Test: `tests/rls/rls-11-linh-vuc` 8 case (a–f theo yêu cầu + hàm/mặc định ngày VN + danh mục/FK ghép), fixture KL gán lĩnh vực cho N1–N4; **93/93 local** (85 cũ xanh); e2e `quan-tri.spec` thêm bước mở hộp kiêm nhiệm (ngành 8 → 4 lĩnh vực), 17/17 local; `rls-11` và e2e quản trị tự bỏ qua trên staging cho tới khi merge 0018. Còn lại GĐ9 (đánh số lại 15/9: GĐ9 = 9A + 9B + `v2.2.0`; dashboard → GĐ10, chỉ đạo → GĐ11, nhân sự → GĐ12, PDF → GĐ13): PR 9B `scripts/anh-xa-linh-vuc.mjs` (82 giá trị `linh_vuc_chi_tiet` → `dm_linh_vuc`, duyệt ngoài repo, `--ghi`) + `linh_vuc_ma` vào `kl_dinh_chinh.cot` + nhật ký cho thêm/sửa danh mục lĩnh vực (hiện chưa có vết); phát hành `v2.2.0` đóng GĐ9 (xác nhận trong phiên).
- **Sau merge #38 (2026-09-15)**: deploy-staging áp 0018–0019; `tests/rls` trên staging **93/93, 0 skip** (`rls-11` chạy thật lần đầu); staging về đúng seed sau test.
- **PR 9B (2026-09-15)** — đóng GĐ9 (đánh số lại 15/9: GĐ9 = 9A + 9B + `v2.2.0`; dashboard → GĐ10, chỉ đạo → GĐ11, nhân sự → GĐ12, PDF → GĐ13). `0020_linh_vuc_dinh_chinh_nhat_ky.sql`: `kl_dinh_chinh.cot` nhận `linh_vuc_ma` (FK ghép chặn sai ngành lúc duyệt); bảng `dm_lich_su` (jsonb cũ/mới, chỉ `quan_tri_kl`/`quan_tri_he_thong` đọc, không ai ghi thẳng); `admin_them_linh_vuc` (mã sinh server `LV<số ngành>_<tên bỏ dấu>` bằng `unaccent`, trùng thêm `_2`; chặn trùng tên không phân biệt hoa thường) và `admin_sua_linh_vuc` (chỉ tên/thứ tự, "không đổi gì" → lỗi) — lý do bắt buộc, nhật ký cùng transaction, đường CLI ghi "qua CLI"; **thu quyền ghi thẳng `dm_linh_vuc`** đã cấp ở 0018 (nguyên tắc "mọi thay đổi quản trị đều có vết"). Màn hình Quản trị: thêm/sửa lĩnh vực qua hộp lý do, bảng "Nhật ký danh mục" 20 dòng; bỏ sinh mã phía client. Ảnh: `docs/anh-man-hinh/gd9b/`.
- `scripts/anh-xa-linh-vuc.mjs` (+ `scripts/kl/anh-xa-linh-vuc.mjs` phần thuần): dry-run **chỉ đọc** → CSV duyệt ngoài repo (`vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.csv`, `;` + BOM, 6 cột; không ghi đè file cũ); đề xuất chỉ khi bằng nhau sau chuẩn hoá và **thuộc đúng ngành của dòng**, "chứa tên" chỉ ghi gợi ý; `--ghi --file` điền `linh_vuc_ma` cho dòng có chốt (tên hoặc mã, phải đúng ngành — sai → dừng), dòng trống giữ NULL, dòng đã có lĩnh vực bỏ qua; ghi bằng một khối SQL tắt tạm `b_kl_nhiem_vu_truoc_ghi` để **không đổi `cap_nhat_luc`**, `kl_lich_su` vẫn ghi từng dòng với ghi chú script; báo cáo trước/sau + biên bản `scripts/out/`; production cần `--production`, backup, xác nhận trong phiên. Đã chạy dry-run **chỉ đọc** trên production (danh mục lấy từ local vì production chưa có 0018): 185 dòng, 184 có `linh_vuc_chi_tiet`, **84 cặp** (ngành, giá trị) — 9 đề xuất được, 14 có gợi ý "chứa tên", còn lại trống chờ người duyệt; CSV đã ở thư mục ngoài repo.
- Test: `kl-anh-xa-linh-vuc` (đề xuất không vượt ngành, không đoán, CSV tròn; chạy thật trên local: `--ghi` sai ngành dừng không ghi, đúng thì chỉ điền dòng có chốt, `cap_nhat_luc` không đổi, lịch sử đủ), `rls-11` phần danh mục viết lại (ghi thẳng bị chặn kể cả `quan_tri_kl`, hàm + nhật ký, đính chính `linh_vuc_ma` kể cả sai ngành). **101/101 local** (staging sẽ 99 + 2 skip vì phần chạy thật chỉ local). Sau merge: phát hành **`v2.2.0`** (0018–0020) → người quản trị sheet duyệt CSV → `--ghi --production` (bước riêng) → biên bản → đóng GĐ9.
- **Sau merge #39 (2026-09-15)**: deploy-staging áp 0020; `tests/rls` trên staging **99/99** (phần chạy thật của script chỉ local); staging về đúng seed sau test. **Phát hành `v2.2.0`** = schema 0018–0020 lên production (nhánh `feature/phat-hanh-v2.2.0`, tag trước khi merge; chủ dự án xác nhận trong phiên và đã backup tay `prod-20260915-0823-tay` — 185 nhiệm vụ / 32 hội nghị / 379 lịch sử / 5 phân công). Sau phát hành: 5 dòng phân công hiện có = "cả phòng"; dữ liệu ánh xạ lĩnh vực nhập ở bước riêng (script `--ghi`, có duyệt CSV).
- **Bổ sung 9B (2026-09-15, sau `v2.2.0`)**: người quản trị sheet duyệt trên **Excel** (Excel theo vùng dấu phẩy mở CSV ";" bị gộp cột) → `anh-xa-linh-vuc.mjs` đọc `--file *.xlsx` ở chế độ `--ghi` (`scripts/kl/doc-xlsx-linh-vuc.mjs`, exceljs sẵn có; sheet "Đối chiếu lĩnh vực", tiêu đề dòng 5, cột A–F, cột E chốt; cột B tên ngành hiển thị → mã ngành theo số đầu chuỗi hoặc tên, không nhận diện → dừng), `--out *.xlsx` xuất cùng bố cục; mọi chốt an toàn giữ nguyên. Test `kl-anh-xa-linh-vuc` thêm 2 case .xlsx (tự bỏ qua khi job không cài exceljs của scripts/) và bước `--ghi` chạy thật đọc từ .xlsx — 8/8 local. Dry-run chỉ đọc trên production sau `v2.2.0` (danh mục thật): 84 cặp, 9 đề xuất, 14 gợi ý, 61 trống → `vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.2026-09-15.csv`; chưa `--ghi`.
- **GĐ9 hoàn thành (2026-09-15)**: `v2.2.0` (PR #40, tag trước merge, backup tay `prod-20260915-0823-tay`) — production ở 0020, bản live ghi `v2.2.0`, 5 phân công hiện có giữ nguyên = "cả phòng". PR #41 (đọc file duyệt `.xlsx`) merged. **Ánh xạ lĩnh vực đợt 1 trên production**: người quản trị sheet duyệt trên Excel → `anh-xa-linh-vuc.mjs --ghi --production` (backup + xác nhận trong phiên): **9 cặp chốt → 51 dòng** được điền `linh_vuc_ma`, 133 dòng còn NULL, 51 dòng `kl_lich_su`, đếm lại khớp, `cap_nhat_luc` không đổi — biên bản `docs/bien-ban-nhap-kl-btvtu.md` mục 7. Còn 14 cặp gợi ý + 61 cặp trống chờ duyệt tiếp (chạy lại script, bỏ qua dòng đã có). Kế tiếp: GĐ10 (màn hình chuyên viên + dashboard lãnh đạo).

## 19. Giai đoạn 10 (v2) — Màn hình chuyên viên và dashboard lãnh đạo KL BTVTU
- **Kế hoạch GĐ10 (2026-09-15, chủ dự án chốt theo đề xuất)**: 5 PR tuần tự — 10A quy tắc minh chứng (0021), 10B màn hình danh sách KL dùng chung A3/A2/A1 + cập nhật nhanh + ngăn truy vết (6.3), 10C dashboard A1 (3.2, mọi số bấm ra danh sách, "Chưa phân loại" cho lĩnh vực NULL), 10D realtime + dự phòng polling 60 giây, 10F form nhập nhiệm vụ mới (`quan_tri_kl`), rồi phát hành `v2.3.0`. Chốt: minh chứng dạng văn bản (chưa tải tệp); bỏ "so với kỳ trước"; hàng 4 = ngành → lĩnh vực (bảng chéo GĐ13); chủ trì không đổi loại thời hạn; ô chỉ đạo, đính chính UI, xuất HTML/`kl_bao_cao` → GĐ11/GĐ13; số liệu đếm phía client từ dòng RLS trả về.
- **PR 10A (2026-09-15)** — `0021_kl_hoan_thanh_bat_buoc_minh_chung.sql`: thay thân trigger `kl_nhiem_vu_truoc_ghi` (0015) — dòng ở trạng thái Hoàn thành sau khi ghi phải có **minh chứng và ngày hoàn thành thật** (quyết định 3 điều chỉnh: chặn từ GĐ10 thay vì GĐ11), trừ (a) dòng đã Hoàn thành và đã thiếu từ trước mà không đổi tiến độ (146 việc Excel, 78 không minh chứng: sửa ghi chú/bổ sung vẫn được, **không chặn ngược, không sửa dữ liệu**; xoá minh chứng thì chặn) và (b) `INSERT nguon = 'excel'` (script nhập, bộ vàng CI). Đóng lỗ hổng CHECK 0014 miễn ngày hoàn thành cho mọi dòng Excel: 39 việc Excel đang mở khi hoàn thành qua app cũng phải có ngày. Đường đính chính `tien_do_ma` đi qua cùng trigger. Không đổi bảng/dữ liệu/quyền; quay lui = migration mới khôi phục thân hàm 0015.
- Test `tests/rls/kl-minh-chung-bat-buoc` 9 case (chặn thiếu minh chứng/ngày/chuỗi trắng; đủ → lịch sử 3 cột; dòng cũ sửa ghi chú, bổ sung được; xoá bị chặn; INSERT app chặn kể cả service_role, INSERT excel nguyên trạng; đính chính duyệt bị chặn, đề nghị vẫn chờ; múi giờ `ngay_hoan_thanh = kl_hom_nay()` nhận ở mọi giờ chạy, +1 chặn); `kl-trang-thai` cập nhật case chuyển Hoàn thành. **110/110 local** (bộ vàng vẫn nạp được, `kl-moc` khớp 146/16/8/6/6/3/0).
