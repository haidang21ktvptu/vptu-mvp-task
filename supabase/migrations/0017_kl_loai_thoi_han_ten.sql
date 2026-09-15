-- GĐ8 (PR 8B) — Đính chính tên danh mục loại thời hạn cho đúng NGUYÊN VĂN chuỗi trong sheet DanhMuc của file
-- Excel gốc (0014 ghi "Ký ban hành (10 ngày)"; sheet và 25 dòng dữ liệu dùng "Ký ban hành (trong 10 ngày)").
-- Script nhập scripts/nhap-kl-btvtu.mjs đối chiếu danh mục từng ký tự, không dùng bí danh — nên sửa ở danh mục.
UPDATE "public"."dm_loai_thoi_han" SET "ten" = 'Ký ban hành (trong 10 ngày)' WHERE "ma" = 'KY_BAN_HANH';
