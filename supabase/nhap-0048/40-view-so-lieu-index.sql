-- 0051: v_nhiem_vu / v_ngoai_le / số liệu dùng trang_thai_dong (một lần mỗi dòng) + index có số đo chứng minh (PR-2a, B4, B5).
-- 1. v_nhiem_vu: CROSS JOIN LATERAL trang_thai_dong(nv, kl_hom_nay()) thay cho LATERAL (SELECT trang_thai(..) AS tt) — cùng tên, kiểu,
--    thứ tự cột. Thêm ở CUỐI (giá trị giống hệt v_ngoai_le / lich_su hiện nay):
--      da_xac_nhan_nhan, nguoi_da_nhan uuid[] (lich_su 'xac_nhan_nhan_viec' — frontend bỏ được truy vấn lich_su toàn phạm vi),
--      nhom_ngoai_le (NULL khi không thuộc danh sách ngoại lệ; = cột nhom của v_ngoai_le), khau (chỉ tính cho dòng ngoại lệ).
-- 2. v_ngoai_le: giữ tên, cột, thứ tự dòng; thân chỉ còn lọc v_nhiem_vu theo nhom_ngoai_le. v_ngoai_le.eq(id) vẫn tra PK (EXPLAIN lượt 1).
-- 3. kl_so_lieu_cac_moc(date[]): một lần RLS, nhiều ngày ⇒ jsonb mảng, mỗi phần tử y hệt kl_so_lieu_tai; kl_so_lieu_tai gọi với 1 ngày.
-- 4. kl_so_chua_xu_ly: nhánh can_quyet dùng trang_thai_dong (bản cũ 2 lời gọi trang_thai mỗi dòng).
-- 5. Index B4: KHÔNG thêm — xem cuối file.

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
    ((SELECT count(*) FROM "public"."minh_chung" m WHERE m.nhiem_vu_id = nv.id AND "public"."minh_chung_la_hop_le"(m.*)))::integer AS so_minh_chung_hop_le,
    (SELECT to_jsonb(x.*) FROM (SELECT m.id, m.loai, m.so_hieu, m.ngay_van_ban, m.cap_nhan, mc.ten AS cap_nhan_ten, m.hop_le, m.nop_luc
                                FROM "public"."minh_chung" m LEFT JOIN "public"."dm_cap" mc ON mc.ma = m.cap_nhan
                                WHERE m.nhiem_vu_id = nv.id ORDER BY m.nop_luc DESC LIMIT 1) x) AS minh_chung_moi_nhat,
    nv.do_khan, nv.uu_tien, nv.giao_thay_mat_cho, tm.full_name AS giao_thay_mat_cho_ten,
    CASE nv.do_khan WHEN 'HOA_TOC' THEN 1 WHEN 'THUONG_KHAN' THEN 2 WHEN 'KHAN' THEN 3 ELSE 4 END AS thu_tu_do_khan,
    nv.bi_tu_choi,
    -- Cột mới PR-2a (cuối view)
    xn.nguoi IS NOT NULL AS da_xac_nhan_nhan,
    xn.nguoi AS nguoi_da_nhan,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN t.dang_dinh_chinh THEN 'DANG_TRA_SOAT' WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END
    END AS nhom_ngoai_le,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN nv.bi_tu_choi THEN 'BI_TU_CHOI'
           WHEN nv.cap_quyet_dinh IS NOT NULL THEN 'CHO_QUYET'
           WHEN EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m.nhiem_vu_id = nv.id AND m.hop_le IS NULL) THEN 'CHO_MINH_CHUNG'
           WHEN nv.theo_1400 AND xn.nguoi IS NULL THEN 'CHUA_NHAN'
           ELSE 'CHUA_SAN_PHAM' END
    END AS khau
   FROM "public"."nhiem_vu" nv
     CROSS JOIN LATERAL "public"."trang_thai_dong"(nv.*, "public"."kl_hom_nay"()) t
     JOIN "public"."van_ban_giao_viec" vb ON vb.id = nv.van_ban_id
     LEFT JOIN LATERAL (SELECT array_agg(DISTINCT l.nguoi_sua) AS nguoi FROM "public"."lich_su" l
                        WHERE l.nhiem_vu_id = nv.id AND l.cot = 'xac_nhan_nhan_viec') xn ON true
     LEFT JOIN "public"."accounts_public" td ON td.id = nv.nguoi_theo_doi
     LEFT JOIN "public"."accounts_public" ow ON ow.id = nv.owner_tai_khoan
     LEFT JOIN "public"."accounts_public" tm ON tm.id = nv.giao_thay_mat_cho
     LEFT JOIN "public"."dm_don_vi" dv ON dv.ma = nv.owner_don_vi_ma
     LEFT JOIN "public"."dm_san_pham" sp ON sp.ma = nv.san_pham_loai
     LEFT JOIN "public"."dm_cap" cn ON cn.ma = nv.cap_nhan_san_pham
     LEFT JOIN "public"."dm_cap" cq ON cq.ma = nv.cap_quyet_dinh
     LEFT JOIN "public"."dm_nganh" dn ON dn.ma = nv.nganh_ma
     LEFT JOIN "public"."dm_linh_vuc" lv ON lv.ma = nv.linh_vuc_ma
     LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl.ma = nv.loai_thoi_han_ma;

CREATE OR REPLACE VIEW "public"."v_ngoai_le" WITH (security_invoker = true) AS
 SELECT id, ma, noi_dung, theo_1400, so_hoi_nghi, so_ket_luan, van_ban_loai, owner_don_vi_ma, owner_don_vi_ten, owner_trong_van_phong,
    owner_tai_khoan, owner_tai_khoan_ten, COALESCE(owner_tai_khoan_ten, owner_don_vi_ten) AS owner_ten, so_ngay_qua, han_xu_ly, so_lan_gia_han,
    muc_canh_bao, san_pham_loai, san_pham_mo_ta,
    COALESCE(san_pham_ten || COALESCE(': ' || san_pham_mo_ta, ''), 'chưa định nghĩa') AS san_pham_ten,
    cap_quyet_dinh, COALESCE(cap_quyet_dinh_ten, 'chưa xác định') AS cap_quyet_dinh_ten,
    nguoi_theo_doi, nguoi_theo_doi_ten, nguoi_theo_doi_phong, dang_dinh_chinh, nhom_ngoai_le AS nhom, so_chi_dao_cho_phan_hoi,
    cap_nhat_luc, cap_nhat_boi, khau, bi_tu_choi, do_khan, uu_tien, giao_thay_mat_cho, giao_thay_mat_cho_ten, thu_tu_do_khan
   FROM "public"."v_nhiem_vu" v
  WHERE nhom_ngoai_le IS NOT NULL
  ORDER BY thu_tu_do_khan, (NOT uu_tien IS DISTINCT FROM 'THUONG_TRUC') DESC, bi_tu_choi DESC, (muc_canh_bao = 'DO_DAC_BIET') DESC, so_ngay_qua DESC, ma;

CREATE OR REPLACE FUNCTION "public"."kl_so_lieu_cac_moc"("p_ngay" date[]) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH t AS (
    SELECT d."ngay", x."nhom_dem", x."muc_canh_bao", x."ket_qua"
    FROM "public"."nhiem_vu" nv
    CROSS JOIN (SELECT DISTINCT u AS "ngay" FROM unnest("p_ngay") u) d
    CROSS JOIN LATERAL "public"."trang_thai_dong"(nv, d."ngay") x
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'ngay', d."ngay",
    'tong', (SELECT count(*) FROM t WHERE t."ngay" IS NOT DISTINCT FROM d."ngay"),
    'nhom_dem', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT t."nhom_dem" AS k, count(*) AS n FROM t
                  WHERE t."ngay" IS NOT DISTINCT FROM d."ngay" AND t."nhom_dem" IS NOT NULL GROUP BY 1) a),
    'muc_canh_bao', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT t."muc_canh_bao" AS k, count(*) AS n FROM t
                  WHERE t."ngay" IS NOT DISTINCT FROM d."ngay" AND t."muc_canh_bao" IS NOT NULL GROUP BY 1) b),
    'ket_qua', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (SELECT t."ket_qua" AS k, count(*) AS n FROM t
                  WHERE t."ngay" IS NOT DISTINCT FROM d."ngay" AND t."ket_qua" IS NOT NULL GROUP BY 1) c)
  ) ORDER BY d."thu_tu"), '[]'::jsonb)
  FROM unnest("p_ngay") WITH ORDINALITY AS d("ngay", "thu_tu");
$$;
REVOKE ALL ON FUNCTION "public"."kl_so_lieu_cac_moc"(date[]) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_so_lieu_cac_moc"(date[]) TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."kl_so_lieu_tai"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT "public"."kl_so_lieu_cac_moc"(ARRAY["p_ngay"]) -> 0;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap FROM "public"."accounts" WHERE "id" = "auth"."uid"()),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL),
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  quyet AS (SELECT n."id" FROM mo n, me CROSS JOIN LATERAL "public"."trang_thai_dong"(n::"public"."nhiem_vu", "public"."kl_hom_nay"()) t
            WHERE n."cap_quyet_dinh" = ANY (me.cap) AND NOT n."bi_tu_choi" AND t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') AND NOT t."dang_dinh_chinh"),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'thong_bao', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'),
    'can_quyet', (SELECT count(*) FROM quyet),
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

-- Index B4: đo 29/9 ở 1 400 việc (giao dịch rollback) — không ứng viên nào có lợi đo được nên KHÔNG thêm (chỉ giữ index có số đo):
--   lich_su (nhiem_vu_id) WHERE cot = 'xac_nhan_nhan_viec': v_nhiem_vu CVP 12,8 → 12,9 ms; đọc xác nhận nhận việc 1,15 → 0,95 ms;
--   minh_chung (nop_luc DESC) WHERE hop_le IS NULL: 1,66 → 1,53 ms; FK direct_messages(nhiem_vu_id), lich_su(dinh_chinh_id),
--   canh_bao(chi_dao_id): bảng/cột tương ứng 0 dòng, xoá 1 việc 2,4 → 0,8 ms (nhiễu bộ đệm). Đo lại khi dữ liệu thật lớn lên (F4).
