// 0130 (v3.32, chủ dự án quyết 26/10/2026 — CAU-HOI R-1…R-3): chủ trì theo dõi sửa minh chứng đã nộp của việc mình — mọi ô và thay tệp, mọi lúc
// (kể cả việc đã hoàn thành, đã đánh giá chất lượng — đánh giá giữ nguyên); đổi ngày văn bản → ngày hoàn thành theo; bản chụp, Diễn biến, tin người
// giao việc (người sửa không tự nhận); tệp cũ giữ trong kho (người tải lên không xoá được); tệp của việc khác / chưa tải lên bị chặn. Việc giao cho
// phòng: Trưởng phòng (người đại diện) sửa được. Bị chặn: chuyên viên khác, Trưởng phòng / Chánh VP / người giao khi không phải chủ trì, người nộp
// thay, thư ký Thường trực, minh chứng bị trả lại (22023), gỡ minh chứng (vẫn chỉ tài khoản quản trị); tài khoản quản trị thay tệp được.
// demo_e2e_tk / demo_e2e_tq bật cờ tạm (RLS chạy tuần tự — --test-concurrency=1), thu lại khi dọn. Khoá "KL-0130"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0130';
const TK = '00000000-0000-4000-8000-000000000018';   // demo_e2e_tk (thư ký Thường trực khi bật cờ)
const TQ = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq (toàn quyền khi bật cờ)
const co = (id, cot, bat) => db().from('accounts').update({ [cot]: bat }).eq('id', id);
const coMig = async () => {   // 0130: câu báo quyền mới (người không phải chủ trì, không phải quản trị)
  const r = await (await userClient('demo_cv2')).rpc('sua_minh_chung', { p_id: '00000000-0000-4000-8000-0000000000ff', p_thay_doi: { so_hieu: 'x' }, p_ly_do: 'x' });
  return /chủ trì theo dõi/.test(r.error?.message || '');
};
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.'
  : (await db().storage.getBucket('minh-chung')).error ? 'Chưa có kho tệp minh-chung (0089).' : !(await coMig()) ? 'Chưa có migration 0130.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const PDF = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');
const pdf = () => new Blob([PDF], { type: 'application/pdf' });
const kho = (c) => c.storage.from('minh-chung');
let vb = null; const v = {};
const viec = async (k, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb, noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(40), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, tao_boi: IDS.pcvp,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const tep = (k, ten) => `${v[k].id}/${KHOA}-${ten}.pdf`;
const tai = async (u, k, ten) => assertOk(await kho(await userClient(u)).upload(tep(k, ten), pdf(), { contentType: 'application/pdf' }), `tải ${ten}`);
const nop = async (u, k, so, them = {}) => assertOk(await (await userClient(u)).rpc('nop_minh_chung', { p: { nhiem_vu_id: v[k].id, so_hieu: so, ngay_van_ban: cong(-3), ...them } }), `nộp ${so}`);
const mc = async (k) => (await db().from('minh_chung').select('id').eq('nhiem_vu_id', v[k].id).order('nop_luc').limit(1).single()).data.id;
const sua = async (u, id, p, lyDo = `${KHOA} ghi nhầm`) => (await userClient(u)).rpc('sua_minh_chung', { p_id: id, p_thay_doi: p, p_ly_do: lyDo });
const doc = async (k, cot) => (await db().from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;
const tonTai = async (path) => { const [thu, ten] = path.split('/'); return ((await kho(db()).list(thu, { search: ten })).data || []).some((f) => f.name === ten); };
const don = async () => {
  await co(TK, 'thu_ky_thuong_truc', false); await co(TQ, 'toan_quyen', false);
  const cu = (await db().from('nhiem_vu').select('id').like('noi_dung', `${KHOA}%`)).data || [];
  for (const { id } of cu) {
    const { data } = await kho(db()).list(id);
    if (data?.length) await kho(db()).remove(data.map((f) => `${id}/${f.name}`));
  }
  if (cu.length) await db().from('direct_messages').delete().in('nhiem_vu_id', cu.map((x) => x.id));
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
};

describe('0130 — chủ trì theo dõi sửa minh chứng đã nộp (mọi ô, thay tệp, mọi lúc)', { skip: SKIP }, () => {
  before(async () => {
    await don();
    const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} VB`, ngay_ban_hanh: cong(-30), ngay_nhan: cong(-29) }).select('id').single();
    assertOk(r, 'văn bản'); vb = r.data.id;
    await viec('A'); await viec('C'); await viec('N');
    await viec('P', { owner_tai_khoan: null, nguoi_theo_doi: IDS.truongphong });   // việc của phòng Tổng hợp → Trưởng phòng (người đại diện, 0128)
  });
  after(don);

  test('1. Chủ trì sửa sau khi lãnh đạo đã đánh giá: số hiệu, ngày → ngày hoàn thành theo; đánh giá giữ; bản chụp; Diễn biến; tin người giao', async () => {
    await tai('demo_cv1', 'A', 'cu');
    await nop('demo_cv1', 'A', `1/BC-${KHOA}`, { tep_path: tep('A', 'cu'), tep_ten: 'ban-cu.pdf' });
    const id = await mc('A'); v.mcA = id;
    assertOk(await (await userClient('demo_pcvp')).rpc('xac_nhan_minh_chung', { p_id: id, p_hop_le: true, p_ly_do: null, p_han_nop_lai: null, p_chat_luong: 'DAT' }), 'đánh giá Đạt');
    assertOk(await sua('demo_cv1', id, { so_hieu: `1/BC-${KHOA} (sửa)`, ngay_van_ban: cong(-2) }), 'chủ trì sửa');
    assert.deepEqual(await doc('A', 'tien_do_ma, ngay_hoan_thanh, chat_luong'), { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-2), chat_luong: 'DAT' });
    const ch = (await db().from('minh_chung_lich_su').select('hanh_dong, ban_cu, ban_moi, nguoi').eq('minh_chung_id', id)).data;
    assert.deepEqual(ch.map((x) => [x.hanh_dong, x.ban_cu.ngay_van_ban, x.ban_moi.ngay_van_ban, x.nguoi]), [['SUA', cong(-3), cong(-2), IDS.cv1]]);
    const dbien = await (await userClient('demo_cv1')).from('v_dien_bien').select('loai').eq('nhiem_vu_id', v.A.id).eq('loai', 'sua_minh_chung');
    assert.equal(dbien.data.length, 1, 'Diễn biến có dòng sửa minh chứng');
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v.A.id).like('content', 'Sửa minh chứng%')).data.map((x) => x.receiver_id);
    assert.ok(tin.includes(IDS.pcvp), 'người giao việc được báo'); assert.ok(!tin.includes(IDS.cv1), 'người sửa không tự nhận tin');
  });

  test('2. Thay tệp: minh chứng trỏ tệp mới, bản chụp giữ tệp cũ, người tải lên không xoá được tệp cũ; tên tệp cắt 200 ký tự; tệp việc khác / chưa tải lên / đã gắn minh chứng khác / bỏ tệp → 22023', async () => {
    await tai('demo_cv1', 'A', 'moi');
    assertOk(await sua('demo_cv1', v.mcA, { tep_path: tep('A', 'moi'), tep_ten: 'Báo cáo bản ký.pdf' }, 'Thay bản có chữ ký'), 'thay tệp');
    const m = (await db().from('minh_chung').select('tep_path, tep_ten').eq('id', v.mcA).single()).data;
    assert.deepEqual(m, { tep_path: tep('A', 'moi'), tep_ten: 'Báo cáo bản ký.pdf' });
    const ch = (await db().from('minh_chung_lich_su').select('ban_cu').eq('minh_chung_id', v.mcA).order('id', { ascending: false }).limit(1).single()).data;
    assert.equal(ch.ban_cu.tep_path, tep('A', 'cu'), 'bản chụp giữ đường dẫn tệp cũ');
    await kho(await userClient('demo_cv1')).remove([tep('A', 'cu')]);
    assert.equal(await tonTai(tep('A', 'cu')), true, 'tệp cũ vẫn còn trong kho');
    await tai('demo_cv1', 'A', 'dai');   // thay lần hai: tệp "moi" chỉ còn bản chụp của lần này giữ
    assertOk(await sua('demo_cv1', v.mcA, { tep_path: tep('A', 'dai'), tep_ten: `${'Báo cáo '.repeat(40)}.pdf` }), 'thay tệp, tên dài');
    assert.equal((await db().from('minh_chung').select('tep_ten').eq('id', v.mcA).single()).data.tep_ten.length, 200, 'tên tệp cắt còn 200 ký tự');
    await kho(await userClient('demo_cv1')).remove([tep('A', 'moi')]);
    assert.equal(await tonTai(tep('A', 'moi')), true, 'tệp chỉ bản chụp giữ vẫn không xoá được');
    await tai('demo_cv1', 'C', 'khac'); await tai('demo_cv1', 'A', 'hai');
    await nop('demo_cv1', 'A', `2/BC-${KHOA}`, { tep_path: tep('A', 'hai'), tep_ten: 'hai.pdf' });   // minh chứng thứ hai của việc A
    for (const [p, nhan] of [[{ tep_path: tep('C', 'khac') }, 'tệp của việc khác'], [{ tep_path: tep('A', 'chua-tai') }, 'tệp chưa tải lên'],
      [{ tep_path: tep('A', 'hai') }, 'tệp đã gắn minh chứng khác'], [{ tep_path: null }, 'bỏ tệp'], [{ tep_ten: 'doi-ten.pdf' }, 'đổi tên không kèm tệp']]) {
      const r = await sua('demo_cv1', v.mcA, p); assert.equal(r.error?.code, '22023', `${nhan}: ${r.error?.message || 'không lỗi'}`);
    }
  });

  test('3. Bị chặn: chuyên viên khác, Trưởng phòng, Chánh VP, người giao, người nộp thay, thư ký Thường trực; minh chứng bị trả lại (22023); chủ trì gỡ', async () => {
    for (const u of ['demo_cv2', 'demo_truongphong', 'demo_cvp', 'demo_pcvp']) assertDenied(await sua(u, v.mcA, { trich_yeu: 'x' }), `${u} sửa`);
    await nop('demo_truongphong', 'N', `5/BC-${KHOA}`);   // Trưởng phòng nộp thay (việc do cv1 chủ trì)
    assertDenied(await sua('demo_truongphong', await mc('N'), { trich_yeu: 'x' }), 'người nộp thay sửa');
    assertOk(await co(TK, 'thu_ky_thuong_truc', true), 'cấp cờ thư ký');
    assertDenied(await sua('demo_e2e_tk', v.mcA, { trich_yeu: 'x' }), 'thư ký Thường trực sửa');
    assertOk(await co(TK, 'thu_ky_thuong_truc', false), 'thu cờ thư ký');
    await nop('demo_cv1', 'C', `3/BC-${KHOA}`);
    const idC = await mc('C');
    assertOk(await (await userClient('demo_pcvp')).rpc('xac_nhan_minh_chung', { p_id: idC, p_hop_le: false, p_ly_do: 'Thiếu phụ lục', p_han_nop_lai: null, p_chat_luong: null }), 'trả lại');
    const r = await sua('demo_cv1', idC, { trich_yeu: 'x' });
    assert.equal(r.error?.code, '22023'); assert.match(r.error.message, /bị trả lại/);
    assertDenied(await (await userClient('demo_cv1')).rpc('go_minh_chung', { p_id: v.mcA, p_ly_do: 'x' }), 'chủ trì gỡ minh chứng');
  });

  test('4. Việc giao cho phòng: Trưởng phòng (người đại diện) sửa được; chuyên viên trong phòng thì không', async () => {
    await nop('demo_truongphong', 'P', `4/BC-${KHOA}`);
    const id = await mc('P');
    assertOk(await sua('demo_truongphong', id, { trich_yeu: `${KHOA} báo cáo của phòng` }), 'Trưởng phòng sửa');
    assertDenied(await sua('demo_cv1', id, { trich_yeu: 'x' }), 'chuyên viên sửa minh chứng việc của phòng');
  });

  test('5. Tài khoản quản trị thay tệp minh chứng của việc người khác chủ trì', async () => {
    assertOk(await db().storage.from('minh-chung').upload(tep('A', 'qt'), pdf(), { contentType: 'application/pdf' }), 'tải tệp');
    assertOk(await co(TQ, 'toan_quyen', true), 'bật toàn quyền');
    try {
      assertOk(await sua('demo_e2e_tq', v.mcA, { tep_path: tep('A', 'qt'), tep_ten: 'qt.pdf' }, 'Quản trị thay bản đúng'), 'quản trị thay tệp');
      assert.equal((await db().from('minh_chung').select('tep_path').eq('id', v.mcA).single()).data.tep_path, tep('A', 'qt'));
    } finally { await co(TQ, 'toan_quyen', false); }
  });
});
