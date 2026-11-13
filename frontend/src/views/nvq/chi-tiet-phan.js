// Phân hệ Nhiệm vụ quý BTV — các phần dưới của ngăn chi tiết: ý kiến chỉ đạo / trao đổi (luồng, trả lời, đánh dấu đã xử lý), các lần cập nhật tiến độ
// (tuần báo cáo, người ghi, nội dung, thay đổi kết quả / số liệu, vướng mắc, đề xuất, nguồn thông tin; người ghi sửa được nội dung khi tuần chưa chốt),
// tệp đính kèm (mở bằng đường dẫn ký 2 phút, gỡ), lịch sử thay đổi (gập).
import { state, findAccount } from '../../lib/state.js';
import { nq } from '../../lib/nvq/du-lieu.js';
import { duocTraoDoi, duocChiDao } from '../../lib/nvq/quyen.js';
import { tenTrangThaiSp, soVN } from '../../lib/nvq/nhan.js';
import { e, vn, tenNguoi, thoiGian } from './khung.js';

const timPhong = (id) => findAccount(id)?.department || null;
const vai = (id) => { const a = state.accounts.find((x) => x.id === id); return a?.role_group === 'A0' ? 'Thường trực' : a?.role_group === 'A1' ? 'Lãnh đạo Văn phòng' : ''; };

export function phanYKien({ r, yKien }) {
  const ky = nq.kys.find((k) => k.id === r.ky_id);
  const coTraoDoi = duocTraoDoi(r, state.user, nq.quyen, timPhong, ky);
  const goc = yKien.filter((y) => !y.tra_loi_cho);
  const con = (id) => yKien.filter((y) => y.tra_loi_cho === id);
  const mot = (y, laCon = false) => `<li class="nq-yk ${y.loai === 'CHI_DAO' ? 'chi-dao' : ''}${laCon ? ' con' : ''}${y.da_xong ? ' xong' : ''}">`
    + `<div class="nq-yk-dau"><b>${e(tenNguoi(y.nguoi_gui))}</b>${vai(y.nguoi_gui) ? ` <span class="chu-phu">${vai(y.nguoi_gui)}</span>` : ''}`
    + ` <small class="chu-phu">${thoiGian(y.gui_luc)}</small>${y.loai === 'CHI_DAO' ? ' <span class="nq-the-cd">Chỉ đạo</span>' : ''}${y.da_xong ? ' <span class="trang-thai tt-xong">Đã xử lý</span>' : ''}</div>`
    + `<p class="nq-yk-nd">${e(y.noi_dung)}</p>${y.han_tra_loi ? `<small class="chu-phu">Hạn trả lời ${vn(y.han_tra_loi)}</small>` : ''}`
    + (!laCon && coTraoDoi ? `<div class="nq-yk-nut"><button type="button" class="nq-link" data-action="nqTraLoi" data-id="${y.id}">Trả lời</button>`
      + (y.loai === 'CHI_DAO' && !y.da_xong && (y.nguoi_gui === state.user?.id || nq.quyen.quan_ly) ? ` · <button type="button" class="nq-link" data-action="nqXongYKien" data-id="${y.id}">Đánh dấu đã xử lý</button>` : '') + '</div>' : '')
    + (!laCon ? `<ul>${con(y.id).map((x) => mot(x, true)).join('')}</ul><form class="nq-tra-loi hidden" data-submit="nqGuiYKien" data-tra-loi="${y.id}">`
      + '<textarea class="o-nhap" name="noi_dung" rows="2" maxlength="2000" aria-label="Nội dung trả lời" required></textarea><button type="submit" class="nut nho">Gửi trả lời</button></form>' : '')
    + '</li>';
  const chiDao = duocChiDao(state.user, nq.quyen);
  const form = coTraoDoi ? `<form class="nq-form-yk" data-submit="nqGuiYKien"><label for="nqYKienMoi">${chiDao ? 'Ý kiến chỉ đạo' : 'Trao đổi'}</label>`
    + '<textarea id="nqYKienMoi" class="o-nhap" name="noi_dung" rows="3" maxlength="2000" required></textarea>'
    + (chiDao ? '<div class="nq-yk-tuy"><label class="nq-hop"><input type="checkbox" name="chi_dao" checked> Là ý kiến chỉ đạo</label><label>Hạn trả lời <input type="date" class="o-nhap nho" name="han_tra_loi"></label></div>' : '')
    + '<button type="submit" class="nut chinh">Gửi</button></form>' : '';
  return `<section class="nq-phan" id="nqPhanYKien"><h3>Ý kiến chỉ đạo, trao đổi${yKien.length ? ` (${yKien.length})` : ''}</h3>`
    + (goc.length ? `<ul class="nq-yk-ds">${goc.map((y) => mot(y)).join('')}</ul>` : '<p class="chu-phu">Chưa có ý kiến.</p>') + form + '</section>';
}

function thayDoiHtml(ds = []) {
  if (!ds.length) return '';
  return `<ul class="nq-td">${ds.map((x) => (x.so_lieu !== undefined
    ? `<li>Số liệu: ${e(x.mo_ta)} — <b>${soVN(x.so_lieu)}</b> ${e(x.don_vi_tinh || '')} (ngày ${vn(x.ngay_so_lieu)}${x.uoc_tinh ? ', ước tính' : ''})</li>`
    : `<li>${e(x.mo_ta)}: ${e(tenTrangThaiSp('', x.cu))} → <b>${e(tenTrangThaiSp('', x.moi))}</b>${x.kq ? ` (${e(x.kq)})` : ''}</li>`)).join('')}</ul>`;
}
export function phanCapNhat({ capNhat }) {
  const tuanChot = (c) => nq.tuans.find((w) => w.id === c.tuan_id)?.trang_thai === 'DA_CHOT';
  const ds = capNhat.map((c) => `<li class="nq-cn"><div class="nq-cn-dau"><b>${vn(c.ngay_bao_cao)}</b>${c.nvq_tuan ? ` · tuần ${c.nvq_tuan.so}` : ''} · ${e(tenNguoi(c.tao_boi))}`
    + `${c.sua_luc ? ' <small class="chu-phu">(đã sửa)</small>' : ''}${(c.tao_boi === state.user?.id && !tuanChot(c)) || nq.quyen.quan_ly ? ` <button type="button" class="nq-link" data-action="nqSuaCapNhat" data-id="${c.id}">Sửa</button>` : ''}</div>`
    + (c.khong_thay_doi ? '<p class="chu-phu">Không có thay đổi trong tuần.</p>' : '')
    + (c.noi_dung ? `<p>${e(c.noi_dung)}</p>` : '') + thayDoiHtml(c.thay_doi)
    + (c.vuong_mac ? `<p class="nq-vm"><b>Vướng mắc:</b> ${e(c.vuong_mac)}</p>` : '') + (c.de_xuat ? `<p class="nq-vm"><b>Đề xuất:</b> ${e(c.de_xuat)}</p>` : '')
    + (c.nguon_thong_tin ? `<small class="chu-phu">Nguồn: ${e(c.nguon_thong_tin)}</small>` : '') + '</li>').join('');
  return `<section class="nq-phan" id="nqPhanCapNhat"><h3>Các lần cập nhật tiến độ${capNhat.length ? ` (${capNhat.length})` : ''}</h3>${ds ? `<ol class="nq-cn-ds">${ds}</ol>` : '<p class="chu-phu">Chưa có lần cập nhật nào.</p>'}</section>`;
}
export function phanTep({ tep, sp }) {
  if (!tep.length) return '';
  return `<section class="nq-phan"><h3>Tệp đính kèm (${tep.length})</h3><ul class="nq-tep">${tep.map((t) => `<li><button type="button" class="nq-link" data-action="nqMoTep" data-duong="${e(t.duong_dan)}">${e(t.ten)}</button>`
    + `${t.san_pham_id ? ` <small class="chu-phu">${e((sp.find((s) => s.id === t.san_pham_id)?.mo_ta || '').slice(0, 60))}</small>` : ''} <small class="chu-phu">${e(tenNguoi(t.tai_boi))} · ${thoiGian(t.tai_luc)}</small>`
    + `${t.tai_boi === state.user?.id || nq.quyen.quan_ly ? ` <button type="button" class="nq-link" data-action="nqGoTep" data-id="${t.id}">Gỡ</button>` : ''}</li>`).join('')}</ul></section>`;
}
export function phanLichSu({ lichSu }) {
  if (!lichSu.length) return '';
  return `<details class="nq-phan nq-ls"><summary>Lịch sử thay đổi (${lichSu.length})</summary><ul>${lichSu.map((l) => `<li><small class="chu-phu">${thoiGian(l.luc)} · ${e(tenNguoi(l.nguoi))}</small><br>${e(l.noi_dung)}</li>`).join('')}</ul></details>`;
}
