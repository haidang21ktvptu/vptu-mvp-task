// Phân hệ Nhiệm vụ quý BTV — Tổng quan quý: trang để LÃNH ĐẠO nắm ngay tình hình (chủ dự án 13/11/2026: "cán bộ chủ trì theo dõi là người cập nhật
// chính, lãnh đạo chỉ nhìn các chỉ tiêu và nắm thông tin đã cập nhật"). Thứ tự: ô số → 05 chỉ tiêu cơ bản → tiến độ 6 trục → việc cần lãnh đạo quan tâm
// (CV 1400 CN-5.2: đơn vị đang chậm, số ngày trễ, sản phẩm còn thiếu, lãnh đạo phụ trách) → kết quả mới trong tuần, đến mốc trong tháng → theo lãnh đạo
// phụ trách, đơn vị tham mưu, chủ trì theo dõi → diễn biến các tuần (tong-quan-2.js). Mọi số / tên bấm được → Danh mục đã lọc / ngăn chi tiết.
// v3.36 (CAU-HOI V-13, DESIGN mục 17 — số trước, chi tiết bấm mới mở): bỏ câu tóm tắt lặp lại các ô số (số ngày còn lại của quý lên dòng phụ đầu trang;
// tỉ lệ hoàn thành, số đã báo cáo tuần ở gợi ý của ô số); ghi chú mốc tính của khối ở nút "i"; thẻ chỉ tiêu chỉ còn tên, số, thanh, mức và ngày số liệu
// (mô tả, nguồn số liệu ở gợi ý); sáu trục xếp hai cột, tên và số cùng dòng; "Cần lãnh đạo quan tâm" hiện 5 nhiệm vụ đầu (components/ds-gon.js — bản in
// đủ), vướng mắc, đề xuất mỗi mục một dòng (đủ chữ ở title, ngăn chi tiết, bản in), chủ trì theo dõi và ngày cập nhật thành ô thứ năm của hàng thông
// tin, số nhiệm vụ ở đầu khối bấm được → Danh mục đã lọc.
import { homNayVN } from '../../lib/kl/ngay.js';
import { nq, dongTheoId } from '../../lib/nvq/du-lieu.js';
import { CHI_TIEU_CO_BAN, soVN, laMa } from '../../lib/nvq/nhan.js';
import { demTheoTrangThai, soNgayGiua, theoTruc, diemNghen, chiTieuCoBan, mucChiTieu, spTheoNv } from '../../lib/nvq/tinh.js';
import { thuocGoi } from '../../components/goi.js';
import { apDanhSach, dangKyDanhSach, nutHetHtml } from '../../components/ds-gon.js';
import { e, vn, vnNgan, dauTrang, chuaCoKy, oSo, khoiNq, thanh, linkNv, rutGon, tenDonVi, tenLanhDao, tenChuTri } from './khung.js';
import { khoiTuanThang, khoiTheoNhom, khoiXuHuong, DS_TUAN_THANG } from './tong-quan-2.js';

export const locHtml = (loc) => e(JSON.stringify(loc));
const SO_NGHEN_DAU = 5;   // "Cần lãnh đạo quan tâm": số nhiệm vụ hiện sẵn
dangKyDanhSach('nqNghen', { vung: () => document.querySelector('#viewNvq .nq-nghen'), chon: ':scope > li', so: SO_NGHEN_DAU, donVi: 'nhiệm vụ' });

function oSoTongQuan(d) {
  const pt = d.tong ? Math.round((100 * d.HOAN_THANH) / d.tong) : 0;
  return oSo([
    { khoa: '{}', nhan: 'nhiệm vụ', so: d.tong },
    { khoa: '{"trangThai":"HOAN_THANH"}', nhan: 'hoàn thành', so: d.HOAN_THANH, lop: 'nq-o-luc', goi: d.tong ? `${pt}% số nhiệm vụ trong danh mục` : '' },
    { khoa: '{"trangThai":"DANG_THUC_HIEN"}', nhan: 'đang thực hiện', so: d.DANG_THUC_HIEN, lop: 'nq-o-lam' },
    { khoa: '{"trangThai":"THUONG_XUYEN"}', nhan: 'thường xuyên', so: d.THUONG_XUYEN, lop: 'nq-o-lam' },
    { khoa: '{"trangThai":"CHAM_TIEN_DO"}', nhan: 'chậm tiến độ', so: d.CHAM_TIEN_DO, lop: 'nq-o-do' },
    { khoa: '{"trangThai":"CHUA_TRIEN_KHAI"}', nhan: 'chưa triển khai', so: d.CHUA_TRIEN_KHAI, lop: 'nq-o-xam' },
    { khoa: '{"chuaCapNhat":true}', nhan: 'chưa báo cáo tuần', so: d.chuaCapNhatTuan, lop: d.chuaCapNhatTuan ? 'nq-o-vang' : '',
      goi: d.mo ? `Báo cáo tuần này: ${d.daCapNhatTuan}/${d.mo} nhiệm vụ chưa hoàn thành đã được chủ trì theo dõi cập nhật.` : '' },
  ], 'nqLocDanhMuc');
}

// Thẻ chỉ tiêu: tên, mục tiêu và thực hiện, thanh, mức, ngày số liệu. Mô tả của chỉ tiêu và nguồn số liệu ở gợi ý (và chữ ẩn); một mã có nhiều chỉ tiêu
// thì mô tả vẫn hiện để phân biệt các thẻ cùng tên.
function khoiChiTieu(sp, theoId) {
  const ds = chiTieuCoBan(sp, theoId);
  const the = ds.flatMap(({ ma, ds: con }) => (con.length ? con : [null]).map((x) => {
    if (!x) return `<div class="nq-ct nq-ct-trong"><b>${e(CHI_TIEU_CO_BAN[ma])}</b><span class="chu-phu">Chưa gắn chỉ tiêu trong danh mục quý.</span></div>`;
    const { s, r } = x; const m = mucChiTieu(s); const coSo = s.thuc_hien !== null && s.thuc_hien !== undefined;
    const pt = s.ty_le_muc_tieu !== null && s.ty_le_muc_tieu !== undefined ? Math.min(100, Number(s.ty_le_muc_tieu)) : null;
    const goi = `${s.mo_ta || CHI_TIEU_CO_BAN[ma]}${s.thuc_hien_ngay ? `. Số liệu ngày ${vn(s.thuc_hien_ngay)}${s.thuc_hien_nguon ? `, ${s.thuc_hien_nguon}` : ''}` : ''}`;
    return `<button type="button" class="nq-ct" data-action="nqMo" data-id="${r.id}"${thuocGoi(goi)}><b>${e(CHI_TIEU_CO_BAN[ma])}</b>${con.length > 1 ? `<span class="nq-ct-mt">${e(s.mo_ta)}</span>` : ''}`
      + `<span class="nq-ct-so"><span>Mục tiêu <b>${soVN(s.muc_tieu)}</b> ${e(s.don_vi_tinh || '')}</span><span>Thực hiện <b>${coSo ? soVN(s.thuc_hien) : '—'}</b> ${coSo ? e(s.don_vi_tinh || '') : ''}</span></span>`
      + (pt !== null ? `<span class="nq-ct-thanh"><span style="width:${pt}%"></span></span>` : '')
      + `<span class="nq-ct-chan"><span class="trang-thai ${m.lop}">${e(m.ten)}</span>${s.thuc_hien_ngay ? `<small class="chu-phu">số liệu ${vnNgan(s.thuc_hien_ngay)}</small>` : ''}</span><span class="sr">. ${e(goi)}</span></button>`;
  })).join('');
  return khoiNq('05 chỉ tiêu cơ bản', '', `<div class="nq-ct-luoi">${the}</div>`, 'rong', 'Theo số liệu chủ trì theo dõi đã cập nhật.');
}

function khoiTruc(rows) {
  const ds = theoTruc(rows, nq.truc);
  const than = ds.map((t) => `<button type="button" class="nq-truc" data-action="nqLocDanhMuc" data-loc="${locHtml({ truc: t.so })}">`
    + `<span class="nq-truc-ten"><b>Trục ${t.so}</b> ${e(t.tenNgan)}</span>`
    + thanh([{ so: t.hoanThanh, lop: 'nq-luc', nhan: 'hoàn thành' }, { so: t.dang, lop: 'nq-lam', nhan: 'đang thực hiện' }, { so: t.cham, lop: 'nq-do', nhan: 'chậm tiến độ' },
      { so: t.chua, lop: 'nq-xam', nhan: 'chưa triển khai' }], t.tong)
    + `<span class="nq-truc-so">${t.hoanThanh}/${t.tong} hoàn thành${t.cham ? ` · <b class="nq-chu-do">${t.cham} chậm</b>` : ''}</span></button>`).join('');
  const chuGiai = '<p class="nq-chu-giai"><span class="nq-luc"></span>Hoàn thành <span class="nq-lam"></span>Đang thực hiện <span class="nq-do"></span>Chậm tiến độ <span class="nq-xam"></span>Chưa triển khai</p>';
  return khoiNq('Tiến độ theo 6 trục kết quả trọng tâm', '', `${than ? `<div class="nq-truc-luoi">${than}</div>` : '<p class="chu-phu">Chưa có nhiệm vụ.</p>'}${chuGiai}`, 'rong');
}

function khoiNghen(rows, spMap) {
  const ds = diemNghen(rows, spMap);
  const than = ds.length ? `<ol class="nq-nghen">${ds.map(({ r, conThieu }) => {
    const thieu = conThieu.map((s) => rutGon(s.mo_ta, 90)).join('; ');
    return `<li class="${r.muc === 'DO_DAC_BIET' ? 'ddb' : r.so_ngay_qua > 0 ? 'do' : 'vang'}">`
    + `<div class="nq-nghen-dau" title="${e(r.noi_dung)}">${linkNv(r)} <span>${e(rutGon(r.noi_dung, 170))}</span></div>`
    + '<dl>'
    + `<div><dt>Đơn vị tham mưu, chủ trì</dt><dd>${e(tenDonVi(r))}</dd></div>`
    + `<div><dt>Tiến độ</dt><dd>${r.so_ngay_qua > 0 ? `<b class="nq-chu-do">Chậm ${r.so_ngay_qua} ngày</b> (mốc ${vnNgan(r.han_gan_nhat)})` : r.han_gan_nhat ? `Mốc gần nhất ${vnNgan(r.han_gan_nhat)}` : 'Thường xuyên'}</dd></div>`
    + `<div><dt>Còn thiếu</dt><dd${thieu ? ` title="${e(thieu)}"` : ''}>${thieu ? e(thieu) : '—'}</dd></div>`
    + `<div><dt>Lãnh đạo phụ trách</dt><dd>${e(tenLanhDao(r))}</dd></div>`
    + `<div><dt>Chủ trì theo dõi</dt><dd>${e(tenChuTri(r))}${r.ket_qua_luc ? `, cập nhật ${vnNgan(String(r.ket_qua_luc).slice(0, 10))}` : ''}</dd></div>`
    + '</dl>'
    + (r.vuong_mac ? `<p class="nq-vm" title="${e(r.vuong_mac)}"><b>Vướng mắc:</b> ${e(rutGon(r.vuong_mac, 300))}</p>` : '')
    + (r.de_xuat ? `<p class="nq-vm" title="${e(r.de_xuat)}"><b>Đề xuất:</b> ${e(rutGon(r.de_xuat, 300))}</p>` : '')
    + (r.so_chi_dao_mo ? `<p class="nq-vm"><b>${r.so_chi_dao_mo} ý kiến chỉ đạo chưa xử lý xong</b></p>` : '') + '</li>';
  }).join('')}</ol>${nutHetHtml('nqNghen', ds.length, SO_NGHEN_DAU, 'nhiệm vụ')}`
    : '<p class="nq-on">Không có nhiệm vụ chậm tiến độ, vướng mắc hay đề xuất cần lãnh đạo xem xét.</p>';
  // Số ở đầu khối bấm được → Danh mục đã lọc (thay nút "Xem đủ N nhiệm vụ" khi quá 15 mục của bản trước).
  const so = ds.length ? `<button type="button" class="nq-link" data-action="nqLocDanhMuc" data-loc="${locHtml({ canQuanTam: true })}" title="Xem trong Danh mục">${ds.length} nhiệm vụ</button>` : '';
  return khoiNq('Cần lãnh đạo quan tâm', so, than, 'rong', 'Nhiệm vụ chậm tiến độ, có vướng mắc, đề xuất hoặc ý kiến chỉ đạo chưa xử lý xong.');
}

export async function veTongQuan(el) {
  if (!nq.ky) { el.innerHTML = dauTrang('Tổng quan nhiệm vụ quý') + chuaCoKy(nq.quyen.quan_ly); return; }
  const hom = homNayVN();
  const d = demTheoTrangThai(nq.rows);
  const theoId = dongTheoId(); const spMap = spTheoNv(nq.sp);
  const con = soNgayGiua(hom, nq.ky.den_ngay);   // quý đã chốt: dòng phụ đã ghi "Quý đã chốt — chỉ xem"
  const conLai = nq.ky.trang_thai === 'DA_CHOT' ? '' : con > 0 ? `còn ${con} ngày đến hết quý` : con === 0 ? 'hôm nay là ngày cuối quý' : 'quý đã kết thúc';
  el.innerHTML = dauTrang('Tổng quan nhiệm vụ quý', { them: conLai })
    + `<section class="nq-tom-tat">${d.tong ? '' : '<p class="nq-cau">Quý này chưa có nhiệm vụ trong danh mục.</p>'}${oSoTongQuan(d)}</section>`
    + `<div class="nq-luoi">${khoiChiTieu(nq.sp, theoId)}${khoiTruc(nq.rows)}${khoiNghen(nq.rows, spMap)}${khoiTuanThang(nq.sp, theoId, hom)}`
    + `${khoiTheoNhom(nq.rows)}${khoiXuHuong(nq.tuans, d)}</div>`;
  ['nqNghen', ...DS_TUAN_THANG].forEach(apDanhSach);   // danh sách dài: chỉ các dòng đầu (bản in đủ dòng)
}
export const tenTruc = (so) => `Trục ${so} (${laMa(so)})`;
