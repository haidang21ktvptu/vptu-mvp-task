// Unit test kế hoạch điền biểu mẫu Giao việc từ kết quả trợ lý AI đọc văn bản (v3.25 — lib/kl/dien-van-ban.js): chỉ điền ô trống, giá trị nguyên văn
// chỉ tự điền khi đã đối chiếu, mã danh mục là đề xuất, nhận diện bản chụp, phân loại số hiệu văn bản nhắc tới. Dữ liệu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemTep, laBanChup, nhanXacMinh, keHoachVanBan, keHoachThe, phanLoaiNhacToi, chuThongKe, TOI_DA_MB, tronCau, nhiemVuTuDoan, laTrung } from '../src/lib/kl/dien-van-ban.js';

test('kiểm tệp: chỉ PDF, giới hạn dung lượng', () => {
  assert.equal(kiemTep(null), 'Chưa chọn tệp.');
  assert.match(kiemTep({ name: 'a.docx', type: 'application/msword', size: 10 }), /PDF/);
  assert.match(kiemTep({ name: 'a.pdf', type: 'application/pdf', size: (TOI_DA_MB + 1) * 1024 * 1024 }), /MB/);
  assert.equal(kiemTep({ name: 'KL-999.PDF', type: '', size: 1000 }), null);
  assert.equal(laBanChup('  \n '), true);
  assert.equal(laBanChup('x'.repeat(250)), false);
  assert.deepEqual(nhanXacMinh(false), ['kiem', 'Cần kiểm tra']);
});

const vb = { loai: { gia_tri: 'KL_BTV', trich: 'KẾT LUẬN của Ban Thường vụ', xac_minh: 'dung' }, so_hieu: { gia_tri: '999-KL/TU', trich: 'Số: 999-KL/TU', xac_minh: 'dung' },
  ngay_ban_hanh: { gia_tri: '2026-10-05', trich: 'ngày 05 tháng 10 năm 2026', xac_minh: 'dung' }, trich_yeu: { gia_tri: 'về thử nghiệm', trich: 'về thử nghiệm', xac_minh: false },
  so_hoi_nghi: { gia_tri: '', trich: '', xac_minh: false } };

test('văn bản mới còn trống: tự điền giá trị đã đối chiếu (kể cả loại), giá trị cần kiểm tra để người dùng bấm', () => {
  const kh = keHoachVanBan(vb, { klThSoKL: '', klThNgayBH: '', klThTrichYeu: '' }, { homNay: '2026-10-17' });
  assert.deepEqual(kh.map((x) => [x.o, x.dien]), [['klThLoaiVB', true], ['klThSoKL', true], ['klThNgayBH', true], ['klThTrichYeu', false]]);
});

test('loại văn bản chưa đối chiếu được vẫn đặt theo trợ lý AI khi văn bản mới còn trống (mã danh mục — nhãn "Cần kiểm tra")', () => {
  const kh = keHoachVanBan({ ...vb, loai: { gia_tri: 'TB_THUONG_TRUC', trich: 'THÔNG BÁO', xac_minh: false } }, { klThSoKL: '', klThNgayBH: '' }, { homNay: '2026-10-17' });
  const loai = kh.find((x) => x.o === 'klThLoaiVB');
  assert.deepEqual([loai.gia_tri, loai.dien, loai.xac_minh], ['TB_THUONG_TRUC', true, false]);
  assert.equal(keHoachVanBan({ loai: { gia_tri: 'TB_THUONG_TRUC', xac_minh: false } }, { klThSoKL: '9-TB/TU', klThNgayBH: '' })[0].dien, false, 'người dùng đã nhập số hiệu');
});

test('không ghi đè: ô đã nhập giữ nguyên; loại văn bản không đổi khi người dùng đã nhập số hiệu; ngày ở tương lai không điền', () => {
  const kh = keHoachVanBan(vb, { klThSoKL: '12-KL/TU', klThNgayBH: '', klThTrichYeu: 'đã gõ' }, { homNay: '2026-10-01' });
  const d = Object.fromEntries(kh.map((x) => [x.o, x.dien]));
  assert.equal(d.klThLoaiVB, false); assert.equal(d.klThSoKL, false); assert.equal(d.klThNgayBH, false); assert.equal(d.klThTrichYeu, false);
});

const nv = { noi_dung: { gia_tri: 'Giao Sở Tài chính chủ trì rà soát…', xac_minh: 'dung' }, han: { gia_tri: '2026-11-30', trich: 'trước ngày 30/11/2026', xac_minh: 'dung' },
  san_pham: { gia_tri: 'BAO_CAO' }, nganh: { gia_tri: 'KINH_TE_TONG_HOP' }, linh_vuc: { gia_tri: 'LV08_TAI_CHINH' }, mo_ta_san_pham: { gia_tri: 'Báo cáo kết quả', xac_minh: false },
  don_vi_phoi_hop: { gia_tri: 'Sở Nội vụ', xac_minh: 'dung' }, don_vi_chu_tri: { gia_tri: 'Sở Tài chính' }, loai_thoi_han: { gia_tri: 'CO_HAN_CU_THE' } };

test('thẻ trống: điền nội dung, hạn đã đối chiếu, mã danh mục là đề xuất, phối hợp đã đối chiếu; mô tả chưa đối chiếu thì không điền', () => {
  const k = keHoachThe(nv, {});
  assert.deepEqual(k.dien, { noi_dung: nv.noi_dung.gia_tri, han: '2026-11-30', san_pham: 'BAO_CAO', nganh: 'KINH_TE_TONG_HOP', linh_vuc: 'LV08_TAI_CHINH', phoi_hop: 'Sở Nội vụ' });
  assert.deepEqual(k.deXuat, ['san_pham', 'nganh', 'linh_vuc']);
  assert.equal(k.goiY.chuTri, 'Sở Tài chính');
  assert.deepEqual(k.canhBao, []);
});

test('hạn chưa đối chiếu → chỉ gợi ý; nội dung chưa khớp nguyên văn → chỉ gợi ý (bản chụp: điền kèm cảnh báo); ô đã có giữ nguyên', () => {
  const lech = { ...nv, noi_dung: { gia_tri: 'Nội dung AI tóm tắt', xac_minh: false }, han: { gia_tri: '2026-12-31', trich: 'trong năm 2026', xac_minh: false } };
  const k = keHoachThe(lech, { san_pham: 'TO_TRINH', nganh: '' });
  assert.equal(k.dien.han, undefined);
  assert.deepEqual(k.goiY.han, { gia_tri: '2026-12-31', trich: 'trong năm 2026' });
  assert.equal(k.dien.noi_dung, undefined); assert.equal(k.goiY.noiDung, 'Nội dung AI tóm tắt'); assert.equal(k.canhBao.length, 0);
  const chup = keHoachThe(lech, {}, { banChup: true });
  assert.equal(chup.dien.noi_dung, 'Nội dung AI tóm tắt'); assert.equal(chup.canhBao.length, 1); assert.equal(chup.goiY.noiDung, undefined);
  assert.equal(k.dien.san_pham, undefined);
  const ky = keHoachThe({ ...nv, han: { gia_tri: '' }, loai_thoi_han: { gia_tri: 'KY_BAN_HANH' } }, { loai: 'CO_HAN_CU_THE' });
  assert.equal(ky.dien.loai, 'KY_BAN_HANH');
});

test('nội dung chưa trọn câu → không tự điền, gợi ý "trọn câu"; chỉ câu dẫn → không có trọn câu; việc trùng, đoạn rà thấy → cảnh báo', () => {
  const tiep = { ...nv, noi_dung: { gia_tri: 'Giao Văn phòng Tỉnh ủy tổng hợp kết quả', xac_minh: 'dung', con_tiep: ', báo cáo Thường trực Tỉnh ủy.' } };
  const k = keHoachThe(tiep, {});
  assert.equal(k.dien.noi_dung, undefined); assert.equal(k.goiY.tronCau, 'Giao Văn phòng Tỉnh ủy tổng hợp kết quả, báo cáo Thường trực Tỉnh ủy.');
  assert.equal(k.dien.han, '2026-11-30', 'các ô khác vẫn điền');
  assert.equal(tronCau('Giao A rà soát', 'các dự án.'), 'Giao A rà soát các dự án.');
  const dan = keHoachThe({ ...nv, noi_dung: { gia_tri: 'Giao Sở A chỉ đạo', xac_minh: 'dung', con_tiep: ': a) Rà soát;', cau_dan: true } }, {});
  assert.deepEqual([dan.goiY.noiDung, dan.goiY.tronCau], ['Giao Sở A chỉ đạo', undefined]);
  const trung = keHoachThe({ ...nv, trung_voi: 0 }, {}); assert.ok(laTrung({ trung_voi: 0 }) && !laTrung({}));
  assert.match(trung.canhBao[0], /trùng với nhiệm vụ 1/);
  const doan = nhiemVuTuDoan({ trang: 2, chu: 'Giao Sở Nội vụ rà soát biên chế.' });
  const kd = keHoachThe(doan, {});
  assert.deepEqual([kd.dien.noi_dung, doan.trang, doan.tu_ra_soat], ['Giao Sở Nội vụ rà soát biên chế.', 2, true]); assert.match(kd.canhBao[0], /hệ thống rà thấy/);
});

test('số hiệu nhắc tới: có trong danh mục → gợi ý AI (đã gộp → mục giữ lại, ngừng dùng → bỏ); đúng dạng nhóm chưa có, đã đối chiếu → mới; dạng lạ, trùng, chưa đối chiếu → bỏ', () => {
  const dm = [{ ma: 'NQ_57', so_hieu: '57-NQ/TW' }, { ma: 'NQ_81', so_hieu: '81-NQ/TW', dang_dung: false, gop_vao: 'NQ_57' }, { ma: 'NQ_59', so_hieu: '59-NQ/TW', dang_dung: false }];
  const nhom = [{ ma: 'NQ_TW', mau_so_hieu: '^[0-9]{1,5}-NQ/TW$' }, { ma: 'NQ_TU', mau_so_hieu: '^[0-9]{1,5}-(NQ|CTr)/TU$' }];
  const r = phanLoaiNhacToi([{ so_hieu: '57-NQ/TW', ten: 'Nghị quyết 57', trich: 't' }, { so_hieu: '057-NQ/TW' }, { so_hieu: '09 - CTr/TU', ten: 'Chương trình số 09-CTr/TU về du lịch', xac_minh: 'dung' },
    { so_hieu: '15-KL/TU', ten: 'Kết luận', xac_minh: 'dung' }, { so_hieu: '81-NQ/TW' }, { so_hieu: '59-NQ/TW' }, { so_hieu: '12-NQ/TU', ten: 'Nghị quyết 12-NQ/TU về x' }], dm, nhom);
  assert.deepEqual(r.coSan.map((x) => x.ma), ['NQ_57'], 'mục đã gộp trả mục giữ lại (không lặp), mục ngừng dùng không gợi ý');
  assert.deepEqual(r.moi, [{ so_hieu: '09-CTr/TU', nhom: 'NQ_TU', ve: 'về du lịch' }], '12-NQ/TU chưa đối chiếu được trong tệp: không mời thêm');
  assert.match(chuThongKe({ co_gia_tri: 8, da_xac_minh: 7 }), /7\/8/);
});
