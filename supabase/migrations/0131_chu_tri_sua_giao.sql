-- 0131 (v3.34, chủ dự án quyết 30/10/2026 — CAU-HOI T-1, T-2): chủ trì theo dõi tự sửa nhiệm vụ mình chủ trì.
-- Lỗi báo: chủ trì ban đầu sửa được mọi ô thông tin giao vì chính là người nhập việc (tầng giao, kl_la_tang_giao); sau "Đổi chủ trì theo dõi"
-- người nhận chủ trì không phải người nhập nên chỉ còn "Đề nghị sửa". Quyết định:
-- 1. Chủ trì theo dõi (coalesce(owner_tai_khoan, nguoi_theo_doi) = người gọi — cùng điều kiện Điều chỉnh hạn 0123, sửa minh chứng 0130) sửa ngay mọi ô
--    thông tin giao (sua_thong_tin_giao) và nguồn / đơn vị phối hợp (dat_thong_tin_giao) khi việc CHƯA HOÀN THÀNH; lý do bắt buộc, lịch sử, tin báo người
--    giao việc như cũ. Việc đã hoàn thành: như cũ (chỉ tài khoản quản trị). kl_la_tang_giao KHÔNG đổi (còn dùng cho trả lại / đánh giá minh chứng, mục
--    tiêu, giải ngân, guard).
-- 2. dieu_chinh_han: bỏ chặn chủ trì khi việc đã quá hạn — tự điều chỉnh mọi lúc; hạn mới không trước hôm nay (trừ tài khoản quản trị), lý do bắt buộc,
--    lùi hạn tính lần gia hạn, lịch sử + Diễn biến + tin báo (kl_ghi_vet_viec) như cũ.

-- ---- 1. Hàm phụ: người gọi là chủ trì theo dõi của việc (tài khoản đang hoạt động) ----
CREATE OR REPLACE FUNCTION "public"."kl_la_chu_tri_theo_doi"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("auth"."uid"() IS NOT NULL AND coalesce("p_nv"."owner_tai_khoan", "p_nv"."nguoi_theo_doi") = "auth"."uid"()
    AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_la_chu_tri_theo_doi"("public"."nhiem_vu") FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_la_chu_tri_theo_doi"("public"."nhiem_vu") TO "authenticated";

-- ---- 2. sua_thong_tin_giao (bản 0124) + chủ trì theo dõi ----
CREATE OR REPLACE FUNCTION "public"."sua_thong_tin_giao"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_moi jsonb; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text; v_me uuid := "auth"."uid"();
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;   -- so giá trị cũ trên dòng đã khoá (không mất cập nhật song song)
  IF v."id" IS NULL OR v_me IS NULL OR NOT ("public"."kl_la_tang_giao"(v)
      OR (v."tien_do_ma" <> 'HOAN_THANH' AND ("public"."kl_la_thu_ky_tt"() OR "public"."kl_la_chu_tri_theo_doi"(v)))) THEN   -- 0131: + chủ trì theo dõi
    RAISE EXCEPTION 'Chỉ người giao việc, chủ trì theo dõi, thư ký Thường trực hoặc tài khoản quản trị mới sửa thông tin giao.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' AND NOT (("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0') OR "public"."me_toan_quyen"()) THEN
    RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành: chỉ tài khoản quản trị sửa thông tin giao.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_moi := "public"."kl_thay_doi_giao"(v, "p_thay_doi");
  PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_moi);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me, 'sua_thong_tin_giao', format('sửa %s — lý do: %s', "public"."kl_ten_thay_doi"(v_moi), v_ly_do), 'app');
  v_tin := format('Sửa thông tin giao · %s: %s — %s', v."ma", "public"."kl_ten_thay_doi"(v_moi), left(v_ly_do, 200));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, u.id, v_tin, false, 'he_thong', v."id"
  FROM (SELECT DISTINCT x AS id FROM unnest(ARRAY[v."owner_tai_khoan", v."nguoi_theo_doi", v."giao_thay_mat_cho", v."tao_boi"]) x WHERE x IS NOT NULL AND x <> v_me) u
  JOIN "public"."accounts" a ON a."id" = u.id WHERE NOT a."is_system" AND a."role_group" <> 'A0' AND NOT coalesce(a."bi_khoa", false);
END;
$$;
REVOKE ALL ON FUNCTION "public"."sua_thong_tin_giao"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."sua_thong_tin_giao"(uuid, jsonb, text) TO "authenticated";

-- ---- 3. dat_thong_tin_giao (bản 0091) + chủ trì theo dõi ----
CREATE OR REPLACE FUNCTION "public"."dat_thong_tin_giao"("p_id" uuid, "p_nguon_nhiem_vu_ma" text, "p_don_vi_phoi_hop" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_nguon text := nullif(btrim(coalesce("p_nguon_nhiem_vu_ma", '')), '');
        v_ph text := nullif(btrim(coalesce("p_don_vi_phoi_hop", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_nv."id" IS NULL OR v_me."id" IS NULL OR NOT ("public"."kl_la_tang_giao"(v_nv)   -- 0091: cùng tầng giao với sửa thông tin giao
      OR (v_nv."tien_do_ma" <> 'HOAN_THANH' AND "public"."kl_la_chu_tri_theo_doi"(v_nv))) THEN   -- 0131: + chủ trì theo dõi, việc chưa hoàn thành
    RAISE EXCEPTION 'Chỉ người giao việc (người nhập, lãnh đạo được thay mặt), chủ trì theo dõi, lãnh đạo cấp trên trong phạm vi hoặc quản trị nhiệm vụ mới sửa nguồn nhiệm vụ, đơn vị phối hợp.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_ph) > 300 THEN RAISE EXCEPTION 'Đơn vị phối hợp tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
  IF v_nguon IS NOT DISTINCT FROM v_nv."nguon_nhiem_vu_ma" AND v_ph IS NOT DISTINCT FROM v_nv."don_vi_phoi_hop" THEN RETURN; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này
  UPDATE "public"."nhiem_vu" SET "nguon_nhiem_vu_ma" = v_nguon, "don_vi_phoi_hop" = v_ph WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;
REVOKE ALL ON FUNCTION "public"."dat_thong_tin_giao"(uuid, text, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."dat_thong_tin_giao"(uuid, text, text) TO "authenticated";

-- ---- 4. dieu_chinh_han (bản 0123) — chủ trì điều chỉnh cả khi việc đã quá hạn ----
CREATE OR REPLACE FUNCTION "public"."dieu_chinh_han"("p_id" uuid, "p_han_moi" date, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tq boolean := "public"."me_toan_quyen"();
        v_tk boolean := "public"."kl_la_thu_ky_tt"(); v_gia_han boolean; v_so integer; v_nd text;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR v_me IS NULL OR NOT (v_tq OR v_tk OR coalesce(v."owner_tai_khoan", v."nguoi_theo_doi") = v_me) THEN
    RAISE EXCEPTION 'Chỉ cán bộ chủ trì theo dõi, thư ký Thường trực hoặc tài khoản quản trị mới điều chỉnh hạn của nhiệm vụ này. Lãnh đạo Văn phòng gia hạn ở mục Chỉ đạo.'
      USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' AND NOT v_tq THEN RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không điều chỉnh hạn.' USING ERRCODE = '22023'; END IF;
  IF v."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Nhiệm vụ chưa có hạn xử lý — điền hạn ở Cập nhật.' USING ERRCODE = '22023'; END IF;
  -- 0131 (CAU-HOI T-2): bỏ chặn việc đã quá hạn — chủ trì tự điều chỉnh mọi lúc, lịch sử / Diễn biến / tin báo ghi như cũ.
  IF "p_han_moi" IS NULL THEN RAISE EXCEPTION 'Chọn hạn mới.' USING ERRCODE = '22023'; END IF;
  IF "p_han_moi" = v."han_xu_ly" THEN RAISE EXCEPTION 'Hạn mới trùng hạn hiện tại (%).', to_char(v."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023'; END IF;
  IF NOT v_tq AND "p_han_moi" < "public"."kl_hom_nay"() THEN   -- hạn đã qua: chỉ tài khoản quản trị đính chính (gõ nhầm ngày làm việc quá hạn ngay)
    RAISE EXCEPTION 'Hạn mới không được trước hôm nay (%).', to_char("public"."kl_hom_nay"(), 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do điều chỉnh hạn bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_gia_han := "p_han_moi" > v."han_xu_ly";
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3: đổi hạn qua hàm (như chi_dao_gui GIA_HAN); trigger 0015/0023 vẫn kiểm ngày
  UPDATE "public"."nhiem_vu" SET "han_xu_ly" = "p_han_moi", "so_lan_gia_han" = "so_lan_gia_han" + CASE WHEN v_gia_han THEN 1 ELSE 0 END,
    "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END
  WHERE "id" = v."id" RETURNING "so_lan_gia_han" INTO v_so;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_nd := format('%s → %s%s — lý do: %s', to_char(v."han_xu_ly", 'DD/MM/YYYY'), to_char("p_han_moi", 'DD/MM/YYYY'),
                 CASE WHEN v_gia_han THEN format(' (gia hạn lần %s)', v_so) ELSE ' (rút ngắn hạn)' END, v_ly_do);
  PERFORM "public"."kl_ghi_vet_viec"(v."id", 'dieu_chinh_han', v_nd, format('Điều chỉnh hạn · %s: %s', v."ma", left(v_nd, 300)));
  RETURN jsonb_build_object('han_cu', v."han_xu_ly", 'han_moi', "p_han_moi", 'gia_han', v_gia_han, 'so_lan_gia_han', v_so);
END;
$$;
REVOKE ALL ON FUNCTION "public"."dieu_chinh_han"(uuid, date, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."dieu_chinh_han"(uuid, date, text) TO "authenticated";
