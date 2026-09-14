#!/usr/bin/env bash
# Tải các artifact backup `prod-*` (deploy-prod.yml và backup-dinh-ky.yml, giữ 90 ngày trên GitHub) về máy
# cá nhân; bản đã có thì bỏ qua. KHÔNG xoá gì theo mặc định.
#
#   bash scripts/tai-backup.sh [--thu-muc <thư mục>] [--giu N] [--repo owner/repo]
#
# --thu-muc  mặc định <repo>/../vptu-backup (= D:\TU 2026\Project\vptu-backup với vị trí repo hiện tại).
# --giu N    CHỈ khi ghi rõ: xoá các file prod-*.tar.gz.gpg cũ hơn N bản mới nhất (in từng file trước khi xoá).
# Cần `gh` đã `gh auth login` (token trong Windows Credential Manager → Task Scheduler cùng user dùng được).
# Chạy tự động: scripts/tai-backup.cmd + Task Scheduler (docs/sao-luu-khoi-phuc.md mục 3). File tải về vẫn
# mã hoá; mở bằng scripts/restore-db.sh với passphrase. Thoát 0 kể cả khi không có bản mới.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib-sao-luu.sh
source "$REPO_DIR/scripts/lib-sao-luu.sh"

THU_MUC="$REPO_DIR/../vptu-backup"; GIU=""; REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --thu-muc) THU_MUC="${2:-}"; shift 2 ;;
    --giu) GIU="${2:-}"; shift 2 ;;
    --repo) REPO="${2:-}"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) loi "Tham số lạ: $1 (xem --help)" ;;
  esac
done
[ -z "$GIU" ] || [[ "$GIU" =~ ^[1-9][0-9]*$ ]] || loi "--giu cần một số nguyên dương."
can_cong_cu gh gpg
gh auth status >/dev/null 2>&1 || loi "gh chưa đăng nhập GitHub — chạy: gh auth login"
[ -n "$REPO" ] || REPO="$(cd "$REPO_DIR" && gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null)" \
  || loi "Không xác định được repo — truyền --repo owner/repo."
mkdir -p "$THU_MUC"
THU_MUC="$(cd "$THU_MUC" && pwd)"
TMP="$(mktemp -d "$THU_MUC/.dang-tai-XXXXXX")"
trap 'rm -rf "$TMP"' EXIT INT TERM HUP

thong_bao "Artifact prod-* trên GitHub ($REPO) — $(date '+%Y-%m-%d %H:%M')"
# Mỗi dòng: run_id <tab> tên <tab> kích thước <tab> ngày tạo; chỉ artifact chưa hết hạn.
DANH_SACH="$(gh api "repos/$REPO/actions/artifacts?per_page=100" --paginate \
  --jq '.artifacts[] | select(.expired == false) | select(.name | startswith("prod-")) | "\(.workflow_run.id)\t\(.name)\t\(.size_in_bytes)\t\(.created_at)"')" \
  || loi "Không gọi được GitHub API (mạng? token hết hạn? chạy: gh auth status)."
[ -n "$DANH_SACH" ] || { canh_bao "GitHub không còn artifact prod-* nào (đã quá 90 ngày?)."; exit 0; }

MOI=0; DA_CO=0; TONG=0
while IFS=$'\t' read -r RUN_ID TEN KICH_THUOC NGAY; do
  [ -n "$TEN" ] || continue
  TONG=$((TONG + 1))
  DICH="$THU_MUC/$TEN.tar.gz.gpg"
  if [ -s "$DICH" ]; then DA_CO=$((DA_CO + 1)); continue; fi
  printf '  Tải %s (%s byte, tạo %s)…\n' "$TEN" "$KICH_THUOC" "$NGAY" >&2
  rm -rf "$TMP/a"
  gh run download "$RUN_ID" -R "$REPO" -n "$TEN" -D "$TMP/a" >/dev/null 2>&1 \
    || { canh_bao "Không tải được $TEN (run $RUN_ID) — bỏ qua, lần sau thử lại."; continue; }
  FILE="$(find "$TMP/a" -name '*.tar.gz.gpg' -type f | head -1)"
  [ -n "$FILE" ] || { canh_bao "Artifact $TEN không chứa file .tar.gz.gpg — bỏ qua."; continue; }
  # Không cần passphrase: chỉ xem gói tin đầu để chắc đây là file gpg đối xứng, không phải trang lỗi.
  gpg --batch --list-packets "$FILE" 2>/dev/null | grep -q 'symkey enc packet' \
    || { canh_bao "$TEN tải về không phải file gpg hợp lệ — bỏ qua."; continue; }
  mv "$FILE" "$DICH"
  MOI=$((MOI + 1))
done <<<"$DANH_SACH"

thong_bao "Kết quả: $MOI bản mới tải về, $DA_CO bản đã có, $TONG bản còn trên GitHub → $THU_MUC"
# Sắp theo TÊN (ngày giờ nằm trong tên), không theo mtime — mtime là lúc tải về, không phải lúc backup.
ls -1 "$THU_MUC"/prod-*.tar.gz.gpg 2>/dev/null | sort -r | head -5 >&2 || true

if [ -n "$GIU" ]; then
  # Chỉ chạy khi người dùng ghi rõ --giu N. Xoá bản cũ hơn N bản mới nhất, in từng file.
  CU="$(ls -1 "$THU_MUC"/prod-*.tar.gz.gpg 2>/dev/null | sort -r | tail -n +"$((GIU + 1))")" || true
  if [ -n "$CU" ]; then
    thong_bao "--giu $GIU: xoá bản cũ hơn $GIU bản mới nhất"
    while IFS= read -r F; do [ -n "$F" ] || continue; printf '  xoá %s\n' "$F" >&2; rm -f "$F"; done <<<"$CU"
  else
    echo "--giu $GIU: không có bản nào cũ hơn để xoá." >&2
  fi
fi
