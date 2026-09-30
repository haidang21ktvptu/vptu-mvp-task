// Lỗi từ DB → câu tiếng Việt dễ hiểu cho người dùng (PR-2a Q7). Lỗi do hàm/trigger của hệ thống RAISE đã viết tiếng Việt thì giữ nguyên;
// lỗi kỹ thuật của Postgres/PostgREST/mạng (tiếng Anh) đổi sang câu hướng dẫn. Quyền thật vẫn ở DB — đây chỉ là cách báo.
const MAU = [
  [/row-level security|permission denied|42501/i, 'Đồng chí không có quyền thực hiện thao tác này với việc đã chọn.'],
  [/check constraint|violates|23514|23502/i, 'Dữ liệu chưa hợp lệ theo quy tắc của hệ thống — kiểm tra lại các ô đã nhập.'],
  [/statement timeout|canceling statement|57014/i, 'Hệ thống đang bận, chưa lưu được — đồng chí thử lại sau ít phút.'],
  [/failed to fetch|networkerror|network request failed|load failed/i, 'Mất kết nối mạng, chưa lưu được — kiểm tra mạng rồi thử lại.'],
  [/jwt|refresh token|not authenticated/i, 'Phiên đăng nhập đã hết hạn — đồng chí đăng nhập lại rồi thử lại.'],
];
const coDauViet = (s) => /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(s);

export function loiDeHieu(e) {
  const msg = String(e?.message ?? e ?? '').trim();
  if (msg && coDauViet(msg)) return msg;
  return MAU.find(([re]) => re.test(msg))?.[1] || 'Chưa lưu được do lỗi hệ thống — đồng chí thử lại; nếu vẫn lỗi, báo quản trị hệ thống.';
}
