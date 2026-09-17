#!/usr/bin/env bash
# Phân loại thay đổi cho CI/CD (ci.yml và deploy-staging.yml cùng gọi) — MỘT nơi khai báo mẫu "không ảnh hưởng app".
#   khong_anh_huong_app=true  ⇔ đọc được ĐỦ danh sách file, có ít nhất một file, và MỌI file khớp KHONG_ANH_HUONG.
#   Mọi trường hợp khác (PR rỗng, API lỗi, lấy không đủ danh sách, push đầu tiên) → false = chạy đủ.
# Sửa chính file này, ci.yml hay deploy-*.yml đều không khớp mẫu → tự chạy đủ. Không có ngoại lệ theo tên nhánh (PR release chỉ tài liệu
# cũng bỏ qua: job kiem-tra của deploy-prod chấp nhận job rỗng cùng tên, v3.6.0/v3.6.1 đã chứng minh).
# Biến vào: GH_TOKEN, REPO, EVENT (pull_request | push), SO_PR (PR), BEFORE + SHA (push). Ghi GITHUB_OUTPUT và GITHUB_STEP_SUMMARY.
set -u
KHONG_ANH_HUONG='^docs/|\.md$|^\.github/workflows/(backup-dinh-ky|canh-bao)\.yml$'
KQ=false; LY_DO=''; FILES=''

lay_files_pr() {
  local mong_doi
  mong_doi=$(gh api "repos/$REPO/pulls/$SO_PR" --jq '.changed_files' 2>/dev/null) || { LY_DO='không đọc được PR'; return 1; }
  FILES=$(gh api "repos/$REPO/pulls/$SO_PR/files?per_page=100" --paginate --jq '.[].filename' 2>/dev/null) || { LY_DO='không đọc được danh sách file PR'; return 1; }
  local so; so=$(printf '%s\n' "$FILES" | grep -c . || true)
  [ "$so" -gt 0 ] || { LY_DO='PR không có file đổi'; return 1; }
  [ "$so" -eq "$mong_doi" ] || { LY_DO="lấy $so/$mong_doi file (không đủ)"; return 1; }
}
lay_files_push() {
  case "${BEFORE:-}" in ''|0000000000000000000000000000000000000000) LY_DO='không có commit trước để so sánh'; return 1;; esac
  FILES=$(gh api "repos/$REPO/compare/$BEFORE...$SHA?per_page=100" --paginate --jq '.files[].filename' 2>/dev/null) || { LY_DO='không đọc được compare'; return 1; }
  local so; so=$(printf '%s\n' "$FILES" | grep -c . || true)
  [ "$so" -gt 0 ] || { LY_DO='compare không có file đổi'; return 1; }
  [ "$so" -lt 300 ] || { LY_DO='compare chạm trần 300 file (không chắc đủ)'; return 1; } # API compare tối đa 300 file
}

if [ "${EVENT:-}" = pull_request ]; then lay_files_pr; else lay_files_push; fi
if [ -z "$LY_DO" ]; then
  NGOAI=$(printf '%s\n' "$FILES" | grep -v -E "$KHONG_ANH_HUONG" || true)
  if [ -z "$NGOAI" ]; then KQ=true; LY_DO='mọi file đổi đều không ảnh hưởng app'; else LY_DO="có file ảnh hưởng app"; fi
fi
echo "khong_anh_huong_app=$KQ" >> "${GITHUB_OUTPUT:-/dev/null}"
{
  echo "### Phân loại thay đổi: khong_anh_huong_app=**$KQ** — $LY_DO"
  echo '```'; printf '%s\n' "${FILES:-(không đọc được danh sách file)}"; echo '```'
  [ -n "${NGOAI:-}" ] && { echo 'File ảnh hưởng app:'; echo '```'; printf '%s\n' "$NGOAI"; echo '```'; }
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0
