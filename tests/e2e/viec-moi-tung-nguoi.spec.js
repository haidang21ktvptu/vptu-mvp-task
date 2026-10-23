// Sau kiểm tra v3.6.0 — "việc mới chờ xác nhận" đếm theo chính tôi (kl_so_chua_xu_ly.viec_moi). v3.31 (0128, chủ dự án 23/10/2026): chỉ còn chủ
// trì theo dõi — người theo dõi (nội bộ) luôn theo chủ trì, nên CHỈ chủ trì tự nhận: việc tạo với người theo dõi khác (demo_e2e_kl) được CSDL ghi về
// chủ trì (demo_e2e_dh); chủ trì thấy việc ở dải "Cần xử lý ngay" mục "việc mới chờ xác nhận": số trên nút = số dòng danh sách = viec_moi của RPC;
// bấm Xác nhận → dòng biến mất, số giảm đúng 1; lịch sử chỉ một dòng nhận của chủ trì. Số tuyệt đối không cố định (spec khác cùng dùng
// demo_e2e_dh khi CI chạy 2 worker) → chỉ so tương đối. Dữ liệu tự dọn theo khoá.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';

const KL_ID = '00000000-0000-4000-8000-000000000010'; // demo_e2e_kl (A3, Tổng hợp) — người theo dõi gửi kèm khi tạo (bị CSDL ghi đè)
const DH_ID = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh (A3, Tổng hợp) — chủ trì theo dõi
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const NAP = { timeout: 20_000 };

test.describe.serial('Việc mới chờ xác nhận — chỉ chủ trì theo dõi nhận, số trên dải = danh sách', () => {
  let db; let khoa; let id; let ma;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('kl_cau_hinh').select('khoa').eq('khoa', 'thuong_truc_han_nhan_ngay').maybeSingle();
    test.skip(!co.data, 'Project chưa có migration 0035+.');
    khoa = khoaRieng('VMTN', testInfo);
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    const { data, error } = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${E2E_TAG} việc mới từng người ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: congNgay(homNayVN(), 10), owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: DH_ID, nguoi_theo_doi: KL_ID,
      theo_1400: true, san_pham_loai: 'BAO_CAO', ngay_nhan_van_ban: homNayVN() }).select('id, ma').single();
    if (error) throw new Error(`Tạo việc mẫu thất bại: ${error.message}`);
    id = data.id; ma = data.ma;
    const { data: nv } = await db.from('nhiem_vu').select('nguoi_theo_doi').eq('id', id).single();
    expect(nv.nguoi_theo_doi).toBe(DH_ID);   // 0128: người theo dõi (nội bộ) = chủ trì, giá trị gửi kèm bị ghi đè
    await kiemThayViec('E2E_DH', id, ma);
  });
  test.afterAll(async () => { if (db) await donVanBan(db, khoa); });

  test('chủ trì theo dõi: việc chờ tôi xác nhận; số trên nút = số dòng = RPC; Xác nhận → dòng mất, số giảm 1; lịch sử một dòng nhận', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_DH', testInfo);
    const nut = page.locator('#canXuLy [data-muc="moi"]');
    await expect(nut).toBeVisible(NAP);
    const so = Number(await nut.locator('b').innerText());
    expect(so).toBeGreaterThanOrEqual(1);
    const rpc = await clientCuaVai('E2E_DH').rpc('kl_so_chua_xu_ly', {});
    expect(Number(rpc.data?.viec_moi)).toBe(so);                              // dải vẽ đúng số của hàm DB
    await expect(page.locator(`#vct-${id}`)).toHaveAttribute('data-viec', 'nhan', NAP);   // dòng "Việc của tôi" (v3.25 bảng) cũng theo chính tôi: còn nút Xác nhận
    await nut.click();
    const ds = page.locator('#cxChiTiet [id^="cx-moi-"]');
    await expect(page.locator(`#cx-moi-${id}`)).toBeVisible(NAP);
    await expect(ds).toHaveCount(so);                                         // số trên nút = số dòng danh sách
    await page.locator(`#cx-moi-${id}`).getByRole('button', { name: 'Xác nhận đã nhận' }).click();
    await expect(page.locator('#toastContainer')).toContainText(`Đã xác nhận nhận việc ${ma}`);
    await expect(page.locator(`#cx-moi-${id}`)).toHaveCount(0, NAP);
    await expect(page.locator(`#vct-${id}`)).toHaveCount(0, NAP);   // đã nhận, còn hạn → rời ô "Cần xử lý" (mặc định) của bảng
    if (so - 1 === 0) await expect(page.locator('#canXuLy [data-muc="moi"]')).toHaveCount(0, NAP);
    else { await expect(page.locator('#canXuLy [data-muc="moi"] b')).toHaveText(String(so - 1), NAP); await expect(ds).toHaveCount(so - 1); }
    const ls = await db.from('lich_su').select('nguoi_sua').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec');
    expect(ls.data.map((l) => l.nguoi_sua)).toEqual([DH_ID]);  // chỉ chủ trì theo dõi nhận (không còn người theo dõi riêng)
    await page.context().close();
  });
});
