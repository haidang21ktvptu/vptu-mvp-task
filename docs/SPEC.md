# SPEC — VPTU-TASK phiên bản 3 (Hệ thống quản trị nhiệm vụ theo kết quả)

Phiên bản 3.0 · Ngày lập 16/9/2026 · Trạng thái: **đã chốt câu hỏi nghiệp vụ (16/9/2026), đủ điều kiện mở GĐ14** · Thay thế `SPEC-v2-luu.md` (v2, giữ để tra cứu).

> Nguồn sự thật về "app phải làm gì" từ nay. Thước đo: `MUC-TIEU-1400.md` (mã NT/CN/QT). Mọi điểm phụ thuộc quyết định của chủ dự án đánh dấu **`[CH-n]`**, trỏ về `CAU-HOI-NGHIEP-VU.md`; văn bản dưới đây viết theo **phương án đề xuất** của câu hỏi đó, chủ dự án quyết khác thì sửa đúng chỗ đánh dấu. Hiện trạng và lý do giữ/bỏ: `RA-SOAT-HIEN-TRANG.md`. Lộ trình: `LO-TRINH-V3.md`. Giao diện: `DESIGN.md` (không đổi). Pipeline: `kien-truc.md`.

---

## 1. Mục tiêu và phạm vi

**1.1 Mục tiêu.** Một hệ thống nội bộ của Văn phòng Tỉnh ủy Cao Bằng theo nguyên tắc **1-1-1-1-3** (NT-1…NT-5) với đúng **5 chức năng MVP** (CN-1…CN-5) và **workflow chuẩn** (QT-1…QT-5) của phụ lục Công văn 1400, xây tiếp trên nền v2.3.0 (Supabase Auth, RLS, CI/CD, backup, 185 nhiệm vụ thật, hàm trạng thái, realtime).

**1.2 Trong phạm vi v3.**
- Một thực thể nhiệm vụ thống nhất (mục 5), chuỗi văn bản giao việc → nhiệm vụ cấp Văn phòng → nhiệm vụ cấp phòng → chuyên viên.
- Trường theo 1-1-1-1-3; Product và minh chứng có cấu trúc (số hiệu + ngày + cấp nhận; tệp tuỳ chọn, nơi lưu tệp chờ kinh phí `[CH-6]`); ngày nhận văn bản.
- Leo thang tự động 3 cấp, thông báo trong app; dashboard ngoại lệ chỉ việc Đỏ với 4 trường.
- Mô hình 4 cấp: Thường trực Tỉnh ủy → Văn phòng Tỉnh ủy → Lãnh đạo phòng chuyên môn → Chuyên viên (bổ sung của chủ dự án, mã CĐ-1 trong `MUC-TIEU-1400.md` mục V).
- Chuyển đổi 185 việc hiện có không mất dữ liệu, không suy đoán hồi tố.

**1.3 Ngoài phạm vi v3** (giữ từ v2 hoặc theo CV-2): tích hợp V-Office (chỉ để sẵn trường); Zalo/SMS/email; AI bóc tách văn bản; KPI/độ khó/năng suất; ứng dụng di động riêng; tài khoản cho đơn vị ngoài Văn phòng **`[CH-1]`** (mô hình chứa được, chưa làm).

---

## 2. Mô hình 4 cấp và vai trò

| Cấp | Chủ thể | Trong app | Vai trò |
|---|---|---|---|
| 1 | Thường trực Tỉnh ủy (3 đồng chí) — cấp giao nhiệm vụ | **`[CH-11]` = A (chốt 16/9):** 3 tài khoản vai trò `A0`, **chỉ đọc** dashboard ngoại lệ/tổng quan **+ ghi ý kiến chỉ đạo** (`chi_dao` loại `Y_KIEN`); tạo bằng script có vết, tài liệu chỉ ghi chức danh | `A0` |
| 2 | Văn phòng Tỉnh ủy — Chánh Văn phòng, Phó Chánh Văn phòng | 5 tài khoản A1 | `A1` (CVP = `is_chief`) |
| 3 | Lãnh đạo phòng chuyên môn (5 phòng) | 5 tài khoản A2 | `A2` |
| 4 | Chuyên viên | 39 tài khoản A3 | `A3` |
| — | Cơ quan/đơn vị ngoài Văn phòng (13 đơn vị theo danh mục) — **Owner** của phần lớn việc theo kết luận | **`[CH-1]`** đề xuất A: là danh mục `dm_don_vi`, không đăng nhập; người theo dõi là cán bộ Văn phòng | không |

**Phạm vi nhìn thấy** (quy tắc 7 CLAUDE.md, giữ nguyên): A3 chỉ việc mình là Owner hoặc người theo dõi; A2 mọi việc của phòng mình (Owner hoặc người theo dõi thuộc phòng); PCVP các phòng/lĩnh vực được phân công (`phu_trach_phong`, kiêm nhiệm theo ngành–lĩnh vực); CVP tất cả; `quan_tri_kl` toàn bộ module; `A0` đọc toàn bộ nhiệm vụ (ngoại lệ + tổng quan, mọi mức), không sửa gì ngoài ghi `chi_dao` loại `Y_KIEN`. `manager_id` không còn là nguồn phân quyền (RA-SOAT 1.1).

**Hai vai trên một nhiệm vụ** **`[CH-2]`**:
- **Owner** (NT-1): đơn vị (`owner_don_vi_ma`, bắt buộc) và/hoặc tài khoản (`owner_tai_khoan`, khi Owner là Văn phòng/phòng/chuyên viên). Chịu trách nhiệm kết quả; mọi số liệu đánh giá tính theo Owner.
- **Người theo dõi** (`nguoi_theo_doi`, đổi tên từ "chủ trì theo dõi"): cán bộ Văn phòng giúp việc; trục nhắc việc nội bộ và phân quyền; không phải người chịu trách nhiệm kết quả. Nguyên tắc không hồi tố giữ nguyên.

---

## 3. Yêu cầu chức năng (theo 5 chức năng 1400)

Ký hiệu: **[Giữ]** đã có ở v2.3.0; **[Sửa]** đổi cách làm; **[Mới]** thêm ở v3.

### 3.1 GV — Giao việc (CN-1, QT-1)

- **GV-1 [Mới]** Mỗi nhiệm vụ sinh từ một **văn bản giao việc** (`van_ban_giao_viec`, mục 5.2) **`[CH-14]`**: kết luận Hội nghị BTV, thông báo Thường trực, hoặc loại khác. 32 hội nghị hiện có chuyển thành văn bản loại `KL_BTV`.
- **GV-2 [Mới]** Người giao **bắt buộc** thiết lập đúng ba thứ: **Owner, Product, Deadline** (CN-1.2). Hệ thống **tự điền, cho sửa**: ngày nhận văn bản (= ngày nhận của văn bản giao việc, không có thì hôm nay), cấp nhận sản phẩm (= cấp trên Owner), người theo dõi (= người giao/người nhập — cột NOT NULL nhưng không phải ô người giao phải nghĩ). **Để sau**: cấp quyết định, ghi chú, `nhiem_vu_cha`. Ngành → lĩnh vực chỉ bắt buộc với việc từ văn bản loại `KL_BTV`/`TB_THUONG_TRUC` (giữ quy tắc 10F, phục vụ phân công PCVP); với loại khác để mở. Không có trường trạng thái định tính; tiến độ chỉ **Đang mở / Đã đóng**.
- **GV-3 [Mới]** Ai được giao: A1 giao cho Văn phòng/phòng/chuyên viên trong phạm vi; A2 giao cho chuyên viên phòng mình; `quan_tri_kl` nhập việc theo kết luận với Owner là đơn vị ngoài. Kiểm quyền trong hàm `giao_viec()`.
- **GV-4 [Mới]** **Chuỗi giao tiếp** **`[CH-3]`**: nhiệm vụ có `nhiem_vu_cha`; con có deadline ≤ cha (CHECK), Owner con thuộc phạm vi Owner cha. Trường "giao tiếp cho phòng" **để mở**, không bắt buộc; hoàn thành cha do minh chứng của cha **`[CH-4]`**.
- **GV-5 [Sửa]** "Tiếp nhận" là **xác nhận đã nhận việc**, ghi vết, **không đổi trạng thái, không dừng đồng hồ** (CN-2.2). Từ chối = chỉ đạo ngược loại `PHAN_HOI` có lý do, việc vẫn đếm.
- **GV-6 [Mới]** Ngày bắt đầu đếm = `ngay_nhan_van_ban` **`[CH-9]`**: bắt buộc với việc mới (mặc định hôm nay, ∈ [ngày ban hành, hôm nay]); dữ liệu cũ tạm = ngày ban hành với cờ `ngay_nhan_uoc_tinh`, dashboard ghi rõ số việc ước tính. Khi nối V-Office (CV-4) trường này nhận ngày giờ từ log.
- **GV-7 [Giữ]** Form nhập hàng loạt theo văn bản (10F: "Lưu, nhập tiếp"), ngành → lĩnh vực bắt buộc như GV-2, hạn tự tính cho loại "Ký ban hành".

### 3.2 DL — Quản lý thời hạn (CN-2, NT-3)

- **DL-1 [Mới]** Việc tạo mới **bắt buộc có deadline** **`[CH-8]`**; loại thời hạn cho việc mới chỉ "Có hạn cụ thể" hoặc "Ký ban hành (trong 10 ngày)" (`dm_loai_thoi_han.cho_phep_tao_moi`). Việc thường xuyên → tạo theo kỳ; việc chờ điều kiện → deadline = ngày phải có quyết định hoặc ngày rà soát (≤ `ngay_ra_soat_toi_da` = 30), đến hạn phải gia hạn có lý do.
- **DL-2 [Giữ]** Dữ liệu cũ: ba trạng thái Thường xuyên / Chờ điều kiện / Cần điền hạn giữ cho 185 việc, hiển thị nhóm riêng, không vào leo thang, tự biến mất khi việc đóng. 3 việc "Cần điền hạn" xử lý theo **`[CH-8b]`** (đề xuất: điền hạn hoặc ngày rà soát trong 10 ngày làm việc sau phát hành).
- **DL-3 [Giữ]** Hạn không trước ngày ban hành; "Ký ban hành" hạn = ngày ban hành + 10 (`kl_cau_hinh`), khoá không sửa **`[CH-9]`**.
- **DL-4 [Mới]** **Lead time** (CN-2.1) = `ngay_hoan_thanh` (ngày của văn bản minh chứng, kiểu `date`, không nhạy múi giờ) − `ngay_nhan_van_ban`; chỉ tính cho việc có cả hai ngày thật (không ước tính); ô số nào dùng lead time phải ghi mẫu số. Đếm ngược hiển thị = `han_xu_ly − kl_hom_nay()`.
- **DL-5 [Giữ]** Gia hạn chỉ qua chỉ đạo `GIA_HAN` có lý do; `so_lan_gia_han` tăng; hạn cũ giữ trong lịch sử.
- **DL-6 [Giữ]** Mọi phép ngày theo giờ Việt Nam (`kl_hom_nay()`), test ở khung 17–23h UTC.

### 3.3 MC — Sản phẩm và minh chứng (CN-3, NT-2, NT-4)

- **MC-1 [Mới]** **Product** **`[CH-5]`**: `san_pham_loai` (danh mục 7 loại) + `san_pham_mo_ta`, bắt buộc khi tạo mới; 185 việc cũ NULL, nhãn "chưa định nghĩa sản phẩm (dữ liệu chuyển đổi)"; việc đang mở (39) phải điền trong 10 ngày làm việc, không chặn cập nhật khác.
- **MC-2 [Mới]** Bảng `minh_chung` (mục 5.4): một việc nhiều minh chứng; mỗi minh chứng có `loai` (`tep` / `so_hieu` / `chu_cu`), `so_hieu`, `ngay_van_ban`, `cap_nhan` (danh mục cấp), `tep_path`/`tep_ten` **để sẵn, NULL** — chưa có nơi lưu tệp (**`[CH-6]` = B**: không dùng Supabase Storage vì chưa có kinh phí gói Pro; khi có kinh phí mới bật tải tệp, giới hạn dự kiến ≤ 20 MB, PDF/DOC/DOCX/XLSX).
- **MC-3 [Mới]** **Minh chứng hợp lệ** **`[CH-6]` = B (chốt 16/9)**: **số hiệu + ngày văn bản + cấp nhận** có cấu trúc (ba trường bắt buộc, không còn ô chữ tự do), cấp nhận = `cap_nhan_san_pham` của nhiệm vụ (CN-3.2 "đã trình đúng cấp"). Tệp **tuỳ chọn** và hiện chưa có nơi lưu; tải tệp là **việc chờ điều kiện kinh phí** (LO-TRINH mục "Chờ điều kiện"), không phải bước đệm có hạn. Lệch với chữ "tải lên tệp" của CN-3.1 được chủ dự án chấp nhận vì văn bản đã tồn tại trên V-Office và tra được theo số hiệu.
- **MC-4 [Sửa]** Nút **"Đóng nhiệm vụ"** chỉ sáng khi có ≥ 1 minh chứng hợp lệ (CN-3.1); hàm `dong_nhiem_vu()` kiểm lại phía DB, đặt `ngay_hoan_thanh` (= ngày văn bản minh chứng, sửa được), `dong_luc`, chốt lead time (QT-4). Quy tắc 0021 (Hoàn thành ⇒ minh chứng + ngày) giữ, chuyển sang bảng `minh_chung`.
- **MC-5 [Giữ]** 76 minh chứng chữ cũ → `minh_chung.loai = chu_cu`, tách số hiệu/ngày khi nhận dạng được; không coi là vi phạm; 146 việc đã đóng không đánh giá lại; 78 việc đóng không minh chứng giữ cờ `thieu_minh_chung`.
- **MC-6 [Mới]** Xác nhận minh chứng: người theo dõi hoặc lãnh đạo trong phạm vi bấm "Xác nhận hợp lệ" / "Không hợp lệ (lý do)" — hành động ghi vết, không phải trạng thái; Owner tài khoản không tự xác nhận minh chứng của mình.
- **MC-7 [Mới]** Cấp nhận sản phẩm và **cấp cần quyết định** **`[CH-7]`**: hai danh mục riêng (Thường trực / BTV / Chánh VP / PCVP / Trưởng phòng / Đơn vị trình); cấp nhận bắt buộc khi tạo mới (mặc định = cấp trên Owner); cấp quyết định để mở, điền khi việc Đỏ; dashboard ngoại lệ đếm việc Đỏ chưa có cấp quyết định.

### 3.4 CB — Cảnh báo tự động và leo thang (CN-4, NT-5)

- **CB-1 [Mới]** Hàm `trang_thai(nv, ngay)` (mở rộng `kl_trang_thai`) trả thêm `muc_canh_bao`: `XANH` (còn > ngưỡng Vàng), `VANG` (còn ≤ `nguong_vang_ngay` = 3 và chưa có minh chứng hợp lệ), `DO` (quá hạn), `DO_DAC_BIET` (quá hạn ≥ `nguong_do_dac_biet_ngay` = 3) **`[CH-10]`**, `KHONG_AP_DUNG` (đã đóng, thường xuyên, chờ điều kiện, cần điền hạn). Một hàm, một nguồn; frontend không tự tính.
- **CB-2 [Mới]** Hàm `canh_bao_quet(p_ngay)` được **workflow cron GitHub Actions** gọi mỗi giờ qua RPC bằng service_role (mục 6, **KT-4 đổi**: không có `pg_cron` vì không có gói Pro): với mỗi việc đang mở, so `muc_canh_bao` với mức đã gửi lần cuối trong bảng `canh_bao`; lên mức → ghi dòng `canh_bao(nhiem_vu_id, muc, gui_luc, nguoi_nhan[])` và tạo tin `he_thong` trong `direct_messages` cho người nhận. Không gửi lặp cùng mức; hạ mức (gia hạn) → ghi dòng "hạ mức". Áp cho mọi việc đang mở kể cả cũ **`[CH-10]`**.
- **CB-3 [Mới]** Người nhận theo mức (CN-4.1–4.3, **`[CH-4]`**): VÀNG → Owner tài khoản (nếu có) và người theo dõi; ĐỎ → thêm **thủ trưởng trực tiếp**: chuyên viên → trưởng phòng; phòng → PCVP phụ trách phòng; Văn phòng → Chánh VP; đơn vị ngoài → lãnh đạo Văn phòng phụ trách lĩnh vực/phòng theo dõi; ĐỎ ĐẶC BIỆT → thêm Chánh VP và xuất hiện trên dashboard cấp Thường trực (CB-5).
- **CB-4 [Mới]** Luân chuyển nội bộ (xác nhận nhận việc, đọc, chuyển người theo dõi) **không** đổi `ngay_nhan_van_ban`, không đổi deadline (CN-2.2); chỉ chỉ đạo `GIA_HAN` đổi deadline.
- **CB-5 [Mới]** **Dashboard cấp Thường trực** = màn hình mặc định của vai trò `A0` (**`[CH-11]` = A**): dashboard ngoại lệ với bộ lọc mặc định `DO_DAC_BIET`, mở rộng được sang mọi việc Đỏ và tổng quan; Chánh Văn phòng cũng xem được chế độ này; xuất được bản HTML/PDF (giai đoạn sau, GĐ cũ 13).
- **CB-6 [Giữ]** Kênh: trong app (chuông + tin hệ thống, realtime) **`[CH-12]`**; nhật ký gửi trong `canh_bao`; kênh ngoài là giai đoạn sau.

### 3.5 DB — Dashboard quản trị ngoại lệ (CN-5, QT-5)

- **DB-1 [Sửa]** Một màn hình **"Ngoại lệ"** cho A1 (và A0): chỉ việc `DO`/`DO_DAC_BIET` (bỏ Xanh, CN-5.1), sắp theo số ngày trễ giảm dần, mỗi dòng đúng **4 trường bắt buộc**: (1) Owner (đơn vị/cá nhân đang chậm), (2) số ngày trễ thực tế, (3) sản phẩm còn thiếu (= Product), (4) cấp cần quyết định; cộng cột phụ: mã, hạn, người theo dõi, cập nhật cuối, căn cứ. Việc đang đính chính tách nhóm "đang tra soát".
- **DB-2 [Giữ]** Màn hình **Tổng quan** (10C) là "tình hình chung": ô số, theo Owner/người theo dõi (việc đang mở), theo văn bản gần nhất, ngành → lĩnh vực, chất lượng dữ liệu; hàng 1 trỏ sang màn hình Ngoại lệ; thêm ô Đỏ đặc biệt, "n việc Đỏ chưa có cấp quyết định", "n việc chưa có sản phẩm", "n việc dùng ngày ban hành thay ngày nhận".
- **DB-3 [Giữ]** Danh sách nhiệm vụ dùng chung (10B) + ngăn chi tiết "vì sao đỏ" + cập nhật nhanh + realtime/dự phòng 60 giây (10D); đổi nhãn "Kết luận BTVTU" → "Nhiệm vụ"; cột Owner, Product, màu.
- **DB-4 [Sửa]** Cây cán bộ thuộc quyền và KPI phòng đọc từ `v_nhiem_vu`, màu từ hàm trạng thái.
- **DB-5 [Giữ]** Mọi con số bấm ra danh sách; tổng các nhóm = tổng dòng là bất biến; số liệu đếm client trên dòng RLS trả về.

### 3.6 CĐ — Chỉ đạo, đính chính, nhắn tin (giữ từ v2, hợp nhất)

- **CĐ-1 [Sửa]** Bảng `chi_dao` (từ `kl_chi_dao`, gộp `task_directives`): loại `DON_DOC`, `GIA_HAN`, `GIAO_LAI`, `YEU_CAU_MINH_CHUNG`, `KIEM_TRA_SO_LIEU`, `Y_KIEN` (bình luận), `PHAN_HOI` (từ Owner/người theo dõi lên), `CHI_DAO_TT` (chỉ đạo Thường trực — chỉ A0 gửi, người nhận tự tính, hạn 2 ngày làm việc, chỉ đạo con gắn `tra_loi_cho`; CH-16, 0032); hàm `chi_dao_gui/phan_hoi/dong`; đã đọc theo người (`chi_dao_da_doc`); huy hiệu + realtime giữ.
- **CĐ-2 [Giữ]** Đính chính (`dinh_chinh`): đề nghị → duyệt bởi `quan_tri_kl` khác người đề nghị; UI ở giai đoạn sau; việc đang đính chính tách khỏi ô Đỏ.
- **CĐ-3 [Giữ]** Nhắn tin 1-1 (`direct_messages`), danh bạ theo vai trò; thêm `loai = he_thong`, `nhiem_vu_id`.

### 3.7 QT — Quản trị và dữ liệu chuyển đổi

- **QT-1 [Giữ]** Cờ `quan_tri_kl`/`quan_tri_he_thong`, phụ trách phòng, kiêm nhiệm lĩnh vực, danh mục lĩnh vực — mọi thay đổi qua hàm có lý do và nhật ký.
- **QT-2 [Mới]** Quản trị thêm: danh mục đơn vị (lãnh đạo Văn phòng phụ trách đơn vị ngoài **`[CH-4b]`**), tham số cảnh báo (`kl_cau_hinh` qua hàm có lý do), danh mục sản phẩm, danh mục cấp.
- **QT-3 [Mới]** Chuyển đổi 185 việc (migration `0022`–`0024`, không script tay): đổi tên bảng/cột bằng `RENAME`, `owner_don_vi_ma ← co_quan_trinh_ma`, `nguoi_theo_doi ← chu_tri_id`, `ngay_nhan_van_ban ← ngay_ban_hanh` với cờ ước tính, minh chứng chữ → `minh_chung.loai = chu_cu`, `san_pham` NULL, `cap_*` NULL. Bộ số 146/16/8/6/6/3/0 tại 14/9 **không đổi** (test hồi quy). Không có tài khoản nào mất quyền nhìn thấy việc hiện có.
- **QT-4 [Giữ]** 146 việc đóng không ngày hoàn thành: giữ NULL, không đánh giá **`[CH-13]`**; nhập bổ sung tuỳ chọn.
- **QT-5 [Giữ]** Chạy song song/đối chiếu với Google Sheet: một kỳ đối chiếu số tổng sau hợp nhất **`[CH-15]`**, rồi sheet chỉ đọc.

---

## 4. Trạng thái, màu và quy tắc dẫn xuất

**4.1 Chỉ hai tiến độ:** `DANG_THUC_HIEN` (Đang mở) / `HOAN_THANH` (Đã đóng). Mọi thứ khác là **dẫn xuất** bởi `trang_thai(nv, ngay)`:

| Thứ tự | Điều kiện | `trang_thai` | `muc_canh_bao` |
|---|---|---|---|
| 1 | đã đóng | `HOAN_THANH` (+ `ket_qua` đúng hạn/trễ/không đánh giá; `lead_time_ngay`) | `KHONG_AP_DUNG` |
| 2 | loại thường xuyên (dữ liệu cũ) | `THUONG_XUYEN` | `KHONG_AP_DUNG` |
| 3 | không hạn, loại chờ quyết định (cũ) | `CHO_DIEU_KIEN` | `KHONG_AP_DUNG` |
| 4 | không hạn (cũ) | `CAN_DIEN_HAN` | `KHONG_AP_DUNG` |
| 5 | hạn < ngày tính, trễ ≥ ngưỡng đỏ đặc biệt | `QUA_HAN` | `DO_DAC_BIET` |
| 6 | hạn < ngày tính | `QUA_HAN` | `DO` |
| 7 | hạn − ngày tính ≤ `nguong_sap_den_han_ngay` (7) | `SAP_DEN_HAN` | `VANG` nếu còn ≤ `nguong_vang_ngay` (3) và chưa có minh chứng hợp lệ, ngược lại `XANH` **`[CH-10b]`** |
| 8 | còn lại | `DANG_THUC_HIEN` | `XANH` |

Hai ngưỡng tách nhau (`[CH-10b]` = (i)): trạng thái "Sắp đến hạn" (7 ngày) để xem/lọc, mức Vàng (3 ngày) để gửi nhắc; chọn (ii) thì hai ngưỡng bằng nhau. Đang đính chính: `nhom_dem = DANG_DINH_CHINH`, không đếm vào Đỏ. Ngưỡng đọc từ `kl_cau_hinh`; "ngày tính" theo giờ Việt Nam.

**4.2 Hành động không phải trạng thái** (CN-1.2): xác nhận nhận việc, nộp minh chứng, xác nhận minh chứng, chỉ đạo, phản hồi, gia hạn, giao lại — đều là dòng trong `lich_su`/`chi_dao`/`minh_chung`, không có cột trạng thái quy trình.

**4.3 Lead time** = `ngay_hoan_thanh − ngay_nhan_van_ban` (ngày lịch, cả hai kiểu `date`); độ trễ nhập liệu = `(dong_luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date − ngay_hoan_thanh` (giữ từ GĐ8, có test 17–23h UTC).

---

## 5. Mô hình dữ liệu (đích)

**5.1 Nguyên tắc đổi tên:** migration dùng `ALTER TABLE … RENAME` để dữ liệu và lịch sử không di chuyển; tiền tố `kl_` bỏ dần (view/hàm cũ giữ dưới dạng bí danh một giai đoạn để frontend chuyển tuần tự).

**5.2 `van_ban_giao_viec`** (← `kl_hoi_nghi`): `id`, `loai` (`KL_BTV`/`TB_THUONG_TRUC`/`NQ_TW`/`CONG_VAN`/`KHAC`), `so_hieu` (← `so_ket_luan`), `ngay_ban_hanh`, `ngay_nhan` (nullable; GV-6), `co_quan_ban_hanh`, `so_hoi_nghi` (nullable), `ghi_chu`, `tao_boi`, `created_at`; UNIQUE(`loai`, `so_hieu`, `ngay_ban_hanh`); trigger ngày ≤ hôm nay, đổi ngày → tính lại hạn "Ký ban hành".

**5.3 `nhiem_vu`** (← `kl_nhiem_vu`), thêm/đổi so với hiện tại:

| Cột | Kiểu | Ràng buộc | Nguồn 1400 |
|---|---|---|---|
| `van_ban_id` (← `hoi_nghi_id`) | uuid | NOT NULL FK | QT-1 |
| `owner_don_vi_ma` (← `co_quan_trinh_ma`) | text | NOT NULL FK `dm_don_vi` — 13 cơ quan + **5 phòng của Văn phòng** (mã = `department`, `trong_van_phong = true`); "Owner là phòng X" = dòng phòng X | NT-1 `[CH-1]` `[CH-3]` |
| `owner_tai_khoan` | uuid | FK `accounts`, NULL khi Owner là đơn vị/phòng; khi có, `accounts.department` phải khớp `dm_don_vi.phong` của `owner_don_vi_ma` (trigger) | NT-1 `[CH-1]` |
| `nguoi_theo_doi` (← `chu_tri_id`) | uuid | NOT NULL FK | `[CH-2]` |
| `san_pham_loai`, `san_pham_mo_ta` | text | NOT NULL khi `nguon = 'app'` và tạo sau v3 (CHECK theo `created_at ≥ mốc phát hành` hoặc cờ `theo_1400`) | NT-2 `[CH-5]` |
| `cap_nhan_san_pham` | text | FK `dm_cap`; NOT NULL khi `theo_1400` | CN-3.2 |
| `cap_quyet_dinh` | text | FK `dm_cap`, nullable | CN-5.2(4) `[CH-7]` |
| `ngay_nhan_van_ban`, `ngay_nhan_uoc_tinh` | date, boolean | NOT NULL; ∈ [ngày ban hành, hôm nay] | CN-1.1 `[CH-9]` |
| `han_xu_ly` | date | NOT NULL khi `theo_1400` | NT-3 `[CH-8]` |
| `nhiem_vu_cha` | uuid | FK `nhiem_vu`; deadline ≤ cha | `[CH-3]` |
| `dong_luc` (← `ghi_hoan_thanh_luc`) | timestamptz | | QT-4 |
| `theo_1400` | boolean | true cho việc tạo từ v3; false cho 185 việc cũ — bật các ràng buộc bắt buộc | |
| giữ nguyên: `ma`, `nganh_ma`, `linh_vuc_ma`, `linh_vuc_chi_tiet`, `noi_dung`, `loai_thoi_han_ma`, `ly_do_chua_co_han`, `tien_do_ma`, `ngay_hoan_thanh`, `minh_chung` (chữ, di sản), `van_ban_trien_khai`, `so_lan_gia_han`, `nguon`, `ghi_chu`, `thieu_minh_chung`, `cap_nhat_luc/boi`, `tao_boi`, `created_at` | | | |

**5.4 `minh_chung`** (mới; ý tưởng từ `task_evidences`): `id`, `nhiem_vu_id` FK, `loai` (`tep`/`so_hieu`/`chu_cu`), `so_hieu`, `ngay_van_ban`, `cap_nhan` FK `dm_cap`, `tep_path`, `tep_ten`, `tep_kich_thuoc`, `noi_dung_chu` (cho `chu_cu`), `nop_boi`, `nop_luc`, `hop_le` (NULL/true/false), `xac_nhan_boi`, `xac_nhan_luc`, `ly_do_khong_hop_le`. Không xoá; thay bằng minh chứng mới.

**5.5 `chi_dao`** (← `kl_chi_dao` + `task_directives`): thêm loại `Y_KIEN`, `PHAN_HOI`; thêm GRANT UPDATE qua hàm; bảng `chi_dao_da_doc(chi_dao_id, nguoi, luc)`.

**5.6 `canh_bao`** (mới): `id`, `nhiem_vu_id`, `muc` (`VANG`/`DO`/`DO_DAC_BIET`/`HA_MUC`), `gui_luc`, `nguoi_nhan uuid[]`, `tin_nhan_ids uuid[]`. Append-only, chỉ job ghi.

**5.7 Danh mục mới:** `dm_don_vi` (← `dm_co_quan_trinh` 13 dòng + 5 dòng phòng Văn phòng; thêm `trong_van_phong`, `phong` (= `department`, chỉ dòng phòng), `lanh_dao_phu_trach`), `dm_san_pham` (7 loại `[CH-5]`), `dm_cap` (6 cấp `[CH-7]`); `dm_loai_thoi_han.cho_phep_tao_moi`; `kl_cau_hinh` thêm 3 khoá (`nguong_vang_ngay`, `nguong_do_dac_biet_ngay`, `ngay_ra_soat_toi_da` `[CH-10]`), giữ 4 khoá cũ.

**5.8 Bỏ:** `tasks`, `task_evidences`, `task_directives`, `view_exception_dashboard`, 7 hàm và 8 policy của luồng cũ (RA-SOAT mục 2–3) — sau khi frontend không còn gọi (giai đoạn "giữ" một phát hành rồi mới drop, theo nếp additive → destructive).

**5.9 View:** `v_nhiem_vu` (← `v_kl_dashboard`, thêm Owner, Product, cấp, ngày nhận, `muc_canh_bao`, `lead_time_ngay`, số minh chứng hợp lệ), `v_ngoai_le` (chỉ `DO`/`DO_DAC_BIET`, 4 trường + phụ), cả hai `security_invoker`.

**5.10 Ánh xạ cột Excel → trường form** (Phụ lục 2, 16 cột):

| Cột Excel | Trường v3 | Ghi chú |
|---|---|---|
| STT | — | không lưu |
| Số hội nghị | `van_ban_giao_viec.so_hoi_nghi` | chỉ loại `KL_BTV` |
| Số TB/KL | `van_ban_giao_viec.so_hieu` | |
| Ngày ban hành | `van_ban_giao_viec.ngay_ban_hanh` | **ngày nhận tạm = ngày này** với cờ ước tính `[CH-9]` |
| Chủ trì theo dõi | `nhiem_vu.nguoi_theo_doi` | không phải Owner `[CH-2]` |
| Ngành/lĩnh vực | `nganh_ma` | |
| Cơ quan/đơn vị trình | `owner_don_vi_ma` | **= Owner** `[CH-1]` |
| Lĩnh vực chi tiết | `linh_vuc_chi_tiet` (ghi chú) → `linh_vuc_ma` qua ánh xạ | 134 dòng NULL |
| Nội dung kết luận / Văn bản trình | `noi_dung` | |
| Loại thời hạn | `loai_thoi_han_ma` | 2 loại không hạn chỉ cho dữ liệu cũ `[CH-8]` |
| Hạn xử lý | `han_xu_ly` | 65 dòng trống giữ nguyên `[CH-8]` |
| Tiến độ | `tien_do_ma` | 2 giá trị |
| Kết quả thực hiện / Minh chứng | `minh_chung` (chữ) → `minh_chung.loai = chu_cu` | `[CH-6]` |
| Văn bản triển khai | `van_ban_trien_khai` | |
| Mã nhiệm vụ | `ma` | giữ NV-001…185 |
| Ngày cập nhật gần nhất | `cap_nhat_luc` | 36 dòng có |
| **Không có trong Excel — form mở, nhập bổ sung dần** | `san_pham_loai/mo_ta` (Product), `cap_nhan_san_pham`, `cap_quyet_dinh`, `ngay_nhan_van_ban` thật, `owner_tai_khoan`, `nhiem_vu_cha` (giao tiếp cho phòng), tệp minh chứng | các điểm 2, 5, 6 của chủ dự án |

---

## 6. Kiến trúc kỹ thuật bổ sung

- Không server riêng (giữ). **Cảnh báo tự động (KT-4, chốt 16/9)**: workflow `canh-bao-tu-dong.yml` chạy theo `schedule` mỗi giờ (+ `workflow_dispatch`), gọi RPC `canh_bao_quet()` trên production bằng `SUPABASE_SERVICE_ROLE_KEY` production để trong **repository secret** (chỉ workflow này dùng; không đưa key vào URL, không log); hàm `security definer`, chỉ `service_role` gọi được, **idempotent** theo (nhiệm vụ, mức) nên chạy trễ/chạy lặp không gửi trùng; có test với ngày cố định. Giới hạn của GitHub Actions: cron có thể trễ vài phút tới vài chục phút giờ cao điểm, và GitHub tắt schedule sau 60 ngày repo không có commit (cùng cơ chế với `backup-dinh-ky.yml`, đã có mục theo dõi trong TRANG-THAI). Chuyển sang `pg_cron` khi có gói Pro là một PR nhỏ (chỉ đổi nơi gọi).
- Tệp minh chứng: **chưa có nơi lưu** (`[CH-6]` = B); cột `tep_path` để sẵn. Khi có kinh phí: Supabase Storage bucket `minh-chung`, policy dùng cùng `kl_pham_vi`, đường dẫn `nhiem_vu/<id>/<uuid>.<đuôi>`, không đưa key vào URL bên thứ ba.
- Realtime: một kênh `nhiem_vu_feed` cho `nhiem_vu`, `chi_dao`, `minh_chung`, `dinh_chinh`, `direct_messages`.
- Thư mục frontend: đổi `views/shared/kl/` → `views/shared/nhiem-vu/`, `lib/kl/` → `lib/nhiem-vu/` khi đụng tới; giữ giới hạn 300 dòng/file.

---

## 7. Yêu cầu phi chức năng (giữ NF-1…NF-8 của v2) + bổ sung

| Mã | Yêu cầu | Đo bằng |
|---|---|---|
| NF-9 | Hàm trạng thái là nguồn duy nhất; mọi màu/số trên màn hình khớp hàm | Test bất biến + test màu tại 17–23h UTC |
| NF-10 | Chuyển đổi không đổi bộ số 14/9 và không làm tài khoản nào mất quyền nhìn việc | Test `kl-moc-2026-09-14` + `kl-pham-vi-tong-hop` xanh sau `0022` |
| NF-11 | Job cảnh báo idempotent, không gửi trùng | Test chạy 2 lần cùng ngày = 1 lần gửi |
| NF-12 | **Khi có tệp** (chờ kinh phí): tệp minh chứng chỉ người trong phạm vi tải được | Test Storage policy 3 vai — chưa áp ở v3 |
| NF-13 | Job cảnh báo chạy được từ bên ngoài chỉ với service_role; `authenticated`/`anon` gọi `canh_bao_quet()` bị chặn | Test RLS 3 vai + service_role |

---

## 8. Quyết định đã chốt (kế thừa, không mở lại)

Không React/Vue; không self-host; email quy ước; RLS/hàm là nơi chặn; mọi thao tác quản trị có vết; không suy đoán hồi tố dữ liệu cũ; minh chứng bắt buộc khi đóng (0021); dashboard thời gian thực không kỳ chốt, snapshot chỉ khi xuất; tag trước merge; phát hành schema và nhập dữ liệu tách biệt; repo không chứa dữ liệu về người.

## 9. Điểm mở

**Đã chốt toàn bộ ngày 16/9/2026** (`CAU-HOI-NGHIEP-VU.md`, ô "Quyết định" từng câu). Khác đề xuất ở hai điểm, đã sửa trong tài liệu này: **CH-6 = B** (minh chứng có cấu trúc, không Storage, tệp chờ kinh phí — MC-2, MC-3, mục 1.2, 6, NF-12) và **CH-11 = A** (vai trò `A0` cho 3 tài khoản Thường trực — mục 2, CB-5); **KT-4 đổi** (cron GitHub Actions thay `pg_cron` — CB-2, mục 6, NF-13). Migration `0022` (GĐ14) được phép viết.
