-- 0098 (v3.21, chủ dự án duyệt 9/10/2026 — "theo đề xuất"): chữ "thay mặt" là nhạy cảm với lãnh đạo ⇒ không còn trong tin hệ thống khi nhập việc
-- do lãnh đạo giao (lưu vết vẫn chỉ ghi "Nhập bởi <tài khoản>" — 0095). Chỉ đổi lời, không đổi quyền / dữ liệu:
-- 1. giao_viec (bản 0095): tin giao "Giao việc · …" (việc nhập thay mặt Thường trực: "Thường trực giao việc · …" như nhãn Thường trực giao);
--    trước đây "Giao việc thay mặt <lãnh đạo / nhóm> · …".
-- 2. nhap_excel_lo_xong (bản 0075): tin tổng hợp của lô "n việc ghi đồng chí là lãnh đạo giao" thay cho "n việc giao thay mặt đồng chí".
-- Giữ nguyên lời của thư ký Thường trực ("đóng thay mặt Thường trực") — quyền đó giữ theo quyết định 9/10/2026.

CREATE OR REPLACE FUNCTION "public"."giao_viec"("p" jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts"; v_tm "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true); v_a0 boolean; v_do_khan text;
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
        v_nhan uuid; v_nguoi uuid[] := ARRAY[]::uuid[]; v_tin text; v_han date := nullif("p" ->> 'han_xu_ly', '')::date; v_han_nop date;
        v_qtkl boolean := "public"."me_quan_tri_kl"();   -- cờ cũ (0041) — 0095: không còn cấp, mọi tài khoản = false; giữ cho đường thay mặt / nhập Excel
        v_lo_nhap boolean := coalesce(current_setting('kl.nhap_excel', true), '') = '1';   -- 0073: gọi từ nhap_excel_dong (0074)
        v_nhap boolean; v_dong "public"."dong_nhap"; v_lo "public"."lo_nhap";
        v_nhom text := nullif("p" ->> 'thay_mat_nhom', ''); v_nhu_a0 boolean;   -- 0079: thay mặt nhóm; Thường trực (A0 hoặc thay mặt Thường trực)
        v_a3_thang boolean := false; v_tu_nhan boolean := "public"."kl_tu_nhan_viec"();   -- 0085: chuyên viên giao thẳng; cấu hình "coi như đã nhận khi giao"
        v_muc text := upper(nullif(btrim("p" ->> 'muc_quan_trong'), '')); v_cqt text := nullif(btrim("p" ->> 'co_quan_trinh'), '');   -- 0087: thông tin nguồn
        v_ttcd uuid := nullif("p" ->> 'thuong_truc_chi_dao', '')::uuid; v_cha "public"."nhiem_vu";
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF nullif("p" ->> 'dong_nhap_id', '') IS NOT NULL THEN   -- 0073: hoàn thiện một dòng ở vùng chờ của lô nhập Excel (biểu mẫu Giao việc điền sẵn)
    SELECT * INTO v_dong FROM "public"."dong_nhap" WHERE "id" = ("p" ->> 'dong_nhap_id')::uuid FOR UPDATE;
    IF v_dong."id" IS NULL OR v_dong."ket_qua" <> 'CHO_HOAN_THIEN' THEN
      RAISE EXCEPTION 'Dòng chờ hoàn thiện không còn (đã hoàn thiện, đã bỏ hoặc lô đã hoàn tác).' USING ERRCODE = '22023';
    END IF;
    IF NOT "public"."kl_lo_cua_toi"(v_dong."lo_id") THEN   -- 0095: nhập Excel là quyền chung — chỉ hoàn thiện dòng của lô mình
      RAISE EXCEPTION 'Dòng chờ này thuộc lô nhập của người khác.' USING ERRCODE = '42501';
    END IF;
  END IF;
  v_nhap := v_lo_nhap OR v_dong."id" IS NOT NULL;
  -- 0095 (Đợt F): nhập Excel là quyền chung (kl_nguoi_nhap — mọi tài khoản trừ Thường trực). Chuyên viên nhập giao như người nhập liệu (không xét
  -- phạm vi giao của lãnh đạo — kiểm theo lãnh đạo được thay mặt, hoặc giao thẳng cho chuyên viên); lãnh đạo nhập vẫn theo phạm vi của mình.
  IF v_nhap THEN PERFORM "public"."kl_nhap_kiem_quyen"(); v_qtkl := v_qtkl OR v_me."role_group" = 'A3'; END IF;
  v_a0 := v_me."role_group" = 'A0';
  IF v_nhom IS NOT NULL AND v_nhom NOT IN ('LANH_DAO_VP', 'THUONG_TRUC') THEN RAISE EXCEPTION 'Nhóm thay mặt không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_nhom IS NOT NULL AND v_me."role_group" <> 'A3' THEN RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023'; END IF;
  v_nhu_a0 := v_a0 OR v_nhom = 'THUONG_TRUC';   -- quy tắc người nhận / ưu tiên / tin như Thường trực giao
  IF v_me."id" IS NULL OR v_me."is_system" OR coalesce(v_me."bi_khoa", false) THEN   -- 0085: mọi vai (kể cả chuyên viên) giao được; 0095: thay mặt của mọi chuyên viên
    RAISE EXCEPTION 'Tài khoản không được giao việc.' USING ERRCODE = '42501';
  END IF;
  -- 0095 (Đợt F): mọi chuyên viên nhập việc thay mặt lãnh đạo / Thường trực được (quyền chung, lưu vết người nhập ở tao_boi + lich_su).
  IF (v_nhom IS NOT NULL OR nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL) AND v_me."role_group" = 'A3' THEN v_qtkl := true; END IF;
  IF (v_nhom IS NOT NULL OR nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL) AND NOT v_qtkl THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_nhu_a0 THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF ("p" ? 'uu_tien') AND NOT v_a0 THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt ưu tiên Thường trực.' USING ERRCODE = '42501'; END IF;
  IF v_muc IS NOT NULL AND v_muc NOT IN ('A', 'B', 'C') THEN RAISE EXCEPTION 'Mức quan trọng chỉ nhận A, B hoặc C.' USING ERRCODE = '22023'; END IF;
  -- 0087: giao tiếp xuống kế thừa ba ô nguồn của việc cha (chỉ việc người giao thấy được) khi không ghi — bỏ giá trị cũ không còn hợp lệ (đơn vị đổi
  -- thành trong Văn phòng, tài khoản không còn là Thường trực); Thường trực giao → Thường trực chỉ đạo mặc định là chính người giao.
  IF nullif("p" ->> 'nhiem_vu_cha', '') IS NOT NULL AND "public"."kl_thay_nhiem_vu"(("p" ->> 'nhiem_vu_cha')::uuid) THEN
    SELECT * INTO v_cha FROM "public"."nhiem_vu" WHERE "id" = ("p" ->> 'nhiem_vu_cha')::uuid;
  END IF;
  v_muc := coalesce(v_muc, v_cha."muc_quan_trong");
  v_cqt := coalesce(v_cqt, (SELECT d."ma" FROM "public"."dm_don_vi" d WHERE d."ma" = v_cha."co_quan_trinh" AND NOT d."trong_van_phong"));
  v_ttcd := coalesce(v_ttcd, (SELECT a."id" FROM "public"."accounts" a WHERE a."id" = v_cha."thuong_truc_chi_dao" AND a."role_group" = 'A0' AND NOT a."is_system"),
    CASE WHEN v_a0 THEN v_me."id" END);
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    -- 0095: văn bản đã có (cùng khoá duy nhất — người nhập có thể không thấy văn bản của phòng khác) → dùng lại, không báo lỗi trùng của Postgres.
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" v WHERE btrim(v."so_ket_luan") = btrim("p" #>> '{van_ban,so_ket_luan}') AND CASE
      WHEN nullif("p" #>> '{van_ban,so_hoi_nghi}', '') IS NOT NULL THEN v."so_hoi_nghi" = ("p" #>> '{van_ban,so_hoi_nghi}')::integer
      ELSE v."so_hoi_nghi" IS NULL AND v."loai" = coalesce("p" #>> '{van_ban,loai}', 'KHAC') AND v."ngay_ban_hanh" = ("p" #>> '{van_ban,ngay_ban_hanh}')::date END;
    IF v_vb."id" IS NOT NULL AND (v_vb."loai" <> coalesce("p" #>> '{van_ban,loai}', 'KHAC') OR v_vb."ngay_ban_hanh" <> ("p" #>> '{van_ban,ngay_ban_hanh}')::date) THEN
      RAISE EXCEPTION 'Văn bản % đã có trên hệ thống với loại / ngày ban hành khác (ban hành %) — chọn đúng văn bản.', btrim("p" #>> '{van_ban,so_ket_luan}'),
        to_char(v_vb."ngay_ban_hanh", 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF v_vb."id" IS NOT NULL THEN NULL;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi",
                                              "so_nhiem_vu_du_kien", "da_ra_soat_toan_van", "ra_soat_boi", "ra_soat_luc")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id",
            nullif("p" #>> '{van_ban,so_nhiem_vu_du_kien}', '')::integer, coalesce(("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean, false),
            CASE WHEN ("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean THEN v_me."id" END, CASE WHEN ("p" #>> '{van_ban,da_ra_soat_toan_van}')::boolean THEN now() END)
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
  IF v_nhu_a0 THEN   -- Người nhận việc Thường trực giao (A0 hoặc thay mặt Thường trực): lãnh đạo Văn phòng (theo dõi = chính họ) hoặc Trưởng phòng của phòng được giao.
    IF v_owner."id" IS NOT NULL AND v_owner."role_group" = 'A1' THEN v_theo_doi := v_owner;
    ELSIF v_owner."id" IS NULL AND v_dv."trong_van_phong" AND v_dv."phong" IS NOT NULL THEN
      SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "role_group" = 'A2' AND "department" = v_dv."phong" AND NOT "is_system" ORDER BY "username" LIMIT 1;
      IF v_theo_doi."id" IS NULL THEN RAISE EXCEPTION 'Phòng % chưa có Trưởng phòng để nhận việc Thường trực giao.', v_dv."ten" USING ERRCODE = '22023'; END IF;
    ELSE RAISE EXCEPTION 'Thường trực Tỉnh ủy giao việc cho lãnh đạo Văn phòng hoặc một phòng của Văn phòng.' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "id" = coalesce(nullif("p" ->> 'nguoi_theo_doi', '')::uuid, v_me."id");
    IF v_theo_doi."id" IS NULL OR v_theo_doi."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Giao thay mặt (0095: mọi chuyên viên): ghi lãnh đạo A1/A2 được thay mặt (hoặc nhóm), Owner trong phạm vi của lãnh đạo đó.
  IF v_me."role_group" = 'A3' AND v_nhom IS NOT NULL THEN   -- 0079: thay mặt cả nhóm — người đại diện ghi vào giao_thay_mat_cho; phạm vi: Lãnh đạo VP = Chánh VP (mọi phòng), Thường trực = nhánh v_nhu_a0 ở trên
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = "public"."kl_dai_dien_nhom_thay_mat"(v_nhom);
    IF v_tm."id" IS NULL THEN RAISE EXCEPTION 'Chưa có tài khoản lãnh đạo để đại diện nhóm %.', "public"."kl_ten_nhom_thay_mat"(v_nhom) USING ERRCODE = '22023'; END IF;
  ELSIF v_me."role_group" = 'A3' AND nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN   -- thay mặt một lãnh đạo (nhập Excel: cột Lãnh đạo giao)
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'thay_mat_cho', '')::uuid;
    IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
      RAISE EXCEPTION 'Giao thay mặt phải chọn một lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A2' AND NOT (CASE WHEN v_nhap THEN v_tm."department" IS NOT DISTINCT FROM v_phong_owner AND v_phong_owner IS NOT NULL
        ELSE "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") END) THEN
      RAISE EXCEPTION 'Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A1' AND NOT (CASE WHEN v_nhap THEN v_tm."is_chief" OR v_phong_owner IS NULL
          OR "public"."kl_pham_vi_pcvp_cua"(v_tm."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''))
        ELSE "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") END) THEN
      RAISE EXCEPTION 'Phó Chánh Văn phòng được thay mặt phải phụ trách phòng của Owner.' USING ERRCODE = '22023';
    END IF;
    -- 0095: người theo dõi khi thay mặt = người nhập, lãnh đạo được thay mặt, hoặc cán bộ trong phạm vi của lãnh đạo đó (như lãnh đạo tự giao — GV-3).
    IF v_theo_doi."id" IS DISTINCT FROM v_me."id" AND v_theo_doi."id" IS DISTINCT FROM v_tm."id" AND NOT coalesce(v_tm."is_chief", false)
       AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), v_tm."id") THEN
      RAISE EXCEPTION 'Người theo dõi phải là đồng chí, lãnh đạo được thay mặt hoặc cán bộ trong phạm vi của lãnh đạo đó.' USING ERRCODE = '22023';
    END IF;
  ELSIF v_me."role_group" = 'A3' THEN   -- 0085 (Đợt E): chuyên viên chủ trì văn bản giao thẳng cho chuyên viên (phòng bất kỳ) hoặc chính mình; theo dõi = người giao (0095: cả dòng Excel không ghi Lãnh đạo giao)
    IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' THEN
      RAISE EXCEPTION 'Chuyên viên giao việc cho một chuyên viên (phòng bất kỳ) hoặc cho chính mình; việc giao cho phòng hoặc lãnh đạo do lãnh đạo giao.' USING ERRCODE = '42501';
    END IF;
    v_a3_thang := true; v_theo_doi := v_me;
  ELSIF nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  IF v_dv."ma" IS NOT NULL AND NOT v_dv."trong_van_phong" THEN   -- 0079 (v3.18): mọi vai, kể cả quản trị KL và lô nhập Excel
    RAISE EXCEPTION 'Người chịu trách nhiệm phải là phòng hoặc cán bộ Văn phòng; việc giao cho đơn vị ngoài (sở, ban, ngành, huyện) thì ghi tên đơn vị thực hiện trong nội dung.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_qtkl AND NOT v_a0 AND NOT v_a3_thang THEN   -- GV-3 (0025); 0085: chuyên viên giao thẳng đã kiểm ở trên
    IF v_me."role_group" = 'A2' THEN
      -- 0078: Trưởng phòng giao được cho chính mình (Owner = tài khoản của mình, cấp nhận = cấp trên); còn lại chuyên viên phòng mình như cũ.
      IF v_owner."id" IS DISTINCT FROM v_me."id" AND (v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_owner."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''))) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ giao việc cho chuyên viên phòng mình hoặc cho chính mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi."department", nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng của đồng chí.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_me."is_chief" THEN
      -- 0078: Phó Chánh Văn phòng giao được cho chính mình; còn lại theo phạm vi phụ trách như cũ.
      IF v_owner."id" IS DISTINCT FROM v_me."id" AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong_owner, nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', '')) THEN
        RAISE EXCEPTION 'Phó Chánh Văn phòng chỉ giao việc cho phòng, cán bộ được phân công phụ trách, hoặc cho chính mình.' USING ERRCODE = '42501';
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
  IF v_nhu_a0 THEN PERFORM set_config('kl.thuong_truc', '1', true); END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi",
    "do_khan", "giao_thay_mat_cho", "uu_tien", "han_nop_minh_chung", "ly_do_han_nop_sat", "nguon_nhiem_vu_ma", "don_vi_phoi_hop", "vuong_mac", "giao_thay_mat_nhom",
    "muc_quan_trong", "co_quan_trinh", "thuong_truc_chi_dao")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, v_han, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id", v_do_khan, v_tm."id", CASE WHEN v_nhu_a0 THEN 'THUONG_TRUC' END,
    nullif("p" ->> 'han_nop_minh_chung', '')::date, nullif(btrim("p" ->> 'ly_do_han_nop_sat'), ''),
    nullif("p" ->> 'nguon_nhiem_vu_ma', ''), nullif(btrim("p" ->> 'don_vi_phoi_hop'), ''),
    CASE WHEN v_nhap THEN left(nullif(btrim("p" ->> 'vuong_mac'), ''), 500) END, v_nhom,   -- 0073: vướng mắc ghi cùng lúc tạo (không phát tin zc_ từng dòng); 0079: nhóm thay mặt
    v_muc, v_cqt, v_ttcd)   -- 0087: thông tin nguồn (trigger bf_ kiểm đơn vị ngoài Văn phòng / tài khoản Thường trực; stt_van_ban tự tăng)
  RETURNING "id", "ma", "han_xu_ly", "han_nop_minh_chung" INTO v_id, v_ma, v_han, v_han_nop;
  PERFORM set_config('kl.thuong_truc', '', true);
  IF v_dong."id" IS NOT NULL THEN   -- 0073: dòng chờ → đã hoàn thiện, gắn việc vừa tạo (giữ dữ liệu gốc của tệp cho ngăn chi tiết)
    UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_THIEN', "nhiem_vu_id" = v_id, "xu_ly_boi" = v_me."id", "xu_ly_luc" = now() WHERE "id" = v_dong."id";
    SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = v_dong."lo_id";
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (v_id, v_me."id", 'nhap_excel', format('Hoàn thiện dòng %s của lô nhập Excel %s (tệp %s)', v_dong."so_dong", v_lo."ma", v_lo."ten_tep"), 'app');
  END IF;
  -- Vết và tin hệ thống (lô nhập Excel: không gửi tin từng việc — nhap_excel_lo_xong gửi MỘT tin tổng hợp cho mỗi người, 0074).
  IF v_a3_thang THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Chuyên viên %s giao, người theo dõi là người giao', v_me."full_name"), 'app');
  END IF;
  v_nhan := coalesce(v_owner."id", v_theo_doi."id");
  IF v_tm."id" IS NOT NULL THEN
    -- 0095: lưu vết chỉ ghi tài khoản thực hiện (không ghi "thay mặt …" vào diễn biến — quyết định chủ dự án 9/10/2026).
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Nhập bởi %s', v_me."full_name"), 'app');
    v_nguoi := v_nguoi || CASE WHEN v_nhom IS NOT NULL THEN "public"."kl_nhom_thay_mat_thanh_vien"(v_nhom, v_id) ELSE ARRAY[v_tm."id"] END;   -- 0083: nhóm trong phạm vi việc được báo
  END IF;
  IF v_a0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Thường trực Tỉnh ủy giao, độ khẩn %s, người nhận %s', "public"."ten_do_khan"(v_do_khan), v_theo_doi."full_name"), 'app');
  END IF;
  -- 0085: chuyên viên giao thẳng, hoặc cấu hình coi như đã nhận (không còn mục "việc mới chờ nhận"): Owner và người theo dõi luôn có tin giao.
  IF v_a0 OR v_tm."id" IS NOT NULL OR v_do_khan <> 'THUONG' OR v_a3_thang OR v_tu_nhan THEN v_nguoi := v_nguoi || v_nhan || v_theo_doi."id"; END IF;
  IF v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN v_nguoi := v_nguoi || "public"."lanh_dao_truc_tiep"(v_nhan); END IF;
  IF v_nhu_a0 OR v_do_khan = 'HOA_TOC' THEN v_nguoi := v_nguoi || (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1); END IF;
  v_tin := format('%s · %s: %s (hạn %s%s)', CASE WHEN v_nhu_a0 THEN 'Thường trực giao việc' ELSE 'Giao việc' END   -- 0098: không ghi "thay mặt …" trong tin
    || CASE WHEN v_do_khan <> 'THUONG' THEN ' · ' || "public"."ten_do_khan"(v_do_khan) ELSE '' END, v_ma, left(btrim("p" ->> 'noi_dung'), 120), coalesce(to_char(v_han, 'DD/MM/YYYY'), 'ký ban hành'),
    coalesce(', hạn nộp minh chứng ' || to_char(v_han_nop, 'DD/MM/YYYY'), ''));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT v_me."id", u, v_tin, false, 'he_thong', v_id FROM unnest(v_nguoi) u JOIN "public"."accounts" a ON a."id" = u
  WHERE u <> v_me."id" AND NOT a."is_system" AND a."role_group" <> 'A0' AND NOT v_lo_nhap;
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$function$;

CREATE OR REPLACE FUNCTION "public"."nhap_excel_lo_xong"("p_lo" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lo "public"."lo_nhap"; v_me "public"."accounts"; r record; v_so jsonb;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = "p_lo" FOR UPDATE;
  IF v_lo."id" IS NULL OR v_lo."tao_boi" <> "auth"."uid"() THEN RAISE EXCEPTION 'Không tìm thấy lô nhập của đồng chí.' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_object_agg("ket_qua", n), '{}'::jsonb) INTO v_so FROM (SELECT "ket_qua", count(*) AS n FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" GROUP BY 1) x;
  IF v_lo."xong_luc" IS NOT NULL THEN RETURN v_so; END IF;
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  UPDATE "public"."lo_nhap" SET "xong_luc" = now(), "so_lieu" = v_so WHERE "id" = "p_lo";
  FOR r IN   -- việc giao mới: chủ trì / theo dõi (nhan) + lãnh đạo được thay mặt; việc có sẵn được cập nhật thông tin: chủ trì / theo dõi (cap_nhat)
    WITH viec AS (SELECT n."id", n."ma", n."owner_tai_khoan", n."nguoi_theo_doi", n."giao_thay_mat_cho", d."ket_qua" = 'CAP_NHAT' AS cn FROM "public"."dong_nhap" d
                  JOIN "public"."nhiem_vu" n ON n."id" = d."nhiem_vu_id" WHERE d."lo_id" = "p_lo" AND d."ket_qua" IN ('GIAO', 'CHO_NGHIEM_THU', 'CAP_NHAT')),
         nhan AS (SELECT DISTINCT viec."id", viec."ma", u.nguoi, u.vai FROM viec CROSS JOIN LATERAL (VALUES
                    (viec."owner_tai_khoan", CASE WHEN viec.cn THEN 'cap_nhat' ELSE 'nhan' END), (viec."nguoi_theo_doi", CASE WHEN viec.cn THEN 'cap_nhat' ELSE 'nhan' END),
                    (CASE WHEN NOT viec.cn THEN viec."giao_thay_mat_cho" END, 'thay_mat')) u(nguoi, vai) WHERE u.nguoi IS NOT NULL AND u.nguoi <> v_me."id")
    SELECT nhan.nguoi, count(DISTINCT nhan."id") FILTER (WHERE nhan.vai = 'nhan') AS so_nhan, count(DISTINCT nhan."id") FILTER (WHERE nhan.vai = 'thay_mat') AS so_tm,
           count(DISTINCT nhan."id") FILTER (WHERE nhan.vai = 'cap_nhat') AS so_cn,
           (array_agg(DISTINCT nhan."ma" ORDER BY nhan."ma") FILTER (WHERE nhan.vai = 'nhan'))[1:8] AS ma,
           (array_agg(DISTINCT nhan."ma" ORDER BY nhan."ma") FILTER (WHERE nhan.vai = 'cap_nhat'))[1:8] AS ma_cn
    FROM nhan JOIN "public"."accounts" a ON a."id" = nhan.nguoi AND NOT a."is_system" AND a."role_group" <> 'A0' GROUP BY nhan.nguoi
  LOOP
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    VALUES (v_me."id", r.nguoi, format('Nhập Excel · lô %s (%s): %s%s', v_lo."ma", v_me."full_name",
      concat_ws('; ', CASE WHEN r.so_nhan > 0 THEN format('%s việc đồng chí chủ trì / theo dõi (%s%s) — xác nhận đã nhận ở "Việc của tôi"', r.so_nhan,
                        array_to_string(r.ma, ', '), CASE WHEN r.so_nhan > 8 THEN '…' ELSE '' END) END,
                      CASE WHEN r.so_tm > 0 THEN format('%s việc ghi đồng chí là lãnh đạo giao', r.so_tm) END,
                      CASE WHEN r.so_cn > 0 THEN format('%s việc đồng chí chủ trì / theo dõi được cập nhật thông tin (%s%s)', r.so_cn,
                        array_to_string(r.ma_cn, ', '), CASE WHEN r.so_cn > 8 THEN '…' ELSE '' END) END), '.'), false, 'he_thong', NULL);
  END LOOP;
  PERFORM "public"."nhat_ky_ghi"('nhap_excel_chot_lo', v_lo."ma", v_so);
  RETURN v_so;
END;
$$;
