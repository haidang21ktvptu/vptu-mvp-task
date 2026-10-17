-- 0112 (v3.25, chủ dự án chọn 17/10/2026: Claude; đổi nhà cung cấp nhanh): cấu hình trợ lý AI, nhật ký dùng AI, hàm cho Edge Function tro-ly-ai.
-- 1. cau_hinh_ai (một dòng): nhà cung cấp anthropic | openai | gemini | khac (dịch vụ theo chuẩn OpenAI, ví dụ dịch vụ trong nước — dia_chi bắt buộc)
--    | gia_lap (chỉ Supabase cục bộ để kiểm thử: Edge Function từ chối khi không có AI_CHO_PHEP_GIA_LAP); mô hình; mức suy nghĩ; bật / tắt; gửi nội dung
--    văn bản, nhiệm vụ cho AI (chủ dự án chọn phương án b: văn bản giao việc không mật, đã công khai trên V-Office); giới hạn lượt / ngày (toàn hệ thống,
--    mỗi người). KHOÁ API KHÔNG nằm trong CSDL: mỗi nhà cung cấp một secret cố định của Edge Function (AI_KEY_ANTHROPIC, AI_KEY_OPENAI, AI_KEY_GEMINI,
--    AI_KEY_KHAC) — không cấu hình được tên secret (tránh trỏ sang secret khác như khoá service_role). Đọc: mọi tài khoản đăng nhập (biết AI có bật không);
--    sửa: qt_dat_cau_hinh_ai (quản trị hệ thống / toàn quyền, có lý do, nhật ký hệ thống).
-- 2. nhat_ky_ai: mỗi lần gọi một dòng — người, việc, nhà cung cấp, mô hình, số token, thời gian, kết quả, lỗi ngắn; KHÔNG lưu nội dung văn bản / kết quả.
--    Quản trị hệ thống đọc; chỉ Edge Function (service_role) ghi. Văn bản tải lên chỉ đọc trên trình duyệt và đi qua Edge Function — không lưu.
-- 3. Hàm chỉ service_role: ai_giu_luot (giữ một lượt trước khi gọi AI — khoá tư vấn nên hai yêu cầu cùng lúc không vượt giới hạn ngày giờ Việt Nam;
--    dòng DANG tính vào lượt; hết lượt → dòng TU_CHOI) và ai_xong_luot (ghi kết quả OK / LOI, token, thời gian), ai_du_lieu_hoc (mẫu việc đã gắn / bị
--    bỏ gợi ý của một mục tiêu — chỉ khi gui_noi_dung), ai_ghi_quy_tac (quy tắc AI soạn vào DE_XUAT → tự kiểm: từ khoá kl_ap_kiem_thu_quy_tac 0111;
--    từ loại trừ kl_ap_kiem_loai_tru — tắt khi nằm trong từ khoá của chính mục tiêu hoặc trúng việc đã gắn đúng mục tiêu → bật mức gợi ý hoặc tắt),
--    ai_can_hoc (mục tiêu chưa có quy tắc AI hoặc có phản hồi mới từ lần học trước). ai_toi: người gọi (Edge Function kiểm quyền bằng JWT người dùng).

CREATE TABLE "public"."cau_hinh_ai" (
  "id" integer PRIMARY KEY DEFAULT 1 CONSTRAINT "cau_hinh_ai_mot_dong" CHECK ("id" = 1),
  "nha_cung_cap" text NOT NULL DEFAULT 'anthropic' CONSTRAINT "cau_hinh_ai_ncc_check" CHECK ("nha_cung_cap" IN ('anthropic', 'openai', 'gemini', 'khac', 'gia_lap')),
  "mo_hinh" text NOT NULL DEFAULT 'claude-sonnet-5-5' CONSTRAINT "cau_hinh_ai_mo_hinh_check" CHECK ("mo_hinh" ~ '^[A-Za-z0-9._:/-]{2,100}$'),
  "dia_chi" text CONSTRAINT "cau_hinh_ai_dia_chi_check" CHECK ("dia_chi" ~ '^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?(/[A-Za-z0-9._~/-]*)?$' AND char_length("dia_chi") <= 200),
  "muc_suy_nghi" text NOT NULL DEFAULT 'medium' CONSTRAINT "cau_hinh_ai_muc_check" CHECK ("muc_suy_nghi" IN ('low', 'medium', 'high')),
  "bat" boolean NOT NULL DEFAULT true,
  "gui_noi_dung" boolean NOT NULL DEFAULT true,
  "gioi_han_ngay" integer NOT NULL DEFAULT 300 CONSTRAINT "cau_hinh_ai_ngay_check" CHECK ("gioi_han_ngay" BETWEEN 1 AND 100000),
  "gioi_han_nguoi" integer NOT NULL DEFAULT 40 CONSTRAINT "cau_hinh_ai_nguoi_check" CHECK ("gioi_han_nguoi" BETWEEN 1 AND 10000),
  "cap_nhat_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "cap_nhat_luc" timestamp with time zone,
  CONSTRAINT "cau_hinh_ai_khac_check" CHECK ("nha_cung_cap" <> 'khac' OR "dia_chi" IS NOT NULL)
);
INSERT INTO "public"."cau_hinh_ai" DEFAULT VALUES;
ALTER TABLE "public"."cau_hinh_ai" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."cau_hinh_ai" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."cau_hinh_ai" TO "authenticated";
CREATE POLICY "cau_hinh_ai_select" ON "public"."cau_hinh_ai" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

CREATE TABLE "public"."nhat_ky_ai" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "nguoi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "hanh_dong" text NOT NULL CONSTRAINT "nhat_ky_ai_hanh_dong_check" CHECK ("hanh_dong" IN ('DOC_VAN_BAN', 'SOAN_QUY_TAC', 'HOC_DEM', 'KIEM_TRA')),
  "nha_cung_cap" text, "mo_hinh" text, "token_vao" integer, "token_ra" integer, "thoi_gian_ms" integer, "so_trang" integer, "so_ky_tu" integer,
  "ket_qua" text NOT NULL CONSTRAINT "nhat_ky_ai_ket_qua_check" CHECK ("ket_qua" IN ('DANG', 'OK', 'LOI', 'TU_CHOI')),
  "loi" text CONSTRAINT "nhat_ky_ai_loi_check" CHECK (char_length("loi") <= 300)
);
CREATE INDEX "nhat_ky_ai_luc_idx" ON "public"."nhat_ky_ai" ("luc" DESC);
ALTER TABLE "public"."nhat_ky_ai" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."nhat_ky_ai" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."nhat_ky_ai" TO "authenticated";
CREATE POLICY "nhat_ky_ai_select_quan_tri" ON "public"."nhat_ky_ai" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_quyen_muc_tieu"()) = 'QUAN_TRI');

-- p: nha_cung_cap, mo_hinh, dia_chi, muc_suy_nghi, bat, gui_noi_dung, gioi_han_ngay, gioi_han_nguoi (khoá vắng = giữ nguyên).
CREATE FUNCTION "public"."qt_dat_cau_hinh_ai"("p" jsonb, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."cau_hinh_ai"; m jsonb; v_cu jsonb := '{}'; v_doi jsonb := '{}'; k text;
BEGIN
  IF "public"."kl_quyen_muc_tieu"() IS DISTINCT FROM 'QUAN_TRI' THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống mới đổi cấu hình trợ lý AI.' USING ERRCODE = '42501';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do thay đổi.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO c FROM "public"."cau_hinh_ai" WHERE "id" = 1 FOR UPDATE;
  m := to_jsonb(c) || (SELECT coalesce(jsonb_object_agg(key, value), '{}') FROM jsonb_each(coalesce("p", '{}'))
                       WHERE key IN ('nha_cung_cap', 'mo_hinh', 'dia_chi', 'muc_suy_nghi', 'bat', 'gui_noi_dung', 'gioi_han_ngay', 'gioi_han_nguoi'));
  IF m ->> 'nha_cung_cap' = 'gia_lap' THEN RAISE EXCEPTION 'Nhà cung cấp giả lập chỉ dùng khi kiểm thử cục bộ.' USING ERRCODE = '22023'; END IF;
  FOREACH k IN ARRAY ARRAY['nha_cung_cap', 'mo_hinh', 'dia_chi', 'muc_suy_nghi', 'bat', 'gui_noi_dung', 'gioi_han_ngay', 'gioi_han_nguoi'] LOOP
    IF (to_jsonb(c) -> k) IS DISTINCT FROM (m -> k) THEN v_cu := v_cu || jsonb_build_object(k, to_jsonb(c) -> k); v_doi := v_doi || jsonb_build_object(k, m -> k); END IF;
  END LOOP;
  IF v_doi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."cau_hinh_ai" SET "nha_cung_cap" = m ->> 'nha_cung_cap', "mo_hinh" = btrim(m ->> 'mo_hinh'), "dia_chi" = nullif(btrim(coalesce(m ->> 'dia_chi', '')), ''),
    "muc_suy_nghi" = m ->> 'muc_suy_nghi', "bat" = (m ->> 'bat')::boolean, "gui_noi_dung" = (m ->> 'gui_noi_dung')::boolean,
    "gioi_han_ngay" = (m ->> 'gioi_han_ngay')::numeric::integer, "gioi_han_nguoi" = (m ->> 'gioi_han_nguoi')::numeric::integer,
    "cap_nhat_boi" = "auth"."uid"(), "cap_nhat_luc" = now() WHERE "id" = 1;
  PERFORM "public"."nhat_ky_ghi"('cau_hinh_ai', 'cau_hinh_ai', jsonb_build_object('cu', v_cu, 'moi', v_doi, 'ly_do', btrim("p_ly_do")));
END;
$$;
REVOKE ALL ON FUNCTION "public"."qt_dat_cau_hinh_ai"(jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."qt_dat_cau_hinh_ai"(jsonb, text) TO "authenticated";

CREATE FUNCTION "public"."ai_toi"() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('id', a."id", 'vai', a."role_group", 'hoat_dong', NOT a."is_system" AND NOT coalesce(a."bi_khoa", false),
                            'quyen_muc_tieu', "public"."kl_quyen_muc_tieu"())
  FROM "public"."accounts" a WHERE a."id" = "auth"."uid"();
$$;
REVOKE ALL ON FUNCTION "public"."ai_toi"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ai_toi"() TO "authenticated";

CREATE FUNCTION "public"."ai_dem_luot"("p_nguoi" uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('ngay', count(*) FILTER (WHERE "ket_qua" <> 'TU_CHOI'), 'nguoi', count(*) FILTER (WHERE "ket_qua" <> 'TU_CHOI' AND "nguoi" = "p_nguoi"))
  FROM "public"."nhat_ky_ai" WHERE "luc" >= ("public"."kl_hom_nay"()::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh');
$$;

-- Giữ một lượt trước khi gọi AI (p_nguoi NULL = tác vụ hệ thống): → { id, duoc, ngay, nguoi, gioi_han_ngay, gioi_han_nguoi }. p: { so_trang, so_ky_tu }.
CREATE FUNCTION "public"."ai_giu_luot"("p_nguoi" uuid, "p_hanh_dong" text, "p" jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."cau_hinh_ai"; d jsonb; v_duoc boolean; v_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nhat_ky_ai_luot'));   -- tuần tự hoá đếm + ghi: không hai lượt cùng lọt qua giới hạn
  SELECT * INTO c FROM "public"."cau_hinh_ai" WHERE "id" = 1;
  d := "public"."ai_dem_luot"("p_nguoi");
  v_duoc := (d ->> 'ngay')::integer < c."gioi_han_ngay" AND (d ->> 'nguoi')::integer < c."gioi_han_nguoi";
  INSERT INTO "public"."nhat_ky_ai" ("nguoi", "hanh_dong", "nha_cung_cap", "mo_hinh", "so_trang", "so_ky_tu", "ket_qua", "loi")
  VALUES ("p_nguoi", "p_hanh_dong", c."nha_cung_cap", c."mo_hinh",
          CASE WHEN jsonb_typeof("p" -> 'so_trang') = 'number' THEN ("p" ->> 'so_trang')::numeric::integer END,
          CASE WHEN jsonb_typeof("p" -> 'so_ky_tu') = 'number' THEN ("p" ->> 'so_ky_tu')::numeric::integer END,
          CASE WHEN v_duoc THEN 'DANG' ELSE 'TU_CHOI' END, CASE WHEN v_duoc THEN NULL ELSE 'Hết lượt trong ngày' END)
  RETURNING "id" INTO v_id;
  RETURN d || jsonb_build_object('id', v_id, 'duoc', v_duoc, 'gioi_han_ngay', c."gioi_han_ngay", 'gioi_han_nguoi', c."gioi_han_nguoi");
END;
$$;
-- Ghi kết quả của lượt đã giữ: p { ket_qua OK | LOI, token_vao, token_ra, thoi_gian_ms, loi }. Lượt không xong (function dừng giữa chừng) giữ DANG — vẫn tính lượt.
CREATE FUNCTION "public"."ai_xong_luot"("p_id" bigint, "p" jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE "public"."nhat_ky_ai" SET "ket_qua" = CASE WHEN "p" ->> 'ket_qua' = 'OK' THEN 'OK' ELSE 'LOI' END,
    "token_vao" = CASE WHEN jsonb_typeof("p" -> 'token_vao') = 'number' THEN ("p" ->> 'token_vao')::numeric::integer END,
    "token_ra" = CASE WHEN jsonb_typeof("p" -> 'token_ra') = 'number' THEN ("p" ->> 'token_ra')::numeric::integer END,
    "thoi_gian_ms" = CASE WHEN jsonb_typeof("p" -> 'thoi_gian_ms') = 'number' THEN ("p" ->> 'thoi_gian_ms')::numeric::integer END,
    "loi" = left(nullif("p" ->> 'loi', ''), 300)
  WHERE "id" = "p_id" AND "ket_qua" = 'DANG';
$$;

-- Mẫu học cho một mục tiêu: việc đang tính mục tiêu này (người đã xác nhận: nguồn khác AI chưa xác nhận) và việc đã bỏ / không chọn gợi ý của nó.
CREATE FUNCTION "public"."ai_du_lieu_hoc"("p_ma" text, "p_gioi_han" integer DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d "public"."dm_muc_tieu"; v_gui boolean; v_dung jsonb := '[]'; v_bo jsonb := '[]'; n integer := least(greatest(coalesce("p_gioi_han", 30), 1), 60);
BEGIN
  SELECT * INTO d FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma";
  IF d."ma" IS NULL THEN RAISE EXCEPTION 'Không có mục tiêu "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  SELECT "gui_noi_dung" INTO v_gui FROM "public"."cau_hinh_ai" WHERE "id" = 1;
  IF coalesce(v_gui, false) THEN
    SELECT coalesce(jsonb_agg(x), '[]') INTO v_dung FROM (
      SELECT left(n2."noi_dung", 600) AS noi_dung, left(vb."trich_yeu", 300) AS trich_yeu, left(n2."san_pham_mo_ta", 200) AS san_pham, lv."ten" AS linh_vuc
      FROM "public"."nhiem_vu" n2 LEFT JOIN "public"."van_ban_giao_viec" vb ON vb."id" = n2."van_ban_id" LEFT JOIN "public"."dm_linh_vuc" lv ON lv."ma" = n2."linh_vuc_ma"
      WHERE EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n2."id" AND m."muc_tieu_ma" = d."ma")
         OR (NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n2."id")
             AND EXISTS (SELECT 1 FROM "public"."van_ban_muc_tieu" v WHERE v."van_ban_id" = n2."van_ban_id" AND v."muc_tieu_ma" = d."ma"))
      ORDER BY n2."created_at" DESC LIMIT n) x;
    SELECT coalesce(jsonb_agg(x), '[]') INTO v_bo FROM (
      SELECT DISTINCT ON (n2."id") left(n2."noi_dung", 600) AS noi_dung, left(vb."trich_yeu", 300) AS trich_yeu, q."gia_tri" AS quy_tac, p."ket_qua"
      FROM "public"."phan_hoi_goi_y" p JOIN "public"."quy_tac_muc_tieu" q ON q."id" = p."quy_tac_id" AND q."muc_tieu_ma" = d."ma"
      JOIN "public"."nhiem_vu" n2 ON n2."id" = p."nhiem_vu_id" LEFT JOIN "public"."van_ban_giao_viec" vb ON vb."id" = n2."van_ban_id"
      WHERE p."ket_qua" IN ('BO', 'BO_QUA') ORDER BY n2."id", p."luc" DESC LIMIT n) x;
  END IF;
  RETURN jsonb_build_object('muc_tieu', jsonb_build_object('ma', d."ma", 'nhom', d."nhom", 'ten', d."ten", 'ten_ngan', d."ten_ngan", 'mo_ta', d."mo_ta",
           'can_cu', d."can_cu", 'so_hieu', d."so_hieu", 'chi_tieu', d."chi_tieu"),
         'quy_tac', (SELECT coalesce(jsonb_agg(jsonb_build_object('loai', q."loai", 'gia_tri', q."gia_tri", 'muc', q."muc", 'trang_thai', q."trang_thai",
                      'hien', q."so_lan_hien", 'nhan', q."so_lan_nhan", 'bo', q."so_lan_bo") ORDER BY q."loai", q."gia_tri"), '[]')
                     FROM "public"."quy_tac_muc_tieu" q WHERE q."muc_tieu_ma" = d."ma"),
         'viec_dung', v_dung, 'viec_bo', v_bo, 'gui_noi_dung', coalesce(v_gui, false));
END;
$$;

-- Tự kiểm từ loại trừ DE_XUAT: nằm trong một từ khoá đang bật của chính mục tiêu (từ khoá đó không bao giờ còn khớp) hoặc trúng việc đã gắn đúng mục
-- tiêu → tắt; còn lại bật. Trả { tong, khop, xac_nhan, dung, trang_thai, ly_do } như kl_ap_kiem_thu_quy_tac.
CREATE FUNCTION "public"."kl_ap_kiem_loai_tru"("p_id" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q "public"."quy_tac_muc_tieu"; k jsonb; v_tt text := 'BAT'; v_ly text;
BEGIN
  SELECT * INTO q FROM "public"."quy_tac_muc_tieu" WHERE "id" = "p_id";
  k := "public"."kl_kiem_thu_quy_tac"("p_id");
  IF EXISTS (SELECT 1 FROM "public"."quy_tac_muc_tieu" x WHERE x."muc_tieu_ma" = q."muc_tieu_ma" AND x."loai" = 'TU_KHOA' AND x."trang_thai" = 'BAT'
             AND position(' ' || q."gia_tri_chuan" || ' ' IN ' ' || x."gia_tri_chuan" || ' ') > 0) THEN
    v_tt := 'TAT'; v_ly := 'Tự kiểm: từ loại trừ nằm trong từ khoá của chính mục tiêu';
  ELSIF (k ->> 'dung')::integer > 0 THEN
    v_tt := 'TAT'; v_ly := format('Tự kiểm: loại trừ cả %s việc đã gắn đúng mục tiêu', k ->> 'dung');
  ELSE v_ly := format('Tự kiểm: bật — khớp %s/%s việc, không trúng việc nào đã gắn mục tiêu', k ->> 'khop', k ->> 'tong');
  END IF;
  UPDATE "public"."quy_tac_muc_tieu" SET "trang_thai" = v_tt, "muc" = 'GOI_Y', "ghi_chu" = left(v_ly, 300), "cap_nhat_luc" = now(),
    "so_lan_hien" = 0, "so_lan_nhan" = 0, "so_lan_bo" = 0, "dem_tu" = now() WHERE "id" = "p_id" AND "trang_thai" = 'DE_XUAT';
  RETURN k || jsonb_build_object('trang_thai', v_tt, 'ly_do', v_ly);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ap_kiem_loai_tru"(uuid) FROM public, "anon", "authenticated";

-- p_ds: [{ loai: TU_KHOA | LOAI_TRU, gia_tri }] (tối đa 20). Mọi quy tắc vào DE_XUAT rồi tự kiểm (từ khoá / loại trừ — hai hàm riêng). Mỗi mục tiêu
-- giữ tối đa 40 quy tắc AI đang dùng, 120 kể cả đã tắt (bộ nhận diện, bảng quy tắc không phình dần theo số lần học đêm).
CREATE FUNCTION "public"."ai_ghi_quy_tac"("p_ma" text, "p_ds" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e jsonb; v text; v_id uuid; v_kt jsonb; v_kq jsonb := '[]'; v_them integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma" AND "dang_dung") THEN
    RAISE EXCEPTION 'Không có mục tiêu đang dùng "%".', "p_ma" USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof("p_ds") IS DISTINCT FROM 'array' OR jsonb_array_length("p_ds") > 20 THEN RAISE EXCEPTION 'Danh sách quy tắc không hợp lệ.' USING ERRCODE = '22023'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements("p_ds") LOOP
    BEGIN
      CONTINUE WHEN e ->> 'loai' NOT IN ('TU_KHOA', 'LOAI_TRU') OR (SELECT count(*) FILTER (WHERE "trang_thai" <> 'TAT') >= 40 OR count(*) >= 120
                                                                    FROM "public"."quy_tac_muc_tieu" WHERE "muc_tieu_ma" = "p_ma" AND "nguon" = 'AI');
      v := "public"."kl_kiem_gia_tri_quy_tac"(e ->> 'loai', e ->> 'gia_tri');
      v_id := NULL;
      INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "trang_thai", "nguon")
      VALUES ("p_ma", e ->> 'loai', v, 'GOI_Y', 'DE_XUAT', 'AI')
      ON CONFLICT ("muc_tieu_ma", "loai", "gia_tri_chuan") DO NOTHING RETURNING "id" INTO v_id;
      CONTINUE WHEN v_id IS NULL;
      v_them := v_them + 1;
      v_kt := CASE WHEN e ->> 'loai' = 'TU_KHOA' THEN "public"."kl_ap_kiem_thu_quy_tac"(v_id) ELSE "public"."kl_ap_kiem_loai_tru"(v_id) END;
      v_kq := v_kq || jsonb_build_array(jsonb_build_object('id', v_id, 'loai', e ->> 'loai', 'gia_tri', v) || v_kt);
      INSERT INTO "public"."dm_lich_su" ("nguoi", "nguoi_ghi_chu", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
      VALUES (NULL, 'trợ lý AI', 'quy_tac_muc_tieu', v_id::text, 'them', jsonb_build_object('muc_tieu_ma', "p_ma", 'loai', e ->> 'loai', 'gia_tri', v,
              'trang_thai', v_kt ->> 'trang_thai'), coalesce(v_kt ->> 'ly_do', 'Trợ lý AI đề xuất'));
    EXCEPTION WHEN invalid_parameter_value OR check_violation THEN NULL;   -- giá trị không hợp lệ: bỏ qua mục đó
    END;
  END LOOP;
  UPDATE "public"."dm_muc_tieu" SET "hoc_ai_luc" = now() WHERE "ma" = "p_ma";
  RETURN jsonb_build_object('them', v_them, 'quy_tac', v_kq);
END;
$$;

CREATE FUNCTION "public"."ai_can_hoc"("p_gioi_han" integer DEFAULT 10) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x."ma"), '[]') FROM (
    SELECT d."ma" FROM "public"."dm_muc_tieu" d
    WHERE d."dang_dung" AND (d."hoc_ai_luc" IS NULL
      OR EXISTS (SELECT 1 FROM "public"."phan_hoi_goi_y" p JOIN "public"."quy_tac_muc_tieu" q ON q."id" = p."quy_tac_id" WHERE q."muc_tieu_ma" = d."ma" AND p."luc" > d."hoc_ai_luc")
      OR EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."muc_tieu_ma" = d."ma" AND m."gan_luc" > d."hoc_ai_luc" AND m."nguon" IN ('CHON', 'RA_SOAT')))
    ORDER BY d."hoc_ai_luc" NULLS FIRST, d."thu_tu" LIMIT least(greatest(coalesce("p_gioi_han", 10), 1), 50)) x;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ai_dem_luot(uuid)', 'ai_giu_luot(uuid,text,jsonb)', 'ai_xong_luot(bigint,jsonb)', 'ai_du_lieu_hoc(text,integer)',
                           'ai_ghi_quy_tac(text,jsonb)', 'ai_can_hoc(integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
