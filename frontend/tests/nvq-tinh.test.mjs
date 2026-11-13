// v3.35 — Phân hệ Nhiệm vụ quý BTV: số liệu cho lãnh đạo (lib/nvq/tinh.js), ẩn / hiện nút theo quyền (lib/nvq/quyen.js — chép điều kiện hàm CSDL 0134),
// nhóm menu "Nhiệm vụ quý BTV" (views/shell/menu.js), mã NQ-<số> trên đường dẫn (lib/tuyen.js), báo cáo Word (lib/nvq/bao-cao-word.js — tệp .docx hợp
// lệ: đủ phần, đúng thể thức VPTU). Dữ liệu giả.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demTheoTrangThai, cauTomTat, theoTruc, lanhDaoCaNhan, theoLanhDao, theoChuTri, diemNghen, locRows, chiTieuCoBan, mucChiTieu, tuanCua, spTheoNv, sapXepViTri }
  from '../src/lib/nvq/tinh.js';
import { duocCapNhat, duocChiDao, duocTraoDoi, laNguoiTheoDoi } from '../src/lib/nvq/quyen.js';
import { tenTrangThai, tenTrangThaiSp, soVN, laMa, tenKy } from '../src/lib/nvq/nhan.js';
import { menuCuaVai, menuNvq } from '../src/views/shell/menu.js';
import { laMaViec, laMaNvq, TUYEN, chonMo } from '../src/lib/tuyen.js';
import { taoBaoCaoWord } from '../src/lib/nvq/bao-cao-word.js';
import { docZip, layTep } from '../src/lib/xlsx-doc.js';

const KY = { id: 'k', nam: 2026, quy: 4, tu_ngay: '2026-10-01', den_ngay: '2026-12-31', trang_thai: 'THUC_HIEN' };
const TRUC = [1, 2, 3].map((so) => ({ so, ten: `Trục ${so} đầy đủ`, ten_ngan: `Trục ${so}` }));
const LD = [{ ma: 'BI_THU', ten: 'Bí thư', thu_tu: 1, thuong_truc: true }, { ma: 'PBT_UBND', ten: 'Chủ tịch UBND', thu_tu: 3, thuong_truc: true },
  { ma: 'PBT_MTTQ', ten: 'Chủ tịch MTTQ', thu_tu: 4 }, { ma: 'TT_TU', ten: 'Thường trực Tỉnh ủy', thu_tu: 5, tap_the: true }];
const r = (id, truc, stt, tt, them = {}) => ({ id, ma: `NQ-${id}`, so_hieu: `${laMa(truc)}.1.(${stt})`, ky_id: 'k', truc_so: truc, nhom: 'TRONG_CT', stt, noi_dung: `Nhiệm vụ ${id}`,
  trang_thai: tt, dieu_chinh: tt === 'RUT' ? 'RUT' : 'TRONG_DANH_MUC', lanh_dao_ma: ['BI_THU'], don_vi: [{ ma: 'DU_UBND', vai_tro: 'CHU_TRI' }], chu_tri_theo_doi: 'u1',
  phoi_hop_theo_doi: [], cap_nhat_tuan_nay: false, ...them });
const ROWS = [
  r('1', 1, 1, 'HOAN_THANH', { ket_qua: 'CHAM_TIEN_DO', cap_nhat_tuan_nay: true }),
  r('2', 1, 2, 'CHAM_TIEN_DO', { so_ngay_qua: 5, vuong_mac: 'Thiếu số liệu', lanh_dao_ma: ['TT_TU'] }),
  r('3', 2, 1, 'DANG_THUC_HIEN', { cap_nhat_tuan_nay: true, chu_tri_theo_doi: 'u2', ket_qua_thuc_hien: 'Đã ban hành kế hoạch số 12-KH/TU' }),
  r('4', 3, 1, 'THUONG_XUYEN', { chu_tri_theo_doi: null, phong_theo_doi: 'CDS_CY' }),
  r('5', 3, 2, 'CHUA_TRIEN_KHAI', { chu_tri_theo_doi: null }),
  r('6', 3, 3, 'RUT'),
];
const SP = [
  { id: 's1', nhiem_vu_id: '2', thu_tu: 1, loai: 'CHI_TIEU', chi_tieu_co_ban: 'GRDP', mo_ta: 'GRDP', muc_tieu: 8, thuc_hien: 7.2, dat_muc_tieu: false, trang_thai: 'DANG', han: '2026-11-08' },
  { id: 's2', nhiem_vu_id: '2', thu_tu: 2, loai: 'VAN_BAN', mo_ta: 'Văn bản chỉ đạo', trang_thai: 'CHUA', han: '2026-11-08', so_ngay_qua: 5 },
  { id: 's3', nhiem_vu_id: '1', thu_tu: 1, loai: 'VAN_BAN', mo_ta: 'Kế hoạch', trang_thai: 'HOAN_THANH', kq_so_ky_hieu: '10-KH/TU', ngay_hoan_thanh: '2026-11-12', han: '2026-11-10' },
];

test('Đếm theo trạng thái (không tính việc rút) và câu tóm tắt cho lãnh đạo', () => {
  const d = demTheoTrangThai(ROWS);
  assert.deepEqual([d.tong, d.HOAN_THANH, d.CHAM_TIEN_DO, d.RUT, d.hoanThanhCham, d.mo, d.daCapNhatTuan, d.chuaCapNhatTuan], [5, 1, 1, 1, 1, 4, 1, 3]);
  assert.equal(cauTomTat(d, KY, '2026-11-13'), '5 nhiệm vụ: 1 hoàn thành (20%), 2 đang thực hiện, 1 chậm tiến độ, 1 chưa triển khai. Còn 48 ngày đến hết quý.');
  assert.equal(cauTomTat(demTheoTrangThai([]), KY, '2026-11-13'), 'Quý này chưa có nhiệm vụ trong danh mục.');
});

test('Theo trục, theo lãnh đạo phụ trách (tập thể Thường trực tính cho từng đồng chí Thường trực), theo chủ trì theo dõi', () => {
  assert.deepEqual(theoTruc(ROWS, TRUC).map((t) => [t.so, t.tong, t.hoanThanh, t.cham, t.tyLe]), [[1, 2, 1, 1, 50], [2, 1, 0, 0, 0], [3, 2, 0, 0, 0]]);
  assert.deepEqual(lanhDaoCaNhan(['TT_TU'], LD), ['BI_THU', 'PBT_UBND']);
  assert.deepEqual(theoLanhDao(ROWS, LD).map((g) => [g.ma, g.tong]), [['BI_THU', 5], ['PBT_UBND', 1]]);
  const ct = theoChuTri(ROWS, (id) => ({ u1: 'Cán bộ Một', u2: 'Cán bộ Hai' }[id]), (p) => `Phòng ${p}`);
  assert.deepEqual(ct.map((g) => [g.khoa, g.tong]), [['u1', 2], ['u2', 1], ['phong:CDS_CY', 1], ['', 1]], 'chưa phân công xếp cuối');
});

test('Việc cần lãnh đạo quan tâm: chậm / vướng mắc, kèm kết quả còn thiếu; 05 chỉ tiêu cơ bản; mức chỉ tiêu', () => {
  const ng = diemNghen(ROWS, spTheoNv(SP));
  assert.deepEqual(ng.map((x) => x.r.id), ['2']); assert.deepEqual(ng[0].conThieu.map((s) => s.id), ['s1', 's2']);
  const theoId = new Map(ROWS.map((x) => [x.id, x]));
  const ctcb = chiTieuCoBan(SP, theoId);
  assert.deepEqual(ctcb.map((c) => [c.ma, c.ds.length]), [['GRDP', 1], ['THU_NSNN', 0], ['GIAI_NGAN', 0], ['THU_NHAP', 0], ['GIAM_NGHEO', 0]]);
  assert.equal(mucChiTieu(SP[0]).ma, 'chua-dat'); assert.equal(mucChiTieu({ thuc_hien: null }).ma, 'chua'); assert.equal(mucChiTieu({ thuc_hien: 9, dat_muc_tieu: true }).ma, 'dat');
});

test('Lọc danh mục: trạng thái, trục, chủ trì / phòng / chưa phân công, việc của tôi, chưa báo cáo tuần, cần quan tâm, tháng có mốc, chữ không dấu', () => {
  const ids = (loc) => locRows(ROWS, loc, { dmLanhDao: LD, spMap: spTheoNv(SP) }).map((x) => x.id);
  assert.deepEqual(ids({}), ['1', '2', '3', '4', '5'], 'mặc định không gồm việc rút');
  assert.deepEqual(ids({ trangThai: 'RUT' }), ['6']);
  assert.deepEqual(ids({ truc: '3' }), ['4', '5']);
  assert.deepEqual(ids({ chuTri: 'phong:CDS_CY' }), ['4']); assert.deepEqual(ids({ chuTri: 'chua' }), ['5']); assert.deepEqual(ids({ chuTri: 'u2' }), ['3']);
  assert.deepEqual(ids({ cuaToi: 'u9', phongToi: 'CDS_CY' }), ['4']);
  assert.deepEqual(ids({ chuaCapNhat: true }), ['2', '4', '5']);
  assert.deepEqual(ids({ canQuanTam: true }), ['2']);
  assert.deepEqual(ids({ thang: '2026-11' }), ['2']);
  assert.deepEqual(ids({ q: 'ke hoach so 12' }), ['3']);
  assert.deepEqual(ids({ lanhDao: 'PBT_UBND' }), ['2'], 'tập thể Thường trực → từng đồng chí');
  assert.deepEqual(sapXepViTri([ROWS[4], ROWS[0], ROWS[2]]).map((x) => x.id), ['1', '3', '5']);
});

test('Tuần báo cáo của một ngày: trong tuần, trước tuần 1, sau tuần cuối', () => {
  const T = [{ so: 1, tu_ngay: '2026-10-01', den_ngay: '2026-10-08' }, { so: 2, tu_ngay: '2026-10-09', den_ngay: '2026-10-15' }];
  assert.equal(tuanCua(T, '2026-10-10').so, 2); assert.equal(tuanCua(T, '2026-09-30').so, 1); assert.equal(tuanCua(T, '2026-12-01').so, 2);
});

test('Quyền (như hàm CSDL): chủ trì / phối hợp / phòng / Trưởng phòng của chủ trì / lãnh đạo VP / đầu mối cập nhật; Thường trực không; quý đã chốt, việc rút không', () => {
  const tp = (id) => ({ u1: 'TONG_HOP', u2: 'QUAN_TRI' }[id] || null);
  const x = ROWS[1];
  assert.equal(duocCapNhat(x, { id: 'u1', role_group: 'A3', department: 'TONG_HOP' }, {}, tp, KY), true);
  assert.equal(duocCapNhat(x, { id: 'u2', role_group: 'A3', department: 'QUAN_TRI' }, {}, tp, KY), false);
  assert.equal(duocCapNhat(x, { id: 'tp', role_group: 'A2', department: 'TONG_HOP' }, {}, tp, KY), true, 'Trưởng phòng của chủ trì');
  assert.equal(duocCapNhat(x, { id: 'tp2', role_group: 'A2', department: 'QUAN_TRI' }, {}, tp, KY), false);
  assert.equal(duocCapNhat(ROWS[3], { id: 'u7', role_group: 'A3', department: 'CDS_CY' }, {}, tp, KY), true, 'cán bộ phòng được giao');
  assert.equal(duocCapNhat(x, { id: 'a1', role_group: 'A1' }, {}, tp, KY), true);
  assert.equal(duocCapNhat(x, { id: 'dm', role_group: 'A3' }, { quan_ly: true }, tp, KY), true);
  assert.equal(duocCapNhat(x, { id: 'a0', role_group: 'A0' }, { quan_ly: true }, tp, KY), false, 'Thường trực không cập nhật');
  assert.equal(duocCapNhat(x, { id: 'u1', role_group: 'A3' }, {}, tp, { ...KY, trang_thai: 'DA_CHOT' }), false);
  assert.equal(duocCapNhat(ROWS[5], { id: 'u1', role_group: 'A3' }, { quan_ly: true }, tp, KY), false, 'việc đã rút');
  assert.equal(duocChiDao({ role_group: 'A0' }, {}), true); assert.equal(duocChiDao({ role_group: 'A3' }, {}), false);
  assert.equal(duocTraoDoi(x, { id: 'u1', role_group: 'A3' }, {}, tp, KY), true);
  assert.equal(laNguoiTheoDoi(ROWS[3], { id: 'u7', department: 'CDS_CY' }), true);
});

test('Nhãn: trạng thái nhiệm vụ, trạng thái kết quả theo loại, số kiểu Việt Nam, tên quý', () => {
  assert.equal(tenTrangThai({ trang_thai: 'HOAN_THANH', ket_qua: 'CHAM_TIEN_DO' }).toLowerCase().includes('hoàn thành'), true);
  assert.equal(tenTrangThaiSp('VAN_BAN', 'HOAN_THANH'), 'Đã ban hành'); assert.equal(tenTrangThaiSp('HOAT_DONG', 'HOAN_THANH'), 'Đã tổ chức');
  assert.equal(soVN(3530), '3.530'); assert.equal(soVN(14.86), '14,86');
  assert.equal(tenKy(KY), 'Quý IV năm 2026');
});

test('Menu: nhóm "Nhiệm vụ quý BTV" chỉ khi truyền quyền; Thường trực không có Cập nhật tuần; Quản lý chỉ người quản lý / chỉ định đầu mối', () => {
  const a3 = { role_group: 'A3' };
  assert.ok(!menuCuaVai(a3).some((m) => m.nhom === 'Nhiệm vụ quý BTV'), 'không truyền nvq → menu như cũ');
  assert.deepEqual(menuNvq(a3).map((m) => m.id), ['navNqTongQuan', 'navNqDanhMuc', 'navNqCapNhat', 'navNqBaoCao']);
  assert.deepEqual(menuNvq({ role_group: 'A0' }).map((m) => m.id), ['navNqTongQuan', 'navNqDanhMuc', 'navNqBaoCao']);
  assert.ok(menuNvq(a3, { quanLy: true }).some((m) => m.id === 'navNqQuanLy'));
  const m = menuCuaVai({ role_group: 'A1', quan_tri_he_thong: true }, { nvq: { quanLy: true } });
  assert.ok(m.findIndex((x) => x.id === 'navNqTongQuan') < m.findIndex((x) => x.id === 'navQuanTri'), 'nhóm Nhiệm vụ quý trước Quản trị');
  assert.ok(m.filter((x) => x.nhom === 'Nhiệm vụ quý BTV').every((x) => x.section === 'viewNvq' && !x.duoi));
});

test('Đường dẫn: mã NQ-<số> là mã việc; mỗi màn của phân hệ có đường dẫn, chỉ mở khi có trong menu', () => {
  assert.equal(laMaViec('NQ-1001'), true); assert.equal(laMaNvq('nq-1001'), true); assert.equal(laMaNvq('NV-1001'), false); assert.equal(laMaViec('NX-1'), false);
  for (const d of ['Tong-quan-quy', 'Danh-muc-quy', 'Cap-nhat-tuan', 'Bao-cao-quy', 'Quan-ly-danh-muc-quy']) assert.ok(TUYEN.some((t) => t.duong === d), d);
  const menu = menuNvq({ role_group: 'A3' });
  assert.deepEqual(chonMo({ duong: 'Danh-muc-quy', the: '' }, { vai: 'A3', menu }), { action: 'openNqDanhMuc', ds: {} });
  assert.deepEqual(chonMo({ duong: 'Quan-ly-danh-muc-quy', the: '' }, { vai: 'A3', menu }), { tuChoi: true });
});

test('Báo cáo Word (tuần, quý): tệp .docx có đủ phần, đúng thể thức (A4, Times New Roman, phụ lục khổ ngang), số kế hoạch căn cứ', async () => {
  const dm = { truc: TRUC, lanhDao: LD, donVi: [{ ma: 'DU_UBND', ten: 'Đảng ủy UBND tỉnh' }] };
  const vanBan = [{ loai: 'KE_HOACH', so_ky_hieu: '193-KH/TU', ngay: '2026-10-08' }];
  for (const loai of ['tuan', 'quy']) {
    const b = taoBaoCaoWord({ loai, ky: KY, tuan: { so: 7, tu_ngay: '2026-11-13', den_ngay: '2026-11-19' }, rows: ROWS, sp: SP, capNhatTuan: [{ nhiem_vu_id: '3', noi_dung: 'Đã đôn đốc' }],
      dm, vanBan, ngay: '2026-11-19', kyTen: { quyenHan: 'K/T CHÁNH VĂN PHÒNG', chucVu: 'PHÓ CHÁNH VĂN PHÒNG', hoTen: 'Họ và tên' } });
    const z = docZip(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const xml = await layTep(z, 'word/document.xml');
    assert.ok(xml && await layTep(z, '[Content_Types].xml') && await layTep(z, 'word/header1.xml'), `${loai}: đủ phần`);
    assert.match(xml, /BÁO CÁO/); assert.match(xml, /193-KH\/TU/); assert.match(xml, /Times New Roman/);
    assert.match(xml, /<pgSz w:w="11906" w:h="16838"/, 'A4 dọc'); assert.match(xml, /w:orient="landscape"/, 'phụ lục khổ ngang');
    assert.match(xml, /PHỤ LỤC/); assert.match(xml, /K\/T CHÁNH VĂN PHÒNG/);
    assert.ok((xml.match(/<p\b/g) || []).length > 20, 'đủ đoạn');
    if (loai === 'tuan') assert.match(xml, /tuần thứ 7/); else assert.match(xml, /kết quả thực hiện/i);
  }
});
