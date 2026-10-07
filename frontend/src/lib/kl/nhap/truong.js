// Chuẩn nhập của hệ thống (v9 đợt 2 — nhập Excel toàn trình), 3 mức: mức 1 = đủ để GIAO việc; mức 2 = tiến độ (tuỳ chọn); mức 3 = đủ để
// ĐÓNG việc (minh chứng 4 yếu tố + chất lượng). 25 trường đầu (mau: true) là cột của "Mẫu nhập chuẩn VPTU-TASK"; trường phụ (mau: false) nhận
// khi tệp khác có cột tương ứng. Mã trường khớp kl_truong_nhap() (migration 0072). ten: tiêu đề hay gặp (đã chuẩn hoá — chuanTieuDe) để tự ghép cột.

export const TRUONG = [
  { k: 'ma', nhan: 'Mã nhiệm vụ', muc: 0, mau: true, ten: ['ma nhiem vu', 'ma nv', 'ma'], goiY: 'Để trống khi nhập việc mới; có mã → cập nhật việc đó' },
  { k: 'loai_van_ban', nhan: 'Loại văn bản', muc: 1, mau: true, kieu: 'loaiVanBan', ten: ['loai van ban', 'loai vb'] },
  { k: 'so_hoi_nghi', nhan: 'Số hội nghị', muc: 1, mau: true, kieu: 'so', ten: ['so hoi nghi', 'hoi nghi so', 'hoi nghi'] },
  { k: 'so_ket_luan', nhan: 'Số/ký hiệu văn bản', muc: 1, mau: true, ten: ['so/ky hieu van ban', 'so ky hieu van ban', 'so tb/kl', 'so tb kl', 'so kl/tb', 'so van ban', 'so hieu van ban', 'so ket luan', 'so hieu', 'ky hieu'] },
  { k: 'ngay_ban_hanh', nhan: 'Ngày ban hành', muc: 1, mau: true, kieu: 'ngay', ten: ['ngay ban hanh', 'ngay bh', 'ngay van ban'] },
  { k: 'noi_dung', nhan: 'Nội dung nhiệm vụ', muc: 1, mau: true, ten: ['noi dung nhiem vu', 'noi dung ket luan / van ban trinh', 'noi dung ket luan', 'noi dung', 'nhiem vu'] },
  { k: 'don_vi', nhan: 'Đơn vị chủ trì', muc: 1, mau: true, kieu: 'donVi', ten: ['don vi chu tri', 'co quan/don vi trinh', 'co quan don vi trinh', 'co quan chu tri', 'don vi thuc hien', 'don vi'] },
  { k: 'can_bo', nhan: 'Cán bộ chủ trì', muc: 1, mau: true, kieu: 'canBo', ten: ['can bo chu tri', 'chuyen vien chu tri', 'nguoi chu tri', 'nguoi thuc hien'] },
  { k: 'theo_doi', nhan: 'Người theo dõi', muc: 1, mau: true, kieu: 'canBo', ten: ['nguoi theo doi', 'chu tri theo doi', 'can bo theo doi', 'theo doi'] },
  { k: 'lanh_dao_giao', nhan: 'Lãnh đạo giao', muc: 1, mau: true, kieu: 'canBo', ten: ['lanh dao giao', 'nguoi giao', 'lanh dao chi dao'] },
  { k: 'loai_thoi_han', nhan: 'Loại thời hạn', muc: 1, mau: true, kieu: 'loaiThoiHan', ten: ['loai thoi han', 'loai han'] },
  { k: 'han_xu_ly', nhan: 'Hạn hoàn thành', muc: 1, mau: true, kieu: 'ngay', ten: ['han hoan thanh', 'han xu ly', 'thoi han hoan thanh', 'thoi han', 'han'] },
  { k: 'san_pham', nhan: 'Sản phẩm đầu ra', muc: 1, mau: true, kieu: 'sanPham', ten: ['san pham dau ra', 'loai san pham', 'san pham'] },
  { k: 'cap_nhan', nhan: 'Cấp nhận sản phẩm', muc: 1, mau: true, kieu: 'cap', ten: ['cap nhan san pham', 'cap nhan', 'trinh cap'] },
  { k: 'do_khan', nhan: 'Độ khẩn', muc: 1, mau: true, kieu: 'doKhan', ten: ['do khan', 'muc do khan'] },
  { k: 'nguon', nhan: 'Nguồn nhiệm vụ', muc: 1, mau: true, kieu: 'nguon', ten: ['nguon nhiem vu', 'nguon'] },
  { k: 'nganh', nhan: 'Ngành', muc: 1, mau: true, kieu: 'nganh', ten: ['nganh', 'nganh/linh vuc', 'nganh linh vuc'] },
  { k: 'linh_vuc', nhan: 'Lĩnh vực', muc: 1, mau: true, kieu: 'linhVuc', ten: ['linh vuc'] },
  { k: 'tien_do', nhan: 'Tiến độ', muc: 2, mau: true, kieu: 'tienDo', ten: ['tien do', 'tinh trang', 'trang thai'] },
  { k: 'vuong_mac', nhan: 'Vướng mắc', muc: 2, mau: true, ten: ['vuong mac', 'kho khan vuong mac', 'kho khan, vuong mac', 'de xuat kien nghi'] },
  { k: 'kq_so_hieu', nhan: 'Số hiệu văn bản kết quả', muc: 3, mau: true, ten: ['so hieu van ban ket qua', 'so van ban ket qua', 'so hieu minh chung'] },
  { k: 'kq_ngay', nhan: 'Ngày văn bản kết quả', muc: 3, mau: true, kieu: 'ngay', ten: ['ngay van ban ket qua', 'ngay minh chung'] },
  { k: 'kq_trich_yeu', nhan: 'Trích yếu văn bản kết quả', muc: 3, mau: true, ten: ['trich yeu van ban ket qua', 'trich yeu ket qua', 'trich yeu'] },
  { k: 'kq_mo_ta', nhan: 'Mô tả kết quả', muc: 3, mau: true, ten: ['mo ta ket qua', 'ket qua thuc hien / minh chung', 'ket qua thuc hien', 'ket qua'] },
  { k: 'chat_luong', nhan: 'Chất lượng', muc: 3, mau: true, kieu: 'chatLuong', ten: ['chat luong', 'danh gia chat luong'] },
  { k: 'linh_vuc_chi_tiet', nhan: 'Lĩnh vực chi tiết', muc: 1, mau: false, ten: ['linh vuc chi tiet'] },
  { k: 'van_ban_trien_khai', nhan: 'Văn bản triển khai', muc: 2, mau: false, ten: ['van ban trien khai'] },
  { k: 'don_vi_phoi_hop', nhan: 'Đơn vị phối hợp', muc: 1, mau: false, ten: ['don vi phoi hop', 'phoi hop'] },
  { k: 'ghi_chu', nhan: 'Ghi chú', muc: 2, mau: false, ten: ['ghi chu'] },
];
export const TRUONG_MAU = TRUONG.filter((t) => t.mau);
export const truong = (k) => TRUONG.find((t) => t.k === k);
export const nhanTruong = (k) => truong(k)?.nhan || k;
export const TEN_MUC = { 0: 'Định danh', 1: 'Mức 1 — đủ để giao', 2: 'Mức 2 — tiến độ', 3: 'Mức 3 — đủ để đóng' };

// Chuẩn hoá chữ để so khớp: thường, bỏ dấu (đ → d), bỏ "(*)", gộp khoảng trắng.
export const chuanChu = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/\(\*\)|\*/g, '').replace(/\s+/g, ' ').trim();
export const chuanTieuDe = (s) => chuanChu(s).replace(/\s*\/\s*/g, '/').replace(/[:.]$/, '');

// Hồ sơ dựng sẵn (không lưu DB): mẫu chuẩn của hệ thống và "Phụ lục 2" (bảng theo dõi kết luận BTV hiện dùng, tiêu đề ở dòng 3).
export const HO_SO_MAU = {
  ten: 'Mẫu nhập chuẩn VPTU-TASK', mau: 'CHUAN', ten_sheet: 'Nhập liệu', dong_tieu_de: 1,
  anh_xa: Object.fromEntries(TRUONG.map((t) => [chuanTieuDe(t.nhan), t.k])),
};
export const HO_SO_PHU_LUC_2 = {
  ten: 'Phụ lục 2 (theo dõi kết luận BTV)', mau: 'PHU_LUC_2', ten_sheet: 'Phụ lục 2', dong_tieu_de: 3,
  anh_xa: { 'so hoi nghi': 'so_hoi_nghi', 'so tb/kl': 'so_ket_luan', 'ngay ban hanh': 'ngay_ban_hanh', 'chu tri theo doi': 'theo_doi',
    'nganh/linh vuc': 'nganh', 'co quan/don vi trinh': 'don_vi', 'linh vuc chi tiet': 'linh_vuc_chi_tiet', 'noi dung ket luan/van ban trinh': 'noi_dung',
    'loai thoi han': 'loai_thoi_han', 'han xu ly': 'han_xu_ly', 'tien do': 'tien_do', 'ket qua thuc hien/minh chung': 'kq_mo_ta',
    'van ban trien khai': 'van_ban_trien_khai', 'ma nhiem vu': 'ma' },
};

// Ghép một tiêu đề với trường chuẩn: khớp đúng tên hay gặp, rồi "bắt đầu bằng" tên dài nhất (tránh "han" ăn "han nop").
export function doanTruong(tieuDe) {
  const h = chuanTieuDe(tieuDe);
  if (!h) return null;
  const dung = TRUONG.find((t) => t.ten.some((x) => chuanTieuDe(x) === h) || chuanTieuDe(t.nhan) === h);
  if (dung) return dung.k;
  let tot = null; let dai = 0;
  TRUONG.forEach((t) => t.ten.forEach((x) => { const c = chuanTieuDe(x); if (c.length > 3 && h.startsWith(c) && c.length > dai) { tot = t.k; dai = c.length; } }));
  return tot;
}

// Ghép một dòng tiêu đề (đã chuẩn hoá) theo hồ sơ: cột có trong hồ sơ theo hồ sơ; hồ sơ dựng sẵn (mẫu, Phụ lục 2) còn đoán thêm cột người dùng
// chèn vào bảng (vd. "Cán bộ chủ trì") cho trường chưa có cột. Hồ sơ đã lưu giữ đúng cách ghép người dùng đã chọn.
export function ghepTheoHoSo(hang, h) {
  const anhXa = {}; hang.forEach((x, i) => { if (x && h.anh_xa[x]) anhXa[i] = h.anh_xa[x]; });
  if (h.mau !== 'TU_GHEP') {
    const daDung = new Set(Object.values(anhXa));
    hang.forEach((x, i) => { const k = anhXa[i] === undefined && x && doanTruong(x); if (k && !daDung.has(k)) { anhXa[i] = k; daDung.add(k); } });
  }
  return anhXa;
}

// Tìm sheet + dòng tiêu đề tốt nhất trong 15 dòng đầu mỗi sheet (sheet ẩn bỏ qua): điểm = số cột ghép được; hồ sơ có sẵn (mẫu, Phụ lục 2, hồ sơ
// đã lưu) khớp ≥ 60% tiêu đề của nó thì dùng hồ sơ đó (ghepTheoHoSo). → { sheet, dongTieuDe, hoSo, anhXa: {chỉ số cột: mã trường} }
export function timTieuDe(sheets, hoSoDaLuu = []) {
  const hoSoDs = [HO_SO_MAU, HO_SO_PHU_LUC_2, ...hoSoDaLuu.map((h) => ({ ...h, mau: 'TU_GHEP' }))];
  let tot = null;
  sheets.forEach((s, si) => {
    if (s.an) return;
    for (let r = 0; r < Math.min(15, s.dong.length); r++) {
      const hang = (s.dong[r] || []).map((x) => (x === null || x === undefined ? '' : chuanTieuDe(x)));
      if (hang.filter(Boolean).length < 2) continue;
      for (const h of hoSoDs) {
        const khoa = Object.keys(h.anh_xa); const trung = khoa.filter((k) => hang.includes(k)).length;
        if (khoa.length && trung / khoa.length >= 0.6 && (!tot || trung + 100 > tot.diem)) {
          tot = { sheet: si, dongTieuDe: r, hoSo: h, anhXa: ghepTheoHoSo(hang, h), diem: trung + 100 };
        }
      }
      const anhXa = {}; const daDung = new Set();
      hang.forEach((x, i) => { const k = x && doanTruong(x); if (k && !daDung.has(k)) { anhXa[i] = k; daDung.add(k); } });
      const diem = Object.keys(anhXa).length;
      if (diem >= 2 && (!tot || diem > tot.diem)) tot = { sheet: si, dongTieuDe: r, hoSo: null, anhXa, diem };
    }
  });
  return tot;
}
