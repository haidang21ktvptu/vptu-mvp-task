// Dữ liệu riêng của từng spec (GĐ23): mỗi spec chạy lại N lần liên tiếp (desktop rồi mobile, 2 worker, kể cả lần trước dừng giữa chừng) vẫn đúng.
// Quy tắc: (1) khoá duy nhất (so_ket_luan) = E2E-TEST-<nhãn>-<project> → không đụng project khác; (2) tạo = xoá dấu vết CỦA CHÍNH KHOÁ ĐÓ
// rồi chèn (idempotent); (3) dọn ở afterAll theo đúng khoá, không xoá theo so_hoi_nghi hay mẫu rộng (từng xoá nhầm dữ liệu spec khác / việc mốc).
import { E2E_TAG } from '../global-setup.mjs';

export const khoaRieng = (nhan, testInfo) => `${E2E_TAG}-${nhan}-${testInfo.project.name}`;

// Xoá văn bản có so_ket_luan đúng bằng khoá cùng mọi nhiệm vụ gắn với nó (chi_dao, lich_su, minh_chung, tin hệ thống… theo FK CASCADE).
export async function donVanBan(db, soKetLuan) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_ket_luan', soKetLuan);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id);
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}

// Tạo văn bản mẫu theo khoá riêng: dọn dấu vết lần chạy dở trước của cùng khoá rồi chèn mới; trả id.
export async function taoVanBanRieng(db, soKetLuan, extra = {}) {
  await donVanBan(db, soKetLuan);
  const { data, error } = await db.from('van_ban_giao_viec').insert({ so_ket_luan: soKetLuan, ngay_ban_hanh: '2026-08-01', ...extra }).select('id').single();
  if (error) throw new Error(`Tạo văn bản mẫu "${soKetLuan}" thất bại: ${error.message}`);
  return data.id;
}

// Xoá nhiệm vụ theo tiền tố nội dung (đã gồm nhãn spec + project) — dùng cho việc tạo qua giao diện trong lần chạy này.
export async function donNhiemVuTheoNoiDung(db, tienTo) {
  await db.from('nhiem_vu').delete().like('noi_dung', `${tienTo}%`);
}
