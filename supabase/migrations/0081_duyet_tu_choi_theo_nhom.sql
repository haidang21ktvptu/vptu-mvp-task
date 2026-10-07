-- 0081 (Đợt B v3.18, tiếp 0079–0080): duyệt / thấy đề nghị từ chối, đề nghị sửa, số đếm chờ duyệt, tầng giao — mở rộng cho thành viên nhóm được thay mặt
-- (kl_duoc_duyet_thay, kl_nguoi_duyet_tu_choi của 0079). Thân hàm = bản gần nhất (0035 / 0034 / 0048 / 0070 / 0071) + các dòng ghi "0079".

-- ---- Duyệt / thấy đề nghị từ chối, đề nghị sửa, số đếm, tầng giao, nhắc: mở rộng cho thành viên nhóm ----

CREATE OR REPLACE FUNCTION "public"."de_nghi_tu_choi"("p_nhiem_vu" uuid, "p_ly_do" text) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu"; v_me "public"."accounts"; v_cap "public"."accounts"; v_id uuid; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_me."id" IS NULL OR v_me."role_group" = 'A0' OR v."id" IS NULL OR NOT (v."nguoi_theo_doi" = v_me."id" OR v."owner_tai_khoan" = v_me."id") THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi vừa được giao việc mới đề nghị từ chối.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn từ chối được.' USING ERRCODE = '22023'; END IF;
  IF v."bi_tu_choi" THEN RAISE EXCEPTION 'Việc đã được đồng ý từ chối, đang chờ giao lại.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = v."id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = v_me."id") THEN
    RAISE EXCEPTION 'Đồng chí đã xác nhận nhận việc này, không còn từ chối được.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' THEN RAISE EXCEPTION 'Đề nghị từ chối phải có lý do.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."tu_choi" WHERE "nhiem_vu_id" = v."id" AND "trang_thai" = 'CHO_DUYET') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có đề nghị từ chối đang chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_cap FROM "public"."accounts" WHERE "id" = coalesce(CASE WHEN v."giao_thay_mat_cho" IS DISTINCT FROM v_me."id" THEN v."giao_thay_mat_cho" END, "public"."lanh_dao_truc_tiep"(v_me."id"));
  IF v_cap."id" IS NULL THEN RAISE EXCEPTION 'Chưa xác định được lãnh đạo trực tiếp để duyệt đề nghị.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."tu_choi" ("nhiem_vu_id", "nguoi_de_nghi", "cap_duyet", "ly_do") VALUES (v."id", v_me."id", v_cap."id", v_ly_do) RETURNING "id" INTO v_id;
  v_tin := format('Đề nghị từ chối · %s: %s đề nghị từ chối nhận việc, chờ %s duyệt', v."ma", v_me."full_name",
    CASE WHEN v."giao_thay_mat_nhom" IS NOT NULL AND v_cap."id" = v."giao_thay_mat_cho" THEN "public"."kl_ten_nhom_thay_mat"(v."giao_thay_mat_nhom") ELSE v_cap."full_name" END);   -- 0079
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v."id", v_me."id", 'tu_choi', format('đề nghị từ chối, chờ %s duyệt', v_cap."full_name"), 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', v."id" FROM (SELECT unnest("public"."kl_nguoi_duyet_tu_choi"(v."id", v_cap."id")) AS u UNION SELECT v."tao_boi" WHERE v."tao_boi" IS NOT NULL) t   -- 0079: cả nhóm
  JOIN "public"."accounts" a ON a."id" = t.u WHERE t.u <> v_me."id" AND NOT a."is_system";
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."duyet_tu_choi"("p_id" uuid, "p_dong_y" boolean, "p_y_kien" text DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE t "public"."tu_choi"; v_ma text; v_ket text; v_y_kien text := nullif(btrim(coalesce("p_y_kien", '')), '');
BEGIN
  SELECT * INTO t FROM "public"."tu_choi" WHERE "id" = "p_id";
  IF t."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet") THEN   -- 0079: cấp duyệt, Thường trực thay Thường trực, hoặc thành viên nhóm được thay mặt
    RAISE EXCEPTION 'Chỉ cấp duyệt ghi trên đề nghị mới được duyệt.' USING ERRCODE = '42501';
  END IF;
  IF t."trang_thai" <> 'CHO_DUYET' THEN RAISE EXCEPTION 'Đề nghị này đã được duyệt.' USING ERRCODE = '22023'; END IF;
  IF "p_dong_y" IS NULL THEN RAISE EXCEPTION 'Phải chọn đồng ý hoặc không đồng ý.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."tu_choi" SET "trang_thai" = CASE WHEN "p_dong_y" THEN 'DONG_Y' ELSE 'KHONG_DONG_Y' END, "y_kien_duyet" = v_y_kien, "duyet_luc" = now() WHERE "id" = "p_id";
  IF "p_dong_y" THEN
    PERFORM set_config('kl.chi_dao', '1', true);
    UPDATE "public"."nhiem_vu" SET "bi_tu_choi" = true WHERE "id" = t."nhiem_vu_id";
    PERFORM set_config('kl.chi_dao', '', true);
  END IF;
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = t."nhiem_vu_id";
  v_ket := CASE WHEN "p_dong_y" THEN 'đồng ý từ chối, chờ giao lại' ELSE 'không đồng ý, tiếp tục thực hiện' END;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (t."nhiem_vu_id", "auth"."uid"(), 'tu_choi', 'đã duyệt: ' || v_ket, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  VALUES ("auth"."uid"(), t."nguoi_de_nghi", format('Duyệt đề nghị từ chối · %s: %s%s', v_ma, v_ket, coalesce(' — ' || v_y_kien, '')), false, 'he_thong', t."nhiem_vu_id");
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_tu_choi_thay_duoc"() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 20 AS $$
  WITH me AS (
    SELECT a."role_group", a."department", coalesce(a."is_chief" AND a."role_group" = 'A1', false) AS chief
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  )
  SELECT t."id" FROM "public"."tu_choi" t
  LEFT JOIN "public"."accounts" dn ON dn."id" = t."nguoi_de_nghi"
  LEFT JOIN me ON true
  WHERE "auth"."uid"() IS NOT NULL AND (
       t."nguoi_de_nghi" = "auth"."uid"() OR t."cap_duyet" = "auth"."uid"()
    OR "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")   -- 0079: thành viên nhóm được thay mặt
    OR CASE me."role_group"
         WHEN 'A0' THEN true
         WHEN 'A1' THEN me.chief OR EXISTS (
           SELECT 1 FROM "public"."phu_trach_phong" p
           WHERE p."lanh_dao_id" = "auth"."uid"() AND p."phong" = dn."department" AND p."nganh_ma" IS NULL
             AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
         WHEN 'A2' THEN dn."department" = me."department"
         ELSE false END);
$$;

CREATE OR REPLACE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")
               AND a."role_group" IN ('A0', 'A1', 'A2') AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system")
    OR "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), "p_nv"."giao_thay_mat_nhom"));   -- 0079: cả nhóm được thay mặt là tầng giao
$$;

CREATE OR REPLACE FUNCTION "public"."de_nghi_sua_duyet"("p_id" uuid, "p_dong_y" boolean, "p_y_kien" text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t "public"."de_nghi_sua"; v "public"."nhiem_vu"; v_moi jsonb; k text; v_ket text; v_me uuid := "auth"."uid"();
        v_y_kien text := nullif(btrim(coalesce("p_y_kien", '')), '');
BEGIN
  SELECT * INTO t FROM "public"."de_nghi_sua" WHERE "id" = "p_id" FOR UPDATE;
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = t."nhiem_vu_id" FOR UPDATE;
  IF t."id" IS NULL OR v_me IS NULL OR v_me = t."nguoi_de_nghi" OR NOT ("public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")   -- 0079: + thành viên nhóm được thay mặt
     OR "public"."kl_la_tang_giao"(v)) THEN
    RAISE EXCEPTION 'Chỉ người duyệt ghi trên đề nghị (hoặc người giao việc) mới duyệt đề nghị sửa.' USING ERRCODE = '42501';
  END IF;
  IF t."trang_thai" <> 'CHO_DUYET' THEN RAISE EXCEPTION 'Đề nghị này đã được xử lý.' USING ERRCODE = '22023'; END IF;
  IF "p_dong_y" IS NULL THEN RAISE EXCEPTION 'Phải chọn chấp nhận hoặc giữ nguyên.' USING ERRCODE = '22023'; END IF;
  IF NOT "p_dong_y" AND v_y_kien IS NULL THEN RAISE EXCEPTION 'Giữ nguyên thì ghi ý kiến cho người đề nghị.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_y_kien) > 500 THEN RAISE EXCEPTION 'Ý kiến tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF "p_dong_y" THEN
    IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng: không áp đề nghị sửa, chọn Giữ nguyên.' USING ERRCODE = '22023'; END IF;
    FOR k IN SELECT jsonb_object_keys(t."gia_tri_cu") LOOP
      IF coalesce(to_jsonb(v) -> k, 'null'::jsonb) IS DISTINCT FROM t."gia_tri_cu" -> k THEN
        RAISE EXCEPTION 'Ô "%" đã đổi sau khi đề nghị được gửi — chọn Giữ nguyên để người đề nghị gửi lại.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023';
      END IF;
    END LOOP;
    v_moi := "public"."kl_thay_doi_giao"(v, t."thay_doi");
    PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_moi);
  END IF;
  UPDATE "public"."de_nghi_sua" SET "trang_thai" = CASE WHEN "p_dong_y" THEN 'DONG_Y' ELSE 'KHONG_DONG_Y' END, "y_kien_duyet" = v_y_kien,
    "duyet_boi" = v_me, "duyet_luc" = now() WHERE "id" = t."id";
  v_ket := CASE WHEN "p_dong_y" THEN 'chấp nhận, đã sửa ' ELSE 'giữ nguyên ' END || "public"."kl_ten_thay_doi"(t."thay_doi");
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me, 'de_nghi_sua', 'đã duyệt đề nghị sửa: ' || v_ket || coalesce(' — ' || v_y_kien, ''), 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, t."nguoi_de_nghi", format('Duyệt đề nghị sửa · %s: %s%s', v."ma", v_ket, coalesce(' — ' || v_y_kien, '')), false, 'he_thong', v."id"
  WHERE t."nguoi_de_nghi" <> v_me;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap,
                "role_group" <> 'A0' AND (coalesce("is_chief" AND "role_group" = 'A1', false) OR coalesce("thu_ky_thuong_truc", false)
                  OR coalesce("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false)) AS nt_rong,
                CASE "role_group" WHEN 'A2' THEN ARRAY["department"]
                  WHEN 'A1' THEN ARRAY(SELECT p."phong" FROM "public"."phu_trach_phong" p WHERE p."lanh_dao_id" = "auth"."uid"()
                                       AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
                  ELSE '{}'::text[] END AS nt_phong
              FROM "public"."accounts" WHERE "id" = "auth"."uid"()),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL),
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  quyet AS (SELECT n."id" FROM mo n, me CROSS JOIN LATERAL "public"."trang_thai_dong"(n::"public"."nhiem_vu", "public"."kl_hom_nay"()) t
            WHERE n."cap_quyet_dinh" = ANY (me.cap) AND NOT n."bi_tu_choi" AND t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') AND NOT t."dang_dinh_chinh"),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'thong_bao', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'),
    'can_quyet', (SELECT count(*) FROM quyet),
    'de_nghi_cho_duyet', (SELECT count(*) FROM "public"."tu_choi" t, me WHERE t."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")),   -- 0079
    'bi_tu_choi', (SELECT count(*) FROM mo n, me WHERE n."bi_tu_choi" AND (me."role_group" IN ('A0', 'A1', 'A2') OR n."tao_boi" = me."id" OR n."giao_thay_mat_cho" = me."id")),
    'tt_cho_nhan', (SELECT count(*) FROM cua_toi WHERE "uu_tien" = 'THUONG_TRUC'),
    'viec_moi', (SELECT count(*) FROM cua_toi),
    'hoa_toc_viec', (SELECT count(*) FROM cua_toi WHERE "do_khan" = 'HOA_TOC'),
    'hoa_toc_chi_dao', (SELECT count(*) FROM ht_cd),
    'can_nghiem_thu', (SELECT count(*) FROM mo n, me CROSS JOIN LATERAL (
        SELECT m."nop_boi", m."loai", m."hop_le" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1) mc
      WHERE mc."hop_le" IS NULL AND (mc."loai" IN ('so_hieu', 'tep') OR (mc."loai" = 'chu_cu' AND n."han_nop_minh_chung" IS NOT NULL))
        AND me."role_group" <> 'A0' AND (me.nt_rong OR coalesce(n."giao_thay_mat_cho", n."tao_boi") = me."id"
          OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") AND a."department" = ANY (me.nt_phong))
          OR EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = n."owner_don_vi_ma" AND d."phong" = ANY (me.nt_phong)))
        AND me."id" = ANY ("public"."nguoi_nghiem_thu_chinh"(n::"public"."nhiem_vu", mc."nop_boi"))),
    'co_vuong_mac', (SELECT count(*) FROM mo n, me WHERE me."role_group" IN ('A1', 'A2') AND n."vuong_mac" IS NOT NULL),
    'de_nghi_sua', (SELECT count(*) FROM "public"."de_nghi_sua" d, me WHERE d."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(d."nhiem_vu_id", d."cap_duyet")),   -- 0079
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;
