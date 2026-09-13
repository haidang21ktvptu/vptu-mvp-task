// Hai kích thước màn hình của bộ e2e (SPEC NF-4): máy tính 1280x800 và điện thoại 360x740.
import { devices } from '@playwright/test';

export const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };
export const MOBILE = { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };
