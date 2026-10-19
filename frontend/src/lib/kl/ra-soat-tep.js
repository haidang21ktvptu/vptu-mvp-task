// Rà soát phân loại bằng tệp Excel (v3.26, 0116 — ra_soat_phan_loai): phần THUẦN (không DOM, không mạng; unit test frontend/tests/phan-loai.test.mjs).
// (1) bangRaSoat: bảng xuất "Rà soát phân loại" (mã, nội dung, văn bản, chủ trì, tiến độ, ngành, lĩnh vực, mục tiêu, lý do) + sheet Danh mục có ô chọn;
// (2) docBangRaSoat: tìm sheet có hàng tiêu đề "Mã nhiệm vụ" + ít nhất một cột Ngành / Lĩnh vực / Mục tiêu then chốt (đọc được cả tệp "Xuất theo mẫu
// nhập"); (3) khopDong: giá trị → mã danh mục — ĐÚNG mã hoặc ĐÚNG tên (không dấu, không phân biệt hoa thường, bỏ số thứ tự đầu tên ngành), không đoán gần
// đúng, không dùng từ điển nhập Excel; ô trống = giữ nguyên. Lỗi của dòng nêu rõ giá trị không khớp; mã trùng trong tệp chỉ lấy dòng đầu.
import { KHONG_THUOC, LV_KHONG_THUOC, sapTheoDanhMuc, mucTieuCua } from './muc-tieu.js';
import { boSoThuTu, tenNhom } from './nhan.js';

export const TIEU_DE = { ma: 'Mã nhiệm vụ', nganh: 'Ngành', linhVuc: 'Lĩnh vực', mucTieu: 'Mục tiêu then chốt', lyDo: 'Lý do rà soát' };
export const TOI_DA_DONG = 200;   // một lượt gọi ra_soat_phan_loai
export const chuan = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const boSo = (s) => chuan(s).replace(/^\d{1,2}\s*[.)]\s*/, '');
const KHONG_NGANH = new Set(['khong thuoc', 'khong thuoc nganh, linh vuc nao', 'khong thuoc nganh nao', 'khong thuoc linh vuc nao', 'khong thuoc linh vuc trong tam']);
const KHONG_MT = new Set(['khong thuoc', 'khong thuoc muc tieu then chot', 'khong thuoc muc tieu then chot nao', 'khong']);

// ---- (1) Xuất ----
// rows: dòng v_nhiem_vu đã ghép mục tiêu; dm: danh mục (nganh, linhVuc, mucTieu, nhomMucTieu). → sheets cho taoXlsx.
export function bangRaSoat(rows, dm = {}) {
  const nganh = dm.nganh || []; const linhVuc = dm.linhVuc || []; const mucTieu = (dm.mucTieu || []).filter((m) => m.dang_dung !== false && !m.gop_vao);
  const tenMt = (ma) => mucTieu.find((m) => m.ma === ma)?.ten_ngan || (dm.mucTieu || []).find((m) => m.ma === ma)?.ten_ngan || ma;
  const vanBan = (r) => [r.so_ket_luan, r.ngay_ban_hanh ? r.ngay_ban_hanh.split('-').reverse().join('/') : ''].filter(Boolean).join(' ngày ');
  const cot = [{ nhan: TIEU_DE.ma, rong: 12 }, { nhan: 'Nội dung nhiệm vụ', rong: 70 }, { nhan: 'Văn bản', rong: 22 }, { nhan: 'Chủ trì', rong: 26 },
    { nhan: 'Tiến độ', rong: 16 }, { nhan: TIEU_DE.nganh, rong: 34 }, { nhan: TIEU_DE.linhVuc, rong: 28 }, { nhan: TIEU_DE.mucTieu, rong: 40 }, { nhan: TIEU_DE.lyDo, rong: 40 }];
  const dong = rows.map((r) => [r.ma, r.noi_dung || '', vanBan(r), r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || '', tenNhom(r.nhom_dem) || '',
    nganh.find((n) => n.ma === r.nganh_ma)?.ten || r.nganh_ten || '', linhVuc.find((l) => l.ma === r.linh_vuc_ma)?.ten || r.linh_vuc_ten || '',
    sapTheoDanhMuc(mucTieuCua(r), dm.mucTieu, dm.nhomMucTieu).map(tenMt).join('; '), '']);
  const dsNganh = nganh.map((n) => n.ten); const dsLv = linhVuc.map((l) => l.ten);
  const dsMt = sapTheoDanhMuc(mucTieu.map((m) => m.ma), dm.mucTieu, dm.nhomMucTieu).map(tenMt);
  const dai = Math.max(dsNganh.length, dsLv.length, dsMt.length);
  const kiemTra = [[5, 'A', dsNganh.length], [6, 'B', dsLv.length]].filter(([, , n]) => n)
    .map(([c, chu, n]) => ({ cot: c, nguon: `'Danh mục'!$${chu}$2:$${chu}$${n + 1}`, den: Math.max(1001, rows.length + 501) }));
  return [
    { ten: 'Rà soát phân loại', cot, dong, kiemTra },
    { ten: 'Danh mục', cot: [{ nhan: 'Ngành', rong: 60 }, { nhan: 'Lĩnh vực', rong: 46 }, { nhan: 'Mục tiêu then chốt (nhiều mục cách nhau bằng ;)', rong: 56 }],
      dong: Array.from({ length: dai }, (_, i) => [dsNganh[i] ?? null, dsLv[i] ?? null, dsMt[i] ?? null]) },
  ];
}

// ---- (2) Đọc ----
// sheets: docXlsx → [{ ten, an, dong }]. → { sheet, dong: [{ so (số dòng Excel), ma, nganh, linhVuc, mucTieu, lyDo }] } — giá trị thô (chuỗi).
export function docBangRaSoat(sheets = []) {
  const muon = Object.fromEntries(Object.entries(TIEU_DE).map(([k, v]) => [k, chuan(v)]));
  for (const s of sheets.filter((x) => !x.an)) {
    const dongs = s.dong || [];
    for (let h = 0; h < Math.min(dongs.length, 10); h++) {
      const td = (dongs[h] || []).map(chuan); const vt = (k) => td.indexOf(muon[k]);
      if (vt('ma') < 0 || !['nganh', 'linhVuc', 'mucTieu'].some((k) => vt(k) >= 0)) continue;
      const o = (d, k) => (vt(k) >= 0 ? String(d?.[vt(k)] ?? '').trim() : '');
      const dong = dongs.slice(h + 1).map((d, i) => ({ so: h + i + 2, ma: o(d, 'ma').toUpperCase(), nganh: o(d, 'nganh'), linhVuc: o(d, 'linhVuc'), mucTieu: o(d, 'mucTieu'), lyDo: o(d, 'lyDo') }))
        .filter((d) => d.ma || d.nganh || d.linhVuc || d.mucTieu);
      return { sheet: s.ten, coCot: { nganh: vt('nganh') >= 0, linhVuc: vt('linhVuc') >= 0, mucTieu: vt('mucTieu') >= 0 }, dong };
    }
  }
  throw new Error('Tệp không có bảng rà soát: cần hàng tiêu đề có cột "Mã nhiệm vụ" và ít nhất một cột "Ngành", "Lĩnh vực" hoặc "Mục tiêu then chốt".');
}

// ---- (3) Khớp ----
export function timNganh(v, nganh = []) {
  const c = boSo(v); if (!c) return null;
  if (KHONG_NGANH.has(c)) return nganh.find((n) => n.ma === KHONG_THUOC)?.ma || null;
  return (nganh.find((n) => n.ma.toLowerCase() === chuan(v)) || nganh.find((n) => boSo(n.ten) === c))?.ma || null;
}
export function timLinhVuc(v, linhVuc = [], nganhMa = null) {
  const c = chuan(v); if (!c) return null;
  if (KHONG_NGANH.has(c)) return linhVuc.find((l) => l.ma === LV_KHONG_THUOC)?.ma || null;
  const theoMa = linhVuc.find((l) => l.ma.toLowerCase() === c); if (theoMa) return theoMa.ma;
  const ds = linhVuc.filter((l) => chuan(l.ten) === c);
  return (nganhMa ? ds.find((l) => l.nganh_ma === nganhMa) : null)?.ma || (ds.length === 1 ? ds[0].ma : null);
}
export function timMucTieuTen(v, mucTieu = []) {
  const c = chuan(v); if (!c) return null;
  if (KHONG_MT.has(c)) return mucTieu.some((m) => m.ma === KHONG_THUOC) ? KHONG_THUOC : null;
  return (mucTieu.find((m) => m.ma.toLowerCase() === c) || mucTieu.find((m) => chuan(m.ten_ngan) === c) || mucTieu.find((m) => chuan(m.ten) === c)
    || mucTieu.find((m) => m.so_hieu && chuan(m.so_hieu) === c))?.ma || null;
}
// d: một dòng docBangRaSoat; dm: danh mục. → { so, ma, nganh, linh_vuc, muc_tieu (mảng | null = giữ), ly_do, loi: [chữ] }.
export function khopDong(d, dm = {}) {
  const loi = []; const nganh = dm.nganh || []; const linhVuc = dm.linhVuc || [];
  let ng = null; let lv = null; let mt = null;
  if (!d.ma) loi.push('thiếu mã nhiệm vụ');
  if (d.nganh) { ng = timNganh(d.nganh, nganh); if (!ng) loi.push(`ngành "${d.nganh}" không có trong danh mục`); }
  if (d.linhVuc) {
    lv = timLinhVuc(d.linhVuc, linhVuc, ng);
    if (!lv) loi.push(`lĩnh vực "${d.linhVuc}" không có trong danh mục${ng ? ' của ngành đã ghi' : ''}`);
    else if (ng && linhVuc.find((l) => l.ma === lv)?.nganh_ma !== ng) loi.push(`lĩnh vực "${d.linhVuc}" không thuộc ngành "${d.nganh}"`);
    else if (!ng && !d.nganh) ng = linhVuc.find((l) => l.ma === lv)?.nganh_ma || null;   // chỉ ghi lĩnh vực: ngành theo lĩnh vực
  }
  if (d.mucTieu) {
    const phan = d.mucTieu.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    const ma = phan.map((x) => [x, timMucTieuTen(x, dm.mucTieu || [])]);
    ma.filter(([, m]) => !m).forEach(([x]) => loi.push(`mục tiêu "${x}" không có trong danh mục`));
    mt = [...new Set(ma.map(([, m]) => m).filter(Boolean))];
    if (mt.includes(KHONG_THUOC) && mt.length > 1) loi.push('"Không thuộc mục tiêu then chốt" không ghi cùng mục tiêu khác');
    if (mt.length > 10) loi.push('tối đa 10 mục tiêu then chốt');
  }
  return { so: d.so, ma: d.ma, nganh: ng, linh_vuc: lv, muc_tieu: mt && mt.length ? mt : null, ly_do: d.lyDo ? d.lyDo.slice(0, 300) : null, loi };
}
// Cả bảng → { gui: [dòng gửi DB], loi: [dòng lỗi phía tệp], trung: số dòng trùng mã bỏ qua }.
export function khopBang(ds = [], dm = {}) {
  const daCo = new Map(); const gui = []; const loi = []; let trung = 0;
  ds.forEach((d) => {
    const k = khopDong(d, dm);
    if (k.ma && daCo.has(k.ma)) { trung += 1; loi.push({ ...k, loi: [`mã trùng với dòng ${daCo.get(k.ma)} — chỉ lấy dòng đầu`] }); return; }
    if (k.ma) daCo.set(k.ma, d.so);
    if (k.loi.length) { loi.push(k); return; }
    if (!k.nganh && !k.linh_vuc && !k.muc_tieu) return;   // dòng không ghi gì để rà soát
    gui.push(k);
  });
  return { gui, loi, trung };
}
// Tham số một dòng cho ra_soat_phan_loai (0116).
export const thamSo = (k) => ({ ma: k.ma, nganh: k.nganh || '', linh_vuc: k.linh_vuc || '', muc_tieu: k.muc_tieu || [], ly_do: k.ly_do || '' });
// Tóm tắt kết quả xem trước / áp dụng (mảng trả về của ra_soat_phan_loai).
export function tomTat(kq = []) {
  const doi = kq.filter((x) => x.ket_qua === 'DOI');
  return { doi: doi.length, giu: kq.filter((x) => x.ket_qua === 'GIU').length, loi: kq.filter((x) => x.ket_qua === 'LOI').length,
    canhBao: doi.filter((x) => x.canh_bao).length, nganh: doi.filter((x) => (x.doi || []).some((c) => c !== 'muc_tieu')).length,
    mucTieu: doi.filter((x) => (x.doi || []).includes('muc_tieu')).length, daXong: doi.filter((x) => x.da_xong).length };
}
