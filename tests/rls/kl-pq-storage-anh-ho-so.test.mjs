// PQ-3 — bucket Storage anh-ho-so (0041): policy INSERT/UPDATE/DELETE chỉ trong thư mục <uid>/ của chính mình; không có policy SELECT
// cho authenticated/anon → list/download qua API có JWT của người khác trả rỗng/bị chặn; anon không ghi/xoá/list được.
// KHÔNG khẳng định việc đọc qua URL công khai (bucket đang public = true theo thiết kế 0041) — ghi nhận ở ma trận, chờ PR RLS quyết.
// Tệp mẫu: <uid cv1>/kl-pq3*.png (PNG 1×1); tự dọn bằng service_role.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, IDS } from './lib.mjs';

const BUCKET = 'anh-ho-so';
const db = () => adminClient();
const SKIP = (await db().storage.getBucket(BUCKET)).error ? 'Chưa có bucket anh-ho-so (migration 0041) trên project này.' : false;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const blob = () => new Blob([PNG], { type: 'image/png' });
const cua = (uid, ten) => `${uid}/kl-pq3-${ten}.png`;
const kho = (c) => c.storage.from(BUCKET);
const don = async () => {
  for (const uid of [IDS.cv1, IDS.cv2]) {
    const { data } = await kho(db()).list(uid, { search: 'kl-pq3' });
    if (data?.length) await kho(db()).remove(data.map((f) => `${uid}/${f.name}`));
  }
};
const tonTai = async (path) => {
  const [uid, ten] = path.split('/');
  return ((await kho(db()).list(uid, { search: ten })).data || []).some((f) => f.name === ten);
};

describe('PQ-3 — Storage anh-ho-so: chỉ ghi/sửa/xoá trong thư mục của mình; người khác và anon không đọc qua API, không ghi, không xoá', { skip: SKIP }, () => {
  before(don);
  after(don);

  test('1. cv1 tải ảnh vào thư mục <uid cv1>/ được; tải vào thư mục của cv2 bị chặn; anon bị chặn', async () => {
    const cv1 = await userClient('demo_cv1');
    const ok = await kho(cv1).upload(cua(IDS.cv1, 'goc'), blob(), { contentType: 'image/png' }); // không upsert — xem test 4
    assert.equal(ok.error, null, `cv1 tải vào thư mục mình: ${ok.error?.message}`);
    assert.ok(await tonTai(cua(IDS.cv1, 'goc')), 'tệp có trên bucket');
    const sai = await kho(cv1).upload(cua(IDS.cv2, 'cua-cv1'), blob(), { contentType: 'image/png' });
    assert.ok(sai.error, 'cv1 tải vào thư mục cv2 phải bị chặn');
    assert.equal(await tonTai(cua(IDS.cv2, 'cua-cv1')), false);
    const an = await kho(anonClient()).upload(cua(IDS.cv1, 'anon'), blob(), { contentType: 'image/png' });
    assert.ok(an.error, 'anon tải lên phải bị chặn');
    assert.equal(await tonTai(cua(IDS.cv1, 'anon')), false);
  });

  // LƯU Ý: upsert/update/remove của cv2 bị chặn hiện CHƯA chứng minh phân quyền theo thư mục — chính chủ cv1 cũng bị chặn đúng các thao tác này
  // do thiếu policy SELECT (test 4). Chỉ ca tải MỚI vào thư mục người khác (test 1, policy INSERT) đang thực sự kiểm foldername = uid.
  test('2. cv2 ghi đè (upsert/update) ảnh của cv1 bị chặn (chưa chứng minh phân quyền — xem ghi chú); xoá ảnh của cv1 → 0 tệp, tệp vẫn còn; anon xoá bị chặn', async () => {
    const cv2 = await userClient('demo_cv2');
    const de = await kho(cv2).upload(cua(IDS.cv1, 'goc'), blob(), { contentType: 'image/png', upsert: true });
    assert.ok(de.error, 'cv2 upsert đè ảnh của cv1 phải bị chặn');
    const sua = await kho(cv2).update(cua(IDS.cv1, 'goc'), blob(), { contentType: 'image/png' });
    assert.ok(sua.error, 'cv2 update ảnh của cv1 phải bị chặn');
    const xoa = await kho(cv2).remove([cua(IDS.cv1, 'goc')]);
    assert.ok(xoa.error || (xoa.data || []).length === 0, 'cv2 xoá ảnh của cv1: bị chặn hoặc 0 tệp');
    assert.ok(await tonTai(cua(IDS.cv1, 'goc')), 'ảnh của cv1 vẫn còn');
    const an = await kho(anonClient()).remove([cua(IDS.cv1, 'goc')]);
    assert.ok(an.error || (an.data || []).length === 0, 'anon xoá: bị chặn hoặc 0 tệp');
    assert.ok(await tonTai(cua(IDS.cv1, 'goc')), 'ảnh của cv1 vẫn còn sau anon');
  });

  // LƯU Ý: hiện CHÍNH CHỦ (cv1) list thư mục mình cũng rỗng do storage.objects thiếu policy SELECT (xem test 4) — nên "người khác list rỗng"
  // ở đây CHƯA chứng minh phân quyền; chỉ có giá trị khi PR RLS thêm policy SELECT cho chủ thư mục (lúc đó cv1 thấy, người khác vẫn rỗng).
  test('3. List thư mục của cv1 qua API: cv2, Chánh VP, QTHT, anon → rỗng (chưa chứng minh phân quyền — xem ghi chú)', async () => {
    for (const u of ['demo_cv2', 'demo_cvp', 'demo_qtht']) {
      const ls = await kho(await userClient(u)).list(IDS.cv1, { search: 'kl-pq3' });
      assert.equal(ls.error, null, `${u} list: ${ls.error?.message}`); assert.equal(ls.data.length, 0, `${u} list thư mục cv1 phải rỗng`);
    }
    assert.equal(((await kho(anonClient()).list(IDS.cv1, { search: 'kl-pq3' })).data || []).length, 0, 'anon list rỗng');
    const cv1 = await userClient('demo_cv1');
    assert.equal(((await kho(cv1).list(IDS.cv1, { search: 'kl-pq3' })).data || []).length, 0, 'cv1 list thư mục mình cũng rỗng [hanh-vi-hien-tai]');
  });

  // Đỏ do bucket anh-ho-so public = true (0041): download qua API (kể cả không đăng nhập) trả được ảnh của người khác.
  // PR RLS chuyển bucket riêng tư sẽ làm test này xanh.
  test('3b. [hanh-vi-hien-tai] cv2, Chánh VP, QTHT, anon download ảnh của cv1 qua API phải bị chặn — hiện KHÔNG chặn (bucket public)', { todo: 'đỏ do bucket public=true; PR RLS chuyển bucket riêng tư sẽ làm test này xanh' }, async () => {
    for (const u of ['demo_cv2', 'demo_cvp', 'demo_qtht']) {
      assert.ok((await kho(await userClient(u)).download(cua(IDS.cv1, 'goc'))).error, `${u} download ảnh của cv1 qua API phải bị chặn`);
    }
    assert.ok((await kho(anonClient()).download(cua(IDS.cv1, 'goc'))).error, 'anon download qua API phải bị chặn');
  });

  // LỖI HIỆN TẠI (phát hiện 2026-09-22, chờ PR RLS): storage.objects không có policy SELECT cho chủ thư mục → upload upsert:true
  // (đúng cách màn Cá nhân gọi, kể cả tệp MỚI), update và remove của CHÍNH CHỦ đều bị chặn/0 tệp. Test này ghi hành vi mong muốn.
  test('4. [hanh-vi-hien-tai] cv1 ghi đè (upsert) và xoá ảnh của chính mình phải được — hiện bị chặn vì thiếu policy SELECT', { todo: 'chờ PR RLS thêm policy SELECT anh-ho-so cho chủ thư mục' }, async () => {
    const cv1 = await userClient('demo_cv1');
    const de = await kho(cv1).upload(cua(IDS.cv1, 'goc'), blob(), { contentType: 'image/png', upsert: true });
    assert.equal(de.error, null, `cv1 upsert ảnh mình: ${de.error?.message}`);
    const r = await kho(cv1).remove([cua(IDS.cv1, 'goc')]);
    assert.equal(r.error, null, `cv1 xoá ảnh mình: ${r.error?.message}`);
    assert.equal(r.data.length, 1, 'xoá đúng 1 tệp');
    assert.equal(await tonTai(cua(IDS.cv1, 'goc')), false, 'tệp đã mất');
  });
});
