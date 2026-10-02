-- 0070 — Giao diện v9 đợt 2 (C): NHẬP THEO TẦNG. Mỗi tầng điền phần của mình: tầng giao (người giao = tao_boi / giao_thay_mat_cho, hoặc quản trị
-- nhiệm vụ) điền "thông tin giao"; tầng nhận (Owner / người theo dõi) điền phần thực hiện. Cấp dưới chỉ XEM ô cấp trên đã điền — muốn đổi thì gửi
-- "Đề nghị sửa" (0071); cấp giao sửa ngay phần của mình qua sua_thong_tin_giao (lý do bắt buộc, lịch sử + tin cho người nhận).
-- 1. Guard a_ (kl_nhiem_vu_guard_a3, bản 0062) thêm hai luật cho đường API trực tiếp (current_user = 'authenticated' — hàm SECURITY DEFINER chạy
--    bằng chủ hàm nên không bị luật này; luồng cờ kl.* giữ nguyên):
--    (a) cột định danh (tao_boi, giao_thay_mat_cho, nhiem_vu_cha, van_ban_id, theo_1400, nguon) không đổi được với MỌI vai, kể cả quản trị
--        nhiệm vụ — đổi người giao / văn bản / việc cha là sửa lịch sử giao việc;
--    (b) ô tầng giao còn mở cho Owner / người theo dõi (sản phẩm, mô tả sản phẩm, cấp nhận sản phẩm, cấp cần quyết định, ngày nhận văn bản khi
--        KHÔNG ước tính): người không phải người giao chỉ ĐIỀN khi ô đang trống; ô đã điền → Đề nghị sửa (cấp cần quyết định, ngày nhận: báo
--        người giao); không tự chuyển ngày nhận đã chốt thành ước tính. Hạn xử lý giữ luật Q7 (0052).
-- 2. kl_cot_tang_giao(): 10 ô "thông tin giao" sửa / đề nghị sửa được; kl_ten_cot_giao(c): tên tiếng Việt; kl_la_tang_giao(nv): người gọi là tầng giao.
-- 3. kl_thay_doi_giao(nv, p): chuẩn hoá (cắt khoảng trắng, chuỗi rỗng = trống), chỉ nhận khoá trong danh sách, kiểm danh mục / ràng buộc nghiệp
--    vụ, trả đúng các ô THỰC SỰ đổi (jsonb). kl_ap_thong_tin_giao(id, p): một câu UPDATE cố định (jsonb_populate_record, không SQL động) dưới cờ
--    kl.ghi_qua_ham. Hai hàm nội bộ — không cấp cho authenticated.
-- 4. sua_thong_tin_giao(p_id, p_thay_doi, p_ly_do): tầng giao; việc đã đóng chỉ quản trị nhiệm vụ; lý do ≤ 500; lịch sử từng cột do trigger c_,
--    thêm một dòng "Sửa thông tin giao" kèm lý do; tin hệ thống cho Owner + người theo dõi (trừ người sửa).

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung', 'vuong_mac'];
        dinh_danh text[] := ARRAY['tao_boi', 'giao_thay_mat_cho', 'nhiem_vu_cha', 'van_ban_id', 'theo_1400', 'nguon'];
        tang_giao text[] := ARRAY['san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban'];
        v_cu jsonb := to_jsonb(OLD); v_moi jsonb := to_jsonb(NEW); c text;
BEGIN
  -- (a) 0070: cột định danh — đường API trực tiếp, mọi vai (kể cả quản trị nhiệm vụ).
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
  -- Q7: UPDATE trực tiếp qua API (vai authenticated) không đổi hạn đã có; điền khi đang NULL được. Đổi hạn đi qua đề nghị gia hạn.
  IF current_user = 'authenticated' AND OLD."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly" THEN
    RAISE EXCEPTION 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.' USING ERRCODE = '42501';
  END IF;
  -- (b) 0070: nhập theo tầng — người không phải người giao (coalesce(giao_thay_mat_cho, tao_boi), như 0054) chỉ điền ô tầng giao còn trống (ngày
  --     nhận ước tính coi như còn trống; không được tự chuyển ngày đã chốt thành ước tính để mở khoá).
  IF current_user = 'authenticated' AND "auth"."uid"() IS DISTINCT FROM coalesce(OLD."giao_thay_mat_cho", OLD."tao_boi") THEN
    IF NOT coalesce(OLD."ngay_nhan_uoc_tinh", false) AND coalesce(NEW."ngay_nhan_uoc_tinh", false) THEN
      RAISE EXCEPTION 'Ngày nhận văn bản đã chốt — không chuyển lại thành ngày ước tính.' USING ERRCODE = '42501';
    END IF;
    FOREACH c IN ARRAY tang_giao LOOP
      CONTINUE WHEN c = 'ngay_nhan_van_ban' AND coalesce(OLD."ngay_nhan_uoc_tinh", false);
      IF v_moi -> c IS DISTINCT FROM v_cu -> c AND nullif(btrim(coalesce(v_cu ->> c, '')), '') IS NOT NULL THEN
        IF c IN ('cap_quyet_dinh', 'ngay_nhan_van_ban') THEN   -- hai ô không nằm trong Đề nghị sửa (kl_cot_tang_giao)
          RAISE EXCEPTION 'Ô "%" đã được ghi — đồng chí báo người giao việc nếu cần điều chỉnh.', "public"."kl_ten_cot_giao"(c) USING ERRCODE = '42501';
        END IF;
        RAISE EXCEPTION 'Ô "%" do cấp giao việc điền — đồng chí gửi "Đề nghị sửa" để cấp giao duyệt.', "public"."kl_ten_cot_giao"(c) USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION "public"."kl_cot_tang_giao"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['noi_dung', 'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'do_khan', 'nganh_ma', 'linh_vuc_ma', 'linh_vuc_chi_tiet',
               'nguon_nhiem_vu_ma', 'don_vi_phoi_hop']::text[];
$$;

CREATE FUNCTION "public"."kl_ten_cot_giao"("p_cot" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_cot" WHEN 'noi_dung' THEN 'Nội dung' WHEN 'san_pham_loai' THEN 'Sản phẩm' WHEN 'san_pham_mo_ta' THEN 'Mô tả sản phẩm'
    WHEN 'cap_nhan_san_pham' THEN 'Cấp nhận sản phẩm' WHEN 'do_khan' THEN 'Độ khẩn' WHEN 'nganh_ma' THEN 'Ngành' WHEN 'linh_vuc_ma' THEN 'Lĩnh vực'
    WHEN 'linh_vuc_chi_tiet' THEN 'Lĩnh vực chi tiết' WHEN 'nguon_nhiem_vu_ma' THEN 'Nguồn nhiệm vụ' WHEN 'don_vi_phoi_hop' THEN 'Đơn vị phối hợp'
    WHEN 'cap_quyet_dinh' THEN 'Cấp cần quyết định' WHEN 'ngay_nhan_van_ban' THEN 'Ngày nhận văn bản' ELSE "p_cot" END;
$$;

-- Tầng giao của một việc: người giao = coalesce(giao_thay_mat_cho, tao_boi) (như 0054), vai lãnh đạo A0/A1/A2, tài khoản còn hoạt động; hoặc quản
-- trị nhiệm vụ CÒN HẠN (không phải A0). Người gõ thay (chuyên viên giữ quan_tri_kl, người nhập Excel) không giữ quyền khi hết ủy quyền.
CREATE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")
               AND a."role_group" IN ('A0', 'A1', 'A2') AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"));
$$;

-- Chuẩn hoá + kiểm thay đổi: trả {cột: giá trị mới} chỉ gồm ô thực sự đổi; lỗi tiếng Việt nếu khoá lạ, giá trị sai danh mục, không đổi gì.
CREATE FUNCTION "public"."kl_thay_doi_giao"("p_nv" "public"."nhiem_vu", "p" jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; val jsonb; v_moi jsonb := '{}'::jsonb; v_cu jsonb := to_jsonb("p_nv"); v_s text; v_loai_vb text; v_nganh text; v_lv text;
BEGIN
  IF "p" IS NULL OR jsonb_typeof("p") <> 'object' OR "p" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p") e LOOP
    IF NOT (k = ANY ("public"."kl_cot_tang_giao"())) THEN RAISE EXCEPTION 'Ô "%" không sửa được bằng cách này.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    IF k IN ('noi_dung', 'do_khan') AND v_s IS NULL THEN RAISE EXCEPTION '% không được để trống.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    IF k = 'noi_dung' AND char_length(v_s) > 2000 THEN RAISE EXCEPTION 'Nội dung tối đa 2000 ký tự.' USING ERRCODE = '22023'; END IF;
    IF k IN ('san_pham_mo_ta', 'linh_vuc_chi_tiet') AND char_length(v_s) > 1000 THEN RAISE EXCEPTION '% tối đa 1000 ký tự.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    IF k = 'don_vi_phoi_hop' AND char_length(v_s) > 300 THEN RAISE EXCEPTION 'Đơn vị phối hợp tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
    IF k = 'do_khan' AND v_s NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
    IF v_s IS NOT NULL AND (
         (k = 'san_pham_loai' AND NOT EXISTS (SELECT 1 FROM "public"."dm_san_pham" WHERE "ma" = v_s))
      OR (k = 'cap_nhan_san_pham' AND NOT EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = v_s))
      OR (k = 'nganh_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = v_s))
      OR (k = 'linh_vuc_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_s))
      OR (k = 'nguon_nhiem_vu_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_nguon_nhiem_vu" WHERE "ma" = v_s AND ("dang_dung" OR "ma" = "p_nv"."nguon_nhiem_vu_ma")))) THEN
      RAISE EXCEPTION '% không có trong danh mục.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023';
    END IF;
    IF coalesce(to_jsonb(v_s), 'null'::jsonb) IS DISTINCT FROM coalesce(v_cu -> k, 'null'::jsonb) THEN v_moi := v_moi || jsonb_build_object(k, v_s); END IF;
  END LOOP;
  IF v_moi = '{}'::jsonb THEN RAISE EXCEPTION 'Không có gì thay đổi so với thông tin đang có.' USING ERRCODE = '22023'; END IF;
  -- Ràng buộc nghiệp vụ trên giá trị SAU khi đổi: sản phẩm của việc theo 1400; ngành + lĩnh vực của việc từ kết luận / thông báo; lĩnh vực thuộc ngành.
  v_nganh := CASE WHEN v_moi ? 'nganh_ma' THEN v_moi ->> 'nganh_ma' ELSE "p_nv"."nganh_ma" END;
  v_lv := CASE WHEN v_moi ? 'linh_vuc_ma' THEN v_moi ->> 'linh_vuc_ma' ELSE "p_nv"."linh_vuc_ma" END;
  IF "p_nv"."theo_1400" AND v_moi ? 'san_pham_loai' AND v_moi ->> 'san_pham_loai' IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ theo quy tắc 1400 phải có sản phẩm đầu ra.' USING ERRCODE = '22023';
  END IF;
  IF "p_nv"."theo_1400" AND v_moi ? 'cap_nhan_san_pham' AND v_moi ->> 'cap_nhan_san_pham' IS NULL THEN   -- minh chứng / nghiệm thu cần cấp nhận
    RAISE EXCEPTION 'Nhiệm vụ theo quy tắc 1400 phải có cấp nhận sản phẩm.' USING ERRCODE = '22023';
  END IF;
  SELECT "loai" INTO v_loai_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_nv"."van_ban_id";
  IF "p_nv"."theo_1400" AND v_loai_vb IN ('KL_BTV', 'TB_THUONG_TRUC') AND (v_nganh IS NULL OR v_lv IS NULL) THEN
    RAISE EXCEPTION 'Việc từ kết luận/thông báo phải có ngành và lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF v_lv IS NOT NULL AND v_nganh IS NULL THEN RAISE EXCEPTION 'Chọn ngành trước khi chọn lĩnh vực.' USING ERRCODE = '22023'; END IF;   -- CHECK lĩnh vực cần ngành
  IF v_lv IS NOT NULL AND v_nganh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_lv AND "nganh_ma" = v_nganh) THEN
    RAISE EXCEPTION 'Lĩnh vực không thuộc ngành đã chọn.' USING ERRCODE = '22023';
  END IF;
  RETURN v_moi;
END;
$$;

-- Áp {cột: giá trị} (đã qua kl_thay_doi_giao) bằng một câu UPDATE cố định; cờ kl.ghi_qua_ham cho guard a_ cho qua đúng câu này.
CREATE FUNCTION "public"."kl_ap_thong_tin_giao"("p_id" uuid, "p" jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; m "public"."nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  m := jsonb_populate_record(v, (SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) FROM jsonb_each("p") e WHERE e.key = ANY ("public"."kl_cot_tang_giao"())));
  PERFORM set_config('kl.ghi_qua_ham', '1', true);
  UPDATE "public"."nhiem_vu" SET "noi_dung" = m."noi_dung", "san_pham_loai" = m."san_pham_loai", "san_pham_mo_ta" = m."san_pham_mo_ta",
    "cap_nhan_san_pham" = m."cap_nhan_san_pham", "do_khan" = m."do_khan", "nganh_ma" = m."nganh_ma", "linh_vuc_ma" = m."linh_vuc_ma",
    "linh_vuc_chi_tiet" = m."linh_vuc_chi_tiet", "nguon_nhiem_vu_ma" = m."nguon_nhiem_vu_ma", "don_vi_phoi_hop" = m."don_vi_phoi_hop"
  WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

-- Danh sách tên ô của một thay đổi, ví dụ "Sản phẩm, Độ khẩn".
CREATE FUNCTION "public"."kl_ten_thay_doi"("p" jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg("public"."kl_ten_cot_giao"(k), ', ' ORDER BY array_position("public"."kl_cot_tang_giao"(), k)) FROM jsonb_object_keys("p") k;
$$;

CREATE FUNCTION "public"."sua_thong_tin_giao"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_moi jsonb; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text; v_me uuid := "auth"."uid"();
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;   -- so giá trị cũ trên dòng đã khoá (không mất cập nhật song song)
  IF v."id" IS NULL OR v_me IS NULL OR NOT "public"."kl_la_tang_giao"(v) THEN
    RAISE EXCEPTION 'Chỉ người giao việc (hoặc quản trị nhiệm vụ) mới sửa thông tin giao. Cấp nhận việc gửi "Đề nghị sửa".' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' AND NOT ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0') THEN
    RAISE EXCEPTION 'Nhiệm vụ đã đóng: chỉ quản trị nhiệm vụ sửa thông tin giao.' USING ERRCODE = '22023';
  END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_moi := "public"."kl_thay_doi_giao"(v, "p_thay_doi");
  PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_moi);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me, 'sua_thong_tin_giao', format('sửa %s — lý do: %s', "public"."kl_ten_thay_doi"(v_moi), v_ly_do), 'app');
  v_tin := format('Sửa thông tin giao · %s: %s — %s', v."ma", "public"."kl_ten_thay_doi"(v_moi), left(v_ly_do, 200));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, u.id, v_tin, false, 'he_thong', v."id"
  FROM (SELECT DISTINCT x AS id FROM unnest(ARRAY[v."owner_tai_khoan", v."nguoi_theo_doi"]) x WHERE x IS NOT NULL AND x <> v_me) u
  JOIN "public"."accounts" a ON a."id" = u.id WHERE NOT a."is_system";
END;
$$;

-- kl_ten_cot_giao: guard a_ (chạy bằng vai người gọi) dùng để báo lỗi — chỉ là bảng tên, để authenticated gọi được.
REVOKE ALL ON FUNCTION "public"."kl_ten_cot_giao"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ten_cot_giao"(text) TO "authenticated";
REVOKE ALL ON FUNCTION "public"."kl_cot_tang_giao"(), "public"."kl_la_tang_giao"("public"."nhiem_vu"),
  "public"."kl_thay_doi_giao"("public"."nhiem_vu", jsonb), "public"."kl_ap_thong_tin_giao"(uuid, jsonb), "public"."kl_ten_thay_doi"(jsonb)
  FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."sua_thong_tin_giao"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."sua_thong_tin_giao"(uuid, jsonb, text) TO "authenticated";
