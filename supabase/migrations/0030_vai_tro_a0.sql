-- 0030 — GĐ18 (PR 18A): vai trò A0 "Thường trực Tỉnh ủy" (CH-11 = A; SPEC mục 2, CB-5): 3 tài khoản thật do chủ dự án tạo
-- bằng script có vết (staging chỉ seed demo_a0). A0 ĐỌC toàn bộ nhiệm vụ (ngoại lệ + tổng quan, mọi mức) và chỉ GHI được chỉ đạo
-- loại Y_KIEN. Nguyên tắc: kl_pham_vi mở đọc cho A0; mọi hàm ghi liệt kê vai được phép tường minh (allowlist) và loại A0 rõ
-- ràng — không suy quyền ghi từ hàm phạm vi đọc. Tin hệ thống: A0 không nằm trong nguoi_lien_quan; chỉ nhận phản hồi vào luồng
-- Y_KIEN do chính mình mở (chi_dao_phan_hoi truyền người mở luồng làm p_them). Cảnh báo Đỏ đặc biệt (0029) vốn không gửi A0.

-- 1. role_group thêm A0.
ALTER TABLE "public"."accounts" DROP CONSTRAINT "accounts_role_group_check";
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_role_group_check"
  CHECK ("role_group" = ANY (ARRAY['A0'::text, 'A1'::text, 'A2'::text, 'A3'::text]));

CREATE FUNCTION "public"."me_la_a0"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "public"."me_role"() = 'A0';
$$;
REVOKE ALL ON FUNCTION "public"."me_la_a0"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."me_la_a0"() TO "authenticated";

-- 2. Phạm vi ĐỌC (0025): A0 thấy mọi nhiệm vụ → kéo theo policy đọc nhiem_vu, van_ban_giao_viec, chi_dao, lich_su, minh_chung,
--    canh_bao (đều qua kl_pham_vi / kl_thay_nhiem_vu).
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
         ELSE false END
  );
$$;

-- 3. "Lãnh đạo trong phạm vi" được ghi (chỉ đạo, cấp quyết định, xác nhận minh chứng, đóng nhiệm vụ đều gọi hàm này): chỉ A1/A2,
--    loại A0 tường minh — dù A0 thấy mọi việc qua kl_pham_vi.
CREATE OR REPLACE FUNCTION "public"."kl_duoc_chi_dao"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT NOT "public"."me_la_a0"() AND "public"."me_role"() IN ('A1', 'A2') AND "public"."kl_thay_nhiem_vu"("p_nhiem_vu");
$$;

-- 4. Người liên quan (tin hệ thống): loại A0 khỏi mọi nhánh (kể cả nhánh "người đã ra chỉ đạo trên việc").
CREATE OR REPLACE FUNCTION "public"."nguoi_lien_quan"("p_nhiem_vu" uuid) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH nv AS (SELECT n.*, "public"."kl_phong_owner"(n."owner_tai_khoan", n."owner_don_vi_ma") AS phong_owner,
                     (SELECT "department" FROM "public"."accounts" WHERE "id" = n."nguoi_theo_doi") AS phong_theo_doi
              FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"
                AND ("auth"."uid"() IS NULL OR "public"."kl_thay_nhiem_vu"("p_nhiem_vu"))),
  phong AS (SELECT phong_owner AS p FROM nv UNION SELECT phong_theo_doi FROM nv),
  ds AS (
    SELECT "owner_tai_khoan" FROM nv UNION SELECT "nguoi_theo_doi" FROM nv
    UNION SELECT a."id" FROM "public"."accounts" a, phong WHERE a."role_group" = 'A2' AND a."department" = phong.p
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, nv."nganh_ma", nv."linh_vuc_ma") FROM phong, nv
    UNION SELECT a."id" FROM "public"."accounts" a, nv WHERE a."is_chief" AND a."role_group" = 'A1'
    UNION SELECT c."nguoi_gui" FROM "public"."chi_dao" c JOIN nv ON c."nhiem_vu_id" = nv."id")
  SELECT DISTINCT ds."owner_tai_khoan" FROM ds JOIN "public"."accounts" a ON a."id" = ds."owner_tai_khoan"
  WHERE NOT a."is_system" AND a."role_group" <> 'A0' AND ds."owner_tai_khoan" IS DISTINCT FROM "auth"."uid"();
$$;

-- 5. chi_dao_gui (0026): thêm nhánh A0 — chỉ Y_KIEN, trên việc trong phạm vi đọc; mọi loại khác 42501. Thân còn lại giữ nguyên.
CREATE OR REPLACE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_id uuid; v_cu uuid;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = ("p" ->> 'nhiem_vu_id')::uuid;
  IF "public"."me_la_a0"() THEN
    IF v_loai IS DISTINCT FROM 'Y_KIEN' THEN
      RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ ghi ý kiến trên nhiệm vụ, không ra chỉ đạo điều hành.' USING ERRCODE = '42501';
    END IF;
    IF v_nv."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN
      RAISE EXCEPTION 'Không tìm thấy nhiệm vụ.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_nv."id" IS NULL OR NOT "public"."kl_duoc_chi_dao"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc trưởng phòng trong phạm vi mới ra chỉ đạo trên nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  IF v_loai NOT IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN') THEN
    RAISE EXCEPTION 'Loại chỉ đạo không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Chỉ đạo phải có nội dung (lý do).' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_loai IN ('GIA_HAN', 'GIAO_LAI') AND v_nv."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không gia hạn hay giao lại.' USING ERRCODE = '22023';
  END IF;
  IF v_loai = 'GIA_HAN' THEN
    IF v_me."role_group" <> 'A1' AND NOT v_me."quan_tri_kl" AND (v_nv."tao_boi" IS DISTINCT FROM v_me."id"
       OR (SELECT "loai" FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id") IN ('KL_BTV', 'TB_THUONG_TRUC')) THEN
      RAISE EXCEPTION 'Trưởng phòng chỉ gia hạn việc do chính mình giao, không phải việc từ kết luận/thông báo của cấp ủy.' USING ERRCODE = '42501';
    END IF;
    v_han_moi := nullif("p" ->> 'han_moi', '')::date;
    IF v_nv."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Việc chưa có hạn thì điền hạn ở Cập nhật, không gia hạn.' USING ERRCODE = '22023'; END IF;
    IF v_han_moi IS NULL OR v_han_moi <= v_nv."han_xu_ly" THEN
      RAISE EXCEPTION 'Gia hạn phải có hạn mới sau hạn hiện tại (%).', to_char(v_nv."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  ELSIF v_loai = 'GIAO_LAI' THEN
    SELECT * INTO v_moi FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'nguoi_theo_doi_moi', '')::uuid;
    IF v_moi."id" IS NULL OR v_moi."is_system" OR v_moi."id" = v_nv."nguoi_theo_doi" THEN
      RAISE EXCEPTION 'Giao lại phải chọn một người theo dõi mới khác người hiện tại.' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_me."quan_tri_kl" OR v_me."is_chief"
            OR (v_me."role_group" = 'A2' AND v_moi."department" = v_me."department")
            OR (v_me."role_group" = 'A1' AND "public"."phu_trach"(v_me."id", v_moi."department", "public"."kl_hom_nay"()))) THEN
      RAISE EXCEPTION 'Người theo dõi mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    v_cu := v_nv."nguoi_theo_doi";
  END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "han_phan_hoi", "han_moi", "chu_tri_moi", "trang_thai")
  VALUES (v_nv."id", v_me."id", v_loai, v_noi_dung, nullif("p" ->> 'han_phan_hoi', '')::date, v_han_moi, v_moi."id",
          CASE WHEN v_loai = 'Y_KIEN' THEN 'DA_PHAN_HOI' ELSE 'CHO_PHAN_HOI' END)
  RETURNING "id" INTO v_id;
  PERFORM set_config('kl.chi_dao', '1', true);
  IF v_loai = 'GIA_HAN' THEN
    UPDATE "public"."nhiem_vu" SET "han_xu_ly" = v_han_moi, "so_lan_gia_han" = "so_lan_gia_han" + 1,
      "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END WHERE "id" = v_nv."id";
  ELSIF v_loai = 'GIAO_LAI' THEN
    UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_moi."id" WHERE "id" = v_nv."id";
  END IF;
  PERFORM set_config('kl.chi_dao', '', true);
  PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), v_noi_dung) ELSE v_noi_dung END, v_cu);
  RETURN v_id;
END;
$$;

-- 6. chi_dao_phan_hoi (0026): A0 bị chặn tường minh (kể cả trong luồng mình mở); người mở luồng gốc luôn nhận tin phản hồi
--    (p_them) — với A0 đây là tin hệ thống duy nhất họ nhận.
CREATE OR REPLACE FUNCTION "public"."chi_dao_phan_hoi"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_goc "public"."chi_dao"; v_nv "public"."nhiem_vu"; v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_id uuid;
BEGIN
  IF "public"."me_la_a0"() THEN
    RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ ghi ý kiến, không phản hồi chỉ đạo.' USING ERRCODE = '42501';
  END IF;
  SELECT g.* INTO v_goc FROM "public"."chi_dao" c JOIN "public"."chi_dao" g ON g."id" = coalesce(c."tra_loi_cho", c."id")
  WHERE c."id" = ("p" ->> 'chi_dao_id')::uuid;
  IF v_goc."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_goc."nhiem_vu_id") THEN
    RAISE EXCEPTION 'Không tìm thấy chỉ đạo trong phạm vi của đồng chí.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_goc."nhiem_vu_id";
  IF NOT (coalesce("auth"."uid"() = v_nv."owner_tai_khoan", false) OR "auth"."uid"() = v_nv."nguoi_theo_doi"
          OR EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nguoi_gui" = "auth"."uid"() AND (c."id" = v_goc."id" OR c."tra_loi_cho" = v_goc."id"))) THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi hoặc người đã tham gia luồng mới phản hồi chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v_goc."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo đã đóng, không phản hồi thêm.' USING ERRCODE = '22023'; END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Phản hồi phải có nội dung.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "tra_loi_cho", "trang_thai")
  VALUES (v_goc."nhiem_vu_id", "auth"."uid"(), 'PHAN_HOI', v_noi_dung, v_goc."id", 'DA_DONG') RETURNING "id" INTO v_id;
  UPDATE "public"."chi_dao" SET "phan_hoi" = v_noi_dung, "phan_hoi_boi" = "auth"."uid"(), "phan_hoi_luc" = now(),
    "trang_thai" = CASE WHEN "nguoi_gui" <> "auth"."uid"() THEN 'DA_PHAN_HOI' ELSE "trang_thai" END WHERE "id" = v_goc."id";
  PERFORM "public"."chi_dao_ghi_vet"(v_goc."nhiem_vu_id", 'PHAN_HOI', v_noi_dung, v_goc."nguoi_gui");
  RETURN v_id;
END;
$$;

-- 7. chi_dao_dong (0026): A0 không đóng được, kể cả ý kiến do mình ghi (chỉ đọc + ghi Y_KIEN).
CREATE OR REPLACE FUNCTION "public"."chi_dao_dong"("p_id" uuid) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."chi_dao";
BEGIN
  IF "public"."me_la_a0"() THEN
    RAISE EXCEPTION 'Thường trực Tỉnh ủy không đóng chỉ đạo.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM "public"."chi_dao" WHERE "id" = "p_id" AND "tra_loi_cho" IS NULL;
  IF v."id" IS NULL OR NOT (v."nguoi_gui" = "auth"."uid"() OR "public"."me_quan_tri_kl"()) THEN
    RAISE EXCEPTION 'Chỉ người ra chỉ đạo mới đóng được chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo này đã đóng.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."chi_dao" SET "trang_thai" = 'DA_DONG' WHERE "id" = "p_id";
  PERFORM "public"."chi_dao_ghi_vet"(v."nhiem_vu_id", 'DONG', v."noi_dung");
END;
$$;

-- 8. Nhắn tin 1-1 (0008): A0 không gửi tin (chỉ đọc + Y_KIEN); tin hệ thống vẫn tới A0 qua hàm SECURITY DEFINER (chi_dao_ghi_vet).
DROP POLICY "messages_insert" ON "public"."direct_messages";
CREATE POLICY "messages_insert" ON "public"."direct_messages"
  FOR INSERT TO "authenticated" WITH CHECK ("sender_id" = "auth"."uid"() AND NOT "public"."me_la_a0"());
