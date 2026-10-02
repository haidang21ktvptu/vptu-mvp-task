-- 0075: Nhập Excel toàn trình — mở lô, nhập từng phần, chốt lô (tin tổng hợp), hoàn tác trong 24 giờ (bảng 0072, hàm dòng 0074).

CREATE FUNCTION "public"."nhap_excel_lo_tao"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."lo_nhap";
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF coalesce("p" ->> 'mau', '') NOT IN ('CHUAN', 'PHU_LUC_2', 'TU_GHEP') OR coalesce("p" ->> 'che_do_xong', '') NOT IN ('DA_XONG_NGOAI', 'CHO_NGHIEM_THU') THEN
    RAISE EXCEPTION 'Thiếu mẫu tệp hoặc cách xử lý việc đã hoàn thành.' USING ERRCODE = '22023';
  END IF;
  IF coalesce(nullif("p" ->> 'so_dong', '')::integer, 0) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mỗi lô nhập từ 1 đến 2000 dòng.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."lo_nhap" ("ten_tep", "mau", "che_do_xong", "so_dong", "tao_boi")
  VALUES (left(coalesce(nullif(btrim("p" ->> 'ten_tep'), ''), 'tep.xlsx'), 200), "p" ->> 'mau', "p" ->> 'che_do_xong', ("p" ->> 'so_dong')::integer, "auth"."uid"())
  RETURNING * INTO v;
  PERFORM "public"."nhat_ky_ghi"('nhap_excel_mo_lo', v."ma", jsonb_build_object('tep', v."ten_tep", 'mau', v."mau", 'che_do_xong', v."che_do_xong", 'so_dong', v."so_dong"));
  RETURN jsonb_build_object('id', v."id", 'ma', v."ma");
END;
$$;

CREATE FUNCTION "public"."nhap_excel_dong"("p_lo" uuid, "p_dong" jsonb) RETURNS jsonb
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

-- Chốt lô: số dòng theo kết quả; MỘT tin hệ thống cho mỗi người chủ trì / theo dõi / được thay mặt của việc lô giao hoặc cập nhật (thay cho tin
-- từng việc).
CREATE FUNCTION "public"."nhap_excel_lo_xong"("p_lo" uuid) RETURNS jsonb
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
                      CASE WHEN r.so_tm > 0 THEN format('%s việc giao thay mặt đồng chí', r.so_tm) END,
                      CASE WHEN r.so_cn > 0 THEN format('%s việc đồng chí chủ trì / theo dõi được cập nhật thông tin (%s%s)', r.so_cn,
                        array_to_string(r.ma_cn, ', '), CASE WHEN r.so_cn > 8 THEN '…' ELSE '' END) END), '.'), false, 'he_thong', NULL);
  END LOOP;
  PERFORM "public"."nhat_ky_ghi"('nhap_excel_chot_lo', v_lo."ma", v_so);
  RETURN v_so;
END;
$$;

-- Việc đã có người thao tác sau thời điểm lô ghi nó (lịch sử của người dùng; cảnh báo tự động không tính), chỉ đạo, minh chứng, đề nghị từ chối /
-- sửa / đính chính, việc con.
CREATE FUNCTION "public"."kl_nhap_da_cham"("p_nv" uuid, "p_luc" timestamp with time zone) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = "p_nv" AND "luc" > "p_luc" AND "nguoi_sua" IS NOT NULL)
      OR EXISTS (SELECT 1 FROM "public"."chi_dao" WHERE "nhiem_vu_id" = "p_nv" AND "created_at" > "p_luc")
      OR EXISTS (SELECT 1 FROM "public"."minh_chung" WHERE "nhiem_vu_id" = "p_nv" AND "nop_luc" > "p_luc")
      OR EXISTS (SELECT 1 FROM "public"."tu_choi" WHERE "nhiem_vu_id" = "p_nv" AND "tao_luc" > "p_luc")
      OR EXISTS (SELECT 1 FROM "public"."de_nghi_sua" WHERE "nhiem_vu_id" = "p_nv" AND "tao_luc" > "p_luc")
      OR EXISTS (SELECT 1 FROM "public"."dinh_chinh" WHERE "nhiem_vu_id" = "p_nv" AND "created_at" > "p_luc")
      OR EXISTS (SELECT 1 FROM "public"."nhiem_vu" WHERE "nhiem_vu_cha" = "p_nv");
$$;

CREATE FUNCTION "public"."hoan_tac_lo"("p_lo" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lo "public"."lo_nhap"; d "public"."dong_nhap"; v "public"."nhiem_vu"; v_giu text[] := '{}'; v_n integer := 0; v_tg jsonb;
        v_nhan jsonb := '[]'::jsonb; v_me uuid := "auth"."uid"(); r record;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  SELECT * INTO v_lo FROM "public"."lo_nhap" WHERE "id" = "p_lo" FOR UPDATE;
  IF v_lo."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy lô nhập.' USING ERRCODE = '22023'; END IF;
  IF v_lo."tao_boi" <> v_me AND NOT "public"."me_quan_tri_he_thong"() THEN
    RAISE EXCEPTION 'Chỉ người nhập lô hoặc quản trị hệ thống mới hoàn tác.' USING ERRCODE = '42501';
  END IF;
  IF v_lo."hoan_tac_luc" IS NOT NULL THEN RAISE EXCEPTION 'Lô % đã hoàn tác trước đó.', v_lo."ma" USING ERRCODE = '22023'; END IF;
  IF now() > v_lo."tao_luc" + interval '24 hours' THEN
    RAISE EXCEPTION 'Lô % nhập quá 24 giờ — không hoàn tác cả lô; sửa từng việc trên hệ thống.', v_lo."ma" USING ERRCODE = '22023';
  END IF;
  FOR d IN SELECT * FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "nhiem_vu_id" IS NOT NULL AND "ket_qua" IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU', 'CAP_NHAT')
           ORDER BY "so_dong" FOR UPDATE LOOP
    SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = d."nhiem_vu_id" FOR UPDATE;
    IF v."id" IS NULL THEN CONTINUE; END IF;
    IF "public"."kl_nhap_da_cham"(v."id", d."xu_ly_luc") THEN v_giu := v_giu || v."ma"; CONTINUE; END IF;
    BEGIN   -- mỗi dòng một khối con: dòng không trả lại được (ràng buộc nghiệp vụ) được giữ và báo mã, các dòng khác vẫn hoàn tác
      IF d."ket_qua" = 'CAP_NHAT' THEN   -- trả giá trị trước khi nhập
        IF coalesce(d."gia_tri_cu" ? '_minh_chung', false) THEN
          DELETE FROM "public"."minh_chung" WHERE "nhiem_vu_id" = v."id" AND "nop_luc" = d."xu_ly_luc" AND "hop_le" IS NULL;
        END IF;
        v_tg := coalesce(d."gia_tri_cu", '{}'::jsonb) - 'vuong_mac' - '_minh_chung';
        IF v_tg -> 'nguon_nhiem_vu_ma' = 'null'::jsonb THEN v_tg := v_tg - 'nguon_nhiem_vu_ma'; END IF;   -- nguồn đã chọn không bỏ trống lại (0062)
        IF v_tg <> '{}'::jsonb THEN PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_tg); END IF;
        IF coalesce(d."gia_tri_cu" ? 'vuong_mac', false) THEN
          PERFORM set_config('kl.ghi_qua_ham', '1', true);
          UPDATE "public"."nhiem_vu" SET "vuong_mac" = d."gia_tri_cu" ->> 'vuong_mac' WHERE "id" = v."id";
          PERFORM set_config('kl.ghi_qua_ham', '', true);
        END IF;
        INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
        VALUES (v."id", v_me, 'nhap_excel', format('Hoàn tác lô nhập Excel %s: trả giá trị trước khi nhập', v_lo."ma"), 'app');
      ELSE
        DELETE FROM "public"."nhiem_vu" WHERE "id" = v."id";   -- lịch sử, minh chứng, tin của việc theo FK CASCADE
        IF d."ket_qua" <> 'DA_XONG' THEN   -- tin hoàn tác chỉ cho người đã nhận tin tổng hợp (việc giao của lô ĐÃ chốt), mỗi việc tính một lần
          v_nhan := v_nhan || jsonb_build_array(jsonb_build_object('u', v."owner_tai_khoan", 'v', v."id"), jsonb_build_object('u', v."nguoi_theo_doi", 'v', v."id"),
                                                jsonb_build_object('u', v."giao_thay_mat_cho", 'v', v."id"));
        END IF;
      END IF;
      UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_TAC', "xu_ly_boi" = v_me, "xu_ly_luc" = now() WHERE "id" = d."id";
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      v_giu := v_giu || v."ma";
    END;
  END LOOP;
  UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_HOAN_TAC', "xu_ly_boi" = v_me, "xu_ly_luc" = now() WHERE "lo_id" = "p_lo" AND "ket_qua" = 'CHO_HOAN_THIEN';
  DELETE FROM "public"."van_ban_giao_viec" vb   -- chỉ văn bản CHÍNH lô này tạo (máy chủ ghi van_ban_moi; người tạo + thời điểm khớp lô), không còn việc nào
  WHERE vb."id" IN (SELECT ("du_lieu" ->> 'van_ban_id')::uuid FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" AND "du_lieu" ->> 'van_ban_moi' = 'true')
    AND vb."tao_boi" = v_lo."tao_boi" AND vb."created_at" >= v_lo."tao_luc"
    AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = vb."id");
  UPDATE "public"."lo_nhap" SET "hoan_tac_luc" = now(), "hoan_tac_boi" = v_me, "xong_luc" = coalesce("xong_luc", now()),
    "so_lieu" = (SELECT jsonb_object_agg("ket_qua", n) FROM (SELECT "ket_qua", count(*) AS n FROM "public"."dong_nhap" WHERE "lo_id" = "p_lo" GROUP BY 1) x)
  WHERE "id" = "p_lo";
  FOR r IN SELECT a."id" AS u, count(DISTINCT x ->> 'v') AS n FROM jsonb_array_elements(v_nhan) x JOIN "public"."accounts" a ON a."id"::text = x ->> 'u'
           WHERE v_lo."xong_luc" IS NOT NULL AND a."id" NOT IN (v_me, v_lo."tao_boi") AND NOT a."is_system" AND a."role_group" <> 'A0' GROUP BY a."id" LOOP
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    VALUES (v_me, r.u, format('Nhập Excel · lô %s đã được hoàn tác: %s việc liên quan tới đồng chí không còn trên hệ thống.', v_lo."ma", r.n), false, 'he_thong', NULL);
  END LOOP;
  PERFORM "public"."nhat_ky_ghi"('hoan_tac_lo', v_lo."ma", jsonb_build_object('hoan_tac', v_n, 'giu_lai', to_jsonb(v_giu)));
  RETURN jsonb_build_object('hoan_tac', v_n, 'giu_lai', to_jsonb(v_giu));
END;
$$;

REVOKE ALL ON FUNCTION "public"."kl_nhap_da_cham"(uuid, timestamp with time zone) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."nhap_excel_lo_tao"(jsonb), "public"."nhap_excel_dong"(uuid, jsonb), "public"."nhap_excel_lo_xong"(uuid), "public"."hoan_tac_lo"(uuid)
  FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."nhap_excel_lo_tao"(jsonb), "public"."nhap_excel_dong"(uuid, jsonb), "public"."nhap_excel_lo_xong"(uuid), "public"."hoan_tac_lo"(uuid)
  TO "authenticated";
