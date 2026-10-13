-- 0103 (v3.23, chủ dự án duyệt 13/10/2026): (1) mọi cán bộ XEM toàn bộ nhiệm vụ theo cấu hình — quyền SỬA giữ nguyên; (2) vướng mắc ghi rõ đề
-- nghị gửi tới ai.
-- 1. kl_cau_hinh 'xem_toan_bo': 1 = như cũ (mỗi người thấy việc trong phạm vi — quy tắc 7 CLAUDE.md); 2 = mọi tài khoản đang hoạt động đọc được
--    MỌI nhiệm vụ (và lịch sử, chỉ đạo, minh chứng, cảnh báo, đính chính, văn bản — các policy SELECT dùng kl_xem_tat_ca / kl_van_ban_thay_duoc).
--    Chỉ đổi phía ĐỌC: kl_pham_vi, kl_thay_nhiem_vu, kl_nhiem_vu_thay_duoc, kl_lanh_dao_pham_vi, kl_duoc_chi_dao… (mọi chốt ghi) không đổi ⇒ lãnh
--    đạo chỉ sửa / chỉ đạo / gia hạn việc trong phạm vi phụ trách, chuyên viên chỉ việc mình chủ trì / theo dõi. Mặc định 1; đổi ở Quản trị → Ngưỡng
--    cảnh báo (qt_dat_cau_hinh, có lý do + nhật ký). kl_tham_chieu_pham_vi (chuẩn đối chiếu phạm vi) không đổi — là tập "trong phạm vi".
--    kl_xem_tat_ca_vai(): phần cũ của kl_xem_tat_ca (quản trị KL / Thường trực / Chánh VP — gồm toàn quyền 0100).
--    v_nhiem_vu + trong_pham_vi (tập đọc cũ: kl_xem_tat_ca_vai OR kl_nhiem_vu_thay_duoc) — giao diện giữ các màn làm việc theo phạm vi, việc
--    ngoài phạm vi chỉ xem.
-- 2. nhiem_vu.vuong_mac_gui_cho + dat_vuong_mac(p_id, p_noi_dung, p_gui_cho DEFAULT NULL) (thay bản 2 tham số 0065): chọn người nhận → một tin hệ
--    thống cho đúng người đó mỗi lần ghi / đổi vướng mắc; không chọn → như cũ (trigger 0062 báo người giao + Phó Chánh VP phụ trách lần đầu).
--    Xoá vướng mắc (đã giải quyết) xoá luôn người nhận. Người nhận (chốt ở DB): người giao việc (người được thay mặt / người tạo việc) hoặc lãnh
--    đạo Văn phòng, Trưởng phòng — không Thường trực (như 0062), không người ghi, tài khoản đang hoạt động. Trigger bg_ (BEFORE) xoá người nhận
--    khi vướng mắc / người nhận đổi NGOÀI dat_vuong_mac (nhập Excel, hoàn tác lô, sửa thẳng qua API) — không để người nhận cũ treo với nội
--    dung mới (và trigger tin 0062 vẫn báo tự động như cũ).
-- 3. Hai hàm đếm SECURITY INVOKER (đọc nhiem_vu theo RLS) giữ nghĩa "trong phạm vi" khi bật xem toàn bộ: kl_so_chua_xu_ly (bản 0100 — số chưa
--    xử lý trên menu / dải Cần xử lý ngay: việc cần quyết, bị từ chối, có vướng mắc…) và kl_so_lieu_cac_moc (bản 0051 — ô số, xu hướng tuần của
--    Cần xử lý) thêm điều kiện: cấu hình tắt (không tính lại phạm vi — như cũ) HOẶC vai xem tất cả HOẶC việc trong kl_nhiem_vu_thay_duoc(true).

-- ---- 1 ----
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('xem_toan_bo', '1', 'Phạm vi xem nhiệm vụ: 1 = mỗi cán bộ thấy việc trong phạm vi của mình; 2 = mọi cán bộ xem toàn bộ nhiệm vụ (chỉ xem — quyền sửa, chỉ đạo, nộp minh chứng vẫn theo phạm vi phụ trách)')
ON CONFLICT ("khoa") DO NOTHING;

CREATE FUNCTION "public"."kl_xem_toan_bo"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT "gia_tri" = '2' FROM "public"."kl_cau_hinh" WHERE "khoa" = 'xem_toan_bo'), false);
$$;
CREATE FUNCTION "public"."kl_xem_tat_ca_vai"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("public"."me_quan_tri_kl"() OR "public"."me_role"() = 'A0' OR "public"."me_is_chief"(), false);   -- = kl_xem_tat_ca bản 0048
$$;
CREATE OR REPLACE FUNCTION "public"."kl_xem_tat_ca"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("public"."kl_xem_tat_ca_vai"() OR ("public"."kl_xem_toan_bo"() AND EXISTS (
    SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false))), false);
$$;
-- Văn bản đọc được: thêm nhánh xem toàn bộ (bản 0048: chỉ văn bản có việc trong phạm vi).
CREATE OR REPLACE FUNCTION "public"."kl_van_ban_thay_duoc"() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 100 AS $$
  SELECT DISTINCT n."van_ban_id" FROM "public"."nhiem_vu" n
  WHERE (SELECT "public"."kl_xem_tat_ca"()) OR n."id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true));
$$;
REVOKE ALL ON FUNCTION "public"."kl_xem_toan_bo"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_xem_tat_ca_vai"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_xem_toan_bo"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_xem_tat_ca_vai"() TO "authenticated";

-- ---- 2 ---- (cột trước view: v_nhiem_vu đọc nv.vuong_mac_gui_cho)
ALTER TABLE "public"."nhiem_vu" ADD COLUMN "vuong_mac_gui_cho" uuid REFERENCES "public"."accounts"("id");
COMMENT ON COLUMN "public"."nhiem_vu"."vuong_mac_gui_cho" IS '0103: người được đề nghị xử lý vướng mắc (người ghi chọn); NULL = theo quy tắc báo tự động 0062';

CREATE FUNCTION "public"."kl_nhiem_vu_vuong_mac_gui_cho"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('kl.dat_vuong_mac', true), '') = '1' THEN RETURN NEW; END IF;   -- ghi qua dat_vuong_mac: giữ người nhận đã kiểm
  IF TG_OP = 'INSERT' THEN NEW."vuong_mac_gui_cho" := NULL;
  ELSIF NEW."vuong_mac" IS DISTINCT FROM OLD."vuong_mac" OR NEW."vuong_mac_gui_cho" IS DISTINCT FROM OLD."vuong_mac_gui_cho" THEN NEW."vuong_mac_gui_cho" := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_vuong_mac_gui_cho"() FROM public, "anon", "authenticated";
CREATE TRIGGER "bg_nhiem_vu_vuong_mac_gui_cho" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_vuong_mac_gui_cho"();

-- v_nhiem_vu (bản 0094 nguyên văn + 2 cột cuối)
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
    nv.stt_van_ban, nv.muc_quan_trong, nv.co_quan_trinh, cqt.ten AS co_quan_trinh_ten, nv.thuong_truc_chi_dao, ttcd.full_name AS thuong_truc_chi_dao_ten,
    -- Cột mới 0103 (cuối view): việc thuộc phạm vi xử lý của người xem (tập đọc cũ) — khi bật "xem toàn bộ" các dòng khác chỉ để xem; người
    -- nhận đề nghị xử lý vướng mắc
    -- (cấu hình tắt: mọi dòng đọc được đều trong phạm vi — không tính lại tập phạm vi)
    ((SELECT NOT "public"."kl_xem_toan_bo"()) OR (SELECT "public"."kl_xem_tat_ca_vai"()) OR nv.id IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true))) AS trong_pham_vi,
    nv.vuong_mac_gui_cho
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

-- Trigger tin vướng mắc (bản 0062 + bỏ qua khi đã chọn người nhận)
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_tin_vuong_mac"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nhan uuid[]; v_phong text; v_me uuid := "auth"."uid"();
BEGIN
  IF NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL THEN RETURN NULL; END IF;
  IF NEW."vuong_mac_gui_cho" IS NOT NULL THEN RETURN NULL; END IF;   -- 0103: người ghi đã chọn người nhận — dat_vuong_mac gửi tin cho đúng người đó
  v_phong := coalesce((SELECT o."department" FROM "public"."accounts" o WHERE o."id" = NEW."owner_tai_khoan"),
                      (SELECT d."phong" FROM "public"."dm_don_vi" d WHERE d."ma" = NEW."owner_don_vi_ma" AND d."trong_van_phong"));
  SELECT array_agg(DISTINCT x."id") INTO v_nhan FROM (
    SELECT a."id" FROM "public"."accounts" a
    WHERE a."id" = coalesce(NEW."giao_thay_mat_cho", NEW."tao_boi") AND a."role_group" IN ('A1', 'A2') AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)
    UNION ALL
    (SELECT a."id" FROM "public"."pcvp_phu_trach"(v_phong, NEW."nganh_ma", NEW."linh_vuc_ma") p(id) JOIN "public"."accounts" a ON a."id" = p.id
     WHERE a."role_group" = 'A1' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) ORDER BY a."username" LIMIT 1)) x
  WHERE x."id" IS DISTINCT FROM v_me;
  IF v_nhan IS NULL THEN v_nhan := "public"."nguoi_nghiem_thu_chinh"(NEW, v_me); END IF;   -- hàm này đã loại A0
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, u, format('Vướng mắc cần lãnh đạo quyết định · %s: %s', NEW."ma", left(NEW."vuong_mac", 200)), false, 'he_thong', NEW."id"
  FROM unnest(coalesce(v_nhan, '{}'::uuid[])) u WHERE u IS DISTINCT FROM v_me;
  RETURN NULL;
END;
$$;

DROP FUNCTION "public"."dat_vuong_mac"(uuid, text);
CREATE FUNCTION "public"."dat_vuong_mac"("p_id" uuid, "p_noi_dung" text, "p_gui_cho" uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_moi text := nullif(btrim(coalesce("p_noi_dung", '')), ''); v_nhan "public"."accounts"; v_me "public"."accounts";
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR "public"."me_la_a0"()
     OR (v_nv."owner_tai_khoan" = "auth"."uid"() OR v_nv."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(v_nv."id")
         OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi, lãnh đạo trong phạm vi hoặc quản trị nhiệm vụ mới ghi vướng mắc.' USING ERRCODE = '42501';
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
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- lãnh đạo không phải Owner / người theo dõi: guard a3 cho qua đúng câu UPDATE này
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
REVOKE ALL ON FUNCTION "public"."dat_vuong_mac"(uuid, text, uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."dat_vuong_mac"(uuid, text, uuid) TO "authenticated";

-- ---- 3 ---- (số liệu theo phạm vi xử lý khi bật xem toàn bộ)
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
              FROM (SELECT x."id", x."department", x."thu_ky_thuong_truc", x."quan_tri_kl", x."quan_tri_kl_het_han",   -- 0100: toàn quyền = Chánh VP
                           CASE WHEN x."toan_quyen" AND x."role_group" <> 'A0' THEN 'A1' ELSE x."role_group" END AS "role_group",
                           x."is_chief" OR (x."toan_quyen" AND x."role_group" <> 'A0') AS "is_chief"
                    FROM "public"."accounts" x WHERE x."id" = "auth"."uid"()) a),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL
              AND (NOT (SELECT "public"."kl_xem_toan_bo"()) OR (SELECT "public"."kl_xem_tat_ca_vai"()) OR n."id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)))),   -- 0103: trong phạm vi xử lý
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
                    AND "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")),   -- 0079
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
    'de_nghi_sua', (SELECT count(*) FROM "public"."de_nghi_sua" d, me WHERE d."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(d."nhiem_vu_id", d."cap_duyet")),   -- 0079
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;
CREATE OR REPLACE FUNCTION "public"."kl_so_lieu_cac_moc"("p_ngay" date[]) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH t AS (
    SELECT d."ngay", x."nhom_dem", x."muc_canh_bao", x."ket_qua"
    FROM "public"."nhiem_vu" nv
    CROSS JOIN (SELECT DISTINCT u AS "ngay" FROM unnest("p_ngay") u) d
    CROSS JOIN LATERAL "public"."trang_thai_dong"(nv, d."ngay") x
    WHERE (NOT (SELECT "public"."kl_xem_toan_bo"()) OR (SELECT "public"."kl_xem_tat_ca_vai"()) OR nv."id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)))   -- 0103: trong phạm vi xử lý
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
