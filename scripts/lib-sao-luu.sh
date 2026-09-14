#!/usr/bin/env bash
# shellcheck disable=SC2034  # biến khai báo ở đây được dùng trong script gọi source
# Hàm dùng chung cho backup-db.sh và restore-db.sh (chỉ để `source`, không chạy trực tiếp).
# Chạy được trong GitHub Actions (ubuntu) và Git Bash trên Windows; không dùng jq.
# Bí mật (passphrase, chuỗi kết nối) chỉ đi qua biến môi trường hoặc hỏi ẩn — không bao giờ qua tham số.

# Chốt an toàn: restore-db.sh TỪ CHỐI hai project này (production thật; staging chỉ dữ liệu giả — rule 11).
PRODUCTION_REF="frwyxcmbonjaimziiuqr"
STAGING_REF="vojmrjezspdftovzinek"
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" # `supabase start`

# Bảng phiên/nhật ký không đưa vào backup: refresh token nạp sang project khác vẫn dùng được, audit_log phình dần.
BANG_LOAI_TRU="auth.audit_log_entries,auth.refresh_tokens,auth.sessions,auth.mfa_amr_claims,auth.flow_state,auth.one_time_tokens"

thong_bao() { printf '\n==> %s\n' "$*" >&2; }
canh_bao() { printf 'CẢNH BÁO: %s\n' "$*" >&2; }
loi() { printf 'LỖI: %s\n' "$*" >&2; exit 1; }

goi_y_cai() {
  case "$1" in
    psql) echo "Cài một lần trong PowerShell: scoop install postgresql (docs/sao-luu-khoi-phuc.md mục 1)." ;;
    supabase) echo "Cài một lần: scoop install supabase, rồi supabase login." ;;
    *) echo "Lệnh này có sẵn trong Git Bash — hãy chạy script trong Git Bash, không phải PowerShell/CMD." ;;
  esac
}
can_cong_cu() {
  local t
  for t in "$@"; do command -v "$t" >/dev/null 2>&1 || loi "Thiếu lệnh '$t'. $(goi_y_cai "$t")"; done
}

# hoi_bi_mat TEN_BIEN "Câu nhắc": giữ giá trị nếu biến đã có trong môi trường; nếu không, hỏi ẩn từ bàn phím.
# Đặt DA_HOI_BI_MAT=1 khi vừa hỏi (để backup hỏi lại lần hai cho chắc). Không tự động được thì báo rõ.
DA_HOI_BI_MAT=0
hoi_bi_mat() {
  local var="$1" nhac="$2" gia_tri
  DA_HOI_BI_MAT=0
  [ -n "${!var:-}" ] && return 0
  [ -t 0 ] || loi "Thiếu biến môi trường $var và không có bàn phím để hỏi (đang chạy tự động?)."
  printf '%s (gõ xong nhấn Enter, chữ không hiện): ' "$nhac" >&2
  IFS= read -rs gia_tri || { stty echo 2>/dev/null || true; loi "Không đọc được đầu vào."; }
  printf '\n' >&2
  [ -n "$gia_tri" ] || loi "Không được để trống."
  printf -v "$var" '%s' "$gia_tri"
  export "${var?}"
  DA_HOI_BI_MAT=1
}

# gpg đối xứng AES-256; passphrase đưa qua fd 3 (không lộ trong `ps`/lịch sử, không ghi file tạm như herestring).
gpg_ma_hoa() { # stdin → file $1
  gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
    --symmetric --cipher-algo AES256 -o "$1" 3< <(printf '%s' "$BACKUP_PASSPHRASE")
}
gpg_giai_ma() { # file $1 → stdout
  gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 -d "$1" 3< <(printf '%s' "$BACKUP_PASSPHRASE")
}

# Trích project ref (20 chữ thường) từ chuỗi kết nối Supabase: pooler `postgres.<ref>:` hoặc host `db.<ref>.supabase.co`.
trich_ref_tu_url() {
  if [[ "$1" =~ postgres\.([a-z]{20})[:@] ]]; then echo "${BASH_REMATCH[1]}"
  elif [[ "$1" =~ db\.([a-z]{20})\.supabase\.co ]]; then echo "${BASH_REMATCH[1]}"
  fi
}

giai_ma_phan_tram() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }

# Tách postgresql://user:pass@host:port/db thành PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE (export) để psql
# chạy không cần tham số kết nối. Cắt ở dấu @ CUỐI CÙNG vì mật khẩu có thể chứa @.
tach_url_thanh_pg_env() {
  local u="${1#postgresql://}" dau sau user pass hostport rest db host port
  u="${u#postgres://}"
  dau="${u%@*}"; sau="${u##*@}"
  user="${dau%%:*}"; pass="${dau#*:}"; [ "$dau" = "$user" ] && pass=""
  hostport="${sau%%/*}"; rest="${sau#*/}"; [ "$sau" = "$hostport" ] && rest=""
  db="${rest%%\?*}"
  host="${hostport%%:*}"; port="${hostport##*:}"; [ "$host" = "$port" ] && port=5432
  PGHOST="$host"; PGPORT="$port"; PGDATABASE="${db:-postgres}"
  PGUSER="$(giai_ma_phan_tram "$user")"; PGPASSWORD="$(giai_ma_phan_tram "$pass")"
  PGCLIENTENCODING=UTF8
  case "$host" in 127.0.0.1|localhost) PGSSLMODE=disable ;; *) PGSSLMODE=require ;; esac
  export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGCLIENTENCODING PGSSLMODE
}

# psql chạy một câu SQL, in kết quả thô (không tiêu đề); bỏ \r vì psql trên Windows xuống dòng CRLF.
psql_dong() { psql -Atq -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'; }

# SQL đếm chính xác số dòng mọi bảng public + auth.users/identities; mỗi dòng kết quả: "schema.bang so_dong".
SQL_DEM_DONG="select n.nspname||'.'||c.relname||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text as dong from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users','identities'))) order by 1"
SQL_PHIEN_BAN_AUTH="select coalesce(max(version), '') as dong from auth.schema_migrations"

# Chạy `supabase db query` (login role qua token, không cần mật khẩu DB) và in cột `dong`, mỗi giá trị một dòng.
# Chỉ lấy stdout từ dấu { đầu tiên (CLI in "Initialising login role..." ra ngoài).
sb_query_dong() { # $1 = SQL; các tham số sau = --project-ref <ref> | --local
  local sql="$1"; shift
  local co=()
  [ "${1:-}" = "--project-ref" ] && co=(--linked) # db query đòi --linked đi kèm --project-ref (không đổi link)
  supabase db query "${co[@]}" "$@" --output-format json "$sql" 2>/dev/null \
    | sed -n '/{/,$p' | grep -o '"dong": *"[^"]*"' | sed 's/^"dong": *"//; s/"$//'
}

# Danh sách version migration đã áp trên đích (cột remote), mỗi dòng một version.
sb_migration_remote() { # --project-ref <ref> | --local
  supabase migration list "$@" --output-format json 2>/dev/null \
    | sed -n '/{/,$p' | grep -o '"remote": *"[0-9]*"' | grep -oE '[0-9]+' || true
}

# Version migration có trong repo (phần số trước dấu _ của tên file).
repo_migration_versions() {
  local f
  for f in "$1"/supabase/migrations/*.sql; do f="${f##*/}"; echo "${f%%_*}"; done
}
