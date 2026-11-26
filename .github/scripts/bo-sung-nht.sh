#!/usr/bin/env bash
# Gọi hàm bổ sung ngày hoàn thành (0141) — dùng chung cho job staging / production của bo-sung-ngay-hoan-thanh.yml. Đầu vào: URL, KEY (service_role),
# THAO_TAC (xem-truoc | thuc-hien | hoan-tac), MOI_TRUONG (staging | production). Key chỉ đi trong header, không in ra log. Repo công khai nên Summary
# production chỉ ghi số tổng hợp và nội dung lỗi (không mã việc); staging (dữ liệu giả) ghi kèm mã việc lỗi.
set -euo pipefail
if [ -z "${KEY:-}" ]; then echo "::error::Thiếu secret service_role của môi trường (docs/TRANG-THAI.md mục 3)."; exit 1; fi
echo "::add-mask::$KEY"
MOI_TRUONG="${MOI_TRUONG:-production}"   # thiếu thì coi như production: Summary không ghi mã việc
case "$THAO_TAC" in
  xem-truoc) HAM=kl_bo_sung_ngay_hoan_thanh; BODY='{"p_thuc_hien":false}'; TEN='xem trước' ;;
  thuc-hien) HAM=kl_bo_sung_ngay_hoan_thanh; BODY='{"p_thuc_hien":true}'; TEN='thực hiện' ;;
  hoan-tac)  HAM=kl_bo_sung_ngay_hoan_thanh_hoan_tac; BODY='{}'; TEN='hoàn tác' ;;
  *) echo "::error::Thao tác không hợp lệ: $THAO_TAC"; exit 1 ;;
esac
HTTP=$(curl --silent --show-error --retry 2 --retry-delay 10 --output kq.json --write-out '%{http_code}' --max-time 170 \
  -X POST "$URL/rest/v1/rpc/$HAM" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$BODY")
if [ "$HTTP" != 200 ]; then echo "::error::$HAM trả HTTP $HTTP."; jq -r '.message // .' kq.json 2>/dev/null || cat kq.json; exit 1; fi
{
  echo "### Bổ sung ngày hoàn thành ($MOI_TRUONG): $TEN"
  if [ "$THAO_TAC" = hoan-tac ]; then
    jq -r '"Đã bỏ ngày bổ sung của \(.hoan_tac) nhiệm vụ."' kq.json
  else
    jq -r --arg mt "$MOI_TRUONG" '"- Việc đã hoàn thành chưa ghi ngày: **\(.tong)** (theo lịch sử cập nhật: \(.lich_su); ước tính ngày giao cộng 30 ngày: \(.uoc_tinh))",
      "- Có hạn để xét đúng hạn: \(.co_han); sẽ đúng hạn: \(.dung_han); trễ hạn: \(.tre_han)",
      "- Ngày tính: \(.ngay); \(if .thuc_hien then "đã ghi \(.da_ghi) việc, lỗi \(.loi) việc" else "chưa ghi gì (xem trước)" end)",
      (.mau_loi[]? | if $mt == "staging" then "- Lỗi: \(.)" else "- Lỗi: \(sub("^[^:]*: "; ""))" end)' kq.json
  fi
} >> "$GITHUB_STEP_SUMMARY"
cat "$GITHUB_STEP_SUMMARY" | tail -n 8
