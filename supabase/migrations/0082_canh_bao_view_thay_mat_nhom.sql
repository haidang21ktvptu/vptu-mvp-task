-- 0082 (Đợt B v3.18, tiếp 0079–0081): canh_bao_quet — nhắc đề nghị từ chối quá hạn duyệt tới cả nhóm được thay mặt (thân hàm = bản 0060 + một dòng);
-- v_nhiem_vu, v_ngoai_le thêm cột cuối giao_thay_mat_nhom (CREATE OR REPLACE giữ nguyên thứ tự cột cũ).

CREATE OR REPLACE FUNCTION "public"."canh_bao_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"(), "p_luc" timestamp with time zone DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_han_duyet integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'tu_choi_han_duyet_ngay'), 2), 0);
  v_tt_ngay integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'thuong_truc_han_nhan_ngay'), 1), 0);
  v_gio numeric := greatest(coalesce((SELECT "gia_tri"::numeric FROM "public"."kl_cau_hinh" WHERE "khoa" = 'hoa_toc_da_nhan_gio'), 2), 0);
  v_n integer := ("public"."kl_nguong_do_khan"('THUONG') ->> 'nhac_lai')::integer;
  v_cvp uuid := (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1);
  v_nghi date[] := "public"."kl_ngay_nghi"(); v_bu date[] := "public"."kl_ngay_lam_bu"();
  v_trong_gio boolean := "public"."gio_lam_viec_sau_mang"("p_luc", 0, v_nghi, v_bu) <= "p_luc";
  r record; v_nguoi uuid[]; v_ntc uuid[]; v_nop uuid[]; v_tin text; v_ids bigint[] := ARRAY[]::bigint[]; v_quet integer := 0; v_bo_qua integer := 0;
  v_gui jsonb := jsonb_build_object('VANG', 0, 'DO', 0, 'DO_DAC_BIET', 0, 'CHI_DAO_TT', 0, 'TU_CHOI', 0, 'TT_CHUA_NHAN', 0, 'HOA_TOC_CHUA_NHAN', 0,
                                    'CHAM_NOP_MC', 0, 'NGHIEM_THU', 0, 'NGHIEM_THU_QUA_HAN', 0);
BEGIN
  IF "p_ngay" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày tính' USING ERRCODE = '22023'; END IF;
  -- Vòng 1: theo trang_thai (xem đầu file).
  FOR r IN
    SELECT q.* FROM (
      SELECT nv AS nv, nv."id", nv."ma", nv."han_xu_ly", nv."do_khan", nv."owner_tai_khoan", nv."nguoi_theo_doi",
             coalesce(nv."giao_thay_mat_cho", nv."tao_boi") AS nguoi_giao, t."muc_canh_bao", t."so_ngay_qua", t."han_nop_hieu_luc" AS n_sao,
             CASE WHEN t."trang_thai" = 'QUA_HAN' THEN t."muc_canh_bao" WHEN t."trang_thai" = 'QUA_HAN_NGHIEM_THU' THEN 'NGHIEM_THU_QUA_HAN'
                  WHEN t."trang_thai" = 'CHAM_NOP_MINH_CHUNG' THEN 'CHAM_NOP_MC' WHEN t."minh_chung_buoc" = 'CHO_NGHIEM_THU' THEN 'NGHIEM_THU'
                  WHEN t."muc_canh_bao" = 'VANG' THEN 'VANG' END AS muc,
             ("public"."kl_nguong_do_khan"(nv."do_khan") ->> 'nhac_lai')::integer AS n, mc."nop_boi", mc.nd
      FROM "public"."nhiem_vu" nv CROSS JOIN LATERAL "public"."trang_thai_dong"(nv, "p_ngay") t
      LEFT JOIN LATERAL (SELECT m."nop_boi", (m."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS nd FROM "public"."minh_chung" m
                         WHERE t."minh_chung_buoc" = 'CHO_NGHIEM_THU' AND m."nhiem_vu_id" = nv."id"
                           AND (m."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "p_ngay" ORDER BY m."nop_luc" DESC LIMIT 1) mc ON true
      WHERE nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH') q
    WHERE q.muc IS NOT NULL ORDER BY q."ma"
  LOOP
    v_quet := v_quet + 1;
    IF r.muc = 'NGHIEM_THU' AND "public"."ngay_lam_viec_sau_mang"(r.nd, 1, v_nghi, v_bu) > "p_ngay" THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    IF r.muc = 'NGHIEM_THU_QUA_HAN' THEN
      IF NOT "public"."kl_la_ngay_lam_viec_mang"("p_ngay", v_nghi, v_bu)
         OR EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" >= "p_ngay") THEN
        v_bo_qua := v_bo_qua + 1; CONTINUE;
      END IF;
    ELSIF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" > "p_ngay" - r.n) THEN
      v_bo_qua := v_bo_qua + 1; CONTINUE;
    END IF;
    v_nop := ARRAY(SELECT DISTINCT u FROM unnest(ARRAY[r."owner_tai_khoan", r."nguoi_theo_doi"]) u WHERE u IS NOT NULL AND u IS DISTINCT FROM r.nguoi_giao);
    v_ntc := CASE WHEN r.muc IN ('CHAM_NOP_MC', 'NGHIEM_THU', 'NGHIEM_THU_QUA_HAN') THEN "public"."nguoi_nghiem_thu_chinh"(r.nv, r."nop_boi") END;
    IF r.muc IN ('DO', 'DO_DAC_BIET') OR (r.muc = 'VANG' AND r.n_sao IS NULL) THEN
      SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM "public"."canh_bao_nguoi_nhan"(r.nv, r.muc) u;
    ELSIF r.muc = 'VANG' THEN v_nguoi := v_nop;
    ELSIF r.muc = 'CHAM_NOP_MC' THEN v_nguoi := v_nop || v_ntc;
    ELSIF r.muc = 'NGHIEM_THU' OR "public"."kl_viec_a0_giao_cvp"(r.nv) THEN v_nguoi := v_ntc;
    ELSE   -- NGHIEM_THU_QUA_HAN: người nhận nhắc chính (luôn nhận) + lãnh đạo trực tiếp; Đỏ đặc biệt thêm Chánh VP; người nhận thêm không gồm chủ trì / theo dõi / người nộp
      v_nguoi := v_ntc || ARRAY(SELECT DISTINCT u FROM unnest(ARRAY(SELECT "public"."lanh_dao_truc_tiep"(x) FROM unnest(v_ntc) x)
                                                  || CASE WHEN r."muc_canh_bao" = 'DO_DAC_BIET' THEN ARRAY[v_cvp] ELSE '{}'::uuid[] END) u
                       WHERE u IS NOT NULL AND u IS DISTINCT FROM r."owner_tai_khoan" AND u IS DISTINCT FROM r."nguoi_theo_doi" AND u IS DISTINCT FROM r."nop_boi");
    END IF;
    IF coalesce(cardinality(v_nguoi), 0) = 0 THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('%s · %s: %s%s', "public"."canh_bao_ten_muc"(r.muc), r."ma", CASE WHEN r."do_khan" <> 'THUONG' THEN '[' || "public"."ten_do_khan"(r."do_khan") || '] ' ELSE '' END,
      CASE r.muc
        WHEN 'VANG' THEN CASE WHEN r.n_sao IS NOT NULL
          THEN format('còn %s ngày tới hạn nộp minh chứng %s (hạn hoàn thành %s)', r.n_sao - "p_ngay", to_char(r.n_sao, 'DD/MM/YYYY'), to_char(r."han_xu_ly", 'DD/MM/YYYY'))
          ELSE format('còn %s ngày tới hạn %s, chưa có minh chứng', r."han_xu_ly" - "p_ngay", to_char(r."han_xu_ly", 'DD/MM/YYYY')) END
        WHEN 'CHAM_NOP_MC' THEN format('quá hạn nộp minh chứng %s ngày (hạn nộp %s, hạn hoàn thành %s)', "p_ngay" - r.n_sao, to_char(r.n_sao, 'DD/MM/YYYY'), to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'NGHIEM_THU' THEN format('minh chứng nộp ngày %s đang chờ nghiệm thu', to_char(r.nd, 'DD/MM/YYYY'))
        WHEN 'NGHIEM_THU_QUA_HAN' THEN format('đã nộp minh chứng, quá hạn %s ngày chưa nghiệm thu (hạn %s)', r."so_ngay_qua", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'DO' THEN format('quá hạn %s ngày (hạn %s)', r."so_ngay_qua", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        ELSE format('quá hạn %s ngày (hạn %s), đã báo lãnh đạo Văn phòng', r."so_ngay_qua", to_char(r."han_xu_ly", 'DD/MM/YYYY')) END);
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
    WHERE t."trang_thai" = 'CHO_DUYET' AND "public"."ngay_lam_viec_sau_mang"((t."tao_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, v_han_duyet, v_nghi, v_bu) < "p_ngay" ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."nhiem_vu_id" AND c."muc" = 'TU_CHOI' AND c."ngay" > "p_ngay" - v_n) THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Đề nghị từ chối chờ duyệt · %s: %s đề nghị từ %s, quá %s ngày làm việc chưa duyệt', r."ma", r."full_name", to_char(r.ngay_dn, 'DD/MM/YYYY'), v_han_duyet);
    v_ids := v_ids || "public"."canh_bao_ghi"(r."nhiem_vu_id", NULL, 'TU_CHOI', "p_ngay", "public"."kl_nguoi_duyet_tu_choi"(r."nhiem_vu_id", r."cap_duyet"), v_tin);   -- 0079: cả nhóm
    v_gui := jsonb_set(v_gui, ARRAY['TU_CHOI'], to_jsonb((v_gui ->> 'TU_CHOI')::integer + 1));
  END LOOP;
  -- Vòng 4: việc Thường trực giao quá N ngày làm việc chưa xác nhận nhận việc → người nhận + Chánh VP, mỗi ngày một lần.
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."noi_dung", nv."owner_tai_khoan", nv."nguoi_theo_doi" FROM "public"."nhiem_vu" nv
    WHERE nv."uu_tien" = 'THUONG_TRUC' AND nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH' AND NOT nv."bi_tu_choi"
      AND "public"."ngay_lam_viec_sau_mang"((nv."created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, v_tt_ngay, v_nghi, v_bu) < "p_ngay" ORDER BY nv."ma"
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
        AND "public"."gio_lam_viec_sau_mang"(nv."created_at", v_gio, v_nghi, v_bu) < "p_luc" AND NOT "public"."da_nhan_viec"(nv)
      UNION ALL
      SELECT nv."id", nv."ma", c."noi_dung", u, c."id" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
      CROSS JOIN LATERAL unnest(CASE WHEN c."loai" = 'CHI_DAO_TT' THEN c."nguoi_nhan" ELSE ARRAY[coalesce(nv."owner_tai_khoan", nv."nguoi_theo_doi")] END) u
      WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (u = ANY (c."da_nhan"))
        AND "public"."gio_lam_viec_sau_mang"(c."created_at", v_gio, v_nghi, v_bu) < "p_luc"
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


-- ---- View: thêm cột cuối giao_thay_mat_nhom (CREATE OR REPLACE giữ nguyên các cột cũ) ----

CREATE OR REPLACE VIEW "public"."v_nhiem_vu" WITH (security_invoker = true) AS
 SELECT nv.id, nv.ma, nv.van_ban_id, vb.loai AS van_ban_loai, vb.so_hoi_nghi, vb.so_ket_luan, vb.ngay_ban_hanh, vb.ngay_nhan AS van_ban_ngay_nhan,
    nv.nguoi_theo_doi, td.full_name AS nguoi_theo_doi_ten, td.department AS nguoi_theo_doi_phong,
    nv.owner_don_vi_ma, dv.ten AS owner_don_vi_ten, dv.trong_van_phong AS owner_trong_van_phong, dv.phong AS owner_phong,
    nv.owner_tai_khoan, ow.full_name AS owner_tai_khoan_ten,
    nv.san_pham_loai, sp.ten AS san_pham_ten, nv.san_pham_mo_ta, nv.cap_nhan_san_pham, cn.ten AS cap_nhan_san_pham_ten,
    nv.cap_quyet_dinh, cq.ten AS cap_quyet_dinh_ten, nv.ngay_nhan_van_ban, nv.ngay_nhan_uoc_tinh, nv.nhiem_vu_cha, nv.theo_1400,
    nv.nganh_ma, dn.ten AS nganh_ten, nv.linh_vuc_ma, lv.ten AS linh_vuc_ten, nv.linh_vuc_chi_tiet, nv.noi_dung,
    nv.loai_thoi_han_ma, dl.ten AS loai_thoi_han_ten, nv.han_xu_ly, nv.ly_do_chua_co_han, nv.tien_do_ma, nv.ngay_hoan_thanh,
    nv.minh_chung, nv.van_ban_trien_khai, nv.so_lan_gia_han, nv.nguon, nv.ghi_chu, nv.thieu_minh_chung, nv.dong_luc,
    nv.cap_nhat_luc, nv.cap_nhat_boi, nv.tao_boi, nv.created_at,
    t.trang_thai, t.so_ngay_qua, t.ket_qua, t.so_ngay_tre, t.do_tre_nhap_lieu, t.dang_dinh_chinh, t.nhom_dem, t.muc_canh_bao, t.lead_time_ngay,
    "public"."kl_hom_nay"() - vb.ngay_ban_hanh AS tuoi_ngay,
    ((SELECT count(*) FROM "public"."chi_dao" c WHERE c.nhiem_vu_id = nv.id AND c.trang_thai = 'CHO_PHAN_HOI'))::integer AS so_chi_dao_cho_phan_hoi,
    mcv.so_hop_le AS so_minh_chung_hop_le,
    mcv.moi_nhat AS minh_chung_moi_nhat,
    nv.do_khan, nv.uu_tien, nv.giao_thay_mat_cho, tm.full_name AS giao_thay_mat_cho_ten,
    CASE nv.do_khan WHEN 'HOA_TOC' THEN 1 WHEN 'THUONG_KHAN' THEN 2 WHEN 'KHAN' THEN 3 ELSE 4 END AS thu_tu_do_khan,
    nv.bi_tu_choi,
    -- Cột mới PR-2a (cuối view)
    xn.nguoi IS NOT NULL AS da_xac_nhan_nhan,
    xn.nguoi AS nguoi_da_nhan,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'NGHIEM_THU' WHEN t.dang_dinh_chinh THEN 'DANG_TRA_SOAT' WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END
    END AS nhom_ngoai_le,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN nv.bi_tu_choi THEN 'BI_TU_CHOI'
           WHEN nv.cap_quyet_dinh IS NOT NULL THEN 'CHO_QUYET'
           WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'CHO_NGHIEM_THU'
           WHEN mcv.co_chua_xac_nhan THEN 'CHO_MINH_CHUNG'
           WHEN nv.theo_1400 AND xn.nguoi IS NULL THEN 'CHUA_NHAN'
           ELSE 'CHUA_SAN_PHAM' END
    END AS khau,
    -- Cột mới PR-2b (cuối view)
    nv.han_nop_minh_chung, nv.ly_do_han_nop_sat, t.han_nop_hieu_luc, t.minh_chung_buoc, t.nop_dung_han, t.nghiem_thu_dung_han, t.so_lan_tra_lai,
    CASE WHEN t.minh_chung_buoc = 'CHO_NGHIEM_THU' THEN mcv.nop_boi_moi END AS nguoi_nop_cho,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntc.id
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(nv.owner_tai_khoan, nv.nguoi_theo_doi) END AS nguoi_chiu_cham,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntca.full_name
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(ow.full_name, td.full_name) END AS nguoi_chiu_cham_ten,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntca.department
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(ow.department, dv.phong, td.department) END AS phong_chiu_cham,
    -- Cột mới PR-3 (cuối view)
    nv.chat_luong, nv.nguon_nhiem_vu_ma, ng.ten AS nguon_nhiem_vu_ten, nv.vuong_mac, nv.don_vi_phoi_hop, t.tien_do_hoan_thanh,
    -- Cột mới 0079 (cuối view)
    nv.giao_thay_mat_nhom
   FROM "public"."nhiem_vu" nv
     CROSS JOIN LATERAL "public"."trang_thai_dong"(nv.*, "public"."kl_hom_nay"()) t
     JOIN "public"."van_ban_giao_viec" vb ON vb.id = nv.van_ban_id
     LEFT JOIN LATERAL (SELECT array_agg(DISTINCT l.nguoi_sua) AS nguoi FROM "public"."lich_su" l
                        WHERE l.nhiem_vu_id = nv.id AND l.cot = 'xac_nhan_nhan_viec') xn ON true
     -- MỘT lần quét minh_chung cho cả 4 cột (bản 0051 có 3 truy vấn con + 1 LATERAL): mỗi tham chiếu bảng dưới RLS dựng lại tập phạm vi
     -- (kl_nhiem_vu_thay_duoc) một lần — đo 30/9 với PCVP ≈ 4,5 ms mỗi lần. Giá trị so_minh_chung_hop_le, minh_chung_moi_nhat, khâu giữ y hệt 0051.
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE "public"."minh_chung_la_hop_le"(m.*))::integer AS so_hop_le,
              (array_agg(jsonb_build_object('id', m.id, 'loai', m.loai, 'so_hieu', m.so_hieu, 'ngay_van_ban', m.ngay_van_ban, 'cap_nhan', m.cap_nhan,
                 'cap_nhan_ten', mcap.ten, 'hop_le', m.hop_le, 'nop_luc', m.nop_luc) ORDER BY m.nop_luc DESC))[1] AS moi_nhat,
              (array_agg(m.nop_boi ORDER BY m.nop_luc DESC))[1] AS nop_boi_moi,
              coalesce(bool_or(m.hop_le IS NULL), false) AS co_chua_xac_nhan
       FROM "public"."minh_chung" m LEFT JOIN "public"."dm_cap" mcap ON mcap.ma = m.cap_nhan
       WHERE m.nhiem_vu_id = nv.id) mcv ON true
     -- CASE (đánh giá lười): WHERE trong LATERAL bị kéo lên thành điều kiện nối ⇒ hàm chạy cho MỌI dòng (đo 30/9: CVP 74 → 2 405 ms).
     LEFT JOIN LATERAL (SELECT CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ("public"."nguoi_nghiem_thu_chinh"(nv.*, mcv.nop_boi_moi))[1] END AS id) ntc ON true
     LEFT JOIN "public"."accounts_public" ntca ON ntca.id = ntc.id
     LEFT JOIN "public"."accounts_public" td ON td.id = nv.nguoi_theo_doi
     LEFT JOIN "public"."accounts_public" ow ON ow.id = nv.owner_tai_khoan
     LEFT JOIN "public"."accounts_public" tm ON tm.id = nv.giao_thay_mat_cho
     LEFT JOIN "public"."dm_don_vi" dv ON dv.ma = nv.owner_don_vi_ma
     LEFT JOIN "public"."dm_san_pham" sp ON sp.ma = nv.san_pham_loai
     LEFT JOIN "public"."dm_cap" cn ON cn.ma = nv.cap_nhan_san_pham
     LEFT JOIN "public"."dm_cap" cq ON cq.ma = nv.cap_quyet_dinh
     LEFT JOIN "public"."dm_nganh" dn ON dn.ma = nv.nganh_ma
     LEFT JOIN "public"."dm_linh_vuc" lv ON lv.ma = nv.linh_vuc_ma
     LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl.ma = nv.loai_thoi_han_ma
     LEFT JOIN "public"."dm_nguon_nhiem_vu" ng ON ng.ma = nv.nguon_nhiem_vu_ma;

CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH (security_invoker = true) AS
 SELECT id, ma, noi_dung, theo_1400, so_hoi_nghi, so_ket_luan, van_ban_loai, owner_don_vi_ma, owner_don_vi_ten, owner_trong_van_phong,
    owner_tai_khoan, owner_tai_khoan_ten, COALESCE(owner_tai_khoan_ten, owner_don_vi_ten) AS owner_ten, so_ngay_qua, han_xu_ly, so_lan_gia_han,
    muc_canh_bao, san_pham_loai, san_pham_mo_ta,
    COALESCE(san_pham_ten || COALESCE(': ' || san_pham_mo_ta, ''), 'chưa định nghĩa') AS san_pham_ten,
    cap_quyet_dinh, COALESCE(cap_quyet_dinh_ten, 'chưa xác định') AS cap_quyet_dinh_ten,
    nguoi_theo_doi, nguoi_theo_doi_ten, nguoi_theo_doi_phong, dang_dinh_chinh, nhom_ngoai_le AS nhom, so_chi_dao_cho_phan_hoi,
    cap_nhat_luc, cap_nhat_boi, khau, bi_tu_choi, do_khan, uu_tien, giao_thay_mat_cho, giao_thay_mat_cho_ten, thu_tu_do_khan,
    nguoi_chiu_cham, nguoi_chiu_cham_ten,
    vuong_mac,
    giao_thay_mat_nhom
   FROM "public"."v_nhiem_vu" v
  WHERE nhom_ngoai_le IS NOT NULL
  ORDER BY thu_tu_do_khan, (NOT uu_tien IS DISTINCT FROM 'THUONG_TRUC') DESC, bi_tu_choi DESC, (muc_canh_bao = 'DO_DAC_BIET') DESC, so_ngay_qua DESC, ma;
