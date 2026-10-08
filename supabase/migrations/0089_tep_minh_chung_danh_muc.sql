-- 0089 (Đợt D v3.20 — chủ dự án duyệt 8/10/2026): tệp minh chứng, cấu hình "Minh chứng phải kèm tệp", danh mục sản phẩm mở rộng.
-- 1. Kho tệp riêng tư "minh-chung" (≤ 10 MB; PDF, Word, Excel, ảnh). Đường dẫn = <id nhiệm vụ>/<tên ngẫu nhiên>. Policy storage.objects:
--    ĐỌC — ai thấy nhiệm vụ (kl_thay_nhiem_vu, cùng phạm vi với bảng minh_chung); TẢI LÊN — ai được nộp minh chứng cho nhiệm vụ
--    (kl_duoc_nop_minh_chung, cùng hàm với nop_minh_chung ở 0090); XOÁ — chính người tải lên khi tệp chưa gắn vào minh chứng nào (giao diện dọn
--    tệp khi nộp lỗi). Không có UPDATE: tệp đã nộp không bị ghi đè; minh chứng bị trả lại giữ tệp làm vết. ĐỌC dùng đúng phạm vi của bảng
--    minh_chung (kl_xem_tat_ca / kl_nhiem_vu_thay_duoc(true) — gồm thư ký Thường trực ở việc Thường trực giao Chánh VP). Một tệp gắn một minh chứng
--    (chỉ mục duy nhất tep_path).
-- 2. Ai được nộp minh chứng (định hướng 8/10/2026 — lãnh đạo chỉ theo dõi, chuyên viên nhập liệu; lãnh đạo LÀM ĐƯỢC mọi việc của chuyên viên
--    trong phạm vi nhưng không bắt buộc): Owner, người theo dõi, người tạo việc còn thấy việc (chuyên viên nhập / giao — nộp thay khi Owner là
--    lãnh đạo; người gõ thay đã hết quyền quản trị thì thôi), lãnh đạo (A0 / A1 / A2) và quản trị nhiệm vụ còn hạn trong phạm vi việc.
-- 3. kl_cau_hinh 'minh_chung_bat_buoc_tep': 1 = tệp tuỳ chọn (mặc định); 2 = nộp minh chứng phải kèm tệp (NT-4 Công văn 1400).
-- 4. dm_san_pham thêm Đề án, Chương trình, Thông báo, Hướng dẫn, Quy chế / Quy định; "Khác" xuống cuối. Danh mục đọc qua kl_danh_muc nên
--    biểu mẫu, bộ lọc, nhập Excel (khớp theo tên) nhận ngay.

-- ---- 2. Quyền nộp minh chứng (dùng chung: policy tệp, nop_minh_chung, gan_tep_minh_chung) ----
CREATE OR REPLACE FUNCTION "public"."kl_duoc_nop_minh_chung"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT "auth"."uid"() IS NOT NULL AND (
      n."owner_tai_khoan" = "auth"."uid"() OR n."nguoi_theo_doi" = "auth"."uid"()
      OR ((n."tao_boi" = "auth"."uid"() OR "public"."me_role"() IN ('A0', 'A1', 'A2') OR "public"."me_quan_tri_kl"()) AND "public"."kl_thay_nhiem_vu"(n."id")))
    FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_duoc_nop_minh_chung"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_duoc_nop_minh_chung"(uuid) TO "authenticated";

-- Thư mục đầu của đường dẫn tệp = id nhiệm vụ; tên không đúng mẫu uuid → NULL (policy trả false, không lỗi ép kiểu).
CREATE OR REPLACE FUNCTION "public"."kl_tep_mc_nhiem_vu"("p_ten" text) RETURNS uuid
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN split_part("p_ten", '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              AND split_part("p_ten", '/', 2) <> '' AND split_part("p_ten", '/', 3) = '' THEN split_part("p_ten", '/', 1)::uuid END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_tep_mc_nhiem_vu"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_tep_mc_nhiem_vu"(text) TO "authenticated";

-- ---- 1. Kho tệp + policy ----
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('minh-chung', 'minh-chung', false, 10485760, ARRAY['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/jpeg', 'image/png'])
ON CONFLICT ("id") DO UPDATE SET "public" = false, "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types";

-- Tệp đã gắn vào minh chứng chưa (đọc bảng minh_chung không qua RLS của người gọi — policy xoá).
CREATE OR REPLACE FUNCTION "public"."kl_tep_mc_da_gan"("p_ten" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."tep_path" = "p_ten");
$$;
REVOKE ALL ON FUNCTION "public"."kl_tep_mc_da_gan"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_tep_mc_da_gan"(text) TO "authenticated";
CREATE UNIQUE INDEX IF NOT EXISTS "minh_chung_tep_path_key" ON "public"."minh_chung" ("tep_path") WHERE "tep_path" IS NOT NULL;

CREATE POLICY "minh_chung_tep_doc" ON "storage"."objects" FOR SELECT TO "authenticated"
  USING ("bucket_id" = 'minh-chung' AND ((SELECT "public"."kl_xem_tat_ca"())
         OR "public"."kl_tep_mc_nhiem_vu"("name") IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true))));
CREATE POLICY "minh_chung_tep_tai_len" ON "storage"."objects" FOR INSERT TO "authenticated"
  WITH CHECK ("bucket_id" = 'minh-chung' AND "public"."kl_duoc_nop_minh_chung"("public"."kl_tep_mc_nhiem_vu"("name")));
CREATE POLICY "minh_chung_tep_xoa" ON "storage"."objects" FOR DELETE TO "authenticated"
  USING ("bucket_id" = 'minh-chung' AND "owner_id" = (SELECT "auth"."uid"())::text AND NOT "public"."kl_tep_mc_da_gan"("objects"."name"));

-- ---- 3. Cấu hình ----
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('minh_chung_bat_buoc_tep', '1', 'Tệp minh chứng: 1 = không bắt buộc (mặc định); 2 = nộp minh chứng phải kèm tệp (PDF, Word, Excel, ảnh; tối đa 10 MB) — NT-4 Công văn 1400 (v3.20)')
ON CONFLICT ("khoa") DO NOTHING;

CREATE OR REPLACE FUNCTION "public"."kl_bat_buoc_tep_mc"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN "gia_tri" ~ '^[0-9]{1,4}$' THEN "gia_tri"::integer END = 2 FROM "public"."kl_cau_hinh" WHERE "khoa" = 'minh_chung_bat_buoc_tep'), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_bat_buoc_tep_mc"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_bat_buoc_tep_mc"() TO "authenticated";

-- ---- 4. Danh mục sản phẩm ----
INSERT INTO "public"."dm_san_pham" ("ma", "ten", "thu_tu") VALUES
  ('DE_AN', 'Đề án', 7), ('CHUONG_TRINH', 'Chương trình', 8), ('THONG_BAO', 'Thông báo', 9), ('HUONG_DAN', 'Hướng dẫn', 10),
  ('QUY_CHE', 'Quy chế / Quy định', 11)
ON CONFLICT ("ma") DO NOTHING;
UPDATE "public"."dm_san_pham" SET "thu_tu" = 99 WHERE "ma" = 'KHAC';
