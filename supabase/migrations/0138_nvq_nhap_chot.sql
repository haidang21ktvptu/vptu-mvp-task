-- 0138 (v3.35 — CAU-HOI nhóm U): tệp minh chứng; nhập danh mục (từ tệp Word Phụ lục / Excel mẫu — đọc trong trình duyệt, gửi lên một lô) và hoàn tác lô;
-- chốt tuần (ảnh chụp trạng thái từng nhiệm vụ cho báo cáo tuần, xu hướng), đánh giá cuối quý (chủ trì theo dõi đề xuất, đầu mối chốt), chốt quý, chuyển
-- nhiệm vụ chưa hoàn thành sang quý sau; nhắc tự động (gọi hằng ngày 7h30 bằng service_role — .github/workflows/canh-bao.yml).

-- ---- 1. Tệp (đã tải lên kho nvq-tep bằng storage API, policy 0134) ----
CREATE FUNCTION "public"."nvq_tep_gan"("p" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nvq_nhiem_vu"; v_dd text := btrim(coalesce("p" ->> 'duong_dan', '')); v_id uuid;
BEGIN
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = "public"."nvq_tep_nhiem_vu"(v_dd);
  IF n."id" IS NULL OR NOT "public"."nvq_duoc_cap_nhat"(n) THEN RAISE EXCEPTION 'Đồng chí không được đính kèm tệp cho nhiệm vụ này.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "storage"."objects" WHERE "bucket_id" = 'nvq-tep' AND "name" = v_dd) THEN
    RAISE EXCEPTION 'Tệp chưa tải lên xong — chọn lại tệp.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'san_pham_id', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."nvq_san_pham" WHERE "id" = ("p" ->> 'san_pham_id')::uuid AND "nhiem_vu_id" = n."id") THEN
    RAISE EXCEPTION 'Kết quả, sản phẩm không thuộc nhiệm vụ này.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."nvq_tep" ("nhiem_vu_id", "san_pham_id", "duong_dan", "ten", "kich_thuoc", "tai_boi")
  VALUES (n."id", nullif("p" ->> 'san_pham_id', '')::uuid, v_dd, left(coalesce(nullif(btrim("p" ->> 'ten'), ''), split_part(v_dd, '/', 2)), 255),
          nullif("p" ->> 'kich_thuoc', '')::integer, "auth"."uid"())
  RETURNING "id" INTO v_id;
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'tep', format('Đính kèm tệp: %s', left(coalesce("p" ->> 'ten', v_dd), 200)));
  RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."nvq_tep_xoa"("p_id" uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t "public"."nvq_tep"; n "public"."nvq_nhiem_vu";
BEGIN
  SELECT * INTO t FROM "public"."nvq_tep" WHERE "id" = "p_id";
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = t."nhiem_vu_id";
  IF t."id" IS NULL OR NOT ("public"."nvq_la_quan_ly"() OR (t."tai_boi" = "auth"."uid"() AND "public"."nvq_duoc_cap_nhat"(n))) THEN
    RAISE EXCEPTION 'Chỉ người đính kèm hoặc đầu mối tổng hợp mới gỡ tệp.' USING ERRCODE = '42501';
  END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  DELETE FROM "public"."nvq_tep" WHERE "id" = t."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'tep', format('Gỡ tệp: %s', t."ten"));
  RETURN t."duong_dan";   -- người tải lên xoá đối tượng trong kho bằng storage API (policy nvq_tep_xoa)
END;
$$;

-- ---- 2. Nhập danh mục (một lô): dòng có vị trí đã có → sửa thông tin giao (giữ kết quả đã cập nhật); dòng mới → thêm kèm kết quả / sản phẩm và lần cập
-- nhật đầu (phần kết quả đã ghi trong tệp — ví dụ chữ đỏ của Phụ lục 2). p_dong: [{truc_so, nhom, stt, noi_dung, lanh_dao_text, lanh_dao_ma, don_vi_text,
-- don_vi, ket_qua_can_dat, tien_do_text, tinh_chat, chu_tri_theo_doi, phoi_hop_theo_doi, phong_theo_doi, du_lieu_goc, san_pham: [...], cap_nhat_dau: {...}}]
CREATE FUNCTION "public"."nvq_nhap_danh_muc"("p_ky" uuid, "p_dong" jsonb, "p_ten_tep" text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky"; d jsonb; e jsonb; v_lo uuid; v_id uuid; v_moi integer := 0; v_sua integer := 0; v_cd jsonb; v_kq text; v_ngay date;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  k := "public"."nvq_ky_mo"("p_ky");
  IF jsonb_typeof("p_dong") <> 'array' OR jsonb_array_length("p_dong") NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Tệp không có dòng nhiệm vụ nào để nhập (tối đa 500).' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."nvq_lo_nhap" ("ky_id", "ten_tep", "nhap_boi") VALUES (k."id", left("p_ten_tep", 300), "auth"."uid"()) RETURNING "id" INTO v_lo;
  FOR d IN SELECT * FROM jsonb_array_elements("p_dong") LOOP
  BEGIN   -- lỗi ràng buộc của một dòng → một câu tiếng Việt nêu vị trí (cả lô huỷ)
    IF EXISTS (SELECT 1 FROM unnest(ARRAY[nullif(d ->> 'chu_tri_theo_doi', '')::uuid] || ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(d -> 'phoi_hop_theo_doi', '[]')) x)) a
               WHERE a IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."accounts" c WHERE c."id" = a AND NOT coalesce(c."bi_khoa", false) AND NOT c."is_system" AND c."role_group" <> 'A0')) THEN
      RAISE EXCEPTION 'Dòng %: chủ trì theo dõi phải là cán bộ Văn phòng đang hoạt động.', d ->> 'stt' USING ERRCODE = '22023';
    END IF;
    SELECT "id" INTO v_id FROM "public"."nvq_nhiem_vu" WHERE "ky_id" = k."id" AND "truc_so" = (d ->> 'truc_so')::smallint AND "nhom" = d ->> 'nhom' AND "stt" = (d ->> 'stt')::smallint;
    IF v_id IS NOT NULL THEN
      PERFORM "public"."nvq_nhiem_vu_luu"((d - 'san_pham' - 'cap_nhat_dau' - 'chu_tri_theo_doi' - 'phoi_hop_theo_doi' - 'phong_theo_doi' - 'du_lieu_goc')
                                          || jsonb_build_object('id', v_id), coalesce(nullif("p_ten_tep", ''), 'Nhập lại danh mục'));
      v_sua := v_sua + 1; CONTINUE;
    END IF;
    v_id := "public"."nvq_nhiem_vu_luu"((d - 'san_pham' - 'cap_nhat_dau') || jsonb_build_object('ky_id', k."id"), NULL);
    UPDATE "public"."nvq_nhiem_vu" SET "nguon" = 'NHAP', "lo_nhap_id" = v_lo, "du_lieu_goc" = d -> 'du_lieu_goc',
      "chu_tri_theo_doi" = nullif(d ->> 'chu_tri_theo_doi', '')::uuid,
      "phoi_hop_theo_doi" = coalesce(ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(d -> 'phoi_hop_theo_doi', '[]')) x), '{}'),
      "phong_theo_doi" = nullif(btrim(coalesce(d ->> 'phong_theo_doi', '')), '')
    WHERE "id" = v_id;
    FOR e IN SELECT * FROM jsonb_array_elements(coalesce(d -> 'san_pham', '[]')) LOOP
      PERFORM "public"."nvq_kiem_san_pham"(e, k);
      INSERT INTO "public"."nvq_san_pham" ("nhiem_vu_id", "thu_tu", "mo_ta", "loai", "han", "han_text", "chi_tieu_co_ban", "don_vi_tinh", "muc_tieu", "chieu",
                                           "trang_thai", "ngay_hoan_thanh", "kq_so_ky_hieu", "kq_ngay", "kq_mo_ta", "sua_boi")
      VALUES (v_id, coalesce(nullif(e ->> 'thu_tu', '')::smallint, 1), btrim(e ->> 'mo_ta'), coalesce(nullif(e ->> 'loai', ''), 'VAN_BAN'), nullif(e ->> 'han', '')::date,
              nullif(e ->> 'han_text', ''), nullif(e ->> 'chi_tieu_co_ban', ''), nullif(e ->> 'don_vi_tinh', ''), nullif(e ->> 'muc_tieu', '')::numeric,
              coalesce(nullif(e ->> 'chieu', ''), 'CAO_HON_TOT'), coalesce(nullif(e ->> 'trang_thai', ''), 'CHUA'),
              CASE WHEN e ->> 'trang_thai' = 'HOAN_THANH' THEN coalesce(nullif(e ->> 'ngay_hoan_thanh', '')::date, nullif(e ->> 'kq_ngay', '')::date,
                least(coalesce(nullif(e ->> 'han', '')::date, "public"."kl_hom_nay"()), "public"."kl_hom_nay"())) END,   -- tệp không ghi ngày xong: coi như xong đúng mốc
              nullif(e ->> 'kq_so_ky_hieu', ''), nullif(e ->> 'kq_ngay', '')::date, nullif(e ->> 'kq_mo_ta', ''), "auth"."uid"());
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM "public"."nvq_san_pham" WHERE "nhiem_vu_id" = v_id) THEN
      INSERT INTO "public"."nvq_san_pham" ("nhiem_vu_id", "mo_ta", "loai", "han", "sua_boi")
      VALUES (v_id, coalesce(nullif(d ->> 'ket_qua_can_dat', ''), 'Kết quả theo yêu cầu nhiệm vụ'), 'KHAC', k."den_ngay", "auth"."uid"());
    END IF;
    v_cd := d -> 'cap_nhat_dau';
    v_kq := nullif(btrim(coalesce(v_cd ->> 'ket_qua_thuc_hien', '')), '');
    IF v_kq IS NOT NULL THEN
      v_ngay := least(coalesce(nullif(v_cd ->> 'ngay_bao_cao', '')::date, "public"."kl_hom_nay"()), "public"."kl_hom_nay"());
      INSERT INTO "public"."nvq_cap_nhat" ("nhiem_vu_id", "tuan_id", "ngay_bao_cao", "noi_dung", "nguon_thong_tin", "tao_boi")
      VALUES (v_id, "public"."nvq_tuan_cua"(k."id", v_ngay), v_ngay, v_kq, left(coalesce(nullif(v_cd ->> 'nguon_thong_tin', ''), "p_ten_tep"), 300), "auth"."uid"());
      UPDATE "public"."nvq_nhiem_vu" SET "ket_qua_thuc_hien" = v_kq, "ket_qua_luc" = now(), "ket_qua_boi" = "auth"."uid"() WHERE "id" = v_id;
    END IF;
    v_moi := v_moi + 1;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR not_null_violation OR unique_violation OR invalid_text_representation OR numeric_value_out_of_range
                 OR invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Dòng %.%.(%): dữ liệu không hợp lệ hoặc quá dài (trục 1–6, Stt 1–999, chỉ tiêu cơ bản phải có mục tiêu, ngày đúng dạng) — sửa trong tệp rồi nhập lại.',
      d ->> 'truc_so', CASE d ->> 'nhom' WHEN 'TRONG_CT' THEN '1' ELSE '2' END, d ->> 'stt' USING ERRCODE = '22023';
  END;
  END LOOP;
  UPDATE "public"."nvq_lo_nhap" SET "so_moi" = v_moi, "so_sua" = v_sua WHERE "id" = v_lo;
  PERFORM "public"."nvq_ghi_lich_su"(NULL, k."id", 'nhap', format('Nhập danh mục%s: %s nhiệm vụ mới, %s nhiệm vụ cập nhật thông tin', coalesce(' từ ' || "p_ten_tep", ''), v_moi, v_sua));
  RETURN jsonb_build_object('lo_id', v_lo, 'so_moi', v_moi, 'so_sua', v_sua);
END;
$$;
-- Hoàn tác lô (trong 24 giờ): xoá các nhiệm vụ lô đã THÊM khi chưa có cập nhật, ý kiến, tệp nào sau lúc nhập. Nhiệm vụ lô chỉ sửa thông tin: không hoàn tác.
CREATE FUNCTION "public"."nvq_hoan_tac_lo"("p_lo" uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l "public"."nvq_lo_nhap"; v_so integer;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO l FROM "public"."nvq_lo_nhap" WHERE "id" = "p_lo" FOR UPDATE;
  IF l."id" IS NULL OR l."hoan_tac_luc" IS NOT NULL THEN RAISE EXCEPTION 'Không có lô nhập này hoặc lô đã hoàn tác.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nvq_ky_mo"(l."ky_id");
  IF l."nhap_luc" < now() - interval '24 hours' THEN RAISE EXCEPTION 'Chỉ hoàn tác lô trong 24 giờ sau khi nhập.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM "public"."nvq_nhiem_vu" n WHERE n."lo_nhap_id" = l."id" AND n."nguon" = 'NHAP' AND (
       EXISTS (SELECT 1 FROM "public"."nvq_cap_nhat" c WHERE c."nhiem_vu_id" = n."id" AND c."tao_luc" > l."nhap_luc" + interval '5 minutes')
       OR EXISTS (SELECT 1 FROM "public"."nvq_y_kien" y WHERE y."nhiem_vu_id" = n."id") OR EXISTS (SELECT 1 FROM "public"."nvq_tep" t WHERE t."nhiem_vu_id" = n."id")
       OR EXISTS (SELECT 1 FROM "public"."nvq_lich_su" h WHERE h."nhiem_vu_id" = n."id" AND h."luc" > l."nhap_luc" + interval '5 minutes')   -- phân công, sửa, đánh giá…
       OR EXISTS (SELECT 1 FROM "public"."nvq_nhiem_vu" m WHERE m."tu_nhiem_vu_id" = n."id")                                                 -- đã chuyển sang quý sau
       OR EXISTS (SELECT 1 FROM "public"."nvq_tuan_anh" a WHERE a."nhiem_vu_id" = n."id"))) THEN                                             -- đã vào báo cáo tuần đã chốt
    RAISE EXCEPTION 'Nhiệm vụ của lô đã được cập nhật, sửa, phân công, đánh giá, ghi ý kiến, đính kèm tệp hoặc đã vào báo cáo tuần đã chốt — không hoàn tác được.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM "public"."nvq_nhiem_vu" WHERE "lo_nhap_id" = l."id" AND "nguon" = 'NHAP';
  GET DIAGNOSTICS v_so = ROW_COUNT;
  UPDATE "public"."nvq_lo_nhap" SET "hoan_tac_luc" = now() WHERE "id" = l."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, l."ky_id", 'hoan_tac_lo', format('Hoàn tác lô nhập %s: xoá %s nhiệm vụ', coalesce(l."ten_tep", ''), v_so));
  RETURN v_so;
END;
$$;

-- ---- 3. Chốt tuần: ảnh chụp trạng thái từng nhiệm vụ (báo cáo tuần, xu hướng); mở lại tuần ----
CREATE FUNCTION "public"."nvq_tuan_chot"("p_tuan" uuid, "p_nhan_xet" text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w "public"."nvq_tuan"; v_sl jsonb;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO w FROM "public"."nvq_tuan" WHERE "id" = "p_tuan" FOR UPDATE;
  IF w."id" IS NULL THEN RAISE EXCEPTION 'Không có tuần báo cáo này.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nvq_ky_mo"(w."ky_id");
  IF w."tu_ngay" > "public"."kl_hom_nay"() THEN RAISE EXCEPTION 'Tuần báo cáo chưa bắt đầu.' USING ERRCODE = '22023'; END IF;
  DELETE FROM "public"."nvq_tuan_anh" WHERE "tuan_id" = w."id";
  INSERT INTO "public"."nvq_tuan_anh" ("tuan_id", "nhiem_vu_id", "trang_thai", "muc", "so_san_pham", "so_xong", "co_cap_nhat", "ket_qua")
  SELECT w."id", v."id", v."trang_thai", v."muc", v."so_san_pham", v."so_xong",
         EXISTS (SELECT 1 FROM "public"."nvq_cap_nhat" c WHERE c."nhiem_vu_id" = v."id" AND c."tuan_id" = w."id"), v."ket_qua_thuc_hien"
  FROM "public"."v_nvq_nhiem_vu" v WHERE v."ky_id" = w."ky_id";
  SELECT jsonb_build_object('tong', count(*) FILTER (WHERE "trang_thai" <> 'RUT'), 'hoan_thanh', count(*) FILTER (WHERE "trang_thai" = 'HOAN_THANH'),
    'dang', count(*) FILTER (WHERE "trang_thai" = 'DANG_THUC_HIEN'), 'thuong_xuyen', count(*) FILTER (WHERE "trang_thai" = 'THUONG_XUYEN'),
    'cham', count(*) FILTER (WHERE "trang_thai" = 'CHAM_TIEN_DO'), 'chua', count(*) FILTER (WHERE "trang_thai" = 'CHUA_TRIEN_KHAI'),
    'rut', count(*) FILTER (WHERE "trang_thai" = 'RUT'), 'co_cap_nhat', count(*) FILTER (WHERE "co_cap_nhat" AND "trang_thai" <> 'RUT'))
  INTO v_sl FROM "public"."nvq_tuan_anh" WHERE "tuan_id" = w."id";
  UPDATE "public"."nvq_tuan" SET "trang_thai" = 'DA_CHOT', "chot_boi" = "auth"."uid"(), "chot_luc" = now(), "so_lieu" = v_sl,
    "nhan_xet" = nullif(btrim(coalesce("p_nhan_xet", '')), '') WHERE "id" = w."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, w."ky_id", 'chot_tuan', format('Chốt báo cáo tuần %s (%s – %s)', w."so", to_char(w."tu_ngay", 'DD/MM'), to_char(w."den_ngay", 'DD/MM/YYYY')), v_sl);
  RETURN v_sl;
END;
$$;
CREATE FUNCTION "public"."nvq_tuan_mo_lai"("p_tuan" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w "public"."nvq_tuan"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO w FROM "public"."nvq_tuan" WHERE "id" = "p_tuan" FOR UPDATE;
  IF w."id" IS NULL OR w."trang_thai" <> 'DA_CHOT' THEN RAISE EXCEPTION 'Tuần báo cáo chưa chốt.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nvq_ky_mo"(w."ky_id");
  UPDATE "public"."nvq_tuan" SET "trang_thai" = 'MO' WHERE "id" = w."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, w."ky_id", 'mo_lai_tuan', format('Mở lại báo cáo tuần %s — lý do: %s', w."so", v_ly));
END;
$$;
