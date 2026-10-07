#!/usr/bin/env bash
# In annotation GitHub (::error) cho từng test RLS đỏ từ log TAP của `node --test` (tests/rls) — annotation đọc được qua API check-runs,
# còn log job thì API không tải về được (chuyển hướng sang kho blob). Dùng ở ci.yml (RLS cục bộ) và deploy-staging.yml (RLS staging), bước
# `if: failure()`. Mỗi dòng: tên test — dòng đầu của thông báo lỗi (vị trí tệp:dòng). Tối đa 40 test.
log="${1:-}"
[ -n "$log" ] && [ -f "$log" ] || { echo "::warning::Không có log RLS để chú thích ($log)."; exit 0; }
awk '
  /^[[:space:]]*not ok/ { sub(/^[[:space:]]+/, ""); ten = $0; n = 14; loc = ""; next }
  n > 0 && /^[[:space:]]*location:/ { loc = $0; sub(/^[[:space:]]*location: */, "", loc); gsub(/'"'"'/, "", loc) }
  n > 0 && /^[[:space:]]*error:/ {
    loi = $0; sub(/^[[:space:]]*error: */, "", loi)
    if (loi == "|-" || loi == "|" || loi == ">-" || loi == ">") { getline; loi = $0; sub(/^[[:space:]]+/, "", loi) }
    gsub(/'"'"'/, "", loi)
    printf "::error title=RLS::%s — %s (%s)\n", ten, loi, loc
    n = 0; next
  }
  n > 0 { n-- }
' "$log" | head -40
# Tóm tắt cuối log (số test đỏ / qua) vào Summary để nhìn nhanh.
grep -E '^# (pass|fail|cancelled|skipped|todo) ' "$log" | sed 's/^# /- /' >> "${GITHUB_STEP_SUMMARY:-/dev/null}" || true
exit 0
