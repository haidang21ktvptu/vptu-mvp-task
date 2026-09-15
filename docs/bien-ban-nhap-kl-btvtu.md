# Biên bản nhập dữ liệu Theo dõi Kết luận BTVTU vào production

Ngày nhập: 15/9/2026 (02:54 UTC = 09:54 giờ Việt Nam). Người thực hiện: chủ dự án, chạy tay từ máy cá nhân bằng `scripts/nhap-kl-btvtu.mjs --ghi --production` sau khi có backup và xác nhận trong phiên (CLAUDE.md rule 12). Đích: project production `frwyxcmbonjaimziiuqr`, schema `v2.1.0` (migration 0001–0017). Bản gốc của biên bản do script sinh tại `scripts/out/bien-ban-nhap-kl-production-2026-09-15.md` (ngoài git); bản này chép lại **không kèm họ tên hay số việc theo người** vì repo public (thiết kế mục 2.4b).

## 1. Nguồn

| Mục | Giá trị |
|---|---|
| File | `kl-btvtu-goc.xlsx` (ngoài repo, `vptu-backup/nguon-kl-btvtu/`), sheet `Phụ lục 2` 185 dòng, sheet `NhatKyChinhSua` 194 dòng |
| SHA-256 | `7afafbea0bd4cac693c8faed1900de93af17187a5f935c8b9e388deee53f4500` |
| Ánh xạ người sửa nhật ký | `anh-xa-nguoi-sua.json` (ngoài repo), 1 địa chỉ email → 1 tài khoản |
| Dry-run trước khi ghi | 0 vi phạm dữ liệu, 0 vi phạm ánh xạ; bảng ánh xạ 8 họ tên → 8 tài khoản phòng Tổng hợp, "VPTU" → Trưởng phòng Tổng hợp — chủ dự án xác nhận trước khi `--ghi` |

## 2. Dòng đã sửa tay trên Excel trước khi nhập (người quản trị sheet, phòng Tổng hợp)

| Mã | Cột | Giá trị cũ | Giá trị mới | Lý do |
|---|---|---|---|---|
| NV-030 | Ngày ban hành | 21/11/2026 | 21/11/2025 | lỗi gõ năm (thiết kế mục 2.4) |
| NV-044 | Ngày ban hành | 10/12/2026 | 10/12/2025 | lỗi gõ năm (mục 2.4) |
| NV-109 | Ngành/lĩnh vực | (trống) | 8. Kinh tế tổng hợp - Tài chính - Đầu tư - Ngân sách | chốt 14/9 (mục 2.4) |
| NV-009 | Hạn xử lý | 11/10/2025 | 10/11/2025 | hạn trước ngày ban hành 05/11/2025 — phát hiện khi đọc file ở PR 8B, chủ dự án xác minh là dòng duy nhất mắc lỗi này |

## 3. Script tự xử lý (không sửa file gốc)

| Nhóm | Số dòng | Cách xử lý |
|---|---|---|
| Đang mở, "Có hạn cụ thể", trống hạn | 3 (NV-037, NV-060, NV-154) | `ly_do_chua_co_han = "Phụ thuộc yếu tố bên ngoài (chốt 14/9/2026)"` → trạng thái "Cần điền hạn" |
| Chủ trì "VPTU" | 10 (NV-002, 015, 062, 083, 109, 124, 125, 154, 159, 185) | gán tài khoản Trưởng phòng Tổng hợp, `ghi_chu = "Chuyển từ VPTU (chủ trì gốc trên Excel: VPTU)"` |
| "Ký ban hành (trong 10 ngày)" | 25 | hạn để trigger tự tính = ngày ban hành + 10 (khớp công thức sheet ở 25/25 dòng có giá trị) |
| Nhật ký không có mã, có số dòng | 17 | mã suy theo công thức của sheet `NV-(dòng − 3)` (177 dòng có mã đối chiếu khớp 100%) |
| Nhật ký người sửa "(không xác định được)" | 13 | `nguoi_sua` NULL, giữ nguyên văn ở `nguoi_sua_ghi_chu` |
| Mốc giờ nhật ký / "Ngày cập nhật gần nhất" | 194 / 36 | chuỗi có hậu tố "Z" của Apps Script là giờ Việt Nam → lưu `+07:00` |

## 4. Đã ghi và đếm lại trên production

| Bảng | Số dòng | Ghi chú |
|---|---|---|
| `kl_hoi_nghi` | 32 | 30 số hội nghị (hội nghị 33 có 3 số KL) |
| `kl_nhiem_vu` `nguon = excel` | 185 | mã giữ nguyên NV-001…NV-185; sequence đặt 185 → mã kế tiếp NV-186 |
| `kl_lich_su` `nguon = excel`, `cot ≠ '*'` | 194 | nhật ký cũ; giá trị danh mục đổi sang mã, serial ngày → `YYYY-MM-DD` |
| `kl_lich_su` `nguon = excel`, `cot = '*'` | 185 | do trigger ghi lúc INSERT (dòng "tạo"), không phải nhật ký cũ |
| `ly_do_chua_co_han` đã gán | 3 | |
| `ghi_chu` "chuyển từ VPTU" | 10 | |
| Dòng giữ `cap_nhat_luc` từ Excel | 36 | 149 dòng còn lại = lúc nhập |

Số thô theo nguồn: tiến độ Hoàn thành 146 / Đang thực hiện 39; loại hạn Có hạn cụ thể 110 / Chờ quyết định 30 / Ký ban hành 25 / Thường xuyên 20; Hoàn thành thiếu minh chứng 78 (cờ `thieu_minh_chung`), Hoàn thành "Có hạn cụ thể" không có hạn gốc 62 (nhập nguyên trạng, không đánh giá đúng/trễ hạn — `ket_qua = KHONG_DANH_GIA` vì không có `ngay_hoan_thanh` gốc).

## 5. Đối chiếu bộ số trạng thái (hàm `kl_trang_thai`, ngày tính 14/9/2026)

| Nhóm | Production | Bộ số chuẩn (thiết kế mục 1.5, chốt 14/9) |
|---|---|---|
| Hoàn thành | 146 | 146 |
| Thường xuyên | 16 | 16 |
| Quá hạn | 8 | 8 |
| Đang thực hiện | 6 | 6 |
| Chờ điều kiện | 6 | 6 |
| Cần điền hạn | 3 | 3 |
| Sắp đến hạn | 0 | 0 |
| **Tổng** | **185** | **185** |

Cùng bộ số này đã đạt trên local, CI cục bộ và staging với bộ dữ liệu vàng ẩn danh (`tests/rls/kl-moc-2026-09-14`, 85/85 test RLS).

## 6. Sau khi nhập

- Cấp cờ `quan_tri_kl` cho 2 tài khoản (một phòng Tổng hợp, một phòng CĐS-CY) qua màn hình Quản trị (`quyen_lich_su` ghi lý do).
- Nhập phân công PCVP ↔ phòng: 5 dòng `phu_trach_phong`, khớp chức danh hiện hành.
- Điều kiện xong GĐ8 (thiết kế Phần 4): nhập 185 dòng, 0 vi phạm cứng, số khớp mốc — **đạt**. Sang GĐ9: chạy song song 2 kỳ báo cáo với Google Sheet.
