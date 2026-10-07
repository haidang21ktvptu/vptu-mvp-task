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

export { USERS };
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
// "Xem toàn bộ việc của tôi" trên màn hình Việc của tôi.
// Mở biểu mẫu Giao việc rồi CHỜ khởi tạo xong ([data-san-sang="1"]) trước thao tác đầu tiên — quy tắc 17/9: "phần tử đã hiện" không phải
// tín hiệu nạp xong (lỗi đua CI #96: chọn "Văn bản mới" trong lúc biểu mẫu còn nạp rồi bị bước khởi tạo ghi đè). mo: cách mở (mặc định menu).
export async function moGiaoViec(page, mo = () => nav(page, 'navGiaoViec')) {
  await mo();
  await expect(page.locator('#viewGiaoViec')).toBeVisible();
  await expect(page.locator('#giaoViecForm')).toHaveAttribute('data-san-sang', '1', NAP);
}

export async function nav(page, id) {
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
