// Unit test nhập Excel v3.25 (lib/kl/nhap/muc-tieu-du-kien.js): tự gắn mục tiêu then chốt cho dòng tạo việc không ghi mục tiêu — dòng nào được gắn cờ,
// đầu vào / khoá nhớ đệm của bộ nhận diện, dự kiến (bỏ mục chỉ theo văn bản), chữ ở cột ghi chú, dữ liệu gửi DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTuGan, dauVaoGoiY, khoaGoiY, duKienTuGoiY, chuDuKien, duLieuCoCo } from '../src/lib/kl/nhap/muc-tieu-du-kien.js';
test('v3.25: tự gắn mục tiêu then chốt khi nhập — chỉ dòng tạo việc không ghi mục tiêu; dự kiến bỏ mục chỉ theo văn bản; cờ gửi DB', () => {
  const x = (ket_qua, them = {}) => ({ ket_qua, gt: { so_ket_luan: '12-KL/TU', noi_dung: 'Đẩy mạnh chuyển đổi số', nganh: 'VAN_HOA_XA_HOI', linh_vuc: null }, du_lieu: { so_dong: 2, muc_tieu_ma: null, ...them } });
  assert.equal(canTuGan(x('GIAO')), true); assert.equal(canTuGan(x('DA_XONG')), true); assert.equal(canTuGan(x('CHO_NGHIEM_THU')), true);
  assert.equal(canTuGan(x('CAP_NHAT')), false, 'cập nhật theo mã không đổi mục tiêu'); assert.equal(canTuGan(x('CHO_HOAN_THIEN')), false, 'chờ hoàn thiện: gợi ý ở Giao việc');
  assert.equal(canTuGan(x('GIAO', { muc_tieu_ma: ['NQ_57'] })), false, 'tệp đã ghi mục tiêu');
  const p = dauVaoGoiY(x('GIAO'));
  assert.deepEqual(p, { so_hieu_van_ban: '12-KL/TU', noi_dung: 'Đẩy mạnh chuyển đổi số', nganh: 'VAN_HOA_XA_HOI', linh_vuc: null });
  assert.equal(khoaGoiY(p), khoaGoiY({ ...p })); assert.notEqual(khoaGoiY(p), khoaGoiY({ ...p, noi_dung: 'khác' }));
  const d = duKienTuGoiY({ goi_y: [{ ma: 'DP_KHCN_CDS', muc: 'TU_TICH', ly_do: [{ loai: 'TU_KHOA' }] }, { ma: 'DP_HA_TANG', muc: 'TU_TICH', ly_do: [{ loai: 'VAN_BAN' }] },
    { ma: 'CTR_DU_LICH', muc: 'GOI_Y', ly_do: [{ loai: 'TU_KHOA' }] }], so_hieu_moi: [{ so_hieu: '81-NQ/TW' }] });
  assert.deepEqual(d, { ma: ['DP_KHCN_CDS'], moi: ['81-NQ/TW'] });
  assert.equal(chuDuKien(d, (m) => (m === 'DP_KHCN_CDS' ? 'Đột phá KHCN' : m)), 'mục tiêu tự gắn (dự kiến): Đột phá KHCN; 81-NQ/TW (thêm vào danh mục)');
  assert.equal(chuDuKien({ ma: [], moi: [] }), '');
  const goc = x('GIAO');
  assert.equal(duLieuCoCo(goc, true).tu_gan_muc_tieu, true); assert.equal(goc.du_lieu.tu_gan_muc_tieu, undefined, 'không đổi dữ liệu gốc');
  assert.equal('tu_gan_muc_tieu' in duLieuCoCo(goc, false), false, 'tắt ô → không gửi cờ');
  assert.equal('tu_gan_muc_tieu' in duLieuCoCo(x('CAP_NHAT'), true), false);
});
