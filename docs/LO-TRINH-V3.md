# LỘ TRÌNH V3 — từ v2.3.0 tới hệ thống theo phụ lục 1400

Ngày lập: 16/9/2026. Đầu vào: `SPEC.md` v3, `RA-SOAT-HIEN-TRANG.md`, `CAU-HOI-NGHIEP-VU.md`. Nguyên tắc: **giai đoạn nhỏ, production luôn chạy được sau mỗi phát hành**, migration additive trước, destructive sau một phát hành; mỗi PR một việc, mở tuần tự; phát hành bằng tag trước merge (`kien-truc.md` mục 7); migration đánh số từ **0022**.

Ước lượng tính bằng **ngày làm việc của một phiên Claude Code có chủ dự án review** (không phải ngày lịch); mỗi PR gồm mã + test + tài liệu. Mã 1400 ghi trong ngoặc là đích của giai đoạn.

## Điều kiện trước khi bắt đầu

| # | Việc | Ai | Chặn giai đoạn |
|---|---|---|---|
| T1 | Chốt **CH-1, 2, 3, 5, 6, 7, 8 (+8b), 9, 10 (+10b), 14** — vì migration 0022 đã tạo cột cha–con (CH-3), danh mục cấp (CH-7), ngưỡng cảnh báo (CH-10) | Chủ dự án | GĐ14 |
| T2 | Chốt CH-4, CH-11, CH-12, CH-13, CH-15 | Chủ dự án | GĐ16, GĐ17 |
| T3 | Lên gói Supabase Pro (đã trong việc GĐ7 còn lại) → bật `pg_cron`, Storage đủ dung lượng, hook khoá tài khoản | Chủ dự án | GĐ15 (Storage), GĐ16 (cron) |
| T4 | Backup tay production trước mỗi phát hành (nếp cũ) | Chủ dự án + Claude | mọi GĐ |

Đánh số giai đoạn tiếp GĐ13 của kế hoạch cũ; GĐ11–13 cũ (vòng chỉ đạo, quản trị nhân sự, xuất PDF) **không bỏ**, được xếp lại vào các giai đoạn dưới.

---

## GĐ14 — Thực thể thống nhất (NT-1, NT-2, NT-3, QT-1, CN-1.2, CN-2.2, CĐ-1…3) · ước 4–5 ngày · phát hành `v3.0.0`

Mục tiêu: một bảng `nhiem_vu` chứa 185 việc với Owner, Product, ngày nhận, cấp; luồng `tasks` ngừng dùng nhưng chưa drop. Số 14/9 không đổi. Không có tính năng mới nhìn thấy ngoài form.

| PR | Nội dung | Migration | Kiểm chứng |
|---|---|---|---|
| 14A | Danh mục mới + cột mới (additive): `dm_don_vi` (← `dm_co_quan_trinh` + 2 cột), `dm_san_pham`, `dm_cap`, `dm_loai_thoi_han.cho_phep_tao_moi`, `kl_cau_hinh` 3 khoá; `kl_nhiem_vu` thêm `owner_tai_khoan`, `san_pham_loai/mo_ta`, `cap_nhan_san_pham`, `cap_quyet_dinh`, `ngay_nhan_van_ban` + `ngay_nhan_uoc_tinh` (điền = ngày ban hành cho 185 dòng), `nhiem_vu_cha`, `theo_1400 = false`; `kl_hoi_nghi` thêm `loai = KL_BTV`, `ngay_nhan`, `co_quan_ban_hanh` | `0022_thuc_the_thong_nhat_cot.sql` | RLS 113 test xanh không đổi; test mới: CHECK deadline con ≤ cha, ngày nhận ∈ [ban hành, hôm nay]; test mốc 14/9 xanh |
| 14B | Đổi tên: `kl_nhiem_vu → nhiem_vu`, `kl_hoi_nghi → van_ban_giao_viec`, `kl_lich_su → lich_su`, `kl_chi_dao → chi_dao`, `kl_dinh_chinh → dinh_chinh`, cột `chu_tri_id → nguoi_theo_doi`, `co_quan_trinh_ma → owner_don_vi_ma`, `hoi_nghi_id → van_ban_id`, `ghi_hoan_thanh_luc → dong_luc`; hàm `kl_trang_thai → trang_thai` (thêm `muc_canh_bao`, `lead_time_ngay`); view `v_nhiem_vu`; **giữ bí danh** `v_kl_dashboard`, `kl_trang_thai` (wrapper) một phát hành để frontend cũ vẫn chạy; `kl_pham_vi` thêm nhánh Owner tài khoản | `0023_doi_ten_thuc_the.sql` | Toàn bộ test đổi tên bảng; bộ số 14/9; test màu 4 mức tại 3 mốc ngày kể cả 17–23h UTC; `kl-pham-vi-tong-hop` không ai mất việc |
| 14C | Hàm `giao_viec(p jsonb)` (thay `assign_task`, kiểm 1-1-1-1-3 theo `theo_1400`), `xac_nhan_nhan_viec()` (ghi vết, không đổi trạng thái); form giao việc thống nhất (mở rộng `them-modal`: văn bản → Owner đơn vị/tài khoản → Product → ngày nhận → deadline → cấp nhận → ngành/lĩnh vực → người theo dõi); danh sách 10B thêm cột Owner/Product/màu, nhãn "Nhiệm vụ" | — | e2e: giao việc mới đủ 1-1-1 → dòng XANH; thiếu Product bị chặn; việc cũ vẫn cập nhật được không cần Product |
| 14D | Chuyển màn hình A1/A2/A3 luồng `tasks` sang đọc `v_nhiem_vu` (cây cán bộ, KPI phòng, nhiệm vụ của tôi = danh sách dùng chung với bộ lọc mặc định); bỏ form giao việc A1/A2 cũ, modal tiếp nhận → "xác nhận đã nhận"; `state.allTasks` → dòng `v_nhiem_vu` | — | e2e `nhiem-vu.spec` viết lại; e2e cũ 43 test xanh |
| 14E | Phát hành `v3.0.0` (docs + tag) | — | Kiểm 3 vai + `quan_tri_kl` trên bản live; đối chiếu bộ số với sheet một lần (`[CH-15]`) |

Rủi ro: đổi tên bảng đụng script nhập/ẩn danh/ánh xạ (`scripts/kl/*`) và bộ dữ liệu vàng → sửa trong 14B, CI cục bộ bắt.

## GĐ15 — Minh chứng và đóng nhiệm vụ (NT-4, CN-3, QT-4) · ước 3–4 ngày · `v3.1.0`

| PR | Nội dung | Migration | Kiểm chứng |
|---|---|---|---|
| 15A | Bảng `minh_chung`; chuyển 76 minh chứng chữ thành dòng `loai = chu_cu` (tách số hiệu/ngày khi nhận dạng được, giữ nguyên văn); trigger 0021 chuyển sang kiểm `EXISTS minh_chung hợp lệ` khi đóng việc `theo_1400` (việc cũ giữ quy tắc chữ); hàm `nop_minh_chung()`, `xac_nhan_minh_chung()`, `dong_nhiem_vu()` (chốt lead time) | `0024_minh_chung.sql` | Test: đóng không minh chứng bị chặn; chữ cũ không bị coi vi phạm; Owner không tự xác nhận; lead time đúng |
| 15B | Supabase Storage bucket `minh-chung` + policy theo `kl_pham_vi`; modal "Nộp minh chứng" (tệp ≤ 20 MB + số hiệu + ngày + cấp nhận) thay modal URL và ô chữ; nút "Đóng nhiệm vụ" chỉ sáng khi có minh chứng hợp lệ; ngăn chi tiết liệt kê minh chứng | `0025_storage_minh_chung.sql` (policy Storage) | Test Storage 3 vai (NF-12); e2e: tải PDF giả → nút Đóng sáng → đóng → `HOAN_THANH`, lead time hiện |
| 15C | Phát hành `v3.1.0`; hướng dẫn người theo dõi nộp tệp | | |

`[CH-6]` = B (bước đệm) thì 15B rút còn số hiệu có cấu trúc, Storage lùi sang GĐ18.

## GĐ16 — Cảnh báo tự động và leo thang (NT-5, CN-4, QT-2, QT-3) · ước 3 ngày · `v3.2.0`

| PR | Nội dung | Migration | Kiểm chứng |
|---|---|---|---|
| 16A | Bảng `canh_bao`; `direct_messages` thêm `loai`, `nhiem_vu_id`; hàm `canh_bao_quet(p_ngay)` idempotent: tính người nhận theo mức (`[CH-4b]`; 4 kiểu Owner = chuyên viên / phòng (dòng phòng trong `dm_don_vi`) / Văn phòng / đơn vị ngoài, tra `accounts.department`, `phu_trach_phong`, `dm_don_vi.lanh_dao_phu_trach`), ghi `canh_bao` + tin hệ thống; `pg_cron` mỗi giờ (nếu chưa bật: workflow cron GitHub gọi RPC bằng service_role, ghi rõ trong `kien-truc.md`) | `0026_canh_bao_tu_dong.sql` | Test: chạy 2 lần = 1 gửi; lên Vàng → Đỏ → Đỏ đặc biệt đúng người nhận cho 4 kiểu Owner; gia hạn → "hạ mức"; khung giờ 17–23h UTC |
| 16B | Ô chuông + danh sách thông báo (dùng lại toast/realtime tin nhắn); tham số cảnh báo sửa qua hàm có lý do trên màn hình Quản trị; danh mục đơn vị (lãnh đạo phụ trách) | — | e2e: tin hệ thống xuất hiện realtime; sửa ngưỡng ghi nhật ký |
| 16C | Phát hành `v3.2.0`; ngày đầu: lãnh đạo Văn phòng rà 8 việc quá hạn cũ trước khi bật dashboard Thường trực (`[CH-10]`) | | |

## GĐ17 — Dashboard ngoại lệ và cấp Thường trực (CN-5, CN-4.3, QT-5) · ước 2–3 ngày · `v3.3.0`

| PR | Nội dung | Migration | Kiểm chứng |
|---|---|---|---|
| 17A | View `v_ngoai_le`; màn hình "Ngoại lệ" cho A1: chỉ Đỏ/Đỏ đặc biệt, 4 trường bắt buộc, nhóm "đang tra soát", ô "chưa có cấp quyết định"; điền cấp quyết định ngay trên dòng; Tổng quan 10C thêm ô Đỏ đặc biệt và chỉ số chất lượng mới; hàng 1 trỏ sang Ngoại lệ | `0027_v_ngoai_le.sql` | e2e: chỉ dòng Đỏ; 4 cột đủ; bấm điền cấp → ghi lịch sử |
| 17B | Chế độ "cấp Thường trực" (chỉ Đỏ đặc biệt) — nếu `[CH-11]` = A: vai trò `A0`, RLS, seed 1 tài khoản giả, 3 tài khoản thật tạo bằng script có vết; nếu B/C: chỉ chế độ xem của Chánh VP | `0028_vai_tro_a0.sql` (chỉ khi A) | RLS: A0 không thấy việc Xanh/Vàng, không ghi gì ngoài `chi_dao` loại `Y_KIEN` |
| 17C | Phát hành `v3.3.0` | | |

## GĐ18 — Dọn luồng cũ và vòng chỉ đạo đầy đủ (QT-5; GĐ11 cũ) · ước 3 ngày · `v3.4.0`

| PR | Nội dung | Migration | Kiểm chứng |
|---|---|---|---|
| 18A | **Destructive, sau một phát hành giữ**: drop `tasks`, `task_evidences`, `task_directives`, `view_exception_dashboard`, 7 hàm, 8 policy, bí danh `v_kl_dashboard`/`kl_trang_thai`; xoá test RLS tương ứng; `manager_id` giữ làm thông tin | `0029_bo_luong_cu.sql` | Backup trước; RLS còn lại xanh; grep frontend không còn `from('tasks')` |
| 18B | Chỉ đạo đầy đủ: `chi_dao_gui/phan_hoi/dong`, loại `Y_KIEN`/`PHAN_HOI`, `chi_dao_da_doc`; UI 5 hành động trên ngăn chi tiết; "Giao lại" thay modal đổi cán bộ; ô "Chỉ đạo chưa phản hồi" | `0030_chi_dao_day_du.sql` | e2e: đôn đốc → phản hồi → đóng; giao lại giữ lịch sử |
| 18C | Đính chính có UI (đề nghị/duyệt); tắt Google Sheet (chỉ đọc) sau kỳ đối chiếu (`[CH-15]`) | — | Một kỳ báo cáo hoàn toàn từ app |
| 18D | Phát hành `v3.4.0` | | |

## GĐ19 — Hoàn thiện theo CV-2 (GĐ12–13 cũ) · ước 4 ngày · `v3.5.x`

- Xuất HTML/PDF hai bản (lãnh đạo: Owner đơn vị, không tên cán bộ; nội bộ: có người theo dõi) từ snapshot `bao_cao` có mã; bảng chéo ngành × đơn vị; tuổi quá hạn theo bậc.
- Quản trị nhân sự: luân chuyển/bổ nhiệm/rời cơ quan có hiệu lực theo ngày; việc mở của người rời → Giao lại; khoá thay xoá.
- Nhập bổ sung dữ liệu chuyển đổi: ngày nhận thật, Product cho việc cũ, ngày hoàn thành cho 68 việc có minh chứng (`[CH-13]` B nếu chọn).
- Chuẩn bị nối V-Office: đặc tả trường nhận từ log (ngày giờ nhận, số văn bản đến) — chỉ tài liệu.

---

## Tổng hợp

| GĐ | Đích 1400 | Migration | Phát hành | Ước lượng |
|---|---|---|---|---|
| 14 | NT-1, NT-2, NT-3, QT-1, CN-1.2, CN-2.2, CĐ-1…3 | 0022–0023 | v3.0.0 | 4–5 ngày |
| 15 | NT-4, CN-3, QT-4 | 0024–0025 | v3.1.0 | 3–4 ngày |
| 16 | NT-5, CN-4, QT-2, QT-3 | 0026 | v3.2.0 | 3 ngày |
| 17 | CN-5, QT-5, CN-4.3 | 0027 (+0028) | v3.3.0 | 2–3 ngày |
| 18 | dọn + QT-5 (chỉ đạo) | 0029–0030 | v3.4.0 | 3 ngày |
| 19 | CV-2 | tuỳ | v3.5.x | 4 ngày |
| **Tổng** | | | | **19–22 ngày làm việc** |

Mốc CV-1 (28/9/2026) không đạt được với toàn bộ 5 chức năng; nếu cần một mốc trình bày, sau GĐ14 (v3.0.0) hệ thống đã có 1-1-1 (Owner, Product, Deadline) trên dữ liệu thật và form giao việc theo 1400 — đủ để chứng minh hướng đi.

## Điều kiện xong mỗi giai đoạn (chung)

1. Test RLS cục bộ + staging xanh; bộ số 14/9 giữ nguyên tới khi 185 việc cũ đóng hết.
2. Không tài khoản nào mất quyền nhìn việc đang có (test `kl-pham-vi-tong-hop`).
3. Kiểm 3 vai + `quan_tri_kl` trên bản live; CHANGELOG 3–6 dòng; TRANG-THAI cập nhật.
4. Mỗi ràng buộc mới có ít nhất một test "bị chặn" và một test "được phép"; mỗi phép ngày có test 17–23h UTC.
