-- 0090 (Đợt D v3.20 — định hướng chủ dự án 8/10/2026: lãnh đạo Thường trực / lãnh đạo Văn phòng / lãnh đạo phòng dùng phần mềm để THEO DÕI
-- và cho ý kiến chỉ đạo; chuyên viên nhập liệu; không bước nào trong luồng thực hiện nhiệm vụ bắt lãnh đạo phải bấm). Bốn việc:
-- 1. nop_minh_chung: nộp minh chứng hợp lệ (số hiệu + ngày; cấp nhận theo việc; tệp tuỳ chọn — bắt buộc khi cấu hình 2) = TỰ HOÀN THÀNH nhiệm vụ
--    (Công văn 1400 bước 4 QT-4: hệ thống chốt lead time, ghi nhận hoàn thành, đóng nhiệm vụ). Ngày hoàn thành = ngày văn bản minh chứng (như
--    nghiệm thu cũ). Minh chứng ghi hop_le = true ngay, xac_nhan_boi NULL (tự động). Quyền nộp: kl_duoc_nop_minh_chung (0089) — Owner, người
--    theo dõi, người tạo việc (chuyên viên nộp thay khi Owner là lãnh đạo), lãnh đạo / quản trị nhiệm vụ trong phạm vi.
-- 2. xac_nhan_minh_chung: không còn là bước bắt buộc. Người giao việc (tầng giao), người theo dõi, lãnh đạo trong phạm vi được (tuỳ chọn):
--    Trả lại (lý do; minh chứng hợp lệ cuối cùng bị trả lại ⇒ nhiệm vụ mở lại, chất lượng xoá) hoặc đánh giá chất lượng hoàn thành.
--    Minh chứng nộp trước 0090 còn chờ: phần dữ liệu cũ được chốt tự động ở mục 4.
-- 3. gan_tep_minh_chung: gắn tệp (kho "minh-chung", 0089) vào minh chứng đã nộp chưa có tệp — người nộp hoặc người được nộp minh chứng.
-- 4. Nhận việc: lãnh đạo (A1 / A2) là Owner hoặc người theo dõi được ghi "đã nhận" tự động khi giao / giao lại (không phải bấm "Xác nhận đã
--    nhận"); chuyên viên vẫn theo cấu hình xac_nhan_nhan_viec (0085). Dữ liệu cũ: minh chứng đang chờ nghiệm thu → hợp lệ, việc đang mở có minh
--    chứng đó → hoàn thành theo ngày văn bản; việc đang mở có lãnh đạo chưa xác nhận → ghi "đã nhận" tự động.

-- ---- 1. Nộp minh chứng = hoàn thành ----
CREATE OR REPLACE FUNCTION "public"."nop_minh_chung"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_id uuid; v_loi text; v_mo boolean;
        v_so text := nullif(btrim(coalesce("p" ->> 'so_hieu', '')), ''); v_ngay date := nullif("p" ->> 'ngay_van_ban', '')::date;
        v_cap text := nullif(btrim(coalesce("p" ->> 'cap_nhan', '')), ''); v_cap_ten text;
        v_trich_yeu text := nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), ''); v_mo_ta text := nullif(btrim(coalesce("p" ->> 'mo_ta_ket_qua', '')), '');
        v_tep text := nullif(btrim(coalesce("p" ->> 'tep_path', '')), ''); v_tep_ten text := left(nullif(btrim(coalesce("p" ->> 'tep_ten', '')), ''), 200);
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_nop_minh_chung"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi, người giao việc hoặc lãnh đạo trong phạm vi mới nộp minh chứng cho nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  v_cap := coalesce(v_cap, v_nv."cap_nhan_san_pham");   -- 0086: cấp nhận để trống = cấp nhận sản phẩm ghi khi giao
  IF v_so IS NULL OR v_ngay IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải có số hiệu và ngày văn bản (cấp nhận lấy theo việc nếu để trống).' USING ERRCODE = '22023';
  END IF;
  IF v_cap IS NULL THEN RAISE EXCEPTION 'Việc chưa ghi cấp nhận sản phẩm — chọn cấp nhận cho minh chứng.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_mo_ta) > 600 THEN RAISE EXCEPTION 'Mô tả kết quả tối đa 600 ký tự.' USING ERRCODE = '22023'; END IF;
  SELECT "ten" INTO v_cap_ten FROM "public"."dm_cap" WHERE "ma" = v_cap;
  IF v_cap_ten IS NULL THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  IF v_tep IS NULL AND "public"."kl_bat_buoc_tep_mc"() THEN
    RAISE EXCEPTION 'Minh chứng phải kèm tệp (PDF, Word, Excel hoặc ảnh, tối đa 10 MB).' USING ERRCODE = '22023';
  END IF;
  IF v_tep IS NOT NULL THEN
    IF "public"."kl_tep_mc_nhiem_vu"(v_tep) IS DISTINCT FROM v_nv."id"
       OR NOT EXISTS (SELECT 1 FROM "storage"."objects" o WHERE o."bucket_id" = 'minh-chung' AND o."name" = v_tep) THEN
      RAISE EXCEPTION 'Tệp minh chứng chưa được tải lên cho đúng nhiệm vụ — chọn lại tệp.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."tep_path" = v_tep) THEN
      RAISE EXCEPTION 'Tệp này đã gắn với một minh chứng khác.' USING ERRCODE = '22023';
    END IF;
    v_tep_ten := coalesce(v_tep_ten, split_part(v_tep, '/', 2));
  END IF;
  v_mo := v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi",
                                     "tep_path", "tep_ten", "hop_le", "xac_nhan_luc")
  VALUES (v_nv."id", 'so_hieu', v_so, v_ngay, v_cap, v_trich_yeu, v_mo_ta, "auth"."uid"(), v_tep, CASE WHEN v_tep IS NOT NULL THEN v_tep_ten END, true, now())
  RETURNING "id" INTO v_id;
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_nop',
    format('Nộp minh chứng · %s: số %s%s (ngày %s, %s)%s', v_nv."ma", v_so, coalesce(' · ' || v_trich_yeu, ''), to_char(v_ngay, 'DD/MM/YYYY'), v_cap_ten,
           CASE WHEN v_tep IS NOT NULL THEN ' · kèm tệp' ELSE '' END) || CASE WHEN v_mo THEN ' — nhiệm vụ hoàn thành' ELSE '' END);
  IF v_mo THEN
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_ngay WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (v_nv."id", "auth"."uid"(), 'dong_nhiem_vu',
            format('Hoàn thành nhiệm vụ · %s: theo minh chứng số %s, ngày hoàn thành %s (tự động khi nộp minh chứng hợp lệ)', v_nv."ma", v_so, to_char(v_ngay, 'DD/MM/YYYY')), 'app');
  END IF;
  RETURN v_id;
END;
$$;

-- Người được trả lại / đánh giá minh chứng (tuỳ chọn): như nghiệm thu cũ (kl_duoc_nghiem_thu — người theo dõi, lãnh đạo Văn phòng / phòng trong
-- phạm vi, quản trị nhiệm vụ) cộng tầng giao (người giao việc kể cả Thường trực, chuyên viên nhập / giao việc — kl_la_tang_giao, 0091). Giữ 0061:
-- Chánh VP chủ trì việc Thường trực giao không tự xem lại.
CREATE OR REPLACE FUNCTION "public"."kl_duoc_xem_lai_minh_chung"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND ("public"."kl_duoc_nghiem_thu"(("p_nv")."id")
    OR ("public"."kl_la_tang_giao"("p_nv") AND NOT ("public"."kl_viec_a0_giao_cvp"("p_nv") AND ("p_nv")."owner_tai_khoan" = "auth"."uid"())));
$$;
REVOKE ALL ON FUNCTION "public"."kl_duoc_xem_lai_minh_chung"("public"."nhiem_vu") FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_duoc_xem_lai_minh_chung"("public"."nhiem_vu") TO "authenticated";

-- ---- 2. Trả lại / đánh giá chất lượng (tuỳ chọn) ----
CREATE OR REPLACE FUNCTION "public"."xac_nhan_minh_chung"("p_id" uuid, "p_hop_le" boolean, "p_ly_do" text DEFAULT NULL, "p_han_nop_lai" date DEFAULT NULL,
                                                          "p_chat_luong" text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mc "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
        v_mo boolean; v_mo_lai boolean := false; v_thay text := ''; v_tin text; v_cl text := nullif(btrim(coalesce("p_chat_luong", '')), '');
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NOT NULL THEN SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id"; END IF;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_xem_lai_minh_chung"(v_nv) THEN
    RAISE EXCEPTION 'Chỉ người giao việc, người theo dõi hoặc lãnh đạo trong phạm vi mới trả lại hoặc đánh giá minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."nop_boi" = "auth"."uid"() THEN RAISE EXCEPTION 'Không tự trả lại hay đánh giá minh chứng do chính mình nộp.' USING ERRCODE = '42501'; END IF;
  IF "p_hop_le" IS NULL THEN RAISE EXCEPTION 'Phải chọn đánh giá hoặc trả lại.' USING ERRCODE = '22023'; END IF;
  IF v_cl IS NOT NULL AND "public"."kl_ten_chat_luong"(v_cl) IS NULL THEN RAISE EXCEPTION 'Chất lượng hoàn thành không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_mc."hop_le" = false THEN RAISE EXCEPTION 'Minh chứng này đã bị trả lại — người thực hiện nộp minh chứng mới.' USING ERRCODE = '22023'; END IF;
  IF "public"."kl_viec_a0_giao_cvp"(v_nv) AND ("public"."me_thu_ky_tt"() OR "public"."me_quan_tri_kl"()) THEN   -- Q8: thư ký / quản trị thay mặt
    v_thay := ' — thay mặt Thường trực — ' || coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), '');
  END IF;
  v_mo := v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- chat_luong, tien_do_ma: guard a3 cho qua các câu UPDATE trong hàm
  IF "p_hop_le" THEN
    IF v_mc."hop_le" IS NULL THEN   -- minh chứng nộp trước 0090 còn chờ (dữ liệu cũ): xác nhận như nghiệm thu cũ, chất lượng tuỳ chọn
      UPDATE "public"."minh_chung" SET "hop_le" = true, "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(), "han_nop_lai" = NULL WHERE "id" = "p_id";
      PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan', format('Minh chứng hợp lệ · %s: %s%s', v_nv."ma", coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)), v_thay));
      IF v_mo AND v_mc."ngay_van_ban" IS NOT NULL THEN
        UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_mc."ngay_van_ban", "chat_luong" = v_cl WHERE "id" = v_nv."id";
        PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'dong_nhiem_vu', format('Hoàn thành nhiệm vụ · %s: ngày hoàn thành %s%s%s', v_nv."ma",
          to_char(v_mc."ngay_van_ban", 'DD/MM/YYYY'), coalesce(' — chất lượng: ' || "public"."kl_ten_chat_luong"(v_cl), ''), v_thay));
        v_cl := NULL;
      END IF;
    ELSIF v_cl IS NULL THEN
      RAISE EXCEPTION 'Minh chứng đã hợp lệ (tự động khi nộp) — chọn chất lượng hoàn thành để đánh giá, hoặc Trả lại nếu chưa đạt.' USING ERRCODE = '22023';
    END IF;
    IF v_cl IS NOT NULL THEN
      IF (SELECT "tien_do_ma" FROM "public"."nhiem_vu" WHERE "id" = v_nv."id") <> 'HOAN_THANH' THEN
        RAISE EXCEPTION 'Chỉ đánh giá chất lượng khi nhiệm vụ đã hoàn thành.' USING ERRCODE = '22023';
      END IF;
      UPDATE "public"."nhiem_vu" SET "chat_luong" = v_cl WHERE "id" = v_nv."id";   -- trigger lịch sử 0023 ghi cột chat_luong (cũ → mới) — diễn biến hiện tên mức
    END IF;
  ELSE
    IF v_cl IS NOT NULL THEN RAISE EXCEPTION 'Trả lại minh chứng không ghi chất lượng hoàn thành.' USING ERRCODE = '22023'; END IF;
    IF v_ly_do IS NULL THEN RAISE EXCEPTION 'Trả lại minh chứng phải ghi lý do.' USING ERRCODE = '22023'; END IF;
    UPDATE "public"."minh_chung" SET "hop_le" = false, "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(), "ly_do_khong_hop_le" = v_ly_do, "han_nop_lai" = NULL
    WHERE "id" = "p_id";
    -- Minh chứng hợp lệ cuối cùng của việc đã hoàn thành bị trả lại ⇒ mở lại việc (ngày hoàn thành, lúc đóng, chất lượng xoá — trigger 0028 / 0062).
    IF NOT v_mo AND NOT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v_nv."id" AND m."id" <> "p_id" AND "public"."minh_chung_la_hop_le"(m)) THEN
      UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'DANG_THUC_HIEN' WHERE "id" = v_nv."id";
      v_mo_lai := true;
    END IF;
    v_tin := format('Minh chứng bị trả lại · %s: %s — %s%s%s', v_nv."ma", coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)), v_ly_do,
      CASE WHEN v_mo_lai OR v_mo THEN ' — nhiệm vụ chưa hoàn thành, nộp minh chứng mới' || coalesce(' trước hạn ' || to_char(v_nv."han_xu_ly", 'DD/MM/YYYY'), '') ELSE '' END, v_thay);
    PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan', v_tin);
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")   -- người nộp luôn nhận tin
    SELECT "auth"."uid"(), v_mc."nop_boi", v_tin, false, 'he_thong', v_nv."id"
    WHERE v_mc."nop_boi" IS NOT NULL AND NOT (v_mc."nop_boi" = ANY (ARRAY(SELECT "public"."nguoi_lien_quan"(v_nv."id"))));
  END IF;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

-- ---- 3. Gắn tệp vào minh chứng đã nộp ----
CREATE OR REPLACE FUNCTION "public"."gan_tep_minh_chung"("p_id" uuid, "p_tep_path" text, "p_tep_ten" text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mc "public"."minh_chung"; v_ma text; v_ten text := left(nullif(btrim(coalesce("p_tep_ten", '')), ''), 200);
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NULL OR NOT (v_mc."nop_boi" = "auth"."uid"() OR "public"."kl_duoc_nop_minh_chung"(v_mc."nhiem_vu_id")) THEN
    RAISE EXCEPTION 'Chỉ người nộp hoặc người được nộp minh chứng của nhiệm vụ mới gắn tệp.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."loai" <> 'so_hieu' OR v_mc."tep_path" IS NOT NULL THEN RAISE EXCEPTION 'Minh chứng này đã có tệp hoặc không gắn tệp được.' USING ERRCODE = '22023'; END IF;
  IF v_mc."hop_le" = false THEN RAISE EXCEPTION 'Minh chứng đã bị trả lại — nộp minh chứng mới kèm tệp.' USING ERRCODE = '22023'; END IF;
  IF "public"."kl_tep_mc_nhiem_vu"("p_tep_path") IS DISTINCT FROM v_mc."nhiem_vu_id"
     OR NOT EXISTS (SELECT 1 FROM "storage"."objects" o WHERE o."bucket_id" = 'minh-chung' AND o."name" = "p_tep_path")
     OR EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."tep_path" = "p_tep_path") THEN
    RAISE EXCEPTION 'Tệp minh chứng chưa được tải lên cho đúng nhiệm vụ — chọn lại tệp.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."minh_chung" SET "tep_path" = "p_tep_path", "tep_ten" = coalesce(v_ten, split_part("p_tep_path", '/', 2)) WHERE "id" = "p_id";
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v_mc."nhiem_vu_id", "auth"."uid"(), 'tep_minh_chung', format('Gắn tệp minh chứng · %s: số %s — %s', v_ma, v_mc."so_hieu", coalesce(v_ten, 'tệp')), 'app');
END;
$$;
REVOKE ALL ON FUNCTION "public"."gan_tep_minh_chung"(uuid, text, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."gan_tep_minh_chung"(uuid, text, text) TO "authenticated";

-- Câu báo của trigger 0077 (mọi đường ghi Hoàn thành): không còn "lãnh đạo nghiệm thu".
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_han_nop_mc"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."han_nop_minh_chung" := NULL; NEW."ly_do_han_nop_sat" := NULL;   -- 0077: hạn nộp minh chứng đã bỏ — mọi đường ghi đều về NULL
  IF NEW."tien_do_ma" = 'HOAN_THANH' AND (TG_OP = 'INSERT' OR OLD."tien_do_ma" <> 'HOAN_THANH') AND NEW."theo_1400" AND "auth"."uid"() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = NEW."id" AND m."hop_le") THEN
    RAISE EXCEPTION 'Nhiệm vụ hoàn thành khi nộp minh chứng hợp lệ (số hiệu, ngày văn bản) — nộp ở mục Minh chứng.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- ---- 4. Nhận việc: lãnh đạo không phải xác nhận ----
CREATE OR REPLACE FUNCTION "public"."nhiem_vu_tu_nhan_viec"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid; v_vai text; v_cau_hinh boolean;
BEGIN
  IF NOT coalesce(NEW."theo_1400", false) OR NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL THEN RETURN NULL; END IF;
  v_cau_hinh := "public"."kl_tu_nhan_viec"();
  FOREACH u IN ARRAY ARRAY[NEW."owner_tai_khoan", NEW."nguoi_theo_doi"] LOOP
    CONTINUE WHEN u IS NULL;
    SELECT CASE WHEN a."is_system" THEN NULL ELSE a."role_group" END INTO v_vai FROM "public"."accounts" a WHERE a."id" = u;
    CONTINUE WHEN v_vai IS NULL OR v_vai = 'A0' OR (v_vai = 'A3' AND NOT v_cau_hinh)
      OR EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = NEW."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = u);
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (NEW."id", u, 'xac_nhan_nhan_viec', CASE WHEN v_vai = 'A3' THEN 'tự động khi giao (cấu hình không yêu cầu xác nhận) '
                                                     ELSE 'tự động khi giao (lãnh đạo không phải xác nhận nhận việc) ' END
            || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app');
  END LOOP;
  RETURN NULL;
END;
$$;

-- Diễn biến (v_dien_bien bản 0046): minh chứng hợp lệ tự động không thành dòng "Xác nhận" riêng; ghi "kèm tệp"; "Không hợp lệ" → "Trả lại".
CREATE OR REPLACE VIEW "public"."v_dien_bien" WITH ("security_invoker" = true) AS
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
       CASE WHEN m."trich_yeu" IS NOT NULL THEN format('Nộp minh chứng %s · %s', m."so_hieu", m."trich_yeu")
            ELSE format('Nộp minh chứng %s', concat_ws(' · ', m."so_hieu", to_char(m."ngay_van_ban", 'DD/MM/YYYY'), m."cap_nhan", left(m."noi_dung_chu", 80))) END
         || CASE WHEN m."tep_path" IS NOT NULL THEN ' · kèm tệp' ELSE '' END, NULL,
       CASE WHEN m."hop_le" IS NULL THEN 'CHO_XAC_NHAN' WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."nop_boi"
UNION ALL
SELECT 'mx-' || m."id", m."nhiem_vu_id", m."xac_nhan_luc", 'minh_chung', 'xac_nhan', m."xac_nhan_boi", a."full_name",
       format('%s minh chứng %s%s', CASE WHEN m."hop_le" THEN 'Xác nhận hợp lệ' ELSE 'Trả lại' END, coalesce(m."so_hieu", ''), coalesce(' — ' || m."ly_do_khong_hop_le", '')), NULL,
       CASE WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."xac_nhan_boi"
WHERE m."xac_nhan_luc" IS NOT NULL AND (m."xac_nhan_boi" IS NOT NULL OR m."hop_le" IS DISTINCT FROM true)   -- 0090: hợp lệ tự động khi nộp không thành dòng riêng
ORDER BY 3 DESC, 1 DESC;

-- ---- Dữ liệu cũ ----
DO $$
DECLARE r record; v_nv uuid[]; v_bo integer := 0;
BEGIN
  -- Minh chứng đang chờ nghiệm thu → hợp lệ (tự động). CHỈ việc có minh chứng VỪA chuyển, đang mở → hoàn thành theo ngày văn bản minh chứng
  -- mới nhất (việc đã nghiệm thu rồi được mở lại có chủ đích giữ nguyên). Mỗi việc một khối con: dòng lệch ràng buộc nghiệp vụ (ngày văn bản
  -- trước ngày ban hành, Owner lệch phòng…) giữ nguyên trạng thái và báo NOTICE — không làm hỏng cả migration.
  WITH chot AS (UPDATE "public"."minh_chung" SET "hop_le" = true, "xac_nhan_luc" = now() WHERE "hop_le" IS NULL AND "loai" IN ('so_hieu', 'tep')
                RETURNING "nhiem_vu_id")
  SELECT coalesce(array_agg(DISTINCT "nhiem_vu_id"), '{}') INTO v_nv FROM chot;
  FOR r IN
    SELECT DISTINCT ON (m."nhiem_vu_id") m."nhiem_vu_id", m."ngay_van_ban", m."so_hieu", n."ma"
    FROM "public"."minh_chung" m JOIN "public"."nhiem_vu" n ON n."id" = m."nhiem_vu_id"
    WHERE m."nhiem_vu_id" = ANY (v_nv) AND m."loai" = 'so_hieu' AND m."hop_le" AND m."ngay_van_ban" IS NOT NULL
      AND n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL
    ORDER BY m."nhiem_vu_id", m."nop_luc" DESC
  LOOP
    BEGIN
      PERFORM set_config('kl.ghi_qua_ham', '1', true);
      UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = least(r."ngay_van_ban", "public"."kl_hom_nay"()) WHERE "id" = r."nhiem_vu_id";
      INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon")
      VALUES (r."nhiem_vu_id", NULL, 'Hệ thống — chuyển sang v3.20', 'dong_nhiem_vu',
              format('Hoàn thành nhiệm vụ · %s: theo minh chứng số %s đã nộp (v3.20: nộp minh chứng hợp lệ là hoàn thành, không chờ nghiệm thu)', r."ma", r."so_hieu"), 'app');
      PERFORM set_config('kl.ghi_qua_ham', '', true);
    EXCEPTION WHEN OTHERS THEN
      v_bo := v_bo + 1;
      RAISE NOTICE '0090: giữ nguyên % — không chuyển hoàn thành được: %', r."ma", SQLERRM;
    END;
  END LOOP;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  IF v_bo > 0 THEN RAISE NOTICE '0090: % việc giữ trạng thái cũ (minh chứng đã hợp lệ) — người theo dõi kiểm tay', v_bo; END IF;
  -- Lãnh đạo là Owner / người theo dõi của việc đang mở chưa xác nhận nhận việc → ghi "đã nhận" tự động.
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  SELECT DISTINCT n."id", a."id", 'xac_nhan_nhan_viec', 'tự động (v3.20: lãnh đạo không phải xác nhận nhận việc)', 'app'
  FROM "public"."nhiem_vu" n CROSS JOIN LATERAL unnest(ARRAY[n."owner_tai_khoan", n."nguoi_theo_doi"]) u(id)
  JOIN "public"."accounts" a ON a."id" = u.id
  WHERE n."theo_1400" AND n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL AND a."role_group" IN ('A1', 'A2') AND NOT a."is_system"
    AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = a."id");
END $$;
