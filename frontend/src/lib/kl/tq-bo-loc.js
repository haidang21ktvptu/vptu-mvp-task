// Bộ lọc chi tiết của Tổng quan (v3.24 — thanh lọc bám đầu trang được duyệt 16/10/2026): 5 lọc nhanh + 12 ô (mục tiêu then chốt, khối lĩnh vực,
// ngành / lĩnh vực, văn bản chỉ đạo, đơn vị chịu trách nhiệm, đồng chí Thường trực chỉ đạo, lãnh đạo VP phụ trách / phòng / cán bộ, trạng thái, mức
// quan trọng, độ khẩn, nguồn nhiệm vụ, kỳ tuỳ chọn). Thuần (không DOM): điều kiện của các khoá mới (tong-quan-them.js locTongQuan gọi khopLocMoi),
// lựa chọn từng ô (đếm trên toàn bộ dòng), chip "Đang áp dụng". Khoá ghép: nganh 'N:<ngành>' | 'L:<lĩnh vực>' | 'CHUA'; nguoi 'LD:<id>' | 'LD:CHUA' |
// 'P:<phòng>' | 'P:NGOAI' | 'CB:<id>'.
import { laXong, laMo, mucMo } from './tong-quan.js';
import { khopMucTieu, nhanLocMucTieu, mucTieuCua, NHOM_MUC_TIEU, CHUA_GAN, khoiCuaNganh } from './muc-tieu.js';
import { khoaXepHang } from './tong-quan-lanh-dao.js';
import { boSoThuTu } from './nhan.js';

export const NHANH = [['tt', 'Việc Thường trực giao'], ['dp', 'Nhiệm vụ đột phá'], ['qh30', 'Quá hạn trên 30 ngày'], ['hk', 'Hỏa tốc, thượng khẩn'], ['vm', 'Vướng mắc chờ ý kiến']];
const KHOP_NHANH = {
  tt: (r) => r.uu_tien === 'THUONG_TRUC',
  dp: (r, c) => khopMucTieu(r, 'NHOM:DOT_PHA', c.mucTieuDm),
  qh30: (r) => laMo(r) && ['do', 'ddb'].includes(mucMo(r)) && (r.so_ngay_qua || 0) > 30,
  hk: (r) => ['HOA_TOC', 'THUONG_KHAN'].includes(r.do_khan),
  vm: (r) => laMo(r) && Boolean(r.vuong_mac),
};
export const dsNhanh = (loc) => String(loc?.nhanh || '').split(',').filter((k) => KHOP_NHANH[k]);
export function doiNhanh(loc, k) {
  const s = new Set(dsNhanh(loc)); if (s.has(k)) s.delete(k); else s.add(k);
  return { ...loc, nhanh: NHANH.map(([x]) => x).filter((x) => s.has(x)).join(',') };
}

export const TRANG_THAI = [['dung', 'Hoàn thành đúng hạn'], ['cham', 'Hoàn thành chậm'], ['cdg', 'Hoàn thành, chưa đánh giá'], ['th', 'Đang thực hiện trong hạn'],
  ['vang', 'Sắp đến hạn (Vàng)'], ['qh', 'Quá hạn (Đỏ, Đỏ đặc biệt)'], ['ch', 'Chưa có hạn, thường xuyên, chờ điều kiện']];
export const trangThaiCua = (r) => (laXong(r) ? (r.ket_qua === 'DUNG_HAN' ? 'dung' : r.ket_qua === 'TRE' ? 'cham' : 'cdg')
  : !laMo(r) ? 'ch' : ({ vang: 'vang', do: 'qh', ddb: 'qh', khac: 'ch' }[mucMo(r)] || 'th'));
export const MUC_QT = [['A', 'Mức A'], ['B', 'Mức B'], ['C', 'Mức C'], ['CHUA', 'Chưa xếp mức']];

// Điều kiện của các khoá mới (khoá cũ phamVi / loai / phong / canBo / doKhan / ldvp ở locTongQuan). c: { mucTieuDm, nganhDm, laLdvp(r, id) }.
export function khopLocMoi(r, l, c = {}) {
  if (dsNhanh(l).some((k) => !KHOP_NHANH[k](r, c))) return false;
  if (l.mucTieu && !khopMucTieu(r, l.mucTieu, c.mucTieuDm)) return false;
  if (l.khoi && (khoiCuaNganh(c.nganhDm, r.nganh_ma) || 'CHUA') !== l.khoi) return false;
  if (l.nganh && !(l.nganh === 'CHUA' ? !r.nganh_ma : l.nganh.startsWith('N:') ? r.nganh_ma === l.nganh.slice(2) : r.linh_vuc_ma === l.nganh.slice(2))) return false;
  if (l.coQuan && khoaXepHang('dv')(r)[0] !== l.coQuan) return false;
  if (l.thuongTruc && khoaXepHang('tt')(r)[0] !== l.thuongTruc) return false;
  if (l.trangThai && trangThaiCua(r) !== l.trangThai) return false;
  if (l.mucQT && (r.muc_quan_trong || 'CHUA') !== l.mucQT) return false;
  if (l.nguon && (r.nguon_nhiem_vu_ma || 'CHUA') !== l.nguon) return false;
  if (l.nguoi) {
    const [p, v] = [l.nguoi.slice(0, l.nguoi.indexOf(':')), l.nguoi.slice(l.nguoi.indexOf(':') + 1)];
    if (p === 'CB' && r.owner_tai_khoan !== v) return false;
    if (p === 'P' && !(v === 'NGOAI' ? !r.owner_trong_van_phong : r.owner_trong_van_phong && r.owner_phong === v)) return false;
    if (p === 'LD' && !(c.laLdvp ? c.laLdvp(r, v) : true)) return false;
  }
  return true;
}

// Lựa chọn của các ô mới, đếm trên TOÀN BỘ dòng (người xem thấy đủ); chỉ giá trị có trong dữ liệu (mục tiêu: nhóm + từng mục tiêu có việc).
const dem = (rows, khoa) => { const m = new Map(); rows.forEach((r) => [].concat(khoa(r)).forEach((k) => { if (k) m.set(k, (m.get(k) || 0) + 1); })); return m; };
// Mục tiêu then chốt: theo nhóm (dòng "Mọi … " của nhóm + từng mục tiêu có việc) và "Chưa gắn" — dùng chung với danh sách Nhiệm vụ.
export function tuyChonMucTieu(rows, mucTieuDm = []) {
  const mt = dem(rows, mucTieuCua); const chuaMt = rows.filter((r) => !mucTieuCua(r).length).length;
  return NHOM_MUC_TIEU.map((n) => {
    const ds = mucTieuDm.filter((m) => m.nhom === n.ma && mt.has(m.ma)).map((m) => ({ ma: m.ma, ten: m.ten_ngan, n: mt.get(m.ma) }));
    const tong = rows.filter((r) => khopMucTieu(r, `NHOM:${n.ma}`, mucTieuDm)).length;
    return { nhom: n.ten, ds: ds.length ? [{ ma: `NHOM:${n.ma}`, ten: n.moi, n: tong }, ...ds] : [] };
  }).filter((g) => g.ds.length).concat(chuaMt ? [{ nhom: '', ds: [{ ma: CHUA_GAN, ten: 'Chưa gắn mục tiêu then chốt', n: chuaMt }] }] : []);
}
export function tuyChonLocMoi(rows, { mucTieuDm = [], khoiDm = [], nganhDm = [], linhVucDm = [], nguonDm = [] } = {}) {
  const mucTieu = tuyChonMucTieu(rows, mucTieuDm);
  const kh = dem(rows, (r) => khoiCuaNganh(nganhDm, r.nganh_ma) || 'CHUA');
  const khoi = [...khoiDm.filter((k) => kh.has(k.ma)).map((k) => ({ ma: k.ma, ten: k.ten, n: kh.get(k.ma) })), ...(kh.has('CHUA') ? [{ ma: 'CHUA', ten: 'Chưa phân ngành', n: kh.get('CHUA') }] : [])];
  const ng = dem(rows, (r) => r.nganh_ma); const lv = dem(rows, (r) => r.linh_vuc_ma);
  const nganh = nganhDm.filter((n) => ng.has(n.ma)).map((n) => ({ nhom: n.ten, ds: [{ ma: `N:${n.ma}`, ten: `Cả ngành (${boSoThuTu(n.ten)})`, n: ng.get(n.ma) },
    ...linhVucDm.filter((l) => l.nganh_ma === n.ma && lv.has(l.ma)).map((l) => ({ ma: `L:${l.ma}`, ten: l.ten, n: lv.get(l.ma) }))] }));
  if (rows.some((r) => !r.nganh_ma)) nganh.push({ nhom: '', ds: [{ ma: 'CHUA', ten: 'Chưa có ngành', n: rows.filter((r) => !r.nganh_ma).length }] });
  const nhom = (cach) => { const m = new Map(); rows.forEach((r) => { const [ma, ten] = khoaXepHang(cach)(r); if (!m.has(ma)) m.set(ma, { ma, ten, n: 0 }); m.get(ma).n++; }); return [...m.values()]; };
  const coQuan = nhom('dv').sort((a, b) => (a.ma === 'VP') - (b.ma === 'VP') || a.ten.localeCompare(b.ten, 'vi'));
  const thuongTruc = nhom('tt').sort((a, b) => (a.ma === 'KHONG') - (b.ma === 'KHONG') || a.ten.localeCompare(b.ten, 'vi'));
  const tt = dem(rows, trangThaiCua); const qt = dem(rows, (r) => r.muc_quan_trong || 'CHUA'); const ngu = dem(rows, (r) => r.nguon_nhiem_vu_ma || 'CHUA');
  return {
    mucTieu, khoi, nganh, coQuan, thuongTruc,
    trangThai: TRANG_THAI.filter(([ma]) => tt.has(ma)).map(([ma, ten]) => ({ ma, ten, n: tt.get(ma) })),
    mucQT: MUC_QT.filter(([ma]) => qt.has(ma)).map(([ma, ten]) => ({ ma, ten, n: qt.get(ma) })),
    nguon: [...ngu.keys()].map((ma) => ({ ma, ten: ma === 'CHUA' ? 'Chưa xác định nguồn' : nguonDm.find((x) => x.ma === ma)?.ten || rows.find((r) => r.nguon_nhiem_vu_ma === ma)?.nguon_nhiem_vu_ten || ma, n: ngu.get(ma) }))
      .sort((a, b) => (a.ma === 'CHUA') - (b.ma === 'CHUA') || b.n - a.n),
  };
}

// Chip "Đang áp dụng": { k, v?, ten } — bấm ✕ bỏ đúng điều kiện đó. tc: tuyChonLoc (cũ + mới), dm: { mucTieuDm }, nhan: { phamVi, loai(ma) }.
export function chipLoc(loc, tc, { mucTieuDm = [], phamViNhan = 'Việc tôi theo dõi hoặc giao', tenLoai = (m) => m, tenDoKhan = (m) => m } = {}) {
  const ten = (ds, ma) => (ds || []).flatMap((x) => x.ds || [x]).find((o) => o.ma === ma)?.ten || ma;
  const nguoi = () => { const [p, ...v] = loc.nguoi.split(':'); const ma = v.join(':'); return p === 'LD' ? (ma === 'CHUA' ? 'Chưa có lãnh đạo phụ trách' : ten(tc.ldvp, ma)) : p === 'P' ? ten(tc.phong, ma) : ten(tc.canBo, ma); };
  const c = [];
  if (loc.phamVi) c.push({ k: 'phamVi', ten: phamViNhan });
  dsNhanh(loc).forEach((k) => c.push({ k: 'nhanh', v: k, ten: NHANH.find(([x]) => x === k)[1] }));
  const them = (k, nhan, gt) => { if (loc[k]) c.push({ k, ten: `${nhan}: ${gt}` }); };
  them('mucTieu', 'Mục tiêu', nhanLocMucTieu(loc.mucTieu, mucTieuDm)); them('khoi', 'Khối', ten(tc.khoi, loc.khoi));
  them('nganh', 'Ngành, lĩnh vực', ten(tc.nganh, loc.nganh)); them('loai', 'Văn bản', tenLoai(loc.loai));
  them('coQuan', 'Đơn vị', ten(tc.coQuan, loc.coQuan)); them('thuongTruc', 'Thường trực chỉ đạo', ten(tc.thuongTruc, loc.thuongTruc));
  if (loc.nguoi) c.push({ k: 'nguoi', ten: nguoi() });
  them('trangThai', 'Trạng thái', ten(tc.trangThai, loc.trangThai)); them('mucQT', 'Mức', ten(tc.mucQT, loc.mucQT));
  them('doKhan', 'Độ khẩn', tenDoKhan(loc.doKhan)); them('nguon', 'Nguồn', ten(tc.nguon, loc.nguon));
  ['phong', 'canBo', 'ldvp'].forEach((k) => { if (loc[k]) c.push({ k, ten: ten(tc[k], loc[k]) }); });   // khoá cũ (chưa dùng ở thanh lọc mới)
  return c;
}
