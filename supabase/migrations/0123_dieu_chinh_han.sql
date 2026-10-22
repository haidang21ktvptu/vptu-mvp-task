-- 0123 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-4): điều chỉnh hạn xử lý ngay trên nhiệm vụ, lý do bắt buộc, có nhật ký và tin báo.
-- 1. kl_la_thu_ky_tt(): người gọi là thư ký Thường trực đang hoạt động (cờ accounts.thu_ky_thuong_truc, không phải Thường trực, tài khoản hệ thống
--    hay tài khoản khoá) — dùng cho các quyền ghi mới của thư ký (0123, 0124). me_thu_ky_tt() (0047) giữ nguyên cho các chỗ đang dùng.
-- 2. nguoi_lien_quan (bản 0030): thư ký Thường trực làm việc trên mọi nhiệm vụ (0123, 0124) — tin báo vẫn tới đúng người liên quan của việc,
--    kể cả việc ngoài phạm vi theo dõi cũ của thư ký (trước đây người gọi không "thấy" việc theo kl_thay_nhiem_vu ⇒ danh sách rỗng).
-- 3. kl_ghi_vet_viec(nhiệm vụ, cột, nội dung, tin, thêm[]): một dòng lịch sử (cột riêng, hiện ở Diễn biến) + tin hệ thống cho người liên quan
--    (nguoi_lien_quan), người giao (người được thay mặt, người tạo việc) và danh sách thêm — không người vừa làm, không Thường trực, không tài
--    khoản hệ thống / khoá. Hàm nội bộ (chỉ gọi từ hàm SECURITY DEFINER).
-- 4. dieu_chinh_han(p_id, p_han_moi, p_ly_do) → { han_cu, han_moi, gia_han, so_lan_gia_han }:
--    - chủ trì theo dõi (người chịu trách nhiệm: tài khoản chủ trì; việc giao cho phòng / đơn vị thì người theo dõi) — việc chưa hoàn thành và
--      CHƯA QUÁ HẠN (hạn ≥ hôm nay), mọi loại văn bản kể cả Kết luận Ban Thường vụ, Thông báo Thường trực;
--    - thư ký Thường trực — mọi việc chưa hoàn thành, kể cả đã quá hạn;
--    - tài khoản toàn quyền (0100) — mọi việc, kể cả đã hoàn thành.
--    Lãnh đạo Văn phòng vẫn "Gia hạn" bằng chỉ đạo (chi_dao_gui GIA_HAN) như cũ; người khác bị chặn (42501).
--    Quy tắc: việc đã có hạn (chưa có hạn thì điền ở Cập nhật); hạn mới khác hạn cũ; lý do bắt buộc, tối đa 500 ký tự. Trigger giữ các ràng buộc cũ
--    (không trước ngày ban hành; hạn việc con không sau hạn việc cha; không rút hạn việc cha xuống trước hạn việc con). Lùi hạn = gia hạn
--    (so_lan_gia_han + 1); rút ngắn không cộng. "Theo ngày ký ban hành" chuyển thành "Có hạn cụ thể" (không thì trigger tính lại hạn).
--    Nhật ký: trigger lịch sử ghi hạn cũ → mới (người, lúc); thêm dòng 'dieu_chinh_han' "30/10/2026 → 15/11/2026 (gia hạn lần 2) — lý do: …".

-- ---- 1 ----
CREATE FUNCTION "public"."kl_la_thu_ky_tt"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT a."thu_ky_thuong_truc" AND a."role_group" <> 'A0' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)
                   FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_la_thu_ky_tt"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_la_thu_ky_tt"() TO "authenticated";

-- ---- 2 ---- (bản 0030 + nhánh thư ký ở điều kiện người gọi)
CREATE OR REPLACE FUNCTION "public"."nguoi_lien_quan"("p_nhiem_vu" uuid) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH nv AS (SELECT n.*, "public"."kl_phong_owner"(n."owner_tai_khoan", n."owner_don_vi_ma") AS phong_owner,
                     (SELECT "department" FROM "public"."accounts" WHERE "id" = n."nguoi_theo_doi") AS phong_theo_doi
              FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"
                AND ("auth"."uid"() IS NULL OR "public"."kl_thay_nhiem_vu"("p_nhiem_vu") OR "public"."kl_la_thu_ky_tt"())),
  phong AS (SELECT phong_owner AS p FROM nv UNION SELECT phong_theo_doi FROM nv),
  ds AS (
    SELECT "owner_tai_khoan" FROM nv UNION SELECT "nguoi_theo_doi" FROM nv
    UNION SELECT a."id" FROM "public"."accounts" a, phong WHERE a."role_group" = 'A2' AND a."department" = phong.p
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, nv."nganh_ma", nv."linh_vuc_ma") FROM phong, nv
    UNION SELECT a."id" FROM "public"."accounts" a, nv WHERE a."is_chief" AND a."role_group" = 'A1'
    UNION SELECT c."nguoi_gui" FROM "public"."chi_dao" c JOIN nv ON c."nhiem_vu_id" = nv."id")
  SELECT DISTINCT ds."owner_tai_khoan" FROM ds JOIN "public"."accounts" a ON a."id" = ds."owner_tai_khoan"
  WHERE NOT a."is_system" AND a."role_group" <> 'A0' AND ds."owner_tai_khoan" IS DISTINCT FROM "auth"."uid"();
$$;

-- ---- 3 ----
CREATE FUNCTION "public"."kl_ghi_vet_viec"("p_nhiem_vu" uuid, "p_cot" text, "p_noi_dung" text, "p_tin" text, "p_them" uuid[] DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"();
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v."id" IS NULL THEN RETURN; END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v."id", v_me, "p_cot", "p_noi_dung", 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me, a."id", "p_tin", false, 'he_thong', v."id"
  FROM "public"."accounts" a
  WHERE a."id" IN (SELECT "public"."nguoi_lien_quan"(v."id")
                   UNION SELECT unnest(ARRAY[v."giao_thay_mat_cho", v."tao_boi"] || coalesce("p_them", '{}'::uuid[])))
    AND a."id" IS DISTINCT FROM v_me AND NOT a."is_system" AND a."role_group" <> 'A0' AND NOT coalesce(a."bi_khoa", false);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ghi_vet_viec"(uuid, text, text, text, uuid[]) FROM public, "anon", "authenticated";

-- ---- 4 ----
CREATE FUNCTION "public"."dieu_chinh_han"("p_id" uuid, "p_han_moi" date, "p_ly_do" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_ly_do text := btrim(coalesce("p_ly_do", '')); v_tq boolean := "public"."me_toan_quyen"();
        v_tk boolean := "public"."kl_la_thu_ky_tt"(); v_gia_han boolean; v_so integer; v_nd text;
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR v_me IS NULL OR NOT (v_tq OR v_tk OR coalesce(v."owner_tai_khoan", v."nguoi_theo_doi") = v_me) THEN
    RAISE EXCEPTION 'Chỉ cán bộ chủ trì theo dõi, thư ký Thường trực hoặc tài khoản quản trị mới điều chỉnh hạn của nhiệm vụ này. Lãnh đạo Văn phòng gia hạn ở mục Chỉ đạo.'
      USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' AND NOT v_tq THEN RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không điều chỉnh hạn.' USING ERRCODE = '22023'; END IF;
  IF v."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Nhiệm vụ chưa có hạn xử lý — điền hạn ở Cập nhật.' USING ERRCODE = '22023'; END IF;
  IF NOT (v_tq OR v_tk) AND v."han_xu_ly" < "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Nhiệm vụ đã quá hạn (hạn %) — đồng chí đề nghị lãnh đạo giao việc gia hạn.', to_char(v."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '42501';
  END IF;
  IF "p_han_moi" IS NULL THEN RAISE EXCEPTION 'Chọn hạn mới.' USING ERRCODE = '22023'; END IF;
  IF "p_han_moi" = v."han_xu_ly" THEN RAISE EXCEPTION 'Hạn mới trùng hạn hiện tại (%).', to_char(v."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023'; END IF;
  IF v_ly_do = '' OR char_length(v_ly_do) > 500 THEN RAISE EXCEPTION 'Lý do điều chỉnh hạn bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  v_gia_han := "p_han_moi" > v."han_xu_ly";
  PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3: đổi hạn qua hàm (như chi_dao_gui GIA_HAN); trigger 0015/0023 vẫn kiểm ngày
  UPDATE "public"."nhiem_vu" SET "han_xu_ly" = "p_han_moi", "so_lan_gia_han" = "so_lan_gia_han" + CASE WHEN v_gia_han THEN 1 ELSE 0 END,
    "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END
  WHERE "id" = v."id" RETURNING "so_lan_gia_han" INTO v_so;
  PERFORM set_config('kl.ghi_qua_ham', '', true);
  v_nd := format('%s → %s%s — lý do: %s', to_char(v."han_xu_ly", 'DD/MM/YYYY'), to_char("p_han_moi", 'DD/MM/YYYY'),
                 CASE WHEN v_gia_han THEN format(' (gia hạn lần %s)', v_so) ELSE ' (rút ngắn hạn)' END, v_ly_do);
  PERFORM "public"."kl_ghi_vet_viec"(v."id", 'dieu_chinh_han', v_nd, format('Điều chỉnh hạn · %s: %s', v."ma", left(v_nd, 300)));
  RETURN jsonb_build_object('han_cu', v."han_xu_ly", 'han_moi', "p_han_moi", 'gia_han', v_gia_han, 'so_lan_gia_han', v_so);
END;
$$;
REVOKE ALL ON FUNCTION "public"."dieu_chinh_han"(uuid, date, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."dieu_chinh_han"(uuid, date, text) TO "authenticated";
