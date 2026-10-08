// GĐ16 (PR 16B; giao diện v7 GĐ20; v8 đợt 4 = 4 yếu tố): minh chứng có cấu trúc. Chuyên viên (người theo dõi) mở ngăn chi tiết → việc theo 1400
// KHÔNG có nút "Đóng nhiệm vụ" (0077: chỉ hoàn thành khi lãnh đạo nghiệm thu) → nộp thiếu ngày bị chặn ở form (0086: trích yếu / mô tả tuỳ chọn) → nộp đủ →
// khối hiện đủ 4 yếu tố, nhãn "Đã nộp — chờ nghiệm thu" → Trưởng phòng nghiệm thu (RPC) → HOAN_THANH, lead time = 15 ngày; việc cũ (không theo
// 1400) có minh chứng chữ hiện nhãn "Minh chứng cũ", nút Đóng sáng. Dữ liệu mẫu tạo bằng service_role trong hội nghị 992, tự dọn.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { pageAs, nav, NAP } from './lib/app.js';
import { getKeys } from './lib/keys.mjs';
import { E2E_TAG } from './global-setup.mjs';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';

const CV1_ID = '00000000-0000-4000-8000-000000000011'; // demo_e2e_mc — tài khoản riêng của spec (GĐ18)
const SO_HOI_NGHI = 992;

test.describe.serial('Nhiệm vụ — minh chứng có cấu trúc và đóng nhiệm vụ', () => {
  let hnKhoa;
  let db; let nvId; let cuId; let page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    const co = await db.from('minh_chung').select('id').limit(1);
    test.skip(Boolean(co.error), 'Project chưa có migration 0028 (minh_chung).');
    hnKhoa = khoaRieng('MC', testInfo); // khoá riêng theo project: chạy lại / chạy dở / 2 worker không đụng nhau
    const hn = { id: await taoVanBanRieng(db, hnKhoa, { so_hoi_nghi: SO_HOI_NGHI }) };
    const base = { van_ban_id: hn.id, nguoi_theo_doi: CV1_ID, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31', nganh_ma: 'KINH_TE_TONG_HOP', owner_don_vi_ma: 'DANG_UY_UBND' };
    const { data: nv, error: e2 } = await db.from('nhiem_vu').insert({ ...base, noi_dung: `${E2E_TAG} MC theo 1400 ${Date.now()}`, theo_1400: true,
      ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, cap_nhan_san_pham: 'CHANH_VAN_PHONG' }).select('id').single();
    if (e2) throw new Error(`Tạo nhiệm vụ mẫu thất bại: ${e2.message}`);
    nvId = nv.id;
    const { data: cu, error: e3 } = await db.from('nhiem_vu').insert({ ...base, noi_dung: `${E2E_TAG} MC việc cũ ${Date.now()}`, theo_1400: false }).select('id').single();
    if (e3) throw new Error(`Tạo nhiệm vụ cũ thất bại: ${e3.message}`);
    cuId = cu.id;
    // Việc mẫu phải nằm trong phạm vi vai sẽ xem — kiểm ngay bằng token của vai, lỗi rõ ở beforeAll (không chờ 10 giây ở #klRow).
    await kiemThayViec('E2E_MC', nvId, 'MC theo 1400'); await kiemThayViec('E2E_MC', cuId, 'MC việc cũ');
    const { error: e4 } = await db.from('minh_chung').insert({ nhiem_vu_id: cuId, loai: 'chu_cu', noi_dung_chu: `Công văn 12/CV-VPTU ngày 10/08/2026 (${E2E_TAG})`, so_hieu: '12/CV-VPTU', ngay_van_ban: '2026-08-10' });
    if (e4) throw new Error(`Tạo minh chứng cũ thất bại: ${e4.message}`);
    page = await pageAs(browser, 'E2E_MC', testInfo);
  });
  test.afterAll(async () => {
    await page?.context().close();
    if (db) await donVanBan(db, hnKhoa);
  });

  test('việc theo 1400: không có nút Đóng; nộp thiếu ngày bị chặn ở form (0086: trích yếu / mô tả tuỳ chọn); nộp đủ → khối hiện 4 yếu tố, chờ nghiệm thu', async () => {
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong
    const row = page.locator(`#klRow-${nvId}`);
    await expect(row).toBeVisible(NAP);
    await row.click();
    const ngan = page.locator(`#klChiTiet-${nvId}`);
    await expect(ngan).toBeVisible(NAP);
    await expect(ngan.getByRole('button', { name: 'Đóng nhiệm vụ' })).toHaveCount(0);   // 0077: việc theo 1400 chỉ đóng khi nghiệm thu
    const khoi = page.locator(`#klMinhChung-${nvId}`);
    await expect(khoi).toContainText('chưa có', NAP);
    await ngan.getByRole('button', { name: 'Nộp minh chứng' }).click();
    await expect(page.locator('#klMcModal')).toBeVisible();
    await expect(page.locator('#klMcCap')).toHaveValue('CHANH_VAN_PHONG'); // cấp nhận gợi ý = cấp nhận sản phẩm của nhiệm vụ
    await page.locator('#klMcSoHieu').fill('15/BC-VPTU');
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('số hiệu và ngày văn bản');   // 0086: thiếu ngày → chặn ở form, hộp vẫn mở
    await expect(page.locator('#klMcModal')).toBeVisible();
    await page.locator('#klMcNgay').fill('2026-08-20');
    await page.locator('#klMcTrichYeu').fill('Báo cáo kết quả rà soát (e2e MC)');
    await page.locator('#klMcMoTaKq').fill('Đã rà soát, tổng hợp và gửi Chánh Văn phòng.');
    await expect(page.locator('#klMcDem')).toHaveText('44'); // đếm ký tự theo ô mô tả
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#klMcModal')).toBeHidden();
    await expect(page.locator('#toastContainer')).toContainText('Đã nộp minh chứng');
    await expect(page.locator(`#klMinhChung-${nvId}`)).toContainText('1 hợp lệ / 1 đã nộp');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`)).toContainText('15/BC-VPTU');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong .mc-trich-yeu`)).toHaveText('Báo cáo kết quả rà soát (e2e MC)');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong .mc-mo-ta`)).toContainText('gửi Chánh Văn phòng');
    await expect(page.locator(`#klDienBien-${nvId}`)).toContainText('Nộp minh chứng 15/BC-VPTU · Báo cáo kết quả rà soát (e2e MC)');
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`)).toContainText('Chờ nghiệm thu');   // PR-2b: nhãn mới
    await expect(page.locator(`#klMinhChung-${nvId} .mc-dong`).getByRole('button', { name: 'Xác nhận hợp lệ' })).toHaveCount(0); // người nộp không tự xác nhận
    await expect(page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Đóng nhiệm vụ' })).toHaveCount(0);
    await expect(page.locator(`#klChiTiet-${nvId} .ct-nhan .trang-thai`)).toHaveText('Đã nộp — chờ nghiệm thu', NAP);
  });

  test('Trưởng phòng nghiệm thu (RPC) → HOAN_THANH, ngày hoàn thành = ngày văn bản, lead time 15 ngày, lịch sử có dòng đóng; chuyên viên hết nút', async () => {
    const mc = (await db.from('minh_chung').select('id').eq('nhiem_vu_id', nvId).single()).data.id;
    const r = await clientCuaVai('A2').rpc('xac_nhan_minh_chung', { p_id: mc, p_hop_le: true, p_chat_luong: 'DAT' });   // demo_truongphong — A2 phòng của người theo dõi
    expect(r.error, r.error?.message).toBeNull();
    await page.reload(); await expect(page.locator('#mainHeader')).toBeVisible(NAP);   // nạp lại app rồi mới mở menu (A3 đi qua Điều hành → Nhiệm vụ)
    await nav(page, 'navKl');
    await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP);
    const row = page.locator(`#klRow-${nvId}`);
    await row.click();
    await expect(row).toHaveAttribute('data-nhom', 'HOAN_THANH', NAP);
    await expect(page.locator(`#klChiTiet-${nvId}`).getByRole('button', { name: 'Đóng nhiệm vụ' })).toHaveCount(0);
    await expect(page.locator(`#klChiTiet-${nvId}`)).toContainText('lead time 15 ngày', NAP);
    const { data } = await db.from('v_nhiem_vu').select('tien_do_ma, ngay_hoan_thanh, thieu_minh_chung, lead_time_ngay, so_minh_chung_hop_le').eq('id', nvId).single();
    expect(data).toEqual({ tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: '2026-08-20', thieu_minh_chung: false, lead_time_ngay: 15, so_minh_chung_hop_le: 1 });
    const { data: ls } = await db.from('lich_su').select('cot').eq('nhiem_vu_id', nvId).in('cot', ['minh_chung_nop', 'dong_nhiem_vu']);
    expect(ls.map((l) => l.cot).sort()).toEqual(['dong_nhiem_vu', 'minh_chung_nop']);
  });

  test('việc cũ: khối minh chứng hiện nhãn "Minh chứng cũ" với nguyên văn; nút Đóng sáng (chữ cũ hợp lệ)', async () => {
    await page.locator(`#klRow-${cuId}`).click();
    const ngan = page.locator(`#klChiTiet-${cuId}`);
    await expect(ngan.getByRole('button', { name: 'Đóng nhiệm vụ' })).toBeEnabled();
    const dong = page.locator(`#klMinhChung-${cuId} .mc-dong`);
    await expect(dong).toHaveAttribute('data-loai', 'chu_cu');
    await expect(dong.locator('.mc-loai')).toHaveText('Minh chứng cũ');
    await expect(dong).toContainText('Công văn 12/CV-VPTU ngày 10/08/2026');
  });

  test('PR-2b: mô tả đúng 600 ký tự (kể cả tiếng Việt dạng tổ hợp NFD) được nhận — client chuẩn hoá NFC khớp char_length của DB; 601 bị chặn cả hai phía', async () => {
    const nfd = (n) => 'ễ'.normalize('NFD').repeat(n);   // mỗi "ễ" = 3 đơn vị mã NFD, 1 ký tự NFC
    await page.locator(`#klRow-${cuId}`).click();
    await page.locator(`#klChiTiet-${cuId}`).getByRole('button', { name: 'Nộp minh chứng' }).click();
    await page.locator('#klMcSoHieu').fill('16/BC-VPTU'); await page.locator('#klMcNgay').fill('2026-08-20');
    await page.locator('#klMcCap').selectOption('CHANH_VAN_PHONG');
    await page.locator('#klMcTrichYeu').fill('Báo cáo 600 ký tự (e2e MC)');
    await page.locator('#klMcMoTaKq').fill(nfd(601));
    await expect(page.locator('#klMcDem')).toHaveText('601');
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#toastContainer')).toContainText('tối đa 600 ký tự');
    await page.locator('#klMcMoTaKq').fill(nfd(600));
    await expect(page.locator('#klMcDem')).toHaveText('600');
    await page.locator('#klMcLuu').click();
    await expect(page.locator('#klMcModal')).toBeHidden(NAP);
    const { data } = await db.from('minh_chung').select('mo_ta_ket_qua').eq('nhiem_vu_id', cuId).eq('so_hieu', '16/BC-VPTU').single();
    expect([...data.mo_ta_ket_qua].length).toBe(600); expect(data.mo_ta_ket_qua).toBe(data.mo_ta_ket_qua.normalize('NFC'));
    const r = await clientCuaVai('E2E_MC').rpc('nop_minh_chung', { p: { nhiem_vu_id: cuId, so_hieu: '17/BC-VPTU', ngay_van_ban: '2026-08-20',
      cap_nhan: 'CHANH_VAN_PHONG', trich_yeu: 'Kiểm 601', mo_ta_ket_qua: 'ễ'.repeat(601) } });
    expect(r.error?.message).toMatch(/tối đa 600/);
  });
});

