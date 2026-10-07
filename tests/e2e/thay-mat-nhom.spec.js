// Đợt B v3.18 (0079–0082): thay mặt theo NHÓM trên biểu mẫu Giao việc và luồng duyệt từ chối theo nhóm. demo_qtht (A3, cờ quan_tri_kl tạm) giao
// (1) thay mặt "Lãnh đạo Văn phòng" cho chuyên viên → DB ghi nhóm + đại diện Chánh VP; (2) thay mặt "Thường trực Tỉnh ủy" cho phòng → như Thường
// trực giao (không ô người theo dõi, Khẩn mặc định, Owner chỉ lãnh đạo VP / phòng; DB: uu_tien THUONG_TRUC, theo dõi = Trưởng phòng). Ô Chịu trách
// nhiệm không còn nhóm "Đơn vị ngoài Văn phòng". Rồi chuyên viên đề nghị từ chối việc (1) → thẻ ghi "chờ Lãnh đạo Văn phòng duyệt"; Phó Chánh VP
// (thành viên nhóm, không phải cấp duyệt ghi trên đề nghị) thấy và Đồng ý. Một phiên mỗi lúc; dữ liệu theo khoá, cờ khôi phục.
import { existsSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { NAP, moGiaoViec, pageAs, contextAs, nav } from './lib/app.js';
import { OPTIONAL_USERS, sessionPath } from './lib/roles.mjs';
import { khoaRieng, donVanBan, donNhiemVuTheoNoiDung } from './lib/du-lieu.mjs';
import { ID, dbAdmin, homNay, cong, datCo, voiPhien } from './lib/pr2b.mjs';

const QTHT = '00000000-0000-4000-8000-000000000008';
const H = cong(homNay(), 20);
let db; let khoa; let nvLdvp;

async function vanBanMoi(page, so) {
  await page.locator('#klThVanBan').selectOption('__moi__'); await page.locator('#klThLoaiVB').selectOption('CONG_VAN');
  await page.locator('#klThSoKL').fill(so); await page.locator('#klThNgayBH').fill(cong(homNay(), -1));
}
const giaTri = (loc) => loc.evaluateAll((os) => os.map((x) => x.value).filter(Boolean));
// Tài khoản ngoài bộ chuẩn (OPTIONAL_USERS — demo_pcvp, demo_qtht): mở phiên đã lưu, chờ tên ở đầu trang; lãnh đạo vào Tổng quan → mở "Cần xử lý".
async function moTuyChon(browser, role, testInfo) {
  const page = await (await contextAs(browser, role, testInfo)).newPage(); await page.goto('./');
  await expect(page.locator('#currentUserDisplay')).toContainText(OPTIONAL_USERS[role].fullName, NAP);
  await nav(page, 'navDieuHanh'); await expect(page.locator('#viewDieuHanh')).toBeVisible();
  return page;
}

test.describe.serial('Thay mặt theo nhóm — Lãnh đạo Văn phòng / Thường trực Tỉnh ủy (v3.18)', () => {
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    db = dbAdmin(); khoa = khoaRieng('TMN', testInfo);
    const co = await db.from('nhiem_vu').select('giao_thay_mat_nhom').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0079.');
    test.skip(!existsSync(sessionPath('QTHT')) || !existsSync(sessionPath('PCVP')), 'Project chưa có demo_qtht / demo_pcvp (seed).');
    await donNhiemVuTheoNoiDung(db, khoa); await datCo(db, QTHT, { quan_tri_kl: true });
  });
  test.afterAll(async () => {
    if (!db) return;
    await donNhiemVuTheoNoiDung(db, khoa);
    for (const s of ['LDVP', 'TT']) await donVanBan(db, `${khoa}-${s}`);
    await datCo(db, QTHT, { quan_tri_kl: false });
  });

  test('1. Quản trị KL giao thay mặt Lãnh đạo Văn phòng (nhóm) và thay mặt Thường trực; Owner không còn đơn vị ngoài', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    await voiPhien(browser, 'QTHT', testInfo, async (page) => {
      await moGiaoViec(page);
      await expect(page.locator('#klThThayMatWrap')).toBeVisible();
      const tm = await giaTri(page.locator('#klThThayMat option'));
      expect(tm.slice(0, 2)).toEqual(['nhom:LANH_DAO_VP', 'nhom:THUONG_TRUC']);
      expect(await page.locator('#klThThayMat optgroup').evaluateAll((gs) => gs.map((g) => g.label))).toEqual(['Nhóm lãnh đạo', 'Từng lãnh đạo']);
      // (1) Lãnh đạo Văn phòng → phạm vi Chánh VP: chuyên viên Tổng hợp chọn được; vẫn có người theo dõi; không có đơn vị ngoài
      await page.locator('#klThThayMat').selectOption('nhom:LANH_DAO_VP'); await expect(page.locator('#gvKhoa')).toBeEnabled(NAP);
      const nhomOwner = await page.locator('#klThOwner optgroup').evaluateAll((gs) => gs.map((g) => g.label));
      expect(nhomOwner).not.toContain('Đơn vị ngoài Văn phòng');
      expect(await giaTri(page.locator('#klThOwner option'))).not.toContain('dv:DANG_UY_UBND');
      await expect(page.locator('#klThNguoiTheoDoiWrap')).toBeVisible();
      await vanBanMoi(page, `${khoa}-LDVP`);
      await page.locator('#klThNoiDung').fill(`${khoa} LDVP`); await page.locator('#klThOwner').selectOption(`tk:${ID.cv1}`);
      await page.locator('#klThSanPham').selectOption('BAO_CAO'); await page.locator('#klThHan').fill(H);
      await expect(page.locator('#gvConThieu')).toHaveText('', NAP);
      await page.locator('#klThLuu').click();
      await expect(page.locator('#toastContainer')).toContainText('Đã giao việc NV-', NAP);
      await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);   // biểu mẫu mở lại sạch
      // (2) Thường trực Tỉnh ủy → như Thường trực giao
      await page.locator('#klThThayMat').selectOption('nhom:THUONG_TRUC'); await expect(page.locator('#gvKhoa')).toBeEnabled(NAP);
      await expect(page.locator('#klThNguoiTheoDoiWrap')).toBeHidden();
      await expect(page.locator('#klThDoKhan')).toHaveValue('KHAN');
      const owner = await giaTri(page.locator('#klThOwner option'));
      expect(owner).toContain('dv:TONG_HOP'); expect(owner).toContain(`tk:${ID.cvp}`); expect(owner).not.toContain(`tk:${ID.cv1}`); expect(owner).not.toContain('dv:VAN_PHONG_TINH_UY');
      await vanBanMoi(page, `${khoa}-TT`);
      await page.locator('#klThNoiDung').fill(`${khoa} TT`); await page.locator('#klThOwner').selectOption('dv:TONG_HOP');
      await page.locator('#klThSanPham').selectOption('TO_TRINH'); await page.locator('#klThHan').fill(H);
      await expect(page.locator('#gvConThieu')).toHaveText('', NAP);
      await page.locator('#klThLuu').click();
      await expect(page.locator('#toastContainer')).toContainText('Chánh Văn phòng có thông báo', NAP);
    });
    const { data } = await db.from('nhiem_vu').select('noi_dung, giao_thay_mat_nhom, giao_thay_mat_cho, uu_tien, nguoi_theo_doi, owner_tai_khoan, owner_don_vi_ma, do_khan, id')
      .like('noi_dung', `${khoa} %`).order('noi_dung');
    const ldvp = data.find((x) => x.noi_dung.endsWith(' LDVP')); const tt = data.find((x) => x.noi_dung.endsWith(' TT'));
    nvLdvp = ldvp.id;
    expect([ldvp.giao_thay_mat_nhom, ldvp.giao_thay_mat_cho, ldvp.uu_tien, ldvp.owner_tai_khoan, ldvp.do_khan]).toEqual(['LANH_DAO_VP', ID.cvp, null, ID.cv1, 'THUONG']);
    expect([tt.giao_thay_mat_nhom, tt.giao_thay_mat_cho, tt.uu_tien, tt.nguoi_theo_doi, tt.owner_don_vi_ma, tt.do_khan]).toEqual(['THUONG_TRUC', ID.a0, 'THUONG_TRUC', ID.tp, 'TONG_HOP', 'KHAN']);
    const { data: tin } = await db.from('direct_messages').select('receiver_id').eq('nhiem_vu_id', ldvp.id).eq('loai', 'he_thong');
    for (const u of [ID.cvp, ID.pcvp, ID.pcvp2]) expect(tin.map((t) => t.receiver_id), `tin giao tới ${u}`).toContain(u);
  });

  test('2. Chuyên viên đề nghị từ chối việc thay mặt nhóm → thẻ ghi chờ Lãnh đạo Văn phòng duyệt', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A3', testInfo);
    const the = page.locator(`#vctMuc-moi #vct-${nvLdvp}`);
    await expect(the).toBeVisible(NAP);
    await expect(the).toContainText('Thay mặt Lãnh đạo Văn phòng giao');
    await the.getByRole('button', { name: 'Từ chối' }).click();
    const o = page.locator(`#oTc-${nvLdvp}`);
    await o.locator('input[name=noi_dung]').fill('Không đúng chức năng (e2e thay mặt nhóm)');
    await o.getByRole('button', { name: 'Gửi đề nghị' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã gửi đề nghị từ chối', NAP);
    await expect(page.locator(`#vct-${nvLdvp}`)).toContainText('chờ Lãnh đạo Văn phòng duyệt', NAP);
    await page.context().close();
  });

  test('3. Phó Chánh VP (thành viên nhóm, không phải cấp duyệt ghi trên đề nghị) thấy và Đồng ý từ chối', async ({ browser }, testInfo) => {
    const { data: tc } = await db.from('tu_choi').select('id, cap_duyet').eq('nhiem_vu_id', nvLdvp).eq('trang_thai', 'CHO_DUYET').single();
    expect(tc.cap_duyet).toBe(ID.cvp);
    const page = await moTuyChon(browser, 'PCVP', testInfo);
    const de = page.locator(`#tc-${tc.id}`);
    await expect(de).toBeVisible(NAP);
    await expect(page.locator(`#btc-${nvLdvp}`)).toContainText('chờ Lãnh đạo Văn phòng duyệt');
    await de.getByRole('button', { name: 'Đồng ý từ chối' }).click();
    await expect(page.locator('#toastContainer')).toContainText('Đã đồng ý từ chối', NAP);
    await expect(page.locator(`#btc-${nvLdvp}`)).toHaveAttribute('data-tu-choi', 'da', NAP);
    await page.context().close();
    const { data: sau } = await db.from('tu_choi').select('trang_thai, cap_duyet').eq('id', tc.id).single();
    expect(sau).toEqual({ trang_thai: 'DONG_Y', cap_duyet: ID.cvp });   // cấp duyệt ghi người đại diện; PCVP duyệt thay nhóm (kl_duoc_duyet_thay)
  });
});
