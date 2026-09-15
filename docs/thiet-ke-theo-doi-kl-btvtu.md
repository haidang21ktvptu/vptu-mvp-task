# Thiết kế tích hợp: Theo dõi Kết luận BTVTU vào VPTU-TASK

Ngày lập: 14/9/2026. Nguồn phân tích: file `TUCB_XX - kết quả thực hiện KL BTVTU - test.xlsx` (185 dòng, 4 sheet), hai bản infographic tuần 34 (bản lãnh đạo ẩn danh + bản nội bộ, dữ liệu 23/8/2026).

Tài liệu này gồm bốn phần: (1) phân tích dữ liệu thủ công hiện có, (2) góc nhìn chuyên viên tổng hợp — cách tổng hợp cho ra số chính xác, (3) góc nhìn lãnh đạo Văn phòng — dashboard phải trả lời gì và chỉ đạo thế nào, (4) kế hoạch tích hợp theo giai đoạn, cùng chuẩn với GĐ0–7.

---

## Phần 1 — Phân tích dữ liệu thủ công hiện có

### 1.1 Cấu trúc và quy trình hiện tại

Một Google Sheet có 4 sheet: `Phụ lục 2` (bảng chính, 16 cột, một dòng một nhiệm vụ), `DanhMuc` (5 danh mục dropdown), `Đặc tả cột` (đặc tả v4 kèm 5 ghi chú tồn đọng), `NhatKyChinhSua` (Apps Script tự ghi lịch sử sửa từ 14/8/2026). Định kỳ, phòng Tổng hợp tự dựng một trang HTML từ sheet, xuất hai bản PDF: bản lãnh đạo (ẩn tên người) và bản nội bộ (có xếp hạng theo người).

Quy trình này đã có nhiều điểm chuẩn hoá tốt và **phải giữ lại** khi tích hợp:

- Bộ 12 ngành/lĩnh vực và 13 cơ quan trình theo tài liệu chuẩn hoá `P-Tong-hop_Data-Standardization`.
- Nguyên tắc **không hồi tố** cột "Chủ trì theo dõi" (giữ theo lịch sử lúc phát sinh — ví dụ chuyên viên đã chuyển công tác giữa năm 2026 vẫn đứng tên các việc phát sinh trước ngày chuyển).
- Bốn loại thời hạn: Có hạn cụ thể / Ký ban hành (10 ngày) / Nhiệm vụ thường xuyên / Chờ quyết định.
- Mã nhiệm vụ `NV-xxx` duy nhất, sinh tự động.
- Nhật ký chỉnh sửa có người sửa, giá trị cũ, giá trị mới.

### 1.2 Phát hiện quan trọng nhất: trạng thái trên báo cáo là số dẫn xuất

Cột `Tiến độ` trong dữ liệu chỉ có **hai giá trị được dùng**: Hoàn thành (146) và Đang thực hiện (39). Giá trị "Chưa hoàn thành (quá hạn)" có trong danh mục nhưng **không dòng nào dùng**. Vậy mà báo cáo PDF hiện 5 trạng thái: Hoàn thành / Đang thực hiện / Thường xuyên / Quá hạn.

Nghĩa là bộ sinh HTML đang **tự suy ra** trạng thái hiển thị từ ba cột: `Tiến độ` + `Loại thời hạn` + `Hạn xử lý` so với ngày chạy. Quy tắc suy ra không được ghi ở đâu trong file. Khi tôi dựng lại quy tắc đó và chạy trên 176 dòng đầu tại ngày 23/8 thì ra 145/17/13/1, còn PDF ghi 141/19/14/2 — lệch vì dữ liệu đã bị sửa 87 lần vào ngày 1/9 (nhật ký ghi rõ), không phải vì quy tắc sai.

Hệ quả cho thiết kế: **quy tắc suy ra trạng thái phải là một đoạn mã duy nhất, nằm trong database, có kiểm thử, và mọi màn hình/báo cáo đều đọc từ đó.** Không được để frontend, script xuất PDF và người tổng hợp mỗi nơi tính một kiểu.

### 1.3 Chất lượng dữ liệu — đối chiếu với "65 cảnh báo" trên PDF

| # | Vấn đề | Số dòng | Hậu quả nếu đưa nguyên vào dashboard |
|---|---|---|---|
| 1 | Loại "Có hạn cụ thể" nhưng **trống Hạn xử lý** | **65/110** | Chính là 65 cảnh báo trên PDF. Những nhiệm vụ này **không bao giờ bị tính quá hạn** dù có trễ bao lâu. Đây là lỗ hổng lớn nhất về độ tin cậy của con số "Quá hạn". |
| 2 | Loại "Ký ban hành (10 ngày)" nhưng trống Hạn, dù đặc tả nói cột K tự tính = Ngày BH + 10 | 12/25 | Công thức không chạy ổn định; cả 12 đều đã Hoàn thành nên chưa gây sai số, nhưng chứng tỏ không thể tin công thức trong sheet. |
| 3 | **Ngày ban hành ở tương lai** (lỗi năm): NV-030 hội nghị 5 ghi 21/11/**2026**, NV-044 hội nghị 8 ghi 10/12/**2026** — các dòng cùng hội nghị ghi 2025 | 2 | Mọi phép tính "tuổi nhiệm vụ", "hạn = ngày BH + 10" trên hai dòng này sai. |
| 4 | "Hoàn thành" nhưng **không có minh chứng** | **78/146** (53%) | Hơn nửa số "Hoàn thành" là tự khai, không đối chiếu được. Tỷ lệ hoàn thành 79% trên PDF là con số chưa được kiểm chứng. |
| 5 | "Đang thực hiện" nhưng **không có hạn** (6 Chờ quyết định + 3 Có hạn cụ thể) | 9 | Vô hình với mọi cảnh báo. Hôm nay có 9 việc như vậy. |
| 6 | Cột "Ngày cập nhật gần nhất" chỉ có 36/185 | 149 trống | Không biết dòng nào đã bị bỏ quên bao lâu. |
| 7 | Ngành/lĩnh vực trống | 1 (NV-109) | PDF phải ghi chú "+1 mục khác không hiển thị". |
| 8 | Chủ trì = "VPTU" (không phải người) | 10 | Không đôn đốc được ai. |
| 9 | Số hội nghị có khoảng trống: thiếu 9, 14, 18, 25, 26, 29, 31, 32 | 8 hội nghị | Không rõ hội nghị không có kết luận cần theo dõi, hay chưa nhập. |
| 10 | Cơ quan trình "6. Đảng ủy UBND tỉnh" chiếm **93/185 = 50%** | — | Biểu đồ theo cơ quan trình gần như vô nghĩa nếu không bổ theo ngành (tài liệu chuẩn hoá cũng ghi: người phụ trách phải tra thêm cột ngành). |

Các cột danh mục sạch: không có khoảng trắng thừa, không sai chính tả, đúng 100% giá trị trong DanhMuc. Điểm này rất tốt — người nhập đã có kỷ luật.

### 1.4 Quy trình vận hành hiện tại — điểm rủi ro

Nhật ký ghi 194 lần sửa, **181 lần từ một tài khoản duy nhất**. Sửa theo đợt: 57 lần ngày 23/8, 87 lần ngày 1/9 — tức gom cập nhật ngay trước ngày báo cáo, không phải cập nhật khi việc xảy ra. (Phân tích theo từng tài khoản: file ngoài repo, xem mục 2.4b.)

Hai rủi ro: (a) một người là điểm nghẽn duy nhất, nghỉ phép là dừng; (b) số liệu chỉ đúng vào **ngày làm báo cáo**, các ngày khác là số cũ. Dashboard trực tuyến chỉ có giá trị khi khắc phục được điểm (b) — tức 9 chuyên viên chủ trì tự cập nhật việc của mình.

### 1.5 Số liệu thật tại ngày 14/9/2026 (nếu áp quy tắc dẫn xuất lên file hiện có)

| Trạng thái | Số | Ghi chú |
|---|---|---|
| Tổng | 185 | hội nghị 1 → 38 |
| Hoàn thành | 146 | 68 có minh chứng, 78 không |
| Thường xuyên | 16 | |
| Đang thực hiện | 15 | trong đó 9 không có hạn |
| **Quá hạn** | **8** | lâu nhất 30 ngày, ngắn nhất 4 ngày; 6/8 quá hạn từ 9 ngày trở lên |
| Sắp đến hạn (15 ngày) | 0 | |

Tỷ lệ hoàn thành theo hội nghị giảm rõ ở các hội nghị gần: HN 34: 25%, HN 36: 25%, HN 37: 20%, HN 38: 11% — bình thường vì mới ban hành, nhưng cũng là chỗ lãnh đạo cần nhìn.

Danh sách 8 việc quá hạn kèm mã NV, số ngày quá và chủ trì để ở file ngoài repo (mục 2.4b); bộ số này là **bộ số đối chiếu** khi kiểm tra điều kiện xong GĐ8.

---

## Phần 2 — Góc nhìn chuyên viên tổng hợp: tổng hợp thế nào để số tuyệt đối chính xác

### 2.1 Nguyên tắc: một nguồn sự thật, một hàm tính, một mốc thời gian

Con số trên dashboard chỉ đáng tin khi thoả ba điều:

1. **Một nguồn**: dữ liệu nhập một lần vào web app, không còn Google Sheet chạy song song sau giai đoạn chuyển đổi.
2. **Một hàm tính**: trạng thái hiển thị (Hoàn thành / Thường xuyên / Đang thực hiện / Quá hạn / Sắp đến hạn / Không xác định hạn) do **một hàm SQL duy nhất** tính, có kiểm thử tự động, mọi màn hình và bản xuất PDF đều gọi hàm đó.
3. **Một mốc thời gian**: mỗi con số gắn với "tính đến ngày giờ X". Bản báo cáo đã gửi lãnh đạo phải **đóng băng** (snapshot), số không được đổi sau khi gửi dù dữ liệu gốc thay đổi.

### 2.2 Quy tắc dẫn xuất trạng thái (đề xuất, cần chủ dự án duyệt)

Thứ tự ưu tiên, dừng ở quy tắc đầu tiên khớp:

1. `tien_do = 'Hoàn thành'` → **Hoàn thành**
2. `loai_thoi_han = 'Nhiệm vụ thường xuyên'` → **Thường xuyên**
3. `han_xu_ly IS NULL` và loại = "Có hạn cụ thể" → **Cần điền hạn** *(trạng thái mới: việc lẽ ra có hạn nhưng chưa xác định được vì yếu tố bên ngoài; bắt buộc có `ly_do_chua_co_han`; đếm tuổi từ ngày ban hành)*
3b. `han_xu_ly IS NULL` và loại = "Chờ quyết định/điều kiện khác" → **Chờ điều kiện**
4. `han_xu_ly < ngày tính` → **Quá hạn**, kèm số ngày quá
5. `han_xu_ly <= ngày tính + 7` → **Sắp đến hạn**
6. còn lại → **Đang thực hiện**

Khác biệt so với bản thủ công: thêm trạng thái "Không xác định hạn" để lãnh đạo **nhìn thấy** 65+9 việc đang vô hình; "Sắp đến hạn" dùng 7 ngày thay 15 (15 ngày với chu kỳ họp BTV 1–2 tuần là quá rộng, gần như việc nào cũng "sắp"). Cả hai tham số để trong bảng cấu hình, không hard-code.

### 2.3 Chốt chất lượng ngay khi nhập (ràng buộc trong database)

| Ràng buộc | Cách áp | Lý do |
|---|---|---|
| Loại "Có hạn cụ thể" ⇒ **có hạn HOẶC có lý do chưa có hạn** | `CHECK`: `han_xu_ly IS NOT NULL OR ly_do_chua_co_han IS NOT NULL OR (tien_do = 'Hoàn thành' AND nguon = 'excel')` | Không còn dòng nào im lặng: hoặc biết hạn, hoặc biết vì sao chưa biết. Việc "Cần điền hạn" hiện công khai kèm tuổi, không chìm vào chú thích |
| Loại "Ký ban hành" ⇒ hạn = ngày BH + 10 | cột generated, không cho nhập tay | Diệt lỗi 12 dòng |
| Ngày ban hành ≤ ngày nhập | `CHECK` | Diệt lỗi năm 2025/2026 |
| Hoàn thành ⇒ phải có minh chứng | giai đoạn 1: cảnh báo; giai đoạn 2: bắt buộc | 78 dòng hiện tại vi phạm, bắt buộc ngay sẽ chặn nhập liệu |
| Chủ trì phải là tài khoản thật | FK tới `accounts` | "VPTU" phải gán về một người hoặc một nhóm có người đại diện |
| Ngành, cơ quan trình, loại hạn, tiến độ | FK tới bảng danh mục | Giữ sạch như hiện nay |
| Mọi thay đổi | trigger ghi `kl_lich_su` (ai, lúc nào, cột, cũ, mới) | Thay Apps Script, không phụ thuộc Google |

### 2.4 Chuyển dữ liệu từ Excel vào — làm một lần, có biên bản

**Nguyên tắc dọn dữ liệu** (chốt 14/9/2026): chỉ sửa tay những gì ảnh hưởng tới việc *đang mở* hoặc làm sai *phép tính*; dữ liệu cũ của việc *đã đóng* nhập nguyên trạng, gắn cờ nguồn, và dashboard nói thật về giới hạn của nó. Không suy đoán hồi tố — đúng tinh thần đặc tả cột của phòng Tổng hợp.

**Danh sách xử lý trước khi nhập — 3 dòng sửa tay trên Excel, 13 dòng script tự xử lý:**

| Nhóm | Dòng | Việc cần làm | Ai |
|---|---|---|---|
| Sai năm ban hành | **2**: NV-030 (ghi 21/11/2026 → 2025), NV-044 (ghi 10/12/2026 → 2025) | Lỗi gõ tay, sửa năm trên Excel trước khi nhập | Người quản trị sheet (phòng Tổng hợp) |
| Thiếu ngành/lĩnh vực | **1**: NV-109 → "8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách" | Chốt 14/9, sửa trên Excel | Người quản trị sheet (phòng Tổng hợp) |
| Đang mở, "Có hạn cụ thể", trống hạn | **3**: NV-037, NV-060, NV-154 | **Không sửa trên Excel.** Chốt 14/9: hạn phụ thuộc yếu tố bên ngoài. Script nhập gán `ly_do_chua_co_han = "Phụ thuộc yếu tố bên ngoài (chốt 14/9/2026)"`; hệ thống xếp "Cần điền hạn", nổi trên danh sách chuyên viên tới khi có hạn | Script |
| Chủ trì "VPTU" | **10** | Đổi thành username Trưởng phòng Tổng hợp, ghi chú "chuyển từ VPTU" — script làm tự động theo bảng ánh xạ, không sửa tay | Script |

**Nhập nguyên trạng, không sửa, có cờ nguồn:**

| Nhóm | Dòng | Cách xử lý trong hệ thống |
|---|---|---|
| Đã Hoàn thành, loại "Có hạn cụ thể", trống hạn | **62** (hội nghị 4–24, chỉ 12 có minh chứng) | `nguon = 'excel'`, hạn để trống. Hàm trạng thái xếp "Hoàn thành" không cần hạn. Ràng buộc "Có hạn cụ thể ⇒ hạn" **chỉ áp cho dòng đang mở và dòng nhập mới** (CHECK có điều kiện `tien_do <> 'Hoàn thành' OR nguon <> 'excel'`). Khối chất lượng dữ liệu ghi: "62 việc nhập từ Excel không có hạn gốc — không đánh giá đúng/trễ hạn". |
| Đã Hoàn thành, loại "Ký ban hành", trống hạn | **12** | Hạn là cột tự tính = ngày BH + 10, script không cần hỏi ai |
| Đã Hoàn thành, không có minh chứng | **78** | Nhập nguyên trạng; cờ `thieu_minh_chung`; `ngay_hoan_thanh` trống, ghi "không có ngày hoàn thành gốc" — không đánh giá đúng/trễ hạn cho nhóm này |
| Đang mở, loại "Chờ quyết định", không hạn | 6 | Đúng bản chất, không sửa; dashboard xếp "Không xác định hạn" |

**Trình tự:**

1. Script `scripts/nhap-kl-btvtu.mjs` chạy `--dry-run` trên file gốc: in bảng đối chiếu (số dòng, số theo danh mục) và danh sách vi phạm cứng — kỳ vọng đúng 3 dòng (2 sai năm + 1 thiếu ngành); 10 dòng VPTU và 3 dòng "Cần điền hạn" được xử lý tự động và liệt kê để chủ dự án xác nhận.
2. Người quản trị sheet (phòng Tổng hợp) sửa 3 dòng trên Excel. Chạy lại `--dry-run` tới khi 0 vi phạm cứng.
3. Chạy `--ghi` vào **staging** trước, chạy test bộ dữ liệu vàng. Xanh mới nhập production (qua quy trình phát hành có backup).
4. Ghi `docs/bien-ban-nhap-kl-btvtu.md`: checksum file gốc, số dòng, số theo trạng thái trước/sau, danh sách 3 dòng đã sửa tay kèm giá trị cũ/mới, 3 dòng gán lý do chưa có hạn, số dòng theo từng cờ nguồn.
5. **Chạy song song 2 kỳ báo cáo**: sheet vẫn cập nhật, web app cũng cập nhật; số trên hai nguồn phải trùng. Trùng 2 kỳ liên tiếp mới tắt sheet.

**Ghi chú khi triển khai (PR 8B, 15/9/2026):** (a) khi đọc file gốc phát hiện thêm **một** vi phạm cứng ngoài danh sách trên — một dòng đã Hoàn thành có hạn xử lý *trước* ngày ban hành (trigger 0015 từ chối); chủ dự án xác minh độc lập đây là dòng duy nhất mắc lỗi và người quản trị sheet đã sửa trên Excel trước khi nhập (script không đoán giá trị). (b) Sheet dùng chuỗi "Ký ban hành (trong 10 ngày)" còn 0014 ghi thiếu chữ "trong" → migration 0017 sửa `ten` cho đúng nguyên văn, giữ nguyên tắc đối chiếu từng ký tự, không bí danh. (c) Nhật ký cũ: 17 dòng không có mã nhưng có số dòng → suy mã theo chính công thức của sheet (NV-(dòng − 3), đối chiếu 177 dòng có mã khớp 100%), liệt kê ở dry-run; 13 dòng ghi "không xác định được" ở cột người sửa → `nguoi_sua` NULL, giữ nguyên văn; người sửa còn lại ánh xạ email → tài khoản qua file ngoài repo. Mốc giờ Apps Script ghi hậu tố "Z" nhưng là giờ Việt Nam (trùng cột "Ngày cập nhật gần nhất" từng giây, phân bố 9h–18h) → lưu `+07:00`. (d) Bộ dữ liệu vàng nạp vào local (kể cả trong CI) và staging bằng chính script nhập; file thật chỉ vào production. Phát hành schema (tag) và nhập dữ liệu thật là **hai bước tách biệt** — xem TRANG-THAI.

### 2.4b Dữ liệu thật không được vào repo công khai

Repo `vptu-mvp-task` là **public**. File Excel và hai PDF chứa họ tên cán bộ, nội dung kết luận BTVTU — **tuyệt đối không commit** vào repo, không đính vào PR, không dán vào issue. Quy tắc:

- File Excel gốc để tại `D:\TU 2026\Project\vptu-backup\nguon-kl-btvtu\` (ngoài repo). Script nhập nhận đường dẫn qua tham số.
- "Bộ dữ liệu vàng" trong `tests/` là **bản ẩn danh sinh tự động** từ file thật bằng `scripts/an-danh-kl-btvtu.mjs`: giữ nguyên cấu trúc, số hội nghị, ngày, loại hạn, tiến độ, ngành, cơ quan trình; thay tên chủ trì bằng tài khoản `demo_*`, thay nội dung bằng "Nhiệm vụ NV-xxx (ẩn)", bỏ minh chứng. Bộ số tổng phải bằng bộ số của file thật — test kiểm điều đó.
- Gitleaks đã có trong CI; thêm rule chặn file `.xlsx`/`.pdf` trong `docs/` và `tests/`.
- **Repo chứa cách làm, không chứa dữ liệu về người. Phân tích có tên để ngoài repo cạnh file nguồn.** Phần phân tích định danh của tài liệu này (danh sách 8 việc quá hạn kèm mã NV và chủ trì, số lần sửa theo từng tài khoản, người sửa 3 dòng Excel) ở `D:\TU 2026\Project\vptu-backup\nguon-kl-btvtu\phan-tich-chi-tiet.md`.

### 2.5 Kiểm thử để bảo đảm "tuyệt đối chính xác"

- **Bộ dữ liệu vàng**: chính file 185 dòng này (sau khi dọn) làm fixture; test khẳng định hàm dẫn xuất cho ra đúng bộ số đã duyệt tay tại ba mốc ngày khác nhau.
- **Test bất biến**: với mọi bộ lọc, tổng các trạng thái = tổng nhiệm vụ; tổng theo chủ trì = tổng; tổng theo ngành + "trống" = tổng. Chạy trong CI.
- **Test biên**: hạn = hôm nay (chưa quá), hạn = hôm qua (quá 1 ngày), hoàn thành sau hạn (vẫn Hoàn thành), thường xuyên có hạn (vẫn Thường xuyên).
- **Đối chiếu snapshot**: mỗi lần xuất báo cáo lưu số tổng vào `kl_bao_cao`; test hồi quy so bản mới với bản cũ và bắt giải thích khi lệch ngoài dự kiến. Dashboard thời gian thực và snapshot dùng **cùng** hàm `kl_trang_thai`, chỉ khác tham số ngày.

---

## Phần 3 — Góc nhìn lãnh đạo Văn phòng: dashboard phải trả lời gì

### 3.1 Bản hiện tại làm tốt gì, thiếu gì

Tốt: tổng quan 5 ô số rõ; biểu đồ theo cơ quan trình và theo ngành; bản nội bộ có xếp hạng theo người và danh sách quá hạn/sắp đến hạn kèm tên.

Thiếu, nhìn từ ghế người điều hành:

- **Không phân biệt "cần tôi làm gì" với "tình hình chung".** Năm ô số ngang hàng nhau, trong khi lãnh đạo chỉ cần 3 giây để biết hôm nay có việc gì phải can thiệp.
- **Không có tuổi của việc quá hạn.** "Quá hạn 8 ngày" và "quá hạn 30 ngày" là hai mức nghiêm trọng khác nhau.
- **Việc không có hạn bị giấu** vào chú thích cuối trang, trong khi đó là 74 việc (65+9) — gần 40% tổng số — không ai kiểm soát được tiến độ.
- **Biểu đồ cơ quan trình vô nghĩa** khi một đơn vị chiếm 50%.
- **Không có vòng phản hồi.** Lãnh đạo đọc xong PDF, muốn chỉ đạo thì phải gọi điện hoặc nhắn — không ghi vết, không biết đã xử lý chưa.
- **Bản ẩn danh** giúp gửi rộng, nhưng lãnh đạo Văn phòng cần bản có tên để đôn đốc; hai bản phải sinh từ cùng một số liệu, cùng thời điểm.

### 3.2 Bố cục dashboard đề xuất (màn hình A1 — Lãnh đạo Văn phòng)

**Hàng 1 — Việc cần can thiệp hôm nay** (chỉ hiện khi > 0, màu đỏ/cam):

- Quá hạn: **8** — bấm vào ra danh sách xếp theo số ngày quá, kèm tên chủ trì
- Chỉ đạo của tôi chưa được phản hồi: **n**
- Sắp đến hạn 7 ngày: **n**
- Cần điền hạn: **3** (tuổi lớn nhất: 290 ngày) — việc có hạn nhưng chưa xác định được; Chờ điều kiện: 6

**Hàng 2 — Tình hình chung**: Tổng / Hoàn thành (tỷ lệ) / Đang thực hiện / Thường xuyên, mỗi ô ghi thêm thay đổi so với kỳ trước (+3, −1).

**Hàng 3 — Hai biểu đồ có tác dụng điều hành**:

- **Theo chủ trì, chỉ tính việc đang mở** (không tính Hoàn thành), phân màu quá hạn / sắp hạn / đang làm / không hạn. Đây mới là "ai đang gánh gì", khác với xếp hạng tổng số việc đã nhận từ đầu nhiệm kỳ.
- **Theo hội nghị gần nhất (8 hội nghị)**: tỷ lệ hoàn thành từng hội nghị. Cho thấy kết luận nào đang "ì".

**Hàng 4 — Theo ngành × cơ quan trình** dạng bảng chéo thu gọn, thay cho hai biểu đồ cột rời. Đảng ủy UBND tỉnh tách theo ngành ngay trong bảng.

**Cuối trang — Chất lượng dữ liệu**: "n việc Hoàn thành chưa có minh chứng", "n việc chưa cập nhật > 30 ngày". Lãnh đạo nhìn thấy để yêu cầu, không phải để tự sửa.

### 3.3 Vòng chỉ đạo trực tiếp — điểm mới quan trọng nhất

Từ bất kỳ dòng nhiệm vụ nào (nhất là quá hạn), lãnh đạo bấm **"Chỉ đạo"** và có 4 lựa chọn, mỗi lựa chọn là một hành động ghi vết:

| Hành động | Ghi gì | Người chủ trì thấy gì |
|---|---|---|
| **Đôn đốc** | nội dung + hạn phản hồi (mặc định 2 ngày) | Việc nổi lên đầu danh sách, có badge "Lãnh đạo đôn đốc"; phải bấm "Phản hồi" mới tắt badge |
| **Gia hạn** | hạn mới + lý do (bắt buộc) | Hạn đổi, lịch sử giữ hạn cũ; dashboard tính theo hạn mới nhưng đánh dấu "đã gia hạn 1 lần" |
| **Giao lại** | chủ trì mới + lý do | Chủ trì cũ và mới đều nhận thông báo; cột chủ trì lịch sử không đổi trên các kỳ báo cáo đã đóng băng |
| **Yêu cầu minh chứng** | với việc "Hoàn thành" chưa có minh chứng | Chủ trì phải đính kèm số hiệu văn bản hoặc chuyển về "Đang thực hiện" |

Dashboard của lãnh đạo có ô "Chỉ đạo chưa phản hồi" — đây là thứ biến dashboard từ *bảng để xem* thành *công cụ để điều hành*. Cơ chế này tận dụng được `task_directives` đã có trong app (ý kiến chỉ đạo) — mở rộng chứ không làm lại.

### 3.4 Màn hình A3 — Chuyên viên chủ trì

Danh sách việc của mình, xếp: đôn đốc chưa phản hồi → quá hạn → sắp hạn → đang làm → không hạn. Mỗi dòng có nút cập nhật nhanh: đổi tiến độ, điền hạn (bắt buộc nếu chọn "Có hạn cụ thể"), dán minh chứng. Mục tiêu: cập nhật mất < 30 giây/việc, để chuyên viên cập nhật **lúc việc xảy ra** thay vì gom 87 lần vào ngày 1/9.

### 3.5 Thời gian thực và hai bản xuất PDF/HTML

Dashboard **không có kỳ chốt**: mọi số đọc trực tiếp từ `v_kl_dashboard`, tính tại thời điểm mở trang (`now()`), và tự làm mới khi có thay đổi (Supabase Realtime trên `kl_nhiem_vu`, `kl_chi_dao`, `kl_dinh_chinh`; nếu Realtime không khả dụng ở gói Free thì polling 60 giây). Góc trên ghi "Số liệu tính đến 14/9/2026 15:42:10".

Snapshot chỉ sinh **khi người có `quan_tri_kl` hoặc A1 bấm "Xuất báo cáo"**: hệ thống ghi một bản đóng băng vào `kl_bao_cao` (mã `BC-2026-0914-1542`), rồi sinh hai bản từ đúng snapshot đó — bản lãnh đạo (không tên chuyên viên) và bản nội bộ (có tên). Chân trang ghi mã báo cáo; mã này tra ngược được bộ số bất kỳ lúc nào, dù dashboard đã đổi.

---

## Phần 4 — Kế hoạch tích hợp theo giai đoạn

Tiếp nối cách làm GĐ0–7: mỗi giai đoạn có SPEC bổ sung, migration qua PR, RLS test, phát hành bằng tag trước merge, ghi CHANGELOG và TRANG-THAI.

### GĐ8 — Mô hình dữ liệu và nhập liệu (2 PR)

**Mục tiêu**: dữ liệu KL BTVTU nằm trong Supabase, sạch, có ràng buộc, có lịch sử.

**PR 8A — schema** (migration 0013, 0014):

- Danh mục: `dm_nganh` (12), `dm_co_quan_trinh` (13), `dm_loai_thoi_han` (4), `dm_tien_do` (2 giá trị dùng thật: Hoàn thành / Đang thực hiện — bỏ "Chưa hoàn thành (quá hạn)" vì là số dẫn xuất).
- `kl_hoi_nghi`: số hội nghị, số TB/KL, ngày ban hành. Một hội nghị có thể nhiều số KL (HN 33 có 3).
- `kl_nhiem_vu`: mã NV (giữ `NV-xxx`), FK hội nghị, chủ trì (FK `accounts`), ngành, cơ quan trình, lĩnh vực chi tiết, nội dung, loại thời hạn, hạn xử lý, tiến độ, minh chứng, văn bản triển khai, số lần gia hạn. Ràng buộc mục 2.3.
- `kl_lich_su`: trigger ghi mọi UPDATE.
- `kl_chi_dao`: mở rộng từ `task_directives` — loại (đôn đốc/gia hạn/giao lại/yêu cầu minh chứng), hạn phản hồi, phản hồi, trạng thái.
- `kl_cau_hinh`: tham số (ngưỡng sắp đến hạn = 7, hạn phản hồi mặc định = 2).
- Hàm `kl_trang_thai(nv, ngay date)` và view `v_kl_dashboard` — nguồn duy nhất của trạng thái.
- RLS theo quyết định 7: A3 phòng Tổng hợp đọc/sửa việc mình chủ trì; lãnh đạo phòng Tổng hợp và PCVP phụ trách Tổng hợp (theo `phu_trach_phong` tại ngày hiện tại) đọc tất cả + ghi `kl_chi_dao`; Chánh Văn phòng đọc tất cả + ghi `kl_chi_dao`; `quan_tri_kl` đọc/sửa tất cả; người ngoài phạm vi không thấy gì. Test RLS thêm ~20 case, gồm case PCVP đổi phòng giữa chừng. **Ghi chú khi triển khai (PR 8A-2, 15/9/2026):** quyền "đọc/sửa việc mình chủ trì" áp cho **mọi chủ trì**, không riêng A3 — vì 10 việc chuyển từ "VPTU" do Trưởng phòng Tổng hợp (A2) chủ trì cũng phải tự cập nhật được; giới hạn cột (tiến độ, hạn, lý do chưa có hạn, ngày hoàn thành, minh chứng, văn bản triển khai, ghi chú) như nhau cho mọi chủ trì không có `quan_tri_kl`. Mọi phép lấy "ngày" từ mốc giờ trong module KL tính theo giờ Việt Nam (`kl_hom_nay()`, `AT TIME ZONE 'Asia/Ho_Chi_Minh'`) vì Postgres trên Supabase chạy UTC.
- Bảng `phu_trach_phong` + màn hình Quản trị phần "Phụ trách phòng" (Phần 5.4).

**PR 8B — script nhập + kiểm chứng**:

- `scripts/nhap-kl-btvtu.mjs`: đọc xlsx → báo cáo vi phạm → chế độ `--dry-run` mặc định, `--ghi` mới ghi.
- Ánh xạ chủ trì: bảng đối chiếu tên Excel → `username` (9 tên; "VPTU" cần chủ dự án quyết gán về ai).
- Test bộ dữ liệu vàng (mục 2.5).
- Việc của chủ dự án: cùng người quản trị sheet (phòng Tổng hợp) sửa **3 dòng** trên Excel (mục 2.4) trước khi nhập thật; ghi biên bản nhập.

**Điều kiện xong GĐ8**: nhập 185 dòng, 0 vi phạm cứng; `select` từ `v_kl_dashboard` tại ngày 14/9 cho đúng bộ số mục 1.5 (sau khi dọn hạn thì số Quá hạn có thể tăng — phải giải thích được từng dòng tăng).

**Rủi ro**: ban đầu tưởng phải dọn 65 dòng; sau khi tách theo tiến độ và chốt cách xử lý việc chưa có hạn, chỉ còn 3 dòng sửa tay. Rủi ro còn lại chuyển sang vận hành: "Cần điền hạn" phải được chuyên viên xử lý, dashboard đếm tuổi để không bị quên.

### GĐ9 — Dashboard đọc và chạy song song (2 PR)

**PR 9A — màn hình A3 và A2**: danh sách việc theo chủ trì, cập nhật nhanh, bộ lọc hội nghị/ngành/trạng thái. Mọi số đọc từ `v_kl_dashboard`.

**PR 9B — dashboard A1**: bố cục mục 3.2, chưa có nút chỉ đạo. Xuất HTML hai bản từ snapshot `kl_bao_cao`.

**Chạy song song 2 kỳ báo cáo** (dự kiến tuần 38–39): phòng Tổng hợp cập nhật cả sheet và app; cuối mỗi kỳ chủ dự án đối chiếu 5 ô số tổng + danh sách quá hạn. Lệch → tìm nguyên nhân, ghi CHANGELOG. Trùng 2 kỳ → GĐ10.

**Điều kiện xong GĐ9**: hai kỳ trùng số; 9 chuyên viên chủ trì đều đã tự cập nhật ít nhất một việc trên app (bằng chứng: `kl_lich_su` có ≥ 9 người sửa khác nhau).

### GĐ10 — Vòng chỉ đạo và tắt Excel (2 PR)

**PR 10A — chỉ đạo**: 4 hành động mục 3.3; ô "Chỉ đạo chưa phản hồi"; thông báo trong app (dùng `direct_messages` đã có) khi bị đôn đốc/giao lại.

**PR 10B — chốt bắt buộc**: minh chứng bắt buộc khi Hoàn thành; ràng buộc "Có hạn cụ thể ⇒ hạn" chuyển từ cảnh báo sang chặn (nếu GĐ8 chưa làm được vì dữ liệu cũ). Tắt quyền sửa Google Sheet, chuyển sheet sang chế độ chỉ đọc làm lưu trữ.

**Điều kiện xong GĐ10**: một kỳ báo cáo hoàn toàn từ app; ít nhất một chỉ đạo thật đi hết vòng đôn đốc → phản hồi → đóng.

### GĐ11 — Xuất PDF và cải tiến (1 PR + việc định kỳ)

- Xuất PDF hai bản trực tiếp từ app (thay HTML dựng tay), có mã báo cáo.
- Bảng chéo ngành × cơ quan trình; tuổi quá hạn theo bậc 1–7 / 8–30 / >30 ngày.
- Sau 2 tháng vận hành: rà lại ngưỡng 7 ngày, xem xét gộp ngành 1 và 12 (ghi chú tồn đọng số 1 trong đặc tả cột).

### Vận hành và xử lý lỗi (bổ sung vào `xu-ly-su-co.md` khi GĐ10 xong)

| Tình huống | Xử lý |
|---|---|
| Số trên dashboard khác số trong bản PDF đã gửi | Bình thường nếu PDF là snapshot cũ. Tra mã báo cáo → `kl_bao_cao` → đối chiếu. Không sửa PDF đã gửi. |
| Một việc "Quá hạn" mà chủ trì nói đã xong | Chủ trì cập nhật tiến độ + minh chứng; nếu xong trước hạn nhưng quên cập nhật, ghi ngày hoàn thành thật (cột `ngay_hoan_thanh`), dashboard kỳ sau tự đúng. Không sửa tay trên Dashboard Supabase. |
| Nhập nhầm chủ trì | Dùng "Giao lại" có lý do; không sửa trực tiếp để giữ lịch sử. |
| Hội nghị mới, kết luận có 20 nhiệm vụ | A2 Tổng hợp tạo hội nghị, nhập hàng loạt qua form thêm nhiều dòng; mỗi dòng bắt buộc chủ trì + loại hạn. |
| Chuyên viên chuyển công tác | Việc đang mở → "Giao lại"; việc đã đóng → giữ nguyên tên (nguyên tắc không hồi tố). |
| Nghi ngờ hàm trạng thái sai | Chạy test bộ dữ liệu vàng; nếu test xanh mà vẫn nghi, đối chiếu tay 5 dòng ngẫu nhiên và ghi kết quả vào CHANGELOG. |

### Quyết định đã chốt (14/9/2026)

1. **Chủ trì không bao giờ được trống hoặc chung chung.** 10 việc đang ghi "VPTU" gán cho tài khoản Trưởng phòng Tổng hợp, ghi chú "chuyển từ VPTU". Cột chủ trì `NOT NULL`, FK `accounts`, form không cho lưu khi trống.
2. Ngưỡng "sắp đến hạn": **7 ngày**, đọc từ `kl_cau_hinh`.
3. Minh chứng bắt buộc khi Hoàn thành: **cảnh báo từ GĐ8, chặn từ GĐ10**.
4. Đặc quyền nhập/quản trị dữ liệu KL: **cờ `quan_tri_kl` gắn vào tài khoản cá nhân** của hai người được chỉ định (một phòng Tổng hợp, một phòng CĐS-CY). Không dùng tài khoản dùng chung. Cách quản lý: Phần 5.
5. Bản PDF lãnh đạo: **hiện đơn vị chịu trách nhiệm (cơ quan trình), không hiện tên chuyên viên**; mọi số liệu **truy vết được ngay trên dashboard** tới nguồn nhập. Thiết kế: Phần 6.
6. Nhân sự chủ trì: 8 người trong Excel đều còn công tác, có tài khoản. Script nhập đối chiếu theo họ tên; Trưởng phòng Tổng hợp hiện tại xác định từ `accounts` (phòng Tổng hợp, chức vụ Trưởng phòng) và hiện trong báo cáo dry-run để chủ dự án xác nhận trước khi ghi.
7. **Phạm vi nhìn thấy**: Chánh Văn phòng nhìn tất cả; **lãnh đạo phòng nào nhìn phòng đó; Phó Chánh Văn phòng nhìn các phòng mình được phân công phụ trách**; hai người có `quan_tri_kl` nhìn toàn bộ module KL. Phân công PCVP ↔ phòng là **dữ liệu có hiệu lực theo ngày**, chủ dự án đổi được ngay trên màn hình Quản trị (Phần 5.5). Áp cho module KL từ GĐ8; áp ngược cho phần giao việc nội bộ là một PR riêng sau (ghi vào việc còn lại), vì đụng RLS của GĐ3.
8. **Không có kỳ báo cáo cố định — dashboard thời gian thực.** Mọi cập nhật của chuyên viên hoặc người nhập hiện ngay trên dashboard. Snapshot chỉ được tạo **khi bấm xuất PDF/HTML** (Phần 3.5), để bản đã gửi đi không đổi.
9. Nhập cả 194 dòng nhật ký chỉnh sửa cũ vào `kl_lich_su`, gắn `nguon = 'excel'`, để cột "cập nhật cuối" có ngày thật cho các dòng từng được sửa.

---

## Phần 5 — Quản trị đặc quyền: ai được làm gì, và chủ dự án thay đổi thế nào

### 5.1 Ba lớp quyền, tách bạch

| Lớp | Là gì | Ai giữ | Cấp/thu thế nào |
|---|---|---|---|
| **Vai trò nghiệp vụ** A1/A2/A3 | Đã có từ GĐ0. Quyết định nhìn thấy gì trong app | Theo chức vụ | Đã có quy trình |
| **Cờ `quan_tri_kl`** | Quyền nhập hội nghị/kết luận mới, sửa mọi nhiệm vụ KL, duyệt đính chính, tạo snapshot báo cáo | 2 tài khoản cá nhân được chỉ định | Chủ dự án bật/tắt qua màn hình Quản trị (5.2) |
| **Cờ `quan_tri_he_thong`** | Quyền bật/tắt các cờ đặc quyền cho người khác, xem nhật ký cấp quyền | Chỉ chủ dự án (`buibahaidang`) | Chỉ bằng migration hoặc `supabase db query` — không có nút trong app, để không ai tự cấp cho mình |

Nguyên tắc: **cờ không kế thừa vai trò.** Người có `quan_tri_kl` vẫn là A3 ở phần giao việc nội bộ; chủ dự án có `quan_tri_he_thong` nhưng **không** mặc định có `quan_tri_kl` — muốn tự nhập dữ liệu KL thì tự cấp cho mình, và việc đó có vết như mọi lần cấp khác.

### 5.2 Màn hình "Quản trị hệ thống" (PR 8A, chỉ hiện với `quan_tri_he_thong`)

Một trang đơn giản, ba phần:

1. **Danh sách tài khoản** (49 người): username, họ tên, phòng, vai trò, hai cột cờ dạng công tắc. Bật/tắt `quan_tri_kl` là **một cú bấm + hộp xác nhận bắt gõ lý do** (ví dụ "Đ/c A nghỉ phép 20/9–5/10, tạm giao đ/c B").
2. **Nhật ký cấp quyền** (`quyen_lich_su`): ai cấp, cho ai, cờ nào, bật hay tắt, lúc nào, lý do. Không xoá được, kể cả chủ dự án.
3. **Cảnh báo tự động**: nếu số người có `quan_tri_kl` ≠ 2 → dòng vàng "Đang có N người giữ quyền quản trị KL (quy định: 2)". Nếu chủ dự án tự cấp `quan_tri_kl` cho mình → dòng vàng nhắc thu lại khi xong.

Mọi thao tác trên màn hình này gọi hàm SQL `admin_dat_co(username, ten_co, bat, ly_do)` — hàm này kiểm tra người gọi có `quan_tri_he_thong`, ghi nhật ký trong cùng transaction rồi mới đổi cờ. Frontend không được `UPDATE accounts` trực tiếp; RLS chặn.

### 5.3 Đường dự phòng khi không vào được app

Cùng mẫu với `xu-ly-su-co.md` mục 6, chạy từ Git Bash:

```bash
supabase db query --linked --project-ref frwyxcmbonjaimziiuqr "select public.admin_dat_co('<username>', 'quan_tri_kl', true, 'Cấp qua CLI: <lý do>')"
```

Hàm ghi nhật ký y hệt đường qua app, với người cấp = `postgres` (kèm ghi chú "qua CLI"). Dùng khi: app lỗi, hoặc cần cấp gấp lúc chủ dự án không ở máy có trình duyệt đã đăng nhập.

### 5.4 Phân công lãnh đạo phụ trách phòng — đổi được ngay, có hiệu lực theo ngày

Bảng `phu_trach_phong`: tài khoản lãnh đạo, phòng, `tu_ngay`, `den_ngay` (null = đang hiệu lực), lý do, người phân công. Mọi RLS "nhìn được phòng nào" đọc từ bảng này tại ngày hiện tại — không đọc từ chức danh trong `accounts`.

Trên màn hình Quản trị, phần **"Phụ trách phòng"** hiện bảng hai chiều: hàng là lãnh đạo (Chánh, các PCVP, trưởng phòng), cột là phòng; ô tích là "đang phụ trách". Đổi phân công = bỏ tích ô cũ, tích ô mới, gõ lý do và ngày hiệu lực (mặc định hôm nay). Hệ thống **không xoá** dòng cũ mà đóng `den_ngay`, nên lịch sử "ai phụ trách phòng nào trong tháng nào" giữ nguyên — cần thiết khi tra lại một chỉ đạo cũ do ai ký.

Ràng buộc: một phòng có thể có nhiều lãnh đạo phụ trách (Chánh + PCVP), một lãnh đạo phụ trách nhiều phòng; Chánh Văn phòng luôn phụ trách mọi phòng (dòng cố định, không tắt được). Lãnh đạo phòng (trưởng/phó phòng) tự động phụ trách phòng mình theo `accounts.department`, không cần dòng trong bảng.

Ví dụ tình huống bạn nêu: PCVP đang phụ trách CĐS-CY chuyển sang Tổng hợp → bỏ tích ô (PCVP, CĐS-CY), tích ô (PCVP, Tổng hợp), lý do "QĐ số .../QĐ-VPTU ngày ...", Lưu. Từ giây đó PCVP thấy dashboard KL và việc của phòng Tổng hợp, không còn thấy CĐS-CY. Hai phút, không cần Claude Code, không cần migration.

### 5.5 Tình huống thường gặp

| Tình huống | Làm gì |
|---|---|
| Người giữ `quan_tri_kl` nghỉ phép dài | Cấp tạm cho người thay, ghi lý do có ngày; đặt nhắc trong TRANG-THAI mục 5 để thu lại |
| Người giữ quyền chuyển công tác | Tắt cờ ngay ngày quyết định có hiệu lực; cấp cho người mới; nhật ký giữ cả hai dòng |
| PCVP đổi phòng phụ trách | Màn hình Quản trị → Phụ trách phòng → đổi tích + lý do + ngày (5.4). Không cần PR |
| Chủ dự án chuyển công tác | Migration gán `quan_tri_he_thong` cho người kế nhiệm, thu của người cũ — phải qua PR để có vết trong git, kèm cập nhật `xu-ly-su-co.md` và secret GitHub/Supabase theo checklist bàn giao |
| Nghi ngờ ai đó sửa dữ liệu KL trái phép | Mở `kl_lich_su` lọc theo người; đối chiếu `quyen_lich_su` xem lúc đó người ấy có cờ không |

---

## Phần 6 — Truy vết số liệu ngay trên dashboard

### 6.1 Bài toán

Tình huống bạn nêu là tình huống thật và sẽ xảy ra: đơn vị trình nộp đúng hạn ngày 20/8, chuyên viên theo dõi nhập vào hệ thống ngày 5/9. Trong 16 ngày đó dashboard báo "quá hạn" — và bản PDF gửi lãnh đạo ngày 23/8 ghi đơn vị đó chậm trễ, dù thực tế không phải. Đơn vị bị oan, lãnh đạo mất tin vào số liệu, chuyên viên bị hỏi.

Có ba nguyên nhân khác nhau dẫn tới cùng một dòng đỏ, và dashboard phải **phân biệt được** chúng:

| Nguyên nhân | Bản chất | Ai phải sửa |
|---|---|---|
| (a) Đơn vị thật sự chậm | Số đúng | Đơn vị trình |
| (b) Đơn vị đã xong, chuyên viên chưa cập nhật | Số đúng tại thời điểm nhìn, nhưng **lỗi độ trễ nhập liệu** | Chuyên viên theo dõi |
| (c) Nhập sai hạn / sai loại thời hạn / sai tiến độ | **Lỗi nhập liệu** | Người nhập, có duyệt |

### 6.2 Tách ba mốc thời gian — nền tảng của truy vết

Mọi thứ bên dưới chỉ làm được nếu bảng `kl_nhiem_vu` tách rõ ba ngày, thay vì một cột "Tiến độ" như Excel:

| Cột | Nghĩa | Ai nhập | Ràng buộc |
|---|---|---|---|
| `han_xu_ly` | Hạn đơn vị phải hoàn thành | Chuyên viên, hoặc tự tính (Ký ban hành) | Không trước ngày ban hành |
| `ly_do_chua_co_han` | Vì sao chưa có hạn (khi loại "Có hạn cụ thể" mà hạn trống) | Chuyên viên, bắt buộc khi để trống hạn | Xoá tự động khi điền hạn |
| `ngay_hoan_thanh` | Ngày đơn vị **thực tế** hoàn thành — lấy theo ngày của văn bản minh chứng | Chuyên viên, **bắt buộc khi chuyển Hoàn thành** | ≥ ngày ban hành, ≤ hôm nay |
| `cap_nhat_luc` | Ngày giờ hệ thống ghi nhận | Tự động | Không sửa được |

Từ ba mốc này, hàm trạng thái tính được hai thứ mà bản thủ công không có:

- **Kết quả thực hiện đúng/trễ hạn**: `ngay_hoan_thanh ≤ han_xu_ly` → "Hoàn thành đúng hạn"; ngược lại "Hoàn thành trễ N ngày". Đây là số để đánh giá đơn vị — dựa trên ngày thật, không dựa trên ngày chuyên viên gõ.
- **Độ trễ nhập liệu** = `cap_nhat_luc − ngay_hoan_thanh`. Đây là số để đánh giá phòng Tổng hợp. Trong ví dụ trên: 16 ngày.

### 6.3 Mỗi con số đỏ mở ra được "vì sao đỏ"

Trên dashboard lãnh đạo, bảng quá hạn có cột **"Căn cứ"**, và mỗi dòng bấm vào mở ngăn chi tiết (không rời trang) hiển thị:

```
NV-xxx · Đảng ủy UBND tỉnh · Quá hạn 30 ngày
─────────────────────────────────────────────
Hạn xử lý      15/8/2026   nhập tay bởi <họ tên chuyên viên>, 23/8/2026 09:12
Loại thời hạn  Có hạn cụ thể   nhập bởi <họ tên chuyên viên>, 15/8/2026
Tiến độ        Đang thực hiện  cập nhật lần cuối 1/9/2026 18:03 (13 ngày trước)
Minh chứng     (trống)
Chỉ đạo        chưa có
Lịch sử        4 thay đổi — xem đầy đủ
                                   [Yêu cầu kiểm tra số liệu]  [Đôn đốc]
```

Lãnh đạo đọc ba dòng đầu là tự trả lời được: hạn có phải tự tính không, ai nhập, cập nhật lần cuối cách đây bao lâu. "13 ngày chưa ai đụng vào" cùng "minh chứng trống" là dấu hiệu rất mạnh của nguyên nhân (b), không phải (a).

### 6.4 Trạng thái "đang đính chính" — để dòng sai không đứng nguyên màu đỏ

Khi chuyên viên (hoặc người có `quan_tri_kl`) phát hiện một dòng sai, họ **không sửa thẳng**. Họ bấm "Đề nghị đính chính": chọn trường sai, giá trị đúng, lý do, đính kèm căn cứ (số hiệu văn bản). Từ giây đó:

- Dòng đó trên dashboard đổi sang **cam, nhãn "Quá hạn — đang đính chính"**, tách khỏi ô đếm "Quá hạn" chính, đếm riêng vào ô "Đang đính chính: n".
- Người có `quan_tri_kl` (không phải người đề nghị) duyệt hoặc bác bỏ, có ghi lý do. Duyệt → hệ thống áp giá trị mới, ghi `kl_lich_su` với loại "đính chính đã duyệt" trỏ về đề nghị.
- Nếu snapshot báo cáo trước đó đã tính dòng này là quá hạn, kỳ báo cáo sau ghi một dòng ở cuối: "1 nhiệm vụ kỳ trước ghi quá hạn đã được đính chính: NV-xxx, lý do ...". **Không sửa snapshot cũ.**

Ý nghĩa: lãnh đạo phân biệt được ngay "8 đỏ" là 8 việc thật, còn "2 cam" là 2 việc đang tra soát — và người phụ trách số liệu có đường sửa sai công khai, không phải lặng lẽ sửa rồi hy vọng không ai để ý.

### 6.5 Lãnh đạo chủ động: "Yêu cầu kiểm tra số liệu"

Hành động chỉ đạo thứ 5 (bên cạnh Đôn đốc / Gia hạn / Giao lại / Yêu cầu minh chứng). Lãnh đạo nghi một dòng sai → bấm, ghi một câu. Hệ thống gửi tới chuyên viên chủ trì **và** cả hai người có `quan_tri_kl`; hạn phản hồi 2 ngày. Phản hồi bắt buộc chọn một trong hai: "Số liệu đúng, đơn vị chậm thật" (kèm ghi chú) hoặc "Đã đề nghị đính chính" (tự liên kết tới 6.4). Ô "Chỉ đạo chưa phản hồi" đếm cả loại này.

### 6.6 Bản PDF lãnh đạo — hiện đơn vị, dẫn về được nguồn

Bảng quá hạn trong PDF gồm: **Cơ quan trình · Nội dung (rút gọn) · Hạn · Quá hạn N ngày · Mã NV · Cập nhật cuối (ngày)**. Không có tên chuyên viên. Cột "Cập nhật cuối" là chốt an toàn: một dòng "quá hạn 30 ngày, cập nhật cuối 45 ngày trước" tự nói với người đọc rằng cần xem lại trước khi kết luận đơn vị chậm. Chân trang ghi mã báo cáo; mở app gõ mã NV là ra ngăn chi tiết 6.3.

Nếu kỳ báo cáo có dòng đang đính chính, PDF ghi rõ dòng đó trong bảng với nhãn "(đang tra soát)" — không ẩn, không tính vào tổng quá hạn.

### 6.7 Chỉ số chất lượng số liệu — hiện cho lãnh đạo, mỗi kỳ

Một khối nhỏ cuối dashboard và cuối PDF nội bộ:

- Độ trễ nhập liệu trung bình / lớn nhất trong kỳ (ngày)
- Số việc Hoàn thành chưa có ngày hoàn thành thật (dữ liệu cũ nhập từ Excel sẽ trống hết — phải ghi rõ "78 việc nhập từ Excel, không có ngày hoàn thành gốc")
- Số việc > 30 ngày không ai cập nhật
- Số đính chính trong kỳ, số đã duyệt / bác bỏ

Ba số đầu đo phòng Tổng hợp, không đo đơn vị trình. Hiện công khai để lãnh đạo biết con số "quá hạn" đáng tin đến đâu — và để phòng Tổng hợp có động lực cập nhật lúc việc xảy ra thay vì gom cuối kỳ.

### 6.8 Ngăn lỗi ngay trên form nhập (PR 9A, kiểm thử bắt buộc)

| Ràng buộc trên form | Kiểm thử Playwright |
|---|---|
| Chọn "Có hạn cụ thể" → phải điền hạn HOẶC tích "chưa xác định được hạn" và ghi lý do | Test 3 nhánh: trống cả hai → chặn; có hạn → lưu; có lý do → lưu, trạng thái "Cần điền hạn" |
| Chọn "Ký ban hành" → ô hạn tự điền = ngày BH + 10, khoá không sửa | Test đổi ngày BH → hạn tự đổi theo |
| Hạn < ngày ban hành → chặn | Test nhập hạn trước ngày BH |
| Chuyển sang "Hoàn thành" → bắt buộc ngày hoàn thành; ngày ≤ hôm nay; cảnh báo nếu minh chứng trống (chặn từ GĐ10) | Test 3 nhánh |
| Ngày ban hành > hôm nay → chặn (lỗi năm 2025/2026) | Test nhập năm sai |
| Nhập hạn → hiện ngay "còn N ngày" / "đã quá N ngày" bên cạnh ô | Test hiển thị đúng với 3 mốc |
| Chủ trì trống → không lưu được; dropdown chỉ liệt kê tài khoản đang hoạt động | Test lưu khi trống |
| Dán minh chứng dạng "số hiệu, ngày" → hệ thống gợi ý ngày hoàn thành từ ngày văn bản | Test gợi ý đúng, người dùng sửa được |

Ngoài test tự động: **hai chuyên viên thật dùng thử 3 ngày làm việc trên staging** với 185 dòng thật đã nhập, ghi lỗi vào một bảng theo dõi; go-live chỉ khi không còn lỗi mức "chặn công việc".

---

## Phụ lục — Lệnh mở phiên Claude Code cho GĐ8

```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/SPEC.md, docs/kien-truc.md,
supabase/migrations/0001_baseline.sql, và docs/thiet-ke-theo-doi-kl-btvtu.md
(tài liệu thiết kế mới, đã duyệt).

VIỆC: Giai đoạn 8, PR 8A — schema module "Theo dõi Kết luận BTVTU" theo đúng
Phần 4 mục GĐ8 của tài liệu thiết kế, cộng Phần 5 (quản trị đặc quyền) và
Phần 6 (truy vết số liệu). Chín quyết định đã chốt ghi ở cuối Phần 4.

Yêu cầu bắt buộc:
- Hàm kl_trang_thai(nv, ngay) là nguồn duy nhất của trạng thái; mọi view, RLS test
  và frontend sau này chỉ được gọi hàm này, không tự tính lại.
- Quy tắc dẫn xuất đúng thứ tự Phần 2 mục 2.2, tham số đọc từ kl_cau_hinh.
- Ràng buộc Phần 2 mục 2.3; ràng buộc minh chứng để ở mức cảnh báo (trigger ghi
  cờ), chưa chặn.
- Test RLS thêm case cho 3 vai trò trên kl_nhiem_vu và kl_chi_dao.
- Test hàm trạng thái với ít nhất 8 case biên (Phần 2 mục 2.5).
- Bảng kl_nhiem_vu tách ba mốc: han_xu_ly, ngay_hoan_thanh, cap_nhat_luc (Phần 6.2);
  hàm trạng thái trả thêm ket_qua (đúng hạn/trễ N ngày) và do_tre_nhap_lieu.
- Bảng kl_dinh_chinh + trạng thái "đang đính chính" tách khỏi ô Quá hạn (Phần 6.4).
- Cờ quan_tri_kl và quan_tri_he_thong trên accounts; hàm admin_dat_co ghi
  quyen_lich_su trong cùng transaction; RLS chặn UPDATE trực tiếp lên hai cờ.
  Migration gán quan_tri_he_thong cho buibahaidang; KHÔNG gán quan_tri_kl cho ai
  trong migration — chủ dự án tự cấp qua màn hình Quản trị sau khi phát hành.
- Cột nguon ('excel' | 'app'), ly_do_chua_co_han, cờ thieu_minh_chung trên
  kl_nhiem_vu; CHECK hạn theo Phần 2.3; trạng thái "Cần điền hạn" và "Chờ điều
  kiện" trong hàm kl_trang_thai (Phần 2.2).
- Dữ liệu thật KHÔNG vào repo (Phần 2.4b): bộ dữ liệu vàng là bản ẩn danh sinh
  bằng scripts/an-danh-kl-btvtu.mjs; thêm rule gitleaks chặn .xlsx/.pdf.
- Bảng phu_trach_phong (Phần 5.4) và RLS theo quyết định 7; Realtime bật cho
  kl_nhiem_vu, kl_chi_dao, kl_dinh_chinh (quyết định 8); script nhập 8B sẽ nhập cả
  nhật ký cũ vào kl_lich_su với nguon='excel' (quyết định 9).
- Không đụng vào bảng tasks hiện có.

Plan mode, trình phương án, chờ tôi duyệt. Không commit thẳng main. Migration
production sẽ phát hành bằng tag theo quy trình hiện hành, có backup trước.
```
