-- 0110 (v3.25): bộ nhận diện mục tiêu then chốt chạy trong CSDL (cùng kết quả cho Giao việc, ngăn chi tiết, nhập Excel, rà soát) và gắn có nguồn.
-- goi_y_muc_tieu(p): p = { van_ban_id, so_hieu_van_ban, trich_yeu, noi_dung, san_pham_mo_ta, nganh, linh_vuc }. Nguồn nhận diện theo thứ tự tin cậy:
--   văn bản đã gắn mục tiêu (tích sẵn) → số hiệu trong trích yếu / nội dung / mô tả sản phẩm (quy tắc SO_HIEU; số hiệu của chính văn bản giao việc
--   không tính) → lĩnh vực, ngành (LINH_VUC, NGANH) → từ khoá không phân biệt dấu (TU_KHOA; LOAI_TRU của cùng mục tiêu có mặt thì bỏ khớp từ khoá —
--   LOAI_TRU do AI soạn chỉ bỏ từ khoá mức gợi ý chưa khoá). Số hiệu không thuộc nhóm nào (KL/TW, CT/TW…) không vào so_hieu_moi.
--   Mức: tích sẵn khi theo văn bản hoặc có quy tắc mức TU_TICH khớp; còn lại gợi ý. Tối đa 10 mục tích sẵn (giới hạn gắn). Chỉ quy tắc BAT của mục
--   đang dùng. Kết quả: { goi_y: [{ ma, muc, ly_do: [{ loai, gia_tri, o }], quy_tac: [id] }], so_hieu_moi: [{ so_hieu, nhom, ve }] } — so_hieu_moi =
--   số hiệu đúng dạng một nhóm (mau_so_hieu) mà danh mục chưa có (giao diện mời tự thêm — them_muc_tieu_tu_dong 0108). SECURITY INVOKER: văn bản đọc
--   theo RLS. goi_y_muc_tieu_viec(ids): như trên cho các việc đã có (đọc theo RLS, tối đa 200) — ngăn chi tiết, rà soát; mục tích sẵn mà mọi quy tắc
--   căn cứ đã bị bỏ ở chính việc đó (phản hồi BO) hạ thành gợi ý. Số hiệu: phần chữ sau mỗi số hiệu tách riêng (không nuốt số hiệu kế tiếp).
-- gan_muc_tieu / gan_muc_tieu_van_ban thêm p_nguon (DEFAULT NULL — lời gọi hai tham số cũ vẫn chạy): { "<mã>": { nguon, ly_do } }, nguồn người gọi khai
-- được: CHON (mặc định), QUY_TAC, GOI_Y, AI, RA_SOAT; gắn sẵn có giữ nguồn cũ trừ khi p_nguon ghi lại; mục MỚI của việc mà văn bản đã gắn và p_nguon không
-- khai → chép nguồn, lý do của văn bản (kể cả EXCEL, GOP). Quyền như 0105 (thân hàm nguyên văn + nguồn).
-- Nhập Excel (trigger 0106): nguồn EXCEL; du_lieu.muc_tieu_nguon = { "<mã>": "QUY_TAC" | "GOI_Y" | "AI" } khi giao diện điền theo bộ nhận diện.
--   Dòng KHÔNG ghi mục tiêu mà du_lieu.tu_gan_muc_tieu = true (ô "Tự gắn mục tiêu then chốt" của bản xem trước, mặc định bật): kl_tu_gan_muc_tieu_viec
--   chạy bộ nhận diện trên việc vừa tạo (văn bản, nội dung, mô tả sản phẩm, ngành, lĩnh vực) — lấy mục mức tích sẵn, số hiệu chưa có thì tự thêm
--   vào danh mục (them_muc_tieu_tu_dong, lỗi từng số hiệu bỏ qua); không có gì ngoài mục tiêu của văn bản → không gắn riêng (việc tính theo văn bản);
--   còn lại gắn riêng: mọi mục của văn bản (giữ nguồn, lý do của văn bản) + mục mới nguồn QUY_TAC (lý do = căn cứ đầu tiên; tổng ≤ 10), lịch sử excel.
-- gan_muc_tieu: mục đã ngừng dùng mà văn bản của việc còn gắn vẫn giữ được khi gắn riêng (như mục việc đã có) — không làm hỏng lần gắn thêm.

CREATE FUNCTION "public"."goi_y_muc_tieu"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_vb uuid; v_tho text; v_rieng text := "public"."kl_khoa_so_hieu"("p" ->> 'so_hieu_van_ban');
  t_ty text := ' ' || "public"."kl_chuan_chu"("p" ->> 'trich_yeu') || ' '; t_nd text := ' ' || "public"."kl_chuan_chu"("p" ->> 'noi_dung') || ' ';
  t_sp text := ' ' || "public"."kl_chuan_chu"("p" ->> 'san_pham_mo_ta') || ' ';
  v_nganh text := nullif("p" ->> 'nganh', ''); v_lv text := nullif("p" ->> 'linh_vuc', '');
  v_kq jsonb := '{}'; v_moi jsonb := '[]'; m text[]; v_sh text; v_khoa text; v_khoa_da text[] := '{}'; v_ve text; r record; v_o text; v_ra jsonb;
  c_sh constant text := '([0-9]{1,5})\s*[-–—]\s*(NQ|CTr|CTR|KL|CT)\s*/\s*(TW|TU)(?![A-Za-z])'; v_sau text[]; v_i integer := 0;
BEGIN
  BEGIN v_vb := nullif("p" ->> 'van_ban_id', '')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_vb := NULL; END;
  v_tho := concat_ws(E'\n', "p" ->> 'trich_yeu', "p" ->> 'noi_dung', "p" ->> 'san_pham_mo_ta');
  -- Văn bản đã gắn mục tiêu (RLS: chỉ văn bản người gọi thấy)
  FOR r IN SELECT v."muc_tieu_ma" AS ma FROM "public"."van_ban_muc_tieu" v JOIN "public"."dm_muc_tieu" d ON d."ma" = v."muc_tieu_ma" AND d."dang_dung"
           WHERE v_vb IS NOT NULL AND v."van_ban_id" = v_vb LOOP
    v_kq := v_kq || jsonb_build_object(r.ma, jsonb_build_object('tich', true, 'ly_do', jsonb_build_array(jsonb_build_object('loai', 'VAN_BAN', 'gia_tri', '', 'o', 'van_ban')), 'quy_tac', '[]'::jsonb));
  END LOOP;
  -- Số hiệu nhắc trong chữ (không tính số hiệu của chính văn bản giao việc). Phần chữ sau mỗi số hiệu (tới số hiệu kế tiếp, dấu ; hoặc xuống dòng,
  -- tối đa 220 ký tự) lấy riêng — không nuốt số hiệu thứ hai trong cùng câu ("Nghị quyết 57-NQ/TW và Nghị quyết 59-NQ/TW").
  v_sau := regexp_split_to_array(v_tho, c_sh);
  FOR m IN SELECT regexp_matches(v_tho, c_sh, 'g') LOOP
    v_i := v_i + 1;
    v_sh := "public"."kl_chuan_so_hieu"(m[1] || '-' || m[2] || '/' || m[3]); v_khoa := "public"."kl_khoa_so_hieu"(v_sh);
    CONTINUE WHEN v_khoa IS NULL OR v_khoa = v_rieng OR v_khoa = ANY (v_khoa_da);
    v_khoa_da := v_khoa_da || v_khoa;
    FOR r IN SELECT q."id", q."muc_tieu_ma" AS ma, q."muc", q."gia_tri" FROM "public"."quy_tac_muc_tieu" q JOIN "public"."dm_muc_tieu" d ON d."ma" = q."muc_tieu_ma" AND d."dang_dung"
             WHERE q."loai" = 'SO_HIEU' AND q."trang_thai" = 'BAT' AND "public"."kl_khoa_so_hieu"(q."gia_tri") = v_khoa LOOP
      v_o := CASE WHEN position(lower(r.gia_tri) IN lower(replace(coalesce("p" ->> 'trich_yeu', ''), ' ', ''))) > 0 THEN 'trich_yeu'
                  WHEN position(lower(r.gia_tri) IN lower(replace(coalesce("p" ->> 'noi_dung', ''), ' ', ''))) > 0 THEN 'noi_dung' ELSE 'san_pham' END;
      v_kq := "public"."kl_goi_y_cong"(v_kq, r.ma, r.muc = 'TU_TICH', jsonb_build_object('loai', 'SO_HIEU', 'gia_tri', r.gia_tri, 'o', v_o), r.id);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d WHERE d."so_hieu" IS NOT NULL AND "public"."kl_khoa_so_hieu"(d."so_hieu") = v_khoa) THEN
      v_ve := nullif(btrim(regexp_replace(substring(left(split_part(split_part(coalesce(v_sau[v_i + 1], ''), ';', 1), E'\n', 1), 220) FROM '([Vv][ềeÊêỀ]\s.*)$'),   -- bỏ đuôi "… và Kết luận số"
        '(\s*,|\s+và)\s+(các\s+)?([Nn]ghị quyết|[Kk]ết luận|[Cc]hỉ thị|[Cc]hương trình|[Qq]uyết định|[Tt]hông báo|[Kk]ế hoạch|[Qq]uy định|[Hh]ướng dẫn)(\s+số)?\s*$', '')), '');
      v_moi := v_moi || coalesce((SELECT jsonb_build_array(jsonb_build_object('so_hieu', v_sh, 'nhom', n."ma", 've', left(v_ve, 200))) FROM "public"."dm_nhom_muc_tieu" n   -- không nhóm nào
        WHERE n."dang_dung" AND n."mau_so_hieu" IS NOT NULL AND v_sh ~ n."mau_so_hieu" ORDER BY n."thu_tu" LIMIT 1), '[]');   -- (KL/TW, CT/TW…) → bỏ qua số hiệu đó
    END IF;
  END LOOP;
  -- Lĩnh vực, ngành
  FOR r IN SELECT q."id", q."muc_tieu_ma" AS ma, q."muc", q."loai", q."gia_tri" FROM "public"."quy_tac_muc_tieu" q JOIN "public"."dm_muc_tieu" d ON d."ma" = q."muc_tieu_ma" AND d."dang_dung"
           WHERE q."trang_thai" = 'BAT' AND ((q."loai" = 'LINH_VUC' AND q."gia_tri" = v_lv) OR (q."loai" = 'NGANH' AND q."gia_tri" = v_nganh)) LOOP
    v_kq := "public"."kl_goi_y_cong"(v_kq, r.ma, r.muc = 'TU_TICH', jsonb_build_object('loai', r.loai, 'gia_tri', r.gia_tri, 'o', lower(r.loai)), r.id);
  END LOOP;
  -- Từ khoá: lọc khớp ngay trong truy vấn (vòng lặp chỉ chạy trên quy tắc khớp); từ loại trừ của mục có mặt thì bỏ khớp — loại trừ do AI soạn chỉ chặn
  -- từ khoá mức gợi ý chưa khoá (AI không làm mất mục tích sẵn). Các ô đã chuẩn hoá một dấu cách, nối nhau bằng hai dấu cách: cụm từ không khớp vắt qua ô.
  FOR r IN SELECT q."id", q."muc_tieu_ma" AS ma, q."muc", q."gia_tri", CASE WHEN position(' ' || q."gia_tri_chuan" || ' ' IN t_nd) > 0 THEN 'noi_dung'
             WHEN position(' ' || q."gia_tri_chuan" || ' ' IN t_sp) > 0 THEN 'san_pham' WHEN position(' ' || q."gia_tri_chuan" || ' ' IN t_ty) > 0 THEN 'trich_yeu' END AS o
           FROM "public"."quy_tac_muc_tieu" q JOIN "public"."dm_muc_tieu" d ON d."ma" = q."muc_tieu_ma" AND d."dang_dung"
           WHERE q."loai" = 'TU_KHOA' AND q."trang_thai" = 'BAT' AND position(' ' || q."gia_tri_chuan" || ' ' IN t_ty || t_nd || t_sp) > 0
             AND NOT EXISTS (SELECT 1 FROM "public"."quy_tac_muc_tieu" x WHERE x."muc_tieu_ma" = q."muc_tieu_ma" AND x."loai" = 'LOAI_TRU' AND x."trang_thai" = 'BAT'
                             AND (x."nguon" <> 'AI' OR (q."muc" = 'GOI_Y' AND NOT q."khoa")) AND position(' ' || x."gia_tri_chuan" || ' ' IN t_ty || t_nd || t_sp) > 0) LOOP
    CONTINUE WHEN r.o IS NULL;
    v_kq := "public"."kl_goi_y_cong"(v_kq, r.ma, r.muc = 'TU_TICH', jsonb_build_object('loai', 'TU_KHOA', 'gia_tri', r.gia_tri, 'o', r.o), r.id);
  END LOOP;
  -- Sắp: tích sẵn trước, nhiều căn cứ trước, thứ tự danh mục; quá 10 mục tích sẵn → phần dư thành gợi ý
  SELECT coalesce(jsonb_agg(jsonb_build_object('ma', x.ma, 'muc', CASE WHEN x.tich AND x.hang <= 10 THEN 'TU_TICH' ELSE 'GOI_Y' END, 'ly_do', x.ly_do, 'quy_tac', x.quy_tac)
                  ORDER BY x.tich DESC, x.hang), '[]') INTO v_ra
  FROM (SELECT e.key AS ma, (e.value ->> 'tich')::boolean AS tich, e.value -> 'ly_do' AS ly_do, e.value -> 'quy_tac' AS quy_tac,
               row_number() OVER (ORDER BY (e.value ->> 'tich')::boolean DESC, jsonb_array_length(e.value -> 'ly_do') DESC, nm."thu_tu", d."thu_tu") AS hang
        FROM jsonb_each(v_kq) e JOIN "public"."dm_muc_tieu" d ON d."ma" = e.key JOIN "public"."dm_nhom_muc_tieu" nm ON nm."ma" = d."nhom") x;
  RETURN jsonb_build_object('goi_y', v_ra, 'so_hieu_moi', v_moi);
END;
$$;

-- Cộng một căn cứ vào kết quả của một mục (giữ cờ tích sẵn nếu đã có; không lặp căn cứ / quy tắc).
CREATE FUNCTION "public"."kl_goi_y_cong"("p_kq" jsonb, "p_ma" text, "p_tich" boolean, "p_ly_do" jsonb, "p_quy_tac" uuid) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT "p_kq" || jsonb_build_object("p_ma", jsonb_build_object(
    'tich', coalesce(("p_kq" -> "p_ma" ->> 'tich')::boolean, false) OR "p_tich",
    'ly_do', CASE WHEN coalesce("p_kq" -> "p_ma" -> 'ly_do', '[]') @> jsonb_build_array("p_ly_do") THEN "p_kq" -> "p_ma" -> 'ly_do'
                  ELSE coalesce("p_kq" -> "p_ma" -> 'ly_do', '[]') || jsonb_build_array("p_ly_do") END,
    'quy_tac', CASE WHEN coalesce("p_kq" -> "p_ma" -> 'quy_tac', '[]') @> jsonb_build_array("p_quy_tac") THEN "p_kq" -> "p_ma" -> 'quy_tac'
                    ELSE coalesce("p_kq" -> "p_ma" -> 'quy_tac', '[]') || jsonb_build_array("p_quy_tac") END));
$$;

-- Quy tắc mà người giao / người rà soát đã BỎ ở một việc (phan_hoi_goi_y kết quả BO — 0111; bảng không ai đọc thẳng): chỉ trả mã quy tắc.
CREATE FUNCTION "public"."kl_quy_tac_da_bo"("p_viec" uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg("quy_tac_id"), '{}') FROM "public"."phan_hoi_goi_y"
  WHERE "nhiem_vu_id" = "p_viec" AND "ket_qua" = 'BO' AND coalesce("public"."kl_thay_nhiem_vu"("p_viec"), false);
$$;

-- Việc đã có: mục tích sẵn mà mọi quy tắc căn cứ đều đã bị bỏ ở chính việc đó → hạ thành gợi ý (không tích lại điều người dùng đã bỏ — ngăn chi
-- tiết, rà soát chấp nhận hàng loạt).
CREATE FUNCTION "public"."goi_y_muc_tieu_viec"("p_ids" uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE r record; v jsonb := '{}'; v_g jsonb; v_bo uuid[];
BEGIN
  IF cardinality(coalesce("p_ids", '{}')) > 200 THEN RAISE EXCEPTION 'Mỗi lượt tối đa 200 việc.' USING ERRCODE = '22023'; END IF;
  FOR r IN SELECT n."id", n."van_ban_id", n."noi_dung", n."san_pham_mo_ta", n."nganh_ma", n."linh_vuc_ma", vb."so_ket_luan", vb."trich_yeu"
           FROM "public"."nhiem_vu" n LEFT JOIN "public"."van_ban_giao_viec" vb ON vb."id" = n."van_ban_id" WHERE n."id" = ANY ("p_ids") LOOP
    v_g := "public"."goi_y_muc_tieu"(jsonb_build_object('van_ban_id', r.van_ban_id, 'so_hieu_van_ban', r.so_ket_luan,
      'trich_yeu', r.trich_yeu, 'noi_dung', r.noi_dung, 'san_pham_mo_ta', r.san_pham_mo_ta, 'nganh', r.nganh_ma, 'linh_vuc', r.linh_vuc_ma));
    v_bo := "public"."kl_quy_tac_da_bo"(r.id);
    IF cardinality(v_bo) > 0 THEN
      SELECT jsonb_set(v_g, '{goi_y}', coalesce(jsonb_agg(CASE WHEN t.g ->> 'muc' = 'TU_TICH' AND jsonb_array_length(t.g -> 'quy_tac') > 0
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.g -> 'quy_tac') q WHERE NOT (q::uuid = ANY (v_bo)))
          THEN jsonb_set(t.g, '{muc}', '"GOI_Y"') ELSE t.g END ORDER BY t.i), '[]'))
      INTO v_g FROM jsonb_array_elements(v_g -> 'goi_y') WITH ORDINALITY AS t(g, i);
    END IF;
    v := v || jsonb_build_object(r.id, v_g);
  END LOOP;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_quy_tac_da_bo"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_quy_tac_da_bo"(uuid) TO "authenticated";   -- goi_y_muc_tieu_viec là SECURITY INVOKER
REVOKE ALL ON FUNCTION "public"."kl_goi_y_cong"(jsonb, text, boolean, jsonb, uuid) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_goi_y_cong"(jsonb, text, boolean, jsonb, uuid) TO "authenticated";   -- goi_y_muc_tieu là SECURITY INVOKER
REVOKE ALL ON FUNCTION "public"."goi_y_muc_tieu"(jsonb), "public"."goi_y_muc_tieu_viec"(uuid[]) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."goi_y_muc_tieu"(jsonb), "public"."goi_y_muc_tieu_viec"(uuid[]) TO "authenticated";

-- Nguồn hợp lệ do người gọi khai (EXCEL, GOP chỉ hệ thống ghi).
CREATE FUNCTION "public"."kl_nguon_gan"("p_nguon" jsonb, "p_ma" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN "p_nguon" -> "p_ma" ->> 'nguon' IN ('CHON', 'QUY_TAC', 'GOI_Y', 'AI', 'RA_SOAT') THEN "p_nguon" -> "p_ma" ->> 'nguon' ELSE 'CHON' END;
$$;
CREATE FUNCTION "public"."kl_ly_do_gan"("p_nguon" jsonb, "p_ma" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT left(nullif(btrim(coalesce("p_nguon" -> "p_ma" ->> 'ly_do', '')), ''), 300); $$;
REVOKE ALL ON FUNCTION "public"."kl_nguon_gan"(jsonb, text), "public"."kl_ly_do_gan"(jsonb, text) FROM public, "anon", "authenticated";

DROP FUNCTION "public"."gan_muc_tieu"(uuid, text[]);
CREATE FUNCTION "public"."gan_muc_tieu"("p_id" uuid, "p_ma" text[], "p_nguon" jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_cu text[]; v_moi text[];
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR v_me IS NULL OR NOT (coalesce("public"."kl_la_tang_giao"(v), false)
       OR (coalesce("public"."me_role"() IN ('A1', 'A2'), false) AND coalesce("public"."kl_lanh_dao_pham_vi"(v."id"), false))) THEN
    RAISE EXCEPTION 'Chỉ người giao việc, người nhập việc hoặc lãnh đạo phụ trách mới gắn mục tiêu then chốt.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg("muc_tieu_ma" ORDER BY "muc_tieu_ma"), '{}'::text[]) INTO v_cu FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = v."id";
  v_moi := "public"."kl_chuan_muc_tieu"("p_ma", v_cu || ARRAY(SELECT "muc_tieu_ma" FROM "public"."van_ban_muc_tieu" WHERE "van_ban_id" = v."van_ban_id"));
  UPDATE "public"."nhiem_vu_muc_tieu" SET "nguon" = "public"."kl_nguon_gan"("p_nguon", "muc_tieu_ma"), "ly_do" = "public"."kl_ly_do_gan"("p_nguon", "muc_tieu_ma")
  WHERE "nhiem_vu_id" = v."id" AND "muc_tieu_ma" = ANY (v_moi) AND coalesce("p_nguon", '{}') ? "muc_tieu_ma";
  IF v_moi = v_cu THEN RETURN; END IF;
  DELETE FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = v."id" AND NOT ("muc_tieu_ma" = ANY (v_moi));
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "nguon", "ly_do")   -- mục của văn bản không khai nguồn: chép nguồn của văn bản
  SELECT v."id", x, v_me, CASE WHEN b."muc_tieu_ma" IS NULL OR coalesce("p_nguon", '{}') ? x THEN "public"."kl_nguon_gan"("p_nguon", x) ELSE b."nguon" END,
         CASE WHEN b."muc_tieu_ma" IS NULL OR coalesce("p_nguon", '{}') ? x THEN "public"."kl_ly_do_gan"("p_nguon", x) ELSE coalesce(b."ly_do", 'theo mục tiêu của văn bản') END
  FROM unnest(v_moi) x LEFT JOIN "public"."van_ban_muc_tieu" b ON b."van_ban_id" = v."van_ban_id" AND b."muc_tieu_ma" = x ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me, 'gan_muc_tieu', "public"."kl_ten_muc_tieu"(v_cu),
          CASE WHEN cardinality(v_moi) = 0 THEN 'Bỏ gắn riêng mục tiêu then chốt — tính theo văn bản'
               ELSE 'Gắn mục tiêu then chốt: ' || "public"."kl_ten_muc_tieu"(v_moi) END, 'app');
END;
$$;

DROP FUNCTION "public"."gan_muc_tieu_van_ban"(uuid, text[]);
CREATE FUNCTION "public"."gan_muc_tieu_van_ban"("p_van_ban" uuid, "p_ma" text[], "p_nguon" jsonb DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."van_ban_giao_viec"; v_me uuid := "auth"."uid"(); v_vai text := coalesce("public"."me_role"(), 'A0'); v_cu text[]; v_moi text[]; v_n integer := 0;
        v_duoc boolean;
BEGIN
  SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "id" = "p_van_ban" FOR UPDATE;
  v_duoc := v."id" IS NOT NULL AND v_me IS NOT NULL AND v_vai <> 'A0'
    AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v_me AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false))
    AND (coalesce("public"."me_is_chief"(), false)
         OR (coalesce(v."tao_boi" = v_me, false) AND coalesce(v."id" IN (SELECT "public"."kl_van_ban_thay_duoc"()), false))
         OR (v_vai IN ('A1', 'A2') AND EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id")
             AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id" AND NOT coalesce("public"."kl_thay_nhiem_vu"(n."id"), false))));
  IF NOT coalesce(v_duoc, false) THEN
    RAISE EXCEPTION 'Chỉ người nhập văn bản, Chánh Văn phòng hoặc lãnh đạo phụ trách mọi nhiệm vụ của văn bản mới gắn mục tiêu cho văn bản.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg("muc_tieu_ma" ORDER BY "muc_tieu_ma"), '{}'::text[]) INTO v_cu FROM "public"."van_ban_muc_tieu" WHERE "van_ban_id" = v."id";
  v_moi := "public"."kl_chuan_muc_tieu"("p_ma", v_cu);
  UPDATE "public"."van_ban_muc_tieu" SET "nguon" = "public"."kl_nguon_gan"("p_nguon", "muc_tieu_ma"), "ly_do" = "public"."kl_ly_do_gan"("p_nguon", "muc_tieu_ma")
  WHERE "van_ban_id" = v."id" AND "muc_tieu_ma" = ANY (v_moi) AND coalesce("p_nguon", '{}') ? "muc_tieu_ma";
  IF v_moi = v_cu THEN RETURN 0; END IF;
  DELETE FROM "public"."van_ban_muc_tieu" WHERE "van_ban_id" = v."id" AND NOT ("muc_tieu_ma" = ANY (v_moi));
  INSERT INTO "public"."van_ban_muc_tieu" ("van_ban_id", "muc_tieu_ma", "gan_boi", "nguon", "ly_do")
  SELECT v."id", x, v_me, "public"."kl_nguon_gan"("p_nguon", x), "public"."kl_ly_do_gan"("p_nguon", x) FROM unnest(v_moi) x ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", v_me, 'gan_muc_tieu', "public"."kl_ten_muc_tieu"(v_cu),
         format('Văn bản %s %s', coalesce(v."so_ket_luan", ''), CASE WHEN cardinality(v_moi) = 0 THEN 'bỏ mục tiêu then chốt'
           ELSE 'gắn mục tiêu then chốt: ' || "public"."kl_ten_muc_tieu"(v_moi) END), 'app'
  FROM "public"."nhiem_vu" n
  WHERE n."van_ban_id" = v."id" AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n."id");
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION "public"."gan_muc_tieu"(uuid, text[], jsonb), "public"."gan_muc_tieu_van_ban"(uuid, text[], jsonb) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."gan_muc_tieu"(uuid, text[], jsonb), "public"."gan_muc_tieu_van_ban"(uuid, text[], jsonb) TO "authenticated";

-- Căn cứ (một phần tử ly_do của goi_y_muc_tieu) → câu ngắn, cùng cách viết với giao diện (lib/kl/goi-y-muc-tieu.js moTaLyDo).
CREATE FUNCTION "public"."kl_mo_ta_ly_do"("p" jsonb) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT left(CASE "p" ->> 'loai'
    WHEN 'VAN_BAN' THEN 'theo mục tiêu của văn bản'
    WHEN 'SO_HIEU' THEN 'số hiệu ' || ("p" ->> 'gia_tri') || ' trong ' || CASE "p" ->> 'o' WHEN 'trich_yeu' THEN 'trích yếu văn bản' WHEN 'san_pham' THEN 'mô tả sản phẩm' ELSE 'nội dung' END
    WHEN 'TU_KHOA' THEN '“' || ("p" ->> 'gia_tri') || '” trong ' || CASE "p" ->> 'o' WHEN 'trich_yeu' THEN 'trích yếu văn bản' WHEN 'san_pham' THEN 'mô tả sản phẩm' ELSE 'nội dung' END
    WHEN 'LINH_VUC' THEN 'lĩnh vực ' || coalesce((SELECT "ten" FROM "public"."dm_linh_vuc" WHERE "ma" = "p" ->> 'gia_tri'), "p" ->> 'gia_tri')
    WHEN 'NGANH' THEN 'ngành ' || coalesce((SELECT "ten" FROM "public"."dm_nganh" WHERE "ma" = "p" ->> 'gia_tri'), "p" ->> 'gia_tri')
    ELSE nullif("p" ->> 'gia_tri', '') END, 300);
$$;

-- Tự gắn khi nhập Excel (gọi từ trigger, quyền của trigger): → số mục đã gắn (0 = không gắn riêng).
CREATE FUNCTION "public"."kl_tu_gan_muc_tieu_viec"("p_id" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nhiem_vu"; v "public"."van_ban_giao_viec"; kq jsonb; g jsonb; v_vb text[]; v_them text[] := '{}'; v_ly jsonb := '{}'; r jsonb; v_n integer;
BEGIN
  SELECT * INTO n FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF n."id" IS NULL OR EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = n."id") THEN RETURN 0; END IF;
  SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "id" = n."van_ban_id";
  kq := "public"."goi_y_muc_tieu"(jsonb_build_object('van_ban_id', n."van_ban_id", 'so_hieu_van_ban', v."so_ket_luan", 'trich_yeu', v."trich_yeu",
          'noi_dung', n."noi_dung", 'san_pham_mo_ta', n."san_pham_mo_ta", 'nganh', n."nganh_ma", 'linh_vuc', n."linh_vuc_ma"));
  -- Mọi mục của văn bản (kể cả mục đã ngừng dùng — việc đang tính theo các mục đó)
  SELECT coalesce(array_agg(m."muc_tieu_ma" ORDER BY m."muc_tieu_ma"), '{}') INTO v_vb FROM "public"."van_ban_muc_tieu" m WHERE m."van_ban_id" = n."van_ban_id";
  FOR g IN SELECT x FROM jsonb_array_elements(coalesce(kq -> 'goi_y', '[]')) x WHERE x ->> 'muc' = 'TU_TICH' AND NOT (x ->> 'ma' = ANY (v_vb)) LOOP
    v_them := v_them || (g ->> 'ma'); v_ly := v_ly || jsonb_build_object(g ->> 'ma', "public"."kl_mo_ta_ly_do"(g -> 'ly_do' -> 0));
  END LOOP;
  FOR g IN SELECT x FROM jsonb_array_elements(CASE WHEN jsonb_typeof(kq -> 'so_hieu_moi') = 'array' THEN kq -> 'so_hieu_moi' ELSE '[]' END) x LOOP
    BEGIN
      r := "public"."them_muc_tieu_tu_dong"(g ->> 'so_hieu', g ->> 've');
      IF r ->> 'ma' IS NOT NULL AND NOT (r ->> 'ma' = ANY (v_them || v_vb)) THEN
        v_them := v_them || (r ->> 'ma');
        v_ly := v_ly || jsonb_build_object(r ->> 'ma', left('số hiệu ' || (g ->> 'so_hieu') || ' trong nội dung' || coalesce(' — ' || (g ->> 've'), ''), 300));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;   -- số hiệu không thêm được (sai dạng, ngừng dùng, quá hạn mức…): bỏ qua, không làm hỏng lô nhập
    END;
  END LOOP;
  v_them := v_them[1:greatest(0, 10 - cardinality(v_vb))];
  IF cardinality(v_them) = 0 THEN RETURN 0; END IF;   -- không có gì ngoài mục tiêu của văn bản: việc tính theo văn bản
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "nguon", "ly_do")
  SELECT n."id", m."muc_tieu_ma", "auth"."uid"(), m."nguon", coalesce(m."ly_do", 'theo mục tiêu của văn bản') FROM "public"."van_ban_muc_tieu" m WHERE m."van_ban_id" = n."van_ban_id"
  UNION ALL
  SELECT n."id", x, "auth"."uid"(), 'QUY_TAC', v_ly ->> x FROM unnest(v_them) x WHERE EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d WHERE d."ma" = x AND d."dang_dung")
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES (n."id", "auth"."uid"(), 'gan_muc_tieu', NULL, 'Gắn mục tiêu then chốt (nhập Excel, tự nhận diện): ' || "public"."kl_ten_muc_tieu"(v_vb || v_them), 'excel');
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_mo_ta_ly_do"(jsonb), "public"."kl_tu_gan_muc_tieu_viec"(uuid) FROM public, "anon", "authenticated";

-- Nhập Excel (bản 0106 + nguồn + tự gắn khi dòng không ghi mục tiêu)
CREATE OR REPLACE FUNCTION "public"."kl_dong_nhap_gan_muc_tieu"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text[]; v_ng jsonb;
BEGIN
  IF NEW."nhiem_vu_id" IS NULL OR NEW."ket_qua" NOT IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU') THEN RETURN NULL; END IF;
  IF jsonb_typeof(NEW."du_lieu" -> 'muc_tieu_ma') IS DISTINCT FROM 'array' THEN
    IF NEW."du_lieu" ->> 'tu_gan_muc_tieu' = 'true' THEN PERFORM "public"."kl_tu_gan_muc_tieu_viec"(NEW."nhiem_vu_id"); END IF;
    RETURN NULL;
  END IF;
  SELECT (array_agg(DISTINCT d."ma" ORDER BY d."ma"))[1:10] INTO v_ma
  FROM jsonb_array_elements_text(NEW."du_lieu" -> 'muc_tieu_ma') x(ma) JOIN "public"."dm_muc_tieu" d ON d."ma" = btrim(x.ma) AND d."dang_dung";
  IF v_ma IS NULL OR cardinality(v_ma) = 0 THEN RETURN NULL; END IF;
  v_ng := CASE WHEN jsonb_typeof(NEW."du_lieu" -> 'muc_tieu_nguon') = 'object' THEN NEW."du_lieu" -> 'muc_tieu_nguon' ELSE '{}' END;
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi", "nguon")
  SELECT NEW."nhiem_vu_id", u, "auth"."uid"(), CASE WHEN v_ng ->> u IN ('QUY_TAC', 'GOI_Y', 'AI') THEN v_ng ->> u ELSE 'EXCEL' END FROM unnest(v_ma) u ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (NEW."nhiem_vu_id", "auth"."uid"(), 'gan_muc_tieu', NULL, 'Gắn mục tiêu then chốt (nhập Excel): ' || "public"."kl_ten_muc_tieu"(v_ma), 'excel');
  RETURN NULL;
END;
$$;

-- ---- Danh mục cho giao diện (bản 0105 + nhóm, số hiệu, trạng thái, khối của lĩnh vực) ----
CREATE OR REPLACE FUNCTION "public"."kl_danh_muc"() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nganh', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "khoi_ma" FROM "public"."dm_nganh") x),
    'linhVuc', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "nganh_ma", "ten", "thu_tu", "khoi_ma" FROM "public"."dm_linh_vuc") x),
    'donVi', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "trong_van_phong", "phong" FROM "public"."dm_don_vi") x),
    'sanPham', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_san_pham") x),
    'cap', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_cap") x),
    'loaiThoiHan', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han") x),
    'tienDo', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_tien_do") x),
    'nguonNhiemVu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "dang_dung" FROM "public"."dm_nguon_nhiem_vu") x),
    'khoi', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "dang_dung" FROM "public"."dm_khoi_linh_vuc") x),
    'nhomMucTieu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "tab", "thu_tu", "dang_dung", "mau_so_hieu" FROM "public"."dm_nhom_muc_tieu") x),
    'mucTieu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "nhom", "ten", "ten_ngan", "mo_ta", "can_cu", "chi_tieu", "thu_tu", "dang_dung",
                "so_hieu", "trang_thai", "nguon_them", "gop_vao", "tao_boi" FROM "public"."dm_muc_tieu") x),
    'cauHinh', (SELECT coalesce(jsonb_object_agg("khoa", "gia_tri"), '{}') FROM "public"."kl_cau_hinh"));
$$;
