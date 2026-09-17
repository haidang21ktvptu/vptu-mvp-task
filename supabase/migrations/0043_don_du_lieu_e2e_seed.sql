-- 0043 — Bộ sẵn "dữ liệu thử" của Dọn dữ liệu (qt_don, 0042) xoá thêm bộ dữ liệu mẫu E2E-SEED (scripts/seed-demo.mjs nạp để e2e chạy được trên DB rỗng):
-- văn bản so_ket_luan LIKE 'E2E-SEED%' và nhiệm vụ noi_dung LIKE 'E2E-SEED%'. Phần còn lại của hàm giữ nguyên 0042. Dùng trước go-live (docs/KIEM-THU.md).
CREATE OR REPLACE FUNCTION "public"."qt_don"("p" jsonb, "p_thuc_hien" boolean) RETURNS jsonb
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
    v_vbs := ARRAY(SELECT "id" FROM "public"."van_ban_giao_viec" WHERE "so_ket_luan" LIKE 'E2E-TEST%' OR "so_ket_luan" LIKE 'E2E-SEED%' OR "so_ket_luan" = 'RLS-TEST' OR "so_hoi_nghi" BETWEEN 991 AND 999);
    v_nv := ARRAY(SELECT "id" FROM "public"."nhiem_vu" WHERE "ma" LIKE 'NV-T%' OR "noi_dung" LIKE 'E2E-TEST%' OR "noi_dung" LIKE 'E2E-SEED%' OR "van_ban_id" = ANY (v_vbs)
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
