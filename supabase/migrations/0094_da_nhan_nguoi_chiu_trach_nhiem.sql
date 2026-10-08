-- 0094 (Đợt D v3.20, sửa sau CI của PR #123): "đã nhận" tự động của LÃNH ĐẠO (0090) chỉ để lãnh đạo không phải bấm — không thay việc nhận của
-- người chịu trách nhiệm. Trưởng phòng giao việc cho chuyên viên thì Trưởng phòng là người theo dõi và được ghi "đã nhận" tự động; trước bản này
-- dòng đó làm việc tính như "đã nhận" (khâu "Chưa nhận việc" biến mất, nhắc Hỏa tốc chưa Đã nhận không gửi chuyên viên chủ trì).
-- 1. kl_nhan_tu_dong_lanh_dao(): dòng nhận tự động của lãnh đạo mà người đó KHÔNG phải người nhận chính (= chủ trì, không có chủ trì thì người theo
--    dõi) — bỏ qua khi xét việc đã được nhận chưa. Việc Thường trực giao Chánh VP / phòng (lãnh đạo là người nhận chính) vẫn tính đã nhận.
-- 2. da_nhan_viec (bản 0037): bỏ qua các dòng ở mục 1 — nhắc TT_CHUA_NHAN, Hỏa tốc chưa Đã nhận.
-- 3. v_nhiem_vu (bản 0087, chỉ đổi cột da_xac_nhan_nhan và khâu CHUA_NHAN theo mục 1; nguoi_da_nhan giữ mọi người đã nhận — "của tôi").

CREATE OR REPLACE FUNCTION "public"."kl_nhan_tu_dong_lanh_dao"("p_gia_tri" text, "p_nguoi" uuid, "p_owner" uuid, "p_theo_doi" uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce("p_gia_tri" LIKE 'tự động%lãnh đạo không phải xác nhận%' AND "p_nguoi" IS DISTINCT FROM coalesce("p_owner", "p_theo_doi"), false);
$$;
GRANT EXECUTE ON FUNCTION "public"."kl_nhan_tu_dong_lanh_dao"(text, uuid, uuid, uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."da_nhan_viec"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = ("p_nv")."id" AND l."cot" = 'xac_nhan_nhan_viec'
                 AND l."nguoi_sua" IN (("p_nv")."owner_tai_khoan", ("p_nv")."nguoi_theo_doi")
                 AND NOT "public"."kl_nhan_tu_dong_lanh_dao"(l."gia_tri_moi", l."nguoi_sua", ("p_nv")."owner_tai_khoan", ("p_nv")."nguoi_theo_doi"));
$$;

-- ---- 3. v_nhiem_vu ----
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
    coalesce(xn.co_nguoi_nhan, false) AS da_xac_nhan_nhan,   -- 0094: không tính "đã nhận" tự động của lãnh đạo chỉ theo dõi
    xn.nguoi AS nguoi_da_nhan,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'NGHIEM_THU' WHEN t.dang_dinh_chinh THEN 'DANG_TRA_SOAT' WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END
    END AS nhom_ngoai_le,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN nv.bi_tu_choi THEN 'BI_TU_CHOI'
           WHEN nv.cap_quyet_dinh IS NOT NULL THEN 'CHO_QUYET'
           WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'CHO_NGHIEM_THU'
           WHEN mcv.co_chua_xac_nhan THEN 'CHO_MINH_CHUNG'
           WHEN nv.theo_1400 AND NOT coalesce(xn.co_nguoi_nhan, false) THEN 'CHUA_NHAN'
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
    nv.giao_thay_mat_nhom,
    -- Cột mới 0087 (cuối view): thông tin nguồn, số thứ tự trong văn bản
    nv.stt_van_ban, nv.muc_quan_trong, nv.co_quan_trinh, cqt.ten AS co_quan_trinh_ten, nv.thuong_truc_chi_dao, ttcd.full_name AS thuong_truc_chi_dao_ten
   FROM "public"."nhiem_vu" nv
     CROSS JOIN LATERAL "public"."trang_thai_dong"(nv.*, "public"."kl_hom_nay"()) t
     JOIN "public"."van_ban_giao_viec" vb ON vb.id = nv.van_ban_id
     LEFT JOIN LATERAL (SELECT array_agg(DISTINCT l.nguoi_sua) AS nguoi,
                               bool_or(NOT "public"."kl_nhan_tu_dong_lanh_dao"(l.gia_tri_moi, l.nguoi_sua, nv.owner_tai_khoan, nv.nguoi_theo_doi)) AS co_nguoi_nhan
                        FROM "public"."lich_su" l WHERE l.nhiem_vu_id = nv.id AND l.cot = 'xac_nhan_nhan_viec') xn ON true
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
     LEFT JOIN "public"."dm_nguon_nhiem_vu" ng ON ng.ma = nv.nguon_nhiem_vu_ma
     LEFT JOIN "public"."dm_don_vi" cqt ON cqt.ma = nv.co_quan_trinh
     LEFT JOIN "public"."accounts_public" ttcd ON ttcd.id = nv.thuong_truc_chi_dao;
