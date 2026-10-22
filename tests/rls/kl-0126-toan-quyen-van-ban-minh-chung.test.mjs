// 0126 (v3.29, chủ dự án quyết 22/10/2026 — CAU-HOI O-6): tài khoản toàn quyền sửa văn bản giao việc (van_ban_sua — việc "theo ngày ký" tính lại hạn,
// ngày nhận chép từ văn bản đổi theo — không sau ngày hoàn thành của việc, xoá thì về ước tính; nhật ký mỗi việc + nhật ký hệ thống; chặn: ngày ban
// hành sau hạn của việc, Kết luận BTV thiếu số hội nghị, đổi sang Thông báo khi còn việc "Không thuộc", trùng văn bản) và sửa / gỡ minh chứng đã nộp
// (bản chụp minh_chung_lich_su; sửa ngày văn bản của minh chứng hợp lệ → ngày hoàn thành theo; gỡ minh chứng hợp lệ cuối cùng → việc mở lại, không
// phải cuối cùng → ngày hoàn thành theo minh chứng còn lại; tệp của minh chứng đã gỡ người tải lên không xoá được). Chánh VP thật, chủ trì bị chặn;
// bản chụp đọc theo phạm vi, không ghi thẳng. demo_e2e_tq bật cờ tạm. Khoá "KL-0126"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, assertDenied, IDS, homNayVN } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0126';
const TQ = '00000000-0000-4000-8000-000000000020';   // demo_e2e_tq
const coBang = async () => !(await db().from('minh_chung_lich_su').select('id').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0126.' : false;
const cong = (n) => { const d = new Date(`${homNayVN()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const vn = (iso) => iso.split('-').reverse().join('/');
const BH = cong(-50); const NHAN = cong(-49);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n');
const kho = (c) => c.storage.from('minh-chung');
const vb = {}; const v = {};
const viec = async (k, b, them = {}) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: vb[b], noi_dung: `${KHOA} ${k}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: cong(60), nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', theo_1400: true, owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, tao_boi: IDS.pcvp,
    san_pham_loai: 'BAO_CAO', cap_nhan_san_pham: 'TRUONG_PHONG', nguon_nhiem_vu_ma: 'NHIEM_VU_PHAT_SINH', ...them }).select('id, ma').single();
  assertOk(r, `việc ${k}`); v[k] = r.data;
};
const vbs = async (u, b, p, lyDo = 'Nhập sai số hiệu') => (await userClient(u)).rpc('van_ban_sua', { p_id: vb[b], p_thay_doi: p, p_ly_do: lyDo });
const doc = async (k, cot) => (await db().from('nhiem_vu').select(cot).eq('id', v[k].id).single()).data;
const co = (bat) => db().from('accounts').update({ toan_quyen: bat }).eq('id', TQ);
const tep = (ten) => `${v.M4?.id}/${KHOA}-${ten}.pdf`;
const don = async () => {
  await co(false);
  if (v.M4) await kho(db()).remove([tep('bc'), tep('khac')]).catch(() => null);
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  await db().from('nhat_ky_he_thong').delete().eq('hanh_dong', 'sua_van_ban').like('doi_tuong', `${KHOA}%`);
};

describe('0126 — toàn quyền sửa văn bản giao, sửa / gỡ minh chứng', { skip: SKIP }, () => {
  before(async () => {
    await don();
    for (const b of ['A', 'B', 'C', 'D']) {
      const r = await db().from('van_ban_giao_viec').insert({ loai: 'CONG_VAN', so_ket_luan: `${KHOA} ${b}`, ngay_ban_hanh: BH, ngay_nhan: NHAN }).select('id').single();
      assertOk(r, `văn bản ${b}`); vb[b] = r.data.id;
    }
    await viec('A', 'A'); await viec('KY', 'A', { loai_thoi_han_ma: 'KY_BAN_HANH', han_xu_ly: null }); await viec('KT', 'B', { nganh_ma: 'KHONG_THUOC', linh_vuc_ma: null });
    await viec('H', 'C', { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-40), nguon: 'excel' });
    for (const k of ['M2', 'M3', 'M4']) await viec(k, 'D');
    assertOk(await co(true), 'bật toàn quyền');
  });
  after(don);

  test('1. Văn bản: Chánh VP bị chặn; toàn quyền sửa số, trích yếu, ngày ban hành + ngày nhận → hạn "theo ngày ký", ngày nhận của việc theo; nhật ký', async () => {
    assertDenied(await vbs('demo_cvp', 'A', { so_ket_luan: `${KHOA} A-SUA` }), 'Chánh VP');
    assertOk(await vbs('demo_e2e_tq', 'A', { so_ket_luan: `${KHOA} A-SUA`, trich_yeu: 'Về việc thử', ngay_ban_hanh: cong(-45), ngay_nhan: cong(-44) }), 'toàn quyền');
    assert.deepEqual(await doc('KY', 'han_xu_ly, ngay_nhan_van_ban'), { han_xu_ly: cong(-35), ngay_nhan_van_ban: cong(-44) });
    assert.equal((await doc('A', 'ngay_nhan_van_ban')).ngay_nhan_van_ban, cong(-44));
    const ls = (await db().from('lich_su').select('gia_tri_moi').eq('nhiem_vu_id', v.A.id).eq('cot', 'van_ban_sua')).data;
    assert.deepEqual(ls.map((l) => l.gia_tri_moi), [`Sửa văn bản giao ${KHOA} A — số / ký hiệu: ${KHOA} A → ${KHOA} A-SUA; ngày ban hành: ${vn(BH)} → ${vn(cong(-45))}; `
      + `ngày nhận: ${vn(NHAN)} → ${vn(cong(-44))}; trích yếu: (trống) → Về việc thử — lý do: Nhập sai số hiệu`]);
    const nk = await db().from('nhat_ky_he_thong').select('chi_tiet').eq('hanh_dong', 'sua_van_ban').eq('doi_tuong', `${KHOA} A`);
    assert.equal(nk.data.length, 1);
  });

  test('2. Văn bản — lỗi 22023: ngày ban hành sau hạn của việc, Kết luận BTV thiếu số hội nghị, đổi sang Thông báo khi còn việc "Không thuộc", trùng, không đổi gì', async () => {
    const LOI = [['A', { ngay_ban_hanh: cong(70), ngay_nhan: cong(70) }], ['A', { loai: 'KL_BTV' }], ['B', { loai: 'TB_THUONG_TRUC' }],
      ['B', { so_ket_luan: `${KHOA} A-SUA`, ngay_ban_hanh: cong(-45), ngay_nhan: cong(-44) }], ['A', { so_ket_luan: `${KHOA} A-SUA` }], ['A', { ma: 'x' }]];
    for (const [b, p] of LOI) { const r = await vbs('demo_e2e_tq', b, p); assert.ok(r.error, JSON.stringify(p)); assert.equal(r.error.code, '22023', `${JSON.stringify(p)}: ${r.error.message}`); }
    assertOk(await vbs('demo_e2e_tq', 'A', { loai: 'KL_BTV', so_hoi_nghi: 126 }), 'Kết luận BTV kèm số hội nghị');
  });

  test('3. Minh chứng: chủ trì nộp → hoàn thành; Chánh VP không sửa; toàn quyền sửa ngày → ngày hoàn thành theo, bản chụp, Diễn biến, tin chủ trì', async () => {
    assertOk(await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: v.A.id, so_hieu: `5/BC-${KHOA}`, ngay_van_ban: cong(-3) } }), 'nộp');
    const mc = (await db().from('minh_chung').select('id').eq('nhiem_vu_id', v.A.id).single()).data.id;
    v.mc = mc;
    assertDenied(await (await userClient('demo_cvp')).rpc('sua_minh_chung', { p_id: mc, p_thay_doi: { so_hieu: 'x' }, p_ly_do: 'x' }), 'Chánh VP sửa');
    assertOk(await (await userClient('demo_e2e_tq')).rpc('sua_minh_chung', { p_id: mc, p_thay_doi: { so_hieu: `5/BC-${KHOA} (sửa)`, ngay_van_ban: cong(-2) }, p_ly_do: 'Ghi sai ngày' }), 'toàn quyền sửa');
    assert.equal((await doc('A', 'ngay_hoan_thanh')).ngay_hoan_thanh, cong(-2));
    const ch = (await db().from('minh_chung_lich_su').select('hanh_dong, ban_cu, ban_moi, ly_do').eq('minh_chung_id', mc)).data;
    assert.deepEqual(ch.map((x) => [x.hanh_dong, x.ban_cu.ngay_van_ban, x.ban_moi.ngay_van_ban, x.ly_do]), [['SUA', cong(-3), cong(-2), 'Ghi sai ngày']]);
    const db1 = await (await userClient('demo_cv1')).from('v_dien_bien').select('loai').eq('nhiem_vu_id', v.A.id).eq('loai', 'sua_minh_chung');
    assert.equal(db1.data.length, 1, 'Diễn biến có dòng sửa minh chứng');
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v.A.id).like('content', 'Sửa minh chứng%')).data.map((x) => x.receiver_id);
    assert.ok(tin.includes(IDS.cv1), 'chủ trì được báo');
  });

  test('4. Gỡ minh chứng hợp lệ cuối cùng → việc mở lại, bản chụp; bản chụp: chủ trì đọc được, người ngoài phạm vi không, không ai ghi thẳng', async () => {
    assertDenied(await (await userClient('demo_cv1')).rpc('go_minh_chung', { p_id: v.mc, p_ly_do: 'x' }), 'chủ trì gỡ');
    const r = await (await userClient('demo_e2e_tq')).rpc('go_minh_chung', { p_id: v.mc, p_ly_do: 'Nộp nhầm văn bản' });
    assertOk(r, 'gỡ'); assert.deepEqual(r.data, { mo_lai: true });
    assert.deepEqual(await doc('A', 'tien_do_ma, ngay_hoan_thanh'), { tien_do_ma: 'DANG_THUC_HIEN', ngay_hoan_thanh: null });
    assert.equal((await db().from('minh_chung').select('id').eq('id', v.mc)).data.length, 0);
    const doc2 = async (u) => ((await (await userClient(u)).from('minh_chung_lich_su').select('hanh_dong').eq('nhiem_vu_id', v.A.id)).data || []).map((x) => x.hanh_dong).sort();
    assert.deepEqual(await doc2('demo_cv1'), ['GO', 'SUA']); assert.deepEqual(await doc2('demo_cv2'), []);
    assertDenied(await (await userClient('demo_e2e_tq')).from('minh_chung_lich_su').insert({ minh_chung_id: v.mc, nhiem_vu_id: v.A.id, hanh_dong: 'GO', ban_cu: {}, ly_do: 'x' }), 'ghi thẳng bản chụp');
  });

  test('5. Ngày nhận văn bản: không dời sau ngày hoàn thành của việc theo văn bản; dời trong giới hạn → việc theo; xoá → việc về ước tính (= ngày ban hành)', async () => {
    const r = await vbs('demo_e2e_tq', 'C', { ngay_nhan: cong(-35) }, 'Ngày nhận ghi nhầm');
    assert.equal(r.error?.code, '22023', 'ngày nhận sau ngày hoàn thành'); assert.match(r.error.message, /Ngày nhận mới/);
    assertOk(await vbs('demo_e2e_tq', 'C', { ngay_nhan: cong(-45) }, 'Ngày nhận ghi nhầm'), 'dời ngày nhận');
    assert.deepEqual(await doc('H', 'ngay_nhan_van_ban, ngay_nhan_uoc_tinh'), { ngay_nhan_van_ban: cong(-45), ngay_nhan_uoc_tinh: false });
    assertOk(await vbs('demo_e2e_tq', 'C', { ngay_nhan: null }, 'Không rõ ngày nhận'), 'xoá ngày nhận');
    assert.deepEqual(await doc('H', 'ngay_nhan_van_ban, ngay_nhan_uoc_tinh'), { ngay_nhan_van_ban: BH, ngay_nhan_uoc_tinh: true });
  });

  test('6. Nhiều minh chứng: sửa ngày của minh chứng đã bị trả lại không đổi ngày hoàn thành; gỡ minh chứng (không phải cuối cùng) quyết định ngày hoàn thành → theo minh chứng còn lại', async () => {
    const nop = async (k, so, ngay) => assertOk(await (await userClient('demo_cv1')).rpc('nop_minh_chung', { p: { nhiem_vu_id: v[k].id, so_hieu: `${so}/BC-${KHOA}`, ngay_van_ban: ngay } }), `nộp ${so}`);
    const mcId = async (k, so) => (await db().from('minh_chung').select('id').eq('nhiem_vu_id', v[k].id).eq('so_hieu', `${so}/BC-${KHOA}`).single()).data.id;
    await nop('M2', 21, cong(-6)); await nop('M2', 22, cong(-4));
    assertOk(await (await userClient('demo_pcvp')).rpc('xac_nhan_minh_chung', { p_id: await mcId('M2', 21), p_hop_le: false, p_ly_do: 'Thiếu phụ lục' }), 'trả lại 21');
    assertOk(await (await userClient('demo_e2e_tq')).rpc('sua_minh_chung', { p_id: await mcId('M2', 21), p_thay_doi: { ngay_van_ban: cong(-5) }, p_ly_do: 'Ghi sai ngày' }), 'sửa minh chứng bị trả lại');
    assert.deepEqual(await doc('M2', 'tien_do_ma, ngay_hoan_thanh'), { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-6) });
    await nop('M3', 31, cong(-6)); await nop('M3', 32, cong(-4));
    const r = await (await userClient('demo_e2e_tq')).rpc('go_minh_chung', { p_id: await mcId('M3', 31), p_ly_do: 'Nộp nhầm' });
    assertOk(r, 'gỡ 31'); assert.deepEqual(r.data, { mo_lai: false });
    assert.deepEqual(await doc('M3', 'tien_do_ma, ngay_hoan_thanh'), { tien_do_ma: 'HOAN_THANH', ngay_hoan_thanh: cong(-4) });
    const tin = (await db().from('direct_messages').select('receiver_id').eq('nhiem_vu_id', v.M3.id).like('content', 'Gỡ minh chứng%')).data.map((x) => x.receiver_id);
    assert.ok(tin.includes(IDS.cv1), 'người nộp được báo');
  });

  test('7. Tệp của minh chứng đã gỡ (còn trong bản chụp): người tải lên không xoá được; tệp chưa gắn xoá được', async () => {
    const c = await userClient('demo_cv1');
    for (const t of ['bc', 'khac']) assertOk(await kho(c).upload(tep(t), new Blob([PDF], { type: 'application/pdf' }), { contentType: 'application/pdf' }), `tải ${t}`);
    assertOk(await c.rpc('nop_minh_chung', { p: { nhiem_vu_id: v.M4.id, so_hieu: `41/BC-${KHOA}`, ngay_van_ban: cong(-3), tep_path: tep('bc') } }), 'nộp kèm tệp');
    const mc = (await db().from('minh_chung').select('id').eq('nhiem_vu_id', v.M4.id).single()).data.id;
    assertOk(await (await userClient('demo_e2e_tq')).rpc('go_minh_chung', { p_id: mc, p_ly_do: 'Nộp nhầm tệp' }), 'gỡ');
    await kho(c).remove([tep('bc'), tep('khac')]);
    const con = ((await kho(db()).list(v.M4.id)).data || []).map((f) => f.name);
    assert.deepEqual(con, [`${KHOA}-bc.pdf`], 'tệp của minh chứng đã gỡ còn, tệp chưa gắn đã xoá');
    assertOk(await co(false), 'tắt toàn quyền');
  });
});
