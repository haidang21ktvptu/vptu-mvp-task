-- 0042 — GĐ23 (tiếp 0041): mốc backup, bản tin 7h30, kl_so_chua_xu_ly thêm thong_bao (phần A) và Dọn dữ liệu (phần B, chỉ quan_tri_he_thong). qt_xem_truoc_xoa(p_pham_vi) trả số dòng từng bảng sẽ mất; qt_xoa_du_lieu(p_pham_vi, 'XOÁ')
-- xoá trong một transaction và ghi nhat_ky_he_thong. p_pham_vi: {loai: tin_nhan | nhiem_vu | chi_dao_canh_bao_lich_su | minh_chung | tat_ca | du_lieu_thu,
-- tai_khoan: uuid, van_ban_id: uuid, tu_ngay: date, den_ngay: date, toan_bo: bool}. Ngày theo giờ Việt Nam. du_lieu_thu = NV-T*, E2E-TEST*, văn bản
-- RLS-TEST / hội nghị 991–999, tài khoản demo_* (không smoke_test) và mọi thứ gắn với chúng. Tệp minh chứng trong Storage không xoá ở đây.
-- Frontend chặn thêm khi mốc backup (nhat_ky_he_thong, phần A) quá 24 giờ; hàm không chặn để CLI dùng được sau khi tự backup.

-- ===== A. Mốc backup (workflow gọi bằng service_role qua REST): một dòng nhat_ky_he_thong hanh_dong = 'backup' — màn hình Dọn dữ liệu đọc dòng mới nhất
--    (không đặt vào kl_cau_hinh: mọi giá trị ở đó được ép kiểu integer trong trang_thai). Bản tin 7h30 (job cảnh báo gọi): chỉ service_role.
CREATE FUNCTION "public"."ghi_moc_backup"("p_nhan" text) RETURNS timestamp with time zone
LANGUAGE "sql" SECURITY DEFINER SET "search_path" = "public" AS $$
  INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet") VALUES (NULL, 'backup', left("p_nhan", 120), '{}'::jsonb) RETURNING "luc";
$$;

-- Người bật gom_tin: mỗi sáng một tin hệ thống tóm tắt số thông báo chưa đọc 24 giờ qua (frontend không bật toast rời khi gom_tin).
CREATE FUNCTION "public"."tin_tom_tat_sang"() RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  PERFORM "public"."uy_quyen_thu_het_han"();
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai")
  SELECT NULL, a."id", format('Bản tin 7h30: %s thông báo chưa đọc trên %s nhiệm vụ trong 24 giờ qua. Mở chuông để xem chi tiết.', count(*), count(DISTINCT d."nhiem_vu_id")), false, 'he_thong'
  FROM "public"."accounts" a JOIN "public"."direct_messages" d ON d."receiver_id" = a."id" AND d."loai" = 'he_thong' AND NOT d."is_read"
       AND d."created_at" >= now() - interval '24 hours' AND d."content" NOT LIKE 'Bản tin 7h30%'
  WHERE coalesce((a."tuy_chon" ->> 'gom_tin')::boolean, false) GROUP BY a."id";
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$$;

-- 9. kl_so_chua_xu_ly (0039) thêm thong_bao = tin hệ thống chưa đọc (chuông); nhan_tin giữ = mọi tin chưa đọc (pill Nhắn tin).
CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE "sql" STABLE SECURITY INVOKER SET "search_path" = "public" AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap FROM "public"."accounts" WHERE "id" = "auth"."uid"()),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL),
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  quyet AS (SELECT n."id" FROM mo n, me CROSS JOIN LATERAL (SELECT "public"."trang_thai"(n, "public"."kl_hom_nay"()) AS tt) t
            WHERE n."cap_quyet_dinh" = ANY (me.cap) AND NOT n."bi_tu_choi" AND (t.tt)."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') AND NOT (t.tt)."dang_dinh_chinh"),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'thong_bao', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'),
    'can_quyet', (SELECT count(*) FROM quyet),
    'de_nghi_cho_duyet', (SELECT count(*) FROM "public"."tu_choi" t, me WHERE t."trang_thai" = 'CHO_DUYET'
                    AND (t."cap_duyet" = me."id" OR (me."role_group" = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = t."cap_duyet") = 'A0'))),
    'bi_tu_choi', (SELECT count(*) FROM mo n, me WHERE n."bi_tu_choi" AND (me."role_group" IN ('A0', 'A1', 'A2') OR n."tao_boi" = me."id" OR n."giao_thay_mat_cho" = me."id")),
    'tt_cho_nhan', (SELECT count(*) FROM cua_toi WHERE "uu_tien" = 'THUONG_TRUC'),
    'viec_moi', (SELECT count(*) FROM cua_toi),
    'hoa_toc_viec', (SELECT count(*) FROM cua_toi WHERE "do_khan" = 'HOA_TOC'),
    'hoa_toc_chi_dao', (SELECT count(*) FROM ht_cd),
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;


DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ghi_moc_backup(text)', 'tin_tom_tat_sang()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

-- ===== B. Dọn dữ liệu
-- Đếm hoặc xoá một bảng theo điều kiện động; tham số: $1 nhiệm vụ, $2 tài khoản, $3 văn bản, $4 từ, $5 đến (đến là mốc loại trừ).
CREATE FUNCTION "public"."qt_don_bang"("p_bang" text, "p_dieu_kien" text, "p_thuc_hien" boolean,
  "p_nv" uuid[], "p_tk" uuid[], "p_vb" uuid[], "p_tu" timestamp with time zone, "p_den" timestamp with time zone) RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF "p_thuc_hien" THEN
    EXECUTE format('DELETE FROM %s WHERE %s', "p_bang", "p_dieu_kien") USING "p_nv", "p_tk", "p_vb", "p_tu", "p_den";
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    EXECUTE format('SELECT count(*) FROM %s WHERE %s', "p_bang", "p_dieu_kien") INTO v_n USING "p_nv", "p_tk", "p_vb", "p_tu", "p_den";
  END IF;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION "public"."qt_don_bang"(text, text, boolean, uuid[], uuid[], uuid[], timestamp with time zone, timestamp with time zone) FROM "public", "anon", "authenticated";

CREATE FUNCTION "public"."qt_don"("p" jsonb, "p_thuc_hien" boolean) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  v_loai text := coalesce("p" ->> 'loai', '');
  v_thu boolean := v_loai = 'du_lieu_thu';
  v_toan_bo boolean := coalesce(("p" ->> 'toan_bo')::boolean, false);
  v_tk uuid := nullif("p" ->> 'tai_khoan', '')::uuid;
  v_vb uuid := nullif("p" ->> 'van_ban_id', '')::uuid;
  v_tu timestamp with time zone := CASE WHEN nullif("p" ->> 'tu_ngay', '') IS NOT NULL THEN ("p" ->> 'tu_ngay')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' END;
  v_den timestamp with time zone := CASE WHEN nullif("p" ->> 'den_ngay', '') IS NOT NULL THEN (("p" ->> 'den_ngay')::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' END;
  v_nv uuid[]; v_tks uuid[] := '{}'::uuid[]; v_vbs uuid[] := '{}'::uuid[];
  -- bảng con của nhiệm vụ: tên → [cột thời gian, cột người]
  v_con text[][] := ARRAY[['direct_messages', 'created_at', 'receiver_id'], ['chi_dao', 'created_at', 'nguoi_gui'], ['canh_bao', 'gui_luc', NULL],
    ['lich_su', 'luc', 'nguoi_sua'], ['minh_chung', 'nop_luc', 'nop_boi'], ['dinh_chinh', 'created_at', 'de_nghi_boi'], ['tu_choi', 'tao_luc', 'nguoi_de_nghi']];
  v_bang text[]; v_dk text; kq jsonb := '{}'::jsonb; v_n integer; b text; i integer; v_null text;
  -- cột tham chiếu tài khoản cần xoá liên kết trước khi xoá tài khoản thử (dữ liệu thật do tài khoản demo chạm vào vẫn giữ)
  v_fk text[] := ARRAY['accounts.manager_id', 'nhiem_vu.cap_nhat_boi', 'nhiem_vu.giao_thay_mat_cho', 'nhiem_vu.tao_boi', 'van_ban_giao_viec.tao_boi',
    'chi_dao.phan_hoi_boi', 'chi_dao.chu_tri_moi', 'minh_chung.xac_nhan_boi', 'dinh_chinh.duyet_boi', 'tu_choi.cap_duyet', 'lich_su.nguoi_sua',
    'dm_don_vi.lanh_dao_phu_trach', 'phu_trach_phong.phan_cong_boi', 'quyen_lich_su.cap_boi'];
BEGIN
  IF NOT "public"."me_quan_tri_he_thong"() THEN RAISE EXCEPTION 'Chỉ người có quyền quản trị hệ thống mới được dọn dữ liệu.' USING ERRCODE = '42501'; END IF;
  IF v_loai NOT IN ('tin_nhan', 'nhiem_vu', 'chi_dao_canh_bao_lich_su', 'minh_chung', 'tat_ca', 'du_lieu_thu') THEN
    RAISE EXCEPTION 'Loại dữ liệu không hợp lệ: "%".', v_loai USING ERRCODE = '22023';
  END IF;
  IF NOT v_thu AND NOT v_toan_bo AND v_tk IS NULL AND v_vb IS NULL AND v_tu IS NULL AND v_den IS NULL THEN
    RAISE EXCEPTION 'Phải chọn phạm vi: tài khoản, văn bản, khoảng ngày hoặc toàn bộ.' USING ERRCODE = '22023';
  END IF;
  IF v_tu IS NOT NULL AND v_den IS NOT NULL AND v_tu >= v_den THEN RAISE EXCEPTION 'Từ ngày phải trước hoặc bằng đến ngày.' USING ERRCODE = '22023'; END IF;

  IF v_thu THEN
    v_tks := ARRAY(SELECT "id" FROM "public"."accounts" WHERE "username" LIKE 'demo\_%' AND "id" IS DISTINCT FROM "auth"."uid"()); -- không bao giờ xoá chính người gọi
    v_vbs := ARRAY(SELECT "id" FROM "public"."van_ban_giao_viec" WHERE "so_ket_luan" LIKE 'E2E-TEST%' OR "so_ket_luan" = 'RLS-TEST' OR "so_hoi_nghi" BETWEEN 991 AND 999);
    v_nv := ARRAY(SELECT "id" FROM "public"."nhiem_vu" WHERE "ma" LIKE 'NV-T%' OR "noi_dung" LIKE 'E2E-TEST%' OR "van_ban_id" = ANY (v_vbs)
                  OR "tao_boi" = ANY (v_tks) OR "owner_tai_khoan" = ANY (v_tks) OR "nguoi_theo_doi" = ANY (v_tks));
    -- điều kiện chung cho bảng con: gắn nhiệm vụ thử hoặc do tài khoản thử tạo; tin nhắn thêm nội dung RLS-TEST
    v_dk := '(%1$s = ANY ($1) OR %2$s = ANY ($2))';
  ELSE
    IF v_tk IS NOT NULL THEN v_tks := ARRAY[v_tk]; END IF;
    IF v_vb IS NOT NULL THEN v_vbs := ARRAY[v_vb]; END IF;
    v_nv := ARRAY(SELECT n."id" FROM "public"."nhiem_vu" n WHERE v_toan_bo OR ((v_vb IS NULL OR n."van_ban_id" = v_vb)
                  AND (v_tk IS NULL OR v_tk IN (n."tao_boi", n."owner_tai_khoan", n."nguoi_theo_doi"))
                  AND (v_tu IS NULL OR n."created_at" >= v_tu) AND (v_den IS NULL OR n."created_at" < v_den)));
    -- bảng con: theo nhiệm vụ đã lọc; riêng loại tin_nhan / chi_dao... không qua nhiệm vụ thì thêm lọc trực tiếp theo người và ngày
    v_dk := CASE WHEN v_toan_bo THEN 'true'
      WHEN v_vb IS NOT NULL THEN '%1$s = ANY ($1)'
      ELSE '((%1$s = ANY ($1)) OR (($2 <> ''{}''::uuid[] AND %2$s = ANY ($2)) OR ($2 = ''{}''::uuid[] AND %1$s IS NULL AND ($4 IS NULL OR %3$s >= $4) AND ($5 IS NULL OR %3$s < $5))))' END;
  END IF;

  v_bang := CASE v_loai WHEN 'tin_nhan' THEN ARRAY['direct_messages'] WHEN 'chi_dao_canh_bao_lich_su' THEN ARRAY['chi_dao', 'canh_bao', 'lich_su']
    WHEN 'minh_chung' THEN ARRAY['minh_chung'] ELSE ARRAY['direct_messages', 'chi_dao', 'canh_bao', 'lich_su', 'minh_chung', 'dinh_chinh', 'tu_choi'] END;
  -- 1. Bảng con (đếm trước để báo cả phần sẽ mất theo cascade)
  FOR i IN 1 .. array_length(v_con, 1) LOOP
    b := v_con[i][1];
    CONTINUE WHEN NOT (b = ANY (v_bang));
    v_null := coalesce(v_con[i][3], 'NULL::uuid');
    v_n := "public"."qt_don_bang"('public.' || b, format(v_dk, 'nhiem_vu_id', v_null, v_con[i][2])
      || CASE WHEN v_thu AND b = 'direct_messages' THEN ' OR content LIKE ''RLS-TEST%'' OR sender_id = ANY ($2)' ELSE '' END, "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den);
    kq := kq || jsonb_build_object(b, v_n);
  END LOOP;
  -- 2. Nhiệm vụ, văn bản
  IF v_loai IN ('nhiem_vu', 'tat_ca', 'du_lieu_thu') THEN
    kq := kq || jsonb_build_object('nhiem_vu', "public"."qt_don_bang"('public.nhiem_vu', 'id = ANY ($1)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den));
  END IF;
  IF v_loai IN ('tat_ca', 'du_lieu_thu') THEN
    v_dk := CASE WHEN v_thu OR v_vb IS NOT NULL THEN 'id = ANY ($3)' WHEN v_toan_bo THEN 'true'
      ELSE '(($2 <> ''{}''::uuid[] AND tao_boi = ANY ($2)) OR ($2 = ''{}''::uuid[] AND ($4 IS NULL OR created_at >= $4) AND ($5 IS NULL OR created_at < $5))) AND NOT EXISTS (SELECT 1 FROM public.nhiem_vu n WHERE n.van_ban_id = van_ban_giao_viec.id AND NOT (n.id = ANY ($1)))' END;
    kq := kq || jsonb_build_object('van_ban_giao_viec', "public"."qt_don_bang"('public.van_ban_giao_viec', v_dk, "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den));
  END IF;
  -- 3. Tài khoản thử: nhật ký quyền, phân công, dấu vết danh mục, rồi accounts và auth.users (gỡ FK trỏ tới chúng trước)
  IF v_thu THEN
    kq := kq || jsonb_build_object(
      'quyen_lich_su', "public"."qt_don_bang"('public.quyen_lich_su', 'tai_khoan = ANY ($2)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den),
      'phu_trach_phong', "public"."qt_don_bang"('public.phu_trach_phong', 'lanh_dao_id = ANY ($2)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den),
      'dm_lich_su', "public"."qt_don_bang"('public.dm_lich_su', 'nguoi = ANY ($2)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den));
    IF "p_thuc_hien" THEN
      FOREACH b IN ARRAY v_fk LOOP
        EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I = ANY ($1)', split_part(b, '.', 1), split_part(b, '.', 2), split_part(b, '.', 2)) USING v_tks;
      END LOOP;
    END IF;
    kq := kq || jsonb_build_object('accounts', "public"."qt_don_bang"('public.accounts', 'id = ANY ($2)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den));
    kq := kq || jsonb_build_object('auth_users', "public"."qt_don_bang"('auth.users', 'id = ANY ($2)', "p_thuc_hien", v_nv, v_tks, v_vbs, v_tu, v_den));
  END IF;
  RETURN kq || jsonb_build_object('thuc_hien', "p_thuc_hien", 'so_nhiem_vu_pham_vi', coalesce(array_length(v_nv, 1), 0));
END;
$$;
REVOKE ALL ON FUNCTION "public"."qt_don"(jsonb, boolean) FROM "public", "anon", "authenticated";

CREATE FUNCTION "public"."qt_xem_truoc_xoa"("p_pham_vi" jsonb) RETURNS jsonb
LANGUAGE "sql" SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "public"."qt_don"("p_pham_vi", false);
$$;

CREATE FUNCTION "public"."qt_xoa_du_lieu"("p_pham_vi" jsonb, "p_xac_nhan" text) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE kq jsonb;
BEGIN
  IF NOT "public"."me_quan_tri_he_thong"() THEN RAISE EXCEPTION 'Chỉ người có quyền quản trị hệ thống mới được dọn dữ liệu.' USING ERRCODE = '42501'; END IF;
  IF "p_xac_nhan" IS DISTINCT FROM 'XOÁ' THEN RAISE EXCEPTION 'Phải gõ đúng chữ XOÁ để xác nhận.' USING ERRCODE = '22023'; END IF;
  kq := "public"."qt_don"("p_pham_vi", true);
  PERFORM "public"."nhat_ky_ghi"('don_du_lieu', "p_pham_vi" ->> 'loai', jsonb_build_object('pham_vi', "p_pham_vi", 'ket_qua', kq));
  RETURN kq;
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['qt_xem_truoc_xoa(jsonb)', 'qt_xoa_du_lieu(jsonb,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
