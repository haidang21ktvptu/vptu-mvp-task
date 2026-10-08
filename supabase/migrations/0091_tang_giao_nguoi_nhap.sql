-- 0091 (Đợt D v3.20 — định hướng 8/10/2026, tiếp 0090): đề nghị từ chối nhận việc / đề nghị sửa thông tin giao về NGƯỜI ĐÃ NHẬP / GIAO VIỆC
-- (thường là chuyên viên); lãnh đạo được báo, xử lý thay được nếu muốn, không bị nhắc. Lãnh đạo làm được mọi việc của chuyên viên trong phạm vi.
-- 1. kl_lanh_dao_pham_vi(việc): người gọi là lãnh đạo (A0 / A1 / A2) và thấy việc (kl_thay_nhiem_vu) — policy UPDATE nhiem_vu (mục 4).
--    kl_cap_bac(tài khoản): Thường trực 4 > Chánh VP 3 > Phó Chánh VP 2 > Trưởng phòng 1 > chuyên viên 0.
-- 2. Tầng giao (kl_la_tang_giao — sửa thông tin giao, nguồn / đơn vị phối hợp (dat_thong_tin_giao), duyệt đề nghị sửa / đề nghị từ chối, trả lại
--    minh chứng): + người tạo việc CÒN THẤY VIỆC và người được thay mặt ở MỌI vai (chuyên viên nhập thay mặt lãnh đạo / nhóm khi còn quyền quản trị,
--    người nhập Excel — trước đây chỉ khi vai lãnh đạo hoặc chuyên viên giao thẳng) + lãnh đạo trong phạm vi CẤP CAO HƠN người giao (người được thay mặt, không có thì người tạo):
--    lãnh đạo càng cao làm thay được càng rộng; Trưởng phòng không sửa thông tin Lãnh đạo Văn phòng giao, Phó Chánh VP không sửa việc Chánh VP giao.
-- 3. Cấp duyệt đề nghị (kl_cap_duyet_sua, dùng cho cả đề nghị từ chối): người tạo việc trước, rồi người được thay mặt, rồi lãnh đạo trực tiếp
--    như cũ. de_nghi_tu_choi dùng chung hàm, và "đã nhận" ghi tự động cho lãnh đạo không chặn từ chối (chuyên viên theo cấu hình 0085 như cũ);
--    duyet_tu_choi nhận thêm tầng giao (mục 2); tin đề nghị tới người tạo, người được thay mặt và cả nhóm thay mặt.
-- 4. Guard a3 (b): người là tầng giao (theo kl_la_tang_giao) sửa trực tiếp ô tầng giao; policy UPDATE nhiem_vu: + người tạo việc, lãnh đạo trong
--    phạm vi (lãnh đạo làm được việc nhập liệu của chuyên viên — cùng danh sách cột được sửa của guard; ô tầng giao đã điền vẫn chỉ tầng giao sửa).
-- 5. canh_bao_ghi: nhắc "đề nghị từ chối chờ duyệt", "minh chứng chờ nghiệm thu" không gửi lãnh đạo (A0 / A1 / A2) — tin báo khi phát sinh vẫn gửi;
--    nhắc không còn người nhận thì không ghi diễn biến.

-- ---- 1 ----
CREATE OR REPLACE FUNCTION "public"."kl_lanh_dao_pham_vi"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND coalesce("public"."me_role"() IN ('A0', 'A1', 'A2'), false) AND "public"."kl_thay_nhiem_vu"("p_nhiem_vu");
$$;
REVOKE ALL ON FUNCTION "public"."kl_lanh_dao_pham_vi"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_lanh_dao_pham_vi"(uuid) TO "authenticated";
CREATE OR REPLACE FUNCTION "public"."kl_cap_bac"("p_id" uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN a."role_group" = 'A0' THEN 4 WHEN a."role_group" = 'A1' AND coalesce(a."is_chief", false) THEN 3 WHEN a."role_group" = 'A1' THEN 2
              WHEN a."role_group" = 'A2' THEN 1 ELSE 0 END FROM "public"."accounts" a WHERE a."id" = "p_id";
$$;
REVOKE ALL ON FUNCTION "public"."kl_cap_bac"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_cap_bac"(uuid) TO "authenticated";

-- ---- 2 ----
CREATE OR REPLACE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"
               AND (a."id" = "p_nv"."giao_thay_mat_cho" OR (a."id" = "p_nv"."tao_boi" AND "public"."kl_thay_nhiem_vu"("p_nv"."id"))))   -- người tạo còn thấy việc
    OR "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), "p_nv"."giao_thay_mat_nhom", "p_nv"."id")
    OR ("public"."kl_lanh_dao_pham_vi"("p_nv"."id")   -- lãnh đạo trong phạm vi, cấp cao hơn người giao (việc không rõ người giao: mọi lãnh đạo trong phạm vi)
        AND "public"."kl_cap_bac"("auth"."uid"()) > coalesce("public"."kl_cap_bac"(coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")), -1))), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_la_tang_giao"("public"."nhiem_vu") FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_la_tang_giao"("public"."nhiem_vu") TO "authenticated";   -- guard a3 (SECURITY INVOKER) gọi trực tiếp

-- dat_thong_tin_giao (bản 0065): nguồn nhiệm vụ, đơn vị phối hợp — cùng tầng giao.
CREATE OR REPLACE FUNCTION "public"."dat_thong_tin_giao"("p_id" uuid, "p_nguon_nhiem_vu_ma" text, "p_don_vi_phoi_hop" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_nguon text := nullif(btrim(coalesce("p_nguon_nhiem_vu_ma", '')), '');
        v_ph text := nullif(btrim(coalesce("p_don_vi_phoi_hop", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_nv."id" IS NULL OR v_me."id" IS NULL OR NOT "public"."kl_la_tang_giao"(v_nv) THEN   -- 0091: cùng tầng giao với sửa thông tin giao
    RAISE EXCEPTION 'Chỉ người giao việc (người nhập, lãnh đạo được thay mặt), lãnh đạo cấp trên trong phạm vi hoặc quản trị nhiệm vụ mới sửa nguồn nhiệm vụ, đơn vị phối hợp.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_ph) > 300 THEN RAISE EXCEPTION 'Đơn vị phối hợp tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
  IF v_nguon IS NOT DISTINCT FROM v_nv."nguon_nhiem_vu_ma" AND v_ph IS NOT DISTINCT FROM v_nv."don_vi_phoi_hop" THEN RETURN; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này
  UPDATE "public"."nhiem_vu" SET "nguon_nhiem_vu_ma" = v_nguon, "don_vi_phoi_hop" = v_ph WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

-- ---- 3 ----
-- Người tạo việc còn quyền xử lý đề nghị (tính cho người khác — không dùng auth.uid): đang hoạt động; lãnh đạo; hoặc là chủ trì / theo dõi; hoặc
-- còn quyền quản trị nhiệm vụ; hoặc chuyên viên giao thẳng (không thay mặt — vẫn thấy việc mình giao). Người gõ thay đã hết quyền quản trị → NULL.
CREATE OR REPLACE FUNCTION "public"."kl_nguoi_tao_xu_ly"("p_nv" "public"."nhiem_vu") RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a."id" FROM "public"."accounts" a
  WHERE a."id" = ("p_nv")."tao_boi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"
    AND (a."role_group" IN ('A0', 'A1', 'A2') OR a."id" IN (("p_nv")."owner_tai_khoan", ("p_nv")."nguoi_theo_doi")
         OR (coalesce(a."quan_tri_kl", false) AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()))
         OR (("p_nv")."giao_thay_mat_cho" IS NULL AND ("p_nv")."giao_thay_mat_nhom" IS NULL));
$$;
REVOKE ALL ON FUNCTION "public"."kl_nguoi_tao_xu_ly"("public"."nhiem_vu") FROM public, "anon", "authenticated";

CREATE OR REPLACE FUNCTION "public"."kl_cap_duyet_sua"("p_nv" "public"."nhiem_vu", "p_nguoi" uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; i int := 0;
BEGIN
  -- 1. Người tạo việc còn quyền (người nhập / giao — mọi vai, kl_nguoi_tao_xu_ly), rồi người được thay mặt; đang hoạt động, khác người đề nghị.
  v := "public"."kl_nguoi_tao_xu_ly"("p_nv");
  IF v IS NOT NULL AND v <> "p_nguoi" THEN RETURN v; END IF;
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE a."id" = "p_nv"."giao_thay_mat_cho" AND a."id" <> "p_nguoi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system";
  IF v IS NOT NULL THEN RETURN v; END IF;
  -- 2. Lãnh đạo trực tiếp (0034); bị khoá thì lên một cấp (tối đa 3 cấp).
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

CREATE OR REPLACE FUNCTION "public"."de_nghi_tu_choi"("p_nhiem_vu" uuid, "p_ly_do" text) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu"; v_me "public"."accounts"; v_cap "public"."accounts"; v_id uuid; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_me."id" IS NULL OR v_me."role_group" = 'A0' OR v."id" IS NULL OR NOT coalesce(v."nguoi_theo_doi" = v_me."id" OR v."owner_tai_khoan" = v_me."id", false) THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi vừa được giao việc mới đề nghị từ chối.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn từ chối được.' USING ERRCODE = '22023'; END IF;
  IF v."bi_tu_choi" THEN RAISE EXCEPTION 'Việc đã được đồng ý từ chối, đang chờ giao lại.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = v."id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = v_me."id"
             AND ("gia_tri_moi" NOT LIKE 'tự động%' OR v_me."role_group" = 'A3')) THEN   -- 0091: lãnh đạo "đã nhận" tự động (0090) vẫn đề nghị từ chối được
    RAISE EXCEPTION 'Đồng chí đã xác nhận nhận việc này, không còn từ chối được.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' THEN RAISE EXCEPTION 'Đề nghị từ chối phải có lý do.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."tu_choi" WHERE "nhiem_vu_id" = v."id" AND "trang_thai" = 'CHO_DUYET') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có đề nghị từ chối đang chờ duyệt.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_cap FROM "public"."accounts" WHERE "id" = "public"."kl_cap_duyet_sua"(v, v_me."id");   -- 0091: người giao việc trước
  IF v_cap."id" IS NULL THEN RAISE EXCEPTION 'Chưa xác định được người giao việc hoặc lãnh đạo trực tiếp để duyệt đề nghị.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."tu_choi" ("nhiem_vu_id", "nguoi_de_nghi", "cap_duyet", "ly_do") VALUES (v."id", v_me."id", v_cap."id", v_ly_do) RETURNING "id" INTO v_id;
  v_tin := format('Đề nghị từ chối · %s: %s đề nghị từ chối nhận việc, chờ %s xử lý', v."ma", v_me."full_name",
    CASE WHEN v."giao_thay_mat_nhom" IS NOT NULL AND v_cap."id" = v."giao_thay_mat_cho" THEN "public"."kl_ten_nhom_thay_mat"(v."giao_thay_mat_nhom") ELSE v_cap."full_name" END);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v."id", v_me."id", 'tu_choi', format('đề nghị từ chối, chờ %s xử lý', v_cap."full_name"), 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", u, v_tin, false, 'he_thong', v."id"
  FROM (SELECT unnest("public"."kl_nguoi_duyet_tu_choi"(v."id", v_cap."id")) AS u UNION SELECT "public"."kl_nguoi_tao_xu_ly"(v) WHERE "public"."kl_nguoi_tao_xu_ly"(v) IS NOT NULL
        UNION SELECT unnest("public"."kl_nguoi_duyet_tu_choi"(v."id", v."giao_thay_mat_cho")) WHERE v."giao_thay_mat_cho" IS NOT NULL) t   -- + cả nhóm thay mặt
  JOIN "public"."accounts" a ON a."id" = t.u WHERE t.u <> v_me."id" AND NOT a."is_system";
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."duyet_tu_choi"("p_id" uuid, "p_dong_y" boolean, "p_y_kien" text DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE t "public"."tu_choi"; v "public"."nhiem_vu"; v_ket text; v_y_kien text := nullif(btrim(coalesce("p_y_kien", '')), '');
BEGIN
  SELECT * INTO t FROM "public"."tu_choi" WHERE "id" = "p_id";
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = t."nhiem_vu_id";
  -- 0091: + tầng giao — người tạo, người được thay mặt, thành viên nhóm thay mặt, lãnh đạo cấp trên người giao trong phạm vi, quản trị nhiệm vụ.
  IF t."id" IS NULL OR "auth"."uid"() IS NULL OR "auth"."uid"() = t."nguoi_de_nghi"
     OR NOT ("public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet") OR "public"."kl_la_tang_giao"(v)) THEN
    RAISE EXCEPTION 'Chỉ người giao việc (người nhập, lãnh đạo được thay mặt), lãnh đạo cấp trên của họ hoặc cấp duyệt mới xử lý đề nghị từ chối.' USING ERRCODE = '42501';
  END IF;
  IF t."trang_thai" <> 'CHO_DUYET' THEN RAISE EXCEPTION 'Đề nghị này đã được duyệt.' USING ERRCODE = '22023'; END IF;
  IF "p_dong_y" IS NULL THEN RAISE EXCEPTION 'Phải chọn đồng ý hoặc không đồng ý.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."tu_choi" SET "trang_thai" = CASE WHEN "p_dong_y" THEN 'DONG_Y' ELSE 'KHONG_DONG_Y' END, "y_kien_duyet" = v_y_kien, "duyet_luc" = now() WHERE "id" = "p_id";
  IF "p_dong_y" THEN
    PERFORM set_config('kl.chi_dao', '1', true);
    UPDATE "public"."nhiem_vu" SET "bi_tu_choi" = true WHERE "id" = t."nhiem_vu_id";
    PERFORM set_config('kl.chi_dao', '', true);
  END IF;
  v_ket := CASE WHEN "p_dong_y" THEN 'đồng ý từ chối, chờ giao lại' ELSE 'không đồng ý, tiếp tục thực hiện' END;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (t."nhiem_vu_id", "auth"."uid"(), 'tu_choi', 'đã duyệt: ' || v_ket, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  VALUES ("auth"."uid"(), t."nguoi_de_nghi", format('Duyệt đề nghị từ chối · %s: %s%s', v."ma", v_ket, coalesce(' — ' || v_y_kien, '')), false, 'he_thong', t."nhiem_vu_id");
END;
$$;

-- ---- 4. Guard a3 (bản 0070; chỉ vế (b) đổi) + policy UPDATE ----
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung', 'vuong_mac'];
        dinh_danh text[] := ARRAY['tao_boi', 'giao_thay_mat_cho', 'nhiem_vu_cha', 'van_ban_id', 'theo_1400', 'nguon'];
        tang_giao text[] := ARRAY['san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban'];
        v_cu jsonb := to_jsonb(OLD); v_moi jsonb := to_jsonb(NEW); c text;
BEGIN
  IF current_user = 'authenticated' AND "auth"."uid"() IS NOT NULL THEN
    FOREACH c IN ARRAY dinh_danh LOOP
      IF v_moi -> c IS DISTINCT FROM v_cu -> c THEN
        RAISE EXCEPTION 'Không sửa trực tiếp người giao, văn bản giao việc, việc cấp trên hay nguồn dòng của nhiệm vụ (cột %).', c USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() OR current_setting('kl.chi_dao', true) = '1'
     OR coalesce(current_setting('kl.han_nop_qua_ham', true), '') = '1' OR coalesce(current_setting('kl.ghi_qua_ham', true), '') = '1' THEN RETURN NEW; END IF;
  IF (v_moi - loai) IS DISTINCT FROM (v_cu - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú, vướng mắc.'
      USING ERRCODE = '42501';
  END IF;
  IF current_user = 'authenticated' AND OLD."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly" THEN
    RAISE EXCEPTION 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.' USING ERRCODE = '42501';
  END IF;
  -- (b) nhập theo tầng — người không phải tầng giao (0091: kl_la_tang_giao — người giao / người tạo việc ở mọi vai / lãnh đạo cấp trên) chỉ điền ô
  --     tầng giao còn trống (ngày nhận ước tính coi như còn trống; không tự chuyển ngày đã chốt thành ước tính để mở khoá).
  IF current_user = 'authenticated' AND NOT "public"."kl_la_tang_giao"(OLD) THEN
    IF NOT coalesce(OLD."ngay_nhan_uoc_tinh", false) AND coalesce(NEW."ngay_nhan_uoc_tinh", false) THEN
      RAISE EXCEPTION 'Ngày nhận văn bản đã chốt — không chuyển lại thành ngày ước tính.' USING ERRCODE = '42501';
    END IF;
    FOREACH c IN ARRAY tang_giao LOOP
      CONTINUE WHEN c = 'ngay_nhan_van_ban' AND coalesce(OLD."ngay_nhan_uoc_tinh", false);
      IF v_moi -> c IS DISTINCT FROM v_cu -> c AND nullif(btrim(coalesce(v_cu ->> c, '')), '') IS NOT NULL THEN
        IF c IN ('cap_quyet_dinh', 'ngay_nhan_van_ban') THEN
          RAISE EXCEPTION 'Ô "%" đã được ghi — đồng chí báo người giao việc nếu cần điều chỉnh.', "public"."kl_ten_cot_giao"(c) USING ERRCODE = '42501';
        END IF;
        RAISE EXCEPTION 'Ô "%" do cấp giao việc điền — đồng chí gửi "Đề nghị sửa" để người giao việc xử lý.', "public"."kl_ten_cot_giao"(c) USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY "nhiem_vu_update" ON "public"."nhiem_vu";
CREATE POLICY "nhiem_vu_update" ON "public"."nhiem_vu" FOR UPDATE TO "authenticated"
  USING ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR "tao_boi" = (SELECT "auth"."uid"())
         OR (SELECT "public"."me_quan_tri_kl"()) OR "public"."kl_lanh_dao_pham_vi"("id"))
  WITH CHECK ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR "tao_boi" = (SELECT "auth"."uid"())
              OR (SELECT "public"."me_quan_tri_kl"()) OR "public"."kl_lanh_dao_pham_vi"("id"));

-- ---- 5. Nhắc không gửi lãnh đạo (bản 0037 + lọc vai theo loại nhắc) ----
CREATE OR REPLACE FUNCTION "public"."canh_bao_ghi"("p_nv" uuid, "p_chi_dao" uuid, "p_muc" text, "p_ngay" date, "p_nguoi" uuid[], "p_tin" text) RETURNS bigint
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nguoi uuid[]; v_id bigint;
BEGIN
  SELECT coalesce(array_agg(DISTINCT u), '{}') INTO v_nguoi FROM unnest("p_nguoi") u JOIN "public"."accounts" a ON a."id" = u
  WHERE NOT a."is_system" AND a."role_group" <> 'A0'
    AND NOT ("p_muc" IN ('TU_CHOI', 'NGHIEM_THU', 'NGHIEM_THU_QUA_HAN') AND a."role_group" IN ('A1', 'A2'));   -- 0091: lãnh đạo không bị nhắc xử lý
  INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "chi_dao_id", "muc", "ngay", "nguoi_nhan") VALUES ("p_nv", "p_chi_dao", "p_muc", "p_ngay", v_nguoi) RETURNING "id" INTO v_id;
  IF cardinality(v_nguoi) > 0 THEN   -- 0091: nhắc chỉ còn người nhận là lãnh đạo ⇒ giữ dòng canh_bao (chống lặp), không ghi diễn biến
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon") VALUES ("p_nv", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', "p_tin", 'app');
  END IF;
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id") SELECT NULL, u, "p_tin", false, 'he_thong', "p_nv" FROM unnest(v_nguoi) u;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION "public"."canh_bao_ghi"(uuid, uuid, text, date, uuid[], text) FROM public, "anon", "authenticated";
