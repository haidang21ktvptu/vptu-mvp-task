# DESIGN — Hệ thống thiết kế VPTU-TASK

Mục tiêu: giao diện **trang trọng như một văn bản của Đảng**, **mang dấu ấn Cao Bằng**, và **dùng được cả ngày** cho 49 cán bộ trên máy tính văn phòng lẫn điện thoại. Không phải giao diện "startup". Không màu mè. Một điểm nhấn duy nhất, còn lại kỷ luật.

Bản mẫu chạy được ở `mockup/index.html`. Claude Code làm theo file này; khi phân vân, chọn phương án **trầm và ít hơn**.

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
| DO | `#FBE9E7` | `#B42318` | Dải màu bên trái |
| DO_DAC_BIET | `#F6DCE0` | `#7A0C1E` | Dải bên trái + chữ đậm + biểu tượng ‼ |
| HOAN_THANH | `#E6F2EF` | `#2A7365` | Chữ mực nhạt, dải ngọc |

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
- [ ] So với `mockup/index.html`, cùng tinh thần
