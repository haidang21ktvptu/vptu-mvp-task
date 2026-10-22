// PR-2a C3: biểu mẫu Giao việc theo phạm vi giao của DB (kl_pham_vi_giao = cùng hàm giao_viec dùng để chặn) — ma trận vai × 7 loại văn bản.
// Vai: PCVP2 kiêm nhiệm (Tổng hợp, Kinh tế tổng hợp, Tài chính — phân công tạm do spec tạo), PCVP phụ trách cả Tổng hợp, Chánh VP, Trưởng phòng.
// Mỗi vai MỘT phiên; đổi 7 loại ngay trên biểu mẫu để kiểm ô ngành/lĩnh vực bắt buộc, lựa chọn Owner / ngành, lĩnh vực tự xác định và dòng "Còn
// thiếu"; chỉ bấm Giao thật ở ô đại diện (mỗi vai ≥ 1 ô được; ô bị chặn = không có lựa chọn / nút mờ kèm lý do). Chỉ máy tính (logic, không bố cục).
// v3.29 (chủ dự án 22/10/2026): bỏ ô Lĩnh vực — lĩnh vực tự xác định trong phạm vi kiêm nhiệm (ô ẩn #klThLinhVuc): ô Lĩnh vực chi tiết ghi tên một
// lĩnh vực ngoài phạm vi cũng không đưa việc vào lĩnh vực đó.
// v3.26 (0116): mọi vai ở đây (không phải Thường trực) bắt buộc ngành + lĩnh vực với MỌI loại văn bản; loại không phải kết luận / thông báo có thêm
// lựa chọn "Không thuộc" (ô "Còn thiếu" ghi 'ngành (hoặc "Không thuộc")'); ô mục tiêu then chốt chọn "Không thuộc" bằng chonPhanLoai.
// Dữ liệu: văn bản so_ket_luan = E2E-TEST-GVKN-<project>-<vai>; phân công ly_do = khoá; tự dọn trước và sau.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { contextAs, moGiaoViec, chonPhanLoai, NAP } from './lib/app.js';
import { khoaRieng, donVanBan } from './lib/du-lieu.mjs';

const LOAI = ['KL_BTV', 'TB_THUONG_TRUC', 'KL_BCH', 'NQ_BCH', 'NQ_TW', 'CONG_VAN', 'KHAC'];   // 0087: + KL / NQ Ban Chấp hành
const BAT_BUOC = new Set(['KL_BTV', 'TB_THUONG_TRUC']);
const KN = { phong: 'TONG_HOP', nganh: 'KINH_TE_TONG_HOP', lv: 'LV08_TAI_CHINH', lvKhac: 'LV08_NGAN_SACH' };
let db; let khoa; const id = {};
const soKL = (vai) => `${khoa}-${vai}`;

async function moTrang(browser, role, testInfo) {
  const page = await (await contextAs(browser, role, testInfo)).newPage();
  await page.goto('./');
  await expect(page.locator('#mainHeader')).toBeVisible(NAP);
  await moGiaoViec(page);
  return page;
}
const giaTri = (page, sel) => page.locator(`${sel} option`).evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
const conThieu = (page) => page.locator('#gvConThieu');
const lv = (page) => page.locator('#klThLinhVuc');
// Ghi ô Lĩnh vực chi tiết rồi kiểm lĩnh vực tự xác định; xoá ô sau khi kiểm (các bước sau không mang theo).
async function quaChiTiet(page, chu, kiem) { await page.locator('#klThLvct').fill(chu); await kiem(expect(lv(page))); await page.locator('#klThLvct').fill(''); }
// Ngành trống: "Còn thiếu" có mục ngành/lĩnh vực (kết luận / thông báo không có "Không thuộc") — v3.29 không còn mục "lĩnh vực" riêng.
async function thieuNganh(page, loai) {
  if (!BAT_BUOC.has(loai)) { await expect(conThieu(page)).toContainText('ngành/lĩnh vực (hoặc "Không thuộc")'); return; }
  await expect(conThieu(page)).toContainText('ngành/lĩnh vực'); await expect(conThieu(page)).not.toContainText('ngành/lĩnh vực (hoặc');
}
async function chonLoai(page, loai) {
  await page.locator('#klThVanBan').selectOption('__moi__');
  await page.locator('#klThLoaiVB').selectOption(loai);
  await expect(page.locator('#klThNganhBatBuoc')).toBeVisible();   // v3.26: bắt buộc với mọi loại (vai không phải Thường trực)
  await expect(page.locator('#klThSoHNWrap')).toBeVisible({ visible: ['KL_BTV', 'KL_BCH', 'NQ_BCH'].includes(loai) });   // 0087: KL / NQ BCH hiện, không bắt buộc
  await expect(page.locator('#klThSoHNBatBuoc')).toBeVisible({ visible: loai === 'KL_BTV' });
}
// Điền đủ phần chung rồi Giao; trả về việc vừa tạo (đọc bằng service_role theo văn bản).
async function giaoThat(page, vai, loai, { owner, nganh, lv }) {
  await chonLoai(page, loai);
  await page.locator('#klThSoKL').fill(soKL(vai));
  await page.locator('#klThNgayBH').fill('2026-09-01');
  if (loai === 'KL_BTV') await page.locator('#klThSoHN').fill('9');
  await page.locator('#klThNoiDung').fill(`${soKL(vai)} ${loai}`);
  await page.locator('#klThOwner').selectOption(owner);
  if (nganh) await page.locator('#klThNganh').selectOption(nganh);
  if (lv) await expect(page.locator('#klThLinhVuc')).toHaveValue(lv);   // v3.29: tự xác định (không còn ô chọn)
  await page.locator('#klThSanPham').selectOption('BAO_CAO');
  await page.locator('#klThHan').fill('2026-12-31');
  await chonPhanLoai(page);   // v3.26: ngành trống → "Không thuộc"; mục tiêu → "Không thuộc"
  await expect(conThieu(page)).toHaveText('');
  await expect(page.locator('#klThLuu')).toBeEnabled();
  await page.locator('#klThLuu').click();
  await expect(page.locator('#nganCT .chi-tiet-noi')).toBeVisible(NAP);   // v9 đợt 2: giao xong ở lại Giao việc, việc vừa giao mở trong ngăn chi tiết
  await expect(page.locator('#viewGiaoViec')).toBeVisible();
  const { data } = await db.from('nhiem_vu').select('id, owner_don_vi_ma, linh_vuc_ma, van_ban_giao_viec!inner(so_ket_luan, loai)').eq('van_ban_giao_viec.so_ket_luan', soKL(vai));
  expect(data).toHaveLength(1);
  expect(data[0].van_ban_giao_viec.loai).toBe(loai);
  return data[0];
}

test.describe.serial('Giao việc theo phạm vi kiêm nhiệm (C3) — vai × loại văn bản', () => {
  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    khoa = khoaRieng('GVKN', testInfo);
    const tk = await db.from('accounts').select('id, username').in('username', ['demo_pcvp2', 'demo_cv1', 'demo_cv2']);
    tk.data.forEach((a) => { id[a.username] = a.id; });
    for (const v of ['PCVP2', 'PCVP', 'A1', 'A2']) await donVanBan(db, soKL(v));
    await db.from('phu_trach_phong').delete().eq('ly_do', khoa);
    const r = await db.from('phu_trach_phong').insert({ lanh_dao_id: id.demo_pcvp2, phong: KN.phong, nganh_ma: KN.nganh, linh_vuc_ma: KN.lv, tu_ngay: '2026-09-01', ly_do: khoa });
    if (r.error) throw new Error(`Tạo kiêm nhiệm tạm: ${r.error.message}`);
  });
  test.afterAll(async () => {
    if (!db) return;
    for (const v of ['PCVP2', 'PCVP', 'A1', 'A2']) await donVanBan(db, soKL(v));
    await db.from('phu_trach_phong').delete().eq('ly_do', khoa);
  });

  test('PCVP2 kiêm nhiệm: ở Tổng hợp chỉ có ngành kiêm nhiệm, lĩnh vực tự là lĩnh vực kiêm nhiệm (lĩnh vực chi tiết khác không đổi được); mọi loại phải có ngành; giao KL_BTV → đúng lĩnh vực', async ({ browser }, testInfo) => {
    const page = await moTrang(browser, 'PCVP2', testInfo);
    const owner = await giaTri(page, '#klThOwner');
    expect(owner).toEqual(expect.arrayContaining(['dv:TONG_HOP', 'dv:QUAN_TRI']));
    expect(owner).not.toContain('dv:VAN_PHONG_TINH_UY');   // Owner không thuộc phòng nào: PCVP không giao
    for (const loai of LOAI) {
      await chonLoai(page, loai);
      await page.locator('#klThOwner').selectOption('dv:TONG_HOP');
      expect(await giaTri(page, '#klThNganh')).toEqual([KN.nganh]);
      await page.locator('#klThNganh').selectOption(KN.nganh);
      await expect(lv(page)).toHaveValue(KN.lv);
      await quaChiTiet(page, 'Ngân sách', (e) => e.toHaveValue(KN.lv));   // lĩnh vực chi tiết ngoài phạm vi kiêm nhiệm: vẫn lĩnh vực kiêm nhiệm
      await expect(page.locator('#gvPhamViGhiChu')).toContainText('chỉ giao được lĩnh vực đang kiêm nhiệm: Tài chính');
      await expect(conThieu(page)).not.toContainText('ngành/lĩnh vực');
      await page.locator('#klThNganh').selectOption('');
      await expect(lv(page)).toHaveValue('');
      await thieuNganh(page, loai);
      await expect(conThieu(page)).toContainText('ngành/lĩnh vực trong phạm vi đồng chí kiêm nhiệm ở Phòng Tổng hợp');
      await expect(page.locator('#klThLuu')).toBeDisabled();
    }
    const v = await giaoThat(page, 'PCVP2', 'KL_BTV', { owner: 'dv:TONG_HOP', nganh: KN.nganh, lv: KN.lv });
    expect([v.owner_don_vi_ma, v.linh_vuc_ma]).toEqual(['TONG_HOP', KN.lv]);
    await page.context().close();
  });

  test('PCVP phụ trách cả Tổng hợp: lĩnh vực PCVP2 kiêm nhiệm không bao giờ được tự chọn (kể cả lĩnh vực chi tiết ghi đúng tên); phòng không phụ trách không có; giao Công văn "Không thuộc" → được', async ({ browser }, testInfo) => {
    const page = await moTrang(browser, 'PCVP', testInfo);
    const owner = await giaTri(page, '#klThOwner');
    expect(owner).toContain('dv:TONG_HOP');
    expect(owner).not.toContain('dv:QUAN_TRI');
    for (const loai of LOAI) {
      await chonLoai(page, loai);
      await page.locator('#klThOwner').selectOption('dv:TONG_HOP');
      await page.locator('#klThNganh').selectOption(KN.nganh);
      await expect(lv(page)).not.toHaveValue('');
      await quaChiTiet(page, 'Tài chính', (e) => e.not.toHaveValue(KN.lv));
      await quaChiTiet(page, 'Ngân sách', (e) => e.toHaveValue(KN.lvKhac));
      await expect(page.locator('#gvPhamViGhiChu')).toContainText('do lãnh đạo khác kiêm nhiệm');
      await page.locator('#klThNganh').selectOption('');
      await thieuNganh(page, loai);   // v3.26: bắt buộc mọi loại
    }
    const v = await giaoThat(page, 'PCVP', 'CONG_VAN', { owner: 'dv:TONG_HOP' });
    expect([v.owner_don_vi_ma, v.linh_vuc_ma]).toEqual(['TONG_HOP', 'LV99_KHONG_THUOC']);   // v3.26: Công văn không thuộc ngành nào → "Không thuộc"
    await page.context().close();
  });

  test('Chánh VP: mọi phòng, cả Văn phòng Tỉnh ủy, đủ lĩnh vực (theo lĩnh vực chi tiết); thiếu ngành → nút mờ; giao Nghị quyết TW cho phòng Quản trị "Không thuộc" → được', async ({ browser }, testInfo) => {
    const page = await moTrang(browser, 'A1', testInfo);
    expect(await giaTri(page, '#klThOwner')).toEqual(expect.arrayContaining(['dv:TONG_HOP', 'dv:QUAN_TRI', 'dv:VAN_PHONG_TINH_UY']));
    for (const loai of LOAI) {
      await chonLoai(page, loai);
      await page.locator('#klThOwner').selectOption('dv:TONG_HOP');
      await page.locator('#klThNganh').selectOption(KN.nganh);
      await quaChiTiet(page, 'Tài chính', (e) => e.toHaveValue(KN.lv));   // Chánh VP: mọi lĩnh vực
      await quaChiTiet(page, 'Ngân sách', (e) => e.toHaveValue(KN.lvKhac));
      await page.locator('#klThNganh').selectOption('');
      await thieuNganh(page, loai);   // v3.26: bắt buộc mọi loại
      await expect(page.locator('#klThLuu')).toBeDisabled();
    }
    const v = await giaoThat(page, 'A1', 'NQ_TW', { owner: 'dv:QUAN_TRI' });
    expect(v.owner_don_vi_ma).toBe('QUAN_TRI');
    await page.context().close();
  });

  test('Trưởng phòng: chỉ chuyên viên phòng mình (không có đơn vị, không có chuyên viên phòng khác); giao Văn bản khác → được', async ({ browser }, testInfo) => {
    const page = await moTrang(browser, 'A2', testInfo);
    const owner = await giaTri(page, '#klThOwner');
    expect(owner).toContain(`tk:${id.demo_cv1}`);
    expect(owner).not.toContain(`tk:${id.demo_cv2}`);
    expect(owner.filter((o) => o.startsWith('dv:'))).toEqual([]);
    for (const loai of LOAI) {
      await chonLoai(page, loai);
      await page.locator('#klThOwner').selectOption(`tk:${id.demo_cv1}`);
      await thieuNganh(page, loai);   // v3.26
    }
    const v = await giaoThat(page, 'A2', 'KHAC', { owner: `tk:${id.demo_cv1}` });
    expect(v.owner_don_vi_ma).toBe('TONG_HOP');
    await page.context().close();
  });
});
