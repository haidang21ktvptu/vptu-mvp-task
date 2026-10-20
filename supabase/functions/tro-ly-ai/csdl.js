// Gọi PostgREST bằng fetch (không cần gói npm — hàm nhẹ, khởi động nhanh). token có → gọi THAY người dùng (anon key + JWT của họ: RLS, auth.uid());
// không có → service_role (chỉ cho hàm ai_* — giữ / xong lượt, học quy tắc — và đọc danh mục; 0112). Lỗi PostgREST → Error có status, code.

export function taoCsdl({ url, anon, service }) {
  async function goi(duong, { method = 'GET', body, token } = {}) {
    const key = token ? anon : service;
    const res = await fetch(`${url}/rest/v1/${duong}`, {
      method,
      headers: { apikey: key, authorization: `Bearer ${token || service}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const chu = await res.text(); let j = null;
    try { j = chu ? JSON.parse(chu) : null; } catch { j = null; }
    if (!res.ok) throw Object.assign(new Error(j?.message || `HTTP ${res.status}`), { status: res.status, code: j?.code });
    return j;
  }
  return {
    rpc: (ham, thamSo, token) => goi(`rpc/${ham}`, { method: 'POST', body: thamSo || {}, token }),
    chon: (bang, truyVan) => goi(`${bang}?${truyVan}`),
  };
}

// Danh mục cho đề bài đọc văn bản: bản đầy đủ (gửi AI chọn mã) và danh sách mã (lược đồ enum + xác minh). v3.26 (0116): bỏ các mục cố định "Không
// thuộc" — AI giữ nguyên cách chọn; AI không đề xuất mục tiêu nào thì giao diện mới đề xuất "Không thuộc" (người giao kiểm tra).
// v3.27 (chủ dự án 20/10/2026): mục tiêu then chốt TẠM ẨN (như frontend lib/kl/muc-tieu.js HIEN_MUC_TIEU) — không đọc, không gửi danh mục mục tiêu cho AI;
// thêm danh mục cơ quan/đơn vị trình (đơn vị ngoài Văn phòng + "1. Văn phòng Tỉnh ủy" — 0117).
const HIEN_MUC_TIEU = false;
export async function napDanhMuc(csdl, LOAI_VAN_BAN) {
  const [sp, lth, ng, lv, mt, cqt] = await Promise.all([
    csdl.chon('dm_san_pham', 'select=ma,ten&order=thu_tu'),
    csdl.chon('dm_loai_thoi_han', 'select=ma,ten&cho_phep_tao_moi=eq.true&order=thu_tu'),
    csdl.chon('dm_nganh', 'select=ma,ten&ma=neq.KHONG_THUOC&order=thu_tu'),
    csdl.chon('dm_linh_vuc', 'select=ma,ten,nganh_ma&ma=neq.LV99_KHONG_THUOC&order=thu_tu'),
    HIEN_MUC_TIEU ? csdl.chon('dm_muc_tieu', 'select=ma,nhom,ten,mo_ta&dang_dung=eq.true&nhom=neq.KHONG_THUOC&order=thu_tu') : [],
    csdl.chon('dm_don_vi', 'select=ma,ten&or=(trong_van_phong.eq.false,ma.eq.VAN_PHONG_TINH_UY)&order=thu_tu'),
  ]);
  const day = { loai: LOAI_VAN_BAN, sanPham: sp || [], loaiThoiHan: lth || [], nganh: ng || [], linhVuc: lv || [], mucTieu: mt || [], coQuanTrinh: cqt || [] };
  const ma = { loai: LOAI_VAN_BAN.map(([m]) => m), sanPham: day.sanPham.map((x) => x.ma), loaiThoiHan: day.loaiThoiHan.map((x) => x.ma),
    nganh: day.nganh.map((x) => x.ma), linhVuc: day.linhVuc.map((x) => x.ma), mucTieu: day.mucTieu.map((x) => x.ma), coQuanTrinh: day.coQuanTrinh.map((x) => x.ma) };
  return { day, ma, xacMinh: { ...ma, linhVuc: day.linhVuc.map((x) => ({ ma: x.ma, nganh_ma: x.nganh_ma })) } };
}
