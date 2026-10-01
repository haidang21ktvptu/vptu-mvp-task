-- 0067: Hiển thị PR-3 (hạng mục A–F; quyết định 1/10/2026). Không đổi cột / thứ tự cũ; cột mới ở CUỐI.
-- 1. v_nhiem_vu (bản 0059) + chat_luong, nguon_nhiem_vu_ma, nguon_nhiem_vu_ten, vuong_mac, don_vi_phoi_hop, tien_do_hoan_thanh (trang_thai_kq 0066).
-- 2. v_ngoai_le (bản 0059) + vuong_mac — trường thứ 5 của thẻ Đỏ (sau chủ trì, ngày trễ, sản phẩm thiếu, cấp quyết định).
-- 3. kl_so_chua_xu_ly (bản 0059) + 'co_vuong_mac': việc đang mở có vướng mắc, chỉ tính cho A1 và A2 (A0 / A3 = 0); phạm vi do RLS nhiem_vu
--    (hàm SECURITY INVOKER) ⇒ Chánh VP mọi việc, PCVP khối mình, Trưởng phòng phòng mình.
-- 4. kl_danh_muc (bản 0051) + 'nguonNhiemVu' (dm_nguon_nhiem_vu, theo thu_tu).

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
    nv.chat_luong, nv.nguon_nhiem_vu_ma, ng.ten AS nguon_nhiem_vu_ten, nv.vuong_mac, nv.don_vi_phoi_hop, t.tien_do_hoan_thanh
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
    vuong_mac
   FROM "public"."v_nhiem_vu" v
  WHERE nhom_ngoai_le IS NOT NULL
  ORDER BY thu_tu_do_khan, (NOT uu_tien IS DISTINCT FROM 'THUONG_TRUC') DESC, bi_tu_choi DESC, (muc_canh_bao = 'DO_DAC_BIET') DESC, so_ngay_qua DESC, ma;

CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap,
                "role_group" <> 'A0' AND (coalesce("is_chief" AND "role_group" = 'A1', false) OR coalesce("thu_ky_thuong_truc", false)
                  OR coalesce("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false)) AS nt_rong,
                CASE "role_group" WHEN 'A2' THEN ARRAY["department"]
                  WHEN 'A1' THEN ARRAY(SELECT p."phong" FROM "public"."phu_trach_phong" p WHERE p."lanh_dao_id" = "auth"."uid"()
                                       AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
                  ELSE '{}'::text[] END AS nt_phong
              FROM "public"."accounts" WHERE "id" = "auth"."uid"()),
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
    'can_nghiem_thu', (SELECT count(*) FROM mo n, me CROSS JOIN LATERAL (
        SELECT m."nop_boi", m."loai", m."hop_le" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1) mc
      WHERE mc."hop_le" IS NULL AND (mc."loai" IN ('so_hieu', 'tep') OR (mc."loai" = 'chu_cu' AND n."han_nop_minh_chung" IS NOT NULL))
        AND me."role_group" <> 'A0' AND (me.nt_rong OR coalesce(n."giao_thay_mat_cho", n."tao_boi") = me."id"
          OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") AND a."department" = ANY (me.nt_phong))
          OR EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = n."owner_don_vi_ma" AND d."phong" = ANY (me.nt_phong)))
        AND me."id" = ANY ("public"."nguoi_nghiem_thu_chinh"(n::"public"."nhiem_vu", mc."nop_boi"))),
    'co_vuong_mac', (SELECT count(*) FROM mo n, me WHERE me."role_group" IN ('A1', 'A2') AND n."vuong_mac" IS NOT NULL),
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION "public"."kl_danh_muc"() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nganh', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_nganh") x),
    'linhVuc', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "nganh_ma", "ten", "thu_tu" FROM "public"."dm_linh_vuc") x),
    'donVi', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "trong_van_phong", "phong" FROM "public"."dm_don_vi") x),
    'sanPham', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_san_pham") x),
    'cap', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_cap") x),
    'loaiThoiHan', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han") x),
    'tienDo', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_tien_do") x),
    'nguonNhiemVu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "dang_dung" FROM "public"."dm_nguon_nhiem_vu") x),
    'cauHinh', (SELECT coalesce(jsonb_object_agg("khoa", "gia_tri"), '{}') FROM "public"."kl_cau_hinh"));
$$;
REVOKE ALL ON FUNCTION "public"."kl_danh_muc"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_danh_muc"() TO "authenticated";

-- 7. Realtime (B6, Lượt 4): minh_chung vào publication (khối "minh chứng chờ xác nhận", PR-2b dùng cho nghiệm thu). nhiem_vu, chi_dao
--    (0016, tên mới 0023), tu_choi (0037) đã có. Realtime lọc sự kiện theo RLS SELECT của người nghe (minh_chung_select, 0049) — test
--    kl-realtime-su-kien. Idempotent: môi trường đã có bảng trong publication thì bỏ qua.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'minh_chung') THEN
    ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."minh_chung";
  END IF;
END $$;

-- Index B4: đo 29/9 ở 1 400 việc (giao dịch rollback) — không ứng viên nào có lợi đo được nên KHÔNG thêm (chỉ giữ index có số đo):
--   lich_su (nhiem_vu_id) WHERE cot = 'xac_nhan_nhan_viec': v_nhiem_vu CVP 12,8 → 12,9 ms; đọc xác nhận nhận việc 1,15 → 0,95 ms;
--   minh_chung (nop_luc DESC) WHERE hop_le IS NULL: 1,66 → 1,53 ms; FK direct_messages(nhiem_vu_id), lich_su(dinh_chinh_id),
--   canh_bao(chi_dao_id): bảng/cột tương ứng 0 dòng, xoá 1 việc 2,4 → 0,8 ms (nhiễu bộ đệm). Đo lại khi dữ liệu thật lớn lên (F4).
