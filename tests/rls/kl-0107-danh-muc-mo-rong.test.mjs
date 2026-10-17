// 0107–0109 (v3.25, chủ dự án duyệt 17/10/2026): danh mục mục tiêu "thêm nhanh, sửa có kiểm soát, không xoá". Kiểm:
// (1) nhóm là danh mục (5 nhóm, có Nghị quyết Tỉnh ủy), số hiệu các nghị quyết Trung ương, kl_danh_muc trả nhomMucTieu; anon không đọc; không ai
//     ghi thẳng dm_muc_tieu / dm_nhom_muc_tieu / quy_tac_muc_tieu;
// (2) them_muc_tieu — chuyên viên thêm được (MOI, có quy tắc số hiệu tích sẵn), chặn trùng số hiệu theo khoá ('09901-nq/tw' ≡ '9901-NQ/TW') và trùng
//     tên không dấu, số hiệu sai nhóm → 22023; Thường trực bị chặn; nhật ký 'them' — chuyên viên đọc được nhật ký danh mục, Thường trực không;
// (3) them_muc_tieu_tu_dong — Thường trực (đang giao việc) cũng tự thêm được; gọi lại trả mã sẵn có; số hiệu không thuộc nhóm nào → 22023;
// (4) sửa — người thêm sửa được mục MOI của mình, không sửa được mục khởi tạo; quản trị hệ thống sửa, khoá (đã đối chiếu) → không ai sửa được, mở
//     khoá → khôi phục lần sửa trước; Trưởng phòng không khoá được;
// (5) gộp — gắn của việc chuyển sang mục giữ lại (nguồn GOP), mục bị gộp ngừng dùng; không gộp vào mục đã gộp; tự thêm theo số hiệu của mục đã gộp
//     trả mục giữ lại (không sinh mục trùng);
// (6) nhóm, khối, quy tắc — chỉ quản trị hệ thống; lĩnh vực có khối riêng; khối còn ngành không ngừng dùng được. Khoá dữ liệu số hiệu 99xx, tên
//     "KL-0107"; tự dọn.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, anonClient, userClient, assertOk, assertDenied, homNayVN, IDS } from './lib.mjs';
import { klSchemaReady } from './fixtures-kl.mjs';

const db = () => adminClient();
const KHOA = 'KL-0107';
const coBang = async () => !(await db().from('dm_nhom_muc_tieu').select('ma').limit(1)).error;
const SKIP = !(await klSchemaReady()) ? 'Chưa có migration KL trên project này.' : !(await coBang()) ? 'Chưa có migration 0107 (dm_nhom_muc_tieu).' : false;
const goi = async (u, ham, thamSo) => (await userClient(u)).rpc(ham, thamSo);
const ma = (r, label) => { assert.ok(r.error, `${label}: phải lỗi`); return r.error.code; };
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tao = [];   // mã mục tiêu tạo trong bài
const don = async () => {
  const ds = [...new Set([...tao, ...((await db().from('dm_muc_tieu').select('ma').or(`ten.like.${KHOA}%,so_hieu.like.990%`)).data || []).map((x) => x.ma)])];
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('van_ban_giao_viec').delete().like('so_ket_luan', `${KHOA}%`);
  if (ds.length) {
    await db().from('dm_muc_tieu').update({ gop_vao: null }).in('gop_vao', ds);
    await db().from('dm_lich_su').delete().eq('bang', 'dm_muc_tieu').in('ma', ds);
    await db().from('dm_muc_tieu').delete().in('ma', ds);
  }
  await db().from('dm_lich_su').delete().like('ly_do', `${KHOA}%`);
  await db().from('dm_nhom_muc_tieu').delete().like('ten', `${KHOA}%`);
  await db().from('dm_khoi_linh_vuc').delete().like('ten', `${KHOA}%`);
  await db().from('dm_linh_vuc').update({ khoi_ma: null }).eq('ma', 'LV05_DOI_NGOAI_DANG');
};

describe('0107–0109 — danh mục mục tiêu mở rộng, quyền thêm / sửa / khoá / gộp', { skip: SKIP }, () => {
  before(don);
  after(don);

  test('1. Nhóm là danh mục; số hiệu nghị quyết; kl_danh_muc trả nhomMucTieu; anon không đọc; không ghi thẳng', async () => {
    const n = await db().from('dm_nhom_muc_tieu').select('ma, mau_so_hieu').order('thu_tu');
    assert.deepEqual(n.data.map((x) => x.ma).slice(0, 5), ['DOT_PHA', 'CHUONG_TRINH', 'NQ_TW', 'NQ_TU', 'CHI_TIEU']);
    const nq = await db().from('dm_muc_tieu').select('ma, so_hieu').eq('nhom', 'NQ_TW').eq('nguon_them', 'KHOI_TAO');
    assert.equal(nq.data.find((x) => x.ma === 'NQ_57')?.so_hieu, '57-NQ/TW');
    assert.equal(nq.data.filter((x) => x.so_hieu).length, 9, '9 nghị quyết có số hiệu (Nghị quyết Đại hội XIV không có)');
    const dm = await goi('demo_cv1', 'kl_danh_muc', {}); assertOk(dm, 'kl_danh_muc');
    assert.ok(dm.data.nhomMucTieu.length >= 5); assert.ok('khoi_ma' in dm.data.linhVuc[0]); assert.ok('so_hieu' in dm.data.mucTieu[0]);
    assert.ok((await anonClient().from('dm_nhom_muc_tieu').select('ma')).error, 'anon');
    const cv = await userClient('demo_cv1'); const qt = await userClient('demo_qtht');
    for (const [c, ten] of [[cv, 'cv1'], [qt, 'qtht']]) {
      assertDenied(await c.from('dm_muc_tieu').insert({ ma: 'X_THANG', nhom: 'NQ_TW', ten: 'x', ten_ngan: 'x', thu_tu: 1 }).select('ma'), `${ten} insert dm_muc_tieu`);
      assertDenied(await c.from('quy_tac_muc_tieu').insert({ muc_tieu_ma: 'NQ_57', loai: 'TU_KHOA', gia_tri: 'abc' }).select('id'), `${ten} insert quy tắc`);
      assertDenied(await c.from('dm_nhom_muc_tieu').insert({ ma: 'XX', ten: 'x', tab: 'x', thu_tu: 9 }).select('ma'), `${ten} insert nhóm`);
      const u = await c.from('dm_muc_tieu').update({ ten: 'đổi thẳng' }).eq('ma', 'NQ_57').select('ma');
      assert.ok(u.error || !u.data?.length, `${ten} update thẳng không có tác dụng`);
    }
  });

  test('2. them_muc_tieu: chuyên viên thêm (MOI + quy tắc số hiệu), chặn trùng số hiệu / tên, sai nhóm; Thường trực bị chặn; nhật ký', async () => {
    const r = await goi('demo_cv1', 'them_muc_tieu', { p_nhom: 'NQ_TW', p_ten: `${KHOA} Nghị quyết số 9901-NQ/TW về thử nghiệm`, p_ten_ngan: `${KHOA} NQ 9901`, p_so_hieu: '9901-nq/tw', p_ly_do: `${KHOA} thêm` });
    assertOk(r, 'thêm'); tao.push(r.data); assert.equal(r.data, 'NQ_9901');
    const d = await db().from('dm_muc_tieu').select('so_hieu, trang_thai, nguon_them, tao_boi').eq('ma', r.data).single();
    assert.deepEqual(d.data, { so_hieu: '9901-NQ/TW', trang_thai: 'MOI', nguon_them: 'NGUOI_DUNG', tao_boi: IDS.cv1 });
    const q = await db().from('quy_tac_muc_tieu').select('loai, gia_tri, muc').eq('muc_tieu_ma', r.data);
    assert.deepEqual(q.data, [{ loai: 'SO_HIEU', gia_tri: '9901-NQ/TW', muc: 'TU_TICH' }]);
    assert.equal(ma(await goi('demo_cv1', 'them_muc_tieu', { p_nhom: 'NQ_TW', p_ten: 'khác', p_so_hieu: '09901-NQ/TW' }), 'trùng số hiệu'), '23505');
    assert.equal(ma(await goi('demo_truongphong', 'them_muc_tieu', { p_nhom: 'NQ_TW', p_ten: `${KHOA.toLowerCase()} nq 9901` }), 'trùng tên không dấu'), '23505');
    assert.equal(ma(await goi('demo_cv1', 'them_muc_tieu', { p_nhom: 'NQ_TW', p_ten: `${KHOA} sai nhóm`, p_so_hieu: '9902-NQ/TU' }), 'sai nhóm'), '22023');
    assert.equal(ma(await goi('demo_a0', 'them_muc_tieu', { p_nhom: 'NQ_TW', p_ten: `${KHOA} A0` }), 'Thường trực'), '42501');
    const ls = await (await userClient('demo_cv1')).from('dm_lich_su').select('hanh_dong, nguoi').eq('bang', 'dm_muc_tieu').eq('ma', r.data);
    assertOk(ls, 'cv1 đọc nhật ký'); assert.deepEqual(ls.data, [{ hanh_dong: 'them', nguoi: IDS.cv1 }]);
    const a0 = await (await userClient('demo_a0')).from('dm_lich_su').select('id').eq('ma', r.data);
    assert.equal((a0.data || []).length, 0, 'Thường trực không đọc nhật ký danh mục');
  });

  test('3. them_muc_tieu_tu_dong: Thường trực tự thêm được, gọi lại trả mã cũ; số hiệu không thuộc nhóm nào → 22023', async () => {
    const r = await goi('demo_a0', 'them_muc_tieu_tu_dong', { p_so_hieu: '9903-CTr/TU', p_ve: 'về thử nghiệm tự thêm' });
    assertOk(r, 'tự thêm'); tao.push(r.data.ma);
    assert.deepEqual(r.data, { ma: 'CTRTU_9903', moi: true });
    const d = await db().from('dm_muc_tieu').select('nhom, ten, ten_ngan, nguon_them').eq('ma', r.data.ma).single();
    assert.deepEqual(d.data, { nhom: 'NQ_TU', ten: 'Chương trình số 9903-CTr/TU về thử nghiệm tự thêm', ten_ngan: 'Chương trình 9903-CTr/TU', nguon_them: 'TU_DONG' });
    const lai = await goi('demo_cv1', 'them_muc_tieu_tu_dong', { p_so_hieu: '09903-ctr/tu' }); assertOk(lai, 'gọi lại');
    assert.deepEqual(lai.data, { ma: 'CTRTU_9903', moi: false });
    assert.equal(ma(await goi('demo_cv1', 'them_muc_tieu_tu_dong', { p_so_hieu: '9904-KL/TW' }), 'không thuộc nhóm'), '22023');
  });

  test('4. Sửa: người thêm sửa mục MOI của mình; quản trị sửa, khoá, mở khoá, khôi phục; Trưởng phòng không khoá được', async () => {
    assertOk(await goi('demo_cv1', 'sua_muc_tieu', { p_ma: 'NQ_9901', p: { mo_ta: 'Thử nghiệm' }, p_ly_do: `${KHOA} sửa mô tả` }), 'người thêm sửa');
    assert.equal(ma(await goi('demo_cv1', 'sua_muc_tieu', { p_ma: 'NQ_57', p: { mo_ta: 'sai' }, p_ly_do: `${KHOA} x` }), 'chuyên viên sửa mục khởi tạo'), '42501');
    assert.equal(ma(await goi('demo_cv2', 'sua_muc_tieu', { p_ma: 'NQ_9901', p: { mo_ta: 'khác' }, p_ly_do: `${KHOA} x` }), 'người khác sửa'), '42501');
    assertOk(await goi('demo_qtht', 'sua_muc_tieu', { p_ma: 'NQ_9901', p: { ten_ngan: `${KHOA} NQ 9901 (sửa)` }, p_ly_do: `${KHOA} quản trị sửa` }), 'quản trị sửa');
    assert.equal(ma(await goi('demo_qtht', 'sua_muc_tieu', { p_ma: 'NQ_9901', p: { ten_ngan: `${KHOA} NQ 9901 (sửa)` }, p_ly_do: `${KHOA} y hệt` }), 'không đổi'), '22023');
    assert.equal(ma(await goi('demo_truongphong', 'dat_trang_thai_muc_tieu', { p_ma: 'NQ_9901', p_hanh_dong: 'khoa', p_ly_do: `${KHOA} khoá` }), 'TP khoá'), '42501');
    assertOk(await goi('demo_qtht', 'dat_trang_thai_muc_tieu', { p_ma: 'NQ_9901', p_hanh_dong: 'khoa', p_ly_do: `${KHOA} đã đối chiếu` }), 'khoá');
    assert.equal(ma(await goi('demo_qtht', 'sua_muc_tieu', { p_ma: 'NQ_9901', p: { mo_ta: 'đổi' }, p_ly_do: `${KHOA} sửa khi khoá` }), 'sửa khi khoá'), '42501');
    assertOk(await goi('demo_qtht', 'dat_trang_thai_muc_tieu', { p_ma: 'NQ_9901', p_hanh_dong: 'mo_khoa', p_ly_do: `${KHOA} mở khoá` }), 'mở khoá');
    const sua = await db().from('dm_lich_su').select('id').eq('bang', 'dm_muc_tieu').eq('ma', 'NQ_9901').eq('hanh_dong', 'sua').order('id', { ascending: false }).limit(1).single();
    assertOk(await goi('demo_qtht', 'khoi_phuc_muc_tieu', { p_lich_su: sua.data.id, p_ly_do: `${KHOA} khôi phục` }), 'khôi phục');
    const d = await db().from('dm_muc_tieu').select('ten_ngan, mo_ta, trang_thai').eq('ma', 'NQ_9901').single();
    assert.deepEqual(d.data, { ten_ngan: `${KHOA} NQ 9901`, mo_ta: 'Thử nghiệm', trang_thai: 'MOI' });
    const hd = (await db().from('dm_lich_su').select('hanh_dong').eq('ma', 'NQ_9901').order('id')).data.map((x) => x.hanh_dong);
    assert.deepEqual(hd, ['them', 'sua', 'sua', 'khoa', 'mo_khoa', 'khoi_phuc']);
  });

  test('5. Gộp: gắn của việc chuyển sang mục giữ lại (GOP), mục bị gộp ngừng dùng; không gộp vào mục đã gộp; chuyên viên bị chặn', async () => {
    const hom = homNayVN();
    const g = await goi('demo_cvp', 'giao_viec', { p: { noi_dung: `${KHOA} việc gộp`, van_ban: { loai: 'CONG_VAN', so_ket_luan: `${KHOA}/1`, ngay_ban_hanh: cong(hom, -5), ngay_nhan: cong(hom, -5) },
      owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.truongphong, san_pham_loai: 'BAO_CAO', han_xu_ly: cong(hom, 30) } });
    assertOk(g, 'giao'); const id = g.data.id;
    assertOk(await goi('demo_cvp', 'gan_muc_tieu', { p_id: id, p_ma: ['CTRTU_9903'] }), 'gắn mục sẽ bị gộp');
    assert.equal(ma(await goi('demo_cv1', 'gop_muc_tieu', { p_tu: 'CTRTU_9903', p_vao: 'NQ_9901', p_ly_do: `${KHOA} gộp` }), 'chuyên viên gộp'), '42501');
    const r = await goi('demo_qtht', 'gop_muc_tieu', { p_tu: 'CTRTU_9903', p_vao: 'NQ_9901', p_ly_do: `${KHOA} gộp trùng` });
    assertOk(r, 'gộp'); assert.deepEqual(r.data, { so_viec: 1, so_van_ban: 0 });
    const m = await db().from('nhiem_vu_muc_tieu').select('muc_tieu_ma, nguon').eq('nhiem_vu_id', id);
    assert.deepEqual(m.data, [{ muc_tieu_ma: 'NQ_9901', nguon: 'GOP' }]);
    const d = await db().from('dm_muc_tieu').select('dang_dung, gop_vao').eq('ma', 'CTRTU_9903').single();
    assert.deepEqual(d.data, { dang_dung: false, gop_vao: 'NQ_9901' });
    assert.equal(ma(await goi('demo_qtht', 'gop_muc_tieu', { p_tu: 'NQ_9901', p_vao: 'CTRTU_9903', p_ly_do: `${KHOA} ngược` }), 'gộp vào mục đã gộp'), '22023');
    const lai = await goi('demo_cv1', 'them_muc_tieu_tu_dong', { p_so_hieu: '9903-CTr/TU' }); assertOk(lai, 'tự thêm số hiệu của mục đã gộp');
    assert.deepEqual(lai.data, { ma: 'NQ_9901', moi: false }, 'trả mục giữ lại, không sinh mục trùng');
  });

  test('6. Nhóm, khối, quy tắc: chỉ quản trị hệ thống; lĩnh vực có khối riêng (kl_danh_muc trả khoi_ma)', async () => {
    assert.equal(ma(await goi('demo_cvp', 'them_nhom_muc_tieu', { p_ten: `${KHOA} nhóm`, p_tab: 'Thử', p_mau_so_hieu: null, p_ly_do: `${KHOA} x` }), 'Chánh VP thêm nhóm'), '42501');
    const n = await goi('demo_qtht', 'them_nhom_muc_tieu', { p_ten: `${KHOA} nhóm chỉ thị`, p_tab: `${KHOA} Chỉ thị`, p_mau_so_hieu: '^[0-9]{1,5}-CT/TW$', p_ly_do: `${KHOA} thêm nhóm` });
    assertOk(n, 'quản trị thêm nhóm');
    assert.equal(ma(await goi('demo_qtht', 'them_nhom_muc_tieu', { p_ten: `${KHOA} nhóm sai`, p_tab: 'Sai', p_mau_so_hieu: '([', p_ly_do: `${KHOA} x` }), 'dạng số hiệu sai cú pháp'), '2201B');
    const k = await goi('demo_qtht', 'them_khoi_linh_vuc', { p_ten: `${KHOA} khối thử`, p_ly_do: `${KHOA} thêm khối` }); assertOk(k, 'thêm khối');
    assert.equal(ma(await goi('demo_qtht', 'sua_khoi_linh_vuc', { p_ma: 'XAY_DUNG_DANG', p: { dang_dung: false }, p_ly_do: `${KHOA} x` }), 'ngừng khối còn ngành'), '22023');
    assertOk(await goi('demo_qtht', 'sua_khoi_linh_vuc', { p_ma: k.data, p: { dang_dung: false }, p_ly_do: `${KHOA} ngừng khối trống` }), 'ngừng khối trống');
    assert.equal(ma(await goi('demo_truongphong', 'dat_khoi_linh_vuc', { p_bang: 'dm_linh_vuc', p_ma: 'LV05_DOI_NGOAI_DANG', p_khoi: 'XAY_DUNG_DANG', p_ly_do: `${KHOA} x` }), 'TP đặt khối'), '42501');
    assertOk(await goi('demo_qtht', 'dat_khoi_linh_vuc', { p_bang: 'dm_linh_vuc', p_ma: 'LV05_DOI_NGOAI_DANG', p_khoi: 'XAY_DUNG_DANG', p_ly_do: `${KHOA} khối riêng` }), 'đặt khối lĩnh vực');
    const dm = await goi('demo_cv1', 'kl_danh_muc', {});
    assert.equal(dm.data.linhVuc.find((l) => l.ma === 'LV05_DOI_NGOAI_DANG').khoi_ma, 'XAY_DUNG_DANG');
    assert.equal(ma(await goi('demo_qtht', 'dat_khoi_linh_vuc', { p_bang: 'dm_nganh', p_ma: 'TUYEN_GIAO', p_khoi: null, p_ly_do: `${KHOA} x` }), 'ngành không khối'), '22023');
    assert.equal(ma(await goi('demo_cv1', 'them_quy_tac', { p_ma: 'NQ_9901', p_loai: 'TU_KHOA', p_gia_tri: 'thử nghiệm', p_muc: 'GOI_Y', p_ly_do: `${KHOA} x` }), 'chuyên viên thêm quy tắc'), '42501');
    const q = await goi('demo_qtht', 'them_quy_tac', { p_ma: 'NQ_9901', p_loai: 'TU_KHOA', p_gia_tri: 'Thử nghiệm KL0107', p_muc: 'GOI_Y', p_ly_do: `${KHOA} quy tắc` });
    assertOk(q, 'quản trị thêm quy tắc');
    assert.equal(ma(await goi('demo_qtht', 'them_quy_tac', { p_ma: 'NQ_9901', p_loai: 'TU_KHOA', p_gia_tri: 'thu nghiem kl0107', p_muc: 'GOI_Y', p_ly_do: `${KHOA} trùng` }), 'trùng không dấu'), '23505');
    assert.equal(ma(await goi('demo_qtht', 'them_quy_tac', { p_ma: 'NQ_9901', p_loai: 'TU_KHOA', p_gia_tri: 'ab', p_muc: 'GOI_Y', p_ly_do: `${KHOA} ngắn` }), 'quá ngắn'), '22023');
    assertOk(await goi('demo_qtht', 'sua_quy_tac', { p_id: q.data, p: { muc: 'TU_TICH' }, p_ly_do: `${KHOA} nâng` }), 'sửa mức');
    const r = await db().from('quy_tac_muc_tieu').select('muc, khoa, nguon').eq('id', q.data).single();
    assert.deepEqual(r.data, { muc: 'TU_TICH', khoa: true, nguon: 'QUAN_TRI' });
  });
});
