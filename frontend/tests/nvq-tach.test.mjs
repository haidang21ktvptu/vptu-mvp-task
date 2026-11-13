// v3.35 — Phân hệ Nhiệm vụ quý BTV: đọc bảng Phụ lục (Word) và mẫu Excel thành dòng nhập (lib/nvq/tach.js, phu-luc.js, mau-excel.js, doc-word.js). Dữ
// liệu GIẢ (tên cán bộ giả — không dùng tên thật trong repo): nhận lãnh đạo phụ trách, đơn vị tham mưu, tách kết quả / sản phẩm "(1) … (2) …", mốc từ
// cột Tiến độ, chỉ tiêu số liệu, chữ đỏ cột Stt = chủ trì theo dõi (người đầu chủ trì, người sau phối hợp; "PHÒNG …" là phòng), chữ đỏ cột Kết quả
// có số văn bản → đã ban hành; mẫu Excel xuất rồi đọc lại giữ nguyên.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nhanLanhDao, nhanDonVi, tinhChatTienDo, hanTu, docChiTieu, loaiKetQua, tachDanhSo, tachSanPham, docVanBanKetQua, coHoanThanh, tachTenTheoDoi, khopTen, phongTuTen }
  from '../src/lib/nvq/tach.js';
import { dongTuPhuLuc, tomTatNhap, tenViTri, kiemDongNhap } from '../src/lib/nvq/phu-luc.js';
import { sheetMau, dongTuMau } from '../src/lib/nvq/mau-excel.js';
import { docBangXml, cacBang } from '../src/lib/nvq/doc-word.js';

const KY = { nam: 2026, quy: 4, tu_ngay: '2026-10-01', den_ngay: '2026-12-31' };
const LD = [['BI_THU', 1], ['PBT_TT', 2], ['PBT_UBND', 3], ['PBT_MTTQ', 4], ['TT_TU', 5]].map(([ma, thu_tu]) => ({ ma, thu_tu }));
const DV = [['DU_UBND', 'Đảng ủy UBND tỉnh', ['đảng ủy ubnd']], ['BTC', 'Ban Tổ chức Tỉnh ủy', ['ban tổ chức']], ['VPTU', 'Văn phòng Tỉnh ủy', ['văn phòng tỉnh ủy']]]
  .map(([ma, ten, tu_khoa], i) => ({ ma, ten, tu_khoa, thu_tu: i + 1 }));
const TK = [{ id: 'a', full_name: 'Nguyễn Văn An' }, { id: 'b', full_name: 'Trần Thị Bình' }, { id: 'c', full_name: 'Lê Văn Cường' }, { id: 'd', full_name: 'Lê Văn Cường', role_group: 'A0' }];
const PHONG = { CDS_CY: ['Phòng Chuyển đổi số - Cơ yếu', 'CĐS-CY'], TONG_HOP: ['Phòng Tổng hợp', 'Tổng hợp'] };

test('Lãnh đạo phụ trách: Phó Bí thư Thường trực không nhầm Bí thư; Chủ tịch UBND; Thường trực Tỉnh ủy; câu chỉ chức danh chung không khớp', () => {
  assert.deepEqual(nhanLanhDao('Bí thư Tỉnh ủy; Phó Bí thư Tỉnh ủy, Chủ tịch UBND tỉnh', LD), ['BI_THU', 'PBT_UBND']);
  assert.deepEqual(nhanLanhDao('Phó Bí thư Thường trực Tỉnh ủy', LD), ['PBT_TT']);
  assert.deepEqual(nhanLanhDao('Thường trực Tỉnh ủy', LD), ['TT_TU']);
  assert.deepEqual(nhanLanhDao('Phó Bí thư Tỉnh ủy, Chủ tịch Ủy ban MTTQ Việt Nam tỉnh', LD), ['PBT_MTTQ']);
  assert.deepEqual(nhanLanhDao('Phó Bí thư Tỉnh ủy,', LD), []);
});

test('Đơn vị tham mưu: vai trò chủ trì / phối hợp / thẩm định, phần cụ thể trong ngoặc', () => {
  assert.deepEqual(nhanDonVi('Đảng ủy UBND tỉnh (Sở Tài chính)\nBan Tổ chức Tỉnh ủy phối hợp', DV),
    [{ ma: 'DU_UBND', vai_tro: 'CHU_TRI', cu_the: 'Sở Tài chính' }, { ma: 'BTC', vai_tro: 'PHOI_HOP', cu_the: null }]);
  assert.equal(nhanDonVi('Văn phòng Tỉnh ủy thẩm định', DV)[0].vai_tro, 'THAM_DINH');
});

test('Tiến độ → tính chất, mốc: tháng, khoảng tháng, quý, thường xuyên, định kỳ', () => {
  assert.equal(hanTu('Tháng 11/2026', KY), '2026-11-30');
  assert.equal(hanTu('Tháng 11 - 12/2026', KY), '2026-12-31');
  assert.equal(hanTu('Quý IV/2026', KY), '2026-12-31');
  assert.equal(hanTu('Tháng 10', KY), '2026-10-31');
  assert.equal(tinhChatTienDo('Thường xuyên'), 'THUONG_XUYEN');
  assert.equal(tinhChatTienDo('Thường xuyên, khi có phát sinh'), 'KHI_PHAT_SINH');
  assert.equal(tinhChatTienDo('Định kỳ hằng tháng'), 'DINH_KY');
  assert.equal(tinhChatTienDo('Sau khi Trung ương ban hành'), 'CHO_DIEU_KIEN');
  assert.equal(tinhChatTienDo('Tháng 12/2026'), 'CO_MOC');
});

test('Chỉ tiêu số liệu (số kiểu Việt Nam), loại kết quả, tách "(1) … (2) …"', () => {
  assert.deepEqual(docChiTieu('- GRDP quý IV: 14,86%'), { mo_ta: 'GRDP quý IV: 14,86%', muc_tieu: 14.86, don_vi_tinh: '%', chi_tieu_co_ban: 'GRDP' });
  assert.equal(docChiTieu('Thu ngân sách 3.530 tỷ đồng').muc_tieu, 3530);
  assert.equal(docChiTieu('Bảo đảm 100% xã có kế hoạch'), null, '% không gắn chỉ tiêu cơ bản → không phải số liệu');
  assert.equal(loaiKetQua('Tổ chức hội nghị sơ kết'), 'HOAT_DONG');
  assert.equal(loaiKetQua('Kế hoạch triển khai'), 'VAN_BAN');
  assert.deepEqual(tachDanhSo('(1) Ban hành kế hoạch; (2) Tổ chức hội nghị.'), ['Ban hành kế hoạch', 'Tổ chức hội nghị.']);
  assert.deepEqual(tachDanhSo('Một kết quả (2) không đánh số từ 1'), ['Một kết quả (2) không đánh số từ 1']);
});

test('Tách kết quả / sản phẩm: mốc theo từng phần tiến độ; định kỳ hằng tháng → mỗi tháng một mốc', () => {
  const a = tachSanPham('(1) Ban hành kế hoạch; (2) Tổ chức hội nghị', '(1) Tháng 10/2026; (2) Tháng 12/2026', KY);
  assert.deepEqual(a.sanPham.map((s) => [s.loai, s.han, s.thu_tu]), [['VAN_BAN', '2026-10-31', 1], ['HOAT_DONG', '2026-12-31', 2]]);
  const b = tachSanPham('Báo cáo tình hình', 'Định kỳ hằng tháng', KY);
  assert.equal(b.tinhChat, 'DINH_KY');
  assert.deepEqual(b.sanPham.map((s) => s.han), ['2026-10-31', '2026-11-30', '2026-12-31']);
  assert.ok(b.sanPham.every((s) => s.loai === 'DINH_KY'));
});

test('Kết quả đã cập nhật: số, ký hiệu và ngày văn bản; "hoàn thành 1/2" không phải hoàn thành', () => {
  assert.deepEqual(docVanBanKetQua('Đã ban hành Kế hoạch số 199-KH/TU ngày 5/11/2026'), { so_ky_hieu: '199-KH/TU', ngay: '2026-11-05' });
  assert.equal(coHoanThanh('HOÀN THÀNH'), true);
  assert.equal(coHoanThanh('Hoàn thành 1/2 nội dung'), false);
});

test('Chủ trì theo dõi: tách tên, khớp tài khoản (bỏ dấu, viết liền, gõ lệch nhẹ, bí danh), trùng tên → không tự chọn; "PHÒNG CĐS-CY" là phòng', () => {
  assert.deepEqual(tachTenTheoDoi('(3)\nNGUYỄN VĂN AN; TRẦN THỊ BÌNH'), ['NGUYỄN VĂN AN', 'TRẦN THỊ BÌNH']);
  assert.equal(khopTen('NGUYỄN VĂN AN', TK).id, 'a');
  assert.equal(khopTen('TRẦN THỊBÌNH', TK).id, 'b', 'viết liền');
  assert.equal(khopTen('Lê Văn Cường', TK).id, 'c', 'tài khoản Thường trực không được chọn làm chủ trì');
  assert.equal(khopTen('Trần Văn Bình', TK).id, 'b', 'lệch tên đệm');
  assert.equal(khopTen('Hoàng Văn Dũng', TK).id, null);
  assert.equal(khopTen('Hoàng Văn Dũng', TK, { biDanh: { 'HOANG VAN DUNG': 'c' } }).id, 'c', 'bí danh do người nhập chọn');
  assert.equal(phongTuTen('PHÒNG CĐS-CY', PHONG), 'CDS_CY');
  assert.equal(phongTuTen('Phòng Tổng hợp', PHONG), 'TONG_HOP');
  assert.equal(phongTuTen('NGUYỄN VĂN AN', PHONG), null);
});

// Một ô bảng: { den: chữ đen, do: chữ đỏ, tat: toàn văn }.
const o = (den = '', dO = '') => ({ den, do: dO, tat: [den, dO].filter(Boolean).join('\n') });
const BANG = [
  [o('Stt'), o('Nhiệm vụ được giao'), o('Lãnh đạo phụ trách'), o('Trục'), o('Đơn vị'), o('Kết quả'), o('Tiến độ')],
  [o(), o('I. Các nhiệm vụ thuộc trục 1: Kinh tế'), o(), o(), o(), o(), o()],
  [o('1'), o('Nhiệm vụ được phê duyệt theo chương trình, kế hoạch công tác'), o(), o(), o(), o(), o()],
  [o('(1)', 'NGUYỄN VĂN AN; TRẦN THỊ BÌNH'), o('Chỉ đạo thực hiện chỉ tiêu tăng trưởng'), o('Bí thư Tỉnh ủy'), o('Trục 1'), o('Đảng ủy UBND tỉnh'),
    o('- GRDP quý IV: 8,5%'), o('Quý IV/2026')],
  [o('(2)', 'PHÒNG CĐS-CY'), o('Ban hành kế hoạch chuyển đổi số'), o('Phó Bí thư Thường trực Tỉnh ủy'), o('Trục 1'), o('Văn phòng Tỉnh ủy'),
    o('Kế hoạch triển khai', 'Đã ban hành Kế hoạch số 77-KH/TU ngày 10/10/2026'), o('Tháng 10/2026', 'HOÀN THÀNH')],
  [o('2'), o('Nhiệm vụ được giao ngoài chương trình, kế hoạch'), o(), o(), o(), o(), o()],
  [o('(1)', 'HOÀNG VĂN DŨNG'), o('Tổ chức hội nghị sơ kết'), o('Thường trực Tỉnh ủy'), o('Trục 1'), o('Ban Tổ chức Tỉnh ủy'), o('Tổ chức hội nghị'), o('Tháng 12/2026')],
];

test('Bảng Phụ lục → dòng nhập: trục / nhóm / Stt, chủ trì + phối hợp theo dõi, phòng, đã ban hành theo chữ đỏ, cảnh báo tên chưa khớp', () => {
  const { dong, canhBao } = dongTuPhuLuc(BANG, { ky: KY, dmLanhDao: LD, dmDonVi: DV, taiKhoan: TK, tenPhong: PHONG, tenTep: 'pl.docx' });
  assert.deepEqual(dong.map(tenViTri), ['I.1.(1)', 'I.1.(2)', 'I.2.(1)']);
  const [a, b, c] = dong;
  assert.deepEqual([a.chu_tri_theo_doi, a.phoi_hop_theo_doi, a.lanh_dao_ma], ['a', ['b'], ['BI_THU']]);
  assert.deepEqual(a.san_pham.map((s) => [s.loai, s.chi_tieu_co_ban, s.muc_tieu]), [['CHI_TIEU', 'GRDP', 8.5]]);
  assert.equal(b.phong_theo_doi, 'CDS_CY'); assert.equal(b.chu_tri_theo_doi, null);
  assert.deepEqual([b.san_pham[0].trang_thai, b.san_pham[0].kq_so_ky_hieu, b.san_pham[0].kq_ngay], ['HOAN_THANH', '77-KH/TU', '2026-10-10']);
  assert.match(b.cap_nhat_dau.ket_qua_thuc_hien, /77-KH\/TU/);
  assert.equal(c.nhom, 'NGOAI_CT'); assert.deepEqual(c.lanh_dao_ma, ['TT_TU']);
  assert.ok(canhBao.some((x) => /HOÀNG VĂN DŨNG/.test(x)), 'báo tên chưa khớp');
  assert.deepEqual(tomTatNhap(dong), { tong: 3, theoTruc: { 1: 3 }, trongCt: 2, ngoaiCt: 1, hoanThanh: 1, chuaPhanCong: 1, sanPham: 3 });
});

test('Mẫu Excel: xuất danh mục rồi đọc lại giữ nguyên vị trí, chủ trì, kết quả / sản phẩm', () => {
  const { dong } = dongTuPhuLuc(BANG, { ky: KY, dmLanhDao: LD, dmDonVi: DV, taiKhoan: TK, tenPhong: PHONG });
  const ten = (id) => TK.find((t) => t.id === id)?.full_name || '';
  const sh = sheetMau({ dong, tenNguoi: ten, tenPhong: (p) => PHONG[p]?.[0] || p });
  const doc = sh.map((x) => ({ ten: x.ten, dong: [x.cot.map((c) => c.nhan), ...x.dong] }));
  const lai = dongTuMau(doc, { ky: KY, dmLanhDao: LD, dmDonVi: DV, taiKhoan: TK, tenPhong: PHONG });
  assert.deepEqual(lai.dong.map(tenViTri), dong.map(tenViTri));
  assert.deepEqual(lai.dong.map((d) => [d.chu_tri_theo_doi, d.phong_theo_doi]), [['a', null], [null, 'CDS_CY'], [null, null]]);
  assert.deepEqual(lai.dong[0].phoi_hop_theo_doi, ['b']);
  assert.deepEqual(lai.dong[1].san_pham.map((s) => [s.loai, s.trang_thai, s.kq_so_ky_hieu]), [['VAN_BAN', 'HOAN_THANH', '77-KH/TU']]);
  assert.equal(lai.dong[0].san_pham[0].muc_tieu, 8.5);
});

test('Đọc bảng Word: ô gộp chữ đen / chữ đỏ, xuống dòng; bảng lồng không làm lệch', () => {
  // document.xml đã bỏ tiền tố "w:" của thẻ (docBangWord), thuộc tính giữ "w:val".
  const r = (t, mau) => `<r>${mau ? `<rPr><color w:val="${mau}"/></rPr>` : ''}<t xml:space="preserve">${t}</t></r>`;
  const tc = (...p) => `<tc>${p.map((x) => `<p>${x}</p>`).join('')}</tc>`;
  const long = `<tbl><tr>${tc(r('lồng'))}</tr></tbl>`;
  const xml = `<body><tbl><tr>${tc(r('(1)'), r('NGUYỄN VĂN AN', 'FF0000'))}${tc(r('Nội dung'))}</tr></tbl><p/>${long}</body>`;
  const bang = cacBang(xml);
  assert.equal(bang.length, 2);
  const h = docBangXml(bang[0]);
  assert.equal(h[0][0].den.trim(), '(1)'); assert.equal(h[0][0].do.trim(), 'NGUYỄN VĂN AN'); assert.equal(h[0][1].tat.trim(), 'Nội dung');
});

test('Trước khi nhập: cắt chữ theo giới hạn cột, báo dòng sai (trục, Stt, chỉ tiêu cơ bản thiếu mục tiêu)', () => {
  const { dong, loi } = kiemDongNhap([
    { truc_so: 1, nhom: 'TRONG_CT', stt: 1, noi_dung: 'x'.repeat(5000), tien_do_text: 'y'.repeat(400), san_pham: [{ mo_ta: 'Kế hoạch', loai: 'VAN_BAN', han_text: 'z'.repeat(150) }] },
    { truc_so: 7, nhom: 'TRONG_CT', stt: 0, noi_dung: 'Sai vị trí', san_pham: [{ mo_ta: 'GRDP', loai: 'CHI_TIEU', chi_tieu_co_ban: 'GRDP', muc_tieu: null }] },
  ]);
  assert.deepEqual([dong[0].noi_dung.length, dong[0].tien_do_text.length, dong[0].san_pham[0].han_text.length], [4000, 300, 100]);
  assert.equal(loi.length, 3);
  assert.ok(loi.some((x) => /trục phải là số 1–6/.test(x)) && loi.some((x) => /Stt/.test(x)) && loi.some((x) => /cần ghi mục tiêu/.test(x)));
});
