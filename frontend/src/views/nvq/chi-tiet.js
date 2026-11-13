// Phân hệ Nhiệm vụ quý BTV — ngăn chi tiết một nhiệm vụ (mở cạnh màn đang xem, mọi màn của phân hệ; điện thoại: toàn màn). Phần đầu cho lãnh đạo nắm nhanh:
// trạng thái, mốc, KẾT QUẢ THỰC HIỆN mới nhất (chủ trì theo dõi ghi), vướng mắc / đề xuất; rồi thông tin giao, từng kết quả / sản phẩm (mốc, trạng thái, văn
// bản kết quả, số liệu chỉ tiêu), ý kiến chỉ đạo, các lần cập nhật, tệp, lịch sử (chi-tiet-phan.js). Nút theo quyền (lib/nvq/quyen.js). Đường dẫn
// "…/<màn>/NQ-<số>" (views/shell/duong-dan.js ghiViec / boViec). Biểu mẫu (cập nhật, sửa, phân công…) vẽ trong ngăn, "← Chi tiết" quay lại.
import { $, show } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { notifyError } from '../../components/toast.js';
import { nq, napChiTiet, timTheoMa, tinDaDoc } from '../../lib/nvq/du-lieu.js';
import { LOAI_SP, tenTrangThaiSp, lopTrangThaiSp, spXong, CHI_TIEU_CO_BAN, soVN, TINH_CHAT, NHOM, DANH_GIA, tenKy } from '../../lib/nvq/nhan.js';
import { mucChiTieu } from '../../lib/nvq/tinh.js';
import { duocCapNhat, duocTraoDoi } from '../../lib/nvq/quyen.js';
import { e, vn, nhanTrangThai, ghiMocHtml, tenChuTri, tenNguoi, tenPhong, donViDayDu, thoiGian } from './khung.js';
import { phanYKien, phanCapNhat, phanTep, phanLichSu } from './chi-tiet-phan.js';
import { ghiViec, boViec, boMaTrenDuong } from '../shell/duong-dan.js';

export const ct = { id: null, du: null, ma: '' };
const timPhong = (id) => findAccount(id)?.department || null;
export const coQuyenCapNhat = (r) => duocCapNhat(r, state.user, nq.quyen, timPhong, nq.kys.find((k) => k.id === r?.ky_id) || nq.ky);
export const dangMo = () => !$('nqNgan')?.classList.contains('hidden');

export function mountNgan() {
  if ($('nqNgan')) return;
  document.body.insertAdjacentHTML('beforeend', '<div id="nqNganNen" class="nq-ngan-nen hidden" data-action="nqDong"></div>'
    + '<aside id="nqNgan" class="nq-ngan hidden" role="dialog" aria-modal="false" aria-labelledby="nqNganTieuDe">'
    + '<div class="nq-ngan-dau"><h2 id="nqNganTieuDe">Nhiệm vụ quý</h2><button type="button" class="nut nho" data-action="nqDong" aria-label="Đóng chi tiết">Đóng</button></div>'
    + '<div id="nqNganThan" class="nq-ngan-than"></div></aside>');
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && dangMo()) dongNgan({ nguoiDung: true }); });
  document.addEventListener('doi-man', () => { if (dangMo()) dongNgan({ doiMan: true }); });
}
export function dongNgan({ nguoiDung = false, doiMan = false } = {}) {
  show('nqNgan', false); show('nqNganNen', false);
  document.body.classList.remove('nq-ngan-mo');
  if (!doiMan && ct.ma) boViec({ nguoiDung });
  ct.id = null; ct.du = null; ct.ma = '';
}

export async function moNhiemVuQuy(id, { cuon = '' } = {}) {
  mountNgan();
  ct.id = id;
  show('nqNgan', true); show('nqNganNen', true); document.body.classList.add('nq-ngan-mo');
  if (!ct.du || ct.du.r?.id !== id) $('nqNganThan').innerHTML = '<p class="chu-phu">Đang tải…</p>';
  try {
    const du = await napChiTiet(id);
    if (ct.id !== id) return;
    if (!du.r) { $('nqNganThan').innerHTML = '<p>Không có nhiệm vụ này.</p>'; return; }
    ct.du = du; ct.ma = du.r.ma;
    veChiTiet();
    ghiViec(du.r.ma);
    tinDaDoc(id).catch(() => null);
    if (cuon) $(cuon)?.scrollIntoView({ block: 'start' });
  } catch (err) { $('nqNganThan').innerHTML = `<p class="nq-chu-do">${e(err.message)}</p>`; }
}
// "…/<màn>/NQ-<số>" (tải lại, đường dẫn được gửi, Quay lại / Tiến tới).
export async function moTheoMaNvq(ma) {
  try {
    const r = await timTheoMa(ma);
    if (!r) { notifyError(`Không có nhiệm vụ quý ${ma}.`); boMaTrenDuong(); return; }
    await moNhiemVuQuy(r.id);
  } catch (err) { notifyError(err.message); boMaTrenDuong(); }
}
export const napLaiNgan = () => (ct.id ? moNhiemVuQuy(ct.id) : null);

function nutHanhDong(r) {
  const capNhat = coQuyenCapNhat(r); const q = nq.quyen; const ky = nq.kys.find((k) => k.id === r.ky_id);
  const ds = [];
  if (capNhat) ds.push('<button type="button" class="nut chinh" data-action="nqFormCapNhat">Cập nhật tiến độ</button>');
  if (duocTraoDoi(r, state.user, q, timPhong, ky)) ds.push(`<button type="button" class="nut" data-action="nqCuonYKien">${state.user?.role_group === 'A0' || state.user?.role_group === 'A1' ? 'Ý kiến chỉ đạo' : 'Trao đổi'}</button>`);
  if (capNhat) ds.push('<button type="button" class="nut" data-action="nqFormSanPham">Sửa kết quả, sản phẩm</button>');
  if (capNhat) ds.push('<label class="nut nq-tai-tep">Đính kèm tệp<input type="file" class="sr" data-nq-tep="" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"></label>');
  if (q.quan_ly && ky?.trang_thai !== 'DA_CHOT') {
    ds.push('<button type="button" class="nut" data-action="nqFormSua">Sửa thông tin nhiệm vụ</button>', '<button type="button" class="nut" data-action="nqFormPhanCong">Phân công</button>');
    ds.push(r.dieu_chinh === 'RUT' ? '<button type="button" class="nut" data-action="nqDieuChinh" data-loai="KHOI_PHUC">Khôi phục vào danh mục</button>'
      : '<button type="button" class="nut" data-action="nqDieuChinh" data-loai="RUT">Rút khỏi danh mục</button>');
  }
  if (capNhat && r.dieu_chinh !== 'RUT' && (q.quan_ly || !r.danh_gia || r.danh_gia_tu_dong)) ds.push(`<button type="button" class="nut" data-action="nqFormDanhGia">${q.quan_ly ? 'Đánh giá' : 'Đề xuất đánh giá'}</button>`);
  return ds.length ? `<div class="hanh-dong nq-nut">${ds.join('')}</div>` : '';
}

function spHtml(s, soLieu) {
  const ls = soLieu.filter((x) => x.san_pham_id === s.id).sort((a, b) => (a.ngay_so_lieu < b.ngay_so_lieu ? 1 : -1));
  const ct2 = s.loai === 'CHI_TIEU' ? (() => {
    const m = mucChiTieu(s);
    return `<div class="nq-sp-ct"><span>Mục tiêu <b>${soVN(s.muc_tieu) || '—'}</b> ${e(s.don_vi_tinh || '')}</span><span>Thực hiện <b>${s.thuc_hien === null || s.thuc_hien === undefined ? '—' : soVN(s.thuc_hien)}</b>`
      + `${s.thuc_hien_ngay ? ` <small>(ngày ${vn(s.thuc_hien_ngay)})</small>` : ''}</span><span class="trang-thai ${m.lop}">${e(m.ten)}</span></div>`
      + (ls.length ? `<details class="nq-sl"><summary>Diễn biến số liệu (${ls.length})</summary><ul>${ls.map((x) => `<li>${vn(x.ngay_so_lieu)}: <b>${soVN(x.gia_tri)}</b> ${e(s.don_vi_tinh || '')}${x.uoc_tinh ? ' (ước tính)' : ''}`
        + `${x.nguon ? ` — ${e(x.nguon)}` : ''} <small class="chu-phu">${e(tenNguoi(x.nhap_boi))}</small>${(x.nhap_boi === state.user?.id || nq.quyen.quan_ly) && coQuyenCapNhat(ct.du.r) ? ` <button type="button" class="nq-link" data-action="nqXoaSoLieu" data-id="${x.id}">Xoá</button>` : ''}</li>`).join('')}</ul></details>` : '');
  })() : '';
  const kq = spXong(s) && (s.kq_so_ky_hieu || s.kq_mo_ta || s.kq_ngay)
    ? `<p class="nq-sp-kq">${s.kq_so_ky_hieu ? `<b>${e(s.kq_so_ky_hieu)}</b>` : ''}${s.kq_ngay ? ` ngày ${vn(s.kq_ngay)}` : ''}${s.kq_co_quan ? ` · ${e(s.kq_co_quan)}` : ''}`
      + `${s.kq_trich_yeu ? ` — ${e(s.kq_trich_yeu)}` : ''}${s.kq_mo_ta ? `<br><span class="chu-phu">${e(s.kq_mo_ta)}</span>` : ''}</p>` : '';
  return `<li class="nq-sp ${lopTrangThaiSp(s)}"><div class="nq-sp-dau"><span class="nq-loai">${e(LOAI_SP[s.loai])}${s.chi_tieu_co_ban ? ` · ${e(CHI_TIEU_CO_BAN[s.chi_tieu_co_ban])}` : ''}</span>`
    + `<span class="trang-thai ${lopTrangThaiSp(s)}">${e(tenTrangThaiSp(s.loai, s.trang_thai))}</span></div><p>${e(s.mo_ta)}</p>`
    + `<small class="${s.so_ngay_qua > 0 ? 'nq-chu-do' : 'chu-phu'}">${s.han ? `Mốc ${vn(s.han)}` : 'Không có mốc'}${s.han_text ? ` (${e(s.han_text)})` : ''}${s.so_ngay_qua > 0 ? ` · chậm ${s.so_ngay_qua} ngày` : ''}`
    + `${spXong(s) && s.ngay_hoan_thanh ? ` · xong ${vn(s.ngay_hoan_thanh)}` : ''}</small>${ct2}${kq}</li>`;
}

export function veChiTiet() {
  const { r, sp, soLieu } = ct.du;
  const ky = nq.kys.find((k) => k.id === r.ky_id);
  $('nqNganTieuDe').textContent = `${r.so_hieu} · ${r.ma}`;
  const phoiHop = (r.phoi_hop_theo_doi || []).map(tenNguoi).join(', ');
  const dong = (nhan, gt) => (gt ? `<div><dt>${nhan}</dt><dd>${gt}</dd></div>` : '');
  $('nqNganThan').innerHTML = `<div class="nq-ct-dau">${nhanTrangThai(r)}${ghiMocHtml(r)}<span class="chu-phu">Trục ${r.truc_so} — ${e(r.truc_ten_ngan || '')} · ${e(NHOM[r.nhom])}`
    + `${ky ? ` · ${e(tenKy(ky))}` : ''}</span></div><p class="nq-ct-nd">${e(r.noi_dung)}</p>`
    + `<section class="nq-kq-moi"><h3>Kết quả thực hiện</h3>${r.ket_qua_thuc_hien ? `<p>${e(r.ket_qua_thuc_hien)}</p><small class="chu-phu">Cập nhật ${thoiGian(r.ket_qua_luc)}${r.ket_qua_boi ? ` · ${e(tenNguoi(r.ket_qua_boi))}` : ''}</small>`
      : '<p class="chu-phu">Chủ trì theo dõi chưa cập nhật kết quả.</p>'}`
    + `${r.vuong_mac ? `<p class="nq-vm"><b>Vướng mắc:</b> ${e(r.vuong_mac)}</p>` : ''}${r.de_xuat ? `<p class="nq-vm"><b>Đề xuất:</b> ${e(r.de_xuat)}</p>` : ''}`
    + `${r.danh_gia || r.danh_gia_de_xuat ? `<p class="nq-dg"><b>${r.danh_gia ? 'Đánh giá' : 'Đề xuất đánh giá'}:</b> ${e(DANH_GIA[r.danh_gia || r.danh_gia_de_xuat])}${r.danh_gia_ly_do ? ` — ${e(r.danh_gia_ly_do)}` : ''}${r.chuyen_ky_sau ? ' · chuyển sang quý sau' : ''}</p>` : ''}`
    + `${r.dieu_chinh === 'RUT' ? `<p class="nq-vm"><b>Rút khỏi danh mục:</b> ${e(r.dieu_chinh_ly_do || '')}</p>` : ''}</section>`
    + nutHanhDong(r)
    + '<dl class="nq-tt">' + dong('Lãnh đạo phụ trách', e(r.lanh_dao_text || '—')) + dong('Đơn vị tham mưu, chủ trì', e(r.don_vi_text || '—') + (r.don_vi?.length ? `<br><small class="chu-phu">${e(donViDayDu(r))}</small>` : ''))
    + dong('Kết quả/sản phẩm cần đạt được', e(r.ket_qua_can_dat || '—')) + dong('Tiến độ thực hiện/hoàn thành', `${e(r.tien_do_text || '—')} <small class="chu-phu">(${e(TINH_CHAT[r.tinh_chat])})</small>`)
    + dong('Chủ trì theo dõi', e(tenChuTri(r)) + (r.phong_theo_doi && r.chu_tri_theo_doi ? ` · ${e(tenPhong(r.phong_theo_doi))}` : '')) + dong('Phối hợp theo dõi', e(phoiHop))
    + '</dl>'
    + `<section class="nq-phan"><h3>Kết quả, sản phẩm (${sp.filter(spXong).length}/${sp.filter((s) => s.trang_thai !== 'KHONG_THUC_HIEN').length} hoàn thành)</h3><ul class="nq-sp-ds">${sp.map((s) => spHtml(s, soLieu)).join('')}</ul></section>`
    + phanYKien(ct.du) + phanCapNhat(ct.du) + phanTep(ct.du) + phanLichSu(ct.du);
}
