-- 0063: Chất lượng hoàn thành khi nghiệm thu (PR-3 hạng mục A; quyết định 1/10/2026).
-- 1. kl_ten_chat_luong(mã) → nhãn tiếng Việt (Không đạt / Đạt / Đạt tốt / Đạt xuất sắc); mã lạ ⇒ NULL (hàm ghi dùng để kiểm hợp lệ).
-- 2. xac_nhan_minh_chung 5 tham số (DROP bản 4 tham số 0057 trong cùng migration — PostgREST không nhận hai hàm trùng tên). Thân = bản 0057 +:
--    hợp lệ và hàm ĐÓNG việc (việc đang mở, minh chứng có ngày văn bản — Q2) ⇒ BẮT BUỘC p_chat_luong, ghi nhiem_vu.chat_luong trong cùng câu
--    UPDATE đóng việc; vết "… — Nghiệm thu: <chất lượng>". Trả lại (p_hop_le = false) kèm chất lượng ⇒ lỗi. Hợp lệ mà không đóng việc (việc đã
--    đóng; minh chứng chu_cu không có ngày văn bản) kèm chất lượng ⇒ lỗi (không ghi chất lượng ngoài lúc đóng).
-- 3. dong_nhiem_vu 3 tham số (đường đóng việc cũ không hạn nộp): p_chat_luong tuỳ chọn, mặc định NULL. Chỉ lãnh đạo trong phạm vi
--    (kl_duoc_chi_dao) hoặc quan_tri_kl còn hạn, và KHÔNG phải Owner tài khoản, mới gửi kèm chất lượng — Owner tự đóng việc mà gửi ⇒ lỗi.
-- Cả hai đặt cờ kl.ghi_qua_ham cục bộ giao dịch quanh đúng câu UPDATE nhiem_vu (guard a3 0062 — chat_luong không thuộc danh sách cột
-- người theo dõi / Owner được sửa) rồi xoá ngay.

CREATE FUNCTION "public"."kl_ten_chat_luong"("p_ma" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_ma" WHEN 'KHONG_DAT' THEN 'Không đạt' WHEN 'DAT' THEN 'Đạt' WHEN 'DAT_TOT' THEN 'Đạt tốt' WHEN 'DAT_XUAT_SAC' THEN 'Đạt xuất sắc' END;
$$;

DROP FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text, date);
CREATE FUNCTION "public"."xac_nhan_minh_chung"("p_id" uuid, "p_hop_le" boolean, "p_ly_do" text DEFAULT NULL, "p_han_nop_lai" date DEFAULT NULL,
                                               "p_chat_luong" text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mc "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), ''); v_t date := "public"."kl_hom_nay"();
        v_mo boolean; v_dong boolean; v_den date; v_thay text := ''; v_tin text; v_cl text := nullif(btrim(coalesce("p_chat_luong", '')), '');
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NOT NULL THEN SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id"; END IF;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_nghiem_thu"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ người theo dõi hoặc lãnh đạo trong phạm vi mới xác nhận minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."nop_boi" = "auth"."uid"() THEN RAISE EXCEPTION 'Không tự xác nhận minh chứng do chính mình nộp.' USING ERRCODE = '42501'; END IF;
  IF "p_hop_le" IS NULL THEN RAISE EXCEPTION 'Phải chọn Hợp lệ hoặc Không hợp lệ.' USING ERRCODE = '22023'; END IF;
  v_mo := v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL;
  v_dong := "p_hop_le" AND v_mo AND v_mc."ngay_van_ban" IS NOT NULL;   -- Q2: nghiệm thu = đóng việc
  IF v_cl IS NOT NULL AND "public"."kl_ten_chat_luong"(v_cl) IS NULL THEN RAISE EXCEPTION 'Chất lượng hoàn thành không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF NOT "p_hop_le" AND v_cl IS NOT NULL THEN RAISE EXCEPTION 'Trả lại minh chứng không ghi chất lượng hoàn thành.' USING ERRCODE = '22023'; END IF;
  IF v_dong AND v_cl IS NULL THEN
    RAISE EXCEPTION 'Nghiệm thu phải chọn chất lượng hoàn thành (Không đạt / Đạt / Đạt tốt / Đạt xuất sắc).' USING ERRCODE = '22023';
  END IF;
  IF "p_hop_le" AND NOT v_dong AND v_cl IS NOT NULL THEN
    RAISE EXCEPTION 'Chỉ ghi chất lượng hoàn thành khi nghiệm thu đóng nhiệm vụ.' USING ERRCODE = '22023';
  END IF;
  IF NOT "p_hop_le" THEN
    IF v_ly_do IS NULL THEN RAISE EXCEPTION 'Bác minh chứng phải ghi lý do.' USING ERRCODE = '22023'; END IF;
    IF v_mo THEN
      IF "p_han_nop_lai" IS NULL THEN RAISE EXCEPTION 'Trả lại minh chứng phải có hạn nộp lại.' USING ERRCODE = '22023'; END IF;
      v_den := CASE WHEN v_nv."han_xu_ly" IS NULL THEN NULL WHEN v_t <= v_nv."han_xu_ly" THEN v_nv."han_xu_ly" ELSE "public"."ngay_lam_viec_sau"(v_t, 2) END;
      IF "p_han_nop_lai" < v_t OR "p_han_nop_lai" > v_den THEN
        RAISE EXCEPTION 'Hạn nộp lại phải từ % đến %.', to_char(v_t, 'DD/MM/YYYY'), coalesce(to_char(v_den, 'DD/MM/YYYY'), '…') USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  IF "public"."kl_viec_a0_giao_cvp"(v_nv) AND ("public"."me_thu_ky_tt"() OR "public"."me_quan_tri_kl"()) THEN   -- Q8: thư ký / quản trị thay mặt
    v_thay := ' — thay mặt Thường trực — ' || coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), '');
  END IF;
  UPDATE "public"."minh_chung" SET "hop_le" = "p_hop_le", "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(),
    "ly_do_khong_hop_le" = CASE WHEN "p_hop_le" THEN NULL ELSE v_ly_do END,
    "han_nop_lai" = CASE WHEN "p_hop_le" OR NOT v_mo THEN NULL ELSE "p_han_nop_lai" END WHERE "id" = "p_id";
  v_tin := format('%s · %s: %s%s%s', CASE WHEN "p_hop_le" THEN 'Minh chứng hợp lệ (nghiệm thu)' ELSE 'Minh chứng bị trả lại' END, v_nv."ma",
                  coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)),
                  CASE WHEN "p_hop_le" THEN '' ELSE coalesce(' — nộp lại trước ' || to_char(CASE WHEN v_mo THEN "p_han_nop_lai" END, 'DD/MM/YYYY'), '') || ' — ' || v_ly_do END, v_thay);
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan', v_tin);
  IF v_thay <> '' AND NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN   -- thư ký: nguoi_lien_quan chỉ trả khi người gọi thấy việc theo quy tắc gốc
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT "auth"."uid"(), u, v_tin, false, 'he_thong', v_nv."id" FROM (SELECT DISTINCT unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) AS u) x
    WHERE u IS NOT NULL AND u <> "auth"."uid"();
  END IF;
  IF v_dong THEN   -- Q2: nghiệm thu = đóng việc, ngày hoàn thành = ngày văn bản minh chứng; chất lượng cùng câu UPDATE
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này (chat_luong ngoài danh sách cột người theo dõi)
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_mc."ngay_van_ban", "chat_luong" = v_cl WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
    PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'dong_nhiem_vu',
      format('Nghiệm thu và đóng nhiệm vụ · %s: hoàn thành ngày %s — Nghiệm thu: %s%s', v_nv."ma", to_char(v_mc."ngay_van_ban", 'DD/MM/YYYY'),
             "public"."kl_ten_chat_luong"(v_cl), v_thay));
  END IF;
END;
$$;

DROP FUNCTION "public"."dong_nhiem_vu"(uuid, date);
CREATE FUNCTION "public"."dong_nhiem_vu"("p_id" uuid, "p_ngay_hoan_thanh" date DEFAULT NULL, "p_chat_luong" text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nv "public"."nhiem_vu"; v_ngay date; v_cl text := nullif(btrim(coalesce("p_chat_luong", '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()
     OR "public"."kl_duoc_chi_dao"(v_nv."id") OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi hoặc lãnh đạo trong phạm vi mới đóng nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  IF v_cl IS NOT NULL THEN
    IF "public"."kl_ten_chat_luong"(v_cl) IS NULL THEN RAISE EXCEPTION 'Chất lượng hoàn thành không hợp lệ.' USING ERRCODE = '22023'; END IF;
    IF v_nv."owner_tai_khoan" = "auth"."uid"() OR NOT ("public"."kl_duoc_chi_dao"(v_nv."id") OR ("public"."me_quan_tri_kl"() AND NOT "public"."me_la_a0"())) THEN
      RAISE EXCEPTION 'Chỉ lãnh đạo trong phạm vi (không phải Owner của việc) mới đánh giá chất lượng khi đóng nhiệm vụ.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF v_nv."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."minh_chung_co_hop_le"("p_id") THEN
    RAISE EXCEPTION 'Đóng nhiệm vụ phải có ít nhất một minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận).' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce("p_ngay_hoan_thanh", (SELECT m."ngay_van_ban" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = "p_id"
                                         AND "public"."minh_chung_la_hop_le"(m) AND m."ngay_van_ban" IS NOT NULL ORDER BY m."nop_luc" DESC LIMIT 1)) INTO v_ngay;
  IF v_ngay IS NULL THEN RAISE EXCEPTION 'Minh chứng không có ngày văn bản — nhập ngày hoàn thành.' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này
  UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_ngay, "chat_luong" = v_cl WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  PERFORM "public"."minh_chung_ghi_vet"("p_id", 'dong_nhiem_vu', format('Đóng nhiệm vụ · %s: hoàn thành ngày %s%s', v_nv."ma", to_char(v_ngay, 'DD/MM/YYYY'),
    coalesce(' — Nghiệm thu: ' || "public"."kl_ten_chat_luong"(v_cl), '')));
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_ten_chat_luong"(text) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text, date, text) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."dong_nhiem_vu"(uuid, date, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ten_chat_luong"(text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."xac_nhan_minh_chung"(uuid, boolean, text, date, text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."dong_nhiem_vu"(uuid, date, text) TO "authenticated";
