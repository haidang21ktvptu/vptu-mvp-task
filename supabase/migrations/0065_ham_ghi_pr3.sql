-- 0065: Hàm ghi PR-3 (hạng mục B, C, E, F; quyết định 1/10/2026). Mỗi hàm liệt kê tường minh người được ghi; A0 chỉ được khi là người giao /
-- người tạo văn bản đúng như quyền sẵn có. Câu UPDATE nhiem_vu đặt cờ kl.ghi_qua_ham cục bộ giao dịch rồi xoá ngay (guard a3, 0062).
-- 1. dat_thong_tin_giao(p_id, p_nguon_nhiem_vu_ma, p_don_vi_phoi_hop): người giao (coalesce(giao_thay_mat_cho, tao_boi), vai A0/A1/A2, không bị
--    khoá) hoặc quan_tri_kl còn hạn (không phải A0). Owner / người theo dõi KHÔNG đổi được (guard a3 chặn cả đường UPDATE trực tiếp).
--    Ghi cả hai cột một lần (biểu mẫu gửi giá trị hiện tại của ô không đổi); bỏ nguồn đã có ⇒ trigger be_nhiem_vu_pr3 báo lỗi.
-- 2. dat_vuong_mac(p_id, p_noi_dung): Owner tài khoản, người theo dõi, lãnh đạo trong phạm vi (kl_duoc_chi_dao: A1/A2 thấy việc) hoặc quan_tri_kl;
--    A0 bị loại. Trống ⇒ NULL (đã giải quyết). Tin lần đầu do trigger zc_ (0062) gửi — đường Cập nhật nhanh (UPDATE trực tiếp) cũng qua đó.
-- 3. van_ban_dat_ra_soat(p_id, p_so, p_da_ra_soat): cùng quyền van_ban_dat_trich_yeu (người tạo văn bản, A1, quan_tri_kl). Đánh dấu rà soát
--    ghi ra_soat_boi / ra_soat_luc (giữ mốc cũ nếu đã rà soát); bỏ dấu thì xoá. Vết lich_su cot = van_ban_ra_soat trên mọi việc của văn bản.
-- 4. kl_van_ban_so_viec(): số nhiệm vụ gốc (nhiem_vu_cha NULL) đã nhập của từng văn bản — đếm TỔNG THẬT (SECURITY DEFINER, cả việc ngoài phạm vi
--    người xem) nhưng chỉ trả dòng cho văn bản người gọi xem được (cùng điều kiện policy van_ban_giao_viec_select). Màn Theo văn bản: "đã nhập x / dự kiến y".

CREATE FUNCTION "public"."dat_thong_tin_giao"("p_id" uuid, "p_nguon_nhiem_vu_ma" text, "p_don_vi_phoi_hop" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_nguon text := nullif(btrim(coalesce("p_nguon_nhiem_vu_ma", '')), '');
        v_ph text := nullif(btrim(coalesce("p_don_vi_phoi_hop", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_nv."id" IS NULL OR v_me."id" IS NULL
     OR ((coalesce(v_nv."giao_thay_mat_cho", v_nv."tao_boi") = v_me."id" AND v_me."role_group" IN ('A0', 'A1', 'A2') AND NOT coalesce(v_me."bi_khoa", false))
         OR ("public"."me_quan_tri_kl"() AND v_me."role_group" <> 'A0')) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ người giao việc hoặc quản trị nhiệm vụ mới sửa nguồn nhiệm vụ, đơn vị phối hợp.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_ph) > 300 THEN RAISE EXCEPTION 'Đơn vị phối hợp tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
  IF v_nguon IS NOT DISTINCT FROM v_nv."nguon_nhiem_vu_ma" AND v_ph IS NOT DISTINCT FROM v_nv."don_vi_phoi_hop" THEN RETURN; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này
  UPDATE "public"."nhiem_vu" SET "nguon_nhiem_vu_ma" = v_nguon, "don_vi_phoi_hop" = v_ph WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

CREATE FUNCTION "public"."dat_vuong_mac"("p_id" uuid, "p_noi_dung" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_moi text := nullif(btrim(coalesce("p_noi_dung", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR "public"."me_la_a0"()
     OR (v_nv."owner_tai_khoan" = "auth"."uid"() OR v_nv."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(v_nv."id")
         OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi, lãnh đạo trong phạm vi hoặc quản trị nhiệm vụ mới ghi vướng mắc.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_moi) > 500 THEN RAISE EXCEPTION 'Vướng mắc tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF v_moi IS NOT DISTINCT FROM v_nv."vuong_mac" THEN RETURN; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- lãnh đạo không phải Owner / người theo dõi: guard a3 cho qua đúng câu UPDATE này
  UPDATE "public"."nhiem_vu" SET "vuong_mac" = v_moi WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

CREATE FUNCTION "public"."van_ban_dat_ra_soat"("p_id" uuid, "p_so" integer, "p_da_ra_soat" boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_rs boolean;
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_id";
  IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  IF "auth"."uid"() IS NULL OR (v_vb."tao_boi" = "auth"."uid"() OR "public"."me_role"() = 'A1' OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ người tạo văn bản, lãnh đạo Văn phòng hoặc quản trị nhiệm vụ mới sửa số nhiệm vụ dự kiến, rà soát văn bản.' USING ERRCODE = '42501';
  END IF;
  IF "p_so" < 0 THEN RAISE EXCEPTION 'Số nhiệm vụ dự kiến không được âm.' USING ERRCODE = '22023'; END IF;
  v_rs := coalesce("p_da_ra_soat", v_vb."da_ra_soat_toan_van");
  IF "p_so" IS NOT DISTINCT FROM v_vb."so_nhiem_vu_du_kien" AND v_rs = v_vb."da_ra_soat_toan_van" THEN RETURN; END IF;
  UPDATE "public"."van_ban_giao_viec" SET "so_nhiem_vu_du_kien" = "p_so", "da_ra_soat_toan_van" = v_rs,
    "ra_soat_boi" = CASE WHEN NOT v_rs THEN NULL WHEN v_vb."da_ra_soat_toan_van" THEN v_vb."ra_soat_boi" ELSE "auth"."uid"() END,
    "ra_soat_luc" = CASE WHEN NOT v_rs THEN NULL WHEN v_vb."da_ra_soat_toan_van" THEN v_vb."ra_soat_luc" ELSE now() END
  WHERE "id" = "p_id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", "auth"."uid"(), 'van_ban_ra_soat',
         format('dự kiến %s · %s', coalesce(v_vb."so_nhiem_vu_du_kien"::text, '—'), CASE WHEN v_vb."da_ra_soat_toan_van" THEN 'đã rà soát' ELSE 'chưa rà soát' END),
         format('dự kiến %s · %s', coalesce("p_so"::text, '—'), CASE WHEN v_rs THEN 'đã rà soát' ELSE 'chưa rà soát' END), 'app'
  FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = "p_id";
END;
$$;

CREATE FUNCTION "public"."kl_van_ban_so_viec"() RETURNS TABLE ("van_ban_id" uuid, "so_viec" integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n."van_ban_id", count(*)::integer FROM "public"."nhiem_vu" n
  WHERE n."nhiem_vu_cha" IS NULL AND "auth"."uid"() IS NOT NULL
    AND ((SELECT "public"."me_quan_tri_kl"()) OR n."van_ban_id" IN (SELECT "public"."kl_van_ban_thay_duoc"()))   -- (SELECT …): một lần mỗi truy vấn
  GROUP BY n."van_ban_id";
$$;

REVOKE ALL ON FUNCTION "public"."dat_thong_tin_giao"(uuid, text, text) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."dat_vuong_mac"(uuid, text) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."van_ban_dat_ra_soat"(uuid, integer, boolean) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_van_ban_so_viec"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."dat_thong_tin_giao"(uuid, text, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."dat_vuong_mac"(uuid, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."van_ban_dat_ra_soat"(uuid, integer, boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_van_ban_so_viec"() TO "authenticated";
