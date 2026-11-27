# DESIGN — Hệ thống thiết kế VPTU-TASK

Mục tiêu: giao diện **trang trọng như một văn bản của Đảng**, **mang dấu ấn Cao Bằng**, và **dùng được cả ngày** cho 49 cán bộ trên máy tính văn phòng lẫn điện thoại. Không phải giao diện "startup". Không màu mè. Một điểm nhấn duy nhất, còn lại kỷ luật. Từ v3.36 (chủ dự án quyết 26/11/2026, CAU-HOI V-12) giao diện có chuyển động đầy đủ (mục 7) và diện mạo sáng, mềm hơn (quầng màu nền, thẻ hơi trong, bóng mềm — mục 2, 5); chuyển động để thấy cái gì vừa đổi, không thay nội dung và tắt được.

**Đây là bản hiện hành duy nhất** (viết lại ngày 26/11/2026, v3.36): gộp các mục cũ, giao diện v8, v9 và các đợt sau thành một bản, không còn thứ tự "bản sau thắng bản trước". Số mục giữ như trước để các chú thích `DESIGN mục N` trong mã và tài liệu khác vẫn đúng. Đổi giao diện thì sửa mục tương ứng ở đây trong cùng PR. Bản mẫu `docs/ui-ux/mockup-v9.html` (chốt 02/10/2026) chỉ minh hoạ bố cục và màu; khi khác tài liệu này thì tài liệu này đúng. `docs/ui-ux/mockup-v8/`, `DESIGN-V8.md`, `mockup-v7.html` và `mockup/index.html` giữ làm lịch sử. Khi phân vân, chọn phương án **trầm và ít hơn**.

---

## 1. Ý tưởng dẫn dắt

| Nguồn | Lấy gì | Không lấy gì |
|---|---|---|
| **Văn bản của Đảng** | Đỏ son dùng tiết chế (nút chính, vạch son đầu trang); tên cơ quan theo thể thức (TỈNH ỦY CAO BẰNG / VĂN PHÒNG / dấu sao) và dòng ngày "Cao Bằng, ngày … tháng … năm …" bằng chữ có chân; bố cục thẳng hàng, khoảng trắng rộng | Không đỏ tràn nền vùng nội dung; không gradient đỏ – vàng |
| **Non nước Cao Bằng** (thác Bản Giốc, núi đá vôi) | Ảnh thác Bản Giốc **chỉ ở trang đăng nhập**; ba lớp núi SVG mờ ở trang đăng nhập và trên dải điều hành của Tổng quan; xanh lục cho "hoàn thành" | Không ảnh chụp trong các màn làm việc (bỏ ảnh nền sau số liệu từ v3.36); không biểu tượng phong cảnh rải rác |
| **Màu thanh bên** | Menu trái và khối trái đầu trang cùng một màu đặc (lam đậm ở kiểu Thanh lịch, đỏ son ở kiểu Trang nghiêm), mục chọn có biểu tượng vàng sao | Không hoa văn lặp; dải hoa văn thổ cẩm của bản v7 không còn dùng |

**Điểm nhấn:** trang đăng nhập (mục 4) và, bên trong, **một** dải điều hành ở đầu Tổng quan (mục 10 — chủ dự án chọn 26/11/2026, CAU-HOI V-11). Các màn còn lại (bảng, biểu mẫu) giữ yên tĩnh để số liệu nổi lên; không thêm dải màu ở màn khác.

**Biểu tượng tỉnh Cao Bằng** (`frontend/public/brand/`, do Văn phòng cung cấp; bản nhỏ `bieu-trung.png`): không tự vẽ, **không đổi màu, không kéo méo tỷ lệ** (`object-fit: contain`). Dùng ở ba chỗ: trang đăng nhập (ô nền trắng 84×68px), khối trái thanh đầu trang (ô nền trắng 44px, bo 12px) và favicon (`favicon-32.png`, `apple-touch-icon-180.png` — xuất từ tệp gốc bằng script). Biểu tượng Đảng và Quốc huy: chỉ dùng khi Văn phòng cung cấp tệp chính thức; không tải từ nguồn không rõ.

---

## 2. Màu sắc

Token khai báo một nơi: `frontend/src/styles/tokens.css`; `tailwind.config.js` đọc lại cùng biến. **Không viết mã màu trong CSS thành phần** — thêm token ở đây và ở `tokens.css` trước.

**Hai kiểu giao diện và nền tối.** Mặc định là **Thanh lịch** (lam); `<html data-kieu="trang-nghiem">` là **Trang nghiêm** (đỏ son); `<html data-theme="dark">` là **nền tối**, đi được với cả hai kiểu. Người dùng chọn ở menu bánh răng (nhóm "Kiểu giao diện": hai mục chọn một và mục bật / tắt "Nền tối"); lựa chọn nhớ theo máy (`localStorage` `vptu.kieu`, `vptu.nen-toi`), gắn bằng đoạn script đầu `index.html` trước khi vẽ để không nháy màu (`views/shell/kieu-giao-dien.js`).

| Token | Thanh lịch | Trang nghiêm | Dùng cho |
|---|---|---|---|
| `--nut` / `--nut-dam` | `#C0262D` / `#A01F25` | `#A61E27` / `#86181F` | Nút chính (đỏ son), lúc rê chuột. **Một nút chính mỗi vùng** |
| `--ben-mau` → `--ben-cuoi` | `#15395F` → `#0E2A49` | `#A82029` → `#84181F` | Menu trái, khối trái thanh đầu trang (`--ben-nen` là dải chuyển hai màu này) |
| `--vach-tren` | `#C0262D` | `#C0262D` | Vạch son 3px trên cùng thanh đầu trang |
| `--hero-1` → `--hero-3` · `--hero-vong` · `--hero-vach` · `--hero-qua-han` | `#0F2F55` → `#2667AA` · `#E9C46A` · `#C0262D` · như `--f-do` | `#84161F` → `#AE262E` · `#E9C46A` · `#E9C46A` · sắc trầm `rgba(43,8,12,.6)` | Dải điều hành của Tổng quan (mục 10): nền chuyển sắc · vòng tỷ lệ · vạch chân dải · phần quá hạn của thanh nhỏ trên dải (đỏ không nổi trên dải đỏ son nên Trang nghiêm dùng sắc trầm). Chỉ dùng ở dải này |
| `--ben-chon-icon` · `--ben-dem` | `#E9C46A` · `#C8323A` | `#E9C46A` · `#E9C46A` | Biểu tượng mục đang chọn · nền số đếm trên menu |
| `--navy` | `#17365D` | `#5C1A20` | Tiêu đề, màu cấu trúc |
| `--navy-dac` · `--vang-tren-dac` | `#17365D` · `#E0A526` | `#7E1D24` · `#E0A526` | Nền khối đặc có chữ trắng (ô số, nút nhóm đang chọn) · số vàng trên nền đó |
| `--nen-phu` · `--nen-mo` | `#E9EEF5` · `#F4F7FB` | `#F3EEED` · `#FBF7F6` | Nền trang · nền nhạt (hàng tiêu đề bảng, khối phụ) |
| `--the` (= `--nen`) | `#FFFFFF` | `#FFFFFF` | Mặt thẻ, bảng, ô nhập, hộp thoại |
| `--chu` · `--chu-phu` · `--chu-mo` | `#14243B` · `#4F607A` · `#5A6A81` | `#2B1B1D` · `#6A5557` · `#7A6568` | Chữ chính · chữ phụ, nhãn · chữ mờ |
| `--vien` · `--vien-nhat` · `--vien-o` | `#D8E1EC` · `#E6ECF3` · `#C1CDDB` | `#E8DEDC` · `#F0E8E6` · `#D7C9C6` | Đường kẻ, viền thẻ · kẻ trong bảng · viền ô nhập |
| `--vien-focus` | `#2A78D6` | `#2A78D6` | Viền tiêu điểm bàn phím |
| `--quang-1` · `--quang-2` · `--quang-3` | lam `rgba(42,120,214,.2)` · tím lam `rgba(124,116,232,.14)` · vàng `rgba(233,196,106,.12)` | son `rgba(192,38,45,.1)` · vàng `rgba(233,196,106,.24)` · son `rgba(192,38,45,.06)` | Ba quầng màu nhạt đứng yên sau nội dung (`base.css`, v3.36); chỉ là nền, không dùng cho thành phần, không mang nghĩa trạng thái |
| `--the-kinh` · `--vien-kinh` | `rgba(255,255,255,.82)` · `rgba(255,255,255,.95)` | như Thanh lịch | Mặt thẻ hơi trong và viền sáng của thẻ Tổng quan (quầng màu ánh qua); chỗ cần nền đặc (ô dính, ô nhập, hộp thoại) vẫn dùng `--the` |
| `--bong-the` · `--bong-nhac` | bóng mềm lan rộng · bóng đậm hơn | như Thanh lịch, sắc ấm | Bóng của thẻ · bóng của thẻ số lúc nhấc lên khi rê chuột (mục 7) |

**Màu trạng thái và mức cảnh báo — cùng nghĩa ở mọi kiểu** (cách ghi bằng chữ: mục 13):

| Mức / trạng thái | Màu chính | Nền nhạt | Chữ trên nền nhạt |
|---|---|---|---|
| Đang thực hiện, trong hạn | `--lam` `#2563B8` | `--lam-nhat` `#E3EEFB` | `--lam` |
| Vàng — sắp đến hạn | `--vang` `#E0A526` | `--vang-nhat` `#FFF1D6`; khối `--nen-vang-mo` | `--vang-chu` `#8A5300` |
| Đỏ — quá hạn dưới 3 ngày | `--do` `#C92A1E` | `--do-nhat` `#FDECEA`; khối `--nen-do-mo` | `--do-chu` `#8E1520` |
| Đỏ đặc biệt — quá hạn từ 3 ngày | **tím đậm** `--ddb` `#6B21A8` | `--ddb-nhat` `#F3E8FF`; nền dòng `--nen-ddb` | `--ddb`, nhãn có ‼ |
| Hoàn thành | `--luc` `#18794E` | `--luc-nhat` `#E2F3EA` | `--luc` |
| Hỏa tốc, chỉ đạo của Thường trực | `--do-dam` `#8E1520` | — | — |

Đỏ và Đỏ đặc biệt phải phân biệt được bằng mắt ngay (v3.23.2); `--do` không dùng cho nút. Bộ `--cam` (cam) giữ cho nghiệm thu, hiện chưa màn nào dùng.

**Biểu đồ** dùng bộ `--f-*` (`--f-tot` đúng hạn, `--f-tre` trễ, `--f-nt` nghiệm thu, `--f-vang`, `--f-do`, `--f-ddb` kèm `--f-ddb-chu` cho chữ trên nó) và `--du-lieu`, `--du-lieu-2` cho chuỗi số liệu; trạng thái luôn kèm nhãn chữ.

**Nền tối** chỉ áp trên màn hình (bản in, PDF luôn dùng token sáng): Thanh lịch xanh đêm (nền trang `#0E1B2D`, thẻ `#152740`), Trang nghiêm đêm ấm (`#1A1315` / `#261C1F`); không dùng đen. Màu trạng thái sáng lên một bậc (Đỏ `#F97A70`, Đỏ đặc biệt `#C4A1F5`); khối đặc màu sáng dùng chữ tối. Quầng màu và mặt thẻ hơi trong có giá trị riêng cho nền tối (`tokens.css`).

**Tương phản và tương thích:** chữ / nền đạt 4.5:1 ở cả bốn chế độ (hai kiểu × sáng / tối); viền tiêu điểm trên nền đặc của menu màu trắng. Không dùng `color-mix()` hay tính năng CSS cần trình duyệt mới hơn Chrome 109 (máy Windows 7 / 8.1 của cơ quan).

Quy tắc: **màu là thông tin, không phải trang trí.**

---

## 3. Chữ

Ba họ chữ, đều có bộ dấu tiếng Việt đầy đủ, **tự host** tại `frontend/public/fonts/` (woff2 biến thiên 400–700, subset Vietnamese + Latin, khai báo ở `src/styles/fonts.css`) vì mạng cơ quan có thể chặn Google Fonts:

| Họ chữ | Vai trò |
|---|---|
| **Lexend** (`--font-tieu-de`) | Tiêu đề trang, tiêu đề khối, con số lớn, giờ và số trong bảng |
| **Source Sans 3** (`--font-sans`) | Thân chữ, bảng, nút, ô nhập |
| **Noto Serif** (`--font-van-ban`) | Tên cơ quan ở đầu trang, dòng ngày theo thể thức (in nghiêng), nội dung ý kiến chỉ đạo |

**Thang cỡ: tám bậc, đơn vị rem** (biến ở `tokens.css`; **mọi** `font-size` trong CSS dùng biến, không viết số px; bản in `in.css` giữ cỡ riêng):

| Biến | Cỡ | Dùng cho |
|---|---|---|
| `--chu-nho` | 13 | Nhãn phụ, chú thích, chip — **nhỏ nhất, không có chữ dưới 13px** |
| `--chu-bang` | 14 | Bảng, nút gọn, ô lọc |
| `--chu-than` | 15 | Thân chữ |
| `--chu-o` | 16 | Ô nhập, nút chính (điện thoại không tự phóng to khi gõ) |
| `--chu-muc` | 17 | Tiêu đề mục, khối |
| `--chu-khoi` | 20 | Tên cơ quan, tiêu đề hộp, số trung bình |
| `--chu-trang` | 24 | Tiêu đề trang, số trong thẻ |
| `--chu-so` | 32 | Con số lớn ở thẻ Tổng quan |

**Cỡ chữ lớn:** mục "Cỡ chữ lớn" ở menu bánh răng đặt `<html data-co-chu="lon">`, gốc 18px, cả thang lớn theo (13 thành 14,6; 15 thành 16,9). Máy chưa chọn thì lãnh đạo (Thường trực, lãnh đạo Văn phòng) mặc định cỡ lớn, người khác cỡ vừa; chọn rồi thì nhớ theo máy. Bản in luôn cỡ vừa.

Nhãn viết hoa chữ đầu, **không viết hoa toàn bộ** (trừ tên cơ quan theo thể thức ở đầu trang, trang đăng nhập và bản in). Trong câu chữ không in nghiêng để nhấn một từ. Riêng **tiêu đề trang có cụm nhấn** (v3.36, CAU-HOI V-12): hai từ đầu chữ Lexend, phần còn lại chữ Noto Serif nghiêng (`.nhan-td`, `lib/chuyen-dong.js` `tieuDeHtml`) — hiện dùng cho tiêu đề Tổng quan, màu `--hero-vong` trên dải. Không dùng chữ đơn cách (monospace) cho số liệu; số dùng `tabular-nums`. Tailwind đọc cùng biến cỡ chữ (`text-xs` = 13px).

---

## 4. Bố cục

**Khung ứng dụng (sau đăng nhập, màn rộng):**
```
┌───────────────────────────────────────────────────────────────────┐
│▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ vạch son 3px ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│
│ [biểu trưng] TỈNH ỦY CAO BẰNG │ Cao Bằng, ngày …   [Tìm] (chuông) Tên ⚙ │
│              VĂN PHÒNG  *     │                                      │
├───────────────────────────────┼──────────────────────────────────────┤
│ MENU 236px (màu thanh bên)    │ Tiêu đề trang  phụ đề    [nút chính] │
│ Điều hành ▾                   │                                      │
│   Tổng quan                   │ Thẻ trắng bo 16px, viền mảnh         │
│   Cần xử lý  (20)             │ Bảng: kẻ ngang mảnh, mép trái 4px    │
│ Nhiệm vụ ▾                    │ theo mức cảnh báo                    │
│ Nhiệm vụ quý BTV ▸            │                                      │
│ Quản trị ▾                    │                                      │
└───────────────────────────────┴──────────────────────────────────────┘
```
- **Thanh đầu trang** cao 72px (điện thoại 56px): khối trái rộng bằng menu, cùng màu menu, mang biểu trưng và tên cơ quan theo thể thức; cạnh đó dòng ngày (chữ có chân, nghiêng); bên phải ô tìm nhanh, chuông (mục 10), tên người dùng, menu bánh răng (kiểu giao diện, nền tối, cỡ chữ, Cá nhân, Đổi mật khẩu, Trợ giúp, Quản trị, Đăng xuất).
- **Menu trái** 236px, nền đặc `--ben-nen`, chữ trắng; bốn nhóm thu gọn được (mục 10); mục đang chọn nền sáng hơn, biểu tượng vàng sao; số đếm nền `--ben-dem`.
- **Vùng nội dung** lề 26px trên, 32px hai bên, 64px dưới; giãn hết bề rộng còn lại (bảng, ma trận cần chỗ); khối chữ đọc dài giới hạn 78ch.
- **Trang đăng nhập** (điểm nhấn duy nhất): ảnh thác Bản Giốc toàn nền (`public/brand/ban-gioc.jpg`) + hai lớp phủ + ba lớp núi SVG + vệt vàng; trên ảnh chỉ có biểu trưng, dòng cơ quan chữ nhỏ và tên hệ thống; thẻ đăng nhập 440px nổi bên phải (cách mép 120px, ≤ 1200px cách 48px); chân trang ghi đầu mối hỗ trợ. Không số liệu hay nội dung nội bộ trên ảnh. Điện thoại: ảnh thành dải 220px trên cùng, thẻ rộng hết chiều ngang.

**Bốn mốc bề rộng (v3.36).** Mọi thay đổi bố cục theo bề rộng cửa sổ chỉ xảy ra ở bốn mốc 600 / 900 / 1200 / 1600px:

| Bề rộng cửa sổ | Thiết bị điển hình | Khung | Nội dung |
|---|---|---|---|
| ≤ 600px | Điện thoại | Thanh đầu 56px cả dải màu menu, nút ☰ mở ngăn menu ngay dưới thanh; thanh dưới các mục chính theo vai; ô tìm nổi dưới thanh | Một cột; bảng thành thẻ, nội dung 3 dòng; nút thao tác rộng hết thẻ, cao ≥ 44px; đăng nhập xếp dọc |
| 601–900px | Máy tính bảng dọc, cửa sổ hẹp | Menu thành thanh biểu tượng 56px (tên ở `title`, không tên nhóm, mọi nhóm mở); khối trái đầu trang 56px, ẩn dòng ngày và tên người dùng; lề nội dung 16px | Lưới hai, ba cột của biểu mẫu xếp một cột; ngăn chi tiết màn Nhiệm vụ xếp dưới danh sách; ô số hai ô một hàng; bảng nhập tệp thành khối |
| 901–1200px | Máy tính bảng ngang, laptop đặt thu phóng 125–150% | Menu đủ 236px | Bảng nhiệm vụ thành thẻ, mỗi ô có nhãn; bộ 8 ô số xếp 4 + 4; ngăn chi tiết cạnh bảng rộng 420px; Quản trị tài khoản một cột |
| 1201–1600px | Laptop 1280–1536px | Menu đủ | Bảng nhiệm vụ gộp cột thời gian vào dòng phụ dưới nội dung; ngăn chi tiết mở thì dòng thành thẻ |
| > 1600px | Màn 1920px | Menu đủ | Bảng nhiệm vụ đủ cột, ngăn chi tiết 520px đứng cạnh |

- CSS chỉ viết `@media (max-width: 600px | 900px | 1200px | 1600px)` và chiều ngược lại `(min-width: 601px | 901px | 1201px | 1601px)`; JS (`matchMedia`) và `screens` của Tailwind dùng đúng các mốc này. Không thêm mốc khác; cần mốc mới thì sửa mục này trước.
- Thành phần co theo chỗ của **chính nó** (không theo cửa sổ) dùng `@container` với ngưỡng theo bề rộng thành phần — không phải mốc màn hình: vùng Tổng quan `tq` (640 / 860 / 900 / 1100px), thẻ việc Cần xử lý `the-hang` (580px), thẻ Giao việc `gv-the` (560px), khung văn bản Giao việc `gv-doc` (520 / 980px).
- Bản in không theo mốc: `@media print` ở `in.css` và cuối tệp của từng thành phần.

---

## 5. Thành phần

| Thành phần | Quy định |
|---|---|
| Nút (`.nut`) | Cao ≥ 32px, chữ 13 đậm vừa, viền `--vien-o`, bo `--bo-nut` 8px. `.nut.chinh` nền `--nut` chữ trắng — một nút chính mỗi vùng; `.nut.lam` nền `--lam` cho thao tác cần làm ngay trên dòng; `.nut.nho` cao 28px. Điện thoại: nút thao tác cao ≥ 44px |
| Ô nhập (`.o-nhap`) | Cao ≥ 42px (ô gọn `.o-nhap.nho` 40px, chữ 14), viền 1px `--vien-o`, bo 8px; nhãn đặt trên ô, không dùng chữ mờ thay nhãn; tiêu điểm viền `--vien-focus` |
| Thẻ, khối | Nền `--the`, viền mảnh, bo `--bo-the` 16px, bóng mềm `--bong-the`. Không bo tròn lớn hơn. Thẻ của Tổng quan dùng mặt hơi trong `--the-kinh`, viền `--vien-kinh` (v3.36); thẻ số nhấc 4px khi rê chuột |
| Nhóm nút chọn một (`.pham-vi`) | Viên thuốc viền mảnh; nút đang chọn nền `--navy-dac` chữ trắng (kỳ Tháng · Quý · Năm · Nhiệm kỳ, phạm vi, sắp xếp) |
| Huy hiệu số | Viên 18px, nền `--ben-dem`, chữ 13; chuông chỉ đếm tin cần đồng chí xử lý (mục 10) |
| Nhãn trạng thái | Viên nền nhạt + chữ đậm cùng sắc (mục 2); mức cảnh báo ghi bằng nghĩa (mục 13) |
| Hộp thoại (`.modal`) | Rộng 480px (`.modal-rong` 640px), bo 16px, bóng `--bong-noi`; hộp bắt buộc (tiếp nhận việc) có viền trên 4px đỏ, không nút đóng ở góc. Hộp sửa có lý do: mục 15 |
| Thông báo nhanh (`components/toast.js`) | Góc dưới phải, nền `--nen-toi` chữ trắng, vạch trái 4px vàng, tự đóng sau 4 giây. Không dùng `alert()` |
| Trạng thái trống (`.trong`) | Một câu hướng dẫn (và nút hành động nếu có), khung viền đứt; không hình minh hoạ |
| Biểu đồ | HTML / SVG thuần, không thư viện; chữ dùng màu chữ, không màu dữ liệu; điểm, cột bấm được thì nhận tiêu điểm bàn phím và có gợi ý; nét không co giãn (`vector-effect`) |

**Tổ chức CSS (v3.36, gộp theo thành phần).** `frontend/src/styles/main.css` nạp phông, token, nền tảng, khung, rồi các tệp thành phần và màn hình theo thứ tự ghi trong tệp (giữ đúng thứ tự ghi đè trước khi gộp — không đảo khi chưa kiểm), cuối cùng `ghi-de.css` và `in.css`. Mỗi quy tắc nằm ở tệp của thành phần hoặc màn hình nó thuộc về; **không tạo tệp theo đợt hay theo phiên bản** (kiểu `v9.css`, `pr3.css`, `gd22.css` đã gộp hết). Lớp dùng trong JS viết nguyên văn (Tailwind cắt lớp ghép chuỗi).

| Tệp | Nội dung |
|---|---|
| `fonts.css`, `tokens.css`, `base.css` | Phông tự host; token (mục 2, 3); nền tảng (chữ gốc, quầng màu nền, tiêu điểm, giảm chuyển động) |
| `khung.css`, `dang-nhap.css` | Thanh đầu trang, menu, thanh dưới, ngăn menu điện thoại; trang đăng nhập, đổi mật khẩu |
| `chuyen-dong.css` | Chuyển động dùng chung (mục 7): biến thời lượng và đường cong `--cd-*`, khung hình, vào trang, chuyển trang, số lăn, tiêu đề từng chữ, đường xu hướng nhỏ, dấu chọn menu, hiện ra khi mở, màn chờ và mở đầu. Kịch bản riêng của một màn nằm ở tệp của màn đó |
| `chuyen-dong-man.css` | Chuyển động theo màn (mục 7): dòng và thẻ hiện lần lượt của các danh sách, ba câu hỏi Cần xử lý, thanh tải việc của Cán bộ, khối và dòng của Nhiệm vụ quý, ngăn chi tiết |
| `thanh-phan.css`, `bang.css`, `the-viec.css`, `chi-tiet.css` | Nút, ô nhập, nhãn, huy hiệu, hộp thoại, thông báo; bảng và hàng tab; tấm, thẻ / hàng việc; ngăn chi tiết dùng chung |
| `tong-quan.css`, `tong-quan-tang.css`, `tong-quan-khoi.css`, `giai-ngan.css`, `muc-tieu.css` | Tổng quan và các khối của nó; giải ngân vốn; mục tiêu then chốt |
| `can-xu-ly.css`, `nhiem-vu.css`, `bang-nhiem-vu.css`, `theo-van-ban.css`, `can-bo-bao-cao.css` | Các màn điều hành và danh sách nhiệm vụ |
| `giao-viec.css`, `giao-viec-ai.css`, `nhap-excel.css` | Giao việc, đề xuất của trợ lý AI, nhập từ Excel |
| `nhan-tin.css`, `ca-nhan.css`, `quan-tri.css`, `nvq.css` | Nhắn tin; Cá nhân, Trợ giúp; Quản trị; Nhiệm vụ quý BTV |
| `ghi-de.css` | Ít quy tắc của nhiều thành phần buộc phải đứng sau các tệp màn hình (ghi rõ lý do từng quy tắc). Thêm vào đây chỉ khi không đặt được ở tệp thành phần |
| `in.css` | Bản in chung, màn Nhiệm vụ, In báo cáo nhanh Tổng quan (A4 dọc) |

---

## 6. Hoa văn và hình ảnh

- Không hoa văn trang trí trong ứng dụng. Dải hoa văn thổ cẩm của bản v7 **đã bỏ** (thay bằng vạch son 3px và màu thanh bên).
- Ảnh chụp chỉ ở trang đăng nhập; dải điều hành của Tổng quan chỉ dùng màu và ba lớp núi SVG mờ, không ảnh. Ảnh thác Bản Giốc hiện là **ảnh tạm, chưa xác định bản quyền** — phải thay bằng ảnh cơ quan tự chụp hoặc ảnh có giấy phép trước khi dùng chính thức (`public/brand/README.md`). Không ảnh trong các màn làm việc, kể cả sau con số.
- Biểu tượng chức năng (menu, nút) là SVG nét cùng một kiểu, màu theo chữ; không dùng biểu tượng cảm xúc.
- Nền trang có ba quầng màu nhạt đứng yên (`--quang-*`, mục 2) phía sau nội dung, liền qua thanh đầu trang (nền thanh trong suốt); không chuyển động, không in.

---

## 7. Chuyển động

Chủ dự án quyết ngày 26/11/2026 (CAU-HOI V-12, theo video mẫu): giao diện có **đủ tám nhóm chuyển động**, làm bằng CSS và JavaScript thuần (`styles/chuyen-dong.css`, `chuyen-dong-man.css`, `lib/chuyen-dong.js`, `views/shell/chuyen-trang.js`, `mo-dau.js`, `dau-chon.js`), không thêm thư viện. Chuyển động để người xem thấy cái gì vừa đổi; không được làm chậm thao tác hay làm sai số liệu.

| Nhóm | Ở đâu | Cách chạy |
|---|---|---|
| 1. Mở đầu hình tròn | Vào ứng dụng (vừa đăng nhập, tải lại trang khi máy còn phiên) | Màn chờ màu menu có biểu trưng và tên cơ quan đúng vị trí thanh đầu trang; khung ứng dụng mở ra theo hình tròn từ biểu trưng trong 0,8 giây. Tải lại trang không còn chớp màn đăng nhập |
| 2. Khối, dòng hiện lần lượt | Mọi mục, lúc vừa vào | Các khối cấp một trượt nhẹ từ dưới lên, cách nhau 0,06 giây. Tổng quan có thứ tự riêng: dải, chữ tiêu đề, vòng và ba số, bốn thẻ, câu kết luận, hai khối biểu đồ, dòng nhiệm vụ quý, phần còn lại. Danh sách (bảng Nhiệm vụ, Việc của tôi, thẻ Cần xử lý, việc của phòng, cán bộ, danh sách trong ngăn chi tiết, khối và dòng của Nhiệm vụ quý): 12 phần tử đầu hiện lần lượt, cách nhau 0,03 giây; phần còn lại hiện ngay. Màn đăng nhập: biểu trưng, thẻ đăng nhập, ba lớp núi, dòng chân hiện dần |
| 3. Tiêu đề hiện từng chữ | Tiêu đề Tổng quan | Mỗi chữ cái cách nhau 0,022 giây; cụm nhấn in nghiêng (mục 3) |
| 4. Số lăn | Số của dải và bốn thẻ Tổng quan; dải số của Nhiệm vụ; hai con số của ba câu hỏi Cần xử lý; dải tổng quan của Báo cáo; ô số của Nhiệm vụ quý | Từng chữ số lăn từ 0 tới giá trị thật trong 0,9 giây, lệch pha theo cột. Lăn xong, ngay trong hiệu ứng, chữ số thật hiện lại (chỗ đổi lệch không quá 1px); từ đó đến lúc gỡ lớp không còn gì xê dịch. Lúc nghỉ, các ô chữ số là phần tử nội dòng nên trình đọc màn hình đọc liền thành một số. Dải số bị giữ trong ô, không làm trang cao thêm |
| 5. Biểu đồ tự vẽ | Vòng tỷ lệ, thanh các phần, thanh theo đơn vị, cột theo tuần, đường xu hướng nhỏ; thanh tiến độ và thanh chỉ tiêu của Nhiệm vụ quý; thanh tải việc của Cán bộ | Vòng quét từ 0, thanh dài ra từ trái, cột mọc từ đáy, đường vẽ từ trái sang phải |
| 6. Chuyển trang | Đổi mục trên menu | Mục cũ nhòe rồi mờ hẳn tại chỗ trong 0,2 giây; thanh đầu trang và menu đứng yên; mục mới hiện lần lượt |
| 7. Dấu chọn menu trượt | Menu dọc | Nền của mục đang chọn trượt sang mục mới trong 0,36 giây |
| 8. Hiện ra, rê chuột, bấm | Menu bánh răng, bảng chuông, ngăn chi tiết, hộp thoại, thông báo nhanh; thẻ số; nút | Hiện dần khi mở (0,18 đến 0,28 giây); thẻ số nhấc 4px khi rê chuột; nút lún nhẹ khi bấm; khung chờ giữ đúng chỗ của nội dung sắp về |

Quy tắc:
- **Trạng thái gốc là trạng thái đã hiện xong.** Hiệu ứng chỉ khai báo khung hình đầu và chỉ chạy khi vùng mang lớp `dang-vao` (vào trang) hoặc `dang-doi` (đổi kỳ, đổi bộ lọc) do `lib/chuyen-dong.js` gắn rồi gỡ. Mã lỗi hoặc tắt hiệu ứng thì nội dung vẫn hiện đủ. Chữ và số trong DOM luôn là nguyên văn; số lăn và chữ tách chỉ là phần trình bày.
- **Chạy khi người dùng vào trang hoặc thao tác, không chạy khi số liệu tự cập nhật.** Nạp lại nền và realtime vẽ ngay; lần nạp lại đến giữa lúc hiệu ứng đang chạy thì chờ hiệu ứng xong (`veSauNap`). Bấm tiếp trong lúc hiệu ứng còn chạy thì nội dung mới hiện ngay. Vào lại một mục đã xem trong lần mở ứng dụng: nội dung của lượt trước hiện ngay với nhịp nhanh hơn (hệ số 0,55), số liệu mới về thì thay sau.
- **Mỗi nội dung chỉ chạy hiệu ứng một lần, không chớp.** Trong lúc hiệu ứng vào trang đang chạy, nội dung vẽ lại thay cho nội dung thật đã hiện thì đứng yên ở trạng thái cuối (lớp `cd-tinh`, `lib/chuyen-dong.js` tự gắn rồi gỡ). Được chạy hiệu ứng: nội dung đang có lúc mở mục, và nội dung lần đầu đổ vào chỗ còn trống hoặc đang là dòng chờ; loại sau chạy ngay khi số liệu về, không chờ mốc trễ gốc (lớp `cd-sau`). Dòng chờ ("đang tải", "không có…") mang một trong các lớp `trong`, `trong-nho`, `bnv-trong`, `nq-dang-tai`, `xuong` hoặc thuộc tính `data-cd-cho`. Số không đổi thì không vẽ lại (`datSo`). Hết thời lượng mà hiệu ứng còn chạy (máy chậm) thì chờ thêm, tối đa 1,8 giây, không cắt ngang; hiệu ứng chưa kịp bắt đầu vì trang không được vẽ (cửa sổ bị che hoặc thu nhỏ) thì không chờ, nội dung hiện ngay.
- **Không đổi bố cục.** Hiệu ứng vào trang và chuyển trang chỉ đổi `transform`, `opacity`, `filter`, `clip-path`, `stroke-dashoffset`. Chuyển tiếp nhỏ khác (bóng của thẻ số và của biểu trưng màn chờ, màu nền nút, kích thước dấu chọn menu — phần tử đặt tuyệt đối) không làm xê dịch phần tử nào khác. Máy yếu (từ 2 luồng xử lý hoặc 2 GB bộ nhớ trở xuống) bỏ phần nhòe và hình tròn mở đầu (chỉ hiện dần). Không dùng tính năng mới hơn Chrome 109.
- **Tắt được.** Menu bánh răng có mục "Hiệu ứng chuyển động" (nhớ theo máy, `vptu.chuyen-dong`); bỏ chọn thì tắt mọi hiệu ứng và chuyển tiếp (`<html data-chuyen-dong="giam">`). Máy đặt giảm chuyển động (`prefers-reduced-motion`) cũng tắt toàn bộ. Bản in không có hiệu ứng. Bộ kiểm thử e2e chạy ở chế độ giảm chuyển động; `chuyen-dong.spec.js` bật lại để kiểm trạng thái cuối.
- **Thời lượng và đường cong** lấy từ biến `--cd-*` (`chuyen-dong.css`). Tệp của màn chỉ ghi mốc trễ của kịch bản riêng.
- **Thêm hiệu ứng cho màn mới:** dùng lớp có sẵn (`so-lan`, `tach-chu`, `thanh-nho`, `duong-nho`) hoặc viết quy tắc `.dang-vao …` ở `chuyen-dong-man.css` hay tệp của màn đó; số lấy từ `soLanHtml` / `datSo`; màn nạp lại số liệu khi mở thì vẽ lại qua `veSauNap`. Màn tự mở hiệu ứng khi số liệu về (Nhiệm vụ quý) đánh dấu mục bằng `data-cd-tu` và mở sau khi đã vẽ nội dung mới. Phần tử căn chỗ bằng `transform` thì hiệu ứng dùng thuộc tính `translate` riêng (thẻ đăng nhập). Không dùng JavaScript gắn lớp làm ẩn nội dung rồi chờ gỡ.

---

## 8. Giọng văn trong giao diện

- Trang trọng, ngắn, chủ động. "Giao việc", "Xác nhận đã nhận việc", "Nộp minh chứng", "Nghiệm thu".
- Xưng hô: "đồng chí" trong thông báo gửi tới người dùng ("Đồng chí có 2 việc chờ xác nhận").
- Lỗi nói rõ việc gì và làm gì tiếp: "Hạn xử lý phải sau hôm nay. Chọn lại ngày."
- Con số luôn kèm danh từ ("8 nhiệm vụ quá hạn"); tên ô theo bảng Phụ lục (mục 12).
- Ít chữ: mỗi con số một nhãn ngắn, phần giải thích mở khi cần (mục 17).
- Không dấu chấm than, không biểu tượng cảm xúc, không tiếng Anh.

---

## 9. Kiểm tra trước khi nộp giao diện

- [ ] Chỉ dùng token (mục 2, 3): không mã màu, không cỡ chữ px trong CSS thành phần; không chữ dưới 13px
- [ ] Một nút chính mỗi vùng; đỏ chỉ ở nút chính và trạng thái
- [ ] Tương phản chữ ≥ 4.5:1 ở cả hai kiểu, sáng và tối (kiểm bằng Lighthouse)
- [ ] Dùng được bằng bàn phím, tiêu điểm nhìn thấy
- [ ] Chỉ dùng bốn mốc bề rộng (mục 4); xem ở 390, 768, 1280, 1366 và 1920px, cỡ chữ vừa và lớn; 360px không cuộn ngang
- [ ] Không chữ hoa toàn bộ ở nhãn, không tiếng Anh; tên ô đúng mục 12, mức cảnh báo ghi đúng mục 13
- [ ] Quy tắc mới đặt đúng tệp thành phần (mục 5); bản in (Ctrl+P) không vỡ
- [ ] Không tính năng CSS mới hơn Chrome 109
- [ ] Chuyển động (mục 7): tắt hiệu ứng thì nội dung vẫn đủ; số liệu tự cập nhật không chạy lại hiệu ứng; hiệu ứng không đổi bố cục; xem ở cả bốn chế độ màu
- [ ] Số trước, chi tiết bấm mới mở (mục 17): không dòng chữ phụ dưới con số, không câu "bấm để xem", không lặp một con số bằng chữ; bản in vẫn đủ chữ

---

## 10. Các màn hình chính

**Tổng quan** (trang mở đầu của Thường trực, lãnh đạo Văn phòng, Trưởng phòng; v3.36 — ba tầng, CAU-HOI V-1, V-9, V-11; SPEC DB-13). *Tầng 1 vừa một màn hình* (1366×768, cỡ chữ lớn), theo phương án "Dải điều hành" chủ dự án chọn 26/11/2026 (bản đầu của v3.36 — nền phẳng, năm thẻ chữ — không được chấp nhận):
- **Dải điều hành** `.tq-dai`: nền đặc chuyển sắc theo kiểu giao diện (`--hero-1` → `--hero-3`: lam đậm ở Thanh lịch, đỏ son ở Trang nghiêm, sẫm hơn ở nền tối), chữ trắng, ba lớp núi SVG mờ ở góc phải, vạch son – vàng 4px ở chân; không ảnh. Hàng 1: tên trang (hiện từng chữ; cụm sau hai từ đầu in nghiêng màu `--hero-vong` — mục 3), nút In báo cáo nhanh (nền trong, viền trắng), nút Giao việc (nút chính; ở Trang nghiêm là nút sáng chữ màu dải để không chìm vào nền đỏ). Hàng 2: phạm vi và giờ cập nhật (giờ cập nhật chữ có chân, nghiêng), nhóm nút kỳ `.pham-vi` Tháng · Quý · Năm · Nhiệm kỳ (nút đang chọn nền trắng). Hàng 3: vòng **tỷ lệ hoàn thành đúng hạn** (`--hero-vong`; chỉ vẽ khi đủ dữ liệu, kèm mẫu số) và ba số tổng cách nhau bằng đường kẻ dọc: nhiệm vụ của kỳ (hoàn thành trong kỳ + đang thực hiện), đã hoàn thành, đang thực hiện. Cạnh số nhiệm vụ của kỳ và số đã hoàn thành có **đường xu hướng nhỏ 12 tuần** (giao mới, hoàn thành — cùng số liệu với biểu đồ tuần bên dưới; rê chuột có gợi ý; không vẽ khi cả 12 tuần đều 0); dưới số đang thực hiện có thanh trong hạn – quá hạn. Màu phủ, đường kẻ, chữ phụ trên dải dùng token nền đặc `--ben-*`. Khung chờ có sẵn nút, nhóm kỳ, vòng và ba ô số giữ chỗ: ở màn từ 1280px dải không đổi chiều cao khi số liệu về; màn hẹp hơn dải cao thêm ít (chữ của các ô số xuống dòng).
- **Bốn thẻ việc cần quan tâm** `.the-so` cùng cỡ, mặt hơi trong (`--the-kinh`), nhấc nhẹ khi rê chuột: số lớn (Lexend, `--chu-so`) và ô biểu tượng ở góc phải, tên thẻ, thanh nhỏ các phần, dòng so với tuần trước ghi gọn "tăng 3 trong tuần" / "giảm 2 trong tuần" (đỏ khi tăng là xấu, lục khi giảm; không đổi thì không ghi). Các phần cộng đủ số thẻ và câu so sánh đủ nằm ở gợi ý khi rê chuột, nhãn đọc màn hình và danh sách mở khi bấm (mục 17). **Thẻ Quá hạn chưa hoàn thành là thẻ duy nhất có màu nhấn** (nền `--nen-do-mo`, viền `--vien-do`, số `--do-chu`); không có việc quá hạn thì như thẻ thường. Ba thẻ còn lại: Cần lãnh đạo cho ý kiến, Chỉ đạo chờ phản hồi, Đang thực hiện trong hạn.
- **Câu kết luận** `.tq1-kl` (không nêu tên cán bộ): màn hình ghi câu gọn, gồm số việc quá hạn và một nơi nhiều nhất ("91 nhiệm vụ quá hạn, nhiều nhất ở Phòng Tổng hợp (38)."); câu đủ chỉ ở bản in báo cáo nhanh; nền đỏ nhạt và nút "Xem và chỉ đạo" (mở danh sách việc quá hạn ngay tại chỗ) khi còn việc quá hạn; nền nhạt, không nút khi không còn.
- **Hàng hai khối**: "Quá hạn theo phòng, đơn vị" (Thường trực: đơn vị chủ trì; Trưởng phòng: cán bộ) — thanh ngang, nhiều việc quá hạn đứng trước, tím = quá hạn từ N ngày, đỏ = dưới N ngày, tối đa 8 dòng (nhiều hơn thì dòng cuối gộp phần còn lại); "Giao mới và hoàn thành theo tuần" — 12 tuần, cột đôi `--du-lieu` / `--du-lieu-2`, trục số tối đa bốn nấc (số của từng tuần ở gợi ý của cột). Hai khối không có câu phụ dưới tiêu đề.
- **Dòng Nhiệm vụ quý của Ban Thường vụ** nền `--nen-mo`: tên (số nhiệm vụ và số ngày còn lại của quý ở gợi ý của tên), thanh cơ cấu theo trạng thái, nút sang Tổng quan quý.
- Mỗi số, thẻ, dòng, cột bấm được → đúng danh sách tạo nên con số. Theo bề rộng vùng Tổng quan (`@container tq`): ≤ 900px vòng đúng hạn một hàng, ba số tổng chia đều hàng dưới, bốn thẻ xếp 2 × 2, hai khối xếp dọc; ≤ 640px nút trên dải chỉ còn biểu tượng, thẻ quá hạn và thẻ trong hạn hết hàng, hai thẻ giữa chỉ số, tên, so sánh. Bản in thường (Ctrl+P) không in nền dải (chữ về màu mực, có khung).

*Phân tích chi tiết (v3.36, CAU-HOI V-13, mục 17)*: sau tầng 1 là một hàng `.tq-loc2` gồm tên phần "Phân tích chi tiết", chip các điều kiện đang lọc, số đang lọc, "Xem danh sách", "Xoá bộ lọc", "Mở tất cả" / "Thu gọn tất cả", nút "Bộ lọc" (mở phần phạm vi việc, lọc nhanh và 12 ô; gập lại mỗi lần vào màn Tổng quan, không nhớ theo máy). Tiếp theo là **danh sách các khối phân tích, mặc định gập**: mỗi khối một dòng gồm tên khối, số chính khi có (ví dụ "11 đơn vị", "91 việc") và mũi tên; bấm tiêu đề để mở / gập; khối đã mở nhớ theo máy; cạnh tên khối đang mở là nút "i" mang ghi chú mốc tính. Khối không còn số thứ tự. Bản in không phụ thuộc trạng thái gập.

*Tầng 2*: ma trận đơn vị theo trạng thái `.bang-mt` (ô có việc tô nền theo mức: tím, đỏ, vàng; đầu cột có ô màu kèm nhãn; tỷ lệ đúng hạn kèm mẫu số, "chưa đủ dữ liệu" khi dưới ngưỡng; ô của dòng Tổng cộng cũng bấm được — mở toàn bộ việc của cột trong phạm vi; vùng ≤ 640px mỗi đơn vị thành một khối, ô 0 ẩn), 10 điểm nghẽn (nội dung tối đa 2 dòng), xếp hạng, rồi các khối phân tích. *Tầng 3*: ngăn chi tiết dùng chung. Mỗi thẻ, ô, cột, dòng bấm được → đúng danh sách tạo nên con số. Phạm vi số liệu do RLS quyết định; frontend chỉ đếm (`lib/kl/tong-quan.js`, `tong-quan-tang.js`).

**Giải ngân vốn đầu tư công trên Tổng quan** (v3.28): khối rộng hết hàng ngay sau Điểm nghẽn. Vòng % và chip mức dùng màu trạng thái sẵn có (lục: đạt / đúng tiến độ, vàng: chậm, đỏ: chậm nhiều) **luôn kèm chữ mức** — chữ khác "Vàng / Đỏ" của cảnh báo hạn. Biểu đồ % qua các kỳ: đường liền `--du-lieu` = lũy kế, đường đứt `--chu-mo` = tiến độ đều tới mục tiêu, chấm rỗng = số ước tính; chấm và chữ là HTML đặt theo % nên không méo ở mọi độ rộng. Bảng chủ đầu tư: tỷ lệ thấp trước, đơn vị dưới mức chung của tỉnh nền `--nen-vang-mo` kèm chữ "dưới mức chung của tỉnh". Hộp "Nhập kỳ số liệu" rộng 1000px (bảng xem trước cuộn trong khung, tiêu đề cột dính trên).

**In báo cáo nhanh (v3.36):** nút ở đầu Tổng quan (biểu tượng máy in; điện thoại chỉ biểu tượng). Bản in một trang A4 dọc: phần đầu theo thể thức Văn phòng (TỈNH ỦY CAO BẰNG / VĂN PHÒNG — Trưởng phòng: VĂN PHÒNG TỈNH ỦY CAO BẰNG / tên phòng; ĐẢNG CỘNG SẢN VIỆT NAM; Cao Bằng, ngày … tháng … năm …; BÁO CÁO NHANH, tình hình thực hiện nhiệm vụ đến ngày …; phạm vi, kỳ, giờ số liệu), năm chỉ tiêu tầng 1 dạng bảng (số, tên, phần tách, so với tuần trước), câu kết luận, dòng nhiệm vụ quý, ma trận đơn vị (6 dòng nhiều việc quá hạn nhất và dòng Tổng cộng; nhiều hơn thì ghi câu chú thích), 5 điểm nghẽn quá hạn lâu nhất (ghi chú thích khi bị cắt), chân ghi nguồn; không in menu, thanh Hỏa tốc, bộ lọc, biểu đồ xu hướng, các khối phân tích khác, chân in chung (`in.css`, chỉ khi bấm nút; khổ A4 dọc chỉ gắn cho bản in này — Ctrl+P, In / lưu PDF, Báo cáo giữ cách in chung, chọn được khổ ngang).

**Cần xử lý** (tiêu đề "Cần xử lý hôm nay"): đầu trang là ba câu hỏi — *Ai đang chậm? Nghẽn ở đâu? Cần đồng chí quyết?* — trả lời bằng tên và số; bấm một ô lọc danh sách như bấm thanh trái. Trưởng phòng xem câu trả lời theo cán bộ, không lọc. Không còn dải 5 ô số (trùng Tổng quan). Mọi thẻ việc của trang (khối Thường trực giao, đề nghị từ chối, bị từ chối, dải Cần xử lý ngay, kết quả nộp, chỉ đạo Thường trực, khối của Trưởng phòng) ghi nội dung **tối đa hai dòng** (`.nd-gon`, nguyên văn ở `title` và ngăn chi tiết) và thông tin phụ một dòng riêng (`.nd-phu`). Thẻ chính `.the.hang` hai tầng (lưới): tầng trên chấm · mã · nội dung tối đa hai dòng · số ngày trễ · nút; tầng dưới (`.the-phu`) chạy từ cột nội dung tới mép phải thẻ — nhãn (độ khẩn, Thường trực giao, vòng khép kín; mỗi nhãn không gãy dòng; chỉ khi có) đứng cùng hàng với bốn điều theo Công văn 1400 (`.bon-dieu`: ai chậm · khâu · sản phẩm · cấp cần quyết) tối đa hai dòng, vướng mắc một dòng; thẻ hẹp dưới 580px (điện thoại, hoặc máy 1000–1250px khi danh sách đứng cạnh thanh trái) xếp dọc theo bề rộng thẻ (`@container the-hang`), bốn điều hiện đủ. Nghiệm thu ngay trên dòng; chỉ đạo chờ trả lời. Danh sách xếp **theo mức khẩn**: độ khẩn, việc Thường trực giao, quá hạn từ N ngày trước quá hạn dưới N ngày, số ngày trễ, hạn gần. Việc sắp đến hạn (để nhắc) mở từ ô Tổng cộng × Sắp đến hạn của ma trận đơn vị ở Tổng quan. Từ v3.36 (CAU-HOI V-13, mục 17): thẻ không còn nhãn mặc định "Thường trực chưa chỉ đạo" (chỉ hiện nhãn khi đã có chỉ đạo hoặc có chỉ đạo điều hành chờ phản hồi); điều thứ ba chỉ ghi tên sản phẩm vì tình trạng đã nằm ở tên khâu đứng trước (câu đầy đủ ở `title` của dòng); danh sách việc nghẽn hiện 10 việc đầu theo mức khẩn, cuối danh sách có nút "Xem tất cả N việc"; khối kết quả nộp mỗi kết quả hai dòng chữ (mã việc, trạng thái, nội dung việc; người nộp, lúc nộp, trích yếu, liên kết "Xem tệp"), hiện 5 kết quả mới nhất; ba câu hỏi và thanh trái chỉ còn tên và số, phần giải thích ở gợi ý `data-goi`; câu giải thích của các khối (kết quả nộp, việc Thường trực giao, đề nghị từ chối, việc bị từ chối, thứ tự xếp của danh sách) nằm ở nút "i" cạnh tên khối.

**Báo cáo và Cán bộ (v3.36, CAU-HOI V-13, mục 17).** *Báo cáo*: phụ đề chỉ ghi kỳ và phạm vi (ngày lập chỉ có ở bản in, lớp `.chi-in-dong`; ghi chú "việc ngoài phạm vi chỉ xem" ở nút "i" cạnh phụ đề). Dải số bảy ô, nhãn ngắn; ngưỡng "sắp đến hạn" và mẫu số của tỉ lệ nộp đúng hạn ở gợi ý (`data-goi`) và chữ ẩn `.sr`. Mỗi khối: tên khối, số lượng khi khối là danh sách ("125 việc", "48 văn bản"), nút "i" cho ghi chú mốc tính. "Việc cần lãnh đạo quyết định" hiện 5 dòng đầu, "Theo kết luận, văn bản giao việc" hiện 10 dòng đầu (hàng đang mở rộng không bị ẩn); nội dung và vướng mắc tối đa hai dòng (`.nd-gon`, đủ chữ ở `title`, ngăn chi tiết và bản in). Dòng phụ của tên dòng ("6 cán bộ", "ban hành …") đứng cùng dòng với tên. Màn hẹp (≤ 900px) và bản in khổ dọc, nơi bảng xếp thành khối không có hàng tiêu đề: mỗi ô mang nhãn ngắn `data-nhan`, sáu số của một dòng đứng cùng hàng ("Tổng: 40, Quá hạn: 10, …"). Bản in ghi số trong bảng (số là nút bấm nên trước v3.36 bị ẩn cùng mọi nút). *Cán bộ*: ghi chú của màn ở nút "i" cạnh tên màn; dòng số của phòng ghi "N cán bộ, N việc đang mở, N quá hạn", cách tính ở gợi ý; số quá hạn của từng người đứng cùng dòng với nhãn.

**Menu:** bốn nhóm **Điều hành, Nhiệm vụ, Nhiệm vụ quý BTV, Quản trị**; tên nhóm là nút thu gọn / mở (mũi tên xoay, `aria-expanded`), lựa chọn nhớ theo máy và tài khoản; lãnh đạo (Thường trực, lãnh đạo Văn phòng, Trưởng phòng) mặc định thu nhóm Nhiệm vụ quý BTV (tầng 1 Tổng quan đã có dòng nhiệm vụ quý); mở một chức năng nằm trong nhóm đang thu thì nhóm tự mở. Thanh biểu tượng 601–900px không có tên nhóm, mọi nhóm mở. Nền của mục đang chọn là một dấu chọn trượt (`.menu-dau`, `shell/dau-chon.js`): đổi mục thì trượt sang mục mới; thu / mở nhóm, đổi cỡ chữ thì đặt lại ngay.

**Màn chờ và mở đầu (v3.36, CAU-HOI V-12):** khi tải lại trang mà máy còn phiên đăng nhập, hoặc vừa đăng nhập xong, màn hình là màn chờ `#manCho` (nền màu menu, vạch son, biểu trưng và tên cơ quan đúng vị trí thanh đầu trang; biểu trưng có vòng sáng lan ra) thay cho màn đăng nhập; vào ứng dụng thì khung ứng dụng mở ra theo hình tròn từ biểu trưng. Không vào được (hết phiên, phải đặt mật khẩu mới, lỗi nạp hồ sơ) thì bỏ màn chờ, hiện đúng màn tương ứng; quá 10 giây (tải lại trang) hoặc 12 giây (vừa đăng nhập) chưa xong thì màn chờ tự bỏ. Menu bánh răng: nhóm "Kiểu giao diện" có thêm mục bật / tắt "Hiệu ứng chuyển động" (mục 7).

**Chuông (v3.36, migration 0142):** hai thẻ trong bảng chuông — **Cần đồng chí xử lý** (mở mặc định) và **Để biết**, số chưa đọc cạnh tên thẻ; thẻ chọn gạch chân lam, `role="tablist"` theo mẫu tab của WAI-ARIA (← → / Home / End chuyển thẻ; số chưa đọc đọc qua `aria-label` của thẻ; danh sách nằm trong khung `tabpanel`). Số trên huy hiệu và cạnh tên thẻ lấy từ `kl_so_chua_xu_ly` (không giới hạn 60 tin đã tải mỗi thẻ). Huy hiệu trên chuông, thông báo nhanh và âm chuông chỉ cho tin cần xử lý; tin để biết thêm vào thẻ của nó, không bật thông báo nhanh. Mỗi thẻ gom tin theo việc; "Đánh dấu đã đọc" áp cho thẻ đang mở; bấm một dòng mở việc và đánh dấu đã đọc mọi tin của việc đó. Ô trống: "Không có thông báo cần đồng chí xử lý." / "Chưa có thông báo để biết."

**Giao việc.** Trên biểu mẫu là dải quy tắc **1-1-1-1-3** (một chủ trì, một sản phẩm, một hạn hoàn thành, một minh chứng, ba mức cảnh báo) sáng dần theo ô đã điền. Dưới các ô Chủ trì theo dõi / Sản phẩm đầu ra / Hạn xử lý có hàng "Chọn nhanh" (chọn nhanh = chọn trong ô, cùng kiểm tra; hạn 7 / 14 / 30 ngày, cuối tháng tính từ ngày nhận văn bản, nhãn ghi rõ ngày). Giao tiếp xuống: khối "Kế thừa từ cấp trên" (nội dung, văn bản, hạn, sản phẩm của việc cha — chỉ xem) và hạn gợi ý "Sớm 3 / 5 / 7 ngày" trước hạn của cấp trên. Cột phải "Văn bản đang nhập": đã nhập / dự kiến và các việc vừa nhập, dùng cùng nút "Giao, nhập tiếp" để nhập liền một văn bản.

**Ngăn chi tiết dùng chung:** mọi chỗ "bấm để xem" (số, biểu đồ, bảng ở Tổng quan; ô ở Cần xử lý; dòng ở Theo văn bản, Báo cáo, Cán bộ, Cần nghiệm thu; chuông, tìm nhanh) mở ngay tại chỗ một tấm cố định bên phải rộng `min(560px, 100vw)` (điện thoại toàn màn dưới thanh đầu trang), hai tầng Danh sách → Chi tiết, không đổi mục, không lớp phủ; đóng bằng dấu × ở góc trên phải (36×36px, nhãn đọc "Đóng ngăn chi tiết") hoặc Esc.

**Nhập theo tầng:** cấp dưới chỉ xem ô cấp giao đã điền (biểu tượng khoá), muốn đổi thì gửi **Đề nghị sửa** (lý do bắt buộc; người giao Chấp nhận / Giữ nguyên kèm ý kiến; người gửi rút được). Cấp giao, chủ trì theo dõi (việc chưa hoàn thành, v3.34) và thư ký Thường trực sửa ngay (biểu tượng bút, "Sửa thông tin giao", lý do bắt buộc, lịch sử và tin báo người liên quan).

**Nhập Excel toàn trình** (thẻ "Nhập từ Excel" / "Chờ hoàn thiện (n)" trên màn Giao việc; chuyên viên quản trị nhiệm vụ và quản trị hệ thống):
- Chuẩn ba mức, tô màu ở mẫu: mức 1 vàng (đủ để giao), mức 2 lam (tiến độ), mức 3 lục (đủ để đóng: minh chứng 4 yếu tố + chất lượng).
- Hai bước. *1. Ghép cột:* tự nhận sheet, dòng tiêu đề, hồ sơ (Mẫu nhập chuẩn, Phụ lục 2, hồ sơ đã lưu dùng chung); ví dụ ngày dạng dd/mm/yyyy. *2. Xem trước* (chưa ghi gì): kết quả dự kiến từng dòng; giá trị chưa khớp / khớp gần đúng → chọn mục đúng, lưu từ điển dùng chung; điền hàng loạt ô trống; một dòng tóm tắt các ô tự điền theo quy tắc mặc định; chọn cách xử lý việc đã hoàn thành của tệp.
- Nhập theo lô (mã LO-…): lỗi giữa chừng → "Nhập tiếp" đúng lô đó. Hoàn tác lô trong 24 giờ. Dòng thiếu vào "Chờ hoàn thiện" → Hoàn thiện bằng biểu mẫu Giao việc điền sẵn, hoặc bỏ.
- Ngăn chi tiết có khối "Dữ liệu gốc từ Excel" (mọi cột của dòng tệp). Màn Nhiệm vụ có "Xuất theo mẫu nhập" để sửa rồi nhập lại theo mã.

## 11. Bảng nhiệm vụ theo cột (v3.25.0 — mẫu 16/10/2026, chủ dự án duyệt 18/10/2026)

Mọi danh sách nhiệm vụ (Nhiệm vụ, Việc tôi đã giao — trước v3.31 là "Việc tôi theo dõi", Việc của tôi, Theo văn bản) là **bảng có cột** kiểu V-Office. CSS `styles/bang-nhiem-vu.css` (khung, cột, màn hẹp, in); lớp tiền tố `bnv-`, viết nguyên văn trong JS.
- **Ô số** trên bảng: một khối, các ô cách nhau 1px, chia đều một hàng; ô đang chọn nền `--navy-dac`, chữ trắng, số `--vang-tren-dac`; chọn một ô một lúc; số của ô = số dòng khi chọn ô đó (cùng một mảng). Bộ 8 ô: 4 + 4 ở 901–1200px; ≤ 900px hai ô một hàng.
- **Dòng**: cao ≥ 58px, kẻ ngang mảnh, không kẻ dọc, không sọc; **mép trái 4px theo mức** (lam trong hạn, vàng, đỏ, tím Đỏ đặc biệt — nền tím nhạt cả dòng, lục hoàn thành); hàng tiêu đề chữ 13px đậm vừa màu `--chu-phu` trên nền `--nen-mo`; giờ và con số bằng Lexend; mã việc đậm màu cấu trúc; ô Hạn: ngày đậm theo màu mức + dòng phụ "còn 3 ngày / trễ 4 ngày / xong 29/9 · trước hạn 1 ngày"; Trạng thái là nhãn màu. Chú giải màu ngay trên bảng.
- **Màn Nhiệm vụ từ v3.36 (CAU-HOI V-13, mục 17)**: mỗi dòng tối đa hai dòng chữ. Ô Nhiệm vụ là một khối hai dòng: mã việc, mã theo nguồn, nhãn và điều cần để ý (viên vàng) đứng đầu, nội dung chạy tiếp; nguyên văn ở `title` của ô và ngăn chi tiết. Dòng phụ của các ô khác (ngày ban hành, phòng, "còn 3 ngày") một dòng, cắt bằng dấu ba chấm, đủ chữ ở `title` của ô; cột Tình hình của Việc tôi đã giao giữ đủ chữ. Ô Thời gian nhập còn giờ và ngày. Ở 1201–1600px dòng "nhập lúc, người nhập" không còn dưới nội dung (vẫn có ở bản in, ở `title` và ngăn chi tiết). Chú giải màu mỗi mục 2 đến 4 chữ, câu đầy đủ ở gợi ý `data-goi`. Dòng phụ đề chỉ ghi phạm vi, ghi chú thêm ở nút "i". Bốn nút Xuất Excel, Xuất theo kỳ, Xuất theo mẫu nhập, In / lưu PDF gom sau nút "Xuất, in" (`components/menu-tha.js`: bấm ra ngoài, nhấn Esc hoặc chọn xong thì đóng).
- **Cột**: Nhiệm vụ — STT | Thời gian nhập | Nhiệm vụ | Văn bản giao | Chủ trì theo dõi | Hạn xử lý | Trạng thái; Việc tôi đã giao — STT | Nhiệm vụ | Chủ trì theo dõi | Văn bản giao | Hạn xử lý | Trạng thái | Tình hình (xám bình thường, vàng cần đôn đốc, đỏ vướng mắc / chỉ đạo chờ, lục đã nộp minh chứng); Việc của tôi — STT | Nhiệm vụ | Văn bản giao | Thời gian giao | Hạn xử lý | Trạng thái | Việc cần làm; Theo văn bản — STT | Văn bản | Ngày nhận | Người giao | Nhiệm vụ (đã nhập / dự kiến) | Tiến độ (thanh lục / đỏ / vàng + "x/n hoàn thành") | Cảnh báo, bấm tên văn bản mở bảng con (Nhiệm vụ của văn bản | Chủ trì theo dõi | Hạn xử lý | Trạng thái; việc giao tiếp xuống thụt "↳").
- **Việc cần làm** (Việc của tôi): một nút cho việc đầu tiên áp dụng — Xác nhận đã nhận việc (nút lam, kèm nút viền "Từ chối") → Trả lời chỉ đạo → Nộp minh chứng (nút lam khi việc gấp) → Cập nhật tiến độ; không có việc chờ thì chữ xám. Biểu mẫu mở **ngay dưới dòng** (khối viền trái theo mức), mỗi lúc một khối, Huỷ đưa con trỏ về nút đã mở.
- **Trang**: 50 dòng mỗi trang; chân bảng "Hiển thị 1–50 trong 230 nhiệm vụ (lọc từ 812)" + "‹ Trang trước · Trang 1/5 · Trang sau ›"; đổi ô số / tìm / lọc / sắp xếp về trang 1. In và Xuất Excel lấy đủ danh sách.
- **Ngăn chi tiết** (màn Nhiệm vụ) hiện **cạnh** bảng (520px; 420px khi ≤ 1200px), không phủ lên bảng; ≤ 900px xếp dưới bảng. Đóng bằng dấu × ở góc trên phải (trong ngăn dùng chung đã có × của ngăn nên ẩn). Thường trực, lãnh đạo Văn phòng, Trưởng phòng thấy khối Chỉ đạo ngay dưới thông tin chính, trước các nút sửa; chuyên viên giữ thứ tự cũ.
- **Theo bề rộng** (bốn mốc, mục 4): > 1600px đủ cột; 1201–1600px gộp cột thời gian vào dòng phụ dưới nội dung; ≤ 1200px — và khi ngăn chi tiết đang mở trên màn ≤ 1600px — mỗi dòng là thẻ, mỗi ô có nhãn (`data-nhan`); ≤ 600px nội dung 3 dòng, nút thao tác rộng hết thẻ (≥ 44px); 360px không cuộn ngang. Thẻ chỉ cho màn hình — bản in giữ dạng bảng.
- **In**: ẩn ô số, chú giải, nút trang, khối dưới dòng và cột Việc cần làm; cột gộp như 1201–1600px; dòng không bị cắt giữa trang.

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
| sản phẩm · nguồn · phối hợp · cấp nhận | **Sản phẩm đầu ra** · **Nguồn nhiệm vụ** · **Đơn vị phối hợp** · **Cấp nhận sản phẩm** (tên ở Giao việc) |
| người theo dõi | **không có ô** (v3.31 — CAU-HOI nhóm Q): chỉ còn **Chủ trì theo dõi**, ghi một kiểu — cán bộ "Họ tên (Phòng …)" (lãnh đạo: "(Văn phòng Tỉnh ủy)"), phòng / Văn phòng: tên đơn vị (`lib/kl/chu-tri.js` `chuTriText`); bảng danh sách: tên dòng trên, phòng dòng dưới. Mục chuyên viên "Việc tôi đã giao" (thay "Việc tôi theo dõi") |

Không dùng "Chủ trì", "Theo dõi", "Người theo dõi" (v3.31), "Chịu trách nhiệm", "Hạn hoàn thành", "Cơ quan trình" hay chữ "Owner" làm tên ô (thông báo lỗi do cơ sở dữ liệu
trả về còn chữ "Owner" — sửa bằng migration ở đợt sau). Giữ nguyên vì nghĩa khác cột Excel: "Trạng thái" (tính theo hạn — khác cột "Tiến độ");
"Số hiệu" của văn bản ở Giao việc (mọi loại văn bản); cột "Nhiệm vụ" của bảng (mã + nội dung); các ô riêng của minh chứng (số hiệu, ngày, trích yếu,
mô tả kết quả); màn và tệp rà soát phân loại (tệp đọc lại theo tiêu đề cũ — v3.29: cột ngành ghi "Ngành/lĩnh vực", bỏ cột "Lĩnh vực", tệp cũ có cột
"Ngành", "Lĩnh vực" vẫn đọc được); chữ "Theo dõi" ở nhóm menu và hộp "Theo dõi giải ngân".

## 13. Mức cảnh báo ghi bằng nghĩa (v3.29 — chủ dự án quyết 22/10/2026)

"Ghi đúng quy tắc" ở **mọi màn hình**, giữ nguyên màu (mục 2). Một chỗ đặt tên: `lib/kl/nhan.js` `tenMuc` — số ngày đọc theo `kl_cau_hinh`
(`nguong_vang_ngay`, `nguong_do_dac_biet_ngay`, `do_khan_KHAN_vang`; mặc định 3 · 3 · 5, cùng số hàm trạng thái của cơ sở dữ liệu dùng).

| Mức (Công văn 1400) | Ghi đầy đủ (giữa câu, tiêu đề) | Ghi gọn (chip, ô hẹp) |
|---|---|---|
| Vàng | sắp đến hạn (còn ≤ 3 ngày) | Sắp đến hạn |
| Đỏ | quá hạn dưới 3 ngày | Quá hạn < 3 ngày |
| Đỏ đặc biệt | quá hạn từ 3 ngày trở lên | Quá hạn ≥ 3 ngày |

- Tên Vàng / Đỏ / Đỏ đặc biệt chỉ còn ở **chú giải màu**, luôn sau nghĩa: "Quá hạn dưới 3 ngày (mức Đỏ)". v3.30 (chủ dự án 23/10/2026): **không ghi dòng "Cách tính"** trên màn hình (Tổng quan, khối Giải ngân vốn, Báo cáo) cho đỡ rối mắt — cách tính ghi ở Hướng dẫn sử dụng.
- Báo cáo (v3.30): thanh **kỳ** dưới tiêu đề — nhóm nút `.pham-vi` (Tháng · Quý · Năm · Nhiệm kỳ) + "Từ ngày" / "Đến ngày" (ô ngày `o-nhap nho`, như màn Thống kê sử dụng); điền ngày thì không nút nào sáng; kỳ ghi ở dòng phụ đề (in cùng trang), thanh kỳ không in; màn ≤ 900px nhóm nút xuống dòng.
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
| Đăng nhập (chưa có phiên) | `/Dang-nhap` |
| Tổng quan | `/Tong-quan` |
| Cần xử lý / Việc của tôi (chuyên viên) | `/Can-xu-ly`, `/Viec-cua-toi` |
| Giao việc và hai thẻ nhập liệu: Nhập từ Excel, Chờ hoàn thiện | `/Giao-viec`, `/Nhap-Excel`, `/Cho-hoan-thien` |
| Nhiệm vụ (mọi tên theo vai) / Việc tôi đã giao | `/Nhiem-vu`, `/Viec-toi-da-giao` (v3.31; đường dẫn cũ `/Viec-toi-theo-doi` vẫn mở) |
| Theo văn bản / Cán bộ / Báo cáo | `/Theo-van-ban`, `/Can-bo`, `/Bao-cao` |
| Chỉ đạo đã gửi / Chỉ đạo Thường trực | `/Chi-dao-da-gui`, `/Chi-dao-Thuong-truc` |
| Rà soát phân loại | `/Ra-soat-phan-loai` |
| Nhiệm vụ quý BTV | `/Tong-quan-quy`, `/Danh-muc-quy`, `/Cap-nhat-tuan`, `/Bao-cao-quy`, `/Quan-ly-danh-muc-quy` |
| Quản trị và từng thẻ | `/Quan-tri`, `/Quan-tri/Tai-khoan`, `/Quan-tri/Phan-cong-phu-trach`, `/Quan-tri/Nguong-canh-bao`… |
| Cá nhân / Trợ giúp | `/Ca-nhan`, `/Tro-giup` |
| Chi tiết một nhiệm vụ (mở ở màn nào thì theo màn đó) | `/<chức năng>/<mã việc>`, ví dụ `/Nhiem-vu/NV-9601`, `/Tong-quan/NV-9601` |

- Đổi màn (menu, nút trong màn, thẻ Quản trị, thẻ Giao việc) → đường dẫn đổi theo, mỗi lần bấm một bước lịch sử; Quay lại / Tiến tới của trình duyệt
  mở đúng chức năng; tải lại trang giữ chức năng. Danh sách "Lọc chi tiết, in" của chuyên viên, Nhắn tin giữ đường dẫn của màn đang mở.
- Chưa đăng nhập (mở một đường dẫn, địa chỉ gốc, sau đăng xuất, hết phiên): thanh địa chỉ ghi `/Dang-nhap` (chủ dự án 22/10/2026); chức năng đang mở
  được nhớ ngầm (không ghi lên đường dẫn) — đăng nhập xong vào đúng chức năng đó, bước `/Dang-nhap` được thay nên Quay lại không về trang đăng nhập.
  Đã đăng nhập mà mở `/Dang-nhap` → trang đầu của vai.
- Mở thẳng một đường dẫn: chức năng không thuộc menu của vai (hoặc đường dẫn lạ) → trang đầu của vai, thông báo "Đường dẫn không thuộc chức năng của
  tài khoản đồng chí — đã mở trang đầu." Dữ liệu vẫn chỉ theo đăng nhập và RLS.
- Chi tiết một nhiệm vụ (chủ dự án 22/10/2026 17:02): mở việc ở bất kỳ màn nào (danh sách, ngăn chi tiết dùng chung, chuông, Theo văn bản…) → thanh
  địa chỉ thêm mã việc sau đường dẫn của màn; đổi sang việc khác không thêm bước; Đóng / Quay lại trong ngăn / Esc → về đường dẫn của màn; Quay lại /
  Tiến tới của trình duyệt đóng / mở lại việc (không vẽ lại màn); tải lại, đánh dấu, gửi đường dẫn → mở đúng màn và đúng việc (chưa đăng nhập thì qua
  `/Dang-nhap`; tự đăng xuất vì hết phiên thì chỉ giữ chức năng, bỏ mã việc). Danh sách lọc (bấm số ở Tổng quan, Báo cáo), cán bộ, văn bản không có
  đường dẫn riêng.
- Đường dẫn chỉ gồm tên chức năng và mã nhiệm vụ (`NV-<số>`) — không nội dung việc, tên người, tên đăng nhập hay mã định danh nội bộ. Mở bằng đường
  dẫn vẫn qua đăng nhập và RLS; việc không có và việc ngoài phạm vi báo cùng một câu "Không có nhiệm vụ NV-… trong phạm vi của đồng chí." (không lộ việc có
  tồn tại hay không), mã bị bỏ khỏi đường dẫn.

## 15. Hộp sửa có lý do (v3.29 — chủ dự án quyết 22/10/2026, CAU-HOI O-4…O-6)

Điều chỉnh hạn, Đổi chủ trì theo dõi, Sửa toàn bộ thông tin, Sửa văn bản giao, Sửa minh chứng dùng chung một khuôn với "Sửa thông tin giao" (mục 5,
hộp thoại): tiêu đề "Tên hộp · mã việc", dòng mô tả chữ phụ (nội dung việc hoặc điều sẽ xảy ra), ô "Đang ghi" (giá trị hiện tại, chữ đậm), ô mới, một dòng
chữ phụ nói hệ quả ngay khi nhập ("Lùi hạn: tính là gia hạn lần 2.", "Phòng, đơn vị chủ trì sau khi đổi: …", "Sẽ sửa: Hạn xử lý, Ghi chú."), ô **Lý do**
bắt buộc ngay trên chân hộp, nút chính "Lưu …" bên phải. Thao tác một bước trên một việc (Mở lại nhiệm vụ, Gỡ minh chứng) dùng ô lý do mở tại chỗ
dưới hàng nút, như "Từ chối" / "Trả lại". Nút chỉ hiện với người có quyền (chốt quyền ở cơ sở dữ liệu); từ v3.34 chủ trì theo dõi điều chỉnh hạn cả khi việc đã quá hạn.

## 16. Phân hệ Nhiệm vụ quý BTV (v3.35 — chủ dự án 13/11/2026, CAU-HOI U-5)

- **Lãnh đạo nắm ngay, chủ trì theo dõi cập nhật**: Tổng quan quý đọc từ trên xuống — một câu tóm tắt (con số kèm danh từ, số ngày còn lại của quý) → ô số
  bấm được → 05 chỉ tiêu cơ bản (mục tiêu / thực hiện / thanh % / Đạt – Chưa đạt, ngày và nguồn số liệu) → 6 trục (thanh xếp chồng hoàn thành / đang /
  chậm / chưa) → **Cần lãnh đạo quan tâm** (đơn vị, số ngày chậm so với mốc, kết quả còn thiếu, lãnh đạo phụ trách, vướng mắc / đề xuất) → kết quả mới trong
  tuần, đến mốc trong tháng → bảng theo lãnh đạo phụ trách, đơn vị, chủ trì theo dõi → diễn biến các tuần đã chốt. Mọi số, tên bấm được → Danh mục đã lọc.
- **Danh mục** đúng cột bảng Phụ lục (nhóm theo trục → nhóm), thêm Kết quả thực hiện mới nhất (kèm ngày), Trạng thái, Chủ trì theo dõi; mép trái theo mức
  (Đỏ đặc biệt tím, Đỏ, Vàng, xanh, lục); kết quả / sản phẩm thu gọn một chấm màu một dòng; ≤ 900px mỗi dòng thành thẻ có nhãn ô.
- **Cập nhật tuần** (nơi làm việc của chủ trì theo dõi): thẻ "Chưa báo cáo tuần này" trước, biểu mẫu mở ngay trên thẻ, ô theo loại kết quả.
- Ngăn chi tiết `#nqNgan` như ngăn dùng chung (mục 10): khối **Kết quả thực hiện** nền lam nhạt ngay dưới nội dung; hộp lý do như mục 15. Chỉ token sẵn có.

---

## 17. Số trước, chi tiết bấm mới mở (v3.36 — chủ dự án chọn 27/11/2026, CAU-HOI V-13)

Chủ dự án xem bản staging của v3.36: "vẫn hiển thị quá nhiều chữ vào thông tin chi tiết không cần thiết". Đo ở 1366×768: Tổng quan dài gần 12 màn hình, khoảng 2.400 chữ; Cần xử lý hơn 18 màn hình. Chọn phương án 2 trong ba bản mẫu. Quy tắc áp cho mọi màn hình (làm lần lượt: Tổng quan, Cần xử lý, Nhiệm vụ, Cán bộ, Báo cáo, Nhiệm vụ quý):

1. **Mỗi con số một nhãn ngắn.** Không dòng chữ phụ dưới con số. Phần tách của con số (các phần cộng lại, mẫu số, so với kỳ trước) nằm ở ba chỗ: gợi ý khi rê chuột hoặc đưa tiêu điểm (`data-goi`), nhãn đọc màn hình (`aria-label`, hoặc chữ ẩn `.sr` khi phần tử không nhận tiêu điểm), và danh sách mở ra khi bấm vào số (các nhóm của danh sách chính là phần tách).
2. **Không lặp một con số bằng chữ** trên cùng màn hình (số đã có ở thẻ thì không nhắc lại ở dòng phụ, câu dẫn của khối khác).
3. **Không câu hướng dẫn thao tác** ("bấm một ô để xem…") và không câu chú thích cách tính đặt sẵn trên màn hình. Ghi chú mốc tính của khối nằm ở nút "i" `.nut-goi` cạnh tên khối (gợi ý `data-goi`); cách tính đầy đủ ở Hướng dẫn sử dụng.
4. **Khối phân tích gập mặc định**, mỗi khối một dòng: tên, một số chính (khi khối có số phù hợp), mũi tên. Bấm tiêu đề để mở / gập; lựa chọn nhớ theo máy; có "Mở tất cả". Khối gập bằng thuộc tính `data-gap` và CSS chỉ áp trên màn hình; nội dung vẫn dựng đủ, bản in không đổi.
5. **Bộ lọc sau một nút.** Hàng tiêu đề chỉ hiện chip các điều kiện đang áp dụng (bỏ từng điều kiện bằng ✕) và số đang lọc; các ô lọc mở khi bấm "Bộ lọc", gập lại mỗi lần vào màn, không nhớ theo máy.
6. **Danh sách**: mỗi dòng tối đa hai dòng chữ; thông tin phụ ở ngăn chi tiết; danh sách dài chỉ hiện các dòng đầu, kèm nút "Xem tất cả N …" (`components/ds-gon.js`). Danh sách vẫn dựng đủ dòng; dòng ngoài các dòng đầu mang `data-sau` và chỉ bị ẩn trên màn hình (CSS trong `@media screen`), nên bản in đủ dòng. Lựa chọn "Xem tất cả" nhớ theo máy (`vptu.ds.het`). Dòng đang mở ô nhập, đang mở diễn biến hoặc đang giữ tiêu điểm không bị ẩn. Riêng thẻ việc chính của Cần xử lý gồm nội dung tối đa hai dòng và một dòng thông tin mang đủ bốn trường bắt buộc của SPEC DB-1.
7. **Bản in giữ đủ chữ**: câu kết luận đủ, bảng năm chỉ tiêu, ma trận, điểm nghẽn in như trước dù khối đang gập trên màn hình.
8. Chú giải màu ngắn (ô màu kèm 1 đến 4 chữ) được giữ: màu không đứng một mình (mục 2).

Thành phần dùng chung: hộp gợi ý `#goiChung` gắn vào `<body>` cho mọi phần tử mang `data-goi` ở mọi màn hình, và nút "i" `nutGoi` (`components/goi.js`; bấm chỗ khác thì hộp ẩn, bấm nút "i" thì hộp giữ để đọc trên màn hình chạm); danh sách hiện các dòng đầu (`components/ds-gon.js`; cấu hình `giu` là bộ chọn các dòng không bị ẩn, bảng Báo cáo dùng cho hàng đang mở rộng; khi thu gọn làm trang ngắn lại và nút ra khỏi tầm nhìn thì nút được đưa về giữa màn hình, các dòng đầu ở ngay trên). Chữ ẩn `.sr` đặt trong phần tử có `position` (chữ ẩn nằm trong thanh cuộn ngang mà không có phần tử cha định vị sẽ làm trang tràn ngang).

Đã áp dụng: Tổng quan (27/11, CHANGELOG mục 104), Cần xử lý (27/11, CHANGELOG mục 105; chi tiết ở mục 10), Nhiệm vụ (27/11, CHANGELOG mục 106; chi tiết ở mục 11), Báo cáo và Cán bộ (27/11, CHANGELOG mục 107; chi tiết ở mục 10).
