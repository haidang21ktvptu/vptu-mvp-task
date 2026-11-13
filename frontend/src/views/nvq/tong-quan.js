// Phân hệ Nhiệm vụ quý BTV — Tổng quan quý: trang để LÃNH ĐẠO nắm ngay tình hình (chủ dự án 13/11/2026: "cán bộ chủ trì theo dõi là người cập nhật
// chính, lãnh đạo chỉ nhìn các chỉ tiêu và nắm thông tin đã cập nhật"). Thứ tự: một câu tóm tắt → ô số → 05 chỉ tiêu cơ bản → tiến độ 6 trục → việc cần
// lãnh đạo quan tâm (CV 1400 CN-5.2: đơn vị đang chậm, số ngày trễ, sản phẩm còn thiếu, lãnh đạo phụ trách) → kết quả mới trong tuần, đến mốc trong tháng
// → theo lãnh đạo phụ trách, đơn vị tham mưu, chủ trì theo dõi → diễn biến các tuần (tong-quan-2.js). Mọi số / tên bấm được → Danh mục đã lọc / ngăn chi tiết.
import { homNayVN } from '../../lib/kl/ngay.js';
import { nq, dongTheoId } from '../../lib/nvq/du-lieu.js';
import { CHI_TIEU_CO_BAN, soVN, laMa } from '../../lib/nvq/nhan.js';
import { demTheoTrangThai, cauTomTat, theoTruc, diemNghen, chiTieuCoBan, mucChiTieu, spTheoNv } from '../../lib/nvq/tinh.js';
import { e, vn, dauTrang, chuaCoKy, oSo, thanh, linkNv, rutGon, tenDonVi, tenLanhDao, tenChuTri } from './khung.js';
import { khoiTuanThang, khoiTheoNhom, khoiXuHuong } from './tong-quan-2.js';

const khoi = (tieuDe, phu, than, lop = '') => `<section class="nq-khoi ${lop}"><div class="nq-khoi-dau"><h2>${e(tieuDe)}</h2>${phu ? `<span class="chu-phu">${phu}</span>` : ''}</div>${than}</section>`;
export const locHtml = (loc) => e(JSON.stringify(loc));

function oSoTongQuan(d) {
  return oSo([
    { khoa: '{}', nhan: 'nhiệm vụ trong danh mục', so: d.tong },
    { khoa: '{"trangThai":"HOAN_THANH"}', nhan: 'hoàn thành', so: d.HOAN_THANH, lop: 'nq-o-luc' },
    { khoa: '{"trangThai":"DANG_THUC_HIEN"}', nhan: 'đang thực hiện', so: d.DANG_THUC_HIEN, lop: 'nq-o-lam' },
    { khoa: '{"trangThai":"THUONG_XUYEN"}', nhan: 'thường xuyên', so: d.THUONG_XUYEN, lop: 'nq-o-lam' },
    { khoa: '{"trangThai":"CHAM_TIEN_DO"}', nhan: 'chậm tiến độ', so: d.CHAM_TIEN_DO, lop: 'nq-o-do' },
    { khoa: '{"trangThai":"CHUA_TRIEN_KHAI"}', nhan: 'chưa triển khai', so: d.CHUA_TRIEN_KHAI, lop: 'nq-o-xam' },
    { khoa: '{"chuaCapNhat":true}', nhan: 'chưa có báo cáo tuần này', so: d.chuaCapNhatTuan, lop: d.chuaCapNhatTuan ? 'nq-o-vang' : '' },
  ], 'nqLocDanhMuc');
}

function khoiChiTieu(sp, theoId) {
  const ds = chiTieuCoBan(sp, theoId);
  const the = ds.flatMap(({ ma, ds: con }) => (con.length ? con : [null]).map((x) => {
    if (!x) return `<div class="nq-ct nq-ct-trong"><b>${e(CHI_TIEU_CO_BAN[ma])}</b><span class="chu-phu">Chưa gắn chỉ tiêu trong danh mục quý.</span></div>`;
    const { s, r } = x; const m = mucChiTieu(s);
    const pt = s.ty_le_muc_tieu !== null && s.ty_le_muc_tieu !== undefined ? Math.min(100, Number(s.ty_le_muc_tieu)) : null;
    return `<button type="button" class="nq-ct" data-action="nqMo" data-id="${r.id}"><b>${e(CHI_TIEU_CO_BAN[ma])}</b><span class="nq-ct-mt">${e(s.mo_ta)}</span>`
      + `<span class="nq-ct-so"><span>Mục tiêu <b>${soVN(s.muc_tieu)}</b> ${e(s.don_vi_tinh || '')}</span><span>Thực hiện <b>${s.thuc_hien === null || s.thuc_hien === undefined ? '—' : soVN(s.thuc_hien)}</b> ${s.thuc_hien === null || s.thuc_hien === undefined ? '' : e(s.don_vi_tinh || '')}</span></span>`
      + (pt !== null ? `<span class="nq-ct-thanh"><span style="width:${pt}%"></span></span>` : '')
      + `<span class="trang-thai ${m.lop}">${e(m.ten)}</span>${s.thuc_hien_ngay ? `<small class="chu-phu">Số liệu ngày ${vn(s.thuc_hien_ngay)}${s.thuc_hien_nguon ? ` · ${e(s.thuc_hien_nguon)}` : ''}</small>` : ''}</button>`;
  })).join('');
  return khoi('05 chỉ tiêu cơ bản', 'Theo số liệu chủ trì theo dõi đã cập nhật', `<div class="nq-ct-luoi">${the}</div>`, 'rong');
}

function khoiTruc(rows) {
  const ds = theoTruc(rows, nq.truc);
  const than = ds.map((t) => `<button type="button" class="nq-truc" data-action="nqLocDanhMuc" data-loc="${locHtml({ truc: t.so })}">`
    + `<span class="nq-truc-ten"><b>Trục ${t.so}</b> ${e(t.tenNgan)}</span>`
    + thanh([{ so: t.hoanThanh, lop: 'nq-luc', nhan: 'hoàn thành' }, { so: t.dang, lop: 'nq-lam', nhan: 'đang thực hiện' }, { so: t.cham, lop: 'nq-do', nhan: 'chậm tiến độ' },
      { so: t.chua, lop: 'nq-xam', nhan: 'chưa triển khai' }], t.tong)
    + `<span class="nq-truc-so">${t.hoanThanh}/${t.tong} hoàn thành${t.cham ? ` · <b class="nq-chu-do">${t.cham} chậm</b>` : ''}</span></button>`).join('');
  const chuGiai = '<p class="nq-chu-giai"><span class="nq-luc"></span>Hoàn thành <span class="nq-lam"></span>Đang thực hiện <span class="nq-do"></span>Chậm tiến độ <span class="nq-xam"></span>Chưa triển khai</p>';
  return khoi('Tiến độ theo 6 trục kết quả trọng tâm', '', `${than || '<p class="chu-phu">Chưa có nhiệm vụ.</p>'}${chuGiai}`);
}

function khoiNghen(rows, spMap) {
  const ds = diemNghen(rows, spMap);
  const than = ds.length ? `<ol class="nq-nghen">${ds.slice(0, 15).map(({ r, conThieu }) => `<li class="${r.muc === 'DO_DAC_BIET' ? 'ddb' : r.so_ngay_qua > 0 ? 'do' : 'vang'}">`
    + `<div class="nq-nghen-dau">${linkNv(r)} <span>${e(rutGon(r.noi_dung, 170))}</span></div>`
    + '<dl>'
    + `<div><dt>Đơn vị tham mưu, chủ trì</dt><dd>${e(tenDonVi(r))}</dd></div>`
    + `<div><dt>Tiến độ</dt><dd>${r.so_ngay_qua > 0 ? `<b class="nq-chu-do">Chậm ${r.so_ngay_qua} ngày</b> (mốc ${vn(r.han_gan_nhat)})` : r.han_gan_nhat ? `Mốc gần nhất ${vn(r.han_gan_nhat)}` : 'Thường xuyên'}</dd></div>`
    + `<div><dt>Còn thiếu</dt><dd>${conThieu.length ? e(conThieu.map((s) => rutGon(s.mo_ta, 90)).join('; ')) : '—'}</dd></div>`
    + `<div><dt>Lãnh đạo phụ trách</dt><dd>${e(tenLanhDao(r))}</dd></div>`
    + '</dl>'
    + (r.vuong_mac ? `<p class="nq-vm"><b>Vướng mắc:</b> ${e(rutGon(r.vuong_mac, 300))}</p>` : '') + (r.de_xuat ? `<p class="nq-vm"><b>Đề xuất:</b> ${e(rutGon(r.de_xuat, 300))}</p>` : '')
    + (r.so_chi_dao_mo ? `<p class="nq-vm"><b>${r.so_chi_dao_mo} ý kiến chỉ đạo chưa xử lý xong</b></p>` : '')
    + `<small class="chu-phu">Chủ trì theo dõi: ${e(tenChuTri(r))}${r.ket_qua_luc ? ` · cập nhật ${vn(String(r.ket_qua_luc).slice(0, 10))}` : ''}</small></li>`).join('')}</ol>`
    + (ds.length > 15 ? `<button type="button" class="nut nho" data-action="nqLocDanhMuc" data-loc="${locHtml({ canQuanTam: true })}">Xem đủ ${ds.length} nhiệm vụ</button>` : '')
    : '<p class="nq-on">Không có nhiệm vụ chậm tiến độ, vướng mắc hay đề xuất cần lãnh đạo xem xét.</p>';
  return khoi('Cần lãnh đạo quan tâm', ds.length ? `${ds.length} nhiệm vụ chậm tiến độ, có vướng mắc / đề xuất hoặc chỉ đạo chưa xong` : '', than, 'rong');
}

export async function veTongQuan(el) {
  if (!nq.ky) { el.innerHTML = dauTrang('Tổng quan nhiệm vụ quý') + chuaCoKy(nq.quyen.quan_ly); return; }
  const hom = homNayVN();
  const d = demTheoTrangThai(nq.rows);
  const theoId = dongTheoId(); const spMap = spTheoNv(nq.sp);
  const tuanCap = d.mo ? `Báo cáo tuần này: ${d.daCapNhatTuan}/${d.mo} nhiệm vụ đang thực hiện đã được chủ trì theo dõi cập nhật.` : '';
  el.innerHTML = dauTrang('Tổng quan nhiệm vụ quý')
    + `<section class="nq-tom-tat"><p class="nq-cau">${e(cauTomTat(d, nq.ky, hom))}</p>${tuanCap ? `<p class="chu-phu">${e(tuanCap)}</p>` : ''}${oSoTongQuan(d)}</section>`
    + `<div class="nq-luoi">${khoiChiTieu(nq.sp, theoId)}${khoiTruc(nq.rows)}${khoiNghen(nq.rows, spMap)}${khoiTuanThang(nq.sp, theoId, hom)}`
    + `${khoiTheoNhom(nq.rows)}${khoiXuHuong(nq.tuans, d)}</div>`;
}
export const tenTruc = (so) => `Trục ${so} (${laMa(so)})`;
