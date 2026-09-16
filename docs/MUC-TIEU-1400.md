# MỤC TIÊU — Phụ lục Công văn 1400-CV/VPTU (thước đo mọi giai đoạn từ nay)

Ngày lập: 16/9/2026. Nguồn: Công văn số 1400-CV/VPTU ngày 28/8/2026 của Văn phòng Tỉnh ủy Cao Bằng "về việc xây dựng phần mềm theo dõi việc thực hiện Nghị quyết Trung ương" và Phụ lục kèm theo "Mô tả chi tiết yêu cầu xây dựng phiên bản MVP hệ thống quản lý, điều hành và theo dõi công việc". Bản gốc (PDF có chữ ký) để ngoài repo tại `vptu-backup/nguon-kl-btvtu/`.

Tài liệu này chép lại **nội dung** phụ lục dạng văn bản để làm thước đo; bỏ phần thể thức (chữ ký, nơi nhận, tên người). Mọi tài liệu thiết kế (`SPEC.md` v3, `RA-SOAT-HIEN-TRANG.md`, `LO-TRINH-V3.md`) đối chiếu về đây bằng mã tham chiếu ở cột đầu.

---

## 0. Bối cảnh từ phần chính của công văn

| Mã | Nội dung |
|---|---|
| CV-1 | Tên hệ thống: **Hệ thống quản trị nhiệm vụ theo kết quả**. Không xây hệ thống quy mô lớn ngay; làm trước **phiên bản MVP** (sản phẩm khả dụng tối thiểu), hoàn thành chậm nhất **28/9/2026**. |
| CV-2 | Khi MVP ổn định và chứng minh hiệu quả mới bổ sung module nâng cao: AI bóc tách văn bản, đánh giá KPI, đo độ khó nhiệm vụ, phân tích năng suất cán bộ. |
| CV-3 | MVP chỉ tập trung **05 chức năng cốt lõi**: Giao việc · Quản lý Deadline · Quản lý Sản phẩm (Evidence) · Cảnh báo tự động (Auto-Escalation) · Dashboard quản trị ngoại lệ. |
| CV-4 | Đơn vị phối hợp khảo sát hạ tầng, **tích hợp với hệ thống V-Office hiện tại để tận dụng dữ liệu log**; đầu mối Văn phòng Tỉnh ủy là Phòng Chuyển đổi số - Cơ yếu. |

Ghi chú của dự án: `vptu-mvp-task` là bản MVP nội bộ do Văn phòng Tỉnh ủy tự xây trên Supabase + GitHub Pages; công văn gửi đơn vị viễn thông, nhưng phụ lục là đặc tả nghiệp vụ chung, áp dụng nguyên văn cho bản nội bộ này.

---

## I. Cấu trúc cốt lõi — nguyên tắc 1-1-1-1-3

Hệ thống phải được thiết kế dựa trên nguyên tắc **1-1-1-1-3**: một nhiệm vụ bắt buộc phải có đủ:

| Mã | Thành phần | Yêu cầu nguyên văn |
|---|---|---|
| NT-1 | **01 Owner** | Đúng 01 người/cơ quan chịu trách nhiệm cuối cùng. |
| NT-2 | **01 Product** | 01 sản phẩm đầu ra được định nghĩa rõ ngay từ đầu (Tờ trình, Dự thảo, Báo cáo...). |
| NT-3 | **01 Deadline** | Có mốc thời gian hoàn thành cụ thể. |
| NT-4 | **01 Evidence** | Bắt buộc có tài liệu đính kèm làm bằng chứng. |
| NT-5 | **03 Cấp cảnh báo** | Phân loại cảnh báo theo trạng thái Vàng, Đỏ, Đỏ đặc biệt. |

---

## II. Chi tiết 05 chức năng của phiên bản MVP

### CN-1. Giao việc (Task Creation)

| Mã | Yêu cầu |
|---|---|
| CN-1.1 | **Logic:** hệ thống tích hợp với luồng văn bản hiện tại, tự động lấy mốc đếm ngược (start-date) từ **ngày/giờ nhận văn bản thực tế** trên hệ thống điện tử (log), **không dùng ngày ký ban hành** trên giấy. |
| CN-1.2 | **Ràng buộc:** loại bỏ hoàn toàn các trường dữ liệu mang tính định tính như "Đang xử lý", "Đang xin ý kiến". Người giao việc **chỉ thiết lập Owner, Product và Deadline**. |

### CN-2. Quản lý Thời hạn (Deadline Management)

| Mã | Yêu cầu |
|---|---|
| CN-2.1 | Hệ thống chạy ngầm để đếm ngược thời gian thực (Lead time). |
| CN-2.2 | **Hardcode logic:** các thao tác luân chuyển nội bộ như "đã chuyển văn bản", "đã đọc" **tuyệt đối không làm dừng bộ đếm thời gian**. |

### CN-3. Quản lý Sản phẩm và Bằng chứng (Evidence Management)

| Mã | Yêu cầu |
|---|---|
| CN-3.1 | Nút "Hoàn thành nhiệm vụ" bị vô hiệu hoá, chỉ được phép bấm (sáng lên) khi Owner đã **tải lên hệ thống tài liệu/file minh chứng hợp lệ**. |
| CN-3.2 | **Định nghĩa hoàn thành:** bằng chứng phải là **sản phẩm đầu ra đã được gửi/trình đến đúng cấp có thẩm quyền tiếp theo**; chấm dứt tình trạng báo cáo "đang dự thảo" để xin đóng việc. |

### CN-4. Cảnh báo tự động và leo thang (Auto-Escalation)

Thay thế hoàn toàn quy trình ban hành công văn đôn đốc thủ công bằng 3 cấp độ tự động:

| Mã | Mức | Điều kiện | Hành động tự động |
|---|---|---|---|
| CN-4.1 | **VÀNG** | Chỉ còn **03 ngày** là đến hạn nhưng chưa có sản phẩm | Gửi thông báo (nhắc nhở 1:1) cho Owner. |
| CN-4.2 | **ĐỎ** | Ngay khi đến deadline (quá hạn) | Chuyển trạng thái nhiệm vụ và gửi cảnh báo đến **thủ trưởng trực tiếp quản lý Owner**. |
| CN-4.3 | **ĐỎ ĐẶC BIỆT** | Quá hạn từ **3–5 ngày** | Đẩy thông tin lên **Dashboard của cấp giao nhiệm vụ** (Thường trực / Ban Thường vụ). |

### CN-5. Dashboard quản trị ngoại lệ (Management by Exception)

| Mã | Yêu cầu |
|---|---|
| CN-5.1 | **Mục tiêu:** cung cấp cho Thường trực và Văn phòng Tỉnh ủy cái nhìn trực quan về các điểm nghẽn. **Bỏ qua các nhiệm vụ đang màu Xanh.** |
| CN-5.2 | **Hiển thị:** dashboard chỉ hiển thị các nhiệm vụ Đỏ/Nghẽn với **04 trường thông tin bắt buộc**: (1) **Cá nhân chủ trì thực hiện** — tên cơ quan/cá nhân đang làm chậm tiến độ; (2) **Bao nhiêu ngày** — số ngày trễ hạn thực tế; (3) **Sản phẩm còn thiếu** — loại văn bản/tài liệu chưa được nộp; (4) **Cấp nào cần quyết định** — cơ quan/lãnh đạo nào có thẩm quyền gỡ vướng mắc này. |

---

## III. Tiến trình hoạt động (workflow chuẩn)

| Mã | Bước | Nội dung |
|---|---|---|
| QT-1 | **Trigger** | Văn bản đến được nhận → tạo nhiệm vụ với Owner, Product, Deadline. Trạng thái: **XANH**. |
| QT-2 | **Tracking** | Hệ thống đếm lùi tự động. |
| QT-3 | **Escalation** | Nếu chậm trễ, hệ thống kích hoạt Vàng → Đỏ → Đỏ đặc biệt, tự động báo cáo vượt cấp theo đúng thiết lập. |
| QT-4 | **Resolution** | Owner tải Evidence lên hệ thống hợp lệ → hệ thống chốt Lead time, ghi nhận hoàn thành và **ĐÓNG** nhiệm vụ. |
| QT-5 | **Exception Review** | Mỗi ngày lãnh đạo chỉ cần mở Dashboard ngoại lệ để ra quyết định xử lý trực tiếp vào các điểm nghẽn thay vì mất thời gian truy vết thủ công. |

---

## IV. Bổ sung của chủ dự án (không có trong phụ lục, chốt trong hội thoại 15/9/2026)

| Mã | Nội dung |
|---|---|
| CĐ-1 | **Mô hình 4 cấp**: Thường trực Tỉnh ủy (3 đồng chí) → Văn phòng Tỉnh ủy → Lãnh đạo phòng chuyên môn → Chuyên viên. Thường trực ra thông báo/kết luận = giao việc cho các cơ quan; Văn phòng nhận việc, thực hiện (minh chứng = tờ trình); lãnh đạo Văn phòng giao tiếp cho 5 phòng (chưa có dữ liệu, để mở) → chuyên viên. |
| CĐ-2 | Thông báo/kết luận của Thường trực Tỉnh ủy **chính là** bước "văn bản đến → tạo nhiệm vụ" (QT-1) của luồng gốc; module KL BTVTU không đặt cạnh hệ thống. |
| CĐ-3 | Owner theo 1400 = "Cơ quan/đơn vị trình" (đơn vị thực hiện), **không phải** "Chủ trì theo dõi" (cán bộ Văn phòng giúp việc); hai vai tách trong mô hình. |

## V. Cách dùng tài liệu này làm thước đo

1. Mỗi giai đoạn trong `LO-TRINH-V3.md` ghi rõ nó đưa hệ thống tới gần mã nào (NT-x, CN-x.y, QT-x, hoặc CĐ-x của mục IV). Giai đoạn không trỏ được về mã nào thì không làm.
2. `RA-SOAT-HIEN-TRANG.md` xếp loại mọi thứ đang có theo bốn mức GIỮ / SỬA / HỢP NHẤT / BỎ, căn cứ vào bảng trên.
3. Điểm nào phụ lục không nói (ví dụ nhiệm vụ thường xuyên, nhiệm vụ chờ điều kiện, dữ liệu cũ không có ngày nhận) thì **không tự suy diễn**, ghi thành câu hỏi trong `CAU-HOI-NGHIEP-VU.md` để chủ dự án quyết.
4. Mốc CV-1 (28/9/2026) là mốc của công văn gửi đơn vị ngoài; lộ trình nội bộ ghi ước lượng riêng và không lấy mốc này làm cam kết kỹ thuật.
