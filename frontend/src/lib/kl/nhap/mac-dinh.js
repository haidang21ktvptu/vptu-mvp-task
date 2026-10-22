// Quy tắc điền mặc định cho ô hệ thống cần mà bảng Phụ lục không có (v3.27 — chủ dự án 20/10/2026: "khi dữ liệu được điền đầy đủ từ cột B tới cột M
// thì import được ngay"). Dùng chung: nhập Excel (danh-gia.js), danh sách "Chờ hoàn thiện" (thiếu còn lại) và biểu mẫu Hoàn thiện (điền sẵn). Quy tắc
// cố định theo từ khoá — không gọi trợ lý AI; bản xem trước / dải nhắc ghi rõ ô nào điền theo quy tắc để người nhập sửa. Thuần (không DOM, không mạng).
import { chuanChu, nhanTruong, chuThuong } from './truong.js';

// Sản phẩm đầu ra: văn bản kết luận đồng ý "ban hành / xây dựng <loại văn bản>" → sản phẩm cùng loại; "Ký ban hành" (văn bản trình ký) → Dự thảo văn
// bản; còn lại → Báo cáo (báo cáo kết quả thực hiện kết luận). Chỉ trả mã có trong danh mục.
const SP_THEO_TU = [['ke hoach', 'KE_HOACH'], ['quyet dinh', 'QUYET_DINH'], ['quy dinh', 'QUY_CHE'], ['quy che', 'QUY_CHE'], ['chuong trinh', 'CHUONG_TRINH'],
  ['de an', 'DE_AN'], ['huong dan', 'HUONG_DAN'], ['thong bao', 'THONG_BAO'], ['chi thi', 'DU_THAO_VAN_BAN'], ['nghi quyet', 'DU_THAO_VAN_BAN'], ['ket luan', 'DU_THAO_VAN_BAN']];
const RE_BAN_HANH = new RegExp(`(?:ban hanh|xay dung|ky ban hanh|phe duyet|thong qua)\\s+(?:du thao\\s+)?(${SP_THEO_TU.map(([t]) => t).join('|')})`);
export function sanPhamMacDinh(noiDung, loaiThoiHan, dsSanPham = []) {
  const co = (ma) => (dsSanPham.some((s) => s.ma === ma) ? ma : null);
  const m = RE_BAN_HANH.exec(chuanChu(noiDung));
  const theoTu = m && co(SP_THEO_TU.find(([t]) => t === m[1])[1]);
  return theoTu || (loaiThoiHan === 'KY_BAN_HANH' && co('DU_THAO_VAN_BAN')) || co('BAO_CAO') || null;
}

// Lĩnh vực (danh mục) trong ngành — v3.29 dùng chung cho mọi nơi giao / sửa việc (ô Lĩnh vực bỏ khỏi giao diện: bảng Phụ lục chỉ có Ngành/lĩnh vực,
// Lĩnh vực chi tiết): chỉ xét lĩnh vực trong phạm vi được giao (cho: Set mã — kiêm nhiệm, pham-vi.js; null = không lọc); (1) chỉ còn một lĩnh vực;
// (2) lĩnh vực chi tiết ghi đúng tên một lĩnh vực (người nhập chỉ rõ — trước cả gợi ý); (3) gợi ý hợp lệ (trợ lý AI, dòng Excel, lĩnh vực đang có
// của việc); (4) lĩnh vực chi tiết / nội dung chứa từ khoá của một lĩnh vực trong ngành (theo tên lĩnh vực — không phụ thuộc mã; "thuế" xét cả dấu
// để không lẫn "thuê"); (5) không nhận ra → lĩnh vực của việc vừa giao cùng ngành (truoc — "Giao, nhập tiếp": như ô chọn cũ giữ lựa chọn), rồi
// lĩnh vực mang tên phần đầu của ngành ("3. Nội chính - ANQP…" → Nội chính), không có thì lĩnh vực đầu. → { ma, chac } (chac = false: lấy mặc
// định) | null (ngành không có lĩnh vực trong phạm vi).
const TU_KHOA = {
  'kiem tra dang': /kiem tra|giam sat|ky luat|uy ban kiem tra|ubkt|kt ?gs/,
  'xay dung chinh quyen': /chinh quyen|noi vu|don vi hanh chinh|don vi su nghiep|bien che|cong chuc|vien chuc|khen thuong|thi dua|thon,? to dan pho/,
  'to chuc, xay dung dang': /to chuc|can bo|dai hoi|bau cu|dang vien|co so dang|nhan su|ban chap hanh|tccb/,
  anqp: /quoc phong|an ninh|quan su|bien gioi|cong an|anqp|bi mat nha nuoc|quan doi/,
  'tu phap': /tu phap|toa an|vien kiem sat|thi hanh an|cai cach tu phap|phap luat/,
  'noi chinh': /noi chinh|tham nhung|tieu cuc|lang phi|tiep cong dan|khieu nai|to cao/,
  'truong chinh tri': /truong chinh tri/,
  'cong tac tuyen giao': /tuyen giao|tuyen truyen|bao chi|dan van|ky niem|thi dua yeu nuoc|hoc tap/,
  'doi ngoai dang': /doi ngoai|hop tac quoc te|ngoai vu|nuoc ngoai|quang tay|trung quoc/,
  'khu kinh te': /khu kinh te|cua khau/,
  'khu/cum cn': /khu cong nghiep|cum cong nghiep|khu\/cum cn|kcn|ccn/,
  'nang luong': /nang luong|thuy dien|dien gio|dien mat troi|luoi dien|cong thuong/,
  'moi truong': /moi truong|rac thai|o nhiem|nuoc thai/,
  pctt: /thien tai|lu lut|lu quet|sat lo|pctt|mua lu/,
  'tai nguyen': /dat dai|tai nguyen|khoang san|chuyen muc dich su dung|thu hoi dat|giao dat|\brung\b/,
  'ngan sach': /ngan sach|du toan|du phong|thu chi|ke hoach von/,
  'dau tu': /dau tu|chu truong dau tu|nha dau tu|du an|von dau tu/,
  'tai chinh': /tai chinh|tai san|ngan hang|tin dung|kinh phi/,
  'du an giao thong trong diem': /cao toc|giao thong trong diem|dong dang|tra linh/,
  'giao thong': /giao thong|quoc lo|duong bo|cau duong|tuyen duong/,
  'chuyen doi so': /chuyen doi so|so hoa|cong nghe thong tin|du lieu so|chinh phu so/,
  khcn: /khoa hoc|cong nghe|doi moi sang tao|khcn/,
  'xa hoi': /giao duc|y te|lao dong|viec lam|an sinh|giam ngheo|ngheo|truong hoc|benh vien|bao hiem|noi tru|nha tam/,
};
const TU_KHOA_DAU = { 'tai chinh': /thuế/ };   // xét trên chữ có dấu: "thuế" (Tài chính) khác "thuê" (đất cho thuê — Tài nguyên)
export function linhVucMacDinh({ nganh, chiTiet, noiDung, goiY = null, cho = null, truoc = null }, dm = {}) {
  const ds = (dm.linhVuc || []).filter((l) => l.nganh_ma === nganh && (!cho || cho.has(l.ma)));
  if (!nganh || !ds.length) return null;
  if (ds.length === 1) return { ma: ds[0].ma, chac: true };
  const ten = (l) => chuanChu(l.ten);
  const dungTen = chiTiet && ds.find((l) => chuanChu(chiTiet) === ten(l)); if (dungTen) return { ma: dungTen.ma, chac: true };
  if (goiY && ds.some((l) => l.ma === goiY)) return { ma: goiY, chac: true };
  for (const goc of [chiTiet, noiDung].filter(Boolean)) {
    const chu = chuanChu(goc); const coDau = String(goc).normalize('NFC').toLowerCase();
    const dung = ds.find((l) => chu === ten(l)); if (dung) return { ma: dung.ma, chac: true };
    const theoTu = ds.find((l) => TU_KHOA[ten(l)]?.test(chu) || TU_KHOA_DAU[ten(l)]?.test(coDau)); if (theoTu) return { ma: theoTu.ma, chac: true };
  }
  if (truoc && ds.some((l) => l.ma === truoc)) return { ma: truoc, chac: false };
  const dau = chuanChu((dm.nganh || []).find((n) => n.ma === nganh)?.ten).replace(/^\d+[.)]\s*/, '').split(/\s+-\s+/)[0];
  return { ma: (ds.find((l) => ten(l) === dau) || ds[0]).ma, chac: false };
}

// Hạn mặc định của việc đang làm còn trống hạn: 1 tháng kể từ ngày đưa lên hệ thống (hoặc từ ngày ban hành, nếu văn bản ban hành sau hôm nay —
// không xảy ra với dữ liệu thật). Cộng tháng giữ ngày, ngày không có trong tháng sau → ngày cuối tháng (31/01 → 28/02).
export function congThang(iso, n = 1) {
  const [y, m, d] = iso.split('-').map(Number); const t = m - 1 + n; const ny = y + Math.floor(t / 12); const nm = ((t % 12) + 12) % 12;
  const cuoi = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(d, cuoi)).padStart(2, '0')}`;
}
export const hanMacDinh = (homNay, ngayBanHanh) => congThang(ngayBanHanh && ngayBanHanh > homNay ? ngayBanHanh : homNay, 1);

// "Chờ hoàn thiện" (v3.27 — chủ dự án 20/10/2026: dòng đã có cán bộ chủ trì mà vẫn báo "thiếu đơn vị chủ trì"): giá trị điền sẵn khi mở Hoàn thiện
// và các ô thật sự còn thiếu. du: dong_nhap.du_lieu (khoá cột nhiem_vu); goc: dữ liệu gốc của dòng (tên cột trong tệp → giá trị).
// → { dien: { san_pham_loai, linh_vuc_ma, loai_thoi_han_ma, han_xu_ly, co_quan_trinh } (chỉ ô đang trống, có giá trị), lvChac, thieu: [mã trường] }
const boSo = (s) => chuanChu(s).replace(/^\d+[.)]\s*/, '');
export function dienSanCho({ thieu = [], du = {}, goc = {} }, dm = {}, homNay = '') {
  const dien = {}; const lv = linhVucMacDinh({ nganh: du.nganh_ma, chiTiet: du.linh_vuc_chi_tiet, noiDung: du.noi_dung }, dm);
  const loai = du.loai_thoi_han_ma && !['CO_HAN_CU_THE', 'KY_BAN_HANH'].includes(du.loai_thoi_han_ma) ? 'CO_HAN_CU_THE' : du.loai_thoi_han_ma || 'CO_HAN_CU_THE';
  if (loai !== du.loai_thoi_han_ma) dien.loai_thoi_han_ma = loai;
  if (!du.san_pham_loai) dien.san_pham_loai = sanPhamMacDinh(du.noi_dung, loai, dm.sanPham || []);
  if (!du.linh_vuc_ma && lv) dien.linh_vuc_ma = lv.ma;
  if (!du.han_xu_ly && loai === 'CO_HAN_CU_THE' && homNay) dien.han_xu_ly = hanMacDinh(homNay, du.ngay_ban_hanh);
  const cqt = !du.co_quan_trinh && [goc['Cơ quan/đơn vị trình'], goc['Cơ quan trình'], goc['Đơn vị chủ trì']].filter(Boolean)
    .map((v) => (dm.donVi || []).find((d) => (!d.trong_van_phong || d.ma === 'VAN_PHONG_TINH_UY') && boSo(d.ten) === boSo(v))).find(Boolean);
  if (cqt) dien.co_quan_trinh = cqt.ma;
  Object.keys(dien).forEach((k) => { if (!dien[k]) delete dien[k]; });
  const bo = new Set(['muc_tieu', 'loai_thoi_han']);
  if (du.owner_tai_khoan) bo.add('don_vi');
  if (dien.san_pham_loai) bo.add('san_pham');
  if (dien.han_xu_ly) bo.add('han_xu_ly');
  if (dien.linh_vuc_ma) bo.add('linh_vuc');   // v3.29: lĩnh vực luôn tự xác định theo ngành — không còn là ô người dùng điền
  return { dien, lvChac: Boolean(lv?.chac), thieu: thieu.filter((k) => !bo.has(k)) };
}
// Chữ "thiếu" / "điền sẵn" dùng chung cho danh sách "Chờ hoàn thiện" và dải nhắc của biểu mẫu Hoàn thiện. x: dienSanCho. Đơn vị chủ trì đọc là "chủ trì
// theo dõi" (một ô của biểu mẫu); v3.29: lĩnh vực không còn là ô của biểu mẫu (tự xác định) — không nhắc ở "điền sẵn"; còn thiếu thì là thiếu ngành/lĩnh vực.
const TEN_DIEN = { loai_thoi_han_ma: 'loại thời hạn', san_pham_loai: 'sản phẩm đầu ra', han_xu_ly: 'hạn xử lý', co_quan_trinh: 'cơ quan/đơn vị trình' };
export function chuDienSan(x) {
  const thieu = [...new Set((x.thieu || []).map((k) => (k === 'don_vi' ? 'chủ trì theo dõi' : k === 'linh_vuc' ? chuThuong(nhanTruong('nganh')) : chuThuong(nhanTruong(k)))))];
  return { thieu, dien: Object.keys(x.dien || {}).map((k) => TEN_DIEN[k]).filter(Boolean) };
}
