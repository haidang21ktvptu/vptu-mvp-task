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

describe('PQ-3 — Storage anh-ho-so: chỉ ghi/sửa/xoá trong thư mục của mình; mọi người đã đăng nhập đọc được, anon không', { skip: SKIP }, () => {
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

  test('3. List thư mục của cv1 qua API: cv1 (chủ), cv2, Chánh VP, QTHT (đã đăng nhập) thấy đúng tệp; anon → rỗng', async () => {
    for (const u of ['demo_cv1', 'demo_cv2', 'demo_cvp', 'demo_qtht']) {
      const ls = await kho(await userClient(u)).list(IDS.cv1, { search: 'kl-pq3-goc' });
      assert.equal(ls.error, null, `${u} list: ${ls.error?.message}`);
      assert.deepEqual(ls.data.map((f) => f.name), ['kl-pq3-goc.png'], `${u} list thư mục cv1 thấy đúng tệp`);
    }
    assert.equal(((await kho(anonClient()).list(IDS.cv1, { search: 'kl-pq3' })).data || []).length, 0, 'anon list rỗng');
  });

  test('3b. Bucket riêng tư (Q5 a): cv2, Chánh VP, QTHT download ảnh của cv1 được; anon download bị chặn; URL công khai không mở được', async () => {
    for (const u of ['demo_cv2', 'demo_cvp', 'demo_qtht']) {
      const r = await kho(await userClient(u)).download(cua(IDS.cv1, 'goc'));
      assert.equal(r.error, null, `${u} download ảnh của cv1: ${r.error?.message}`);
    }
    assert.ok((await kho(anonClient()).download(cua(IDS.cv1, 'goc'))).error, 'anon download qua API phải bị chặn');
    const cong = kho(anonClient()).getPublicUrl(cua(IDS.cv1, 'goc')).data.publicUrl;
    assert.ok((await fetch(cong)).status >= 400, 'URL công khai phải trả lỗi (bucket riêng tư)');
  });

  test('3c. Signed URL: cv2 (đã đăng nhập) tạo signed URL ảnh của cv1 và mở được; anon không tạo được', async () => {
    const s = await kho(await userClient('demo_cv2')).createSignedUrl(cua(IDS.cv1, 'goc'), 60);
    assert.equal(s.error, null, `cv2 tạo signed URL: ${s.error?.message}`);
    assert.equal((await fetch(s.data.signedUrl)).status, 200, 'signed URL mở được');
    assert.ok((await kho(anonClient()).createSignedUrl(cua(IDS.cv1, 'goc'), 60)).error, 'anon tạo signed URL phải bị chặn');
  });

  test('4. cv1 ghi đè (upsert) và xoá ảnh của chính mình được (policy SELECT cho chủ thư mục — 0052)', async () => {
    const cv1 = await userClient('demo_cv1');
    const de = await kho(cv1).upload(cua(IDS.cv1, 'goc'), blob(), { contentType: 'image/png', upsert: true });
    assert.equal(de.error, null, `cv1 upsert ảnh mình: ${de.error?.message}`);
    const r = await kho(cv1).remove([cua(IDS.cv1, 'goc')]);
    assert.equal(r.error, null, `cv1 xoá ảnh mình: ${r.error?.message}`);
    assert.equal(r.data.length, 1, 'xoá đúng 1 tệp');
    assert.equal(await tonTai(cua(IDS.cv1, 'goc')), false, 'tệp đã mất');
  });
});
