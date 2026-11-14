// Phân hệ Nhiệm vụ quý BTV — Quản lý danh mục quý (đầu mối tổng hợp, Chánh Văn phòng, tài khoản toàn quyền): thẻ "Quý, văn bản căn cứ" (tạo quý — sinh tuần
// báo cáo; hạn báo cáo kết quả; kế hoạch, văn bản điều chỉnh), "Nhập danh mục" (quan-ly-nhap.js), "Phân công" (quan-ly-phan-cong.js), "Đánh giá, chốt quý"
// (quan-ly-cuoi-quy.js), "Đầu mối, danh mục" (chỉ định đầu mối — Chánh Văn phòng / quản trị hệ thống; danh mục lãnh đạo phụ trách, đơn vị tham mưu).
import { notifyError, notifySuccess } from '../../components/toast.js';
import { state } from '../../lib/state.js';
import { nq, luuKy, luuVanBan, xoaVanBan, napDauMoi, datDauMoi, luuDanhMuc, napLichSuKy } from '../../lib/nvq/du-lieu.js';
import { tenKy, laMa } from '../../lib/nvq/nhan.js';
import { e, vn, dauTrang, tenNguoi, thoiGian } from './khung.js';
import { veNhap } from './quan-ly-nhap.js';
import { vePhanCong } from './quan-ly-phan-cong.js';
import { veCuoiQuy } from './quan-ly-cuoi-quy.js';

export const ql = { the: 'ky' };
const THE = [['ky', 'Quý, văn bản căn cứ'], ['nhap', 'Nhập danh mục'], ['phan-cong', 'Phân công'], ['cuoi-quy', 'Đánh giá, chốt quý'], ['danh-muc', 'Đầu mối, danh mục']];

function theKy() {
  const k = nq.ky; const nam = new Date().getFullYear();
  const quyMoi = k ? (k.quy % 4) + 1 : Math.floor(new Date().getMonth() / 3) + 1;   // chưa có quý nào → mặc định quý hiện tại
  const tao = `<form class="nq-form" data-submit="nqTaoKy"><h3>Tạo quý mới</h3><div class="nq-luoi-form">`
    + `<label class="nq-o-form"><span>Năm</span><input type="number" class="o-nhap nho" name="nam" min="2025" max="2100" value="${k ? (k.quy === 4 ? k.nam + 1 : k.nam) : nam}" required></label>`
    + `<label class="nq-o-form"><span>Quý</span><select class="o-nhap nho" name="quy">${[1, 2, 3, 4].map((q) => `<option value="${q}"${q === quyMoi ? ' selected' : ''}>Quý ${laMa(q)}</option>`).join('')}</select></label>`
    + '<label class="nq-o-form"><span>Hạn báo cáo kết quả</span><input type="date" class="o-nhap nho" name="han_bao_cao_ket_qua"></label></div>'
    + '<p class="chu-phu">Hệ thống tự tạo các tuần báo cáo của quý (kết thúc thứ Năm, hạn 11h00).</p><button type="submit" class="nut chinh">Tạo quý</button></form>';
  if (!k) return tao;
  const vb = nq.vanBan.map((v) => `<li><b>${e(v.so_ky_hieu)}</b>${v.ngay ? ` ngày ${vn(v.ngay)}` : ''} — ${v.loai === 'KE_HOACH' ? 'Kế hoạch' : v.loai === 'DIEU_CHINH' ? 'Văn bản điều chỉnh danh mục' : 'Khác'}`
    + `${v.trich_yeu ? `: ${e(v.trich_yeu)}` : ''} <button type="button" class="nq-link" data-action="nqXoaVanBan" data-id="${v.id}">Xoá</button></li>`).join('');
  return `<section class="nq-khoi rong"><h3>${e(tenKy(k))} · ${vn(k.tu_ngay)} – ${vn(k.den_ngay)} · ${k.trang_thai === 'DA_CHOT' ? 'đã chốt' : 'đang thực hiện'} · ${nq.tuans.length} tuần báo cáo</h3>`
    + `<form class="nq-form" data-submit="nqLuuKy"><div class="nq-luoi-form"><label class="nq-o-form"><span>Hạn báo cáo kết quả</span><input type="date" class="o-nhap nho" name="han_bao_cao_ket_qua" value="${k.han_bao_cao_ket_qua || ''}"></label>`
    + `<label class="nq-o-form rong"><span>Ghi chú</span><input class="o-nhap nho" name="ghi_chu" maxlength="1000" value="${e(k.ghi_chu || '')}"></label></div><button type="submit" class="nut">Lưu</button></form></section>`
    + `<section class="nq-khoi rong"><h3>Văn bản căn cứ của quý</h3>${vb ? `<ul class="nq-ds">${vb}</ul>` : '<p class="chu-phu">Chưa ghi văn bản căn cứ.</p>'}`
    + '<form class="nq-form" data-submit="nqThemVanBan"><div class="nq-luoi-form"><label class="nq-o-form"><span>Loại</span><select class="o-nhap nho" name="loai"><option value="KE_HOACH">Kế hoạch</option><option value="DIEU_CHINH">Văn bản điều chỉnh danh mục</option><option value="KHAC">Khác</option></select></label>'
    + '<label class="nq-o-form"><span>Số, ký hiệu</span><input class="o-nhap nho" name="so_ky_hieu" maxlength="100" required placeholder="193-KH/TU"></label><label class="nq-o-form"><span>Ngày</span><input type="date" class="o-nhap nho" name="ngay"></label>'
    + '<label class="nq-o-form rong"><span>Trích yếu</span><input class="o-nhap nho" name="trich_yeu" maxlength="1000"></label></div><button type="submit" class="nut">Thêm văn bản</button></form></section>'
    + `<section class="nq-khoi rong">${tao}</section><section class="nq-khoi rong" id="nqLsKy"><details><summary>Nhật ký thao tác của quý</summary><div data-nq-ls-ky>Đang tải…</div></details></section>`;
}

async function theDanhMuc() {
  const dm = await napDauMoi();
  const canBo = state.accounts.filter((a) => a.role_group !== 'A0' && !a.is_system).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
  const dauMoi = `<section class="nq-khoi rong"><h3>Đầu mối tổng hợp nhiệm vụ quý</h3><p class="chu-phu">Quản lý danh mục, phân công, chốt báo cáo tuần, đánh giá và chốt quý. Chánh Văn phòng luôn có quyền này.</p>`
    + (dm.length ? `<ul class="nq-ds">${dm.map((x) => `<li>${e(tenNguoi(x.tai_khoan))}${nq.quyen.phan_quyen ? ` <button type="button" class="nq-link" data-action="nqBoDauMoi" data-id="${x.tai_khoan}">Thôi chỉ định</button>` : ''}</li>`).join('')}</ul>` : '<p>Chưa chỉ định đầu mối.</p>')
    + (nq.quyen.phan_quyen ? `<form class="nq-form" data-submit="nqThemDauMoi"><label class="nq-o-form"><span>Cán bộ</span><select class="o-nhap nho" name="tai_khoan" required><option value="">— Chọn —</option>${canBo.map((a) => `<option value="${a.id}">${e(a.full_name)}</option>`).join('')}</select></label><button type="submit" class="nut">Chỉ định</button></form>` : '')
    + '</section>';
  const bangDm = (bang, ds, laLd) => `<section class="nq-khoi rong"><h3>${laLd ? 'Danh mục lãnh đạo phụ trách' : 'Danh mục đơn vị tham mưu, chủ trì'}</h3><p class="chu-phu">Từ nhận diện (cách nhau dấu phẩy): chữ thường dùng để nhận ra ${laLd ? 'chức danh' : 'đơn vị'} khi nhập danh mục.</p>`
    + [...ds, null].map((x) => `<form class="nq-form nq-dm-dong" data-submit="nqLuuDanhMuc" data-bang="${bang}"><input class="o-nhap nho" name="ma" value="${e(x?.ma || '')}" ${x ? 'readonly' : ''} placeholder="Mã (chữ hoa)" aria-label="Mã" maxlength="30" required>`
      + `<input class="o-nhap nho" name="ten" value="${e(x?.ten || '')}" placeholder="Tên" aria-label="Tên" maxlength="200" required><input type="number" class="o-nhap nho" name="thu_tu" value="${x?.thu_tu ?? ''}" aria-label="Thứ tự" placeholder="Thứ tự">`
      + `<input class="o-nhap nho" name="tu_khoa" value="${e((x?.tu_khoa || []).join(', '))}" aria-label="Từ nhận diện" placeholder="Từ nhận diện">`
      + (laLd ? `<label class="nq-hop"><input type="checkbox" name="thuong_truc"${x?.thuong_truc ? ' checked' : ''}> Thường trực</label><label class="nq-hop"><input type="checkbox" name="tap_the"${x?.tap_the ? ' checked' : ''}> Tập thể</label>` : '')
      + `<label class="nq-hop"><input type="checkbox" name="dang_dung"${!x || x.dang_dung ? ' checked' : ''}> Đang dùng</label><button type="submit" class="nut nho">${x ? 'Lưu' : 'Thêm'}</button></form>`).join('') + '</section>';
  return dauMoi + bangDm('lanh_dao', nq.lanhDao, true) + bangDm('don_vi', nq.donVi, false);
}

export async function veQuanLy(el, ds = {}) {
  if (ds.the) ql.the = ds.the;
  if (!nq.quyen.quan_ly && !nq.quyen.phan_quyen) { el.innerHTML = `${dauTrang('Quản lý danh mục quý')}<p>Đồng chí chưa được giao quản lý danh mục nhiệm vụ quý.</p>`; return; }
  if (!nq.quyen.quan_ly) ql.the = 'danh-muc';
  const nav = `<div class="nq-the-nav" role="tablist">${THE.filter(([k]) => nq.quyen.quan_ly || k === 'danh-muc').map(([k, t]) => `<button type="button" role="tab" class="nq-the-nut${ql.the === k ? ' chon' : ''}" aria-selected="${ql.the === k}" data-action="nqTheQuanLy" data-the="${k}">${e(t)}</button>`).join('')}</div>`;
  let than = '';
  if (ql.the === 'ky') than = theKy();
  else if (ql.the === 'danh-muc') than = await theDanhMuc();
  else if (!nq.ky) than = '<p>Tạo quý trước (thẻ "Quý, văn bản căn cứ").</p>';
  else if (ql.the === 'nhap') than = await veNhap();
  else if (ql.the === 'phan-cong') than = vePhanCong();
  else if (ql.the === 'cuoi-quy') than = veCuoiQuy();
  el.innerHTML = dauTrang('Quản lý danh mục quý') + nav + `<div class="nq-the-than">${than}</div>`;
  const ls = el.querySelector('[data-nq-ls-ky]');
  if (ls && nq.ky) napLichSuKy(nq.ky.id).then((d) => { ls.innerHTML = d.length ? `<ul class="nq-ds">${d.map((l) => `<li><small class="chu-phu">${thoiGian(l.luc)} · ${e(tenNguoi(l.nguoi))}</small> ${e(l.noi_dung)}</li>`).join('')}</ul>` : '<p class="chu-phu">Chưa có.</p>'; }).catch(() => { ls.textContent = ''; });
}

export function hanhDongQuanLy(veLai, napLaiSauGhi) {
  const chay = async (viec, tb, lamMoiDm = false) => { try { await viec(); notifySuccess(tb); await napLaiSauGhi({ lamMoiDanhMuc: lamMoiDm }); } catch (err) { notifyError(err.message); } };
  const f = (form) => Object.fromEntries(new FormData(form));
  return {
    nqTheQuanLy: ({ the }) => { ql.the = the; return veLai(); },
    nqTaoKy: (ds, form) => chay(async () => { const id = await luuKy(f(form)); nq.kyChon = id; }, 'Đã tạo quý và các tuần báo cáo.'),
    nqLuuKy: (ds, form) => chay(() => luuKy({ id: nq.ky.id, ...f(form) }), 'Đã lưu thông tin quý.'),
    nqThemVanBan: (ds, form) => chay(() => luuVanBan({ ky_id: nq.ky.id, ...f(form) }), 'Đã thêm văn bản căn cứ.'),
    nqXoaVanBan: ({ id }) => chay(() => xoaVanBan(id), 'Đã xoá văn bản căn cứ.'),
    nqThemDauMoi: (ds, form) => chay(() => datDauMoi(f(form).tai_khoan, true), 'Đã chỉ định đầu mối tổng hợp.', true),
    nqBoDauMoi: ({ id }) => chay(() => datDauMoi(id, false), 'Đã thôi chỉ định.', true),
    nqLuuDanhMuc: (ds, form) => {
      const x = f(form);
      return chay(() => luuDanhMuc(form.dataset.bang, { ...x, tu_khoa: String(x.tu_khoa || '').split(',').map((t) => t.trim()).filter(Boolean),
        thuong_truc: x.thuong_truc === 'on', tap_the: x.tap_the === 'on', dang_dung: x.dang_dung === 'on' }), 'Đã lưu danh mục.', true);
    },
  };
}
