# RÀ SOÁT HIỆN TRẠNG — đối chiếu v2.3.0 với phụ lục Công văn 1400

Ngày lập: 16/9/2026, ngay sau khi `v2.3.0` lên production. Thước đo: `MUC-TIEU-1400.md` (mã NT/CN/QT). Nguồn: 21 migration (`0001`–`0021`), `frontend/src` (75 file, ~5 100 dòng), `tests/`, `.github/workflows`, số liệu production đọc ngày 15/9.

**Cách xếp loại**
- **GIỮ** — đúng hoặc trung lập với 1400, đã chạy tốt, không đụng.
- **SỬA** — giữ cấu trúc, đổi/thêm trường, tên, quy tắc để khớp 1400.
- **HỢP NHẤT** — hai thứ cùng vai trò trong hai luồng (giao việc nội bộ `tasks` và KL BTVTU `kl_*`) gộp thành một.
- **BỎ** — không còn chỗ trong mô hình 1400, hoặc bị thứ khác thay thế hoàn toàn.

**Nguyên tắc:** giữ tối đa thứ đã chạy tốt — Supabase Auth, RLS + hàm `security definer`, CI/CD, backup, 185 nhiệm vụ thật, quy tắc minh chứng bắt buộc (0021), realtime, form nhập; không làm lại từ đầu.

## 0. Số liệu nền (production, 15/9/2026)

| Đối tượng | Số | Ý nghĩa cho rà soát |
|---|---|---|
| `accounts` | 49 dòng (A1 5, A2 5, A3 39 — gồm tài khoản hệ thống `smoke_test`; 48 cán bộ thật) | Giữ nguyên |
| `tasks`, `task_evidences`, `task_directives`, `direct_messages` | **0 / 0 / 0 / 0** | Luồng giao việc nội bộ **không có dữ liệu** (đã xoá sạch khi lên v2, SPEC v2 Q1). Hợp nhất không phải chuyển dữ liệu |
| `kl_nhiem_vu` | 185 (`nguon = excel` 185, `app` 0) | Toàn bộ dữ liệu thật nằm ở KL |
| `kl_hoi_nghi` / `kl_lich_su` / `kl_chi_dao` / `kl_dinh_chinh` / `phu_trach_phong` | 32 / 430 / 0 / 0 / 5 | |
| Hoàn thành 146: không ngày hoàn thành 146; thiếu minh chứng 78; có minh chứng (chữ) 76/185 | | CH-6, CH-13 |
| "Có hạn cụ thể" không hạn 65 (62 đã xong + 3 mở có lý do); `linh_vuc_ma` NULL 134 | | CH-8 |
| Cơ quan trình = Văn phòng Tỉnh ủy 29; đơn vị ngoài 156 | | CH-1 |
| `kl_lich_su` `nguon = app`: 51 dòng, **0 người sửa** (đều do script) | | Chưa chuyên viên nào tự cập nhật trên app |

**Kết luận chung:** hai luồng song song là hai cách mô hình hoá **cùng một việc**. Luồng `tasks` (GĐ0–5) có đúng các trường 1400 đòi (sản phẩm đầu ra, mốc nhận V-Office, cấp có thẩm quyền, ngưỡng đỏ đặc biệt, trạng thái Vàng/Đỏ/Đỏ đặc biệt) nhưng rỗng dữ liệu và thiếu mọi thứ KL đã làm tốt (hàm trạng thái có kiểm thử, lịch sử từng cột, đính chính, phạm vi theo phụ trách phòng và lĩnh vực, minh chứng bắt buộc). Luồng KL có dữ liệu, ràng buộc và phần lớn trong 113 test RLS (khoảng 54 test `kl-*`/`rls-10`/`rls-11`; 41 test còn lại thuộc luồng `tasks` sắp bỏ) nhưng thiếu 4 trong 5 thành phần 1-1-1-1-3 ở dạng có cấu trúc (Owner thật, Product, ngày nhận, tệp minh chứng) và không có leo thang tự động. **Hợp nhất = lấy `kl_*` làm thân, ghép các trường của `tasks` vào, bỏ `tasks`.**

---

## 1. Bảng và view trong database

### 1.1 Luồng gốc (0001–0012)

| Đối tượng | Hiện trạng | Đối chiếu 1400 | Xếp loại | Lý do / việc làm |
|---|---|---|---|---|
| `accounts` | 49 cán bộ, `role_group` A1/A2/A3, `is_chief`, `manager_id`, `department`, 5 cờ; quyền cột tường minh; FK `auth.users` | Mô hình 4 cấp cần thêm cấp Thường trực (CH-11) và cấp "đơn vị ngoài" (CH-1) | **GIỮ** (SỬA nhỏ sau khi có CH-11: thêm giá trị `A0` vào CHECK `role_group`) | Nền của Auth/RLS, đã ổn định. `manager_id` chỉ dùng cho `in_my_block` của luồng cũ → sau hợp nhất chỉ còn là thông tin tổ chức |
| `accounts_public` (view) | Hồ sơ không mật khẩu, security_invoker | — | **GIỮ** | Nguồn duy nhất frontend đọc hồ sơ |
| `tasks` | 18 cột: `id`, `title`, `resolution_code`, `expected_product`, `voffice_received_at`, `deadline`, `critical_overdue_days`, `competent_authority`, `status` 6 giá trị, `assigned_to`, `leader_in_charge`, `created_by`, `warning_count`, `last_warned_at`, `completed_at`, `reject_reason`, `created_at`, `owner_id` (mồ côi) | Có đúng các trường NT-2 (`expected_product`), CN-1.1 (`voffice_received_at`), CN-5.2(4) (`competent_authority`), CN-4.3 (`critical_overdue_days`). Nhưng `status` có `CHO_TIEP_NHAN`/`TU_CHOI_TIEP_NHAN`/`CHO_DUYET` là trạng thái quy trình nội bộ — CN-1.2 loại trường định tính, CN-2.2 luân chuyển không dừng đồng hồ | **HỢP NHẤT → `nhiem_vu`** rồi **BỎ** bảng | 0 dòng nên không chuyển dữ liệu. Mang sang `nhiem_vu`: `san_pham` (← `expected_product`), `ngay_nhan_van_ban` (← `voffice_received_at`), `cap_quyet_dinh` (← `competent_authority`), `owner_tai_khoan` (← `assigned_to`), `nguoi_theo_doi`/lãnh đạo (← `leader_in_charge`), `tao_boi` (← `created_by`). **Không** mang: `status` quy trình (tiếp nhận/từ chối/chờ duyệt — thay bằng hành động ghi vết không đổi trạng thái, xem SPEC 4.3), `critical_overdue_days` theo từng việc (→ tham số chung `kl_cau_hinh`, CH-10), `warning_count`/`last_warned_at` (→ bảng `canh_bao` tự động), `owner_id` mồ côi |
| `task_evidences` | `document_title`, `file_url` (URL, kiểm trong hàm), `is_approved`, `reviewed_at`, `uploaded_by` không FK, `note` không dùng | NT-4/CN-3.1 đòi **tệp** đính kèm; CN-3.2 đòi đã gửi đúng cấp. Bảng này gần hơn KL (chỉ có ô chữ `minh_chung`) vì cho **nhiều minh chứng/một việc** và có duyệt | **HỢP NHẤT → bảng `minh_chung` mới** rồi BỎ | Lấy ý tưởng "một việc nhiều minh chứng, có người duyệt"; thêm `tep_path` (Storage), `so_hieu`, `ngay_van_ban`, `cap_nhan`, `loai` (`tep`/`so_hieu`/`chu_cu`). Ô chữ `kl_nhiem_vu.minh_chung` giữ làm di sản (CH-6) |
| `task_directives` | Bình luận theo task, `is_read` chung, `recipient_id` không dùng | Không có trong 1400; nhưng "vòng chỉ đạo" (đôn đốc/gia hạn/giao lại/yêu cầu minh chứng) là cách lãnh đạo can thiệp vào việc Đỏ (QT-5) | **HỢP NHẤT → `chi_dao`** (từ `kl_chi_dao`) rồi BỎ | `kl_chi_dao` đã có 5 loại, hạn phản hồi, trạng thái; thêm loại `Y_KIEN` (bình luận tự do) để không mất tính năng luồng ý kiến; đã đọc theo người bằng bảng `chi_dao_da_doc` (ý tưởng DIR-3 của SPEC v2) |
| `direct_messages` | Nhắn 1-1, realtime | CN-4.1 "nhắc nhở 1:1" — chính là kênh gửi thông báo trong app | **GIỮ**, SỬA nhỏ | Thêm `loai` (`tin_nhan`/`he_thong`) và `nhiem_vu_id` nullable để tin hệ thống trỏ về việc; tin hệ thống có `sender_id NULL` + `loai = he_thong`, ghi qua hàm của job (không dùng tài khoản nào làm "người gửi") (CH-12) |
| `view_exception_dashboard` | Tính `alert_level` XANH/VANG/DO/DO_DAC_BIET từ `tasks`, security_invoker | Đúng tinh thần CN-5 nhưng trên bảng sẽ bỏ; thiếu 2/4 trường bắt buộc ("sản phẩm còn thiếu", "cấp cần quyết định" có nhưng tự do) | **BỎ**, thay bằng `v_ngoai_le` từ `nhiem_vu` | Logic màu chuyển vào hàm `trang_thai()` (một nguồn duy nhất, đã là nguyên tắc GĐ8) |
| `auth_failed_attempts` + hook khoá 15 phút | Có sẵn, hook tắt (gói Free) | — | **GIỮ** | Bật khi lên Pro (việc GĐ7 còn lại) |
| `quyen_lich_su` | Nhật ký cấp quyền, append-only | — | **GIỮ** | |
| `phu_trach_phong` | PCVP ↔ phòng ↔ (ngành, lĩnh vực), hiệu lực theo ngày, 2 EXCLUDE | Là cách xác định "thủ trưởng trực tiếp"/lãnh đạo phụ trách cho leo thang Đỏ (CN-4.2) | **GIỮ** | Trở thành nguồn duy nhất về phạm vi lãnh đạo, thay `manager_id` cho cả phần giao việc nội bộ (việc số 7 trong TRANG-THAI mục 6) |

### 1.2 Module KL BTVTU (0013–0021)

| Đối tượng | Hiện trạng | Đối chiếu 1400 | Xếp loại | Lý do / việc làm |
|---|---|---|---|---|
| `dm_nganh` (12), `dm_linh_vuc` (32), `dm_lich_su` | Danh mục chuẩn hoá, sửa chỉ qua hàm có lý do | Không có trong 1400, nhưng là trục phân công PCVP kiêm nhiệm và bảng hàng 4 dashboard | **GIỮ** | |
| `dm_co_quan_trinh` (13) | Tên nguyên văn sheet | Đây chính là **danh mục Owner** (NT-1, CH-1) | **SỬA** → `dm_don_vi` | Thêm 5 dòng cho 5 phòng của Văn phòng (mã = `department`) để "Owner là phòng" cùng một cột; thêm cột `trong_van_phong boolean`, `phong` (chỉ dòng phòng), `lanh_dao_phu_trach` nullable (lãnh đạo Văn phòng phụ trách theo dõi đơn vị ngoài — CH-4b); giữ 13 mã cũ, không đổi tên hiển thị |
| `dm_loai_thoi_han` (4) | Có hạn cụ thể / Ký ban hành / Thường xuyên / Chờ quyết định | NT-3 "1 Deadline": hai loại sau không có hạn | **SỬA** | Thêm cột `cho_phep_tao_moi boolean` (CH-8: A → chỉ 2 loại đầu cho việc mới); giữ 4 mã cho dữ liệu cũ |
| `dm_tien_do` (2) | Đang thực hiện / Hoàn thành | CN-1.2: không trường định tính. Hai giá trị này không định tính (là "mở/đóng") | **GIỮ** | Đổi nhãn hiển thị: "Đang mở" / "Đã đóng" (QT-4 "ĐÓNG nhiệm vụ") — chỉ ở frontend |
| `kl_cau_hinh` | 4 khoá: sắp đến hạn 7, hạn phản hồi 2, ký ban hành 10, không cập nhật 30 | CN-4: Vàng 3 ngày, Đỏ đặc biệt 3–5 ngày | **SỬA** | Thêm `nguong_vang_ngay = 3`, `nguong_do_dac_biet_ngay = 3` (CH-10), `ngay_ra_soat_toi_da = 30` (CH-8); `nguong_sap_den_han_ngay` (7) giữ làm ngưỡng trạng thái "Sắp đến hạn" hoặc gộp với Vàng (câu phụ CH-10b quyết) |
| `kl_hoi_nghi` | Số hội nghị + số KL + ngày ban hành, UNIQUE, trigger ngày ≤ hôm nay, đổi ngày → tính lại hạn | QT-1 "văn bản đến được nhận → tạo nhiệm vụ": văn bản là thực thể gốc; hội nghị BTV chỉ là một loại | **SỬA** → `van_ban_giao_viec` (CH-14) | Thêm `loai` (KL_BTV / TB_THUONG_TRUC / NQ_TW / CONG_VAN / KHAC), `co_quan_ban_hanh`, `ngay_nhan` (mốc đếm cấp văn bản, CN-1.1), `so_hoi_nghi` nullable; 32 dòng cũ `loai = KL_BTV` |
| `kl_nhiem_vu` | 25 cột (xem kiểm kê); CHECK hạn/ngày hoàn thành; 3 trigger (guard cột theo chủ trì, chuẩn hoá + minh chứng bắt buộc 0021, lịch sử); `thieu_minh_chung` generated; realtime | Thiếu ở dạng có cấu trúc: Owner đúng nghĩa (có `co_quan_trinh_ma` nhưng RLS/dashboard lấy `chu_tri_id`), Product, ngày nhận, tệp minh chứng, cấp quyết định, cha–con, màu cảnh báo | **SỬA** → `nhiem_vu` (thân của thực thể thống nhất) | Thêm: `owner_don_vi_ma` (← `co_quan_trinh_ma`, bắt buộc), `owner_tai_khoan` nullable, `nguoi_theo_doi` (← đổi tên `chu_tri_id`), `san_pham_loai` + `san_pham_mo_ta`, `cap_nhan_san_pham`, `cap_quyet_dinh`, `ngay_nhan_van_ban` + `ngay_nhan_uoc_tinh`, `nhiem_vu_cha`, `dong_luc` (← `ghi_hoan_thanh_luc`), `lead_time_ngay` (tính). Giữ nguyên mọi CHECK/trigger/lịch sử; migration đổi tên bảng + cột bằng `ALTER … RENAME` để 185 dòng và 430 dòng lịch sử không di chuyển |
| `kl_lich_su` | Trigger ghi từng cột, `nguon` excel/app/dinh_chinh | Không có trong 1400; là nền của truy vết (thiết kế Phần 6) | **GIỮ** (đổi tên `lich_su`) | |
| `kl_chi_dao` | Bảng + RLS, 5 loại, **không có GRANT UPDATE, chưa có hàm, frontend chưa dùng** | Cách lãnh đạo can thiệp việc Đỏ (QT-5) | **SỬA** (thành `chi_dao`, hợp nhất `task_directives`) | Thêm hàm `chi_dao_gui`, `chi_dao_phan_hoi`, `chi_dao_dong`; loại `Y_KIEN`; bảng đã đọc theo người |
| `kl_dinh_chinh` + 2 hàm | Đề nghị → duyệt bởi `quan_tri_kl` khác người đề nghị; UI chưa gọi | Không có trong 1400; giữ vì bảo đảm "một việc sai không đứng nguyên màu đỏ" | **GIỮ** (đổi tên) | UI ở giai đoạn sau |
| `v_kl_dashboard` | Mọi cột + `kl_trang_thai` + tên hiển thị + lĩnh vực | Thiếu màu cảnh báo, lead time, Owner đúng nghĩa, "sản phẩm còn thiếu", "cấp cần quyết định" | **SỬA** → `v_nhiem_vu` (+ `v_ngoai_le` chỉ Đỏ/Đỏ đặc biệt với 4 trường CN-5.2) | |
| `kl_trang_thai_kq` (type) | 7 trường | Cần thêm `muc_canh_bao` (XANH/VANG/DO/DO_DAC_BIET/KHONG_AP_DUNG), `lead_time_ngay` | **SỬA** | |

---

## 2. Hàm, RPC, trigger

| Hàm | Vai trò | Xếp loại | Lý do |
|---|---|---|---|
| `me_role`, `me_dept`, `me_is_chief`, `in_my_dept`, `me_quan_tri_kl`, `me_quan_tri_he_thong` | Helper vai trò | **GIỮ** | |
| `in_my_block`, `task_in_scope`, `can_assign_to`, `can_see_task`, `is_task_party`, `tasks_guard_a3` | Phạm vi luồng `tasks` theo `manager_id` | **BỎ** cùng bảng `tasks` | Phạm vi thống nhất tính bằng `kl_pham_vi` mở rộng (theo `phu_trach_phong`); `manager_id` không còn là nguồn phân quyền — thống nhất với quyết định 7 của thiết kế KL |
| `assign_task` | Giao việc nội bộ (INSERT `tasks`) | **HỢP NHẤT** → `giao_viec(p jsonb)` trên `nhiem_vu` | Giữ ý tưởng "một hàm, kiểm quyền bên trong, payload jsonb"; thêm kiểm 1-1-1-1-3 (Owner, Product, Deadline bắt buộc) và cha–con |
| `submit_evidence`, `approve_task` | Nộp URL → chờ duyệt → duyệt = hoàn thành | **HỢP NHẤT** → `nop_minh_chung` (tệp/số hiệu, nhiều lần) + `dong_nhiem_vu` (chốt lead time, QT-4) | Bỏ bước "chờ duyệt" như một **trạng thái**; người duyệt (lãnh đạo/người theo dõi) xác nhận minh chứng hợp lệ là một **hành động** ghi vết; nút Đóng chỉ sáng khi có minh chứng hợp lệ (CN-3.1) |
| `warn_task` | Tăng `warning_count` thủ công | **BỎ** | Thay bằng cảnh báo tự động (CN-4) + chỉ đạo "Đôn đốc" ghi vết |
| `mark_directives_read` | Đã đọc chung | **HỢP NHẤT** → `chi_dao_da_doc` | |
| `mark_messages_read` | Đã đọc tin nhắn | **GIỮ** | |
| `handle_password_changed`, `hook_password_verification_attempt`, `admin_set_must_change_password` | Auth | **GIỮ** | |
| `admin_dat_co`, `admin_kiem_tra_nguoi_goi`, `phu_trach`, `nguoi_kiem_nhiem`, `admin_phan_cong_phong`, `admin_kiem_nhiem_linh_vuc`, `kl_kiem_tra_quan_tri_kl`, `kl_sinh_ma_linh_vuc`, `admin_them_linh_vuc`, `admin_sua_linh_vuc` | Quản trị có vết | **GIỮ** | Toàn bộ nguyên tắc "mọi thay đổi quản trị đều có vết" giữ nguyên |
| `kl_hom_nay` | Hôm nay giờ Việt Nam | **GIỮ** (SỬA nhỏ: thêm `SET search_path`) | |
| `kl_trang_thai`, `kl_tinh_trang_thai` | Nguồn duy nhất của trạng thái | **SỬA** → `trang_thai` | Thêm màu cảnh báo và lead time; giữ 8 test biên + test mốc 14/9; thêm test màu tại 17–23h UTC |
| `kl_pham_vi`, `kl_thay_nhiem_vu`, `kl_duoc_chi_dao` | Phạm vi đọc/chỉ đạo KL | **SỬA** | Thêm nhánh Owner là tài khoản (`owner_tai_khoan = uid()`), phòng của Owner khi Owner là phòng/chuyên viên; A0 Thường trực (nếu CH-11 = A) thấy Đỏ đặc biệt |
| Trigger `a_…guard_a3`, `b_…truoc_ghi` (0021), `c_…lich_su`, `kl_hoi_nghi_*` | Ràng buộc + lịch sử | **GIỮ** (đổi tên, mở rộng danh sách cột) | Quy tắc minh chứng bắt buộc 0021 giữ nguyên và chuyển sang bảng `minh_chung` |
| `kl_de_nghi_dinh_chinh`, `kl_duyet_dinh_chinh` | Đính chính | **GIỮ** | |

---

## 3. Policy RLS (theo nhóm)

| Nhóm policy | Xếp loại | Ghi chú |
|---|---|---|
| `accounts_select`, `accounts_update_a1` + GRANT 4 cột | **GIỮ** | `accounts_update_a1` chưa có UI — giữ, không mở thêm |
| `tasks_*`, `directives_*`, `evidences_*` (8 policy) | **BỎ** cùng bảng | Thay bằng policy trên `nhiem_vu`, `minh_chung`, `chi_dao` theo mẫu KL (`kl_pham_vi`) |
| `messages_select/insert` | **GIỮ** (SỬA: cho phép `sender_id NULL` với `loai = he_thong` qua hàm) | |
| `quyen_lich_su_select_qtht`, `phu_trach_phong_select` | **GIỮ** | |
| `dm_*_select`, `dm_lich_su_select_quan_tri`, `kl_cau_hinh_*` | **GIỮ** | `kl_cau_hinh_update_qtkl` GRANT toàn bảng → SỬA thành cập nhật qua hàm có lý do (cùng nguyên tắc có vết) |
| `kl_hoi_nghi_*`, `kl_nhiem_vu_select/insert_qtkl/update_qtkl/update_chu_tri`, `kl_lich_su_select`, `kl_chi_dao_*`, `kl_dinh_chinh_select` | **SỬA** | Đổi tên bảng; `update_chu_tri` → `update_owner_hoac_theo_doi` (Owner tài khoản và người theo dõi đều cập nhật được cột cho phép); thêm `insert` cho lãnh đạo giao việc trong phạm vi (không chỉ `quan_tri_kl`) |
| Quy tắc 7 của CLAUDE.md (A3 không xem việc người khác; A2 phòng mình; CVP tất cả; PCVP khối phụ trách) | **GIỮ** nguyên văn | Kiểm bằng test RLS; "khối" = `phu_trach_phong` |

**Đường ghi thẳng bảng từ frontend** (`direct_messages`, `task_directives`, `tasks` UPDATE, `kl_hoi_nghi`/`kl_nhiem_vu` INSERT/UPDATE): SỬA theo nguyên tắc đã chốt "mọi thao tác nhiều bước qua hàm"; `nhiem_vu` UPDATE 7 cột của người theo dõi có thể giữ ghi thẳng (trigger guard + lịch sử đã chặn đúng), còn giao việc, nộp minh chứng, đóng, chỉ đạo đi qua hàm.

---

## 4. Màn hình và mã frontend

| Màn hình / module | File | Xếp loại | Việc làm |
|---|---|---|---|
| Đăng nhập, đổi mật khẩu bắt buộc, phiên, khung app, thanh bên, toast, modal, token màu | `auth/*`, `views/shell.js`, `components/toast.js`, `styles/*` | **GIỮ** | DESIGN.md không đổi |
| A1 — Bảng điều khiển ngoại lệ (`view_exception_dashboard`) | `views/a1/dashboard.js`, `template.js` | **HỢP NHẤT** vào dashboard thống nhất | 1400 CN-5: **một** dashboard ngoại lệ chỉ hiện Đỏ/Đỏ đặc biệt với 4 trường; phần "tình hình chung" là màn hình Tổng quan KL đã có (10C) |
| A1 — Form "Lãnh đạo Văn phòng giao việc" | `views/a1/template.js` | **HỢP NHẤT** vào form giao việc thống nhất (`them-modal.js`) | Form 10F đã có hội nghị → ngành → lĩnh vực; thêm Owner/Product/Deadline/ngày nhận/cấp nhận |
| A1 — Cây cán bộ thuộc quyền + KPI | `views/a1/tree.js`, `views/shared/kpi.js`, `inline-tasks.js` | **SỬA** | Đọc từ `v_nhiem_vu` (Owner là tài khoản) thay `tasks`; KPI theo màu cảnh báo từ hàm trạng thái, không tự tính 3 ngày ở client |
| A1 — Tổng quan KL BTVTU (10C) | `views/a1/kl-dashboard/*` | **GIỮ**, SỬA nhãn | Đổi "theo chủ trì" → "theo người theo dõi"/"theo Owner" (CH-2); thêm ô Đỏ đặc biệt; hàng 1 trỏ sang dashboard ngoại lệ |
| A2 — Theo dõi và duyệt / Giao việc / KPI phòng | `views/a2/*` | **HỢP NHẤT** vào danh sách nhiệm vụ dùng chung (10B) + form giao việc thống nhất | Danh sách 10B đã lọc theo RLS; thêm bộ lọc "phòng tôi" và cột Owner; "duyệt hoàn thành" thành hành động xác nhận minh chứng trên ngăn chi tiết |
| A3 — Nhiệm vụ của tôi | `views/a3/index.js`, `template.js` | **HỢP NHẤT** vào danh sách dùng chung | Đã có màn hình KL dùng chung mọi vai trò; giữ thứ tự sắp xếp của A3 (quá hạn → sắp hạn → đang làm → xong) — 10B đã có |
| A3 — Modal bắt buộc tiếp nhận / từ chối | `views/a3/accept-modal*.js` | **SỬA** → "Xác nhận đã nhận việc" **không đổi trạng thái, không dừng đồng hồ** (CN-2.2); từ chối = gửi chỉ đạo ngược loại `PHAN_HOI` có lý do | Giữ UX modal bắt buộc, bỏ trạng thái `CHO_TIEP_NHAN`/`TU_CHOI_TIEP_NHAN` |
| A3 — Modal nộp minh chứng (URL) | `views/a3/evidence-modal*.js` | **HỢP NHẤT** với modal cập nhật KL → "Nộp minh chứng" (tệp + số hiệu + ngày + cấp nhận) | CH-6 |
| Modal phân công / đổi cán bộ | `features/tasks/reassign*.js` | **HỢP NHẤT** → chỉ đạo "Giao lại" (đã có loại `GIAO_LAI`) | |
| Luồng ý kiến chỉ đạo inline | `features/directives/*` | **HỢP NHẤT** → `chi_dao` | Giữ UI luồng inline + huy hiệu chưa đọc (đã có e2e realtime) |
| Nhắn tin 1-1 + toast realtime | `features/messages/*`, `features/realtime.js` | **GIỮ**, SỬA nhỏ | Thêm tin hệ thống (cảnh báo tự động) vào cùng danh sách; gộp hai kênh realtime (`realtime_feed`, `kl_feed`) thành một |
| Danh sách KL (10B), ngăn chi tiết "vì sao đỏ", cập nhật nhanh, thêm nhiệm vụ (10F), realtime + dự phòng (10D) | `views/shared/kl/*`, `lib/kl/*`, `features/kl-realtime.js` | **GIỮ**, SỬA | Đổi nhãn "Kết luận BTVTU" → "Nhiệm vụ"; thêm cột Owner, Product, màu; cập nhật nhanh thêm ngày nhận và sản phẩm; ngăn chi tiết thêm dòng "Sản phẩm còn thiếu", "Cấp cần quyết định" |
| Quản trị hệ thống (cờ, phụ trách phòng, kiêm nhiệm, danh mục, nhật ký) | `views/shared/quan-tri/*` | **GIỮ** | Thêm phần "Danh mục đơn vị" (lãnh đạo phụ trách đơn vị ngoài, CH-4b) và "Tham số cảnh báo" qua hàm có lý do |
| `lib/state.js` (`allTasks`, `taskParties`), `lib/constants.js` (nhãn `tasks.status`) | | **SỬA** | Bỏ từ vựng trạng thái cũ; nhãn màu Vàng/Đỏ/Đỏ đặc biệt dùng chung |
| Trùng lặp: `linhVucCuaNganh` ở 2 nơi, 2 cache danh mục, `todayLocal` vs `homNayVN` | | **SỬA** | Gộp khi đụng tới file — không mở PR riêng |

---

## 5. Kiểm thử, CI/CD, vận hành

| Đối tượng | Xếp loại | Ghi chú |
|---|---|---|
| `tests/rls` 113 test (local) — trong đó `rls-3-4-tasks`, `rls-5-7-directives-evidences`, phần `tasks` của `rls-6-8` | **GIỮ** khung; **BỎ** các file test bảng bị bỏ, **SỬA** thành test trên `nhiem_vu`/`minh_chung`/`chi_dao` giữ nguyên ma trận vai trò | Quy tắc 7 CLAUDE.md phải có test cho mọi bảng mới |
| `kl-trang-thai`, `kl-minh-chung-bat-buoc`, `kl-pham-vi-tong-hop`, `kl-moc-2026-09-14`, `rls-9/10/11` | **GIỮ** (đổi tên bảng) | Bộ số 146/16/8/6/6/3/0 tại 14/9 phải giữ nguyên sau hợp nhất — là test hồi quy của việc đổi tên |
| e2e `nhiem-vu.spec.js` (giao → nhận → nộp → duyệt) | **SỬA** | Kịch bản mới: giao (Owner/Product/Deadline) → xác nhận nhận (đồng hồ không dừng) → nộp tệp → đóng |
| e2e `dang-nhap`, `realtime`, `quan-tri`, `kl-*` | **GIỮ** | |
| `ci.yml`, `deploy-staging.yml`, `deploy-prod.yml`, `backup-dinh-ky.yml`, ruleset `main`, secrets | **GIỮ** | Vừa rút gọn ở PR #50 |
| Backup 3 ngày/lần + tay, `sao-luu-khoi-phuc.md`, `xu-ly-su-co.md` 13 tình huống | **GIỮ** | Thêm tình huống "cảnh báo tự động không chạy" khi có pg_cron |
| Script `nhap-kl-btvtu.mjs`, `an-danh-kl-btvtu.mjs`, `anh-xa-linh-vuc.mjs`, bộ dữ liệu vàng | **GIỮ**, SỬA tên bảng | Bộ vàng ẩn danh là fixture hồi quy của hợp nhất |
| `docs/thiet-ke-theo-doi-kl-btvtu.md` | **GIỮ** làm tài liệu lịch sử, đóng băng | Dòng đầu file trỏ sang SPEC v3 + tài liệu này |
| `docs/SPEC.md` v2 | **GIỮ** dưới tên `SPEC-v2-luu.md` | Tra cứu mã yêu cầu cũ |

---

## 6. Khoảng trống so với 1400 (những gì chưa có ở đâu)

| Mã 1400 | Khoảng trống | Có gì để tận dụng | Câu hỏi liên quan |
|---|---|---|---|
| NT-1 Owner | Owner đúng nghĩa (đơn vị hoặc tài khoản) chưa là trục dữ liệu; RLS/dashboard theo người theo dõi | `dm_co_quan_trinh` 13 đơn vị, `chu_tri_id`, `tasks.assigned_to` | CH-1, CH-2, CH-4 |
| NT-2 Product | Không có cột nào; `tasks.expected_product` là chữ tự do, 0 dòng | | CH-5 |
| NT-3 Deadline | 65 việc không hạn; 2 loại thời hạn không hạn | Hàm trạng thái, CHECK "có hạn hoặc lý do" | CH-8 |
| NT-4 Evidence | Chỉ chữ; không tệp; không "cấp nhận" | 0021 bắt buộc khi Hoàn thành; `task_evidences` mẫu nhiều minh chứng | CH-6, CH-7 |
| NT-5 / CN-4 | **Không có leo thang tự động nào**: không job, không thông báo, không đẩy lên cấp trên; `warn_task` thủ công | `direct_messages` realtime; `phu_trach_phong` để tìm lãnh đạo; `kl_cau_hinh` | CH-10, CH-12 |
| CN-1.1 | Không có ngày nhận văn bản; đếm từ ngày ban hành | `tasks.voffice_received_at` (ý tưởng), `kl_hoi_nghi.ngay_ban_hanh` | CH-9 |
| CN-1.2 | `tasks.status` có trạng thái quy trình; KL thì đúng (chỉ mở/đóng) | | — |
| CN-2.1 Lead time | Không tính | `ghi_hoan_thanh_luc`, `ngay_hoan_thanh` | CH-9, CH-13 |
| CN-3.1 Nút Hoàn thành khoá | Có ở mức form + trigger (0021) cho chữ | | CH-6 |
| CN-4.3 / CN-5 Dashboard Thường trực | Không có màn hình/vai trò Thường trực; dashboard A1 hiện mọi trạng thái | Dashboard 10C, `v_kl_dashboard` | CH-11 |
| CN-5.2 (3) (4) | "Sản phẩm còn thiếu" = Product (chưa có); "Cấp nào cần quyết định" chưa có | `tasks.competent_authority` (ý tưởng) | CH-5, CH-7 |
| CĐ-1 chuỗi 4 cấp (bổ sung của chủ dự án, MUC-TIEU mục V) | Không có cha–con; 5 phòng chưa có việc; "Owner là phòng" chưa biểu diễn được | `department`, `phu_trach_phong` | CH-3 |
| CV-4 V-Office | Ngoài phạm vi kỹ thuật hiện tại (không có API); thiết kế trường để nối sau | | CH-9 |

---

## 7. Tổng hợp

| Xếp loại | Bảng/view | Hàm/trigger | Policy | Màn hình/module | Hạ tầng |
|---|---|---|---|---|---|
| GIỮ | 14 | 20 | 12 | 10 | tất cả |
| SỬA | 8 | 6 | 9 | 7 | — |
| HỢP NHẤT | 3 (`tasks`, `task_evidences`, `task_directives`) | 4 | — | 7 | — |
| BỎ | 2 (`tasks` sau hợp nhất, `view_exception_dashboard`) + 2 bảng con | 7 | 8 | — | — |

Điểm cần nhấn: **không có gì trong hạ tầng bị bỏ**; phần bỏ là luồng giao việc nội bộ rỗng dữ liệu, được thay bằng chính thực thể KL mở rộng. Rủi ro lớn nhất không phải kỹ thuật mà là nghiệp vụ — 15 câu hỏi trong `CAU-HOI-NGHIEP-VU.md` phải được chốt trước migration `0022`.
