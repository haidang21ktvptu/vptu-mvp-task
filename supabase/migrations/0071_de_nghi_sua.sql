-- 0071 — Giao diện v9 đợt 2 (C): ĐỀ NGHỊ SỬA thông tin giao (cấp nhận việc → cấp giao duyệt). Ô thuộc tầng giao (kl_cot_tang_giao, 0070) mà
-- Owner / người theo dõi không sửa được: gửi đề nghị kèm lý do; người duyệt một bấm "Chấp nhận" (áp ngay, như sua_thong_tin_giao) hoặc "Giữ
-- nguyên" (ý kiến bắt buộc). Việc vẫn chạy trong lúc chờ (không đổi trạng thái / mức cảnh báo — khác dinh_chinh).
-- 1. Bảng de_nghi_sua (một đề nghị chờ duyệt mỗi việc; gia_tri_cu = ảnh chụp lúc gửi để chặn duyệt trên dữ liệu đã đổi). RLS chỉ SELECT: người đề
--    nghị, người duyệt, người xem tất cả (kl_xem_tat_ca) và người thấy việc (kl_nhiem_vu_thay_duoc). Ghi chỉ qua ba hàm dưới.
-- 2. kl_cap_duyet_sua(nv, người đề nghị): người giao (còn hoạt động, A0/A1/A2, khác người đề nghị) → lãnh đạo trực tiếp (0034; bị khoá thì lên
--    cấp trên nữa, tối đa 3 cấp) → một quản trị nhiệm vụ còn hạn (không A0). Cấp duyệt là A0 → mọi A0 duyệt được (như tu_choi).
-- 3. de_nghi_sua_gui(p_nhiem_vu, p_thay_doi, p_ly_do) → id: Owner / người theo dõi KHÔNG thuộc tầng giao, không A0, việc đang mở, chưa có đề
--    nghị chờ; giá trị qua kl_thay_doi_giao (0070). Lịch sử cot = de_nghi_sua; tin hệ thống cho người duyệt + người giao.
-- 4. de_nghi_sua_duyet(p_id, p_dong_y, p_y_kien): người duyệt, A0 khi người duyệt là A0, hoặc tầng giao hiện tại — không bao giờ người đề nghị.
--    Chấp nhận: kiểm dữ liệu chưa đổi so với gia_tri_cu, việc còn mở, kiểm lại giá trị rồi áp (kl_ap_thong_tin_giao). Tin cho người đề nghị.
-- 5. de_nghi_sua_huy(p_id): người đề nghị rút đề nghị đang chờ.
-- 6. kl_so_chua_xu_ly (bản 0067) + 'de_nghi_sua': đề nghị sửa chờ chính tôi duyệt (A0: mọi đề nghị có người duyệt là A0). Realtime: thêm bảng.

CREATE TABLE "public"."de_nghi_sua" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "nguoi_de_nghi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "cap_duyet" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "thay_doi" jsonb NOT NULL CHECK (jsonb_typeof("thay_doi") = 'object' AND "thay_doi" <> '{}'::jsonb),
  "gia_tri_cu" jsonb NOT NULL CHECK (jsonb_typeof("gia_tri_cu") = 'object'),
  "ly_do" text NOT NULL CHECK (btrim("ly_do") <> '' AND char_length("ly_do") <= 500),
  "trang_thai" text NOT NULL DEFAULT 'CHO_DUYET' CHECK ("trang_thai" IN ('CHO_DUYET', 'DONG_Y', 'KHONG_DONG_Y', 'HUY')),
  "y_kien_duyet" text CHECK ("y_kien_duyet" IS NULL OR char_length("y_kien_duyet") <= 500),
  "duyet_boi" uuid REFERENCES "public"."accounts"("id"),
  "tao_luc" timestamp with time zone NOT NULL DEFAULT now(),
  "duyet_luc" timestamp with time zone
);
CREATE INDEX "de_nghi_sua_nhiem_vu_idx" ON "public"."de_nghi_sua" ("nhiem_vu_id", "tao_luc" DESC);
CREATE UNIQUE INDEX "de_nghi_sua_mot_cho_duyet_idx" ON "public"."de_nghi_sua" ("nhiem_vu_id") WHERE "trang_thai" = 'CHO_DUYET';
CREATE INDEX "de_nghi_sua_cap_duyet_idx" ON "public"."de_nghi_sua" ("cap_duyet") WHERE "trang_thai" = 'CHO_DUYET';
ALTER TABLE "public"."de_nghi_sua" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."de_nghi_sua" FROM "anon", "authenticated";
GRANT SELECT ON "public"."de_nghi_sua" TO "authenticated";
CREATE POLICY "de_nghi_sua_select" ON "public"."de_nghi_sua" FOR SELECT TO "authenticated"
  USING ("nguoi_de_nghi" = (SELECT "auth"."uid"()) OR "cap_duyet" = (SELECT "auth"."uid"()) OR (SELECT "public"."kl_xem_tat_ca"())
         OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(false)));

CREATE FUNCTION "public"."kl_cap_duyet_sua"("p_nv" "public"."nhiem_vu", "p_nguoi" uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; i int := 0;
BEGIN
  -- 1. Người giao còn hoạt động, vai lãnh đạo, khác người đề nghị.
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi") AND a."id" <> "p_nguoi"
    AND a."role_group" IN ('A0', 'A1', 'A2') AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system";
  IF v IS NOT NULL THEN RETURN v; END IF;
  -- 2. Lãnh đạo trực tiếp (0034); bị khoá thì lên một cấp (tối đa 3 cấp: Trưởng phòng → PCVP → Chánh VP → Thường trực).
  v := "public"."lanh_dao_truc_tiep"("p_nguoi");
  WHILE v IS NOT NULL AND i < 3 AND (v = "p_nguoi" OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND (coalesce(a."bi_khoa", false) OR a."is_system"))) LOOP
    v := "public"."lanh_dao_truc_tiep"(v); i := i + 1;
  END LOOP;
  IF v IS NOT NULL AND v <> "p_nguoi" AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system") THEN RETURN v; END IF;
  -- 3. Một quản trị nhiệm vụ còn hạn (không A0).
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl", false) AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"())
    AND a."role_group" <> 'A0' AND a."id" <> "p_nguoi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system" ORDER BY a."username" LIMIT 1;
  RETURN v;
END;
$$;

CREATE FUNCTION "public"."de_nghi_sua_gui"("p_nhiem_vu" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me "public"."accounts"; v_cap "public"."accounts"; v_moi jsonb; v_cu jsonb; v_id uuid;
        v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu" FOR UPDATE;   -- hai đề nghị gửi cùng lúc: lần sau thấy đề nghị đang chờ
  -- IS DISTINCT FROM: việc giao cho đơn vị (owner_tai_khoan NULL) — so sánh "=" ra NULL sẽ lọt qua.
  IF v_me."id" IS NULL OR v_me."role_group" = 'A0' OR v."id" IS NULL
     OR (v_me."id" IS DISTINCT FROM v."owner_tai_khoan" AND v_me."id" IS DISTINCT FROM v."nguoi_theo_doi") THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới gửi đề nghị sửa.' USING ERRCODE = '42501';
  END IF;
  IF "public"."kl_la_tang_giao"(v) THEN
    RAISE EXCEPTION 'Đồng chí là người giao việc này: sửa trực tiếp thông tin giao, không cần đề nghị.' USING ERRCODE = '22023';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không gửi đề nghị sửa.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Đề nghị sửa phải có lý do, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."de_nghi_sua" WHERE "nhiem_vu_id" = v."id" AND "trang_thai" = 'CHO_DUYET') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có một đề nghị sửa đang chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  v_moi := "public"."kl_thay_doi_giao"(v, "p_thay_doi");
  SELECT jsonb_object_agg(k, coalesce(to_jsonb(v) -> k, 'null'::jsonb)) INTO v_cu FROM jsonb_object_keys(v_moi) k;
  SELECT * INTO v_cap FROM "public"."accounts" WHERE "id" = "public"."kl_cap_duyet_sua"(v, v_me."id");
  IF v_cap."id" IS NULL THEN RAISE EXCEPTION 'Chưa xác định được người duyệt đề nghị sửa.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."de_nghi_sua" ("nhiem_vu_id", "nguoi_de_nghi", "cap_duyet", "thay_doi", "gia_tri_cu", "ly_do")
  VALUES (v."id", v_me."id", v_cap."id", v_moi, v_cu, v_ly_do) RETURNING "id" INTO v_id;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me."id", 'de_nghi_sua', format('đề nghị sửa %s, chờ %s duyệt — lý do: %s', "public"."kl_ten_thay_doi"(v_moi), v_cap."full_name", v_ly_do), 'app');
  v_tin := format('Đề nghị sửa · %s: %s đề nghị sửa %s, chờ %s duyệt', v."ma", v_me."full_name", "public"."kl_ten_thay_doi"(v_moi), v_cap."full_name");
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u.id, v_tin, false, 'he_thong', v."id"
  FROM (SELECT DISTINCT x AS id FROM unnest(ARRAY[v_cap."id", coalesce(v."giao_thay_mat_cho", v."tao_boi")]) x WHERE x IS NOT NULL AND x <> v_me."id") u
  JOIN "public"."accounts" a ON a."id" = u.id WHERE NOT a."is_system";
  RETURN v_id;
END;
$$;

CREATE FUNCTION "public"."de_nghi_sua_duyet"("p_id" uuid, "p_dong_y" boolean, "p_y_kien" text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t "public"."de_nghi_sua"; v "public"."nhiem_vu"; v_moi jsonb; k text; v_ket text; v_me uuid := "auth"."uid"();
        v_y_kien text := nullif(btrim(coalesce("p_y_kien", '')), '');
BEGIN
  SELECT * INTO t FROM "public"."de_nghi_sua" WHERE "id" = "p_id" FOR UPDATE;
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = t."nhiem_vu_id" FOR UPDATE;
  IF t."id" IS NULL OR v_me IS NULL OR v_me = t."nguoi_de_nghi" OR NOT (t."cap_duyet" = v_me
     OR ("public"."me_role"() = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = t."cap_duyet") = 'A0')
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

CREATE FUNCTION "public"."de_nghi_sua_huy"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t "public"."de_nghi_sua";
BEGIN
  SELECT * INTO t FROM "public"."de_nghi_sua" WHERE "id" = "p_id" FOR UPDATE;
  IF t."id" IS NULL OR "auth"."uid"() IS NULL OR t."nguoi_de_nghi" <> "auth"."uid"() THEN
    RAISE EXCEPTION 'Chỉ người gửi mới rút được đề nghị sửa.' USING ERRCODE = '42501';
  END IF;
  IF t."trang_thai" <> 'CHO_DUYET' THEN RAISE EXCEPTION 'Đề nghị này đã được xử lý.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."de_nghi_sua" SET "trang_thai" = 'HUY', "duyet_luc" = now() WHERE "id" = t."id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (t."nhiem_vu_id", "auth"."uid"(), 'de_nghi_sua', 'rút đề nghị sửa ' || "public"."kl_ten_thay_doi"(t."thay_doi"), 'app');
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
                    AND (t."cap_duyet" = me."id" OR (me."role_group" = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = t."cap_duyet") = 'A0'))),
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
                    AND (d."cap_duyet" = me."id" OR (me."role_group" = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = d."cap_duyet") = 'A0'))),
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;


REVOKE ALL ON FUNCTION "public"."kl_cap_duyet_sua"("public"."nhiem_vu", uuid) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."de_nghi_sua_gui"(uuid, jsonb, text), "public"."de_nghi_sua_duyet"(uuid, boolean, text), "public"."de_nghi_sua_huy"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."de_nghi_sua_gui"(uuid, jsonb, text), "public"."de_nghi_sua_duyet"(uuid, boolean, text), "public"."de_nghi_sua_huy"(uuid) TO "authenticated";

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'de_nghi_sua') THEN
    ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."de_nghi_sua";
  END IF;
END $$;
