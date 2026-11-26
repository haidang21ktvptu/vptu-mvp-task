// Hai kích thước màn hình của bộ e2e (SPEC NF-4): máy tính 1280x800 và điện thoại 360x740.
// v3.36 (CAU-HOI V-12): bộ e2e chạy ở chế độ giảm chuyển động (prefers-reduced-motion: reduce) — ứng dụng không chạy hiệu ứng, kiểm thử không phải chờ
// chuyển động; context tự tạo trong lib/app.js contextAs cũng đặt như vậy. Riêng chuyen-dong.spec.js bật lại chuyển động để kiểm trạng thái cuối.
import { devices } from '@playwright/test';

const GIAM_CHUYEN_DONG = { contextOptions: { reducedMotion: 'reduce' } };
export const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...GIAM_CHUYEN_DONG };
export const MOBILE = { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, ...GIAM_CHUYEN_DONG };
