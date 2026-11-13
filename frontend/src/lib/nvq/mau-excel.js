// Phân hệ Nhiệm vụ quý BTV: tệp Excel "Mẫu danh mục nhiệm vụ quý" — hai sheet: "Nhiệm vụ" (một dòng một nhiệm vụ, đúng cột bảng Phụ lục + chủ trì theo
// dõi + kết quả đã cập nhật) và "Kết quả, sản phẩm" (một dòng một kết quả / sản phẩm, khoá Trục · Nhóm · Stt; trống → hệ thống tự tách từ cột "Kết quả/
// sản phẩm cần đạt được"). Dùng để: tải mẫu trống; xuất danh mục đang có để sửa rồi nhập lại (cùng vị trí → sửa thông tin giao); đầu mối chuẩn bị danh mục
// quý. Đọc tệp → các dòng nhập như phu-luc.js (nvq_nhap_danh_muc). Thuần (taoXlsx / docXlsx nhận, trả mảng byte / ma trận ô).
import { chuan, nhanLanhDao, nhanDonVi, tachSanPham, tinhChatTienDo, khopTen, phongTuTen } from './tach.js';
import { LOAI_SP, TINH_CHAT, CHI_TIEU_CO_BAN, tenTrangThaiSp } from './nhan.js';

export const SHEET_NV = 'Nhiệm vụ';
export const SHEET_SP = 'Kết quả, sản phẩm';
export const COT_NV = ['Trục', 'Nhóm (1: theo chương trình, kế hoạch; 2: ngoài chương trình, kế hoạch)', 'Stt', 'Nhiệm vụ được giao', 'Lãnh đạo phụ trách',
  'Đơn vị tham mưu, chủ trì', 'Kết quả/sản phẩm cần đạt được', 'Tiến độ thực hiện/hoàn thành', 'Tính chất', 'Chủ trì theo dõi', 'Phối hợp theo dõi', 'Phòng theo dõi',
  'Kết quả đã cập nhật'];
export const COT_SP = ['Trục', 'Nhóm', 'Stt', 'Thứ tự', 'Kết quả, sản phẩm', 'Loại', 'Mốc hoàn thành', 'Tiến độ ghi', 'Chỉ tiêu cơ bản', 'Đơn vị tính', 'Mục tiêu',
  'Trạng thái', 'Số, ký hiệu văn bản kết quả', 'Ngày văn bản kết quả', 'Kết quả (mô tả)'];
const RONG_NV = [6, 10, 6, 60, 30, 30, 50, 20, 14, 22, 22, 14, 50];
const RONG_SP = [6, 6, 6, 7, 55, 12, 14, 18, 22, 12, 10, 16, 22, 14, 40];
const nguoc = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [chuan(v).toLowerCase(), k]));
const LOAI_NGUOC = nguoc(LOAI_SP); const TC_NGUOC = nguoc(TINH_CHAT); const CTCB_NGUOC = nguoc(CHI_TIEU_CO_BAN);
const TT_NGUOC = { 'chưa triển khai': 'CHUA', 'đang thực hiện': 'DANG', 'đang xây dựng': 'DANG', 'đang chuẩn bị': 'DANG', 'đã trình': 'DA_TRINH', 'hoàn thành': 'HOAN_THANH',
  'đã ban hành': 'HOAN_THANH', 'đã tổ chức': 'HOAN_THANH', 'đã thực hiện': 'HOAN_THANH', 'đạt, hoàn thành': 'HOAN_THANH', 'không phát sinh': 'KHONG_PHAT_SINH' };
const ngayVN = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const ngayISO = (v) => { const s = chuan(v); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null; };
const so = (v) => { if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return v; const s = chuan(v).replace(/\./g, '').replace(',', '.'); return Number.isFinite(Number(s)) ? Number(s) : null; };

// Danh mục đang có (dòng v_nvq_nhiem_vu + v_nvq_san_pham) hoặc dòng nhập đã chuẩn bị (phu-luc.js) → hai sheet. tenNguoi(id), tenPhong(ma).
export function sheetMau({ dong = [], tenNguoi = () => '', tenPhong = (p) => p || '' } = {}) {
  const nv = dong.map((d) => [d.truc_so, d.nhom === 'NGOAI_CT' ? 2 : 1, d.stt, d.noi_dung, d.lanh_dao_text || '', d.don_vi_text || '', d.ket_qua_can_dat || '',
    d.tien_do_text || '', TINH_CHAT[d.tinh_chat] || '', d.chu_tri_theo_doi ? tenNguoi(d.chu_tri_theo_doi) : '', (d.phoi_hop_theo_doi || []).map(tenNguoi).join('; '),
    d.phong_theo_doi ? tenPhong(d.phong_theo_doi) : '', d.ket_qua_thuc_hien ?? d.cap_nhat_dau?.ket_qua_thuc_hien ?? '']);
  const sp = dong.flatMap((d) => (d.san_pham || []).map((s) => [d.truc_so, d.nhom === 'NGOAI_CT' ? 2 : 1, d.stt, s.thu_tu, s.mo_ta, LOAI_SP[s.loai] || '', s.han || '',
    s.han_text || '', CHI_TIEU_CO_BAN[s.chi_tieu_co_ban] || '', s.don_vi_tinh || '', s.muc_tieu ?? '', tenTrangThaiSp(s.loai, s.trang_thai || 'CHUA'),
    s.kq_so_ky_hieu || '', s.kq_ngay || '', s.kq_mo_ta || '']));
  return [
    { ten: SHEET_NV, cot: COT_NV.map((nhan, i) => ({ nhan, rong: RONG_NV[i] })), dong: nv },
    { ten: SHEET_SP, cot: COT_SP.map((nhan, i) => ({ nhan, rong: RONG_SP[i], kieu: i === 6 || i === 13 ? 'ngay' : undefined })), dong: sp },
    { ten: 'Hướng dẫn', cot: [{ nhan: 'Hướng dẫn điền', rong: 120 }], dong: HUONG_DAN.map((x) => [x]) },
  ];
}
const HUONG_DAN = [
  'Sheet "Nhiệm vụ": mỗi dòng một nhiệm vụ. Trục: số 1–6; Nhóm: 1 = theo chương trình, kế hoạch công tác, 2 = ngoài chương trình, kế hoạch; Stt: số thứ tự trong nhóm.',
  'Lãnh đạo phụ trách, Đơn vị tham mưu, chủ trì: ghi như văn bản (ví dụ "Bí thư Tỉnh ủy; Phó Bí thư Tỉnh ủy, Chủ tịch UBND tỉnh") — hệ thống tự nhận theo danh mục.',
  'Chủ trì theo dõi, Phối hợp theo dõi: họ tên cán bộ Văn phòng (phối hợp: nhiều người cách nhau dấu ";"); hoặc ghi Phòng theo dõi (ví dụ "Phòng Chuyển đổi số - Cơ yếu").',
  'Kết quả đã cập nhật: kết quả thực hiện đến thời điểm nhập (lần cập nhật đầu tiên). Để trống nếu chưa có.',
  'Sheet "Kết quả, sản phẩm": mỗi dòng một kết quả / sản phẩm của nhiệm vụ (khoá Trục, Nhóm, Stt). Loại: Văn bản / Chỉ tiêu / Hoạt động / Định kỳ / Khác. Mốc: ngày dd/mm/yyyy.',
  'Chỉ tiêu: ghi Đơn vị tính và Mục tiêu (số); 05 chỉ tiêu cơ bản chọn ở cột "Chỉ tiêu cơ bản". Trạng thái "Hoàn thành" của văn bản: ghi Số, ký hiệu và Ngày văn bản kết quả.',
  'Nhiệm vụ không có dòng ở sheet "Kết quả, sản phẩm": hệ thống tự tách từ cột "Kết quả/sản phẩm cần đạt được" và "Tiến độ" (xem trước khi nhập).',
  'Nhập lại tệp vào quý đã có: nhiệm vụ cùng Trục · Nhóm · Stt được cập nhật thông tin giao (giữ nguyên kết quả đã cập nhật); dòng mới được thêm.',
];

// Hai sheet đã đọc (docXlsx) → dòng nhập. ctx: { ky, dmLanhDao, dmDonVi, taiKhoan, tenPhong: { MA: [tên…] }, biDanh }.
export function dongTuMau(sheets, ctx = {}) {
  const tim = (ten) => sheets.find((s) => chuan(s.ten).toLowerCase() === chuan(ten).toLowerCase());
  const shNv = tim(SHEET_NV) || sheets.find((s) => !s.an);
  if (!shNv) return { dong: [], meta: [], canhBao: ['Tệp không có sheet "Nhiệm vụ".'] };
  const canhBao = []; const meta = [];
  const spTheo = new Map();
  (tim(SHEET_SP)?.dong || []).slice(1).forEach((h, i) => {
    if (!h || !chuan(h[4])) return;
    const k = `${so(h[0])}|${so(h[1])}|${so(h[2])}`;
    if (!spTheo.has(k)) spTheo.set(k, []);
    const loai = LOAI_NGUOC[chuan(h[5]).toLowerCase()] || 'VAN_BAN';
    const tt = TT_NGUOC[chuan(h[11]).toLowerCase()] || 'CHUA';
    const s = { thu_tu: so(h[3]) || spTheo.get(k).length + 1, mo_ta: chuan(h[4]), loai, han: ngayISO(h[6]) || ctx.ky?.den_ngay || null, han_text: chuan(h[7]) || null,
      chi_tieu_co_ban: CTCB_NGUOC[chuan(h[8]).toLowerCase()] || null, don_vi_tinh: chuan(h[9]) || null, muc_tieu: so(h[10]), trang_thai: tt,
      kq_so_ky_hieu: chuan(h[12]) || null, kq_ngay: ngayISO(h[13]), kq_mo_ta: chuan(h[14]) || null };
    if (s.chi_tieu_co_ban && s.muc_tieu === null) canhBao.push(`Sheet "${SHEET_SP}" dòng ${i + 2}: chỉ tiêu cơ bản cần ghi Mục tiêu.`);
    spTheo.get(k).push(s);
  });
  const dong = [];
  shNv.dong.slice(1).forEach((h, i) => {
    if (!h || !chuan(h[3])) return;
    const truc = so(h[0]); const nhomSo = so(h[1]); const stt = so(h[2]);
    if (!truc || ![1, 2].includes(nhomSo) || !stt) { canhBao.push(`Sheet "${SHEET_NV}" dòng ${i + 2}: thiếu Trục / Nhóm (1 hoặc 2) / Stt — bỏ qua.`); return; }
    const k = `${truc}|${nhomSo}|${stt}`;
    const tienDo = chuan(h[7]);
    const tach = tachSanPham(chuan(h[6]), tienDo, ctx.ky);
    const khop = [];
    const ten = [chuan(h[9]), ...chuan(h[10]).split(';')].map((x) => x.trim()).filter(Boolean);
    const ids = [];
    ten.forEach((t) => { const kq = khopTen(t, ctx.taiKhoan || [], { biDanh: ctx.biDanh }); khop.push({ ten: t, ...kq }); if (kq?.id && !ids.includes(kq.id)) ids.push(kq.id); });
    const phong = chuan(h[11]) ? phongTuTen(/^phòng/i.test(chuan(h[11])) ? chuan(h[11]) : `Phòng ${chuan(h[11])}`, ctx.tenPhong) : null;
    if (chuan(h[11]) && !phong) canhBao.push(`Dòng ${i + 2}: không nhận ra phòng "${chuan(h[11])}".`);
    khop.filter((x) => !x.id).forEach((x) => canhBao.push(`Dòng ${i + 2}: chưa khớp tên "${x.ten}" với tài khoản nào.`));
    const capNhat = chuan(h[12]);
    dong.push({
      truc_so: truc, nhom: nhomSo === 2 ? 'NGOAI_CT' : 'TRONG_CT', stt, noi_dung: chuan(h[3]), lanh_dao_text: chuan(h[4]) || null,
      lanh_dao_ma: nhanLanhDao(chuan(h[4]), ctx.dmLanhDao), don_vi_text: chuan(h[5]) || null, don_vi: nhanDonVi(chuan(h[5]), ctx.dmDonVi),
      ket_qua_can_dat: chuan(h[6]) || null, tien_do_text: tienDo || null, tinh_chat: TC_NGUOC[chuan(h[8]).toLowerCase()] || tinhChatTienDo(tienDo),
      chu_tri_theo_doi: ids[0] || null, phoi_hop_theo_doi: ids.slice(1), phong_theo_doi: phong,
      san_pham: spTheo.get(k) || tach.sanPham, cap_nhat_dau: capNhat ? { ket_qua_thuc_hien: capNhat, nguon_thong_tin: ctx.tenTep || null } : null,
      du_lieu_goc: { nguon: 'excel', dong: i + 2 },
    });
    meta.push({ khop, xong: false, kqDo: capNhat, tuTach: !spTheo.has(k) });
  });
  return { dong, meta, canhBao };
}
export const ngayHienThi = ngayVN;
