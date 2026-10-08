// Đợt E v3.18 (0085): chuyên viên chủ trì văn bản gốc X nhập từng nhiệm vụ trên văn bản và giao thẳng cho chuyên viên khác / chính mình — không ô
// Thay mặt, không ô Người theo dõi (theo dõi = người giao); cấu hình xac_nhan_nhan_viec = 2 (đặt tạm bằng service_role, khôi phục) → việc coi như đã
// nhận ngay khi giao. demo_e2e_cv (A3, phòng E2E_RT) giao 2 việc một lượt (thẻ 1 cho demo_e2e_nv phòng Tổng hợp — khác phòng; thẻ 2 cho chính mình)
// → việc 1 ở "Việc tôi theo dõi", việc 2 ở "Việc của tôi"; demo_e2e_nv (không bị spec nào đăng xuất — bo-cuc đăng xuất demo_e2e_kl) thấy việc 1 ở "Việc của tôi" mục đang làm (không chờ xác nhận, không nút
// Xác nhận), có tin giao, menu có Giao việc (Đợt D: không còn Cần nghiệm thu). Một phiên mỗi lúc; dữ liệu theo khoá; tự dọn.
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec, nav } from './lib/app.js';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, voiPhien } from './lib/pr2b.mjs';

const H = cong(homNay(), 20);
let db; let khoa; let cauHinhCu = '1'; let viec = [];
const the = (p, i) => p.locator(`#gvLuoiThan .gv-nv[data-dong="${i}"]`);
const o = (p, i, cot) => the(p, i).locator(`[data-cot="${cot}"]`);
const datCauHinh = (v) => db.from('kl_cau_hinh').update({ gia_tri: v }).eq('khoa', 'xac_nhan_nhan_viec');

test.describe.serial('Chuyên viên nhập nhiệm vụ từ văn bản gốc và giao thẳng (v3.18 Đợt E)', () => {
  test.describe.configure({ timeout: 150_000 });
  const don = async () => { await donNhiemVuTheoNoiDung(db, khoa); await donVanBan(db, `${khoa}-X`); };
  test.beforeAll(async () => {
    db = dbAdmin(); khoa = khoaRieng('CVG', test.info());
    const ch = await db.from('kl_cau_hinh').select('gia_tri').eq('khoa', 'xac_nhan_nhan_viec').maybeSingle();
    test.skip(!ch.data, 'Project chưa có migration 0085.');
    cauHinhCu = ch.data.gia_tri;
    const r = await datCauHinh('2'); if (r.error) throw new Error(`Đặt cấu hình thất bại: ${r.error.message}`);
    await don();
  });
  test.afterAll(async () => { if (!db) return; await don(); await datCauHinh(cauHinhCu); });

  test('1. demo_e2e_cv: menu có Giao việc; biểu mẫu không ô Thay mặt / Người theo dõi, Owner chỉ chuyên viên; giao 2 việc một lượt từ văn bản X → DB: theo dõi = người giao, đã nhận tự động, tin tới Owner', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await expect(p.locator('#navGiaoViec')).toHaveCount(1); await expect(p.locator('#navNghiemThu')).toHaveCount(0);   // Đợt D: bỏ mục Cần nghiệm thu
      await moGiaoViec(p);
      await expect(p.locator('#klThThayMatWrap')).toBeHidden(); await expect(p.locator('#klThNguoiTheoDoiWrap')).toBeHidden();
      expect(await p.locator('#klThOwner optgroup').evaluateAll((gs) => gs.map((g) => g.label))).toEqual(['Chuyên viên']);
      const owner = await p.locator('#klThOwner option').evaluateAll((os) => os.map((x) => x.value).filter(Boolean));
      expect(owner[0]).toBe(`tk:${ID.e2eCv}`);   // chính tôi đứng đầu
      expect(owner).toContain(`tk:${ID.e2eNv}`); expect(owner.some((v) => v.startsWith('dv:'))).toBe(false); expect(owner).not.toContain(`tk:${ID.e2eTp}`);
      await expect(p.locator('#gvBuoc1')).toContainText('không cần xác nhận');
      await p.locator('#klThVanBan').selectOption('__moi__'); await p.locator('#klThLoaiVB').selectOption('CONG_VAN');
      await p.locator('#klThSoKL').fill(`${khoa}-X`); await p.locator('#klThNgayBH').fill(cong(homNay(), -1));
      await p.locator('#klThNoiDung').fill(`${khoa} việc 1 giao chuyên viên Tổng hợp`); await p.locator('#klThOwner').selectOption(`tk:${ID.e2eNv}`);
      await p.locator('#klThSanPham').selectOption('BAO_CAO'); await p.locator('#klThHan').fill(cong(H, 1));
      await expect(p.locator('#klThCapNhan')).toHaveValue('TRUONG_PHONG');
      await p.locator('#gvThemDong').click();
      await expect(the(p, 2).locator('[data-wrap="theo_doi"]')).toBeHidden();
      await o(p, 2, 'noi_dung').fill(`${khoa} việc 2 tự làm`); await o(p, 2, 'owner').selectOption(`tk:${ID.e2eCv}`);
      await o(p, 2, 'san_pham').selectOption('TO_TRINH'); await o(p, 2, 'han').fill(cong(H, 2));
      await expect(p.locator('#gvConThieu')).toHaveText('', NAP); await expect(p.locator('#klThLuu')).toHaveText('Giao 2 việc'); await expect(p.locator('#klThLuu')).toBeEnabled();
      await p.locator('#klThLuu').click();
      await expect(p.locator('#toastContainer')).toContainText('Đã giao 2 việc', NAP);
      await p.locator('#nganCTDong').click(); await expect(p.locator('#nganCT')).toBeHidden();
    });
    const { data } = await db.from('nhiem_vu').select('id, noi_dung, owner_tai_khoan, nguoi_theo_doi, tao_boi, giao_thay_mat_cho, van_ban_id').like('noi_dung', `${khoa} việc%`).order('noi_dung');
    viec = data; expect(data.length).toBe(2);
    expect(data.map((x) => [x.owner_tai_khoan, x.nguoi_theo_doi, x.tao_boi, x.giao_thay_mat_cho])).toEqual([[ID.e2eNv, ID.e2eCv, ID.e2eCv, null], [ID.e2eCv, ID.e2eCv, ID.e2eCv, null]]);
    expect(new Set(data.map((x) => x.van_ban_id)).size).toBe(1);
    const { data: ls } = await db.from('lich_su').select('nhiem_vu_id, nguoi_sua').eq('cot', 'xac_nhan_nhan_viec').in('nhiem_vu_id', data.map((x) => x.id));
    expect(ls.filter((l) => l.nhiem_vu_id === data[0].id).map((l) => l.nguoi_sua).sort()).toEqual([ID.e2eCv, ID.e2eNv].sort());   // Owner + theo dõi tự nhận
    expect(ls.filter((l) => l.nhiem_vu_id === data[1].id).map((l) => l.nguoi_sua)).toEqual([ID.e2eCv]);
    const { data: tin } = await db.from('direct_messages').select('receiver_id').eq('nhiem_vu_id', data[0].id).eq('loai', 'he_thong');
    expect(tin.map((t) => t.receiver_id)).toContain(ID.e2eNv);
  });

  test('2. demo_e2e_cv: việc 1 ở "Việc tôi theo dõi" (có Giao tiếp xuống), việc 2 ở "Việc của tôi" — không chờ xác nhận', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_CV', testInfo, async (p) => {
      await expect(p.locator(`#vct-${viec[1].id}`)).toBeVisible(NAP);
      await expect(p.locator(`#vctMuc-moi #vct-${viec[1].id}`)).toHaveCount(0);
      await nav(p, 'navTheoDoi');
      await expect(p.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
      const row = p.locator(`#klRow-${viec[0].id}`); await expect(row).toBeVisible(NAP); await row.click();
      await expect(p.locator(`#klChiTiet-${viec[0].id}`)).toBeVisible(NAP);
      await expect(p.locator(`#klChiTiet-${viec[0].id}`)).toContainText('đã nhận việc');
      await expect(p.locator(`#klGiaoTiep-${viec[0].id}`)).toBeVisible();
      await expect(p.locator(`#klRow-${viec[1].id}`)).toHaveCount(0);   // việc tự làm không ở "theo dõi (không phải Owner)"
    });
  });

  test('3. demo_e2e_nv (Owner, phòng khác): việc ở "Việc của tôi" mục đang làm, không nút Xác nhận, có tin giao', async ({ browser }, testInfo) => {
    await voiPhien(browser, 'E2E_NV', testInfo, async (p) => {
      const the1 = p.locator(`#vct-${viec[0].id}`);
      await expect(the1).toBeVisible(NAP);
      await expect(p.locator(`#vctMuc-moi #vct-${viec[0].id}`)).toHaveCount(0);
      await expect(the1.getByRole('button', { name: 'Xác nhận đã nhận' })).toHaveCount(0);
      await expect(the1.getByRole('button', { name: 'Từ chối' })).toHaveCount(0);
      await expect(p.locator('#navGiaoViec')).toHaveCount(1);
    });
  });
});
