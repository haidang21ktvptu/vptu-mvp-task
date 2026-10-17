-- 0109 (v3.25): việc chỉ quản trị hệ thống làm (QUAN_TRI — kl_quyen_muc_tieu 0108), mọi thao tác có lý do, ghi dm_lich_su.
--  - khoi_phuc_muc_tieu: trả các cột của một lần sửa (dm_lich_su 'sua' / 'khoi_phuc' của dm_muc_tieu) về giá trị cũ — đi qua kl_sua_muc_tieu (cùng
--    kiểm tra, mục đang khoá thì phải mở khoá trước), nhật ký 'khoi_phuc'.
--  - gop_muc_tieu: gộp mục trùng — gắn của việc / văn bản chuyển sang mục giữ lại (nguồn GOP), quy tắc chuyển theo (trùng thì bỏ), kết quả chỉ tiêu
--    chuyển khi không trùng kỳ; mục bị gộp ngừng dùng, ghi gop_vao; lịch sử 'gan_muc_tieu' ở các việc bị đổi. Số hiệu: mục giữ lại chưa có số hiệu thì
--    nhận số hiệu của mục bị gộp (khi đúng dạng số hiệu của nhóm mục giữ lại); không thì số hiệu ở lại mục bị gộp (them_muc_tieu_tu_dong theo gop_vao
--    trả mục giữ lại — không sinh mục trùng).
--  - Nhóm: them_nhom_muc_tieu / sua_nhom_muc_tieu (tên, nhãn thẻ, dạng số hiệu, thứ tự, đang dùng).
--  - Khối lĩnh vực: them_khoi_linh_vuc / sua_khoi_linh_vuc, dat_khoi_nganh (ngành → khối), dat_khoi_linh_vuc (lĩnh vực có khối riêng; NULL = theo ngành).
--  - Quy tắc: them_quy_tac (quản trị thêm tay — nguồn QUAN_TRI), sua_quy_tac (mức, trạng thái, khoá, ghi chú); quy tắc quản trị đã khoá không bị tự học đổi.

CREATE FUNCTION "public"."kl_can_quan_tri_muc_tieu"("p_ly_do" text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF "public"."kl_quyen_muc_tieu"() IS DISTINCT FROM 'QUAN_TRI' THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống mới thực hiện được thao tác này.' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do.' USING ERRCODE = '22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_can_quan_tri_muc_tieu"(text) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."khoi_phuc_muc_tieu"("p_lich_su" bigint, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l "public"."dm_lich_su";
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  SELECT * INTO l FROM "public"."dm_lich_su" WHERE "id" = "p_lich_su";
  IF l."id" IS NULL OR l."bang" <> 'dm_muc_tieu' OR l."hanh_dong" NOT IN ('sua', 'khoi_phuc') OR l."gia_tri_cu" IS NULL THEN
    RAISE EXCEPTION 'Chỉ khôi phục được một lần sửa mục tiêu.' USING ERRCODE = '22023';
  END IF;
  PERFORM "public"."kl_sua_muc_tieu"(l."ma", l."gia_tri_cu", btrim("p_ly_do") || ' (khôi phục lần sửa #' || l."id" || ')', 'khoi_phuc');
END;
$$;

CREATE FUNCTION "public"."gop_muc_tieu"("p_tu" text, "p_vao" text, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a "public"."dm_muc_tieu"; b "public"."dm_muc_tieu"; v_me uuid := "auth"."uid"(); v_viec uuid[]; v_vb uuid[]; v_ly text; v_chuyen boolean;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  SELECT * INTO a FROM "public"."dm_muc_tieu" WHERE "ma" = "p_tu" FOR UPDATE;
  SELECT * INTO b FROM "public"."dm_muc_tieu" WHERE "ma" = "p_vao" FOR UPDATE;
  IF a."ma" IS NULL OR b."ma" IS NULL OR a."ma" = b."ma" THEN RAISE EXCEPTION 'Chọn hai mục tiêu khác nhau có trong danh mục.' USING ERRCODE = '22023'; END IF;
  IF a."gop_vao" IS NOT NULL OR b."gop_vao" IS NOT NULL OR NOT b."dang_dung" THEN
    RAISE EXCEPTION 'Mục giữ lại phải đang dùng; không gộp mục đã gộp.' USING ERRCODE = '22023';
  END IF;
  v_ly := left('Gộp từ ' || a."ten_ngan", 300);
  SELECT coalesce(array_agg("nhiem_vu_id"), '{}') INTO v_viec FROM "public"."nhiem_vu_muc_tieu" WHERE "muc_tieu_ma" = a."ma";
  SELECT coalesce(array_agg("van_ban_id"), '{}') INTO v_vb FROM "public"."van_ban_muc_tieu" WHERE "muc_tieu_ma" = a."ma";
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "gan_luc", "nguon", "ly_do")
  SELECT "nhiem_vu_id", b."ma", "gan_boi", "gan_luc", 'GOP', v_ly FROM "public"."nhiem_vu_muc_tieu" WHERE "muc_tieu_ma" = a."ma" ON CONFLICT DO NOTHING;
  DELETE FROM "public"."nhiem_vu_muc_tieu" WHERE "muc_tieu_ma" = a."ma";
  INSERT INTO "public"."van_ban_muc_tieu" ("van_ban_id", "muc_tieu_ma", "gan_boi", "gan_luc", "nguon", "ly_do")
  SELECT "van_ban_id", b."ma", "gan_boi", "gan_luc", 'GOP', v_ly FROM "public"."van_ban_muc_tieu" WHERE "muc_tieu_ma" = a."ma" ON CONFLICT DO NOTHING;
  DELETE FROM "public"."van_ban_muc_tieu" WHERE "muc_tieu_ma" = a."ma";
  UPDATE "public"."quy_tac_muc_tieu" q SET "muc_tieu_ma" = b."ma", "cap_nhat_luc" = now()
  WHERE q."muc_tieu_ma" = a."ma" AND NOT EXISTS (SELECT 1 FROM "public"."quy_tac_muc_tieu" x WHERE x."muc_tieu_ma" = b."ma" AND x."loai" = q."loai" AND x."gia_tri_chuan" = q."gia_tri_chuan");
  DELETE FROM "public"."quy_tac_muc_tieu" WHERE "muc_tieu_ma" = a."ma";
  UPDATE "public"."chi_tieu_ket_qua" k SET "muc_tieu_ma" = b."ma"
  WHERE k."muc_tieu_ma" = a."ma" AND b."nhom" = 'CHI_TIEU' AND NOT EXISTS (SELECT 1 FROM "public"."chi_tieu_ket_qua" x WHERE x."muc_tieu_ma" = b."ma" AND x."ky" = k."ky");
  v_chuyen := b."so_hieu" IS NULL AND a."so_hieu" IS NOT NULL   -- số hiệu sang mục giữ lại chỉ khi đúng dạng nhóm của mục đó (sửa mục sau này không bị chặn)
    AND coalesce((SELECT a."so_hieu" ~ g."mau_so_hieu" FROM "public"."dm_nhom_muc_tieu" g WHERE g."ma" = b."nhom" AND g."mau_so_hieu" IS NOT NULL), true);
  UPDATE "public"."dm_muc_tieu" SET "dang_dung" = false, "gop_vao" = b."ma", "cap_nhat_luc" = now(), "so_hieu" = CASE WHEN v_chuyen THEN NULL ELSE "so_hieu" END WHERE "ma" = a."ma";
  IF v_chuyen THEN UPDATE "public"."dm_muc_tieu" SET "so_hieu" = a."so_hieu" WHERE "ma" = b."ma"; END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", v_me, 'gan_muc_tieu', a."ten_ngan", 'Gộp mục tiêu trùng: ' || a."ten_ngan" || ' → ' || b."ten_ngan", 'app'
  FROM "public"."nhiem_vu" n
  WHERE n."id" = ANY (v_viec)
     OR (n."van_ban_id" = ANY (v_vb) AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n."id" AND m."nguon" <> 'GOP'));
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES (v_me, 'dm_muc_tieu', a."ma", 'gop', jsonb_build_object('dang_dung', a."dang_dung"), jsonb_build_object('gop_vao', b."ma", 'so_viec', cardinality(v_viec),
          'so_van_ban', cardinality(v_vb)), btrim("p_ly_do"));
  RETURN jsonb_build_object('so_viec', cardinality(v_viec), 'so_van_ban', cardinality(v_vb));
END;
$$;

-- ---- Nhóm ----
CREATE FUNCTION "public"."them_nhom_muc_tieu"("p_ten" text, "p_tab" text, "p_mau_so_hieu" text, "p_ly_do" text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text; v_goc text; v_n integer := 1; v_dong "public"."dm_nhom_muc_tieu";
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  IF nullif(btrim(coalesce("p_ten", '')), '') IS NULL OR nullif(btrim(coalesce("p_tab", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Tên nhóm và nhãn thẻ bắt buộc.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."dm_nhom_muc_tieu" WHERE "public"."kl_chuan_chu"("ten") = "public"."kl_chuan_chu"("p_ten")) THEN
    RAISE EXCEPTION 'Đã có nhóm "%".', btrim("p_ten") USING ERRCODE = '23505';
  END IF;
  PERFORM regexp_match('', coalesce(nullif(btrim(coalesce("p_mau_so_hieu", '')), ''), ''));   -- dạng số hiệu sai cú pháp → lỗi ngay
  v_goc := left(upper(replace("public"."kl_chuan_chu"("p_tab"), ' ', '_')), 26); v_ma := v_goc;
  WHILE EXISTS (SELECT 1 FROM "public"."dm_nhom_muc_tieu" WHERE "ma" = v_ma) LOOP v_n := v_n + 1; v_ma := v_goc || '_' || v_n; END LOOP;
  INSERT INTO "public"."dm_nhom_muc_tieu" ("ma", "ten", "tab", "mau_so_hieu", "thu_tu")
  VALUES (v_ma, btrim("p_ten"), btrim("p_tab"), nullif(btrim(coalesce("p_mau_so_hieu", '')), ''), (SELECT coalesce(max("thu_tu"), 0) + 1 FROM "public"."dm_nhom_muc_tieu"))
  RETURNING * INTO v_dong;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_nhom_muc_tieu', v_ma, 'them', to_jsonb(v_dong), btrim("p_ly_do"));
  RETURN v_ma;
END;
$$;
CREATE FUNCTION "public"."sua_nhom_muc_tieu"("p_ma" text, "p" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."dm_nhom_muc_tieu"; m jsonb; v_cu jsonb := '{}'; v_doi jsonb := '{}'; k text;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  SELECT * INTO c FROM "public"."dm_nhom_muc_tieu" WHERE "ma" = "p_ma" FOR UPDATE;
  IF c."ma" IS NULL THEN RAISE EXCEPTION 'Không có nhóm "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  m := to_jsonb(c) || (SELECT coalesce(jsonb_object_agg(key, value), '{}') FROM jsonb_each(coalesce("p", '{}')) WHERE key IN ('ten', 'tab', 'mau_so_hieu', 'thu_tu', 'dang_dung'));
  PERFORM regexp_match('', coalesce(nullif(m ->> 'mau_so_hieu', ''), ''));
  FOREACH k IN ARRAY ARRAY['ten', 'tab', 'mau_so_hieu', 'thu_tu', 'dang_dung'] LOOP
    IF (to_jsonb(c) -> k) IS DISTINCT FROM (m -> k) THEN v_cu := v_cu || jsonb_build_object(k, to_jsonb(c) -> k); v_doi := v_doi || jsonb_build_object(k, m -> k); END IF;
  END LOOP;
  IF v_doi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."dm_nhom_muc_tieu" SET "ten" = btrim(m ->> 'ten'), "tab" = btrim(m ->> 'tab'), "mau_so_hieu" = nullif(btrim(coalesce(m ->> 'mau_so_hieu', '')), ''),
    "thu_tu" = (m ->> 'thu_tu')::numeric::integer, "dang_dung" = (m ->> 'dang_dung')::boolean WHERE "ma" = c."ma";
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_nhom_muc_tieu', c."ma", 'sua', v_cu, v_doi, btrim("p_ly_do"));
END;
$$;

-- ---- Khối lĩnh vực ----
CREATE FUNCTION "public"."them_khoi_linh_vuc"("p_ten" text, "p_ly_do" text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text; v_goc text; v_n integer := 1;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  IF nullif(btrim(coalesce("p_ten", '')), '') IS NULL OR char_length(btrim("p_ten")) > 120 THEN RAISE EXCEPTION 'Tên khối bắt buộc, tối đa 120 ký tự.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."dm_khoi_linh_vuc" WHERE "public"."kl_chuan_chu"("ten") = "public"."kl_chuan_chu"("p_ten")) THEN
    RAISE EXCEPTION 'Đã có khối "%".', btrim("p_ten") USING ERRCODE = '23505';
  END IF;
  v_goc := left(upper(replace("public"."kl_chuan_chu"("p_ten"), ' ', '_')), 34); v_ma := v_goc;
  WHILE EXISTS (SELECT 1 FROM "public"."dm_khoi_linh_vuc" WHERE "ma" = v_ma) LOOP v_n := v_n + 1; v_ma := v_goc || '_' || v_n; END LOOP;
  INSERT INTO "public"."dm_khoi_linh_vuc" ("ma", "ten", "thu_tu") VALUES (v_ma, btrim("p_ten"), (SELECT coalesce(max("thu_tu"), 0) + 1 FROM "public"."dm_khoi_linh_vuc"));
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_khoi_linh_vuc', v_ma, 'them', jsonb_build_object('ten', btrim("p_ten")), btrim("p_ly_do"));
  RETURN v_ma;
END;
$$;
CREATE FUNCTION "public"."sua_khoi_linh_vuc"("p_ma" text, "p" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."dm_khoi_linh_vuc"; m jsonb; v_cu jsonb := '{}'; v_doi jsonb := '{}'; k text;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  SELECT * INTO c FROM "public"."dm_khoi_linh_vuc" WHERE "ma" = "p_ma" FOR UPDATE;
  IF c."ma" IS NULL THEN RAISE EXCEPTION 'Không có khối "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  m := to_jsonb(c) || (SELECT coalesce(jsonb_object_agg(key, value), '{}') FROM jsonb_each(coalesce("p", '{}')) WHERE key IN ('ten', 'thu_tu', 'dang_dung'));
  FOREACH k IN ARRAY ARRAY['ten', 'thu_tu', 'dang_dung'] LOOP
    IF (to_jsonb(c) -> k) IS DISTINCT FROM (m -> k) THEN v_cu := v_cu || jsonb_build_object(k, to_jsonb(c) -> k); v_doi := v_doi || jsonb_build_object(k, m -> k); END IF;
  END LOOP;
  IF v_doi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  IF v_doi ? 'dang_dung' AND NOT (m ->> 'dang_dung')::boolean AND (EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "khoi_ma" = c."ma") OR EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "khoi_ma" = c."ma")) THEN
    RAISE EXCEPTION 'Khối còn ngành hoặc lĩnh vực — chuyển sang khối khác trước khi ngừng dùng (số liệu Tổng quan không bị lệch).' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."dm_khoi_linh_vuc" SET "ten" = btrim(m ->> 'ten'), "thu_tu" = (m ->> 'thu_tu')::numeric::integer, "dang_dung" = (m ->> 'dang_dung')::boolean WHERE "ma" = c."ma";
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_khoi_linh_vuc', c."ma", 'sua', v_cu, v_doi, btrim("p_ly_do"));
END;
$$;
-- p_bang 'dm_nganh' (bắt buộc có khối) | 'dm_linh_vuc' (NULL = theo khối của ngành).
CREATE FUNCTION "public"."dat_khoi_linh_vuc"("p_bang" text, "p_ma" text, "p_khoi" text, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cu text;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  IF "p_khoi" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_khoi_linh_vuc" WHERE "ma" = "p_khoi" AND "dang_dung") THEN
    RAISE EXCEPTION 'Không có khối "%".', "p_khoi" USING ERRCODE = '22023';
  END IF;
  IF "p_bang" = 'dm_nganh' THEN
    IF "p_khoi" IS NULL THEN RAISE EXCEPTION 'Ngành phải thuộc một khối.' USING ERRCODE = '22023'; END IF;
    SELECT "khoi_ma" INTO v_cu FROM "public"."dm_nganh" WHERE "ma" = "p_ma" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có ngành "%".', "p_ma" USING ERRCODE = '22023'; END IF;
    UPDATE "public"."dm_nganh" SET "khoi_ma" = "p_khoi" WHERE "ma" = "p_ma";
  ELSIF "p_bang" = 'dm_linh_vuc' THEN
    SELECT "khoi_ma" INTO v_cu FROM "public"."dm_linh_vuc" WHERE "ma" = "p_ma" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có lĩnh vực "%".', "p_ma" USING ERRCODE = '22023'; END IF;
    UPDATE "public"."dm_linh_vuc" SET "khoi_ma" = "p_khoi" WHERE "ma" = "p_ma";
  ELSE RAISE EXCEPTION 'Bảng không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF v_cu IS NOT DISTINCT FROM "p_khoi" THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), "p_bang", "p_ma", 'sua', jsonb_build_object('khoi_ma', v_cu), jsonb_build_object('khoi_ma', "p_khoi"), btrim("p_ly_do"));
END;
$$;

-- ---- Quy tắc ----
CREATE FUNCTION "public"."kl_kiem_gia_tri_quy_tac"("p_loai" text, "p_gia_tri" text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v text := nullif(btrim(coalesce("p_gia_tri", '')), '');
BEGIN
  IF v IS NULL OR char_length(v) > 120 THEN RAISE EXCEPTION 'Giá trị quy tắc bắt buộc, tối đa 120 ký tự.' USING ERRCODE = '22023'; END IF;
  IF "p_loai" = 'SO_HIEU' THEN v := "public"."kl_chuan_so_hieu"(v); IF v IS NULL THEN RAISE EXCEPTION 'Số hiệu không đúng dạng (ví dụ 57-NQ/TW).' USING ERRCODE = '22023'; END IF;
  ELSIF "p_loai" = 'LINH_VUC' THEN IF NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v) THEN RAISE EXCEPTION 'Không có lĩnh vực "%".', v USING ERRCODE = '22023'; END IF;
  ELSIF "p_loai" = 'NGANH' THEN IF NOT EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = v) THEN RAISE EXCEPTION 'Không có ngành "%".', v USING ERRCODE = '22023'; END IF;
  ELSIF "p_loai" IN ('TU_KHOA', 'LOAI_TRU') THEN
    IF char_length("public"."kl_chuan_chu"(v)) < 3 THEN RAISE EXCEPTION 'Từ khoá quá ngắn (ít nhất 3 chữ cái).' USING ERRCODE = '22023'; END IF;
  ELSE RAISE EXCEPTION 'Loại quy tắc không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_kiem_gia_tri_quy_tac"(text, text) FROM public, "anon", "authenticated";
CREATE FUNCTION "public"."them_quy_tac"("p_ma" text, "p_loai" text, "p_gia_tri" text, "p_muc" text, "p_ly_do" text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v text;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  IF NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma") THEN RAISE EXCEPTION 'Không có mục tiêu "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  IF coalesce("p_muc", '') NOT IN ('TU_TICH', 'GOI_Y') THEN RAISE EXCEPTION 'Mức chỉ nhận tích sẵn hoặc gợi ý.' USING ERRCODE = '22023'; END IF;
  v := "public"."kl_kiem_gia_tri_quy_tac"("p_loai", "p_gia_tri");
  INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "nguon", "khoa", "ghi_chu")
  VALUES ("p_ma", "p_loai", v, "p_muc", 'QUAN_TRI', true, left(btrim("p_ly_do"), 300))
  ON CONFLICT ("muc_tieu_ma", "loai", "gia_tri_chuan") DO NOTHING RETURNING "id" INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Quy tắc này đã có.' USING ERRCODE = '23505'; END IF;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'quy_tac_muc_tieu', v_id::text, 'them', jsonb_build_object('muc_tieu_ma', "p_ma", 'loai', "p_loai", 'gia_tri', v, 'muc', "p_muc"), btrim("p_ly_do"));
  RETURN v_id;
END;
$$;
-- p: muc (TU_TICH | GOI_Y), trang_thai (BAT | TAT), khoa (true = giữ cố định, không tự nâng / hạ), ghi_chu.
CREATE FUNCTION "public"."sua_quy_tac"("p_id" uuid, "p" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."quy_tac_muc_tieu"; m jsonb; v_cu jsonb := '{}'; v_doi jsonb := '{}'; k text;
BEGIN
  PERFORM "public"."kl_can_quan_tri_muc_tieu"("p_ly_do");
  SELECT * INTO c FROM "public"."quy_tac_muc_tieu" WHERE "id" = "p_id" FOR UPDATE;
  IF c."id" IS NULL THEN RAISE EXCEPTION 'Không có quy tắc này.' USING ERRCODE = '22023'; END IF;
  m := to_jsonb(c) || (SELECT coalesce(jsonb_object_agg(key, value), '{}') FROM jsonb_each(coalesce("p", '{}')) WHERE key IN ('muc', 'trang_thai', 'khoa', 'ghi_chu'));
  IF m ->> 'muc' NOT IN ('TU_TICH', 'GOI_Y') OR m ->> 'trang_thai' NOT IN ('BAT', 'TAT') THEN
    RAISE EXCEPTION 'Mức (tích sẵn / gợi ý) hoặc trạng thái (bật / tắt) không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['muc', 'trang_thai', 'khoa', 'ghi_chu'] LOOP
    IF (to_jsonb(c) -> k) IS DISTINCT FROM (m -> k) THEN v_cu := v_cu || jsonb_build_object(k, to_jsonb(c) -> k); v_doi := v_doi || jsonb_build_object(k, m -> k); END IF;
  END LOOP;
  IF v_doi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."quy_tac_muc_tieu" SET "muc" = m ->> 'muc', "trang_thai" = m ->> 'trang_thai', "khoa" = (m ->> 'khoa')::boolean,
    "ghi_chu" = left(m ->> 'ghi_chu', 300), "cap_nhat_luc" = now() WHERE "id" = c."id";
  IF v_doi ? 'muc' OR v_doi ? 'trang_thai' THEN   -- đổi mức / trạng thái: đếm lại từ đầu (không tự đổi ngược ngay quyết định của quản trị)
    UPDATE "public"."quy_tac_muc_tieu" SET "so_lan_hien" = 0, "so_lan_nhan" = 0, "so_lan_bo" = 0, "dem_tu" = now() WHERE "id" = c."id";
  END IF;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'quy_tac_muc_tieu', c."id"::text, 'sua', v_cu, v_doi, btrim("p_ly_do"));
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['khoi_phuc_muc_tieu(bigint,text)', 'gop_muc_tieu(text,text,text)', 'them_nhom_muc_tieu(text,text,text,text)',
                           'sua_nhom_muc_tieu(text,jsonb,text)', 'them_khoi_linh_vuc(text,text)', 'sua_khoi_linh_vuc(text,jsonb,text)',
                           'dat_khoi_linh_vuc(text,text,text,text)', 'them_quy_tac(text,text,text,text,text)', 'sua_quy_tac(uuid,jsonb,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
