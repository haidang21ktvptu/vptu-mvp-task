-- 0126 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-6): tài khoản toàn quyền (0100) sửa thông tin văn bản giao việc; sửa, gỡ minh chứng đã nộp.
-- Lý do bắt buộc; nhật ký ở từng việc liên quan (Diễn biến) + nhật ký hệ thống (văn bản) / bảng chụp bản cũ – bản mới (minh chứng).
-- 1. van_ban_sua(p_id, p_thay_doi, p_ly_do): loại, số hội nghị, số / ký hiệu, ngày ban hành, ngày nhận, trích yếu. Kiểm: Kết luận BTV có số hội
--    nghị; đổi sang Kết luận BTV / Thông báo Thường trực thì mọi việc của văn bản phải có ngành, lĩnh vực cụ thể; không trùng văn bản đã có; ngày ban
--    hành không ở tương lai, không sau hạn / ngày hoàn thành / ngày nhận (đã chốt) của việc, ngày văn bản của minh chứng (trigger 0022 kiểm ngày nhận).
--    Ngày nhận của việc chép từ văn bản (bằng ngày nhận cũ của văn bản) đổi theo ngày nhận mới (xoá ngày nhận của văn bản → ước tính = ngày ban
--    hành); ngày nhận mới không sau ngày hoàn thành / ngày minh chứng của các việc đó (lead time không âm); trigger 0022 tính lại ngày nhận ước tính,
--    hạn "theo ngày ký ban hành" của các việc. Không gửi tin (đổi thông tin văn bản — nhật ký từng việc + nhật ký hệ thống).
-- 2. minh_chung_lich_su: bản chụp minh chứng trước / sau mỗi lần sửa, gỡ (đọc theo phạm vi như minh_chung; chỉ ghi qua hàm).
-- 3. sua_minh_chung(p_id, p_thay_doi, p_ly_do): số hiệu, ngày văn bản, cấp nhận, trích yếu, mô tả kết quả, nội dung (minh chứng chữ cũ). Ngày kiểm
--    như khi nộp (minh_chung_kiem_ngay). Minh chứng hợp lệ mà việc đã hoàn thành theo đúng nó (ngày hoàn thành = ngày văn bản cũ) → ngày hoàn thành
--    theo ngày mới. Tin báo người liên quan và người nộp.
-- 4. go_minh_chung(p_id, p_ly_do): chụp bản cũ rồi gỡ; tệp đính kèm giữ trong kho (bản chụp còn đường dẫn — kl_tep_mc_da_gan xét cả bản chụp nên
--    người tải lên không xoá được). Gỡ minh chứng hợp lệ cuối cùng của việc đã hoàn thành (việc theo 1400; việc chuyển đổi không còn minh chứng chữ)
--    → mở lại việc như "Trả lại" (0090); còn minh chứng hợp lệ khác mà ngày hoàn thành lấy theo minh chứng vừa gỡ → ngày hoàn thành theo minh chứng
--    hợp lệ nộp sớm nhất còn lại. Tin báo người liên quan và người nộp.

-- ---- 1 ----
-- p_uoc: văn bản không còn ngày nhận ⇒ ngày nhận của việc là ước tính (= ngày ban hành), như khi giao (trigger 0023 giữ cờ khi kl.tai_uoc_tinh = '1').
CREATE FUNCTION "public"."kl_van_ban_doi_ngay_nhan"("p_vb" uuid, "p_cu" date, "p_moi" date, "p_uoc" boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('kl.ghi_qua_ham', '1', true);
  PERFORM set_config('kl.tai_uoc_tinh', '1', true);
  UPDATE "public"."nhiem_vu" SET "ngay_nhan_van_ban" = "p_moi", "ngay_nhan_uoc_tinh" = "p_uoc"
  WHERE "van_ban_id" = "p_vb" AND NOT "ngay_nhan_uoc_tinh" AND "ngay_nhan_van_ban" = "p_cu";
  PERFORM set_config('kl.tai_uoc_tinh', '', true);
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_van_ban_doi_ngay_nhan"(uuid, date, date, boolean) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."van_ban_sua"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."van_ban_giao_viec"; m "public"."van_ban_giao_viec"; v_ly_do text := btrim(coalesce("p_ly_do", '')); k text; val jsonb; v_s text;
        v_doi jsonb := '{}'; v_cu jsonb; v_n integer; v_moc date; v_ten text; v_nd text; v_nhan_cu date; v_nhan_moi date;
        v_cot text[] := ARRAY['loai', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'ngay_nhan', 'trich_yeu'];
BEGIN
  SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (toàn quyền) mới sửa thông tin văn bản giao việc.' USING ERRCODE = '42501';
  END IF;
  IF "p_thay_doi" IS NULL OR jsonb_typeof("p_thay_doi") <> 'object' OR "p_thay_doi" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_cu := to_jsonb(v);
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p_thay_doi") e LOOP
    IF NOT (k = ANY (v_cot)) THEN RAISE EXCEPTION 'Ô "%" của văn bản không sửa được bằng cách này.', k USING ERRCODE = '22023'; END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    CONTINUE WHEN coalesce(v_s, '') = coalesce(v_cu ->> k, '');
    v_doi := v_doi || jsonb_build_object(k, v_s);
  END LOOP;
  IF v_doi = '{}'::jsonb THEN RAISE EXCEPTION 'Không có gì thay đổi so với thông tin đang có.' USING ERRCODE = '22023'; END IF;
  BEGIN
    m := jsonb_populate_record(v, v_doi);
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'Ngày hoặc số hội nghị không hợp lệ.' USING ERRCODE = '22023';
  END;
  IF m."loai" NOT IN ('KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'NQ_BCH', 'KL_BCH', 'CONG_VAN', 'KHAC') THEN RAISE EXCEPTION 'Loại văn bản không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF m."so_ket_luan" IS NULL THEN RAISE EXCEPTION 'Văn bản phải có số / ký hiệu.' USING ERRCODE = '22023'; END IF;
  IF m."ngay_ban_hanh" IS NULL THEN RAISE EXCEPTION 'Văn bản phải có ngày ban hành.' USING ERRCODE = '22023'; END IF;
  IF m."loai" = 'KL_BTV' AND m."so_hoi_nghi" IS NULL THEN RAISE EXCEPTION 'Kết luận Ban Thường vụ phải có số hội nghị.' USING ERRCODE = '22023'; END IF;
  IF m."so_hoi_nghi" IS NOT NULL AND m."so_hoi_nghi" <= 0 THEN RAISE EXCEPTION 'Số hội nghị phải lớn hơn 0.' USING ERRCODE = '22023'; END IF;
  IF m."loai" IN ('KL_BTV', 'TB_THUONG_TRUC') AND m."loai" IS DISTINCT FROM v."loai" THEN
    SELECT count(*) INTO v_n FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id"
      AND (n."nganh_ma" = 'KHONG_THUOC' OR (n."theo_1400" AND (n."nganh_ma" IS NULL OR n."linh_vuc_ma" IS NULL)));
    IF v_n > 0 THEN
      RAISE EXCEPTION 'Văn bản có % nhiệm vụ chưa có ngành, lĩnh vực cụ thể — phân loại các việc đó trước khi đổi sang Kết luận / Thông báo.', v_n USING ERRCODE = '22023';
    END IF;
  END IF;
  v_nhan_cu := coalesce(v."ngay_nhan", v."ngay_ban_hanh"); v_nhan_moi := coalesce(m."ngay_nhan", m."ngay_ban_hanh");   -- ngày nhận việc chép từ văn bản
  IF v_nhan_moi > v_nhan_cu THEN   -- việc theo ngày nhận của văn bản (chép hoặc ước tính) dời ngày giao: không sau ngày hoàn thành / minh chứng (DL-4)
    SELECT least(min(n."ngay_hoan_thanh"), min(mc."ngay_van_ban")) INTO v_moc
    FROM "public"."nhiem_vu" n LEFT JOIN "public"."minh_chung" mc ON mc."nhiem_vu_id" = n."id" AND "public"."minh_chung_la_hop_le"(mc)
    WHERE n."van_ban_id" = v."id" AND (n."ngay_nhan_uoc_tinh" OR n."ngay_nhan_van_ban" = v_nhan_cu);
    IF v_moc IS NOT NULL AND v_nhan_moi > v_moc THEN
      RAISE EXCEPTION 'Ngày nhận mới (%) sau ngày hoàn thành hoặc ngày minh chứng của việc giao từ văn bản (sớm nhất %) — ngày giao không được sau ngày hoàn thành.',
        to_char(v_nhan_moi, 'DD/MM/YYYY'), to_char(v_moc, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF m."ngay_ban_hanh" IS DISTINCT FROM v."ngay_ban_hanh" THEN
    SELECT least(min(n."han_xu_ly") FILTER (WHERE n."loai_thoi_han_ma" <> 'KY_BAN_HANH'), min(n."ngay_hoan_thanh"),
                 min(n."ngay_nhan_van_ban") FILTER (WHERE NOT n."ngay_nhan_uoc_tinh" AND n."ngay_nhan_van_ban" IS DISTINCT FROM v_nhan_cu),
                 (SELECT min(mc."ngay_van_ban") FROM "public"."minh_chung" mc JOIN "public"."nhiem_vu" x ON x."id" = mc."nhiem_vu_id" WHERE x."van_ban_id" = v."id"))
      INTO v_moc FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id";
    IF v_moc IS NOT NULL AND m."ngay_ban_hanh" > v_moc THEN
      RAISE EXCEPTION 'Ngày ban hành mới (%) sau hạn, ngày nhận, ngày hoàn thành hoặc ngày minh chứng của việc giao từ văn bản (sớm nhất %).',
        to_char(m."ngay_ban_hanh", 'DD/MM/YYYY'), to_char(v_moc, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Việc chép ngày nhận của văn bản (chưa sửa riêng) theo ngày mới. Trigger 0023 kiểm ngày nhận của việc theo ngày ban hành ĐANG ghi ⇒ ngày nhận mới
  -- không trước ngày ban hành cũ thì đổi trước văn bản (văn bản dời ngày ban hành về sau — trigger 0022 ghi lại các việc), không thì đổi sau.
  IF v_nhan_moi IS DISTINCT FROM v_nhan_cu AND v_nhan_moi >= v."ngay_ban_hanh" THEN
    PERFORM "public"."kl_van_ban_doi_ngay_nhan"(v."id", v_nhan_cu, v_nhan_moi, m."ngay_nhan" IS NULL);
  END IF;
  BEGIN
    UPDATE "public"."van_ban_giao_viec" SET "loai" = m."loai", "so_hoi_nghi" = m."so_hoi_nghi", "so_ket_luan" = m."so_ket_luan", "ngay_ban_hanh" = m."ngay_ban_hanh",
      "ngay_nhan" = m."ngay_nhan", "trich_yeu" = m."trich_yeu" WHERE "id" = v."id";
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Đã có văn bản cùng loại, số / ký hiệu và ngày ban hành (hoặc cùng số hội nghị và số) — kiểm tra lại.' USING ERRCODE = '22023';
  END;
  IF v_nhan_moi IS DISTINCT FROM v_nhan_cu AND v_nhan_moi < v."ngay_ban_hanh" THEN
    PERFORM "public"."kl_van_ban_doi_ngay_nhan"(v."id", v_nhan_cu, v_nhan_moi, m."ngay_nhan" IS NULL);
  END IF;
  SELECT string_agg(format('%s: %s → %s', CASE x WHEN 'loai' THEN 'loại' WHEN 'so_hoi_nghi' THEN 'số hội nghị' WHEN 'so_ket_luan' THEN 'số / ký hiệu'
           WHEN 'ngay_ban_hanh' THEN 'ngày ban hành' WHEN 'ngay_nhan' THEN 'ngày nhận' ELSE 'trích yếu' END,
           coalesce(CASE WHEN x LIKE 'ngay%' THEN to_char((v_cu ->> x)::date, 'DD/MM/YYYY') WHEN x = 'loai' THEN "public"."kl_ten_loai_van_ban"(v_cu ->> x) ELSE left(v_cu ->> x, 80) END, '(trống)'),
           coalesce(CASE WHEN x LIKE 'ngay%' THEN to_char((v_doi ->> x)::date, 'DD/MM/YYYY') WHEN x = 'loai' THEN "public"."kl_ten_loai_van_ban"(v_doi ->> x) ELSE left(v_doi ->> x, 80) END, '(trống)')),
         '; ' ORDER BY array_position(v_cot, x)) INTO v_ten FROM jsonb_object_keys(v_doi) x;
  v_nd := format('Sửa văn bản giao %s — %s — lý do: %s', v."so_ket_luan", v_ten, v_ly_do);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  SELECT n."id", "auth"."uid"(), 'van_ban_sua', v_nd, 'app' FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id";
  PERFORM "public"."nhat_ky_ghi"('sua_van_ban', v."so_ket_luan", jsonb_build_object('van_ban_id', v."id", 'cu', v_cu, 'moi', v_doi, 'ly_do', v_ly_do));
  RETURN v_doi;
END;
$$;
REVOKE ALL ON FUNCTION "public"."van_ban_sua"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."van_ban_sua"(uuid, jsonb, text) TO "authenticated";

-- ---- 2 ----
CREATE TABLE "public"."minh_chung_lich_su" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "minh_chung_id" uuid NOT NULL,   -- không khoá ngoại: bản chụp còn khi minh chứng đã gỡ
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "hanh_dong" text NOT NULL CHECK ("hanh_dong" IN ('SUA', 'GO')),
  "ban_cu" jsonb NOT NULL,
  "ban_moi" jsonb,
  "ly_do" text NOT NULL CHECK (btrim("ly_do") <> '' AND char_length("ly_do") <= 500),
  "nguoi" uuid REFERENCES "public"."accounts"("id"),
  "luc" timestamp with time zone NOT NULL DEFAULT now()
);
COMMENT ON TABLE "public"."minh_chung_lich_su" IS '0126: bản chụp minh chứng trước / sau khi tài khoản toàn quyền sửa (SUA) hoặc gỡ (GO); chỉ ghi qua sua_minh_chung / go_minh_chung';
CREATE INDEX "minh_chung_lich_su_nhiem_vu_idx" ON "public"."minh_chung_lich_su" ("nhiem_vu_id", "luc" DESC);
ALTER TABLE "public"."minh_chung_lich_su" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "public"."minh_chung_lich_su" FROM "anon", "authenticated";
GRANT SELECT ON "public"."minh_chung_lich_su" TO "authenticated";
CREATE POLICY "minh_chung_lich_su_select" ON "public"."minh_chung_lich_su" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));   -- như minh_chung (0049)
-- Tệp của minh chứng đã gỡ / đã sửa còn trong bản chụp: người tải lên không xoá được (policy minh_chung_tep_xoa — 0089).
CREATE OR REPLACE FUNCTION "public"."kl_tep_mc_da_gan"("p_ten" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."tep_path" = "p_ten")
      OR EXISTS (SELECT 1 FROM "public"."minh_chung_lich_su" l WHERE l."ban_cu" ->> 'tep_path' = "p_ten");
$$;

-- ---- 3 ----
-- Tính lại cờ thiếu minh chứng của việc đã hoàn thành (như minh_chung_ghi_vet 0028 — trigger 0028 tính khi ghi dòng nhiệm vụ). Nhật ký sửa / gỡ dùng
-- kl_ghi_vet_viec (cột 'sua_minh_chung' / 'go_minh_chung' — Diễn biến không ẩn như các dòng 'minh_chung_%' đã có nguồn riêng từ bảng minh_chung).
CREATE FUNCTION "public"."kl_minh_chung_tinh_lai"("p_nhiem_vu" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
  UPDATE "public"."nhiem_vu" SET "thieu_minh_chung" = "thieu_minh_chung" WHERE "id" = "p_nhiem_vu" AND "tien_do_ma" = 'HOAN_THANH';
  PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_minh_chung_tinh_lai"(uuid) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."sua_minh_chung"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."minh_chung"; m "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_ly_do text := btrim(coalesce("p_ly_do", ''));
        k text; val jsonb; v_s text; v_doi jsonb := '{}'; v_cu jsonb; v_loi text; v_ten text;
        v_cot text[] := ARRAY['so_hieu', 'ngay_van_ban', 'cap_nhan', 'trich_yeu', 'mo_ta_ket_qua', 'noi_dung_chu'];
BEGIN
  SELECT * INTO c FROM "public"."minh_chung" WHERE "id" = "p_id" FOR UPDATE;
  IF c."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (toàn quyền) mới sửa minh chứng đã nộp.' USING ERRCODE = '42501';
  END IF;
  IF "p_thay_doi" IS NULL OR jsonb_typeof("p_thay_doi") <> 'object' OR "p_thay_doi" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_cu := to_jsonb(c);
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p_thay_doi") e LOOP
    IF NOT (k = ANY (v_cot)) THEN RAISE EXCEPTION 'Ô "%" của minh chứng không sửa được bằng cách này.', k USING ERRCODE = '22023'; END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    CONTINUE WHEN coalesce(v_s, '') = coalesce(v_cu ->> k, '');
    v_doi := v_doi || jsonb_build_object(k, v_s);
  END LOOP;
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
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = c."nhiem_vu_id";
  IF m."ngay_van_ban" IS DISTINCT FROM c."ngay_van_ban" AND m."ngay_van_ban" IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
    v_loi := "public"."minh_chung_kiem_ngay"(m."ngay_van_ban", v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
    IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  END IF;
  UPDATE "public"."minh_chung" SET "so_hieu" = m."so_hieu", "ngay_van_ban" = m."ngay_van_ban", "cap_nhan" = m."cap_nhan", "trich_yeu" = m."trich_yeu",
    "mo_ta_ket_qua" = m."mo_ta_ket_qua", "noi_dung_chu" = m."noi_dung_chu" WHERE "id" = c."id";
  INSERT INTO "public"."minh_chung_lich_su" ("minh_chung_id", "nhiem_vu_id", "hanh_dong", "ban_cu", "ban_moi", "ly_do", "nguoi")
  VALUES (c."id", c."nhiem_vu_id", 'SUA', v_cu, to_jsonb(m), v_ly_do, "auth"."uid"());
  IF v_nv."tien_do_ma" = 'HOAN_THANH' AND v_doi ? 'ngay_van_ban' AND m."ngay_van_ban" IS NOT NULL AND "public"."minh_chung_la_hop_le"(c)
     AND v_nv."ngay_hoan_thanh" IS NOT DISTINCT FROM c."ngay_van_ban" THEN
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- việc hoàn thành theo minh chứng này: ngày hoàn thành theo ngày văn bản mới
    UPDATE "public"."nhiem_vu" SET "ngay_hoan_thanh" = m."ngay_van_ban" WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
  END IF;
  SELECT string_agg(CASE x WHEN 'so_hieu' THEN 'số hiệu' WHEN 'ngay_van_ban' THEN 'ngày văn bản' WHEN 'cap_nhan' THEN 'cấp nhận' WHEN 'trich_yeu' THEN 'trích yếu'
                      WHEN 'mo_ta_ket_qua' THEN 'mô tả kết quả' ELSE 'nội dung' END, ', ' ORDER BY array_position(v_cot, x)) INTO v_ten FROM jsonb_object_keys(v_doi) x;
  v_ten := format('%s (sửa %s) — lý do: %s', coalesce(m."so_hieu", left(m."noi_dung_chu", 60)), v_ten, v_ly_do);
  PERFORM "public"."kl_ghi_vet_viec"(v_nv."id", 'sua_minh_chung', v_ten, format('Sửa minh chứng · %s: %s', v_nv."ma", left(v_ten, 300)), ARRAY[c."nop_boi"]);
  PERFORM "public"."kl_minh_chung_tinh_lai"(v_nv."id");
  RETURN v_doi;
END;
$$;
REVOKE ALL ON FUNCTION "public"."sua_minh_chung"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."sua_minh_chung"(uuid, jsonb, text) TO "authenticated";

-- ---- 4 ----
CREATE FUNCTION "public"."go_minh_chung"("p_id" uuid, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_mo_lai boolean := false; v_nd text; v_ngay date;
BEGIN
  SELECT * INTO c FROM "public"."minh_chung" WHERE "id" = "p_id" FOR UPDATE;
  IF c."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (toàn quyền) mới gỡ minh chứng đã nộp.' USING ERRCODE = '42501';
  END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do gỡ bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = c."nhiem_vu_id" FOR UPDATE;
  INSERT INTO "public"."minh_chung_lich_su" ("minh_chung_id", "nhiem_vu_id", "hanh_dong", "ban_cu", "ly_do", "nguoi")
  VALUES (c."id", c."nhiem_vu_id", 'GO', to_jsonb(c), v_ly_do, "auth"."uid"());
  DELETE FROM "public"."minh_chung" WHERE "id" = c."id";
  IF v_nv."tien_do_ma" = 'HOAN_THANH' AND NOT "public"."minh_chung_co_hop_le"(v_nv."id")
     AND (v_nv."theo_1400" OR nullif(btrim(coalesce(v_nv."minh_chung", '')), '') IS NULL) THEN
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- như "Trả lại" (0090): không còn minh chứng hợp lệ ⇒ mở lại việc
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'DANG_THUC_HIEN' WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
    v_mo_lai := true;
  ELSIF v_nv."tien_do_ma" = 'HOAN_THANH' AND "public"."minh_chung_la_hop_le"(c) AND c."ngay_van_ban" IS NOT NULL
        AND v_nv."ngay_hoan_thanh" IS NOT DISTINCT FROM c."ngay_van_ban" THEN   -- ngày hoàn thành lấy theo minh chứng vừa gỡ → theo minh chứng còn lại
    SELECT mc."ngay_van_ban" INTO v_ngay FROM "public"."minh_chung" mc
    WHERE mc."nhiem_vu_id" = v_nv."id" AND "public"."minh_chung_la_hop_le"(mc) AND mc."ngay_van_ban" IS NOT NULL ORDER BY mc."nop_luc", mc."id" LIMIT 1;
    IF v_ngay IS NOT NULL AND v_ngay IS DISTINCT FROM v_nv."ngay_hoan_thanh" THEN
      PERFORM set_config('kl.ghi_qua_ham', '1', true);
      UPDATE "public"."nhiem_vu" SET "ngay_hoan_thanh" = v_ngay WHERE "id" = v_nv."id";
      PERFORM set_config('kl.ghi_qua_ham', '', true);
    END IF;
  END IF;
  v_nd := format('%s — lý do: %s%s', coalesce(c."so_hieu", left(c."noi_dung_chu", 60)), v_ly_do,
                 CASE WHEN v_mo_lai THEN ' — nhiệm vụ chưa hoàn thành, nộp minh chứng mới' ELSE '' END);
  PERFORM "public"."kl_ghi_vet_viec"(v_nv."id", 'go_minh_chung', v_nd, format('Gỡ minh chứng · %s: %s', v_nv."ma", left(v_nd, 300)), ARRAY[c."nop_boi"]);
  PERFORM "public"."kl_minh_chung_tinh_lai"(v_nv."id");
  RETURN jsonb_build_object('mo_lai', v_mo_lai);
END;
$$;
REVOKE ALL ON FUNCTION "public"."go_minh_chung"(uuid, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."go_minh_chung"(uuid, text) TO "authenticated";
