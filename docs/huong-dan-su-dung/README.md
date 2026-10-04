# Hướng dẫn sử dụng (.docx) — nguồn dựng

Thư mục này chứa **nguồn** của tài liệu *Hướng dẫn sử dụng Hệ thống quản trị nhiệm vụ* (bản phát hành đầu: v3.14, 4/10/2026, 46 trang, 67 hình). Bản `.docx` / `.pdf` dựng ra **không commit** (`.gitignore`); bản đã bàn giao nằm ngoài kho, trên máy chủ dự án: `D:\TU 2026\kiem-thu\huong-dan-su-dung\`.

## Tệp
- `noi-dung-1.mjs`, `noi-dung-2.mjs` — toàn bộ chữ của tài liệu (Phần 1–4 và 5–9), tiếng Việt phổ thông, mỗi chức năng = vài bước + một hình. `noi-dung.mjs` ghép hai nửa, đánh số hình và gom tiêu đề cho mục lục.
- `lib.mjs` — bộ dựng trên `docx` (npm): tiêu đề, đoạn, bước đánh số (mỗi danh sách đếm lại từ 1), ảnh có chú thích (giới hạn 16,5 × 11 cm), hộp lưu ý, bảng, mục lục tĩnh có số trang. Chữ Times New Roman 13pt, A4, lề 2 cm; `**đậm**`, `*nghiêng*` trong chuỗi.
- `build.mjs` — dựng `HDSD-VPTU-TASK.docx`; `--trang trang.json` điền số trang vào mục lục.
- `trang.py` — đọc PDF (pdftotext) → số trang từng tiêu đề → `trang.json`.
- `cat.py` — bảng vùng cắt của ảnh chụp (tệp `-cat.jpg`), để chữ trong hình to hơn.
- `anh/` — 73 ảnh đang dùng, chụp trên **staging** bằng tài khoản demo (`demo_cv1`, `demo_truongphong`, `demo_cvp`, `demo_a0`, `demo_qtht`), 1536 px; dữ liệu trong ảnh là hư cấu (`phu-luc-2-hu-cau.xlsx`, `bang-theo-doi-tu-do-hu-cau.xlsx`, việc NV-4710…). Không chụp production, không ảnh có tên thật.

## Dựng lại
Cần Node ≥ 22, LibreOffice (`soffice`) và poppler (`pdftotext`, `pdfinfo`) để tính số trang.
```
cd docs/huong-dan-su-dung
npm install                          # chỉ lấy gói docx
node build.mjs                       # lượt 1: mục lục chưa có số trang
soffice --headless --convert-to pdf HDSD-VPTU-TASK.docx
python3 trang.py                     # → trang.json (bỏ qua trang mục lục)
node build.mjs --trang trang.json    # lượt 2: mục lục có số trang
soffice --headless --convert-to pdf HDSD-VPTU-TASK.docx   # bản PDF phát hành
```
Mục lục là tĩnh (không phải trường TOC của Word) nên mở bằng Word không bị hỏi "cập nhật trường"; đổi nội dung thì chạy lại hai lượt.

## Khi giao diện đổi
1. Chụp lại màn hình liên quan trên staging (1536 px, tài khoản demo), ghi đè tệp cùng tên trong `anh/`; nếu là ảnh cắt, sửa toạ độ trong `cat.py` rồi chạy `python3 cat.py <ten-anh>`.
2. Sửa chữ trong `noi-dung-*.mjs` theo đúng nhãn trên màn hình (không dùng thuật ngữ kỹ thuật).
3. Dựng lại hai lượt như trên, mở PDF xem từng trang, cập nhật phiên bản ở `build.mjs` (`PHIEN_BAN`) và chép bản phát hành ra ngoài kho.
