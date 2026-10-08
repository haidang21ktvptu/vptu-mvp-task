# pdf.js (Mozilla) — bản dựng sẵn, chép nguyên văn

Dùng cho Đợt D v3.20: khi người nộp minh chứng chọn tệp PDF, giao diện đọc chữ trang đầu để **gợi ý** số hiệu, ngày, trích yếu
(`frontend/src/lib/kl/doc-pdf.js`, nạp khi cần — không nằm trong gói chính của ứng dụng). Người nộp vẫn kiểm tra và sửa các ô trước khi nộp.

- Nguồn: `https://github.com/mozilla/pdf.js/releases/download/v4.10.38/pdfjs-4.10.38-legacy-dist.zip`
  (SHA-256 của tệp zip: `c85b52b94e081c0443333da0ba4270661b2061da573133984c6272fe3e27bb57`).
- Bản **legacy** (có polyfill cho trình duyệt cũ hơn) — máy văn phòng có thể chưa cập nhật Chrome mới nhất.
- Lấy `build/pdf.mjs`, `build/pdf.worker.mjs` và `LICENSE` (Apache-2.0); chỉ bỏ dòng `//# sourceMappingURL=` cuối mỗi tệp (không kèm tệp .map).
- Vite gói `pdf.mjs` thành một khối nạp chậm và `pdf.worker.mjs` thành worker (`?worker`), đều được nén khi build.
- Gọi với `isEvalSupported: false` (đóng đường thực thi mã qua font, CVE-2024-4367 đã vá từ 4.2.67).
- Không sửa nội dung thư viện. Nâng phiên bản: thay hai tệp `.mjs` + `LICENSE` từ bản phát hành mới, cập nhật mục trên.
- `scripts/check-line-limit.mjs` bỏ qua thư mục này (mã bên thứ ba, không phải mã của dự án).
