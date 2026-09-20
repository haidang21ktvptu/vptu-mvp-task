// Sau kiểm tra v3.6.2 (0045): (1) duyệt "Đồng ý từ chối" xong, số trên dải "Cần xử lý ngay" giảm ngay không cần tải lại; (2) "Giao lại" việc bị
// từ chối đổi CHỦ TRÌ sang người được chọn (người theo dõi gợi ý theo cấp quản lý của chủ trì mới), chủ trì cũ không còn là chủ trì và không
// còn thấy việc, cờ bị từ chối tự xoá, lịch sử ghi chuyển chủ trì (không ghi lý do từ chối), chủ trì mới phải xác nhận nhận lại.
// Tài khoản riêng phòng E2E_RT: demo_e2e_tp (A2, người giao + cấp duyệt), demo_e2e_cv (chủ trì cũ), demo_e2e_cv2 (chủ trì mới, seed-demo.mjs).
// Đơn vị dm_don_vi E2E_RT do seed-demo tạo. Dữ liệu tự tạo, tự dọn theo khoá riêng. Số trên dải so tương đối (spec khác có thể dùng chung TP).
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { storageStatePath } from './lib/roles.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';

const TP_ID = '00000000-0000-4000-8000-000000000015';  // demo_e2e_tp (A2, E2E_RT)
const CV_ID = '00000000-0000-4000-8000-000000000016';  // demo_e2e_cv (A3, E2E_RT) — chủ trì cũ
const CV2_ID = '00000000-0000-4000-8000-000000000017'; // demo_e2e_cv2 (A3, E2E_RT) — chủ trì mới
const LY_DO_TU_CHOI = 'Đang đi công tác dài ngày (e2e giao lại)';
const homNayVN = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const congNgay = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const NAP = { timeout: 20_000 };
const so = async (loc) => Number((await loc.innerText()).trim());

test.describe.serial('Giao lại đổi chủ trì; số đếm dải Cần xử lý ngay sau khi duyệt từ chối', () => {
  let db; let khoa; let id; let ma; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    test.skip(!existsSync(storageStatePath('E2E_CV2')), 'Chưa có demo_e2e_cv2 trên project này (chạy scripts/seed-demo.mjs).');
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const dv = await db.from('dm_don_vi').select('ma').eq('ma', 'E2E_RT').maybeSingle();
    test.skip(!dv.data, 'Chưa có đơn vị E2E_RT trong dm_don_vi (seed-demo.mjs tạo).');
    khoa = khoaRieng('GLCT', testInfo);
    const vbId = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN' });
    const { data, error } = await db.from('nhiem_vu').insert({ van_ban_id: vbId, noi_dung: `${E2E_TAG} giao lại chủ trì ${testInfo.project.name} ${Date.now()}`,
      loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: congNgay(homNayVN(), 12), owner_don_vi_ma: 'E2E_RT', owner_tai_khoan: CV_ID, nguoi_theo_doi: TP_ID, tao_boi: TP_ID,
      theo_1400: true, san_pham_loai: 'BAO_CAO', ngay_nhan_van_ban: homNayVN(), do_khan: 'KHAN' }).select('id, ma').single();
    if (error) throw new Error(`Tạo việc mẫu thất bại: ${error.message}`);
    id = data.id; ma = data.ma;
    await kiemThayViec('E2E_CV', id, ma); await kiemThayViec('E2E_TP', id, ma);
    const r = await clientCuaVai('E2E_CV').rpc('de_nghi_tu_choi', { p_nhiem_vu: id, p_ly_do: LY_DO_TU_CHOI }); // chủ trì cũ tự đề nghị, token của mình
    if (r.error) throw new Error(`Đề nghị từ chối thất bại: ${r.error.message}`);
    page = await pageAs(browser, 'E2E_TP', testInfo);
  });
  test.afterAll(async () => { await page?.context().close(); if (db) await donVanBan(db, khoa); });

  test('Lỗi 2: Đồng ý từ chối trên dải → số "đề nghị chờ duyệt" giảm đúng 1 ngay, không tải lại', async () => {
    const nut = page.locator('#canXuLy [data-muc="denghi"]');
    await expect(nut).toBeVisible(NAP);
    const n = await so(nut.locator('b'));
    await nut.click();
    const dong = page.locator(`#cx-denghi-${id}`);
    await expect(dong).toBeVisible(NAP);
    await expect(dong).toContainText(LY_DO_TU_CHOI);
    await dong.getByRole('button', { name: 'Đồng ý từ chối' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã đồng ý từ chối');
    await expect(dong).toHaveCount(0, NAP);
    if (n - 1 === 0) await expect(page.locator('#canXuLy [data-muc="denghi"]')).toHaveCount(0, NAP);
    else await expect(page.locator('#canXuLy [data-muc="denghi"] b')).toHaveText(String(n - 1), NAP);
    await expect(page.locator('#canXuLy [data-muc="tuchoi"]')).toBeVisible(NAP); // việc chuyển sang mục "bị từ chối"
  });

  test('Lỗi 1: Giao lại đổi chủ trì; người theo dõi gợi ý = Trưởng phòng; cờ xoá; lịch sử; chủ trì cũ không còn thấy việc; chủ trì mới phải nhận lại', async () => {
    await page.locator('#canXuLy [data-muc="tuchoi"]').click();
    const dong = page.locator(`#cx-tuchoi-${id}`);
    await expect(dong).toBeVisible(NAP);
    await dong.locator(`[data-action="moO"][data-o="cxGiaoLai-${id}"]`).click();
    const o = page.locator(`#cxGiaoLai-${id}`);
    await expect(o).toHaveClass(/\bmo\b/);
    await expect(o.locator('select[name=chu_tri_moi] option[value="' + CV_ID + '"]')).toHaveCount(0); // không cho chọn lại chủ trì hiện tại
    await o.locator('select[name=chu_tri_moi]').selectOption(CV2_ID);
    await expect(o.locator('select[name=nguoi_theo_doi_moi]')).toHaveValue(TP_ID);                      // gợi ý theo cấp quản lý của chủ trì mới
    await o.locator('input[name=noi_dung]').fill('Chuyển đồng chí Hai chủ trì (e2e)');
    await o.locator('button[type=submit]').click();
    await expect(page.locator('#toastContainer')).toContainText('Đã giao lại');
    await expect(page.locator('#toastContainer')).toContainText('Demo E2E Chuyên viên GL');
    await expect(dong).toHaveCount(0, NAP);
    const { data: nv } = await db.from('nhiem_vu').select('owner_tai_khoan, owner_don_vi_ma, nguoi_theo_doi, bi_tu_choi, cap_nhan_san_pham').eq('id', id).single();
    expect(nv).toEqual({ owner_tai_khoan: CV2_ID, owner_don_vi_ma: 'E2E_RT', nguoi_theo_doi: TP_ID, bi_tu_choi: false, cap_nhan_san_pham: 'TRUONG_PHONG' });
    const { data: ls } = await db.from('lich_su').select('cot, gia_tri_moi').eq('nhiem_vu_id', id);
    expect(ls.some((l) => l.cot === 'giao_lai' && /Chuyển chủ trì từ Demo E2E Chuyên viên RT sang Demo E2E Chuyên viên GL/.test(l.gia_tri_moi))).toBe(true);
    expect(ls.some((l) => (l.gia_tri_moi || '').includes(LY_DO_TU_CHOI))).toBe(false);                 // lý do từ chối không vào lịch sử việc
    const cu = await clientCuaVai('E2E_CV').from('v_nhiem_vu').select('id').eq('id', id);
    expect(cu.data).toHaveLength(0);                                                                     // chủ trì cũ không còn thấy việc
    const moi = await clientCuaVai('E2E_CV2').rpc('kl_so_chua_xu_ly', {});
    expect(Number(moi.data?.viec_moi)).toBeGreaterThanOrEqual(1);                                       // chủ trì mới phải xác nhận nhận lại
    const { data: xn } = await db.from('lich_su').select('nguoi_sua').eq('nhiem_vu_id', id).eq('cot', 'xac_nhan_nhan_viec').eq('nguoi_sua', CV2_ID);
    expect(xn).toHaveLength(0);
  });
});
