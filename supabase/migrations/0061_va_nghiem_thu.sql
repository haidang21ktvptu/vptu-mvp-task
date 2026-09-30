-- 0061: Vá nghiệm thu / hạn nộp sau review PR-2b (quyết định chủ dự án 30/9). 0053–0060 đã áp staging ⇒ không sửa, định nghĩa lại ở đây.
-- 1. Q8 chặt hơn: việc Thường trực (A0) giao cho Chánh VP (kl_viec_a0_giao_cvp) CHỈ thư ký Thường trực nghiệm thu; không ai giữ cờ thư ký thì
--    quan_tri_kl còn hạn — TRỪ chính Chánh VP (chủ trì) trong mọi trường hợp. nguoi_nghiem_thu_chinh bỏ chủ trì khỏi hai danh sách của nhánh này;
--    kl_duoc_nghiem_thu với loại việc này = "tôi thuộc nguoi_nghiem_thu_chinh(việc, người nộp minh chứng mới nhất)" — CÙNG hàm với nhắc
--    (canh_bao_quet), huy hiệu (kl_so_chua_xu_ly) và cột nguoi_chiu_cham, nên nút / danh sách / huy hiệu / quyền ghi khớp nhau.
--    Loại việc khác giữ quy tắc 0057 (người theo dõi ∨ kl_duoc_chi_dao ∨ quan_tri_kl còn hạn).
-- 2. Q4 mở rộng: người giao (coalesce(giao_thay_mat_cho, tao_boi)) còn hoạt động nhưng không còn vai A0/A1/A2 ⇒ coi như không còn người giao
--    ⇒ quan_tri_kl sửa hạn nộp. nguoi_nghiem_thu_chinh vốn chỉ lấy người giao vai A1/A2 (không phải A0 — A0 chỉ đọc ở bước nghiệm thu) nên
--    người giao không còn vai lãnh đạo tự rơi xuống nhánh sau — đã khớp, chỉ ghi chú.
-- 3. Việc lúc giao chưa có hạn hoàn thành (Cần điền hạn; Ký ban hành chưa có ngày ban hành), về sau có hạn mà chưa có hạn nộp minh chứng:
--    trigger AFTER UPDATE gửi tin hệ thống tới người giao (A0/A1/A2 còn hoạt động); không còn người giao thì mọi quan_tri_kl còn hạn (Q4).
--    Chỉ việc nguon = app (việc nhập — Q1 — không bắt buộc hạn nộp) và đang mở.

CREATE OR REPLACE FUNCTION "public"."nguoi_nghiem_thu_chinh"("p_nv" "public"."nhiem_vu", "p_nguoi_nop" uuid DEFAULT NULL) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER AS $$   -- mọi tên đã có schema ⇒ không SET search_path (bớt chi phí mỗi lời gọi)
  -- Bản 0057 + nhánh Q8 bỏ chủ trì (Chánh VP) khỏi danh sách thư ký và danh sách quan_tri_kl dự phòng. COALESCE dừng ở đối số đầu khác NULL.
  SELECT CASE WHEN "public"."kl_viec_a0_giao_cvp"("p_nv") THEN coalesce(
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."thu_ky_thuong_truc", false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" IS DISTINCT FROM ("p_nv")."owner_tai_khoan"),
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" IS DISTINCT FROM ("p_nv")."owner_tai_khoan"), '{}'::uuid[])
    ELSE coalesce(
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a
       WHERE a."id" = coalesce(("p_nv")."giao_thay_mat_cho", ("p_nv")."tao_boi") AND a."role_group" IN ('A1', 'A2') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop"),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" o JOIN "public"."accounts" a ON a."role_group" = 'A2' AND a."department" = o."department"
       WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A3' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop" ORDER BY a."username" LIMIT 1),
      (SELECT ARRAY[a."id"] FROM "public"."pcvp_phu_trach"(
         coalesce((SELECT o."department" FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan"),
                  (SELECT d."phong" FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND d."trong_van_phong")),
         ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") x(id) JOIN "public"."accounts" a ON a."id" = x.id
       WHERE NOT EXISTS (SELECT 1 FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A1') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop"
       ORDER BY a."username" LIMIT 1),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a
       WHERE ("p_nv")."owner_tai_khoan" IS NULL AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop" AND a."id" = "public"."lanh_dao_truc_tiep"(("p_nv")."nguoi_theo_doi")
         AND EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND NOT d."trong_van_phong")),
      (SELECT ARRAY[a."id"] FROM "public"."accounts" a WHERE a."role_group" = 'A1' AND a."is_chief" AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."id" IS DISTINCT FROM "p_nguoi_nop" ORDER BY a."username" LIMIT 1),
      (SELECT array_agg(a."id" ORDER BY a."username") FROM "public"."accounts" a WHERE coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop"), '{}'::uuid[]) END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_duoc_nghiem_thu"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT "auth"."uid"() IS NOT NULL AND NOT "public"."me_la_a0"() AND CASE
      WHEN "public"."kl_viec_a0_giao_cvp"(n) THEN   -- Q8 (0061): đúng người nhận nhắc chính — thư ký, không có thì quan_tri_kl; không bao giờ là Chánh VP chủ trì
        "auth"."uid"() = ANY ("public"."nguoi_nghiem_thu_chinh"(n,
          (SELECT m."nop_boi" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1)))
      ELSE n."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(n."id") OR "public"."me_quan_tri_kl"() END
    FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"), false);
$$;

-- dat_han_nop_minh_chung (0054) + Q4 mở rộng: người giao chỉ tính khi còn hoạt động VÀ còn vai A0/A1/A2.
CREATE OR REPLACE FUNCTION "public"."dat_han_nop_minh_chung"("p_id" uuid, "p_han" date, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_giao "public"."accounts"; v_q4 boolean := false; v_k jsonb; v_sat boolean; v_tin text;
        v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_nv."id" IS NULL OR v_me."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy nhiệm vụ.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_giao FROM "public"."accounts" WHERE "id" = coalesce(v_nv."giao_thay_mat_cho", v_nv."tao_boi");
  IF v_giao."id" IS NOT NULL AND NOT v_giao."is_system" AND NOT coalesce(v_giao."bi_khoa", false) AND v_giao."role_group" IN ('A0', 'A1', 'A2') THEN
    IF v_me."id" <> v_giao."id" THEN
      RAISE EXCEPTION 'Chỉ người giao việc mới sửa hạn nộp minh chứng.' USING ERRCODE = '42501';
    END IF;
  ELSIF "public"."me_quan_tri_kl"() THEN v_q4 := true;
  ELSE RAISE EXCEPTION 'Việc không còn người giao — chỉ quản trị nhiệm vụ sửa hạn nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_nv."tien_do_ma" = 'HOAN_THANH' OR v_nv."dong_luc" IS NOT NULL THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng.' USING ERRCODE = '22023'; END IF;
  IF "p_han" IS NULL THEN RAISE EXCEPTION 'Thiếu hạn nộp minh chứng mới.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do IS NULL OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Sửa hạn nộp minh chứng phải ghi lý do (tối đa 500 ký tự).' USING ERRCODE = '22023'; END IF;
  IF "p_han" IS NOT DISTINCT FROM v_nv."han_nop_minh_chung" THEN RAISE EXCEPTION 'Hạn nộp mới trùng hạn hiện tại.' USING ERRCODE = '22023'; END IF;
  v_k := "public"."kl_khung_han_nop"(v_nv."han_xu_ly");
  v_sat := v_k ->> 'khong_ly_do_den' IS NULL OR "p_han" > (v_k ->> 'khong_ly_do_den')::date;
  PERFORM set_config('kl.han_nop_qua_ham', '1', true);   -- guard a3 (người không phải quan_tri_kl) cho qua đúng một UPDATE này
  UPDATE "public"."nhiem_vu" SET "han_nop_minh_chung" = "p_han", "ly_do_han_nop_sat" = CASE WHEN v_sat THEN v_ly_do END WHERE "id" = "p_id";
  PERFORM set_config('kl.han_nop_qua_ham', '', true);
  v_tin := format('Đổi hạn nộp minh chứng · %s: %s → %s — %s%s', v_nv."ma", coalesce(to_char(v_nv."han_nop_minh_chung", 'DD/MM/YYYY'), '(chưa có)'),
                  to_char("p_han", 'DD/MM/YYYY'), v_ly_do, CASE WHEN v_q4 THEN ' (quản trị sửa thay — không có người giao)' ELSE '' END);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES ("p_id", v_me."id", 'han_nop_minh_chung_ly_do', to_char(v_nv."han_nop_minh_chung", 'YYYY-MM-DD'), v_tin, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', "p_id" FROM (SELECT DISTINCT unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) AS u) x
  WHERE u IS NOT NULL AND u <> v_me."id";
END;
$$;

-- 3. Nhắc đặt hạn nộp khi việc vừa có hạn hoàn thành (NULL → có giá trị) mà chưa có hạn nộp. Tin hệ thống (sender NULL), không ghi cảnh báo.
CREATE FUNCTION "public"."kl_nhiem_vu_nhac_dat_han_nop"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nhan uuid[];
BEGIN
  IF NEW."nguon" <> 'app' OR NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL THEN RETURN NULL; END IF;
  SELECT ARRAY[a."id"] INTO v_nhan FROM "public"."accounts" a
  WHERE a."id" = coalesce(NEW."giao_thay_mat_cho", NEW."tao_boi") AND a."role_group" IN ('A0', 'A1', 'A2') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false);
  IF v_nhan IS NULL THEN   -- Q4: không còn người giao ⇒ mọi quan_tri_kl còn hạn
    SELECT array_agg(a."id") INTO v_nhan FROM "public"."accounts" a
    WHERE coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false)
      AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0';
  END IF;
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT NULL, u, format('Việc %s đã có hạn hoàn thành %s — đặt hạn nộp minh chứng', NEW."ma", to_char(NEW."han_xu_ly", 'DD/MM/YYYY')), false, 'he_thong', NEW."id"
  FROM unnest(coalesce(v_nhan, '{}'::uuid[])) u;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "zb_nhiem_vu_nhac_dat_han_nop" AFTER UPDATE ON "public"."nhiem_vu"   -- không "OF han_xu_ly": hạn có thể do trigger BEFORE tính (Ký ban hành)
  FOR EACH ROW WHEN (OLD."han_xu_ly" IS NULL AND NEW."han_xu_ly" IS NOT NULL AND NEW."han_nop_minh_chung" IS NULL)
  EXECUTE FUNCTION "public"."kl_nhiem_vu_nhac_dat_han_nop"();

REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_nhac_dat_han_nop"() FROM public, "anon", "authenticated";
