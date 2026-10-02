// Nhập theo tầng + Đề nghị sửa (giao diện v9 đợt 2, 0070–0071). Một việc phòng thử E2E_RT do Trưởng phòng (demo_e2e_tp) giao cho chuyên viên
// (demo_e2e_cv): (1) A3 — thẻ "Việc của tôi" → Đề nghị sửa sản phẩm (lý do bắt buộc) → thẻ ghi "chờ … duyệt", nút Rút thay nút Đề nghị sửa;
// ngăn chi tiết có KHOÁ (không có bút) ở ô do cấp giao điền, khối "đang chờ" chỉ có Rút; (2) A2 — dải Cần xử lý ngay có mục "đề nghị sửa chờ
// duyệt" → Chấp nhận → sản phẩm đổi; (3) A2 — đề nghị thứ hai (gửi bằng token A3) → ngăn chi tiết có BÚT, khối đang chờ → Giữ nguyên (ý kiến
// bắt buộc); Sửa thông tin giao (độ khẩn): thiếu lý do bị chặn, có lý do áp ngay, lịch sử ghi lý do. Project chưa áp 0071 → skip cả spec.
// Chạy ở project riêng SAU chuỗi pr4 (playwright.config.js): hàm DB gửi tin hệ thống cho demo_e2e_cv — realtime.spec đếm huy hiệu tin của tài
// khoản này. Dữ liệu theo khoá riêng, tự dọn (văn bản → việc → đề nghị, lịch sử, tin theo FK CASCADE).
import { test, expect } from '@playwright/test';
import { pageAs, moViec, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, taoViec } from './lib/pr2b.mjs';

const LY_DO = 'E2E: trình dưới dạng tờ trình kèm dự thảo';
const toast = (page) => page.locator('#toastContainer');

test.describe.serial('Nhập theo tầng — khoá / bút, Đề nghị sửa và duyệt', () => {
  let db; let khoa; let nv; let dnsId;

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin();
    test.skip(Boolean((await db.from('de_nghi_sua').select('id').limit(1)).error), 'Project chưa có migration 0071 (đề nghị sửa).');
    khoa = khoaRieng('NTT', testInfo);
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: homNay(), ngay_nhan: homNay() });
    nv = await taoViec(db, vb, `${khoa} việc nhập theo tầng`, { san_pham_loai: 'BAO_CAO' });
    await kiemThayViec('E2E_CV', nv.id, nv.ma); await kiemThayViec('E2E_TP', nv.id, nv.ma);
  });
  test.afterAll(async () => { if (db && khoa) await donVanBan(db, khoa); });

  test('A3: thẻ Việc của tôi → Đề nghị sửa (lý do bắt buộc) → thẻ ghi chờ duyệt, có Rút; ngăn chi tiết có khoá, không có bút', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_CV', testInfo);
    const the = page.locator(`#vct-${nv.id}`);
    await expect(the).toBeVisible(NAP);
    await the.getByRole('button', { name: 'Đề nghị sửa', exact: true }).click();
    const hop = page.locator('#stModal');
    await expect(hop).toBeVisible();
    await expect(page.locator('#stTieuDe')).toHaveText(`Đề nghị sửa · ${nv.ma}`);
    await page.locator('#stCot').selectOption('san_pham_loai');
    await expect(page.locator('#stCu')).toHaveText('Báo cáo');
    await page.locator('#stMoi').selectOption('TO_TRINH');
    await page.locator('#stLuu').click();   // thiếu lý do → chặn ngay ở hộp thoại, chưa gọi hàm
    await expect(toast(page)).toContainText('Ghi lý do');
    await expect(hop).toBeVisible();
    await page.locator('#stLyDo').fill(LY_DO);
    await page.locator('#stLuu').click();
    await expect(toast(page)).toContainText('Đã gửi đề nghị sửa');
    await expect(hop).toBeHidden();
    await expect(the).toContainText('Đã đề nghị sửa sản phẩm', NAP);
    await expect(the).toContainText('chờ Demo E2E Trưởng phòng RT duyệt');
    await expect(the.getByRole('button', { name: 'Rút đề nghị sửa' })).toBeVisible();
    await expect(the.getByRole('button', { name: 'Đề nghị sửa', exact: true })).toHaveCount(0);

    const d = (await db.from('de_nghi_sua').select('id, cap_duyet, thay_doi, gia_tri_cu, ly_do, trang_thai').eq('nhiem_vu_id', nv.id).single()).data;
    expect(d).toMatchObject({ cap_duyet: ID.e2eTp, thay_doi: { san_pham_loai: 'TO_TRINH' }, gia_tri_cu: { san_pham_loai: 'BAO_CAO' }, ly_do: LY_DO, trang_thai: 'CHO_DUYET' });
    dnsId = d.id;
    expect((await db.from('nhiem_vu').select('san_pham_loai').eq('id', nv.id).single()).data.san_pham_loai).toBe('BAO_CAO');   // chưa duyệt → chưa đổi

    await moViec(page, nv.id, nv.ma);
    const ngan = page.locator(`#klChiTiet-${nv.id}`);
    await expect(ngan.locator('.nut-tang.khoa').first()).toBeVisible();
    await expect(ngan.locator('.nut-tang:not(.khoa)')).toHaveCount(0);
    const khoi = ngan.locator(`#klDns-${nv.id}`);
    await expect(khoi).toContainText('Sản phẩm: Báo cáo → Tờ trình', NAP);
    await expect(khoi.getByRole('button', { name: 'Rút đề nghị' })).toBeVisible();
    await expect(khoi.getByRole('button', { name: 'Chấp nhận' })).toHaveCount(0);
    await page.context().close();
  });

  test('A2 (người giao): dải Cần xử lý ngay có mục đề nghị sửa → Chấp nhận → sản phẩm đổi, đề nghị đóng', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_TP', testInfo);
    const muc = page.locator('#canXuLy [data-muc="dnsua"]');
    await expect(muc).toBeVisible(NAP);
    await muc.click();
    const dong = page.locator(`#cx-dnsua-${dnsId}`);
    await expect(dong).toBeVisible(NAP);
    await expect(dong).toContainText('Sản phẩm: Báo cáo → Tờ trình');
    await expect(dong).toContainText(LY_DO);
    await dong.getByRole('button', { name: 'Chấp nhận' }).click();
    await expect(toast(page)).toContainText('Đã chấp nhận đề nghị sửa');
    await expect(page.locator(`#cx-dnsua-${dnsId}`)).toHaveCount(0, NAP);
    await page.context().close();
    expect((await db.from('nhiem_vu').select('san_pham_loai').eq('id', nv.id).single()).data.san_pham_loai).toBe('TO_TRINH');
    expect((await db.from('de_nghi_sua').select('trang_thai, duyet_boi').eq('id', dnsId).single()).data).toEqual({ trang_thai: 'DONG_Y', duyet_boi: ID.e2eTp });
  });

  test('A2: ngăn chi tiết có bút; đề nghị thứ hai → Giữ nguyên (ý kiến bắt buộc); Sửa thông tin giao — thiếu lý do bị chặn, có lý do áp ngay', async ({ browser }, testInfo) => {
    const gui = await clientCuaVai('E2E_CV').rpc('de_nghi_sua_gui', { p_nhiem_vu: nv.id, p_thay_doi: { don_vi_phoi_hop: 'Sở Tài chính (e2e)' }, p_ly_do: 'E2E: thêm đơn vị phối hợp' });
    if (gui.error) throw new Error(`A3 gửi đề nghị thứ hai: ${gui.error.message}`);
    const page = await pageAs(browser, 'E2E_TP', testInfo);
    await moViec(page, nv.id, nv.ma);
    const ngan = page.locator(`#klChiTiet-${nv.id}`);
    await expect(ngan.locator('.nut-tang:not(.khoa)').first()).toBeVisible();
    await expect(ngan.locator('.nut-tang.khoa')).toHaveCount(0);
    const khoi = ngan.locator(`#klDns-${nv.id}`);
    await expect(khoi).toContainText('Đơn vị phối hợp: (trống) → Sở Tài chính (e2e)', NAP);
    await khoi.getByRole('button', { name: 'Giữ nguyên' }).click();   // mở ô ý kiến
    const o = page.locator(`#oDns-${gui.data}`);
    await expect(o).toBeVisible();
    await o.locator('input[name=y_kien]').fill('Phối hợp đã có trong kế hoạch chung (e2e)');
    await o.getByRole('button', { name: 'Giữ nguyên' }).click();
    await expect(toast(page)).toContainText('Đã giữ nguyên');
    await expect(khoi).toBeHidden(NAP);

    await ngan.getByRole('button', { name: 'Sửa thông tin giao' }).click();
    await expect(page.locator('#stTieuDe')).toHaveText(`Sửa thông tin giao · ${nv.ma}`);
    await page.locator('#stCot').selectOption('do_khan');
    await page.locator('#stMoi').selectOption('KHAN');
    await page.locator('#stLuu').click();
    await expect(toast(page)).toContainText('Ghi lý do');
    await page.locator('#stLyDo').fill('E2E: theo kết luận giao ban');
    await page.locator('#stLuu').click();
    await expect(toast(page)).toContainText('Đã sửa độ khẩn');
    await expect(page.locator('#stModal')).toBeHidden();
    await page.context().close();

    expect((await db.from('de_nghi_sua').select('trang_thai, y_kien_duyet').eq('id', gui.data).single()).data)
      .toEqual({ trang_thai: 'KHONG_DONG_Y', y_kien_duyet: 'Phối hợp đã có trong kế hoạch chung (e2e)' });
    const v = (await db.from('nhiem_vu').select('do_khan, don_vi_phoi_hop').eq('id', nv.id).single()).data;
    expect(v).toEqual({ do_khan: 'KHAN', don_vi_phoi_hop: null });
    const ls = (await db.from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', nv.id).eq('cot', 'sua_thong_tin_giao')).data;
    expect(ls.map((x) => x.gia_tri_moi)).toEqual([expect.stringContaining('E2E: theo kết luận giao ban')]);
  });
});
