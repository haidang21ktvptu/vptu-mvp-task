#!/usr/bin/env bash
# Khôi phục một file backup (.tar.gz.gpg do backup-db.sh hoặc deploy-prod.yml tạo) lên một project Supabase
# TRẮNG (hoặc project cũ với --ghi-de). Chạy trong Git Bash / ubuntu. Cần: gpg, tar, psql, supabase.
#
#   scripts/restore-db.sh <file.tar.gz.gpg> --project-ref <ref đích> [--ghi-de] [--yes]
#   scripts/restore-db.sh <file.tar.gz.gpg> --local [--ghi-de] [--yes]      # lên `supabase start`
#
# Chốt an toàn nằm trong code: TỪ CHỐI production (frwyxcmbonjaimziiuqr) và staging (vojmrjezspdftovzinek);
# ref trong chuỗi kết nối phải trùng --project-ref; luôn hỏi xác nhận trước khi ghi (chỉ --yes bỏ qua).
# Bí mật qua env hoặc hỏi ẩn: BACKUP_PASSPHRASE, RESTORE_DB_URL (Session pooler cổng 5432, Dashboard →
# Connect). Dữ liệu giải mã KHÔNG ghi ra đĩa (stream gpg → tar → psql).
# Cách làm: schema = `supabase db push` từ supabase/migrations của repo (schema.sql trong backup thiếu trigger
# trên auth.users và lịch sử migration); dữ liệu = psql với session_replication_role = replica (tắt kiểm tra
# FK/trigger khi nạp nên thứ tự auth/public không quan trọng) rồi kiểm chứng FK accounts→auth.users và số dòng.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-sao-luu.sh
source "$REPO/scripts/lib-sao-luu.sh"

FILE=""; REF=""; LOCAL=0; GHI_DE=0; YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --project-ref) REF="${2:-}"; shift 2 ;;
    --local) LOCAL=1; shift ;;
    --ghi-de) GHI_DE=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    -*) loi "Tham số lạ: $1 (xem --help)" ;;
    *) [ -z "$FILE" ] || loi "Chỉ nhận một file backup."; FILE="$1"; shift ;;
  esac
done
# ---- Chốt an toàn 1: kiểm tra ref TRƯỚC mọi việc khác ----
[ "$REF" = "$PRODUCTION_REF" ] && loi "TỪ CHỐI: $REF là project PRODUCTION. Script này không bao giờ ghi lên production."
[ "$REF" = "$STAGING_REF" ] && loi "TỪ CHỐI: $REF là project staging (chỉ dữ liệu giả — rule 11). Dùng project trắng riêng."
if [ "$LOCAL" = 1 ]; then DICH=(--local); REF="local"; else
  [[ "$REF" =~ ^[a-z]{20}$ ]] || loi "Cần --project-ref <20 chữ thường> của project ĐÍCH hoặc --local."
  DICH=(--project-ref "$REF")
fi
[ -n "$FILE" ] || loi "Thiếu file backup (.tar.gz.gpg)."
[ -f "$FILE" ] || loi "Không thấy file: $FILE"
can_cong_cu gpg tar psql supabase
don_dep() { stty echo 2>/dev/null || true; }
trap don_dep EXIT INT TERM HUP

hoi_bi_mat BACKUP_PASSPHRASE "Passphrase của file backup"
if [ "$LOCAL" = 1 ]; then RESTORE_DB_URL="$LOCAL_DB_URL"; else
  hoi_bi_mat RESTORE_DB_URL "Chuỗi kết nối Session pooler của project ĐÍCH (Dashboard → Connect, đã thay mật khẩu)"
fi
# ---- Chốt an toàn 2: chuỗi kết nối phải trỏ đúng project đích ----
[[ "$RESTORE_DB_URL" == *"[YOUR-PASSWORD]"* ]] && loi "Chuỗi kết nối còn [YOUR-PASSWORD] — thay bằng mật khẩu DB thật rồi chạy lại."
REF_URL="$(trich_ref_tu_url "$RESTORE_DB_URL")"
if [ "$LOCAL" = 0 ]; then
  [ -n "$REF_URL" ] || loi "Không nhận ra project trong chuỗi kết nối (cần dạng postgres.<ref>@aws-x-<region>.pooler.supabase.com)."
  [ "$REF_URL" = "$PRODUCTION_REF" ] && loi "TỪ CHỐI: chuỗi kết nối trỏ vào PRODUCTION."
  [ "$REF_URL" = "$STAGING_REF" ] && loi "TỪ CHỐI: chuỗi kết nối trỏ vào staging."
  [ "$REF_URL" = "$REF" ] || loi "Chuỗi kết nối trỏ project $REF_URL, còn --project-ref là $REF — không khớp, dừng."
  [[ "$RESTORE_DB_URL" =~ db\.[a-z]{20}\.supabase\.co[:/] ]] && loi "Đây là kết nối trực tiếp db.<ref>.supabase.co (chỉ IPv6). Dùng Session pooler (…pooler.supabase.com:5432)."
  [[ "$RESTORE_DB_URL" == *":6543/"* ]] && loi "Cổng 6543 là Transaction pooler, không nạp được dump. Chọn Session pooler cổng 5432."
fi
tach_url_thanh_pg_env "$RESTORE_DB_URL"
unset RESTORE_DB_URL

# ---- Đọc file backup (không ghi plaintext ra đĩa) ----
thong_bao "Kiểm tra file backup"
DANH_SACH="$(gpg_giai_ma "$FILE" | tar tz)" || loi "Không giải mã được — sai passphrase hoặc file hỏng."
grep -qx 'data.sql' <<<"$DANH_SACH" || loi "Trong file không có data.sql."
doc_trong_backup() { gpg_giai_ma "$FILE" 2>/dev/null | tar xzOf - "$1" 2>/dev/null || true; }
THONG_TIN="$(doc_trong_backup thong-tin.txt)"
SO_DONG_BACKUP="$(doc_trong_backup so-dong.txt)"
MIG_BACKUP="$(doc_trong_backup migrations.txt | sort)"
MIG_REPO="$(repo_migration_versions "$REPO" | sort)"
[ -n "$THONG_TIN" ] && printf '%s\n' "$THONG_TIN" >&2
if [ -z "$MIG_BACKUP" ]; then
  canh_bao "Backup không có migrations.txt (artifact deploy-prod cũ?) — không đối chiếu được với repo, sẽ áp migrations hiện có: $(tr '\n' ' ' <<<"$MIG_REPO")"
elif [ "$MIG_BACKUP" != "$MIG_REPO" ]; then
  loi "Migration lúc backup [$(tr '\n' ' ' <<<"$MIG_BACKUP")] khác repo [$(tr '\n' ' ' <<<"$MIG_REPO")]. Chuyển repo về đúng bản đã phát hành (git checkout production) rồi chạy lại."
fi

# ---- Kết nối và kiểm tra trước (chưa ghi gì) ----
thong_bao "Kết nối $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
psql_dong 'select 1' >/dev/null || loi "Không kết nối được — kiểm tra chuỗi kết nối, mật khẩu, mạng."
psql_dong 'begin; set session_replication_role = replica; rollback;' >/dev/null \
  || loi "Tài khoản DB không được đặt session_replication_role (cần user postgres của project)."
AUTH_NGUON="$(sed -n 's/^auth_schema_version=//p' <<<"$THONG_TIN")"
AUTH_DICH="$(psql_dong "$SQL_PHIEN_BAN_AUTH")"
if [ -n "$AUTH_NGUON" ] && [[ "$AUTH_DICH" < "$AUTH_NGUON" ]]; then
  loi "Auth của project đích ($AUTH_DICH) cũ hơn lúc backup ($AUTH_NGUON) — INSERT auth.users sẽ thiếu cột. Tạo project mới hơn."
fi
# "Trắng" = chưa có cán bộ nào (auth.users rỗng, accounts chưa có hoặc rỗng); schema đã áp sẵn vẫn coi là trắng
# (db push sẽ báo "up to date") — để chạy lại được sau một lần nạp dữ liệu lỗi.
TRANG="$(psql_dong "select not exists (select 1 from auth.users) and (to_regclass('public.accounts') is null or not exists (select 1 from public.accounts))")"
if [ "$TRANG" != "t" ]; then
  [ "$GHI_DE" = 1 ] || loi "Project đích KHÔNG trắng (đã có dữ liệu trong accounts/auth.users). Muốn xoá sạch và nạp lại thì thêm --ghi-de."
  canh_bao "Sẽ XOÁ TOÀN BỘ dữ liệu hiện có trên $REF (supabase db reset: xoá schema public, auth.users, storage, lịch sử migration):"
  psql_dong "$SQL_DEM_DONG" >&2 || true
  if [ "$YES" = 0 ]; then
    printf 'Gõ đúng project ref (%s) để xác nhận xoá: ' "$REF" >&2; read -r GO
    [ "$GO" = "$REF" ] || loi "Không khớp — dừng, chưa đổi gì."
  fi
fi

thong_bao "Tóm tắt"
printf '  File backup : %s\n  Đích        : %s (%s)\n  Migrations  : %s\n  Cách        : %s\n' \
  "$FILE" "$REF" "$PGHOST" "$(tr '\n' ' ' <<<"$MIG_REPO")" "$([ "$GHI_DE" = 1 ] && echo 'xoá sạch rồi nạp' || echo 'project trắng')" >&2
if [ "$YES" = 0 ]; then
  printf 'Gõ "khoi phuc" để bắt đầu (mọi thứ khác = huỷ): ' >&2; read -r GO
  [ "$GO" = "khoi phuc" ] || loi "Đã huỷ, chưa đổi gì."
fi

# ---- Schema từ migrations của repo ----
cd "$REPO"
if [ "$TRANG" = "t" ]; then
  thong_bao "Áp migrations lên project trắng (supabase db push)"
  supabase db push "${DICH[@]}" --skip-vault --yes
else
  thong_bao "Xoá sạch và áp lại migrations (supabase db reset --no-seed)"
  supabase db reset "${DICH[@]}" --no-seed --yes
fi
MIG_DICH="$(sb_migration_remote "${DICH[@]}" | sort)"
[ "$MIG_DICH" = "$MIG_REPO" ] || loi "Sau khi áp, đích có [$(tr '\n' ' ' <<<"$MIG_DICH")] ≠ repo [$(tr '\n' ' ' <<<"$MIG_REPO")]."

# ---- Dữ liệu: một transaction, tắt FK/trigger khi nạp ----
thong_bao "Nạp data.sql (một transaction; lỗi ở đâu thì huỷ toàn bộ)"
gpg_giai_ma "$FILE" | tar xzOf - data.sql \
  | psql -q -v ON_ERROR_STOP=1 --single-transaction -c 'set session_replication_role = replica' -f - >/dev/null \
  || loi "Nạp dữ liệu thất bại — transaction đã huỷ, đích chỉ có schema trống."

# ---- Kiểm chứng ----
thong_bao "Kiểm chứng"
MO_COI="$(psql_dong 'select count(*) from public.accounts a left join auth.users u on u.id = a.id where u.id is null')"
[ "$MO_COI" = "0" ] || loi "Có $MO_COI dòng accounts không có auth.users tương ứng (FK 0011) — dữ liệu không toàn vẹn."
DEM_DICH="$(psql_dong "$SQL_DEM_DONG")"
printf '%s\n' "$DEM_DICH" >&2
if [ -z "$SO_DONG_BACKUP" ]; then canh_bao "Backup không có so-dong.txt — không đối chiếu số dòng được."
elif [ "$DEM_DICH" = "$SO_DONG_BACKUP" ]; then echo "Số dòng khớp so-dong.txt trong backup. FK accounts→auth.users: 0 dòng mồ côi." >&2
elif grep -q '^so_dong=xap-xi' <<<"$THONG_TIN"; then canh_bao "Số dòng lệch so-dong.txt, nhưng backup đã ghi 'xap-xi' (có người dùng lúc dump) — chấp nhận."
else
  diff <(printf '%s\n' "$SO_DONG_BACKUP") <(printf '%s\n' "$DEM_DICH") >&2 || true
  loi "Số dòng KHÔNG khớp so-dong.txt (bên trái = backup, bên phải = đích)."
fi

thong_bao "KHÔI PHỤC XONG lên $REF"
cat >&2 <<'HET'
Việc sau khôi phục:
  - Mật khẩu cán bộ giữ nguyên (hash được nạp lại). Phiên đăng nhập cũ mất vì JWT secret của project mới khác.
  - Thử đăng nhập: chạy frontend local với VITE_SUPABASE_URL/ANON_KEY của project đích (docs/sao-luu-khoi-phuc.md mục 4).
  - Nếu là khôi phục THẬT (production chuyển sang project này): đổi ref/secret ở mọi nơi theo checklist
    docs/sao-luu-khoi-phuc.md mục 5, `supabase config diff` rồi `config push`, phát hành lại bằng tag v*.
  - Ghi biên bản khôi phục vào docs/ (mẫu ở mục 7).
HET
