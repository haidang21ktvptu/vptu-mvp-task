-- 0125 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-6): tài khoản toàn quyền (accounts.toan_quyen — chỉ qt_vptu, 0100) sửa mọi thông tin của
-- nhiệm vụ, kể cả việc đã hoàn thành, và mở lại việc đã hoàn thành. Mọi thay đổi có lý do, nhật ký (trigger lịch sử: người, lúc, cũ → mới; một
-- dòng tóm tắt kèm lý do ở Diễn biến) và tin báo người liên quan. Ràng buộc dữ liệu giữ nguyên (trigger, CHECK — ngày, cha con, chủ trì khớp đơn vị,
-- kết luận / thông báo có ngành, lĩnh vực…). Không sửa định danh: mã, số thứ tự trong văn bản, người giao, việc cha, văn bản của việc, nguồn dòng.
-- Đổi chủ trì, người theo dõi: doi_chu_tri (0124). Hoàn thành vẫn qua nộp minh chứng / Đóng nhiệm vụ.
-- 1. kl_ten_cot_sua(cột): tên ô cho câu nhật ký (ô thông tin giao — kl_ten_cot_giao — và ô thực hiện).
-- 2. sua_toan_bo_nhiem_vu(p_id, p_thay_doi, p_ly_do): ô thông tin giao (kl_cot_tang_giao — kiểm như sửa thông tin giao: danh mục, ngành – lĩnh vực,
--    quy tắc 1400) + ô thực hiện: hạn xử lý, loại thời hạn, lý do chưa có hạn, ngày hoàn thành, kết quả / minh chứng dạng chữ, văn bản triển khai,
--    ghi chú, cấp cần quyết định, ngày nhận văn bản. Chỉ ô có giá trị khác hiện tại; không có gì khác → lỗi. Đổi hạn ở đây là đính chính (không tính
--    lần gia hạn — gia hạn dùng dieu_chinh_han, 0123).
-- 3. mo_lai_nhiem_vu(p_id, p_ly_do): việc đã hoàn thành → đang thực hiện; ngày hoàn thành, lúc đóng, chất lượng tự xoá (trigger 0028 / 0062);
--    minh chứng giữ nguyên.

-- ---- 1 ----
CREATE FUNCTION "public"."kl_ten_cot_sua"("p_cot" text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE "p_cot" WHEN 'han_xu_ly' THEN 'Hạn xử lý' WHEN 'loai_thoi_han_ma' THEN 'Loại thời hạn' WHEN 'ly_do_chua_co_han' THEN 'Lý do chưa có hạn'
    WHEN 'ngay_hoan_thanh' THEN 'Ngày hoàn thành' WHEN 'minh_chung' THEN 'Kết quả, minh chứng (chữ)' WHEN 'van_ban_trien_khai' THEN 'Văn bản triển khai'
    WHEN 'ghi_chu' THEN 'Ghi chú' ELSE "public"."kl_ten_cot_giao"("p_cot") END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ten_cot_sua"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ten_cot_sua"(text) TO "authenticated";

-- ---- 2 ----
CREATE FUNCTION "public"."sua_toan_bo_nhiem_vu"("p_id" uuid, "p_thay_doi" jsonb, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; m "public"."nhiem_vu"; v_ly_do text := btrim(coalesce("p_ly_do", '')); k text; val jsonb; v_s text; v_cu jsonb;
        v_giao jsonb := '{}'; v_th jsonb := '{}'; v_doi jsonb; v_ten text;
        v_cot_th text[] := ARRAY['han_xu_ly', 'loai_thoi_han_ma', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                                 'cap_quyet_dinh', 'ngay_nhan_van_ban'];
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (toàn quyền) mới sửa toàn bộ thông tin nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  IF "p_thay_doi" IS NULL OR jsonb_typeof("p_thay_doi") <> 'object' OR "p_thay_doi" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do sửa bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_cu := to_jsonb(v);
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p_thay_doi") e LOOP
    IF NOT (k = ANY ("public"."kl_cot_tang_giao"()) OR k = ANY (v_cot_th)) THEN
      RAISE EXCEPTION 'Ô "%" không sửa được bằng cách này.', "public"."kl_ten_cot_sua"(k) USING ERRCODE = '22023';
    END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    CONTINUE WHEN coalesce(to_jsonb(v_s), 'null'::jsonb) IS NOT DISTINCT FROM coalesce(v_cu -> k, 'null'::jsonb);
    IF k = ANY (v_cot_th) THEN v_th := v_th || jsonb_build_object(k, v_s); ELSE v_giao := v_giao || jsonb_build_object(k, v_s); END IF;
  END LOOP;
  IF v_giao = '{}'::jsonb AND v_th = '{}'::jsonb THEN RAISE EXCEPTION 'Không có gì thay đổi so với thông tin đang có.' USING ERRCODE = '22023'; END IF;
  IF v_giao <> '{}'::jsonb THEN v_giao := "public"."kl_thay_doi_giao"(v, v_giao); END IF;   -- danh mục, ngành – lĩnh vực, quy tắc 1400
  -- Ô thực hiện: kiểu, danh mục, độ dài (ngày, cha con, đơn vị: trigger 0015 / 0023 / 0028 kiểm khi ghi).
  BEGIN
    PERFORM (v_th ->> 'han_xu_ly')::date, (v_th ->> 'ngay_hoan_thanh')::date, (v_th ->> 'ngay_nhan_van_ban')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Ngày không hợp lệ (định dạng năm-tháng-ngày).' USING ERRCODE = '22023';
  END;
  IF v_th ? 'loai_thoi_han_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_loai_thoi_han" WHERE "ma" = v_th ->> 'loai_thoi_han_ma') THEN
    RAISE EXCEPTION 'Loại thời hạn không có trong danh mục.' USING ERRCODE = '22023';
  END IF;
  IF v_th ? 'cap_quyet_dinh' AND v_th ->> 'cap_quyet_dinh' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = v_th ->> 'cap_quyet_dinh') THEN
    RAISE EXCEPTION 'Cấp cần quyết định không có trong danh mục.' USING ERRCODE = '22023';
  END IF;
  IF v_th ? 'ngay_hoan_thanh' AND v_th ->> 'ngay_hoan_thanh' IS NOT NULL AND v."tien_do_ma" <> 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ chưa hoàn thành — ngày hoàn thành ghi khi nộp minh chứng.' USING ERRCODE = '22023';
  END IF;
  IF v_th ? 'ngay_hoan_thanh' AND v_th ->> 'ngay_hoan_thanh' IS NULL AND v."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành phải có ngày hoàn thành — muốn bỏ thì mở lại nhiệm vụ.' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_th ->> 'ly_do_chua_co_han', '')) > 500 OR char_length(coalesce(v_th ->> 'minh_chung', '')) > 2000
     OR char_length(coalesce(v_th ->> 'van_ban_trien_khai', '')) > 1000 OR char_length(coalesce(v_th ->> 'ghi_chu', '')) > 2000 THEN
    RAISE EXCEPTION 'Nội dung quá dài (lý do chưa có hạn tối đa 500, văn bản triển khai 1000, ghi chú / kết quả 2000 ký tự).' USING ERRCODE = '22023';
  END IF;
  v_doi := v_giao || v_th;
  m := jsonb_populate_record(v, v_doi);
  IF m."loai_thoi_han_ma" = 'CO_HAN_CU_THE' AND m."han_xu_ly" IS NULL AND nullif(btrim(coalesce(m."ly_do_chua_co_han", '')), '') IS NULL
     AND NOT (m."tien_do_ma" = 'HOAN_THANH' AND m."nguon" = 'excel') THEN
    RAISE EXCEPTION 'Loại "Có hạn cụ thể" phải có hạn xử lý hoặc lý do chưa xác định được hạn.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);
  UPDATE "public"."nhiem_vu" SET "noi_dung" = m."noi_dung", "san_pham_loai" = m."san_pham_loai", "san_pham_mo_ta" = m."san_pham_mo_ta",
    "cap_nhan_san_pham" = m."cap_nhan_san_pham", "do_khan" = m."do_khan", "nganh_ma" = m."nganh_ma", "linh_vuc_ma" = m."linh_vuc_ma",
    "linh_vuc_chi_tiet" = m."linh_vuc_chi_tiet", "nguon_nhiem_vu_ma" = m."nguon_nhiem_vu_ma", "don_vi_phoi_hop" = m."don_vi_phoi_hop",
    "muc_quan_trong" = m."muc_quan_trong", "co_quan_trinh" = m."co_quan_trinh", "thuong_truc_chi_dao" = m."thuong_truc_chi_dao",
    "han_xu_ly" = m."han_xu_ly", "loai_thoi_han_ma" = m."loai_thoi_han_ma", "ly_do_chua_co_han" = m."ly_do_chua_co_han", "ngay_hoan_thanh" = m."ngay_hoan_thanh",
    "minh_chung" = m."minh_chung", "van_ban_trien_khai" = m."van_ban_trien_khai", "ghi_chu" = m."ghi_chu", "cap_quyet_dinh" = m."cap_quyet_dinh",
    "ngay_nhan_van_ban" = m."ngay_nhan_van_ban"
  WHERE "id" = v."id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  SELECT string_agg("public"."kl_ten_cot_sua"(x), ', ' ORDER BY x) INTO v_ten FROM jsonb_object_keys(v_doi) x;
  PERFORM "public"."kl_ghi_vet_viec"(v."id", 'sua_toan_bo', format('sửa %s — lý do: %s', v_ten, v_ly_do),
                                     format('Tài khoản quản trị sửa thông tin nhiệm vụ · %s: %s — %s', v."ma", v_ten, left(v_ly_do, 200)));
  RETURN v_doi;
END;
$$;
REVOKE ALL ON FUNCTION "public"."sua_toan_bo_nhiem_vu"(uuid, jsonb, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."sua_toan_bo_nhiem_vu"(uuid, jsonb, text) TO "authenticated";

-- ---- 3 ----
CREATE FUNCTION "public"."mo_lai_nhiem_vu"("p_id" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_ly_do text := btrim(coalesce("p_ly_do", '')); v_nd text;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (toàn quyền) mới mở lại nhiệm vụ đã hoàn thành.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" <> 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ chưa hoàn thành — không cần mở lại.' USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do mở lại bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);
  UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'DANG_THUC_HIEN' WHERE "id" = v."id";   -- trigger xoá ngày hoàn thành, lúc đóng, chất lượng
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_nd := format('Mở lại nhiệm vụ (đã hoàn thành%s) — minh chứng giữ nguyên — lý do: %s', coalesce(' ngày ' || to_char(v."ngay_hoan_thanh", 'DD/MM/YYYY'), ''), v_ly_do);
  PERFORM "public"."kl_ghi_vet_viec"(v."id", 'mo_lai', v_nd, format('Mở lại nhiệm vụ · %s: %s', v."ma", left(v_ly_do, 200)));
END;
$$;
REVOKE ALL ON FUNCTION "public"."mo_lai_nhiem_vu"(uuid, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."mo_lai_nhiem_vu"(uuid, text) TO "authenticated";
