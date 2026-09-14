-- GĐ8 (PR 8A-2, 2/3) — Hàm và trigger module KL BTVTU. Điểm cốt lõi: kl_trang_thai() là NGUỒN DUY NHẤT
-- của trạng thái (Phần 2.1/2.2): view, test, frontend, snapshot đều gọi hàm này với tham số ngày, không tự tính.
-- Tham số đọc từ kl_cau_hinh. Ba mốc thời gian (Phần 6.2) cho ket_qua và do_tre_nhap_lieu; đính chính (Phần 6.4).

-- "Hôm nay" theo giờ Việt Nam: current_date của Postgres trên Supabase là UTC (lệch 7 giờ — từ 0h tới 7h sáng
-- sẽ tính nhầm sang ngày hôm trước). Mọi chỗ so với hôm nay trong module KL dùng hàm này.
CREATE FUNCTION "public"."kl_hom_nay"() RETURNS date
LANGUAGE "sql" STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date; $$;

CREATE TYPE "public"."kl_trang_thai_kq" AS (
  "trang_thai" text,            -- HOAN_THANH | THUONG_XUYEN | CAN_DIEN_HAN | CHO_DIEU_KIEN | QUA_HAN | SAP_DEN_HAN | DANG_THUC_HIEN
  "so_ngay_qua" integer,        -- chỉ khi QUA_HAN
  "ket_qua" text,               -- chỉ khi HOAN_THANH: DUNG_HAN | TRE | KHONG_DANH_GIA (thiếu ngày hoàn thành hoặc hạn)
  "so_ngay_tre" integer,        -- chỉ khi ket_qua = TRE
  "do_tre_nhap_lieu" integer,   -- ngày từ lúc đơn vị xong (ngay_hoan_thanh) tới lúc ghi vào hệ thống (ghi_hoan_thanh_luc)
  "dang_dinh_chinh" boolean,    -- có đề nghị đính chính đang chờ duyệt
  "nhom_dem" text               -- ô đếm trên dashboard: = trang_thai, trừ QUA_HAN đang đính chính → DANG_DINH_CHINH
);

-- Thứ tự quy tắc đúng Phần 2.2, dừng ở quy tắc đầu tiên khớp. tien_do lấy theo dòng hiện tại (không tái dựng
-- trạng thái quá khứ); tham số ngay chỉ đổi cách so hạn — dashboard dùng kl_hom_nay(), snapshot dùng ngày chốt.
CREATE FUNCTION "public"."kl_trang_thai"("nv" "public"."kl_nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."kl_trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  WITH ch AS (
    SELECT coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_sap_den_han_ngay'), 7) AS nguong
  ), tt AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'HOAN_THANH'
      WHEN "nv"."loai_thoi_han_ma" = 'THUONG_XUYEN' THEN 'THUONG_XUYEN'
      WHEN "nv"."han_xu_ly" IS NULL AND "nv"."loai_thoi_han_ma" = 'CHO_QUYET_DINH' THEN 'CHO_DIEU_KIEN'
      WHEN "nv"."han_xu_ly" IS NULL THEN 'CAN_DIEN_HAN'
      WHEN "nv"."han_xu_ly" < "ngay" THEN 'QUA_HAN'
      WHEN "nv"."han_xu_ly" <= "ngay" + (SELECT nguong FROM ch) THEN 'SAP_DEN_HAN'
      ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."kl_dinh_chinh" d
              WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh
  ), kq AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
      WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
      WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
      ELSE 'TRE' END AS ket_qua
  )
  SELECT ROW(
    tt.trang_thai,
    CASE WHEN tt.trang_thai = 'QUA_HAN' THEN ("ngay" - "nv"."han_xu_ly")::integer END,
    kq.ket_qua,
    CASE WHEN kq.ket_qua = 'TRE' THEN ("nv"."ngay_hoan_thanh" - "nv"."han_xu_ly")::integer END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."ghi_hoan_thanh_luc" IS NOT NULL
         -- Lấy NGÀY theo giờ VN (cast ::date trần dùng múi giờ phiên = UTC → thiếu một ngày khi ghi nhận sau 17h UTC).
         THEN (("nv"."ghi_hoan_thanh_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - "nv"."ngay_hoan_thanh")::integer END,
    tt.dang_dinh_chinh,
    CASE WHEN tt.trang_thai = 'QUA_HAN' AND tt.dang_dinh_chinh THEN 'DANG_DINH_CHINH' ELSE tt.trang_thai END
  )::"public"."kl_trang_thai_kq"
  FROM tt, kq;
$$;

-- Gọi qua PostgREST/test theo id (RLS của người gọi áp lên kl_nhiem_vu: không thấy → NULL).
CREATE FUNCTION "public"."kl_tinh_trang_thai"("p_id" uuid, "p_ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."kl_trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  SELECT "public"."kl_trang_thai"(nv, "p_ngay") FROM "public"."kl_nhiem_vu" nv WHERE nv."id" = "p_id";
$$;

-- Trigger hội nghị: ngày ban hành không ở tương lai (diệt lỗi năm 2025/2026, Phần 1.3 #3).
CREATE FUNCTION "public"."kl_hoi_nghi_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
BEGIN
  IF NEW."ngay_ban_hanh" > "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Ngày ban hành % ở tương lai — kiểm tra lại năm.', to_char(NEW."ngay_ban_hanh", 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "kl_hoi_nghi_truoc_ghi" BEFORE INSERT OR UPDATE ON "public"."kl_hoi_nghi"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_hoi_nghi_truoc_ghi"();

-- Đổi ngày ban hành → hạn của các nhiệm vụ "Ký ban hành" thuộc văn bản đó tính lại (qua trigger nhiệm vụ).
CREATE FUNCTION "public"."kl_hoi_nghi_sau_doi_ngay"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  UPDATE "public"."kl_nhiem_vu" SET "han_xu_ly" = NULL
  WHERE "hoi_nghi_id" = NEW."id" AND "loai_thoi_han_ma" = 'KY_BAN_HANH';
  RETURN NULL;
END;
$$;
CREATE TRIGGER "kl_hoi_nghi_sau_doi_ngay" AFTER UPDATE OF "ngay_ban_hanh" ON "public"."kl_hoi_nghi"
  FOR EACH ROW WHEN (OLD."ngay_ban_hanh" IS DISTINCT FROM NEW."ngay_ban_hanh")
  EXECUTE FUNCTION "public"."kl_hoi_nghi_sau_doi_ngay"();

-- 1) Chủ trì không có quan_tri_kl (A3, hoặc A2 với 10 việc "VPTU") chỉ được đổi các cột cập nhật tiến độ của việc
--    mình (như tasks_guard_a3); service_role/CLI (auth.uid() NULL) không bị giới hạn.
--    Chạy trước trigger ghi (tên bắt đầu bằng "a_"); cột hệ thống do trigger ghi đặt được loại ra khi so.
CREATE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung',
                              'van_ban_trien_khai', 'ghi_chu', 'cap_nhat_luc', 'cap_nhat_boi', 'ghi_hoan_thanh_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Chủ trì chỉ được cập nhật tiến độ, hạn, lý do chưa có hạn, ngày hoàn thành, minh chứng, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "a_kl_nhiem_vu_guard_a3" BEFORE UPDATE ON "public"."kl_nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_guard_a3"();

-- 2) Chuẩn hoá và kiểm tra trước khi ghi (Phần 2.3, 6.2). SECURITY DEFINER để đọc kl_hoi_nghi/kl_cau_hinh
--    không phụ thuộc RLS người gọi; auth.uid() vẫn là người gọi.
CREATE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ngay_bh date; v_ky integer;
BEGIN
  SELECT "ngay_ban_hanh" INTO v_ngay_bh FROM "public"."kl_hoi_nghi" WHERE "id" = NEW."hoi_nghi_id";
  IF NEW."loai_thoi_han_ma" = 'KY_BAN_HANH' THEN
    -- Hạn tự tính, không cho nhập tay (diệt lỗi 12 dòng công thức sheet không chạy).
    SELECT coalesce("gia_tri"::integer, 10) INTO v_ky FROM "public"."kl_cau_hinh" WHERE "khoa" = 'ky_ban_hanh_ngay';
    NEW."han_xu_ly" := v_ngay_bh + coalesce(v_ky, 10);
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" < v_ngay_bh THEN
    RAISE EXCEPTION 'Hạn xử lý không được trước ngày ban hành (%).', to_char(v_ngay_bh, 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL THEN NEW."ly_do_chua_co_han" := NULL; END IF;   -- có hạn thì lý do chưa có hạn hết ý nghĩa
  IF NEW."tien_do_ma" <> 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh" := NULL;
    NEW."ghi_hoan_thanh_luc" := NULL;
  ELSE
    IF NEW."ngay_hoan_thanh" IS NOT NULL AND (NEW."ngay_hoan_thanh" < v_ngay_bh OR NEW."ngay_hoan_thanh" > "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.' USING ERRCODE = '22023';
    END IF;
    -- Lúc ghi nhận Hoàn thành (để tính độ trễ nhập liệu): app = now(); dòng Excel giữ giá trị script đưa vào (thường NULL).
    IF TG_OP = 'UPDATE' AND OLD."tien_do_ma" <> 'HOAN_THANH' THEN NEW."ghi_hoan_thanh_luc" := now();
    ELSIF TG_OP = 'INSERT' AND NEW."nguon" = 'app' THEN NEW."ghi_hoan_thanh_luc" := now();
    ELSIF TG_OP = 'UPDATE' THEN NEW."ghi_hoan_thanh_luc" := OLD."ghi_hoan_thanh_luc";
    END IF;
  END IF;
  -- Mốc hệ thống: dòng Excel lúc nhập giữ cap_nhat_luc script đưa vào (quyết định 9); còn lại = now().
  IF TG_OP = 'UPDATE' OR NEW."nguon" = 'app' THEN
    NEW."cap_nhat_luc" := now();
    NEW."cap_nhat_boi" := "auth"."uid"();
  END IF;
  IF TG_OP = 'INSERT' AND NEW."tao_boi" IS NULL THEN NEW."tao_boi" := "auth"."uid"(); END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "b_kl_nhiem_vu_truoc_ghi" BEFORE INSERT OR UPDATE ON "public"."kl_nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"();

-- 3) Lịch sử: INSERT một dòng cot = '*'; UPDATE một dòng mỗi cột đổi (bỏ cột hệ thống). SECURITY DEFINER vì
--    kl_lich_su không cho ai INSERT trực tiếp. Đang duyệt đính chính thì nguon = 'dinh_chinh' (biến phiên kl.dinh_chinh_id).
CREATE FUNCTION "public"."kl_nhiem_vu_lich_su"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_dc uuid := nullif(current_setting('kl.dinh_chinh_id', true), '')::uuid; r record;
        bo text[] := ARRAY['cap_nhat_luc', 'cap_nhat_boi', 'ghi_hoan_thanh_luc', 'thieu_minh_chung', 'created_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "public"."kl_lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (NEW."id", "auth"."uid"(), '*', NEW."ma", CASE WHEN NEW."nguon" = 'excel' THEN 'excel' ELSE 'app' END);
    RETURN NULL;
  END IF;
  FOR r IN SELECT n.key, o.value AS cu, n.value AS moi
           FROM jsonb_each_text(to_jsonb(NEW) - bo) n
           JOIN jsonb_each_text(to_jsonb(OLD) - bo) o ON o.key = n.key
           WHERE n.value IS DISTINCT FROM o.value LOOP
    INSERT INTO "public"."kl_lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon", "dinh_chinh_id")
    VALUES (NEW."id", "auth"."uid"(), r.key, r.cu, r.moi, CASE WHEN v_dc IS NULL THEN 'app' ELSE 'dinh_chinh' END, v_dc);
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER "c_kl_nhiem_vu_lich_su" AFTER INSERT OR UPDATE ON "public"."kl_nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_lich_su"();

-- Đề nghị đính chính (Phần 6.4): chủ trì của dòng hoặc người có quan_tri_kl; giá trị cũ lấy từ dòng hiện tại.
CREATE FUNCTION "public"."kl_de_nghi_dinh_chinh"("p_nhiem_vu" uuid, "p_cot" text, "p_gia_tri_moi" text, "p_ly_do" text, "p_can_cu" text DEFAULT NULL)
RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."kl_nhiem_vu"; v_id uuid;
BEGIN
  SELECT * INTO v_nv FROM "public"."kl_nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL
     OR NOT ("public"."me_quan_tri_kl"() OR v_nv."chu_tri_id" = "auth"."uid"()) THEN
    RAISE EXCEPTION 'Chỉ chủ trì hoặc người quản trị KL mới được đề nghị đính chính.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO "public"."kl_dinh_chinh" ("nhiem_vu_id", "de_nghi_boi", "cot", "gia_tri_cu", "gia_tri_moi", "ly_do", "can_cu")
  VALUES ("p_nhiem_vu", "auth"."uid"(), "p_cot", to_jsonb(v_nv) ->> "p_cot", "p_gia_tri_moi", "p_ly_do", "p_can_cu")
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;

-- Duyệt/bác đề nghị: quan_tri_kl và KHÔNG phải người đề nghị. Duyệt = áp giá trị (cột trong whitelist CHECK của bảng,
-- %I chống tiêm; ràng buộc/trigger của kl_nhiem_vu vẫn chạy), lịch sử ghi nguon = 'dinh_chinh' trỏ về đề nghị.
CREATE FUNCTION "public"."kl_duyet_dinh_chinh"("p_id" uuid, "p_chap_nhan" boolean, "p_ly_do" text DEFAULT NULL)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."kl_dinh_chinh";
BEGIN
  SELECT * INTO v FROM "public"."kl_dinh_chinh" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR NOT "public"."me_quan_tri_kl"() OR v."de_nghi_boi" = "auth"."uid"() THEN
    RAISE EXCEPTION 'Chỉ người quản trị KL (không phải người đề nghị) mới được duyệt đính chính.' USING ERRCODE = '42501';
  END IF;
  IF v."trang_thai" <> 'CHO_DUYET' THEN
    RAISE EXCEPTION 'Đề nghị đính chính này đã được xử lý.' USING ERRCODE = '22023';
  END IF;
  IF "p_chap_nhan" THEN
    PERFORM set_config('kl.dinh_chinh_id', v."id"::text, true);
    EXECUTE format('UPDATE public.kl_nhiem_vu SET %I = %L WHERE id = %L', v."cot", v."gia_tri_moi", v."nhiem_vu_id");
    PERFORM set_config('kl.dinh_chinh_id', '', true);
    UPDATE "public"."kl_dinh_chinh" SET "trang_thai" = 'DA_DUYET', "duyet_boi" = "auth"."uid"(), "duyet_luc" = now() WHERE "id" = "p_id";
  ELSE
    IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
      RAISE EXCEPTION 'Bác bỏ đính chính phải ghi lý do.' USING ERRCODE = '22023';
    END IF;
    UPDATE "public"."kl_dinh_chinh" SET "trang_thai" = 'BAC_BO', "duyet_boi" = "auth"."uid"(), "duyet_luc" = now(),
      "ly_do_bac_bo" = btrim("p_ly_do") WHERE "id" = "p_id";
  END IF;
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['kl_hom_nay()', 'kl_trang_thai(kl_nhiem_vu,date)', 'kl_tinh_trang_thai(uuid,date)',
    'kl_de_nghi_dinh_chinh(uuid,text,text,text,text)', 'kl_duyet_dinh_chinh(uuid,boolean,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- Hàm trigger chỉ chạy qua trigger.
  FOREACH f IN ARRAY ARRAY['kl_hoi_nghi_truoc_ghi()', 'kl_hoi_nghi_sau_doi_ngay()', 'kl_nhiem_vu_guard_a3()',
    'kl_nhiem_vu_truoc_ghi()', 'kl_nhiem_vu_lich_su()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
END $$;
