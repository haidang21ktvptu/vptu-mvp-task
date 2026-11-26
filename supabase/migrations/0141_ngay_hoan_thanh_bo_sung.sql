-- 0141 (v3.36 — CAU-HOI V-2, chủ dự án duyệt 25/11/2026 "Tự thêm 30 ngày những việc chưa có ngày hoàn thành"): bổ sung ngày hoàn thành cho việc đã
-- hoàn thành mà chưa ghi ngày (rà soát 25/11: 275/337 việc, chủ yếu nhập từ Excel "đã xong ngoài hệ thống"), để tỷ lệ đúng hạn tính trên đủ việc.
-- Cách lấy ngày, theo thứ tự: (1) LICH_SU — lần gần nhất việc được chuyển sang Hoàn thành trong lịch sử cập nhật (UPDATE tiến độ, không tính lúc nhập
-- việc đã hoàn thành); (2) UOC_TINH — ngày giao + 30 ngày, không quá ngày nhập việc vào hệ thống (việc nhập đã hoàn thành thì xong trước ngày nhập).
-- Cả hai luôn không trước ngày ban hành và ngày giao nhiệm vụ (lead time không âm — DL-4), không sau hôm nay. Ngày bổ sung được đánh dấu ở cột
-- ngay_hoan_thanh_bo_sung (giao diện ghi "bổ sung"); người dùng sửa ngày hoàn thành hoặc mở lại việc thì dấu tự bỏ (trigger).
-- Không tự chạy khi áp migration: hàm kl_bo_sung_ngay_hoan_thanh (chỉ service_role, workflow bo-sung-ngay-hoan-thanh.yml) — xem trước CHẠY THỬ từng việc
-- rồi hoàn lại (đúng số sẽ ghi, số bị kiểm tra dữ liệu từ chối, đúng hạn / trễ hạn theo hạn sau khi ghi); chủ dự án xác nhận rồi mới thực hiện trên
-- production. Hoàn tác: kl_bo_sung_ngay_hoan_thanh_hoan_tac (chỉ việc còn dấu bổ sung, từng việc một). Lịch sử cập nhật ghi mỗi thay đổi (trigger lịch
-- sử, người sửa trống = hệ thống). Rà soát độc lập 26/11: chỉ ghi việc còn đúng điều kiện lúc ghi (người dùng vừa ghi ngày thì giữ ngày của người dùng;
-- gọi lại khi mạng chập chờn không ghi đè).

ALTER TABLE "public"."nhiem_vu" ADD COLUMN "ngay_hoan_thanh_bo_sung" text CHECK ("ngay_hoan_thanh_bo_sung" IN ('LICH_SU', 'UOC_TINH'));
COMMENT ON COLUMN "public"."nhiem_vu"."ngay_hoan_thanh_bo_sung" IS '0141: ngày hoàn thành do hệ thống bổ sung — LICH_SU (theo lịch sử cập nhật) / UOC_TINH (ngày giao + 30 ngày); NULL = người dùng ghi';

-- Dấu bổ sung chỉ hàm bổ sung đặt được (biến phiên kl.bo_sung_nht); thêm việc mới không mang dấu; sửa ngày hoàn thành hoặc mở lại việc thì bỏ dấu.
-- Tên "bz_" để chạy sau các trigger BEFORE khác (thứ tự theo tên): xét giá trị cuối cùng của dòng.
CREATE FUNCTION "public"."kl_nhiem_vu_dau_bo_sung_nht"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('kl.bo_sung_nht', true) = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW."ngay_hoan_thanh_bo_sung" := NULL; RETURN NEW; END IF;
  IF NEW."ngay_hoan_thanh" IS DISTINCT FROM OLD."ngay_hoan_thanh" OR NEW."tien_do_ma" IS DISTINCT FROM 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh_bo_sung" := NULL;
  ELSE
    NEW."ngay_hoan_thanh_bo_sung" := OLD."ngay_hoan_thanh_bo_sung";
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_dau_bo_sung_nht"() FROM public, "anon", "authenticated";
CREATE TRIGGER "bz_nhiem_vu_dau_bo_sung_nht" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_dau_bo_sung_nht"();

-- kl_nhiem_vu_truoc_ghi (bản 0028 nguyên văn + cho hàm hoàn tác bổ sung bỏ ngày hoàn thành của việc đã hoàn thành — biến phiên kl.bo_sung_nht)
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ngay_bh date; v_ky integer; v_du boolean;
        v_da_hoan_thanh boolean := TG_OP = 'UPDATE' AND OLD."tien_do_ma" = 'HOAN_THANH';
        v_nhap_excel boolean := TG_OP = 'INSERT' AND NEW."nguon" = 'excel';
        v_co_chu boolean := nullif(btrim(coalesce(NEW."minh_chung", '')), '') IS NOT NULL;
        -- ghi_vet chỉ tính lại cờ (bác minh chứng sau khi đóng); coalesce vì GUC chưa từng set trả NULL, không phải '' (NULL làm IF bên dưới im lặng).
        v_tinh_lai boolean := coalesce(current_setting('kl.minh_chung_tinh_lai', true), '') = '1';
BEGIN
  SELECT "ngay_ban_hanh" INTO v_ngay_bh FROM "public"."van_ban_giao_viec" WHERE "id" = NEW."van_ban_id";
  IF NEW."loai_thoi_han_ma" = 'KY_BAN_HANH' THEN
    SELECT coalesce("gia_tri"::integer, 10) INTO v_ky FROM "public"."kl_cau_hinh" WHERE "khoa" = 'ky_ban_hanh_ngay';
    NEW."han_xu_ly" := v_ngay_bh + coalesce(v_ky, 10);
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" < v_ngay_bh THEN
    RAISE EXCEPTION 'Hạn xử lý không được trước ngày ban hành (%).', to_char(v_ngay_bh, 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL THEN NEW."ly_do_chua_co_han" := NULL; END IF;
  v_du := CASE WHEN NEW."theo_1400" THEN "public"."minh_chung_co_hop_le"(NEW."id")
               ELSE v_co_chu OR "public"."minh_chung_co_hop_le"(NEW."id") END;
  IF NEW."tien_do_ma" <> 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh" := NULL;
    NEW."dong_luc" := NULL;
  ELSE
    IF NOT v_du AND NOT (v_da_hoan_thanh AND (OLD."thieu_minh_chung" OR v_tinh_lai)) AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải có minh chứng (%).',
        CASE WHEN NEW."theo_1400" THEN 'số hiệu, ngày văn bản và cấp nhận — nộp ở mục Minh chứng' ELSE 'số hiệu văn bản hoặc đường dẫn' END
        USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NULL AND NOT (v_da_hoan_thanh AND OLD."ngay_hoan_thanh" IS NULL) AND NOT v_nhap_excel
       AND current_setting('kl.bo_sung_nht', true) IS DISTINCT FROM '1' THEN   -- 0141: hoàn tác bổ sung trả việc về "chưa ghi ngày hoàn thành"
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải ghi ngày hoàn thành thật (theo văn bản minh chứng).' USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NOT NULL AND (NEW."ngay_hoan_thanh" < v_ngay_bh OR NEW."ngay_hoan_thanh" > "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD."tien_do_ma" <> 'HOAN_THANH' THEN NEW."dong_luc" := now();
    ELSIF TG_OP = 'INSERT' AND NEW."nguon" = 'app' THEN NEW."dong_luc" := now();
    ELSIF TG_OP = 'UPDATE' THEN NEW."dong_luc" := OLD."dong_luc";
    END IF;
  END IF;
  NEW."thieu_minh_chung" := NEW."tien_do_ma" = 'HOAN_THANH' AND NOT v_du;
  IF (TG_OP = 'UPDATE' OR NEW."nguon" = 'app') AND NOT v_tinh_lai THEN   -- tính lại cờ không ghi đè người/giờ cập nhật cuối
    NEW."cap_nhat_luc" := now();
    NEW."cap_nhat_boi" := "auth"."uid"();
  END IF;
  IF TG_OP = 'INSERT' AND NEW."tao_boi" IS NULL THEN NEW."tao_boi" := "auth"."uid"(); END IF;
  RETURN NEW;
END;
$$;

-- v_nhiem_vu (bản 0103 nguyên văn + 1 cột cuối)
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
    nv.vuong_mac_gui_cho,
    -- Cột mới 0141 (cuối view): ngày hoàn thành do hệ thống bổ sung (LICH_SU / UOC_TINH), NULL = ngày do người dùng ghi
    nv.ngay_hoan_thanh_bo_sung
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

-- Việc cần bổ sung và ngày sẽ ghi (một nguồn cho xem trước và thực hiện). Ngày luôn trong khoảng [ngày ban hành văn bản, ngày giao nhiệm vụ] → hôm nay
-- (kiểm tra của kl_nhiem_vu_truoc_ghi; lead time không âm, DL-4); văn bản ban hành sau hôm nay thì bỏ qua. p_ids: chỉ xét các việc này (kiểm thử, chạy
-- thử một nhóm); NULL = mọi việc.
CREATE FUNCTION "public"."kl_nht_ung_vien"("p_ids" uuid[] DEFAULT NULL) RETURNS TABLE ("id" uuid, "ma" text, "han_xu_ly" date, "ngay" date, "nguon" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (
    SELECT nv."id", nv."ma", nv."han_xu_ly", vb."ngay_ban_hanh", nv."ngay_nhan_van_ban",
      (SELECT (l."luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date FROM "public"."lich_su" l
        WHERE l."nhiem_vu_id" = nv."id" AND l."cot" = 'tien_do_ma' AND l."gia_tri_moi" = 'HOAN_THANH' AND l."gia_tri_cu" IS DISTINCT FROM 'HOAN_THANH'
        ORDER BY l."luc" DESC LIMIT 1) AS ngay_ls,
      least(coalesce(nv."ngay_nhan_van_ban", vb."ngay_ban_hanh", (nv."created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) + 30,
            (nv."created_at" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS ngay_uoc
    FROM "public"."nhiem_vu" nv JOIN "public"."van_ban_giao_viec" vb ON vb."id" = nv."van_ban_id"
    WHERE nv."tien_do_ma" = 'HOAN_THANH' AND nv."ngay_hoan_thanh" IS NULL AND (vb."ngay_ban_hanh" IS NULL OR vb."ngay_ban_hanh" <= "public"."kl_hom_nay"())
      AND ("p_ids" IS NULL OR nv."id" = ANY ("p_ids"))
  )
  SELECT u."id", u."ma", u."han_xu_ly", least(greatest(coalesce(u.ngay_ls, u.ngay_uoc), u."ngay_ban_hanh", u."ngay_nhan_van_ban"), "public"."kl_hom_nay"()),
         CASE WHEN u.ngay_ls IS NULL THEN 'UOC_TINH' ELSE 'LICH_SU' END
  FROM u;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nht_ung_vien"(uuid[]) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_nht_ung_vien"(uuid[]) TO "service_role";

-- Xem trước (p_thuc_hien = false) hoặc thực hiện — cùng một vòng, từng việc một trong khối con: ghi ngày + dấu, chỉ khi việc vẫn hoàn thành và chưa có ngày
-- lúc ghi (người dùng vừa ghi ngày / mở lại việc trong lúc chạy: giữ nguyên, đếm "khong_con"); xem trước chạy thử rồi hoàn lại khối con (mã lỗi riêng
-- ZZ141) nên đếm đúng số sẽ ghi, số bị kiểm tra dữ liệu từ chối và đúng hạn / trễ hạn theo hạn SAU khi ghi (Ký ban hành tự tính lại hạn). Việc bị từ chối:
-- bỏ qua, ghi số lỗi và tối đa 5 "mã việc: lý do". Không đổi người / giờ cập nhật cuối (kl.minh_chung_tinh_lai — như tính lại cờ thiếu minh chứng).
-- Trả { tong, lich_su, uoc_tinh, ghi, khong_con, loi, mau_loi, co_han, dung_han, tre_han, thuc_hien, ngay } (co_han / dung_han / tre_han trong số ghi).
CREATE FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh"("p_thuc_hien" boolean DEFAULT false, "p_ids" uuid[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_han date; v_tong integer := 0; v_ls integer := 0; v_ghi integer := 0; v_khong integer := 0; v_loi integer := 0;
        v_co_han integer := 0; v_dung integer := 0; v_tre integer := 0; v_mau text[] := '{}';
BEGIN
  PERFORM set_config('kl.bo_sung_nht', '1', true);
  PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
  FOR c IN SELECT * FROM "public"."kl_nht_ung_vien"("p_ids") LOOP
    v_tong := v_tong + 1;
    IF c."nguon" = 'LICH_SU' THEN v_ls := v_ls + 1; END IF;
    BEGIN
      UPDATE "public"."nhiem_vu" SET "ngay_hoan_thanh" = c."ngay", "ngay_hoan_thanh_bo_sung" = c."nguon"
      WHERE "id" = c."id" AND "ngay_hoan_thanh" IS NULL AND "tien_do_ma" = 'HOAN_THANH'
      RETURNING "han_xu_ly" INTO v_han;
      IF FOUND THEN
        v_ghi := v_ghi + 1;
        IF v_han IS NOT NULL THEN
          v_co_han := v_co_han + 1;
          IF c."ngay" <= v_han THEN v_dung := v_dung + 1; ELSE v_tre := v_tre + 1; END IF;
        END IF;
      ELSE
        v_khong := v_khong + 1;
      END IF;
      IF NOT "p_thuc_hien" THEN RAISE EXCEPTION 'chạy thử' USING ERRCODE = 'ZZ141'; END IF;   -- xem trước: hoàn lại khối con
    EXCEPTION
      WHEN SQLSTATE 'ZZ141' THEN NULL;   -- biến đếm không bị hoàn lại; dữ liệu đã hoàn lại
      WHEN others THEN
        v_loi := v_loi + 1;
        IF cardinality(v_mau) < 5 THEN v_mau := v_mau || (c."ma" || ': ' || SQLERRM); END IF;
    END;
  END LOOP;
  PERFORM set_config('kl.bo_sung_nht', '', true);
  PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
  RETURN jsonb_build_object('tong', v_tong, 'lich_su', v_ls, 'uoc_tinh', v_tong - v_ls, 'ghi', v_ghi, 'khong_con', v_khong, 'loi', v_loi, 'mau_loi', to_jsonb(v_mau),
    'co_han', v_co_han, 'dung_han', v_dung, 'tre_han', v_tre, 'thuc_hien', "p_thuc_hien", 'ngay', "public"."kl_hom_nay"());
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh"(boolean, uuid[]) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh"(boolean, uuid[]) TO "service_role";

-- Hoàn tác: bỏ ngày đã bổ sung của mọi việc còn dấu (việc người dùng đã sửa ngày thì không còn dấu — giữ nguyên), từng việc một trong khối con: việc bị
-- kiểm tra dữ liệu từ chối (dữ liệu đổi sau khi bổ sung) thì bỏ qua, ghi số lỗi và tối đa 5 "mã việc: lý do". Trả { hoan_tac, loi, mau_loi }.
CREATE FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh_hoan_tac"("p_ids" uuid[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_n integer := 0; v_loi integer := 0; v_mau text[] := '{}';
BEGIN
  PERFORM set_config('kl.bo_sung_nht', '1', true);
  PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
  FOR c IN SELECT n."id", n."ma" FROM "public"."nhiem_vu" n WHERE n."ngay_hoan_thanh_bo_sung" IS NOT NULL AND ("p_ids" IS NULL OR n."id" = ANY ("p_ids")) LOOP
    BEGIN
      UPDATE "public"."nhiem_vu" SET "ngay_hoan_thanh" = NULL, "ngay_hoan_thanh_bo_sung" = NULL WHERE "id" = c."id" AND "ngay_hoan_thanh_bo_sung" IS NOT NULL;
      IF FOUND THEN v_n := v_n + 1; END IF;
    EXCEPTION WHEN others THEN
      v_loi := v_loi + 1;
      IF cardinality(v_mau) < 5 THEN v_mau := v_mau || (c."ma" || ': ' || SQLERRM); END IF;
    END;
  END LOOP;
  PERFORM set_config('kl.bo_sung_nht', '', true);
  PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
  RETURN jsonb_build_object('hoan_tac', v_n, 'loi', v_loi, 'mau_loi', to_jsonb(v_mau));
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh_hoan_tac"(uuid[]) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_bo_sung_ngay_hoan_thanh_hoan_tac"(uuid[]) TO "service_role";
