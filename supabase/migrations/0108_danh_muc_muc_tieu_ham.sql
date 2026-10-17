-- 0108 (v3.25): hàm danh mục mục tiêu then chốt — "thêm nhanh, sửa có kiểm soát, không xoá" (chủ dự án duyệt 17/10/2026; lãnh đạo không thao tác).
-- Quyền (kl_quyen_muc_tieu): QUAN_TRI = quản trị hệ thống hoặc tài khoản toàn quyền (0100); NHAP = mọi cán bộ nhập liệu (kl_nguoi_nhap — không Thường
-- trực, không tài khoản hệ thống, không bị khoá). Mọi thao tác ghi dm_lich_su (bảng dm_muc_tieu) cùng giao dịch.
--  - them_muc_tieu: NHAP / QUAN_TRI thêm vào nhóm đang dùng, dùng được ngay (trang_thai MOI); chặn trùng số hiệu (theo khoá so khớp) và trùng tên trong
--    nhóm (không phân biệt dấu, hoa thường); có số hiệu → tự tạo quy tắc SO_HIEU mức tích sẵn.
--  - them_muc_tieu_tu_dong: hệ thống thêm khi văn bản giao việc / nội dung nhiệm vụ nhắc số hiệu đúng dạng của một nhóm (mau_so_hieu) mà danh mục chưa
--    có — mọi tài khoản đang hoạt động (kể cả Thường trực khi giao việc), tối đa 30 mục mỗi người mỗi ngày; đã có → trả mã sẵn có (mục đã gộp → mục giữ
--    lại; mục ngừng dùng → báo lỗi, không gắn được).
--  - sua_muc_tieu: QUAN_TRI; hoặc người thêm khi mục còn MOI và do người dùng thêm. Mục DA_DOI_CHIEU (đã đối chiếu văn bản gốc) bị khoá với mọi người —
--    quản trị mở khoá trước (dat_trang_thai_muc_tieu). Bắt buộc lý do; nhật ký chỉ ghi cột đổi (gia_tri_cu / gia_tri_moi) — khôi phục được (0109).
--  - dat_trang_thai_muc_tieu: QUAN_TRI — khoa (đã đối chiếu) / mo_khoa / ngung (ngừng dùng: không còn trong ô chọn, việc đã gắn giữ nguyên) / dung_lai.
-- kl_chuan_so_hieu: dạng chuẩn để lưu, hiển thị ('57 - nq/tw' → '57-NQ/TW', CTR → CTr); kl_khoa_so_hieu: khoá so khớp (bỏ số 0 đầu: '05-NQ/TU' ≡ '5-NQ/TU').

CREATE FUNCTION "public"."kl_chuan_so_hieu"("p" text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  WITH s AS (SELECT upper(regexp_replace(translate(coalesce("p", ''), '–—‑', '---'), '\s+', '', 'g')) AS x)
  SELECT CASE WHEN x ~ '^[0-9]{1,5}-[A-ZĐ]{1,5}/[A-Z]{1,8}$' THEN regexp_replace(x, '-CTR/', '-CTr/') END FROM s;
$$;
CREATE FUNCTION "public"."kl_khoa_so_hieu"("p" text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN "public"."kl_chuan_so_hieu"("p") IS NOT NULL
    THEN (split_part("public"."kl_chuan_so_hieu"("p"), '-', 1)::integer)::text || '-' || upper(split_part("public"."kl_chuan_so_hieu"("p"), '-', 2)) END;
$$;
CREATE UNIQUE INDEX "dm_muc_tieu_so_hieu_khoa_key" ON "public"."dm_muc_tieu" ("public"."kl_khoa_so_hieu"("so_hieu")) WHERE "so_hieu" IS NOT NULL;
GRANT EXECUTE ON FUNCTION "public"."kl_chuan_so_hieu"(text), "public"."kl_khoa_so_hieu"(text) TO "authenticated";

CREATE FUNCTION "public"."kl_quyen_muc_tieu"() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)) THEN NULL
    WHEN coalesce("public"."me_quan_tri_he_thong"(), false) OR coalesce("public"."me_toan_quyen"(), false) THEN 'QUAN_TRI'
    WHEN coalesce("public"."kl_nguoi_nhap"(), false) THEN 'NHAP' END;
$$;
GRANT EXECUTE ON FUNCTION "public"."kl_quyen_muc_tieu"() TO "authenticated";

-- Mã mới: theo số hiệu (NQ/TW → NQ_81; NQ/TU → NQTU_5; CTr/TU → CTRTU_5; khác → MT_<số>_<loại>), không có số hiệu → MT_<tên ngắn không dấu>; trùng → _2, _3…
CREATE FUNCTION "public"."kl_ma_muc_tieu_moi"("p_so_hieu" text, "p_ten_ngan" text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE k text := "public"."kl_khoa_so_hieu"("p_so_hieu"); v_goc text; v_ma text; v_n integer := 1;
BEGIN
  v_goc := CASE
    WHEN k ~ '-NQ/TW$' THEN 'NQ_' || split_part(k, '-', 1)
    WHEN k ~ '-NQ/TU$' THEN 'NQTU_' || split_part(k, '-', 1)
    WHEN k ~ '-CTR/TU$' THEN 'CTRTU_' || split_part(k, '-', 1)
    WHEN k IS NOT NULL THEN 'MT_' || upper(regexp_replace(k, '[^A-Za-z0-9]+', '_', 'g'))
    ELSE 'MT_' || upper(left(replace("public"."kl_chuan_chu"("p_ten_ngan"), ' ', '_'), 30)) END;
  v_goc := left(rtrim(v_goc, '_'), 36);
  IF v_goc = 'MT' OR v_goc = 'MT_' THEN v_goc := 'MT_MUC_TIEU'; END IF;
  v_ma := v_goc;
  WHILE EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" WHERE "ma" = v_ma) LOOP v_n := v_n + 1; v_ma := v_goc || '_' || v_n; END LOOP;
  RETURN v_ma;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ma_muc_tieu_moi"(text, text) FROM public, "anon", "authenticated";

-- Kiểm trùng (dùng cho thêm và sửa): số hiệu theo khoá; tên / tên ngắn trong cùng nhóm theo kl_chuan_chu. p_tru = mã đang sửa (bỏ qua chính nó).
CREATE FUNCTION "public"."kl_kiem_trung_muc_tieu"("p_nhom" text, "p_ten" text, "p_ten_ngan" text, "p_so_hieu" text, "p_tru" text) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_ten text;
BEGIN
  IF "p_so_hieu" IS NOT NULL THEN
    SELECT "ten_ngan" INTO v_ten FROM "public"."dm_muc_tieu"
    WHERE "so_hieu" IS NOT NULL AND "public"."kl_khoa_so_hieu"("so_hieu") = "public"."kl_khoa_so_hieu"("p_so_hieu") AND "ma" IS DISTINCT FROM "p_tru";
    IF v_ten IS NOT NULL THEN RAISE EXCEPTION 'Số hiệu % đã có trong danh mục: %.', "p_so_hieu", v_ten USING ERRCODE = '23505'; END IF;
  END IF;
  SELECT "ten_ngan" INTO v_ten FROM "public"."dm_muc_tieu"
  WHERE "nhom" = "p_nhom" AND "ma" IS DISTINCT FROM "p_tru"
    AND ("public"."kl_chuan_chu"("ten") IN ("public"."kl_chuan_chu"("p_ten"), "public"."kl_chuan_chu"("p_ten_ngan"))
         OR "public"."kl_chuan_chu"("ten_ngan") IN ("public"."kl_chuan_chu"("p_ten"), "public"."kl_chuan_chu"("p_ten_ngan")))
  LIMIT 1;
  IF v_ten IS NOT NULL THEN RAISE EXCEPTION 'Nhóm này đã có mục tiêu "%".', v_ten USING ERRCODE = '23505'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_kiem_trung_muc_tieu"(text, text, text, text, text) FROM public, "anon", "authenticated";

-- Kiểm nhóm + số hiệu đúng dạng của nhóm; trả số hiệu dạng chuẩn (NULL nếu không có).
CREATE FUNCTION "public"."kl_kiem_so_hieu_nhom"("p_nhom" text, "p_so_hieu" text) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_mau text; v_sh text := "public"."kl_chuan_so_hieu"("p_so_hieu");
BEGIN
  SELECT "mau_so_hieu" INTO v_mau FROM "public"."dm_nhom_muc_tieu" WHERE "ma" = "p_nhom" AND "dang_dung";
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có nhóm mục tiêu "%".', "p_nhom" USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce("p_so_hieu", '')), '') IS NULL THEN RETURN NULL; END IF;
  IF v_sh IS NULL THEN RAISE EXCEPTION 'Số hiệu "%" không đúng dạng (ví dụ 57-NQ/TW).', "p_so_hieu" USING ERRCODE = '22023'; END IF;
  IF v_mau IS NOT NULL AND v_sh !~ v_mau THEN RAISE EXCEPTION 'Số hiệu % không thuộc nhóm này.', v_sh USING ERRCODE = '22023'; END IF;
  RETURN v_sh;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_kiem_so_hieu_nhom"(text, text) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."them_muc_tieu"("p_nhom" text, "p_ten" text, "p_ten_ngan" text DEFAULT NULL, "p_so_hieu" text DEFAULT NULL, "p_mo_ta" text DEFAULT NULL,
  "p_can_cu" text DEFAULT NULL, "p_chi_tieu" text DEFAULT NULL, "p_ly_do" text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ten text := nullif(btrim(coalesce("p_ten", '')), ''); v_ngan text; v_sh text; v_ma text; v_dong "public"."dm_muc_tieu";
BEGIN
  IF "public"."kl_quyen_muc_tieu"() IS NULL THEN
    RAISE EXCEPTION 'Tài khoản này không bổ sung được danh mục (Thường trực, tài khoản hệ thống hoặc đã khoá).' USING ERRCODE = '42501';
  END IF;
  IF v_ten IS NULL OR char_length(v_ten) > 300 THEN RAISE EXCEPTION 'Tên mục tiêu bắt buộc, tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
  v_ngan := left(coalesce(nullif(btrim(coalesce("p_ten_ngan", '')), ''), v_ten), 120);
  v_sh := "public"."kl_kiem_so_hieu_nhom"("p_nhom", "p_so_hieu");
  PERFORM "public"."kl_kiem_trung_muc_tieu"("p_nhom", v_ten, v_ngan, v_sh, NULL);
  v_ma := "public"."kl_ma_muc_tieu_moi"(v_sh, v_ngan);
  INSERT INTO "public"."dm_muc_tieu" ("ma", "nhom", "ten", "ten_ngan", "mo_ta", "can_cu", "chi_tieu", "thu_tu", "so_hieu", "trang_thai", "nguon_them", "tao_boi")
  VALUES (v_ma, "p_nhom", v_ten, v_ngan, left(nullif(btrim(coalesce("p_mo_ta", '')), ''), 300), left(nullif(btrim(coalesce("p_can_cu", '')), ''), 300),
          left(nullif(btrim(coalesce("p_chi_tieu", '')), ''), 200),
          (SELECT coalesce(max("thu_tu"), 0) + 1 FROM "public"."dm_muc_tieu" WHERE "nhom" = "p_nhom"), v_sh, 'MOI', 'NGUOI_DUNG', "auth"."uid"())
  RETURNING * INTO v_dong;
  IF v_sh IS NOT NULL THEN
    INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "nguon") VALUES (v_ma, 'SO_HIEU', v_sh, 'TU_TICH', 'TU_DONG');
  END IF;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_muc_tieu', v_ma, 'them', to_jsonb(v_dong), coalesce(nullif(btrim(coalesce("p_ly_do", '')), ''), 'Bổ sung danh mục'));
  RETURN v_ma;
END;
$$;

-- p_ve: cụm chữ sau số hiệu trong câu nhắc tới văn bản (ví dụ "của Bộ Chính trị về …") — ghép vào tên, mô tả để người xem nhận ra.
CREATE FUNCTION "public"."them_muc_tieu_tu_dong"("p_so_hieu" text, "p_ve" text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sh text := "public"."kl_chuan_so_hieu"("p_so_hieu"); v_nhom text; v_ma text; v_loai text; v_ve text; v_dong "public"."dm_muc_tieu"; c "public"."dm_muc_tieu"; i integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)) THEN
    RAISE EXCEPTION 'Phiên đăng nhập không hợp lệ.' USING ERRCODE = '42501';
  END IF;
  IF v_sh IS NULL THEN RAISE EXCEPTION 'Số hiệu không đúng dạng.' USING ERRCODE = '22023'; END IF;
  SELECT "ma" INTO v_nhom FROM "public"."dm_nhom_muc_tieu" WHERE "dang_dung" AND "mau_so_hieu" IS NOT NULL AND v_sh ~ "mau_so_hieu" ORDER BY "thu_tu" LIMIT 1;
  v_loai := CASE WHEN v_sh ~ '-CTr/' THEN 'Chương trình' ELSE 'Nghị quyết' END;
  SELECT * INTO c FROM "public"."dm_muc_tieu" WHERE "so_hieu" IS NOT NULL AND "public"."kl_khoa_so_hieu"("so_hieu") = "public"."kl_khoa_so_hieu"(v_sh);
  IF c."ma" IS NULL THEN   -- đã thêm tay cùng tên ngắn (chưa ghi số hiệu)
    SELECT * INTO c FROM "public"."dm_muc_tieu" WHERE "nhom" = v_nhom AND "public"."kl_chuan_chu"("ten_ngan") = "public"."kl_chuan_chu"(v_loai || ' ' || v_sh) LIMIT 1;
  END IF;
  WHILE c."gop_vao" IS NOT NULL AND i < 5 LOOP SELECT * INTO c FROM "public"."dm_muc_tieu" WHERE "ma" = c."gop_vao"; i := i + 1; END LOOP;   -- mục đã gộp → mục giữ lại
  IF c."ma" IS NOT NULL AND NOT c."dang_dung" THEN RAISE EXCEPTION 'Mục tiêu có số hiệu % đang ngừng dùng.', v_sh USING ERRCODE = '22023'; END IF;
  IF c."ma" IS NOT NULL THEN RETURN jsonb_build_object('ma', c."ma", 'moi', false); END IF;
  IF (SELECT count(*) FROM "public"."dm_lich_su" WHERE "bang" = 'dm_muc_tieu' AND "hanh_dong" = 'tu_dong' AND "nguoi" = "auth"."uid"()
      AND "luc" >= ("public"."kl_hom_nay"()::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) >= 30 THEN
    RAISE EXCEPTION 'Hôm nay đồng chí đã tự thêm 30 mục tiêu theo số hiệu — liên hệ quản trị hệ thống nếu cần thêm.' USING ERRCODE = '54000';
  END IF;
  IF v_nhom IS NULL THEN RAISE EXCEPTION 'Số hiệu % không thuộc nhóm mục tiêu nào.', v_sh USING ERRCODE = '22023'; END IF;
  v_ve := left(nullif(btrim(regexp_replace(coalesce("p_ve", ''), '\s+', ' ', 'g')), ''), 200);
  v_ma := "public"."kl_ma_muc_tieu_moi"(v_sh, v_loai || ' ' || v_sh);
  INSERT INTO "public"."dm_muc_tieu" ("ma", "nhom", "ten", "ten_ngan", "mo_ta", "thu_tu", "so_hieu", "trang_thai", "nguon_them", "tao_boi")
  VALUES (v_ma, v_nhom, left(v_loai || ' số ' || v_sh || coalesce(' ' || v_ve, ''), 300), v_loai || ' ' || v_sh, v_ve,
          (SELECT coalesce(max("thu_tu"), 0) + 1 FROM "public"."dm_muc_tieu" WHERE "nhom" = v_nhom), v_sh, 'MOI', 'TU_DONG', "auth"."uid"())
  RETURNING * INTO v_dong;
  INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "nguon") VALUES (v_ma, 'SO_HIEU', v_sh, 'TU_TICH', 'TU_DONG');
  INSERT INTO "public"."dm_lich_su" ("nguoi", "nguoi_ghi_chu", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'tự động', 'dm_muc_tieu', v_ma, 'tu_dong', to_jsonb(v_dong), 'Tự thêm: số hiệu được nhắc trong văn bản giao việc / nội dung nhiệm vụ');
  RETURN jsonb_build_object('ma', v_ma, 'moi', true);
END;
$$;

-- Sửa nội dung (dùng chung với khôi phục — 0109). p: các khoá ten, ten_ngan, mo_ta, can_cu, chi_tieu, so_hieu, nhom, thu_tu (khoá vắng = giữ nguyên).
CREATE FUNCTION "public"."kl_sua_muc_tieu"("p_ma" text, "p" jsonb, "p_ly_do" text, "p_hanh_dong" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."dm_muc_tieu"; v_quyen text := "public"."kl_quyen_muc_tieu"(); v_moi jsonb; v_cu jsonb := '{}'; v_doi jsonb := '{}'; k text;
        v_nhom text; v_sh text;
BEGIN
  SELECT * INTO c FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma" FOR UPDATE;
  IF c."ma" IS NULL THEN RAISE EXCEPTION 'Không có mục tiêu "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  IF NOT (v_quyen = 'QUAN_TRI' OR (v_quyen = 'NHAP' AND c."tao_boi" = "auth"."uid"() AND c."trang_thai" = 'MOI' AND c."nguon_them" = 'NGUOI_DUNG')) THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống (hoặc người vừa thêm mục này) mới sửa được mục tiêu.' USING ERRCODE = '42501';
  END IF;
  IF c."trang_thai" = 'DA_DOI_CHIEU' THEN
    RAISE EXCEPTION 'Mục tiêu đã đối chiếu văn bản gốc và đang khoá — quản trị hệ thống mở khoá trước khi sửa.' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do sửa.' USING ERRCODE = '22023'; END IF;
  v_moi := to_jsonb(c) || (SELECT coalesce(jsonb_object_agg(key, CASE WHEN jsonb_typeof(value) = 'string' THEN to_jsonb(nullif(btrim(value #>> '{}'), '')) ELSE value END), '{}')
                          FROM jsonb_each(coalesce("p", '{}')) WHERE key IN ('ten', 'ten_ngan', 'mo_ta', 'can_cu', 'chi_tieu', 'so_hieu', 'nhom', 'thu_tu'));
  v_nhom := v_moi ->> 'nhom';
  v_sh := "public"."kl_kiem_so_hieu_nhom"(v_nhom, v_moi ->> 'so_hieu');
  v_moi := jsonb_set(v_moi, '{so_hieu}', coalesce(to_jsonb(v_sh), 'null'::jsonb));
  IF nullif(v_moi ->> 'ten', '') IS NULL OR char_length(v_moi ->> 'ten') > 300 THEN RAISE EXCEPTION 'Tên mục tiêu bắt buộc, tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
  IF nullif(v_moi ->> 'ten_ngan', '') IS NULL OR char_length(v_moi ->> 'ten_ngan') > 120 THEN RAISE EXCEPTION 'Tên ngắn bắt buộc, tối đa 120 ký tự.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_moi ->> 'mo_ta') > 300 OR char_length(v_moi ->> 'can_cu') > 300 OR char_length(v_moi ->> 'chi_tieu') > 200 THEN
    RAISE EXCEPTION 'Mô tả, căn cứ tối đa 300 ký tự; chỉ tiêu tối đa 200 ký tự.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_moi -> 'thu_tu') <> 'number' OR (v_moi ->> 'thu_tu')::numeric < 1 THEN RAISE EXCEPTION 'Thứ tự phải là số nguyên dương.' USING ERRCODE = '22023'; END IF;
  FOREACH k IN ARRAY ARRAY['ten', 'ten_ngan', 'mo_ta', 'can_cu', 'chi_tieu', 'so_hieu', 'nhom', 'thu_tu'] LOOP
    IF (to_jsonb(c) -> k) IS DISTINCT FROM (v_moi -> k) THEN v_cu := v_cu || jsonb_build_object(k, to_jsonb(c) -> k); v_doi := v_doi || jsonb_build_object(k, v_moi -> k); END IF;
  END LOOP;
  IF v_doi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."kl_kiem_trung_muc_tieu"(v_nhom, v_moi ->> 'ten', v_moi ->> 'ten_ngan', v_sh, c."ma");
  UPDATE "public"."dm_muc_tieu" SET "ten" = v_moi ->> 'ten', "ten_ngan" = v_moi ->> 'ten_ngan', "mo_ta" = v_moi ->> 'mo_ta',
    "can_cu" = v_moi ->> 'can_cu', "chi_tieu" = v_moi ->> 'chi_tieu', "so_hieu" = v_sh, "nhom" = v_nhom,
    "thu_tu" = (v_moi ->> 'thu_tu')::numeric::integer, "cap_nhat_luc" = now()
  WHERE "ma" = c."ma";
  IF v_doi ? 'so_hieu' THEN
    DELETE FROM "public"."quy_tac_muc_tieu" WHERE "muc_tieu_ma" = c."ma" AND "loai" = 'SO_HIEU' AND NOT "khoa";
    IF v_sh IS NOT NULL THEN
      INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "nguon") VALUES (c."ma", 'SO_HIEU', v_sh, 'TU_TICH', 'TU_DONG') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_muc_tieu', c."ma", "p_hanh_dong", v_cu, v_doi, btrim("p_ly_do"));
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_sua_muc_tieu"(text, jsonb, text, text) FROM public, "anon", "authenticated";
CREATE FUNCTION "public"."sua_muc_tieu"("p_ma" text, "p" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT "public"."kl_sua_muc_tieu"("p_ma", "p", "p_ly_do", 'sua'); $$;

CREATE FUNCTION "public"."dat_trang_thai_muc_tieu"("p_ma" text, "p_hanh_dong" text, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."dm_muc_tieu";
BEGIN
  IF "public"."kl_quyen_muc_tieu"() IS DISTINCT FROM 'QUAN_TRI' THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống mới khoá, mở khoá hoặc ngừng dùng mục tiêu.' USING ERRCODE = '42501';
  END IF;
  IF "p_hanh_dong" NOT IN ('khoa', 'mo_khoa', 'ngung', 'dung_lai') THEN RAISE EXCEPTION 'Thao tác không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma" FOR UPDATE;
  IF c."ma" IS NULL THEN RAISE EXCEPTION 'Không có mục tiêu "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  IF "p_hanh_dong" = 'dung_lai' AND c."gop_vao" IS NOT NULL THEN RAISE EXCEPTION 'Mục đã gộp vào mục khác — không dùng lại được.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."dm_muc_tieu" SET
    "trang_thai" = CASE "p_hanh_dong" WHEN 'khoa' THEN 'DA_DOI_CHIEU' WHEN 'mo_khoa' THEN 'MOI' ELSE "trang_thai" END,
    "dang_dung" = CASE "p_hanh_dong" WHEN 'ngung' THEN false WHEN 'dung_lai' THEN true ELSE "dang_dung" END, "cap_nhat_luc" = now()
  WHERE "ma" = c."ma";
  INSERT INTO "public"."dm_lich_su" ("nguoi", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), 'dm_muc_tieu', c."ma", "p_hanh_dong", jsonb_build_object('trang_thai', c."trang_thai", 'dang_dung', c."dang_dung"),
          (SELECT jsonb_build_object('trang_thai', "trang_thai", 'dang_dung', "dang_dung") FROM "public"."dm_muc_tieu" WHERE "ma" = c."ma"), btrim("p_ly_do"));
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['them_muc_tieu(text,text,text,text,text,text,text,text)', 'them_muc_tieu_tu_dong(text,text)', 'sua_muc_tieu(text,jsonb,text)',
                           'dat_trang_thai_muc_tieu(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
