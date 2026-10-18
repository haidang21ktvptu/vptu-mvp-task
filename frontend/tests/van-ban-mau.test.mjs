// Hồi quy đối chiếu kết quả trợ lý AI trên năm văn bản mẫu HƯ CẤU (tests/ai-van-ban-mau — chữ pdf.js như trình duyệt đọc): kết quả AI giả định chép
// đúng → mọi giá trị đối chiếu được như bảng README, không báo sót / trùng nhầm; chép sai kiểu thường gặp → không được đánh dấu đối chiếu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { xacMinhKetQua } from '../../supabase/functions/tro-ly-ai/xac-minh.js';
import { LOAI_VAN_BAN } from '../../supabase/functions/tro-ly-ai/de-bai.js';

const chu = (f) => readFileSync(new URL(`../../tests/ai-van-ban-mau/${f}.txt`, import.meta.url), 'utf8');
const DM = { loai: LOAI_VAN_BAN.map(([m]) => m), sanPham: ['BAO_CAO'], loaiThoiHan: ['CO_HAN_CU_THE'], nganh: [], linhVuc: [], mucTieu: [] };
const v = (noi, x = {}) => ({ noi_dung: noi, trich: '', don_vi_chu_tri: '', don_vi_phoi_hop: '', han: '', trich_han: '', loai_thoi_han: '', san_pham: '',
  mo_ta_san_pham: '', nganh: '', linh_vuc: '', muc_tieu: [], ...x });
const vb = (loai, so, ngay, ty, hn = '') => ({ loai: { gia_tri: loai, trich: '' }, so_hieu: { gia_tri: so, trich: '' }, ngay_ban_hanh: { gia_tri: ngay, trich: '' },
  trich_yeu: { gia_tri: ty, trich: '' }, so_hoi_nghi: { gia_tri: hn, trich: '' } });
// Mỗi nhiệm vụ → [nội dung đối chiếu, hạn đối chiếu, còn tiếp?, trùng?]; văn bản → các ô có giá trị đều 'dung'.
const tom = (kq) => ({ vb: Object.entries(kq.van_ban).filter(([, x]) => x.gia_tri).every(([, x]) => x.xac_minh === 'dung'),
  nv: kq.nhiem_vu.map((n) => [n.noi_dung.xac_minh, n.han.gia_tri ? n.han.xac_minh : '-', Boolean(n.noi_dung.con_tiep), Number.isInteger(n.trung_voi)]), sot: kq.tong_bo_sot });
const D = ['dung', 'dung', false, false]; const KH = ['dung', '-', false, false];

test('1 · kết luận 998-KL/TU: 3 nhiệm vụ, hạn quý I năm 2027 = 31/03/2027', () => {
  const kq = xacMinhKetQua({ van_ban: vb('KL_BTV', '998-KL/TU', '2026-10-16', 'về một số nhiệm vụ trọng tâm cuối năm 2026', '12'), nhiem_vu: [
    v('Giao Ban Tổ chức Tỉnh ủy chủ trì, phối hợp với Văn phòng Tỉnh ủy tham mưu triển khai Nghị quyết số 57-NQ/TW của Bộ Chính trị trong công tác tổ chức xây dựng Đảng, trọng tâm là chuyển đổi số hồ sơ đảng viên; hoàn thành trước ngày 15/12/2026.', { han: '2026-12-15', trich_han: 'hoàn thành trước ngày 15/12/2026' }),
    v('Giao Đảng ủy Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo xây dựng Đề án phát triển kinh tế rừng gắn với bảo vệ rừng đầu nguồn; trình Ban Thường vụ Tỉnh ủy trong quý I năm 2027.', { han: '2027-03-31', trich_han: 'trong quý I năm 2027' }),
    v('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan, đơn vị thực hiện Kết luận này; tổng hợp, báo cáo Ban Thường vụ Tỉnh ủy trước ngày 31/12/2026.', { han: '2026-12-31', trich_han: 'trước ngày 31/12/2026' }),
  ] }, chu('1-ket-luan-998-KL-TU'), DM);
  assert.deepEqual(tom(kq), { vb: true, nv: [D, D, D], sot: 0 });
});

test('2 · thông báo 999-TB/TU: 6 nhiệm vụ, 2.6 vắt trang, "hằng tháng" không hạn, phần đánh giá không báo sót', () => {
  const n = (noi, han, trich) => v(noi, han ? { han, trich_han: trich } : {});
  const kq = xacMinhKetQua({ van_ban: vb('TB_THUONG_TRUC', '999-TB/TU', '2026-10-15', 'của Thường trực Tỉnh ủy về một số nhiệm vụ trọng tâm quý IV năm 2026'), nhiem_vu: [
    n('Giao Văn phòng Tỉnh ủy chủ trì, phối hợp với Sở Khoa học và Công nghệ xây dựng kế hoạch triển khai Nghị quyết số 57-NQ/TW của Bộ Chính trị về đột phá phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số quốc gia trong các cơ quan đảng của tỉnh; hoàn thành, trình Thường trực Tỉnh ủy trước ngày 30/11/2026.', '2026-11-30', 'trước ngày 30/11/2026'),
    n('Giao Ban Tuyên giáo và Dân vận Tỉnh ủy chủ trì tham mưu sơ kết việc thực hiện Nghị quyết số 15-NQ/TU của Ban Chấp hành Đảng bộ tỉnh về phát triển du lịch bền vững gắn với Công viên địa chất toàn cầu UNESCO Non nước Cao Bằng; báo cáo Thường trực Tỉnh ủy trước ngày 15/12/2026.', '2026-12-15', 'trước ngày 15/12/2026'),
    n('Giao Đảng ủy Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo đẩy nhanh tiến độ giải ngân vốn đầu tư công năm 2026, phấn đấu tỷ lệ giải ngân đạt trên 95% kế hoạch vốn được giao; báo cáo kết quả về Thường trực Tỉnh ủy hằng tháng.'),
    n('Giao Ban Tổ chức Tỉnh ủy chủ trì rà soát, bổ sung quy hoạch cán bộ nhiệm kỳ 2025–2030, chú trọng nâng cao chất lượng đội ngũ cán bộ lãnh đạo, quản lý các cấp; hoàn thành trong tháng 12/2026.', '2026-12-31', 'hoàn thành trong tháng 12/2026'),
    n('Giao Đảng ủy Ủy ban nhân dân tỉnh chỉ đạo xây dựng phương án phát triển kinh tế cửa khẩu gắn với bảo đảm quốc phòng, an ninh khu vực biên giới; trình Thường trực Tỉnh ủy trong quý I năm 2027.', '2027-03-31', 'trong quý I năm 2027'),
    n('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan, đơn vị thực hiện Thông báo này; tổng hợp kết quả, báo cáo Thường trực Tỉnh ủy trước ngày 25/12/2026.', '2026-12-25', 'trước ngày 25/12/2026'),
  ] }, chu('2-thong-bao-999-TB-TU'), DM);
  assert.deepEqual(tom(kq), { vb: true, nv: [D, D, KH, D, D, D], sot: 0 });
});

const M1 = 'Ban Tuyên giáo và Dân vận Tỉnh ủy, Ban Tổ chức Tỉnh ủy, Ủy ban Kiểm tra Tỉnh ủy theo chức năng, nhiệm vụ rà soát các văn bản hướng dẫn thuộc lĩnh vực phụ trách, báo cáo kết quả về Văn phòng Tỉnh ủy trước tháng 12/2026.';
test('3 · công văn 9001-CV/VPTU: giao ba cơ quan ngang nhau (không trùng), "trước tháng 12/2026" chỉ gợi ý, phối hợp từng đơn vị, câu kết không báo sót', () => {
  const kq = xacMinhKetQua({ van_ban: vb('CONG_VAN', '9001-CV/VPTU', '2026-10-20', 'V/v triển khai Kết luận số 990-KL/TU'), nhiem_vu: [
    ...['Ban Tuyên giáo và Dân vận Tỉnh ủy', 'Ban Tổ chức Tỉnh ủy', 'Ủy ban Kiểm tra Tỉnh ủy'].map((ct) => v(M1, { don_vi_chu_tri: ct, han: '2026-11-30', trich_han: 'trước tháng 12/2026' })),
    v('Đảng ủy Ủy ban nhân dân tỉnh chỉ đạo Sở Tài chính chủ trì, phối hợp với Sở Xây dựng, Kho bạc Nhà nước khu vực tham mưu bố trí vốn đối ứng cho các dự án trọng điểm, bảo đảm tỷ lệ giải ngân đạt 95,5% kế hoạch; hoàn thành trong 6 tháng đầu năm 2027.',
      { don_vi_phoi_hop: 'Sở Xây dựng; Kho bạc Nhà nước khu vực', han: '2027-06-30', trich_han: 'hoàn thành trong 6 tháng đầu năm 2027' }),
    v('Văn phòng Tỉnh ủy tổng hợp kết quả thực hiện, báo cáo Thường trực Tỉnh ủy trước ngày 20/01/2027.', { han: '2027-01-20', trich_han: 'trước ngày 20/01/2027' }),
  ] }, chu('3-cong-van-9001-CV-VPTU'), DM);
  const G = ['dung', false, false, false];
  assert.deepEqual(tom(kq), { vb: true, nv: [G, G, G, D, D], sot: 0 });
  assert.equal(kq.nhiem_vu[3].don_vi_phoi_hop.xac_minh, 'dung');
  const sai = xacMinhKetQua({ van_ban: vb('KL_BTV', '990-KL/TU', '2026-10-05', 'Kết luận số 990-KL/TU', '11'), nhiem_vu: [] }, chu('3-cong-van-9001-CV-VPTU'), DM).van_ban;
  assert.deepEqual(['loai', 'so_hieu', 'ngay_ban_hanh', 'so_hoi_nghi'].map((k) => sai[k].xac_minh), [false, false, false, false], 'không lấy của văn bản được nhắc tới');
});

test('4 · kết luận 991-KL/TU: câu dẫn + ý a) b) c), việc gồm nhiều ý vắt trang, đánh giá "đã chủ trì" không báo sót, mục 3 chưa tách → có thể còn sót', () => {
  const c = chu('4-ket-luan-991-KL-TU'); const L = 'Giao Ban cán sự đảng Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo:';
  const a = c.slice(c.indexOf('Xây dựng Đề án'), c.indexOf('quý II/2027.') + 12).replace(/\s+/g, ' ');
  const kq = xacMinhKetQua({ van_ban: vb('KL_BTV', '991-KL/TU', '2026-10-21', 'về phát triển du lịch và công tác cán bộ', '13'), nhiem_vu: [
    v(`${L} ${a}`, { han: '2027-06-30', trich_han: 'trong quý II/2027' }),
    v(`${L} Rà soát quy hoạch các khu, điểm du lịch trọng điểm; hoàn thành trước ngày 31/03/2027.`, { han: '2027-03-31', trich_han: 'hoàn thành trước ngày 31/03/2027' }),
    v(`${L} Chỉ đạo các sở, ngành tăng cường công tác phòng, chống thiên tai, chủ động phương án ứng phó với rét đậm, rét hại.`),
    v('Giao Ban Tổ chức Tỉnh ủy xây dựng đề án vị trí việc làm của các cơ quan đảng, trong đó tập trung: Rà soát biên chế được giao của từng cơ quan; Đề xuất phương án sắp xếp, bố trí cán bộ; báo cáo Ban Thường vụ Tỉnh ủy trước ngày 30/11/2026.',
      { han: '2026-11-30', trich_han: 'trước ngày 30/11/2026' }),
    v('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc việc thực hiện Kết luận này, định kỳ 6 tháng báo cáo Ban Thường vụ Tỉnh ủy.'),
  ] }, c, DM);
  assert.deepEqual(tom(kq), { vb: true, nv: [D, D, KH, D, KH], sot: 1 });
  assert.match(kq.nghi_bo_sot[0].chu, /^Các cơ quan, đơn vị căn cứ Kết luận này .* trước ngày 15\/11\/2026\.$/);
  assert.equal(kq.nhiem_vu[3].trang, 1);
});

test('5 · thông báo 9002-TB/TU có bảng: nội dung, chủ trì / phối hợp / thời gian ở cột vẫn đối chiếu được trong dòng của bảng', () => {
  const r = (noi, ph, han, trich) => v(noi, { don_vi_phoi_hop: ph, han, trich_han: trich });
  const kq = xacMinhKetQua({ van_ban: vb('TB_THUONG_TRUC', '9002-TB/TU', '2026-10-22', 'ý kiến chỉ đạo của Thường trực Tỉnh ủy về một số nhiệm vụ trọng tâm (hư cấu)'), nhiem_vu: [
    r('Xây dựng kế hoạch chuyển đổi số trong các cơ quan đảng năm 2027', 'Sở Khoa học và Công nghệ', '2026-12-31', 'Tháng 12/2026'),
    r('Tổ chức hội nghị sơ kết 5 năm thực hiện Nghị quyết số 15-NQ/TU về phát triển du lịch', 'Sở Văn hóa, Thể thao và Du lịch', '2027-03-31', 'Quý I/2027'),
    r('Rà soát, bổ sung quy hoạch cán bộ diện Ban Thường vụ Tỉnh ủy quản lý', 'Ủy ban Kiểm tra Tỉnh ủy', '2026-11-30', 'Trước ngày 30/11/2026'),
    v('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc, tổng hợp kết quả, báo cáo Thường trực Tỉnh ủy trước ngày 25/12/2026.', { han: '2026-12-25', trich_han: 'trước ngày 25/12/2026' }),
  ] }, chu('5-thong-bao-9002-TB-TU-bang'), DM);
  assert.deepEqual(tom(kq), { vb: true, nv: [D, D, D, D], sot: 0 });
  assert.deepEqual(kq.nhiem_vu.slice(0, 3).map((n) => n.don_vi_phoi_hop.xac_minh), ['dung', 'dung', 'dung']);
});

test('chép sai kiểu thường gặp: cắt cụt trước tên cơ quan xuống dòng, trích yếu thiếu dòng sau, số hiệu sai dạng, hạn của việc khác', () => {
  const c = chu('1-ket-luan-998-KL-TU');
  const kq = xacMinhKetQua({ van_ban: vb('KL_BTV', '998/KL-TU', '2026-10-16', 'của Ban Thường vụ Tỉnh ủy tại Hội nghị lần thứ 12 về một số nhiệm vụ'), nhiem_vu: [
    v('Giao Đảng ủy Ủy ban nhân dân tỉnh lãnh đạo, chỉ đạo xây dựng Đề án phát triển kinh tế rừng gắn với bảo vệ rừng đầu nguồn; trình Ban Thường vụ'),
    v('Giao Văn phòng Tỉnh ủy theo dõi, đôn đốc các cơ quan, đơn vị thực hiện Kết luận này; tổng hợp, báo cáo Ban Thường vụ Tỉnh ủy trước ngày 31/12/2026.', { han: '2026-12-15', trich_han: 'trước ngày 15/12/2026' }),
  ] }, c, DM);
  assert.match(kq.nhiem_vu[0].noi_dung.con_tiep, /^Tỉnh ủy trong quý I năm 2027\.$/, 'câu còn tiếp ở dòng sau (viết hoa) — không tự điền');
  assert.equal(kq.nhiem_vu[1].han.xac_minh, false, 'hạn 15/12 là của nhiệm vụ 1');
  assert.deepEqual([kq.van_ban.so_hieu.gia_tri, kq.van_ban.so_hieu.xac_minh], ['998-KL/TU', 'dung'], 'điền số hiệu theo chữ của tệp');
  assert.equal(kq.van_ban.trich_yeu.gia_tri, 'của Ban Thường vụ Tỉnh ủy tại Hội nghị lần thứ 12 về một số nhiệm vụ trọng tâm cuối năm 2026', 'trích yếu lấy trọn');
});
