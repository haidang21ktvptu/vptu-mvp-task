// Hết phiên do không thao tác (v3.15.1, SPEC NF-14): phần thuần, không chạm DOM — unit test frontend/tests/het-phien.test.mjs.
// Supabase Auth gói Free không có "inactivity timeout" phía máy chủ (tính năng Pro), nên app tự đếm: quá PHUT_HET_PHIEN phút không
// có thao tác → đăng xuất thiết bị này; nhắc trước PHUT_BAO_TRUOC phút. Mốc "lần cuối thao tác" lưu localStorage để các tab cùng
// trình duyệt dùng chung và để lúc tải lại trang sau một đêm biết phiên đã quá hạn.
export const PHUT_HET_PHIEN = 30;
export const PHUT_BAO_TRUOC = 2;
export const KHOA_LAN_CUOI = 'vptu-lan-cuoi-thao-tac';
export const KHOA_GHI_DE_PHUT = 'vptu-phut-het-phien';   // chỉ để kiểm thử: số phút (có thể lẻ) ghi đè mặc định
export const KHOA_LY_DO_THOAT = 'vptu-ly-do-dang-xuat';

// Số phút hết phiên đang áp dụng: giá trị ghi đè (kiểm thử) nếu hợp lệ, không thì mặc định.
export function phutHetPhien(ghiDe) {
  const n = Number(ghiDe);
  return Number.isFinite(n) && n > 0 && n <= 24 * 60 ? n : PHUT_HET_PHIEN;
}

// Trạng thái theo mốc thao tác cuối (ms) và hiện tại (ms): 'ok' | 'sap_het' (còn ≤ baoTruoc phút) | 'het'. conGiay: giây còn lại (≥ 0).
export function trangThaiPhien(lanCuoiMs, nowMs, { phut = PHUT_HET_PHIEN, baoTruoc = PHUT_BAO_TRUOC } = {}) {
  if (!Number.isFinite(lanCuoiMs)) return { trangThai: 'ok', conGiay: Math.round(phut * 60) };
  const conGiay = Math.max(0, Math.round((lanCuoiMs + phut * 60_000 - nowMs) / 1000));
  if (conGiay <= 0) return { trangThai: 'het', conGiay: 0 };
  if (conGiay <= Math.min(baoTruoc, phut / 2) * 60) return { trangThai: 'sap_het', conGiay };
  return { trangThai: 'ok', conGiay };
}

export const CAU_HET_PHIEN = (phut) => `Hệ thống đã tự đăng xuất vì không có thao tác trong ${phut} phút. Đồng chí đăng nhập lại để tiếp tục.`;
export const CAU_SAP_HET = (giay) => `Phiên sẽ tự đăng xuất sau ${Math.max(1, Math.ceil(giay / 60))} phút nếu không thao tác — bấm hoặc gõ bất kỳ để tiếp tục.`;
