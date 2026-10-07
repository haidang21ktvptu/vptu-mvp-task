// PR-3 (C) — vướng mắc / đề nghị lãnh đạo quyết định: chuyên viên chủ trì điền ở Cập nhật nhanh → tin hệ thống MỘT lần tới người giao (A2) và
// lãnh đạo phụ trách, không tới A0 → thẻ Đỏ trên Điều hành của Chánh VP hiện trường thứ 5 "Vướng mắc", dải "Cần xử lý ngay" có mục vướng mắc, Báo
// cáo liệt kê ở "Việc cần lãnh đạo quyết định" → Chánh VP xoá trống tại ngăn chi tiết (= đã giải quyết) → thẻ và bảng không còn. Tuần tự, mỗi lúc
// một phiên (docs/KIEM-THU.md). Việc mẫu chèn bằng service_role theo khoá riêng; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, nav, moViec } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, taoViec, voiPhien } from './lib/pr2b.mjs';

let db; let khoa; let V;
const VM = 'Chờ Sở Tài chính cho ý kiến về nguồn kinh phí — đề nghị Chánh Văn phòng quyết định';

test.describe.serial('PR-3 — vướng mắc: Cập nhật nhanh → thẻ Đỏ, Báo cáo → xoá trống', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('PR3V', test.info());
    await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, khoa);
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: cong(homNay(), -20), ngay_nhan: cong(homNay(), -19) });
    // Việc Đỏ (quá hạn 3 ngày, chưa nộp minh chứng): chủ trì demo_e2e_cv (phòng E2E_RT), người giao demo_e2e_tp.
    V = await taoViec(db, vb, `${khoa} việc Đỏ`, { han_xu_ly: cong(homNay(), -3), ngay_nhan_van_ban: cong(homNay(), -19) });
    await db.from('lich_su').insert({ nhiem_vu_id: V.id, nguoi_sua: ID.e2eCv, cot: 'xac_nhan_nhan_viec', gia_tri_moi: 'Đã nhận việc (e2e)', nguon: 'app' });
  });
  test.afterAll(async () => { if (db) { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, khoa); } });

  test('1. Chủ trì (A3) điền vướng mắc ở Cập nhật nhanh → DB + tin hệ thống một lần (người giao, không A0)', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await moViec(p, V.id, V.ma);
      await p.locator(`#klChiTiet-${V.id} [data-action="openKlCapNhat"]`).click();
      await p.locator('#klCnVuongMac').fill(VM);
      await p.locator('#klCnLuu').click();
      await expect(p.locator('#toastContainer')).toContainText(`Đã cập nhật ${V.ma}`, NAP);
    });
    expect((await db.from('nhiem_vu').select('vuong_mac').eq('id', V.id).single()).data.vuong_mac).toBe(VM);
    const tin = (await db.from('direct_messages').select('receiver_id').eq('nhiem_vu_id', V.id).like('content', 'Vướng mắc%')).data.map((x) => x.receiver_id);
    expect(tin).toContain(ID.e2eTp);
    expect(tin).not.toContain(ID.a0); expect(tin).not.toContain(ID.e2eCv);
    expect(new Set(tin).size).toBe(tin.length);   // mỗi người một tin
  });

  test('2. Chánh VP: thẻ Đỏ có trường thứ 5 "Vướng mắc", dải Cần xử lý ngay, Báo cáo; xoá trống tại ngăn chi tiết thì biến mất', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'A1', testInfo, async (p) => {
      await nav(p, 'navDieuHanh');
      const the = p.locator(`#the-${V.id}`);
      await expect(the.locator('[data-truong="vuong-mac"]')).toContainText(VM, NAP);
      await expect(p.locator('#canXuLy [data-muc="vuongmac"]')).toBeVisible(NAP);
      await nav(p, 'navBaoCao');
      await expect(p.locator('#bcCanQuyet')).toContainText(V.ma, NAP);
      await moViec(p, V.id, V.ma);
      const ngan = p.locator(`#klChiTiet-${V.id}`);
      await expect(ngan.locator('[data-truong="vuong-mac"]')).toContainText(VM);
      await ngan.getByRole('button', { name: 'Sửa vướng mắc' }).click();
      await ngan.locator('textarea[name="vuong_mac"]').fill('');
      await ngan.locator(`#oVm-${V.id}`).getByRole('button', { name: 'Lưu' }).click();
      await expect(p.locator('#toastContainer')).toContainText('đã giải quyết', NAP);
      await nav(p, 'navDieuHanh');
      await expect(p.locator(`#the-${V.id}`)).toBeVisible(NAP);
      await expect(p.locator(`#the-${V.id} [data-truong="vuong-mac"]`)).toHaveCount(0);
      await nav(p, 'navBaoCao');
      await expect(p.locator('#bcCanQuyet')).not.toContainText(V.ma, NAP);
    });
    expect((await db.from('nhiem_vu').select('vuong_mac').eq('id', V.id).single()).data.vuong_mac).toBeNull();
  });
});
