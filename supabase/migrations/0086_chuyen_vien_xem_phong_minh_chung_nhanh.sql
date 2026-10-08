-- 0086 (Đợt C1 v3.19 — quyết định 8/10/2026 sau rà soát bản MVP của Phòng Tổng hợp): chuyên viên xem cả phòng theo cấu hình; minh chứng nhanh.
-- 1. kl_cau_hinh 'pham_vi_chuyen_vien': 1 = chuyên viên chỉ thấy việc mình chủ trì / theo dõi / đã giao (mặc định, quy tắc 7 CLAUDE.md); 2 = thấy
--    thêm MỌI việc của phòng mình — cùng quy tắc đọc của Trưởng phòng (phòng của người theo dõi hoặc phòng Owner) — CHỈ XEM: mọi hàm ghi
--    (cập nhật, nộp minh chứng, từ chối, chỉ đạo, nghiệm thu) vẫn kiểm Owner / người theo dõi / vai như cũ. Hai nguồn phạm vi đổi cùng nhau:
--    kl_pham_vi (vị từ từng dòng — kl_thay_nhiem_vu, RPC) và kl_nhiem_vu_thay_duoc (tập id — policy 0049); chuẩn đối chiếu kl_tham_chieu_pham_vi
--    suy từ kl_pham_vi nên tự theo. Đổi qua qt_dat_cau_hinh (Quản trị → Ngưỡng cảnh báo); staging bật 2 để kiểm, production do chủ dự án bật.
-- 2. nop_minh_chung (0046): trích yếu + mô tả kết quả thành tuỳ chọn, cấp nhận để trống = cấp nhận sản phẩm của việc — "minh chứng nhanh"
--    (số hiệu + ngày) trong một form cập nhật; bốn yếu tố vẫn ghi được đủ khi có.

INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('pham_vi_chuyen_vien', '1', 'Phạm vi xem của chuyên viên: 1 = chỉ việc mình chủ trì / theo dõi / đã giao; 2 = xem thêm mọi việc của phòng mình (chỉ xem — quyền ghi không đổi; có thêm Tổng quan phòng, Nhiệm vụ của phòng) (v3.19)')
ON CONFLICT ("khoa") DO NOTHING;

CREATE OR REPLACE FUNCTION "public"."kl_chuyen_vien_xem_phong"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT "gia_tri" = '2' FROM "public"."kl_cau_hinh" WHERE "khoa" = 'pham_vi_chuyen_vien'), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_chuyen_vien_xem_phong"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_chuyen_vien_xem_phong"() TO "authenticated";

-- Vị từ từng dòng (0030 nguyên văn + nhánh A3).
CREATE OR REPLACE FUNCTION "public"."kl_pham_vi"("p_nguoi_theo_doi" uuid, "p_nganh_ma" text, "p_linh_vuc_ma" text,
                                                  "p_owner_tai_khoan" uuid, "p_owner_don_vi_ma" text) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    "public"."me_quan_tri_kl"()
    OR "p_nguoi_theo_doi" = "auth"."uid"() OR "p_owner_tai_khoan" = "auth"."uid"()
    OR CASE "public"."me_role"()
         WHEN 'A0' THEN true
         WHEN 'A1' THEN "public"."me_is_chief"()
                        OR "public"."kl_pham_vi_pcvp"((SELECT "department" FROM "public"."accounts" WHERE "id" = "p_nguoi_theo_doi"), "p_nganh_ma", "p_linh_vuc_ma")
                        OR "public"."kl_pham_vi_pcvp"("public"."kl_phong_owner"("p_owner_tai_khoan", "p_owner_don_vi_ma"), "p_nganh_ma", "p_linh_vuc_ma")
         WHEN 'A2' THEN "public"."in_my_dept"("p_nguoi_theo_doi")
                        OR "public"."kl_phong_owner"("p_owner_tai_khoan", "p_owner_don_vi_ma") = "public"."me_dept"()
         WHEN 'A3' THEN "public"."kl_chuyen_vien_xem_phong"()   -- 0086: cấu hình 2 — cả phòng, quy tắc như Trưởng phòng
                        AND ("public"."in_my_dept"("p_nguoi_theo_doi") OR "public"."kl_phong_owner"("p_owner_tai_khoan", "p_owner_don_vi_ma") = "public"."me_dept"())
         ELSE false END
  );
$$;

-- Tập id (0083 nguyên văn + nhánh A3 theo cấu hình).
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_thay_duoc"("p_ca_thu_ky" boolean DEFAULT true) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 300 AS $$
  WITH me AS (
    SELECT a."id", a."role_group", a."department",
           coalesce(a."is_chief" AND a."role_group" = 'A1', false) AS chief,
           coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AS qtkl,
           coalesce(a."thu_ky_thuong_truc", false) AS thu_ky
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  ), ca_phong AS (   -- phu_trach(tôi, phòng, hôm nay) cho A1 không phải Chánh VP: phân công cả phòng (nganh_ma NULL) đang hiệu lực
    SELECT p."phong" FROM "public"."phu_trach_phong" p
    WHERE p."lanh_dao_id" = "auth"."uid"() AND p."nganh_ma" IS NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), kn AS (         -- nguoi_kiem_nhiem(phòng, ngành, lĩnh vực, hôm nay) của MỌI người
    SELECT p."phong", p."nganh_ma", p."linh_vuc_ma", p."lanh_dao_id" FROM "public"."phu_trach_phong" p
    WHERE p."nganh_ma" IS NOT NULL AND p."linh_vuc_ma" IS NOT NULL AND p."lanh_dao_id" IS NOT NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), nv AS (
    SELECT n."id", n."nguoi_theo_doi", n."owner_tai_khoan", n."nganh_ma", n."linh_vuc_ma",
           td."department" AS phong_theo_doi, coalesce(oa."department", dv."phong") AS phong_owner   -- kl_phong_owner
    FROM "public"."nhiem_vu" n
    LEFT JOIN "public"."accounts" td ON td."id" = n."nguoi_theo_doi"
    LEFT JOIN "public"."accounts" oa ON oa."id" = n."owner_tai_khoan"
    LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = n."owner_don_vi_ma"
  )
  -- Ba nhánh UNION ALL (IN không cần khử trùng). Nhánh 1: người theo dõi / Owner — tra index, đủ cho A3 thường (đa số tài khoản; kiểm RLS
  -- của Realtime mỗi thay đổi chạy cho từng người). Nhánh 2, 3 có điều kiện chỉ đọc "me" ⇒ initplan, bị bỏ qua cả nhánh khi vai không cần.
  -- 0086: A3 chỉ vào nhánh 2 khi kl_cau_hinh.pham_vi_chuyen_vien = 2 (chuyên viên xem cả phòng, chỉ xem).
  SELECT n."id" FROM "public"."nhiem_vu" n
  WHERE n."nguoi_theo_doi" = "auth"."uid"() OR n."owner_tai_khoan" = "auth"."uid"()
  UNION ALL
  SELECT nv."id"
  FROM nv
  CROSS JOIN me
  LEFT JOIN kn k1 ON k1."phong" = nv.phong_theo_doi AND k1."nganh_ma" = nv."nganh_ma" AND k1."linh_vuc_ma" = nv."linh_vuc_ma"
  LEFT JOIN kn k2 ON k2."phong" = nv.phong_owner AND k2."nganh_ma" = nv."nganh_ma" AND k2."linh_vuc_ma" = nv."linh_vuc_ma"
  WHERE (SELECT m.qtkl OR m."role_group" IN ('A0', 'A1', 'A2') OR (m."role_group" = 'A3' AND "public"."kl_chuyen_vien_xem_phong"()) FROM me m)   -- 0086
    AND (me.qtkl
      OR CASE me."role_group"
           WHEN 'A0' THEN true
           WHEN 'A1' THEN me.chief
             OR (nv.phong_theo_doi IS NOT NULL AND CASE WHEN k1."lanh_dao_id" IS NOT NULL THEN k1."lanh_dao_id" = "auth"."uid"()
                                                       ELSE nv.phong_theo_doi IN (SELECT c."phong" FROM ca_phong c) END)
             OR (nv.phong_owner IS NOT NULL AND CASE WHEN k2."lanh_dao_id" IS NOT NULL THEN k2."lanh_dao_id" = "auth"."uid"()
                                                    ELSE nv.phong_owner IN (SELECT c."phong" FROM ca_phong c) END)
           WHEN 'A2' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"
           WHEN 'A3' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"   -- 0086: cấu hình 2 — chuyên viên xem cả phòng (quy tắc Trưởng phòng)
           ELSE false END)
  UNION ALL
  SELECT c."nhiem_vu_id" FROM "public"."chi_dao" c   -- thư ký Thường trực (0047): việc có ≥ 1 CHI_DAO_TT
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND c."loai" = 'CHI_DAO_TT'
  UNION ALL
  SELECT n."id" FROM "public"."nhiem_vu" n   -- 0057 (Q8): thư ký thấy việc Thường trực giao cho Chánh VP (A0, hoặc thay mặt Thường trực — 0083) để nghiệm thu thay mặt
  JOIN "public"."accounts" o ON o."id" = n."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief"
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND "public"."kl_viec_a0_giao_cvp"(n);
$$;

-- Minh chứng nhanh (0046 nguyên văn + hai dòng 0086).
CREATE OR REPLACE FUNCTION "public"."nop_minh_chung"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_id uuid; v_loi text;
        v_so text := nullif(btrim(coalesce("p" ->> 'so_hieu', '')), ''); v_ngay date := nullif("p" ->> 'ngay_van_ban', '')::date;
        v_cap text := nullif(btrim(coalesce("p" ->> 'cap_nhan', '')), ''); v_cap_ten text;
        v_trich_yeu text := nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), ''); v_mo_ta text := nullif(btrim(coalesce("p" ->> 'mo_ta_ket_qua', '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  v_cap := coalesce(v_cap, v_nv."cap_nhan_san_pham");   -- 0086: minh chứng nhanh — cấp nhận để trống = cấp nhận sản phẩm ghi khi giao
  IF v_so IS NULL OR v_ngay IS NULL OR v_cap IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải có số hiệu và ngày văn bản (cấp nhận lấy theo việc nếu để trống).' USING ERRCODE = '22023';
  END IF;
  -- 0086 (Đợt C1): trích yếu và mô tả kết quả không còn bắt buộc (quyết định 8/10/2026 — một form cập nhật, nhập tối thiểu số hiệu + ngày).
  IF char_length(v_mo_ta) > 600 THEN RAISE EXCEPTION 'Mô tả kết quả tối đa 600 ký tự.' USING ERRCODE = '22023'; END IF;
  SELECT "ten" INTO v_cap_ten FROM "public"."dm_cap" WHERE "ma" = v_cap;
  IF v_cap_ten IS NULL THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi")
  VALUES (v_nv."id", 'so_hieu', v_so, v_ngay, v_cap, v_trich_yeu, v_mo_ta, "auth"."uid"()) RETURNING "id" INTO v_id;
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_nop',
    format('Nộp minh chứng · %s: số %s%s (ngày %s, %s)', v_nv."ma", v_so, coalesce(' · ' || v_trich_yeu, ''), to_char(v_ngay, 'DD/MM/YYYY'), v_cap_ten));
  RETURN v_id;
END;
$$;
