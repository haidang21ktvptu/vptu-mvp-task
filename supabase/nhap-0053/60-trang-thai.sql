-- 0058: Trạng thái theo hạn nộp minh chứng (PR-2b, thiết kế A5, A9 sửa Q-2, Q9). Vẫn MỘT hàm tính (trang_thai_dong; trang_thai là lớp bọc).
-- Giữ điều kiện inline của 0050: SQL, STABLE, không SET / SECURITY DEFINER / STRICT, một câu SELECT, không CTE. Minh chứng của việc gom MỘT lần
-- mỗi dòng (LATERAL, index minh_chung_nhiem_vu_idx) — không đọc ngày nghỉ, không gọi hàm plpgsql (bổ sung A 30/9).
-- Minh chứng tính tại ngày `ngay`: chỉ dòng có ngày nộp (giờ VN) ≤ ngay; "mới nhất" theo nop_luc.
--   đang chờ = mới nhất loại so_hieu/tep (chu_cu chỉ khi việc có hạn nộp) và (hop_le NULL hoặc xác nhận sau ngay);
--   bị trả lại = mới nhất hop_le = false, xác nhận ≤ ngay ⇒ N* = han_nop_lai của dòng đó (không có thì hạn nộp gốc); còn lại N* = hạn nộp gốc.
-- Thứ tự (dừng ở dòng đầu khớp): 1 HOAN_THANH · 2–4 việc không có H (như cũ) · 5 chờ & ngay > H → QUA_HAN_NGHIEM_THU (Đỏ/Đỏ đặc biệt)
--   · 6 chờ → CHO_NGHIEM_THU (Xanh) · 7 ngay > H → QUA_HAN (như cũ) · 8 N* < ngay → CHAM_NOP_MINH_CHUNG (Vàng, không leo thang)
--   · 9 N* − ngay ≤ ngưỡng vàng → SAP_DEN_HAN (H − ngay ≤ ngưỡng sắp đến hạn) hoặc DANG_THUC_HIEN, Vàng
--   · 10 không có N*: như 0050, Vàng thêm điều kiện không có minh chứng hợp lệ trong bảng (Q-2) · 11 có N*, H − ngay ≤ ngưỡng → SAP_DEN_HAN Xanh
--   · 12 còn lại DANG_THUC_HIEN Xanh. ket_qua, lead_time, do_tre_nhap_lieu giữ công thức. so_ngay_qua tính cả dòng 5.
-- Trường mới (cuối kiểu): han_nop_hieu_luc (N*), minh_chung_buoc, nop_dung_han (Q9: minh chứng được nghiệm thu nộp ≤ hạn áp dụng cho lượt đó
--   = hạn nộp lại của lần trả lại liền trước, không có thì hạn gốc), nghiem_thu_dung_han (xác nhận ≤ H), so_lan_tra_lai.

ALTER TYPE "public"."trang_thai_kq"
  ADD ATTRIBUTE "han_nop_hieu_luc" date,
  ADD ATTRIBUTE "minh_chung_buoc" text,
  ADD ATTRIBUTE "nop_dung_han" text,
  ADD ATTRIBUTE "nghiem_thu_dung_han" text,
  ADD ATTRIBUTE "so_lan_tra_lai" integer;

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
                                   WHEN b.n_sao IS NULL AND ("nv"."han_xu_ly" - "trang_thai_dong"."ngay") <= b.vang AND NOT b.co_hop_le
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN CASE WHEN b.vang_moi THEN 'VANG' ELSE 'XANH' END
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END,
    b.n_sao,
    CASE WHEN b.cho THEN 'CHO_NGHIEM_THU' WHEN b.tra_lai THEN 'BI_TRA_LAI' WHEN b.nt_nd IS NOT NULL THEN 'DA_NGHIEM_THU'
         WHEN b.moi_loai = 'chu_cu' THEN 'CHU_CU' ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_nop_minh_chung" IS NULL THEN 'KHONG_DANH_GIA'
         WHEN b.nt_nd IS NOT NULL THEN CASE WHEN b.nt_loai = 'chu_cu' THEN 'KHONG_DANH_GIA'
                                            WHEN b.nt_nd <= coalesce(b.nt_han_ap, "nv"."han_nop_minh_chung") THEN 'DUNG_HAN' ELSE 'TRE' END
         WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'KHONG_DANH_GIA'
         WHEN b.cho THEN CASE WHEN b.moi_nd <= coalesce(b.moi_han_ap, "nv"."han_nop_minh_chung") THEN 'DUNG_HAN' ELSE 'TRE' END
         ELSE 'CHUA_NOP' END,
    CASE WHEN "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
         WHEN b.nt_xd IS NOT NULL THEN CASE WHEN b.nt_xd <= "nv"."han_xu_ly" THEN 'DUNG_HAN' ELSE 'TRE' END
         WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'KHONG_DANH_GIA'
         ELSE 'CHUA' END,
    b.so_tra_lai
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
    CROSS JOIN LATERAL (
      SELECT a.*,
        coalesce(a.moi_loai IN ('so_hieu', 'tep') OR (a.moi_loai = 'chu_cu' AND "nv"."han_nop_minh_chung" IS NOT NULL), false)
          AND (a.moi_hop_le IS NULL OR a.moi_xd > "trang_thai_dong"."ngay") AS cho,
        coalesce(a.moi_hop_le = false AND a.moi_xd <= "trang_thai_dong"."ngay", false) AS tra_lai,
        CASE WHEN a.moi_hop_le = false AND a.moi_xd <= "trang_thai_dong"."ngay" THEN coalesce(a.moi_han_lai, "nv"."han_nop_minh_chung")
             ELSE "nv"."han_nop_minh_chung" END AS n_sao
      FROM (
        SELECT
          (array_agg(x."loai" ORDER BY x."nop_luc" DESC))[1] AS moi_loai,
          (array_agg(x."hop_le" ORDER BY x."nop_luc" DESC))[1] AS moi_hop_le,
          (array_agg(x.xd ORDER BY x."nop_luc" DESC))[1] AS moi_xd,
          (array_agg(x.nd ORDER BY x."nop_luc" DESC))[1] AS moi_nd,
          (array_agg(x."han_nop_lai" ORDER BY x."nop_luc" DESC))[1] AS moi_han_lai,
          (array_agg(x.han_ap ORDER BY x."nop_luc" DESC))[1] AS moi_han_ap,
          count(*) FILTER (WHERE x."hop_le" = false AND x.xd <= "trang_thai_dong"."ngay")::integer AS so_tra_lai,
          coalesce(bool_or(x."loai" IN ('so_hieu', 'chu_cu') AND NOT coalesce(x."hop_le" = false AND x.xd <= "trang_thai_dong"."ngay", false)), false) AS co_hop_le,
          (array_agg(x.nd ORDER BY x."nop_luc" DESC) FILTER (WHERE x."hop_le" AND x.xd <= "trang_thai_dong"."ngay"))[1] AS nt_nd,
          (array_agg(x.xd ORDER BY x."nop_luc" DESC) FILTER (WHERE x."hop_le" AND x.xd <= "trang_thai_dong"."ngay"))[1] AS nt_xd,
          (array_agg(x."loai" ORDER BY x."nop_luc" DESC) FILTER (WHERE x."hop_le" AND x.xd <= "trang_thai_dong"."ngay"))[1] AS nt_loai,
          (array_agg(x.han_ap ORDER BY x."nop_luc" DESC) FILTER (WHERE x."hop_le" AND x.xd <= "trang_thai_dong"."ngay"))[1] AS nt_han_ap
        FROM (
          SELECT mc."loai", mc."hop_le", mc."nop_luc", mc."han_nop_lai",
                 (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS nd,
                 (mc."xac_nhan_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS xd,
                 CASE WHEN lag(mc."hop_le") OVER w = false THEN lag(mc."han_nop_lai") OVER w END AS han_ap
          FROM "public"."minh_chung" mc
          WHERE mc."nhiem_vu_id" = "nv"."id" AND (mc."nop_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= "trang_thai_dong"."ngay"
          WINDOW w AS (ORDER BY mc."nop_luc")
        ) x
      ) a
    ) m
    OFFSET 0
  ) b;
$$;
