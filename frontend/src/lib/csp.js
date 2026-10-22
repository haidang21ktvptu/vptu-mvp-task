// Chính sách nội dung (Content-Security-Policy) của bản build (v3.29 — chủ dự án 22/10/2026, CAU-HOI O-7). GitHub Pages không đặt được tiêu đề HTTP
// nên chính sách đi bằng thẻ meta (vite.config.js chèn lúc build; bản chạy thử cục bộ không có). Thuần — unit test frontend/tests/tuyen.test.mjs.
// - script-src 'self' + mã băm (sha256) của đúng đoạn mã nội tuyến có trong index.html lúc build (đoạn nhớ kiểu giao diện, chạy trước khi vẽ): chỉ chạy
//   mã của chính hệ thống — mã bị chèn vào trang không chạy được;
// - connect-src: chỉ máy chủ dữ liệu của bản đó (https + wss của VITE_SUPABASE_URL);
// - img-src: ảnh của hệ thống, ảnh hồ sơ / tệp đọc qua đường dẫn ký của máy chủ dữ liệu, data: / blob: (xem trước tại chỗ);
// - style-src 'unsafe-inline': mẫu HTML có thuộc tính style (độ rộng thanh tiến độ, màu đoạn biểu đồ) — không chạy được mã;
// - worker-src: worker pdf.js do Vite gói (cùng nguồn); object-src 'none', frame-src 'none', base-uri, form-action 'self'.
// frame-ancestors không có tác dụng trong thẻ meta — chống nhúng khung làm ở main.js.
export function chinhSachNoiDung(supabaseUrl, { bamScript = [] } = {}) {
  let goc = ''; let ws = '';
  try {
    const u = new URL(supabaseUrl);
    goc = u.origin; ws = `${u.protocol === 'http:' ? 'ws:' : 'wss:'}//${u.host}`;
  } catch { /* thiếu địa chỉ: chỉ 'self' */ }
  const nguon = (...ds) => ds.flat().filter(Boolean).join(' ');
  return [
    ['default-src', "'self'"],
    ['script-src', nguon("'self'", bamScript.map((b) => `'sha256-${b}'`))],
    ['style-src', "'self' 'unsafe-inline'"],
    ['img-src', nguon("'self'", 'data:', 'blob:', goc)],
    ['font-src', "'self'"],
    ['connect-src', nguon("'self'", goc, ws)],
    ['worker-src', "'self' blob:"],
    ['frame-src', "'none'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
  ].map(([k, v]) => `${k} ${v}`).join('; ');
}
// Các đoạn <script> nội tuyến (không src) của một trang HTML → nội dung (để băm sha256 lúc build).
export const doanScriptNoiTuyen = (html) => [...String(html).matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
