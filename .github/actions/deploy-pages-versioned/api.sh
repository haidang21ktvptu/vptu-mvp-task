# Hàm gọi REST API GitHub dùng chung cho deploy-pages-versioned (source từ action.yml).
#
#   api <METHOD> <đường dẫn sau /> [file JSON thân request]
#   → trả 0 khi HTTP 2xx; đặt API_CODE (mã HTTP) và API_BODY (file chứa body phản hồi).
#
# Header giống hệt octokit của actions/deploy-pages: Accept application/vnd.github.v3+json,
# Authorization "token", Content-Type application/json; không gửi X-GitHub-Api-Version.
# Luôn in HTTP code + body phản hồi (body phản hồi không chứa token; thân request thì không in vì
# có OIDC). Lời gọi thành công in trong ::group:: cho gọn; lời gọi LỖI in ngoài group để không bị gập.
api() {
  local method=$1 path=$2 body=${3:-}
  local url="${GITHUB_API_URL:-https://api.github.com}/$path"
  API_BODY=$(mktemp)
  local args=(-sS --max-time 60 -o "$API_BODY" -w '%{http_code}' -X "$method"
    -H "Accept: application/vnd.github.v3+json"
    -H "Authorization: token $GH_TOKEN"
    -H "Content-Type: application/json"
    -H "User-Agent: vptu-deploy-pages-versioned")
  [ -n "$body" ] && args+=(--data-binary "@$body")
  API_CODE=$(curl "${args[@]}" "$url") || true   # curl lỗi kết nối: -w vẫn in 000
  API_CODE=${API_CODE:-000}
  if [ "${API_CODE:0:1}" = "2" ]; then
    echo "::group::$method $path → HTTP $API_CODE"
    cat "$API_BODY"; echo
    echo "::endgroup::"
    return 0
  fi
  local note=""
  [ "$API_CODE" = 000 ] && note=" (curl không kết nối được hoặc quá 60 giây)"
  echo "$method $url → HTTP $API_CODE$note"
  echo "Body phản hồi:"
  cat "$API_BODY"; echo
  return 1
}
