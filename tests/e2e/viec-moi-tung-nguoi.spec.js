// Sau kiểm tra v3.6.0 — quy tắc: Owner và người theo dõi MỖI NGƯỜI tự bấm "Xác nhận đã nhận", không nhận thay nhau (kl_so_chua_xu_ly.viec_moi
// đếm theo chính tôi). Owner (demo_e2e_kl) xác nhận bằng RPC với token của mình → người theo dõi (demo_e2e_dh) vẫn thấy việc ở dải "Cần xử lý
// ngay" mục "việc mới chờ xác nhận": số trên nút = số dòng danh sách = viec_moi của RPC; bấm Xác nhận → dòng biến mất, số giảm đúng 1.
// Số tuyệt đối không cố định (spec khác cùng dùng demo_e2e_dh làm người theo dõi khi CI chạy 2 worker) → chỉ so tương đối. Dữ liệu tự dọn theo khoá.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';

const KL_ID = '00000000-0000-4000-8000-000000000010'; // demo_e2e_kl (A3, Tổng hợp) — Owner
const DH_ID = '00000000-0000-4000-8000-000000000013'; // demo_e2e_dh (A3, Tổng hợp) — người theo dõi
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const NAP = { timeout: 20_000 };

test.describe.serial('Việc mới chờ xác nhận — mỗi người tự nhận, số trên dải = danh sách', () => {
  let db; let khoa; let id; let ma;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('kl_cau_hinh').select('khoa').eq('khoa', 'thuong_truc_han_nhan_ngay').maybeSingle();
    test.skip(!co.data, 'Project chưa có migration 0035+.');
    khoa = khoaRieng('VMTN', testInfo);
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    const { data, error } = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${E2E_TAG} việc mới từng người ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: congNgay(homNayVN(), 10), owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: KL_ID, nguoi_theo_doi: DH_ID,
      theo_1400: true, san_pham_loai: 'BAO_CAO', ngay_nhan_van_ban: homNayVN() }).select('id, ma').single();
    if (error) throw new Error(`Tạo việc mẫu thất bại: ${error.message}`);
    id = data.id; ma = data.ma;
    await kiemThayViec('E2E_KL', id, ma); await kiemThayViec('E2E_DH', id, ma);
    // Owner tự xác nhận bằng RPC dưới token của chính mình (không ghi thẳng bảng, không service_role).
    const r = await clientCuaVai('E2E_KL').rpc('xac_nhan_nhan_viec', { p_id: id });
    if (r.error) throw new Error(`Owner xác nhận nhận việc thất bại: ${r.error.message}`);
    expect(r.data).toBe(true);
  });
  test.afterAll(async () => { if (db) await donVanBan(db, khoa); });

  test('người theo dõi: việc vẫn chờ tôi dù Owner đã nhận; số trên nút = số dòng = RPC; Xác nhận → dòng mất, số giảm 1', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_DH', testInfo);
    const nut = page.locator('#canXuLy [data-muc="moi"]');
    await expect(nut).toBeVisible(NAP);
    const so = Number(await nut.locator('b').innerText());
    expect(so).toBeGreaterThanOrEqual(1);
    const rpc = await clientCuaVai('E2E_DH').rpc('kl_so_chua_xu_ly', {});
    expect(Number(rpc.data?.viec_moi)).toBe(so);                              // dải vẽ đúng số của hàm DB
    await expect(page.locator(`#vctMuc-moi #vct-${id}`)).toBeVisible(NAP);   // thẻ "Việc mới giao" của A3 cũng theo chính tôi
    await nut.click();
    const ds = page.locator('#cxChiTiet [id^="cx-moi-"]');
    await expect(page.locator(`#cx-moi-${id}`)).toBeVisible(NAP);
    await expect(ds).toHaveCount(so);                                         // số trên nút = số dòng danh sách
    await page.locator(`#cx-moi-${id}`).getByRole('button', { name: 'Xác nhận đã nhận' }).click();
    await expect(page.locator('#toastContainer')).toContainText(`Đã xác nhận nhận việc ${ma}`);
    await expect(page.locator(`#cx-moi-${id}`)).toHaveCount(0, NAP);
    await expect(page.locator(`#vct-${id}`)).toHaveCount(0, NAP);
    if (so - 1 === 0) await expect(page.locator('#canXuLy [data-muc="moi"]')).toHaveCount(0, NAP);
    else { await expect(page.locator('#canXuLy [data-muc="moi"] b')).toHaveText(String(so - 1), NAP); await expect(ds).toHaveCount(so - 1); }
    const ls = await db.from('lich_su').select('nguoi_sua').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec');
    expect(ls.data.map((l) => l.nguoi_sua).sort()).toEqual([KL_ID, DH_ID].sort());  // hai dòng riêng: Owner và người theo dõi
    await page.context().close();
  });
});
