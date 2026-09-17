-- 0037 — GĐ22 (3/3): canh_bao_quet nhắc lại theo độ khẩn (kl_nguong_do_khan.nhac_lai), thêm hai vòng: TT_CHUA_NHAN (việc Thường trực giao
-- quá thuong_truc_han_nhan_ngay ngày làm việc chưa xác nhận nhận việc → nhắc người nhận + Chánh VP, hằng ngày) và HOA_TOC_CHUA_NHAN (việc /
-- chỉ đạo Hỏa tốc quá hoa_toc_da_nhan_gio giờ làm việc chưa bấm Đã nhận → mỗi lần quét trong giờ làm việc nhắc người nhận + cấp trên trực
-- tiếp + Chánh VP; p_luc để test đặt mốc). v_nhiem_vu/v_ngoai_le thêm cột độ khẩn, ưu tiên, thay mặt, thứ tự (do_khan → Thường trực giao →
-- bị từ chối → mức → ngày trễ). v_dien_bien: một dòng thời gian gộp lịch sử, chỉ đạo/phản hồi, từ chối (lý do chỉ theo RLS tu_choi),
-- minh chứng, cảnh báo. kl_so_chua_xu_ly(): số chưa xử lý cho huy hiệu menu và dải "Cần xử lý ngay". tu_choi vào realtime.

ALTER TABLE "public"."canh_bao" DROP CONSTRAINT "canh_bao_muc_check", DROP CONSTRAINT "canh_bao_tt_co_chi_dao",
  ADD CONSTRAINT "canh_bao_muc_check" CHECK ("muc" IN ('VANG', 'DO', 'DO_DAC_BIET', 'CHI_DAO_TT', 'TU_CHOI', 'TT_CHUA_NHAN', 'HOA_TOC_CHUA_NHAN')),
  ADD CONSTRAINT "canh_bao_tt_co_chi_dao" CHECK (("muc" <> 'CHI_DAO_TT' OR "chi_dao_id" IS NOT NULL) AND ("chi_dao_id" IS NULL OR "muc" IN ('CHI_DAO_TT', 'HOA_TOC_CHUA_NHAN')));
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tu_choi";

-- 1. Một lần gửi = dòng canh_bao + lich_su (Hệ thống) + tin he_thong cho từng người (không trùng, không A0/hệ thống). Trả id dòng canh_bao.
CREATE FUNCTION "public"."canh_bao_ghi"("p_nv" uuid, "p_chi_dao" uuid, "p_muc" text, "p_ngay" date, "p_nguoi" uuid[], "p_tin" text) RETURNS bigint
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nguoi uuid[]; v_id bigint;
BEGIN
  SELECT coalesce(array_agg(DISTINCT u), '{}') INTO v_nguoi FROM unnest("p_nguoi") u JOIN "public"."accounts" a ON a."id" = u WHERE NOT a."is_system" AND a."role_group" <> 'A0';
  INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "chi_dao_id", "muc", "ngay", "nguoi_nhan") VALUES ("p_nv", "p_chi_dao", "p_muc", "p_ngay", v_nguoi) RETURNING "id" INTO v_id;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon") VALUES ("p_nv", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', "p_tin", 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id") SELECT NULL, u, "p_tin", false, 'he_thong', "p_nv" FROM unnest(v_nguoi) u;
  RETURN v_id;
END;
$$;
-- Người nhận việc (Owner tài khoản, không có thì người theo dõi) đã xác nhận nhận việc chưa.
CREATE FUNCTION "public"."da_nhan_viec"("p_nv" "public"."nhiem_vu") RETURNS boolean LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = ("p_nv")."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" IN (("p_nv")."owner_tai_khoan", ("p_nv")."nguoi_theo_doi"));
$$;

-- 2. canh_bao_quet (0034) → (p_ngay, p_luc): 5 vòng. Trả jsonb như cũ, gui thêm hai khoá mới.
DROP FUNCTION "public"."canh_bao_quet"(date);
CREATE FUNCTION "public"."canh_bao_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"(), "p_luc" timestamp with time zone DEFAULT now()) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  v_han_duyet integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'tu_choi_han_duyet_ngay'), 2), 0);
  v_tt_ngay integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'thuong_truc_han_nhan_ngay'), 1), 0);
  v_gio numeric := greatest(coalesce((SELECT "gia_tri"::numeric FROM "public"."kl_cau_hinh" WHERE "khoa" = 'hoa_toc_da_nhan_gio'), 2), 0);
  v_n integer := ("public"."kl_nguong_do_khan"('THUONG') ->> 'nhac_lai')::integer;
  v_cvp uuid := (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1);
  v_trong_gio boolean := "public"."gio_lam_viec_sau"("p_luc", 0) <= "p_luc";
  r record; v_nguoi uuid[]; v_tin text; v_ids bigint[] := ARRAY[]::bigint[]; v_quet integer := 0; v_bo_qua integer := 0;
  v_gui jsonb := jsonb_build_object('VANG', 0, 'DO', 0, 'DO_DAC_BIET', 0, 'CHI_DAO_TT', 0, 'TU_CHOI', 0, 'TT_CHUA_NHAN', 0, 'HOA_TOC_CHUA_NHAN', 0);
BEGIN
  IF "p_ngay" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày tính' USING ERRCODE = '22023'; END IF;
  -- Vòng 1: mức Vàng/Đỏ/Đỏ đặc biệt theo trang_thai; nhắc lại sau N ngày theo độ khẩn của việc (Thường 3, Khẩn 2, Thượng khẩn/Hỏa tốc 1).
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."han_xu_ly", nv."do_khan", (t.tt)."muc_canh_bao" AS muc, (t.tt)."so_ngay_qua" AS so_ngay_qua, ("public"."kl_nguong_do_khan"(nv."do_khan") ->> 'nhac_lai')::integer AS n
    FROM "public"."nhiem_vu" nv CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "p_ngay") AS tt) t
    WHERE nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH' AND (t.tt)."muc_canh_bao" IN ('VANG', 'DO', 'DO_DAC_BIET') ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" > "p_ngay" - r.n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM "public"."canh_bao_nguoi_nhan"(r.nv, r.muc) u;
    v_tin := format('%s · %s: %s%s', "public"."canh_bao_ten_muc"(r.muc), r."ma", CASE WHEN r."do_khan" <> 'THUONG' THEN '[' || "public"."ten_do_khan"(r."do_khan") || '] ' ELSE '' END,
      CASE r.muc WHEN 'VANG' THEN format('còn %s ngày tới hạn %s, chưa có minh chứng', r."han_xu_ly" - "p_ngay", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'DO' THEN format('quá hạn %s ngày (hạn %s)', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        ELSE format('quá hạn %s ngày (hạn %s), đã báo lãnh đạo Văn phòng', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY')) END);
    v_ids := v_ids || "public"."canh_bao_ghi"(r."id", NULL, r.muc, "p_ngay", v_nguoi, v_tin);
    v_gui := jsonb_set(v_gui, ARRAY[r.muc], to_jsonb((v_gui ->> r.muc)::integer + 1));
  END LOOP;
  -- Vòng 2: chỉ đạo Thường trực quá hạn phản hồi (0032), nhắc lại theo độ khẩn của chỉ đạo.
  FOR r IN
    SELECT c."id", c."nhiem_vu_id", c."han_phan_hoi", c."noi_dung", c."nguoi_nhan", nv."ma", ("public"."kl_nguong_do_khan"(c."do_khan") ->> 'nhac_lai')::integer AS n
    FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
    WHERE c."loai" = 'CHI_DAO_TT' AND c."trang_thai" = 'CHO_PHAN_HOI' AND c."han_phan_hoi" < "p_ngay" ORDER BY nv."ma", c."created_at"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."chi_dao_id" = r."id" AND c."muc" = 'CHI_DAO_TT' AND c."ngay" > "p_ngay" - r.n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM unnest(r."nguoi_nhan") u WHERE NOT EXISTS (SELECT 1 FROM "public"."chi_dao" p WHERE p."tra_loi_cho" = r."id" AND p."nguoi_gui" = u);
    IF cardinality(v_nguoi) = 0 THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Chỉ đạo Thường trực quá hạn phản hồi · %s: quá %s ngày (hạn %s) — %s', r."ma", "p_ngay" - r."han_phan_hoi", to_char(r."han_phan_hoi", 'DD/MM/YYYY'), left(btrim(r."noi_dung"), 80));
    v_ids := v_ids || "public"."canh_bao_ghi"(r."nhiem_vu_id", r."id", 'CHI_DAO_TT', "p_ngay", v_nguoi, v_tin);
    v_gui := jsonb_set(v_gui, ARRAY['CHI_DAO_TT'], to_jsonb((v_gui ->> 'CHI_DAO_TT')::integer + 1));
  END LOOP;
  -- Vòng 3: đề nghị từ chối chờ duyệt quá N ngày làm việc (0034).
  FOR r IN
    SELECT t."id", t."nhiem_vu_id", t."cap_duyet", nv."ma", a."full_name", (t."tao_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ngay_dn
    FROM "public"."tu_choi" t JOIN "public"."nhiem_vu" nv ON nv."id" = t."nhiem_vu_id" JOIN "public"."accounts" a ON a."id" = t."nguoi_de_nghi"
    WHERE t."trang_thai" = 'CHO_DUYET' AND "public"."ngay_lam_viec_sau"((t."tao_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, v_han_duyet) < "p_ngay" ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."nhiem_vu_id" AND c."muc" = 'TU_CHOI' AND c."ngay" > "p_ngay" - v_n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Đề nghị từ chối chờ duyệt · %s: %s đề nghị từ %s, quá %s ngày làm việc chưa duyệt', r."ma", r."full_name", to_char(r.ngay_dn, 'DD/MM/YYYY'), v_han_duyet);
    v_ids := v_ids || "public"."canh_bao_ghi"(r."nhiem_vu_id", NULL, 'TU_CHOI', "p_ngay", ARRAY[r."cap_duyet"], v_tin);
    v_gui := jsonb_set(v_gui, ARRAY['TU_CHOI'], to_jsonb((v_gui ->> 'TU_CHOI')::integer + 1));
  END LOOP;
  -- Vòng 4: việc Thường trực giao quá N ngày làm việc chưa xác nhận nhận việc → người nhận + Chánh VP, mỗi ngày một lần.
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."noi_dung", nv."owner_tai_khoan", nv."nguoi_theo_doi" FROM "public"."nhiem_vu" nv
    WHERE nv."uu_tien" = 'THUONG_TRUC' AND nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH' AND NOT nv."bi_tu_choi"
      AND "public"."ngay_lam_viec_sau"((nv."created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, v_tt_ngay) < "p_ngay" ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF "public"."da_nhan_viec"(r.nv) OR EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = 'TT_CHUA_NHAN' AND c."ngay" >= "p_ngay") THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Việc Thường trực giao chưa xác nhận nhận · %s: %s — quá %s ngày làm việc chưa xác nhận nhận việc', r."ma", left(r."noi_dung", 80), v_tt_ngay);
    v_ids := v_ids || "public"."canh_bao_ghi"(r."id", NULL, 'TT_CHUA_NHAN', "p_ngay", ARRAY[r."owner_tai_khoan", r."nguoi_theo_doi", v_cvp], v_tin);
    v_gui := jsonb_set(v_gui, ARRAY['TT_CHUA_NHAN'], to_jsonb((v_gui ->> 'TT_CHUA_NHAN')::integer + 1));
  END LOOP;
  -- Vòng 5: Hỏa tốc quá N giờ làm việc chưa "Đã nhận" — chỉ trong giờ làm việc, mỗi lần quét (chống trùng 50 phút); việc rồi chỉ đạo.
  IF v_trong_gio THEN
    FOR r IN
      SELECT nv."id", nv."ma", nv."noi_dung", coalesce(nv."owner_tai_khoan", nv."nguoi_theo_doi") AS nhan, NULL::uuid AS cd FROM "public"."nhiem_vu" nv
      WHERE nv."do_khan" = 'HOA_TOC' AND nv."theo_1400" AND nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH' AND NOT nv."bi_tu_choi"
        AND "public"."gio_lam_viec_sau"(nv."created_at", v_gio) < "p_luc" AND NOT "public"."da_nhan_viec"(nv)
      UNION ALL
      SELECT nv."id", nv."ma", c."noi_dung", u, c."id" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
      CROSS JOIN LATERAL unnest(CASE WHEN c."loai" = 'CHI_DAO_TT' THEN c."nguoi_nhan" ELSE ARRAY[coalesce(nv."owner_tai_khoan", nv."nguoi_theo_doi")] END) u
      WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (u = ANY (c."da_nhan"))
        AND "public"."gio_lam_viec_sau"(c."created_at", v_gio) < "p_luc"
      ORDER BY 2, 5
    LOOP
      v_quet := v_quet + 1;
      IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."chi_dao_id" IS NOT DISTINCT FROM r.cd AND c."muc" = 'HOA_TOC_CHUA_NHAN' AND c."gui_luc" > "p_luc" - interval '50 minutes' AND r.nhan = ANY (c."nguoi_nhan")) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
      v_tin := format('Hỏa tốc chưa Đã nhận · %s: %s — %s quá %s giờ làm việc chưa bấm Đã nhận', r."ma", left(r."noi_dung", 80), (SELECT "full_name" FROM "public"."accounts" WHERE "id" = r.nhan), v_gio);
      v_ids := v_ids || "public"."canh_bao_ghi"(r."id", r.cd, 'HOA_TOC_CHUA_NHAN', "p_ngay", ARRAY[r.nhan, "public"."lanh_dao_truc_tiep"(r.nhan), v_cvp], v_tin);
      v_gui := jsonb_set(v_gui, ARRAY['HOA_TOC_CHUA_NHAN'], to_jsonb((v_gui ->> 'HOA_TOC_CHUA_NHAN')::integer + 1));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ngay', "p_ngay", 'quet', v_quet, 'gui', v_gui, 'bo_qua', v_bo_qua,
    'tin', (SELECT coalesce(sum(cardinality(c."nguoi_nhan")), 0) FROM "public"."canh_bao" c WHERE c."id" = ANY (v_ids)),
    'theo_nguoi_nhan', coalesce((SELECT jsonb_agg(jsonb_build_object('tai_khoan', s.username, 'so_tin', s.n) ORDER BY s.n DESC, s.username)
      FROM (SELECT a."username", count(*) AS n FROM "public"."canh_bao" c CROSS JOIN LATERAL unnest(c."nguoi_nhan") u JOIN "public"."accounts" a ON a."id" = u
            WHERE c."id" = ANY (v_ids) GROUP BY a."username") s), '[]'::jsonb));
END;
$$;

-- 3. v_nhiem_vu (0028) + do_khan, uu_tien, giao_thay_mat_cho(_ten), thu_tu_do_khan (1 = Hỏa tốc … 4 = Thường) ở cuối.
CREATE OR REPLACE VIEW "public"."v_nhiem_vu" WITH ("security_invoker" = true) AS
SELECT nv."id", nv."ma", nv."van_ban_id", vb."loai" AS "van_ban_loai", vb."so_hoi_nghi", vb."so_ket_luan", vb."ngay_ban_hanh", vb."ngay_nhan" AS "van_ban_ngay_nhan",
       nv."nguoi_theo_doi", td."full_name" AS "nguoi_theo_doi_ten", td."department" AS "nguoi_theo_doi_phong",
       nv."owner_don_vi_ma", dv."ten" AS "owner_don_vi_ten", dv."trong_van_phong" AS "owner_trong_van_phong", dv."phong" AS "owner_phong",
       nv."owner_tai_khoan", ow."full_name" AS "owner_tai_khoan_ten",
       nv."san_pham_loai", sp."ten" AS "san_pham_ten", nv."san_pham_mo_ta",
       nv."cap_nhan_san_pham", cn."ten" AS "cap_nhan_san_pham_ten", nv."cap_quyet_dinh", cq."ten" AS "cap_quyet_dinh_ten",
       nv."ngay_nhan_van_ban", nv."ngay_nhan_uoc_tinh", nv."nhiem_vu_cha", nv."theo_1400",
       nv."nganh_ma", dn."ten" AS "nganh_ten", nv."linh_vuc_ma", lv."ten" AS "linh_vuc_ten", nv."linh_vuc_chi_tiet",
       nv."noi_dung", nv."loai_thoi_han_ma", dl."ten" AS "loai_thoi_han_ten",
       nv."han_xu_ly", nv."ly_do_chua_co_han", nv."tien_do_ma", nv."ngay_hoan_thanh", nv."minh_chung",
       nv."van_ban_trien_khai", nv."so_lan_gia_han", nv."nguon", nv."ghi_chu", nv."thieu_minh_chung",
       nv."dong_luc", nv."cap_nhat_luc", nv."cap_nhat_boi", nv."tao_boi", nv."created_at",
       (tt).trang_thai, (tt).so_ngay_qua, (tt).ket_qua, (tt).so_ngay_tre, (tt).do_tre_nhap_lieu,
       (tt).dang_dinh_chinh, (tt).nhom_dem, (tt).muc_canh_bao, (tt).lead_time_ngay,
       ("public"."kl_hom_nay"() - vb."ngay_ban_hanh")::integer AS "tuoi_ngay",
       (SELECT count(*) FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = nv."id" AND c."trang_thai" = 'CHO_PHAN_HOI')::integer AS "so_chi_dao_cho_phan_hoi",
       (SELECT count(*) FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = nv."id" AND "public"."minh_chung_la_hop_le"(m))::integer AS "so_minh_chung_hop_le",
       (SELECT to_jsonb(x) FROM (SELECT m."id", m."loai", m."so_hieu", m."ngay_van_ban", m."cap_nhan", mc."ten" AS "cap_nhan_ten", m."hop_le", m."nop_luc"
                                 FROM "public"."minh_chung" m LEFT JOIN "public"."dm_cap" mc ON mc."ma" = m."cap_nhan"
                                 WHERE m."nhiem_vu_id" = nv."id" ORDER BY m."nop_luc" DESC LIMIT 1) x) AS "minh_chung_moi_nhat",
       nv."do_khan", nv."uu_tien", nv."giao_thay_mat_cho", tm."full_name" AS "giao_thay_mat_cho_ten",
       CASE nv."do_khan" WHEN 'HOA_TOC' THEN 1 WHEN 'THUONG_KHAN' THEN 2 WHEN 'KHAN' THEN 3 ELSE 4 END AS "thu_tu_do_khan", nv."bi_tu_choi"
FROM "public"."nhiem_vu" nv
CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "public"."kl_hom_nay"()) AS tt) t
JOIN "public"."van_ban_giao_viec" vb ON vb."id" = nv."van_ban_id"
LEFT JOIN "public"."accounts_public" td ON td."id" = nv."nguoi_theo_doi"
LEFT JOIN "public"."accounts_public" ow ON ow."id" = nv."owner_tai_khoan"
LEFT JOIN "public"."accounts_public" tm ON tm."id" = nv."giao_thay_mat_cho"
LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = nv."owner_don_vi_ma"
LEFT JOIN "public"."dm_san_pham" sp ON sp."ma" = nv."san_pham_loai"
LEFT JOIN "public"."dm_cap" cn ON cn."ma" = nv."cap_nhan_san_pham"
LEFT JOIN "public"."dm_cap" cq ON cq."ma" = nv."cap_quyet_dinh"
LEFT JOIN "public"."dm_nganh" dn ON dn."ma" = nv."nganh_ma"
LEFT JOIN "public"."dm_linh_vuc" lv ON lv."ma" = nv."linh_vuc_ma"
LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl."ma" = nv."loai_thoi_han_ma";

-- 4. v_ngoai_le (0034) + cột độ khẩn/ưu tiên/thay mặt; thứ tự: độ khẩn → Thường trực giao → bị từ chối → mức → số ngày trễ → mã.
CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH ("security_invoker" = true) AS
SELECT v."id", v."ma", v."noi_dung", v."theo_1400", v."so_hoi_nghi", v."so_ket_luan", v."van_ban_loai",
       v."owner_don_vi_ma", v."owner_don_vi_ten", v."owner_trong_van_phong", v."owner_tai_khoan", v."owner_tai_khoan_ten",
       coalesce(v."owner_tai_khoan_ten", v."owner_don_vi_ten") AS "owner_ten",
       v."so_ngay_qua", v."han_xu_ly", v."so_lan_gia_han", v."muc_canh_bao",
       v."san_pham_loai", v."san_pham_mo_ta",
       coalesce(v."san_pham_ten" || coalesce(': ' || v."san_pham_mo_ta", ''), 'chưa định nghĩa') AS "san_pham_ten",
       v."cap_quyet_dinh", coalesce(v."cap_quyet_dinh_ten", 'chưa xác định') AS "cap_quyet_dinh_ten",
       v."nguoi_theo_doi", v."nguoi_theo_doi_ten", v."nguoi_theo_doi_phong",
       v."dang_dinh_chinh", CASE WHEN v."dang_dinh_chinh" THEN 'DANG_TRA_SOAT' WHEN v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END AS "nhom",
       v."so_chi_dao_cho_phan_hoi", v."cap_nhat_luc", v."cap_nhat_boi",
       CASE
         WHEN n."bi_tu_choi" THEN 'BI_TU_CHOI'
         WHEN v."cap_quyet_dinh" IS NOT NULL THEN 'CHO_QUYET'
         WHEN EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS NULL) THEN 'CHO_MINH_CHUNG'
         WHEN v."theo_1400" AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = v."id" AND l."cot" = 'xac_nhan_nhan_viec') THEN 'CHUA_NHAN'
         ELSE 'CHUA_SAN_PHAM' END AS "khau",
       n."bi_tu_choi", v."do_khan", v."uu_tien", v."giao_thay_mat_cho", v."giao_thay_mat_cho_ten", v."thu_tu_do_khan"
FROM "public"."v_nhiem_vu" v JOIN "public"."nhiem_vu" n ON n."id" = v."id"
WHERE v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') OR (n."bi_tu_choi" AND n."tien_do_ma" <> 'HOAN_THANH')
ORDER BY v."thu_tu_do_khan", (v."uu_tien" IS NOT DISTINCT FROM 'THUONG_TRUC') DESC, n."bi_tu_choi" DESC, (v."muc_canh_bao" = 'DO_DAC_BIET') DESC, v."so_ngay_qua" DESC, v."ma";

-- 5. v_dien_bien: dòng thời gian một việc, mới nhất trước. nguon: lich_su | canh_bao | tu_choi (vết không lý do) | tu_choi_ly_do (chỉ RLS tu_choi)
--    | chi_dao | phan_hoi | minh_chung. Dòng lich_su cot chi_dao/minh_chung_* bỏ (đã có từ bảng gốc), trừ "Đóng…"/"Đã nhận…" chỉ có ở lich_su.
CREATE VIEW "public"."v_dien_bien" WITH ("security_invoker" = true) AS
SELECT 'ls-' || l."id" AS "id", l."nhiem_vu_id", l."luc", CASE l."cot" WHEN 'canh_bao' THEN 'canh_bao' WHEN 'tu_choi' THEN 'tu_choi' ELSE 'lich_su' END AS "nguon", l."cot" AS "loai",
       l."nguoi_sua" AS "nguoi", coalesce(a."full_name", l."nguoi_sua_ghi_chu", CASE WHEN l."nguon" = 'excel' THEN 'Nhật ký Excel' ELSE 'Hệ thống' END) AS "nguoi_ten",
       l."gia_tri_moi" AS "noi_dung", l."gia_tri_cu", NULL::text AS "trang_thai", NULL::uuid AS "chi_dao_id"
FROM "public"."lich_su" l LEFT JOIN "public"."accounts_public" a ON a."id" = l."nguoi_sua"
WHERE (l."cot" <> 'chi_dao' OR l."gia_tri_moi" ~ '^(Đóng|Đã nhận)') AND l."cot" NOT LIKE 'minh_chung_%'
UNION ALL
SELECT 'cd-' || c."id", c."nhiem_vu_id", c."created_at", CASE WHEN c."loai" = 'PHAN_HOI' THEN 'phan_hoi' ELSE 'chi_dao' END, c."loai", c."nguoi_gui", a."full_name",
       c."noi_dung", CASE WHEN c."do_khan" <> 'THUONG' THEN "public"."ten_do_khan"(c."do_khan") END, c."trang_thai", coalesce(c."tra_loi_cho", c."id")
FROM "public"."chi_dao" c LEFT JOIN "public"."accounts_public" a ON a."id" = c."nguoi_gui"
UNION ALL
SELECT 'tc-' || t."id", t."nhiem_vu_id", t."tao_luc", 'tu_choi_ly_do', t."trang_thai", t."nguoi_de_nghi", a."full_name", 'Lý do: ' || t."ly_do", t."y_kien_duyet", t."trang_thai", NULL
FROM "public"."tu_choi" t LEFT JOIN "public"."accounts_public" a ON a."id" = t."nguoi_de_nghi"
UNION ALL
SELECT 'mc-' || m."id", m."nhiem_vu_id", m."nop_luc", 'minh_chung', 'nop', m."nop_boi", a."full_name",
       format('Nộp minh chứng %s', concat_ws(' · ', m."so_hieu", to_char(m."ngay_van_ban", 'DD/MM/YYYY'), m."cap_nhan", left(m."noi_dung_chu", 80))), NULL,
       CASE WHEN m."hop_le" IS NULL THEN 'CHO_XAC_NHAN' WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."nop_boi"
UNION ALL
SELECT 'mx-' || m."id", m."nhiem_vu_id", m."xac_nhan_luc", 'minh_chung', 'xac_nhan', m."xac_nhan_boi", a."full_name",
       format('%s minh chứng %s%s', CASE WHEN m."hop_le" THEN 'Xác nhận hợp lệ' ELSE 'Không hợp lệ' END, coalesce(m."so_hieu", ''), coalesce(' — ' || m."ly_do_khong_hop_le", '')), NULL,
       CASE WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."xac_nhan_boi" WHERE m."xac_nhan_luc" IS NOT NULL
ORDER BY 3 DESC, 1 DESC;

-- 6. kl_so_chua_xu_ly() → {nhan_tin, can_quyet, de_nghi_cho_duyet, bi_tu_choi, tt_cho_nhan, viec_moi, hoa_toc_viec, hoa_toc_chi_dao, hoa_toc: [...]}
--    (SECURITY INVOKER: mọi số đếm trên dòng RLS trả về; hoa_toc = việc/chỉ đạo Hỏa tốc TÔI là người nhận chưa bấm Đã nhận, cho thanh đỏ).
CREATE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE "sql" STABLE SECURITY INVOKER SET "search_path" = "public" AS $$
  WITH me AS (SELECT "id", "role_group" FROM "public"."accounts" WHERE "id" = "auth"."uid"()),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL),
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'can_quyet', (SELECT count(*) FROM "public"."v_ngoai_le" v, me WHERE v."nhom" = 'DO' AND v."cap_quyet_dinh" = ANY (CASE me."role_group"
                    WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG'] WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END)),
    'de_nghi_cho_duyet', (SELECT count(*) FROM "public"."tu_choi" t, me WHERE t."trang_thai" = 'CHO_DUYET'
                    AND (t."cap_duyet" = me."id" OR (me."role_group" = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = t."cap_duyet") = 'A0'))),
    'bi_tu_choi', (SELECT count(*) FROM mo n, me WHERE n."bi_tu_choi" AND (me."role_group" IN ('A0', 'A1', 'A2') OR n."tao_boi" = me."id" OR n."giao_thay_mat_cho" = me."id")),
    'tt_cho_nhan', (SELECT count(*) FROM cua_toi WHERE "uu_tien" = 'THUONG_TRUC'),
    'viec_moi', (SELECT count(*) FROM cua_toi),
    'hoa_toc_viec', (SELECT count(*) FROM cua_toi WHERE "do_khan" = 'HOA_TOC'),
    'hoa_toc_chi_dao', (SELECT count(*) FROM ht_cd),
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;

DO $$ BEGIN
  REVOKE ALL ON FUNCTION "public"."canh_bao_quet"(date, timestamptz) FROM public, "anon", "authenticated";
  GRANT EXECUTE ON FUNCTION "public"."canh_bao_quet"(date, timestamptz) TO "service_role";
  REVOKE ALL ON FUNCTION "public"."canh_bao_ghi"(uuid, uuid, text, date, uuid[], text) FROM public, "anon", "authenticated";
  REVOKE ALL ON FUNCTION "public"."da_nhan_viec"(public.nhiem_vu) FROM public, "anon";
  GRANT EXECUTE ON FUNCTION "public"."da_nhan_viec"(public.nhiem_vu) TO "authenticated";
  REVOKE ALL ON TABLE "public"."v_dien_bien" FROM "anon"; GRANT SELECT ON TABLE "public"."v_dien_bien" TO "authenticated";
  REVOKE ALL ON FUNCTION "public"."kl_so_chua_xu_ly"() FROM public, "anon"; GRANT EXECUTE ON FUNCTION "public"."kl_so_chua_xu_ly"() TO "authenticated";
END $$;
