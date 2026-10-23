// v3.25 — "Việc của tôi" dạng bảng (mẫu Main 16/10/2026): ô số, việc cần làm, sắp xếp, nhóm theo văn bản (lib/kl/viec-toi.js). Chạy `npm test`
// trong frontend/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { O_SO, locO, demO, viecCanLam, sapXepViec, sapXepMuc, nhomGiuThuTu, chuaNhan } from '../src/lib/kl/viec-toi.js';
import * as viecToiMod from '../src/lib/kl/viec-toi.js';

const ME = 'me';
const v = (id, o = {}) => ({ id, ma: `NV-${id}`, owner_tai_khoan: ME, nguoi_theo_doi: 'tp', theo_1400: true, toi_da_xac_nhan: true, tien_do_ma: 'DANG_THUC_HIEN',
  nhom_dem: 'DANG_THUC_HIEN', muc_canh_bao: 'XANH', so_minh_chung_hop_le: 0, han_xu_ly: '2026-11-30', created_at: '2026-10-01T02:00:00Z', van_ban_id: 'vb1', ...o });
const ctx = (cd = {}, dn = {}) => ({ me: ME, chiDao: (id) => cd[id] || [], deNghi: (id) => dn[id] || null });

const DS = [
  v('1', { toi_da_xac_nhan: false }),                                         // chưa nhận
  v('2', { muc_canh_bao: 'VANG', nhom_dem: 'SAP_DEN_HAN' }),                   // Vàng, chưa minh chứng
  v('3', { muc_canh_bao: 'DO_DAC_BIET', nhom_dem: 'QUA_HAN' }),                // Đỏ đặc biệt
  v('4'),                                                                      // trong hạn, chỉ đạo chờ trả lời (ctx)
  v('5'),                                                                      // trong hạn, không việc gấp
  v('6', { tien_do_ma: 'HOAN_THANH', nhom_dem: 'HOAN_THANH', so_minh_chung_hop_le: 1 }),
  v('7', { bi_tu_choi: true }),                                                // bị từ chối, chờ giao lại
  v('8', { owner_tai_khoan: null, nguoi_theo_doi: ME, toi_da_xac_nhan: false }),   // việc giao cho phòng, tôi là người đại diện chủ trì (0128), chưa nhận
  v('9', { owner_tai_khoan: 'cv2', nguoi_theo_doi: 'tp', muc_canh_bao: 'DO' }),    // không phải việc của tôi (Toàn Văn phòng)
  v('10', { theo_1400: false, toi_da_xac_nhan: false }),                      // việc cũ (không theo 1400): không phải nhận
];
const C = ctx({ 4: [{ id: 'cd4' }] });

test('ô số: Cần xử lý gồm chưa nhận, chỉ đạo chờ trả lời, Vàng/Đỏ/Đỏ đặc biệt, bị từ chối; không gồm việc người khác; mỗi ô = số dòng lọc', () => {
  const so = demO(DS, C);
  assert.deepEqual(locO(DS, 'can', C).map((r) => r.id), ['1', '2', '3', '4', '7', '8']);
  assert.deepEqual(locO(DS, 'nhan', C).map((r) => r.id), ['1', '8']);
  assert.deepEqual(locO(DS, 'chiDao', C).map((r) => r.id), ['4']);
  assert.deepEqual(locO(DS, 'sap', C).map((r) => r.id), ['2']);
  assert.deepEqual(locO(DS, 'qua', C).map((r) => r.id), ['3', '9']);
  assert.equal(so.mo, 9); assert.equal(so.xong, 1); assert.equal(so.tat, DS.length);
  for (const [k] of O_SO) assert.equal(so[k], locO(DS, k, C).length, `ô ${k}`);
  assert.deepEqual(locO(DS, 'khong-co', C), DS, 'khoá lạ → Tất cả');
  assert.equal(chuaNhan(v('x', { toi_da_xac_nhan: false, bi_tu_choi: true }), ME), false, 'bị từ chối không còn phải nhận');
});

test('việc cần làm: thứ tự xác nhận → trả lời chỉ đạo → nộp minh chứng → cập nhật; đề nghị từ chối đang chờ, bị từ chối, việc người khác, đã xong', () => {
  const ma = (r, c = C) => viecCanLam(r, c).ma;
  assert.deepEqual(viecCanLam(DS[0], C), { ma: 'nhan', chinh: true });
  assert.equal(ma(v('x', { toi_da_xac_nhan: false }), ctx({ x: [{ id: 'c' }] })), 'nhan', 'chưa nhận đứng trước chỉ đạo');
  assert.deepEqual(viecCanLam(DS[3], C), { ma: 'tra-loi', chinh: true });
  assert.deepEqual(viecCanLam(DS[1], C), { ma: 'nop', chinh: true }, 'Vàng → nộp minh chứng, nút chính');
  assert.deepEqual(viecCanLam(DS[4], C), { ma: 'nop', chinh: false }, 'trong hạn → nộp minh chứng, nút thường');
  assert.equal(ma(v('x', { so_minh_chung_hop_le: 1 })), 'cap-nhat');
  assert.equal(ma(DS[9]), 'cap-nhat', 'việc cũ không theo 1400: cập nhật tiến độ');
  assert.equal(ma(v('x', { nhom_dem: 'CHO_NGHIEM_THU' })), 'cap-nhat', 'chờ xác nhận minh chứng cũ: không nộp lại');
  assert.equal(ma(DS[6]), 'cho-giao-lai');
  assert.equal(ma(v('x', { toi_da_xac_nhan: false }), ctx({}, { x: { id: 'tc' } })), 'cho-duyet');
  assert.equal(ma(DS[5]), ''); assert.equal(ma(DS[8]), '', 'việc người khác (Toàn Văn phòng): chỉ xem');
  assert.equal(viecCanLam(v('x', { minh_chung_buoc: 'BI_TRA_LAI' }), C).chinh, true, 'minh chứng bị trả lại → nút chính');
});

test('v3.31: không còn nhãn vai (chỉ còn chủ trì theo dõi); sắp xếp mới giao / hạn / mức cảnh báo, nhóm theo văn bản giữ thứ tự', () => {
  assert.ok(!('vaiCua' in viecToiMod), 'bỏ nhãn vai Chủ trì / Người theo dõi');
  const a = v('a', { created_at: '2026-10-02T01:00:00Z', van_ban_id: 'vb2', han_xu_ly: '2026-12-01' });
  const b = v('b', { created_at: '2026-10-03T01:00:00Z', van_ban_id: 'vb1', han_xu_ly: '2026-10-20', muc_canh_bao: 'VANG' });
  const c = v('c', { created_at: '2026-10-01T01:00:00Z', van_ban_id: 'vb2', han_xu_ly: '2026-10-10', muc_canh_bao: 'DO_DAC_BIET' });
  const d = v('d', { created_at: '2026-10-04T01:00:00Z', van_ban_id: null, tien_do_ma: 'HOAN_THANH', nhom_dem: 'HOAN_THANH', muc_canh_bao: 'DO' });
  assert.deepEqual(sapXepViec([a, b, c, d], 'moi').map((r) => r.id), ['d', 'b', 'a', 'c']);
  assert.deepEqual(sapXepViec([a, b, c, d], 'han').map((r) => r.id), ['c', 'b', 'a', 'd']);
  assert.deepEqual(sapXepMuc([a, b, c, d]).map((r) => r.id), ['c', 'b', 'a', 'd'], 'việc xong cuối dù mức Đỏ');
  assert.deepEqual(sapXepViec([a, b], 'la').map((r) => r.id), ['b', 'a'], 'khoá lạ → mới giao trước');
  const g = nhomGiuThuTu(sapXepViec([a, b, c, d], 'moi'));
  assert.deepEqual(g.map((x) => [x.khoa, x.rows.map((r) => r.id)]), [['khong', ['d']], ['vb1', ['b']], ['vb2', ['a', 'c']]]);
});
