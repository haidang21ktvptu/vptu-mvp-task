// Chạy cuối cùng (thứ tự tên file): dọn dữ liệu mẫu RLS-TEST trên project test.
import { test } from 'node:test';
import { teardownFixtures } from './fixtures.mjs';

test('dọn dữ liệu mẫu', async () => { await teardownFixtures(); });
