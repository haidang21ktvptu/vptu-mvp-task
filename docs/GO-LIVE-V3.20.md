# Danh sách việc đưa v3.20.0 vào dùng chính thức (go-live)

Bản phát hành gộp **v3.20.0** = Đợt B + E (PR #120, migration 0079–0085), Đợt C1 (PR #121, 0086), Đợt C2 (PR #122, 0087–0088), Đợt D (PR #123, 0089–0094) + PR phát hành `release/v3.20.0` (HDSD 3.20). Production hiện chạy `v3.17.0` (0001–0078); staging đã áp 0001–0094.

Mỗi bước dưới đây do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu / khoá service. Làm **lần lượt**, xong bước này mới sang bước sau.

## Bước 1 — Kiểm tay trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
Tài khoản demo (mật khẩu demo của staging). Mỗi dòng là một việc cần thấy đúng:
1. `demo_cv1` (chuyên viên): **Giao việc** → chọn văn bản, thêm 2 thẻ (một giao `demo_cv2`, một "Chính tôi") → Giao 2 việc. Việc tự giao hiện ở Việc của tôi; việc giao `demo_cv2` ở Việc tôi theo dõi.
2. `demo_cv2`: thấy việc mới → **Xác nhận đã nhận việc** → mở việc (gõ mã vào ô tìm nhanh), **Nộp minh chứng** kèm một tệp PDF có chữ (tệp thử, không phải văn bản thật) → hệ thống điền sẵn số hiệu / ngày / trích yếu → nộp → việc **Hoàn thành** ngay.
3. `demo_cv1`: mở việc vừa hoàn thành → thấy tệp (bấm tên tệp mở được) → **Trả lại** có lý do → việc mở lại; `demo_cv2` thấy "Bị trả lại: …", nộp lại → hoàn thành.
4. `demo_truongphong`: không có mục "Cần nghiệm thu"; Cần xử lý có khối **Kết quả nộp trong 7 ngày** (Đánh giá / Trả lại, không bắt buộc); việc giao cho Trưởng phòng hiện "đã nhận việc" mà không phải bấm.
5. `demo_cv2`: trên một việc `demo_cv1` giao, bấm **Từ chối** có lý do → `demo_cv1` thấy khối "Đề nghị từ chối nhận việc, cần đồng chí duyệt" → Không đồng ý.
6. `demo_cv1`: trên việc mình giao, khối **Chỉ đạo** → Đôn đốc / Gia hạn được (việc không phải từ KL BTV / TB Thường trực).
7. `demo_qtht`: Quản trị → Tài khoản và cờ → **Chuyển việc theo dõi** của một tài khoản demo → chọn người nhận, xem số việc sẽ chuyển → Huỷ (không cần chuyển thật).
8. `demo_cvp`: Tổng quan có thanh lọc, KPI theo cán bộ; Quản trị → Ngưỡng cảnh báo có khoá `minh_chung_bat_buoc_tep` = 1.
9. Điện thoại: đăng nhập `demo_cv1`, nộp minh chứng kèm ảnh chụp (tệp ảnh thử).

Gặp lỗi: chụp màn hình kèm dòng phiên bản ở chân menu, gửi Claude — sửa, CI xanh rồi mới sang Bước 2.

## Bước 2 — Xem trước dữ liệu production sẽ đổi (chỉ đọc)
Migration **thay đổi dữ liệu** khi áp:
- **0087**: đánh số thứ tự nhiệm vụ trong từng văn bản (`stt_van_ban`) cho việc đã có.
- **0089**: tạo kho tệp riêng tư `minh-chung`, khoá cấu hình `minh_chung_bat_buoc_tep = 1`, thêm 5 loại sản phẩm.
- **0090** (không hoàn tác được): minh chứng **đang chờ nghiệm thu** (số hiệu / tệp) được coi là **hợp lệ**; việc đang mở có minh chứng vừa chuyển → **Hoàn thành** theo ngày văn bản minh chứng (dòng lệch ngày chỉ báo NOTICE, giữ nguyên); lãnh đạo (A1/A2) là chủ trì / theo dõi việc theo quy tắc 1400 đang mở được ghi "đã nhận" tự động.
- 0079–0086, 0088, 0091–0094: chỉ đổi hàm, quyền, view, cột mới — không đổi dữ liệu cũ.

Trước khi xác nhận, chủ dự án chạy trong **SQL Editor của project production** (chỉ SELECT) để biết số dòng bị ảnh hưởng:
```sql
SELECT count(*) AS minh_chung_cho_se_hop_le
FROM minh_chung WHERE hop_le IS NULL AND loai IN ('so_hieu', 'tep');

SELECT count(DISTINCT m.nhiem_vu_id) AS viec_se_hoan_thanh
FROM minh_chung m JOIN nhiem_vu n ON n.id = m.nhiem_vu_id
WHERE m.hop_le IS NULL AND m.loai = 'so_hieu' AND m.ngay_van_ban IS NOT NULL
  AND n.tien_do_ma <> 'HOAN_THANH' AND n.dong_luc IS NULL;
```

## Bước 3 — Phát hành production (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên một câu xác nhận: **"Đồng ý áp migration 0079–0094 lên production"**.
2. PR phát hành `release/v3.20.0` đã CI xanh đủ check. Chủ dự án gắn tag lên **đầu nhánh phát hành** (không đứng ở `main`):
   ```
   git fetch origin && git checkout release/v3.20.0 && git pull
   git tag v3.20.0 && git push origin v3.20.0
   ```
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt. Theo dõi Summary: "Kiểm tra tag" → "Backup + migration production + build" (backup trước, rồi `db push`) → "Deploy Pages" → smoke (đăng nhập thử, đạt thì gắn tag `production`) đều xanh.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.20.0`. Báo Claude để **merge PR phát hành bằng merge commit**.
5. Sau phát hành, không đẩy thêm commit lên `release/v3.20.0`.

## Bước 4 — Cấu hình production (chủ dự án quyết, đăng nhập tài khoản Chánh Văn phòng / quản trị hệ thống → Quản trị → Ngưỡng cảnh báo; mỗi lần sửa ghi lý do)
| Khoá | Mặc định | Gợi ý khi go-live |
|---|---|---|
| `xac_nhan_nhan_viec` | 1 (chuyên viên tự bấm Đã nhận) | Giữ 1 nếu muốn biết chuyên viên đã nhận; 2 nếu áp luồng chuyên viên giao thẳng, coi như đã nhận khi giao |
| `pham_vi_chuyen_vien` | 1 (chỉ việc của mình) | 2 nếu muốn chuyên viên xem cả phòng (chỉ xem) — theo dõi tải hệ thống vài ngày sau khi bật |
| `minh_chung_bat_buoc_tep` | 1 (tệp không bắt buộc) | 2 khi Văn phòng yêu cầu mọi minh chứng phải kèm tệp |

## Bước 5 — Tài khoản và dữ liệu thật (trên production, không qua kho mã, không đưa lên staging)
1. Quản trị hệ thống rà danh sách tài khoản (họ tên, phòng, vai, chức danh); khoá tài khoản không dùng; **Chuyển việc theo dõi** trước khi khoá người còn việc.
2. Kiểm cờ: quản trị nhiệm vụ (tối đa 2 người), thư ký Thường trực, quản trị hệ thống.
3. Phân công Phó Chánh Văn phòng phụ trách phòng / kiêm nhiệm lĩnh vực; lịch nghỉ lễ năm 2026–2027 ở thẻ Ngày nghỉ.
4. **Bàn giao tài khoản** (Quản trị → Tài khoản → Bàn giao tài khoản…): xuất phiếu / tệp mật khẩu tạm, phát qua kênh riêng, **xoá tệp sau khi phát**. Tệp này không gửi qua chat, không lưu vào kho mã.
5. Cán bộ tổng hợp nhập các bảng theo dõi hiện có bằng **Nhập từ Excel** (mẫu 28 cột hoặc bảng Phụ lục 2) — làm trên production; hoàn tác được trong 24 giờ.

## Bước 6 — Hướng dẫn sử dụng
Bản **HDSD v3.20** (59 trang, PDF + DOCX) dựng từ `docs/huong-dan-su-dung/` (không commit tệp dựng). Chép bản phát hành vào `D:\TU 2026\kiem-thu\huong-dan-su-dung\` và gửi cán bộ; mỗi người đọc Phần 2 và phần của vai mình. Ảnh trong tài liệu chụp từ bộ dựng thử với dữ liệu hư cấu (tên "Demo …").

## Khi có sự cố
- Deploy đỏ ở bước kiểm tra / migration: không merge PR; báo Claude. Bản backup tự động của run nằm trong Summary.
- Sự cố sau phát hành: `docs/xu-ly-su-co.md`; sửa trên nhánh `fix/...`, phát hành tag số mới (`v3.20.1`), không xoá / đổi tag đã đẩy.
