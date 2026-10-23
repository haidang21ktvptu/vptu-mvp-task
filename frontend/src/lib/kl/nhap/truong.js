// Chuẩn nhập của hệ thống (v9 đợt 2 — nhập Excel toàn trình), 3 mức: mức 1 = đủ để GIAO việc; mức 2 = tiến độ (tuỳ chọn); mức 3 = đủ để
// ĐÓNG việc (minh chứng 4 yếu tố + chất lượng). Mã trường khớp kl_truong_nhap() (migration 0072). ten: tiêu đề hay gặp (đã chuẩn hoá — chuanTieuDe)
// để tự ghép cột. v3.27 (chủ dự án 20/10/2026 — "chuẩn hoá theo tệp TUCB …, điền đủ cột B tới M thì import được ngay"): MẪU NHẬP CHUẨN = đúng các cột
// của bảng Phụ lục (COT_MAU, A–O); mẫu 29 cột cũ (cu: true) vẫn nhận ra (HO_SO_MAU_CU). Cột "Chủ trì theo dõi" (chu_tri) = cán bộ chủ trì, hoặc một đơn
// vị Văn phòng ("VPTU"); "Cơ quan/đơn vị trình" là cơ quan trình (trước v3.27 bị ghép nhầm vào đơn vị chủ trì). v3.31 (0128): cột "Người theo dõi" của
// mẫu cũ vẫn nhận ra nhưng bỏ qua (an: không có trong ô chọn ghép cột; chuanDong không đọc) — hệ thống ghi theo chủ trì theo dõi.

export const TRUONG = [
  { k: 'ma', nhan: 'Mã nhiệm vụ', muc: 0, cu: true, ten: ['ma nhiem vu', 'ma nv', 'ma'], goiY: 'Để trống khi nhập việc mới; có mã → cập nhật việc đó' },
  { k: 'loai_van_ban', nhan: 'Loại văn bản', muc: 1, cu: true, kieu: 'loaiVanBan', ten: ['loai van ban', 'loai vb'] },
  { k: 'so_hoi_nghi', nhan: 'Số hội nghị', muc: 1, cu: true, kieu: 'so', ten: ['so hoi nghi', 'hoi nghi so', 'hoi nghi'] },
  { k: 'so_ket_luan', nhan: 'Số TB/KL', nhanCu: 'Số/ký hiệu văn bản', muc: 1, cu: true, ten: ['so/ky hieu van ban', 'so ky hieu van ban', 'so tb/kl', 'so tb kl', 'so kl/tb', 'so van ban', 'so hieu van ban', 'so ket luan', 'so hieu', 'ky hieu'] },
  { k: 'ngay_ban_hanh', nhan: 'Ngày ban hành', muc: 1, cu: true, kieu: 'ngay', ten: ['ngay ban hanh', 'ngay bh', 'ngay van ban'] },
  { k: 'noi_dung', nhan: 'Nội dung kết luận / Văn bản trình', nhanCu: 'Nội dung nhiệm vụ', muc: 1, cu: true, ten: ['noi dung nhiem vu', 'noi dung ket luan / van ban trinh', 'noi dung ket luan', 'noi dung', 'nhiem vu'] },
  { k: 'don_vi', nhan: 'Đơn vị chủ trì theo dõi', nhanCu: 'Đơn vị chủ trì', muc: 1, cu: true, kieu: 'donVi', ten: ['don vi chu tri', 'co quan chu tri', 'don vi thuc hien', 'don vi'] },
  { k: 'chu_tri', nhan: 'Chủ trì theo dõi', muc: 1, kieu: 'chuTri', ten: ['chu tri theo doi', 'chu tri', 'nguoi chu tri theo doi'], goiY: 'Họ tên cán bộ, hoặc "VPTU" (Văn phòng Tỉnh ủy)' },
  { k: 'can_bo', nhan: 'Cán bộ chủ trì', muc: 1, cu: true, kieu: 'canBo', ten: ['can bo chu tri', 'chuyen vien chu tri', 'nguoi chu tri', 'nguoi thuc hien'] },
  { k: 'theo_doi', nhan: 'Người theo dõi', muc: 1, cu: true, an: true, kieu: 'canBo', ten: ['nguoi theo doi', 'can bo theo doi', 'theo doi'] },   // v3.31: bỏ qua
  { k: 'lanh_dao_giao', nhan: 'Lãnh đạo giao', muc: 1, cu: true, kieu: 'lanhDao', ten: ['lanh dao giao', 'nguoi giao', 'lanh dao chi dao'], goiY: 'Họ tên lãnh đạo, hoặc "Lãnh đạo Văn phòng" / "Thường trực Tỉnh ủy" (cả nhóm — v3.18)' },
  { k: 'loai_thoi_han', nhan: 'Loại thời hạn', muc: 1, cu: true, kieu: 'loaiThoiHan', ten: ['loai thoi han', 'loai han'] },
  { k: 'han_xu_ly', nhan: 'Hạn xử lý', nhanCu: 'Hạn hoàn thành', muc: 1, cu: true, kieu: 'ngay', ten: ['han hoan thanh', 'han xu ly', 'thoi han hoan thanh', 'thoi han', 'han'] },
  { k: 'san_pham', nhan: 'Sản phẩm đầu ra', muc: 1, cu: true, kieu: 'sanPham', ten: ['san pham dau ra', 'loai san pham', 'san pham'] },
  { k: 'cap_nhan', nhan: 'Cấp nhận sản phẩm', muc: 1, cu: true, kieu: 'cap', ten: ['cap nhan san pham', 'cap nhan', 'trinh cap'] },
  { k: 'do_khan', nhan: 'Độ khẩn', muc: 1, cu: true, kieu: 'doKhan', ten: ['do khan', 'muc do khan'] },
  { k: 'nguon', nhan: 'Nguồn nhiệm vụ', muc: 1, cu: true, kieu: 'nguon', ten: ['nguon nhiem vu', 'nguon'] },
  { k: 'nganh', nhan: 'Ngành/lĩnh vực', nhanCu: 'Ngành', muc: 1, cu: true, kieu: 'nganh', ten: ['nganh', 'nganh/linh vuc', 'nganh linh vuc'] },
  { k: 'linh_vuc', nhan: 'Lĩnh vực', muc: 1, cu: true, kieu: 'linhVuc', ten: ['linh vuc'] },
  { k: 'tien_do', nhan: 'Tiến độ', muc: 2, cu: true, kieu: 'tienDo', ten: ['tien do', 'tinh trang', 'trang thai'] },
  { k: 'vuong_mac', nhan: 'Vướng mắc', muc: 2, cu: true, ten: ['vuong mac', 'kho khan vuong mac', 'kho khan, vuong mac', 'de xuat kien nghi'] },
  { k: 'kq_so_hieu', nhan: 'Số hiệu văn bản kết quả', muc: 3, cu: true, ten: ['so hieu van ban ket qua', 'so van ban ket qua', 'so hieu minh chung'] },
  { k: 'kq_ngay', nhan: 'Ngày văn bản kết quả', muc: 3, cu: true, kieu: 'ngay', ten: ['ngay van ban ket qua', 'ngay minh chung'] },
  { k: 'kq_trich_yeu', nhan: 'Trích yếu văn bản kết quả', muc: 3, cu: true, ten: ['trich yeu van ban ket qua', 'trich yeu ket qua', 'trich yeu'] },
  { k: 'kq_mo_ta', nhan: 'Kết quả thực hiện / Minh chứng', nhanCu: 'Mô tả kết quả', muc: 3, cu: true, ten: ['mo ta ket qua', 'ket qua thuc hien / minh chung', 'ket qua thuc hien', 'ket qua'] },
  { k: 'chat_luong', nhan: 'Chất lượng', muc: 3, cu: true, kieu: 'chatLuong', ten: ['chat luong', 'danh gia chat luong'] },
  // Đợt D v3.20 (0093): ba ô nguồn của 0087 — thêm cuối mẫu (giữ vị trí 25 cột cũ để tệp đã điền / "Xuất theo mẫu" nhập lại đúng cột).
  { k: 'muc_quan_trong', nhan: 'Mức quan trọng', muc: 1, cu: true, kieu: 'mucQT', ten: ['muc quan trong', 'muc do quan trong'] },
  { k: 'co_quan_trinh', nhan: 'Cơ quan/đơn vị trình', nhanCu: 'Cơ quan trình', muc: 1, cu: true, kieu: 'coQuanTrinh', ten: ['co quan/don vi trinh', 'co quan don vi trinh', 'co quan trinh', 'don vi trinh'] },
  { k: 'thuong_truc_chi_dao', nhan: 'Thường trực chỉ đạo', muc: 1, cu: true, kieu: 'thuongTruc', ten: ['thuong truc chi dao', 'dong chi thuong truc chi dao'] },
  // v3.24 (0106): mục tiêu then chốt — cuối mẫu; nhiều mục cách nhau bằng dấu chấm phẩy; chỉ áp khi lô TẠO việc (cập nhật theo mã không đổi).
  { k: 'muc_tieu', nhan: 'Mục tiêu then chốt', muc: 1, cu: true, kieu: 'mucTieu', ten: ['muc tieu then chot', 'muc tieu', 'phuc vu muc tieu'],
    goiY: 'Tên ngắn (sheet "Danh mục") hoặc mã; nhiều mục cách nhau bằng dấu chấm phẩy (;), tối đa 10' },
  { k: 'linh_vuc_chi_tiet', nhan: 'Lĩnh vực chi tiết', muc: 1, ten: ['linh vuc chi tiet'] },
  { k: 'van_ban_trien_khai', nhan: 'Văn bản triển khai', muc: 2, ten: ['van ban trien khai'] },
  { k: 'don_vi_phoi_hop', nhan: 'Đơn vị phối hợp', muc: 1, ten: ['don vi phoi hop', 'phoi hop'] },
  { k: 'ghi_chu', nhan: 'Ghi chú', muc: 2, ten: ['ghi chu'] },
];
export const TRUONG_CU = TRUONG.filter((t) => t.cu);   // 29 cột của mẫu trước v3.27 (thứ tự cột cũ)
export const truong = (k) => TRUONG.find((t) => t.k === k);
export const nhanTruong = (k) => truong(k)?.nhan || k;
// Tên ô giữa câu ("thiếu …"): chỉ hạ chữ đầu — giữ nguyên "TB/KL", "Văn bản trình" như cột bảng Phụ lục (v3.28.1).
export const chuThuong = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
export const TEN_MUC = { 0: 'Định danh', 1: 'Mức 1 — đủ để giao', 2: 'Mức 2 — tiến độ', 3: 'Mức 3 — đủ để đóng' };

// Chuẩn hoá chữ để so khớp: thường, bỏ dấu (đ → d), bỏ "(*)", gộp khoảng trắng.
export const chuanChu = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
  .toLowerCase().replace(/\(\*\)|\*/g, '').replace(/\s+/g, ' ').trim();
export const chuanTieuDe = (s) => chuanChu(s).replace(/\s*\/\s*/g, '/').replace(/[:.]$/, '');

// v3.27: mẫu nhập chuẩn = các cột của bảng Phụ lục (tệp TUCB / KL Thường trực của Văn phòng): A STT … O Mã nhiệm vụ. "STT" không ghép (đánh số).
export const COT_MAU = [['stt', 'STT'], ['so_hoi_nghi', 'Số hội nghị'], ['so_ket_luan', 'Số TB/KL'], ['ngay_ban_hanh', 'Ngày ban hành'], ['chu_tri', 'Chủ trì theo dõi'],
  ['nganh', 'Ngành/lĩnh vực'], ['co_quan_trinh', 'Cơ quan/đơn vị trình'], ['linh_vuc_chi_tiet', 'Lĩnh vực chi tiết'], ['noi_dung', 'Nội dung kết luận / Văn bản trình'],
  ['loai_thoi_han', 'Loại thời hạn'], ['han_xu_ly', 'Hạn xử lý'], ['tien_do', 'Tiến độ'], ['kq_mo_ta', 'Kết quả thực hiện / Minh chứng'],
  ['van_ban_trien_khai', 'Văn bản triển khai'], ['ma', 'Mã nhiệm vụ']];
export const COT_BAT_BUOC = ['so_ket_luan', 'ngay_ban_hanh', 'chu_tri', 'nganh', 'co_quan_trinh', 'noi_dung', 'loai_thoi_han', 'tien_do'];   // B (KL BTV), K (Có hạn cụ thể) theo dòng
// Hồ sơ dựng sẵn (không lưu DB): mẫu chuẩn (bảng Phụ lục — tiêu đề ở dòng nào cũng nhận) và mẫu 29 cột trước v3.27.
export const HO_SO_MAU = {
  ten: 'Mẫu nhập chuẩn VPTU-TASK (bảng Phụ lục)', mau: 'CHUAN', ten_sheet: 'Nhập liệu', dong_tieu_de: 1,
  anh_xa: Object.fromEntries(COT_MAU.filter(([k]) => k !== 'stt').map(([k, t]) => [chuanTieuDe(t), k])),
};
export const HO_SO_MAU_CU = {
  ten: 'Mẫu nhập 29 cột (trước v3.27)', mau: 'CHUAN', ten_sheet: 'Nhập liệu', dong_tieu_de: 1,
  anh_xa: Object.fromEntries(TRUONG.filter((t) => t.k !== 'chu_tri').map((t) => [chuanTieuDe(t.nhanCu || t.nhan), t.k])),   // v3.28.1: tiêu đề cũ của mẫu 29 cột
};

// Ghép một tiêu đề với trường chuẩn: khớp đúng tên hay gặp, rồi "bắt đầu bằng" tên dài nhất (tránh "han" ăn "han nop").
export function doanTruong(tieuDe) {
  const h = chuanTieuDe(tieuDe);
  if (!h) return null;
  const dung = TRUONG.find((t) => t.ten.some((x) => chuanTieuDe(x) === h) || chuanTieuDe(t.nhan) === h || (t.nhanCu && chuanTieuDe(t.nhanCu) === h));
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

// Tìm sheet + dòng tiêu đề tốt nhất trong 15 dòng đầu mỗi sheet (sheet ẩn bỏ qua): điểm = số cột ghép được; hồ sơ có sẵn (mẫu chuẩn, mẫu cũ, hồ sơ
// đã lưu) khớp ≥ 60% tiêu đề của nó thì dùng hồ sơ đó (ghepTheoHoSo). → { sheet, dongTieuDe, hoSo, anhXa: {chỉ số cột: mã trường} }
export function timTieuDe(sheets, hoSoDaLuu = []) {
  const hoSoDs = [HO_SO_MAU, HO_SO_MAU_CU, ...hoSoDaLuu.map((h) => ({ ...h, mau: 'TU_GHEP' }))];
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
