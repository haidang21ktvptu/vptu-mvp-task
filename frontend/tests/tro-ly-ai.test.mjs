// Unit test phần thuần của Edge Function tro-ly-ai (v3.25): xác minh trích dẫn nguyên văn (xac-minh.js), bộ nối nhà cung cấp (nha-cung-cap.js — fetch giả,
// không gọi mạng), lược đồ đề bài (de-bai.js), giả lập (gia-lap.js). Văn bản mẫu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuanTrich, coTrong, taoBo, boMepTrang, kiemNgay, kiemHan, kiemSoHieu, kiemLoai, xacMinhKetQua } from '../../supabase/functions/tro-ly-ai/xac-minh.js';
import { yeuCauAnthropic, yeuCauOpenAI, docKetQuaAnthropic, goiAi, diaChi, LoiAi } from '../../supabase/functions/tro-ly-ai/nha-cung-cap.js';
import { luocDoDocVanBan, dsQuyTac, noiDungDoc, LOAI_VAN_BAN } from '../../supabase/functions/tro-ly-ai/de-bai.js';
import { giaLap } from '../../supabase/functions/tro-ly-ai/gia-lap.js';

const VB = `TỈNH ỦY CAO BẰNG
Số: 999-KL/TU
Cao Bằng, ngày 05 tháng 10 năm 2026
KẾT LUẬN
của Ban Thường vụ Tỉnh ủy về thử nghiệm hệ thống
Hội nghị Ban Thường vụ Tỉnh ủy lần thứ 12 thực hiện Nghị quyết số 57-NQ/TW của Bộ Chính trị về đột phá phát triển khoa học, công nghệ.
- Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chủ trì đẩy mạnh chuyển đổi số trong các cơ quan, báo cáo kết quả trước ngày 30/11/2026.
- Giao Văn phòng Tỉnh ủy tham mưu tổng kết, hoàn thành trong quý IV/2026.`;
const DM = { loai: LOAI_VAN_BAN.map(([m]) => m), sanPham: ['BAO_CAO'], loaiThoiHan: ['CO_HAN_CU_THE'], nganh: ['VAN_HOA_XA_HOI', 'KINH_TE_TONG_HOP'],
  linhVuc: [{ ma: 'LV10_CHUYEN_DOI_SO', nganh_ma: 'VAN_HOA_XA_HOI' }, { ma: 'LV08_TAI_CHINH', nganh_ma: 'KINH_TE_TONG_HOP' }], mucTieu: ['DP_KHCN_CDS', 'NQ_57'] };

test('chuẩn hoá trích dẫn: bỏ dấu câu, khoảng trắng, xuống dòng; so không dấu khi PDF mất dấu', () => {
  assert.equal(chuanTrich('Đẩy mạnh,\n chuyển  đổi số!'), 'đẩymạnhchuyểnđổisố');
  const bo = taoBo(VB);
  assert.equal(coTrong(bo, 'đẩy mạnh chuyển đổi số trong các cơ quan'), 'dung');
  assert.equal(coTrong(taoBo('Day manh chuyen doi so trong cac co quan'), 'Đẩy mạnh chuyển đổi số'), 'khong_dau');
  assert.equal(coTrong(bo, 'đẩy mạnh kinh tế số'), false);
  assert.equal(coTrong(bo, 'số'), false, 'trích quá ngắn không tính');
  assert.equal(coTrong(taoBo(''), 'bất kỳ'), false, 'PDF scan: không có chữ để đối chiếu');
});

test('ngày, hạn, số hiệu, loại văn bản đúng theo câu trích', () => {
  assert.ok(kiemNgay('2026-10-05', 'Cao Bằng, ngày 05 tháng 10 năm 2026')); assert.ok(kiemNgay('2026-10-05', 'ngày 5/10/2026'));
  assert.ok(!kiemNgay('2026-10-06', 'ngày 05 tháng 10 năm 2026')); assert.ok(!kiemNgay('2026-02-30', 'ngày 30 tháng 02 năm 2026'));
  assert.ok(kiemHan('2026-11-30', 'trước ngày 30/11/2026')); assert.ok(kiemHan('2026-12-31', 'trong quý IV/2026'));
  assert.ok(kiemHan('2026-06-30', 'trong tháng 6/2026')); assert.ok(kiemHan('2026-12-31', 'trong năm 2026')); assert.ok(!kiemHan('2026-12-30', 'trong quý IV/2026'));
  assert.ok(kiemSoHieu('999-KL/TU', 'Số: 999-KL/TU')); assert.ok(!kiemSoHieu('99-KL/TU', 'Số: 999-KL/TU'), 'không dính số đứng trước');
  assert.ok(kiemLoai('KL_BTV', 'KẾT LUẬN của Ban Thường vụ Tỉnh ủy')); assert.ok(!kiemLoai('NQ_TW', 'KẾT LUẬN của Ban Thường vụ'));
});

test('xacMinhKetQua: ô nguyên văn được xác minh, ô viết lại không; mã sai bị bỏ; lĩnh vực phải thuộc ngành', () => {
  const kq = xacMinhKetQua({
    van_ban: { loai: { gia_tri: 'KL_BTV', trich: 'KẾT LUẬN\ncủa Ban Thường vụ Tỉnh ủy' }, so_hieu: { gia_tri: '999-KL/TU', trich: 'Số: 999-KL/TU' },
      ngay_ban_hanh: { gia_tri: '2026-10-05', trich: 'Cao Bằng, ngày 05 tháng 10 năm 2026' }, trich_yeu: { gia_tri: 'của Ban Thường vụ Tỉnh ủy về thử nghiệm hệ thống', trich: '' },
      so_hoi_nghi: { gia_tri: '12', trich: 'Hội nghị Ban Thường vụ Tỉnh ủy lần thứ 12' }, co_quan_ban_hanh: { gia_tri: 'Tỉnh ủy Cao Bằng', trich: 'TỈNH ỦY CAO BẰNG' } },
    nhiem_vu: [
      { noi_dung: 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chủ trì đẩy mạnh chuyển đổi số trong các cơ quan, báo cáo kết quả trước ngày 30/11/2026.', trich: '',
        don_vi_chu_tri: 'Ban cán sự đảng Ủy ban nhân dân tỉnh', don_vi_phoi_hop: '', han: '2026-11-30', trich_han: 'trước ngày 30/11/2026', loai_thoi_han: 'CO_HAN_CU_THE',
        san_pham: 'BAO_CAO', mo_ta_san_pham: '', nganh: 'KINH_TE_TONG_HOP', linh_vuc: 'LV10_CHUYEN_DOI_SO', muc_tieu: [{ ma: 'DP_KHCN_CDS', trich: 'chuyển đổi số', ly_do: 'x' }, { ma: 'KHONG_CO', trich: 'a', ly_do: 'b' }] },
      { noi_dung: 'Văn phòng Tỉnh ủy tổng kết việc thử nghiệm', trich: '', don_vi_chu_tri: '', don_vi_phoi_hop: '', han: '2026-12-30', trich_han: 'trong quý IV/2026',
        loai_thoi_han: 'SAI', san_pham: '', mo_ta_san_pham: '', nganh: '', linh_vuc: 'LV08_TAI_CHINH', muc_tieu: [] },
    ],
    muc_tieu_van_ban: [{ ma: 'NQ_57', trich: 'Nghị quyết số 57-NQ/TW', ly_do: 'x' }], van_ban_nhac_toi: [{ so_hieu: '57-NQ/TW', ten: '', trich: 'Nghị quyết số 57-NQ/TW của Bộ Chính trị' }],
  }, VB, DM);
  const v = kq.van_ban;
  assert.ok(v.loai.xac_minh && v.so_hieu.xac_minh && v.ngay_ban_hanh.xac_minh && v.trich_yeu.xac_minh && v.so_hoi_nghi.xac_minh && v.co_quan_ban_hanh.xac_minh);
  const [n1, n2] = kq.nhiem_vu;
  assert.equal(n1.noi_dung.xac_minh, 'dung'); assert.equal(n1.han.xac_minh, 'dung');
  assert.equal(n1.linh_vuc.gia_tri, '', 'lĩnh vực không thuộc ngành đã chọn → bỏ'); assert.deepEqual(n1.muc_tieu.map((m) => m.ma), ['DP_KHCN_CDS']);
  assert.equal(n2.noi_dung.xac_minh, false, 'nội dung viết lại không phải nguyên văn'); assert.equal(n2.han.xac_minh, false, 'hạn không khớp cuối quý');
  assert.equal(n2.loai_thoi_han.gia_tri, ''); assert.equal(n2.nganh.gia_tri, 'KINH_TE_TONG_HOP', 'ngành suy từ lĩnh vực');
  assert.equal(kq.van_ban_nhac_toi[0].xac_minh, 'dung');
  const scan = xacMinhKetQua({ van_ban: { so_hieu: { gia_tri: '999-KL/TU', trich: 'Số: 999-KL/TU' } }, nhiem_vu: [{ noi_dung: 'Giao Văn phòng Tỉnh ủy tham mưu tổng kết' }] }, '', DM);
  assert.equal(scan.co_chu, false); assert.equal(scan.van_ban.so_hieu.xac_minh, false); assert.equal(scan.nhiem_vu[0].noi_dung.xac_minh, false);
});

// Chữ như trình duyệt ghép (lib/kl/doc-pdf.js): dòng trong trang cách nhau "\n", các trang cách nhau "\n\n" (trang trống vẫn giữ thứ tự).
const ND = 'Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan thực hiện Thông báo này; tổng hợp kết quả, báo cáo Thường trực Tỉnh ủy trước ngày 25/12/2026.';
const trang = (...ds) => ds.join('\n'); const vb = (...tr) => tr.join('\n\n');
const P1 = trang('TỈNH ỦY CAO BẰNG', '- Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan thực hiện Thông báo này;', 'tổng hợp kết quả, báo cáo Thường trực Tỉnh ủy trước');
test('câu vắt hai trang: bỏ số trang của CHÍNH trang ở dòng ngoài cùng (đầu hoặc cuối chữ của trang)', () => {
  assert.equal(boMepTrang(VB), VB, 'một trang: giữ nguyên');
  for (const so of ['2', '- 2 -', '(2)', 'Trang 2', '2/3', 'Trang 2/3']) {
    const chu = vb(P1, trang(so, 'ngày 25/12/2026.', 'Nơi nhận: các cơ quan liên quan.'));
    assert.equal(coTrong(taoBo(chu), ND, 12), 'dung', `số trang "${so}" ở đầu trang 2`);
    const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [{ noi_dung: ND, han: '2026-12-25', trich_han: 'Thường trực Tỉnh ủy trước ngày 25/12/2026' }] }, chu, DM);
    assert.equal(kq.nhiem_vu[0].noi_dung.xac_minh, 'dung'); assert.equal(kq.nhiem_vu[0].han.xac_minh, 'dung');
  }
  assert.equal(coTrong(taoBo(vb(trang(P1, '- 1 -'), trang('ngày 25/12/2026.'))), ND, 12), 'dung', 'số trang ở cuối trang 1');
  assert.equal(coTrong(taoBo(vb('trang một', '', trang('3', 'nội dung trang ba'))), 'trang một nội dung trang ba'), 'dung', 'trang trống giữ thứ tự: "3" ở trang 3');
  const bo = taoBo(vb(P1, trang('2', 'ngày 25/12/2026.')));
  assert.equal(coTrong(bo, 'báo cáo Thường trực Tỉnh ủy ngày 25/12/2026'), false, 'bỏ chữ giữa câu → không khớp');
  assert.equal(coTrong(taoBo(vb(P1, trang('VĂN BẢN THỬ', 'ngày 25/12/2026.'))), ND, 12), false, 'dòng đầu trang không phải số trang: không bỏ');
});
test('số trang: không bao giờ bỏ nhầm dòng nội dung (số khác trang, dòng giữa trang, dòng trùng ở mép, câu sai hạn)', () => {
  const g = boMepTrang(vb(trang('5', 'mở đầu trang một', '2', 'cuối trang một'), trang('nội dung trang hai', '2', 'cuối trang hai', '5')));
  assert.equal(g.split('\n').filter((x) => x === '5').length, 2, '"5" ở mép trang 1, 2 không phải số của chính trang → giữ');
  assert.equal(g.split('\n').filter((x) => x === '2').length, 2, '"2" giữa trang 1 và giữa trang 2 (không ở dòng ngoài cùng) → giữ');
  const hai = vb(trang('mở đầu', 'phối hợp với Ban Tổ chức Tỉnh ủy,', 'Ban Tuyên giáo Tỉnh ủy,'), trang('Ban Dân vận Tỉnh ủy triển khai thực hiện', 'Ban Tuyên giáo Tỉnh ủy,'));
  assert.equal(coTrong(taoBo(hai), 'phối hợp với Ban Tổ chức Tỉnh ủy, Ban Dân vận Tỉnh ủy triển khai thực hiện'), false, 'dòng trùng ở mép 2 trang → giữ');
  const ba = vb(trang('mở đầu', 'Giao Văn phòng Tỉnh ủy xây dựng kế hoạch,'), trang('2', 'Thời hạn hoàn thành: trước ngày 30/11/2026.', 'Giao Ban Tổ chức Tỉnh ủy rà soát cán bộ,'),
    trang('3', 'Thời hạn hoàn thành: trước ngày 31/12/2026.', 'kết thúc'));
  const b3 = taoBo(ba);
  assert.equal(coTrong(b3, 'Giao Văn phòng Tỉnh ủy xây dựng kế hoạch, Thời hạn hoàn thành: trước ngày 30/11/2026.'), 'dung');
  assert.equal(coTrong(b3, 'Giao Văn phòng Tỉnh ủy xây dựng kế hoạch, Thời hạn hoàn thành: trước ngày 31/12/2026.'), false, 'ghép nhầm hạn của việc khác → không khớp');
  assert.equal(coTrong(b3, 'Giao Ban Tổ chức Tỉnh ủy rà soát cán bộ, Thời hạn hoàn thành: trước ngày 31/12/2026.'), 'dung');
  assert.equal(boMepTrang(null), ''); assert.equal(boMepTrang(vb('2', '2')), '2\n', 'trang 1 chỉ có "2" giữ, trang 2 chỉ có "2" bỏ');
});

test('yêu cầu Claude: output_config json_schema + effort cho mô hình 5.x; chuẩn OpenAI: json_schema, max_completion_tokens / max_tokens', () => {
  const yc = { heThong: 'hệ thống', noiDung: 'nội dung', anh: [{ media: 'image/jpeg', data: 'AAA' }], schema: { type: 'object' }, tenSchema: 'doc_van_ban', toiDa: 100 };
  const a = yeuCauAnthropic({ nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5-5', muc_suy_nghi: 'medium' }, yc, 'k');
  assert.equal(a.url, 'https://api.anthropic.com/v1/messages'); assert.equal(a.headers['x-api-key'], 'k'); assert.equal(a.headers['anthropic-version'], '2023-06-01');
  assert.deepEqual(a.body.output_config, { format: { type: 'json_schema', schema: { type: 'object' } }, effort: 'medium' });
  assert.equal(a.body.messages[0].content[0].type, 'image'); assert.ok(!('temperature' in a.body));
  assert.ok(!('effort' in yeuCauAnthropic({ nha_cung_cap: 'anthropic', mo_hinh: 'claude-3-haiku' }, yc, 'k').body.output_config));
  const o = yeuCauOpenAI({ nha_cung_cap: 'openai', mo_hinh: 'm' }, yc, 'k');
  assert.equal(o.url, 'https://api.openai.com/v1/chat/completions'); assert.equal(o.body.max_completion_tokens, 100);
  assert.equal(o.body.response_format.type, 'json_schema'); assert.equal(o.headers.authorization, 'Bearer k');
  const g = yeuCauOpenAI({ nha_cung_cap: 'gemini', mo_hinh: 'm' }, yc, 'k', 'object');
  assert.equal(g.url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'); assert.equal(g.body.max_tokens, 100); assert.deepEqual(g.body.response_format, { type: 'json_object' });
  assert.equal(diaChi({ nha_cung_cap: 'khac', dia_chi: 'https://ai.vi-du.vn/v1/' }), 'https://ai.vi-du.vn/v1');
  assert.throws(() => diaChi({ nha_cung_cap: 'khac', dia_chi: 'http://x' }), LoiAi);
});

test('đọc kết quả, lỗi HTTP, thử lại json_object, thiếu khoá — fetch giả', async () => {
  assert.deepEqual(docKetQuaAnthropic({ content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: '{"a":1}' }], usage: { input_tokens: 3, output_tokens: 4 } }), { json: { a: 1 }, vao: 3, ra: 4 });
  assert.throws(() => docKetQuaAnthropic({ stop_reason: 'max_tokens', content: [] }), (e) => e.ma === 'QUA_DAI');
  const tra = (status, j) => async () => ({ ok: status < 400, status, json: async () => j });
  const ch = { nha_cung_cap: 'anthropic', mo_hinh: 'claude-sonnet-5-5' };
  const ok = await goiAi(ch, 'k', { noiDung: 'x', schema: {} }, { fetchFn: tra(200, { content: [{ type: 'text', text: 'trước {"b":2} sau' }] }) });
  assert.deepEqual(ok.json, { b: 2 });
  await assert.rejects(goiAi(ch, 'k', { noiDung: 'x', schema: {} }, { fetchFn: tra(401, { error: { message: 'invalid x-api-key' } }) }), (e) => e.ma === 'KHOA' && !/x-api-key/.test(e.message));
  await assert.rejects(goiAi(ch, null, { noiDung: 'x', schema: {} }), (e) => e.ma === 'CHUA_KHOA' && /AI_KEY_ANTHROPIC/.test(e.message));
  let lan = 0; const doi = async (_u, init) => { lan++; const b = JSON.parse(init.body);
    return b.response_format.type === 'json_schema' ? { ok: false, status: 400, json: async () => ({ error: { message: 'response_format json_schema not supported' } }) }
      : { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '{"c":3}' } }], usage: { prompt_tokens: 1, completion_tokens: 2 } }) }; };
  const k = await goiAi({ nha_cung_cap: 'khac', mo_hinh: 'm', dia_chi: 'https://ai.vi-du.vn/v1' }, 'k', { noiDung: 'x', schema: {} }, { fetchFn: doi });
  assert.equal(lan, 2); assert.deepEqual(k, { json: { c: 3 }, vao: 1, ra: 2 });
  await assert.rejects(goiAi({ nha_cung_cap: 'gia_lap', mo_hinh: 'x' }, null, {}), (e) => e.ma === 'CAU_HINH');
});

test('lược đồ: mọi đối tượng additionalProperties false và bắt buộc đủ khoá; enum có ""; đề bài kèm danh mục', () => {
  const kiem = (n) => { if (n?.type === 'object') { assert.equal(n.additionalProperties, false); assert.deepEqual([...n.required].sort(), Object.keys(n.properties).sort()); Object.values(n.properties).forEach(kiem); }
    if (n?.type === 'array') kiem(n.items); if (n?.enum) assert.ok(n.enum.includes('')); };
  kiem(luocDoDocVanBan({ loai: ['KL_BTV'], sanPham: ['BAO_CAO'], loaiThoiHan: ['X'], nganh: ['N'], linhVuc: ['L'], mucTieu: ['M'] }));
  const nd = noiDungDoc({ loai: LOAI_VAN_BAN, sanPham: [{ ma: 'BAO_CAO', ten: 'Báo cáo' }], loaiThoiHan: [], nganh: [], linhVuc: [], mucTieu: [{ ma: 'NQ_57', ten: 'Nghị quyết 57', nhom: 'NQ_TW' }] }, VB, 'kl.pdf', false);
  assert.ok(nd.includes('BAO_CAO = Báo cáo') && nd.includes('NQ_57 = Nghị quyết 57') && nd.includes('Số: 999-KL/TU'));
  assert.deepEqual(dsQuyTac({ tu_khoa: [{ gia_tri: ' kinh tế số ' }, { gia_tri: '' }], loai_tru: [{ gia_tri: 'x'.repeat(121) }] }), [{ loai: 'TU_KHOA', gia_tri: 'kinh tế số' }]);
});

test('giả lập: kết quả chép nguyên văn nên xác minh được', () => {
  const r = giaLap({ tenSchema: 'doc_van_ban', noiDung: `DANH MỤC\n...\n\nVĂN BẢN (tệp "kl.pdf"):\n${VB}` });
  const kq = xacMinhKetQua(r.json, VB, DM);
  assert.equal(kq.van_ban.so_hieu.gia_tri, '999-KL/TU'); assert.ok(kq.van_ban.so_hieu.xac_minh); assert.ok(kq.van_ban.ngay_ban_hanh.xac_minh);
  assert.equal(kq.nhiem_vu.length, 2); assert.ok(kq.nhiem_vu.every((n) => n.noi_dung.xac_minh)); assert.equal(kq.nhiem_vu[0].han.gia_tri, '2026-11-30');
  assert.deepEqual(kq.van_ban_nhac_toi.map((v) => v.so_hieu), ['57-NQ/TW']);
});
