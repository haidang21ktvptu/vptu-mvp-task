-- 0046 (v8 đợt 4): (1) Minh chứng hoàn thành đủ 4 yếu tố — số hiệu, ngày (0028) + trích yếu văn bản + mô tả kết quả (≤ 600 ký tự); bắt buộc với minh
--     chứng NỘP MỚI qua nop_minh_chung, bản ghi cũ giữ NULL (vẫn hợp lệ: minh_chung_la_hop_le không đổi). Hàm nhận thêm hai khoá jsonb
--     trich_yeu, mo_ta_ket_qua (chữ ký nop_minh_chung(jsonb) không đổi → mọi chỗ gọi cũ vẫn gọi được, DB báo thiếu).
-- (2) van_ban_giao_viec.trich_yeu (nullable): Thường trực và mọi vai nhập được trích yếu văn bản; hàm van_ban_dat_trich_yeu(id, text) đặt sau
--     giao_viec (không chép lại giao_viec 0045), có vết ở lich_su của mọi nhiệm vụ thuộc văn bản đó.
-- (3) v_minh_chung: minh_chung + tên người nộp / xác nhận / cấp nhận (security_invoker → RLS minh_chung_select) — lá của cây "Theo văn bản".
-- (4) v_dien_bien: dòng nộp minh chứng ghi "Nộp minh chứng <số> · <trích yếu>" (cũ không trích yếu → như 0037).

ALTER TABLE "public"."minh_chung"
  ADD COLUMN "trich_yeu" text,
  ADD COLUMN "mo_ta_ket_qua" text,
  ADD CONSTRAINT "minh_chung_mo_ta_ket_qua_600" CHECK ("mo_ta_ket_qua" IS NULL OR char_length("mo_ta_ket_qua") <= 600);
COMMENT ON COLUMN "public"."minh_chung"."trich_yeu" IS 'Trích yếu văn bản minh chứng (bắt buộc với minh chứng nộp mới từ 0046)';
COMMENT ON COLUMN "public"."minh_chung"."mo_ta_ket_qua" IS 'Mô tả kết quả ≤ 600 ký tự: đã làm gì, kết quả, gửi ai (bắt buộc với minh chứng nộp mới từ 0046)';

ALTER TABLE "public"."van_ban_giao_viec" ADD COLUMN "trich_yeu" text;
COMMENT ON COLUMN "public"."van_ban_giao_viec"."trich_yeu" IS 'Trích yếu văn bản giao việc (không bắt buộc; đặt qua van_ban_dat_trich_yeu)';

-- 1. nop_minh_chung(p): thêm trich_yeu, mo_ta_ket_qua bắt buộc; vết ghi "Nộp minh chứng · <mã>: số <số> · <trích yếu>".
CREATE OR REPLACE FUNCTION "public"."nop_minh_chung"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_id uuid; v_loi text;
        v_so text := nullif(btrim(coalesce("p" ->> 'so_hieu', '')), ''); v_ngay date := nullif("p" ->> 'ngay_van_ban', '')::date;
        v_cap text := nullif(btrim(coalesce("p" ->> 'cap_nhan', '')), ''); v_cap_ten text;
        v_trich_yeu text := nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), ''); v_mo_ta text := nullif(btrim(coalesce("p" ->> 'mo_ta_ket_qua', '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_so IS NULL OR v_ngay IS NULL OR v_cap IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải đủ ba trường: số hiệu, ngày văn bản và cấp nhận.' USING ERRCODE = '22023';
  END IF;
  IF v_trich_yeu IS NULL OR v_mo_ta IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải có trích yếu văn bản và mô tả kết quả (đã làm gì, kết quả, gửi ai).' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_mo_ta) > 600 THEN RAISE EXCEPTION 'Mô tả kết quả tối đa 600 ký tự.' USING ERRCODE = '22023'; END IF;
  SELECT "ten" INTO v_cap_ten FROM "public"."dm_cap" WHERE "ma" = v_cap;
  IF v_cap_ten IS NULL THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi")
  VALUES (v_nv."id", 'so_hieu', v_so, v_ngay, v_cap, v_trich_yeu, v_mo_ta, "auth"."uid"()) RETURNING "id" INTO v_id;
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_nop',
    format('Nộp minh chứng · %s: số %s · %s (ngày %s, %s)', v_nv."ma", v_so, v_trich_yeu, to_char(v_ngay, 'DD/MM/YYYY'), v_cap_ten));
  RETURN v_id;
END;
$$;

-- 2. van_ban_dat_trich_yeu(id, text): allowlist tường minh — người tạo văn bản (vai vừa giao việc, kể cả A0 với văn bản mình tạo), A1, quan_tri_kl.
CREATE FUNCTION "public"."van_ban_dat_trich_yeu"("p_id" uuid, "p_trich_yeu" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_moi text := nullif(btrim(coalesce("p_trich_yeu", '')), '');
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_id";
  IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  IF "auth"."uid"() IS NULL OR NOT (v_vb."tao_boi" = "auth"."uid"() OR "public"."me_role"() = 'A1' OR "public"."me_quan_tri_kl"()) THEN
    RAISE EXCEPTION 'Chỉ người tạo văn bản, lãnh đạo Văn phòng hoặc quản trị nhiệm vụ mới sửa trích yếu văn bản.' USING ERRCODE = '42501';
  END IF;
  IF v_moi IS NOT DISTINCT FROM v_vb."trich_yeu" THEN RETURN; END IF;
  UPDATE "public"."van_ban_giao_viec" SET "trich_yeu" = v_moi WHERE "id" = "p_id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", "auth"."uid"(), 'van_ban_trich_yeu', v_vb."trich_yeu", v_moi, 'app' FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = "p_id";
END;
$$;
REVOKE ALL ON FUNCTION "public"."van_ban_dat_trich_yeu"(uuid, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."van_ban_dat_trich_yeu"(uuid, text) TO "authenticated";

-- 3. v_minh_chung: mọi cột minh_chung + tên người nộp / xác nhận / cấp nhận; RLS của bảng gốc quyết phạm vi (A0 toàn bộ, A1 theo kl_pham_vi…).
CREATE VIEW "public"."v_minh_chung" WITH ("security_invoker" = true) AS
SELECT m.*, a."full_name" AS "nop_boi_ten", x."full_name" AS "xac_nhan_boi_ten", c."ten" AS "cap_nhan_ten"
FROM "public"."minh_chung" m
LEFT JOIN "public"."accounts_public" a ON a."id" = m."nop_boi"
LEFT JOIN "public"."accounts_public" x ON x."id" = m."xac_nhan_boi"
LEFT JOIN "public"."dm_cap" c ON c."ma" = m."cap_nhan";
REVOKE ALL ON TABLE "public"."v_minh_chung" FROM "anon"; GRANT SELECT ON TABLE "public"."v_minh_chung" TO "authenticated";

-- 4. v_dien_bien (0037): chỉ đổi nội dung dòng nộp minh chứng — có trích yếu → "Nộp minh chứng <số> · <trích yếu>"; các nhánh khác giữ nguyên.
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
            ELSE format('Nộp minh chứng %s', concat_ws(' · ', m."so_hieu", to_char(m."ngay_van_ban", 'DD/MM/YYYY'), m."cap_nhan", left(m."noi_dung_chu", 80))) END, NULL,
       CASE WHEN m."hop_le" IS NULL THEN 'CHO_XAC_NHAN' WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."nop_boi"
UNION ALL
SELECT 'mx-' || m."id", m."nhiem_vu_id", m."xac_nhan_luc", 'minh_chung', 'xac_nhan', m."xac_nhan_boi", a."full_name",
       format('%s minh chứng %s%s', CASE WHEN m."hop_le" THEN 'Xác nhận hợp lệ' ELSE 'Không hợp lệ' END, coalesce(m."so_hieu", ''), coalesce(' — ' || m."ly_do_khong_hop_le", '')), NULL,
       CASE WHEN m."hop_le" THEN 'HOP_LE' ELSE 'KHONG_HOP_LE' END, NULL
FROM "public"."minh_chung" m LEFT JOIN "public"."accounts_public" a ON a."id" = m."xac_nhan_boi" WHERE m."xac_nhan_luc" IS NOT NULL
ORDER BY 3 DESC, 1 DESC;
