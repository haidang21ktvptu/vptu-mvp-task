// "Việc của tôi" — phần "Nhiệm vụ theo văn bản gốc" (v3.23.1, chủ dự án 13/10/2026): mọi việc xếp theo văn bản gốc giao việc, mỗi văn bản một
// khối gập / mở (loại · số · ngày, trích yếu, người giao = tài khoản đã giao việc từ văn bản, x/n hoàn thành); phạm vi "Phạm vi của tôi" (dh.rows —
// việc RLS cho tôi xử lý) / "Toàn Văn phòng" (dh.tatCa — khi bật cấu hình xem toàn bộ, 0103); ô số theo trạng thái; tìm; lọc cán bộ chủ trì /
// người theo dõi. Mỗi việc MỘT dòng tối giản (id #vctDong-<id>), "Chi tiết" mở thông tin + thao tác (Cập nhật, Nộp minh chứng, Đề nghị sửa — các
// hộp dùng chung; Mở ngăn chi tiết). Việc ngoài phạm vi chỉ xem. Không ô nhập trong dòng (không trùng id với thẻ "Cần xử lý ngay").
import { $, setText, escapeHtml } from '../../lib/dom.js';
import { state, findAccount } from '../../lib/state.js';
import { formatNgay, ghiChuHan, homNayVN } from '../../lib/kl/ngay.js';
import { nhanTrangThai, boSoThuTu, lopQuaHan, laBenNop } from '../../lib/kl/nhan.js';
import { nhanPhuHtml } from '../../lib/kl/do-khan.js';
import { locRows } from '../../lib/kl/tong-hop.js';
import { chiXem, locCanBo, tuyChonCanBo, nhomTheoVanBan, vanBanGocText, nguoiGiaoVanBan, nguoiGiaoText, tienDoVanBan } from '../../lib/kl/pham-vi.js';
import { duocNopMinhChung } from '../../lib/kl/minh-chung.js';
import { cheDoTang } from '../../lib/kl/sua-tang.js';
import { tenLoaiVanBan } from '../shared/kl/them-owner.js';
import { duocCapNhat, ownerText, NHAN_CHI_XEM } from '../shared/kl/dong.js';
import { daGuiVuongMacHtml } from '../shared/kl/thong-tin-giao.js';
import { dh } from '../shared/dieu-hanh/du-lieu.js';
import { mo, quaHan, choNghiemThu, dnsCho } from './viec-cua-toi.js';

// pham: 'toi' | 'toan'; trangThai: khoá TT; moNhom: khoá `${pham}:${văn bản}` → mở / gập (mặc định: phạm vi của tôi mở, toàn Văn phòng gập).
export const vbc = { pham: 'toi', trangThai: 'mo', loc: { chuTri: '', theoDoi: '' }, tuKhoa: '', vanBan: new Map(), moNhom: new Map(), chiTiet: new Set() };
const TT = [['mo', 'Đang thực hiện'], ['qua-han', 'Quá hạn'], ['xong', 'Đã hoàn thành'], ['tat-ca', 'Tất cả']];
const LOC_TT = { mo, 'qua-han': quaHan, xong: (r) => !mo(r), 'tat-ca': () => true };
const ten = (id) => findAccount(id)?.full_name || '';
export const coToanVP = () => dh.tatCa.length > dh.rows.length;   // có việc ngoài phạm vi đọc được (cấu hình xem toàn bộ bật)
const toanVP = () => vbc.pham === 'toan' && coToanVP();
const coSo = () => (toanVP() ? dh.tatCa : dh.rows);
const daLoc = () => locCanBo(vbc.tuKhoa ? locRows(coSo(), { tuKhoa: vbc.tuKhoa }) : coSo(), vbc.loc);   // trước lọc trạng thái
// Mặc định: phạm vi của tôi mở; toàn Văn phòng gập — trừ khi đang tìm / lọc (mở để thấy ngay việc khớp).
const moNhom = (khoa) => { const k = `${vbc.pham}:${khoa}`; return vbc.moNhom.has(k) ? vbc.moNhom.get(k) : !toanVP() || Boolean(vbc.tuKhoa || vbc.loc.chuTri || vbc.loc.theoDoi); };
const lopTT = (r) => (r.nhom_dem === 'HOAN_THANH' ? 'tt-xong' : laBenNop(r, state.user?.id) ? 'tt-cho' : ['QUA_HAN', 'QUA_HAN_NGHIEM_THU', 'DANG_DINH_CHINH'].includes(r.nhom_dem) ? lopQuaHan(r) : 'tt-cho');
const nut = (r, nhan, action, lop = '') => `<button type="button" class="nut nho ${lop}" data-action="${action}" data-id="${r.id}">${nhan}</button>`;

// Đề nghị sửa: đã có đề nghị của tôi đang chờ → nút Rút (như thẻ "Cần xử lý ngay"), không gửi đề nghị thứ hai.
const nutDns = (r) => { const d = dnsCho(r.id); if (d) return `<button type="button" class="nut nho" data-action="dnsRut" data-id="${d.id}" data-nv="${r.id}">Rút đề nghị sửa</button>`;
  return cheDoTang(r) === 'de-nghi' ? nut(r, 'Đề nghị sửa', 'moDeNghiSua') : ''; };
function themHtml(r, ro) {
  const o = (nhan, gt) => (gt ? `<dt>${nhan}</dt><dd>${gt}</dd>` : '');
  const coMc = mo(r) && r.theo_1400 && (r.so_minh_chung_hop_le || 0) === 0 && !choNghiemThu(r) && duocNopMinhChung(r);
  const hd = ro ? '' : [mo(r) && duocCapNhat(r) ? nut(r, 'Cập nhật', 'capNhatThe') : '', coMc ? nut(r, 'Nộp minh chứng', 'vbcNopMinhChung', 'lam') : '',
    nutDns(r)].join('');
  return `<dl>${o('Người theo dõi', escapeHtml(r.nguoi_theo_doi_ten || ''))}${o('Người giao', escapeHtml(ten(r.tao_boi)))}
      ${o('Sản phẩm', escapeHtml([r.san_pham_ten, r.san_pham_mo_ta].filter(Boolean).join(': ')))}${o('Loại thời hạn', escapeHtml(boSoThuTu(r.loai_thoi_han_ten) || ''))}
      ${o('Vướng mắc', r.vuong_mac ? `${escapeHtml(r.vuong_mac)}${daGuiVuongMacHtml(r)}` : '')}</dl>
    <div class="hanh-dong">${hd}${nut(r, 'Mở ngăn chi tiết', 'nganMoViec')}</div>`;
}

function dongHtml(r, homNay) {
  const ro = chiXem(r); const ct = vbc.chiTiet.has(r.id);
  const han = !mo(r) ? (r.ngay_hoan_thanh ? `xong ${formatNgay(r.ngay_hoan_thanh)}` : 'đã hoàn thành')
    : r.han_xu_ly ? `hạn ${formatNgay(r.han_xu_ly)} (${ghiChuHan(r.han_xu_ly, homNay).toLowerCase()})` : 'chưa có hạn';
  return `<div class="vbc-dong" id="vctDong-${r.id}" data-id="${r.id}" data-muc="${escapeHtml(r.muc_canh_bao || '')}"${ro ? ' data-chi-xem="1"' : ''}>
    <div class="vbc-chinh"><p class="vbc-dau-dong"><b class="ma">${escapeHtml(r.ma)}</b><span class="trang-thai ${lopTT(r)}">${escapeHtml(nhanTrangThai(r, state.user?.id))}</span>${nhanPhuHtml(r)}${ro ? NHAN_CHI_XEM : ''}</p>
      <p class="vbc-nd" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.noi_dung)}</p>
      <p class="vbc-phu">Chủ trì: ${escapeHtml(ownerText(r))} · ${han}</p></div>
    <button type="button" class="nut nho vbc-nut-ct" data-action="vbcChiTiet" data-id="${r.id}" aria-expanded="${String(ct)}" aria-controls="vbcThem-${r.id}">Chi tiết</button>
    <div class="vbc-them" id="vbcThem-${r.id}"${ct ? '' : ' hidden'}>${themHtml(r, ro)}</div></div>`;
}

// Một văn bản: đầu khối tính trên MỌI việc của văn bản trong phạm vi đang xem (không theo trạng thái / tìm / lọc), danh sách theo bộ lọc.
function nhomHtml(g, cuaVb, homNay) {
  const m = moNhom(g.khoa); const td = tienDoVanBan(cuaVb); const ng = nguoiGiaoVanBan(cuaVb, ten);
  const ty = vbc.vanBan.get(g.khoa)?.trich_yeu;
  const rows = [...g.rows].sort((a, b) => (a.stt_van_ban ?? 1e9) - (b.stt_van_ban ?? 1e9) || (a.ma || '').localeCompare(b.ma || '', 'vi', { numeric: true }));
  return `<section class="vbc-vb" id="vctVb-${escapeHtml(g.khoa)}" data-mo="${m ? '1' : '0'}">
    <button type="button" class="vbc-gap" data-action="vbcGap" data-khoa="${escapeHtml(g.khoa)}" aria-expanded="${String(m)}">
      <span class="vbc-ten"><b>${escapeHtml(vanBanGocText(g.r, tenLoaiVanBan, formatNgay))}</b>${ty ? `<small>${escapeHtml(ty)}</small>` : ''}</span>
      <span class="vbc-so">${g.rows.length} việc · ${td.xong}/${td.n} hoàn thành${td.quaHan ? ` · ${td.quaHan} quá hạn` : ''}</span></button>
    <p class="vbc-giao" data-truong="nguoi-giao">Người giao: ${ng.length ? escapeHtml(nguoiGiaoText(ng)) : 'chưa xác định'}</p>
    <div class="vbc-ds"${m ? '' : ' hidden'}>${rows.map((r) => dongHtml(r, homNay)).join('')}</div></section>`;
}

// Vẽ phần dưới: nút phạm vi, ô số trạng thái, ô lọc, cây văn bản, dòng tóm tắt (ô tìm #vbcTim nằm sẵn trong khung — không vẽ lại khi gõ).
export function veVbc() {
  if (!$('vbcCay')) return;
  if (vbc.pham === 'toan' && !coToanVP()) vbc.pham = 'toi';
  const goc = daLoc(); const ds = goc.filter(LOC_TT[vbc.trangThai]); const homNay = homNayVN();
  $('vbcPhamVi').innerHTML = coToanVP() ? ['toi', 'toan'].map((k) => `<button type="button" data-action="vbcPhamVi" data-pv="${k}" aria-pressed="${String(vbc.pham === k)}">${k === 'toi' ? 'Phạm vi của tôi' : 'Toàn Văn phòng'}</button>`).join('') : '';
  $('vbcPhamVi').classList.toggle('hidden', !coToanVP());
  $('vbcSo').innerHTML = TT.map(([k, t]) => `<button type="button" class="o-so" data-action="vbcTrangThai" data-tt="${k}" aria-pressed="${String(vbc.trangThai === k)}"><b>${goc.filter(LOC_TT[k]).length}</b> ${t.toLowerCase()}</button>`).join('');
  const tc = tuyChonCanBo(coSo(), { ten });
  const chon = (k, nhan) => `<select data-vbc-loc="${k}" aria-label="Lọc theo ${nhan.toLowerCase()}"><option value="">${nhan} (${tc[k].length})</option>${tc[k].map((o) =>
    `<option value="${escapeHtml(o.ma)}"${vbc.loc[k] === o.ma ? ' selected' : ''}>${escapeHtml(o.ten)} (${o.n})</option>`).join('')}</select>`;
  $('vbcChon').innerHTML = chon('chuTri', 'Cán bộ chủ trì') + chon('theoDoi', 'Người theo dõi');
  const cuaVb = new Map(); coSo().forEach((r) => { const k = r.van_ban_id || 'khong'; if (!cuaVb.has(k)) cuaVb.set(k, []); cuaVb.get(k).push(r); });
  const nhom = nhomTheoVanBan(ds);
  $('vbcCay').innerHTML = nhom.length ? nhom.map((g) => nhomHtml(g, cuaVb.get(g.khoa) || g.rows, homNay)).join('')
    : `<p class="trong">Không có nhiệm vụ nào ${vbc.tuKhoa || vbc.loc.chuTri || vbc.loc.theoDoi ? 'khớp bộ lọc' : 'ở mục này'}.</p>`;
  setText('vbcTom', `${ds.length} việc · ${nhom.length} văn bản · ${toanVP() ? 'toàn Văn phòng (việc ngoài phạm vi chỉ xem)' : 'trong phạm vi của đồng chí'}`);
  $('vbcCay').dataset.nap = String(Date.now());
}

// Hành động (đăng ký ở a3/index.js); thao tác gập / Chi tiết đổi DOM tại chỗ, không vẽ lại cả cây.
export const hanhDongVbc = {
  vbcPhamVi: ({ pv }) => { vbc.pham = pv === 'toan' ? 'toan' : 'toi'; veVbc(); },
  vbcTrangThai: ({ tt }) => { if (LOC_TT[tt]) vbc.trangThai = tt; veVbc(); },
  vbcGap: ({ khoa }) => {
    const m = !moNhom(khoa); vbc.moNhom.set(`${vbc.pham}:${khoa}`, m);
    const el = document.getElementById(`vctVb-${khoa}`); if (!el) return;
    el.dataset.mo = m ? '1' : '0'; el.querySelector('.vbc-gap')?.setAttribute('aria-expanded', String(m)); el.querySelector('.vbc-ds').hidden = !m;
  },
  vbcGapTatCa: ({ mo: m }) => { document.querySelectorAll('#vbcCay .vbc-vb').forEach((el) => vbc.moNhom.set(`${vbc.pham}:${el.id.slice(6)}`, m === '1')); veVbc(); },
  vbcChiTiet: ({ id }) => {
    if (vbc.chiTiet.has(id)) vbc.chiTiet.delete(id); else vbc.chiTiet.add(id);
    const o = document.getElementById(`vbcThem-${id}`); if (o) o.hidden = !vbc.chiTiet.has(id);
    document.getElementById(`vctDong-${id}`)?.querySelector('.vbc-nut-ct')?.setAttribute('aria-expanded', String(vbc.chiTiet.has(id)));
  },
};
// Ô chọn lọc / ô tìm (sự kiện change / input gắn ở a3/index.js): trả true khi trạng thái đổi.
export function doiLocVbc(el) {
  if (el.matches?.('select[data-vbc-loc]')) { vbc.loc = { ...vbc.loc, [el.dataset.vbcLoc]: el.value }; return true; }
  // Ô tìm: 'input' đã vẽ lại khi gõ; 'change' lúc rời ô (bấm nút ngay sau khi gõ) không vẽ lại — tránh thay nút đang bấm (mất cú bấm).
  if (el.id === 'vbcTim') { if (vbc.tuKhoa === el.value) return false; vbc.tuKhoa = el.value; return true; }
  return false;
}
export const datLaiVbc = () => { Object.assign(vbc, { pham: 'toi', trangThai: 'mo', loc: { chuTri: '', theoDoi: '' }, tuKhoa: '', vanBan: new Map() }); vbc.moNhom.clear(); vbc.chiTiet.clear(); };
