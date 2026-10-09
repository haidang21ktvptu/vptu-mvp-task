# Phát hành v3.21.0 — Đợt F: mọi chuyên viên ngang nhau

Bản phát hành **v3.21.0** = Đợt F (PR #126, migration **0095–0097**) + bổ sung theo đề xuất được duyệt (PR #128, **0098–0099**) + PR phát hành `release/v3.21.0` (HDSD 3.21). Production đang chạy `v3.20.0` (0001–0094); staging đã áp 0001–0099.

Mỗi bước do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu / khoá service. Làm **lần lượt**.

## Thay đổi khi áp lên production
- **0095, 0097, 0098, 0099**: chỉ đổi hàm / view — không đổi dữ liệu cũ. Diễn biến hiện vết cũ "X giao thay mặt Y" thành "Nhập bởi X" (bảng lịch sử giữ nguyên); tin giao việc mới không còn chữ "thay mặt" (0098); hồ sơ ghép cột / từ điển nhập chỉ người lưu sửa, xoá (0099).
- **0096** (đổi dữ liệu, không hoàn tác bằng hàm): **thu cờ "quản trị nhiệm vụ" của mọi tài khoản** đang giữ (kể cả ủy quyền còn hạn), mỗi tài khoản một dòng nhật ký cấp quyền + nhật ký hệ thống. Sau đó nhập Excel, nhập việc thay mặt lãnh đạo, sửa danh mục lĩnh vực là việc chung của mọi tài khoản trừ Thường trực. Giữ cờ thư ký Thường trực và quản trị hệ thống.
- Edge Function `quan-tri-tai-khoan` được deploy lại cùng lượt (không cấp lại cờ quản trị nhiệm vụ).

## Bước 1 — Kiểm tay trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
0. Tải lại hẳn trang (**Ctrl + F5**) để trình duyệt lấy bản mới; dòng phiên bản ở chân menu phải là bản build ngày 09/10.
1. `demo_cv1`: **Giao việc** → ô **Thay mặt** có, để trống = giao thẳng; chọn "Demo Trưởng phòng" → giao một việc cho chính mình → mở việc: dòng đầu ngăn chi tiết ghi "… bởi Demo Chuyên viên Một", Diễn biến ghi "Nhập bởi Demo Chuyên viên Một"; thẻ việc và tin của `demo_truongphong` không có chữ "thay mặt".
2. `demo_cv1`: Bánh răng → **Danh mục lĩnh vực** mở được; **Nhập từ Excel** có ở màn Giao việc.
3. `demo_qtht`: Quản trị → Tài khoản và cờ: không còn cột / nút "Quản trị KL BTVTU"; không còn thẻ Ủy quyền.

## Bước 2 — Xem trước trên production (chỉ đọc, SQL Editor của project production)
```sql
SELECT count(*) FILTER (WHERE quan_tri_kl OR quan_tri_kl_het_han IS NOT NULL) AS se_thu_co_quan_tri_nv,
       count(*) FILTER (WHERE thu_ky_thuong_truc AND NOT coalesce(bi_khoa, false)) AS thu_ky_tt_dang_hoat_dong
FROM accounts WHERE NOT is_system;
```
`thu_ky_tt_dang_hoat_dong` nên ≥ 1: từ v3.21, xem lại kết quả việc Thường trực giao Chánh Văn phòng chỉ còn thư ký Thường trực (không còn người dự phòng giữ quyền quản trị nhiệm vụ).

## Bước 3 — Phát hành (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên: **"Đồng ý áp migration 0095–0099 lên production"**.
2. PR `release/v3.21.0` xanh đủ check. Gắn tag lên **đầu nhánh phát hành**:
   ```
   git fetch origin && git checkout release/v3.21.0 && git pull
   git tag v3.21.0 && git push origin v3.21.0
   ```
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt; theo dõi đến smoke xanh và tag `production`.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.21.0`; báo Claude merge PR phát hành bằng merge commit.

## Bước 4 — Cấu hình production
Muốn chuyên viên có **Tổng quan phòng** / **Nhiệm vụ của phòng** (chỉ xem): Quản trị → Ngưỡng cảnh báo → `pham_vi_chuyen_vien` = **2** (ghi lý do). Mặc định 1 = chuyên viên chỉ thấy việc của mình (chủ trì, theo dõi, đã giao, đã nhập).

## Bước 5 — Hướng dẫn sử dụng
Bản **HDSD v3.21** (59 trang, PDF + DOCX) dựng từ `docs/huong-dan-su-dung/` (không commit tệp dựng): 1.3 (bảng vai trò — bỏ dòng "Cán bộ tổng hợp"), 2 (bánh răng có Danh mục lĩnh vực), 3.11, 4.6, Phần 7 (nhập Excel, 7.7 nhập việc thay mặt), Phần 8, Phần 9; ảnh `a3-11-giao-viec`, `qt-02-tai-khoan` chụp lại.
