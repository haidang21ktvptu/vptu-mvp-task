// Thao tác giao diện dùng chung cho các kịch bản e2e.
//
// Phiên riêng cho từng context (CI-4): global-setup đăng nhập mỗi vai MỘT lần và lưu cặp token vào .auth/<vai>.json; mỗi context lấy một cặp
// token MỚI bằng refresh (giới hạn 150/5 phút, tách khỏi 30 lượt đăng nhập) theo chuỗi: đọc token mới nhất → refresh → ghi lại. Với xoay
// refresh token đang bật, hai context không bao giờ giữ cùng một refresh token còn hiệu lực; context cũ vẫn chạy bằng access token (JWT 1
// giờ) tới hết lần chạy. Khoá thư mục (mkdir nguyên tử) để hai worker không refresh cùng một token ngoài khoảng reuse 10 giây.
//
// GĐ20 (giao diện v7): menu là hàng pill (#<id>) trên máy tính và thanh dưới (#<id>Duoi, mục thừa trong "Khác") trên điện thoại — nav()
// bấm đúng nút đang hiện.
import { expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getKeys, SEED_PASSWORD } from './keys.mjs';
import { USERS, TQ, sessionPath } from './roles.mjs';
import { ganTre } from './tre.mjs';
import { HIEN_MUC_TIEU } from '../../../frontend/src/lib/kl/muc-tieu.js';   // v3.27: mục tiêu then chốt tạm ẩn — spec mục tiêu tự bỏ qua

export { USERS, HIEN_MUC_TIEU };
export const LY_DO_AN_MT = 'Mục tiêu then chốt tạm ẩn (v3.27, chủ dự án 20/10/2026 — chưa đủ dữ liệu); bật lại cờ HIEN_MUC_TIEU thì chạy lại.';
// Thời gian chờ DỮ LIỆU NẠP XONG trên staging (data-nap, #klRow-*, #vct*, #the-*, #tt-viec-*, ngăn chi tiết…): staging nhỏ, 2 worker → có thể
// quá 10 giây. Assert giao diện thuần (nút, nhãn, lớp CSS) giữ 10 giây mặc định.
export const NAP = { timeout: 20_000 };

const KHOA_MS = 20_000;
const ngu = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
export const storageKey = () => `sb-${new URL(getKeys().url).hostname.split('.')[0]}-auth-token`;

// Cặp token mới cho vai (giữ khoá trong lúc refresh + ghi lại file).
export async function phienMoi(role) {
  const dir = `${sessionPath(role)}.lock`;
  const han = Date.now() + KHOA_MS;
  for (;;) {
    try { mkdirSync(dir); break; } catch (e) { if (e.code !== 'EEXIST' || Date.now() > han) throw e; ngu(100); }
  }
  try {
    const k = getKeys();
    const cu = JSON.parse(readFileSync(sessionPath(role), 'utf8'));
    const client = createClient(k.url, k.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.refreshSession({ refresh_token: cu.refresh_token });
    if (error) throw new Error(`Làm mới phiên ${role} thất bại: ${error.message}`);
    writeFileSync(sessionPath(role), JSON.stringify(data.session));
    return data.session;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Context mới theo kích thước/thiết bị của project hiện tại, đã có phiên riêng của vai trong localStorage.
export async function contextAs(browser, role, testInfo) {
  const session = await phienMoi(role);
  const { viewport, isMobile, hasTouch, baseURL, locale } = testInfo.project.use;
  const context = await browser.newContext({
    viewport, isMobile, hasTouch, baseURL, locale,
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: storageKey(), value: JSON.stringify(session) }] }] },
  });
  await ganTre(context);   // E2E_TRE_MS (mặc định tắt): độ trễ giả lập để bắt lỗi đua
  return context;
}

// v9: lãnh đạo (A0/A1/A2) vào Tổng quan — mở tiếp "Cần xử lý" (#viewDieuHanh) như trang mở đầu cũ để các kịch bản dựa vào nó chạy nguyên;
// kịch bản cần đứng ở Tổng quan truyền { oTongQuan: true }.
export async function pageAs(browser, role, testInfo, { oTongQuan = false } = {}) {
  const context = await contextAs(browser, role, testInfo);
  const page = await context.newPage();
  await page.goto('./');
  await expectLoggedIn(page, role);
  if (USERS[role].section === TQ && !oTongQuan) { await nav(page, 'navDieuHanh'); await expect(page.locator('#viewDieuHanh')).toBeVisible(); }
  return page;
}

// Đăng nhập qua form (SPEC AUTH-1) và chờ vào đúng view theo vai trò (AUTH-5). Tốn 1 lượt đăng nhập — chỉ dùng ở dang-nhap.spec.js.
export async function loginAs(page, role, password = SEED_PASSWORD) {
  const user = USERS[role];
  await page.goto('./');
  await page.locator('#loginUsername').fill(user.username);
  await page.locator('#loginPassword').fill(password);
  await page.locator('#loginSubmitBtn').click();
  await expectLoggedIn(page, role);
}

export async function expectLoggedIn(page, role) {
  const user = USERS[role];
  await expect(page.locator('#mainHeader')).toBeVisible({ timeout: 20_000 }); // khôi phục phiên + đọc hồ sơ trên staging lúc bận có thể quá 10 giây
  await expect(page.locator('#currentUserDisplay')).toContainText(user.fullName);
  await expect(page.locator('#currentRoleDisplay')).toContainText(user.roleLabel);
  await expect(page.locator('#loginSection')).toBeHidden();
  await expect(page.locator(user.section)).not.toHaveClass(/\bhidden\b/);
  for (const id of ['#viewKl', '#viewGiaoViec', '#viewNhanTin', '#viewQuanTri']) await expect(page.locator(id)).toHaveClass(/\bhidden\b/);
}

// Bấm một mục menu theo id (navKl, navDieuHanh, dmBubbleLauncher, navQuanTri…): pill trên máy tính, nút thanh dưới hoặc "Khác" trên điện thoại.
// Chuyên viên (A3) không có mục Nhiệm vụ trên menu (mockup: Việc của tôi · Việc tôi theo dõi · Nhắn tin) — mở toàn bộ việc bằng nút
// [data-action=openKl] trên màn hình Việc của tôi (v3.25: "Lọc chi tiết, in").
// Mở biểu mẫu Giao việc rồi CHỜ khởi tạo xong ([data-san-sang="1"]) trước thao tác đầu tiên — quy tắc 17/9: "phần tử đã hiện" không phải
// tín hiệu nạp xong (lỗi đua CI #96: chọn "Văn bản mới" trong lúc biểu mẫu còn nạp rồi bị bước khởi tạo ghi đè). mo: cách mở (mặc định menu).
export async function moGiaoViec(page, mo = () => nav(page, 'navGiaoViec')) {
  await mo();
  await expect(page.locator('#viewGiaoViec')).toBeVisible();
  await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
}

// v3.26 (0116): Giao việc bắt buộc phân loại MỌI thẻ — ngành/lĩnh vực, và mục tiêu then chốt hoặc "Không thuộc". the: số thẻ (data-dong, 1 = thẻ
// chính). Ô đã có giá trị (kịch bản tự chọn, AI / tệp điền sẵn) giữ nguyên. Ngành trống → nganh (mặc định "Không thuộc ngành, lĩnh vực nào"; kết
// luận / thông báo phải truyền ngành cụ thể). v3.29: không còn ô Lĩnh vực — lĩnh vực (danh mục) tự xác định vào ô ẩn (#klThLinhVuc /
// [data-cot=linh_vuc]) theo ngành, phạm vi kiêm nhiệm, lĩnh vực chi tiết, nội dung; ở đây chỉ kiểm ô ẩn đã có giá trị. Kịch bản cần một lĩnh vực cụ
// thể (ngành nhiều lĩnh vực) thì điền ô Lĩnh vực chi tiết đúng tên lĩnh vực. Ô mục tiêu chưa có mục nào (kể cả mục theo văn bản) → tích "Không thuộc
// mục tiêu then chốt nào"; mucTieu: false = không đụng (kịch bản tự chọn mục tiêu). Ô ngành đang ẩn (Thường trực giao loại không bắt buộc) → bỏ qua
// ngành. v3.27: mục tiêu then chốt tạm ẩn (HIEN_MUC_TIEU) → chỉ ngành.
export async function chonPhanLoai(page, { the = 1, nganh = 'KHONG_THUOC', mucTieu = true } = {}) {
  const goc = the === 1 ? page.locator('#gvThe1') : page.locator(`#gvLuoiThan .gv-nv[data-dong="${the}"]`);
  const sNganh = the === 1 ? page.locator('#klThNganh') : goc.locator('[data-cot="nganh"]');
  const sLv = the === 1 ? page.locator('#klThLinhVuc') : goc.locator('[data-cot="linh_vuc"]');
  const hien = await sNganh.isVisible();
  if (hien && nganh && !(await sNganh.inputValue())) await sNganh.selectOption(nganh);
  if (hien && await sNganh.inputValue()) await expect(sLv, `thẻ ${the}: lĩnh vực tự xác định theo ngành`).not.toHaveValue('');
  if (!mucTieu || !HIEN_MUC_TIEU) return;
  const o = goc.locator('.mtg').first();
  await expect(o.locator('[data-mtg-khong]')).toBeVisible(NAP);
  if (await o.locator('[data-mtg-phan="chon"] .mtg-chip').count() === 0) await o.locator('[data-mtg-khong]').check();
  await expect(o.locator('[data-mtg-phan="chon"] .mtg-chip')).not.toHaveCount(0);
}

// v3.27: người theo dõi, đơn vị phối hợp, mô tả sản phẩm, cấp nhận ở mục gập "Thêm" của thẻ nhiệm vụ — mở trước khi điền. the: số thẻ (1 = thẻ chính).
export async function moThem(page, the = 1) {
  const d = the === 1 ? page.locator('#gvThe1Them') : page.locator(`#gvLuoiThan .gv-nv[data-dong="${the}"] .gv-nv-them`);
  if ((await d.getAttribute('open')) === null) await d.locator('summary').click();
  await expect(d).toHaveAttribute('open', '');
}

// v3.29: ngăn chi tiết dùng chung đang mở (mở việc rồi tải lại: đường dẫn "…/NV-…" mở lại việc) che nút trong màn → đóng như người dùng, chờ thanh
// địa chỉ bỏ mã việc (bước lùi của app xong) rồi mới bấm menu. Đường dẫn còn mã việc (vừa tải lại / mở thẳng) → app mở lại việc SAU khi màn nạp xong:
// chờ lượt mở đó xong (ngăn hiện, chi tiết hiện ngay trong màn Nhiệm vụ, hoặc mã bị bỏ) — không thì ngăn mở ra giữa chừng, che nút sắp bấm.
async function dongNganNeuMo(page) {
  const ngan = page.locator('#nganCT');
  const coMa = () => /\/NV-\d+(?:[?#].*)?$/i.test(page.url());
  if (coMa()) {
    await expect.poll(async () => !coMa() || (await ngan.isVisible()) || (await page.locator('#viewKl:not(.hidden) [id^="klChiTiet-"]').count()) > 0,
      { ...NAP, message: 'đường dẫn có mã việc: chờ app mở lại việc' }).toBe(true);
  }
  if (!(await ngan.isVisible())) return;
  await ngan.locator('[data-action="nganDong"]').click();
  await expect(ngan).toBeHidden();
  await expect(page).not.toHaveURL(/\/NV-\d+(?:[?#].*)?$/i);
}

export async function nav(page, id) {
  await dongNganNeuMo(page);
  const pill = page.locator(`#${id}`);
  if (await pill.count() === 0) {
    if (id !== 'navKl') throw new Error(`Menu không có mục ${id}`);
    if (!(await page.locator('#viewDieuHanh').isVisible())) await nav(page, 'navDieuHanh');
    await page.locator('#viewDieuHanh [data-action="openKl"]').click();
    return;
  }
  if (await pill.isVisible()) { await pill.click(); return; }
  const duoi = page.locator(`#${id}Duoi`);
  if (!(await duoi.isVisible())) await page.locator('#navKhacDuoi').click();
  await duoi.click();
}

// Mở màn hình Nhiệm vụ, lọc theo mã và mở ngăn chi tiết của một việc (id) — dùng ở nhiều kịch bản. boCuaToi: chuyên viên thường mở Nhiệm vụ
// mặc định lọc "Việc của tôi" — xem việc của người khác thì bỏ chip lọc đó (nếu có) trước khi tìm; chuyên viên giữ quyền quản trị nhiệm vụ
// vào "Toàn bộ nhiệm vụ" không có chip (chiViecCuaToi, kl/index.js).
export async function moViec(page, id, ma, { boCuaToi = false } = {}) {
  await nav(page, 'navKl');
  if (boCuaToi) { const chip = page.locator('#klChipLoc [data-action="boKlLoc"][data-khoa="cuaToi"]'); if (await chip.count()) await chip.click(); }
  await page.locator('#klTimKiem').fill(ma);
  await expect(page.locator('#klBody')).toHaveAttribute('data-nap', /./, NAP); // danh sách đã nạp xong rồi mới tìm dòng (không tìm khi đang nạp lại)
  const row = page.locator(`#klRow-${id}`);
  await expect(row).toBeVisible(NAP);
  await row.click();
  await expect(page.locator(`#klChiTiet-${id}`)).toBeVisible(NAP);
  return row;
}

// v3.25 (bảng theo cột): màn Nhiệm vụ 50 dòng mỗi trang — n việc đang lọc ⇒ #klBody ghi data-so-loc = n, trang 1 hiện min(n, 50) dòng.
export async function soDongKl(page, n) {
  await expect(page.locator('#klBody')).toHaveAttribute('data-so-loc', String(n));
  await expect(page.locator('#klBody [id^="klRow-"]')).toHaveCount(Math.min(n, 50));
}

// Đăng xuất qua nút — supabase-js huỷ phiên ở mọi thiết bị của tài khoản, nên chỉ gọi trong kịch bản đăng nhập (chạy sau cùng).
// Màu tính toán của một biến CSS (token) trên chính trang, ở dạng rgb(...) như getComputedStyle trả về — spec so màu KHÔNG ghi cứng
// chuỗi rgb (đổi token là đổi một chỗ: frontend/src/styles/tokens.css).
export async function mauToken(page, ten) {
  return page.evaluate((t) => {
    const el = globalThis.document.createElement('span'); el.style.color = `var(${t})`; globalThis.document.body.appendChild(el);
    const mau = globalThis.getComputedStyle(el).color; el.remove(); return mau;
  }, ten);
}

export async function logout(page) {
  await page.locator('#banhRangBtn').click(); // GĐ23: Đăng xuất nằm cuối menu bánh răng
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginSection')).toBeVisible();
  await expect(page.locator('#mainHeader')).toBeHidden();
}
