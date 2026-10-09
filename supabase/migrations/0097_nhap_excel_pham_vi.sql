-- 0097 (Đợt F v3.21, rà soát độc lập trước PR): nhập Excel là quyền chung từ 0096 ⇒ hai đường của lô không còn được dựa vào "người nhập thấy hết":
-- 1. kl_nhap_da_xong (bản 0074) — dòng "đã xong ngoài hệ thống" ghi thẳng nhiem_vu (không qua giao_viec): nay kiểm như giao_viec — lãnh đạo nhập
--    theo phạm vi giao của mình (GV-3; ghi thay mặt bị bỏ như kl_nhap_giao 0093), chuyên viên ghi Lãnh đạo giao theo phạm vi của lãnh đạo đó
--    (kl_duoc_giao_cho_phong p_thay_mat), chuyên viên không ghi Lãnh đạo giao = giao thẳng (chủ trì là chuyên viên, người theo dõi = người nhập);
--    nhóm lãnh đạo (Lãnh đạo Văn phòng / Thường trực) như Chánh VP. Owner đơn vị ngoài của dữ liệu cũ vẫn nhận khi phạm vi cho phép (0079).
-- 2. nhap_excel_dong (bản 0075, một nhánh mới): dòng có mã của việc người nhập KHÔNG xem được → bỏ qua, không so / báo từng ô (kl_nhap_cap_nhat
--    trả lời "không đổi chủ trì / hạn…" từng làm lộ nội dung việc ngoài phạm vi).

CREATE OR REPLACE FUNCTION "public"."kl_nhap_da_xong"("d" jsonb, "p_vb" uuid, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_id uuid; v_ma text; v_chu text; v_me "public"."accounts"; v_tm "public"."accounts"; v_owner "public"."accounts";
        v_td "public"."accounts"; v_dv "public"."dm_don_vi"; v_phong text; v_ng text := nullif("d" ->> 'nganh_ma', ''); v_lv text := nullif("d" ->> 'linh_vuc_ma', '');
        v_nhom text;
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_vb";
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF nullif("d" ->> 'nguoi_theo_doi', '') IS NULL THEN RAISE EXCEPTION 'Thiếu người theo dõi.' USING ERRCODE = '22023'; END IF;
  IF v_me."role_group" = 'A3' THEN   -- thay mặt chỉ của chuyên viên (như kl_nhap_giao 0093); lãnh đạo nhập: bỏ cột Lãnh đạo giao
    v_nhom := nullif("d" ->> 'thay_mat_nhom', '');
    IF nullif("d" ->> 'thay_mat_cho', '') IS NOT NULL THEN
      SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = ("d" ->> 'thay_mat_cho')::uuid;
      IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
        RAISE EXCEPTION 'Lãnh đạo giao phải là lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "d" ->> 'owner_don_vi_ma';
  IF nullif("d" ->> 'owner_tai_khoan', '') IS NOT NULL THEN SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("d" ->> 'owner_tai_khoan')::uuid; END IF;
  v_phong := coalesce(v_owner."department", v_dv."phong");
  SELECT * INTO v_td FROM "public"."accounts" WHERE "id" = ("d" ->> 'nguoi_theo_doi')::uuid;
  IF v_td."id" IS NULL OR v_td."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  IF v_me."role_group" = 'A3' AND v_nhom IS NULL AND v_tm."id" IS NULL THEN   -- giao thẳng (GV-14)
    IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR v_owner."is_system" THEN
      RAISE EXCEPTION 'Không ghi Lãnh đạo giao thì chủ trì phải là một chuyên viên (chuyên viên giao thẳng).' USING ERRCODE = '22023';
    END IF;
    v_td := v_me;
  ELSIF v_nhom IS NULL THEN   -- lãnh đạo nhập (phạm vi của mình) / chuyên viên ghi một lãnh đạo (phạm vi của lãnh đạo đó)
    IF NOT (coalesce(v_owner."id" = v_me."id", false) OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong, v_ng, v_lv, v_tm."id")) THEN
      RAISE EXCEPTION 'Chủ trì ngoài phạm vi giao của %.', CASE WHEN v_tm."id" IS NULL THEN 'đồng chí' ELSE 'lãnh đạo giao' END USING ERRCODE = '22023';
    END IF;
    IF NOT (coalesce(v_td."id" = v_me."id" OR v_td."id" = v_tm."id", false) OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_td."department", v_ng, v_lv, v_tm."id")) THEN
      RAISE EXCEPTION 'Người theo dõi ngoài phạm vi giao của %.', CASE WHEN v_tm."id" IS NULL THEN 'đồng chí' ELSE 'lãnh đạo giao' END USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "noi_dung", "owner_don_vi_ma", "owner_tai_khoan", "nguoi_theo_doi", "giao_thay_mat_cho", "loai_thoi_han_ma",
    "han_xu_ly", "san_pham_loai", "cap_nhan_san_pham", "do_khan", "nguon_nhiem_vu_ma", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai",
    "don_vi_phoi_hop", "ghi_chu", "theo_1400", "tien_do_ma", "chat_luong", "nguon", "tao_boi", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh")
  VALUES ("p_vb", btrim("d" ->> 'noi_dung'), nullif("d" ->> 'owner_don_vi_ma', ''), nullif("d" ->> 'owner_tai_khoan', '')::uuid, v_td."id",
    v_tm."id", coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE'), nullif("d" ->> 'han_xu_ly', '')::date,
    nullif("d" ->> 'san_pham_loai', ''), nullif("d" ->> 'cap_nhan_san_pham', ''), coalesce(nullif("d" ->> 'do_khan', ''), 'THUONG'),
    nullif("d" ->> 'nguon_nhiem_vu_ma', ''), nullif("d" ->> 'nganh_ma', ''), nullif("d" ->> 'linh_vuc_ma', ''), nullif(btrim("d" ->> 'linh_vuc_chi_tiet'), ''),
    nullif(btrim("d" ->> 'van_ban_trien_khai'), ''), left(nullif(btrim("d" ->> 'don_vi_phoi_hop'), ''), 300), nullif(btrim("d" ->> 'ghi_chu'), ''), false,
    'HOAN_THANH', nullif("d" ->> 'chat_luong', ''), 'excel', "auth"."uid"(), coalesce(v_vb."ngay_nhan", v_vb."ngay_ban_hanh"), v_vb."ngay_nhan" IS NULL)
  RETURNING "id", "ma" INTO v_id, v_ma;
  v_chu := nullif(concat_ws(' · ', 'Số ' || nullif(btrim("d" ->> 'kq_so_hieu'), ''), 'ngày ' || to_char(nullif("d" ->> 'kq_ngay', '')::date, 'DD/MM/YYYY'),
    nullif(btrim("d" ->> 'kq_trich_yeu'), ''), nullif(btrim("d" ->> 'kq_mo_ta'), '')), '');
  IF v_chu IS NOT NULL THEN   -- kết quả trong tệp → minh chứng chữ (như dữ liệu chuyển đổi 15/9), tính lại cờ thiếu minh chứng của việc đã đóng
    INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "noi_dung_chu", "nop_boi") VALUES (v_id, 'chu_cu', left(v_chu, 2000), "auth"."uid"());
    PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
    UPDATE "public"."nhiem_vu" SET "thieu_minh_chung" = "thieu_minh_chung" WHERE "id" = v_id;
    PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
  END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v_id, "auth"."uid"(), 'nhap_excel', format('Nhập từ Excel (đã xong ngoài hệ thống) · lô %s, dòng %s (tệp %s)', "p_lo"."ma", "d" ->> 'so_dong', "p_lo"."ten_tep"), 'excel');
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma);
END;
$$;

-- nhap_excel_dong (bản 0075) + nhánh 0097 (việc ngoài phạm vi).
CREATE OR REPLACE FUNCTION "public"."nhap_excel_dong"("p_lo" uuid, "p_dong" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lo "public"."lo_nhap"; d jsonb; v_so integer; v_cu "public"."dong_nhap"; v_kq text; v_r jsonb; v_vb jsonb; v_ghi text; v_ra jsonb := '[]'::jsonb;
        v_thieu text[]; v_nv uuid;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = "p_lo" FOR UPDATE;   -- các phần của một lô chạy nối tiếp
  IF v_lo."id" IS NULL OR v_lo."tao_boi" <> "auth"."uid"() THEN RAISE EXCEPTION 'Không tìm thấy lô nhập của đồng chí.' USING ERRCODE = '42501'; END IF;
  IF v_lo."xong_luc" IS NOT NULL OR v_lo."hoan_tac_luc" IS NOT NULL THEN
    RAISE EXCEPTION 'Lô % đã chốt — mở lô mới để nhập tiếp.', v_lo."ma" USING ERRCODE = '22023';
  END IF;
  IF "p_dong" IS NULL OR jsonb_typeof("p_dong") <> 'array' OR jsonb_array_length("p_dong") > 100 THEN
    RAISE EXCEPTION 'Mỗi lần gửi tối đa 100 dòng.' USING ERRCODE = '22023';
  END IF;
  FOR d IN SELECT * FROM jsonb_array_elements("p_dong") LOOP
    v_so := nullif(d ->> 'so_dong', '')::integer;
    IF v_so IS NULL OR v_so < 1 THEN RAISE EXCEPTION 'Dòng không có số thứ tự trong tệp.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_cu FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "so_dong" = v_so;
    IF v_cu."id" IS NOT NULL THEN   -- gửi lại phần đã xử lý: trả kết quả đã lưu
      v_ra := v_ra || jsonb_build_object('so_dong', v_so, 'ket_qua', v_cu."ket_qua", 'nhiem_vu_id', v_cu."nhiem_vu_id",
        'ma', (SELECT "ma" FROM "public"."nhiem_vu" WHERE "id" = v_cu."nhiem_vu_id"), 'ghi_chu', v_cu."ghi_chu");
      CONTINUE;
    END IF;
    v_kq := NULL; v_r := NULL; v_vb := NULL; v_ghi := NULL;
    v_thieu := ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(d -> 'thieu') = 'array' THEN d -> 'thieu' ELSE '[]'::jsonb END));
    v_nv := NULL;
    IF nullif(btrim(d ->> 'ma'), '') IS NOT NULL THEN SELECT "id" INTO v_nv FROM "public"."nhiem_vu" WHERE upper("ma") = upper(btrim(d ->> 'ma')); END IF;
    BEGIN
      IF v_nv IS NOT NULL AND NOT coalesce((d ->> 'cap_nhat')::boolean, false) THEN   -- xem trước coi là việc mới (đã điền mặc định): không ghi đè việc có sẵn
        v_kq := 'BO_QUA'; v_ghi := format('Mã %s đã có trên hệ thống nhưng bản xem trước coi là việc mới — chọn lại tệp để cập nhật theo mã.', upper(btrim(d ->> 'ma')));
      ELSIF v_nv IS NULL AND coalesce((d ->> 'cap_nhat')::boolean, false) THEN   -- xem trước thấy mã, nay việc không còn (đã xoá / hoàn tác): không tạo việc mới
        v_kq := 'BO_QUA'; v_ghi := format('Mã %s không còn trên hệ thống — bỏ qua dòng.', upper(btrim(coalesce(d ->> 'ma', ''))));
      ELSIF v_nv IS NOT NULL AND EXISTS (SELECT 1 FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "nhiem_vu_id" = v_nv AND "ket_qua" = 'CAP_NHAT') THEN
        v_kq := 'BO_QUA'; v_ghi := 'Mã việc trùng với một dòng trước trong tệp — gộp các thay đổi vào một dòng.';   -- hoàn tác trả đúng giá trị gốc
      ELSIF v_nv IS NOT NULL AND NOT "public"."kl_thay_nhiem_vu"(v_nv) THEN   -- 0097: không dò / sửa việc ngoài phạm vi qua tệp (trả lời chung, không nội dung)
        v_kq := 'BO_QUA'; v_ghi := format('Mã %s không thuộc các việc đồng chí xem được — bỏ qua dòng.', upper(btrim(d ->> 'ma')));
      ELSIF v_nv IS NOT NULL THEN
        v_kq := 'CAP_NHAT';
        v_r := "public"."kl_nhap_cap_nhat"(d, v_lo);
        IF NOT (v_r ->> 'doi')::boolean THEN v_kq := 'BO_QUA'; v_ghi := coalesce(v_r ->> 'ghi_chu', 'Không có thay đổi so với dữ liệu trên hệ thống.');
        ELSE v_ghi := v_r ->> 'ghi_chu'; END IF;
      ELSIF cardinality(v_thieu) > 0 THEN
        v_kq := 'CHO_HOAN_THIEN';
      ELSIF d ->> 'tien_do_ma' = 'HOAN_THANH' AND v_lo."che_do_xong" = 'DA_XONG_NGOAI' THEN
        v_kq := 'DA_XONG';
        v_vb := "public"."kl_nhap_van_ban"(d);
        v_r := "public"."kl_nhap_da_xong"(d, (v_vb ->> 'van_ban_id')::uuid, v_lo);
      ELSE
        v_kq := 'GIAO';
        v_vb := "public"."kl_nhap_van_ban"(d);
        v_r := "public"."kl_nhap_giao"(d, (v_vb ->> 'van_ban_id')::uuid, v_lo);
        IF (v_r ->> 'minh_chung')::boolean THEN v_kq := 'CHO_NGHIEM_THU';
        ELSIF d ->> 'tien_do_ma' = 'HOAN_THANH' THEN v_ghi := 'Chưa đủ 4 yếu tố minh chứng — giao như việc đang làm, chủ trì nộp minh chứng trên hệ thống.'; END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN   -- lỗi ràng buộc / kiểu của Postgres (tiếng Anh) → lời nhắn tiếng Việt; lỗi nghiệp vụ (RAISE của hàm) giữ nguyên
      v_ghi := left(CASE SQLSTATE WHEN '23505' THEN 'Trùng dữ liệu đã có trên hệ thống (văn bản / nhiệm vụ) — kiểm tra lại dòng.'
        WHEN '23503' THEN 'Giá trị không có trong danh mục / tài khoản của hệ thống.' WHEN '23502' THEN 'Thiếu thông tin bắt buộc.'
        WHEN '23514' THEN 'Giá trị không hợp lệ (vượt giới hạn hoặc sai kiểu cho phép).' WHEN '22P02' THEN 'Giá trị không đúng kiểu (số, ngày, mã).'
        WHEN '22007' THEN 'Ngày không hợp lệ.' WHEN '22008' THEN 'Ngày không hợp lệ.' WHEN '22001' THEN 'Nội dung quá dài.'
        WHEN '22003' THEN 'Số vượt giới hạn (số hội nghị…).' ELSE SQLERRM END, 1000);
      v_r := NULL; v_vb := NULL;
      v_kq := CASE WHEN v_kq = 'CAP_NHAT' THEN 'BO_QUA' ELSE 'CHO_HOAN_THIEN' END;
      PERFORM set_config('kl.nhap_excel', '', true);
    END;
    INSERT INTO "public"."dong_nhap" ("lo_id", "so_dong", "ket_qua", "nhiem_vu_id", "du_lieu", "du_lieu_goc", "gia_tri_cu", "thieu", "ghi_chu", "xu_ly_boi")
    VALUES ("p_lo", v_so, v_kq, (v_r ->> 'id')::uuid, (d - 'du_lieu_goc' - 'thieu' - 'so_dong' - 'van_ban_id' - 'van_ban_moi') || coalesce(v_vb, '{}'::jsonb),
      CASE WHEN jsonb_typeof(d -> 'du_lieu_goc') = 'object' THEN d -> 'du_lieu_goc' ELSE '{}'::jsonb END, nullif(v_r -> 'gia_tri_cu', 'null'::jsonb), v_thieu, v_ghi,
      "auth"."uid"());
    v_ra := v_ra || jsonb_build_object('so_dong', v_so, 'ket_qua', v_kq, 'nhiem_vu_id', v_r ->> 'id', 'ma', v_r ->> 'ma', 'ghi_chu', v_ghi);
  END LOOP;
  RETURN v_ra;
END;
$$;
