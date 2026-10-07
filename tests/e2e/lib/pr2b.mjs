// Dùng chung cho spec PR-2b (project pr2b, chỉ máy tính): id tài khoản seed, client service_role, tạo việc / minh chứng mẫu theo khoá riêng của lần
// chạy, bật cờ tạm có khôi phục. Việc mẫu chèn bằng service_role (không qua kiểm tra của giao_viec), nên đặt được hạn hoàn thành trong quá khứ
// để dựng đúng trạng thái cần kiểm (0077: hạn nộp minh chứng đã bỏ). Mọi dữ liệu gắn văn bản so_ket_luan = khoá ⇒ donVanBan dọn hết.
import { expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './keys.mjs';
import { contextAs, NAP } from './app.js';

export const ID = {
  cvp: '00000000-0000-4000-8000-000000000001', pcvp: '00000000-0000-4000-8000-000000000002', tp: '00000000-0000-4000-8000-000000000003',
  cv1: '00000000-0000-4000-8000-000000000004', pcvp2: '00000000-0000-4000-8000-000000000006', a0: '00000000-0000-4000-8000-000000000009',
  e2eKl: '00000000-0000-4000-8000-000000000010', e2eNv: '00000000-0000-4000-8000-000000000012', e2eOwner: '00000000-0000-4000-8000-000000000014',
  e2eTp: '00000000-0000-4000-8000-000000000015', e2eCv: '00000000-0000-4000-8000-000000000016', e2eTk: '00000000-0000-4000-8000-000000000018',
};
export const dbAdmin = () => { const k = getKeys(); return createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } }); };
export const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày Việt Nam (đúng cả 17–24h UTC)
export const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const dd = (d) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}/${d.slice(0, 4)}`;   // như formatNgay của app (không đệm 0)

// Việc mẫu: mặc định chủ trì demo_e2e_cv (phòng E2E_RT), theo dõi = chủ trì, người giao demo_e2e_tp; hạn +20 ngày.
export async function taoViec(db, vbId, nhan, row = {}) {
  const r = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: nhan, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(homNay(), 20),
    owner_don_vi_ma: 'E2E_RT', owner_tai_khoan: ID.e2eCv, nguoi_theo_doi: ID.e2eCv, tao_boi: ID.e2eTp,
    nganh_ma: 'KINH_TE_TONG_HOP', theo_1400: true, ngay_nhan_van_ban: homNay(), ngay_nhan_uoc_tinh: false, cap_nhan_san_pham: 'TRUONG_PHONG', ...row })
    .select('id, ma').single();
  if (r.error) throw new Error(`Tạo việc mẫu "${nhan}" thất bại: ${r.error.message}`);
  return r.data;
}
// Minh chứng đang chờ nghiệm thu (nộp lúc chạy).
export async function taoMinhChung(db, nvId, nopBoi, so) {
  const r = await db.from('minh_chung').insert({ nhiem_vu_id: nvId, loai: 'so_hieu', so_hieu: so, ngay_van_ban: homNay(), cap_nhan: 'TRUONG_PHONG',
    trich_yeu: 'Báo cáo kết quả (e2e PR-2b)', mo_ta_ket_qua: 'Đã tổng hợp và gửi lãnh đạo.', nop_boi: nopBoi }).select('id').single();
  if (r.error) throw new Error(`Tạo minh chứng mẫu thất bại: ${r.error.message}`);
  return r.data.id;
}
export async function datCo(db, id, patch) {
  const r = await db.from('accounts').update(patch).eq('id', id);
  if (r.error) throw new Error(`Đặt cờ tài khoản thất bại: ${r.error.message}`);
}

// Mở app bằng phiên của vai, chờ đầu trang (dữ liệu hồ sơ + menu theo cờ đã nạp).
export async function moApp(browser, role, testInfo) {
  const page = await (await contextAs(browser, role, testInfo)).newPage();
  await page.goto('./');
  await expect(page.locator('#mainHeader')).toBeVisible(NAP);
  return page;
}
// Một phiên cho một đoạn việc: mở, chạy fn(page), ĐÓNG ngay kể cả khi lỗi — spec không mở quá 2 phiên cùng lúc (docs/KIEM-THU.md, CI #97).
export async function voiPhien(browser, role, testInfo, fn) {
  const page = await moApp(browser, role, testInfo);
  try { return await fn(page); } finally { await page.context().close(); }
}
// PR-3: nghiệm thu ở màn "Cần nghiệm thu" = bấm Nghiệm thu → chọn chất lượng (BẮT BUỘC: nút xác nhận mờ tới khi chọn) → Xác nhận nghiệm thu.
export async function nghiemThuMc(page, mc, chatLuong = 'DAT') {
  await page.locator(`#nt-${mc}`).getByRole('button', { name: 'Nghiệm thu' }).click();
  const f = page.locator(`#oNtCl-${mc}`); const nut = f.getByRole('button', { name: 'Xác nhận nghiệm thu' });
  await expect(nut).toBeDisabled();
  await f.locator('select[name="chat_luong"]').selectOption(chatLuong);
  await nut.click();
}
// Mở màn "Cần nghiệm thu" và chờ danh sách nạp xong.
export async function moNghiemThu(page) {
  await page.locator('#navNghiemThu').click();
  await expect(page.locator('#ntDanhSach')).toHaveAttribute('data-nap', /./, NAP);
}
