-- 0038 — GĐ22 (sửa 0036 sau khi đã push staging): chi_dao_ghi_vet bản mảng lọc A0 khỏi CẢ danh sách p_them, làm Thường trực mở luồng Y_KIEN
-- không còn nhận tin phản hồi (0030 mục 6: người mở luồng gốc luôn nhận tin qua p_them). Sửa: chỉ nguoi_lien_quan tự loại A0; p_them ghi
-- đích danh (A0 mở luồng, cấp trên trực tiếp của người nhận với Thượng khẩn/Hỏa tốc — kể cả khi cấp trên đó là Thường trực).
CREATE OR REPLACE FUNCTION "public"."chi_dao_ghi_vet"("p_nhiem_vu" uuid, "p_loai" text, "p_noi_dung" text, "p_them" uuid[]) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ma text; v_tin text;
BEGIN
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  v_tin := format('%s · %s: %s', "public"."chi_dao_ten_loai"("p_loai"), v_ma, left(btrim("p_noi_dung"), 120));
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES ("p_nhiem_vu", "auth"."uid"(), 'chi_dao', v_tin, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT "auth"."uid"(), t.u, v_tin, false, 'he_thong', "p_nhiem_vu"
  FROM (SELECT "public"."nguoi_lien_quan"("p_nhiem_vu") AS u UNION SELECT unnest(coalesce("p_them", '{}'))) t JOIN "public"."accounts" a ON a."id" = t.u
  WHERE t.u <> "auth"."uid"() AND NOT a."is_system";
END;
$$;
