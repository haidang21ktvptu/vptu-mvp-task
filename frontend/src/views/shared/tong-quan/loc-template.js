// Thanh lọc Tổng quan (v3.24 — bám đầu trang khi cuộn, bố cục được duyệt 16/10/2026): hàng 1 phạm vi + lọc nhanh + nút "Bộ lọc chi tiết"; hàng 2
// (mở / gập) 12 ô; hàng 3 chip "Đang áp dụng" (✕ bỏ từng điều kiện), số đang lọc, "Xoá bộ lọc", "Mở danh sách theo bộ lọc này" (ngăn chi tiết dùng
// chung — không chuyển mục). Ô chọn data-loc="<khoá>" đổi → vẽ lại tại chỗ (index.js). Cùng file: khối "Theo loại văn bản" (xem trong khối 6) và
// "Theo lãnh đạo VP phụ trách" (khối 9). Chỉ dựng HTML từ số đã tính (lib/kl/tong-quan-them.js, tq-bo-loc.js).
import { escapeHtml } from '../../../lib/dom.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { KHONG_VB, CHUA_LDVP } from '../../../lib/kl/tong-quan-them.js';
import { NHANH, dsNhanh } from '../../../lib/kl/tq-bo-loc.js';
import { coMucTieu } from '../../../lib/kl/du-lieu.js';
import { mo, dauThe, pillCanh, thuoc } from './template.js';

const MAU = ['--f-tot', '--du-lieu', '--f-vang', '--f-nt', '--f-xs', '--f-dt', '--f-tre', '--chu-mo'];
export const tenLoai = (ma) => (ma === KHONG_VB ? 'Không có văn bản' : tenLoaiVanBan(ma));
const ICON_LOC = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

const opt = (o, chon) => `<option value="${escapeHtml(o.ma)}"${o.ma === chon ? ' selected' : ''}>${escapeHtml(o.ten)}${o.n === null || o.n === undefined ? '' : ` (${o.n})`}</option>`;
// ds: [{ma, ten, n}] hoặc nhóm [{nhom, ds: [...]}] (nhom rỗng = không bọc optgroup). Không có lựa chọn → không vẽ ô.
function oChon(id, khoa, nhan, ds, chon, tatCa) {
  const nhom = ds.length && ds[0].ds !== undefined;
  const than = nhom ? ds.map((g) => (g.nhom ? `<optgroup label="${escapeHtml(g.nhom)}">${g.ds.map((o) => opt(o, chon)).join('')}</optgroup>` : g.ds.map((o) => opt(o, chon)).join(''))).join('')
    : ds.map((o) => opt(o, chon)).join('');
  if (!than) return '';
  return `<label class="o-loc">${nhan}<select id="${id}" data-loc="${khoa}"><option value="">${tatCa}</option>${than}</select></label>`;
}
const pv = (k, ds, chon, id, nhan) => `<div class="pham-vi" role="group" aria-label="${nhan}"${id ? ` id="${id}"` : ''}>${ds.map(([v, ten, act = 'tqLocDat']) => `<button type="button" data-action="${act}" data-k="${k}" data-v="${v}" data-tb="${v}" aria-pressed="${String(chon === v)}">${escapeHtml(ten)}</button>`).join('')}</div>`;

// loc: tq.loc; tc: tuyChonLoc + tuyChonLocMoi; hien: { phong, ldvp, phamViNhan, toanBo (null = không hiện) }; chip: chipLoc (+ kỳ tuỳ chọn); mo: hàng 2 mở.
export function thanhLocHtml({ loc, tc, hien = {}, soHien, soTong, chip = [], mo: moLuoi = false, coLoc = false }) {
  const { phong = false, ldvp = false, phamViNhan = 'Việc tôi theo dõi hoặc giao' } = hien;
  const tb = hien.toanBo === null || hien.toanBo === undefined ? ''
    : pv('toanBo', [['1', 'Toàn Văn phòng', 'tqToanBo'], ['0', 'Phạm vi của tôi', 'tqToanBo']], hien.toanBo ? '1' : '0', 'tqToanBo', 'Phạm vi số liệu');
  const nhanh = NHANH.filter(([k]) => k !== 'dp' || coMucTieu()).map(([k, ten]) =>   // v3.27: "Nhiệm vụ đột phá" là nhóm mục tiêu — tạm ẩn
    `<button type="button" class="nhanh-tq" data-action="tqNhanh" data-n="${k}" aria-pressed="${String(dsNhanh(loc).includes(k))}">${ten}</button>`).join('');
  const nguoi = [ldvp && tc.ldvp.length ? { nhom: 'Lãnh đạo Văn phòng phụ trách', ds: [...tc.ldvp.map((o) => ({ ...o, ma: `LD:${o.ma}` })), { ma: `LD:${CHUA_LDVP}`, ten: 'Chưa có lãnh đạo phụ trách', n: null }] } : null,
    phong && tc.phong.length ? { nhom: 'Đơn vị chủ trì theo dõi', ds: tc.phong.map((o) => ({ ...o, ma: `P:${o.ma}` })) } : null,
    tc.canBo.length ? { nhom: 'Chủ trì theo dõi', ds: tc.canBo.map((o) => ({ ...o, ma: `CB:${o.ma}` })) } : null].filter(Boolean);
  const luoi = `<div class="tq-luoi-loc" id="tqLocLuoi"${moLuoi ? '' : ' hidden'}>
      ${oChon('tqLocMucTieu', 'mucTieu', 'Mục tiêu then chốt', coMucTieu() ? tc.mucTieu : [], loc.mucTieu, 'Mọi mục tiêu')}
      ${oChon('tqLocCachGan', 'cachGan', 'Cách gắn mục tiêu', coMucTieu() ? tc.cachGan || [] : [], loc.cachGan, 'Mọi cách gắn')}
      ${oChon('tqLocKhoi', 'khoi', 'Khối lĩnh vực', tc.khoi, loc.khoi, 'Mọi khối')}
      ${oChon('tqLocNganh', 'nganh', 'Ngành/lĩnh vực', tc.nganh, loc.nganh, 'Mọi ngành/lĩnh vực')}
      ${oChon('tqLocLoai', 'loai', 'Văn bản chỉ đạo', tc.loai, loc.loai, 'Mọi loại văn bản')}
      ${oChon('tqLocCoQuan', 'coQuan', 'Cơ quan/đơn vị trình', tc.coQuan, loc.coQuan, 'Mọi cơ quan, đơn vị trình')}
      ${oChon('tqLocThuongTruc', 'thuongTruc', 'Đồng chí Thường trực chỉ đạo', tc.thuongTruc, loc.thuongTruc, 'Mọi đồng chí')}
      ${oChon('tqLocNguoi', 'nguoi', ldvp ? 'Lãnh đạo VP phụ trách, phòng, cán bộ' : phong ? 'Đơn vị, chủ trì theo dõi' : 'Chủ trì theo dõi', nguoi, loc.nguoi, 'Mọi lãnh đạo, phòng, cán bộ')}
      ${oChon('tqLocTrangThai', 'trangThai', 'Trạng thái', tc.trangThai, loc.trangThai, 'Mọi trạng thái')}
      ${oChon('tqLocMucQT', 'mucQT', 'Mức quan trọng', tc.mucQT, loc.mucQT, 'Mọi mức')}
      ${oChon('tqLocDoKhan', 'doKhan', 'Độ khẩn', tc.doKhan, loc.doKhan, 'Mọi độ khẩn')}
      ${oChon('tqLocNguon', 'nguon', 'Nguồn nhiệm vụ', tc.nguon, loc.nguon, 'Mọi nguồn nhiệm vụ')}
      <div class="o-loc"><span>Kỳ tùy chọn (thay kỳ ở đầu trang)</span><div class="hai-o">
        <input type="date" id="tqLocTu" data-loc="tu" min="2000-01-01" max="2100-12-31" value="${escapeHtml(loc.tu || '')}" aria-label="Từ ngày"><input type="date" id="tqLocDen" data-loc="den" min="2000-01-01" max="2100-12-31" value="${escapeHtml(loc.den || '')}" aria-label="Đến ngày"></div></div></div>`;
  const chips = chip.map((c) => `<span class="chip-tq">${escapeHtml(c.ten)}<button type="button" data-action="tqChipBo" data-k="${c.k}" data-v="${escapeHtml(c.v || '')}" aria-label="Bỏ điều kiện: ${escapeHtml(c.ten)}">${ICON_X}</button></span>`).join('');
  return `<section class="tq-loc2" id="tqLoc" aria-label="Bộ lọc của Tổng quan">
    <div class="tq-loc-hang">${tb}${pv('phamVi', [['', 'Toàn bộ'], ['toi', phamViNhan]], loc.phamVi || '', 'tqPhamVi', 'Phạm vi')}
      <span class="nho-tq">Lọc nhanh</span>${nhanh}<span class="tq-day"></span>
      <button type="button" class="nut nho" id="tqLocChiTietNut" data-action="tqLocChiTiet" aria-expanded="${String(moLuoi)}" aria-controls="tqLocLuoi">${ICON_LOC}Bộ lọc chi tiết</button></div>
    ${luoi}
    <div class="tq-loc-hang"><span class="nho-tq">Đang áp dụng</span>${chips || '<span class="nho-tq">chưa chọn bộ lọc nào — mọi khối bên dưới tính trên toàn bộ nhiệm vụ trong phạm vi</span>'}
      <span class="tq-dang-loc" id="tqDangLoc">${coLoc ? `Đang lọc: <b>${soHien}</b> / ${soTong} nhiệm vụ` : `${soTong} nhiệm vụ ${hien.toanBo ? 'toàn Văn phòng' : 'trong phạm vi'}`}</span>
      <span class="tq-day"></span>
      <button type="button" class="nut nho tq-loc-bo" id="tqLocBo" data-action="tqLocBo" ${chip.length ? '' : 'disabled'}>Xoá bộ lọc</button>
      <button type="button" class="nut nho" id="tqMoTheoLoc" ${mo({ t: 'loc' })}>Mở danh sách theo bộ lọc này</button></div></section>`;
}

export function loaiVanBanHtml(ds, locLoai) {
  const tong = ds.reduce((s, d) => s + d.tong, 0);
  let goc = 0;
  const doan = ds.map((d, i) => { const tu = goc; goc += (d.tong / (tong || 1)) * 360; return `var(${MAU[i % MAU.length]}) ${tu}deg ${goc}deg`; });
  const dong = (d, i) => `<tr><td><button type="button" class="ten-bam loai-nut" style="--mau:var(${MAU[i % MAU.length]})" data-action="tqLocLoai" data-loai="${escapeHtml(d.ma)}" aria-pressed="${String(locLoai === d.ma)}" title="Bấm để lọc toàn bộ Tổng quan theo loại này">${escapeHtml(tenLoai(d.ma))}</button>
      <small class="chu-phu">${d.xong} hoàn thành · ${d.dangMo} đang làm${d.canhBao ? ` · ${d.canhBao} cảnh báo` : ''}</small></td>
    <td class="so" data-n="Tổng"><button type="button" class="ten-bam" ${mo({ t: 'loai', ma: d.ma, ten: tenLoai(d.ma) })}><b>${d.tong}</b><small>${d.tyLe}%</small></button></td></tr>`;
  return `<div id="tqLoaiVanBan">${ds.length ? `<div class="loai-vb"><div class="vong" data-tong="${tong}" style="background:conic-gradient(${doan.join(', ')})" role="img" aria-label="${tong} nhiệm vụ theo loại văn bản"></div>
      <table><tbody>${ds.map(dong).join('')}</tbody></table></div><p class="chu-phu tq-chu-nho">Bấm tên loại để lọc cả Tổng quan, bấm số để xem việc.</p>` : '<p class="trong">Chưa có nhiệm vụ trong phạm vi.</p>'}</div>`;
}

export function lanhDaoVpHtml(ds, k) {
  const dong = (d) => `<tr><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'nhom', kh: 'ldvp', ma: d.ma, ten: d.ten })}><b>${escapeHtml(d.ten)}</b><small><span class="chi-mt">${d.phong.length ? escapeHtml(d.phong.join(', ')) : d.ma === CHUA_LDVP ? 'ngoài phân công' : 'chỉ kiêm nhiệm'}</span><span class="chi-dt">${d.xong} hoàn thành, ${d.dangMo} đang làm</span></small></button></td>
    <td class="so" data-n="Tổng">${d.tong}</td><td class="so" data-n="Hoàn thành">${d.xong}</td><td class="so" data-n="Đang làm">${d.dangMo}</td>
    <td data-n="Cảnh báo"><span class="canh-tq">${pillCanh(d, 'ldvp')}</span></td><td data-n="Đúng hạn">${thuoc(d.tyLe)}</td></tr>`;
  return `<article class="the-bd n12" id="tqLanhDaoVp">${dauThe('Theo lãnh đạo Văn phòng phụ trách', `Theo phân công phụ trách phòng, kiêm nhiệm ngành / lĩnh vực đang hiệu lực · hoàn thành, đúng hạn tính ${k.trong}`)}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>Lãnh đạo · phòng phụ trách</th><th class="so">Tổng</th><th class="so">Hoàn thành</th><th class="so">Đang làm</th><th>Cảnh báo</th><th>Đúng hạn</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody></table></div>` : '<p class="trong">Chưa có phân công phụ trách hoặc chưa có nhiệm vụ.</p>'}</article>`;
}
