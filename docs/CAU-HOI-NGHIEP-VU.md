# CÂU HỎI NGHIỆP VỤ — những điểm chủ dự án phải quyết trước khi làm v3

Ngày lập: 16/9/2026. Đối chiếu: `MUC-TIEU-1400.md` (mã NT/CN/QT), `RA-SOAT-HIEN-TRANG.md`, `SPEC.md` v3 mục tương ứng. Số liệu lấy từ production ngày 15/9/2026 (chỉ đọc) và cấu trúc file Excel gốc (không chép nội dung dòng).

Cách dùng: mỗi câu có bối cảnh, các phương án kèm hệ quả kỹ thuật, **đề xuất của người viết** (để chủ dự án bác hoặc chọn nhanh), và ô "Quyết định" để trống. `SPEC.md` v3 được viết theo phương án đề xuất và **đánh dấu `[CH-n]`** ở mọi chỗ phụ thuộc; câu nào quyết khác đề xuất thì sửa SPEC ở đúng chỗ đánh dấu. Không câu nào được tự giả định trong mã.

---

## Nhóm A — Owner và chuỗi trách nhiệm (NT-1, CN-4.2, CN-5.2)

### CH-1. Owner là "Cơ quan/đơn vị trình", không phải "Chủ trì theo dõi" — vậy Owner ngoài Văn phòng Tỉnh ủy có nằm trong app không?

**Bối cảnh.** Excel có hai cột khác bản chất: *Cơ quan/đơn vị trình* (đơn vị thực hiện, 13 giá trị) và *Chủ trì theo dõi* (cán bộ Văn phòng Tỉnh ủy giúp việc, 8 người + "VPTU"). Module KL hiện coi chủ trì theo dõi là trục chính (RLS, dashboard "theo chủ trì", màn hình chuyên viên). Theo 1400, **Owner = người/cơ quan chịu trách nhiệm cuối cùng** = cơ quan trình. Trên production: 29/185 việc có cơ quan trình là Văn phòng Tỉnh ủy; **156/185** là đơn vị ngoài (Đảng ủy UBND tỉnh 93, các ban Đảng, đảng ủy trực thuộc…). Những đơn vị này không có tài khoản trong app (app có 49 cán bộ Văn phòng).

| Phương án | Nội dung | Hệ quả kỹ thuật |
|---|---|---|
| A — Owner ngoài app là **đơn vị** (danh mục), không đăng nhập | Nhiệm vụ có `owner_don_vi` (FK danh mục đơn vị = 13 cơ quan **+ 5 phòng của Văn phòng**, để "Owner là phòng" biểu diễn được cùng một cột) **và** `nguoi_theo_doi` (cán bộ VPTU). Vàng gửi người theo dõi; Đỏ gửi lãnh đạo Văn phòng phụ trách; Đỏ đặc biệt lên dashboard Thường trực. Minh chứng do người theo dõi nộp thay (tờ trình đơn vị đã gửi). | Không thêm tài khoản, không mở app ra ngoài cơ quan. Cảnh báo 1:1 tới Owner (CN-4.1) chỉ đúng nghĩa với 29 việc Owner là VPTU/phòng/chuyên viên. |
| B — Tạo **tài khoản đại diện** cho 13 cơ quan | Mỗi cơ quan một tài khoản đăng nhập, tự nộp minh chứng, nhận nhắc Vàng. | Mở app ra ngoài Văn phòng: thêm vai trò "đơn vị ngoài", RLS mới (chỉ thấy việc của mình), quản lý mật khẩu 13 đơn vị, hỗ trợ người dùng ngoài cơ quan. Lớn hơn MVP. |
| C — MVP chỉ áp 1-1-1-1-3 **đầy đủ** cho việc Owner trong Văn phòng (29 việc + việc nội bộ mới); 156 việc ngoài chỉ **theo dõi** như hiện nay | Hai "chế độ" nhiệm vụ. | Hai luồng cảnh báo, hai bộ quy tắc; dashboard phải ghi rõ chế độ; phức tạp hơn A về lâu dài. |

**Đề xuất:** **A**, với ghi chú: khi nối V-Office (CV-4) tài khoản đơn vị ngoài có thể xuất hiện tự nhiên qua hệ thống văn bản, khi đó xét lại B. Mô hình dữ liệu của A chứa được B (thêm `owner_tai_khoan` nullable), không phải làm lại.

**Quyết định (chủ dự án, 16/9/2026):** ☑ **A** — Owner ngoài Văn phòng là đơn vị trong danh mục, không đăng nhập.

### CH-2. "Chủ trì theo dõi" giữ vai gì, và mọi con số "theo chủ trì" hiện nay xử lý thế nào?

**Bối cảnh.** Bản nội bộ tuần 34 xếp hạng khối lượng theo chủ trì; dashboard 10C có ô "theo chủ trì (việc đang mở)"; RLS `kl_pham_vi` lấy phòng của chủ trì làm gốc phân quyền; điều kiện xong GĐ10 là "≥ 9 chuyên viên chủ trì tự cập nhật". Theo 1400 đây là **người theo dõi**, không phải người chịu trách nhiệm kết quả.

| Phương án | Nội dung |
|---|---|
| A | Giữ cột, đổi tên thành **"Người theo dõi"** (`nguoi_theo_doi`); là trục phân quyền nội bộ (ai thấy gì) và trục nhắc việc trong Văn phòng; **mọi số liệu đánh giá kết quả tính theo Owner** (cơ quan trình / phòng / chuyên viên thực hiện). Xếp hạng "theo người theo dõi" chỉ còn ở bản nội bộ, đổi nhãn thành "khối lượng theo dõi", không dùng để đánh giá. |
| B | Bỏ hẳn cột chủ trì; mỗi việc chỉ có Owner. | Với 156 việc Owner ngoài app thì không còn ai trong Văn phòng "đứng tên" để nhắc — trái với cách phòng Tổng hợp đang vận hành. |

**Đề xuất:** **A**.

**Quyết định (16/9):** ☑ **A** — giữ cột, đổi tên "Người theo dõi"; số liệu đánh giá tính theo Owner.

**Bổ sung (17/9/2026, `v3.6.1`):** chủ trì (Owner tài khoản) và người theo dõi **mỗi người tự xác nhận nhận việc**, người này nhận không thay cho người kia (dải "Cần xử lý ngay", thẻ "Việc mới giao", nút ở ngăn chi tiết và `kl_so_chua_xu_ly.viec_moi` đều tính theo chính người xem); khâu nghẽn "Chưa nhận việc" và cảnh báo tự động (`da_nhan_viec`, `v_ngoai_le`) tính khi **chưa ai** nhận.

### CH-3. Chuỗi 4 cấp: cấp phòng có bắt buộc trong chuỗi giao việc không?

**Bối cảnh.** Mô hình 1400 (theo chủ dự án): Thường trực → Văn phòng → Lãnh đạo phòng chuyên môn → Chuyên viên. Hiện 185 việc đều do phòng Tổng hợp theo dõi; 5 phòng chưa có dữ liệu giao việc. CN-1.2: người giao **chỉ đặt Owner, Product, Deadline**.

| Phương án | Nội dung | Hệ quả |
|---|---|---|
| A — Chuỗi **mở**, mỗi mắt xích là một nhiệm vụ con có Owner riêng | Việc cấp Văn phòng (Owner = VPTU) có thể được lãnh đạo Văn phòng **giao tiếp** cho một phòng (Owner = phòng, người nhận = trưởng phòng) rồi trưởng phòng giao cho chuyên viên (Owner = chuyên viên). Mỗi cấp một deadline ≤ deadline cấp trên. Không bắt buộc đủ cấp: có thể giao thẳng chuyên viên. | Cột `nhiem_vu_cha`; deadline con ≤ cha (CHECK); hoàn thành cha không tự động — cần quyết ở CH-4. |
| B — Cố định 2 cấp trong Văn phòng (Văn phòng → chuyên viên), phòng chỉ là thuộc tính | Đơn giản; không có "việc của phòng". | Không phản ánh "lãnh đạo phòng chuyên môn" trong mô hình 4 cấp. |

**Đề xuất:** **A**, trường "giao tiếp cho phòng" **để mở** (nullable, không bắt buộc), nhập dần khi có dữ liệu (điểm 6 của chủ dự án).

**Quyết định (16/9):** ☑ **A** — chuỗi mở, `nhiem_vu_cha`; "giao tiếp cho phòng" để mở, không bắt buộc.

### CH-4. Khi có nhiệm vụ con, việc cha "Hoàn thành" thế nào? Ai là "thủ trưởng trực tiếp" ở mỗi cấp (CN-4.2)?

| Câu | Phương án | Đề xuất |
|---|---|---|
| 4a. Cha hoàn thành khi | (i) Owner cha nộp minh chứng của cha (tờ trình đã trình lên cấp trên), không phụ thuộc con; (ii) tự động khi mọi con xong | **(i)** — đúng CN-3.2 (bằng chứng là sản phẩm đã trình đúng cấp); con xong không có nghĩa cha đã trình. Dashboard cảnh báo nếu cha còn mở mà mọi con đã xong quá 2 ngày. |
| 4b. Thủ trưởng trực tiếp của Owner | Chuyên viên → trưởng phòng (`accounts.department`); phòng → PCVP phụ trách phòng (`phu_trach_phong` tại ngày) ; Văn phòng → Chánh Văn phòng; đơn vị ngoài → **lãnh đạo Văn phòng phụ trách lĩnh vực** (kiêm nhiệm lĩnh vực nếu có, không thì PCVP phụ trách phòng Tổng hợp) | như cột bên; điểm cần chốt là mắt xích **đơn vị ngoài**. |

**Quyết định 4a (16/9):** ☑ **(i)** cha hoàn thành bằng minh chứng của cha — **4b:** ☑ **đồng ý** (đơn vị ngoài → lãnh đạo Văn phòng phụ trách lĩnh vực/phòng theo dõi).

---

## Nhóm B — Product và Evidence (NT-2, NT-4, CN-3)

### CH-5. Product (sản phẩm đầu ra) — bắt buộc khi giao việc mới; 185 việc cũ để trống nhập bổ sung: ai nhập, đến khi nào, có chặn gì không?

**Bối cảnh.** Excel không có cột sản phẩm đầu ra. Cột "Nội dung kết luận / Văn bản trình" mô tả yêu cầu, không phải sản phẩm. 1400 đòi Product định nghĩa rõ ngay từ đầu (Tờ trình, Dự thảo, Báo cáo…).

| Phương án | Nội dung |
|---|---|
| A | Trường `san_pham` (loại từ danh mục: Tờ trình / Dự thảo văn bản / Báo cáo / Kế hoạch / Quyết định / Công văn / Khác + mô tả ngắn) **bắt buộc khi tạo mới**. 185 dòng cũ: NULL, nhãn "chưa định nghĩa sản phẩm (dữ liệu chuyển đổi)"; **việc còn mở** (39) phải được người theo dõi điền trong 10 ngày làm việc sau phát hành (dashboard đếm); việc đã đóng (146) điền khi tiện, không chặn. Không chặn Hoàn thành vì thiếu Product với dòng cũ. |
| B | Bắt buộc với cả dòng cũ khi bất kỳ ai sửa dòng (không lưu được nếu chưa điền). | Cản chuyên viên cập nhật nhanh; ngược lại mục tiêu "cập nhật < 30 giây". |

**Đề xuất:** **A**. Danh mục sản phẩm là câu hỏi phụ: chủ dự án cho danh sách hoặc dùng 7 loại trên.

**Quyết định (16/9):** ☑ **A** — Danh mục sản phẩm: ☑ **dùng 7 loại đề xuất**.

### CH-6. Minh chứng hợp lệ là gì? Tệp bắt buộc hay số hiệu văn bản là đủ?

**Bối cảnh.** 1400: "tài liệu đính kèm", "Owner đã tải lên tệp minh chứng hợp lệ", "sản phẩm đã gửi/trình đến đúng cấp có thẩm quyền tiếp theo". Excel: 76/185 có minh chứng, **toàn bộ là chữ** (số hiệu văn bản, ngày; 0 đường dẫn, 0 tệp); 78/146 việc Hoàn thành không có minh chứng. Từ GĐ10 (migration 0021) chuyển Hoàn thành phải có minh chứng dạng chữ + ngày hoàn thành. Dạng điển hình (theo ví dụ chủ dự án nêu): một thông báo kết luận giao việc cho Văn phòng → sản phẩm là một hoặc nhiều **tờ trình có số hiệu** của Văn phòng gửi cấp trên; minh chứng hợp lệ là các tờ trình đó.

| Phương án | Định nghĩa "hợp lệ" | Hệ quả |
|---|---|---|
| A — **Tệp bắt buộc** | Ít nhất một tệp (PDF/DOC/DOCX/XLSX, ≤ 20 MB) **và** số hiệu + ngày + cấp nhận. | Cần Supabase Storage (bucket riêng, RLS theo nhiệm vụ), quét dung lượng, tải lên từ điện thoại. Đúng nguyên văn 1400. |
| B — **Số hiệu văn bản là đủ**, tệp tuỳ chọn | Số hiệu + ngày + cấp nhận (ba trường có cấu trúc, không còn ô chữ tự do); tệp đính kèm khuyến khích. | Không cần Storage ngay; văn bản đã tồn tại trên V-Office nên số hiệu tra được. Lệch với chữ "tải lên tệp" của 1400. |
| C — Tệp **hoặc** liên kết V-Office | Như A nhưng chấp nhận liên kết tới văn bản trên V-Office thay tệp. | Cần biết dạng liên kết V-Office; hiện chưa nối. |

**Xử lý dữ liệu cũ (áp cho mọi phương án):** 76 minh chứng chữ giữ nguyên, tách tự động thành số hiệu/ngày khi nhận dạng được (52/76 có dạng số-ký hiệu), gắn cờ `minh_chung_kieu = 'chu_truoc_1400'`; **không** coi là vi phạm, không đánh giá lại 146 việc đã đóng. Việc còn mở (39) khi chuyển Hoàn thành phải theo định nghĩa mới.

**Đề xuất:** **A** cho việc tạo mới từ ngày phát hành v3 (đúng 1400, Storage trên gói Pro đủ dung lượng), **B** làm bước đệm một giai đoạn nếu chưa kịp làm Storage — ghi rõ trong lộ trình là bước đệm, không phải đích.

**Quyết định (16/9):** ☑ **B** — **số hiệu + ngày + cấp nhận** là minh chứng hợp lệ; tệp **tuỳ chọn**, **không dùng Supabase Storage** (chưa có kinh phí gói Pro). Tệp đính kèm là **việc chờ điều kiện kinh phí**, không phải bước đệm có hạn; khi có kinh phí mới mở lại A. Hệ quả: GĐ15B rút còn nộp minh chứng có cấu trúc, bỏ migration policy Storage, NF-12 chuyển thành "khi có tệp".

### CH-7. Cấp có thẩm quyền "tiếp theo" ghi ở đâu, và "Cấp nào cần quyết định" (CN-5.2 mục 4) lấy từ đâu?

**Bối cảnh.** Hai khái niệm khác nhau: (a) cấp nhận sản phẩm (để minh chứng hợp lệ — CN-3.2); (b) cấp có thẩm quyền gỡ vướng khi việc nghẽn (dashboard ngoại lệ). Excel không có cả hai. Luồng tasks cũ có cột `authority_level` (cấp có thẩm quyền) chưa dùng.

**Đề xuất:** hai trường riêng, đều **danh mục**: Thường trực Tỉnh ủy / Ban Thường vụ / Chánh Văn phòng / Phó Chánh Văn phòng / Trưởng phòng / Đơn vị trình. (a) bắt buộc khi tạo mới, mặc định = cấp ngay trên Owner; (b) **để mở** khi tạo, người theo dõi hoặc lãnh đạo điền khi việc chuyển Đỏ (dashboard ngoại lệ hiện "chưa xác định" cho tới khi điền, và đếm số việc Đỏ chưa có cấp quyết định). Dòng cũ: cả hai NULL.

**Quyết định (16/9):** ☑ **đồng ý** — hai danh mục cấp riêng; cấp nhận bắt buộc khi tạo mới, cấp quyết định để mở.

---

## Nhóm C — Deadline và mốc bắt đầu (NT-3, CN-1.1, CN-2)

### CH-8. Bốn loại thời hạn (Có hạn cụ thể / Ký ban hành 10 ngày / Thường xuyên / Chờ quyết định) đối chiếu với "1 Deadline" — và ba trạng thái "Thường xuyên / Chờ điều kiện / Cần điền hạn"

**Bối cảnh (production 15/9).** Có hạn cụ thể 110 (trong đó **65 không có hạn**: 62 đã Hoàn thành từ Excel + 3 đang mở đã gán lý do "phụ thuộc yếu tố bên ngoài"); Ký ban hành 25 (hạn tự tính = ngày ban hành + 10); Thường xuyên 20; Chờ quyết định 30. Hàm `kl_trang_thai` sinh ra ba trạng thái không có deadline: Thường xuyên (16 đang mở), Chờ điều kiện (6), Cần điền hạn (3). 1400 không có khái niệm việc không hạn; CN-1.2 cấm trường định tính.

| Phương án | Nội dung | Hệ quả |
|---|---|---|
| A — Mọi nhiệm vụ **tạo mới** bắt buộc có deadline; ba trạng thái không hạn chỉ tồn tại cho **dữ liệu cũ** và tự hết theo thời gian | "Thường xuyên" → tạo nhiệm vụ theo **kỳ** (mỗi kỳ một deadline, ví dụ báo cáo tháng); "Chờ quyết định" → deadline = **ngày phải có quyết định/điều kiện** (nếu chưa biết, người giao đặt ngày rà soát, tối đa 30 ngày, đến hạn phải gia hạn có lý do); "Cần điền hạn" bị loại bỏ với việc mới. | Đúng 1400. Form tạo mới bỏ chọn loại thời hạn không hạn; giữ enum cho dòng cũ. Việc thường xuyên cũ (20) giữ nguyên, hiển thị nhóm riêng, không vào leo thang. |
| B — Giữ 4 loại cho cả việc mới; chỉ "Có hạn cụ thể" và "Ký ban hành" vào leo thang; hai loại còn lại có **hạn rà soát định kỳ** (30 ngày) để không vô hình | Gần cách phòng Tổng hợp đang làm. | Hai loại việc "ngoài" 1-1-1-1-3 tồn tại lâu dài; dashboard phải luôn có nhóm ngoại lệ. |
| C — Bỏ hẳn loại thời hạn, chỉ còn deadline; dữ liệu cũ không hạn → gán deadline giả | Sạch nhất. | Gán hạn giả cho 65 việc là suy đoán hồi tố — trái nguyên tắc đã chốt ở GĐ8. |

**Đề xuất:** **A**. Ba trạng thái không hạn là **di sản chuyển đổi**, có ngày kết thúc: sau khi mọi việc cũ đóng, chúng biến mất khỏi dashboard. Tham số "ngày rà soát tối đa 30" đặt trong cấu hình.

**Câu phụ 8b — 3 việc đang mở "Cần điền hạn"** (đã có lý do "phụ thuộc yếu tố bên ngoài" chốt 14/9): (i) ép người theo dõi điền hạn (hoặc ngày rà soát) trong 10 ngày làm việc sau phát hành v3; (ii) giữ nguyên tới khi yếu tố bên ngoài rõ, chỉ đếm tuổi. Đề xuất (i).

**Quyết định (16/9):** ☑ **A** — việc mới bắt buộc có deadline; ☑ việc thường xuyên mới **tạo theo kỳ**; 8b: ☑ **(i)** — 3 việc "Cần điền hạn" điền hạn hoặc ngày rà soát trong 10 ngày làm việc sau phát hành v3.

### CH-9. Ngày bắt đầu đếm khi chưa nối V-Office: trường "ngày nhận văn bản", tạm bằng ngày ban hành, sửa dần — ai sửa, sửa đến khi nào, và "Ký ban hành trong 10 ngày" tính từ ngày nào?

**Bối cảnh.** Excel chỉ có *Ngày ban hành*; 1400 cấm dùng ngày ký để đếm (CN-1.1). Lead time (QT-4) và tuổi việc cần mốc bắt đầu. Với loại "Ký ban hành (trong 10 ngày)" hạn hiện = ngày ban hành + 10 (khớp 25/25 dòng).

**Đề xuất:**
- Thêm `ngay_nhan_van_ban` (ngày, sau này là ngày giờ từ log V-Office). Khi nhập từ Excel/nhập tay không có ngày nhận: **tạm = ngày ban hành**, cờ `ngay_nhan_uoc_tinh = true`; dashboard ghi rõ "n việc dùng ngày ban hành thay ngày nhận". Người theo dõi sửa khi biết ngày nhận thật (tra sổ văn bản đến); không đặt hạn chót sửa cho việc đã đóng.
- Với việc tạo mới từ v3: ngày nhận **bắt buộc**, mặc định = hôm nay, không được sau hôm nay, không được trước ngày ban hành.
- "Ký ban hành trong 10 ngày": hạn = **ngày ban hành + 10** (giữ, vì đây là quy định về thời hạn ký ban hành tính từ ngày ban hành kết luận), còn **lead time** tính từ ngày nhận. Hai mốc dùng cho hai việc khác nhau.

**Quyết định (16/9):** ☑ **đồng ý** — `ngay_nhan_van_ban` tạm = ngày ban hành có cờ ước tính; việc mới bắt buộc ngày nhận; "Ký ban hành" hạn = ngày ban hành + 10, lead time từ ngày nhận.

### CH-10. Ngưỡng cảnh báo: Vàng 3 ngày (1400) thay 7 ngày "sắp đến hạn" hiện tại; Đỏ đặc biệt 3 hay 5 ngày; áp ngay cho 8 việc quá hạn cũ?

**Bối cảnh.** `kl_cau_hinh` hiện: sắp đến hạn 7 ngày. 1400: Vàng khi còn 3 ngày; Đỏ đặc biệt khi quá hạn "từ 3–5 ngày". Production có 8 việc quá hạn (4–30 ngày) — nếu áp ngay, toàn bộ 8 lên dashboard Thường trực ngày đầu.

**Đề xuất:** Vàng = **3** ngày; Đỏ đặc biệt = quá hạn **≥ 3 ngày** (lấy cận dưới, để cảnh báo sớm; tham số cấu hình 3–5 do chủ dự án chỉnh); áp cho **mọi việc đang mở kể cả cũ** từ ngày phát hành, vì che đi việc cũ là trái tinh thần 1400 — nhưng dashboard Thường trực chỉ bật (CH-11) sau khi lãnh đạo Văn phòng đã rà 8 việc này một lần.

**Câu phụ 10b — ngưỡng "sắp đến hạn" 7 ngày hiện có** (`nguong_sap_den_han_ngay`, dùng cho ô "Sắp đến hạn" ở tổng quan và danh sách): (i) giữ hai ngưỡng — trạng thái "Sắp đến hạn" vẫn 7 ngày để lọc/xem, mức cảnh báo Vàng 3 ngày để gửi nhắc; (ii) gộp: sắp đến hạn = Vàng = 3 ngày. Đề xuất (i) — bộ số hồi quy 14/9 không đổi và lãnh đạo vẫn nhìn được việc sắp tới sớm hơn.

**Quyết định (16/9):** Vàng ☑ **3** — Đỏ đặc biệt ☑ **3** — Áp cho việc cũ ☑ **có** — 10b: ☑ **(i)** giữ hai ngưỡng (Sắp đến hạn 7 để xem, Vàng 3 để nhắc).

---

## Nhóm D — Thường trực Tỉnh ủy và kênh thông báo (CN-4.3, CN-5)

### CH-11. Ba tài khoản Thường trực Tỉnh ủy có đăng nhập trực tiếp không?

| Phương án | Nội dung | Hệ quả |
|---|---|---|
| A — Có, vai trò mới **A0 (Thường trực)**, chỉ đọc dashboard ngoại lệ + được ghi "ý kiến chỉ đạo" | 3 tài khoản thật; thấy mọi việc Đỏ đặc biệt (và tuỳ chọn mọi việc). | RLS thêm vai trò; seed staging thêm 1 tài khoản giả; đào tạo 3 người dùng cấp cao; rủi ro mật khẩu. |
| B — Không; dashboard "cấp Thường trực" là một **màn hình của Chánh Văn phòng** (và bản xuất PDF/HTML) để trình | Thường trực nhận bản in/PDF hoặc xem qua máy của Văn phòng. | Không thêm vai trò; "đẩy lên dashboard Thường trực" = xuất hiện ở màn hình đó + báo Chánh Văn phòng. Sát thực tế vận hành hiện nay (PDF tuần 34). |
| C — B trước, A khi Thường trực yêu cầu | | Mô hình dữ liệu chuẩn bị sẵn vai trò A0 (không mất gì). |

**Đề xuất:** **C**.

**Quyết định (16/9):** ☑ **A** — vai trò `A0` cho 3 tài khoản Thường trực Tỉnh ủy, **chỉ đọc + ghi ý kiến chỉ đạo**; PR 17B làm theo nhánh A. Tài liệu ghi chức danh, không ghi tên.

### CH-12. "Tự động gửi thông báo" qua kênh nào khi cơ quan chưa có email nội bộ và Zalo/SMS ngoài phạm vi?

**Đề xuất:** giai đoạn v3: thông báo **trong app** (ô chuông + tin nhắn hệ thống trong `direct_messages`, realtime) là kênh chính thức; ghi nhật ký gửi (`thong_bao` bảng riêng, có `da_doc`). Kênh ngoài (Zalo OA/SMS/email) là giai đoạn sau, cần hợp đồng dịch vụ. Thông báo tự động sinh bởi job chạy ngầm trong DB (`pg_cron`, mỗi giờ) — cần bật extension trên gói Pro.

**Quyết định (16/9):** ☑ **đồng ý** — thông báo trong app là kênh chính thức. **Cách chạy ngầm đổi theo KT-4**: workflow cron GitHub Actions gọi RPC bằng service_role (không có `pg_cron`).

---

## Nhóm E — Dữ liệu chuyển đổi (185 việc)

### CH-13. 146 việc Hoàn thành không có ngày hoàn thành gốc: xử lý thế nào?

| Phương án | Nội dung | Hệ quả |
|---|---|---|
| A | Giữ NULL, gắn nhãn "dữ liệu chuyển đổi, không đánh giá đúng/trễ hạn"; mọi chỉ số kết quả (đúng hạn, lead time) chỉ tính trên việc có ngày thật và **ghi mẫu số** ngay trên ô. | Như thiết kế GĐ8; trung thực; 146 việc không bao giờ có lead time. |
| B | Người theo dõi nhập bổ sung **ngày của văn bản minh chứng** cho 68 việc có minh chứng (tách tự động khi nhận dạng được ngày trong chuỗi; xác nhận tay); 78 việc không minh chứng giữ NULL. | Có lead time cho ~68 việc; công sức nhập ước 2–3 giờ. |
| C | Coi ngày hoàn thành = ngày cập nhật cuối. | Suy đoán hồi tố, sai với 149 dòng không có ngày cập nhật gốc. Không đề xuất. |

**Đề xuất:** **A ngay, B tuỳ chọn** (không là điều kiện xong giai đoạn nào).

**Quyết định (16/9):** ☑ **A + B tuỳ chọn** — giữ NULL và không đánh giá; nhập bổ sung ngày văn bản minh chứng cho 68 việc khi tiện, không là điều kiện xong giai đoạn.

### CH-14. Phạm vi "văn bản giao việc": chỉ thông báo/kết luận của Thường trực, Ban Thường vụ hay mọi văn bản đến Văn phòng?

**Bối cảnh.** Chủ dự án chốt: thông báo/kết luận của Thường trực Tỉnh ủy chính là bước "văn bản đến → tạo nhiệm vụ". 185 việc hiện có đều từ kết luận Hội nghị BTV (32 số văn bản, 30 hội nghị). Công văn gốc nói "theo dõi việc thực hiện Nghị quyết Trung ương" và "văn bản đến được nhận".

**Đề xuất:** thực thể **văn bản giao việc** (`van_ban_giao_viec`) tổng quát: loại (Kết luận BTV / Thông báo Thường trực / Nghị quyết TW / Công văn / Khác), số hiệu, ngày ban hành, ngày nhận, cơ quan ban hành, số hội nghị (nullable, chỉ với BTV). Bảng `kl_hoi_nghi` hiện có chuyển thành bảng này. MVP nhập từ hai nguồn: kết luận BTV (như nay) và thông báo Thường trực; loại khác cho phép nhưng không bắt buộc dùng.

**Quyết định (16/9):** ☑ **đồng ý tổng quát** — thực thể `van_ban_giao_viec` tổng quát; MVP nhập từ kết luận BTV và thông báo Thường trực, loại khác cho phép.

### CH-15. Điều kiện "chạy song song 2 kỳ với Google Sheet" và "≥ 9 chuyên viên tự cập nhật" còn giữ không khi mô hình đổi?

**Đề xuất:** giữ nguyên tắc **một kỳ đối chiếu số tổng** với sheet sau khi hợp nhất thực thể (số tổng 185 và bộ trạng thái 146/16/8/6/6/3/0 tại 14/9 phải không đổi: việc đổi tên bảng/hàm và thêm màu cảnh báo không đụng thứ tự quy tắc dẫn xuất; ngưỡng "sắp đến hạn" giữ 7 nếu CH-10b = (i)), rồi tắt sheet; bỏ điều kiện "≥ 9 chuyên viên" thay bằng "mọi việc đang mở đã có Product và ngày nhận (ước tính hay thật) do người theo dõi xác nhận".

**Quyết định (16/9):** ☑ **đồng ý** — một kỳ đối chiếu số tổng sau hợp nhất rồi tắt sheet; bỏ điều kiện "≥ 9 chuyên viên".

### CH-16. Thường trực Tỉnh ủy (A0) có ra "chỉ đạo" trên nhiệm vụ không, hay chỉ ghi ý kiến?

**Bối cảnh:** GĐ18 (`v3.4.0`) cho A0 xem toàn bộ và ghi chỉ đạo loại `Y_KIEN` (bình luận, không tính chờ phản hồi). Thường trực cần một kênh chỉ đạo có hạn phản hồi và có người chịu trách nhiệm trả lời, tách khỏi ý kiến thông thường.

**Quyết định (16/9):** ☑ **có — loại chỉ đạo riêng `CHI_DAO_TT`** (làm ở GĐ19):
- Chỉ A0 gửi; A1/A2 không dùng loại này.
- Người nhận bắt buộc: Chánh Văn phòng + PCVP phụ trách phạm vi của nhiệm vụ (phòng/ngành–lĩnh vực).
- Hạn phản hồi mặc định **2 ngày làm việc** (A0 sửa được khi gửi).
- Hiện ở **đầu Dashboard A1** và đếm vào ô "cấp cần quyết định".
- A1 **phản hồi** hoặc **chuyển thành giao việc/đôn đốc** (chỉ đạo con gắn với chỉ đạo Thường trực); A0 thấy trạng thái phản hồi.
- Quá hạn phản hồi → tin hệ thống cho A1 (Chánh VP + PCVP), **không leo thang thêm**.

---

## Nhóm F — Câu hỏi kỹ thuật có ảnh hưởng nghiệp vụ (chủ dự án chỉ cần phản đối nếu không đồng ý)

| # | Đề xuất | Lý do |
|---|---|---|
| KT-1 | Hợp nhất bằng cách **phát triển `kl_nhiem_vu` thành `nhiem_vu`** (đổi tên, thêm cột) và **bỏ** `tasks`, `task_evidences`, `task_directives` (production 0 dòng, staging chỉ dữ liệu giả). | Bên có dữ liệu, ràng buộc, lịch sử, RLS đã kiểm (113 test RLS, hơn nửa cho KL) là bên KL; luồng cũ rỗng. |
| KT-2 | `direct_messages` giữ làm kênh thông báo và nhắn tin; `kl_chi_dao` thành `chi_dao` dùng chung. | Tránh hai bảng chỉ đạo. |
| KT-3 | Trạng thái nhiệm vụ = **một hàm** `trang_thai(nv, ngay)` mở rộng từ `kl_trang_thai` (thêm màu XANH/VÀNG/ĐỎ/ĐỎ ĐẶC BIỆT, lead time). Frontend không tự tính. | Đã chốt GĐ8, giữ. |
| KT-4 | ~~Cảnh báo tự động chạy bằng `pg_cron` trong Postgres (gói Pro)~~ **Đổi (chủ dự án 16/9):** cảnh báo tự động chạy bằng **workflow cron GitHub Actions** gọi RPC `canh_bao_quet()` bằng service_role (secret repository), vì không có gói Pro nên không có `pg_cron`. Không thêm server. | Ghi rõ trong SPEC mục 6, LO-TRINH 16A, `kien-truc.md`. |
| KT-5 | Tệp minh chứng ở Supabase Storage, bucket `minh-chung`, RLS theo phạm vi nhiệm vụ; không lưu tệp trong repo/Pages. | Duy nhất chỗ lưu tệp trong stack hiện có. |

**Quyết định (16/9):** KT-1, 2, 3, 5 ☑ **không phản đối**; KT-4 ☑ **đổi** như trên.

## Nhóm G — Quyết định khi làm PR-2a (tối ưu DB và phân quyền giao việc, migration 0048–0052)

| # | Câu hỏi | Quyết định | Kiểm bằng |
|---|---|---|---|
| G-1 | Phó Chánh Văn phòng có giao việc cho lãnh đạo Văn phòng (Chánh VP, PCVP khác) được không? | **Không (29/9/2026) — giữ nguyên hành vi DB.** Lãnh đạo Văn phòng thuộc `department` = lãnh đạo, ngoài mọi phòng PCVP phụ trách; Owner hay người theo dõi là lãnh đạo đều bị chặn. Chỉ Chánh VP giao việc cho lãnh đạo Văn phòng. Biểu mẫu Giao việc của PCVP không hiện các lựa chọn này. | RLS `kl-pq-pham-vi-giao` #7 |
| G-2 | PCVP kiêm nhiệm theo ngành–lĩnh vực giao việc thế nào (C3)? | **Giao đúng lĩnh vực kiêm nhiệm (28/9/2026).** Quyền giao theo đúng quy tắc phạm vi xem (phòng, ngành, lĩnh vực): PCVP kiêm nhiệm chỉ giao việc thuộc lĩnh vực mình kiêm nhiệm ở phòng đó; lĩnh vực đã có lãnh đạo khác kiêm nhiệm thì PCVP phụ trách cả phòng **không** giao được. Biểu mẫu chỉ liệt kê tổ hợp được giao (`kl_pham_vi_giao`, cùng hàm `giao_viec` dùng để chặn). | RLS `kl-pq-pham-vi-giao` #1–6; e2e `giao-viec-kiem-nhiem` |
| G-3 | Ai xem được ảnh hồ sơ (Q5)? | **(a) Mọi người đã đăng nhập (28/9/2026); anon bị chặn.** Bucket riêng tư, hiển thị bằng signed URL. | RLS `kl-pq-storage-anh-ho-so`; e2e `ca-nhan-anh` |
| G-4 | Owner/người theo dõi có tự đổi hạn xử lý được không (Q7)? | **Không (28/9/2026).** Chỉ điền hạn khi đang trống (việc "Cần điền hạn"); mọi lần đổi khác đi qua chỉ đạo `GIA_HAN`; `quan_tri_kl` giữ quyền sửa. | RLS `kl-pq-q7-khoa-han-xu-ly`; e2e `cap-nhat-nhanh-han` |

## Nhóm H — Quyết định khi làm PR-2b (hạn nộp minh chứng, nghiệm thu, migration 0053–0060)

> **Từ v3.17 (0077, yêu cầu của chủ dự án 7/10/2026, mục 4.1): bỏ hẳn hạn nộp minh chứng** — mỗi việc chỉ còn hạn hoàn thành; nộp minh chứng và nghiệm thu đều tính theo hạn đó; trả lại chỉ cần lý do (không còn hạn nộp lại); nhắc `CHAM_NOP_MC`, nhãn cam "Chậm nộp minh chứng", màn sửa hạn nộp không còn. Các dòng H-1, H-3, H-4, H-6, H-8, H-10, H-11 dưới đây là **lịch sử**; H-2, H-5, H-7, H-9, H-12 vẫn hiệu lực (H-2 nay áp cho mọi việc theo 1400; H-6 đổi thành: nộp đúng hạn = ngày nộp lượt được nghiệm thu ≤ hạn hoàn thành).

| # | Câu hỏi | Quyết định | Kiểm bằng |
|---|---|---|---|
| H-1 (Q1) | Việc cũ chưa có hạn nộp minh chứng chuyển đổi thế nào? | **Không còn (29/9/2026)** — production đã reset, 0 nhiệm vụ. Không có phần chuyển đổi. Nhập Excel qua giao diện (2/10/2026): việc còn mở đi qua `giao_viec` (`nguon = app`, có hạn nộp gợi ý); chỉ việc "đã xong ngoài hệ thống" ghi `nguon = excel`, để trống hạn nộp như việc cũ. | RLS `kl-0058-trang-thai-nghiem-thu` |
| H-2 (Q2) | Lãnh đạo xác nhận hợp lệ có đóng việc không? | **Có (a)** — nghiệm thu = đóng trong cùng giao dịch, ngày hoàn thành = ngày văn bản minh chứng. Việc có hạn nộp chỉ đóng khi có minh chứng hợp lệ, ở mọi đường (nút Đóng, Cập nhật nhanh, trigger). | RLS `kl-0028-minh-chung`; e2e `nghiem-thu` |
| H-3 (Q3) | Trả lại khi đã qua hạn hoàn thành? | **(b)** hạn nộp lại ∈ [hôm nay, 2 ngày làm việc sau]; chưa qua hạn: ∈ [hôm nay, H]. Hạn hoàn thành giữ nguyên, vẫn tính Quá hạn. | RLS `kl-0028-minh-chung` |
| H-4 (Q4) | Ai sửa hạn nộp khi không còn người giao? | **Quản trị KL (a)**, bắt buộc lý do, có lịch sử; không suy người giao từ người theo dõi. | RLS `kl-0054-han-nop-minh-chung` |
| H-5 (Q8) | Ai nghiệm thu việc Thường trực giao Chánh VP? | **Thư ký Thường trực**, lịch sử "thay mặt Thường trực — <tên>"; không có thư ký thì quản trị KL. Quyền đọc thêm đúng các việc này. | RLS `kl-0057-nghiem-thu-thu-ky`; e2e `nghiem-thu` |
| H-6 (Q9) | "Nộp minh chứng đúng hạn" nghĩa là gì? | Minh chứng **được nghiệm thu** có ngày nộp (giờ VN) ≤ hạn áp dụng cho lượt nộp đó (hạn gốc hoặc hạn nộp lại liền trước); báo cáo kèm số lần trả lại. | RLS `kl-0058-trang-thai-nghiem-thu` |
| H-7 (Q10) | Danh mục ngày nghỉ khởi tạo? | **Để trống**; quản trị nhập lịch 2026–2027 ở Quản trị › Ngày nghỉ sau phát hành (việc tay trong `TRANG-THAI.md`). | RLS `kl-0053-ngay-lam-viec` |
| H-8 (Mới 1) | "Chậm nộp minh chứng" hiển thị ra sao? | Nhãn riêng **màu cam** (token `--cam` trong `DESIGN-V8.md`), mức Vàng, **không** leo thang Đỏ. | e2e `han-nop-minh-chung` |
| H-9 (Mới 2) | Quá hạn ở bước nghiệm thu tính chậm cho ai? | **Lãnh đạo nghiệm thu** (`nguoi_chiu_cham`); người nộp thấy nhãn trung tính "Đã nộp — chờ nghiệm thu", không bị tính chậm. | e2e `nghiem-thu` |
| H-10 | Việc có hạn hoàn thành đã qua lúc giao? | **Không để trống (30/9)** — hạn nộp bắt buộc trong [hôm nay, 2 ngày làm việc sau], gợi ý mốc cuối; việc vẫn tính Quá hạn. Hạn còn < 1 ngày làm việc: đường "việc gấp có lý do". | RLS `kl-0054-han-nop-minh-chung` |
| H-11 | Hạn nộp bắt buộc với cả service_role? | **Không (30/9)** — chỉ ép với phiên người dùng (nhập liệu, test dựng dữ liệu bằng service_role không bị ép). | RLS `kl-0054-han-nop-minh-chung` |
| H-12 | GIAO_LAI của PCVP theo phạm vi nào? | **Theo phạm vi giao (30/9)** — như `giao_viec`, kể cả kiêm nhiệm; các vai khác giữ nguyên như 0045. | RLS `kl-pq-giao-lai-pham-vi` |
| H-13 | Nhịp nhắc việc? | **Một lần mỗi ngày 07:30 (30/9)** — `canh-bao.yml` giữ lịch; nhắc lặp chỉ vào ngày làm việc. | RLS `kl-0060-nhac-nghiem-thu` |


## Nhóm I — Quyết định 1/10/2026: tiếp thu tính năng phần mềm điều hành của lãnh đạo (PR-3, migration 0062–0067)

| # | Câu hỏi | Quyết định | Kiểm bằng |
|---|---|---|---|
| I-1 | Nhập dữ liệu của phần mềm điều hành? | **Không** — chỉ tiếp thu tính năng; dữ liệu đó là thử nghiệm. | — |
| I-2 | Chất lượng hoàn thành? | 4 mức, **bắt buộc khi nghiệm thu đóng việc**; trả lại không kèm; đường đóng cũ tuỳ chọn, **Owner tự đóng không được chấm** (lãnh đạo / quản trị KL thì được). | RLS `kl-pr3-chat-luong-nguon`; e2e `pr3-hien-thi`, `nghiem-thu` |
| I-3 | Nguồn nhiệm vụ? | 6 mục cố định, **bắt buộc khi giao** (phiên người dùng); mặc định theo loại văn bản ở cả văn bản mới và có sẵn; người giao / quản trị KL đổi được. | RLS `kl-pr3-chat-luong-nguon`; e2e `han-nop-minh-chung` (ma trận), `pr3-giao-that` |
| I-4 | Vướng mắc / đề nghị lãnh đạo quyết định? | Owner, người theo dõi, lãnh đạo A1/A2 trong phạm vi, quản trị KL sửa; xoá trống = đã giải quyết; tin lần đầu tới người giao vai A1/A2 + PCVP phụ trách (không có ⇒ `nguoi_nghiem_thu_chinh`); **không gửi A0** (A0 chỉ đọc và chỉ đạo; việc Thường trực giao ⇒ thư ký theo nhánh dự phòng). Đếm "Cần xử lý ngay" cho A1 và A2. | RLS `kl-pr3-vuong-mac-ra-soat`; e2e `pr3-vuong-mac` |
| I-5 | "Trước hạn"? | Trường mới `tien_do_hoan_thanh`; `ket_qua` giữ nguyên ⇒ số liệu, bộ mốc 14/9 không đổi; chỉ tách ở hiển thị. | RLS `kl-pr3-chat-luong-nguon` (D), `kl-moc-2026-09-14` |
| I-6 | Đơn vị phối hợp? | Chữ tự do ≤ 300, tuỳ chọn; người giao / quản trị KL sửa. | RLS `kl-pr3-chat-luong-nguon` |
| I-7 | Rà soát văn bản? | Số nhiệm vụ dự kiến + cờ đã rà soát toàn văn; "đã nhập" = **tổng thật** (hàm DB, chỉ trả cho văn bản người xem được); quyền sửa như trích yếu. | RLS `kl-pr3-vuong-mac-ra-soat`; e2e `pr3-hien-thi` |
| I-8 | Xuất Excel / In? | .xlsx thật (tự ghi, không thư viện ngoài, nạp động); Nhiệm vụ: danh sách đang lọc; Báo cáo: theo phòng + theo nguồn + Đỏ; tên `vptu-nhiem-vu-<yyyymmdd>.xlsx`, `vptu-bao-cao-<yyyymmdd>.xlsx`; A3 cũng xuất được (RLS giới hạn). | unit `frontend/tests/xlsx.test.mjs`; e2e `pr3-hien-thi` |
| I-9 | Chuyên viên tự ghi nhận việc? | **Không làm** — giữ nguyên tắc chỉ lãnh đạo giao. Hoãn: chu kỳ lặp (sau go-live), xuất lịch .ics. Nhập Excel qua giao diện **đã làm** (giao diện v9 đợt 2, cho quản trị nhiệm vụ / quản trị hệ thống). | — |

## Nhóm J — Quyết định 1/10/2026: sửa vai trò / phòng / chức danh tài khoản (PR-4, migration 0068)

| # | Câu hỏi | Quyết định | Kiểm bằng |
|---|---|---|---|
| J-1 | Ai sửa vai trò / phòng / chức danh tài khoản đã tạo? | Chỉ quản trị hệ thống, lý do bắt buộc, nhật ký cũ → mới từng cột; không tự đổi vai của mình; không sửa tài khoản hệ thống. | RLS `kl-0068-sua-tai-khoan`, e2e `pr4` |
| J-2 | Phòng theo vai? | A0 không phòng; A1 = Lãnh đạo Văn phòng; A2/A3 = phòng chuyên môn trong `dm_don_vi`. Một Trưởng phòng (A2) chưa khoá mỗi phòng. | RLS `kl-0068-sua-tai-khoan` |
| J-3 | Đổi vai Chánh Văn phòng? | **Chặn** — chỉ sửa chức danh (cờ `is_chief` không đổi qua màn hình). | RLS `kl-0068-sua-tai-khoan` |
| J-4 | Rời A1 khi còn phân công phụ trách / kiêm nhiệm hiệu lực? | **Chặn** — kết thúc ở bảng Phân công trước. Cùng tinh thần (0069, sau review): còn là lãnh đạo phụ trách đơn vị ngoài (`dm_don_vi`) cũng chặn — đổi lãnh đạo phụ trách trước. | RLS `kl-0068-sua-tai-khoan` |
| J-5 | Sang A0 khi còn cờ quản trị KL / thư ký Thường trực? | **Chặn** — thu cờ trước. | RLS `kl-0068-sua-tai-khoan` |
| J-6 | ~~Mở~~ **Đã quyết 8/10/2026:** việc đang mở có người theo dõi là Trưởng phòng cũ (lưu cố định lúc giao) — khi người đó đổi vai/phòng, có chuyển sang Trưởng phòng mới không? | **Có, chuyển hàng loạt có lý do** (v3.20 Đợt D, migration 0092 `admin_chuyen_theo_doi`): Quản trị → Tài khoản → "Chuyển việc theo dõi" (quản trị hệ thống hoặc Chánh Văn phòng) — xem trước số việc đang mở, lý do bắt buộc, việc đã hoàn thành giữ nguyên, lịch sử từng việc + tin cho người nhận. SPEC QT-8. | Chủ dự án duyệt kế hoạch Đợt D (8/10/2026) |
