-- 0093 (Đợt D v3.20): nhập Excel theo định hướng 8/10/2026.
-- 1. kl_nhap_giao (bản 0080 + một dòng "0093"): nhận ba ô nguồn của 0087 — Mức quan trọng, Cơ quan trình, Thường trực chỉ đạo (giao_viec 0088 kiểm
--    giá trị; sai thì dòng báo lỗi). Số thứ tự trong văn bản tự tính như biểu mẫu.
-- 1b. kl_truong_nhap (bản 0072): mã trường hồ sơ nhập thêm muc_quan_trong, co_quan_trinh, thuong_truc_chi_dao (mẫu nhập chuẩn 28 cột).
-- 2. kl_nhap_minh_chung (bản 0074): dòng "Hoàn thành" có đủ kết quả ở chế độ "ghi minh chứng" (CHO_NGHIEM_THU) → minh chứng hợp lệ ngay và việc
--    hoàn thành theo ngày văn bản minh chứng (không chờ lãnh đạo nghiệm thu — như nop_minh_chung 0090).
-- 3. hoan_tac_lo (bản 0075, chỉ nhánh CAP_NHAT đổi): minh chứng lô ghi cho việc có sẵn (hợp lệ ngay từ mục 2) bị xoá theo thời điểm lô ghi, việc lô
--    đã hoàn thành được mở lại về tiến độ trước khi nhập (giá trị cũ lấy từ lịch sử cột tien_do_ma cùng thời điểm).

CREATE OR REPLACE FUNCTION "public"."kl_nhap_giao"("d" jsonb, "p_vb" uuid, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_k jsonb; v_han_nop date := nullif("d" ->> 'han_nop_minh_chung', '')::date; v_ly_do text; v_kq jsonb;
        v_nv "public"."nhiem_vu"; v_mc boolean; v_loai text := coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE');
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_vb";
  v_k := "public"."kl_khung_han_nop"(nullif("d" ->> 'han_xu_ly', '')::date, v_vb."ngay_ban_hanh", v_loai);
  IF v_han_nop IS NULL AND v_k IS NOT NULL THEN v_han_nop := (v_k ->> 'goi_y')::date; END IF;
  IF v_han_nop IS NOT NULL AND v_k IS NOT NULL AND (v_k ->> 'khong_ly_do_den' IS NULL OR v_han_nop > (v_k ->> 'khong_ly_do_den')::date) THEN
    v_ly_do := format('Nhập từ Excel (lô %s): hạn hoàn thành %s', "p_lo"."ma", CASE WHEN (v_k ->> 'qua_han')::boolean THEN 'đã qua' ELSE 'sát ngày nhập' END);
  END IF;
  PERFORM set_config('kl.nhap_excel', '1', true);
  v_kq := "public"."giao_viec"(jsonb_strip_nulls(jsonb_build_object(
    'van_ban_id', "p_vb", 'noi_dung', "d" ->> 'noi_dung', 'owner_don_vi_ma', "d" ->> 'owner_don_vi_ma', 'owner_tai_khoan', "d" ->> 'owner_tai_khoan',
    'nguoi_theo_doi', "d" ->> 'nguoi_theo_doi', 'thay_mat_cho', CASE WHEN "public"."me_role"() = 'A3' THEN "d" ->> 'thay_mat_cho' END,
    'thay_mat_nhom', CASE WHEN "public"."me_role"() = 'A3' THEN "d" ->> 'thay_mat_nhom' END,   -- 0079
    'loai_thoi_han_ma', v_loai, 'han_xu_ly', "d" ->> 'han_xu_ly', 'san_pham_loai', "d" ->> 'san_pham_loai', 'cap_nhan_san_pham', "d" ->> 'cap_nhan_san_pham',
    'do_khan', coalesce(nullif("d" ->> 'do_khan', ''), 'THUONG'), 'nguon_nhiem_vu_ma', "d" ->> 'nguon_nhiem_vu_ma', 'nganh_ma', "d" ->> 'nganh_ma',
    'linh_vuc_ma', "d" ->> 'linh_vuc_ma', 'linh_vuc_chi_tiet', "d" ->> 'linh_vuc_chi_tiet', 'van_ban_trien_khai', "d" ->> 'van_ban_trien_khai',
    'don_vi_phoi_hop', "d" ->> 'don_vi_phoi_hop', 'ghi_chu', "d" ->> 'ghi_chu', 'vuong_mac', "d" ->> 'vuong_mac',
    'muc_quan_trong', "d" ->> 'muc_quan_trong', 'co_quan_trinh', "d" ->> 'co_quan_trinh', 'thuong_truc_chi_dao', "d" ->> 'thuong_truc_chi_dao',   -- 0093
    'ngay_nhan_van_ban', coalesce(v_vb."ngay_nhan", v_vb."ngay_ban_hanh"), 'han_nop_minh_chung', v_han_nop, 'ly_do_han_nop_sat', v_ly_do, 'theo_1400', true)));
  PERFORM set_config('kl.nhap_excel', '', true);
  IF v_vb."ngay_nhan" IS NULL THEN   -- tệp không có ngày nhận: lấy ngày ban hành, ghi là ƯỚC TÍNH (chủ trì sửa được ngày nhận thật — 0070 b)
    PERFORM set_config('kl.ghi_qua_ham', '1', true);
    UPDATE "public"."nhiem_vu" SET "ngay_nhan_uoc_tinh" = true WHERE "id" = (v_kq ->> 'id')::uuid;
    PERFORM set_config('kl.ghi_qua_ham', '', true);
  END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = (v_kq ->> 'id')::uuid;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v_nv."id", "auth"."uid"(), 'nhap_excel', format('Nhập từ Excel · lô %s, dòng %s (tệp %s)', "p_lo"."ma", "d" ->> 'so_dong', "p_lo"."ten_tep"), 'app');
  v_mc := "d" ->> 'tien_do_ma' = 'HOAN_THANH' AND "p_lo"."che_do_xong" = 'CHO_NGHIEM_THU' AND "public"."kl_nhap_du_kq"("d");
  IF v_mc THEN PERFORM "public"."kl_nhap_minh_chung"(v_nv, "d", "p_lo"); END IF;
  RETURN jsonb_build_object('id', v_nv."id", 'ma', v_nv."ma", 'minh_chung', v_mc);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_nhap_minh_chung"("p_nv" "public"."nhiem_vu", "d" jsonb, "p_lo" "public"."lo_nhap") RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_loi text; v_ngay date := ("d" ->> 'kq_ngay')::date; v_so text := left(btrim("d" ->> 'kq_so_hieu'), 100);
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_nv"."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION 'Minh chứng: %', v_loi USING ERRCODE = '22023'; END IF;
  IF "p_nv"."cap_nhan_san_pham" IS NULL THEN RAISE EXCEPTION 'Minh chứng cần cấp nhận sản phẩm của việc.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi", "hop_le", "xac_nhan_luc")
  VALUES ("p_nv"."id", 'so_hieu', v_so, v_ngay, "p_nv"."cap_nhan_san_pham", left(btrim("d" ->> 'kq_trich_yeu'), 300), left(btrim("d" ->> 'kq_mo_ta'), 600),
          coalesce("p_nv"."owner_tai_khoan", "p_nv"."nguoi_theo_doi"), true, now());   -- 0093: hợp lệ ngay (tự hoàn thành, như nop_minh_chung 0090)
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_nv"."id", "auth"."uid"(), 'minh_chung_nop', format('Nộp minh chứng (nhập Excel lô %s) · %s: số %s · %s (ngày %s)', "p_lo"."ma", "p_nv"."ma", v_so,
          left(btrim("d" ->> 'kq_trich_yeu'), 120), to_char(v_ngay, 'DD/MM/YYYY')), 'app');
  IF "p_nv"."tien_do_ma" <> 'HOAN_THANH' AND "p_nv"."dong_luc" IS NULL THEN   -- 0093: việc đang mở → hoàn thành theo ngày văn bản minh chứng
    PERFORM set_config('kl.ghi_qua_ham', '1', true);
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_ngay WHERE "id" = "p_nv"."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES ("p_nv"."id", "auth"."uid"(), 'dong_nhiem_vu', format('Hoàn thành nhiệm vụ · %s: theo minh chứng số %s (nhập Excel lô %s), ngày hoàn thành %s', "p_nv"."ma", v_so,
            "p_lo"."ma", to_char(v_ngay, 'DD/MM/YYYY')), 'app');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_truong_nhap"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ma', 'loai_van_ban', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'noi_dung', 'don_vi', 'can_bo', 'theo_doi', 'lanh_dao_giao',
               'loai_thoi_han', 'han_xu_ly', 'san_pham', 'cap_nhan', 'do_khan', 'nguon', 'nganh', 'linh_vuc', 'tien_do', 'vuong_mac',
               'kq_so_hieu', 'kq_ngay', 'kq_trich_yeu', 'kq_mo_ta', 'chat_luong',
               'linh_vuc_chi_tiet', 'van_ban_trien_khai', 'han_nop', 'don_vi_phoi_hop', 'ghi_chu',
               'muc_quan_trong', 'co_quan_trinh', 'thuong_truc_chi_dao']::text[];   -- 0093
$$;

CREATE OR REPLACE FUNCTION "public"."hoan_tac_lo"("p_lo" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lo "public"."lo_nhap"; d "public"."dong_nhap"; v "public"."nhiem_vu"; v_giu text[] := '{}'; v_n integer := 0; v_tg jsonb;
        v_nhan jsonb := '[]'::jsonb; v_me uuid := "auth"."uid"(); r record;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = "p_lo" FOR UPDATE;
  IF v_lo."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy lô nhập.' USING ERRCODE = '22023'; END IF;
  IF v_lo."tao_boi" <> v_me AND NOT "public"."me_quan_tri_he_thong"() THEN
    RAISE EXCEPTION 'Chỉ người nhập lô hoặc quản trị hệ thống mới hoàn tác.' USING ERRCODE = '42501';
  END IF;
  IF v_lo."hoan_tac_luc" IS NOT NULL THEN RAISE EXCEPTION 'Lô % đã hoàn tác trước đó.', v_lo."ma" USING ERRCODE = '22023'; END IF;
  IF now() > v_lo."tao_luc" + interval '24 hours' THEN
    RAISE EXCEPTION 'Lô % nhập quá 24 giờ — không hoàn tác cả lô; sửa từng việc trên hệ thống.', v_lo."ma" USING ERRCODE = '22023';
  END IF;
  FOR d IN SELECT * FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "nhiem_vu_id" IS NOT NULL AND "ket_qua" IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU', 'CAP_NHAT')
           ORDER BY "so_dong" FOR UPDATE LOOP
    SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = d."nhiem_vu_id" FOR UPDATE;
    IF v."id" IS NULL THEN CONTINUE; END IF;
    IF "public"."kl_nhap_da_cham"(v."id", d."xu_ly_luc") THEN v_giu := v_giu || v."ma"; CONTINUE; END IF;
    BEGIN   -- mỗi dòng một khối con: dòng không trả lại được (ràng buộc nghiệp vụ) được giữ và báo mã, các dòng khác vẫn hoàn tác
      IF d."ket_qua" = 'CAP_NHAT' THEN   -- trả giá trị trước khi nhập
        IF coalesce(d."gia_tri_cu" ? '_minh_chung', false) THEN   -- 0093: minh chứng lô ghi đã hợp lệ ngay và đã hoàn thành việc
          DELETE FROM "public"."minh_chung" WHERE "nhiem_vu_id" = v."id" AND "nop_luc" = d."xu_ly_luc" AND "xac_nhan_boi" IS NULL;
          IF v."tien_do_ma" = 'HOAN_THANH' AND NOT "public"."minh_chung_co_hop_le"(v."id") THEN   -- mở lại về tiến độ trước khi nhập (lịch sử cùng lúc)
            PERFORM set_config('kl.ghi_qua_ham', '1', true);
            UPDATE "public"."nhiem_vu" SET "tien_do_ma" = coalesce((SELECT l."gia_tri_cu" FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = v."id"
              AND l."cot" = 'tien_do_ma' AND l."luc" = d."xu_ly_luc" AND l."gia_tri_cu" IS NOT NULL ORDER BY l."id" DESC LIMIT 1), 'DANG_THUC_HIEN') WHERE "id" = v."id";
            PERFORM set_config('kl.ghi_qua_ham', '', true);
          END IF;
        END IF;
        v_tg := coalesce(d."gia_tri_cu", '{}'::jsonb) - 'vuong_mac' - '_minh_chung';
        IF v_tg -> 'nguon_nhiem_vu_ma' = 'null'::jsonb THEN v_tg := v_tg - 'nguon_nhiem_vu_ma'; END IF;   -- nguồn đã chọn không bỏ trống lại (0062)
        IF v_tg <> '{}'::jsonb THEN PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_tg); END IF;
        IF coalesce(d."gia_tri_cu" ? 'vuong_mac', false) THEN
          PERFORM set_config('kl.ghi_qua_ham', '1', true);
          UPDATE "public"."nhiem_vu" SET "vuong_mac" = d."gia_tri_cu" ->> 'vuong_mac' WHERE "id" = v."id";
          PERFORM set_config('kl.ghi_qua_ham', '', true);
        END IF;
        INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
        VALUES (v."id", v_me, 'nhap_excel', format('Hoàn tác lô nhập Excel %s: trả giá trị trước khi nhập', v_lo."ma"), 'app');
      ELSE
        DELETE FROM "public"."nhiem_vu" WHERE "id" = v."id";   -- lịch sử, minh chứng, tin của việc theo FK CASCADE
        IF d."ket_qua" <> 'DA_XONG' THEN   -- tin hoàn tác chỉ cho người đã nhận tin tổng hợp (việc giao của lô ĐÃ chốt), mỗi việc tính một lần
          v_nhan := v_nhan || jsonb_build_array(jsonb_build_object('u', v."owner_tai_khoan", 'v', v."id"), jsonb_build_object('u', v."nguoi_theo_doi", 'v', v."id"),
                                                jsonb_build_object('u', v."giao_thay_mat_cho", 'v', v."id"));
        END IF;
      END IF;
      UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_TAC', "xu_ly_boi" = v_me, "xu_ly_luc" = now() WHERE "id" = d."id";
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      v_giu := v_giu || v."ma";
    END;
  END LOOP;
  UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_TAC', "xu_ly_boi" = v_me, "xu_ly_luc" = now() WHERE "lo_id" = "p_lo" AND "ket_qua" = 'CHO_HOAN_THIEN';
  DELETE FROM "public"."van_ban_giao_viec" vb   -- chỉ văn bản CHÍNH lô này tạo (máy chủ ghi van_ban_moi; người tạo + thời điểm khớp lô), không còn việc nào
  WHERE vb."id" IN (SELECT ("du_lieu" ->> 'van_ban_id')::uuid FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "du_lieu" ->> 'van_ban_moi' = 'true')
    AND vb."tao_boi" = v_lo."tao_boi" AND vb."created_at" >= v_lo."tao_luc"
    AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = vb."id");
  UPDATE "public"."lo_nhap" SET "hoan_tac_luc" = now(), "hoan_tac_boi" = v_me, "xong_luc" = coalesce("xong_luc", now()),
    "so_lieu" = (SELECT jsonb_object_agg("ket_qua", n) FROM (SELECT "ket_qua", count(*) AS n FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" GROUP BY 1) x)
  WHERE "id" = "p_lo";
  FOR r IN SELECT a."id" AS u, count(DISTINCT x ->> 'v') AS n FROM jsonb_array_elements(v_nhan) x JOIN "public"."accounts" a ON a."id"::text = x ->> 'u'
           WHERE v_lo."xong_luc" IS NOT NULL AND a."id" NOT IN (v_me, v_lo."tao_boi") AND NOT a."is_system" AND a."role_group" <> 'A0' GROUP BY a."id" LOOP
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    VALUES (v_me, r.u, format('Nhập Excel · lô %s đã được hoàn tác: %s việc liên quan tới đồng chí không còn trên hệ thống.', v_lo."ma", r.n), false, 'he_thong', NULL);
  END LOOP;
  PERFORM "public"."nhat_ky_ghi"('hoan_tac_lo', v_lo."ma", jsonb_build_object('hoan_tac', v_n, 'giu_lai', to_jsonb(v_giu)));
  RETURN jsonb_build_object('hoan_tac', v_n, 'giu_lai', to_jsonb(v_giu));
END;
$$;
