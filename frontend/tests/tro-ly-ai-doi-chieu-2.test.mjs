// Unit test đối chiếu / rà soát của Edge Function tro-ly-ai — các điểm của rà soát độc lập lần 2 (18/10/2026): ý mở bằng số, xuống dòng "Giao thông", "TP.",
// câu dẫn đúng phạm vi, hạn ở ranh giới số và mốc "tính đến", nhiệm vụ chép khác chỉ che câu của chính nó, câu dẫn sau trích yếu một dòng, tiêu đề mục,
// ý không ký hiệu. Văn bản mẫu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xacMinhKetQua, kiemHan } from '../../supabase/functions/tro-ly-ai/xac-minh.js';
import { taoGoc } from '../../supabase/functions/tro-ly-ai/van-ban-goc.js';
import { LOAI_VAN_BAN } from '../../supabase/functions/tro-ly-ai/de-bai.js';
import { keHoachThe } from '../src/lib/kl/dien-van-ban.js';

const DM = { loai: LOAI_VAN_BAN.map(([m]) => m), sanPham: ['BAO_CAO'], loaiThoiHan: ['CO_HAN_CU_THE'], nganh: [], linhVuc: [], mucTieu: [] };
const viec = (noi, them = {}) => ({ noi_dung: noi, trich: '', don_vi_chu_tri: '', don_vi_phoi_hop: '', han: '', trich_han: '', loai_thoi_han: '', san_pham: '',
  mo_ta_san_pham: '', nganh: '', linh_vuc: '', muc_tieu: [], ...them });
const HD = 'TỈNH ỦY CAO BẰNG\nSố 998-KL/TU\nCao Bằng, ngày 16 tháng 10 năm 2026\nKẾT LUẬN\ncủa Ban Thường vụ Tỉnh ủy\nvề một số nhiệm vụ trọng tâm\n'
  + 'Ngày 15/10/2026, Ban Thường vụ Tỉnh ủy họp nghe báo cáo tình hình thực hiện nhiệm vụ.';
const xm = (chu, nv) => xacMinhKetQua({ van_ban: {}, nhiem_vu: nv }, chu, DM);
const sot = (kq) => kq.nghi_bo_sot.map((x) => x.chu);

test('ý mở bằng số ("- 100% …") là ý: hạn của ý sau không gán cho ý trước, không nối câu, ý bị sót được báo kèm câu dẫn', () => {
  const chu = `${HD}\nBan Thường vụ Tỉnh ủy yêu cầu:\n- Giao Sở Nội vụ rà soát biên chế các cơ quan, đơn vị;\n- 100% cơ quan, đơn vị hoàn thành số hóa hồ sơ, báo cáo trước ngày 30/11/2026.\nNơi nhận:\n- Như trên.`;
  const kq = xm(chu, [viec('Giao Sở Nội vụ rà soát biên chế các cơ quan, đơn vị;', { han: '2026-11-30', trich_han: 'báo cáo trước ngày 30/11/2026' })]);
  const n = kq.nhiem_vu[0];
  assert.deepEqual([n.noi_dung.xac_minh, n.noi_dung.con_tiep, n.han.xac_minh], ['dung', undefined, false]);
  assert.deepEqual(sot(kq), ['Ban Thường vụ Tỉnh ủy yêu cầu: 100% cơ quan, đơn vị hoàn thành số hóa hồ sơ, báo cáo trước ngày 30/11/2026.']);
  const g = taoGoc('Chiến lược giai đoạn 2021\n- 2025, tầm nhìn đến năm 2030.\nThực hiện theo điểm\nb) khoản 2 Điều 5.\nChỉ tiêu đến năm 2030\n- 100% xã đạt chuẩn.');
  assert.deepEqual(g.muc.map(([a, b]) => g.text.slice(a, b + 5)), ['- 100%'], 'khoảng năm, "điểm\\nb) khoản" không phải ý');
});

test('xuống dòng "… và Sở\\nGiao thông vận tải …" không phải câu mới; "TP." không phải hết câu; ngoặc kép đóng, "1.500" giữ nguyên văn', () => {
  const chu = `${HD}\n- Giao Sở Xây dựng chủ trì, phối hợp với Sở Tài chính, Công an tỉnh, Bộ Chỉ huy Quân sự tỉnh và Sở\nGiao thông vận tải rà soát hạ tầng giao thông biên giới, `
    + 'báo cáo trước ngày 30/11/2026.\n- Giao Ủy ban nhân dân TP. Cao Bằng chủ trì xây dựng kế hoạch chỉnh trang đô thị.\n- Giao Sở Văn hóa xây dựng Đề án “Phát triển du lịch cộng đồng.”\n'
    + '- Giao Sở Tài chính bố trí 1.500 tỷ đồng cho các dự án trọng điểm.';
  const [a, b, c, d] = xm(chu, [viec('Giao Sở Xây dựng chủ trì, phối hợp với Sở Tài chính, Công an tỉnh, Bộ Chỉ huy Quân sự tỉnh và Sở', { han: '2026-11-30', trich_han: 'báo cáo trước ngày 30/11/2026' }),
    viec('Giao Ủy ban nhân dân TP'), viec('Giao Sở Văn hóa xây dựng Đề án “Phát triển du lịch cộng đồng.”'), viec('Giao Sở Tài chính bố trí 1')]).nhiem_vu;
  assert.equal(a.noi_dung.con_tiep, 'Giao thông vận tải rà soát hạ tầng giao thông biên giới, báo cáo trước ngày 30/11/2026.');
  assert.equal(keHoachThe(a, {}).dien.noi_dung, undefined, 'không tự điền nội dung bị cắt'); assert.equal(a.han.xac_minh, 'dung');
  assert.equal(keHoachThe(b, {}).goiY.tronCau, 'Giao Ủy ban nhân dân TP. Cao Bằng chủ trì xây dựng kế hoạch chỉnh trang đô thị.');
  assert.equal(keHoachThe(c, {}).dien.noi_dung, 'Giao Sở Văn hóa xây dựng Đề án “Phát triển du lịch cộng đồng.”');
  assert.equal(keHoachThe(d, {}).goiY.tronCau, 'Giao Sở Tài chính bố trí 1.500 tỷ đồng cho các dự án trọng điểm.');
});

test('câu dẫn đúng phạm vi: không ghép ý của mục khác / dưới tiêu đề sau; ý b) sau ý a) có danh sách con vẫn ghép được', () => {
  const B = `${HD}\nBan Thường vụ Tỉnh ủy kết luận như sau:\n1. Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chỉ đạo:\na) Rà soát, sắp xếp các dự án đầu tư công, hoàn thành trong quý IV/2026;\n`
    + 'b) Xây dựng kế hoạch phát triển du lịch năm 2027.\n2. Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc việc thực hiện kết luận này\n- Tổng hợp kết quả, báo cáo Ban Thường vụ Tỉnh ủy trước ngày 31/12/2026.';
  const sai = xm(B, [viec('Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chỉ đạo: Tổng hợp kết quả, báo cáo Ban Thường vụ Tỉnh ủy trước ngày 31/12/2026.',
    { han: '2026-12-31', trich_han: 'trước ngày 31/12/2026' })]).nhiem_vu[0];
  assert.deepEqual([sai.noi_dung.xac_minh, sai.han.xac_minh], [false, false]);
  const A = `${HD}\nBan Thường vụ Tỉnh ủy yêu cầu:\n1. Giao Sở Tài chính chủ trì rà soát vốn đầu tư công, báo cáo trước ngày 30/11/2026.\n2. Giao Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, `
    + 'báo cáo trước ngày 15/12/2026.\n3. Kết quả thực hiện năm 2025\n- Tỷ lệ giải ngân vốn đầu tư công đạt 95%, cao hơn cùng kỳ năm trước.\n- Thu ngân sách trên địa bàn vượt dự toán được giao, nhiều chỉ tiêu đạt khá.\nNơi nhận:\n- Như trên.';
  const kqA = xm(A, [viec('Giao Sở Tài chính chủ trì rà soát vốn đầu tư công, báo cáo trước ngày 30/11/2026.'), viec('Giao Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo trước ngày 15/12/2026.'),
    viec('Ban Thường vụ Tỉnh ủy yêu cầu: Tỷ lệ giải ngân vốn đầu tư công đạt 95%, cao hơn cùng kỳ năm trước.')]);
  assert.equal(kqA.nhiem_vu[2].noi_dung.xac_minh, false, 'ý đánh giá dưới "3. Kết quả …" không thuộc câu dẫn "… yêu cầu:"');
  assert.deepEqual(sot(kqA), [], 'các ý đánh giá không bị báo sót');
  const C = `${HD}\n2.1. Giao Ban cán sự đảng Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo:\na) Xây dựng Đề án phát triển du lịch bền vững giai đoạn 2026 – 2030, trong đó tập trung:\n`
    + '- Phát triển sản phẩm du lịch đặc thù của từng vùng;\n- Nâng cao chất lượng nguồn nhân lực du lịch;\nb) Rà soát quy hoạch các khu, điểm du lịch trọng điểm; hoàn thành trước ngày 31/03/2027.\nNơi nhận:\n- Như trên.';
  const L = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo:';
  const kqC = xm(C, [viec(`${L} Xây dựng Đề án phát triển du lịch bền vững giai đoạn 2026 – 2030, trong đó tập trung: Phát triển sản phẩm du lịch đặc thù của từng vùng; Nâng cao chất lượng nguồn nhân lực du lịch;`),
    viec(`${L} Rà soát quy hoạch các khu, điểm du lịch trọng điểm; hoàn thành trước ngày 31/03/2027.`, { han: '2027-03-31', trich_han: 'hoàn thành trước ngày 31/03/2027' })]);
  assert.deepEqual([...kqC.nhiem_vu.map((n) => n.noi_dung.xac_minh), kqC.nhiem_vu[1].han.xac_minh, kqC.tong_bo_sot], ['dung', 'dung', 'dung', 0]);
});

test('hạn: không khớp giữa số ("5/12/2026" trong "15/12/2026"); mốc "tính đến ngày …" không phải hạn; "từ … đến …" (ngày có dấu chấm); "đầu tư" không phải "từ"', () => {
  const chu = `${HD}\n- Giao Sở Tài chính chủ trì rà soát vốn đầu tư công, hoàn thành trước ngày 15/12/2026.\n- Giao Văn phòng Tỉnh ủy theo dõi.`;
  const h = (han, th) => xm(chu, [viec('Giao Sở Tài chính chủ trì rà soát vốn đầu tư công, hoàn thành trước ngày 15/12/2026.', { han, trich_han: th })]).nhiem_vu[0].han.xac_minh;
  assert.deepEqual([h('2026-12-05', '5/12/2026'), h('2026-12-15', '15/12/2026')], [false, 'dung']);
  const t = 'tổng hợp số liệu tính đến ngày 31/10/2026, báo cáo trước ngày 15/11/2026'; const r = 'thực hiện từ ngày 01.10.2026 đến ngày 31.12.2026';
  assert.deepEqual([kiemHan('2026-11-15', t), kiemHan('2026-10-31', t), kiemHan('2026-12-31', r), kiemHan('2026-10-01', r)], [true, false, true, false]);
  assert.ok(kiemHan('2026-12-15', 'rà soát vốn đầu tư công đến năm 2030, báo cáo trước ngày 15/12/2026'));
});

test('nhiệm vụ chép khác văn bản chỉ che câu của chính nó (cùng số, cùng chủ trì, giống nhất) — không che nhiệm vụ khác bị sót', () => {
  const chu = `${HD}\n- Giao Sở Tài chính chủ trì, phối hợp với các sở, ngành liên quan rà soát vốn đầu tư công, báo cáo Thường trực Tỉnh ủy trước ngày 30/11/2026.\n`
    + '- Giao Sở Nội vụ chủ trì, phối hợp với các sở, ngành liên quan rà soát biên chế, báo cáo Thường trực Tỉnh ủy trước ngày 15/12/2026.\nNơi nhận:\n- Như trên.';
  const para = 'Giao Sở Tài chính chủ trì, phối hợp các sở, ngành liên quan rà soát nguồn vốn đầu tư công, báo cáo Thường trực Tỉnh ủy trước ngày 30/11/2026.';
  const kq = xm(chu, [viec(para, { don_vi_chu_tri: 'Sở Tài chính' })]);
  assert.equal(kq.nhiem_vu[0].noi_dung.xac_minh, false); assert.deepEqual(sot(kq).map((x) => x.slice(0, 14)), ['Giao Sở Nội vụ']);
  let dai = 'Mở đầu văn bản thử nghiệm.\n'; for (let i = 1; i <= 200; i++) dai += `- Giao Sở Tài chính rà soát nội dung số ${i}.\n`;
  const nv = [viec('Giao Sở Tài chính rà soát, kiểm tra nội dung số 7 kỹ lưỡng.'), ...Array.from({ length: 10 }, (_, k) => viec(`Giao Sở Tài chính rà soát nội dung số ${k * 20 + 1}.`))];
  assert.equal(xm(dai, nv).tong_bo_sot, 189, 'mỗi nhiệm vụ chép khác che nhiều nhất một câu');
});

test('câu dẫn ngay sau trích yếu một dòng vẫn là câu dẫn; tiêu đề mục chỉ bỏ ở I., 1., 1.1., a) — "- Sở Nội vụ phối hợp" là đầu câu; ý không ký hiệu cách nhau ";"', () => {
  const tb = `TỈNH ỦY CAO BẰNG\nSố 999-TB/TU\nCao Bằng, ngày 16 tháng 10 năm 2026\nTHÔNG BÁO\nkết luận của Thường trực Tỉnh ủy về công tác cán bộ\nThường trực Tỉnh ủy đề nghị các cơ quan:\n`
    + '1. Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo trước ngày 30/11/2026.\n2. Ủy ban Kiểm tra Tỉnh ủy kiểm tra việc kê khai tài sản, thu nhập năm 2026.\nNơi nhận:\n- Như trên.';
  assert.deepEqual(sot(xm(tb, [viec('Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo trước ngày 30/11/2026.')])),
    ['Thường trực Tỉnh ủy đề nghị các cơ quan: Ủy ban Kiểm tra Tỉnh ủy kiểm tra việc kê khai tài sản, thu nhập năm 2026.']);
  const kl = 'KẾT LUẬN\ncủa Ban Thường vụ Tỉnh ủy\nNội dung mở đầu của văn bản thử nghiệm, Ban Thường vụ Tỉnh ủy kết luận như sau.\n- Sở Nội vụ phối hợp\n'
    + 'Ban Tổ chức Tỉnh ủy tham mưu kiểm tra việc kê khai tài sản, báo cáo trước ngày 30/11/2026.\n- Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc.';
  assert.deepEqual(sot(xm(kl, [viec('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc.')])), ['Sở Nội vụ phối hợp Ban Tổ chức Tỉnh ủy tham mưu kiểm tra việc kê khai tài sản, báo cáo trước ngày 30/11/2026.']);
  const ds = `${HD}\nBan Thường vụ Tỉnh ủy giao:\nSở Nội vụ rà soát biên chế;\nSở Tài chính bảo đảm kinh phí, hoàn thành trước ngày 30/11/2026.`;
  const kq = xm(ds, [viec('Sở Nội vụ rà soát biên chế', { han: '2026-11-30', trich_han: 'hoàn thành trước ngày 30/11/2026' })]);
  assert.deepEqual([kq.nhiem_vu[0].han.xac_minh, kq.nhiem_vu[0].noi_dung.con_tiep], [false, undefined], 'hạn của ý sau');
  assert.deepEqual(sot(kq), ['Ban Thường vụ Tỉnh ủy giao: Sở Tài chính bảo đảm kinh phí, hoàn thành trước ngày 30/11/2026.']);
});

// Rà soát độc lập lần 3 (18/10/2026).
const BANG = (o, sau) => `THÔNG BÁO\ný kiến chỉ đạo của Thường trực Tỉnh ủy\nThường trực Tỉnh ủy giao các cơ quan thực hiện các nhiệm vụ tại bảng\ndưới đây:\nST\nT\nNội dung nhiệm vụ Cơ quan chủ\ntrì\n`
  + `Cơ quan phối\nhợp\nThời gian\nhoàn thành\n1 ${o}\n${sau}\n2 Tổ chức hội nghị sơ kết công tác\nnăm 2026\nBan Tổ chức\nTỉnh ủy\nSở Nội vụ\nTháng\n12/2026\nNơi nhận:\n- Như trên.`;
test('ô bảng: cắt trước dòng viết hoa → còn tiếp (không tự điền); ô trọn mà ô sau là chủ trì / thời gian của chính nhiệm vụ (kể cả viết thường) → điền', () => {
  const F = { don_vi_chu_tri: 'Văn phòng Tỉnh ủy', don_vi_phoi_hop: 'Sở Nội vụ', han: '2027-03-31', trich_han: 'Quý I/2027' };
  const n = (o, sau, nd, them = F) => xm(BANG(o, sau), [viec(nd, them)]).nhiem_vu[0];
  for (const [o, nd] of [['Rà soát quy hoạch cán bộ, báo cáo\nThường trực Tỉnh ủy', 'Rà soát quy hoạch cán bộ, báo cáo'], ['Xây dựng đề án vị trí việc làm, trình\nBan Thường vụ Tỉnh ủy', 'Xây dựng đề án vị trí việc làm, trình'],
    ['Kiểm tra việc thực hiện tại\nỦy ban nhân dân các huyện', 'Kiểm tra việc thực hiện tại'], ['Tổng kết Đề án phát triển du lịch\nNon nước Cao Bằng', 'Tổng kết Đề án phát triển du lịch']]) {
    const x = n(o, 'Văn phòng\nTỉnh ủy\nSở Nội vụ\nQuý I/2027', nd);
    assert.equal(keHoachThe(x, {}).dien.noi_dung, undefined, `không tự điền "${nd}"`); assert.equal(x.noi_dung.con_tiep, o.split('\n')[1]);
  }
  assert.equal(n('Rà soát quy hoạch cán bộ, báo cáo\nThường trực Tỉnh ủy', 'Văn phòng\nTỉnh ủy', 'Rà soát quy hoạch cán bộ, báo cáo', { don_vi_chu_tri: 'Thường trực Tỉnh ủy' }).noi_dung.con_tiep
    .startsWith('Thường trực Tỉnh ủy'), true, 'trợ lý AI lấy nhầm dòng của ô làm chủ trì — vẫn không tự điền');
  const tron = [n('Rà soát quy hoạch cán bộ năm 2027', 'các sở, ngành\nSở Nội vụ\nQuý I/2027', 'Rà soát quy hoạch cán bộ năm 2027', { ...F, don_vi_chu_tri: 'các sở, ngành' }),
    n('Rà soát quy hoạch cán bộ năm 2027', 'quý I/2027\nBan Tổ chức Tỉnh ủy', 'Rà soát quy hoạch cán bộ năm 2027', { don_vi_chu_tri: 'Ban Tổ chức Tỉnh ủy', han: '2027-03-31', trich_han: 'quý I/2027' })];
  assert.deepEqual(tron.map((x) => [x.noi_dung.con_tiep, keHoachThe(x, {}).dien.noi_dung, x.han.xac_minh]),
    [[undefined, 'Rà soát quy hoạch cán bộ năm 2027', 'dung'], [undefined, 'Rà soát quy hoạch cán bộ năm 2027', 'dung']]);
});

test('danh sách thiếu dấu câu: ý mở bằng số sau dòng dài vẫn là ý (kể cả ý cuối dính "Nơi nhận:"); ý không ký hiệu kết thúc bằng "." mở bằng tên cơ quan; "tỉnh đến hết ngày" là hạn', () => {
  const A = `${HD}\nBan Thường vụ Tỉnh ủy yêu cầu:\n- Giao Sở Nội vụ chủ trì rà soát biên chế các cơ quan, đơn vị trong hệ thống chính trị\n- 100% cơ quan, đơn vị hoàn thành số hóa hồ sơ, báo cáo trước ngày 30/11/2026\n`
    + '- 03 đề án trọng điểm được Ban Thường vụ Tỉnh ủy thông qua trong quý IV/2026\nNơi nhận:\n- Như trên.';
  const kq = xm(A, [viec('Giao Sở Nội vụ chủ trì rà soát biên chế các cơ quan, đơn vị trong hệ thống chính trị', { han: '2026-11-30', trich_han: 'báo cáo trước ngày 30/11/2026' })]);
  assert.deepEqual([kq.nhiem_vu[0].han.xac_minh, kq.nhiem_vu[0].noi_dung.con_tiep, kq.tong_bo_sot], [false, undefined, 2]);
  const tb = 'TỈNH ỦY CAO BẰNG\nSố 999-TB/TU\nCao Bằng, ngày 16 tháng 10 năm 2026\nTHÔNG BÁO\nkết luận của Thường trực Tỉnh ủy về công tác cán bộ\nNgày 15/10/2026, Thường trực Tỉnh ủy họp nghe báo cáo.\n'
    + 'Thường trực Tỉnh ủy đề nghị các cơ quan:\nBan Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo trước ngày 30/11/2026.\nỦy ban Kiểm tra Tỉnh ủy kiểm tra việc kê khai tài sản, thu nhập năm 2026.\n'
    + 'Văn phòng Tỉnh ủy tổng hợp kết quả thực hiện các nội dung trên.\nNơi nhận:\n- Như trên.';
  assert.deepEqual(sot(xm(tb, [viec('Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo trước ngày 30/11/2026.')])).map((x) => x.slice(41, 60)), ['Ủy ban Kiểm tra Tỉn', 'Văn phòng Tỉnh ủy t']);
  assert.deepEqual([kiemHan('2026-12-31', 'triển khai trên địa bàn tỉnh đến hết ngày 31/12/2026'), kiemHan('2026-12-31', 'báo cáo Ủy ban nhân dân tỉnh tới ngày 31/12/2026')], [true, true]);
});

// Rà soát độc lập lần 4 (18/10/2026).
test('văn xuôi (dòng dài): dòng sau trùng phối hợp / mô tả / câu thời hạn / "03 Đề án" vẫn là câu còn tiếp — không tự điền; ô chủ trì hai cơ quan không làm ô trọn thành "chưa trọn câu"', () => {
  const P = 'Giao Sở Tài chính chủ trì rà soát, thẩm định toàn bộ danh mục các dự án đầu tư công giai đoạn 2026 – 2030, phối hợp chặt';
  const chu = `${HD}\n- ${P}\nSở Xây dựng thẩm định các dự án, báo cáo Thường trực Tỉnh ủy trước ngày 30/11/2026.\n- Giao Văn phòng Tỉnh ủy theo dõi.`;
  for (const them of [{ don_vi_phoi_hop: 'Sở Xây dựng' }, { mo_ta_san_pham: 'Sở Xây dựng thẩm định' }, { han: '2026-11-30', trich_han: 'Sở Xây dựng thẩm định các dự án' }]) {
    const x = xm(chu, [viec(P, them)]).nhiem_vu[0];
    assert.deepEqual([x.noi_dung.con_tiep, keHoachThe(x, {}).dien.noi_dung], ['Sở Xây dựng thẩm định các dự án, báo cáo Thường trực Tỉnh ủy trước ngày 30/11/2026.', undefined]);
  }
  const Q = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo các sở, ngành, địa phương xây dựng và trình ban hành';
  const x = xm(`${HD}\n- ${Q}\n03 Đề án phát triển kinh tế cửa khẩu trong quý IV/2026.\n- Giao Văn phòng Tỉnh ủy theo dõi.`, [viec(Q)]).nhiem_vu[0];
  assert.equal(x.noi_dung.con_tiep, '03 Đề án phát triển kinh tế cửa khẩu trong quý IV/2026.');
  const D = 'THÔNG BÁO\ný kiến chỉ đạo của Thường trực Tỉnh ủy\nSTT Nội dung nhiệm vụ Cơ quan chủ trì Cơ quan phối hợp Thời gian\n1 Rà soát quy hoạch các khu\ndu lịch trọng điểm\n'
    + 'Sở Văn hóa, Thể thao\nvà Du lịch; Sở Xây dựng\nỦy ban nhân dân\ncác huyện\nQuý I/2027\nNơi nhận:\n- Như trên.';
  const f = (ct) => ({ don_vi_chu_tri: ct, don_vi_phoi_hop: 'Ủy ban nhân dân các huyện', han: '2027-03-31', trich_han: 'Quý I/2027' });
  const kq = xm(D, [viec('Rà soát quy hoạch các khu du lịch trọng điểm', f('Sở Văn hóa, Thể thao và Du lịch')), viec('Rà soát quy hoạch các khu du lịch trọng điểm', f('Sở Xây dựng'))]);
  assert.deepEqual(kq.nhiem_vu.map((n) => [n.noi_dung.con_tiep, n.han.xac_minh]), [[undefined, 'dung'], [undefined, 'dung']]);
});

test('rà sót: câu dẫn xuống dòng trước tên riêng không bị tách (giữ người được giao); câu đánh giá sau câu dẫn giao việc không báo; câu dẫn dài + ý a) chép khác vẫn báo ý b), c)', () => {
  const L1 = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh phối hợp với Ban Tuyên giáo và Dân vận';
  const chu = `${HD}\n${L1}\nTỉnh ủy lãnh đạo, chỉ đạo thực hiện các nội dung sau:\na) Rà soát, điều chỉnh quy hoạch các khu du lịch trọng điểm của tỉnh;\n`
    + 'b) Kiểm tra công tác bảo tồn di sản văn hóa các dân tộc, báo cáo trước ngày 30/11/2026.\nNơi nhận:\n- Như trên.';
  const LEAD = `${L1} Tỉnh ủy lãnh đạo, chỉ đạo thực hiện các nội dung sau:`;
  assert.deepEqual(sot(xm(chu, [viec(`${LEAD} Rà soát, điều chỉnh quy hoạch các khu du lịch trọng điểm của tỉnh;`)])),
    [`${LEAD} Kiểm tra công tác bảo tồn di sản văn hóa các dân tộc, báo cáo trước ngày 30/11/2026.`]);
  const tb = 'TỈNH ỦY CAO BẰNG\nSố 999-TB/TU\nCao Bằng, ngày 16 tháng 10 năm 2026\nTHÔNG BÁO\nkết luận của Thường trực Tỉnh ủy tại buổi làm việc với các cơ quan\n'
    + 'Ngày 15/10/2026, Thường trực Tỉnh ủy làm việc với các cơ quan về tình hình thực hiện nhiệm vụ.\nSau khi nghe báo cáo, Thường trực Tỉnh ủy kết luận và giao nhiệm vụ như sau:\n'
    + 'Sở Tài chính cơ bản hoàn thành các chỉ tiêu thu ngân sách 9 tháng năm 2026, tuy nhiên tiến độ giải ngân vốn đầu tư công còn chậm.\n'
    + 'Sở Nội vụ tích cực tham mưu sắp xếp tổ chức bộ máy, bảo đảm tiến độ theo kế hoạch.\nGiao Sở Tài chính chủ trì đẩy nhanh tiến độ giải ngân, báo cáo trước ngày 30/11/2026.\nNơi nhận:\n- Như trên.';
  assert.deepEqual(sot(xm(tb, [viec('Giao Sở Tài chính chủ trì đẩy nhanh tiến độ giải ngân, báo cáo trước ngày 30/11/2026.', { don_vi_chu_tri: 'Sở Tài chính' })])), []);
  const LD = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo các sở, ngành, địa phương liên quan khẩn trương triển khai thực hiện có hiệu quả các nội dung trọng tâm sau đây:';
  const c2 = `${HD}\n${LD}\na) Rà soát, điều chỉnh quy hoạch các khu, điểm du lịch trọng điểm của tỉnh;\nb) Chỉ đạo các địa phương rà soát, triển khai thực hiện có hiệu quả các nội dung trọng tâm về du lịch;\n`
    + 'c) Kiểm tra an toàn thực phẩm dịp Tết Nguyên đán năm 2027.\nNơi nhận:\n- Như trên.';
  const r = xm(c2, [viec(`${LD} Rà soát, điều chỉnh lại quy hoạch các khu và điểm du lịch trọng điểm trên địa bàn tỉnh;`, { don_vi_chu_tri: 'Ban cán sự đảng Ủy ban nhân dân tỉnh' })]);
  assert.deepEqual(sot(r).map((x) => x.slice(LD.length + 1, LD.length + 15)), ['Chỉ đạo các đị', 'Kiểm tra an to']);
});
