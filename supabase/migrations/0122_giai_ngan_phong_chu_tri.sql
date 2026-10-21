-- 0122 (v3.28, rà soát độc lập lần 3 ngày 21/10/2026 — 0121 đã commit nên sửa bằng tệp mới): thay gn_gan_nhiem_vu, gn_ghi_ky, gn_xoa_ky.
-- 1. Chủ trì của việc gồm cả Trưởng phòng (A2) của phòng chủ trì khi việc giao cho phòng, chưa giao cán bộ (owner_tai_khoan trống — kiểu Thường trực, Phó
--    Chánh VP giao cho phòng): không tự đặt / hạ mục tiêu, không bỏ việc cấp trên gắn. Chánh Văn phòng (và tài khoản toàn quyền — me_is_chief) là cấp cao
--    nhất của Văn phòng: vẫn đặt được mục tiêu cho việc mình chủ trì.
-- 2. Mục tiêu chỉ kế thừa trong cùng một kiểu theo dõi: đổi "Số liệu toàn tỉnh" ⇄ nguồn vốn / chủ đầu tư không mang mục tiêu cũ sang (trước đây đổi việc toàn
--    tỉnh mục tiêu 60% sang chủ đầu tư mang theo 60% rồi bị chặn "đổi mục tiêu" dù người dùng không đổi gì).
-- 3. gn_xoa_ky khoá theo năm như gn_ghi_ky (xoá và ghi lại cùng kỳ cùng lúc không còn để lại diễn biến mà không có kỳ / lỗi kỹ thuật); gn_ghi_ky: cập nhật
--    không trúng dòng nào thì chèn mới.
-- Phần còn lại giữ nguyên văn 0121.

CREATE OR REPLACE FUNCTION "public"."gn_gan_nhiem_vu"("p_nv" uuid, "p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v "public"."nhiem_vu"; c "public"."gn_nhiem_vu"; m "public"."gn_nhiem_vu"; v_loai text := nullif(btrim(coalesce("p" ->> 'loai', '')), '');
  v_uid uuid := "auth"."uid"(); v_mac_pt numeric; v_mac_ngay date; v_khac text; v_lanh_dao boolean; v_tu_sua boolean; v_rieng boolean;
  v_chu_tri boolean; v_cung_kieu boolean;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nv";
  IF v."id" IS NULL OR NOT "public"."kl_nguoi_nhap"() THEN
    RAISE EXCEPTION 'Không có nhiệm vụ này hoặc tài khoản không được ghi.' USING ERRCODE = '42501';
  END IF;
  IF v_loai IS NOT NULL AND v_loai NOT IN ('TOAN_TINH', 'NGUON', 'CHU_DAU_TU') THEN
    RAISE EXCEPTION 'Loại theo dõi giải ngân không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gn_nhiem_vu:' || "p_nv"::text, 0));   -- hai người sửa cùng việc: người sau đọc bản người trước vừa ghi
  SELECT * INTO c FROM "public"."gn_nhiem_vu" WHERE "nhiem_vu_id" = "p_nv";
  v_rieng := coalesce(c."loai" IN ('NGUON', 'CHU_DAU_TU'), false);   -- việc đang gắn nguồn vốn / chủ đầu tư
  -- Chủ trì của việc: tài khoản chủ trì; việc giao cho phòng (chưa giao cán bộ) — Trưởng phòng của phòng đó.
  v_chu_tri := coalesce(v."owner_tai_khoan" = v_uid OR (v."owner_tai_khoan" IS NULL AND "public"."me_role"() = 'A2'
    AND "public"."kl_phong_owner"(NULL, v."owner_don_vi_ma") = "public"."me_dept"()), false);
  -- Lãnh đạo của việc: lãnh đạo trong phạm vi hoặc tầng giao — không phải người chủ trì (kể cả việc tự giao cho mình, 0085), trừ Chánh Văn phòng / toàn quyền.
  v_lanh_dao := coalesce((NOT v_chu_tri OR "public"."me_is_chief"()) AND ("public"."kl_duoc_chi_dao"(v."id") OR "public"."kl_la_tang_giao"(v)), false);
  -- Người đã tự gắn nguồn vốn / chủ đầu tư, mục tiêu đang mặc định: được tự sửa / bỏ việc gắn của mình. gan_boi NULL (tài khoản đã xoá) → không.
  v_tu_sua := coalesce(v_rieng AND c."gan_boi" = v_uid AND c."muc_tieu_pt" = 100 AND c."muc_tieu_ngay" = make_date(c."nam", 12, 31), false);
  IF v_loai = 'TOAN_TINH' OR c."loai" = 'TOAN_TINH' THEN
    IF coalesce("public"."me_role"() = 'A1', false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng chọn, đổi hoặc bỏ nhiệm vụ "Số liệu toàn tỉnh".' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- Gắn mới nguồn vốn / chủ đầu tư, hoặc đổi / bỏ việc đang gắn (kể cả đổi sang toàn tỉnh): chủ trì, người theo dõi, lãnh đạo trong phạm vi.
  IF (v_rieng OR coalesce(v_loai IN ('NGUON', 'CHU_DAU_TU'), false))
     AND (v."owner_tai_khoan" = v_uid OR v."nguoi_theo_doi" = v_uid OR "public"."kl_duoc_chi_dao"(v."id")) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ chủ trì, người theo dõi hoặc lãnh đạo trong phạm vi gắn nhiệm vụ với theo dõi giải ngân.' USING ERRCODE = '42501';
  END IF;
  IF v_loai IS NULL THEN   -- bỏ theo dõi
    IF c."nhiem_vu_id" IS NULL THEN RETURN jsonb_build_object('doi', false); END IF;
    IF v_rieng AND NOT v_lanh_dao AND NOT v_tu_sua THEN
      RAISE EXCEPTION 'Việc này do lãnh đạo hoặc người giao gắn theo dõi giải ngân (hoặc đã đặt mục tiêu riêng) — chỉ lãnh đạo trong phạm vi hoặc người giao bỏ theo dõi.'
        USING ERRCODE = '42501';
    END IF;
    DELETE FROM "public"."gn_nhiem_vu" WHERE "nhiem_vu_id" = "p_nv";
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES ("p_nv", "auth"."uid"(), 'giai_ngan', "public"."gn_mo_ta"(c), 'Bỏ theo dõi giải ngân', 'app');
    RETURN jsonb_build_object('doi', true);
  END IF;
  m."nhiem_vu_id" := "p_nv"; m."loai" := v_loai;
  v_cung_kieu := coalesce((c."loai" = 'TOAN_TINH') = (v_loai = 'TOAN_TINH'), false);   -- mục tiêu chỉ kế thừa trong cùng kiểu theo dõi
  BEGIN
    m."nam" := coalesce(nullif("p" ->> 'nam', '')::integer, c."nam", extract(year FROM "public"."kl_hom_nay"())::integer);
    m."muc_tieu_pt" := coalesce(nullif("p" ->> 'muc_tieu_pt', '')::numeric, CASE WHEN v_cung_kieu THEN c."muc_tieu_pt" END, 100);
    m."muc_tieu_ngay" := coalesce(nullif("p" ->> 'muc_tieu_ngay', '')::date, CASE WHEN v_cung_kieu AND c."nam" = m."nam" THEN c."muc_tieu_ngay" END,
      make_date(m."nam", 12, 31));
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Năm, mục tiêu hoặc mốc mục tiêu không đúng dạng.' USING ERRCODE = '22023';
  END;
  IF m."nam" NOT BETWEEN 1990 AND 2100 OR m."muc_tieu_pt" = 'NaN'::numeric OR m."muc_tieu_pt" <= 0 OR m."muc_tieu_pt" > 100 THEN
    RAISE EXCEPTION 'Năm hoặc mục tiêu (phần trăm kế hoạch vốn, lớn hơn 0 và không quá 100) không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF m."muc_tieu_ngay" NOT BETWEEN make_date(m."nam", 1, 1) AND make_date(m."nam" + 1, 1, 31) THEN
    RAISE EXCEPTION 'Mốc mục tiêu phải trong năm % hoặc đến 31/1/%.', m."nam", m."nam" + 1 USING ERRCODE = '22023';
  END IF;
  IF v_loai <> 'TOAN_TINH' THEN
    m."ten" := left(nullif(btrim(coalesce("p" ->> 'ten', '')), ''), 300); m."ten_chuan" := left(nullif(btrim(coalesce("p" ->> 'ten_chuan', '')), ''), 300);
    IF m."ten" IS NULL OR m."ten_chuan" IS NULL THEN RAISE EXCEPTION 'Ghi tên nguồn vốn hoặc chủ đầu tư.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF c."nhiem_vu_id" IS NOT NULL AND "public"."gn_mo_ta"(c) = "public"."gn_mo_ta"(m) AND c."ten_chuan" IS NOT DISTINCT FROM m."ten_chuan" THEN
    RETURN jsonb_build_object('doi', false);
  END IF;
  -- Việc đang gắn nguồn vốn / chủ đầu tư: đổi gì (đối tượng, năm, mục tiêu, kể cả đổi sang "Số liệu toàn tỉnh") cũng cần lãnh đạo / tầng giao không phải
  -- người chủ trì, trừ người tự gắn với mục tiêu mặc định.
  IF v_rieng AND NOT v_lanh_dao AND NOT v_tu_sua THEN
    RAISE EXCEPTION 'Việc này do lãnh đạo hoặc người giao gắn theo dõi giải ngân (hoặc đã đặt mục tiêu riêng) — chỉ lãnh đạo trong phạm vi hoặc người giao đổi.'
      USING ERRCODE = '42501';
  END IF;
  -- Mục tiêu khác mặc định — mặc định: mục tiêu đang có của việc gắn nguồn vốn / chủ đầu tư cùng năm; còn lại (gắn mới, đổi năm, từ toàn tỉnh) 100% trước 31/12.
  v_mac_pt := CASE WHEN v_rieng AND c."nam" = m."nam" THEN c."muc_tieu_pt" ELSE 100 END;
  v_mac_ngay := CASE WHEN v_rieng AND c."nam" = m."nam" THEN c."muc_tieu_ngay" ELSE make_date(m."nam", 12, 31) END;
  IF (m."muc_tieu_pt" <> v_mac_pt OR m."muc_tieu_ngay" <> v_mac_ngay) AND v_loai <> 'TOAN_TINH' AND NOT v_lanh_dao THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo trong phạm vi hoặc người giao việc (không phải người chủ trì) đặt mục tiêu giải ngân khác 100%% trước 31/12 cho nhiệm vụ.'
      USING ERRCODE = '42501';
  END IF;
  IF v_loai = 'TOAN_TINH' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('gn_toan_tinh:' || m."nam", 0));   -- hai lãnh đạo chọn cùng lúc hai việc cho một năm
    SELECT n."ma" INTO v_khac FROM "public"."gn_nhiem_vu" g JOIN "public"."nhiem_vu" n ON n."id" = g."nhiem_vu_id"
    WHERE g."nam" = m."nam" AND g."loai" = 'TOAN_TINH' AND g."nhiem_vu_id" <> "p_nv";
    IF v_khac IS NOT NULL THEN
      RAISE EXCEPTION 'Năm % đã có nhiệm vụ "Số liệu toàn tỉnh" (%) — bỏ theo dõi ở việc đó trước.', m."nam", v_khac USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."gn_nhiem_vu" ("nhiem_vu_id", "nam", "loai", "ten", "ten_chuan", "muc_tieu_pt", "muc_tieu_ngay", "gan_boi")
  VALUES ("p_nv", m."nam", m."loai", m."ten", m."ten_chuan", m."muc_tieu_pt", m."muc_tieu_ngay", v_uid)
  ON CONFLICT ("nhiem_vu_id") DO UPDATE SET "nam" = EXCLUDED."nam", "loai" = EXCLUDED."loai", "ten" = EXCLUDED."ten", "ten_chuan" = EXCLUDED."ten_chuan",
    "muc_tieu_pt" = EXCLUDED."muc_tieu_pt", "muc_tieu_ngay" = EXCLUDED."muc_tieu_ngay", "gan_boi" = EXCLUDED."gan_boi", "gan_luc" = now();
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES ("p_nv", "auth"."uid"(), 'giai_ngan', "public"."gn_mo_ta"(c), "public"."gn_mo_ta"(m), 'app');
  RETURN jsonb_build_object('doi', true);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."gn_ghi_ky"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nam integer; v_ngay date; v_kh numeric; v_da numeric; v_uoc boolean; v_id uuid; v_trung text; v_sai integer;
  v_can_cu text := btrim(coalesce("p" ->> 'can_cu', '')); v_ghi_chu text := left(nullif(btrim(coalesce("p" ->> 'ghi_chu', '')), ''), 500);
  v_dong jsonb := coalesce("p" -> 'dong', '[]'::jsonb); v_tt "public"."gn_nhiem_vu"; v_cu "public"."gn_ky"; v_thay boolean := false;
BEGIN
  BEGIN
    v_nam := ("p" ->> 'nam')::integer; v_ngay := ("p" ->> 'ngay_so_lieu')::date; v_kh := round(("p" ->> 'ke_hoach')::numeric, 3);   -- như cột numeric(16,3)
    v_da := round(("p" ->> 'da_giai_ngan')::numeric, 3); v_uoc := coalesce(("p" ->> 'uoc_tinh')::boolean, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Năm, ngày số liệu, kế hoạch vốn hoặc số đã giải ngân không đúng dạng.' USING ERRCODE = '22023';
  END;
  IF v_nam IS NULL OR v_ngay IS NULL OR v_kh IS NULL OR v_da IS NULL THEN
    RAISE EXCEPTION 'Ghi đủ năm, ngày số liệu, kế hoạch vốn năm và số đã giải ngân lũy kế.' USING ERRCODE = '22023';
  END IF;
  IF NOT "public"."gn_duoc_nhap_ky"(v_nam) THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc chủ trì, người theo dõi nhiệm vụ "Số liệu toàn tỉnh" năm % mới nhập kỳ số liệu giải ngân.', v_nam
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tt FROM "public"."gn_nhiem_vu" WHERE "nam" = v_nam AND "loai" = 'TOAN_TINH';
  IF v_tt."nhiem_vu_id" IS NULL THEN
    RAISE EXCEPTION 'Năm % chưa có nhiệm vụ "Số liệu toàn tỉnh" — lãnh đạo Văn phòng chọn nhiệm vụ đó trước khi nhập kỳ số liệu.', v_nam USING ERRCODE = '22023';
  END IF;
  IF v_ngay > "public"."kl_hom_nay"() THEN RAISE EXCEPTION 'Ngày số liệu không được sau hôm nay.' USING ERRCODE = '22023'; END IF;
  IF v_ngay NOT BETWEEN make_date(v_nam, 1, 1) AND make_date(v_nam + 1, 1, 31) THEN
    RAISE EXCEPTION 'Số liệu kế hoạch vốn năm % phải tính đến ngày từ 1/1/% đến 31/1/%.', v_nam, v_nam, v_nam + 1 USING ERRCODE = '22023';
  END IF;
  IF v_can_cu = '' OR char_length(v_can_cu) > 300 THEN
    RAISE EXCEPTION 'Ghi văn bản căn cứ (số hiệu, ngày, cơ quan báo cáo), tối đa 300 ký tự.' USING ERRCODE = '22023';
  END IF;
  -- NaN lớn hơn mọi số trong Postgres (qua được CHECK > 0) — chặn riêng; numeric(16,3) giữ được dưới 10^13.
  IF v_kh = 'NaN'::numeric OR v_da = 'NaN'::numeric OR v_kh <= 0 OR v_da < 0 OR v_kh >= 1e13 OR v_da >= 1e13 THEN
    RAISE EXCEPTION 'Kế hoạch vốn phải lớn hơn 0, số đã giải ngân không âm (tỷ đồng, dưới 10 nghìn tỷ tỷ).' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_dong) <> 'array' THEN RAISE EXCEPTION 'Dòng chi tiết phải là một danh sách.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_dong) x WHERE jsonb_typeof(x) <> 'object' OR coalesce(x ->> 'loai', '') NOT IN ('NGUON', 'CHU_DAU_TU')
       OR btrim(coalesce(x ->> 'ten', '')) = '' OR btrim(coalesce(x ->> 'ten_chuan', '')) = '') THEN
    RAISE EXCEPTION 'Mỗi dòng chi tiết phải có loại (nguồn vốn / chủ đầu tư) và tên.' USING ERRCODE = '22023';
  END IF;
  BEGIN   -- số của dòng: đúng dạng, không âm, không NaN, vừa numeric(16,3)
    SELECT count(*) INTO v_sai FROM (SELECT round(nullif(x ->> 'ke_hoach', '')::numeric, 3) AS kh, round(nullif(x ->> 'da_giai_ngan', '')::numeric, 3) AS da,
      nullif(x ->> 'thu_tu', '')::integer AS tt FROM jsonb_array_elements(v_dong) x) s
    WHERE s.kh = 'NaN'::numeric OR s.da = 'NaN'::numeric OR s.kh < 0 OR s.da < 0 OR s.kh >= 1e13 OR s.da >= 1e13 OR s.tt < 0;
  EXCEPTION WHEN OTHERS THEN v_sai := 1;
  END;
  IF v_sai > 0 THEN
    RAISE EXCEPTION 'Dòng chi tiết có số không hợp lệ (kế hoạch, đã giải ngân phải là số không âm, tính bằng tỷ đồng).' USING ERRCODE = '22023';
  END IF;
  -- Trùng tên kiểm trên tên đã chuẩn hoá đúng như lúc ghi (cắt khoảng trắng, 300 ký tự).
  SELECT min(left(btrim(x ->> 'ten'), 300)) INTO v_trung FROM jsonb_array_elements(v_dong) x
  GROUP BY x ->> 'loai', left(btrim(x ->> 'ten_chuan'), 300) HAVING count(*) > 1 LIMIT 1;
  IF v_trung IS NOT NULL THEN RAISE EXCEPTION 'Bảng có hai dòng cùng tên "%" — gộp hoặc bỏ một dòng.', v_trung USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gn_ky:' || v_nam, 0));   -- ghi cùng năm cùng lúc: người sau thấy kỳ người trước vừa ghi (ghi thay)
  SELECT * INTO v_cu FROM "public"."gn_ky" WHERE "nam" = v_nam AND "ngay_so_lieu" = v_ngay;
  IF v_cu."id" IS NOT NULL THEN
    UPDATE "public"."gn_ky" SET "can_cu" = v_can_cu, "uoc_tinh" = v_uoc, "ke_hoach" = v_kh, "da_giai_ngan" = v_da, "ghi_chu" = v_ghi_chu,
      "nhap_boi" = "auth"."uid"(), "nhap_luc" = now() WHERE "id" = v_cu."id" RETURNING "id" INTO v_id;
    v_thay := v_id IS NOT NULL;
    IF v_thay THEN DELETE FROM "public"."gn_ky_dong" WHERE "ky_id" = v_id; ELSE v_cu := NULL; END IF;
  END IF;
  IF v_id IS NULL THEN   -- chưa có kỳ ngày này (hoặc kỳ vừa bị xoá)
    INSERT INTO "public"."gn_ky" ("nam", "ngay_so_lieu", "can_cu", "uoc_tinh", "ke_hoach", "da_giai_ngan", "ghi_chu", "nhap_boi")
    VALUES (v_nam, v_ngay, v_can_cu, v_uoc, v_kh, v_da, v_ghi_chu, "auth"."uid"()) RETURNING "id" INTO v_id;
  END IF;
  INSERT INTO "public"."gn_ky_dong" ("ky_id", "loai", "ten", "ten_chuan", "thu_tu", "ke_hoach", "da_giai_ngan")
  SELECT v_id, x ->> 'loai', left(btrim(x ->> 'ten'), 300), left(btrim(x ->> 'ten_chuan'), 300), coalesce(nullif(x ->> 'thu_tu', '')::integer, t.o::integer),
         round(nullif(x ->> 'ke_hoach', '')::numeric, 3), round(nullif(x ->> 'da_giai_ngan', '')::numeric, 3)
  FROM jsonb_array_elements(v_dong) WITH ORDINALITY t(x, o);
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (v_tt."nhiem_vu_id", "auth"."uid"(), 'giai_ngan',
    CASE WHEN v_thay THEN format('Kỳ đến %s: %s/%s tỷ đồng', to_char(v_ngay, 'DD/MM/YYYY'), "public"."gn_so"(v_cu."da_giai_ngan"),
      "public"."gn_so"(v_cu."ke_hoach")) END,
    format('Kỳ số liệu đến %s%s: đã giải ngân %s/%s tỷ đồng (%s) — căn cứ: %s', to_char(v_ngay, 'DD/MM/YYYY'), CASE WHEN v_uoc THEN ' (ước tính)' ELSE '' END,
      "public"."gn_so"(v_da), "public"."gn_so"(v_kh), "public"."gn_pt"(v_da, v_kh), v_can_cu), 'app');
  RETURN jsonb_build_object('id', v_id, 'thay', v_thay, 'so_dong', jsonb_array_length(v_dong));
END;
$$;

CREATE OR REPLACE FUNCTION "public"."gn_xoa_ky"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."gn_ky"; v_tt "public"."gn_nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."gn_ky" WHERE "id" = "p_id";
  IF v."id" IS NULL THEN RAISE EXCEPTION 'Không có kỳ số liệu này.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."gn_duoc_nhap_ky"(v."nam") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc chủ trì, người theo dõi nhiệm vụ "Số liệu toàn tỉnh" năm % mới xoá kỳ số liệu.', v."nam" USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gn_ky:' || v."nam", 0));   -- như gn_ghi_ky: xoá và ghi cùng năm lần lượt
  SELECT * INTO v FROM "public"."gn_ky" WHERE "id" = "p_id";   -- đọc lại sau khoá (người khác vừa xoá / ghi thay)
  IF v."id" IS NULL THEN RAISE EXCEPTION 'Không có kỳ số liệu này (vừa được xoá).' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_tt FROM "public"."gn_nhiem_vu" WHERE "nam" = v."nam" AND "loai" = 'TOAN_TINH';
  DELETE FROM "public"."gn_ky" WHERE "id" = "p_id";
  IF v_tt."nhiem_vu_id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
    VALUES (v_tt."nhiem_vu_id", "auth"."uid"(), 'giai_ngan', format('Kỳ đến %s: %s/%s tỷ đồng — căn cứ: %s', to_char(v."ngay_so_lieu", 'DD/MM/YYYY'),
      "public"."gn_so"(v."da_giai_ngan"), "public"."gn_so"(v."ke_hoach"), v."can_cu"), 'Xoá kỳ số liệu', 'app');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION "public"."gn_ghi_ky"(jsonb), "public"."gn_xoa_ky"(uuid), "public"."gn_gan_nhiem_vu"(uuid, jsonb) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."gn_ghi_ky"(jsonb), "public"."gn_xoa_ky"(uuid), "public"."gn_gan_nhiem_vu"(uuid, jsonb) TO "authenticated";
