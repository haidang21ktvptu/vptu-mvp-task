-- GĐ15 (PR 15D) — Sửa mặc định cột nhiem_vu.ma: 0014 dùng ('NV-' || lpad(nextval::text, 3, '0')), mà lpad CẮT chuỗi dài hơn
-- 3 ký tự → khi sequence vượt 999, mã sinh ra là NV-100, NV-101… trùng dòng cũ (UNIQUE kl_nhiem_vu_ma_key) và mọi lần tạo
-- nhiệm vụ mới đều lỗi. Phát hiện 16/9 khi CI e2e đỏ trên staging: sequence staging = 1001 (mỗi lần test, kể cả chèn lỗi, tiêu
-- một số; đã setval về 185 để test tiếp), production = 185 (còn 814 số) — sửa trước khi production tới ngưỡng.
-- Cách sửa: hàm sinh mã không cắt (đệm tới ít nhất 3 chữ số, dài hơn thì giữ nguyên: NV-186 … NV-999, NV-1000, NV-1001 …);
-- DEFAULT không nhận subquery nên đặt trong hàm. Không đổi mã đã có, không đổi sequence.
CREATE FUNCTION "public"."nhiem_vu_ma_moi"() RETURNS text
LANGUAGE "sql" VOLATILE SET "search_path" = "public" AS $$
  SELECT 'NV-' || lpad(v, greatest(3, length(v)), '0') FROM (SELECT nextval('public.nhiem_vu_ma_seq')::text AS v) s;
$$;
REVOKE ALL ON FUNCTION "public"."nhiem_vu_ma_moi"() FROM public, anon;
GRANT EXECUTE ON FUNCTION "public"."nhiem_vu_ma_moi"() TO authenticated;   -- người có quyền INSERT (quan_tri_kl, hàm giao_viec) dùng DEFAULT
ALTER TABLE "public"."nhiem_vu" ALTER COLUMN "ma" SET DEFAULT "public"."nhiem_vu_ma_moi"();
