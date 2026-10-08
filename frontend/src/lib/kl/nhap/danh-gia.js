// Đánh giá từng dòng nhập Excel theo chuẩn 3 mức (v9 đợt 2): ô trống lấy lần lượt từ điền hàng loạt → quy tắc mặc định → (còn thiếu) vùng chờ
// hoàn thiện; cấp dưới tự bổ sung phần thực hiện khi nhận việc (nhập theo tầng, 0070). Ngành ↔ lĩnh vực suy ra nhau khi xác định được (lĩnh vực
// thuộc đúng một ngành; ngành chỉ có một lĩnh vực). Kết quả dự kiến của dòng (DB là chốt khi nhập):
//   CAP_NHAT  — có mã việc đã có trên hệ thống (chỉ ô có giá trị trong tệp; KHÔNG mặc định, không điền hàng loạt — tránh ghi đè dữ liệu đang có);
//   DA_XONG   — tiến độ Hoàn thành + lô chọn "Đã xong ngoài hệ thống" (cần văn bản, nội dung, người theo dõi);
//   CHO_NGHIEM_THU — Hoàn thành + "Ghi minh chứng" + đủ 4 yếu tố minh chứng (0093: hoàn thành theo minh chứng ngay); GIAO — còn lại, đủ mức 1; CHO_HOAN_THIEN — thiếu mức 1.
// Thuần (không DOM, không mạng): dữ liệu vào là dòng đã chuẩn hoá { k: {ma, hien, gan} | {loi} | null } (chuan-hoa.js).
import { nhanTruong } from './truong.js';
import { tachThayMat } from '../thay-mat.js';

const NGUON_THEO_LOAI = { KL_BTV: 'VAN_BAN_CAN_THEO_DOI', TB_THUONG_TRUC: 'VAN_BAN_CAN_THEO_DOI', NQ_TW: 'VAN_BAN_CAN_THEO_DOI', KL_BCH: 'VAN_BAN_CAN_THEO_DOI',
  NQ_BCH: 'VAN_BAN_CAN_THEO_DOI', CONG_VAN: 'NHIEM_VU_PHAT_SINH', KHAC: 'NHIEM_VU_PHAT_SINH' };   // 0087: hai loại Ban Chấp hành
const CAN_NGANH = new Set(['KL_BTV', 'TB_THUONG_TRUC']);
export const LOAI_HAN_MOI = new Set(['CO_HAN_CU_THE', 'KY_BAN_HANH']);   // việc mới (giao_viec) chỉ nhận hai loại hạn này
export const du4YeuTo = (g) => ['kq_so_hieu', 'kq_ngay', 'kq_trich_yeu', 'kq_mo_ta'].every((k) => g[k]);

// Loại văn bản khi tệp không có cột: có số hội nghị → Kết luận BTV (như bảng Phụ lục 2); số hiệu có TB / NQ / CV → loại tương ứng; còn lại Khác.
export function doanLoaiVanBan(soHn, soKl) {
  if (soHn) return 'KL_BTV';
  const s = String(soKl || '').toUpperCase();
  if (/\bTB\b|-TB\//.test(s)) return 'TB_THUONG_TRUC';
  if (/\bNQ\b|-NQ\//.test(s)) return 'NQ_TW';
  if (/\bCV\b|-CV\b|\/CV/.test(s)) return 'CONG_VAN';
  return 'KHAC';
}

// Đơn vị của một cán bộ (phòng → dòng dm_don_vi có phong; lãnh đạo Văn phòng → Văn phòng Tỉnh ủy).
export const donViCuaCanBo = (a, dm) => (!a ? null : dm.donVi.find((d) => d.phong && d.phong === a.department)?.ma || (a.role_group === 'A1' ? 'VAN_PHONG_TINH_UY' : null));
// Lãnh đạo giao mặc định (người nhập là chuyên viên → phải ghi thay mặt): việc của một phòng → Trưởng phòng đó; còn lại → Chánh Văn phòng.
function lanhDaoMacDinh(dv, accounts) {
  const ds = accounts.filter((a) => !a.is_system && !a.bi_khoa);
  const tp = dv?.phong ? ds.find((a) => a.role_group === 'A2' && a.department === dv.phong) : null;
  return (tp || ds.find((a) => a.role_group === 'A1' && a.is_chief))?.id || null;
}
// Người theo dõi mặc định: cán bộ chủ trì → Trưởng phòng của phòng chủ trì → Chánh VP (việc của Văn phòng) → lãnh đạo giao → người nhập.
function theoDoiMacDinh(g, dv, accounts, me) {
  if (g.can_bo) return g.can_bo;
  const ds = accounts.filter((a) => !a.is_system && !a.bi_khoa);
  if (dv?.trong_van_phong) {
    const a = dv.phong ? ds.find((x) => x.role_group === 'A2' && x.department === dv.phong) : ds.find((x) => x.role_group === 'A1' && x.is_chief);
    if (a) return a.id;
  }
  return tachThayMat(g.lanh_dao_giao).thay_mat_cho || me?.id || null;   // nhóm lãnh đạo không phải người theo dõi
}

// dong: { soDong, o: {k: {ma,hien,gan}|{loi}|null}, goc: {tiêu đề: giá trị} }; ctx: { me, dm, accounts, cheDoXong, hangLoat: {k: ma; linh_vuc: [ma]}, maDaCo: Set<MÃ HOA> }
// → { ket_qua, thieu: [k], loi: [k], macDinh: Set<k> (quy tắc mặc định), dienHL: Set<k> (điền hàng loạt), canhBao: [chuỗi], gt: {k: mã sau cùng}, du_lieu (gửi DB) }
export function danhGia(dong, ctx) {
  const { me, dm, accounts } = ctx;
  const gt = {}; const loi = []; const macDinh = new Set(); const dienHL = new Set(); const canhBao = [];
  Object.entries(dong.o).forEach(([k, x]) => { if (x?.loi) loi.push(k); else if (x && x.ma !== undefined && x.ma !== '') gt[k] = x.ma; });
  const ma = gt.ma ? String(gt.ma).trim().toUpperCase() : '';
  const capNhat = Boolean(ma && ctx.maDaCo?.has(ma));
  if (!capNhat) {
    const lvDm = dm.linhVuc || [];
    const md = (k, v) => { if (!gt[k] && !loi.includes(k) && v) { gt[k] = v; macDinh.add(k); } };
    md('nganh', lvDm.find((l) => l.ma === gt.linh_vuc)?.nganh_ma);   // có lĩnh vực, thiếu ngành → ngành của lĩnh vực (xác định, trước điền hàng loạt)
    const hl = ctx.hangLoat || {};
    Object.entries(hl).forEach(([k, v]) => { if (k !== 'linh_vuc' && v && !gt[k] && !loi.includes(k)) { gt[k] = v; dienHL.add(k); } });
    // Lĩnh vực điền hàng loạt theo ngành của từng dòng (mỗi ngành một lĩnh vực); dòng chưa có ngành chỉ nhận khi chọn đúng một lĩnh vực.
    const lvHl = [].concat(hl.linh_vuc || []);
    if (lvHl.length && !gt.linh_vuc && !loi.includes('linh_vuc') && !loi.includes('nganh')) {
      const lv = gt.nganh ? lvDm.find((l) => lvHl.includes(l.ma) && l.nganh_ma === gt.nganh) : lvHl.length === 1 ? lvDm.find((l) => l.ma === lvHl[0]) : null;
      if (lv) { gt.linh_vuc = lv.ma; dienHL.add('linh_vuc'); md('nganh', lv.nganh_ma); }
    }
    const lvNganh = gt.nganh ? lvDm.filter((l) => l.nganh_ma === gt.nganh) : [];
    md('linh_vuc', lvNganh.length === 1 ? lvNganh[0].ma : null);   // ngành chỉ có một lĩnh vực → lĩnh vực đó
    md('loai_van_ban', doanLoaiVanBan(gt.so_hoi_nghi, gt.so_ket_luan));
    const tt = me?.role_group === 'A3' && tachThayMat(gt.lanh_dao_giao).thay_mat_nhom === 'THUONG_TRUC';   // v3.18: thay mặt Thường trực = Thường trực giao
    md('do_khan', tt ? 'KHAN' : 'THUONG'); md('tien_do', 'DANG_THUC_HIEN'); md('loai_thoi_han', 'CO_HAN_CU_THE');
    md('nguon', NGUON_THEO_LOAI[gt.loai_van_ban] || 'NHIEM_VU_PHAT_SINH');
    md('don_vi', donViCuaCanBo(accounts.find((a) => a.id === gt.can_bo), dm));
    let dv = dm.donVi.find((d) => d.ma === gt.don_vi);
    const xongNgoai = gt.tien_do === 'HOAN_THANH' && ctx.cheDoXong === 'DA_XONG_NGOAI';   // dữ liệu cũ đã xong: kl_nhap_da_xong vẫn nhận đơn vị ngoài
    if (dv && !dv.trong_van_phong && !xongNgoai) {   // v3.18 (0079): Owner luôn là phòng / cán bộ Văn phòng — dòng chờ hoàn thiện, người nhập chọn lại
      delete gt.don_vi; loi.push('don_vi'); dv = undefined; canhBao.push('đơn vị chủ trì ngoài Văn phòng — ghi tên đơn vị thực hiện trong nội dung, chọn phòng / cán bộ Văn phòng chịu trách nhiệm');
    }
    if (me?.role_group === 'A3') md('lanh_dao_giao', lanhDaoMacDinh(dv, accounts));
    md('theo_doi', theoDoiMacDinh(gt, dv, accounts, me));
    const cb = accounts.find((a) => a.id === gt.can_bo);
    if (cb && dv && (dv.phong ? cb.department !== dv.phong : !(dv.ma === 'VAN_PHONG_TINH_UY' && cb.role_group === 'A1'))) {
      delete gt.can_bo; loi.push('can_bo'); canhBao.push('cán bộ chủ trì không thuộc đơn vị chủ trì');
    } else if (tt && !xongNgoai && (cb ? cb.role_group !== 'A1' : dv && !dv.phong)) {   // Thường trực giao cho lãnh đạo Văn phòng hoặc một phòng (giao_viec v_nhu_a0)
      const k = cb ? 'can_bo' : 'don_vi'; delete gt[k]; loi.push(k); canhBao.push('thay mặt Thường trực: người chịu trách nhiệm phải là lãnh đạo Văn phòng hoặc một phòng');
    }
  }
  if (ma && !capNhat) canhBao.push(`mã ${ma} chưa có trên hệ thống — nhập như việc mới, hệ thống cấp mã mới`);
  const xong = gt.tien_do === 'HOAN_THANH';
  const daXong = !capNhat && xong && ctx.cheDoXong === 'DA_XONG_NGOAI';
  const thieu = [];
  const can = (k, dk = true) => { if (dk && !gt[k] && !thieu.includes(k)) thieu.push(k); };
  if (!capNhat) {
    can('so_ket_luan'); can('ngay_ban_hanh'); can('so_hoi_nghi', gt.loai_van_ban === 'KL_BTV'); can('noi_dung'); can('theo_doi');
    if (!daXong) {
      can('don_vi'); can('lanh_dao_giao', me?.role_group === 'A3'); can('san_pham'); can('nguon');
      can('han_xu_ly', gt.loai_thoi_han === 'CO_HAN_CU_THE');
      can('nganh', CAN_NGANH.has(gt.loai_van_ban)); can('linh_vuc', CAN_NGANH.has(gt.loai_van_ban));
      if (gt.loai_thoi_han && !LOAI_HAN_MOI.has(gt.loai_thoi_han)) { thieu.push('loai_thoi_han'); canhBao.push('việc mới chỉ nhận "Có hạn cụ thể" hoặc "Ký ban hành"'); }
    }
    if (loi.includes('can_bo') && !thieu.includes('can_bo')) thieu.push('can_bo');
    const boQua = loi.filter((k) => !thieu.includes(k));   // ô tuỳ chọn không khớp: bỏ giá trị, vẫn nhập dòng
    if (boQua.length) canhBao.push(`bỏ giá trị không khớp: ${boQua.map(nhanTruong).join(', ')}`);
    if (gt.ngay_ban_hanh && gt.ngay_ban_hanh > ctx.homNay) { thieu.push('ngay_ban_hanh'); canhBao.push('ngày ban hành ở tương lai'); }
    if (gt.han_xu_ly && gt.ngay_ban_hanh && gt.han_xu_ly < gt.ngay_ban_hanh) { thieu.push('han_xu_ly'); canhBao.push('hạn trước ngày ban hành'); }
  }
  let ketQua = capNhat ? 'CAP_NHAT' : thieu.length ? 'CHO_HOAN_THIEN' : daXong ? 'DA_XONG' : xong && ctx.cheDoXong === 'CHO_NGHIEM_THU' && du4YeuTo(gt) ? 'CHO_NGHIEM_THU' : 'GIAO';
  if (ketQua === 'GIAO' && xong) canhBao.push('Hoàn thành nhưng chưa đủ 4 yếu tố minh chứng — giao như việc đang làm');
  if (capNhat && loi.length) canhBao.push(`bỏ qua ô không khớp: ${loi.map(nhanTruong).join(', ')}`);
  return { ket_qua: ketQua, thieu, loi, macDinh, dienHL, canhBao, gt, du_lieu: duLieuGui(dong, gt, ketQua, thieu, me) };
}

// Dòng gửi DB (nhap_excel_dong): tên khoá theo cột nhiem_vu / tham số giao_viec; dữ liệu gốc = mọi cột của tệp; cap_nhat = xem trước nhận ra mã có sẵn.
function duLieuGui(dong, g, ketQua, thieu, me) {
  const d = { so_dong: dong.soDong, ma: g.ma || null, loai_van_ban: g.loai_van_ban, so_hoi_nghi: g.so_hoi_nghi, so_ket_luan: g.so_ket_luan, ngay_ban_hanh: g.ngay_ban_hanh,
    noi_dung: g.noi_dung, owner_don_vi_ma: g.don_vi, owner_tai_khoan: g.can_bo, nguoi_theo_doi: g.theo_doi, ...tachThayMat(me?.role_group === 'A3' ? g.lanh_dao_giao : null),
    loai_thoi_han_ma: g.loai_thoi_han, han_xu_ly: g.han_xu_ly, san_pham_loai: g.san_pham, cap_nhan_san_pham: g.cap_nhan,
    do_khan: g.do_khan, nguon_nhiem_vu_ma: g.nguon, nganh_ma: g.nganh, linh_vuc_ma: g.linh_vuc, linh_vuc_chi_tiet: g.linh_vuc_chi_tiet,
    van_ban_trien_khai: g.van_ban_trien_khai, don_vi_phoi_hop: g.don_vi_phoi_hop, ghi_chu: g.ghi_chu, tien_do_ma: g.tien_do, vuong_mac: g.vuong_mac,
    kq_so_hieu: g.kq_so_hieu, kq_ngay: g.kq_ngay, kq_trich_yeu: g.kq_trich_yeu, kq_mo_ta: g.kq_mo_ta, chat_luong: g.chat_luong,
    muc_quan_trong: g.muc_quan_trong, co_quan_trinh: g.co_quan_trinh, thuong_truc_chi_dao: g.thuong_truc_chi_dao,   // 0093
    thieu: ketQua === 'CHO_HOAN_THIEN' ? thieu : [], du_lieu_goc: dong.goc, cap_nhat: ketQua === 'CAP_NHAT' };   // cap_nhat: DB chỉ cập nhật việc có sẵn khi xem trước cũng thấy mã
  Object.keys(d).forEach((k) => { if (d[k] === undefined || d[k] === '') d[k] = null; });
  return d;
}

// Thống kê cho thanh tóm tắt: số dòng theo kết quả dự kiến.
export const demKetQua = (ds) => ds.reduce((m, x) => ({ ...m, [x.ket_qua]: (m[x.ket_qua] || 0) + 1 }), {});
