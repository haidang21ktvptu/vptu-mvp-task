// Unit test bộ chọn mục tiêu then chốt có gợi ý (v3.25 — lib/kl/goi-y-muc-tieu.js): tích sẵn theo quy tắc, gợi ý một bấm, theo văn bản, số hiệu mới,
// kết quả lưu (nguồn, theo văn bản), phản hồi cho bộ tự học. Mã danh mục theo 0105 / 0113.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taoBoChon, apGoiY, apGoiYAi, bat, tat, batMoi, dsHien, ketQua, phanHoi, hieuLuc, datVanBan, moTaLyDo, TOI_DA } from '../src/lib/kl/goi-y-muc-tieu.js';

const kq1 = { goi_y: [
  { ma: 'NQ_57', muc: 'TU_TICH', ly_do: [{ loai: 'SO_HIEU', gia_tri: '57-NQ/TW', o: 'noi_dung' }], quy_tac: ['q57'] },
  { ma: 'DP_KHCN_CDS', muc: 'GOI_Y', ly_do: [{ loai: 'TU_KHOA', gia_tri: 'đổi mới sáng tạo', o: 'noi_dung' }], quy_tac: ['qdm'] },
], so_hieu_moi: [{ so_hieu: '81-NQ/TW', nhom: 'NQ_TW', ve: 'về phát triển văn hóa' }] };

test('tích sẵn mục mức TU_TICH, gợi ý mức GOI_Y, số hiệu mới tích sẵn', () => {
  const tt = apGoiY(taoBoChon(), kq1);
  assert.deepEqual(hieuLuc(tt), ['NQ_57']);
  assert.equal(tt.chon.get('NQ_57').nguon, 'QUY_TAC');
  assert.equal(tt.chon.get('NQ_57').ly_do, 'số hiệu 57-NQ/TW trong nội dung');
  const h = dsHien(tt);
  assert.deepEqual(h.goiY.map((x) => x.ma), ['DP_KHCN_CDS']);
  assert.equal(h.moi[0].chon, true);
});

test('gợi ý đổi theo ô nhập: mục tích sẵn chưa đụng thì bỏ theo, mục người chọn giữ', () => {
  const tt = apGoiY(taoBoChon(), kq1);
  bat(tt, 'DP_KHCN_CDS', { nguon: 'GOI_Y', ly_do: 'x' });
  apGoiY(tt, { goi_y: [], so_hieu_moi: [] });
  assert.deepEqual(hieuLuc(tt), ['DP_KHCN_CDS']);
  assert.equal(tt.moi.length, 0);
});

test('mục người dùng bỏ tích không bị tích lại ở lượt gợi ý sau', () => {
  const tt = apGoiY(taoBoChon(), kq1);
  tat(tt, 'NQ_57'); batMoi(tt, '81-NQ/TW', false);
  apGoiY(tt, kq1);
  assert.deepEqual(hieuLuc(tt), []);
  assert.equal(tt.moi[0].chon, false);
});

test('theo văn bản: hiện như đã tích; không thêm gì → không gắn riêng; thêm một mục → gắn riêng đủ tập', () => {
  const tt = taoBoChon({ vb: ['DP_HA_TANG'] });
  apGoiY(tt, { goi_y: [{ ma: 'DP_HA_TANG', muc: 'TU_TICH', ly_do: [{ loai: 'VAN_BAN', gia_tri: '', o: 'van_ban' }], quy_tac: [] }] });
  assert.deepEqual(dsHien(tt).daChon.map((x) => [x.ma, x.nguon]), [['DP_HA_TANG', 'VAN_BAN']]);
  assert.equal(ketQua(tt).theoVb, true);
  bat(tt, 'NQ_57', { nguon: 'CHON' });
  const k = ketQua(tt);
  assert.equal(k.theoVb, false);
  assert.deepEqual(k.ma.sort(), ['DP_HA_TANG', 'NQ_57']);
  assert.equal(k.nguon.DP_HA_TANG, undefined, 'mục của văn bản không khai nguồn — máy chủ chép nguồn của văn bản (0110)');
  assert.deepEqual(k.nguon.NQ_57, { nguon: 'CHON', ly_do: null });
  datVanBan(tt, ['DP_HA_TANG'], { DP_HA_TANG: { nguon: 'QUY_TAC', ly_do: 'số hiệu 57-NQ/TW' } });   // văn bản chưa lưu được mục: khai thay
  assert.deepEqual(ketQua(tt).nguon.DP_HA_TANG, { nguon: 'QUY_TAC', ly_do: 'số hiệu 57-NQ/TW' });
});

test('ngăn chi tiết: việc đã gắn riêng — mục của văn bản ngoài phần gắn riêng không áp', () => {
  const tt = taoBoChon({ rieng: ['NQ_57'], nguonRieng: { NQ_57: { nguon: 'AI', ly_do: 'a' } }, vb: ['DP_HA_TANG'] });
  assert.deepEqual(hieuLuc(tt), ['NQ_57']);
  assert.equal(dsHien(tt).daChon[0].nguon, 'AI');
  tat(tt, 'NQ_57');
  assert.deepEqual(ketQua(tt).ma, []);
  assert.equal(ketQua(tt).theoVb, true);   // bỏ hết → tính theo văn bản (gan_muc_tieu với mảng rỗng)
});

test('số hiệu mới: sau khi hệ thống thêm vào danh mục, mã mới vào kết quả với nguồn tích sẵn', () => {
  const tt = apGoiY(taoBoChon(), kq1);
  const k = ketQua(tt, new Map([['SH:81-NQ/TW', 'NQ_81']]));
  assert.deepEqual(k.ma, ['NQ_57', 'NQ_81']);
  assert.equal(k.nguon.NQ_81.nguon, 'QUY_TAC');
  assert.match(k.nguon.NQ_81.ly_do, /81-NQ\/TW về phát triển văn hóa/);
  assert.deepEqual(k.moi, [{ so_hieu: '81-NQ/TW', ve: 'về phát triển văn hóa' }]);
});

test('gợi ý AI chỉ để bấm; số hiệu văn bản nhắc tới hiện chưa tích', () => {
  const tt = apGoiYAi(taoBoChon(), [{ ma: 'DP_CAN_BO', trich: 'đào tạo cán bộ', ly_do: 'phục vụ đột phá', xac_minh: 'dung' }], [{ so_hieu: '72-NQ/TW', nhom: 'NQ_TW' }]);
  assert.deepEqual(hieuLuc(tt), []);
  assert.deepEqual(dsHien(tt).goiY.map((x) => [x.ma, x.nguon]), [['DP_CAN_BO', 'AI']]);
  assert.equal(tt.moi[0].chon, false);
  bat(tt, 'DP_CAN_BO', { nguon: 'AI', ly_do: 'phục vụ đột phá' });
  assert.equal(ketQua(tt).nguon.DP_CAN_BO.nguon, 'AI');
});

test('phản hồi: tích sẵn giữ / bỏ, gợi ý bấm / không bấm; mục đã có từ trước không tính', () => {
  const tt = apGoiY(taoBoChon(), kq1);
  assert.deepEqual(phanHoi(tt), [{ quy_tac: ['q57'], ket_qua: 'GIU' }, { quy_tac: ['qdm'], ket_qua: 'BO_QUA' }]);
  tat(tt, 'NQ_57'); bat(tt, 'DP_KHCN_CDS', { nguon: 'GOI_Y' });
  assert.deepEqual(phanHoi(tt), [{ quy_tac: ['q57'], ket_qua: 'BO' }, { quy_tac: ['qdm'], ket_qua: 'THEM' }]);
  const cu = apGoiY(taoBoChon({ rieng: ['NQ_57'] }), kq1);
  assert.deepEqual(phanHoi(cu).map((x) => x.quy_tac[0]), ['qdm']);
});

test('bỏ mục đã gắn từ trước mà quy tắc tích sẵn → ghi BO; mở lại (quy tắc đã bị bỏ → gợi ý) không tự tích lại', () => {
  const cu = apGoiY(taoBoChon({ rieng: ['NQ_57'], nguonRieng: { NQ_57: { nguon: 'QUY_TAC' } } }), kq1);
  tat(cu, 'NQ_57');
  const k = ketQua(cu);
  assert.deepEqual(k.ma, []);
  assert.deepEqual(phanHoi(cu, k.ma), [{ quy_tac: ['q57'], ket_qua: 'BO' }, { quy_tac: ['qdm'], ket_qua: 'BO_QUA' }]);
  // máy chủ (goi_y_muc_tieu_viec) hạ mục có quy tắc đã bị bỏ thành GOI_Y → lần mở sau chỉ hiện ở dòng gợi ý
  const moLai = apGoiY(taoBoChon(), { goi_y: [{ ...kq1.goi_y[0], muc: 'GOI_Y' }], so_hieu_moi: [] });
  assert.deepEqual(hieuLuc(moLai), []);
  assert.deepEqual(dsHien(moLai).goiY.map((x) => x.ma), ['NQ_57']);
  // vùng mục đã có của văn bản (theo văn bản) cũng vậy
  const vb = apGoiY(taoBoChon({ vb: ['NQ_57'] }), kq1);
  tat(vb, 'NQ_57');
  assert.deepEqual(phanHoi(vb, ketQua(vb).ma).find((x) => x.quy_tac[0] === 'q57'), { quy_tac: ['q57'], ket_qua: 'BO' });
});

test('gợi ý "đã bỏ ở việc này" (da_bo — 0115): không tích sẵn, không gửi "không bấm"; chọn lại → THEM', () => {
  const ktr = { ma: 'CTR_KINH_TE_RUNG', muc: 'GOI_Y', da_bo: true, quy_tac: ['qktr', 'qbvr'],
    ly_do: [{ loai: 'TU_KHOA', gia_tri: 'kinh tế rừng', o: 'noi_dung' }, { loai: 'TU_KHOA', gia_tri: 'bảo vệ rừng', o: 'noi_dung' }] };
  const tt = apGoiY(taoBoChon({ vb: ['NQ_57'] }), { goi_y: [ktr, kq1.goi_y[1]], so_hieu_moi: [] });
  assert.deepEqual(hieuLuc(tt), ['NQ_57']);
  assert.deepEqual(dsHien(tt).goiY.map((g) => [g.ma, g.da_bo]), [['CTR_KINH_TE_RUNG', true], ['DP_KHCN_CDS', false]]);
  assert.deepEqual(phanHoi(tt), [{ quy_tac: ['qdm'], ket_qua: 'BO_QUA' }], 'không ghi đè trí nhớ BO của máy chủ');
  bat(tt, 'CTR_KINH_TE_RUNG', { nguon: 'GOI_Y' });
  assert.deepEqual(phanHoi(tt)[0], { quy_tac: ['qktr', 'qbvr'], ket_qua: 'THEM' });
});

test('tối đa 10 mục; đổi văn bản bỏ lựa chọn bỏ cũ', () => {
  const tt = taoBoChon();
  for (let i = 0; i < TOI_DA; i++) assert.equal(bat(tt, `M${i}`), true);
  assert.equal(bat(tt, 'M_QUA'), false);
  const v = taoBoChon({ vb: ['A', 'B'] }); tat(v, 'A');
  datVanBan(v, ['B', 'C']);
  assert.deepEqual(hieuLuc(v), ['B', 'C']);
});

test('mô tả lý do', () => {
  const s = moTaLyDo([{ loai: 'LINH_VUC', gia_tri: 'LV10' }, { loai: 'TU_KHOA', gia_tri: 'chuyển đổi số', o: 'trich_yeu' }], { tenLv: () => 'Chuyển đổi số' });
  assert.equal(s, 'lĩnh vực Chuyển đổi số; “chuyển đổi số” trong trích yếu văn bản');
});
