// Dữ liệu riêng của từng spec (GĐ23): mỗi spec chạy lại N lần liên tiếp (desktop rồi mobile, 2 worker, kể cả lần trước dừng giữa chừng) vẫn đúng.
// Quy tắc: (1) khoá duy nhất (so_ket_luan) = E2E-TEST-<nhãn>-<project> → không đụng project khác; (2) tạo = xoá dấu vết CỦA CHÍNH KHOÁ ĐÓ
// rồi chèn (idempotent); (3) dọn ở afterAll theo đúng khoá, không xoá theo so_hoi_nghi hay mẫu rộng (từng xoá nhầm dữ liệu spec khác / việc mốc).
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { E2E_TAG } from '../global-setup.mjs';
import { getKeys } from './keys.mjs';
import { sessionPath } from './roles.mjs';

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

// Client Supabase chạy DƯỚI QUYỀN một vai (anon key + access token đã lưu ở global-setup): RLS đúng như người dùng thấy; dùng cho đọc kiểm
// và cho hành động của chính vai đó (RPC xac_nhan_nhan_viec…) mà không cần service_role. Token JWT 1 giờ đủ cho một lần chạy.
export function clientCuaVai(role) {
  const k = getKeys();
  const { access_token } = JSON.parse(readFileSync(sessionPath(role), 'utf8'));
  return createClient(k.url, k.anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${access_token}` } } });
}

// Sau khi tạo việc mẫu bằng service_role: đọc lại v_nhiem_vu bằng token (đã lưu ở global-setup, không tốn refresh) của vai sẽ xem việc đó.
// Không thấy → ném lỗi rõ ngay ở beforeAll (RLS kl_pham_vi / dữ liệu tài khoản trên project không như spec giả định) thay vì để test chờ 10 giây
// ở #klRow-<id>. Nhiều vai / nhiều việc: gọi lần lượt.
export async function kiemThayViec(role, id, nhan = '') {
const { data, error } = await clientCuaVai(role).from('v_nhiem_vu').select('id').eq('id', id);
  if (error) throw new Error(`Đọc v_nhiem_vu bằng vai ${role}: ${error.message}`);
  if (!data.length) throw new Error(`Việc mẫu ${nhan || id} không nằm trong phạm vi của vai ${role} (kl_pham_vi) — kiểm owner_tai_khoan / nguoi_theo_doi / owner_don_vi_ma và tài khoản trên project.`);
}

// Phòng mà một lãnh đạo (PCVP demo) đang phụ trách — đọc phu_trach_phong lúc chạy thay vì gõ cứng (trên production phòng thật có lãnh đạo thật,
// seed-demo chỉ phân công phòng thử E2E_PT / E2E_RT cho demo_pcvp2). Ưu tiên phòng thử E2E_*; không có phân công nào → lỗi rõ ở beforeAll.
export async function phongPhuTrach(db, lanhDaoId) {
  const { data, error } = await db.from('phu_trach_phong').select('phong').eq('lanh_dao_id', lanhDaoId).is('den_ngay', null);
  if (error) throw new Error(`Đọc phu_trach_phong: ${error.message}`);
  const phong = data.map((p) => p.phong).sort((a, b) => Number(b.startsWith('E2E_')) - Number(a.startsWith('E2E_')))[0];
  if (!phong) throw new Error(`Lãnh đạo ${lanhDaoId} không phụ trách phòng nào — chạy scripts/seed-demo.mjs (phòng thử E2E) trước.`);
  return phong;
}
