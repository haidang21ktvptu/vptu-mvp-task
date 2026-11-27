// v3.36 (Đợt 1, phần 4 — CAU-HOI V-1): menu bốn nhóm thu gọn được (lãnh đạo mặc định thu nhóm Nhiệm vụ quý BTV; lựa chọn nhớ theo máy; mở chức năng
// nằm trong nhóm đang thu thì nhóm tự mở); Cần xử lý bỏ dải ô số trùng Tổng quan, nội dung việc trong thẻ tối đa hai dòng; "In báo cáo nhanh" từ Tổng
// quan: bản in có phần đầu theo thể thức Văn phòng, chỉ tầng 1, ma trận đơn vị và 5 điểm nghẽn. Cần xử lý hiện các dòng đầu (V-13). Chỉ đọc — không tạo
// dữ liệu.
import { test, expect } from '@playwright/test';
import { pageAs, nav, NAP } from './lib/app.js';

const nhomQuy = (page) => page.locator('#mainNav .menu-nhom', { hasText: 'Nhiệm vụ quý BTV' });

test('A1: menu bốn nhóm; Nhiệm vụ quý BTV mặc định thu, bấm để mở, nhớ sau khi tải lại; mở mục của nhóm đang thu thì nhóm tự mở', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  const ten = await page.locator('#mainNav .menu-nhom').allTextContents();
  expect(ten.map((t) => t.trim()).slice(0, 3)).toEqual(['Điều hành', 'Nhiệm vụ', 'Nhiệm vụ quý BTV']);
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#navNqTongQuan')).toBeHidden();
  await nhomQuy(page).click();
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#navNqTongQuan')).toBeVisible();
  await page.reload();
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(nhomQuy(page), 'lựa chọn mở nhóm nhớ theo máy').toHaveAttribute('aria-expanded', 'true');
  await nhomQuy(page).click();
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'false');
  // Dòng Nhiệm vụ quý của tầng 1 mở Tổng quan quý: nhóm đang thu tự mở để thấy mục đang chọn.
  const moQuy = page.locator('#tqNvq [data-action="openNqTongQuan"]');
  if (await moQuy.count()) {
    await moQuy.click();
    await expect(page.locator('#navNqTongQuan')).toHaveAttribute('aria-selected', 'true', NAP);
    await expect(page.locator('#navNqTongQuan')).toBeVisible();
    await expect(nhomQuy(page)).toHaveAttribute('aria-expanded', 'true');
  }
  await page.context().close();
});

test('A1: Cần xử lý không còn dải ô số; nội dung việc trong thẻ tối đa hai dòng, đủ nguyên văn ở title', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true });
  await nav(page, 'navDieuHanh');
  await expect(page.locator('#dhBaCau .bc-o')).toHaveCount(3, NAP);
  await expect(page.locator('#dhKpi')).toHaveCount(0);
  await expect(page.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
  const gon = page.locator('#viewDieuHanh .nd-gon').first();
  if (await gon.count()) {
    const kieu = await gon.evaluate((el) => ({ clamp: globalThis.getComputedStyle(el).webkitLineClamp, title: el.getAttribute('title') }));
    expect(kieu.clamp).toBe('2');
    expect(kieu.title.length).toBeGreaterThan(0);
  }
  await page.context().close();
});

// v3.36 (CAU-HOI V-13, DESIGN mục 17): Cần xử lý ở trạng thái mặc định của người dùng thật (dsGon) — danh sách việc nghẽn hiện 10 việc đầu, nút "Xem tất
// cả N việc" mở hết và nhớ theo máy; thứ tự xếp ở nút "i"; thanh trái chỉ còn tên và số (lời giải thích ở gợi ý); không còn nhãn mặc định "chưa chỉ đạo".
test('A1: Cần xử lý hiện 10 việc đầu, "Xem tất cả" nhớ theo máy; ghi chú ở nút "i", thanh trái không còn dòng giải thích', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { dsGon: true });
  await expect(page.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
  const the = page.locator('#dsThe .the'); const nut = page.locator('[data-action="dsHet"][data-ds="dhThe"]');
  await expect(page.locator('#dsPhu')).toHaveCount(0);
  await expect(page.locator('#dsTieuDe + .nut-goi')).toHaveAttribute('data-goi', /^Xếp theo mức khẩn/);
  await expect(page.locator('#dhRay button small')).toHaveCount(0);
  for (const b of await page.locator('#dhRay button[data-khau]').all()) await expect(b).toHaveAttribute('data-goi', /.+: .+/);
  await expect(page.locator('#dsThe')).not.toContainText('chưa chỉ đạo');
  if (await the.count() <= 10) {   // phạm vi ít việc nghẽn: không có nút, mọi thẻ hiện
    await expect(nut).toHaveCount(0);
    await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
    await page.context().close();
    return;
  }
  await expect(page.locator('#dsThe .the:not([data-sau])')).toHaveCount(10);
  await expect(the.nth(10)).toBeHidden();
  await expect(nut).toHaveText(/^Xem tất cả \d+ việc$/);
  await expect(nut).toHaveAttribute('aria-expanded', 'false');
  await nut.click();
  await expect(nut).toHaveText('Chỉ hiện 10 việc đầu');
  await expect(nut).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
  await expect(the.nth(10)).toBeVisible();
  await page.reload();
  await expect(page.locator('#mainHeader')).toBeVisible(NAP);
  await nav(page, 'navDieuHanh');
  await expect(nut, 'lựa chọn "Xem tất cả" nhớ theo máy').toHaveText('Chỉ hiện 10 việc đầu', NAP);
  await expect(page.locator('#dsThe .the[data-sau]')).toHaveCount(0);
  await nut.click();
  await expect(nut).toHaveText(/^Xem tất cả \d+ việc$/);
  await expect(page.locator('#dsThe .the:not([data-sau])')).toHaveCount(10);
  await page.context().close();
});

// v3.36 (CAU-HOI V-13, DESIGN mục 11 và 17): màn Nhiệm vụ — phụ đề chỉ còn phạm vi; chú giải ghi ngắn, câu đầy đủ ở gợi ý; bốn nút xuất, in gom sau
// nút "Xuất, in" (bấm ra ngoài thì đóng); mỗi dòng tối đa hai dòng chữ: mã việc đứng đầu khối nội dung, dòng "nhập lúc" chỉ còn ở bản in.
test('A1: Nhiệm vụ — dòng hai dòng chữ, phụ đề ngắn, chú giải có gợi ý, nút xuất và in gom sau "Xuất, in"', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo);
  await nav(page, 'navKl');
  await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
  await expect(page.locator('#klPhuDe')).toHaveText(/^(trong phạm vi của đồng chí|toàn Văn phòng)$/);
  await expect(page.locator('#viewKl .bnv-chu-giai [data-goi]').first()).toHaveAttribute('data-goi', /^Quá hạn từ \d+ ngày trở lên \(mức Đỏ đặc biệt\)$/);
  await expect(page.locator('#viewKl .bnv-chu-giai .nhan-moi')).toHaveCount(0);
  for (const id of ['klXuatExcel', 'klXuatKy', 'klIn']) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.locator('#klXuatMo').click();
  await expect(page.locator('#klXuatMo')).toHaveAttribute('aria-expanded', 'true');
  for (const id of ['klXuatExcel', 'klXuatKy', 'klIn']) await expect(page.locator(`#${id}`)).toBeVisible();
  await page.locator('#klTieuDe').click();   // bấm ra ngoài
  await expect(page.locator('#klXuatMo')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#klIn')).toBeHidden();
  const dong = page.locator('#klBody .hang-nv').first();
  if (await dong.count()) {
    await expect(dong.locator('.bnv-nd .ma')).toBeVisible();
    await expect(dong.locator('.bnv-chi-gon')).toHaveCount(0);
    if (await dong.locator('.bnv-chi-in').count()) await expect(dong.locator('.bnv-chi-in')).toBeHidden();
    expect((await dong.locator('.bnv-c-nv').getAttribute('title')).length, 'nguyên văn nội dung ở title của ô').toBeGreaterThan(0);
    const o = await dong.locator('.bnv-c-nv').evaluate((el) => { const cs = globalThis.getComputedStyle(el.querySelector('.bnv-nd')); return { clamp: cs.webkitLineClamp, cao: el.getBoundingClientRect().height, dong: parseFloat(cs.lineHeight) }; });
    expect(o.clamp).toBe('2');
    expect(o.cao, 'ô Nhiệm vụ: mã, nhãn và nội dung trong hai dòng chữ').toBeLessThanOrEqual(o.dong * 2 + 12);
    await page.emulateMedia({ media: 'print' });
    if (await dong.locator('.bnv-chi-in').count()) await expect(dong.locator('.bnv-chi-in')).toBeVisible();   // bản in vẫn ghi lúc nhập, người nhập
    await page.emulateMedia({ media: 'screen' });
  }
  await page.context().close();
});

// v3.36 (CAU-HOI V-13, DESIGN mục 17): Báo cáo — phụ đề chỉ ghi kỳ và phạm vi (ngày lập chỉ ở bản in); dải số nhãn ngắn, phần giải thích ở gợi ý; ghi chú
// của khối ở nút "i"; "Việc cần lãnh đạo quyết định" hiện 5 dòng đầu, "Theo kết luận, văn bản giao việc" hiện 10 dòng đầu (hàng đang mở rộng không bị
// ẩn); bản in đủ dòng và ghi lại số trong bảng. Cán bộ: ghi chú của màn ở nút "i", dòng số của phòng ghi ngắn, cách tính ở gợi ý. Chỉ đọc; số dòng đọc
// tại chỗ (worker kia có thể thêm việc, realtime vẽ lại) nên chỉ so theo mẫu, không so số tuyệt đối.
test('A1: Báo cáo, Cán bộ — phụ đề ngắn, ghi chú ở nút "i", hai danh sách dài hiện các dòng đầu, bản in đủ dòng và có số', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A1', testInfo, { dsGon: true });
  await nav(page, 'navBaoCao');
  const bc = page.locator('#viewBaoCao');
  await expect(bc.locator('#bcTheoPhong tbody tr.bc-hang').first()).toBeVisible(NAP);
  await expect(bc.locator('#bcKyMoTa')).toHaveText(/^Năm \d{4} \(1\/1\/\d{4} – 31\/12\/\d{4}\) · (toàn Văn phòng Tỉnh ủy|phạm vi phụ trách của đồng chí)$/, { useInnerText: true });
  await expect(bc.locator('#bcKyMoTa .chi-in-dong')).toBeHidden();
  const o = bc.locator('.tq .o-so');
  await expect(o).toHaveCount(7);
  await expect(o.nth(2)).toHaveAttribute('data-goi', /^Còn ≤ \d+ ngày \(mức Vàng\)$/);
  await expect(o.nth(6)).toHaveAttribute('data-goi', /^Nộp minh chứng trước hạn xử lý: \d+ trên \d+ nhiệm vụ được đánh giá/);
  await expect(bc.locator('#bcTheoPhong .bang-ten .nut-goi')).toHaveAttribute('data-goi', /^Tính theo phòng của cán bộ chủ trì theo dõi/);
  await expect(bc.locator('#bcCanQuyet .bang-ten .nut-goi')).toHaveAttribute('data-goi', /^Việc đang mở có vướng mắc/);
  const coNut = {};
  for (const [vung, chon, ten, so, dv] of [['#bcCanQuyet', 'tbody > tr', 'bcCanQuyet', 5, 'việc'], ['#bcTheoVanBan', 'tbody > tr.bc-hang', 'bcVanBan', 10, 'văn bản']]) {
    const dong = bc.locator(`${vung} ${chon}`); const nut = bc.locator(`[data-action="dsHet"][data-ds="${ten}"]`);
    coNut[ten] = await dong.count() > so;
    if (!coNut[ten]) { await expect(nut).toHaveCount(0); continue; }   // ít dòng: không có nút, mọi dòng hiện
    await expect(nut).toHaveText(new RegExp(`^Xem tất cả \\d+ ${dv}$`));
    await expect(dong.nth(so - 1)).toBeVisible();
    await expect(dong.nth(so)).toBeHidden();
    await nut.click();
    await expect(nut).toHaveText(`Chỉ hiện ${so} ${dv} đầu`);
    await expect(dong.nth(so)).toBeVisible();
    if (ten === 'bcVanBan') {   // hàng đang mở rộng (danh sách việc ngay dưới) không bị ẩn khi thu gọn
      await dong.nth(so).locator('td.so button').first().click();
      await expect(bc.locator('#bcTheoVanBan #bcMoRong')).toBeVisible();
      await nut.click();
      await expect(nut).toHaveText(new RegExp(`^Xem tất cả \\d+ ${dv}$`));
      await expect(bc.locator('#bcTheoVanBan tr.bc-hang.dang')).toBeVisible();
      await expect(bc.locator('#bcTheoVanBan #bcMoRong')).toBeVisible();
      await bc.locator('#bcTheoVanBan tr.bc-hang.dang td.so button').first().click();   // gập hàng: trở về đúng các dòng đầu
      await expect(bc.locator('#bcMoRong')).toHaveCount(0);
      await expect(bc.locator('#bcTheoVanBan tbody > tr.bc-hang:not([data-sau])')).toHaveCount(so);
    } else {
      await nut.click();
      await expect(dong.nth(so)).toBeHidden();
    }
  }
  await page.emulateMedia({ media: 'print' });
  await expect(bc.locator('#bcKyMoTa .chi-in-dong'), 'bản in ghi ngày lập').toBeVisible();
  await expect(bc.locator('#bcTheoPhong td.so .nut').first(), 'bản in ghi số trong bảng').toBeVisible();
  if (coNut.bcCanQuyet) await expect(bc.locator('#bcCanQuyet tbody > tr').nth(5), 'bản in đủ dòng').toBeVisible();
  if (coNut.bcVanBan) await expect(bc.locator('#bcTheoVanBan tbody > tr.bc-hang').nth(10), 'bản in đủ dòng').toBeVisible();
  await expect(bc.locator('.nut-goi').first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await nav(page, 'navCanBo');
  const cb = page.locator('#viewCanBo');
  await expect(cb.locator('.cb section').first()).toBeVisible(NAP);
  await expect(cb.locator('.dau .nut-goi')).toHaveAttribute('data-goi', /Tải việc theo người: quá hạn, sắp đến hạn, đang làm/);
  await expect(cb.locator('.dau')).not.toContainText('bấm một người');
  await expect(cb.locator('.cb .tieu span[data-goi]').first()).toHaveText(/^\d+ cán bộ, \d+ việc đang mở, \d+ quá hạn/, { useInnerText: true });
  await expect(cb.locator('.cb .tieu span[data-goi]').first()).toHaveAttribute('data-goi', /^Việc đang mở: việc cán bộ trong phòng/);
  await page.context().close();
});

// v3.36 (CAU-HOI V-13, DESIGN mục 17): màn của Trưởng phòng và chuyên viên. Phòng tôi: ba nhóm việc hiện các dòng đầu (chỉ đạo 5, quá hạn 10, sắp đến
// hạn 5), "Xem tất cả" mở tại chỗ. Việc của tôi: câu hướng dẫn ở nút "i", dòng tóm tắt ngắn, mã việc đứng đầu khối nội dung, dòng "Giao giờ, ngày" chỉ ở
// bản in. Theo văn bản: câu hướng dẫn ở nút "i". Chỉ đọc; nhóm ít việc thì không có nút.
test('A2: Phòng tôi — mỗi nhóm việc hiện các dòng đầu, "Xem tất cả" mở tại chỗ', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A2', testInfo, { dsGon: true });
  await expect(page.locator('#dhTinhDen')).toContainText('số liệu lúc', NAP);
  for (const [vung, ten, so] of [['#ptMucChiDao', 'ptChiDao', 5], ['#ptMucDo', 'ptDo', 10], ['#ptMucVang', 'ptVang', 5]]) {
    const dong = page.locator(`${vung} > .the-con`); const nut = page.locator(`[data-action="dsHet"][data-ds="${ten}"]`);
    if (await dong.count() <= so) { await expect(nut).toHaveCount(0); continue; }
    await expect(dong.nth(so - 1)).toBeVisible();
    await expect(dong.nth(so)).toBeHidden();
    await nut.click();
    await expect(nut).toHaveText(/^Chỉ hiện \d+ (việc|chỉ đạo) đầu$/);
    await expect(dong.nth(so)).toBeVisible();
    await nut.click();
    await expect(dong.nth(so)).toBeHidden();
  }
  await page.context().close();
});

test('A3: Việc của tôi, Theo văn bản — câu hướng dẫn ở nút "i", mã việc đứng đầu khối nội dung, dòng "Giao giờ, ngày" chỉ ở bản in', async ({ browser }, testInfo) => {
  const page = await pageAs(browser, 'A3', testInfo);
  const man = page.locator('#viewDieuHanh');
  await expect(man.locator('#vctBang')).toHaveAttribute('data-nap', /./, NAP);
  await expect(man.locator('.dau .nut-goi')).toHaveAttribute('data-goi', /^Việc đồng chí chủ trì theo dõi\./);
  await expect(man.locator('.bnv-mo-ta')).not.toContainText('Bấm nội dung');
  await expect(man.locator('#vctTom')).toHaveText(/^\d+ việc cần làm ngay, \d+ việc đang thực hiện$/);
  await expect(man.locator('.bnv-chu-giai [data-goi]').last()).toHaveAttribute('data-goi', /^Chữ đậm:/);
  const dong = man.locator('.bnv-dong').first();
  if (await dong.count()) {
    await expect(dong.locator('.bnv-nd .ma')).toBeVisible();
    await expect(dong.locator('.bnv-chi-gon')).toHaveCount(0);
    await expect(dong.locator('.bnv-chi-in')).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(dong.locator('.bnv-chi-in'), 'bản in ghi giờ, ngày giao').toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  }
  await nav(page, 'navTheoVanBan');
  await expect(page.locator('#viewTheoVanBan .dau .nut-goi')).toHaveAttribute('data-goi', /^Mỗi văn bản một dòng\./);
  await expect(page.locator('#viewTheoVanBan .dau')).not.toContainText('bấm tên văn bản');
  await page.context().close();
});

test('A1: In báo cáo nhanh — bấm nút: phần đầu theo thể thức, tầng 1, ma trận (6 dòng + Tổng cộng), 5 điểm nghẽn; afterprint trả lại màn hình', async ({ browser }, testInfo) => {
  // V-13: in từ trạng thái mặc định của người dùng thật — mọi khối phân tích đang gập trên màn hình; bản in vẫn có ma trận, điểm nghẽn, câu kết luận đủ.
  const page = await pageAs(browser, 'A1', testInfo, { oTongQuan: true, tqGap: true });
  await expect(page.locator('#viewTongQuan')).toHaveAttribute('data-nap', /./, NAP);
  await expect(page.locator('#tqIn')).toBeVisible();
  await expect(page.locator('#tqTang1 .tq-in-dau')).toBeHidden();
  await expect(page.locator('#tqMaTran')).toHaveAttribute('data-gap', '');
  await expect(page.locator('#tqMaTran .bang-mt')).toBeHidden();
  await expect(page.locator('#tqMaTran .khoi-so')).toBeVisible();
  await expect(page.locator('#tqKhoiTatCa')).toHaveText('Mở tất cả');
  // Bấm nút thật, hộp in của trình duyệt thay bằng hàm rỗng: nút gắn lớp in-tq và khổ A4 dọc tạm (chỉ cho bản in này), afterprint gỡ cả hai.
  await page.evaluate(() => { globalThis.print = () => {}; });
  await page.locator('#tqIn').click();
  await expect(page.locator('body')).toHaveClass(/\bin-tq\b/);
  await expect(page.locator('#tqInTrang')).toHaveCount(1);
  expect(await page.locator('#tqInTrang').textContent()).toContain('A4 portrait');
  await page.emulateMedia({ media: 'print' });
  const dau = page.locator('#tqTang1 .tq-in-dau');
  await expect(dau).toBeVisible();
  await expect(dau).toContainText('VĂN PHÒNG');
  await expect(dau).toContainText('ĐẢNG CỘNG SẢN VIỆT NAM');
  await expect(dau).toContainText('BÁO CÁO NHANH');
  await expect(page.locator('#tqSo')).toBeHidden();   // dải điều hành và bốn thẻ không in — bản in dùng bảng năm chỉ tiêu
  await expect(page.locator('#tqTang1 .tq1-bang-in .dong-in')).toHaveCount(5);
  await expect(page.locator('#tqTang1 .tq1-bang-in')).toBeVisible();
  await expect(page.locator('#tqKetLuan .chi-in'), 'bản in ghi câu kết luận đủ').toBeVisible();
  await expect(page.locator('#tqKetLuan .chi-man')).toBeHidden();
  await expect(page.locator('#tqMaTran')).toBeVisible();
  await expect(page.locator('#tqMaTran .bang-mt'), 'khối gập trên màn hình vẫn in đủ').toBeVisible();
  await expect(page.locator('#tqMaTran .khoi-so')).toBeHidden();
  await expect(page.locator('#tqLoc')).toBeHidden();
  await expect(page.locator('#mainHeader')).toBeHidden();
  for (const id of ['#tqXepHang', '#tqThang', '#tqVanBan']) if (await page.locator(id).count()) await expect(page.locator(id)).toBeHidden();
  const dong = page.locator('#tqNghen .bang-ng tbody tr');
  if (await dong.count() > 5) {
    await expect(dong.nth(4)).toBeVisible();
    await expect(dong.nth(5)).toBeHidden();
    await expect(page.locator('#tqNghen .chan-ng .chi-in')).toBeVisible();
  }
  const dongMt = page.locator('#tqMaTran .bang-mt tbody tr');
  if (await dongMt.count() > 6) {
    await expect(dongMt.nth(5)).toBeVisible();
    await expect(dongMt.nth(6)).toBeHidden();
    await expect(page.locator('#tqMaTran .mt-chi-in')).toBeVisible();
  }
  await expect(page.locator('#tqMaTran .bang-mt tfoot tr')).toBeVisible();   // Tổng cộng luôn in
  await expect(page.locator('.chan-in')).toBeHidden();   // chân in chung không lặp với chân của báo cáo nhanh
  await expect(page.locator('.tq-in-chan')).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event('afterprint')));
  await expect(page.locator('body')).not.toHaveClass(/\bin-tq\b/);
  await expect(page.locator('#tqInTrang')).toHaveCount(0);
  await expect(dau).toBeHidden();
  await expect(page.locator('#tqLoc')).toBeVisible();
  await expect(page.locator('#tqMaTran .bang-mt'), 'trở lại màn hình: khối vẫn gập').toBeHidden();
  await page.context().close();
});
