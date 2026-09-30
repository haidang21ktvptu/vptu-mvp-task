-- 0060: Nhắc việc theo hạn nộp minh chứng (PR-2b, thiết kế A7; bổ sung H 30/9: canh-bao.yml giữ MỘT lần/ngày 07:30 giờ VN — không thêm lịch).
-- 1. canh_bao.muc thêm CHAM_NOP_MC, NGHIEM_THU, NGHIEM_THU_QUA_HAN (viết lại đúng danh sách 0037, thêm vào cuối). canh_bao_ten_muc thêm 3 tên.
-- 2. canh_bao_quet: vòng 1 chọn việc theo trang_thai (trang_thai_dong ở FROM — một lần mỗi dòng, bản 0037 gọi trang_thai vô hướng nhiều lần):
--    QUA_HAN → DO / DO_DAC_BIET như CB-3 (0036) · QUA_HAN_NGHIEM_THU → NGHIEM_THU_QUA_HAN: người nhận nhắc chính + lãnh đạo trực tiếp của họ, Đỏ đặc
--    biệt thêm Chánh VP; người nhận THÊM không gồm chủ trì / người theo dõi / người nộp (người nhận nhắc chính luôn nhận, kể cả khi chính họ là
--    người theo dõi — Trưởng phòng giao và tự theo dõi); mỗi NGÀY LÀM VIỆC một lần (lần quét ngày nghỉ bỏ qua) ·
--    CHAM_NOP_MINH_CHUNG → CHAM_NOP_MC: người nộp (chủ trì tài khoản + người theo dõi, trừ người giao) + người nhận nhắc chính; không thủ trưởng /
--    Chánh VP · minh chứng đang chờ (dòng 6 và việc không hạn) → NGHIEM_THU: chỉ người nhận nhắc chính, khi đã chờ ≥ 1 ngày làm việc ·
--    Vàng: việc có hạn nộp → người nộp trừ người giao, tin theo hạn nộp; việc cũ → như 0036. Nhắc lại theo độ khẩn như VANG (Thường 3, Khẩn 2,
--    Thượng khẩn / Hỏa tốc 1 ngày) — với nhịp quét một lần/ngày: gửi lại khi lần gửi trước cách ≥ N ngày.
--    Việc Thường trực giao cho Chánh VP (Q8): NGHIEM_THU / NGHIEM_THU_QUA_HAN chỉ gửi thư ký (không có thì quan_tri_kl); không gửi Chánh VP, A0.
-- 3. Ngày nghỉ đọc MỘT lần mỗi lần quét (v_nghi, v_bu) rồi dùng bản *_mang cho mọi dòng (vòng 1, 3, 4, 5) — bổ sung A 30/9.

ALTER TABLE "public"."canh_bao" DROP CONSTRAINT "canh_bao_muc_check",
  ADD CONSTRAINT "canh_bao_muc_check" CHECK ("muc" IN ('VANG', 'DO', 'DO_DAC_BIET', 'CHI_DAO_TT', 'TU_CHOI', 'TT_CHUA_NHAN', 'HOA_TOC_CHUA_NHAN',
                                                     'CHAM_NOP_MC', 'NGHIEM_THU', 'NGHIEM_THU_QUA_HAN'));

CREATE OR REPLACE FUNCTION "public"."canh_bao_ten_muc"("p_muc" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_muc" WHEN 'VANG' THEN 'Cảnh báo Vàng' WHEN 'DO' THEN 'Cảnh báo Đỏ' WHEN 'DO_DAC_BIET' THEN 'Cảnh báo Đỏ đặc biệt'
    WHEN 'CHAM_NOP_MC' THEN 'Chậm nộp minh chứng' WHEN 'NGHIEM_THU' THEN 'Cần nghiệm thu minh chứng'
    WHEN 'NGHIEM_THU_QUA_HAN' THEN 'Quá hạn ở bước nghiệm thu' ELSE "p_muc" END;
$$;

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
    v_ids := v_ids || "public"."canh_bao_ghi"(r."nhiem_vu_id", NULL, 'TU_CHOI', "p_ngay", ARRAY[r."cap_duyet"], v_tin);
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
