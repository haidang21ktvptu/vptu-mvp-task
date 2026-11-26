#!/usr/bin/env bash
# Gọi hàm bổ sung ngày hoàn thành (0141) — dùng chung cho job staging / production của bo-sung-ngay-hoan-thanh.yml. Đầu vào: URL, KEY (service_role),
# THAO_TAC (xem-truoc | thuc-hien | hoan-tac), MOI_TRUONG (staging | production). Key chỉ đi trong header, không in ra log. Summary: số tổng hợp và tối
# đa 5 "mã việc: lý do" bị từ chối (mã NV-<số> không chứa nội dung việc hay tên người). Gọi lại khi mạng chập chờn an toàn: hàm chỉ ghi việc còn chưa có ngày.
set -euo pipefail
if [ -z "${KEY:-}" ]; then echo "::error::Thiếu secret service_role của môi trường (docs/TRANG-THAI.md mục 3)."; exit 1; fi
echo "::add-mask::$KEY"
MOI_TRUONG="${MOI_TRUONG:-?}"
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
    jq -r '"- Đã bỏ ngày bổ sung của \(.hoan_tac) nhiệm vụ; bị kiểm tra dữ liệu từ chối: \(.loi)", (.mau_loi[]? | "- Lỗi: \(.)")' kq.json
  else
    jq -r '"- Việc đã hoàn thành chưa ghi ngày: **\(.tong)** (theo lịch sử cập nhật: \(.lich_su); ước tính ngày giao cộng 30 ngày: \(.uoc_tinh))",
      "- \(if .thuc_hien then "Đã ghi" else "Sẽ ghi" end): **\(.ghi)** việc; bị kiểm tra dữ liệu từ chối: \(.loi); đã có ngày trong lúc chạy: \(.khong_con)",
      "- Trong số ghi, có hạn để xét đúng hạn: \(.co_han); đúng hạn: \(.dung_han); trễ hạn: \(.tre_han)",
      "- Ngày tính: \(.ngay); \(if .thuc_hien then "đã thực hiện" else "xem trước (chạy thử rồi hoàn lại, chưa ghi gì)" end)",
      (.mau_loi[]? | "- Lỗi: \(.)")' kq.json
  fi
} >> "$GITHUB_STEP_SUMMARY"
cat "$GITHUB_STEP_SUMMARY" | tail -n 8
