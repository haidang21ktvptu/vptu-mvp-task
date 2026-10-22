-- 0124 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-5): thư ký Thường trực (cờ accounts.thu_ky_thuong_truc) làm việc trên MỌI nhiệm vụ:
-- xem; cập nhật tiến độ, kết quả; nộp minh chứng (kể cả tải tệp); ghi vướng mắc; sửa thông tin giao; điều chỉnh hạn (0123); đổi chủ trì theo dõi,
-- người theo dõi. Ngoại lệ thứ tư của quy tắc 7 (CLAUDE.md). KHÔNG mở rộng: chỉ đạo, trả lại / đánh giá minh chứng, đóng nhiệm vụ, giải ngân, phân
-- công, đề nghị / duyệt sửa, mục tiêu then chốt (các hàm đó dùng kl_la_tang_giao / kl_duoc_chi_dao … — không đổi). Việc đã hoàn thành: thư ký chỉ xem.
-- 1. kl_xem_toan_bo() (bản 0103) đúng cả với thư ký: đọc mọi nhiệm vụ qua kl_xem_tat_ca() (mọi policy SELECT nhiem_vu, lich_su, chi_dao, minh_chung,
--    canh_bao, dinh_chinh, văn bản, tệp minh chứng); v_nhiem_vu.trong_pham_vi, kl_so_chua_xu_ly, kl_so_lieu_cac_moc vẫn tính PHẠM VI CŨ của thư ký
--    (việc mình chủ trì / theo dõi / giao, việc có chỉ đạo Thường trực, việc Thường trực giao cho Chánh VP — 0047, 0057) ⇒ "Cần xử lý", số liệu không đổi.
-- 2. Policy nhiem_vu_update (bản 0091) + nhánh thư ký với việc chưa hoàn thành; các trigger giữ nguyên chốt cột (guard a3: chỉ ô của người thực hiện;
--    hạn đã có thì đổi qua dieu_chinh_han; ô do cấp giao điền thì sửa qua sua_thong_tin_giao).
-- 3. kl_duoc_nop_minh_chung (bản 0089: nop_minh_chung, policy tải tệp minh-chung) + thư ký với việc chưa hoàn thành.
-- 4. dat_vuong_mac (bản 0103) + thư ký với việc chưa hoàn thành.
-- 5. sua_thong_tin_giao (bản 0070) + thư ký với việc chưa hoàn thành; việc đã hoàn thành: tài khoản toàn quyền (0100) sửa được (B3 — trước đây chỉ
--    quản trị nhiệm vụ đã bỏ ở 0096); tin báo thêm người giao việc (người được thay mặt / người tạo việc) khi người sửa là người khác.
-- 6. doi_chu_tri(p_id, p {chu_tri?, nguoi_theo_doi?}, p_ly_do): thư ký (việc chưa hoàn thành) và tài khoản toàn quyền (mọi việc). Như "Giao lại" của chỉ
--    đạo (0045/0056): đơn vị chủ trì theo phòng của cán bộ mới (lãnh đạo Văn phòng → Văn phòng Tỉnh ủy), cấp nhận sản phẩm theo chủ trì mới; không xét
--    phạm vi người làm. Nhật ký: trigger ghi các cột đổi; dòng 'doi_chu_tri' "chủ trì: A → B · người theo dõi: C → D — lý do: …"; tin báo người liên
--    quan sau khi đổi, chủ trì / người theo dõi cũ, người giao.
-- 7. kl_tham_chieu_pham_vi (bản 0096 — chuẩn đối chiếu của test kl-pq-tuong-duong-pham-vi): thư ký → mọi dòng ở các bảng đọc theo kl_xem_tat_ca.

-- ---- 1 ----
CREATE OR REPLACE FUNCTION "public"."kl_xem_toan_bo"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT "gia_tri" = '2' FROM "public"."kl_cau_hinh" WHERE "khoa" = 'xem_toan_bo'), false) OR "public"."kl_la_thu_ky_tt"();
$$;

-- ---- 2 ----
DROP POLICY "nhiem_vu_update" ON "public"."nhiem_vu";
CREATE POLICY "nhiem_vu_update" ON "public"."nhiem_vu" FOR UPDATE TO "authenticated"
  USING ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR "tao_boi" = (SELECT "auth"."uid"())
         OR (SELECT "public"."me_quan_tri_kl"()) OR "public"."kl_lanh_dao_pham_vi"("id")
         OR ((SELECT "public"."kl_la_thu_ky_tt"()) AND "tien_do_ma" <> 'HOAN_THANH'))
  WITH CHECK ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR "tao_boi" = (SELECT "auth"."uid"())
              OR (SELECT "public"."me_quan_tri_kl"()) OR "public"."kl_lanh_dao_pham_vi"("id") OR (SELECT "public"."kl_la_thu_ky_tt"()));

-- ---- 3 ----
CREATE OR REPLACE FUNCTION "public"."kl_duoc_nop_minh_chung"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT "auth"."uid"() IS NOT NULL AND (
      n."owner_tai_khoan" = "auth"."uid"() OR n."nguoi_theo_doi" = "auth"."uid"()
      OR ((n."tao_boi" = "auth"."uid"() OR "public"."me_role"() IN ('A0', 'A1', 'A2') OR "public"."me_quan_tri_kl"()) AND "public"."kl_thay_nhiem_vu"(n."id"))
      OR (n."tien_do_ma" <> 'HOAN_THANH' AND "public"."kl_la_thu_ky_tt"()))   -- 0124: thư ký Thường trực, mọi việc chưa hoàn thành
    FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"), false);
$$;

-- ---- 4 ---- (bản 0103 + nhánh thư ký)
CREATE OR REPLACE FUNCTION "public"."dat_vuong_mac"("p_id" uuid, "p_noi_dung" text, "p_gui_cho" uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_moi text := nullif(btrim(coalesce("p_noi_dung", '')), ''); v_nhan "public"."accounts"; v_me "public"."accounts";
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR "public"."me_la_a0"()
     OR (v_nv."owner_tai_khoan" = "auth"."uid"() OR v_nv."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(v_nv."id")
         OR "public"."me_quan_tri_kl"() OR (v_nv."tien_do_ma" <> 'HOAN_THANH' AND "public"."kl_la_thu_ky_tt"())) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ chủ trì theo dõi, người theo dõi, lãnh đạo trong phạm vi hoặc thư ký Thường trực mới ghi vướng mắc.' USING ERRCODE = '42501';
  END IF;
  IF char_length(v_moi) > 500 THEN RAISE EXCEPTION 'Vướng mắc tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF "p_gui_cho" IS NOT NULL AND v_moi IS NOT NULL THEN   -- 0103: người giao việc hoặc lãnh đạo VP / Trưởng phòng; không Thường trực, không người ghi
    SELECT * INTO v_nhan FROM "public"."accounts" WHERE "id" = "p_gui_cho";
    IF v_nhan."id" IS NULL OR v_nhan."is_system" OR coalesce(v_nhan."bi_khoa", false) OR v_nhan."id" = "auth"."uid"() OR v_nhan."role_group" = 'A0'
       OR NOT (v_nhan."role_group" IN ('A1', 'A2') OR v_nhan."id" = coalesce(v_nv."giao_thay_mat_cho", v_nv."tao_boi")) THEN
      RAISE EXCEPTION 'Người nhận đề nghị xử lý vướng mắc không hợp lệ.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_moi IS NOT DISTINCT FROM v_nv."vuong_mac" AND (v_moi IS NULL OR "p_gui_cho" IS NOT DISTINCT FROM v_nv."vuong_mac_gui_cho") THEN RETURN; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- lãnh đạo / thư ký không phải chủ trì, người theo dõi: guard a3 cho qua đúng câu UPDATE này
  PERFORM set_config('kl.dat_vuong_mac', '1', true);   -- trigger bg_ giữ người nhận vừa kiểm
  UPDATE "public"."nhiem_vu" SET "vuong_mac" = v_moi, "vuong_mac_gui_cho" = CASE WHEN v_moi IS NULL THEN NULL ELSE "p_gui_cho" END WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  PERFORM set_config('kl.dat_vuong_mac', '', true);
  IF v_nhan."id" IS NOT NULL AND v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL THEN
    SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    VALUES ("auth"."uid"(), v_nhan."id", format('Đề nghị đồng chí xử lý vướng mắc · %s (%s): %s', v_nv."ma", v_me."full_name", left(v_moi, 200)), false, 'he_thong', v_nv."id");
  END IF;
END;
$$;

-- ---- 5 ---- (bản 0070 + thư ký; việc đã hoàn thành: toàn quyền; tin thêm người giao)
CREATE OR REPLACE FUNCTION "public"."sua_thong_tin_giao"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_moi jsonb; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tin text; v_me uuid := "auth"."uid"();
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;   -- so giá trị cũ trên dòng đã khoá (không mất cập nhật song song)
  IF v."id" IS NULL OR v_me IS NULL OR NOT ("public"."kl_la_tang_giao"(v) OR (v."tien_do_ma" <> 'HOAN_THANH' AND "public"."kl_la_thu_ky_tt"())) THEN
    RAISE EXCEPTION 'Chỉ người giao việc, thư ký Thường trực hoặc tài khoản quản trị mới sửa thông tin giao. Cấp nhận việc gửi "Đề nghị sửa".' USING ERRCODE = '42501';
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
  JOIN "public"."accounts" a ON a."id" = u.id WHERE NOT a."is_system" AND a."role_group" <> 'A0';
END;
$$;

-- ---- 6 ----
CREATE FUNCTION "public"."doi_chu_tri"("p_id" uuid, "p" jsonb, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_tq boolean := "public"."me_toan_quyen"(); v_ly_do text := btrim(coalesce("p_ly_do", ''));
        v_ct "public"."accounts"; v_td "public"."accounts"; v_dv "public"."dm_don_vi"; v_doi_ct boolean; v_doi_td boolean; v_nd text; v_cu_ct text; v_cu_td text;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR v_me IS NULL OR NOT (v_tq OR "public"."kl_la_thu_ky_tt"()) THEN
    RAISE EXCEPTION 'Chỉ thư ký Thường trực hoặc tài khoản quản trị mới đổi chủ trì theo dõi bằng chức năng này. Lãnh đạo Văn phòng giao lại ở mục Chỉ đạo.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' AND NOT v_tq THEN RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không đổi chủ trì theo dõi.' USING ERRCODE = '22023'; END IF;
  IF "p" IS NULL OR jsonb_typeof("p") <> 'object' THEN RAISE EXCEPTION 'Chưa chọn chủ trì hoặc người theo dõi mới.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF nullif("p" ->> 'chu_tri', '') IS NOT NULL THEN
    SELECT * INTO v_ct FROM "public"."accounts" WHERE "id" = ("p" ->> 'chu_tri')::uuid;
    IF v_ct."id" IS NULL OR v_ct."is_system" OR coalesce(v_ct."bi_khoa", false) OR v_ct."role_group" = 'A0' THEN
      RAISE EXCEPTION 'Chủ trì mới phải là cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_ct."department" LIMIT 1;
    IF v_dv."ma" IS NULL AND v_ct."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
    IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (phòng) của chủ trì mới.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF nullif("p" ->> 'nguoi_theo_doi', '') IS NOT NULL THEN
    SELECT * INTO v_td FROM "public"."accounts" WHERE "id" = ("p" ->> 'nguoi_theo_doi')::uuid;
    IF v_td."id" IS NULL OR v_td."is_system" OR coalesce(v_td."bi_khoa", false) OR v_td."role_group" = 'A0' THEN
      RAISE EXCEPTION 'Người theo dõi mới phải là cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_doi_ct := v_ct."id" IS NOT NULL AND v_ct."id" IS DISTINCT FROM v."owner_tai_khoan";
  v_doi_td := v_td."id" IS NOT NULL AND v_td."id" IS DISTINCT FROM v."nguoi_theo_doi";
  IF NOT (v_doi_ct OR v_doi_td) THEN RAISE EXCEPTION 'Chủ trì, người theo dõi mới trùng hiện tại — không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  SELECT coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = v."owner_tai_khoan"),
                  (SELECT regexp_replace("ten", '^\d+\.\s*', '') FROM "public"."dm_don_vi" WHERE "ma" = v."owner_don_vi_ma"), '(chưa có)') INTO v_cu_ct;
  SELECT coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = v."nguoi_theo_doi"), '(chưa có)') INTO v_cu_td;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3: cột chủ trì / người theo dõi chỉ đổi qua hàm (trigger 0023 kiểm chủ trì khớp đơn vị)
  UPDATE "public"."nhiem_vu" SET
    "owner_tai_khoan" = CASE WHEN v_doi_ct THEN v_ct."id" ELSE "owner_tai_khoan" END,
    "owner_don_vi_ma" = CASE WHEN v_doi_ct THEN v_dv."ma" ELSE "owner_don_vi_ma" END,
    "cap_nhan_san_pham" = CASE WHEN v_doi_ct THEN "public"."kl_cap_nhan_mac_dinh"(v_ct, v_dv) ELSE "cap_nhan_san_pham" END,
    "nguoi_theo_doi" = CASE WHEN v_doi_td THEN v_td."id" ELSE "nguoi_theo_doi" END
  WHERE "id" = v."id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_nd := concat_ws(' · ', CASE WHEN v_doi_ct THEN format('chủ trì: %s → %s', v_cu_ct, v_ct."full_name") END,
                           CASE WHEN v_doi_td THEN format('người theo dõi: %s → %s', v_cu_td, v_td."full_name") END) || ' — lý do: ' || v_ly_do;
  PERFORM "public"."kl_ghi_vet_viec"(v."id", 'doi_chu_tri', v_nd, format('Đổi chủ trì theo dõi · %s: %s', v."ma", left(v_nd, 300)),
                                     ARRAY[v."owner_tai_khoan", v."nguoi_theo_doi"]);
  RETURN jsonb_build_object('chu_tri', CASE WHEN v_doi_ct THEN v_ct."id" ELSE v."owner_tai_khoan" END, 'nguoi_theo_doi', CASE WHEN v_doi_td THEN v_td."id" ELSE v."nguoi_theo_doi" END);
END;
$$;
REVOKE ALL ON FUNCTION "public"."doi_chu_tri"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."doi_chu_tri"(uuid, jsonb, text) TO "authenticated";

-- ---- 7 ---- (bản 0096 + thư ký: mọi dòng của các bảng đọc theo kl_xem_tat_ca)
CREATE OR REPLACE FUNCTION "public"."kl_tham_chieu_pham_vi"("p_nguoi" uuid) RETURNS TABLE ("bang" text, "ids" text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tk boolean;
BEGIN
  IF "p_nguoi" IS NULL THEN RAISE EXCEPTION 'Thiếu tài khoản cần đối chiếu.' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', "p_nguoi", 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', "p_nguoi"::text, true);
  IF "auth"."uid"() IS DISTINCT FROM "p_nguoi" THEN RAISE EXCEPTION 'Không đặt được người cần đối chiếu (auth.uid() khác p_nguoi).' USING ERRCODE = '42501'; END IF;
  v_tk := "public"."kl_la_thu_ky_tt"();   -- 0124: thư ký Thường trực đọc mọi nhiệm vụ
  RETURN QUERY
  WITH nv AS (
    SELECT n.* FROM "public"."nhiem_vu" n
    WHERE v_tk OR "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")
       OR n."tao_boi" = "auth"."uid"()   -- 0096: như kl_nhiem_vu_thay_duoc — người nhập xem lại việc mình nhập
       OR ("public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n)))
  ), goc AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE v_tk OR "public"."kl_thay_nhiem_vu"(n."id")),
  tk AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE v_tk OR ("public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n))))
  SELECT x.b, array_agg(x.i ORDER BY x.i) FROM (
  SELECT 'nhiem_vu', nv."id"::text FROM nv
  UNION ALL SELECT 'v_nhiem_vu', nv."id"::text FROM nv
  UNION ALL SELECT 'v_ngoai_le', nv."id"::text FROM nv CROSS JOIN LATERAL "public"."trang_thai"(nv, "public"."kl_hom_nay"()) t
    WHERE t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') OR (nv."bi_tu_choi" AND nv."tien_do_ma" <> 'HOAN_THANH')
  UNION ALL SELECT 'van_ban_giao_viec', v."id"::text FROM "public"."van_ban_giao_viec" v
    WHERE "public"."me_quan_tri_kl"() OR EXISTS (SELECT 1 FROM nv WHERE nv."van_ban_id" = v."id")
  UNION ALL SELECT 'lich_su', l."id"::text FROM "public"."lich_su" l WHERE l."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'chi_dao', c."id"::text FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'minh_chung', m."id"::text FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'canh_bao', c."id"::text FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" IN (SELECT "id" FROM goc)
  UNION ALL SELECT 'dinh_chinh', d."id"::text FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" IN (SELECT "id" FROM goc)
  UNION ALL SELECT 'tu_choi', t."id"::text FROM "public"."tu_choi" t WHERE "public"."tu_choi_thay"(t."nguoi_de_nghi", t."cap_duyet")
    OR "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")   -- 0083: thành viên nhóm được thay mặt trong phạm vi việc
  ) x(b, i) GROUP BY x.b;
END;
$$;
