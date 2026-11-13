// Phân hệ Nhiệm vụ quý BTV: một dòng nhiệm vụ của bảng danh mục (đúng cột bảng Phụ lục + Kết quả thực hiện, Trạng thái, Chủ trì theo dõi) và danh sách
// kết quả / sản phẩm thu gọn (dấu trạng thái từng cái). Màn hẹp: mỗi dòng thành thẻ, ô có nhãn (data-nhan — nvq.css).
import { nq } from '../../lib/nvq/du-lieu.js';
import { NHOM, laMa, tenTrangThaiSp, lopTrangThaiSp, spXong, LOAI_SP, soVN, lopMep } from '../../lib/nvq/nhan.js';
import { e, vn, nhanTrangThai, ghiMocHtml, tenChuTri, tenNguoi, rutGon, thoiGian } from './khung.js';

export function spMiniHtml(ds = []) {
  if (!ds.length) return '<span class="chu-phu">—</span>';
  return `<ul class="nq-sp-mini">${ds.map((s) => {
    const kq = spXong(s) && s.kq_so_ky_hieu ? ` <b>${e(s.kq_so_ky_hieu)}</b>` : '';
    const ct = s.loai === 'CHI_TIEU' && s.muc_tieu !== null && s.muc_tieu !== undefined
      ? ` <small>(${s.thuc_hien !== null && s.thuc_hien !== undefined ? `${soVN(s.thuc_hien)}/` : 'mục tiêu '}${soVN(s.muc_tieu)} ${e(s.don_vi_tinh || '')})</small>` : '';
    return `<li class="${lopTrangThaiSp(s)}" title="${e(`${LOAI_SP[s.loai]} — ${tenTrangThaiSp(s.loai, s.trang_thai)}${s.han ? `, mốc ${vn(s.han)}` : ''}`)}">`
      + `<i aria-hidden="true"></i><span>${e(rutGon(s.mo_ta, 110))}${ct}${kq}</span><span class="sr">: ${e(tenTrangThaiSp(s.loai, s.trang_thai))}</span></li>`;
  }).join('')}</ul>`;
}

export function dongHtml(r, sp = [], { chon = false } = {}) {
  const phoiHop = (r.phoi_hop_theo_doi || []).map(tenNguoi).join(', ');
  const kq = r.ket_qua_thuc_hien
    ? `<div class="nq-kq">${e(rutGon(r.ket_qua_thuc_hien, 260))}</div><small class="chu-phu">${r.ket_qua_luc ? `Cập nhật ${thoiGian(r.ket_qua_luc)}` : ''}</small>`
    : '<span class="chu-phu">Chưa có kết quả cập nhật.</span>';
  const tuan = r.trang_thai !== 'HOAN_THANH' && r.trang_thai !== 'RUT'
    ? `<small class="${r.cap_nhat_tuan_nay ? 'nq-chu-luc' : 'nq-chu-vang'}">${r.cap_nhat_tuan_nay ? 'Đã báo cáo tuần này' : 'Chưa báo cáo tuần này'}</small>` : '';
  // Chế độ chọn (phân công nhiều việc): dòng không bấm mở — ô chọn cần thao tác riêng; mở bằng nút mã việc ở ô Stt.
  return `<tr class="nq-dong ${lopMep(r)}${r.trang_thai === 'RUT' ? ' nq-rut' : ''}"${chon ? '' : ` data-action="nqMo" data-id="${r.id}" tabindex="0"`}>`
    + (chon ? `<td class="nq-chon" data-nhan="Chọn"><input type="checkbox" data-nq-chon="${r.id}" aria-label="Chọn ${e(r.so_hieu)}"></td>` : '')
    + `<td class="nq-stt" data-nhan="Stt"><b>(${r.stt})</b>${chon ? `<button type="button" class="nq-link" data-action="nqMo" data-id="${r.id}">${e(r.ma)}</button>` : `<small class="chu-phu">${e(r.ma)}</small>`}</td>`
    + `<td class="nq-nd" data-nhan="Nhiệm vụ được giao">${e(rutGon(r.noi_dung, 320))}</td>`
    + `<td data-nhan="Lãnh đạo phụ trách">${e(rutGon(r.lanh_dao_text || '', 160))}</td>`
    + `<td data-nhan="Đơn vị tham mưu, chủ trì">${e(rutGon(r.don_vi_text || '', 160))}</td>`
    + `<td class="nq-cot-sp" data-nhan="Kết quả/sản phẩm cần đạt được">${spMiniHtml(sp)}</td>`
    + `<td data-nhan="Tiến độ">${e(r.tien_do_text || '')}</td>`
    + `<td class="nq-cot-kq" data-nhan="Kết quả thực hiện">${kq}</td>`
    + `<td data-nhan="Trạng thái">${nhanTrangThai(r)}${ghiMocHtml(r)}${tuan}${r.vuong_mac ? '<small class="nq-chu-do">Có vướng mắc</small>' : ''}</td>`
    + `<td data-nhan="Chủ trì theo dõi">${e(tenChuTri(r))}${phoiHop ? `<small class="chu-phu">Phối hợp: ${e(phoiHop)}</small>` : ''}</td></tr>`;
}
const COT = ['Stt', 'Nhiệm vụ được giao', 'Lãnh đạo phụ trách', 'Đơn vị tham mưu, chủ trì', 'Kết quả/sản phẩm cần đạt được', 'Tiến độ', 'Kết quả thực hiện', 'Trạng thái', 'Chủ trì theo dõi'];
export const soCot = (chon) => COT.length + (chon ? 1 : 0);
export const dauBangHtml = (chon = false) => `<thead><tr>${chon ? '<th class="nq-chon"><span class="sr">Chọn</span></th>' : ''}${COT.map((c) => `<th>${c}</th>`).join('')}</tr></thead>`;

// Thân bảng nhóm theo trục → nhóm (như bảng Phụ lục), dòng đã sắp theo vị trí.
export function thanBangHtml(rows, spMap, { chon = false } = {}) {
  let truc = null; let nhom = null; const ra = [];
  const n = soCot(chon);
  rows.forEach((r) => {
    if (r.truc_so !== truc) {
      truc = r.truc_so; nhom = null;
      const t = nq.truc.find((x) => x.so === r.truc_so);
      ra.push(`<tr class="nq-nhom-truc"><td colspan="${n}">${laMa(r.truc_so)}. Các nhiệm vụ thuộc trục ${r.truc_so}: ${e(t?.ten || r.truc_ten_ngan || '')}</td></tr>`);
    }
    if (r.nhom !== nhom) { nhom = r.nhom; ra.push(`<tr class="nq-nhom-con"><td colspan="${n}">${r.nhom === 'TRONG_CT' ? 1 : 2}. ${e(NHOM[r.nhom])}</td></tr>`); }
    ra.push(dongHtml(r, spMap.get(r.id) || [], { chon }));
  });
  return ra.join('');
}
