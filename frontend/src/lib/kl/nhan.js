// Nhãn, màu và thứ tự của các nhóm trạng thái (nhom_dem, muc_canh_bao từ hàm trang_thai — DB tính, frontend chỉ đặt tên) và
// bốn khâu nghẽn (v_ngoai_le.khau, 0033). Màu là thông tin (mockup): đỏ = phải can thiệp, vàng = sắp/chưa rõ, lục = xong, lam = cấu trúc.
// Tên lớp khai báo NGUYÊN VĂN (Tailwind cắt lớp ghép chuỗi khỏi bản build).
import { soNgay } from './ngay.js';
// Ngưỡng ngày của nhãn (v3.29 — đặt theo kl_cau_hinh khi nạp, datNguongCanhBao bên dưới; mặc định như DB).
const NGUONG = { vang: 3, khan: 5, ddb: 3, sap: 7 };

export const NHOM = {
  QUA_HAN:        { ten: 'Quá hạn',                     lop: 'do',   stat: 's-do',   thuTu: 2, mo: true },
  // PR-2b (0058): dòng 5 — đã nộp minh chứng, quá hạn ở bước NGHIỆM THU (chậm tính cho lãnh đạo nghiệm thu, không cho người nộp — Mới 2)
  QUA_HAN_NGHIEM_THU: { ten: 'Quá hạn, chờ xác nhận minh chứng', lop: 'do', stat: 's-do', thuTu: 2.5, mo: true },
  DANG_DINH_CHINH:{ ten: 'Quá hạn — đang đính chính',   lop: 'vang', stat: 's-vang', thuTu: 3, mo: true },
  // v3.29: nhóm xem "Sắp đến hạn" (còn ≤ nguong_sap_den_han_ngay = 7 ngày — CH-10b) ghi kèm số ngày, khác mức cảnh báo Vàng (còn ≤ 3 ngày, tenMuc).
  SAP_DEN_HAN:    { get ten() { return `Sắp đến hạn (còn ≤ ${NGUONG.sap} ngày)`; }, lop: 'vang', stat: 's-vang', thuTu: 4, mo: true },
  CHO_NGHIEM_THU: { ten: 'Chờ xác nhận minh chứng',     lop: 'lam',  stat: 's-lam',  thuTu: 4.5, mo: true },
  CAN_DIEN_HAN:   { ten: 'Cần điền hạn',                lop: 'vang', stat: 's-vang', thuTu: 5, mo: true },
  DANG_THUC_HIEN: { ten: 'Đang thực hiện',              lop: 'lam',  stat: 's-lam',  thuTu: 6, mo: true },
  CHO_DIEU_KIEN:  { ten: 'Chờ điều kiện',               lop: '',     stat: '',       thuTu: 7, mo: true },
  THUONG_XUYEN:   { ten: 'Thường xuyên',                lop: '',     stat: '',       thuTu: 8, mo: false },
  HOAN_THANH:     { ten: 'Hoàn thành',                  lop: 'luc',  stat: 's-luc',  thuTu: 9, mo: false },
};
export const THU_TU_NHOM = Object.keys(NHOM); // thứ tự hiển thị ô số / bộ lọc
// Nhóm có hạn là MỐC RÀ SOÁT (DB không tính quá hạn, không áp mức cảnh báo) — dòng việc ghi "thường xuyên · mốc rà soát …" thay cho "trễ N ngày".
export const MOC_RA_SOAT = { THUONG_XUYEN: 'thường xuyên', CHO_DIEU_KIEN: 'chờ điều kiện' };

export const nhomCua = (ma) => NHOM[ma] || { ten: ma, lop: '', stat: '', thuTu: 99, mo: true };
export const tenNhom = (ma) => nhomCua(ma).ten;

// Bốn mức cảnh báo 1400 (NT-5, CN-4) → lớp mép trái (the/hang-nv/muc) và tên (chú giải — tên mức theo Công văn 1400 trong ngoặc).
// Tên đọc lúc dùng (getter): số ngày theo cấu hình đã nạp (datNguongCanhBao).
export const MUC_CANH_BAO = {
  XANH:          { ten: 'Trong hạn', lop: 'lam' },
  VANG:          { get ten() { return `Sắp đến hạn — còn ≤ ${NGUONG.vang} ngày, chưa có minh chứng (mức Vàng)`; }, lop: 'vang' },
  DO:            { get ten() { return `Quá hạn dưới ${NGUONG.ddb} ngày (mức Đỏ)`; }, lop: 'do' },
  DO_DAC_BIET:   { get ten() { return `Quá hạn từ ${NGUONG.ddb} ngày trở lên (mức Đỏ đặc biệt)`; }, lop: 'dac-biet' },
  KHONG_AP_DUNG: { ten: 'Không áp dụng cảnh báo', lop: '' },
};
// v3.29 (chủ dự án 22/10/2026 — "ghi đúng quy tắc", mọi màn hình, giữ màu): ba mức cảnh báo ghi bằng nghĩa; tên Vàng / Đỏ / Đỏ đặc biệt chỉ còn ở
// chú giải. Ngưỡng theo kl_cau_hinh (du-lieu.js gọi datNguongCanhBao khi nạp; mặc định 3 / 5 / 3 như DB — trang_thai_dong, 0077).
export function datNguongCanhBao(ch = {}) {
  NGUONG.vang = ch.nguong_vang_ngay ?? 3; NGUONG.khan = ch.do_khan_KHAN_vang ?? 5; NGUONG.ddb = ch.nguong_do_dac_biet_ngay ?? 3; NGUONG.sap = ch.nguong_sap_den_han_ngay ?? 7;
}
export const tenSapDenHan = () => `sắp đến hạn (còn ≤ ${NGUONG.sap} ngày)`;   // nhóm xem SAP_DEN_HAN, ghi giữa câu
export const nguongCanhBao = () => ({ ...NGUONG });
const MA_MUC = { VANG: 'vang', DO: 'do', DO_DAC_BIET: 'ddb' };
// m: 'vang' | 'do' | 'ddb' (hoặc mã DB VANG / DO / DO_DAC_BIET); gon: nhãn ngắn, chữ đầu hoa (chip, ô hẹp); mặc định để ghi giữa câu.
export function tenMuc(m, gon = false) {
  const k = MA_MUC[m] || m; const { vang, ddb } = NGUONG;
  if (k === 'vang') return gon ? 'Sắp đến hạn' : `sắp đến hạn (còn ≤ ${vang} ngày)`;
  if (k === 'do') return gon ? `Quá hạn < ${ddb} ngày` : `quá hạn dưới ${ddb} ngày`;
  if (k === 'ddb') return gon ? `Quá hạn ≥ ${ddb} ngày` : `quá hạn từ ${ddb} ngày trở lên`;
  return '';
}
export const tenMucHoa = (m) => { const t = tenMuc(m); return t && t[0].toUpperCase() + t.slice(1); };   // đầu nhãn, ô số
// Bảng nhãn tĩnh [khoá, tên, …] (ô số, đoạn, lựa chọn lọc) có ô tên theo ngưỡng cấu hình: ô tên thành getter — đọc lúc vẽ, sau khi đã nạp cấu hình.
export function nhanTheoNguong(ds, khoa, ten) { Object.defineProperty(ds.find(([k]) => k === khoa), 1, { get: ten, enumerable: true }); return ds; }
// Chú giải màu dùng chung (bảng, Tổng quan): nghĩa trước, tên mức theo Công văn 1400 sau.
export const chuGiaiMuc = () => [['vang', `Sắp đến hạn: còn ≤ ${NGUONG.vang} ngày, chưa có minh chứng (việc khẩn trở lên ≤ ${NGUONG.khan} ngày) — mức Vàng`],
  ['do', `Quá hạn dưới ${NGUONG.ddb} ngày — mức Đỏ`], ['ddb', `Quá hạn từ ${NGUONG.ddb} ngày trở lên — mức Đỏ đặc biệt`]];
export const mucCua = (muc) => MUC_CANH_BAO[muc] || MUC_CANH_BAO.KHONG_AP_DUNG;
// Góc nhìn NGƯỜI NỘP (Mới 2): chủ trì tài khoản hoặc người đã nộp minh chứng đang chờ thấy nhãn trung tính "Đã nộp — chờ nghiệm thu", kể cả khi
// việc đã quá hạn ở bước nghiệm thu (chậm thuộc về lãnh đạo nghiệm thu). me = id người đang xem (tuỳ chọn).
const CHO_NT = ['CHO_NGHIEM_THU', 'QUA_HAN_NGHIEM_THU'];
export const laBenNop = (r, me) => Boolean(me) && CHO_NT.includes(r.nhom_dem) && (r.nguoi_nop_cho === me || r.owner_tai_khoan === me);
// Lớp mép trái của một dòng v_nhiem_vu: hoàn thành → lục; người nộp đang chờ nghiệm thu → trung tính; còn lại theo mức.
export const lopMep = (r, me) => (r.nhom_dem === 'HOAN_THANH' ? 'luc' : laBenNop(r, me) ? 'lam' : mucCua(r.muc_canh_bao).lop);
// v3.23.2: lớp nhãn trạng thái (.trang-thai) của việc quá hạn — Đỏ đặc biệt (quá hạn ≥ 3 ngày) tím, còn lại đỏ (cùng màu dải mép trái).
export const lopQuaHan = (r) => (r.muc_canh_bao === 'DO_DAC_BIET' ? 'tt-ddb' : 'tt-qua');

// Bốn khâu nghẽn của việc Đỏ (v_ngoai_le.khau, thứ tự ưu tiên trong 0033); mau = màu thanh tỉ lệ ở thanh trái.
export const KHAU = {
  BI_TU_CHOI:     { ten: 'Bị từ chối, chờ giao lại',  phu: 'đề nghị từ chối đã duyệt',  mau: 'do' },
  CHO_QUYET:      { ten: 'Chờ cấp trên quyết',        phu: 'đã trình, chưa có ý kiến',  mau: 'cam' },
  CHUA_SAN_PHAM:  { ten: 'Chưa có sản phẩm',          phu: 'đang làm, đã quá hạn',      mau: 'cam' },
  CHO_MINH_CHUNG: { ten: 'Việc quá hạn chờ xác nhận minh chứng', phu: 'đã nộp, chờ Văn phòng', mau: 'lam' },
  CHO_NGHIEM_THU: { ten: 'Chờ xác nhận minh chứng',   phu: 'nộp trước v3.20, quá hạn chưa xác nhận', mau: 'lam' },
  CHUA_NHAN:      { ten: 'Chưa nhận việc',            phu: 'giao rồi, chưa xác nhận',   mau: 'cam' },
};
export const THU_TU_KHAU = Object.keys(KHAU);
export const tenKhau = (ma) => KHAU[ma]?.ten || ma || '';

// Nhãn trạng thái đầy đủ cho một dòng v_nhiem_vu: "Quá hạn · 30 ngày", "Cần điền hạn · 290 ngày", "Hoàn thành đúng hạn"…
export function nhanTrangThai(r, me) {
  if (laBenNop(r, me)) return 'Đã nộp — chờ xác nhận';   // chỉ minh chứng nộp trước v3.20 (0090: nộp là hoàn thành)
  switch (r.nhom_dem) {
    case 'QUA_HAN_NGHIEM_THU': return `Quá hạn, chờ xác nhận minh chứng · ${r.so_ngay_qua} ngày`;
    case 'CHO_NGHIEM_THU': return 'Chờ xác nhận minh chứng';
    case 'QUA_HAN': return `Quá hạn · ${r.so_ngay_qua} ngày`;
    case 'DANG_DINH_CHINH': return `Quá hạn · ${r.so_ngay_qua} ngày · đang đính chính`;
    case 'CAN_DIEN_HAN': return `Cần điền hạn · ${r.tuoi_ngay} ngày tuổi`;
    case 'SAP_DEN_HAN': return 'Sắp đến hạn';   // nhãn dòng: ô Hạn đã ghi "còn n ngày"
    case 'HOAN_THANH':
      if (r.ket_qua === 'DUNG_HAN') return 'Hoàn thành đúng hạn';
      if (r.ket_qua === 'TRE') return `Hoàn thành trễ ${r.so_ngay_tre} ngày`;
      return 'Hoàn thành';
    default: return tenNhom(r.nhom_dem);
  }
}

// Tên hiển thị của mã nguồn dòng / nguồn dòng lịch sử.
export const TEN_NGUON = { excel: 'Nhập từ Excel', app: 'Nhập trên hệ thống', dinh_chinh: 'Đính chính đã duyệt' };

// Tên cột nhiem_vu dùng trong ngăn truy vết và lịch sử (0023 đã đổi tên cột cũ trong lịch sử).
export const TEN_COT = {
  han_xu_ly: 'Hạn xử lý', loai_thoi_han_ma: 'Loại thời hạn', tien_do_ma: 'Tiến độ', ngay_hoan_thanh: 'Ngày hoàn thành',
  minh_chung: 'Minh chứng', van_ban_trien_khai: 'Văn bản triển khai', ly_do_chua_co_han: 'Lý do chưa có hạn',
  ghi_chu: 'Ghi chú', nganh_ma: 'Ngành/lĩnh vực', linh_vuc_ma: 'Lĩnh vực (tự xác định)', owner_don_vi_ma: 'Chủ trì theo dõi (phòng, đơn vị)',
  owner_tai_khoan: 'Chủ trì theo dõi (cán bộ)', nguoi_theo_doi: 'Người theo dõi', noi_dung: 'Nội dung kết luận / Văn bản trình',
  linh_vuc_chi_tiet: 'Lĩnh vực chi tiết', so_lan_gia_han: 'Số lần gia hạn', van_ban_id: 'Văn bản giao việc',
  san_pham_loai: 'Sản phẩm đầu ra', san_pham_mo_ta: 'Mô tả sản phẩm', cap_nhan_san_pham: 'Cấp nhận sản phẩm', cap_quyet_dinh: 'Cấp cần quyết định',
  ngay_nhan_van_ban: 'Ngày giao nhiệm vụ', ngay_nhan_uoc_tinh: 'Ngày giao ước tính', nhiem_vu_cha: 'Nhiệm vụ cha', theo_1400: 'Theo quy tắc 1400',
  xac_nhan_nhan_viec: 'Xác nhận đã nhận việc', chi_dao: 'Chỉ đạo', '*': 'Tạo dòng', tu_choi: 'Từ chối nhận việc', bi_tu_choi: 'Bị từ chối, chờ giao lại',
  minh_chung_nop: 'Nộp minh chứng', minh_chung_xac_nhan: 'Xác nhận / trả lại minh chứng', dong_nhiem_vu: 'Hoàn thành nhiệm vụ',
  giao_thay_mat: 'Giao việc', giao_viec: 'Giao việc', canh_bao: 'Cảnh báo', do_khan: 'Độ khẩn', uu_tien: 'Ưu tiên', giao_thay_mat_cho: 'Lãnh đạo giao',
  han_nop_minh_chung: 'Hạn nộp minh chứng (đã bỏ từ 3.17)', ly_do_han_nop_sat: 'Lý do việc gấp (hạn nộp sát — đã bỏ)', han_nop_minh_chung_ly_do: 'Đổi hạn nộp minh chứng (đã bỏ)',
  chat_luong: 'Chất lượng hoàn thành', nguon_nhiem_vu_ma: 'Nguồn nhiệm vụ', vuong_mac: 'Vướng mắc / đề nghị lãnh đạo quyết định',
  sua_thong_tin_giao: 'Sửa thông tin giao', de_nghi_sua: 'Đề nghị sửa', nhap_excel: 'Nhập Excel',
  don_vi_phoi_hop: 'Đơn vị phối hợp', van_ban_ra_soat: 'Rà soát văn bản (số nhiệm vụ dự kiến)',
  muc_quan_trong: 'Mức quan trọng', co_quan_trinh: 'Cơ quan/đơn vị trình', thuong_truc_chi_dao: 'Thường trực chỉ đạo', stt_van_ban: 'Số thứ tự trong văn bản',   // 0087
  tep_minh_chung: 'Gắn tệp minh chứng', chuyen_theo_doi: 'Chuyển chủ trì theo dõi',   // 0090, 0092 (v3.31 — 0128: chuyển chủ trì theo dõi)
  gan_muc_tieu: 'Mục tiêu then chốt',   // 0105
  ra_soat_phan_loai: 'Rà soát phân loại (ngành/lĩnh vực, mục tiêu then chốt)',   // 0116
  giai_ngan: 'Giải ngân vốn',   // 0119: nhập / xoá kỳ số liệu, gắn / đổi / bỏ theo dõi
  van_ban_trich_yeu: 'Trích yếu văn bản',   // 0046 dat_trich_yeu_van_ban — trước đây diễn biến hiện tên cột thô (kiểm tay 18/10)
  dieu_chinh_han: 'Điều chỉnh hạn', doi_chu_tri: 'Đổi chủ trì theo dõi', sua_toan_bo: 'Tài khoản quản trị sửa thông tin', mo_lai: 'Mở lại nhiệm vụ',   // 0123–0125
  van_ban_sua: 'Sửa văn bản giao', sua_minh_chung: 'Sửa minh chứng', go_minh_chung: 'Gỡ minh chứng',   // 0126
};
export const tenCot = (cot) => TEN_COT[cot] || cot;

// PR-3: chất lượng hoàn thành (0063) và tiến độ hoàn thành (0066). Màu dùng bộ trạng thái sẵn có: đỏ = Không đạt, trung tính = Đạt, lục = Đạt tốt / xuất sắc.
export const CHAT_LUONG = [['KHONG_DAT', 'Không đạt'], ['DAT', 'Đạt'], ['DAT_TOT', 'Đạt tốt'], ['DAT_XUAT_SAC', 'Đạt xuất sắc']];
export const tenChatLuong = (ma) => CHAT_LUONG.find(([m]) => m === ma)?.[1] || '';
const LOP_CHAT_LUONG = { KHONG_DAT: 'tt-qua', DAT: 'tt-xam', DAT_TOT: 'tt-xong', DAT_XUAT_SAC: 'tt-xong' };
export const nhanChatLuongHtml = (ma) => (ma ? `<span class="trang-thai ${LOP_CHAT_LUONG[ma] || 'tt-xam'}" data-truong="chat-luong">${tenChatLuong(ma)}</span>` : '');
// "Trước hạn 3 ngày" / "Đúng hạn" / "Trễ 2 ngày" theo tien_do_hoan_thanh (DB); số ngày lấy từ hai cột ngày của chính dòng (soNgay, UTC).
export function tenTienDoHoanThanh(r) {
  if (r.tien_do_hoan_thanh === 'TRUOC_HAN') return `Trước hạn ${soNgay(r.ngay_hoan_thanh, r.han_xu_ly)} ngày`;
  if (r.tien_do_hoan_thanh === 'DUNG_HAN') return 'Đúng hạn';
  if (r.tien_do_hoan_thanh === 'TRE') return `Trễ ${soNgay(r.han_xu_ly, r.ngay_hoan_thanh)} ngày`;
  return '';
}

// "6. Đảng ủy Ủy ban nhân dân tỉnh" → "Đảng ủy Ủy ban nhân dân tỉnh" (bỏ số thứ tự khi hiện trong ô).
export const boSoThuTu = (ten) => (ten || '').replace(/^\d+\.\s*/, '');
