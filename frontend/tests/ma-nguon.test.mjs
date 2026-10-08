// Đợt C2 v3.19 (0087): mã theo nguồn dựng từ loại văn bản, số hội nghị, số hiệu và STT trong văn bản; mức quan trọng; tìm theo mã nguồn / số hiệu /
// cơ quan trình. Dữ liệu hư cấu. Chạy `npm test` trong frontend/ (node:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maTheoNguon, soDauSoHieu, tenMucQuanTrong, MUC_QUAN_TRONG } from '../src/lib/kl/ma-nguon.js';
import { locRows } from '../src/lib/kl/tong-hop.js';

test('mã theo nguồn: loại · HN · số hiệu · STT (2 chữ số); thiếu phần nào thì bỏ phần đó; chưa có STT → rỗng', () => {
  assert.equal(maTheoNguon({ van_ban_loai: 'KL_BTV', so_hoi_nghi: 39, so_ket_luan: '671-KL/TU', stt_van_ban: 4 }), 'KL-BTV·HN39·671·04');
  assert.equal(maTheoNguon({ van_ban_loai: 'TB_THUONG_TRUC', so_ket_luan: '102-TB/TU', stt_van_ban: 12 }), 'TB-TT·102·12');
  assert.equal(maTheoNguon({ van_ban_loai: 'NQ_BCH', so_hoi_nghi: 5, so_ket_luan: '15-NQ/TU', stt_van_ban: 1 }), 'NQ-BCH·HN5·15·01');
  assert.equal(maTheoNguon({ van_ban_loai: 'KHAC', so_ket_luan: 'Thường trực giao 08/10/2026 09:00', stt_van_ban: 1 }), 'VB·01', 'mốc Thường trực giao: không lấy số trong ngày giờ');
  assert.equal(maTheoNguon({ van_ban_loai: 'CONG_VAN', so_ket_luan: '2470-CV/TU' }), '');
  assert.equal(soDauSoHieu(' 98-TB/TU'), '98'); assert.equal(soDauSoHieu(null), '');
});

test('mức quan trọng: ba mức, tên đầy đủ; mã lạ giữ nguyên', () => {
  assert.deepEqual(MUC_QUAN_TRONG.map(([m]) => m), ['A', 'B', 'C']);
  assert.match(tenMucQuanTrong('A'), /^A — /); assert.equal(tenMucQuanTrong(null), ''); assert.equal(tenMucQuanTrong('X'), 'X');
});

test('tìm nhanh khớp mã theo nguồn, số hiệu văn bản, cơ quan trình, Thường trực chỉ đạo', () => {
  const rows = [
    { ma: 'NV-1', noi_dung: 'Báo cáo A', van_ban_loai: 'KL_BTV', so_hoi_nghi: 39, so_ket_luan: '671-KL/TU', stt_van_ban: 4, co_quan_trinh_ten: '6. Đảng ủy Ủy ban nhân dân tỉnh' },
    { ma: 'NV-2', noi_dung: 'Tờ trình B', van_ban_loai: 'CONG_VAN', so_ket_luan: '2470-CV/TU', stt_van_ban: 1, thuong_truc_chi_dao_ten: 'Nguyễn Văn Thường' },
  ];
  const tim = (kw) => locRows(rows, { tuKhoa: kw }).map((r) => r.ma);
  assert.deepEqual(tim('hn39·671'), ['NV-1']); assert.deepEqual(tim('2470-cv'), ['NV-2']);
  assert.deepEqual(tim('ủy ban nhân dân'), ['NV-1']); assert.deepEqual(tim('văn thường'), ['NV-2']);
});
