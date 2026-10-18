// HTML bảng "Theo văn bản" (v3.25, mẫu TheoVanBan 16/10/2026): mỗi văn bản MỘT dòng (STT | Văn bản | Ngày nhận | Người giao | Nhiệm vụ | Tiến độ |
// Cảnh báo); bấm tên văn bản mở bảng con "Nhiệm vụ của văn bản | Chủ trì | Hạn xử lý | Trạng thái" — việc giao tiếp xuống lồng trong việc cha
// (thụt "↳"; nút gập riêng), minh chứng ghi dưới nhãn trạng thái; cuối bảng con: + Giao thêm nhiệm vụ, "đã nhập x / dự kiến y · rà soát" + Sửa.
// Giữ id / lớp e2e: #tvbVb-<vb> (data-mo / so / xong / qua / sap), .tvb-vb, .tvb-trich-yeu, .tvb-tien-chu, [data-truong=nguoi-giao], .tvb-ra-soat
// [data-canh-bao], #oRs-<vb>; #tvbNv-<id> (data-cap / nhom / mo) > .tvb-hang > .tvb-gap + button.tvb-nut (.chu-tri). Lớp viết nguyên văn.
import { escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { lopMep } from '../../../lib/kl/nhan.js';
import { hanO, trangThaiO, gioVN, vanBanNgan } from '../../../lib/kl/bang-o.js';
import { chiXem, nguoiGiaoVanBan, nguoiGiaoText } from '../../../lib/kl/pham-vi.js';
import { ownerText, NHAN_CHI_XEM } from '../kl/dong.js';

const xacNhan = (m) => (m.hop_le === null ? '<span class="tt-cho">chưa xác nhận</span>' : m.hop_le ? `<span class="tt-xong">hợp lệ — ${escapeHtml(m.xac_nhan_boi_ten || '')}</span>`
  : `<span class="tt-qua">không hợp lệ — ${escapeHtml(m.xac_nhan_boi_ten || '')}</span>`);
const laHtml = (m) => `<span class="tvb-la" data-id="${m.id}">${m.loai === 'chu_cu' ? 'Minh chứng cũ' : 'Minh chứng'} <b>${escapeHtml(m.so_hieu || 'không có số')}</b>${m.ngay_van_ban ? ` · ${formatNgay(m.ngay_van_ban)}` : ''} · ${xacNhan(m)}</span>`;

// Nhánh nhiệm vụ (một dòng của bảng con) — html các nhánh con và minh chứng do index.js truyền vào.
export function nhanhHtml(r, cap, { con, mc, mo, homNay }) {
  const me = state.user?.id; const tt = trangThaiO(r, me); const han = hanO(r, homNay); const coCon = Boolean(con);
  return `<div class="tvb-nhanh ${lopMep(r, me) || 'xam'}" id="tvbNv-${r.id}" data-id="${r.id}" data-cap="${cap}" data-nhom="${escapeHtml(r.nhom_dem || '')}" data-mo="${mo ? '1' : '0'}" style="--cap:${cap - 1}">
    <div class="tvb-hang">
      ${coCon ? `<button type="button" class="tvb-gap" data-action="tvbGap" data-khoa="nv-${r.id}" aria-expanded="${mo}" aria-label="${mo ? 'Thu gọn' : 'Mở rộng'} ${escapeHtml(r.ma)}"></button>` : '<i class="tvb-gap trong"></i>'}
      <button type="button" class="tvb-nut" data-action="tvbMoViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}" title="Bấm để xem chi tiết">
        <span class="bnv-c bnv-c-nv"><span class="ma">${cap > 1 ? '↳ ' : ''}${escapeHtml(r.ma)}${r.stt_van_ban ? `<small class="tvb-stt" title="Số thứ tự trong văn bản">·${String(r.stt_van_ban).padStart(2, '0')}</small>` : ''}</span><span class="nd">${escapeHtml(r.noi_dung)}${chiXem(r) ? NHAN_CHI_XEM : ''}</span></span>
        <span class="bnv-c chu-tri" data-nhan="Chủ trì">${escapeHtml(ownerText(r))}</span>
        <span class="bnv-c han" data-nhan="Hạn xử lý"><b>${escapeHtml(han.ngay)}</b><span>${escapeHtml(han.chu)}</span></span>
        <span class="bnv-c bnv-c-tt" data-nhan="Trạng thái"><span class="trang-thai ${tt.lop}">${escapeHtml(tt.chu)}</span>${mc.map(laHtml).join('')}</span></button>
    </div>
    <div class="tvb-con">${con || ''}</div></div>`;
}

// Cảnh báo của văn bản: n Đỏ đặc biệt · n quá hạn · n sắp đến hạn · Hoàn thành toàn bộ · Trong hạn.
function canhBaoHtml(t) {
  const ds = [t.ddb ? `<span class="trang-thai tt-ddb">${t.ddb} Đỏ đặc biệt</span>` : '', t.quaThuong ? `<span class="trang-thai tt-qua">${t.quaThuong} quá hạn</span>` : '',
    t.sap ? `<span class="trang-thai tt-cho">${t.sap} sắp đến hạn</span>` : '', t.n && t.xong === t.n ? '<span class="trang-thai tt-xong">Hoàn thành toàn bộ</span>' : ''].filter(Boolean);
  return ds.length ? ds.join('') : '<span class="bnv-phu">Trong hạn</span>';
}
// Cuối bảng con: + Giao thêm (mọi vai giao được — quyền thật ở giao_viec), rà soát + Sửa (người tạo văn bản, A1, quan_tri_kl — van_ban_dat_ra_soat).
function chanConHtml(d, sua) {
  const id = d.vb.van_ban_id; const y = d.h.so_nhiem_vu_du_kien;
  const giao = state.user?.role_group && !state.user?.bi_khoa && id ? `<button type="button" class="nut nho tvb-giao-them" data-action="giaoThemTuVanBan" data-vb="${escapeHtml(id)}">+ Giao thêm nhiệm vụ từ văn bản này</button>` : '';
  const rs = `<span class="trang-thai ${d.rs.canhBao ? 'tt-cho' : 'tt-xong'} tvb-ra-soat" data-canh-bao="${d.rs.canhBao ? '1' : '0'}">${escapeHtml(d.rs.dong)}</span>`;
  const nut = sua ? `<button type="button" class="nut nho" data-action="moO" data-o="oRs-${id}">Sửa</button>` : '';
  const form = sua ? `<form class="o" id="oRs-${id}" data-submit="tvbRaSoat" data-id="${id}"><input type="number" name="so" min="0" step="1" value="${y ?? ''}" placeholder="Số nhiệm vụ dự kiến" aria-label="Số nhiệm vụ dự kiến">
      <label class="gv-chon"><input type="checkbox" name="ra_soat"${d.h.da_ra_soat_toan_van ? ' checked' : ''}> Đã rà soát toàn văn</label>
      <button type="submit" class="nut chinh">Lưu</button><button type="button" class="nut" data-action="dongO" data-o="oRs-${id}">Huỷ</button></form>` : '';
  return `<div class="bnv-con-chan">${giao}<p class="tvb-ra-soat-dong">${rs}${nut}</p>${form}</div>`;
}

// Một văn bản: d = { vb (dòng đại diện), tatCa (mọi việc của văn bản đang xem), t (tongHopVanBan), rs (raSoatVanBan), h (văn bản), x (đã nhập) };
// o = { stt, mo, nhanh (html), sua }.
export function vanBanHtml(d, o) {
  const vb = vanBanNgan(d.vb); const id = d.vb.van_ban_id; const t = d.t; const pc = (k) => (t.n ? Math.round((k / t.n) * 100) : 0);
  const ng = nguoiGiaoVanBan(d.tatCa, (x) => findAccount(x)?.full_name); const y = d.h.so_nhiem_vu_du_kien;
  const nhap = gioVN(d.h.created_at).ngay;
  return `<section class="tvb-goc bnv-dong ${o.lop}" id="tvbVb-${id}" data-mo="${o.mo ? '1' : '0'}" data-so="${t.n}" data-xong="${t.xong}" data-qua="${t.qua}" data-sap="${t.sap}">
    <div class="bnv-hang">
      <span class="bnv-c bnv-c-stt">${o.stt}</span>
      <span class="bnv-c bnv-c-nv"><button type="button" class="tvb-mo-vb" data-action="tvbGap" data-khoa="vb-${id}" aria-expanded="${o.mo}"><span class="tvb-vb"><b>${escapeHtml(vb.ten)}</b></span></button>
        ${d.h.trich_yeu ? `<span class="tvb-trich-yeu">${escapeHtml(d.h.trich_yeu)}</span>` : ''}<span class="bnv-phu">${escapeHtml([vb.phu, nhap ? `nhập lên hệ thống ${nhap}` : ''].filter(Boolean).join(' · '))}</span></span>
      <span class="bnv-c" data-nhan="Ngày nhận">${d.h.ngay_nhan ? formatNgay(d.h.ngay_nhan) : '—'}</span>
      <span class="bnv-c" data-nhan="Người giao"><span data-truong="nguoi-giao">${ng.length ? escapeHtml(nguoiGiaoText(ng)) : 'chưa xác định'}</span></span>
      <span class="bnv-c" data-nhan="Nhiệm vụ"><span><b>${d.x}</b>${y !== null && y !== undefined ? ` / dự kiến ${y}` : ''}</span>${d.rs.chu ? `<span class="bnv-nhan canh">${escapeHtml(d.rs.chu)}</span>` : ''}</span>
      <span class="bnv-c" data-nhan="Tiến độ"><span class="tvb-thanh" role="img" aria-label="${t.xong} trên ${t.n} hoàn thành"><i class="luc" style="width:${pc(t.xong)}%"></i><i class="do" style="width:${pc(t.qua)}%"></i><i class="vang" style="width:${pc(t.sap)}%"></i></span>
        <span class="tvb-tien-chu">${t.xong}/${t.n} hoàn thành</span></span>
      <span class="bnv-c" data-nhan="Cảnh báo">${canhBaoHtml(t)}</span>
    </div>
    <div class="tvb-con bnv-con"><div class="bnv-con-dau" aria-hidden="true"><span>Nhiệm vụ của văn bản</span><span>Chủ trì</span><span>Hạn xử lý</span><span>Trạng thái</span></div>
      ${o.nhanh}${chanConHtml(d, o.sua)}</div></section>`;
}
