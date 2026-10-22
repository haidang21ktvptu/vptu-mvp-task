# DESIGN — Hệ thống thiết kế VPTU-TASK

Mục tiêu: giao diện **trang trọng như một văn bản của Đảng**, **mang dấu ấn Cao Bằng**, và **dùng được cả ngày** cho 49 cán bộ trên máy tính văn phòng lẫn điện thoại. Không phải giao diện "startup". Không màu mè. Một điểm nhấn duy nhất, còn lại kỷ luật.

**Đặc tả UI/UX hiện hành: giao diện v9 — mục 10 dưới đây và bản mẫu `docs/ui-ux/mockup-v9.html`** (bản 6, chốt 02/10/2026; từ v3.14.0). Khi khác với các mục 1–9 hay với `docs/ui-ux/mockup-v8/` (`DESIGN-V8.md`, chốt 21/9/2026), **v9 thắng** (ví dụ hai kiểu giao diện, chữ Lexend / Source Sans 3 / Noto Serif, trang Tổng quan). Phần v9 không nói tới thì v8 rồi các mục 1–9 vẫn áp dụng. Bản cũ `docs/ui-ux/mockup-v7.html` và `mockup/index.html` giữ làm lịch sử. Khi phân vân, chọn phương án **trầm và ít hơn**.

---

## 1. Ý tưởng dẫn dắt

Ba nguồn hình ảnh, mỗi nguồn cho đúng một thứ:

| Nguồn | Lấy gì | Không lấy gì |
|---|---|---|
| **Văn bản của Đảng** | Màu đỏ sẫm dùng tiết chế, chữ có chân cho tên cơ quan, bố cục thẳng hàng, khoảng trắng rộng | Không dùng đỏ tràn nền; không gradient đỏ-vàng |
| **Non nước Cao Bằng** (núi đá vôi, suối Lê-nin, thác Bản Giốc) | Nền trang màu đá vôi ấm; xanh ngọc cho "hoàn thành"; hình núi lớp chồng ở trang đăng nhập | Không ảnh chụp làm nền; không icon phong cảnh rải rác |
| **Thổ cẩm Tày – Nùng** | Nền chàm cho thanh bên; một dải hoa văn hình thoi mảnh ở đầu trang | Không hoa văn lặp toàn màn hình |

**Điểm nhấn duy nhất:** trang đăng nhập với hình núi đá vôi xếp lớp bằng SVG màu chàm và dải hoa văn thổ cẩm. Toàn bộ phần bên trong (dashboard, bảng, form) giữ yên tĩnh để dữ liệu nổi lên.

**Biểu tượng tỉnh Cao Bằng** (`frontend/public/brand/logo-cao-bang.png`, PNG nền trong suốt 1280×819, do Văn phòng cung cấp): không tự vẽ, **không đổi màu, không kéo méo tỷ lệ**. Dùng ở đúng 3 chỗ: trang đăng nhập (rộng 112px, căn giữa, phía trên tên cơ quan), thanh bên (rộng 40px trong ô nền trắng bo 4px để đủ tương phản trên nền chàm, cạnh chữ "Văn phòng Tỉnh ủy") và favicon (`favicon-32.png`, `apple-touch-icon-180.png` nền trắng — xuất từ file gốc bằng script, không vẽ lại). Biểu tượng Đảng (búa liềm) và Quốc huy: không tự vẽ, không tải từ nguồn không rõ; chỉ dùng khi Văn phòng cung cấp file chính thức. Trong mockup còn để ô trống có nhãn "Biểu tượng chính thức".

---

## 2. Màu sắc

Token CSS (đặt trong `frontend/src/styles/tokens.css` và `tailwind.config.js`):

| Token | Hex | Tên gọi | Dùng cho |
|---|---|---|---|
| `--cb-do` | `#A6192E` | Đỏ Đảng | Nút hành động chính, tiêu đề mục quan trọng, viền trên thẻ đăng nhập. **Tối đa 1–2 chỗ mỗi màn hình.** |
| `--cb-vang` | `#C9A227` | Vàng sao | Gạch nhấn dưới tên cơ quan, hoa văn thổ cẩm, huy hiệu số. Không dùng làm nền. |
| `--cb-cham` | `#1C2A44` | Chàm Tày–Nùng | Thanh bên, đầu trang, nền hình núi. Tạo sự trang trọng thay cho màu đỏ. |
| `--cb-ngoc` | `#2E7D6E` | Ngọc Pác Bó | Trạng thái hoàn thành, thông báo thành công, mức XANH. |
| `--cb-da` | `#F4F2ED` | Đá vôi | Nền trang. |
| `--cb-giay` | `#FFFFFF` | Giấy | Nền bảng, thẻ, form. |
| `--cb-muc` | `#1D2433` | Mực | Chữ chính. |
| `--cb-muc-nhat` | `#5B6474` | Mực nhạt | Chữ phụ, nhãn cột. |
| `--cb-vien` | `#DDD8CE` | Viền | Đường kẻ bảng, viền input. |

Màu mức cảnh báo (khớp `alert_level` của view):

| Mức | Hex nền | Hex chữ/viền | Cách hiển thị |
|---|---|---|---|
| XANH | `#E6F2EF` | `#2A7365` | Dải màu 4px bên trái dòng. Chữ/viền đậm hơn ngọc một bậc vì `#2E7D6E` trên nền nhạt chỉ đạt 4.28:1 với chữ 12px |
| VANG | `#FBF3DF` | `#8A6512` | Dải màu bên trái |
| DO | `#FDECEA` | `#C92A1E` | Dải màu bên trái, nhãn trạng thái đỏ |
| DO_DAC_BIET | `#F3E8FF` | `#6B21A8` | **Tím đậm** (v3.23.2): dải bên trái, chấm, nhãn trạng thái tím có ‼ |
| HOAN_THANH | `#E6F2EF` | `#2A7365` | Chữ mực nhạt, dải ngọc |

v3.23.2 (chủ dự án 14/10/2026): Đỏ và Đỏ đặc biệt phải phân biệt được bằng mắt ngay — Đỏ đặc biệt đổi sang **tím đậm** (token `--ddb`, `--ddb-nhat`, `--nen-ddb`; biểu đồ `--f-ddb`, chữ trên nó `--f-ddb-chu`); nền tối: Đỏ `#F97A70`, Đỏ đặc biệt `#C4A1F5`. `--do-dam` (đỏ rượu) chỉ còn cho Hỏa tốc và chỉ đạo Thường trực, không dùng cho mức cảnh báo.

Quy tắc: **màu là thông tin, không phải trang trí.** Mỗi màu xuất hiện vì nó nói lên trạng thái hoặc vai trò, không vì "cho đẹp".

---

## 3. Chữ

Hai họ chữ, vai trò rõ ràng, đều có bộ dấu tiếng Việt đầy đủ; **tự host** tại `frontend/public/fonts/` (woff2, subset Vietnamese + Latin, khai báo ở `src/styles/fonts.css`) vì mạng cơ quan có thể chặn Google Fonts:

| Họ chữ | Vai trò | Lý do |
|---|---|---|
| **Noto Serif** | Tên cơ quan ở đầu trang, tiêu đề trang đăng nhập, tiêu đề văn bản trong modal | Gợi sự trang trọng của văn bản hành chính, gần chữ Times quen thuộc mà rõ trên màn hình |
| **Be Vietnam Pro** | Toàn bộ giao diện còn lại | Thiết kế riêng cho tiếng Việt, dấu không bị lệch, đọc tốt cỡ nhỏ trong bảng |

Thang cỡ (px / độ đậm / giãn dòng):
- Tên cơ quan: 20 / Serif 600 / 1.3, chữ hoa có dấu, giãn chữ 0.02em
- Tiêu đề trang: 24 / 600 / 1.3
- Tiêu đề mục: 17 / 600 / 1.4
- Thân: 15 / 400 / 1.6
- Bảng: 14 / 400 / 1.5
- Nhãn phụ: 13 / 500 / 1.4, màu mực nhạt, **viết hoa chữ đầu, không viết hoa toàn bộ**

Không dùng chữ hoa toàn bộ cho nhãn cột. Không in nghiêng để nhấn một từ. Không dùng chữ đơn cách (monospace) cho số liệu.

---

## 4. Bố cục

**Khung ứng dụng (sau đăng nhập):**
```
┌──────────────┬─────────────────────────────────────────┐
│  THANH BÊN   │  ĐẦU TRANG: Tỉnh ủy Cao Bằng · Văn phòng │
│  (chàm)      │  ─ dải hoa văn thổ cẩm mảnh ─            │
│              ├─────────────────────────────────────────┤
│  Bảng điều   │  Tiêu đề trang              [Giao việc] │
│  khiển       │                                         │
│  Nhiệm vụ    │  Thanh số liệu: 12 · 3 · 5 · 20 (1 hàng)│
│  Ý kiến      │                                         │
│  Nhắn tin    │  Bảng dữ liệu (nền giấy, viền mảnh)     │
│              │  ▌ dòng có dải màu mức cảnh báo         │
│  ── ─ ──     │  ▌                                      │
│  Tên · vai   │                                         │
└──────────────┴─────────────────────────────────────────┘
```
- Thanh bên 240px, nền chàm, chữ trắng 90%. Mục đang chọn: nền chàm sáng hơn + dải vàng 3px bên trái.
- Nội dung căn trái, lề 32px, rộng tối đa 1280px.
- Thanh số liệu là **một hàng có đường kẻ dọc phân cách**, không phải 4 thẻ rời.
- Bảng: dòng cao 44px, kẻ ngang mảnh màu viền, không kẻ dọc, dòng chẵn không tô màu. Mức cảnh báo là dải 4px bên trái dòng.
- Bo góc: 4px cho input và nút, 6px cho thẻ. Không bo tròn lớn. Bóng đổ: chỉ modal, `0 8px 24px rgba(28,42,68,.18)`.

**Trang đăng nhập:**
```
┌─────────────────────────────────────────────┐
│ (nền chàm, núi đá vôi xếp lớp mờ dần)       │
│                                             │
│        ┌───────────────────────┐            │
│        │ ▔▔ viền đỏ 4px ▔▔     │            │
│        │ [ô biểu tượng]        │            │
│        │ TỈNH ỦY CAO BẰNG      │  serif     │
│        │ Văn phòng Tỉnh ủy     │            │
│        │ Hệ thống quản trị     │            │
│        │ nhiệm vụ              │            │
│        │ ─ dải thổ cẩm ─       │            │
│        │ Tên đăng nhập         │            │
│        │ Mật khẩu              │            │
│        │ [ Đăng nhập ]  đỏ     │            │
│        └───────────────────────┘            │
│  Phòng Chuyển đổi số – Cơ yếu · 0869 134 298│
└─────────────────────────────────────────────┘
```

**Điện thoại (≤768px):** thanh bên thu thành thanh dưới 4 mục; bảng chuyển thành danh sách thẻ, mỗi thẻ vẫn có dải màu mức cảnh báo bên trái.

---

## 5. Thành phần

| Thành phần | Quy định |
|---|---|
| Nút chính | Nền đỏ Đảng, chữ trắng, 40px cao, chữ 15/500. Một nút chính mỗi vùng. |
| Nút phụ | Viền 1px mực nhạt, nền trong suốt. |
| Nút nguy hiểm (từ chối, xoá) | Viền đỏ, chữ đỏ, nền trắng. Chỉ đổi nền đỏ khi rê chuột. |
| Input | Cao 40px, viền 1px, focus: viền chàm 2px. Nhãn trên input, không placeholder thay nhãn. |
| Huy hiệu số chưa đọc | Tròn 18px, nền vàng sao, chữ mực đậm 12px. |
| Modal bắt buộc (A3 tiếp nhận) | Viền trên 4px đỏ, tiêu đề serif, không có nút đóng ở góc. |
| Toast | Góc dưới phải, nền chàm, chữ trắng, 4 giây. Không rung, không trượt vào. |
| Trạng thái trống | Một câu hướng dẫn + nút hành động. Không hình minh hoạ. |

---

## 6. Hoa văn thổ cẩm (SVG gốc, tự vẽ)

Dải cao 6px lặp ngang, hình thoi lồng nhau, màu vàng sao 60% trên nền chàm. Dùng đúng 3 chỗ: dưới đầu trang, trên form đăng nhập, chân trang in. Không dùng ở bảng, thẻ, nút.

```html
<svg width="0" height="0"><defs>
<pattern id="thocam" width="16" height="6" patternUnits="userSpaceOnUse">
  <path d="M0 3 L4 0 L8 3 L4 6 Z M8 3 L12 0 L16 3 L12 6 Z"
        fill="none" stroke="#C9A227" stroke-opacity=".6" stroke-width="1"/>
</pattern></defs></svg>
<div style="height:6px;background:url(#thocam)"></div>
```

---

## 7. Chuyển động

- Không hiệu ứng khi tải trang, trừ **một** lần: hình núi ở trang đăng nhập hiện dần trong 600ms.
- Mở/đóng luồng ý kiến, mở chi tiết inline: trượt dọc 160ms.
- Tôn trọng `prefers-reduced-motion`: tắt toàn bộ.

---

## 8. Giọng văn trong giao diện

- Trang trọng, ngắn, chủ động. "Giao việc", "Tiếp nhận", "Nộp minh chứng", "Duyệt hoàn thành".
- Xưng hô: "đồng chí" trong thông báo gửi tới người dùng ("Đồng chí có 2 việc chờ tiếp nhận").
- Lỗi nói rõ việc gì và làm gì tiếp: "Hạn hoàn thành phải sau hôm nay. Chọn lại ngày."
- Không dấu chấm than, không biểu tượng cảm xúc, không tiếng Anh.

---

## 9. Kiểm tra trước khi nộp giao diện

- [ ] Màu đỏ xuất hiện không quá 2 chỗ trên màn hình
- [ ] Tương phản chữ ≥ 4.5:1 (kiểm bằng Lighthouse)
- [ ] Dùng được bằng bàn phím, focus nhìn thấy
- [ ] 360px không vỡ bố cục
- [ ] Không chữ hoa toàn bộ ở nhãn, không tiếng Anh
- [ ] Hoa văn thổ cẩm đúng 3 chỗ
- [ ] So với `docs/ui-ux/mockup-v9.html` (màn hình tương ứng), đúng bố cục, màu, chữ — xem ở cả hai kiểu và nền tối

---

## 10. Giao diện v9 (từ v3.14.0 — đợt 1)

**Hai kiểu giao diện và nền tối.** Token ở `frontend/src/styles/tokens.css`; mặc định là Thanh lịch, `<html data-kieu="trang-nghiem">` là Trang nghiêm, `<html data-theme="dark">` là nền tối (đi được với cả hai kiểu). Người dùng chọn ở menu bánh răng, nhóm "Kiểu giao diện" (hai mục chọn một và mục bật/tắt "Nền tối"); lựa chọn nhớ **theo máy** (`localStorage` `vptu.kieu`, `vptu.nen-toi`), được gắn bằng đoạn script đầu `index.html` trước khi vẽ để không nháy màu.

| | Thanh lịch (xanh lam) | Trang nghiêm (đỏ son) | Nền tối |
|---|---|---|---|
| Nền trang / thẻ | sương `#E9EEF5` / trắng | ấm `#F3EEED` / trắng | xanh đêm `#0E1B2D` / `#152740`; Trang nghiêm: đêm ấm `#1A1315` / `#261C1F` |
| Thanh bên, khối trái đầu trang | `#15395F` → `#0E2A49`, chữ trắng | đỏ son `#A82029` → `#84181F` | sẫm hơn cùng sắc |
| Nhấn | vạch son 3px trên cùng; nút chính son `#C0262D`; mục chọn sáng hơn + biểu tượng vàng sao `#E9C46A`; số đếm nền son | nút chính `#A61E27`; số đếm và vạch dải đầu vàng sao | khối đặc màu sáng dùng chữ tối `#0B1626` (`v9.css`) |

Màu mức cảnh báo (Vàng, Đỏ, Đỏ đặc biệt) và trạng thái giữ **cùng nghĩa ở mọi kiểu**; biểu đồ dùng bộ `--f-*` (đúng hạn, trễ, nghiệm thu, vàng, đỏ, đỏ đặc biệt). Không thêm màu ngoài token. Nền tối chỉ áp trên màn hình — bản in / PDF luôn dùng token sáng. **Tương thích:** không dùng `color-mix()` hay tính năng CSS cần trình duyệt mới hơn Chrome 109 (máy Windows 7/8.1 của cơ quan); chữ / nền phải đạt 4.5:1 ở cả bốn chế độ (viền tiêu điểm trên nền đặc của thanh bên màu trắng).

**Chữ** (thay mục 3; tự host woff2 biến thiên 400–700, subset Vietnamese + Latin, `src/styles/fonts.css`; bỏ Be Vietnam Pro và Lora): **Lexend** cho tiêu đề trang, tiêu đề khối, con số lớn; **Source Sans 3** cho thân chữ, bảng, nút, ô nhập; **Noto Serif** cho tên cơ quan ở đầu trang, dòng ngày theo thể thức ("Cao Bằng, ngày 02 tháng 10 năm 2026", in nghiêng) và nội dung ý kiến chỉ đạo.

**Khung.** Đầu trang: khối trái cùng màu thanh bên mang biểu trưng và tên cơ quan theo thể thức văn bản của Đảng (TỈNH ỦY CAO BẰNG / VĂN PHÒNG / dấu sao vàng), cạnh đó dòng ngày; bỏ ảnh Bản Giốc ở đầu trang. 601–900px: khối trái thu còn 56px, tên cơ quan nằm cạnh. Điện thoại (≤600px): cả dải đầu màu thanh bên, thanh dưới 4 mục, mục đang chọn có gạch son phía trên.

**Tổng quan** (trang mở đầu của Thường trực, lãnh đạo Văn phòng, Trưởng phòng — "Tổng quan phòng"; Chuyên viên không có): dải đầu với bốn số (giao trong kỳ, hoàn thành, đang mở, cảnh báo), vòng tỷ lệ đúng hạn và đường xu hướng các tháng từ đầu năm; chọn kỳ Tháng / Quý / Năm đổi tại chỗ; dải cảnh báo Đỏ, Đỏ đặc biệt; bảy khối: theo tháng, cơ cấu việc đang mở, theo phòng / đơn vị chủ trì / cán bộ (tuỳ vai), theo văn bản, theo lĩnh vực, chất lượng nghiệm thu, ý kiến chỉ đạo. Mỗi tên, số bấm được → danh sách Nhiệm vụ đã lọc (chip "← Về Tổng quan") hoặc màn hình chi tiết. Phạm vi số liệu do RLS quyết định; frontend chỉ đếm (`lib/kl/tong-quan.js`).

**Giải ngân vốn đầu tư công trên Tổng quan** (v3.28): khối rộng hết hàng ngay sau Điểm nghẽn. Vòng % và chip mức dùng màu trạng thái sẵn có (lục: đạt / đúng tiến độ, vàng: chậm, đỏ: chậm nhiều) **luôn kèm chữ mức** — chữ khác "Vàng / Đỏ" của cảnh báo hạn. Biểu đồ % qua các kỳ: đường liền `--du-lieu` = lũy kế, đường đứt `--chu-mo` = tiến độ đều tới mục tiêu, chấm rỗng = số ước tính; nét không co giãn (`vector-effect`), chấm và chữ là HTML đặt theo % nên không méo ở mọi độ rộng; mỗi chấm nhận tiêu điểm bàn phím, có gợi ý. Bảng chủ đầu tư: tỷ lệ thấp trước, đơn vị dưới mức chung của tỉnh nền `--nen-vang-mo` kèm chữ "dưới mức chung của tỉnh". Hộp "Nhập kỳ số liệu" rộng 1000px (bảng xem trước cuộn trong khung, tiêu đề cột dính trên).

**Cần xử lý** (đổi tên từ "Điều hành", tiêu đề "Cần xử lý hôm nay"): đầu trang là ba câu hỏi — *Ai đang chậm? Nghẽn ở đâu? Cần đồng chí quyết?* — trả lời bằng tên và số; bấm một ô lọc danh sách như bấm thanh trái / ô số. Trưởng phòng xem câu trả lời theo cán bộ, không lọc. Phần còn lại giữ như v8: dòng việc đủ bốn thông tin theo Công văn 1400, nghiệm thu ngay trên dòng, chỉ đạo chờ trả lời.

**Giao việc.** Trên biểu mẫu là dải quy tắc **1-1-1-1-3** (một chủ trì, một sản phẩm, một hạn hoàn thành, một minh chứng, ba mức cảnh báo) sáng dần theo ô đã điền. Dưới các ô Chịu trách nhiệm / Sản phẩm / Hạn hoàn thành có hàng "Chọn nhanh" (chọn nhanh = chọn trong ô, cùng kiểm tra; hạn 7 / 14 / 30 ngày, cuối tháng tính từ ngày nhận văn bản, nhãn ghi rõ ngày). Giao tiếp xuống: khối "Kế thừa từ cấp trên" (nội dung, văn bản, hạn, sản phẩm của việc cha — chỉ xem) và hạn gợi ý "Sớm 3 / 5 / 7 ngày" trước hạn của cấp trên. Cột phải "Văn bản đang nhập": đã nhập / dự kiến và các việc vừa nhập, dùng cùng nút "Giao, nhập tiếp" để nhập liền một văn bản.

**Đợt 2 (đã làm, migration 0070–0075).**
- **Ngăn chi tiết dùng chung:** mọi chỗ "bấm để xem" (số, biểu đồ, bảng ở Tổng quan; ô ở Cần xử lý; dòng ở Theo văn bản, Báo cáo, Cán bộ, Cần nghiệm thu; chuông, tìm nhanh) mở ngay tại chỗ, hai tầng Danh sách → Chi tiết, không đổi mục.
- **Nhập theo tầng:** cấp dưới chỉ xem ô cấp giao đã điền (biểu tượng khoá), muốn đổi thì gửi **Đề nghị sửa** (lý do bắt buộc; người giao Chấp nhận / Giữ nguyên kèm ý kiến; người gửi rút được). Cấp giao sửa ngay (biểu tượng bút, "Sửa thông tin giao", lý do bắt buộc, lịch sử + tin cho chủ trì). "Việc của tôi" của Chuyên viên: từ v3.25 là bảng theo cột, thao tác mở ngay dưới dòng (mục 11).
- **Nhập Excel toàn trình** (thẻ "Nhập từ Excel" / "Chờ hoàn thiện (n)" trên màn Giao việc; chuyên viên quản trị nhiệm vụ và quản trị hệ thống):
  - Chuẩn ba mức, tô màu ở mẫu: mức 1 vàng (đủ để giao), mức 2 lam (tiến độ), mức 3 lục (đủ để đóng: minh chứng 4 yếu tố + chất lượng).
  - Hai bước. *1. Ghép cột:* tự nhận sheet, dòng tiêu đề, hồ sơ (Mẫu nhập chuẩn, Phụ lục 2, hồ sơ đã lưu dùng chung); ví dụ ngày dạng dd/mm/yyyy. *2. Xem trước* (chưa ghi gì): kết quả dự kiến từng dòng; giá trị chưa khớp / khớp gần đúng → chọn mục đúng, lưu từ điển dùng chung; điền hàng loạt ô trống (lĩnh vực theo từng ngành); một dòng tóm tắt các ô tự điền theo quy tắc mặc định; chọn cách xử lý việc đã hoàn thành của tệp.
  - Nhập theo lô (mã LO-…): lỗi giữa chừng → "Nhập tiếp" đúng lô đó. Hoàn tác lô trong 24 giờ. Dòng thiếu vào "Chờ hoàn thiện" → Hoàn thiện bằng biểu mẫu Giao việc điền sẵn, hoặc bỏ.
  - Ngăn chi tiết có khối "Dữ liệu gốc từ Excel" (mọi cột của dòng tệp). Màn Nhiệm vụ có "Xuất theo mẫu nhập" để sửa rồi nhập lại theo mã.

## 11. Bảng nhiệm vụ theo cột (v3.25.0 — mẫu 16/10/2026, chủ dự án duyệt 18/10/2026)

Mọi danh sách nhiệm vụ (Nhiệm vụ, Việc tôi theo dõi, Việc của tôi, Theo văn bản) là **bảng có cột** kiểu V-Office; thay "dòng cao 44px" của mục 4 cho các bảng này. CSS `styles/bang-nhiem-vu.css` (khung, cột) + `styles/bang-man-hinh.css` (màn hẹp, in); lớp tiền tố `bnv-` (tên trong mẫu như `.bang .han .stt` đã là lớp chung), viết nguyên văn trong JS.
- **Ô số** trên bảng: một khối, các ô cách nhau 1px, chia đều một hàng; ô đang chọn nền `--navy-dac`, chữ trắng, số `--vang-tren-dac`; chọn một ô một lúc; số của ô = số dòng khi chọn ô đó (cùng một mảng). Bộ 8 ô: 4 + 4 ở 861–1199px; ≤ 860px hai ô một hàng.
- **Dòng**: cao ≥ 58px, kẻ ngang mảnh, không kẻ dọc, không sọc; **mép trái 4px theo mức** (lam trong hạn, vàng, đỏ, tím Đỏ đặc biệt — nền tím nhạt cả dòng, lục hoàn thành); hàng tiêu đề chữ 13px đậm vừa màu `--chu-phu` trên nền `--nen-mo`; giờ và con số bằng Lexend; mã việc đậm màu navy; ô Hạn: ngày đậm theo màu mức + dòng phụ "còn 3 ngày / trễ 4 ngày / xong 29/9 · trước hạn 1 ngày"; Trạng thái là nhãn màu. Chú giải màu ngay trên bảng.
- **Cột**: Nhiệm vụ — STT | Thời gian nhập | Nhiệm vụ | Văn bản giao | Chủ trì theo dõi | Hạn xử lý | Trạng thái; Việc tôi theo dõi — STT | Nhiệm vụ | Chủ trì theo dõi | Văn bản giao | Hạn xử lý | Trạng thái | Tình hình (xám bình thường, vàng cần đôn đốc, đỏ vướng mắc / chỉ đạo chờ, lục đã nộp minh chứng); Việc của tôi — STT | Nhiệm vụ | Văn bản giao | Thời gian giao | Hạn xử lý | Trạng thái | Việc cần làm; Theo văn bản — STT | Văn bản | Ngày nhận | Người giao | Nhiệm vụ (đã nhập / dự kiến) | Tiến độ (thanh lục / đỏ / vàng + "x/n hoàn thành") | Cảnh báo, bấm tên văn bản mở bảng con (Nhiệm vụ của văn bản | Chủ trì theo dõi | Hạn xử lý | Trạng thái; việc giao tiếp xuống thụt "↳").
- **Việc cần làm** (Việc của tôi): một nút cho việc đầu tiên áp dụng — Xác nhận đã nhận việc (nút lam, kèm nút viền "Từ chối") → Trả lời chỉ đạo → Nộp minh chứng (nút lam khi việc gấp) → Cập nhật tiến độ; không có việc chờ thì chữ xám. Biểu mẫu mở **ngay dưới dòng** (khối viền trái theo mức), mỗi lúc một khối, Huỷ đưa con trỏ về nút đã mở.
- **Trang**: 50 dòng mỗi trang; chân bảng "Hiển thị 1–50 trong 230 nhiệm vụ (lọc từ 812)" + "‹ Trang trước · Trang 1/5 · Trang sau ›"; đổi ô số / tìm / lọc / sắp xếp về trang 1. In và Xuất Excel lấy đủ danh sách.
- **Ngăn chi tiết** (màn Nhiệm vụ) hiện **cạnh** bảng (520px; 420px khi ≤ 1180px), không phủ lên bảng; khi ngăn mở, dưới 1600px dòng thành thẻ gọn.
- **Màn hẹp**: 1024–1365px gộp cột thời gian vào dòng phụ dưới nội dung; < 1024px mỗi dòng là thẻ, mỗi ô có nhãn (`data-nhan`); ≤ 600px nội dung 3 dòng, nút thao tác rộng hết thẻ (≥ 44px); 360px không cuộn ngang.
- **In**: ẩn ô số, chú giải, nút trang, khối dưới dòng và cột Việc cần làm; dòng không bị cắt giữa trang.

## 12. Tên ô nhiệm vụ theo bảng Phụ lục (v3.28.1 — chủ dự án quyết 22/10/2026)

"Phải theo đúng như các cột ở file excel … để thuận tiện sử dụng." Mọi màn hình (Giao việc, Nhiệm vụ và ngăn chi tiết, Tổng quan, Theo văn bản,
Việc của tôi, Cần xử lý, Báo cáo, Nhập / Xuất Excel, Diễn biến) gọi một ô bằng **đúng một tên** — tên cột bảng Phụ lục (mẫu nhập chuẩn `COT_MAU`);
ô không có trong bảng Phụ lục dùng đúng tên ở màn Giao việc. Thêm màn hình hay ô mới: lấy tên ở bảng dưới, không đặt tên khác.

| Ô (dữ liệu) | Tên dùng thống nhất |
|---|---|
| người, phòng chịu trách nhiệm (Owner) | **Chủ trì theo dõi** (cột E) — phòng của chủ trì: **Đơn vị chủ trì theo dõi**; Diễn biến: "Chủ trì theo dõi (cán bộ)", "Chủ trì theo dõi (phòng, đơn vị)" |
| ngành | **Ngành/lĩnh vực** (cột F) |
| lĩnh vực (danh mục) | **không có ô** (v3.29 — bảng Phụ lục không có cột "Lĩnh vực"): hệ thống tự xác định trong ngành theo phạm vi kiêm nhiệm, gợi ý AI / Excel, Lĩnh vực chi tiết, nội dung (`lib/kl/nhap/mac-dinh.js` `linhVucMacDinh`); chỉ còn ở Quản trị (Kiêm nhiệm lĩnh vực, Danh mục lĩnh vực) |
| cơ quan trình | **Cơ quan/đơn vị trình** (cột G) |
| nội dung | **Nội dung kết luận / Văn bản trình** (cột I) |
| hạn | **Hạn xử lý** (cột K) |
| mã | **Mã nhiệm vụ** (cột O) |
| số văn bản | **Số TB/KL** (cột C) |
| Lĩnh vực chi tiết, Loại thời hạn, Tiến độ, Văn bản triển khai, Số hội nghị, Ngày ban hành | như tên cột (H, J, L, N, B, D) |
| kết quả (Nhập Excel, Bổ sung dữ liệu) | **Kết quả thực hiện / Minh chứng** (cột M) |
| người theo dõi · sản phẩm · nguồn · phối hợp · cấp nhận | **Người theo dõi** · **Sản phẩm đầu ra** · **Nguồn nhiệm vụ** · **Đơn vị phối hợp** · **Cấp nhận sản phẩm** (tên ở Giao việc) |

Không dùng "Chủ trì", "Theo dõi", "Chịu trách nhiệm", "Hạn hoàn thành", "Cơ quan trình" hay chữ "Owner" làm tên ô (thông báo lỗi do cơ sở dữ liệu
trả về còn chữ "Owner" — sửa bằng migration ở đợt sau). Giữ nguyên vì nghĩa khác cột Excel: "Trạng thái" (tính theo hạn — khác cột "Tiến độ");
"Số hiệu" của văn bản ở Giao việc (mọi loại văn bản); cột "Nhiệm vụ" của bảng (mã + nội dung); các ô riêng của minh chứng (số hiệu, ngày, trích yếu,
mô tả kết quả); màn và tệp rà soát phân loại (tệp đọc lại theo tiêu đề cũ — v3.29: cột ngành ghi "Ngành/lĩnh vực", bỏ cột "Lĩnh vực", tệp cũ có cột
"Ngành", "Lĩnh vực" vẫn đọc được); chữ "Theo dõi" ở nhóm menu và hộp "Theo dõi giải ngân".

## 13. Mức cảnh báo ghi bằng nghĩa (v3.29 — chủ dự án quyết 22/10/2026)

"Ghi đúng quy tắc" ở **mọi màn hình**, giữ nguyên màu (mục 2, 10). Một chỗ đặt tên: `lib/kl/nhan.js` `tenMuc` — số ngày đọc theo `kl_cau_hinh`
(`nguong_vang_ngay`, `nguong_do_dac_biet_ngay`, `do_khan_KHAN_vang`; mặc định 3 · 3 · 5, cùng số hàm trạng thái của cơ sở dữ liệu dùng).

| Mức (Công văn 1400) | Ghi đầy đủ (giữa câu, tiêu đề) | Ghi gọn (chip, ô hẹp) |
|---|---|---|
| Vàng | sắp đến hạn (còn ≤ 3 ngày) | Sắp đến hạn |
| Đỏ | quá hạn dưới 3 ngày | Quá hạn < 3 ngày |
| Đỏ đặc biệt | quá hạn từ 3 ngày trở lên | Quá hạn ≥ 3 ngày |

- Tên Vàng / Đỏ / Đỏ đặc biệt chỉ còn ở **chú giải màu** và câu "Cách tính", luôn sau nghĩa: "Quá hạn dưới 3 ngày (mức Đỏ)".
- Con số luôn kèm danh từ: "8 nhiệm vụ sắp đến hạn (còn ≤ 3 ngày), 0 nhiệm vụ quá hạn dưới 3 ngày, 5 nhiệm vụ quá hạn từ 3 ngày trở lên"; tỷ lệ ghi mẫu
  số ("21% số nhiệm vụ đang thực hiện"); các phần của một ô cộng đủ số của ô.
- Nơi gộp Đỏ + Đỏ đặc biệt (tải việc cán bộ, nhãn văn bản, Báo cáo) ghi "quá hạn".
- Nhóm xem "Sắp đến hạn" (còn ≤ 7 ngày — `nguong_sap_den_han_ngay`, CH-10b; khác mức Vàng) ghi kèm số ngày: "Sắp đến hạn (còn ≤ 7 ngày)" ở ô số Nhiệm vụ,
  Cần xử lý, Theo văn bản, Trưởng phòng; nhãn trạng thái trên dòng việc giữ "Sắp đến hạn" (ô Hạn đã ghi "còn n ngày").
- Nhãn trong bảng tĩnh (ô số, lựa chọn lọc, đoạn biểu đồ) lấy số ngày lúc vẽ (`nhanTheoNguong`); chú giải màu của bảng (`bang/khung.js`: Nhiệm vụ,
  Việc của tôi, Theo văn bản — khối `data-chu-giai`) vẽ lại mỗi lần vẽ bảng (`veChuGiai`), nên đổi ngưỡng ở Quản trị thì mọi nơi cùng một số.
- Báo cáo (mọi bảng, dải đầu, tệp Excel): Tổng số nhiệm vụ · Quá hạn · Sắp đến hạn (còn ≤ 3 ngày) · Đang thực hiện · Hoàn thành · Trước hạn; xếp mức như
  Tổng quan (`lib/kl/bao-cao.js`); không còn cột chất lượng (Không đạt … Đạt xuất sắc — vẫn ghi ở ngăn chi tiết, hàng việc, Cán bộ).

## 14. Đường dẫn chức năng (v3.29 — chủ dự án quyết 22/10/2026, CAU-HOI O-7)

Mỗi chức năng một đường dẫn sau địa chỉ gốc (`…/vptu-mvp-task/`), viết như tên mục menu bỏ dấu, nối bằng gạch ngang, viết hoa chữ đầu (và tên riêng:
Excel, Thường trực); gõ chữ thường, thừa gạch chéo cuối hay đuôi `.html` vẫn vào được, thanh địa chỉ tự sửa lại cho đúng. Bảng ở `frontend/src/lib/tuyen.js`.

| Chức năng | Đường dẫn |
|---|---|
| Tổng quan | `/Tong-quan` |
| Cần xử lý / Việc của tôi (chuyên viên) | `/Can-xu-ly`, `/Viec-cua-toi` |
| Giao việc và hai thẻ nhập liệu: Nhập từ Excel, Chờ hoàn thiện | `/Giao-viec`, `/Nhap-Excel`, `/Cho-hoan-thien` |
| Nhiệm vụ (mọi tên theo vai) / Việc tôi theo dõi | `/Nhiem-vu`, `/Viec-toi-theo-doi` |
| Theo văn bản / Cán bộ / Báo cáo | `/Theo-van-ban`, `/Can-bo`, `/Bao-cao` |
| Chỉ đạo đã gửi / Chỉ đạo Thường trực | `/Chi-dao-da-gui`, `/Chi-dao-Thuong-truc` |
| Rà soát phân loại | `/Ra-soat-phan-loai` |
| Quản trị và từng thẻ | `/Quan-tri`, `/Quan-tri/Tai-khoan`, `/Quan-tri/Phan-cong-phu-trach`, `/Quan-tri/Nguong-canh-bao`… |
| Cá nhân / Trợ giúp | `/Ca-nhan`, `/Tro-giup` |

- Đổi màn (menu, nút trong màn, thẻ Quản trị, thẻ Giao việc) → đường dẫn đổi theo, mỗi lần bấm một bước lịch sử; Quay lại / Tiến tới của trình duyệt
  mở đúng chức năng; tải lại trang giữ chức năng. Danh sách "Lọc chi tiết, in" của chuyên viên, Nhắn tin giữ đường dẫn của màn đang mở.
- Mở thẳng một đường dẫn: chưa đăng nhập thì đăng nhập tại chỗ rồi vào đúng chức năng; chức năng không thuộc menu của vai (hoặc đường dẫn lạ) → trang
  đầu của vai, thông báo "Đường dẫn không thuộc chức năng của tài khoản đồng chí — đã mở trang đầu." Dữ liệu vẫn chỉ theo đăng nhập và RLS.
- Đường dẫn chỉ gồm tên chức năng — không mã việc, không dữ liệu.

