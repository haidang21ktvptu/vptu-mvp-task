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
