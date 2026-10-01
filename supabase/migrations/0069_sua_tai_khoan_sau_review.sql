-- 0069 — PR-4 sau /code-review (0068 đã áp staging nên sửa bằng migration mới):
-- 1. admin_sua_tai_khoan: rời A1 còn bị chặn khi tài khoản đang là lãnh đạo phụ trách đơn vị ngoài (dm_don_vi.lanh_dao_phu_trach, CH-4b) —
--    nếu không, người đã xuống A2/A3 vẫn nhận chỉ đạo Thường trực (0032) và cảnh báo Đỏ (0029/0036) của đơn vị đó. Phần còn lại giữ nguyên 0068.
-- 2. tin_tom_tat_sang: khoá tư vấn theo giao dịch để hai lượt gọi chồng nhau (curl --retry khi lượt đầu còn chạy trên máy chủ) chạy nối tiếp;
--    lượt sau thấy bản tin lượt trước đã ghi nên không gửi trùng. Phần còn lại giữ nguyên 0068.
CREATE OR REPLACE FUNCTION "public"."admin_sua_tai_khoan"("p_username" text, "p_role_group" text, "p_department" text, "p_position_title" text, "p_ly_do" text)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  v_ghi_chu text; v "public"."accounts"; v_ten text; v_ten_phong text;
  v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
  v_vai text := btrim(coalesce("p_role_group", ''));
  v_phong text := nullif(btrim(coalesce("p_department", '')), '');
  v_cd text := btrim(coalesce("p_position_title", ''));
  r record; v_cu jsonb := '{}'::jsonb; v_moi jsonb := '{}'::jsonb;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi"();
  IF v_ly_do IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do sửa tài khoản.' USING ERRCODE = '22023';
  END IF;
  IF v_vai NOT IN ('A0', 'A1', 'A2', 'A3') THEN
    RAISE EXCEPTION 'Vai trò "%" không hợp lệ (chỉ A0, A1, A2, A3).', v_vai USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM "public"."accounts" WHERE "username" = "p_username" FOR UPDATE;
  IF v."id" IS NULL THEN
    RAISE EXCEPTION 'Không có tài khoản "%".', "p_username" USING ERRCODE = '22023';
  END IF;
  IF v."is_system" THEN
    RAISE EXCEPTION 'Không sửa tài khoản hệ thống "%".', "p_username" USING ERRCODE = '42501';
  END IF;

  -- Phòng theo vai.
  IF v_vai = 'A0' THEN v_phong := NULL;
  ELSIF v_vai = 'A1' THEN v_phong := 'LANH_DAO_VAN_PHONG';
  ELSIF v_phong IS NULL OR NOT EXISTS (SELECT 1 FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" = v_phong) THEN
    RAISE EXCEPTION 'Phòng "%" không thuộc danh sách phòng chuyên môn của Văn phòng.', coalesce(v_phong, '(trống)') USING ERRCODE = '22023';
  END IF;

  IF v_vai <> v."role_group" THEN
    IF v."id" = "auth"."uid"() THEN
      RAISE EXCEPTION 'Không tự đổi vai trò của chính mình — nhờ một người quản trị hệ thống khác thực hiện.' USING ERRCODE = '42501';
    END IF;
    IF v."is_chief" THEN
      RAISE EXCEPTION 'Không đổi vai trò tài khoản Chánh Văn phòng qua màn hình này (chỉ sửa chức danh).' USING ERRCODE = '22023';
    END IF;
    IF v."role_group" = 'A1' AND EXISTS (SELECT 1 FROM "public"."phu_trach_phong" p WHERE p."lanh_dao_id" = v."id"
                                           AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())) THEN
      RAISE EXCEPTION 'Tài khoản còn phân công phụ trách phòng hoặc kiêm nhiệm lĩnh vực đang hiệu lực — kết thúc ở bảng Phân công trước.' USING ERRCODE = '22023';
    END IF;
    IF v."role_group" = 'A1' THEN
      SELECT "ten" INTO v_ten FROM "public"."dm_don_vi" WHERE "lanh_dao_phu_trach" = v."id" ORDER BY "thu_tu" LIMIT 1;
      IF v_ten IS NOT NULL THEN
        RAISE EXCEPTION 'Tài khoản đang là lãnh đạo phụ trách đơn vị "%" (danh mục đơn vị) — đổi lãnh đạo phụ trách đơn vị trước.', v_ten USING ERRCODE = '22023';
      END IF;
    END IF;
    IF v_vai = 'A0' AND (v."quan_tri_kl" OR v."thu_ky_thuong_truc") THEN
      RAISE EXCEPTION 'Tài khoản còn quyền quản trị KL BTVTU hoặc thư ký Thường trực — thu quyền trước khi chuyển sang Thường trực Tỉnh ủy (A0).' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Một Trưởng phòng (A2) đang hoạt động mỗi phòng (0045/0052 lấy "A2 của phòng").
  IF v_vai = 'A2' AND (v."role_group" <> 'A2' OR v."department" IS DISTINCT FROM v_phong) THEN
    SELECT "full_name" INTO v_ten FROM "public"."accounts"
    WHERE "role_group" = 'A2' AND "department" = v_phong AND "id" <> v."id" AND NOT "is_system" AND NOT "bi_khoa" ORDER BY "username" LIMIT 1;
    IF v_ten IS NOT NULL THEN
      SELECT "ten" INTO v_ten_phong FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" = v_phong ORDER BY "thu_tu" LIMIT 1;
      RAISE EXCEPTION '% đã có Trưởng phòng (A2) đang hoạt động: %. Mỗi phòng một Trưởng phòng — đổi vai hoặc khoá tài khoản đó trước.',
        coalesce(v_ten_phong, v_phong), v_ten USING ERRCODE = '22023';
    END IF;
  END IF;

  FOR r IN SELECT * FROM (VALUES ('role_group', v."role_group", v_vai), ('department', v."department", v_phong),
                                 ('position_title', v."position_title", v_cd)) x("cot", "cu", "moi")
           WHERE x."cu" IS DISTINCT FROM x."moi" LOOP
    INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do", "gia_tri_cu", "gia_tri_moi")
    VALUES ("auth"."uid"(), v_ghi_chu, v."id", 'sua:' || r."cot", true, v_ly_do, r."cu", r."moi");
    v_cu := v_cu || jsonb_build_object(r."cot", r."cu");
    v_moi := v_moi || jsonb_build_object(r."cot", r."moi");
  END LOOP;
  IF v_cu = '{}'::jsonb THEN RETURN; END IF;

  UPDATE "public"."accounts" SET "role_group" = v_vai, "department" = v_phong, "position_title" = v_cd WHERE "id" = v."id";
  INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet")
  VALUES ("auth"."uid"(), 'sua_tai_khoan', "p_username", jsonb_build_object('cu', v_cu, 'moi', v_moi, 'ly_do', v_ly_do, 'ghi_chu', v_ghi_chu));
END;
$$;

CREATE OR REPLACE FUNCTION "public"."tin_tom_tat_sang"() RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  -- Lượt gọi chồng nhau chờ nhau tới hết giao dịch; câu INSERT dưới lấy ảnh dữ liệu mới (READ COMMITTED) nên thấy bản tin lượt trước.
  PERFORM pg_advisory_xact_lock(hashtext('public.tin_tom_tat_sang'));
  PERFORM "public"."uy_quyen_thu_het_han"();
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai")
  SELECT NULL, a."id", format('Bản tin 7h30: %s thông báo chưa đọc trên %s nhiệm vụ trong 24 giờ qua. Mở chuông để xem chi tiết.', count(*), count(DISTINCT d."nhiem_vu_id")), false, 'he_thong'
  FROM "public"."accounts" a JOIN "public"."direct_messages" d ON d."receiver_id" = a."id" AND d."loai" = 'he_thong' AND NOT d."is_read"
       AND d."created_at" >= now() - interval '24 hours' AND d."content" NOT LIKE 'Bản tin 7h30%'
  WHERE coalesce((a."tuy_chon" ->> 'gom_tin')::boolean, false)
    AND NOT EXISTS (SELECT 1 FROM "public"."direct_messages" b
                    WHERE b."receiver_id" = a."id" AND b."loai" = 'he_thong' AND b."sender_id" IS NULL AND b."content" LIKE 'Bản tin 7h30%'
                      AND b."created_at" >= ("public"."kl_hom_nay"()::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  GROUP BY a."id";
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$$;
