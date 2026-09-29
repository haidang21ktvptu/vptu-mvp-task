-- 0052: Vá phân quyền (PR-2a, thiết kế C1, C2 phần DB, C3, Q7). Không đổi phạm vi ĐỌC nhiem_vu/bảng con; chỉ quyền GHI + ảnh hồ sơ.
-- C3. kl_pham_vi_pcvp_cua(lãnh đạo, phòng, ngành, lĩnh vực): như kl_pham_vi_pcvp nhưng cho một lãnh đạo bất kỳ (nhánh quan_tri_kl thay mặt
--     PCVP xét quyền của NGƯỜI ĐƯỢC THAY MẶT); kl_pham_vi_pcvp gọi bản mới với auth.uid(). giao_viec (0045, nhánh A1 không phải Chánh VP và
--     nhánh thay mặt A1): thay phu_trach(…, phòng) bằng kl_pham_vi_pcvp_cua(…, phòng, ngành, lĩnh vực của việc) cho Owner và người theo dõi
--     ⇒ kiêm nhiệm hiệu lực hôm nay của TÔI ⇒ được giao; (ngành, lĩnh vực) có NGƯỜI KHÁC kiêm nhiệm ⇒ không được (kể cả phụ trách cả phòng);
--     không có kiêm nhiệm / việc không có ngành–lĩnh vực ⇒ như cũ (phân công cả phòng). GIAO_LAI (0045) giữ phu_trach — đề xuất F4.
-- C1. van_ban_dat_trich_yeu: (tao_boi = tôi OR A1 OR quan_tri_kl) IS NOT TRUE ⇒ chặn — văn bản tao_boi NULL chỉ A1 / quan_tri_kl sửa được.
-- C2. Bucket anh-ho-so riêng tư; đọc: mọi người đã đăng nhập (Q5 a), anon không có policy ⇒ bị chặn; ghi/sửa/xoá: chỉ chủ thư mục <uid>/.
--     cap_nhat_ho_so nhận ĐƯỜNG DẪN '<uid>/<tên tệp>' (tiền tố = auth.uid(), không '..', ≤ 200 ký tự); không nhận URL https:// nữa
--     (production 0 ảnh — đếm 28/9). Frontend hiển thị bằng signed URL (Lượt 4).
-- C3 (Lượt 4). kl_duoc_giao_cho_phong(người giao, phòng Owner, ngành, lĩnh vực, người được thay mặt): MỘT nguồn phần "phòng" của quy tắc
--     giao_viec — Chánh VP / lãnh đạo giữ quan_tri_kl: mọi Owner; PCVP: phòng có trong kl_pham_vi_pcvp_cua, Owner không thuộc phòng nào (Văn phòng,
--     đơn vị ngoài) thì không; A2: phòng mình; quan_tri_kl giao thay mặt: theo người được thay mặt (A2: phòng người đó; PCVP: như trên nhưng Owner
--     không thuộc phòng được phép — giữ nguyên hành vi 0045). giao_viec (nhánh A2, PCVP, thay mặt) và kl_pham_vi_giao cùng gọi, nên biểu mẫu
--     Giao việc chỉ đưa ra đúng tổ hợp DB cho giao (test kl-pq-pham-vi-giao đối chiếu từng tổ hợp).
-- Q7. Owner / người theo dõi (không phải quan_tri_kl) không tự đổi han_xu_ly của việc ĐANG CÓ hạn qua API (UPDATE trực tiếp); điền hạn khi
--     đang NULL vẫn được. Chặn ở trigger a_nhiem_vu_guard_a3 (chạy trước b_nhiem_vu_truoc_ghi, thấy đúng giá trị người gọi gửi) khi
--     current_user = 'authenticated' — các hàm SECURITY DEFINER (GIA_HAN, duyệt đính chính, đổi ngày văn bản…) chạy dưới chủ hàm nên không bị chặn.

CREATE OR REPLACE FUNCTION "public"."kl_pham_vi_pcvp_cua"("p_lanh_dao" uuid, "p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "p_phong" IS NOT NULL AND coalesce((
    SELECT CASE WHEN kn."id" IS NOT NULL THEN kn."id" = "p_lanh_dao"
                ELSE "public"."phu_trach"("p_lanh_dao", "p_phong", "public"."kl_hom_nay"()) END
    FROM (SELECT "public"."nguoi_kiem_nhiem"("p_phong", "p_nganh_ma", "p_linh_vuc_ma", "public"."kl_hom_nay"()) AS "id") kn), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_pham_vi_pcvp_cua"(uuid, text, text, text) FROM public, "anon", "authenticated";

CREATE OR REPLACE FUNCTION "public"."kl_pham_vi_pcvp"("p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "public"."kl_pham_vi_pcvp_cua"("auth"."uid"(), "p_phong", "p_nganh_ma", "p_linh_vuc_ma");
$$;

CREATE OR REPLACE FUNCTION "public"."kl_duoc_giao_cho_phong"("p_nguoi" uuid, "p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text, "p_thay_mat" uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN "p_thay_mat" IS NOT NULL THEN a."role_group" = 'A3' AND a."quan_tri_kl" AND CASE
          WHEN tm."id" IS NULL OR tm."is_system" THEN false
          WHEN tm."role_group" = 'A2' THEN tm."department" = "p_phong"
          WHEN tm."role_group" = 'A1' AND tm."is_chief" THEN true
          WHEN tm."role_group" = 'A1' THEN "p_phong" IS NULL OR "public"."kl_pham_vi_pcvp_cua"(tm."id", "p_phong", "p_nganh_ma", "p_linh_vuc_ma")
          ELSE false END
      WHEN a."quan_tri_kl" AND a."role_group" IN ('A1', 'A2') THEN true
      WHEN a."role_group" = 'A1' AND a."is_chief" THEN true
      WHEN a."role_group" = 'A1' THEN "p_phong" IS NOT NULL AND "public"."kl_pham_vi_pcvp_cua"(a."id", "p_phong", "p_nganh_ma", "p_linh_vuc_ma")
      WHEN a."role_group" = 'A2' THEN a."department" = "p_phong"
      ELSE false END
    FROM "public"."accounts" a LEFT JOIN "public"."accounts" tm ON tm."id" = "p_thay_mat"
    WHERE a."id" = "p_nguoi" AND NOT a."is_system"), false);
$$;
REVOKE ALL ON FUNCTION "public"."kl_duoc_giao_cho_phong"(uuid, text, text, text, uuid) FROM public, "anon", "authenticated";

CREATE OR REPLACE FUNCTION "public"."giao_viec"("p" jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts"; v_tm "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true); v_a0 boolean; v_do_khan text;
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
        v_nhan uuid; v_nguoi uuid[] := ARRAY[]::uuid[]; v_tin text; v_han date := nullif("p" ->> 'han_xu_ly', '')::date;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  v_a0 := v_me."role_group" = 'A0';
  IF v_me."id" IS NULL OR (v_me."role_group" NOT IN ('A0', 'A1', 'A2') AND NOT v_me."quan_tri_kl") THEN
    RAISE EXCEPTION 'Chỉ Thường trực, lãnh đạo Văn phòng, trưởng phòng hoặc người quản trị KL mới được giao việc.' USING ERRCODE = '42501';
  END IF;
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_a0 THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF ("p" ? 'uu_tien') AND NOT v_a0 THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt ưu tiên Thường trực.' USING ERRCODE = '42501'; END IF;
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id")
    RETURNING * INTO v_vb;
  ELSIF v_a0 THEN   -- Thường trực giao trực tiếp, không kèm văn bản: một văn bản loại KHAC ghi mốc giao.
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES ('KHAC', 'Thường trực giao ' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS.MS'), "public"."kl_hom_nay"(), "public"."kl_hom_nay"(), 'Thường trực Tỉnh ủy', v_me."id")
    RETURNING * INTO v_vb;
  ELSE
    RAISE EXCEPTION 'Nhiệm vụ phải gắn với một văn bản giao việc.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "p" ->> 'owner_don_vi_ma';
  IF v_1400 AND v_dv."ma" IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ phải có một Owner chịu trách nhiệm (đơn vị, phòng hoặc cán bộ) — nguyên tắc 1 Owner.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'owner_tai_khoan', '') IS NOT NULL THEN
    SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("p" ->> 'owner_tai_khoan')::uuid;
    IF v_owner."id" IS NULL OR v_owner."is_system" THEN RAISE EXCEPTION 'Tài khoản Owner không hợp lệ.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_phong_owner := coalesce(v_owner."department", v_dv."phong");
  IF v_a0 THEN   -- Người nhận việc Thường trực giao: lãnh đạo Văn phòng (theo dõi = chính họ) hoặc Trưởng phòng của phòng được giao.
    IF v_owner."id" IS NOT NULL AND v_owner."role_group" = 'A1' THEN v_theo_doi := v_owner;
    ELSIF v_owner."id" IS NULL AND v_dv."trong_van_phong" AND v_dv."phong" IS NOT NULL THEN
      SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "role_group" = 'A2' AND "department" = v_dv."phong" AND NOT "is_system" ORDER BY "username" LIMIT 1;
      IF v_theo_doi."id" IS NULL THEN RAISE EXCEPTION 'Phòng % chưa có Trưởng phòng để nhận việc Thường trực giao.', v_dv."ten" USING ERRCODE = '22023'; END IF;
    ELSE RAISE EXCEPTION 'Thường trực Tỉnh ủy giao việc cho lãnh đạo Văn phòng hoặc một phòng của Văn phòng.' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "id" = coalesce(nullif("p" ->> 'nguoi_theo_doi', '')::uuid, v_me."id");
    IF v_theo_doi."id" IS NULL OR v_theo_doi."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Giao thay mặt: người giao không phải lãnh đạo (A3 giữ quan_tri_kl) phải ghi lãnh đạo A1/A2 được thay mặt, trong phạm vi Owner.
  IF v_me."role_group" = 'A3' THEN
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'thay_mat_cho', '')::uuid;
    IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
      RAISE EXCEPTION 'Người quản trị KL giao việc phải thay mặt một lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A2' AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") THEN
      RAISE EXCEPTION 'Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A1' AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") THEN
      RAISE EXCEPTION 'Phó Chánh Văn phòng được thay mặt phải phụ trách phòng của Owner.' USING ERRCODE = '22023';
    END IF;
  ELSIF nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  IF NOT v_me."quan_tri_kl" AND NOT v_a0 THEN   -- GV-3 (0025)
    IF v_dv."ma" IS NOT NULL AND NOT v_dv."trong_van_phong" THEN
      RAISE EXCEPTION 'Việc có Owner là đơn vị ngoài Văn phòng chỉ người quản trị KL nhập theo kết luận.' USING ERRCODE = '42501';
    ELSIF v_me."role_group" = 'A2' THEN
      IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_owner."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ giao việc cho chuyên viên phòng mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng của đồng chí.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_me."is_chief" THEN
      IF NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Phó Chánh Văn phòng chỉ giao việc cho phòng, cán bộ được phân công phụ trách.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng đồng chí phụ trách.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  IF v_1400 THEN   -- 1-1-1 (0025)
    IF nullif("p" ->> 'san_pham_loai', '') IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải định nghĩa sản phẩm đầu ra (tờ trình, báo cáo, dự thảo…) — nguyên tắc 1 Product.' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((SELECT "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han" WHERE "ma" = v_loai_han), false) THEN
      RAISE EXCEPTION 'Việc mới phải có thời hạn: chọn "Có hạn cụ thể" hoặc "Ký ban hành".' USING ERRCODE = '22023';
    END IF;
    IF v_loai_han = 'CO_HAN_CU_THE' AND v_han IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải có hạn hoàn thành cụ thể — nguyên tắc 1 Deadline.' USING ERRCODE = '22023';
    END IF;
    IF v_vb."loai" IN ('KL_BTV', 'TB_THUONG_TRUC') AND (nullif("p" ->> 'nganh_ma', '') IS NULL OR nullif("p" ->> 'linh_vuc_ma', '') IS NULL) THEN
      RAISE EXCEPTION 'Việc từ kết luận/thông báo phải chọn ngành và lĩnh vực (để phân công lãnh đạo phụ trách).' USING ERRCODE = '22023';
    END IF;
    v_cap := coalesce(nullif("p" ->> 'cap_nhan_san_pham', ''), "public"."kl_cap_nhan_mac_dinh"(v_owner, v_dv)); -- 0045: một quy tắc dùng chung với giao lại
  END IF;
  IF v_a0 THEN PERFORM set_config('kl.thuong_truc', '1', true); END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi",
    "do_khan", "giao_thay_mat_cho", "uu_tien")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, v_han, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id", v_do_khan, v_tm."id", CASE WHEN v_a0 THEN 'THUONG_TRUC' END)
  RETURNING "id", "ma", "han_xu_ly" INTO v_id, v_ma, v_han;
  PERFORM set_config('kl.thuong_truc', '', true);
  -- Vết và tin hệ thống.
  v_nhan := coalesce(v_owner."id", v_theo_doi."id");
  IF v_tm."id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_thay_mat', format('%s giao thay mặt %s', v_me."full_name", v_tm."full_name"), 'app');
    v_nguoi := v_nguoi || v_tm."id";
  END IF;
  IF v_a0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Thường trực Tỉnh ủy giao, độ khẩn %s, người nhận %s', "public"."ten_do_khan"(v_do_khan), v_theo_doi."full_name"), 'app');
  END IF;
  IF v_a0 OR v_tm."id" IS NOT NULL OR v_do_khan <> 'THUONG' THEN v_nguoi := v_nguoi || v_nhan || v_theo_doi."id"; END IF;
  IF v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN v_nguoi := v_nguoi || "public"."lanh_dao_truc_tiep"(v_nhan); END IF;
  IF v_a0 OR v_do_khan = 'HOA_TOC' THEN v_nguoi := v_nguoi || (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1); END IF;
  v_tin := format('%s · %s: %s (hạn %s)', CASE WHEN v_a0 THEN 'Thường trực giao việc' WHEN v_tm."id" IS NOT NULL THEN 'Giao việc thay mặt ' || v_tm."full_name" ELSE 'Giao việc' END
    || CASE WHEN v_do_khan <> 'THUONG' THEN ' · ' || "public"."ten_do_khan"(v_do_khan) ELSE '' END, v_ma, left(btrim("p" ->> 'noi_dung'), 120), coalesce(to_char(v_han, 'DD/MM/YYYY'), 'ký ban hành'));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT v_me."id", u, v_tin, false, 'he_thong', v_id FROM unnest(v_nguoi) u JOIN "public"."accounts" a ON a."id" = u
  WHERE u <> v_me."id" AND NOT a."is_system" AND a."role_group" <> 'A0';
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$function$;

-- Tổ hợp (phòng, ngành, lĩnh vực) người gọi được giao — hoặc, khi người gọi giữ quan_tri_kl, giao thay mặt p_thay_mat. Ngành/lĩnh vực NULL =
-- việc không có ngành–lĩnh vực; phòng NULL = Owner không thuộc phòng nào (Văn phòng, đơn vị ngoài; một dòng). Ứng viên: (phòng của Văn phòng
-- × ({NULL} ∪ dm_linh_vuc)) ∪ (NULL, NULL, NULL); lọc bằng CHÍNH kl_duoc_giao_cho_phong.
CREATE OR REPLACE FUNCTION "public"."kl_pham_vi_giao"("p_thay_mat" uuid DEFAULT NULL)
RETURNS TABLE ("phong" text, "nganh_ma" text, "linh_vuc_ma" text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH phong AS (SELECT DISTINCT d."phong" FROM "public"."dm_don_vi" d WHERE d."trong_van_phong" AND d."phong" IS NOT NULL UNION ALL SELECT NULL::text),
       lv AS (SELECT NULL::text AS "nganh_ma", NULL::text AS "ma" UNION ALL SELECT l."nganh_ma", l."ma" FROM "public"."dm_linh_vuc" l)
  SELECT p."phong", lv."nganh_ma", lv."ma" FROM phong p CROSS JOIN lv
  WHERE (p."phong" IS NOT NULL OR lv."ma" IS NULL) AND "auth"."uid"() IS NOT NULL
    AND "public"."kl_duoc_giao_cho_phong"("auth"."uid"(), p."phong", lv."nganh_ma", lv."ma", "p_thay_mat")
  ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;
$$;
REVOKE ALL ON FUNCTION "public"."kl_pham_vi_giao"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_pham_vi_giao"(uuid) TO "authenticated";

CREATE OR REPLACE FUNCTION "public"."van_ban_dat_trich_yeu"("p_id" uuid, "p_trich_yeu" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_moi text := nullif(btrim(coalesce("p_trich_yeu", '')), '');
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_id";
  IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  -- IS NOT TRUE: tao_boi NULL (văn bản nhập bằng script) làm biểu thức thành NULL — trước đây IF NOT NULL không chặn (C1).
  IF "auth"."uid"() IS NULL OR (v_vb."tao_boi" = "auth"."uid"() OR "public"."me_role"() = 'A1' OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ người tạo văn bản, lãnh đạo Văn phòng hoặc quản trị nhiệm vụ mới sửa trích yếu văn bản.' USING ERRCODE = '42501';
  END IF;
  IF v_moi IS NOT DISTINCT FROM v_vb."trich_yeu" THEN RETURN; END IF;
  UPDATE "public"."van_ban_giao_viec" SET "trich_yeu" = v_moi WHERE "id" = "p_id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", "auth"."uid"(), 'van_ban_trich_yeu', v_vb."trich_yeu", v_moi, 'app' FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = "p_id";
END;
$$;

CREATE OR REPLACE FUNCTION "public"."cap_nhat_ho_so"("p_dien_thoai" text, "p_anh_url" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dt text := nullif(btrim(coalesce("p_dien_thoai", '')), '');
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  IF v_dt IS NOT NULL AND v_dt !~ '^[0-9][0-9 .()+-]{7,19}$' THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ (8–20 ký tự số).' USING ERRCODE = '22023';
  END IF;
  -- Ảnh: đường dẫn tệp trong bucket riêng tư anh-ho-so, thư mục của chính mình (C2).
  IF "p_anh_url" IS NOT NULL AND (length("p_anh_url") > 200 OR position('..' IN "p_anh_url") > 0
      OR left("p_anh_url", 37) <> "auth"."uid"()::text || '/' OR length("p_anh_url") <= 37) THEN
    RAISE EXCEPTION 'Đường dẫn ảnh không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."accounts" SET "dien_thoai" = v_dt, "anh_url" = "p_anh_url" WHERE "id" = "auth"."uid"();
END;
$$;

UPDATE "storage"."buckets" SET "public" = false WHERE "id" = 'anh-ho-so';
DROP POLICY "anh_ho_so_ghi" ON "storage"."objects";
DROP POLICY "anh_ho_so_sua" ON "storage"."objects";
DROP POLICY "anh_ho_so_xoa" ON "storage"."objects";
CREATE POLICY "anh_ho_so_doc" ON "storage"."objects" FOR SELECT TO "authenticated"
  USING ("bucket_id" = 'anh-ho-so');
CREATE POLICY "anh_ho_so_ghi" ON "storage"."objects" FOR INSERT TO "authenticated"
  WITH CHECK ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text);
CREATE POLICY "anh_ho_so_sua" ON "storage"."objects" FOR UPDATE TO "authenticated"
  USING ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text);
CREATE POLICY "anh_ho_so_xoa" ON "storage"."objects" FOR DELETE TO "authenticated"
  USING ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text);

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() OR current_setting('kl.chi_dao', true) = '1' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  -- Q7: UPDATE trực tiếp qua API (vai authenticated) không đổi hạn đã có; điền khi đang NULL được. Đổi hạn đi qua đề nghị gia hạn.
  IF current_user = 'authenticated' AND OLD."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly" THEN
    RAISE EXCEPTION 'Việc đã có hạn xử lý: muốn đổi hạn phải đề nghị gia hạn.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
