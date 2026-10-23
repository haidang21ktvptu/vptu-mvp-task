-- 0129 (v3.31, rà soát độc lập 23/10/2026 trước khi mở PR — 0128 đã commit nên sửa bằng tệp mới):
-- 1. Căn dữ liệu của 0128 tắt trigger người dùng (không tin báo, không kiểm lại quy tắc cũ) nên trigger tự nhận việc zd_nhiem_vu_tu_nhan_viec (bản 0114)
--    không chạy: việc giao cho phòng / Văn phòng có người theo dõi mới là lãnh đạo (Trưởng phòng, Chánh Văn phòng) mất trạng thái "đã nhận" — lãnh đạo
--    lại hiện ở "Việc mới chờ xác nhận", nhắc Thường trực / Hỏa tốc chưa nhận gửi nhầm. Ghi bù đúng dòng trigger sẽ ghi cho người theo dõi mới của các
--    việc 0128 đã căn (lịch sử "Hệ thống — v3.31: …"): việc đang mở, theo 1400; lãnh đạo (A1 / A2) — chuyên viên chỉ khi cấu hình coi như đã nhận
--    (kl_tu_nhan_viec); bỏ qua người đã có dòng xác nhận nhận việc. Không tin báo.
-- 2. admin_chuyen_theo_doi (bản 0128): câu báo bỏ qua việc giao cho phòng / Văn phòng thừa chữ "s" ("…Chánh Văn phòngs —") — RAISE dùng %, không %s.
--    Chỉ sửa câu; quyền, cách chuyển giữ nguyên.

-- ---- 1. Ghi bù "đã nhận" tự động cho người theo dõi mới của căn dữ liệu 0128 ----
DO $$
DECLARE v_so integer;
BEGIN
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  SELECT n."id", n."nguoi_theo_doi", 'xac_nhan_nhan_viec',
         CASE WHEN a."role_group" = 'A3' THEN 'tự động khi giao (cấu hình không yêu cầu xác nhận) '
              ELSE 'tự động khi giao (lãnh đạo không phải xác nhận nhận việc) ' END
         || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app'
  FROM "public"."nhiem_vu" n JOIN "public"."accounts" a ON a."id" = n."nguoi_theo_doi"
  WHERE coalesce(n."theo_1400", false) AND n."tien_do_ma" IS DISTINCT FROM 'HOAN_THANH' AND n."dong_luc" IS NULL AND NOT a."is_system"
    AND (a."role_group" IN ('A1', 'A2') OR (a."role_group" = 'A3' AND "public"."kl_tu_nhan_viec"()))
    AND EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'nguoi_theo_doi' AND l."nguoi_sua" IS NULL
                  AND l."nguoi_sua_ghi_chu" = 'Hệ thống — v3.31: người theo dõi theo chủ trì theo dõi' AND l."gia_tri_moi" = n."nguoi_theo_doi"::text)
    AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = n."nguoi_theo_doi");
  GET DIAGNOSTICS v_so = ROW_COUNT;
  RAISE NOTICE '0129: ghi bù % dòng "đã nhận" tự động cho người theo dõi mới (căn dữ liệu 0128)', v_so;
END;
$$;

-- ---- 2. Quản trị › "Chuyển việc đang chủ trì theo dõi": bản 0128, sửa câu báo bỏ qua ----
CREATE OR REPLACE FUNCTION "public"."admin_chuyen_theo_doi"("p_tu" uuid, "p_den" uuid, "p_ly_do" text, "p_thuc_hien" boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tu "public"."accounts"; v_den "public"."accounts"; v_dv "public"."dm_don_vi"; v_ly_do text := btrim(coalesce("p_ly_do", ''));
        v_ids uuid[]; v_ma text[]; v_ct boolean[]; v_xong text[] := '{}'; v_bo jsonb := '[]'::jsonb; v_sau uuid;
BEGIN
  IF NOT ("public"."me_quan_tri_he_thong"() OR "public"."la_chanh_van_phong"()) THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống hoặc Chánh Văn phòng mới chuyển việc chủ trì theo dõi.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tu FROM "public"."accounts" WHERE "id" = "p_tu";
  SELECT * INTO v_den FROM "public"."accounts" WHERE "id" = "p_den";
  IF v_tu."id" IS NULL OR v_den."id" IS NULL OR v_tu."id" = v_den."id" THEN RAISE EXCEPTION 'Chọn người cũ và người nhận khác nhau.' USING ERRCODE = '22023'; END IF;
  IF v_den."is_system" OR coalesce(v_den."bi_khoa", false) OR v_den."role_group" = 'A0' THEN
    RAISE EXCEPTION 'Người nhận phải là cán bộ Văn phòng đang hoạt động.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_den."department" LIMIT 1;
  IF v_dv."ma" IS NULL AND v_den."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
  IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (phòng) của người nhận.' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(array_agg("id" ORDER BY "ma"), '{}'), coalesce(array_agg("ma" ORDER BY "ma"), '{}'), coalesce(array_agg("owner_tai_khoan" IS NOT NULL ORDER BY "ma"), '{}')
    INTO v_ids, v_ma, v_ct
  FROM "public"."nhiem_vu" WHERE "tien_do_ma" <> 'HOAN_THANH' AND "dong_luc" IS NULL
    AND ("owner_tai_khoan" = v_tu."id" OR ("owner_tai_khoan" IS NULL AND "nguoi_theo_doi" = v_tu."id"));
  IF NOT coalesce("p_thuc_hien", false) THEN RETURN jsonb_build_object('so_viec', cardinality(v_ids), 'ma', to_jsonb(v_ma[1:20])); END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_ids) = 0 THEN RETURN jsonb_build_object('so_viec', 0, 'ma', '[]'::jsonb, 'bo_qua', '[]'::jsonb); END IF;
  -- Từng việc một khối con: việc lệch ràng buộc nghiệp vụ giữ nguyên, trả mã + lý do.
  FOR i IN 1 .. cardinality(v_ids) LOOP
    BEGIN
      PERFORM set_config('kl.ghi_qua_ham', '1', true);
      IF v_ct[i] THEN
        UPDATE "public"."nhiem_vu" SET "owner_tai_khoan" = v_den."id", "owner_don_vi_ma" = v_dv."ma",
          "cap_nhan_san_pham" = "public"."kl_cap_nhan_mac_dinh"(v_den, v_dv) WHERE "id" = v_ids[i];
      ELSE
        UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_den."id" WHERE "id" = v_ids[i] RETURNING "nguoi_theo_doi" INTO v_sau;   -- trigger 0128 tính lại
      END IF;
      PERFORM set_config('kl.ghi_qua_ham', '', true);
      IF NOT v_ct[i] AND v_sau IS DISTINCT FROM v_den."id" THEN   -- lỗi trong khối con: thay đổi của việc này được hoàn lại
        RAISE EXCEPTION 'Việc giao cho phòng / Văn phòng: người nhận thay là người đang giữ chức Trưởng phòng / Chánh Văn phòng% — đổi chức danh ở Quản trị › Tài khoản trước.',
          CASE WHEN v_sau IS DISTINCT FROM v_tu."id" THEN coalesce(' (' || (SELECT a."full_name" FROM "public"."accounts" a WHERE a."id" = v_sau) || ')', '') ELSE '' END;
      END IF;
      INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
      VALUES (v_ids[i], "auth"."uid"(), 'chuyen_theo_doi', v_tu."full_name", format('Chuyển chủ trì theo dõi từ %s sang %s — lý do: %s', v_tu."full_name", v_den."full_name", v_ly_do), 'app');
      v_xong := v_xong || v_ma[i];
    EXCEPTION WHEN OTHERS THEN
      v_bo := v_bo || jsonb_build_object('ma', v_ma[i], 'loi', SQLERRM);
    END;
  END LOOP;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_ma := v_xong;
  IF cardinality(v_ma) = 0 THEN RETURN jsonb_build_object('so_viec', 0, 'ma', '[]'::jsonb, 'bo_qua', v_bo); END IF;
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  VALUES ("auth"."uid"(), v_den."id", format('Đồng chí được giao chủ trì theo dõi %s nhiệm vụ đang mở (trước do %s chủ trì theo dõi): %s%s — lý do: %s', cardinality(v_ma), v_tu."full_name",
          array_to_string(v_ma[1:10], ', '), CASE WHEN cardinality(v_ma) > 10 THEN ', …' ELSE '' END, v_ly_do), false, 'he_thong', NULL);
  PERFORM "public"."nhat_ky_ghi"('chuyen_theo_doi', v_den."username",
    jsonb_build_object('tu', v_tu."username", 'den', v_den."username", 'so_viec', cardinality(v_ma), 'bo_qua', jsonb_array_length(v_bo), 'ly_do', v_ly_do));
  RETURN jsonb_build_object('so_viec', cardinality(v_ma), 'ma', to_jsonb(v_ma[1:20]), 'bo_qua', v_bo);
END;
$$;
REVOKE ALL ON FUNCTION "public"."admin_chuyen_theo_doi"(uuid, uuid, text, boolean) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."admin_chuyen_theo_doi"(uuid, uuid, text, boolean) TO "authenticated";
