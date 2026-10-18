// Unit test đối chiếu THEO VỊ TRÍ của Edge Function tro-ly-ai (v3.25 — đợt sửa gộp 18/10/2026): thông tin văn bản chỉ lấy ở phần đầu trang 1, nội dung
// điền nguyên văn chữ của tệp, câu còn tiếp, câu dẫn + ý liệt kê, hạn / phối hợp phải thuộc chính nhiệm vụ, rà soát sót / trùng. Văn bản mẫu hư cấu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xacMinhKetQua, kiemHan } from '../../supabase/functions/tro-ly-ai/xac-minh.js';
import { chuanTrich, banDo, khongDauDeu } from '../../supabase/functions/tro-ly-ai/chuan-hoa.js';
import { taoGoc } from '../../supabase/functions/tro-ly-ai/van-ban-goc.js';
import { docDau } from '../../supabase/functions/tro-ly-ai/dau-van-ban.js';
import { LOAI_VAN_BAN } from '../../supabase/functions/tro-ly-ai/de-bai.js';

const DM = { loai: LOAI_VAN_BAN.map(([m]) => m), sanPham: ['BAO_CAO'], loaiThoiHan: ['CO_HAN_CU_THE'], nganh: [], linhVuc: [], mucTieu: [] };
const viec = (noi, them = {}) => ({ noi_dung: noi, trich: '', don_vi_chu_tri: '', don_vi_phoi_hop: '', han: '', trich_han: '', loai_thoi_han: '', san_pham: '',
  mo_ta_san_pham: '', nganh: '', linh_vuc: '', muc_tieu: [], ...them });
const CV = `TỈNH ỦY CAO BẰNG
Số: 1234-CV/TU
Cao Bằng, ngày 12 tháng 10 năm 2026
V/v triển khai Kết luận số 99-KL/TU
Thực hiện Kết luận số 99-KL/TU ngày 05/10/2026 của Ban Thường vụ Tỉnh ủy, Hội nghị lần thứ 12, Thường trực Tỉnh ủy đề nghị:
1. Giao Sở Tài chính chủ trì, phối hợp với Sở Xây dựng tham mưu bố trí vốn cho các dự án trọng điểm, bảo đảm tăng thu ngân sách 12% so với năm 2025, báo cáo trước ngày 15 tháng 10 năm 2026.
2. Giao Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo Thường trực Tỉnh ủy.`;
const ND1 = 'Giao Sở Tài chính chủ trì, phối hợp với Sở Xây dựng tham mưu bố trí vốn cho các dự án trọng điểm, bảo đảm tăng thu ngân sách 12% so với năm 2025, báo cáo trước ngày 15 tháng 10 năm 2026.';

test('bản đồ ký tự: chữ chuẩn hoá trùng chuanTrich, chữ không dấu giữ độ dài', () => {
  for (const t of [CV, 'İ ﬁ 𝐀b — Đẩy, mạnh!', '']) { const b = banDo(t); assert.equal(b.chuan, chuanTrich(t)); assert.equal(b.viTri.length, b.chuan.length); assert.equal(khongDauDeu(b.chuan).length, b.chuan.length); }
});

test('hạn: câu có ngày cụ thể phải đúng ngày; 6 tháng đầu / cuối năm; "trước tháng / quý / năm", "đầu năm", quý không có năm → không xác minh', () => {
  assert.ok(!kiemHan('2026-10-31', 'báo cáo trước ngày 15 tháng 10 năm 2026')); assert.ok(kiemHan('2026-10-15', 'báo cáo trước ngày 15 tháng 10 năm 2026'));
  assert.ok(!kiemHan('2026-12-31', 'trong 6 tháng đầu năm 2026')); assert.ok(kiemHan('2026-06-30', 'trong 6 tháng đầu năm 2026'));
  assert.ok(kiemHan('2026-12-31', '6 tháng cuối năm 2026')); assert.ok(kiemHan('2026-09-30', '9 tháng đầu năm 2026'));
  for (const g of ['2026-05-31', '2026-06-30']) assert.ok(!kiemHan(g, 'hoàn thành trước tháng 6/2026'));
  assert.ok(!kiemHan('2026-09-30', 'trước quý IV/2026')); assert.ok(!kiemHan('2027-03-31', 'đầu năm 2027')); assert.ok(!kiemHan('2026-12-31', 'trong quý IV'));
  assert.ok(kiemHan('2026-12-31', 'trong quý IV năm 2026')); assert.ok(kiemHan('2026-06-30', 'từ tháng 3 đến tháng 6/2026')); assert.ok(kiemHan('2026-12-31', 'đến hết năm 2026'));
});

test('thông tin văn bản chỉ theo phần đầu trang 1: không lấy số hiệu, ngày, loại của văn bản được nhắc tới', () => {
  const r = (vb) => xacMinhKetQua({ van_ban: vb, nhiem_vu: [] }, CV, DM).van_ban;
  const tSh = 'Thực hiện Kết luận số 99-KL/TU ngày 05/10/2026 của Ban Thường vụ Tỉnh ủy';
  const sai = r({ so_hieu: { gia_tri: '99-KL/TU', trich: tSh }, ngay_ban_hanh: { gia_tri: '2026-10-05', trich: tSh }, loai: { gia_tri: 'KL_BTV', trich: tSh },
    so_hoi_nghi: { gia_tri: '5', trich: tSh } });
  assert.deepEqual([sai.so_hieu.xac_minh, sai.ngay_ban_hanh.xac_minh, sai.loai.xac_minh, sai.so_hoi_nghi.xac_minh], [false, false, false, false]);
  const dung = r({ so_hieu: { gia_tri: '1234-CV/TU', trich: 'x' }, ngay_ban_hanh: { gia_tri: '2026-10-12', trich: 'x' }, loai: { gia_tri: 'CONG_VAN', trich: 'x' },
    trich_yeu: { gia_tri: 'V/v triển khai Kết luận số 99-KL/TU', trich: '' } });
  assert.deepEqual([dung.so_hieu.xac_minh, dung.ngay_ban_hanh.xac_minh, dung.loai.xac_minh, dung.trich_yeu.xac_minh], ['dung', 'dung', 'dung', 'dung']);
  assert.equal(dung.so_hieu.trich, 'Số: 1234-CV/TU', 'trích = chính dòng của tệp');
});

test('phần đầu: dòng "Số" dính địa danh, "Số:" xuống dòng; loại theo tên loại + cơ quan + số hiệu đúng loại; số hội nghị sau "lần thứ"', () => {
  const tb = (so, ten) => `ĐẢNG BỘ TỈNH CAO BẰNGĐẢNG CỘNG SẢN VIỆT NAM\nTỈNH ỦY\n${so}Cao Bằng, ngày 12 tháng 10 năm 2026\n${ten}\nViệc triển khai nhiệm vụ năm 2027\nNội dung.`;
  const d = docDau(taoGoc(tb('Số 999-TB/TU', 'THÔNG BÁO\nÝ kiến chỉ đạo của Thường trực Tỉnh ủy')));
  assert.equal(d.soHieu.ma, '999-TB/TU'); assert.deepEqual([d.ngay.d, d.ngay.m, d.ngay.y], [12, 10, 2026]); assert.equal(d.tieuDe.tu, 'THONGBAO');
  const loai = (chu, ma) => xacMinhKetQua({ van_ban: { loai: { gia_tri: ma, trich: '' } } }, chu, DM).van_ban.loai.xac_minh;
  assert.equal(loai(tb('Số 999-TB/TU', 'THÔNG BÁO\nÝ kiến chỉ đạo của Thường trực Tỉnh ủy'), 'TB_THUONG_TRUC'), 'dung');
  assert.equal(loai(tb('Số 999-KL/TU', 'THÔNG BÁO\nÝ kiến chỉ đạo của Thường trực Tỉnh ủy'), 'TB_THUONG_TRUC'), false, 'số hiệu -KL/ không phải thông báo');
  assert.equal(loai(tb('Số 999-TB/TU', 'THÔNG BÁO KẾT LUẬN CỦA BAN THƯỜNG VỤ TỈNH ỦY'), 'TB_THUONG_TRUC'), false, 'thông báo không phải của Thường trực');
  assert.equal(loai(tb('Số 998-KL/TU', 'KẾT LUẬN\nHội nghị Ban Thường vụ Tỉnh ủy lần thứ 12'), 'KL_BTV'), 'dung');
  const hn = xacMinhKetQua({ van_ban: { so_hoi_nghi: { gia_tri: '12', trich: '' }, so_hieu: { gia_tri: '998-KL/TU', trich: '' } } },
    tb('Số:\n998-KL/TU\n', 'KẾT LUẬN\nHội nghị Ban Thường vụ Tỉnh ủy lần thứ 12'), DM).van_ban;
  assert.equal(hn.so_hoi_nghi.xac_minh, 'dung'); assert.equal(hn.so_hieu.xac_minh, 'dung', '"Số:" một dòng, số hiệu dòng sau');
  const trang2 = xacMinhKetQua({ van_ban: { trich_yeu: { gia_tri: 'về việc triển khai nhiệm vụ', trich: '' } } }, `${tb('Số 999-TB/TU', 'THÔNG BÁO')}\n\nvề việc triển khai nhiệm vụ`, DM);
  assert.equal(trang2.van_ban.trich_yeu.xac_minh, false, 'trích yếu chỉ ở trang 1');
});

test('nội dung: điền NGUYÊN VĂN chữ của tệp (AI đổi số, đổi dấu); khớp giữa từ không tính; câu còn tiếp → con_tiep', () => {
  const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec(ND1.replace('12%', '1,2%')), viec(ND1.replace('Sở Tài chính', 'Sơ Tai chinh')),
    viec(ND1.slice(2)), viec('Giao Sở Tài chính chủ trì, phối hợp với Sở Xây dựng tham mưu bố trí vốn')] }, CV, DM).nhiem_vu;
  assert.equal(kq[0].noi_dung.gia_tri, ND1); assert.equal(kq[0].noi_dung.xac_minh, 'dung');
  assert.equal(kq[1].noi_dung.gia_tri, ND1, 'tệp có dấu: lấy chữ của tệp'); assert.equal(kq[1].noi_dung.xac_minh, 'dung');
  assert.equal(kq[2].noi_dung.xac_minh, false, '"ao Sở…" bắt đầu giữa từ');
  assert.equal(kq[3].noi_dung.xac_minh, 'dung'); assert.match(kq[3].noi_dung.con_tiep, /^cho các dự án trọng điểm, .* báo cáo trước ngày 15 tháng 10 năm 2026\.$/);
  assert.equal(kq[0].noi_dung.con_tiep, undefined); assert.equal(kq[0].trang, 1);
  const mat = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec('Giao Sở Tài chính rà soát vốn đầu tư công.')] }, 'Noi dung\n- Giao So Tai chinh ra soat von dau tu cong.\n- Ket thuc van ban thu nghiem nay.', DM);
  assert.deepEqual([mat.nhiem_vu[0].noi_dung.gia_tri, mat.nhiem_vu[0].noi_dung.xac_minh], ['Giao Sở Tài chính rà soát vốn đầu tư công.', 'khong_dau'], 'tệp mất dấu: giữ chữ AI');
});

test('hạn, phối hợp, mô tả sản phẩm phải nằm trong chính nhiệm vụ (không lấy của nhiệm vụ khác)', () => {
  const nv2 = 'Giao Ban Tổ chức Tỉnh ủy rà soát quy hoạch cán bộ, báo cáo Thường trực Tỉnh ủy.';
  const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec(ND1, { han: '2026-10-15', trich_han: 'trước ngày 15 tháng 10 năm 2026', don_vi_phoi_hop: 'Sở Xây dựng' }),
    viec(nv2, { han: '2026-10-15', trich_han: 'trước ngày 15 tháng 10 năm 2026', don_vi_phoi_hop: 'Sở Xây dựng', mo_ta_san_pham: 'báo cáo Thường trực Tỉnh ủy' })] }, CV, DM).nhiem_vu;
  assert.deepEqual([kq[0].han.xac_minh, kq[0].don_vi_phoi_hop.xac_minh], ['dung', 'dung']);
  assert.deepEqual([kq[1].han.xac_minh, kq[1].don_vi_phoi_hop.xac_minh, kq[1].mo_ta_san_pham.xac_minh], [false, false, 'dung']);
  const nhieu = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec('Giao Sở Nội vụ chủ trì, phối hợp với Sở Tài chính và Ban Tổ chức Tỉnh ủy rà soát biên chế năm 2027.',
    { don_vi_phoi_hop: 'Sở Tài chính; Ban Tổ chức Tỉnh ủy' })] }, 'Mở đầu.\n- Giao Sở Nội vụ chủ trì, phối hợp với Sở Tài chính và Ban Tổ chức Tỉnh ủy rà soát biên chế năm 2027.', DM);
  assert.deepEqual(nhieu.nhiem_vu[0].don_vi_phoi_hop, { gia_tri: 'Sở Tài chính; Ban Tổ chức Tỉnh ủy', xac_minh: 'dung' }, 'từng đơn vị phối hợp');
});

const DAN = `Mở đầu văn bản thử nghiệm.
Thường trực Tỉnh ủy đề nghị:
1. Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chỉ đạo:
a) Rà soát, sắp xếp các dự án đầu tư công, hoàn thành trong quý IV/2026;
b) Xây dựng kế hoạch phát triển du lịch năm 2027, báo cáo Thường trực Tỉnh ủy trước ngày 15/12/2026.
2. Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan thực hiện.
Nơi nhận:
- Như trên, giao các cơ quan lưu.`;
const LEAD = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chỉ đạo:';
test('câu dẫn + ý liệt kê: mỗi phần khớp nguyên văn, hạn theo ý của chính nhiệm vụ; rà soát sót (bỏ câu dẫn, nơi nhận) và trùng', () => {
  const b = `${LEAD} Xây dựng kế hoạch phát triển du lịch năm 2027, báo cáo Thường trực Tỉnh ủy trước ngày 15/12/2026.`;
  const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec(b, { han: '2026-12-15', trich_han: 'trước ngày 15/12/2026', don_vi_chu_tri: 'Ban cán sự đảng Ủy ban nhân dân tỉnh' }),
    viec(b, { don_vi_chu_tri: 'Ban cán sự đảng Ủy ban nhân dân tỉnh' }), viec(b, { don_vi_chu_tri: 'Văn phòng Tỉnh ủy' })] }, DAN, DM);
  const [n1, n2, n3] = kq.nhiem_vu;
  assert.deepEqual([n1.noi_dung.xac_minh, n1.noi_dung.gia_tri, n1.han.xac_minh], ['dung', b, 'dung']);
  assert.equal(n1.noi_dung.con_tiep, undefined);
  assert.equal(n2.trung_voi, 0, 'cùng đoạn, cùng chủ trì → trùng'); assert.equal(n3.trung_voi, undefined, 'khác chủ trì → không trùng');
  assert.deepEqual(kq.nghi_bo_sot.map((x) => x.chu), [`${LEAD} Rà soát, sắp xếp các dự án đầu tư công, hoàn thành trong quý IV/2026`,
    'Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan thực hiện.'], 'ý liệt kê sót kèm câu dẫn giao việc của nó');
  assert.equal(kq.tong_bo_sot, 2); assert.equal(kq.nghi_bo_sot[0].trang, 1);
  const a = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec(`${LEAD} Rà soát, sắp xếp các dự án đầu tư công, hoàn thành trong quý IV/2026;`, { han: '2026-12-15', trich_han: 'trước ngày 15/12/2026' })] }, DAN, DM).nhiem_vu[0];
  assert.deepEqual([a.noi_dung.xac_minh, a.han.xac_minh], ['dung', false], 'hạn của ý b) không gán cho ý a)');
  const dan = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec('Giao Ban cán sự đảng Ủy ban nhân dân tỉnh chỉ đạo')] }, DAN, DM).nhiem_vu[0];
  assert.equal(dan.noi_dung.cau_dan, true); assert.match(dan.noi_dung.con_tiep, /^: a\) Rà soát/);
});

test('một nhiệm vụ gồm câu dẫn và các ý a), b): AI bỏ ký hiệu đầu ý ở giữa vẫn khớp; "điểm b) khoản 2" giữa câu không bị bỏ', () => {
  const chu = 'Mở đầu.\n- Giao Sở Nội vụ xây dựng đề án vị trí việc làm, trong đó tập trung:\na) Rà soát biên chế các cơ quan;\nb) Đề xuất phương án sắp xếp, báo cáo trước ngày 30/11/2026.\n- Giao Sở Tư pháp hướng dẫn thực hiện điểm b) khoản 2 Điều 5 Quy định số 09.';
  const nd = 'Giao Sở Nội vụ xây dựng đề án vị trí việc làm, trong đó tập trung: Rà soát biên chế các cơ quan; Đề xuất phương án sắp xếp, báo cáo trước ngày 30/11/2026.';
  const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec(nd, { han: '2026-11-30', trich_han: 'trước ngày 30/11/2026' }),
    viec('Giao Sở Tư pháp hướng dẫn thực hiện điểm khoản 2 Điều 5 Quy định số 09.')] }, chu, DM).nhiem_vu;
  assert.deepEqual([kq[0].noi_dung.xac_minh, kq[0].noi_dung.gia_tri, kq[0].han.xac_minh], ['dung', nd, 'dung']);
  assert.equal(kq[1].noi_dung.xac_minh, false, 'chữ "b)" giữa câu là nội dung, không phải ký hiệu đầu ý');
});

test('rà soát sót: câu đánh giá, "Ban Tuyên giáo", "được giao" không tính; thời hạn ngay sau nhiệm vụ đã tách không tính', () => {
  const chu = `KẾT LUẬN\ncủa Ban Thường vụ Tỉnh ủy\nNăm qua, Ban Tuyên giáo Tỉnh ủy đã chủ trì tốt các nhiệm vụ được giao, đáp ứng yêu cầu đề ra.\n- Giao Sở Văn hóa xây dựng đề án bảo tồn di sản.\nThời hạn hoàn thành: trước ngày 30/11/2026.\n- Đề nghị các huyện ủy quán triệt kết luận này.`;
  const kq = xacMinhKetQua({ van_ban: {}, nhiem_vu: [viec('Giao Sở Văn hóa xây dựng đề án bảo tồn di sản.')] }, chu, DM);
  assert.deepEqual(kq.nghi_bo_sot.map((x) => x.chu), ['Đề nghị các huyện ủy quán triệt kết luận này.']);
  assert.deepEqual(xacMinhKetQua({ van_ban: {}, nhiem_vu: [] }, '', DM).nghi_bo_sot, [], 'bản chụp: không rà');
  const cv = `TỈNH ỦY CAO BẰNG\nVĂN PHÒNG\n* Cao Bằng, ngày 20 tháng 10 năm 2026\nSố 9001-CV/VPTU\nV/v triển khai kết luận\nKính gửi: Các cơ quan tham mưu, giúp việc Tỉnh ủy; Đảng ủy\nỦy ban nhân dân tỉnh.
Thời gian qua, Ban Tổ chức Tỉnh ủy đã chủ trì tham mưu tốt công tác cán bộ.\n3. Tổ chức thực hiện\nCác cơ quan, đơn vị căn cứ Công văn này xây dựng kế hoạch, hoàn thành trước ngày 15/11/2026.
Văn phòng Tỉnh ủy đề nghị các cơ quan quan tâm, phối hợp thực hiện.`;
  assert.deepEqual(xacMinhKetQua({ van_ban: {}, nhiem_vu: [] }, cv, DM).nghi_bo_sot.map((x) => x.chu),
    ['Các cơ quan, đơn vị căn cứ Công văn này xây dựng kế hoạch, hoàn thành trước ngày 15/11/2026.'], 'không rà phần đầu ("Kính gửi … tham mưu"), câu đánh giá, câu kết; bỏ dòng tiêu đề mục');
});
