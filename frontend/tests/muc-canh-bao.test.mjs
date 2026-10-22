// v3.29 (chủ dự án 22/10/2026 — "ghi đúng quy tắc", mọi màn hình): ba mức cảnh báo ghi bằng nghĩa, số ngày theo kl_cau_hinh; tên Vàng / Đỏ / Đỏ
// đặc biệt chỉ còn ở chú giải. Nhóm xem "Sắp đến hạn" (còn ≤ 7 ngày — CH-10b) ghi kèm số ngày để khỏi lẫn với mức Vàng (còn ≤ 3 ngày).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenMuc, tenMucHoa, chuGiaiMuc, datNguongCanhBao, nguongCanhBao, tenNhom, nhanTrangThai, tenSapDenHan, nhanTheoNguong, mucCua } from '../src/lib/kl/nhan.js';
import { O_SO } from '../src/lib/kl/viec-toi.js';
import { O_SO_TD } from '../src/lib/kl/tinh-hinh.js';
import { TRANG_THAI } from '../src/lib/kl/tq-bo-loc.js';
import { DOAN } from '../src/lib/kl/tong-quan-lanh-dao.js';
import { cotBaoCao } from '../src/lib/kl/bao-cao.js';
import { O_SO_VB } from '../src/lib/kl/van-ban-bang.js';
import { chuGiaiMucHtml, chuGiaiVbHtml } from '../src/views/shared/bang/khung.js';

const ten = (ds, k) => ds.find(([x]) => x === k)[1];

test('Mặc định (3 · 5 · 3 · 7 ngày): ba mức ghi bằng nghĩa, nhãn gọn; chú giải ghi tên mức theo Công văn 1400 sau nghĩa', () => {
  datNguongCanhBao({});
  assert.deepEqual(['vang', 'do', 'ddb'].map((m) => tenMuc(m)), ['sắp đến hạn (còn ≤ 3 ngày)', 'quá hạn dưới 3 ngày', 'quá hạn từ 3 ngày trở lên']);
  assert.deepEqual(['VANG', 'DO', 'DO_DAC_BIET'].map((m) => tenMuc(m, true)), ['Sắp đến hạn', 'Quá hạn < 3 ngày', 'Quá hạn ≥ 3 ngày'], 'mã DB cũng nhận');
  assert.equal(tenMuc('XANH'), '');
  assert.equal(tenMucHoa('ddb'), 'Quá hạn từ 3 ngày trở lên');
  assert.deepEqual(chuGiaiMuc().map(([, t]) => t.split(' — ')[1]), ['mức Vàng', 'mức Đỏ', 'mức Đỏ đặc biệt']);
  assert.deepEqual([ten(O_SO, 'sap'), ten(O_SO_TD, 'sap'), ten(TRANG_THAI, 'vang'), ten(DOAN, 'vang')], Array(4).fill('Sắp đến hạn (còn ≤ 3 ngày)'));
  assert.equal(tenNhom('SAP_DEN_HAN'), 'Sắp đến hạn (còn ≤ 7 ngày)', 'nhóm xem — khác mức Vàng');
  assert.equal(nhanTrangThai({ nhom_dem: 'SAP_DEN_HAN' }), 'Sắp đến hạn', 'nhãn dòng gọn (ô Hạn đã ghi số ngày)');
});

test('Ngưỡng theo cấu hình: mọi nhãn (ô số, lựa chọn lọc, đoạn Tổng quan, cột Báo cáo, nhóm xem) đổi theo, kể cả bảng nhãn tĩnh', () => {
  datNguongCanhBao({ nguong_vang_ngay: 4, nguong_do_dac_biet_ngay: 5, do_khan_KHAN_vang: 6, nguong_sap_den_han_ngay: 10 });
  assert.deepEqual(nguongCanhBao(), { vang: 4, khan: 6, ddb: 5, sap: 10 });
  assert.deepEqual(['vang', 'do', 'ddb'].map((m) => tenMuc(m)), ['sắp đến hạn (còn ≤ 4 ngày)', 'quá hạn dưới 5 ngày', 'quá hạn từ 5 ngày trở lên']);
  assert.deepEqual([ten(O_SO, 'sap'), ten(O_SO_TD, 'sap'), ten(TRANG_THAI, 'vang'), ten(DOAN, 'vang')], Array(4).fill('Sắp đến hạn (còn ≤ 4 ngày)'));
  assert.equal(cotBaoCao(nguongCanhBao().vang)[2][1], 'Sắp đến hạn (còn ≤ 4 ngày)');
  assert.deepEqual([tenNhom('SAP_DEN_HAN'), tenSapDenHan()], ['Sắp đến hạn (còn ≤ 10 ngày)', 'sắp đến hạn (còn ≤ 10 ngày)']);
  assert.match(chuGiaiMuc()[0][1], /còn ≤ 4 ngày.*khẩn trở lên ≤ 6 ngày/);
  // Rà soát PR 1: chú giải của bảng (mẫu HTML chèn trước khi đọc cấu hình — vẽ lại lúc vẽ bảng), tên mức (mucCua), ô số Theo văn bản
  assert.match(chuGiaiMucHtml(), /Quá hạn từ 5 ngày trở lên \(mức Đỏ đặc biệt\).*Quá hạn dưới 5 ngày \(mức Đỏ\).*còn ≤ 4 ngày \(mức Vàng\)/);
  assert.match(chuGiaiVbHtml(), /quá hạn từ 5 ngày trở lên.*quá hạn dưới 5 ngày.*sắp đến hạn \(còn ≤ 10 ngày\)/);
  assert.deepEqual(['VANG', 'DO', 'DO_DAC_BIET'].map((m) => mucCua(m).ten.match(/\d+/)[0]), ['4', '5', '5']);
  assert.equal(ten(O_SO_VB, 'sap'), 'Có việc sắp đến hạn (còn ≤ 10 ngày)');
  datNguongCanhBao({});
  assert.equal(ten(O_SO, 'sap'), 'Sắp đến hạn (còn ≤ 3 ngày)');
  assert.deepEqual(nhanTheoNguong([['a', 'x'], ['b', 'y']], 'b', () => 'z').map(([, t]) => t), ['x', 'z']);
});
