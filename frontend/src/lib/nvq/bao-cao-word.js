// Phân hệ Nhiệm vụ quý BTV: dự thảo báo cáo của Văn phòng (tệp Word, thể thức mẫu báo cáo — lib/nvq/docx.js) — báo cáo tiến độ hằng tuần (Kế hoạch
// 193-KH/TU mục III.2.3: "Văn phòng Tỉnh ủy theo dõi, đôn đốc, báo cáo hằng tuần tiến độ thực hiện Danh mục") và báo cáo kết quả quý (đánh giá từng nhiệm
// vụ). Thân: tình hình chung, theo 6 trục, 05 chỉ tiêu cơ bản, kết quả trong tuần, nhiệm vụ chậm tiến độ / vướng mắc / đề xuất (đủ 4 thông tin CV 1400),
// đến hạn thời gian tới; phụ lục khổ ngang: bảng danh mục kèm kết quả thực hiện. Là DỰ THẢO — người ký, số, ngày do Văn phòng hoàn thiện trên Word.
import { p, c, dongTrong, bang, o, runs, phanDau, tieuDe, khoangTruocKy, phanKy, taoDocx } from './docx.js';
import { tenKy, laMa, tenTrangThai, ghiMoc, NHOM, CHI_TIEU_CO_BAN, DANH_GIA, soVN, tenTrangThaiSp, spXong } from './nhan.js';
import { demTheoTrangThai, theoTruc, diemNghen, ketQuaTrongKhoang, denHanTrongKhoang, chiTieuCoBan, mucChiTieu, theoLanhDao, spTheoNv, sapXepViTri, trongDanhMuc } from './tinh.js';

const vn = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const vnNgan = (iso) => (iso ? iso.split('-').slice(1).reverse().join('/') : '');
const congNgay = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const de = (t) => p([{ t, b: true }]);   // đề mục in đậm, cùng thông số thân
const gach = (t) => p(`- ${t}`);
const vbCanCu = (vanBan, loai) => vanBan.filter((v) => v.loai === loai).map((v) => `${v.so_ky_hieu}${v.ngay ? `, ngày ${vn(v.ngay)}` : ''}`);

function tenDonVi(r, dmDonVi) {
  const ten = (r.don_vi || []).filter((d) => (d.vai_tro || 'CHU_TRI') === 'CHU_TRI').map((d) => dmDonVi.find((x) => x.ma === d.ma)?.ten).filter(Boolean);
  return ten.join(', ') || r.don_vi_text || 'chưa xác định';
}
const tenLanhDao = (r) => (r.lanh_dao_text || '').replace(/^(các )?đồng chí:?\s*/i, '').replace(/\s*;\s*$/, '') || 'chưa ghi';
const ngan = (s, n = 220) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
function ketQuaSp(s) {
  const kq = [s.kq_so_ky_hieu, s.kq_ngay ? `ngày ${vn(s.kq_ngay)}` : ''].filter(Boolean).join(', ');
  return `${s.mo_ta}${kq ? ` (${kq})` : ''}`;
}

// ---- Thân báo cáo ----
function phanChung(d, rows, truc, ngay) {
  const trong = rows.filter((r) => r.nhom === 'TRONG_CT' && r.trang_thai !== 'RUT').length;
  const ra = [de('1. Tình hình chung'),
    p(`Tổng số ${d.tong} nhiệm vụ (${trong} nhiệm vụ theo chương trình, kế hoạch công tác; ${d.tong - trong} nhiệm vụ ngoài chương trình, kế hoạch công tác). `
      + `Đến ngày ${vn(ngay)}: hoàn thành ${d.HOAN_THANH} nhiệm vụ (${d.tong ? Math.round((100 * d.HOAN_THANH) / d.tong) : 0}%${d.hoanThanhCham ? `, trong đó ${d.hoanThanhCham} nhiệm vụ hoàn thành nhưng chậm tiến độ` : ''}); `
      + `đang thực hiện ${d.DANG_THUC_HIEN + d.THUONG_XUYEN} nhiệm vụ${d.THUONG_XUYEN ? ` (${d.THUONG_XUYEN} nhiệm vụ thực hiện thường xuyên)` : ''}; chậm tiến độ ${d.CHAM_TIEN_DO} nhiệm vụ; `
      + `chưa triển khai ${d.CHUA_TRIEN_KHAI} nhiệm vụ${d.RUT ? `; ${d.RUT} nhiệm vụ đã rút khỏi danh mục theo văn bản điều chỉnh` : ''}.`)];
  theoTruc(rows, truc).forEach((t) => ra.push(gach(`Trục ${t.so} (${t.tenNgan}): ${t.tong} nhiệm vụ — hoàn thành ${t.hoanThanh}, đang thực hiện ${t.dang}`
    + `${t.cham ? `, chậm tiến độ ${t.cham}` : ''}${t.chua ? `, chưa triển khai ${t.chua}` : ''}.`)));
  return ra;
}
function phanChiTieu(sp, theoId, so) {
  const ds = chiTieuCoBan(sp, theoId).filter((x) => x.ds.length);
  if (!ds.length) return [];
  const ra = [de(`${so}. Các chỉ tiêu cơ bản`)];
  ds.forEach(({ ma, ds: con }) => con.forEach(({ s }) => {
    const m = mucChiTieu(s);
    const dv = s.don_vi_tinh ? ` ${s.don_vi_tinh}` : '';
    const nguon = [s.thuc_hien_ngay ? `số liệu ngày ${vn(s.thuc_hien_ngay)}` : '', s.thuc_hien_nguon || ''].filter(Boolean).join(', ');
    ra.push(gach(`${CHI_TIEU_CO_BAN[ma]} — ${s.mo_ta}: mục tiêu ${soVN(s.muc_tieu)}${dv}; `
      + (s.thuc_hien === null || s.thuc_hien === undefined ? 'chưa có số liệu.' : `thực hiện ${soVN(s.thuc_hien)}${dv}${nguon ? ` (${nguon})` : ''} — ${m.ten.toLowerCase()}.`)));
  }));
  return ra;
}
function phanTrongTuan(sp, theoId, capNhat, tu, den, so) {
  const xong = ketQuaTrongKhoang(sp, theoId, tu, den);
  const nd = capNhat.filter((x) => x.noi_dung && theoId.has(x.nhiem_vu_id));
  const ra = [de(`${so}. Kết quả trong tuần`)];
  if (!xong.length && !nd.length) return [...ra, p('Trong tuần chưa có kết quả, sản phẩm mới hoàn thành.')];
  if (xong.length) ra.push(p(`Hoàn thành ${xong.length} kết quả, sản phẩm:`));
  xong.forEach(({ s, r }) => ra.push(gach(`${r.so_hieu}: ${ketQuaSp(s)}.`)));
  const daNeu = new Set(xong.map((x) => x.r.id));
  nd.filter((x) => !daNeu.has(x.nhiem_vu_id)).slice(0, 40).forEach((x) => ra.push(gach(`${theoId.get(x.nhiem_vu_id).so_hieu}: ${ngan(x.noi_dung, 400)}`)));
  return ra;
}
function phanNghen(rows, spMap, dm, so) {
  const ds = diemNghen(rows, spMap);
  const ra = [de(`${so}. Nhiệm vụ chậm tiến độ, có vướng mắc, đề xuất`)];
  if (!ds.length) return [...ra, p('Không có nhiệm vụ chậm tiến độ, có vướng mắc hoặc đề xuất.')];
  ds.forEach(({ r, conThieu }) => ra.push(gach([`${r.so_hieu} — ${ngan(r.noi_dung, 180)}: đơn vị tham mưu, chủ trì ${tenDonVi(r, dm.donVi)}`,
    r.so_ngay_qua > 0 ? `; chậm ${r.so_ngay_qua} ngày${r.han_gan_nhat ? ` so với mốc ${vn(r.han_gan_nhat)}` : ''}` : '',
    conThieu.length ? `; còn: ${conThieu.map((s) => ngan(s.mo_ta, 120)).join('; ')}` : '',
    r.vuong_mac ? `; vướng mắc: ${ngan(r.vuong_mac, 300)}` : '', r.de_xuat ? `; đề xuất: ${ngan(r.de_xuat, 300)}` : '',
    `; lãnh đạo phụ trách: ${tenLanhDao(r)}.`].join(''))));
  return ra;
}
function phanSapDenHan(sp, theoId, tu, den, so) {
  const ds = denHanTrongKhoang(sp, theoId, tu, den);
  const ra = [de(`${so}. Nhiệm vụ đến mốc hoàn thành từ ngày ${vn(tu)} đến ngày ${vn(den)}`)];
  if (!ds.length) return [...ra, p('Không có kết quả, sản phẩm đến mốc trong thời gian này.')];
  ds.forEach(({ s, r }) => ra.push(gach(`${r.so_hieu}: ${ngan(s.mo_ta, 200)} — mốc ${vn(s.han)} (${tenTrangThaiSp(s.loai, s.trang_thai).toLowerCase()}).`)));
  return ra;
}
function phanDanhGia(rows, dm, so) {
  const ds = trongDanhMuc(rows);
  const dem = (m) => ds.filter((r) => r.danh_gia === m).length;
  const chua = ds.filter((r) => r.danh_gia === 'CHUA_HOAN_THANH' || r.danh_gia === 'KHONG_DANH_GIA');
  const ra = [de(`${so}. Đánh giá kết quả thực hiện`),
    p(`Hoàn thành ${dem('HOAN_THANH')} nhiệm vụ; hoàn thành nhưng chậm tiến độ ${dem('HOAN_THANH_CHAM')} nhiệm vụ; chưa hoàn thành ${dem('CHUA_HOAN_THANH')} nhiệm vụ; `
      + `không đánh giá ${dem('KHONG_DANH_GIA')} nhiệm vụ; chưa có đánh giá ${ds.filter((r) => !r.danh_gia).length} nhiệm vụ.`)];
  chua.forEach((r) => ra.push(gach(`${r.so_hieu} — ${ngan(r.noi_dung, 160)}: ${DANH_GIA[r.danh_gia].toLowerCase()}${r.danh_gia_ly_do ? `; nguyên nhân: ${ngan(r.danh_gia_ly_do, 300)}` : ''}`
    + `${r.chuyen_ky_sau ? '; chuyển sang quý sau' : ''}.`)));
  const ld = theoLanhDao(rows, dm.lanhDao);
  if (ld.length) {
    ra.push(p('Tổng hợp theo lãnh đạo phụ trách (một nhiệm vụ có nhiều đồng chí phụ trách được tính cho từng đồng chí):'));
    const K = [4300, 1500, 1500, 1700];
    const oc = (t, i, al = 'center', b = false) => o(`<w:p><w:pPr><w:spacing w:before="40" w:after="40"/><w:jc w:val="${al}"/></w:pPr>${runs(String(t), { sz: 13, b })}</w:p>`, K[i]);
    ra.push(bang(K, [['Lãnh đạo phụ trách', 'Số nhiệm vụ', 'Hoàn thành', 'Tỷ lệ'].map((t, i) => oc(t, i, 'center', true)),
      ...ld.map((x) => [oc(x.ten, 0, 'left'), oc(x.tong, 1), oc(x.hoanThanh, 2), oc(`${x.tyLe}%`, 3)])], { vien: true, tieuDe: 1 }));
  }
  return ra;
}

// ---- Phụ lục: bảng danh mục kèm kết quả ----
const K_PL = [700, 3300, 1700, 1700, 2500, 1100, 2853, 1000];
const tp = (t, op = {}) => `<w:p><w:pPr><w:spacing w:before="30" w:after="30"/><w:jc w:val="${op.align || 'left'}"/></w:pPr>${runs(String(t ?? ''), { sz: 12, ...op })}</w:p>`;
function phuLuc({ rows, spMap, capTuanTheoNv, loai, tieuDePl, ngay, dsTruc = [] }) {
  const tieuDeCot = ['Stt', 'Nhiệm vụ được giao', 'Lãnh đạo phụ trách', 'Đơn vị tham mưu, chủ trì', 'Kết quả/sản phẩm cần đạt được', 'Tiến độ',
    `Kết quả thực hiện (đến ngày ${vn(ngay)})`, loai === 'quy' ? 'Đánh giá' : 'Tình trạng'];
  const hang = [tieuDeCot.map((t, i) => o(tp(t, { b: true, align: 'center' }), K_PL[i], { vAlign: 'center' }))];
  let truc = null; let nhom = null;
  sapXepViTri(rows).forEach((r) => {
    if (r.truc_so !== truc) { truc = r.truc_so; nhom = null; hang.push([o(tp(`${laMa(r.truc_so)}. Các nhiệm vụ thuộc trục ${r.truc_so}: ${dsTruc.find((t) => t.so === r.truc_so)?.ten || r.truc_ten_ngan || ''}`, { b: true }), 14853, { span: 8 })]); }
    if (r.nhom !== nhom) { nhom = r.nhom; hang.push([o(tp(`${r.nhom === 'TRONG_CT' ? 1 : 2}. ${NHOM[r.nhom]}`, { b: true, i: true }), 14853, { span: 8 })]); }
    const sp = spMap.get(r.id) || [];
    const kq = [r.ket_qua_thuc_hien, ...sp.filter((s) => spXong(s) && s.kq_so_ky_hieu && !(r.ket_qua_thuc_hien || '').includes(s.kq_so_ky_hieu)).map((s) => ketQuaSp(s)),
      capTuanTheoNv.get(r.id) ? `Trong tuần: ${capTuanTheoNv.get(r.id)}` : ''].filter(Boolean).join('\n');
    const tt = loai === 'quy' ? [DANH_GIA[r.danh_gia] || 'Chưa đánh giá', r.danh_gia_ly_do ? `(${ngan(r.danh_gia_ly_do, 200)})` : ''].filter(Boolean).join('\n')
      : [tenTrangThai(r), ghiMoc(r) && r.trang_thai !== 'HOAN_THANH' ? `(${ghiMoc(r)})` : ''].filter(Boolean).join('\n');
    hang.push([o(tp(`(${r.stt})`, { align: 'center' }), K_PL[0]), o(tp(r.noi_dung), K_PL[1]), o(tp(tenLanhDao(r)), K_PL[2]), o(tp(r.don_vi_text || ''), K_PL[3]),
      o(tp(r.ket_qua_can_dat || sp.map((s) => s.mo_ta).join('; ')), K_PL[4]), o(tp(r.tien_do_text || '', { align: 'center' }), K_PL[5]), o(tp(kq || 'Chưa có kết quả cập nhật.'), K_PL[6]),
      o(tp(tt, { align: 'center' }), K_PL[7])]);
  });
  return [c([{ t: 'PHỤ LỤC', b: true }]), ...tieuDePl.map((t) => c([{ t, b: true }])), c([{ t: `(Kèm theo Báo cáo số     -BC/VPTU, ngày     /${ngay.slice(5, 7)}/${ngay.slice(0, 4)} của Văn phòng Tỉnh ủy)`, i: true }]),
    c('-----'), dongTrong(), bang(K_PL, hang, { vien: true, tieuDe: 1 })].join('');
}

// ctx: { loai: 'tuan' | 'quy', ky, tuan, rows, sp, capNhatTuan, dm: { truc, lanhDao, donVi }, vanBan, ngay (ISO, số liệu đến), ky_ten: { quyenHan, chucVu, hoTen },
// noiNhan: [dòng], nhanXet }
export function taoBaoCaoWord(ctx) {
  const { loai, ky, tuan, rows, sp, capNhatTuan = [], dm, vanBan = [], ngay } = ctx;
  const spMap = spTheoNv(sp); const theoId = new Map(rows.map((r) => [r.id, r])); const d = demTheoTrangThai(rows);
  const kh = vbCanCu(vanBan, 'KE_HOACH'); const dc = vbCanCu(vanBan, 'DIEU_CHINH');
  const ky1 = tenKy(ky).replace(/^Quý/, 'quý');
  const trich = loai === 'tuan'
    ? [`tiến độ thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1}`, 'của Ban Thường vụ Tỉnh ủy', `(tuần thứ ${tuan.so}, từ ngày ${vnNgan(tuan.tu_ngay)} đến ngày ${vn(tuan.den_ngay)})`]
    : [`kết quả thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1}`, 'của Ban Thường vụ Tỉnh ủy'];
  const canCu = `Thực hiện ${kh.length ? `Kế hoạch số ${kh.join('; ')}` : 'Kế hoạch'} của Ban Thường vụ Tỉnh ủy về tổ chức thực hiện các chỉ tiêu, nhiệm vụ chính trị ${ky1}`
    + `${dc.length ? ` (danh mục được điều chỉnh, bổ sung theo văn bản số ${dc.join('; ')})` : ''}, Văn phòng Tỉnh ủy tổng hợp, báo cáo ${loai === 'tuan' ? 'tiến độ' : 'kết quả'} thực hiện như sau:`;
  const capTuanTheoNv = new Map(); capNhatTuan.filter((x) => x.noi_dung).forEach((x) => capTuanTheoNv.set(x.nhiem_vu_id, [capTuanTheoNv.get(x.nhiem_vu_id), ngan(x.noi_dung, 600)].filter(Boolean).join('; ')));
  let so = 1; const n = () => { so += 1; return so; };
  const than = [
    phanDau({ ngay: `Cao Bằng, ngày     tháng ${ngay.slice(5, 7)} năm ${ngay.slice(0, 4)}` }), tieuDe(trich), p(canCu),
    ...phanChung(d, rows, dm.truc, ngay), ...phanChiTieu(sp, theoId, n()),
    ...(loai === 'tuan' ? phanTrongTuan(sp, theoId, capNhatTuan, tuan.tu_ngay, tuan.den_ngay, n()) : []),
    ...phanNghen(rows, spMap, dm, n()),
    ...(loai === 'tuan' ? phanSapDenHan(sp, theoId, congNgay(ngay, 1), congNgay(ngay, 14) > ky.den_ngay ? ky.den_ngay : congNgay(ngay, 14), n()) : phanDanhGia(rows, dm, n())),
    ...(ctx.nhanXet ? [de(`${n()}. Nhận xét, đề xuất`), ...String(ctx.nhanXet).split(/\n+/).map((x) => p(x))] : []),
    p(`Trên đây là báo cáo ${loai === 'tuan' ? `tiến độ thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1} tuần thứ ${tuan.so}` : `kết quả thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1}`}, `
      + 'Văn phòng Tỉnh ủy trân trọng báo cáo./.', { keepNext: true, keepLines: true }),
    khoangTruocKy(),
    phanKy({ noiNhan: ctx.noiNhan?.length ? ctx.noiNhan : ['- Thường trực Tỉnh ủy (b/c);', '- Các đồng chí Ủy viên Ban Thường vụ Tỉnh ủy;', '- Lãnh đạo Văn phòng;', '- Lưu Văn phòng Tỉnh ủy.'],
      ...(ctx.kyTen || { chucVu: 'CHÁNH VĂN PHÒNG' }) }),
  ].join('');
  const tieuDePl = loai === 'tuan' ? [`Tiến độ thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1}`, `(tuần thứ ${tuan.so}, từ ngày ${vnNgan(tuan.tu_ngay)} đến ngày ${vn(tuan.den_ngay)})`]
    : [`Kết quả thực hiện Danh mục các chỉ tiêu, nhiệm vụ chính trị ${ky1}`];
  return taoDocx({ than, phuLuc: phuLuc({ rows, spMap, capTuanTheoNv, loai, tieuDePl, ngay, dsTruc: dm.truc }), tieuDe: `Báo cáo ${trich.join(' ')}` });
}
