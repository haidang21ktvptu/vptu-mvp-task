// Chạy cuối cùng (thứ tự tên file): dọn dữ liệu mẫu RLS-TEST trên project test (tin nhắn và module KL).
import { test } from 'node:test';
import { teardownFixtures } from './fixtures.mjs';
import { teardownKlFixtures, klSchemaReady } from './fixtures-kl.mjs';

test('dọn dữ liệu mẫu', async () => {
  await teardownFixtures();
  if (await klSchemaReady()) await teardownKlFixtures();
});
