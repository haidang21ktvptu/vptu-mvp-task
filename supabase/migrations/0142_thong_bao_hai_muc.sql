-- 0142 (v3.36 — Đợt 1, CAU-HOI V-1, V-10; chủ dự án duyệt 25/11/2026): thông báo hai mức. Mỗi tin hệ thống mang một mức: "Cần đồng chí xử lý"
-- (XU_LY — người nhận phải làm một việc: xác nhận nhận việc, phản hồi chỉ đạo, duyệt đề nghị, quyết vướng mắc, nộp lại minh chứng…) hoặc "Để biết"
-- (BIET — kết quả, thay đổi đã áp dụng, tin báo kèm cấp trên). Chuông chỉ đếm tin cần xử lý chưa đọc; toast và âm chuông chỉ cho tin cần xử lý; tin để
-- biết xem ở thẻ riêng của chuông, tin cũ vẫn xem được.
-- 1. Cột direct_messages.muc_tin (mặc định XU_LY; giá trị hằng nên thêm cột không ghi lại bảng).
-- 2. kl_phan_muc_tin(nội dung, người nhận, nhiệm vụ, nhiệm vụ quý): phân mức theo nhãn đầu tin (hàm tạo tin ghi "<nhãn> · <mã>: …") và vai của người
--    nhận trên việc LÚC GỬI: chủ trì / người theo dõi, người có quyền duyệt, người nhận chỉ đạo Thường trực, người đã ra chỉ đạo còn mở. Nhãn chưa phân
--    loại ⇒ XU_LY (như trước: không giấu tin có thể cần xử lý). Không sửa ~30 hàm tạo tin.
-- 3. Trigger BEFORE INSERT ba_direct_messages_muc_tin: mọi tin được phân mức ở cơ sở dữ liệu (kể cả tin do hàm SECURITY DEFINER tạo); người dùng không
--    tự chọn mức (UPDATE đã thu hồi từ 0008; INSERT luôn bị trigger ghi đè).
-- 4. Tin cũ: phân mức một lần bằng cùng hàm theo dữ liệu hiện tại (chỉ ghi các dòng ra BIET).
-- 5. kl_so_chua_xu_ly (bản 0103 nguyên văn): thong_bao = tin cần xử lý chưa đọc; thêm thong_bao_biet = tin để biết chưa đọc.
-- 6. tin_he_thong_doc_het(p_muc): nút "Đánh dấu đã đọc" theo từng thẻ của chuông (tin_he_thong_da_doc giữ nguyên: mở một việc thì đọc hết tin của việc).
-- 7. tin_tom_tat_sang (bản 0069): bản tin 7h30 đếm tin cần xử lý chưa đọc.

-- 1. Cột mức tin
ALTER TABLE "public"."direct_messages"
  ADD COLUMN "muc_tin" text NOT NULL DEFAULT 'XU_LY' CHECK ("muc_tin" IN ('XU_LY', 'BIET'));

-- 2. Hàm phân mức
CREATE FUNCTION "public"."kl_phan_muc_tin"("p_noi_dung" text, "p_nhan" uuid, "p_nv" uuid, "p_nvq" uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text := coalesce("p_noi_dung", '');
  v "public"."nhiem_vu";
  v_ct boolean := false;   -- người nhận là chủ trì / người theo dõi của việc: người thực hiện, phản hồi chỉ đạo, nộp minh chứng
BEGIN
  IF "p_nv" IS NOT NULL THEN
    SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_nv";
    v_ct := v."id" IS NOT NULL AND coalesce("p_nhan" IN (v."owner_tai_khoan", v."nguoi_theo_doi"), false);
  END IF;

  -- Nhiệm vụ quý của Ban Thường vụ (0133–0139): "Nhiệm vụ quý · <mã>: <loại tin> — …", nhắc tuần "Nhiệm vụ quý: đồng chí còn …"
  IF t LIKE 'Nhiệm vụ quý%' THEN
    IF t LIKE 'Nhiệm vụ quý:%' OR t LIKE '%: đồng chí được phân công theo dõi — %' THEN RETURN 'XU_LY'; END IF;
    IF t LIKE '%: có cập nhật tiến độ mới do đồng chí khác ghi%' OR t LIKE '%: trao đổi — %' THEN RETURN 'BIET'; END IF;
    IF t LIKE '%: có vướng mắc / đề xuất mới — %' THEN   -- Chánh Văn phòng quyết; đầu mối tổng hợp để biết
      RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "p_nhan" AND a."is_chief" AND a."role_group" = 'A1') THEN 'XU_LY' ELSE 'BIET' END;
    END IF;
    IF t LIKE '%: trả lời ý kiến — %' THEN   -- người đã ghi ý kiến chỉ đạo trên nhiệm vụ xem câu trả lời; người khác để biết
      RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."nvq_y_kien" y WHERE y."nhiem_vu_id" = "p_nvq" AND y."nguoi_gui" = "p_nhan" AND y."loai" = 'CHI_DAO')
                  THEN 'XU_LY' ELSE 'BIET' END;
    END IF;
    IF "p_nvq" IS NOT NULL THEN   -- ý kiến chỉ đạo, nhắc mốc (còn … ngày đến mốc, chậm tiến độ): người theo dõi nhiệm vụ xử lý; người được báo kèm để biết
      RETURN CASE WHEN "p_nhan" = ANY ("public"."nvq_nguoi_theo_doi"("p_nvq")) THEN 'XU_LY' ELSE 'BIET' END;
    END IF;
    RETURN 'XU_LY';
  END IF;

  -- Để biết với mọi người nhận: kết quả, thay đổi đã áp dụng, tin tổng hợp
  IF t LIKE 'Bản tin 7h30%' OR t LIKE 'Đã nhận chỉ đạo ·%' OR t LIKE 'Duyệt đề nghị sửa ·%' OR t LIKE 'Ý kiến ·%'
     OR t LIKE 'Nộp minh chứng ·%' OR t LIKE 'Minh chứng hợp lệ ·%' OR t LIKE 'Sửa minh chứng ·%' OR t LIKE 'Hoàn thành nhiệm vụ ·%'
     OR t LIKE 'Đóng nhiệm vụ ·%' OR t LIKE 'Đóng chỉ đạo%' OR t LIKE 'Đóng thay mặt Thường trực%'
     OR t LIKE 'Sửa thông tin giao ·%' OR t LIKE 'Điều chỉnh hạn ·%' OR t LIKE 'Tài khoản quản trị sửa thông tin nhiệm vụ ·%'
     OR (t LIKE 'Nhập Excel ·%' AND t NOT LIKE '%xác nhận đã nhận%')
     OR t LIKE 'Gắn tệp minh chứng ·%' OR t LIKE 'Nghiệm thu và đóng nhiệm vụ ·%' OR t LIKE 'Đổi hạn nộp minh chứng ·%'   -- nhãn cũ (tin trước 0077, 0090)
     OR t LIKE 'Minh chứng hợp lệ (nghiệm thu) ·%' OR t LIKE 'Việc % đã có hạn hoàn thành % — đặt hạn nộp minh chứng%' THEN   -- nhãn cũ 0057–0077; nhắc hạn nộp đã bỏ ở 0077
    RETURN 'BIET';
  END IF;

  -- Cần xử lý với mọi người nhận: hàm tạo tin đã chọn đúng người phải làm (nhắc nghiệm thu: canh_bao_ghi đã bỏ lãnh đạo — 0091)
  IF t LIKE 'Vướng mắc cần lãnh đạo quyết định ·%' OR t LIKE 'Đề nghị đồng chí xử lý vướng mắc ·%'
     OR t LIKE 'Cần nghiệm thu minh chứng ·%' OR t LIKE 'Quá hạn ở bước nghiệm thu ·%'
     OR t LIKE 'Nhập Excel ·%' OR t LIKE 'Đồng chí được giao chủ trì theo dõi%' THEN
    RETURN 'XU_LY';
  END IF;

  -- Kết quả duyệt đề nghị từ chối: không đồng ý thì người đề nghị tiếp tục thực hiện
  IF t LIKE 'Duyệt đề nghị từ chối ·%' THEN
    RETURN CASE WHEN t LIKE '%không đồng ý, tiếp tục thực hiện%' THEN 'XU_LY' ELSE 'BIET' END;
  END IF;

  -- Đề nghị chờ duyệt (từ chối nhận việc, sửa thông tin giao): cấp duyệt và nhóm thay mặt (kl_nguoi_duyet_tu_choi — 0079/0083) xử lý; người khác để biết
  IF t LIKE 'Đề nghị từ chối%' THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."tu_choi" x WHERE x."nhiem_vu_id" = "p_nv" AND x."trang_thai" = 'CHO_DUYET'
                             AND "p_nhan" = ANY ("public"."kl_nguoi_duyet_tu_choi"("p_nv", x."cap_duyet"))) THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  IF t LIKE 'Đề nghị sửa ·%' THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."de_nghi_sua" x WHERE x."nhiem_vu_id" = "p_nv" AND x."trang_thai" = 'CHO_DUYET'
                             AND "p_nhan" = ANY ("public"."kl_nguoi_duyet_tu_choi"("p_nv", x."cap_duyet"))) THEN 'XU_LY' ELSE 'BIET' END;
  END IF;

  -- Chỉ đạo Thường trực (và nhắc quá hạn phản hồi): người nhận chỉ đạo đang chờ phản hồi xử lý; cấp trên, người theo dõi được báo kèm để biết
  IF t LIKE 'Chỉ đạo Thường trực%' THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nv" AND c."loai" = 'CHI_DAO_TT'
                             AND c."trang_thai" = 'CHO_PHAN_HOI' AND "p_nhan" = ANY (c."nguoi_nhan")) THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  -- Phản hồi chỉ đạo: người đã ra chỉ đạo còn mở trên việc xem xét (đóng hoặc chỉ đạo tiếp); chủ trì / người theo dõi khi việc còn chỉ đạo điều hành
  -- chờ phản hồi (người ra chỉ đạo trả lời thêm trong luồng của mình — chi_dao_phan_hoi); người khác để biết
  IF t LIKE 'Phản hồi%' THEN
    RETURN CASE WHEN EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nv" AND c."nguoi_gui" = "p_nhan"
                             AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG')
                  OR (v_ct AND EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nv" AND c."trang_thai" = 'CHO_PHAN_HOI'
                                       AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN', 'CHI_DAO_TT'))) THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  -- Hỏa tốc chưa "Đã nhận": người phải bấm Đã nhận xử lý; lãnh đạo trực tiếp, Chánh Văn phòng được báo kèm để biết
  IF t LIKE 'Hỏa tốc chưa Đã nhận ·%' THEN
    RETURN CASE WHEN v_ct OR EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nv" AND c."do_khan" = 'HOA_TOC'
                                     AND c."trang_thai" <> 'DA_DONG' AND "p_nhan" = ANY (c."nguoi_nhan")
                                     AND NOT ("p_nhan" = ANY (coalesce(c."da_nhan", '{}'::uuid[])))) THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  -- Đổi chủ trì theo dõi: chủ trì mới xử lý (0128: chủ trì = người theo dõi; không xét đã xác nhận — lãnh đạo được tự xác nhận trước khi tin được
  -- phân mức); chủ trì cũ, người giao, lãnh đạo để biết
  IF t LIKE 'Đổi chủ trì theo dõi ·%' THEN
    RETURN CASE WHEN v_ct THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  -- Gỡ minh chứng: việc trở lại đang thực hiện thì chủ trì nộp lại; còn hoàn thành thì để biết
  IF t LIKE 'Gỡ minh chứng ·%' THEN
    RETURN CASE WHEN v_ct AND v."tien_do_ma" <> 'HOAN_THANH' THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  -- Việc phải làm (giao việc; chỉ đạo chờ phản hồi: đôn đốc, gia hạn, giao lại, yêu cầu minh chứng, kiểm tra số liệu; nhắc sắp đến hạn, quá hạn, chậm
  -- nộp minh chứng; việc Thường trực giao chưa xác nhận nhận; minh chứng bị trả lại; mở lại việc): chủ trì / người theo dõi xử lý; lãnh đạo, người giao
  -- việc, người nghiệm thu được báo kèm để biết
  IF t LIKE 'Giao việc ·%' OR t LIKE 'Thường trực giao việc ·%' OR t LIKE 'Đôn đốc ·%' OR t LIKE 'Gia hạn ·%' OR t LIKE 'Giao lại ·%'
     OR t LIKE 'Yêu cầu minh chứng ·%' OR t LIKE 'Kiểm tra số liệu ·%' OR t LIKE 'Sắp đến hạn ·%' OR t LIKE 'Quá hạn dưới %' OR t LIKE 'Quá hạn từ %'
     OR t LIKE 'Chậm nộp minh chứng ·%' OR t LIKE 'Việc Thường trực giao chưa xác nhận nhận ·%' OR t LIKE 'Minh chứng bị trả lại ·%' OR t LIKE 'Minh chứng không hợp lệ ·%'
     OR t LIKE 'Mở lại nhiệm vụ ·%'
     OR t LIKE 'Giao việc thay mặt %' OR t LIKE 'Cảnh báo Vàng ·%' OR t LIKE 'Cảnh báo Đỏ ·%' OR t LIKE 'Cảnh báo Đỏ đặc biệt ·%' THEN   -- nhãn cũ (trước 0098, 0127)
    RETURN CASE WHEN v_ct THEN 'XU_LY' ELSE 'BIET' END;
  END IF;
  RETURN 'XU_LY';   -- nhãn chưa phân loại: đếm trên chuông như trước
END;
$$;

-- 3. Trigger phân mức khi tạo tin
CREATE FUNCTION "public"."kl_direct_messages_muc_tin"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW."muc_tin" := CASE WHEN NEW."loai" = 'he_thong'
    THEN "public"."kl_phan_muc_tin"(NEW."content", NEW."receiver_id", NEW."nhiem_vu_id", NEW."nvq_nhiem_vu_id") ELSE 'XU_LY' END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ba_direct_messages_muc_tin" BEFORE INSERT ON "public"."direct_messages"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_direct_messages_muc_tin"();

-- 4. Tin cũ: phân mức theo dữ liệu hiện tại (chỉ ghi dòng ra BIET; dòng còn lại giữ mặc định XU_LY)
UPDATE "public"."direct_messages" d SET "muc_tin" = 'BIET'
WHERE d."loai" = 'he_thong' AND "public"."kl_phan_muc_tin"(d."content", d."receiver_id", d."nhiem_vu_id", d."nvq_nhiem_vu_id") = 'BIET';

-- 5. Số chưa xử lý (bản 0103 nguyên văn; đổi thong_bao, thêm thong_bao_biet)
CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap,
                "role_group" <> 'A0' AND (coalesce("is_chief" AND "role_group" = 'A1', false) OR coalesce("thu_ky_thuong_truc", false)
                  OR coalesce("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false)) AS nt_rong,
                CASE "role_group" WHEN 'A2' THEN ARRAY["department"]
                  WHEN 'A1' THEN ARRAY(SELECT p."phong" FROM "public"."phu_trach_phong" p WHERE p."lanh_dao_id" = "auth"."uid"()
                                       AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
                  ELSE '{}'::text[] END AS nt_phong
              FROM (SELECT x."id", x."department", x."thu_ky_thuong_truc", x."quan_tri_kl", x."quan_tri_kl_het_han",   -- 0100: toàn quyền = Chánh VP
                           CASE WHEN x."toan_quyen" AND x."role_group" <> 'A0' THEN 'A1' ELSE x."role_group" END AS "role_group",
                           x."is_chief" OR (x."toan_quyen" AND x."role_group" <> 'A0') AS "is_chief"
                    FROM "public"."accounts" x WHERE x."id" = "auth"."uid"()) a),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL
              AND (NOT (SELECT "public"."kl_xem_toan_bo"()) OR (SELECT "public"."kl_xem_tat_ca_vai"()) OR n."id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)))),   -- 0103: trong phạm vi xử lý
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  quyet AS (SELECT n."id" FROM mo n, me CROSS JOIN LATERAL "public"."trang_thai_dong"(n::"public"."nhiem_vu", "public"."kl_hom_nay"()) t
            WHERE n."cap_quyet_dinh" = ANY (me.cap) AND NOT n."bi_tu_choi" AND t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') AND NOT t."dang_dinh_chinh"),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'thong_bao', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'
                    AND d."muc_tin" = 'XU_LY'),   -- 0142: chuông chỉ đếm tin cần xử lý
    'thong_bao_biet', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'
                    AND d."muc_tin" = 'BIET'),
    'can_quyet', (SELECT count(*) FROM quyet),
    'de_nghi_cho_duyet', (SELECT count(*) FROM "public"."tu_choi" t, me WHERE t."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")),   -- 0079
    'bi_tu_choi', (SELECT count(*) FROM mo n, me WHERE n."bi_tu_choi" AND (me."role_group" IN ('A0', 'A1', 'A2') OR n."tao_boi" = me."id" OR n."giao_thay_mat_cho" = me."id")),
    'tt_cho_nhan', (SELECT count(*) FROM cua_toi WHERE "uu_tien" = 'THUONG_TRUC'),
    'viec_moi', (SELECT count(*) FROM cua_toi),
    'hoa_toc_viec', (SELECT count(*) FROM cua_toi WHERE "do_khan" = 'HOA_TOC'),
    'hoa_toc_chi_dao', (SELECT count(*) FROM ht_cd),
    'can_nghiem_thu', (SELECT count(*) FROM mo n, me CROSS JOIN LATERAL (
        SELECT m."nop_boi", m."loai", m."hop_le" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1) mc
      WHERE mc."hop_le" IS NULL AND (mc."loai" IN ('so_hieu', 'tep') OR (mc."loai" = 'chu_cu' AND n."han_nop_minh_chung" IS NOT NULL))
        AND me."role_group" <> 'A0' AND (me.nt_rong OR coalesce(n."giao_thay_mat_cho", n."tao_boi") = me."id"
          OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") AND a."department" = ANY (me.nt_phong))
          OR EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = n."owner_don_vi_ma" AND d."phong" = ANY (me.nt_phong)))
        AND me."id" = ANY ("public"."nguoi_nghiem_thu_chinh"(n::"public"."nhiem_vu", mc."nop_boi"))),
    'co_vuong_mac', (SELECT count(*) FROM mo n, me WHERE me."role_group" IN ('A1', 'A2') AND n."vuong_mac" IS NOT NULL),
    'de_nghi_sua', (SELECT count(*) FROM "public"."de_nghi_sua" d, me WHERE d."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(d."nhiem_vu_id", d."cap_duyet")),   -- 0079
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;

-- 6. Đánh dấu đã đọc mọi tin hệ thống của tôi ở một mức (thẻ đang mở của chuông)
CREATE FUNCTION "public"."tin_he_thong_doc_het"("p_muc" text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  IF "p_muc" IS NULL OR "p_muc" NOT IN ('XU_LY', 'BIET') THEN RAISE EXCEPTION 'Mức thông báo không hợp lệ.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."direct_messages" SET "is_read" = true, "read_at" = now()
  WHERE "receiver_id" = "auth"."uid"() AND "loai" = 'he_thong' AND "is_read" = false AND "muc_tin" = "p_muc";
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 7. Bản tin 7h30 (bản 0069 nguyên văn; chỉ đếm tin cần xử lý)
CREATE OR REPLACE FUNCTION "public"."tin_tom_tat_sang"() RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  -- Lượt gọi chồng nhau chờ nhau tới hết giao dịch; câu INSERT dưới lấy ảnh dữ liệu mới (READ COMMITTED) nên thấy bản tin lượt trước.
  PERFORM pg_advisory_xact_lock(hashtext('public.tin_tom_tat_sang'));
  PERFORM "public"."uy_quyen_thu_het_han"();
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai")
  SELECT NULL, a."id", format('Bản tin 7h30: %s thông báo cần đồng chí xử lý chưa đọc trên %s nhiệm vụ trong 24 giờ qua. Mở chuông để xem chi tiết.',
                              count(*), count(DISTINCT d."nhiem_vu_id")), false, 'he_thong'
  FROM "public"."accounts" a JOIN "public"."direct_messages" d ON d."receiver_id" = a."id" AND d."loai" = 'he_thong' AND NOT d."is_read"
       AND d."muc_tin" = 'XU_LY' AND d."created_at" >= now() - interval '24 hours' AND d."content" NOT LIKE 'Bản tin 7h30%'
  WHERE coalesce((a."tuy_chon" ->> 'gom_tin')::boolean, false)
    AND NOT EXISTS (SELECT 1 FROM "public"."direct_messages" b
                    WHERE b."receiver_id" = a."id" AND b."loai" = 'he_thong' AND b."sender_id" IS NULL AND b."content" LIKE 'Bản tin 7h30%'
                      AND b."created_at" >= ("public"."kl_hom_nay"()::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))
  GROUP BY a."id";
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$$;

-- Quyền: hàm phân mức và trigger chỉ dùng nội bộ; đánh dấu đã đọc theo mức cho người đăng nhập.
REVOKE ALL ON FUNCTION "public"."kl_phan_muc_tin"(text, uuid, uuid, uuid) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."kl_direct_messages_muc_tin"() FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."tin_he_thong_doc_het"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."tin_he_thong_doc_het"(text) TO "authenticated";
