// PR-2a lỗi (3): không có id trùng trên trang và mọi ô số hiệu / ngày văn bản / cấp nhận có <label for> trỏ đúng ô — kiểm trên "Việc của tôi"
// (A3 có ≥ 2 thẻ với ô nộp minh chứng tại chỗ), khi ngăn chi tiết đang mở (biểu mẫu minh chứng của ngăn) và trên biểu mẫu Giao việc (Chánh VP).
// Dữ liệu riêng: 2 việc quá hạn của demo_e2e_mc (đã xác nhận nhận, chưa có minh chứng) theo khoá E2E-TEST-IDD-<project>; tự dọn trước và sau.
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { getKeys } from './lib/keys.mjs';
import { pageAs, moViec, moGiaoViec, NAP } from './lib/app.js';
import { khoaRieng, taoVanBanRieng, donVanBan, kiemThayViec, clientCuaVai } from './lib/du-lieu.mjs';

// id trùng + ô (so_hieu / ngay_van_ban / cap_nhan) không có nhãn trỏ đúng — đọc trên toàn tài liệu (section ẩn vẫn nằm trong DOM).
const kiemId = (page) => page.evaluate(() => {
  const d = globalThis.document; const dem = new Map();
  d.querySelectorAll('[id]').forEach((e) => dem.set(e.id, (dem.get(e.id) || 0) + 1));
  const trung = [...dem].filter(([, n]) => n > 1).map(([id]) => id);
  const o = [...d.querySelectorAll('input[name="so_hieu"], input[name="ngay_van_ban"], select[name="cap_nhan"], #klMcSoHieu, #klMcNgay, #klMcCap')];
  const thieuNhan = o.filter((e) => !e.id || !d.querySelector(`label[for="${globalThis.CSS.escape(e.id)}"]`)).map((e) => e.name || e.id);
  return { trung, thieuNhan, soO: o.length };
});

test.describe.serial('Id duy nhất và nhãn ô minh chứng (PR-2a lỗi 3)', () => {
  let db; let khoa; const ids = [];

  test.beforeAll(async ({}, testInfo) => { // eslint-disable-line no-empty-pattern
    const k = getKeys();
    db = createClient(k.url, k.service, { auth: { persistSession: false, autoRefreshToken: false } });
    khoa = khoaRieng('IDD', testInfo);
    const vb = await taoVanBanRieng(db, khoa, { loai: 'CONG_VAN', ngay_ban_hanh: '2026-07-01', ngay_nhan: '2026-07-01' });
    const { data: mc } = await db.from('accounts').select('id').eq('username', 'demo_e2e_mc').single();
    for (const n of [1, 2]) {
      const r = await db.from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${khoa} việc ${n}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-07-20',
        theo_1400: true, ngay_nhan_van_ban: '2026-07-01', ngay_nhan_uoc_tinh: false, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: mc.id, nguoi_theo_doi: mc.id,
        san_pham_loai: 'BAO_CAO', tao_boi: mc.id }).select('id, ma').single();
      if (r.error) throw new Error(`Tạo việc mẫu: ${r.error.message}`);
      ids.push(r.data);
      await kiemThayViec('E2E_MC', r.data.id, r.data.ma);
      const xn = await clientCuaVai('E2E_MC').rpc('xac_nhan_nhan_viec', { p_id: r.data.id });   // đã nhận → thẻ vào nhóm cần minh chứng
      if (xn.error) throw new Error(`Xác nhận nhận việc mẫu: ${xn.error.message}`);
    }
  });
  test.afterAll(async () => { if (db) await donVanBan(db, khoa); });

  test('Việc của tôi (≥ 2 ô nộp tại chỗ) và ngăn chi tiết đang mở: không id trùng, ô minh chứng có nhãn', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'E2E_MC', testInfo);
    for (const v of ids) await expect(page.locator(`#vct-${v.id} form.mc-inline`)).toBeVisible(NAP);
    for (const v of ids) await expect(page.locator(`label[for="mc-${v.id}-so-hieu"]`)).toHaveCount(1);
    let kq = await kiemId(page);
    expect(kq.trung, 'id trùng trên Việc của tôi').toEqual([]);
    expect(kq.thieuNhan, 'ô thiếu nhãn trên Việc của tôi').toEqual([]);
    expect(kq.soO).toBeGreaterThanOrEqual(6);
    await moViec(page, ids[0].id, ids[0].ma);   // ngăn chi tiết (có biểu mẫu minh chứng của ngăn) — thẻ Việc của tôi vẫn trong DOM
    kq = await kiemId(page);
    expect(kq.trung, 'id trùng khi ngăn chi tiết đang mở').toEqual([]);
    expect(kq.thieuNhan, 'ô thiếu nhãn khi ngăn chi tiết đang mở').toEqual([]);
    await page.context().close();
  });

  test('Giao việc (Chánh VP): không id trùng', async ({ browser }, testInfo) => {
    const page = await pageAs(browser, 'A1', testInfo);
    await moGiaoViec(page);
    const kq = await kiemId(page);
    expect(kq.trung, 'id trùng trên Giao việc').toEqual([]);
    await page.context().close();
  });
});
