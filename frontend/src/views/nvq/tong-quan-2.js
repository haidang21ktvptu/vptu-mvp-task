// Phân hệ Nhiệm vụ quý BTV — Tổng quan quý (phần dưới): kết quả mới trong tuần, đến mốc trong tháng; bảng theo lãnh đạo phụ trách / đơn vị tham mưu,
// chủ trì / chủ trì theo dõi (cùng cột: Số nhiệm vụ · Hoàn thành · Đang thực hiện · Chậm tiến độ · Đã báo cáo tuần này); diễn biến qua các tuần đã chốt.
// v3.36 (CAU-HOI V-13, DESIGN mục 17): hai danh sách kết quả hiện 6 dòng đầu, nút "Xem tất cả" ở cuối (components/ds-gon.js — danh sách dựng đủ, bản
// in đủ dòng; thay giới hạn 12 / 15 dòng của bản trước); số kết quả ở đầu khối, số của "Đến mốc trong tháng" bấm được → Danh mục đã lọc; ghi chú mốc
// tính của khối ở nút "i" (khoiNq); tỉ lệ hoàn thành trong bảng đứng cùng dòng với số (nvq.css). Ba bảng theo nhóm và biểu đồ diễn biến là khối phân
// tích: rộng hết hàng, mặc định gập, mỗi khối một dòng có số chính (khoi-gap.js).
import { nq } from '../../lib/nvq/du-lieu.js';
import { tenTrangThaiSp } from '../../lib/nvq/nhan.js';
import { ketQuaTrongKhoang, denHanTrongKhoang, theoLanhDao, theoDonVi, theoChuTri, xuHuongTuan, tuanCua } from '../../lib/nvq/tinh.js';
import { dangKyDanhSach, nutHetHtml } from '../../components/ds-gon.js';
import { e, vn, vnNgan, khoiNq, linkNv, rutGon, tenNguoi, tenPhong } from './khung.js';
import { dauPhanTichNq, khoiGapNq } from './khoi-gap.js';

const SO_KQ_DAU = 6;   // hai danh sách kết quả: số dòng hiện sẵn
export const DS_TUAN_THANG = ['nqMoi', 'nqDenMoc'];   // tên danh sách (ds-gon) — veTongQuan gọi apDanhSach sau khi vẽ
DS_TUAN_THANG.forEach((ten) => dangKyDanhSach(ten, { vung: () => document.getElementById(ten), chon: ':scope > li', so: SO_KQ_DAU, donVi: 'kết quả' }));
const loc = (o) => e(JSON.stringify(o));
const cuoiThang = (iso) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export function khoiTuanThang(sp, theoId, hom) {
  const w = tuanCua(nq.tuans, hom);
  const tu = w ? w.tu_ngay : hom; const den = w ? w.den_ngay : hom;
  const moi = ketQuaTrongKhoang(sp, theoId, tu, den);
  const ds1 = moi.length ? `<ul class="nq-ds" id="nqMoi">${moi.map(({ s, r }) => `<li>${linkNv(r)} <span>${e(rutGon(s.mo_ta, 120))}</span>`
    + `${s.kq_so_ky_hieu ? ` — <b>${e(s.kq_so_ky_hieu)}</b>${s.kq_ngay ? ` ngày ${vn(s.kq_ngay)}` : ''}` : ''} <small class="chu-phu">${e(tenTrangThaiSp(s.loai, s.trang_thai))} ${vnNgan(s.ngay_hoan_thanh)}</small></li>`).join('')}</ul>`
    + nutHetHtml('nqMoi', moi.length, SO_KQ_DAU, 'kết quả')
    : '<p class="chu-phu">Trong tuần chưa có kết quả, sản phẩm mới hoàn thành.</p>';
  const thangDen = cuoiThang(hom);
  const den1 = denHanTrongKhoang(sp, theoId, hom.slice(0, 8) + '01', thangDen);
  const ds2 = den1.length ? `<ul class="nq-ds" id="nqDenMoc">${den1.map(({ s, r }) => `<li class="${s.so_ngay_qua > 0 ? 'qua' : ''}">${linkNv(r)} <span>${e(rutGon(s.mo_ta, 120))}</span>`
    + ` <small class="${s.so_ngay_qua > 0 ? 'nq-chu-do' : 'chu-phu'}">mốc ${vnNgan(s.han)}${s.so_ngay_qua > 0 ? ` · chậm ${s.so_ngay_qua} ngày` : ''}</small></li>`).join('')}</ul>`
    + nutHetHtml('nqDenMoc', den1.length, SO_KQ_DAU, 'kết quả')
    : '<p class="chu-phu">Không còn kết quả, sản phẩm nào đến mốc trong tháng.</p>';
  // Số ở đầu khối "Đến mốc" bấm được → Danh mục đã lọc theo tháng (thay nút "Xem đủ N kết quả" khi quá 15 dòng của bản trước).
  const soDen = den1.length ? `<button type="button" class="nq-link" data-action="nqLocDanhMuc" data-loc="${loc({ thang: hom.slice(0, 7) })}" title="Xem trong Danh mục">${den1.length} kết quả</button>` : '';
  return khoiNq('Kết quả mới trong tuần', moi.length ? `${moi.length} kết quả` : '', ds1, '', w ? `Kết quả, sản phẩm hoàn thành trong tuần ${w.so} (${vnNgan(tu)} – ${vn(den)}).` : '')
    + khoiNq(`Đến mốc trong tháng ${Number(hom.slice(5, 7))}`, soDen, ds2, '', 'Kết quả, sản phẩm chưa xong có mốc trong tháng.');
}

function bangNhom(ds, khoaLoc, giaTri, tieuDeCot) {
  if (!ds.length) return '<p class="chu-phu">Chưa có số liệu.</p>';
  return `<div class="bang-cuon"><table class="nq-bang-nho"><thead><tr><th>${e(tieuDeCot)}</th><th>Số nhiệm vụ</th><th>Hoàn thành</th><th>Đang thực hiện</th><th>Chậm tiến độ</th><th>Báo cáo tuần này</th></tr></thead><tbody>`
    + ds.map((x) => `<tr><td><button type="button" class="nq-link" data-action="nqLocDanhMuc" data-loc="${loc({ [khoaLoc]: giaTri(x) })}">${e(x.ten)}</button></td>`
      + `<td>${x.tong}</td><td>${x.hoanThanh} <small class="chu-phu">(${x.tyLe}%)</small></td><td>${x.dang}</td><td>${x.cham ? `<b class="nq-chu-do">${x.cham}</b>` : 0}</td>`
      + `<td>${x.mo ? `${x.daCapNhatTuan}/${x.mo}` : '—'}</td></tr>`).join('') + '</tbody></table></div>';
}
export function khoiTheoNhom(rows) {
  const ld = theoLanhDao(rows, nq.lanhDao);
  const dv = theoDonVi(rows, nq.donVi);
  const ct = theoChuTri(rows, tenNguoi, tenPhong);
  return dauPhanTichNq()
    + khoiGapNq('nqTheoLanhDao', 'Theo lãnh đạo phụ trách', ld.length ? `${ld.length} đồng chí` : '', bangNhom(ld, 'lanhDao', (x) => x.ma, 'Lãnh đạo phụ trách'), 'Nhiệm vụ do Thường trực Tỉnh ủy phụ trách chung được tính cho từng đồng chí.')
    + khoiGapNq('nqTheoDonVi', 'Theo đơn vị tham mưu, chủ trì', dv.length ? `${dv.length} đơn vị` : '', bangNhom(dv, 'donVi', (x) => x.ma, 'Đơn vị'))
    + khoiGapNq('nqTheoChuTri', 'Theo chủ trì theo dõi', ct.length ? `${ct.length} chủ trì` : '', bangNhom(ct, 'chuTri', (x) => x.khoa || 'chua', 'Chủ trì theo dõi'), 'Cán bộ Văn phòng cập nhật tiến độ.');
}

// Cột theo tuần đã chốt: phần hoàn thành / chậm tiến độ trên tổng (ảnh chụp khi chốt), và tuần hiện tại (số liệu đang có).
export function khoiXuHuong(tuans, d) {
  const ds = xuHuongTuan(tuans);
  const hien = { so: 'nay', hoanThanh: d.HOAN_THANH, cham: d.CHAM_TIEN_DO, tong: d.tong };
  const cot = [...ds, hien];
  const max = Math.max(1, ...cot.map((x) => x.tong));
  const than = `<div class="nq-xh" role="img" aria-label="${e(cot.map((x) => `${x.so === 'nay' ? 'Hiện tại' : `Tuần ${x.so}`}: ${x.hoanThanh} hoàn thành, ${x.cham} chậm tiến độ`).join('; '))}">`
    + cot.map((x) => `<div class="nq-xh-cot"><div class="nq-xh-thanh" style="height:${(100 * x.tong) / max}%"><span class="nq-do" style="height:${x.tong ? (100 * x.cham) / x.tong : 0}%"></span>`
      + `<span class="nq-luc" style="height:${x.tong ? (100 * x.hoanThanh) / x.tong : 0}%"></span></div><b>${x.hoanThanh}</b><small>${x.so === 'nay' ? 'Hiện tại' : `T${x.so}`}</small></div>`).join('')
    + '</div><p class="nq-chu-giai"><span class="nq-luc"></span>Hoàn thành (số trên cột) <span class="nq-do"></span>Chậm tiến độ</p>';
  return khoiGapNq('nqDienBien', 'Diễn biến qua các tuần', ds.length ? `${ds.length} tuần đã chốt` : 'chưa chốt tuần nào', than, ds.length ? 'Theo số liệu chốt báo cáo tuần.' : 'Chưa chốt báo cáo tuần nào; cột "Hiện tại" là số liệu đang có.');
}
