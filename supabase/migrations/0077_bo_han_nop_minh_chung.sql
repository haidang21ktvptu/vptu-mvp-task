-- 0077: Bỏ hạn nộp minh chứng (Đợt A v3.17, yêu cầu 7/10/2026 mục 4.1 — "mỗi việc một hạn": nộp minh chứng và nghiệm thu đều tính theo hạn hoàn thành).
-- 1. Trigger bd_nhiem_vu_han_nop_mc (viết lại, cùng tên): MỌI đường ghi (giao_viec, nhập Excel 0074, GIA_HAN 0056, API) đều đưa han_nop_minh_chung /
--    ly_do_han_nop_sat về NULL — không cần sửa từng hàm. Hoàn thành (chuyển sang HOAN_THANH trong phiên người dùng) với việc theo_1400 chỉ khi có
--    minh chứng được nghiệm thu (hop_le = true) — mọi việc như nhau, không còn phân biệt "có hạn nộp"; seed / fixture (không phiên) không bị ép.
-- 2. dat_han_nop_minh_chung: báo "đã bỏ". Trigger zb_nhiem_vu_nhac_dat_han_nop (nhắc đặt hạn nộp khi việc có hạn) xoá cùng hàm.
-- 3. xac_nhan_minh_chung: trả lại chỉ cần lý do; p_han_nop_lai giữ trong chữ ký (bỏ qua, ghi NULL) để client cũ không lỗi. Tin trả lại không còn
--    "nộp lại trước …"; người nộp nộp lại trước hạn hoàn thành.
-- 4. trang_thai_dong (bản 0066): bỏ ngữ nghĩa hạn nộp — không còn CHAM_NOP_MINH_CHUNG, han_nop_hieu_luc NULL, Vàng chỉ theo hạn hoàn thành (0050);
--    nop_dung_han = ngày nộp lượt được nghiệm thu (hoặc đang chờ) ≤ hạn hoàn thành; nghiem_thu_dung_han không còn đòi hạn nộp; quét minh chứng cho
--    mọi việc (việc đóng không có minh chứng ⇒ minh_chung_buoc NULL). Giữ điều kiện inline 0050/0058: SQL STABLE, một SELECT, không CTE.
-- 5. Dữ liệu: ba cột về NULL (tắt trigger lịch sử trong lúc cập nhật — không ghi vết hàng loạt). Cột và kiểu giữ nguyên (view v_nhiem_vu, trang_thai_kq).

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_han_nop_mc"() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW."han_nop_minh_chung" := NULL; NEW."ly_do_han_nop_sat" := NULL;   -- 0077: hạn nộp minh chứng đã bỏ — mọi đường ghi đều về NULL
  IF NEW."tien_do_ma" = 'HOAN_THANH' AND (TG_OP = 'INSERT' OR OLD."tien_do_ma" <> 'HOAN_THANH') AND NEW."theo_1400" AND "auth"."uid"() IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = NEW."id" AND m."hop_le") THEN
    RAISE EXCEPTION 'Nhiệm vụ chỉ hoàn thành khi lãnh đạo nghiệm thu minh chứng (xác nhận hợp lệ).' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."dat_han_nop_minh_chung"("p_id" uuid, "p_han" date, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Hạn nộp minh chứng đã được bỏ từ phiên bản 3.17 — người thực hiện nộp minh chứng trước hạn hoàn thành.' USING ERRCODE = '22023';
END;
$$;
DROP TRIGGER IF EXISTS "zb_nhiem_vu_nhac_dat_han_nop" ON "public"."nhiem_vu";
DROP FUNCTION IF EXISTS "public"."kl_nhiem_vu_nhac_dat_han_nop"();

-- 3. xac_nhan_minh_chung (bản 0063) — bỏ hạn nộp lại.
CREATE OR REPLACE FUNCTION "public"."xac_nhan_minh_chung"("p_id" uuid, "p_hop_le" boolean, "p_ly_do" text DEFAULT NULL, "p_han_nop_lai" date DEFAULT NULL,
                                                          "p_chat_luong" text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mc "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
        v_mo boolean; v_dong boolean; v_thay text := ''; v_tin text; v_cl text := nullif(btrim(coalesce("p_chat_luong", '')), '');
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NOT NULL THEN SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id"; END IF;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_nghiem_thu"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ người theo dõi hoặc lãnh đạo trong phạm vi mới xác nhận minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."nop_boi" = "auth"."uid"() THEN RAISE EXCEPTION 'Không tự xác nhận minh chứng do chính mình nộp.' USING ERRCODE = '42501'; END IF;
  IF "p_hop_le" IS NULL THEN RAISE EXCEPTION 'Phải chọn Hợp lệ hoặc Không hợp lệ.' USING ERRCODE = '22023'; END IF;
  v_mo := v_nv."tien_do_ma" <> 'HOAN_THANH' AND v_nv."dong_luc" IS NULL;
  v_dong := "p_hop_le" AND v_mo AND v_mc."ngay_van_ban" IS NOT NULL;   -- Q2: nghiệm thu = đóng việc
  IF v_cl IS NOT NULL AND "public"."kl_ten_chat_luong"(v_cl) IS NULL THEN RAISE EXCEPTION 'Chất lượng hoàn thành không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF NOT "p_hop_le" AND v_cl IS NOT NULL THEN RAISE EXCEPTION 'Trả lại minh chứng không ghi chất lượng hoàn thành.' USING ERRCODE = '22023'; END IF;
  IF v_dong AND v_cl IS NULL THEN
    RAISE EXCEPTION 'Nghiệm thu phải chọn chất lượng hoàn thành (Không đạt / Đạt / Đạt tốt / Đạt xuất sắc).' USING ERRCODE = '22023';
  END IF;
  IF "p_hop_le" AND NOT v_dong AND v_cl IS NOT NULL THEN
    RAISE EXCEPTION 'Chỉ ghi chất lượng hoàn thành khi nghiệm thu đóng nhiệm vụ.' USING ERRCODE = '22023';
  END IF;
  IF NOT "p_hop_le" AND v_ly_do IS NULL THEN RAISE EXCEPTION 'Bác minh chứng phải ghi lý do.' USING ERRCODE = '22023'; END IF;
  IF "public"."kl_viec_a0_giao_cvp"(v_nv) AND ("public"."me_thu_ky_tt"() OR "public"."me_quan_tri_kl"()) THEN   -- Q8: thư ký / quản trị thay mặt
    v_thay := ' — thay mặt Thường trực — ' || coalesce((SELECT "full_name" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), '');
  END IF;
  UPDATE "public"."minh_chung" SET "hop_le" = "p_hop_le", "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(),
    "ly_do_khong_hop_le" = CASE WHEN "p_hop_le" THEN NULL ELSE v_ly_do END, "han_nop_lai" = NULL WHERE "id" = "p_id";
  v_tin := format('%s · %s: %s%s%s', CASE WHEN "p_hop_le" THEN 'Minh chứng hợp lệ (nghiệm thu)' ELSE 'Minh chứng bị trả lại' END, v_nv."ma",
                  coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)),
                  CASE WHEN "p_hop_le" THEN '' ELSE ' — ' || v_ly_do || CASE WHEN v_mo AND v_nv."han_xu_ly" IS NOT NULL
                    THEN ' — nộp lại trước hạn hoàn thành ' || to_char(v_nv."han_xu_ly", 'DD/MM/YYYY') ELSE '' END END, v_thay);
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan', v_tin);
  IF v_thay <> '' AND NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN   -- thư ký: nguoi_lien_quan chỉ trả khi người gọi thấy việc theo quy tắc gốc
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT "auth"."uid"(), u, v_tin, false, 'he_thong', v_nv."id" FROM (SELECT DISTINCT unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) AS u) x
    WHERE u IS NOT NULL AND u <> "auth"."uid"();
  END IF;
  IF v_dong THEN   -- Q2: nghiệm thu = đóng việc, ngày hoàn thành = ngày văn bản minh chứng; chất lượng cùng câu UPDATE
    PERFORM set_config('kl.ghi_qua_ham', '1', true);   -- guard a3 cho qua đúng câu UPDATE này (chat_luong ngoài danh sách cột người theo dõi)
    UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_mc."ngay_van_ban", "chat_luong" = v_cl WHERE "id" = v_nv."id";
    PERFORM set_config('kl.ghi_qua_ham', '', true);
    PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'dong_nhiem_vu',
      format('Nghiệm thu và đóng nhiệm vụ · %s: hoàn thành ngày %s — Nghiệm thu: %s%s', v_nv."ma", to_char(v_mc."ngay_van_ban", 'DD/MM/YYYY'),
             "public"."kl_ten_chat_luong"(v_cl), v_thay));
  END IF;
END;
$$;

-- 4. trang_thai_dong (bản 0066) — không còn hạn nộp.
CREATE OR REPLACE FUNCTION "public"."trang_thai_dong"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS SETOF "public"."trang_thai_kq" LANGUAGE sql STABLE ROWS 1 AS $$
  SELECT
    b.trang_thai,
    CASE WHEN b.trang_thai IN ('QUA_HAN', 'QUA_HAN_NGHIEM_THU') THEN ("trang_thai_dong"."ngay" - "nv"."han_xu_ly")::integer END,
    b.ket_qua,
    CASE WHEN b.ket_qua = 'TRE' THEN ("nv"."ngay_hoan_thanh" - "nv"."han_xu_ly")::integer END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."dong_luc" IS NOT NULL
         THEN (("nv"."dong_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - "nv"."ngay_hoan_thanh")::integer END,
    b.dang_dinh_chinh,
    CASE WHEN b.trang_thai = 'QUA_HAN' AND b.dang_dinh_chinh THEN 'DANG_DINH_CHINH' ELSE b.trang_thai END,
    CASE b.trang_thai
      WHEN 'QUA_HAN' THEN CASE WHEN ("trang_thai_dong"."ngay" - "nv"."han_xu_ly") >= b.ddb THEN 'DO_DAC_BIET' ELSE 'DO' END
      WHEN 'QUA_HAN_NGHIEM_THU' THEN CASE WHEN ("trang_thai_dong"."ngay" - "nv"."han_xu_ly") >= b.ddb THEN 'DO_DAC_BIET' ELSE 'DO' END
      WHEN 'CHO_NGHIEM_THU' THEN 'XANH'
      WHEN 'SAP_DEN_HAN' THEN CASE WHEN ("nv"."han_xu_ly" - "trang_thai_dong"."ngay") <= b.vang
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL
                                    AND NOT b.co_hop_le
                                   THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN 'XANH'
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END,
    NULL::date,   -- han_nop_hieu_luc: đã bỏ (0077)
    CASE WHEN b.moi_loai IS NULL AND "nv"."tien_do_ma" = 'HOAN_THANH' THEN NULL WHEN b.cho THEN 'CHO_NGHIEM_THU' WHEN b.tra_lai THEN 'BI_TRA_LAI'
         WHEN b.nt_nd IS NOT NULL THEN 'DA_NGHIEM_THU' WHEN b.moi_loai = 'chu_cu' THEN 'CHU_CU' ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'   -- nộp đúng hạn = ngày nộp ≤ hạn hoàn thành (0077)
         WHEN b.nt_nd IS NOT NULL THEN CASE WHEN b.nt_loai = 'chu_cu' THEN 'KHONG_DANH_GIA' WHEN b.nt_nd <= "nv"."han_xu_ly" THEN 'DUNG_HAN' ELSE 'TRE' END
         WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'KHONG_DANH_GIA'
         WHEN b.cho THEN CASE WHEN b.moi_nd <= "nv"."han_xu_ly" THEN 'DUNG_HAN' ELSE 'TRE' END
         ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
         WHEN b.nt_xd IS NOT NULL THEN CASE WHEN b.nt_xd <= "nv"."han_xu_ly" THEN 'DUNG_HAN' ELSE 'TRE' END
         WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'KHONG_DANH_GIA'
         ELSE 'CHUA' END,
    b.so_tra_lai,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."han_xu_ly" IS NOT NULL THEN
      CASE WHEN "nv"."ngay_hoan_thanh" < "nv"."han_xu_ly" THEN 'TRUOC_HAN' WHEN "nv"."ngay_hoan_thanh" = "nv"."han_xu_ly" THEN 'DUNG_HAN' ELSE 'TRE' END END
  FROM (
    SELECT
      CASE
        WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'HOAN_THANH'
        WHEN "nv"."loai_thoi_han_ma" = 'THUONG_XUYEN' THEN 'THUONG_XUYEN'
        WHEN "nv"."han_xu_ly" IS NULL AND "nv"."loai_thoi_han_ma" = 'CHO_QUYET_DINH' THEN 'CHO_DIEU_KIEN'
        WHEN "nv"."han_xu_ly" IS NULL THEN 'CAN_DIEN_HAN'
        WHEN m.cho AND "nv"."han_xu_ly" < "trang_thai_dong"."ngay" THEN 'QUA_HAN_NGHIEM_THU'
        WHEN m.cho THEN 'CHO_NGHIEM_THU'
        WHEN "nv"."han_xu_ly" < "trang_thai_dong"."ngay" THEN 'QUA_HAN'
        WHEN "nv"."han_xu_ly" <= "trang_thai_dong"."ngay" + greatest(c.nguong, c.vang) THEN 'SAP_DEN_HAN'
        ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh,
      CASE
        WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
        WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
        WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
        ELSE 'TRE' END AS ket_qua,
      c.vang, c.ddb,
      m.*
    FROM (
      SELECT
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k WHERE k."khoa" = 'nguong_sap_den_han_ngay'), 7) AS nguong,
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k
                  WHERE k."khoa" = CASE WHEN "nv"."do_khan" = 'THUONG' THEN 'nguong_vang_ngay' ELSE 'do_khan_' || "nv"."do_khan" || '_vang' END),
                 CASE WHEN "nv"."do_khan" = 'THUONG' THEN 3 ELSE 5 END) AS vang,
        coalesce((SELECT k."gia_tri"::integer FROM "public"."kl_cau_hinh" k WHERE k."khoa" = 'nguong_do_dac_biet_ngay'), 3) AS ddb
      OFFSET 0
    ) c
    CROSS JOIN LATERAL (   -- MỘT lần quét minh chứng của việc (một tham chiếu ⇒ một lần kiểm RLS dạng tập hợp), input đã sắp theo index
      SELECT a.so_tra_lai, a.co_hop_le,
        (a.m1).loai AS moi_loai, (a.m1).hop_le AS moi_hop_le, (a.m1).xd AS moi_xd, (a.m1).nd AS moi_nd, (a.m1).nop_luc AS moi_luc,
        (a.m2).loai AS nt_loai, (a.m2).xd AS nt_xd, (a.m2).nd AS nt_nd, (a.m2).nop_luc AS nt_luc,
        coalesce((a.m1).loai IN ('so_hieu', 'tep'), false) AND ((a.m1).hop_le IS NULL OR (a.m1).xd > "trang_thai_dong"."ngay") AS cho,
        coalesce((a.m1).hop_le = false AND (a.m1).xd <= "trang_thai_dong"."ngay", false) AS tra_lai
      FROM (
        SELECT (array_agg(ROW(mc."loai", mc."hop_le", mc."nop_luc", (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, NULL::date)::"public"."kl_mc_moc" ORDER BY mc."nop_luc" DESC))[1] AS m1,
               (array_agg(ROW(mc."loai", mc."hop_le", mc."nop_luc", (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, NULL::date)::"public"."kl_mc_moc" ORDER BY mc."nop_luc" DESC)
                  FILTER (WHERE mc."hop_le" AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"))[1] AS m2,
               count(*) FILTER (WHERE mc."hop_le" = false AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay")::integer AS so_tra_lai,
               coalesce(bool_or(mc."loai" IN ('so_hieu', 'chu_cu')
                 AND NOT coalesce(mc."hop_le" = false AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay", false)), false) AS co_hop_le
        FROM "public"."minh_chung" mc
        WHERE mc."nhiem_vu_id" = "nv"."id" AND (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"
      ) a
    ) m
    OFFSET 0
  ) b;
$$;

-- 5. Dữ liệu: về NULL. Tắt trigger người dùng của bảng trong lúc cập nhật: không ghi vết từng việc, không đổi cap_nhat_luc / cap_nhat_boi,
--    không kiểm lại quy tắc 1400 / minh chứng với dữ liệu cũ (dòng đã đóng).
ALTER TABLE "public"."nhiem_vu" DISABLE TRIGGER USER;
UPDATE "public"."nhiem_vu" SET "han_nop_minh_chung" = NULL, "ly_do_han_nop_sat" = NULL
WHERE "han_nop_minh_chung" IS NOT NULL OR "ly_do_han_nop_sat" IS NOT NULL;
ALTER TABLE "public"."nhiem_vu" ENABLE TRIGGER USER;
UPDATE "public"."minh_chung" SET "han_nop_lai" = NULL WHERE "han_nop_lai" IS NOT NULL;
