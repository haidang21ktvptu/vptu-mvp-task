-- 0066: Tiến độ hoàn thành "Trước hạn" (PR-3 hạng mục D; quyết định 1/10/2026). Vẫn MỘT hàm tính (trang_thai_dong, bản 0058 nguyên văn).
-- Trường mới ở CUỐI kiểu trang_thai_kq: tien_do_hoan_thanh = 'TRUOC_HAN' (ngày hoàn thành < hạn), 'DUNG_HAN' (=), 'TRE' (>); NULL khi chưa
-- đóng hoặc thiếu ngày hoàn thành / hạn. KHÔNG đổi ket_qua (DUNG_HAN gồm cả trước hạn) ⇒ mọi số liệu, báo cáo và bộ mốc kl-moc-2026-09-14 giữ
-- nguyên; "Trước hạn" chỉ tách ở hiển thị. Không phụ thuộc tham số ngày (hai cột đều kiểu date, không qua múi giờ).

ALTER TYPE "public"."trang_thai_kq" ADD ATTRIBUTE "tien_do_hoan_thanh" text;

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
      WHEN 'CHAM_NOP_MINH_CHUNG' THEN 'VANG'
      WHEN 'CHO_NGHIEM_THU' THEN 'XANH'
      WHEN 'SAP_DEN_HAN' THEN CASE WHEN b.vang_moi THEN 'VANG'
                                   WHEN b.n_sao IS NULL AND ("nv"."han_xu_ly" - "trang_thai_dong"."ngay") <= b.vang
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL
                                    AND NOT b.co_hop_le
                                   THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN CASE WHEN b.vang_moi THEN 'VANG' ELSE 'XANH' END
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END,
    b.n_sao,
    CASE WHEN b.bo_qua_mc THEN NULL WHEN b.cho THEN 'CHO_NGHIEM_THU' WHEN b.tra_lai THEN 'BI_TRA_LAI' WHEN b.nt_nd IS NOT NULL THEN 'DA_NGHIEM_THU'
         WHEN b.moi_loai = 'chu_cu' THEN 'CHU_CU' ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_nop_minh_chung" IS NULL THEN 'KHONG_DANH_GIA'
         WHEN b.nt_nd IS NOT NULL THEN CASE WHEN b.nt_loai = 'chu_cu' THEN 'KHONG_DANH_GIA'
           WHEN b.nt_nd <= coalesce(b.han_lai_truoc, "nv"."han_nop_minh_chung") THEN 'DUNG_HAN' ELSE 'TRE' END
         WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'KHONG_DANH_GIA'
         WHEN b.cho THEN CASE WHEN b.moi_nd <= coalesce(b.han_lai_truoc, "nv"."han_nop_minh_chung") THEN 'DUNG_HAN' ELSE 'TRE' END
         ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_xu_ly" IS NULL OR "nv"."han_nop_minh_chung" IS NULL THEN 'KHONG_DANH_GIA'
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
        WHEN m.n_sao < "trang_thai_dong"."ngay" THEN 'CHAM_NOP_MINH_CHUNG'
        WHEN m.n_sao - "trang_thai_dong"."ngay" <= c.vang THEN
          CASE WHEN "nv"."han_xu_ly" <= "trang_thai_dong"."ngay" + c.nguong THEN 'SAP_DEN_HAN' ELSE 'DANG_THUC_HIEN' END
        WHEN m.n_sao IS NULL AND "nv"."han_xu_ly" <= "trang_thai_dong"."ngay" + greatest(c.nguong, c.vang) THEN 'SAP_DEN_HAN'
        WHEN m.n_sao IS NOT NULL AND "nv"."han_xu_ly" <= "trang_thai_dong"."ngay" + c.nguong THEN 'SAP_DEN_HAN'
        ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh,
      CASE
        WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
        WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
        WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
        ELSE 'TRE' END AS ket_qua,
      c.vang, c.ddb,
      coalesce(NOT m.cho AND m.n_sao >= "trang_thai_dong"."ngay" AND m.n_sao - "trang_thai_dong"."ngay" <= c.vang, false) AS vang_moi,
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
      SELECT a.so_tra_lai, a.co_hop_le, a.han_lai_truoc, "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."han_nop_minh_chung" IS NULL AS bo_qua_mc,
        (a.m1).loai AS moi_loai, (a.m1).hop_le AS moi_hop_le, (a.m1).xd AS moi_xd, (a.m1).nd AS moi_nd, (a.m1).han_nop_lai AS moi_han_lai, (a.m1).nop_luc AS moi_luc,
        (a.m2).loai AS nt_loai, (a.m2).xd AS nt_xd, (a.m2).nd AS nt_nd, (a.m2).nop_luc AS nt_luc,
        coalesce((a.m1).loai IN ('so_hieu', 'tep') OR ((a.m1).loai = 'chu_cu' AND "nv"."han_nop_minh_chung" IS NOT NULL), false)
          AND ((a.m1).hop_le IS NULL OR (a.m1).xd > "trang_thai_dong"."ngay") AS cho,
        coalesce((a.m1).hop_le = false AND (a.m1).xd <= "trang_thai_dong"."ngay", false) AS tra_lai,
        CASE WHEN (a.m1).hop_le = false AND (a.m1).xd <= "trang_thai_dong"."ngay" THEN coalesce((a.m1).han_nop_lai, "nv"."han_nop_minh_chung")
             ELSE "nv"."han_nop_minh_chung" END AS n_sao
      FROM (
        SELECT (array_agg(ROW(mc."loai", mc."hop_le", mc."nop_luc", (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, mc."han_nop_lai")::"public"."kl_mc_moc" ORDER BY mc."nop_luc" DESC))[1] AS m1,
               (array_agg(ROW(mc."loai", mc."hop_le", mc."nop_luc", (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, mc."han_nop_lai")::"public"."kl_mc_moc" ORDER BY mc."nop_luc" DESC)
                  FILTER (WHERE mc."hop_le" AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"))[1] AS m2,
               count(*) FILTER (WHERE mc."hop_le" = false AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay")::integer AS so_tra_lai,
               -- hạn nộp lại của lần trả lại gần nhất (= "lần trả lại liền trước" của lượt đang chờ / lượt được nghiệm thu — việc đóng khi nghiệm thu)
               (array_agg(mc."han_nop_lai" ORDER BY mc."nop_luc" DESC)
                  FILTER (WHERE mc."hop_le" = false AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"))[1] AS han_lai_truoc,
               coalesce(bool_or(mc."loai" IN ('so_hieu', 'chu_cu')
                 AND NOT coalesce(mc."hop_le" = false AND (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay", false)), false) AS co_hop_le
        FROM "public"."minh_chung" mc
        WHERE mc."nhiem_vu_id" = "nv"."id" AND (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"
          -- việc đã đóng không có hạn nộp (việc cũ): không trường nào cần minh chứng ⇒ bỏ quét (điều kiện chỉ theo tham số: một lần lọc, không đọc index)
          AND NOT ("nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."han_nop_minh_chung" IS NULL)
      ) a
    ) m
    OFFSET 0
  ) b;
$$;
