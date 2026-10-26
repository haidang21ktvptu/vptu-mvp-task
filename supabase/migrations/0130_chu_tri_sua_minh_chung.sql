-- 0130 (v3.32, chủ dự án quyết 26/10/2026 — CAU-HOI R-1…R-3): CHỦ TRÌ THEO DÕI sửa được minh chứng đã nộp của việc mình, kể cả thay tệp đính kèm.
-- sua_minh_chung (bản 0126 — chỉ tài khoản quản trị; 0126 đã commit nên định nghĩa lại ở tệp mới):
-- 1. Ai: tài khoản quản trị (như cũ) hoặc chủ trì theo dõi — cán bộ chủ trì; việc giao cho phòng / Văn phòng: người đại diện (Trưởng phòng / Chánh VP,
--    nguoi_theo_doi nội bộ 0128) — cùng điều kiện với Điều chỉnh hạn (0123). Lãnh đạo khác, chuyên viên khác, thư ký Thường trực: không.
-- 2. Khi nào: mọi lúc (R-2) — việc đang làm, đã hoàn thành, đã đánh giá chất lượng (giữ đánh giá; lãnh đạo nhận tin, đánh giá lại nếu cần), đã đóng.
--    Chủ trì không sửa minh chứng đã bị trả lại (vết của lần trả lại — nộp minh chứng mới); tài khoản quản trị như cũ.
-- 3. Ô: số hiệu, ngày văn bản, cấp nhận, trích yếu, mô tả kết quả, nội dung (minh chứng chữ cũ) như 0126; MỚI: thay / thêm tệp (tep_path, tep_ten —
--    minh chứng loại số hiệu; kiểm như gan_tep_minh_chung 0090: tệp đã tải lên kho "minh-chung" đúng thư mục của việc, chưa gắn minh chứng khác).
--    Tệp cũ giữ trong kho: bản chụp minh_chung_lich_su còn đường dẫn — kl_tep_mc_da_gan (0126) xét cả bản chụp nên người tải lên không xoá được.
-- 4. Như 0126: kiểm ngày (minh_chung_kiem_ngay); đổi ngày văn bản của minh chứng đã làm việc hoàn thành → ngày hoàn thành theo; bản chụp cũ / mới;
--    Diễn biến; tin báo người liên quan (chủ trì, Trưởng phòng, Phó Chánh VP phụ trách, Chánh VP, người đã chỉ đạo), người giao việc, người nộp.
-- go_minh_chung không đổi (R-3: chỉ tài khoản quản trị gỡ).

CREATE OR REPLACE FUNCTION "public"."sua_minh_chung"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."minh_chung"; m "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_ly_do text := btrim(coalesce("p_ly_do", ''));
        k text; val jsonb; v_s text; v_doi jsonb := '{}'; v_cu jsonb; v_loi text; v_ten text; v_tq boolean := "public"."me_toan_quyen"();
        v_cot text[] := ARRAY['so_hieu', 'ngay_van_ban', 'cap_nhan', 'trich_yeu', 'mo_ta_ket_qua', 'noi_dung_chu', 'tep_path', 'tep_ten'];
BEGIN
  SELECT * INTO c FROM "public"."minh_chung" WHERE "id" = "p_id" FOR UPDATE;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = c."nhiem_vu_id";
  IF c."id" IS NULL OR "auth"."uid"() IS NULL
     OR NOT (v_tq OR coalesce(coalesce(v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi") = "auth"."uid"(), false)) THEN
    RAISE EXCEPTION 'Chỉ chủ trì theo dõi của nhiệm vụ hoặc tài khoản quản trị mới sửa minh chứng đã nộp.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_tq AND c."hop_le" = false THEN
    RAISE EXCEPTION 'Minh chứng này đã bị trả lại — giữ làm vết; đồng chí nộp minh chứng mới.' USING ERRCODE = '22023';
  END IF;
  IF "p_thay_doi" IS NULL OR jsonb_typeof("p_thay_doi") <> 'object' OR "p_thay_doi" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_cu := to_jsonb(c);
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p_thay_doi") e LOOP
    IF NOT (k = ANY (v_cot)) THEN RAISE EXCEPTION 'Ô "%" của minh chứng không sửa được bằng cách này.', k USING ERRCODE = '22023'; END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    CONTINUE WHEN k = 'tep_ten' OR coalesce(v_s, '') = coalesce(v_cu ->> k, '');   -- tên tệp đi kèm tệp mới (dưới)
    v_doi := v_doi || jsonb_build_object(k, v_s);
  END LOOP;
  IF v_doi ? 'tep_path' THEN   -- thay / thêm tệp (như gan_tep_minh_chung, 0090)
    IF c."loai" <> 'so_hieu' THEN RAISE EXCEPTION 'Chỉ minh chứng có số hiệu văn bản mới gắn tệp.' USING ERRCODE = '22023'; END IF;
    IF v_doi ->> 'tep_path' IS NULL THEN RAISE EXCEPTION 'Không bỏ được tệp của minh chứng — chọn tệp khác để thay.' USING ERRCODE = '22023'; END IF;
    IF "public"."kl_tep_mc_nhiem_vu"(v_doi ->> 'tep_path') IS DISTINCT FROM c."nhiem_vu_id"
       OR NOT EXISTS (SELECT 1 FROM "storage"."objects" o WHERE o."bucket_id" = 'minh-chung' AND o."name" = v_doi ->> 'tep_path')
       OR EXISTS (SELECT 1 FROM "public"."minh_chung" x WHERE x."tep_path" = v_doi ->> 'tep_path') THEN
      RAISE EXCEPTION 'Tệp minh chứng chưa được tải lên cho đúng nhiệm vụ — chọn lại tệp.' USING ERRCODE = '22023';
    END IF;
    v_doi := v_doi || jsonb_build_object('tep_ten', coalesce(left(nullif(btrim("p_thay_doi" ->> 'tep_ten'), ''), 200), split_part(v_doi ->> 'tep_path', '/', 2)));
  ELSIF nullif(btrim(coalesce("p_thay_doi" ->> 'tep_ten', '')), '') IS DISTINCT FROM nullif(btrim(coalesce(c."tep_ten", '')), '')
        AND "p_thay_doi" ? 'tep_ten' THEN
    RAISE EXCEPTION 'Đổi tên tệp phải kèm tệp mới.' USING ERRCODE = '22023';
  END IF;
  IF v_doi = '{}'::jsonb THEN RAISE EXCEPTION 'Không có gì thay đổi so với minh chứng đang có.' USING ERRCODE = '22023'; END IF;
  BEGIN
    m := jsonb_populate_record(c, v_doi);
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Ngày văn bản không hợp lệ.' USING ERRCODE = '22023';
  END;
  IF m."loai" = 'so_hieu' AND (m."so_hieu" IS NULL OR m."ngay_van_ban" IS NULL OR m."cap_nhan" IS NULL) THEN
    RAISE EXCEPTION 'Minh chứng phải có số hiệu, ngày văn bản và cấp nhận.' USING ERRCODE = '22023';
  END IF;
  IF m."loai" = 'chu_cu' AND m."noi_dung_chu" IS NULL THEN RAISE EXCEPTION 'Minh chứng dạng chữ phải có nội dung.' USING ERRCODE = '22023'; END IF;
  IF m."cap_nhan" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = m."cap_nhan") THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  IF char_length(coalesce(m."mo_ta_ket_qua", '')) > 600 THEN RAISE EXCEPTION 'Mô tả kết quả tối đa 600 ký tự.' USING ERRCODE = '22023'; END IF;
  IF m."ngay_van_ban" IS DISTINCT FROM c."ngay_van_ban" AND m."ngay_van_ban" IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
    v_loi := "public"."minh_chung_kiem_ngay"(m."ngay_van_ban", v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
    IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  END IF;
  UPDATE "public"."minh_chung" SET "so_hieu" = m."so_hieu", "ngay_van_ban" = m."ngay_van_ban", "cap_nhan" = m."cap_nhan", "trich_yeu" = m."trich_yeu",
    "mo_ta_ket_qua" = m."mo_ta_ket_qua", "noi_dung_chu" = m."noi_dung_chu", "tep_path" = m."tep_path", "tep_ten" = m."tep_ten" WHERE "id" = c."id";
  INSERT INTO "public"."minh_chung_lich_su" ("minh_chung_id", "nhiem_vu_id", "hanh_dong", "ban_cu", "ban_moi", "ly_do", "nguoi")
  VALUES (c."id", c."nhiem_vu_id", 'SUA', v_cu, to_jsonb(m), v_ly_do, "auth"."uid"());
  IF v_nv."tien_do_ma" = 'HOAN_THANH' AND v_doi ? 'ngay_van_ban' AND m."ngay_van_ban" IS NOT NULL AND "public"."minh_chung_la_hop_le"(c)
     AND v_nv."ngay_hoan_thanh" IS NOT DISTINCT FROM c."ngay_van_ban" THEN
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- việc hoàn thành theo minh chứng này: ngày hoàn thành theo ngày văn bản mới
    UPDATE "public"."nhiem_vu" SET "ngay_hoan_thanh" = m."ngay_van_ban" WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
  END IF;
  SELECT string_agg(CASE x WHEN 'so_hieu' THEN 'số hiệu' WHEN 'ngay_van_ban' THEN 'ngày văn bản' WHEN 'cap_nhan' THEN 'cấp nhận' WHEN 'trich_yeu' THEN 'trích yếu'
                      WHEN 'mo_ta_ket_qua' THEN 'mô tả kết quả' WHEN 'tep_path' THEN 'tệp: ' || m."tep_ten" ELSE 'nội dung' END, ', ' ORDER BY array_position(v_cot, x))
    INTO v_ten FROM jsonb_object_keys(v_doi) x WHERE x <> 'tep_ten';
  v_ten := format('%s (sửa %s) — lý do: %s', coalesce(m."so_hieu", left(m."noi_dung_chu", 60)), v_ten, v_ly_do);
  PERFORM "public"."kl_ghi_vet_viec"(v_nv."id", 'sua_minh_chung', v_ten, format('Sửa minh chứng · %s: %s', v_nv."ma", left(v_ten, 300)), ARRAY[c."nop_boi"]);
  PERFORM "public"."kl_minh_chung_tinh_lai"(v_nv."id");
  RETURN v_doi;
END;
$$;
REVOKE ALL ON FUNCTION "public"."sua_minh_chung"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."sua_minh_chung"(uuid, jsonb, text) TO "authenticated";
