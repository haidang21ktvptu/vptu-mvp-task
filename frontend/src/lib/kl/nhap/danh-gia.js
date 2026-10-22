// Đánh giá từng dòng nhập Excel theo chuẩn 3 mức (v9 đợt 2): ô trống lấy lần lượt từ điền hàng loạt → quy tắc mặc định → (còn thiếu) vùng chờ
// hoàn thiện; cấp dưới tự bổ sung phần thực hiện khi nhận việc (nhập theo tầng, 0070). Ngành ↔ lĩnh vực suy ra nhau khi xác định được (lĩnh vực
// thuộc đúng một ngành; ngành chỉ có một lĩnh vực). Kết quả dự kiến của dòng (DB là chốt khi nhập):
//   CAP_NHAT  — có mã việc đã có trên hệ thống (chỉ ô có giá trị trong tệp; KHÔNG mặc định, không điền hàng loạt — tránh ghi đè dữ liệu đang có);
//   DA_XONG   — tiến độ Hoàn thành + lô chọn "Đã xong ngoài hệ thống" (cần văn bản, nội dung, người theo dõi);
//   CHO_NGHIEM_THU — Hoàn thành + "Ghi minh chứng" + đủ 4 yếu tố minh chứng (0093: hoàn thành theo minh chứng ngay); GIAO — còn lại, đủ mức 1; CHO_HOAN_THIEN — thiếu mức 1.
// Thuần (không DOM, không mạng): dữ liệu vào là dòng đã chuẩn hoá { k: {ma, hien, gan} | {loi} | null } (chuan-hoa.js).
import { nhanTruong } from './truong.js';
import { tachThayMat } from '../thay-mat.js';
import { KHONG_THUOC, HIEN_MUC_TIEU } from '../muc-tieu.js';
import { sanPhamMacDinh, linhVucMacDinh, hanMacDinh } from './mac-dinh.js';   // v3.27: ô bảng Phụ lục không có — quy tắc cố định

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
  if (me?.role_group === 'A3' && !g.lanh_dao_giao) return me.id;   // Đợt F: chuyên viên giao thẳng — người theo dõi = người nhập (giao_viec ép)
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
  const gt = {}; const loi = []; const macDinh = new Set(); const dienHL = new Set(); const canhBao = []; let ngoaiPhong = false;
  Object.entries(dong.o).forEach(([k, x]) => { if (x?.loi) loi.push(k); else if (x && x.ma !== undefined && x.ma !== '') gt[k] = x.ma; });
  if (loi.includes('linh_vuc')) loi.splice(loi.indexOf('linh_vuc'), 1);   // v3.29: lĩnh vực tự xác định — cột Lĩnh vực của mẫu cũ ghi sai thì bỏ qua
  const ma = gt.ma ? String(gt.ma).trim().toUpperCase() : '';
  const capNhat = Boolean(ma && ctx.maDaCo?.has(ma));
  if (!HIEN_MUC_TIEU) { delete gt.muc_tieu; if (loi.includes('muc_tieu')) loi.splice(loi.indexOf('muc_tieu'), 1); }   // v3.27: mục tiêu tạm ẩn — bỏ cột
  // v3.27: "Chủ trì theo dõi" (bảng Phụ lục) = cán bộ chủ trì + người theo dõi ("tk:<id>"), hoặc một đơn vị Văn phòng ("dv:<mã>", VPTU). Cập nhật theo
  // mã: chỉ cán bộ chủ trì (DB chỉ báo khác chủ trì — tệp "Xuất theo mẫu" nhập lại không báo nhầm người theo dõi).
  const [loaiCt, maCt] = String(gt.chu_tri || '').split(':');
  if (loaiCt === 'tk') (capNhat ? ['can_bo'] : ['can_bo', 'theo_doi']).forEach((k) => { if (!gt[k] && !loi.includes(k)) gt[k] = maCt; });
  else if (loaiCt === 'dv' && !gt.don_vi && !loi.includes('don_vi')) gt.don_vi = maCt;
  if (capNhat && gt.nganh && !gt.linh_vuc && !loi.includes('nganh')) {   // v3.27: mẫu Phụ lục không có cột Lĩnh vực — đổi ngành thì DB dùng gợi ý (0117)
    const lv = linhVucMacDinh({ nganh: gt.nganh, chiTiet: gt.linh_vuc_chi_tiet, noiDung: gt.noi_dung }, dm); if (lv) gt.linh_vuc_goi_y = lv.ma;
  }
  if (!capNhat) {
    const lvDm = dm.linhVuc || [];
    const md = (k, v) => { if (!gt[k] && !loi.includes(k) && v) { gt[k] = v; macDinh.add(k); } };
    md('nganh', lvDm.find((l) => l.ma === gt.linh_vuc)?.nganh_ma);   // có lĩnh vực, thiếu ngành → ngành của lĩnh vực (xác định, trước điền hàng loạt)
    const hl = ctx.hangLoat || {};
    Object.entries(hl).forEach(([k, v]) => { if (k !== 'linh_vuc' && v && !gt[k] && !loi.includes(k)) { gt[k] = v; dienHL.add(k); } });
    // Lĩnh vực: ngành một lĩnh vực / từ khoá lĩnh vực chi tiết, nội dung / mặc định theo ngành (mac-dinh.js — v3.27). v3.29: luôn tự xác định (không
    // còn ô, không điền hàng loạt, không nhắc "kiểm tra lại").
    const lv = linhVucMacDinh({ nganh: gt.nganh, chiTiet: gt.linh_vuc_chi_tiet, noiDung: gt.noi_dung }, dm);
    if (lv && !gt.linh_vuc) md('linh_vuc', lv.ma);
    md('loai_van_ban', doanLoaiVanBan(gt.so_hoi_nghi, gt.so_ket_luan));
    const tt = me?.role_group === 'A3' && tachThayMat(gt.lanh_dao_giao).thay_mat_nhom === 'THUONG_TRUC';   // v3.18: thay mặt Thường trực = Thường trực giao
    md('do_khan', tt ? 'KHAN' : 'THUONG'); md('tien_do', 'DANG_THUC_HIEN'); md('loai_thoi_han', 'CO_HAN_CU_THE');
    md('nguon', NGUON_THEO_LOAI[gt.loai_van_ban] || 'NHIEM_VU_PHAT_SINH');
    const xongNgoai = gt.tien_do === 'HOAN_THANH' && ctx.cheDoXong === 'DA_XONG_NGOAI';   // dữ liệu cũ đã xong: kl_nhap_da_xong vẫn nhận đơn vị ngoài
    const ngoai = dm.donVi.find((d) => d.ma === gt.don_vi && !d.trong_van_phong);
    if (ngoai && !xongNgoai) {   // v3.18 (0079): Owner luôn là phòng / cán bộ Văn phòng. v3.27: đơn vị ngoài ở cột "Đơn vị chủ trì" thực chất là cơ quan trình
      delete gt.don_vi;
      if (!gt.co_quan_trinh && !loi.includes('co_quan_trinh')) { gt.co_quan_trinh = ngoai.ma; macDinh.add('co_quan_trinh'); }
      if (gt.can_bo) canhBao.push(`"${ngoai.ten}" ở cột đơn vị chủ trì → ghi vào cơ quan/đơn vị trình; đơn vị chủ trì theo dõi lấy theo cán bộ chủ trì`);
      else { loi.push('don_vi'); canhBao.push('đơn vị chủ trì ngoài Văn phòng — ghi tên đơn vị thực hiện trong nội dung, chọn phòng / cán bộ Văn phòng chủ trì theo dõi'); }
    }
    md('don_vi', donViCuaCanBo(accounts.find((a) => a.id === gt.can_bo), dm));
    const dv = dm.donVi.find((d) => d.ma === gt.don_vi);
    if (!xongNgoai) macDinhGiao(gt, { dm, ctx, macDinh, canhBao, loi });   // v3.27: dòng đi qua giao_viec — loại hạn, hạn, sản phẩm, ghi chú tiến độ
    if (me?.role_group === 'A3') md('lanh_dao_giao', lanhDaoMacDinh(dv, accounts));
    md('theo_doi', theoDoiMacDinh(gt, dv, accounts, me));
    const cb = accounts.find((a) => a.id === gt.can_bo);
    if (cb && dv && (dv.phong ? cb.department !== dv.phong : !(dv.ma === 'VAN_PHONG_TINH_UY' && cb.role_group === 'A1'))) {
      delete gt.can_bo; loi.push('can_bo'); canhBao.push('cán bộ chủ trì không thuộc đơn vị chủ trì theo dõi');
    } else if (tt && !xongNgoai && (cb ? cb.role_group !== 'A1' : dv && !dv.phong)) {   // Thường trực giao cho lãnh đạo Văn phòng hoặc một phòng (giao_viec v_nhu_a0)
      const k = cb ? 'can_bo' : 'don_vi'; delete gt[k]; loi.push(k); canhBao.push('thay mặt Thường trực: chủ trì theo dõi phải là lãnh đạo Văn phòng hoặc một phòng');
    }
    // v3.27: Trưởng phòng giao trong phòng mình (giao_viec, kl_nhap_da_xong chặn) — báo ở bản xem trước thay vì dòng rơi vào "Chờ hoàn thiện" khi nhập
    if (me?.role_group === 'A2' && !me.quan_tri_kl && (gt.can_bo || gt.don_vi)) {
      ngoaiPhong = (accounts.find((a) => a.id === gt.can_bo)?.department || dm.donVi.find((d) => d.ma === gt.don_vi)?.phong || null) !== me.department;
      if (ngoaiPhong) canhBao.push('chủ trì ngoài phòng của đồng chí — chọn cán bộ trong phòng (việc của phòng khác do lãnh đạo Văn phòng giao)');
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
      // Đợt F (0095): chuyên viên không ghi Lãnh đạo giao (không suy được mặc định) mà chủ trì là chuyên viên → giao thẳng (người theo dõi = người nhập).
      can('don_vi'); can('lanh_dao_giao', me?.role_group === 'A3' && accounts.find((a) => a.id === gt.can_bo)?.role_group !== 'A3'); can('san_pham'); can('nguon');
      can('han_xu_ly', gt.loai_thoi_han === 'CO_HAN_CU_THE');
      can('nganh', CAN_NGANH.has(gt.loai_van_ban)); can('linh_vuc', CAN_NGANH.has(gt.loai_van_ban) && Boolean(gt.nganh));   // v3.29: chưa có ngành → chỉ báo thiếu ngành
      if (gt.loai_thoi_han && !LOAI_HAN_MOI.has(gt.loai_thoi_han)) { thieu.push('loai_thoi_han'); canhBao.push('việc mới chỉ nhận "Có hạn cụ thể" hoặc "Ký ban hành"'); }
    }
    if (CAN_NGANH.has(gt.loai_van_ban) && gt.nganh === KHONG_THUOC) {   // 0116: DB chặn (trigger) — báo ngay ở bản xem trước
      thieu.push('nganh'); canhBao.push('kết luận / thông báo phải có ngành/lĩnh vực cụ thể — không chọn "Không thuộc"');
    }
    if (loi.includes('can_bo') && !thieu.includes('can_bo')) thieu.push('can_bo');
    if (loi.includes('chu_tri') && !gt.don_vi && !gt.can_bo && !thieu.includes('chu_tri')) thieu.push('chu_tri');   // v3.27: chọn đúng người ở "chưa khớp"
    if (ngoaiPhong && !thieu.includes('chu_tri')) thieu.push('chu_tri');
    if (thieu.includes('chu_tri') && thieu.includes('don_vi')) thieu.splice(thieu.indexOf('don_vi'), 1);   // một ô: đơn vị theo người chủ trì chọn được
    const boQua = loi.filter((k) => !thieu.includes(k));   // ô tuỳ chọn không khớp: bỏ giá trị, vẫn nhập dòng
    if (boQua.length) canhBao.push(`bỏ giá trị không khớp: ${boQua.map(nhanTruong).join(', ')}`);
    if (gt.ngay_ban_hanh && gt.ngay_ban_hanh > ctx.homNay) { thieu.push('ngay_ban_hanh'); canhBao.push('ngày ban hành ở tương lai'); }
    if (gt.han_xu_ly && gt.ngay_ban_hanh && gt.han_xu_ly < gt.ngay_ban_hanh) { thieu.push('han_xu_ly'); canhBao.push('hạn trước ngày ban hành'); }
  }
  let ketQua = capNhat ? 'CAP_NHAT' : thieu.length ? 'CHO_HOAN_THIEN' : daXong ? 'DA_XONG' : xong && ctx.cheDoXong === 'CHO_NGHIEM_THU' && du4YeuTo(gt) ? 'CHO_NGHIEM_THU' : 'GIAO';
  if (ketQua === 'GIAO' && xong) canhBao.push('Hoàn thành nhưng chưa đủ 4 yếu tố minh chứng — giao như việc đang làm');
  if (capNhat && loi.length) canhBao.push(`bỏ qua ô không khớp: ${loi.map(nhanTruong).join(', ')}`);
  // v3.24: mục tiêu then chốt — khớp gần đúng / bỏ bớt thì ghi rõ đã nhận gì; dòng cập nhật theo mã không đổi mục tiêu (sửa ở ngăn chi tiết). v3.27: tạm ẩn.
  if (HIEN_MUC_TIEU && capNhat && gt.muc_tieu) canhBao.push('mục tiêu then chốt chỉ gắn khi tạo việc mới — việc đã có sửa ở ngăn chi tiết');
  else if (HIEN_MUC_TIEU && dong.o.muc_tieu?.gan === 'gan_dung') canhBao.push(`mục tiêu then chốt nhận: ${dong.o.muc_tieu.hien}`);
  return { ket_qua: ketQua, thieu, loi, macDinh, dienHL, canhBao, gt, du_lieu: duLieuGui(dong, gt, ketQua, thieu, me) };
}

// v3.27 — dòng đi qua giao_viec (việc mới đang làm, hoặc Hoàn thành theo "Ghi minh chứng"): giao_viec chỉ nhận "Có hạn cụ thể" / "Ký ban hành" có
// hạn + sản phẩm. Loại khác (thường xuyên, chờ điều kiện) → Có hạn cụ thể, loại gốc ghi vào ghi chú; hạn trống → 1 tháng kể từ hôm nay (chủ dự án
// 20/10/2026); sản phẩm trống → theo từ khoá nội dung; việc đang làm có "Kết quả thực hiện" trong tệp → ghi chú (chưa phải kết quả); Hoàn thành chưa đủ
// 4 yếu tố minh chứng (giao như việc đang làm) → ghi chú "Kết quả theo tệp".
function macDinhGiao(gt, { dm, ctx, macDinh, canhBao, loi }) {
  const md = (k, v) => { if (!gt[k] && !loi.includes(k) && v) { gt[k] = v; macDinh.add(k); } };
  const them = (chu) => { gt.ghi_chu = [gt.ghi_chu, chu].filter(Boolean).join(' · '); };
  if (gt.loai_thoi_han && !LOAI_HAN_MOI.has(gt.loai_thoi_han)) {
    them(`Loại thời hạn theo tệp: ${(dm.loaiThoiHan || []).find((l) => l.ma === gt.loai_thoi_han)?.ten || gt.loai_thoi_han}`);
    gt.loai_thoi_han = 'CO_HAN_CU_THE'; macDinh.add('loai_thoi_han'); canhBao.push('loại thời hạn chuyển "Có hạn cụ thể" (việc mới phải có hạn) — loại gốc ghi ở ghi chú');
  }
  if (gt.loai_thoi_han === 'CO_HAN_CU_THE' && ctx.homNay) md('han_xu_ly', hanMacDinh(ctx.homNay, gt.ngay_ban_hanh));
  md('san_pham', sanPhamMacDinh(gt.noi_dung, gt.loai_thoi_han, dm.sanPham));
  if (gt.kq_mo_ta && gt.tien_do !== 'HOAN_THANH') them(`Tiến độ theo tệp: ${gt.kq_mo_ta}`);
  else if (gt.kq_mo_ta && !du4YeuTo(gt)) them(`Kết quả theo tệp: ${gt.kq_mo_ta}`);   // "Ghi minh chứng" chưa đủ 4 yếu tố (mẫu Phụ lục chỉ có cột M) → việc mở, giữ chữ
}

// Dòng gửi DB (nhap_excel_dong): tên khoá theo cột nhiem_vu / tham số giao_viec; dữ liệu gốc = mọi cột của tệp; cap_nhat = xem trước nhận ra mã có sẵn.
function duLieuGui(dong, g, ketQua, thieu, me) {
  const d = { so_dong: dong.soDong, ma: g.ma || null, loai_van_ban: g.loai_van_ban, so_hoi_nghi: g.so_hoi_nghi, so_ket_luan: g.so_ket_luan, ngay_ban_hanh: g.ngay_ban_hanh,
    noi_dung: g.noi_dung, owner_don_vi_ma: g.don_vi, owner_tai_khoan: g.can_bo, nguoi_theo_doi: g.theo_doi, ...tachThayMat(me?.role_group === 'A3' ? g.lanh_dao_giao : null),
    loai_thoi_han_ma: g.loai_thoi_han, han_xu_ly: g.han_xu_ly, san_pham_loai: g.san_pham, cap_nhan_san_pham: g.cap_nhan,
    do_khan: g.do_khan, nguon_nhiem_vu_ma: g.nguon, nganh_ma: g.nganh, linh_vuc_ma: g.linh_vuc, linh_vuc_goi_y: g.linh_vuc_goi_y, linh_vuc_chi_tiet: g.linh_vuc_chi_tiet,
    van_ban_trien_khai: g.van_ban_trien_khai, don_vi_phoi_hop: g.don_vi_phoi_hop, ghi_chu: g.ghi_chu, tien_do_ma: g.tien_do, vuong_mac: g.vuong_mac,
    kq_so_hieu: g.kq_so_hieu, kq_ngay: g.kq_ngay, kq_trich_yeu: g.kq_trich_yeu, kq_mo_ta: g.kq_mo_ta, chat_luong: g.chat_luong,
    muc_quan_trong: g.muc_quan_trong, co_quan_trinh: g.co_quan_trinh, thuong_truc_chi_dao: g.thuong_truc_chi_dao,   // 0093
    muc_tieu_ma: Array.isArray(g.muc_tieu) && g.muc_tieu.length ? g.muc_tieu : null,   // 0106: trigger gắn vào việc do lô tạo
    thieu: ketQua === 'CHO_HOAN_THIEN' ? thieu : [], du_lieu_goc: dong.goc, cap_nhat: ketQua === 'CAP_NHAT' };   // cap_nhat: DB chỉ cập nhật việc có sẵn khi xem trước cũng thấy mã
  Object.keys(d).forEach((k) => { if (d[k] === undefined || d[k] === '') d[k] = null; });
  return d;
}

// Thống kê cho thanh tóm tắt: số dòng theo kết quả dự kiến.
export const demKetQua = (ds) => ds.reduce((m, x) => ({ ...m, [x.ket_qua]: (m[x.ket_qua] || 0) + 1 }), {});
