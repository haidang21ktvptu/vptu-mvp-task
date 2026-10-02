// Số liệu màn hình Tổng quan (giao diện v9, A0/A1/A2) — thuần tổng hợp trên các dòng v_nhiem_vu mà RLS đã trả về (DB-5: trạng thái từng dòng
// do DB tính; ở đây chỉ lọc theo kỳ, đếm và nhóm). Không DOM, không Supabase; unit test ở frontend/tests/tong-quan.test.mjs.
// Quy ước kỳ: "giao trong kỳ" theo ngày nhận văn bản (hoặc ngày ban hành, ngày tạo); "hoàn thành trong kỳ" theo ngày hoàn thành; việc đang mở
// và cảnh báo luôn là hiện tại. Tỷ lệ đúng hạn = việc hoàn thành trong kỳ có kết quả Đúng hạn / việc hoàn thành trong kỳ đã được đánh giá.
import { nhomCua, boSoThuTu } from './nhan.js';
import { homNayVN, soNgay } from './ngay.js';

const SO_LA_MA = ['I', 'II', 'III', 'IV'];
const pad = (n) => String(n).padStart(2, '0');
const cuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Khoảng ngày của kỳ ('thang' | 'quy' | 'nam') chứa hôm nay + nhãn nút và cụm "trong …" cho phụ đề.
export function khoangKy(ky, homNay) {
  const [y, m] = homNay.split('-').map(Number);
  if (ky === 'thang') return { ky, tu: `${y}-${pad(m)}-01`, den: `${y}-${pad(m)}-${pad(cuoiThang(y, m))}`, ten: `Tháng ${m}`, trong: `trong tháng ${m}` };
  if (ky === 'quy') {
    const q = Math.ceil(m / 3); const m1 = q * 3 - 2; const m3 = q * 3;
    return { ky, tu: `${y}-${pad(m1)}-01`, den: `${y}-${pad(m3)}-${pad(cuoiThang(y, m3))}`, ten: `Quý ${SO_LA_MA[q - 1]}`, trong: `trong quý ${SO_LA_MA[q - 1]}` };
  }
  return { ky: 'nam', tu: `${y}-01-01`, den: `${y}-12-31`, ten: `Năm ${y}`, trong: `từ đầu năm ${y}` };
}

const ngayCua = (ts) => (ts ? homNayVN(new Date(ts)) : null);
export const ngayGiao = (r) => r.ngay_nhan_van_ban || r.ngay_ban_hanh || ngayCua(r.created_at);
const trong = (d, k) => Boolean(d) && d >= k.tu && d <= k.den;
export const laXong = (r) => r.nhom_dem === 'HOAN_THANH';
export const laMo = (r) => !laXong(r) && nhomCua(r.nhom_dem).mo;
export const xongTrongKy = (r, k) => laXong(r) && trong(r.ngay_hoan_thanh, k);
const coDanhGia = (r) => r.ket_qua === 'DUNG_HAN' || r.ket_qua === 'TRE';
const tyLe = (a, b) => (b ? Math.round((a / b) * 100) : null);

// Mức của một việc ĐANG MỞ (một nhóm duy nhất, để các phần cộng đủ tổng): Đỏ đặc biệt → Đỏ → Vàng → chờ nghiệm thu → trong hạn (Xanh);
// còn lại là "khác" — DB không áp mức cảnh báo (KHONG_AP_DUNG: cần điền hạn, chờ điều kiện, đang đính chính), không tính là trong hạn.
export function mucMo(r) {
  if (r.muc_canh_bao === 'DO_DAC_BIET') return 'ddb';
  if (r.muc_canh_bao === 'DO') return 'do';
  if (r.muc_canh_bao === 'VANG') return 'vang';
  if (r.nhom_dem === 'CHO_NGHIEM_THU' || r.nhom_dem === 'QUA_HAN_NGHIEM_THU') return 'nt';
  return r.muc_canh_bao === 'XANH' ? 'trongHan' : 'khac';
}
const demMo = (mo) => mo.reduce((d, r) => { d[mucMo(r)]++; return d; }, { trongHan: 0, nt: 0, khac: 0, vang: 0, do: 0, ddb: 0 });

// Dải đầu trang + cơ cấu trạng thái.
export function soLieuChinh(rows, k) {
  const xong = rows.filter((r) => xongTrongKy(r, k)); const dg = xong.filter(coDanhGia);
  const dung = dg.filter((r) => r.ket_qua === 'DUNG_HAN').length;
  const mo = rows.filter(laMo); const m = demMo(mo);
  return {
    giao: rows.filter((r) => trong(ngayGiao(r), k)).length, xong: xong.length, dungHan: dung, tre: dg.length - dung, chuaDanhGia: xong.length - dg.length,
    tyLeDungHan: tyLe(dung, dg.length), dangMo: mo.length, mo: m, canhBao: m.vang + m.do + m.ddb,
  };
}

// Giao mới / hoàn thành / tỷ lệ đúng hạn từng tháng của năm chứa hôm nay, tới tháng hiện tại.
export function theoThang(rows, homNay) {
  const [y, mHienTai] = homNay.split('-').map(Number);
  return Array.from({ length: mHienTai }, (_, i) => {
    const k = { tu: `${y}-${pad(i + 1)}-01`, den: `${y}-${pad(i + 1)}-${pad(cuoiThang(y, i + 1))}` };
    const xong = rows.filter((r) => xongTrongKy(r, k)); const dg = xong.filter(coDanhGia);
    return { thang: i + 1, giao: rows.filter((r) => trong(ngayGiao(r), k)).length, xong: xong.length, tyLe: tyLe(dg.filter((r) => r.ket_qua === 'DUNG_HAN').length, dg.length) };
  });
}

// Cách gom theo vai: A0 theo đơn vị chủ trì (mọi việc trong Văn phòng gộp một dòng), A1 theo phòng, A2 theo cán bộ chủ trì — việc phòng chủ
// trì chưa giao cán bộ gom một dòng; việc đơn vị khác chủ trì (phòng chỉ theo dõi) gom theo đơn vị đó.
export function khoaNhom(vai, tenPhong = {}, phongToi = null) {
  if (vai === 'A0') return (r) => (r.owner_trong_van_phong ? ['VAN_PHONG', 'Văn phòng Tỉnh ủy', null] : [r.owner_don_vi_ma || '', boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định', r.owner_don_vi_ma || '']);
  if (vai === 'A2') {
    return (r) => (r.owner_tai_khoan ? [r.owner_tai_khoan, r.owner_tai_khoan_ten || 'Cán bộ', null]
      : r.owner_phong && r.owner_phong === phongToi ? ['PHONG', 'Phòng, chưa giao cán bộ', null]
        : [`DV:${r.owner_don_vi_ma || ''}`, boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định', null]);
  }
  return (r) => {
    const ma = r.owner_trong_van_phong && r.owner_phong ? r.owner_phong : r.owner_don_vi_ma || '';
    return [ma, tenPhong[r.owner_phong] || boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định', r.owner_don_vi_ma || ''];
  };
}
// Bảng theo nhóm: việc xong trong kỳ, đang mở, cảnh báo theo mức, tỷ lệ đúng hạn; nhóm có việc Đỏ lên trước, rồi nhiều việc trước.
export function theoNhom(rows, k, khoa) {
  const m = new Map();
  rows.forEach((r) => {
    const [ma, ten, donVi] = khoa(r);
    if (!m.has(ma)) m.set(ma, { ma, ten, donVi, rows: [] });
    m.get(ma).rows.push(r);
  });
  return [...m.values()].map((g) => {
    const s = soLieuChinh(g.rows, k);
    return { ma: g.ma, ten: g.ten, donVi: g.donVi, tong: g.rows.length, xong: s.xong, dangMo: s.dangMo, vang: s.mo.vang, do: s.mo.do, ddb: s.mo.ddb, tyLe: s.tyLeDungHan };
  }).filter((g) => g.dangMo + g.xong > 0)
    .sort((a, b) => b.ddb - a.ddb || b.do - a.do || b.vang - a.vang || (b.dangMo + b.xong) - (a.dangMo + a.xong) || a.ten.localeCompare(b.ten, 'vi'));
}

// Tiến độ theo văn bản giao việc: đã hoàn thành / tổng, số việc Đỏ đang mở; văn bản có việc Đỏ lên trước, rồi mới ban hành trước.
export function theoVanBan(rows, n = 5) {
  const m = new Map();
  rows.forEach((r) => {
    if (!r.van_ban_id) return;
    if (!m.has(r.van_ban_id)) m.set(r.van_ban_id, { id: r.van_ban_id, soHieu: r.so_ket_luan || '', loai: r.van_ban_loai, ngay: r.ngay_ban_hanh, tong: 0, xong: 0, do: 0 });
    const v = m.get(r.van_ban_id); v.tong++;
    if (laXong(r)) v.xong++;
    else if (laMo(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao)) v.do++;
  });
  return [...m.values()].sort((a, b) => b.do - a.do || (b.ngay || '').localeCompare(a.ngay || '') || b.tong - a.tong).slice(0, n);
}

// Việc đang mở theo lĩnh vực (lĩnh vực trống gom "Chưa phân loại"), nhiều việc trước.
export function theoLinhVuc(rows, n = 7) {
  const m = new Map();
  rows.filter(laMo).forEach((r) => {
    const ma = r.linh_vuc_ma || 'CHUA_PHAN_LOAI';
    if (!m.has(ma)) m.set(ma, { ma, ten: r.linh_vuc_ten || 'Chưa phân loại', so: 0 });
    m.get(ma).so++;
  });
  return [...m.values()].sort((a, b) => b.so - a.so || a.ten.localeCompare(b.ten, 'vi')).slice(0, n);
}

// Chất lượng nghiệm thu của việc hoàn thành trong kỳ (PR-3: KHONG_DAT / DAT / DAT_TOT / DAT_XUAT_SAC; việc cũ chưa đánh giá) + số lượt trả lại.
export function chatLuongKy(rows, k) {
  const xong = rows.filter((r) => xongTrongKy(r, k));
  const dem = (c) => xong.filter((r) => r.chat_luong === c).length;
  const d = { xuatSac: dem('DAT_XUAT_SAC'), tot: dem('DAT_TOT'), dat: dem('DAT'), khongDat: dem('KHONG_DAT') };
  const coDg = d.xuatSac + d.tot + d.dat + d.khongDat;
  return { ...d, coDanhGia: coDg, chuaDanhGia: xong.length - coDg, tyLeTot: tyLe(d.xuatSac + d.tot, coDg), traLai: xong.reduce((s, r) => s + (r.so_lan_tra_lai || 0), 0) };
}

// Chỉ đạo gốc (không tính phản hồi) gửi trong kỳ, của người gửi thuộc phạm vi vai: A0 = chỉ đạo Thường trực; A1 = lãnh đạo Văn phòng;
// A2 = chính Trưởng phòng. Đúng hạn = phản hồi không muộn hơn hạn phản hồi (trên số đã phản hồi có hạn); thời gian trung bình tính theo ngày.
// chiDaoPhan: các tập chỉ đạo (banHanh / daPhanHoi / dangCho / quaHan) — Tổng quan bấm số → danh sách việc của đúng tập đó.
export function chiDaoPhan(cds, k, { vai, me, laLanhDaoVP = () => false }, now = new Date()) {
  const cuaVai = (c) => (vai === 'A0' ? c.loai === 'CHI_DAO_TT' : vai === 'A2' ? c.nguoi_gui === me : c.loai !== 'CHI_DAO_TT' && laLanhDaoVP(c.nguoi_gui));
  const banHanh = cds.filter((c) => c.loai !== 'PHAN_HOI' && !c.tra_loi_cho && cuaVai(c) && trong(ngayCua(c.created_at), k));
  const dangCho = banHanh.filter((c) => !c.phan_hoi_luc && c.trang_thai === 'CHO_PHAN_HOI');
  const homNay = homNayVN(now);
  return { banHanh, daPhanHoi: banHanh.filter((c) => c.phan_hoi_luc), dangCho,
    quaHan: dangCho.filter((c) => c.han_phan_hoi && soNgay(String(c.han_phan_hoi).slice(0, 10), homNay) > 0) };
}
export function chiDaoKy(cds, k, ctx, now = new Date()) {
  const p = chiDaoPhan(cds, k, ctx, now); const daPh = p.daPhanHoi;
  const coHan = daPh.filter((c) => c.han_phan_hoi);
  const dung = coHan.filter((c) => ngayCua(c.phan_hoi_luc) <= String(c.han_phan_hoi).slice(0, 10)).length;
  const tb = daPh.length ? daPh.reduce((s, c) => s + Math.max(0, (Date.parse(c.phan_hoi_luc) - Date.parse(c.created_at)) / 86400000), 0) / daPh.length : null;
  return {
    banHanh: p.banHanh.length, daPhanHoi: daPh.length, dangCho: p.dangCho.length, quaHan: p.quaHan.length,
    tyLeDungHan: tyLe(dung, coHan.length), tbNgay: tb === null ? null : Math.round(tb * 10) / 10,
  };
}

// Dải cảnh báo: việc Đỏ / Đỏ đặc biệt đang mở và tối đa 3 người / đơn vị chủ trì (nhiều việc Đỏ trước).
export function canhBaoDo(rows) {
  const ds = rows.filter((r) => laMo(r) && ['DO', 'DO_DAC_BIET'].includes(r.muc_canh_bao));
  const dem = new Map();
  ds.forEach((r) => { const ten = r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định'; dem.set(ten, (dem.get(ten) || 0) + 1); });
  return { ddb: ds.filter((r) => r.muc_canh_bao === 'DO_DAC_BIET').length, do: ds.filter((r) => r.muc_canh_bao === 'DO').length,
    nguoi: [...dem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi')).slice(0, 3).map(([ten]) => ten) };
}
