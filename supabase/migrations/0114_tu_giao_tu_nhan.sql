-- 0114 (v3.25 — đợt sửa sau kiểm tay staging 18/10/2026, chủ dự án duyệt mục "nhập liệu nhanh hơn"): người tự giao việc cho CHÍNH MÌNH được tính
-- "đã nhận" ngay khi giao — không phải bấm "Xác nhận đã nhận việc" cho việc của chính mình (kiểm tay: chuyên viên tự giao vẫn phải xác nhận khi
-- kl_cau_hinh.xac_nhan_nhan_viec = 1).
-- nhiem_vu_tu_nhan_viec (trigger zd_nhiem_vu_tu_nhan_viec, bản 0090) thêm một trường hợp: Owner tài khoản là chuyên viên (A3) và chính là người
-- thực hiện thao tác (auth.uid() — giao_viec, giao_viec_nhieu, giao lại, nhập Excel) → ghi lich_su 'xac_nhan_nhan_viec' "tự động khi giao (người giao
-- tự nhận việc của mình)". Chỉ Owner (người nhận chính) — người giao làm NGƯỜI THEO DÕI việc giao cho người khác không được ghi (nếu ghi, việc tính là
-- "đã nhận" khi Owner chưa nhận — lỗi 0094 đã sửa cho lãnh đạo). Câu ghi không khớp mẫu "lãnh đạo không phải xác nhận" của kl_nhan_tu_dong_lanh_dao
-- nên tính là việc đã được nhận (v_nhiem_vu.da_xac_nhan_nhan, da_nhan_viec). Chỉ khi TẠO việc hoặc ĐỔI Owner (giao, giao lại) — người nhận gửi lại
-- chính Owner của mình trong một lần cập nhật khác không được ghi "tự nhận" (rà soát độc lập 18/10). Lãnh đạo, cấu hình 2: như 0090. Việc giao trước
-- bản này: giữ nguyên (không điền lại, như 0085). Không đổi bảng, view, quyền.

CREATE OR REPLACE FUNCTION "public"."nhiem_vu_tu_nhan_viec"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid; v_vai text; v_cau_hinh boolean; v_me uuid := "auth"."uid"(); v_tu_giao boolean; v_doi_owner boolean := true;
BEGIN
  IF NOT coalesce(NEW."theo_1400", false) OR NEW."tien_do_ma" = 'HOAN_THANH' OR NEW."dong_luc" IS NOT NULL THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' THEN v_doi_owner := OLD."owner_tai_khoan" IS DISTINCT FROM NEW."owner_tai_khoan"; END IF;
  v_cau_hinh := "public"."kl_tu_nhan_viec"();
  FOREACH u IN ARRAY ARRAY[NEW."owner_tai_khoan", NEW."nguoi_theo_doi"] LOOP
    CONTINUE WHEN u IS NULL;
    SELECT CASE WHEN a."is_system" THEN NULL ELSE a."role_group" END INTO v_vai FROM "public"."accounts" a WHERE a."id" = u;
    v_tu_giao := v_doi_owner AND v_me IS NOT NULL AND u = v_me AND u IS NOT DISTINCT FROM NEW."owner_tai_khoan";
    CONTINUE WHEN v_vai IS NULL OR v_vai = 'A0' OR (v_vai = 'A3' AND NOT v_cau_hinh AND NOT v_tu_giao)
      OR EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = NEW."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = u);
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (NEW."id", u, 'xac_nhan_nhan_viec', CASE WHEN v_vai = 'A3' AND v_cau_hinh THEN 'tự động khi giao (cấu hình không yêu cầu xác nhận) '
                                                     WHEN v_vai = 'A3' THEN 'tự động khi giao (người giao tự nhận việc của mình) '
                                                     ELSE 'tự động khi giao (lãnh đạo không phải xác nhận nhận việc) ' END
            || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app');
  END LOOP;
  RETURN NULL;
END;
$$;
