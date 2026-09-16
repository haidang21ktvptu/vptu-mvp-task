// GĐ19 (CH-16, 0032) — chỉ đạo Thường trực: A0 mở nhiệm vụ, chọn "Chỉ đạo" trên ô nhập chung → luồng có dòng CHI_DAO_TT chờ
// phản hồi, người nhận tự tính → PCVP phụ trách (người nhận) thấy khối "Chỉ đạo Thường trực chờ phản hồi" ở ĐẦU Dashboard,
// bấm Phản hồi → gửi → A0 thấy "Đã phản hồi" trên Dashboard của mình. Dữ liệu ở phòng Quản trị (Owner/theo dõi demo_cv2,
// người nhận = Chánh VP + demo_pcvp2) vì không spec nào khác ghi ở đó (2 worker); hội nghị 991, tự dọn. Bỏ qua khi thiếu demo_a0.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, contextAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { OPTIONAL_USERS, storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';

const CV2_ID = '00000000-0000-4000-8000-000000000005'; // demo_cv2 — chuyên viên phòng Quản trị
const SO_HOI_NGHI = 991;
const RT = { timeout: 20_000 };   // realtime trên gói Free có thể trễ vài giây

test.describe.serial('Chỉ đạo Thường trực — A0 gửi → PCVP phụ trách phản hồi → A0 thấy trạng thái', () => {
  let db; let nvId; let ma; let a0; let pcvp;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('A0')), 'Chưa có demo_a0 trên project này.');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('v_chi_dao_tt').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0032 (chỉ đạo Thường trực).');
    await don(db);
    const { data: hn, error: e1 } = await db.from('van_ban_giao_viec').insert({ so_hoi_nghi: SO_HOI_NGHI, so_ket_luan: `${E2E_TAG}-TT`, ngay_ban_hanh: '2026-08-01' }).select('id').single();
    if (e1) throw new Error(`Tạo hội nghị mẫu thất bại: ${e1.message}`);
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({
      van_ban_id: hn.id, nguoi_theo_doi: CV2_ID, owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: CV2_ID,
      noi_dung: `${E2E_TAG} chỉ đạo Thường trực ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP',
    }).select('id, ma').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id; ma = nv.ma;
    a0 = await (await contextAs(browser, 'A0', testInfo)).newPage(); // A0 là tài khoản tuỳ chọn (không trong USERS)
    await a0.goto('./');
    await expect(a0.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS.A0.fullName);
    pcvp = await pageAs(browser, 'PCVP2', testInfo);
  });
  test.afterAll(async () => {
    for (const p of [a0, pcvp]) await p?.context().close();
    if (db) await don(db);
  });

  test('A0: ô nhập chung có "Ý kiến" / "Chỉ đạo"; gửi Chỉ đạo → dòng CHI_DAO_TT chờ phản hồi, người nhận tự tính, A0 có nút Đóng; Dashboard A0 có dòng', async () => {
    await a0.locator('#navKl').click();
    await a0.locator('#klTimKiem').fill(ma);
    const row = a0.locator(`#klRow-${nvId}`);
    await expect(row).toBeVisible();
    await row.locator('[data-action=moKlChiDao]').click();
    const form = a0.locator(`#klChiDao-${nvId} form.cd-form`);
    await expect(form.locator('input[name=noi_dung]')).toBeVisible();
    await expect(form.locator('input[name=noi_dung]')).toBeEditable(); // không kiểm focus tự động (headless trên runner không ổn định)
    await expect(form.locator('select[name=loai] option')).toHaveText(['Ý kiến', 'Chỉ đạo']);
    await expect(form.locator('input[name=han_phan_hoi]')).toBeHidden();
    await form.locator('select[name=loai]').selectOption('CHI_DAO_TT');
    await expect(form.locator('input[name=han_phan_hoi]')).toBeVisible(); // để trống = 2 ngày làm việc
    await form.locator('input[name=noi_dung]').click();
    await form.locator('input[name=noi_dung]').fill('Báo cáo Thường trực tiến độ trước thứ Sáu (e2e)');
    await form.locator('button[type=submit]').click();
    const goc = a0.locator(`#klChiDao-${nvId} .cd-goc[data-loai=CHI_DAO_TT]`);
    await expect(goc).toHaveCount(1, RT);
    await expect(goc).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI');
    await expect(goc).toContainText('Chỉ đạo Thường trực');
    await expect(goc).toContainText('Người nhận: Demo Chánh Văn phòng, Demo Phó Chánh Văn phòng Hai');
    await expect(goc).toContainText('Hạn phản hồi');
    await expect(goc.locator('[data-action=dongChiDao]')).toHaveCount(1); // A0 đóng được luồng TT của mình (0032)
    await expect(goc.locator('.cd-form-ph')).toHaveCount(0);            // A0 không phản hồi
    await a0.locator('#navKlDashboard').click();
    const dong = a0.locator('#klDbChiDaoTTBody tr', { hasText: ma });
    await expect(dong).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI', RT);
    await expect(dong).toContainText('chưa có');
  });

  test('PCVP2: khối "Chỉ đạo Thường trực chờ phản hồi" đứng trước bảng ngoại lệ; Phản hồi → mở luồng (không nút Đóng, có ô chuyển thành chỉ đạo) → gửi', async () => {
    await pcvp.locator('#navKlDashboard').click();
    const khoi = pcvp.locator('#klDbChiDaoTTKhoi');
    await expect(khoi).toBeVisible(RT);
    await expect(pcvp.locator('#klDbH0')).toContainText('Chỉ đạo Thường trực chờ phản hồi (');
    expect((await khoi.boundingBox()).y).toBeLessThan((await pcvp.locator('#klDbH1').boundingBox()).y); // đầu trang
    const dong = pcvp.locator('#klDbChiDaoTTBody tr', { hasText: ma });
    await expect(dong).toHaveAttribute('data-trang-thai', 'CHO_PHAN_HOI');
    await expect(dong).toContainText('Demo Phó Chánh Văn phòng Hai');
    await dong.locator('[data-action=moChiDaoTT]').click();
    await expect(pcvp.locator('#viewKl')).toBeVisible();
    const goc = pcvp.locator(`#klChiDao-${nvId} .cd-goc[data-loai=CHI_DAO_TT]`);
    await expect(goc).toBeVisible();
    await expect(goc.locator('[data-action=dongChiDao]')).toHaveCount(0); // người nhận không đóng luồng TT
    await expect(goc.locator('form.cd-form-con')).toHaveCount(1);         // ô "Chuyển thành chỉ đạo" (chỉ đạo con)
    await expect(goc.locator('form.cd-form-con button[type=submit]')).toHaveText('Chuyển thành chỉ đạo');
    await goc.locator('.cd-form-ph input[name=noi_dung]').fill('Đã giao phòng Quản trị hoàn thiện, trình ngày mai (e2e)');
    await goc.locator('.cd-form-ph button[type=submit]').click();
    await expect(goc.locator('.cd-ph')).toHaveCount(1, RT);
    await expect(goc).toHaveAttribute('data-trang-thai', 'DA_PHAN_HOI', RT);
  });

  test('A0: Dashboard thấy "Đã phản hồi" kèm nội dung và người phản hồi', async () => {
    await a0.locator('[data-action=loadKlDashboard]').click();
    const dong = a0.locator('#klDbChiDaoTTBody tr', { hasText: ma });
    await expect(dong).toHaveAttribute('data-trang-thai', 'DA_PHAN_HOI', RT);
    await expect(dong).toContainText('Đã phản hồi');
    await expect(dong).toContainText('Đã giao phòng Quản trị hoàn thiện');
    await expect(dong).toContainText('Demo Phó Chánh Văn phòng Hai');
  });
});

async function don(db) {
  const { data } = await db.from('van_ban_giao_viec').select('id').eq('so_hoi_nghi', SO_HOI_NGHI);
  for (const h of data || []) {
    await db.from('nhiem_vu').delete().eq('van_ban_id', h.id); // chi_dao, canh_bao, lich_su, tin hệ thống xoá theo FK CASCADE
    await db.from('van_ban_giao_viec').delete().eq('id', h.id);
  }
}
