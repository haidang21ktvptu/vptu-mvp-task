-- 0057: Nghiệm thu minh chứng (PR-2b, thiết kế A4, A6; Q2, Q3, Q8) + mở phạm vi đọc cho thư ký Thường trực + thu hẹp kl_tham_chieu_pham_vi.
-- 1. kl_viec_a0_giao_cvp(nv): việc Thường trực (A0, tao_boi) giao cho Chánh VP (chủ trì tài khoản) — loại việc thư ký nghiệm thu thay mặt (Q8).
-- 2. kl_duoc_nghiem_thu(nv) = MỘT điều kiện cho xac_nhan_minh_chung và danh sách "Cần nghiệm thu — Trong phạm vi" (kl_can_nghiem_thu, 0059):
--    quy tắc 0028 (người theo dõi ∨ kl_duoc_chi_dao ∨ quan_tri_kl còn hạn) + thư ký với việc ở (1); A0 bị loại tường minh.
-- 3. nguoi_nghiem_thu_chinh(nv, người nộp) → uuid[]: người nhận nhắc chính (bảng A6) — người giao (A1/A2) → A2 phòng chủ trì (chủ trì A3) →
--    PCVP phụ trách (kiêm nhiệm ưu tiên) → lãnh đạo trực tiếp người theo dõi (đơn vị ngoài Văn phòng) → Chánh VP; việc ở (1): mọi thư ký đang
--    giữ cờ, không có thì mọi quan_tri_kl còn hạn. Luôn khác người nộp, bỏ tài khoản hệ thống / bị khoá / A0. Rỗng ⇒ mọi quan_tri_kl còn hạn.
-- 4. xac_nhan_minh_chung 4 tham số (DROP bản 3 tham số trong cùng migration — PostgREST không thấy hai hàm trùng tên):
--    hợp lệ = NGHIỆM THU và (Q2) đóng việc cùng giao dịch, ngày hoàn thành = ngày văn bản của minh chứng; trả lại (việc đang mở) bắt buộc lý do +
--    hạn nộp lại trong [hôm nay, H] (chưa qua H) hoặc [hôm nay, ngày làm việc thứ 2 sau hôm nay] (đã qua H, Q3). Việc ở (1): lịch sử
--    "thay mặt Thường trực — <tên>".
-- 5. kl_nhiem_vu_thay_duoc: nhánh 4 — thư ký thấy việc ở (1) (bảng dùng p_ca_thu_ky = true; canh_bao / dinh_chinh vẫn false).
-- 6. kl_tham_chieu_pham_vi(p_nguoi): chỉ service_role gọi được (tài khoản thật trên production không gọi được); đặt request.jwt.claims và
--    request.jwt.claim.sub = p_nguoi trong giao dịch, kiểm auth.uid() = p_nguoi rồi tính theo QUY TẮC GỐC (thêm nhánh thư ký ở (1)).

CREATE FUNCTION "public"."kl_viec_a0_giao_cvp"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."accounts" g WHERE g."id" = ("p_nv")."tao_boi" AND g."role_group" = 'A0')
     AND EXISTS (SELECT 1 FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief");
$$;

CREATE FUNCTION "public"."kl_duoc_nghiem_thu"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT "auth"."uid"() IS NOT NULL AND NOT "public"."me_la_a0"() AND (
         n."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(n."id") OR "public"."me_quan_tri_kl"()
      OR ("public"."me_thu_ky_tt"() AND "public"."kl_viec_a0_giao_cvp"(n)))
    FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"), false);
$$;

CREATE FUNCTION "public"."nguoi_nghiem_thu_chinh"("p_nv" "public"."nhiem_vu", "p_nguoi_nop" uuid DEFAULT NULL) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH hl AS (
    SELECT a."id", a."username", a."role_group", a."department", a."is_chief", coalesce(a."thu_ky_thuong_truc", false) AS thu_ky,
           coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AS qtkl
    FROM "public"."accounts" a
    WHERE NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) AND a."role_group" <> 'A0' AND a."id" IS DISTINCT FROM "p_nguoi_nop"
  ), ow AS (SELECT a."role_group", a."department" FROM "public"."accounts" a WHERE a."id" = ("p_nv")."owner_tai_khoan"
  ), ph AS (
    SELECT coalesce((SELECT ow."department" FROM ow), (SELECT d."phong" FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND d."trong_van_phong")) AS p,
           coalesce((SELECT NOT d."trong_van_phong" FROM "public"."dm_don_vi" d WHERE d."ma" = ("p_nv")."owner_don_vi_ma" AND ("p_nv")."owner_tai_khoan" IS NULL), false) AS ngoai
  ), q8 AS (SELECT "public"."kl_viec_a0_giao_cvp"("p_nv") AS la
  ), ung_vien AS (
    SELECT 1 AS uu, h."id", h."username" FROM hl h WHERE h."id" = coalesce(("p_nv")."giao_thay_mat_cho", ("p_nv")."tao_boi") AND h."role_group" IN ('A1', 'A2')
    UNION ALL SELECT 2, h."id", h."username" FROM hl h, ow WHERE ow."role_group" = 'A3' AND h."role_group" = 'A2' AND h."department" = ow."department"
    UNION ALL SELECT 3, h."id", h."username" FROM ph CROSS JOIN LATERAL "public"."pcvp_phu_trach"(ph.p, ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") x(id)
              JOIN hl h ON h."id" = x.id WHERE NOT EXISTS (SELECT 1 FROM ow WHERE ow."role_group" = 'A1')
    UNION ALL SELECT 4, h."id", h."username" FROM ph, hl h WHERE ph.ngoai AND h."id" = "public"."lanh_dao_truc_tiep"(("p_nv")."nguoi_theo_doi")
    UNION ALL SELECT 5, h."id", h."username" FROM hl h WHERE h."role_group" = 'A1' AND h."is_chief"
  ), tat_ca_qtkl AS (SELECT array_agg(h."id" ORDER BY h."username") AS ds FROM hl h WHERE h.qtkl)
  SELECT CASE WHEN (SELECT la FROM q8)
    THEN coalesce((SELECT array_agg(h."id" ORDER BY h."username") FROM hl h WHERE h.thu_ky), (SELECT ds FROM tat_ca_qtkl), '{}'::uuid[])
    ELSE coalesce((SELECT ARRAY[u."id"] FROM ung_vien u ORDER BY u.uu, u."username" LIMIT 1), (SELECT ds FROM tat_ca_qtkl), '{}'::uuid[]) END;
$$;

DROP FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text);
CREATE FUNCTION "public"."xac_nhan_minh_chung"("p_id" uuid, "p_hop_le" boolean, "p_ly_do" text DEFAULT NULL, "p_han_nop_lai" date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mc "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), ''); v_t date := "public"."kl_hom_nay"();
        v_mo boolean; v_den date; v_thay text := ''; v_tin text;
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NOT NULL THEN SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id"; END IF;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_nghiem_thu"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ người theo dõi hoặc lãnh đạo trong phạm vi mới xác nhận minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."nop_boi" = "auth"."uid"() THEN RAISE EXCEPTION 'Không tự xác nhận minh chứng do chính mình nộp.' USING ERRCODE = '42501'; END IF;
  IF "p_hop_le" IS NULL THEN RAISE EXCEPTION 'Phải chọn Hợp lệ hoặc Không hợp lệ.' USING ERRCODE = '22023'; END IF;
  v_mo := v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL;
  IF NOT "p_hop_le" THEN
    IF v_ly_do IS NULL THEN RAISE EXCEPTION 'Bác minh chứng phải ghi lý do.' USING ERRCODE = '22023'; END IF;
    IF v_mo THEN
      IF "p_han_nop_lai" IS NULL THEN RAISE EXCEPTION 'Trả lại minh chứng phải có hạn nộp lại.' USING ERRCODE = '22023'; END IF;
      v_den := CASE WHEN v_nv."han_xu_ly" IS NULL THEN NULL WHEN v_t <= v_nv."han_xu_ly" THEN v_nv."han_xu_ly" ELSE "public"."ngay_lam_viec_sau"(v_t, 2) END;
      IF "p_han_nop_lai" < v_t OR "p_han_nop_lai" > v_den THEN
        RAISE EXCEPTION 'Hạn nộp lại phải từ % đến %.', to_char(v_t, 'DD/MM/YYYY'), coalesce(to_char(v_den, 'DD/MM/YYYY'), '…') USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  IF "public"."kl_viec_a0_giao_cvp"(v_nv) THEN
    v_thay := ' — thay mặt Thường trực — ' || coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), '');
  END IF;
  UPDATE "public"."minh_chung" SET "hop_le" = "p_hop_le", "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(),
    "ly_do_khong_hop_le" = CASE WHEN "p_hop_le" THEN NULL ELSE v_ly_do END,
    "han_nop_lai" = CASE WHEN "p_hop_le" OR NOT v_mo THEN NULL ELSE "p_han_nop_lai" END WHERE "id" = "p_id";
  v_tin := format('%s · %s: %s%s%s', CASE WHEN "p_hop_le" THEN 'Minh chứng hợp lệ (nghiệm thu)' ELSE 'Minh chứng bị trả lại' END, v_nv."ma",
                  coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)),
                  CASE WHEN "p_hop_le" THEN '' ELSE coalesce(' — nộp lại trước ' || to_char(CASE WHEN v_mo THEN "p_han_nop_lai" END, 'DD/MM/YYYY'), '') || ' — ' || v_ly_do END, v_thay);
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan', v_tin);
  IF v_thay <> '' AND NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN   -- thư ký: nguoi_lien_quan chỉ trả khi người gọi thấy việc theo quy tắc gốc
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT "auth"."uid"(), u, v_tin, false, 'he_thong', v_nv."id" FROM (SELECT DISTINCT unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) AS u) x
    WHERE u IS NOT NULL AND u <> "auth"."uid"();
  END IF;
  IF "p_hop_le" AND v_mo AND v_mc."ngay_van_ban" IS NOT NULL THEN   -- Q2: nghiệm thu = đóng việc, ngày hoàn thành = ngày văn bản minh chứng
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_mc."ngay_van_ban" WHERE "id" = v_nv."id";
    PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'dong_nhiem_vu',
      format('Nghiệm thu và đóng nhiệm vụ · %s: hoàn thành ngày %s%s', v_nv."ma", to_char(v_mc."ngay_van_ban", 'DD/MM/YYYY'), v_thay));
  END IF;
END;
$$;

-- kl_nhiem_vu_thay_duoc (0048) nguyên văn + nhánh 4 (thư ký, Q8).
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_thay_duoc"("p_ca_thu_ky" boolean DEFAULT true) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 300 AS $$
  WITH me AS (
    SELECT a."id", a."role_group", a."department",
           coalesce(a."is_chief" AND a."role_group" = 'A1', false) AS chief,
           coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AS qtkl,
           coalesce(a."thu_ky_thuong_truc", false) AS thu_ky
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  ), ca_phong AS (   -- phu_trach(tôi, phòng, hôm nay) cho A1 không phải Chánh VP: phân công cả phòng (nganh_ma NULL) đang hiệu lực
    SELECT p."phong" FROM "public"."phu_trach_phong" p
    WHERE p."lanh_dao_id" = "auth"."uid"() AND p."nganh_ma" IS NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), kn AS (         -- nguoi_kiem_nhiem(phòng, ngành, lĩnh vực, hôm nay) của MỌI người
    SELECT p."phong", p."nganh_ma", p."linh_vuc_ma", p."lanh_dao_id" FROM "public"."phu_trach_phong" p
    WHERE p."nganh_ma" IS NOT NULL AND p."linh_vuc_ma" IS NOT NULL AND p."lanh_dao_id" IS NOT NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), nv AS (
    SELECT n."id", n."nguoi_theo_doi", n."owner_tai_khoan", n."nganh_ma", n."linh_vuc_ma",
           td."department" AS phong_theo_doi, coalesce(oa."department", dv."phong") AS phong_owner   -- kl_phong_owner
    FROM "public"."nhiem_vu" n
    LEFT JOIN "public"."accounts" td ON td."id" = n."nguoi_theo_doi"
    LEFT JOIN "public"."accounts" oa ON oa."id" = n."owner_tai_khoan"
    LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = n."owner_don_vi_ma"
  )
  -- Ba nhánh UNION ALL (IN không cần khử trùng). Nhánh 1: người theo dõi / Owner — tra index, đủ cho A3 thường (đa số tài khoản; kiểm RLS
  -- của Realtime mỗi thay đổi chạy cho từng người). Nhánh 2, 3 có điều kiện chỉ đọc "me" ⇒ initplan, bị bỏ qua cả nhánh khi vai không cần.
  SELECT n."id" FROM "public"."nhiem_vu" n
  WHERE n."nguoi_theo_doi" = "auth"."uid"() OR n."owner_tai_khoan" = "auth"."uid"()
  UNION ALL
  SELECT nv."id"
  FROM nv
  CROSS JOIN me
  LEFT JOIN kn k1 ON k1."phong" = nv.phong_theo_doi AND k1."nganh_ma" = nv."nganh_ma" AND k1."linh_vuc_ma" = nv."linh_vuc_ma"
  LEFT JOIN kn k2 ON k2."phong" = nv.phong_owner AND k2."nganh_ma" = nv."nganh_ma" AND k2."linh_vuc_ma" = nv."linh_vuc_ma"
  WHERE (SELECT m.qtkl OR m."role_group" IN ('A0', 'A1', 'A2') FROM me m)
    AND (me.qtkl
      OR CASE me."role_group"
           WHEN 'A0' THEN true
           WHEN 'A1' THEN me.chief
             OR (nv.phong_theo_doi IS NOT NULL AND CASE WHEN k1."lanh_dao_id" IS NOT NULL THEN k1."lanh_dao_id" = "auth"."uid"()
                                                       ELSE nv.phong_theo_doi IN (SELECT c."phong" FROM ca_phong c) END)
             OR (nv.phong_owner IS NOT NULL AND CASE WHEN k2."lanh_dao_id" IS NOT NULL THEN k2."lanh_dao_id" = "auth"."uid"()
                                                    ELSE nv.phong_owner IN (SELECT c."phong" FROM ca_phong c) END)
           WHEN 'A2' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"
           ELSE false END)
  UNION ALL
  SELECT c."nhiem_vu_id" FROM "public"."chi_dao" c   -- thư ký Thường trực (0047): việc có ≥ 1 CHI_DAO_TT
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND c."loai" = 'CHI_DAO_TT'
  UNION ALL
  SELECT n."id" FROM "public"."nhiem_vu" n   -- 0057 (Q8): thư ký thấy việc Thường trực (A0) giao cho Chánh VP để nghiệm thu thay mặt
  JOIN "public"."accounts" g ON g."id" = n."tao_boi" AND g."role_group" = 'A0'
  JOIN "public"."accounts" o ON o."id" = n."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief"
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m);
$$;

-- Chuẩn đối chiếu (0048) — nay chỉ service_role: tính cho p_nguoi bằng cách đặt claims trong giao dịch (mọi hàm quy tắc gốc đọc auth.uid()).
DROP FUNCTION "public"."kl_tham_chieu_pham_vi"();
CREATE FUNCTION "public"."kl_tham_chieu_pham_vi"("p_nguoi" uuid) RETURNS TABLE ("bang" text, "ids" text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF "p_nguoi" IS NULL THEN RAISE EXCEPTION 'Thiếu tài khoản cần đối chiếu.' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', "p_nguoi", 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', "p_nguoi"::text, true);
  IF "auth"."uid"() IS DISTINCT FROM "p_nguoi" THEN RAISE EXCEPTION 'Không đặt được người cần đối chiếu (auth.uid() khác p_nguoi).' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH nv AS (
    SELECT n.* FROM "public"."nhiem_vu" n
    WHERE "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")
       OR ("public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n)))
  ), goc AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."kl_thay_nhiem_vu"(n."id")),
  tk AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n)))
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
  ) x(b, i) GROUP BY x.b;
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_viec_a0_giao_cvp"("public"."nhiem_vu") FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."nguoi_nghiem_thu_chinh"("public"."nhiem_vu", uuid) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."kl_duoc_nghiem_thu"(uuid) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text, date) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_tham_chieu_pham_vi"(uuid) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_duoc_nghiem_thu"(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text, date) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_tham_chieu_pham_vi"(uuid) TO "service_role";
