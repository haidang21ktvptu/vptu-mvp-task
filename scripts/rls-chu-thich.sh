#!/usr/bin/env bash
# In annotation GitHub (::error) cho từng test RLS đỏ từ log của `node --test` (tests/rls) — annotation đọc được qua API check-runs, còn log
# job thì API không tải về được (chuyển hướng sang kho blob). Dùng ở ci.yml (RLS cục bộ) và deploy-staging.yml (RLS staging), bước
# `if: failure()`. Hiểu cả hai định dạng: TAP ("not ok … / error:") khi stdout không phải TTY và spec ("✖ tên test"). Mỗi dòng: tên test — dòng
# đầu của thông báo lỗi (vị trí tệp:dòng, nếu có). Tối đa 40 test. Thêm một annotation ::notice chứa 25 dòng cuối log (đọc được qua API khi
# log không có dòng test đỏ nào — ví dụ chết ở before(), hết giờ) và tóm tắt (số pass / fail, 40 dòng chót) vào Summary cho người xem.
log="${1:-}"
[ -n "$log" ] && [ -f "$log" ] || { echo "::warning::Không có log RLS để chú thích ($log)."; exit 0; }
awk '
  /^[[:space:]]*not ok/ { sub(/^[[:space:]]+/, ""); ten = $0; n = 14; loc = ""; next }
  /^[[:space:]]*✖ / { sub(/^[[:space:]]+/, ""); ten = $0; n = 14; loc = ""; next }
  n > 0 && /^[[:space:]]*location:/ { loc = $0; sub(/^[[:space:]]*location: */, "", loc); gsub(/'"'"'/, "", loc) }
  n > 0 && /^[[:space:]]*error:/ {
    loi = $0; sub(/^[[:space:]]*error: */, "", loi)
    if (loi == "|-" || loi == "|" || loi == ">-" || loi == ">") { getline; loi = $0; sub(/^[[:space:]]+/, "", loi) }
    gsub(/'"'"'/, "", loi)
    printf "::error title=RLS::%s — %s (%s)\n", ten, loi, loc
    n = 0; next
  }
  n > 0 && ten ~ /^✖/ && /Error|lỗi|thất bại|timeout/ { loi = $0; sub(/^[[:space:]]+/, "", loi); printf "::error title=RLS::%s — %s\n", ten, loi; n = 0; next }
  n > 0 { n-- }
' "$log" | head -40
# 25 dòng cuối thành MỘT annotation (xuống dòng mã hoá %0A theo quy ước workflow command; cắt 3500 ký tự cho dưới giới hạn annotation).
tail -n 25 "$log" | awk '{ gsub(/%/, "%25"); gsub(/\r/, "%0D"); printf "%s%%0A", $0 }' | cut -c1-3500 | sed 's/^/::notice title=RLS — 25 dòng cuối log::/'
echo
{
  echo '#### Test RLS — tóm tắt'
  grep -E '^#? ?(tests|pass|fail|cancelled|skipped|todo|ℹ (tests|pass|fail|cancelled|skipped|todo)) ' "$log" | sed 's/^/- /' || true
  echo '<details><summary>40 dòng cuối log</summary>'; echo; echo '```'; tail -n 40 "$log"; echo '```'; echo '</details>'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}" || true
exit 0
