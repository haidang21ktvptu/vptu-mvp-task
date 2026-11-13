-- 0139 (v3.35 — CAU-HOI nhóm U): cuối quý — đánh giá kết quả từng nhiệm vụ (chủ trì theo dõi đề xuất, đầu mối tổng hợp chốt; mức: Hoàn thành / Hoàn thành
-- nhưng chậm tiến độ / Chưa hoàn thành / Không đánh giá — lý do bắt buộc với hai mức sau), chốt quý (nhiệm vụ chưa có đánh giá nhận mức theo trạng thái), mở
-- lại quý, chuyển nhiệm vụ chưa hoàn thành sang quý sau (giữ liên kết, chỉ chép kết quả / sản phẩm chưa xong); nhắc tự động hằng ngày; realtime.

-- Mức gợi ý theo trạng thái (dùng khi chốt quý mà chưa có đánh giá, và để giao diện điền sẵn).
CREATE FUNCTION "public"."nvq_danh_gia_goi_y"("p_trang_thai" text, "p_ket_qua" text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN "p_trang_thai" = 'RUT' THEN NULL WHEN "p_trang_thai" = 'HOAN_THANH' AND "p_ket_qua" = 'CHAM_TIEN_DO' THEN 'HOAN_THANH_CHAM'
              WHEN "p_trang_thai" IN ('HOAN_THANH', 'THUONG_XUYEN') THEN 'HOAN_THANH' ELSE 'CHUA_HOAN_THANH' END;
$$;
GRANT EXECUTE ON FUNCTION "public"."nvq_danh_gia_goi_y"(text, text) TO "authenticated";

-- p_chot = false: đề xuất (người được cập nhật); true: chốt (người quản lý danh mục). p_chuyen: chuyển nhiệm vụ sang quý sau (chỉ khi chưa hoàn thành).
CREATE FUNCTION "public"."nvq_danh_gia"("p_id" uuid, "p_muc" text, "p_ly_do" text DEFAULT NULL, "p_chot" boolean DEFAULT false, "p_chuyen" boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nvq_nhiem_vu"; v_ly text;
BEGIN
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF n."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  IF "p_chot" THEN PERFORM "public"."nvq_can_quan_ly"();
  ELSIF NOT "public"."nvq_duoc_cap_nhat"(n) THEN RAISE EXCEPTION 'Chỉ chủ trì theo dõi, người được phân công mới đề xuất đánh giá.' USING ERRCODE = '42501'; END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  IF "p_muc" NOT IN ('HOAN_THANH', 'HOAN_THANH_CHAM', 'CHUA_HOAN_THANH', 'KHONG_DANH_GIA') THEN RAISE EXCEPTION 'Chọn mức đánh giá.' USING ERRCODE = '22023'; END IF;
  v_ly := "public"."nvq_ly_do"("p_ly_do", "p_muc" IN ('CHUA_HOAN_THANH', 'KHONG_DANH_GIA', 'HOAN_THANH_CHAM'));
  IF "p_chuyen" AND "p_muc" NOT IN ('CHUA_HOAN_THANH', 'KHONG_DANH_GIA') THEN RAISE EXCEPTION 'Chỉ chuyển sang quý sau nhiệm vụ chưa hoàn thành.' USING ERRCODE = '22023'; END IF;
  IF NOT "p_chot" AND n."danh_gia" IS NOT NULL AND NOT n."danh_gia_tu_dong" THEN
    RAISE EXCEPTION 'Đầu mối tổng hợp đã chốt đánh giá nhiệm vụ này — đề nghị đầu mối điều chỉnh.' USING ERRCODE = '22023';
  END IF;
  IF "p_chot" THEN
    UPDATE "public"."nvq_nhiem_vu" SET "danh_gia" = "p_muc", "danh_gia_ly_do" = v_ly, "danh_gia_boi" = "auth"."uid"(), "danh_gia_luc" = now(), "danh_gia_tu_dong" = false,
      "chuyen_ky_sau" = coalesce("p_chuyen", "chuyen_ky_sau") WHERE "id" = n."id";
  ELSE
    UPDATE "public"."nvq_nhiem_vu" SET "danh_gia_de_xuat" = "p_muc", "danh_gia_ly_do" = coalesce(v_ly, "danh_gia_ly_do"),
      "chuyen_ky_sau" = coalesce("p_chuyen", "chuyen_ky_sau") WHERE "id" = n."id";
  END IF;
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", CASE WHEN "p_chot" THEN 'danh_gia' ELSE 'de_xuat_danh_gia' END,
    format('%s: %s%s%s', CASE WHEN "p_chot" THEN 'Chốt đánh giá' ELSE 'Đề xuất đánh giá' END,
      CASE "p_muc" WHEN 'HOAN_THANH' THEN 'Hoàn thành' WHEN 'HOAN_THANH_CHAM' THEN 'Hoàn thành nhưng chậm tiến độ' WHEN 'CHUA_HOAN_THANH' THEN 'Chưa hoàn thành' ELSE 'Không đánh giá' END,
      CASE WHEN "p_chuyen" THEN ' — chuyển sang quý sau' ELSE '' END, coalesce(' — lý do: ' || v_ly, '')));
END;
$$;

CREATE FUNCTION "public"."nvq_ky_chot"("p_ky" uuid, "p_nhan_xet" text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky"; v_so integer; v_kq jsonb;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  k := "public"."nvq_ky_mo"("p_ky");
  IF "public"."kl_hom_nay"() < k."den_ngay" - 31 THEN RAISE EXCEPTION 'Chỉ chốt quý trong tháng cuối của quý hoặc sau đó.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."nvq_nhiem_vu" n SET "danh_gia" = coalesce(n."danh_gia_de_xuat", "public"."nvq_danh_gia_goi_y"(v."trang_thai", v."ket_qua")),
    "danh_gia_boi" = "auth"."uid"(), "danh_gia_luc" = now(), "danh_gia_tu_dong" = true
  FROM "public"."v_nvq_nhiem_vu" v WHERE v."id" = n."id" AND n."ky_id" = k."id" AND n."danh_gia" IS NULL AND n."dieu_chinh" = 'TRONG_DANH_MUC';
  GET DIAGNOSTICS v_so = ROW_COUNT;
  SELECT jsonb_build_object('tong', count(*) FILTER (WHERE "dieu_chinh" = 'TRONG_DANH_MUC'),
    'hoan_thanh', count(*) FILTER (WHERE "danh_gia" = 'HOAN_THANH'), 'hoan_thanh_cham', count(*) FILTER (WHERE "danh_gia" = 'HOAN_THANH_CHAM'),
    'chua_hoan_thanh', count(*) FILTER (WHERE "danh_gia" = 'CHUA_HOAN_THANH'), 'khong_danh_gia', count(*) FILTER (WHERE "danh_gia" = 'KHONG_DANH_GIA'),
    'chuyen_ky_sau', count(*) FILTER (WHERE "chuyen_ky_sau"), 'tu_dien', v_so)
  INTO v_kq FROM "public"."nvq_nhiem_vu" WHERE "ky_id" = k."id";
  UPDATE "public"."nvq_ky" SET "trang_thai" = 'DA_CHOT', "chot_boi" = "auth"."uid"(), "chot_luc" = now(), "chot_nhan_xet" = nullif(btrim(coalesce("p_nhan_xet", '')), '')
  WHERE "id" = k."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, k."id", 'chot_ky', format('Chốt Quý %s năm %s', "public"."nvq_la_ma"(k."quy"), k."nam"), v_kq);
  RETURN v_kq;
END;
$$;
CREATE FUNCTION "public"."nvq_ky_mo_lai"("p_ky" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO k FROM "public"."nvq_ky" WHERE "id" = "p_ky" FOR UPDATE;
  IF k."id" IS NULL OR k."trang_thai" <> 'DA_CHOT' THEN RAISE EXCEPTION 'Quý chưa chốt.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."nvq_ky" SET "trang_thai" = 'THUC_HIEN' WHERE "id" = k."id";
  UPDATE "public"."nvq_nhiem_vu" SET "danh_gia" = NULL, "danh_gia_boi" = NULL, "danh_gia_luc" = NULL, "danh_gia_tu_dong" = false
  WHERE "ky_id" = k."id" AND "danh_gia_tu_dong";   -- mức do chốt quý tự điền: đánh giá lại theo kết quả mới
  PERFORM "public"."nvq_ghi_lich_su"(NULL, k."id", 'mo_lai_ky', format('Mở lại Quý %s năm %s — lý do: %s', "public"."nvq_la_ma"(k."quy"), k."nam", v_ly));
END;
$$;

-- Chuyển sang quý mới (đã tạo): mỗi nhiệm vụ một bản mới cùng trục, nhóm (Stt nối tiếp), chủ trì theo dõi; chỉ kết quả / sản phẩm chưa xong, mốc = cuối quý mới.
CREATE FUNCTION "public"."nvq_chuyen_ky"("p_ids" uuid[], "p_ky_moi" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky"; n "public"."nvq_nhiem_vu"; v_id uuid; v_so integer := 0;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  k := "public"."nvq_ky_mo"("p_ky_moi");
  FOR n IN SELECT * FROM "public"."nvq_nhiem_vu" WHERE "id" = ANY ("p_ids") ORDER BY "truc_so", "nhom", "stt" LOOP
    IF n."ky_id" = k."id" OR (SELECT "den_ngay" FROM "public"."nvq_ky" WHERE "id" = n."ky_id") >= k."tu_ngay" THEN
      RAISE EXCEPTION 'Chỉ chuyển nhiệm vụ sang quý sau quý của nhiệm vụ.' USING ERRCODE = '22023';
    END IF;
    IF n."dieu_chinh" = 'RUT' OR (SELECT "trang_thai" FROM "public"."v_nvq_nhiem_vu" WHERE "id" = n."id") = 'HOAN_THANH' THEN
      RAISE EXCEPTION 'Nhiệm vụ % đã hoàn thành hoặc đã rút khỏi danh mục — không chuyển.', n."ma" USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM "public"."nvq_nhiem_vu" WHERE "tu_nhiem_vu_id" = n."id" AND "ky_id" = k."id") THEN CONTINUE; END IF;
    INSERT INTO "public"."nvq_nhiem_vu" ("ky_id", "truc_so", "nhom", "stt", "noi_dung", "lanh_dao_text", "lanh_dao_ma", "don_vi_text", "don_vi", "ket_qua_can_dat",
      "tien_do_text", "tinh_chat", "chu_tri_theo_doi", "phong_theo_doi", "phoi_hop_theo_doi", "ket_qua_thuc_hien", "nguon", "tu_nhiem_vu_id", "tao_boi")
    -- Stt chuyển tiếp từ 101 (không trùng Stt của danh mục quý mới nhập sau — nhập cùng Trục · Nhóm · Stt là sửa thông tin giao).
    VALUES (k."id", n."truc_so", n."nhom", (SELECT greatest(coalesce(max("stt"), 0), 100) + 1 FROM "public"."nvq_nhiem_vu" WHERE "ky_id" = k."id" AND "truc_so" = n."truc_so" AND "nhom" = n."nhom"),
      n."noi_dung", n."lanh_dao_text", n."lanh_dao_ma", n."don_vi_text", n."don_vi", n."ket_qua_can_dat", format('Quý %s năm %s (chuyển tiếp)', "public"."nvq_la_ma"(k."quy"), k."nam"),
      n."tinh_chat", n."chu_tri_theo_doi", n."phong_theo_doi", n."phoi_hop_theo_doi", n."ket_qua_thuc_hien", 'CHUYEN_KY', n."id", "auth"."uid"())
    RETURNING "id" INTO v_id;
    INSERT INTO "public"."nvq_san_pham" ("nhiem_vu_id", "thu_tu", "mo_ta", "loai", "han", "han_text", "chi_tieu_co_ban", "don_vi_tinh", "muc_tieu", "chieu",
      "trang_thai", "thuc_hien", "thuc_hien_ngay", "thuc_hien_nguon", "sua_boi")
    SELECT v_id, s."thu_tu", s."mo_ta", s."loai", k."den_ngay", format('Quý %s/%s', "public"."nvq_la_ma"(k."quy"), k."nam"), s."chi_tieu_co_ban", s."don_vi_tinh",
      s."muc_tieu", s."chieu", CASE WHEN s."trang_thai" = 'CHUA' THEN 'CHUA' ELSE 'DANG' END, s."thuc_hien", s."thuc_hien_ngay", s."thuc_hien_nguon", "auth"."uid"()
    FROM "public"."nvq_san_pham" s WHERE s."nhiem_vu_id" = n."id" AND s."trang_thai" NOT IN ('HOAN_THANH', 'KHONG_PHAT_SINH', 'KHONG_THUC_HIEN');
    IF NOT EXISTS (SELECT 1 FROM "public"."nvq_san_pham" WHERE "nhiem_vu_id" = v_id) THEN
      INSERT INTO "public"."nvq_san_pham" ("nhiem_vu_id", "mo_ta", "loai", "han", "sua_boi")
      VALUES (v_id, coalesce(n."ket_qua_can_dat", 'Kết quả theo yêu cầu nhiệm vụ'), 'KHAC', k."den_ngay", "auth"."uid"());
    END IF;
    UPDATE "public"."nvq_nhiem_vu" SET "chuyen_ky_sau" = true WHERE "id" = n."id";
    PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'chuyen_ky', format('Chuyển sang Quý %s năm %s', "public"."nvq_la_ma"(k."quy"), k."nam"));
    PERFORM "public"."nvq_ghi_lich_su"(v_id, k."id", 'chuyen_ky', 'Chuyển tiếp từ quý trước');
    v_so := v_so + 1;
  END LOOP;
  RETURN v_so;
END;
$$;

-- ---- Nhắc tự động (service_role, hằng ngày 7h30) ----
-- 1. Thứ Tư, thứ Năm: mỗi chủ trì theo dõi (việc giao cho phòng: Trưởng phòng) còn nhiệm vụ chưa cập nhật tuần này (tuần chưa chốt) → một tin "còn n nhiệm vụ…, hạn 11h00 thứ Năm dd/mm".
-- 2. Mức theo mốc gần nhất của nhiệm vụ: sắp đến hạn → chủ trì + phối hợp theo dõi; quá hạn → thêm Trưởng phòng của chủ trì; quá hạn từ ngưỡng Đỏ đặc
--    biệt → thêm đầu mối tổng hợp và Chánh Văn phòng. Mỗi (nhiệm vụ, mức, mốc) nhắc một lần (nvq_nhac).
CREATE FUNCTION "public"."nvq_nhac_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_tuan integer := 0; v_muc integer := 0; v_nhan uuid[]; v_khoa text;
BEGIN
  IF extract(isodow FROM "p_ngay") IN (3, 4) THEN
    FOR r IN
      SELECT x.nguoi, x.tuan_id, x.den_ngay, count(*)::integer AS so FROM (
        SELECT coalesce(n."chu_tri_theo_doi", (SELECT a."id" FROM "public"."accounts" a WHERE a."department" = n."phong_theo_doi" AND a."role_group" = 'A2'
                 AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system" ORDER BY a."username" LIMIT 1)) AS nguoi,   -- giao cho phòng: Trưởng phòng
               w."id" AS tuan_id, w."den_ngay", n."id" AS nv_id
        FROM "public"."v_nvq_nhiem_vu" n JOIN "public"."nvq_tuan" w ON w."ky_id" = n."ky_id" AND "p_ngay" BETWEEN w."tu_ngay" AND w."den_ngay" AND w."trang_thai" = 'MO'
        WHERE n."ky_trang_thai" = 'THUC_HIEN' AND n."trang_thai" NOT IN ('HOAN_THANH', 'RUT')
          AND NOT EXISTS (SELECT 1 FROM "public"."nvq_cap_nhat" c WHERE c."nhiem_vu_id" = n."id" AND c."tuan_id" = w."id")) x
      WHERE x.nguoi IS NOT NULL
      GROUP BY 1, 2, 3
    LOOP
      v_khoa := format('tuan:%s:%s:%s', r.tuan_id, r.nguoi, "p_ngay");
      IF EXISTS (SELECT 1 FROM "public"."nvq_nhac" WHERE "khoa" = v_khoa) THEN CONTINUE; END IF;
      INSERT INTO "public"."nvq_nhac" ("khoa") VALUES (v_khoa);
      v_tuan := v_tuan + "public"."nvq_gui_tin"(NULL, ARRAY[r.nguoi], format('Nhiệm vụ quý: đồng chí còn %s nhiệm vụ chưa cập nhật tiến độ tuần này (hạn 11h00 thứ Năm %s).',
        r.so, to_char(r."den_ngay", 'DD/MM/YYYY')));
    END LOOP;
  END IF;
  FOR r IN
    SELECT n.*, (SELECT array_agg(a."id") FROM "public"."accounts" a
                 WHERE a."department" = coalesce((SELECT c."department" FROM "public"."accounts" c WHERE c."id" = n."chu_tri_theo_doi"), n."phong_theo_doi")
                   AND a."role_group" = 'A2' AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system") AS truong_phong
    FROM "public"."v_nvq_nhiem_vu" n WHERE n."ky_trang_thai" = 'THUC_HIEN' AND n."muc" IN ('VANG', 'DO', 'DO_DAC_BIET') AND n."han_gan_nhat" IS NOT NULL
  LOOP
    v_khoa := format('muc:%s:%s:%s', r."id", r."muc", r."han_gan_nhat");
    IF EXISTS (SELECT 1 FROM "public"."nvq_nhac" WHERE "khoa" = v_khoa) THEN CONTINUE; END IF;
    INSERT INTO "public"."nvq_nhac" ("khoa") VALUES (v_khoa);
    v_nhan := ARRAY[r."chu_tri_theo_doi"] || r."phoi_hop_theo_doi"
      || CASE WHEN r."muc" IN ('DO', 'DO_DAC_BIET') OR r."chu_tri_theo_doi" IS NULL THEN coalesce(r.truong_phong, '{}') ELSE '{}' END
      || CASE WHEN r."muc" = 'DO_DAC_BIET' THEN ARRAY(SELECT "tai_khoan" FROM "public"."nvq_phan_quyen")
           || ARRAY(SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system") ELSE '{}' END;
    v_muc := v_muc + "public"."nvq_gui_tin"(r."id", v_nhan, format('Nhiệm vụ quý · %s: %s — %s', r."so_hieu",
      CASE r."muc" WHEN 'VANG' THEN format('còn %s ngày đến mốc %s', r."so_ngay_con", to_char(r."han_gan_nhat", 'DD/MM/YYYY'))
                   ELSE format('chậm tiến độ %s ngày (mốc %s)', r."so_ngay_qua", to_char(r."han_gan_nhat", 'DD/MM/YYYY')) END, left(r."noi_dung", 160)));
  END LOOP;
  DELETE FROM "public"."nvq_nhac" WHERE "luc" < now() - interval '400 days';
  RETURN jsonb_build_object('ngay', "p_ngay", 'tin_tuan', v_tuan, 'tin_muc', v_muc);
END;
$$;
REVOKE ALL ON FUNCTION "public"."nvq_nhac_quet"(date) FROM public, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."nvq_nhac_quet"(date) TO "service_role";

-- Chuông dùng chung: đánh dấu đã đọc các tin của một nhiệm vụ quý (tin hệ thống gửi tới chính mình).
CREATE FUNCTION "public"."nvq_tin_da_doc"("p_nv" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_so integer;
BEGIN
  UPDATE "public"."direct_messages" SET "is_read" = true
  WHERE "receiver_id" = "auth"."uid"() AND "loai" = 'he_thong' AND NOT "is_read" AND "nvq_nhiem_vu_id" = "p_nv";
  GET DIAGNOSTICS v_so = ROW_COUNT;
  RETURN v_so;
END;
$$;

-- ---- Quyền gọi các hàm ghi (0135–0139): chỉ người đã đăng nhập; quyền thật kiểm trong thân hàm ----
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['nvq_ky_luu(jsonb)', 'nvq_van_ban_luu(jsonb)', 'nvq_van_ban_xoa(uuid)', 'nvq_nhiem_vu_luu(jsonb, text)', 'nvq_nhiem_vu_xoa(uuid, text)',
      'nvq_san_pham_luu(jsonb, text)', 'nvq_san_pham_xoa(uuid, text)', 'nvq_phan_cong(uuid[], jsonb, text)', 'nvq_dieu_chinh(uuid, text, uuid, text)',
      'nvq_phan_quyen_dat(uuid, boolean)', 'nvq_danh_muc_luu(text, jsonb)', 'nvq_cap_nhat_gui(jsonb)', 'nvq_cap_nhat_sua(uuid, jsonb, text)',
      'nvq_so_lieu_xoa(uuid, text)', 'nvq_y_kien_gui(jsonb)', 'nvq_y_kien_xong(uuid)', 'nvq_tep_gan(jsonb)', 'nvq_tep_xoa(uuid)',
      'nvq_nhap_danh_muc(uuid, jsonb, text)', 'nvq_hoan_tac_lo(uuid)', 'nvq_tuan_chot(uuid, text)', 'nvq_tuan_mo_lai(uuid, text)',
      'nvq_danh_gia(uuid, text, text, boolean, boolean)', 'nvq_ky_chot(uuid, text)', 'nvq_ky_mo_lai(uuid, text)', 'nvq_chuyen_ky(uuid[], uuid)', 'nvq_tin_da_doc(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- ---- Realtime: chủ trì theo dõi cập nhật → màn hình của lãnh đạo đang mở tự nạp lại (RLS SELECT áp cho realtime) ----
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."nvq_nhiem_vu", "public"."nvq_san_pham", "public"."nvq_cap_nhat", "public"."nvq_y_kien";
  END IF;
END $$;
