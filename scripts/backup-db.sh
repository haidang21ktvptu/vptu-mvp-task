#!/usr/bin/env bash
# Sao lưu một project Supabase thành một file mã hoá: <tên>-<YYYYmmdd-HHMM UTC>-<nhãn>.tar.gz.gpg
# chứa schema.sql, data.sql, migrations.txt, so-dong.txt, thong-tin.txt. Chạy được trong GitHub Actions
# lẫn Git Bash trên Windows (cần Docker Desktop đang mở vì `supabase db dump` chạy pg_dump trong Docker).
#
#   scripts/backup-db.sh --project-ref <ref> [--nhan <nhãn>] [--thu-muc <thư mục ra>]
#   scripts/backup-db.sh --local ...            # từ `supabase start` (để thử script)
#
# Bí mật: BACKUP_PASSPHRASE (env; không có thì hỏi ẩn, hai lần). Mật khẩu DB KHÔNG cần: CLI ≥ 2.1xx tạo
# login role tạm qua token (`supabase login` trên máy, SUPABASE_ACCESS_TOKEN trên Actions); nếu env
# SUPABASE_DB_PASSWORD có sẵn thì CLI tự dùng. Không tham số nào chứa bí mật.
# Khôi phục: scripts/restore-db.sh. Hướng dẫn: docs/sao-luu-khoi-phuc.md.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-sao-luu.sh
source "$REPO/scripts/lib-sao-luu.sh"

REF=""; LOCAL=0; NHAN="tay"; THU_MUC="."
while [ $# -gt 0 ]; do
  case "$1" in
    --project-ref) REF="${2:-}"; shift 2 ;;
    --local) LOCAL=1; shift ;;
    --nhan) NHAN="${2:-}"; shift 2 ;;
    --thu-muc) THU_MUC="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) loi "Tham số lạ: $1 (xem --help)" ;;
  esac
done
if [ "$LOCAL" = 1 ]; then
  DICH=(--local); TEN="local"
else
  [[ "$REF" =~ ^[a-z]{20}$ ]] || loi "Cần --project-ref <20 chữ thường> hoặc --local."
  DICH=(--project-ref "$REF")
  case "$REF" in "$PRODUCTION_REF") TEN="prod" ;; "$STAGING_REF") TEN="staging" ;; *) TEN="$REF" ;; esac
fi
[[ "$NHAN" =~ ^[A-Za-z0-9._-]+$ ]] || loi "--nhan chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (đi vào tên file; tag v* hợp lệ)."

can_cong_cu supabase gpg tar sha256sum mktemp
docker info >/dev/null 2>&1 || loi "Docker chưa chạy — mở Docker Desktop, đợi biểu tượng cá voi ổn định rồi chạy lại (supabase db dump cần Docker)."
mkdir -p "$THU_MUC"
THU_MUC="$(cd "$THU_MUC" && pwd)"

hoi_bi_mat BACKUP_PASSPHRASE "Passphrase mã hoá backup"
if [ "$DA_HOI_BI_MAT" = 1 ]; then
  XAC_NHAN_PP=""
  hoi_bi_mat XAC_NHAN_PP "Nhập lại passphrase để chắc không gõ nhầm"
  [ "$XAC_NHAN_PP" = "$BACKUP_PASSPHRASE" ] || loi "Hai lần nhập không khớp."
  unset XAC_NHAN_PP
fi

TMP="$(mktemp -d "$THU_MUC/.dang-sao-luu-XXXXXX")"
don_dep() { stty echo 2>/dev/null || true; rm -rf "$TMP"; }
trap don_dep EXIT INT TERM HUP
cd "$REPO"

LUC="$(date -u +%Y%m%d-%H%M)"
RA="$THU_MUC/$TEN-$LUC-$NHAN.tar.gz.gpg"
[ -e "$RA" ] && loi "Đã có $RA — đợi sang phút khác hoặc đổi --nhan."

thong_bao "Đếm dòng trước khi dump ($TEN)"
DEM_TRUOC="$(sb_query_dong "$SQL_DEM_DONG" "${DICH[@]}")"
[ -n "$DEM_TRUOC" ] || loi "Không truy vấn được database (đã 'supabase login'? ref đúng? mạng?)."
printf '%s\n' "$DEM_TRUOC" >&2

thong_bao "Dump schema (tham khảo — khôi phục dùng migrations của repo)"
supabase db dump "${DICH[@]}" -f "$TMP/schema.sql"
thong_bao "Dump dữ liệu (bỏ bảng phiên/nhật ký: $BANG_LOAI_TRU)"
supabase db dump "${DICH[@]}" --data-only -x "$BANG_LOAI_TRU" -f "$TMP/data.sql"
grep -q '^SET session_replication_role = replica' "$TMP/data.sql" \
  || canh_bao "data.sql không bắt đầu bằng SET session_replication_role — restore-db.sh vẫn tự đặt."

thong_bao "Đếm dòng sau khi dump và ghi thông tin kèm"
DEM_SAU="$(sb_query_dong "$SQL_DEM_DONG" "${DICH[@]}")"
if [ "$DEM_TRUOC" = "$DEM_SAU" ]; then DO_CHINH_XAC="chinh-xac"; else
  DO_CHINH_XAC="xap-xi"; canh_bao "Số dòng đổi trong lúc dump (có người đang dùng) — so-dong.txt chỉ xấp xỉ."
fi
printf '%s\n' "$DEM_SAU" > "$TMP/so-dong.txt"
sb_migration_remote "${DICH[@]}" > "$TMP/migrations.txt"
[ -s "$TMP/migrations.txt" ] || canh_bao "Không đọc được danh sách migration đã áp — restore sẽ bỏ qua bước đối chiếu."
PHIEN_BAN_AUTH="$(sb_query_dong "$SQL_PHIEN_BAN_AUTH" "${DICH[@]}" | head -1)"
GIT_COMMIT="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo "?")"
{
  echo "dinh_dang=vptu-backup-1"
  echo "luc_utc=$(date -u '+%Y-%m-%d %H:%M:%S')"
  echo "luc_viet_nam=$(date -u -d '7 hours' '+%Y-%m-%d %H:%M:%S')"
  echo "nguon=$TEN"; echo "project_ref=${REF:-local}"; echo "nhan=$NHAN"
  echo "supabase_cli=$(supabase --version 2>/dev/null | head -1)"
  echo "git_commit=$GIT_COMMIT"
  echo "auth_schema_version=$PHIEN_BAN_AUTH"
  echo "so_dong=$DO_CHINH_XAC"
  echo "bang_loai_tru=$BANG_LOAI_TRU"
} > "$TMP/thong-tin.txt"

thong_bao "Nén và mã hoá AES-256 → $RA"
tar czf - -C "$TMP" schema.sql data.sql migrations.txt so-dong.txt thong-tin.txt | gpg_ma_hoa "$RA"
gpg_giai_ma "$RA" | tar tz >/dev/null || loi "Không giải mã lại được file vừa tạo — xoá $RA và chạy lại."

thong_bao "Xong"
ls -l "$RA" >&2
sha256sum "$RA" >&2
cat "$TMP/thong-tin.txt" >&2
echo "Chỉ mở được bằng đúng passphrase vừa dùng — giữ passphrase trong trình quản lý mật khẩu." >&2
echo "$RA"
