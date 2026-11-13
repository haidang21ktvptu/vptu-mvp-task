// Phân hệ Nhiệm vụ quý BTV: đọc chữ của bảng Phụ lục (Danh mục tổ chức thực hiện các chỉ tiêu, nhiệm vụ chính trị trong quý — mẫu kèm Kế hoạch 193-KH/TU,
// Công văn 888-CV/TU) thành dữ liệu có cấu trúc: lãnh đạo phụ trách, đơn vị tham mưu / chủ trì (vai trò), các kết quả / sản phẩm và mốc của từng cái
// (văn bản, chỉ tiêu có số mục tiêu, hoạt động, định kỳ hằng tháng), tính chất tiến độ, số / ngày văn bản kết quả trong phần đã cập nhật, khớp tên chủ trì
// theo dõi với tài khoản. Thuần — unit test frontend/tests/nvq-tach.test.mjs. Kết quả là GỢI Ý: màn Nhập cho xem trước, sau nhập vẫn sửa được từng nhiệm vụ.

export const chuan = (s) => String(s ?? '').normalize('NFC').replace(/uỷ/g, 'ủy').replace(/Uỷ/g, 'Ủy').replace(/UỶ/g, 'ỦY').replace(/[ \t ]+/g, ' ').trim();
export const thuong = (s) => chuan(s).toLowerCase();
export const boDau = (s) => chuan(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const doan = (s) => chuan(s).split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);

// ---- Lãnh đạo phụ trách → mã danh mục (thứ tự kiểm quan trọng: "Phó Bí thư Thường trực" trước "Bí thư"; câu chỉ "Phó Bí thư Tỉnh ủy," không khớp gì) ----
export function nhanLanhDao(text, dm = []) {
  const ra = [];
  const them = (ma) => { if (ma && !ra.includes(ma) && (!dm.length || dm.some((l) => l.ma === ma))) ra.push(ma); };
  doan(text).forEach((g) => {
    const s = thuong(g).replace(/^(các )?đồng chí:?\s*|^đ\/c\s*/, '');
    if (/phó bí thư thường trực/.test(s)) them('PBT_TT');
    else if (/thường trực tỉnh ủy/.test(s)) them('TT_TU');
    if (/chủ tịch (ubnd|ủy ban nhân dân)/.test(s)) them('PBT_UBND');
    if (/mttq|mặt trận tổ quốc/.test(s)) them('PBT_MTTQ');
    if ((/bí thư tỉnh ủy/.test(s) && !/phó bí thư/.test(s)) || /chủ tịch hđnd|chủ tịch hội đồng nhân dân/.test(s)) them('BI_THU');
    dm.filter((l) => !['PBT_TT', 'TT_TU', 'PBT_UBND', 'PBT_MTTQ', 'BI_THU'].includes(l.ma)).forEach((l) => { if ((l.tu_khoa || []).some((k) => k && s.includes(thuong(k)))) them(l.ma); });
  });
  const thuTu = new Map(dm.map((l) => [l.ma, l.thu_tu]));
  return thuTu.size ? ra.sort((a, b) => (thuTu.get(a) ?? 99) - (thuTu.get(b) ?? 99)) : ra;
}

// ---- Đơn vị tham mưu, chủ trì → [{ ma, vai_tro, cu_the }] (mỗi đoạn có thể nêu nhiều đơn vị cùng vai trò) ----
export function nhanDonVi(text, dm = []) {
  const ra = [];
  doan(String(text || '').replace(/\n(?=\s*\()/g, ' ')).forEach((g) => {
    const s = thuong(g);
    const vai = /thẩm tra/.test(s) ? 'THAM_TRA' : /thẩm định/.test(s) ? 'THAM_DINH' : /phối hợp/.test(s) ? 'PHOI_HOP' : 'CHU_TRI';
    const cuThe = (chuan(g).match(/\(([^)]+)\)/) || [])[1]?.trim() || null;
    dm.forEach((d) => {
      const tk = [thuong(d.ten), ...(d.tu_khoa || []).map(thuong)].filter(Boolean);
      if (tk.some((k) => s.includes(k)) && !ra.some((x) => x.ma === d.ma)) ra.push({ ma: d.ma, vai_tro: vai, cu_the: cuThe });
    });
  });
  return ra;
}

// ---- Tiến độ → mốc ----
const cuoiThang = (nam, thang) => new Date(Date.UTC(nam, thang, 0)).toISOString().slice(0, 10);
export function tinhChatTienDo(text) {
  const s = thuong(text);
  if (/thường xuyên/.test(s) && /khi|nếu có/.test(s)) return 'KHI_PHAT_SINH';
  if (/thường xuyên/.test(s)) return 'THUONG_XUYEN';
  if (/khi có phát sinh|nếu có|khi phát sinh/.test(s)) return 'KHI_PHAT_SINH';
  if (/định kỳ|hằng tháng|hàng tháng|các tháng/.test(s)) return 'DINH_KY';
  if (/sau khi/.test(s)) return 'CHO_DIEU_KIEN';
  return 'CO_MOC';
}
// "Tháng 11/2026" → 30/11/2026; "Tháng 11 - 12/2026", "Tháng11,12/2026" → 31/12; "Quý IV/2026" → cuối quý; không đọc được → cuối quý.
export function hanTu(text, ky) {
  const s = thuong(text).replace(/hoàn thành/g, '');
  const m = s.match(/tháng\s*([\d\s,–-]+?)\s*\/\s*(\d{4})/);
  if (m) {
    const thang = m[1].split(/[^\d]+/).map(Number).filter((x) => x >= 1 && x <= 12);
    if (thang.length) return cuoiThang(Number(m[2]), Math.max(...thang));
  }
  const m2 = s.match(/tháng\s*(\d{1,2})(?!\s*[,–-]\s*\d)/);
  if (m2 && ky) return cuoiThang(ky.nam, Number(m2[1]));
  return ky?.den_ngay || null;
}
const thangCuaQuy = (ky) => [0, 1, 2].map((i) => 3 * ky.quy - 2 + i);
export const ghiThang = (thang, nam) => `Tháng ${thang}/${nam}`;

// ---- Chỉ tiêu: một dòng "GRDP quý IV: 14,86%" → { mo_ta, muc_tieu, don_vi_tinh, chi_tieu_co_ban } ----
const CTCB = [[/grdp|tăng trưởng/, 'GRDP'], [/thu ngân sách|thu nsnn/, 'THU_NSNN'], [/giải ngân/, 'GIAI_NGAN'], [/thu nhập bình quân/, 'THU_NHAP'], [/hộ nghèo/, 'GIAM_NGHEO']];
const SO = /(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(%|tỷ đồng|triệu đồng\/người|triệu đồng|bộ|xã|mộ|xóm)/i;
export const docSo = (nguyen, thapPhan) => Number(`${String(nguyen).replace(/\./g, '')}${thapPhan ? `.${thapPhan}` : ''}`);
export function docChiTieu(dong) {
  const s = thuong(dong);
  const ctcb = (CTCB.find(([re]) => re.test(s)) || [])[1] || null;
  const m = chuan(dong).match(SO);
  if (!m || (!ctcb && m[3] === '%')) return null;   // "Bảo đảm 100% …" không phải chỉ tiêu số liệu
  const moTa = chuan(dong).replace(/^[-–+•]\s*/, '').replace(/[.;]+$/, '').trim();
  return { mo_ta: moTa, muc_tieu: docSo(m[1], m[2]), don_vi_tinh: m[3].toLowerCase(), chi_tieu_co_ban: ctcb };
}

// ---- Loại kết quả theo chữ ----
export function loaiKetQua(text) {
  const s = thuong(text);
  if (/^(tổ chức|hội nghị|hội thảo|diễn tập|đoàn |tham quan|kịp thời huy động|thực hiện tuyên truyền|tiếp tục tìm kiếm)/.test(s) || /^\(?\d*\)?\s*tổ chức/.test(s)) return 'HOAT_DONG';
  if (/kế hoạch|báo cáo|nghị quyết|chỉ thị|quy định|quyết định|đề án|hướng dẫn|kết luận|chương trình|quy chế|công văn|văn bản|tờ trình|thông báo|dự thảo|tbkl/.test(s)) return 'VAN_BAN';
  return 'KHAC';
}

// Tách chữ có đánh số "(1) … (2) …" (số liền nhau từ 1) → các phần; không có "(1)" ở đầu → một phần.
export function tachDanhSo(text) {
  const t = chuan(text).replace(/^\(\(/, '(');
  const vt = []; let can = 1; const re = /\(\s*(\d{1,2})\s*\)/g; let m;
  while ((m = re.exec(t))) { if (Number(m[1]) === can) { vt.push({ i: m.index, j: re.lastIndex }); can += 1; } }
  if (!vt.length || vt[0].i > 8) return [t];
  return vt.map((p, k) => t.slice(p.j, k + 1 < vt.length ? vt[k + 1].i : t.length).replace(/^[\s:.]+|[\s;,]+$/g, '').trim()).filter(Boolean);
}

// Kết quả / sản phẩm của một nhiệm vụ từ cột "Kết quả/sản phẩm cần đạt được" + "Tiến độ" (phần chữ đen — chưa gồm kết quả đã cập nhật).
export function tachSanPham(ketQua, tienDo, ky) {
  const tinhChat = tinhChatTienDo(tienDo);
  const phanTd = tachDanhSo(tienDo);
  const phan = tachDanhSo(ketQua || '');
  const ds = [];
  phan.forEach((p, i) => {
    const td = phanTd.length === phan.length ? phanTd[i] : chuan(tienDo);
    const han = hanTu(td, ky);
    const dongCt = p.split(/\n|\s(?=-\s)/).map((x) => x.trim()).filter((x) => /^[-–+•]/.test(x)).map(docChiTieu).filter(Boolean);
    if (dongCt.length) { dongCt.forEach((c) => ds.push({ ...c, loai: 'CHI_TIEU', han, han_text: chuan(td) })); return; }
    const ct = docChiTieu(p);
    if (ct && (ct.chi_tieu_co_ban || ct.don_vi_tinh !== '%') && !/^tiếp tục/i.test(chuan(p))) { ds.push({ ...ct, mo_ta: chuan(p).replace(/[.;\s]+$/, ''), loai: 'CHI_TIEU', han, han_text: chuan(td) }); return; }
    ds.push({ mo_ta: p.replace(/\s*\n\s*/g, '; ').replace(/[.;\s]+$/, '').trim() || 'Kết quả theo yêu cầu nhiệm vụ', loai: loaiKetQua(p), han, han_text: chuan(td) });
  });
  if (!ds.length) ds.push({ mo_ta: 'Kết quả theo yêu cầu nhiệm vụ', loai: 'KHAC', han: hanTu(tienDo, ky), han_text: chuan(tienDo) });
  // Định kỳ hằng tháng, một kết quả → mỗi tháng của quý một mốc.
  if (tinhChat === 'DINH_KY' && ds.length === 1 && ky) {
    const goc = ds[0];
    return { tinhChat, sanPham: thangCuaQuy(ky).map((t, i) => ({ ...goc, loai: 'DINH_KY', thu_tu: i + 1, mo_ta: `${goc.mo_ta} — ${ghiThang(t, ky.nam).toLowerCase()}`,
      han: cuoiThang(ky.nam, t), han_text: ghiThang(t, ky.nam) })) };
  }
  return { tinhChat, sanPham: ds.map((s, i) => ({ ...s, thu_tu: i + 1 })) };
}

// ---- Phần kết quả đã cập nhật (chữ đỏ): số, ký hiệu và ngày văn bản đầu tiên tìm thấy ----
const SO_VB = /(\d{1,4}(?:\/\d{4})?\s?[-/]\s?[A-Za-zĐđ]{1,6}(?:[-/][A-Za-zĐđ&]{1,10}){1,3})/;
export function docVanBanKetQua(text) {
  const s = chuan(text);
  const so = (s.match(SO_VB) || [])[1]?.replace(/\s+/g, '') || null;
  const n = s.match(/ngày\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i);
  const ngay = n ? `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}` : null;
  return { so_ky_hieu: so, ngay };
}
export const coHoanThanh = (s) => /hoàn thành/i.test(chuan(s)) && !/hoàn thành\s+\d+\s*\/\s*\d+/i.test(chuan(s));

// ---- Khớp tên chủ trì theo dõi với tài khoản (chữ hoa, bỏ dấu, gõ lệch nhẹ); "PHÒNG CĐS-CY" → phòng ----
export const khoaTen = (s) => boDau(s).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
export function tachTenTheoDoi(text) {
  return chuan(text).replace(/^[\s(]*\d+\)?|\(\s*\d+\s*\)?/g, ' ').split(/;|,|\n/).map((x) => x.replace(/[()\d]/g, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3);
}
export function khopTen(ten, taiKhoan = [], { biDanh = {} } = {}) {
  const k = khoaTen(ten);
  if (!k) return null;
  if (biDanh[k]) return { id: biDanh[k], cach: 'bi-danh' };
  const ds = taiKhoan.filter((a) => a.full_name && !a.is_system && a.role_group !== 'A0');
  const dung = ds.filter((a) => khoaTen(a.full_name) === k || khoaTen(a.full_name).replace(/\s/g, '') === k.replace(/\s/g, ''));
  if (dung.length === 1) return { id: dung[0].id, cach: 'dung' };
  if (dung.length > 1) return { id: null, cach: 'trung', goiY: dung.map((a) => a.id) };
  const tu = k.split(' ');
  const diem = ds.map((a) => { const t = khoaTen(a.full_name).split(' '); return { a, d: tu.filter((x) => t.includes(x)).length + (t.at(-1) === tu.at(-1) ? 1 : 0) }; })
    .filter((x) => x.d >= Math.max(2, tu.length - 1)).sort((x, y) => y.d - x.d);
  return diem.length === 1 || (diem.length > 1 && diem[0].d > diem[1].d) ? { id: diem[0].a.id, cach: 'gan' } : { id: null, cach: 'khong', goiY: diem.slice(0, 5).map((x) => x.a.id) };
}
// tenPhong: { MA: ['Phòng Chuyển đổi số - Cơ yếu', 'CĐS-CY'] } (tên đầy đủ và tên ngắn).
export function phongTuTen(ten, tenPhong = {}) {
  const k = khoaTen(ten).replace(/^PHONG\s*/, '').replace(/\s/g, '');
  if (!k || !/^PHONG/.test(khoaTen(ten))) return null;
  return Object.keys(tenPhong).find((ma) => [].concat(tenPhong[ma]).some((x) => khoaTen(x).replace(/^PHONG\s*/, '').replace(/\s/g, '') === k)) || null;
}
