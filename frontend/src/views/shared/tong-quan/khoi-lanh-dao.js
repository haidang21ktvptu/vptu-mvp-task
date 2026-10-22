// Tổng quan cho lãnh đạo (v3.24 — bố cục 9 khối được duyệt 16/10/2026): khối 1 "Điểm nghẽn cần chỉ đạo" (đủ bốn thông tin của Công văn 1400: ai
// đang chậm, chậm bao nhiêu ngày, sản phẩm còn thiếu, cấp nào quyết định — lọc theo cấp, nút Chỉ đạo), khối 2 "Thực hiện các mục tiêu then chốt"
// (v3.25: nhóm theo danh mục dm_nhom_muc_tieu — nhóm có dạng số hiệu (nghị quyết Trung ương, Tỉnh ủy…): bảng; chỉ tiêu chủ yếu: bảng, chỉ hiện khi
// có kết quả hoặc có việc gắn chỉ tiêu; nhóm khác (đột phá, chương trình trọng tâm…): thẻ), khối 3 "Thực hiện theo lĩnh vực trọng tâm" (5 khối mở ra các ngành, thanh cơ cấu trạng thái). Chỉ dựng HTML từ số đã tính
// (lib/kl/tong-quan-lanh-dao.js); mọi số / thẻ / dòng mở danh sách việc trong ngăn chi tiết dùng chung (tqMo).
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { boSoThuTu } from '../../../lib/kl/nhan.js';
import { NHOM_MUC_TIEU } from '../../../lib/kl/muc-tieu.js';
import { DOAN, tenKy, chuThieuNganh } from '../../../lib/kl/tong-quan-lanh-dao.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { mo, dauKhoi, nhomNut, thuoc } from './template.js';

const SO_DONG_NGHEN = 8;
const tenMuc = (r) => (r.muc_canh_bao === 'DO_DAC_BIET' ? ['ddb', 'Đỏ đặc biệt'] : ['do', 'Đỏ']);
// Sản phẩm còn thiếu theo khâu nghẽn (v_nhiem_vu.khau, 0033): đã nộp chờ xác nhận / chưa nhận việc / bị từ chối; còn lại = sản phẩm đầu ra chưa có.
function sanPhamThieu(r) {
  if (r.khau === 'CHO_MINH_CHUNG' || r.khau === 'CHO_NGHIEM_THU') return 'Đã nộp minh chứng — chờ xác nhận';
  if (r.khau === 'CHUA_NHAN') return 'Chưa xác nhận nhận việc';
  if (r.khau === 'BI_TU_CHOI') return 'Bị từ chối — chờ giao lại';
  return [r.san_pham_ten, r.san_pham_mo_ta].filter(Boolean).join(': ') || 'Chưa định nghĩa sản phẩm';
}
// Cơ quan trình (đơn vị ngoài Văn phòng) nếu có, không thì đơn vị chủ trì; dòng phụ: người theo dõi (khi việc của cơ quan ngoài / chưa giao cán bộ)
// hoặc cán bộ chủ trì.
function coQuanCanBo(r) {
  const dv = boSoThuTu(r.co_quan_trinh_ten) || boSoThuTu(r.owner_don_vi_ten) || 'Chưa xác định';
  const phong = DEPT_NAMES[r.nguoi_theo_doi_phong];
  const phu = r.co_quan_trinh || !r.owner_tai_khoan ? `Người theo dõi: Đ/c ${r.nguoi_theo_doi_ten || '—'}${phong ? `, ${phong}` : ''}` : `Chủ trì theo dõi: Đ/c ${r.owner_tai_khoan_ten}`;
  return [dv, phu];
}

// ds: diemNghen (đã sắp); cap: capNghen; chon: cấp đang lọc ('' = mọi cấp); duocChiDao(r) | boolean: người xem chỉ đạo được việc (chữ nút — DB là chốt).
export function nghenHtml(ds, cap, chonUi, { duocChiDao = false } = {}) {
  const chon = chonUi && cap.some((c) => c.ma === chonUi) ? chonUi : '';   // cấp đang chọn hết việc (đổi bộ lọc / kỳ) → "Mọi cấp"
  const hien = chon ? ds.filter((r) => (r.cap_quyet_dinh || 'CHUA') === chon) : ds;
  const phu = ds.length ? `${ds.length} việc Đỏ và Đỏ đặc biệt, nặng nhất trước — ai đang chậm, chậm bao nhiêu ngày, sản phẩm còn thiếu, cấp nào cần quyết định.`
    : 'Không có việc Đỏ, Đỏ đặc biệt.';
  const nut = ds.length ? nhomNut('tqCap', 'cap', [['', `Mọi cấp (${ds.length})`], ...cap.map((c) => [c.ma, `${c.ten} (${c.n})`])], chon, 'Lọc theo cấp cần quyết định') : '';
  if (!ds.length) {
    return `<article class="the-bd n12" id="tqNghen">${dauKhoi(1, 'Điểm nghẽn cần chỉ đạo', phu)}<div class="bao-dong yen" role="note"><span class="bieu-bd" aria-hidden="true">✓</span>
      <div class="noi-bd"><b>Không có việc Đỏ</b><span>Mọi việc đang mở trong phạm vi đều trong hạn hoặc mới ở mức Vàng.</span></div></div></article>`;
  }
  const dong = (r) => {
    const [lop, muc] = tenMuc(r); const [dv, cb] = coQuanCanBo(r);
    const vb = [tenLoaiVanBan(r.van_ban_loai), r.so_ket_luan].filter(Boolean).join(' ');
    return `<tr><td data-n="Mức"><span class="muc-tq ${lop}">${muc}</span></td>
      <td class="c-ten"><button type="button" class="ten-bam" data-action="tqMoViec" data-id="${r.id}"><span class="ma-ng">${escapeHtml(r.ma)}</span><b>${escapeHtml(r.noi_dung)}</b><small>${escapeHtml(vb)}</small></button></td>
      <td data-n="Cơ quan/đơn vị trình, chủ trì theo dõi"><b class="nd-ng">${escapeHtml(dv)}</b><small>${escapeHtml(cb)}</small></td>
      <td class="so" data-n="Trễ"><b class="tre-ng">${r.so_ngay_qua ?? 0}</b><small>ngày</small></td>
      <td data-n="Sản phẩm còn thiếu"><span class="nd-ng">${escapeHtml(sanPhamThieu(r))}</span><small>${escapeHtml(r.vuong_mac ? `Vướng mắc: ${r.vuong_mac}` : 'Chưa báo vướng mắc')}</small></td>
      <td data-n="Cấp cần quyết định"><span class="cap-ng">${escapeHtml(r.cap_quyet_dinh_ten || 'Chưa xác định')}</span></td>
      <td class="c-nut"><button type="button" class="nut nho" data-action="tqChiDao" data-id="${r.id}">${(typeof duocChiDao === 'function' ? duocChiDao(r) : duocChiDao) ? 'Chỉ đạo' : 'Xem'}</button></td></tr>`;
  };
  const chan = `Đang hiện ${Math.min(SO_DONG_NGHEN, hien.length)} trong ${hien.length} việc${chon ? '' : cap.length > 1 ? ` · ${cap.map((c) => `${c.ten} ${c.n}`).join(' · ')}` : ''}`;
  return `<article class="the-bd n12" id="tqNghen">${dauKhoi(1, 'Điểm nghẽn cần chỉ đạo', phu, nut)}
    <div class="cuon-ngang"><table class="bang-tq bang-ng"><thead><tr><th>Mức</th><th>Nhiệm vụ</th><th>Cơ quan/đơn vị trình, chủ trì theo dõi</th><th class="so">Trễ</th><th>Sản phẩm còn thiếu</th><th>Cấp cần quyết định</th><th><span class="sr">Thao tác</span></th></tr></thead>
      <tbody>${hien.slice(0, SO_DONG_NGHEN).map(dong).join('')}</tbody></table></div>
    <div class="chan-ng"><span>${chan}</span><button type="button" class="nut nho" ${mo({ t: 'nghen', cap: chon, ten: chon ? cap.find((c) => c.ma === chon)?.ten : '' })}>Xem danh sách ${hien.length} việc</button></div></article>`;
}

const pills = (m) => [[m.ddb, 'ddb', 'Đỏ đặc biệt'], [m.do, 'do', 'Đỏ'], [m.vang, 'vang', 'Vàng']].filter(([n]) => n).map(([n, lop, ten]) => `<span class="muc-tq ${lop}">${n} ${ten}</span>`).join('')
  || (m.tong ? '<span class="muc-tq tot">Không có việc chậm</span>' : '<span class="chu-phu">Chưa có nhiệm vụ gắn mục tiêu này</span>');
const theMt = (m, i, n) => `<button type="button" class="the-mt${m.ddb + m.do ? ' nguy' : ''}" ${mo({ t: 'mt', ma: m.ma, ten: m.ten_ngan })}>
    <span class="nhom-mt">${m.nhom === 'DOT_PHA' ? `Đột phá ${i + 1}` : escapeHtml(n?.ten || '')}</span><span class="tieu-mt">${escapeHtml(m.ten)}</span>
    <span class="can-cu-mt">${escapeHtml([m.can_cu, m.vanBan.length ? `văn bản: ${m.vanBan.slice(0, 2).join(', ')}${m.vanBan.length > 2 ? '…' : ''}` : ''].filter(Boolean).join(' · '))}</span>
    <span class="hang-so-mt"><span><b>${m.xong}</b> / ${m.tong} nhiệm vụ hoàn thành</span><span>${m.pct}%</span></span><span class="thuoc-tq tot"><i style="width:${m.pct}%"></i></span>
    <span class="hang-so-mt nho"><span>Đúng hạn ${m.dung}/${m.dg}</span><span>${m.mo} đang thực hiện</span></span><span class="canh-tq">${pills(m)}</span></button>`;
const qh = (n, ct) => (n ? `<button type="button" class="muc-tq do" ${mo(ct)}>${n}</button>` : '<span class="muc-tq tot">Không</span>');
// Nhóm có số hiệu: dòng có việc trước (thứ tự danh mục); mục chưa có việc gom một dòng cuối (danh mục mở rộng được — không kéo dài bảng).
const bangNq = (dsDu, n) => { const ds = dsDu.filter((m) => m.tong); const rong = dsDu.filter((m) => !m.tong);
  return `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>${escapeHtml(n?.tab || 'Nghị quyết')}</th><th>Văn bản của các việc</th><th class="so">Nhiệm vụ</th><th class="so">Hoàn thành</th><th class="so">Đang làm trong hạn</th><th>Quá hạn</th><th>Tiến độ</th></tr></thead><tbody>
  ${ds.map((m) => `<tr><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'mt', ma: m.ma, ten: m.ten_ngan })}><b>${escapeHtml(m.ten_ngan)}</b><small>${escapeHtml(m.mo_ta || '')}</small></button></td>
    <td data-n="Văn bản">${m.vanBan.length ? escapeHtml(m.vanBan.slice(0, 2).join(', ')) : '<span class="chu-phu">chưa có việc</span>'}</td>
    <td class="so" data-n="Tổng"><b>${m.tong}</b></td><td class="so" data-n="Hoàn thành">${m.xong}</td><td class="so" data-n="Đang làm">${m.th}</td>
    <td data-n="Cảnh báo">${qh(m.ddb + m.do, { t: 'mtm', ma: m.ma, ten: m.ten_ngan, m: 'qh' })}</td><td data-n="Đúng hạn">${thuoc(m.tong ? m.pct : null)}</td></tr>`).join('')}
  ${rong.length ? `<tr class="dong-rong-mt"><td colspan="7"><span class="chu-phu">${ds.length ? 'Chưa có nhiệm vụ gắn' : 'Chưa có nhiệm vụ gắn mục nào'} (${rong.length}): ${escapeHtml(rong.map((m) => m.so_hieu || m.ten_ngan).join(', '))}</span></td></tr>` : ''}</tbody></table></div>`; };
const DG = { VUOT: 'vượt', DAT: 'đạt', CHUA_DAT: 'chưa đạt' };
const bangCt = (ds, kq) => `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>Chỉ tiêu chủ yếu</th><th>Mục tiêu đến năm 2030</th><th>Kết quả kỳ gần nhất</th><th class="so">Nhiệm vụ gắn chỉ tiêu</th></tr></thead><tbody>
  ${ds.map((m) => { const x = kq.get(m.ma); return `<tr><td class="c-ten"><b>${escapeHtml(m.ten_ngan)}</b><small>${escapeHtml(m.mo_ta || '')}</small></td><td data-n="Mục tiêu">${escapeHtml(m.chi_tieu || '')}</td>
    <td data-n="Kết quả">${x ? `<b>${escapeHtml(x.gia_tri)}</b> <small class="chu-phu">${tenKy(x.ky)}${x.danh_gia ? ` · ${DG[x.danh_gia]}` : ''}</small>` : '<span class="chu-phu">chưa có số liệu</span>'}</td>
    <td class="so" data-n="Nhiệm vụ">${m.tong ? `<button type="button" class="ten-bam" ${mo({ t: 'mt', ma: m.ma, ten: m.ten_ngan })}><b>${m.tong}</b></button>` : '0'}</td></tr>`; }).join('')}</tbody></table>
  <p class="chu-phu tq-chu-nho">Kết quả do Văn phòng nhập theo báo cáo định kỳ; hệ thống ghép với các nhiệm vụ đã gắn chỉ tiêu.</p></div>`;

// theo: { [mã nhóm]: theoMucTieu }; tab đang chọn; nhom: dsNhom (thứ tự, nhãn tab, mau_so_hieu); hienCt: có thẻ chỉ tiêu; coGan: có việc nào gắn mục
// tiêu; kq: ketQuaMoiNhat; tuDong: số việc gắn nhờ gợi ý của hệ thống (quy tắc, trợ lý AI, rà soát — cán bộ đã giữ khi lưu); pl: phanLoaiMucTieu
// (v3.26 — số việc gắn mục tiêu / "Không thuộc" / chưa phân loại).
export function mucTieuHtml(theo, tab, { hienCt = false, coGan = true, kq = new Map(), nhom = NHOM_MUC_TIEU, tuDong = 0, raSoat = false, pl = null } = {}) {
  const tabs = nhom.filter((n) => n.ma !== 'CHI_TIEU' || hienCt);
  const n = tabs.find((x) => x.ma === tab) || tabs[0]; const t = n?.ma;
  const than = !n ? '' : t === 'CHI_TIEU' ? bangCt(theo.CHI_TIEU || [], kq) : n.mau_so_hieu ? bangNq(theo[t] || [], n)
    : `<div class="luoi-mt">${(theo[t] || []).map((m, i) => theMt(m, i, n)).join('') || '<p class="trong">Chưa có mục tiêu trong danh mục.</p>'}</div>`;
  // raSoat: người xem gắn được mục tiêu (không phải Thường trực) → lối vào trang Rà soát (lãnh đạo chỉ xem, không phải bấm).
  const nutRs = raSoat ? ' <button type="button" class="ten-bam lien-ket" data-action="moRaSoatMucTieu" data-che="chua">Rà soát phân loại</button>' : '';
  const tom = pl ? `<p class="chu-phu tq-chu-nho" id="tqMtPhanLoai">Phân loại: <b>${pl.gan}</b> nhiệm vụ gắn mục tiêu then chốt · <b>${pl.khong}</b> không thuộc mục tiêu then chốt · ${pl.chua
    ? `<b class="tq-chua-pl">${pl.chua}</b> chưa phân loại — cần rà soát` : 'không còn nhiệm vụ chưa phân loại'}.${nutRs}</p>` : '';
  const goiY = !coGan ? `<p class="goi-y-mt" role="note">Chưa có nhiệm vụ nào gắn mục tiêu then chốt. Khi giao việc, hệ thống tự gợi ý mục tiêu theo văn bản, nội dung, ngành, lĩnh vực; nhiệm vụ không phục vụ mục tiêu nào thì chọn "Không thuộc mục tiêu then chốt"; việc đã giao phân loại ở ngăn chi tiết hoặc trang Rà soát.${pl ? '' : nutRs}</p>`
    : tuDong ? `<p class="chu-phu tq-chu-nho">${tuDong} nhiệm vụ gắn mục tiêu nhờ gợi ý của hệ thống (theo quy tắc, trợ lý AI hoặc rà soát) — cán bộ đã giữ lại khi lưu.${pl ? '' : nutRs}</p>`
      : !pl && nutRs ? `<p class="chu-phu tq-chu-nho">${nutRs}</p>` : '';
  return `<article class="the-bd n12" id="tqMucTieu">${dauKhoi(2, 'Thực hiện các mục tiêu then chốt', 'Nghị quyết Đại hội XX Đảng bộ tỉnh (nhiệm kỳ 2025–2030), các nghị quyết, chương trình của Trung ương và Tỉnh ủy · tính trên mọi nhiệm vụ đã gắn (mọi kỳ); một nhiệm vụ có thể phục vụ nhiều mục tiêu.',
    nhomNut('tqTabMt', 'tab', tabs.map((n) => [n.ma, n.tab]), t, 'Nhóm mục tiêu'))}${tom}${goiY}${than}</article>`;
}

// Khối 3. t: theoKhoi; mo: Set mã khối đang mở; sap: 'qh' | 'dm'; k: kỳ.
const MAU_DOAN = Object.fromEntries(DOAN.map(([ma, , mau]) => [ma, mau]));
function xepKv(d, ten, ct) {
  if (!d.tong) return '<span class="xep mong rong" aria-hidden="true"></span>';
  return `<span class="xep mong">${DOAN.filter(([ma]) => d.dem[ma]).map(([ma, tenD]) => { const goi = `${ten} — ${tenD}: ${d.dem[ma]} việc (${Math.round((d.dem[ma] / d.tong) * 100)}%)`;
    return `<button type="button" class="doan" style="width:${(d.dem[ma] / d.tong) * 100}%;background:var(${MAU_DOAN[ma]})" ${mo({ ...ct, d: ma })} data-goi="${escapeHtml(goi)}" aria-label="${escapeHtml(goi)}"></button>`; }).join('')}</span>`;
}
function hangKv(d, { ten, ct, lop = '', dau = '' }) {
  return `<div class="kv-hang ${lop}">${dau || `<span class="kv-ten">${escapeHtml(ten)}</span>`}${xepKv(d, ten, ct)}
    <button type="button" class="kv-so ten-bam" ${mo(ct)}><b>${d.tong}</b></button><span class="kv-so an-dt">${d.tyLe === null ? '—' : `${d.tyLe}%`}</span>
    <span class="kv-so an-dt">${qh(d.qh, { ...ct, d: 'qh' })}</span></div>`;
}
// v3.26: dòng "Không thuộc lĩnh vực trọng tâm" (ngành "Không thuộc") và "Chưa phân loại — cần rà soát" (chưa có ngành); o: { raSoat, soNganh, soKhoi,
// thieu: thieuNganh(rows) — câu dưới bảng cùng số với Chất lượng dữ liệu và ô "Chưa có ngành, lĩnh vực" của màn Rà soát }.
export function linhVucHtml(t, mo2, sap, k, { raSoat = false, soNganh = 12, soKhoi = t.khoi.length, thieu = null } = {}) {
  const khoi = t.khoi.map((d) => {
    const moKhoi = mo2.has(d.ma);
    const dau = `<button type="button" class="kv-ten kv-mo" data-action="tqLvMo" data-ma="${d.ma}" aria-expanded="${String(moKhoi)}"><span class="mui" aria-hidden="true">${moKhoi ? '−' : '+'}</span><span>${escapeHtml(d.ten)}</span></button>`;
    const con = moKhoi ? d.nganh.map((n) => hangKv(n, { ten: boSoThuTu(n.ten), ct: { t: 'khoi', ma: n.ma, loai: 'nganh', kh: d.ma, ten: boSoThuTu(n.ten) }, lop: 'con' })).join('')
      || '<p class="chu-phu kv-trong">Không có nhiệm vụ trong kỳ.</p>' : '';
    return hangKv(d, { ten: d.ten, ct: { t: 'khoi', ma: d.ma, ten: d.ten }, dau }) + con;
  }).join('');
  const khong = t.khongThuoc ? hangKv(t.khongThuoc, { ten: 'Không thuộc lĩnh vực trọng tâm', ct: { t: 'khoi', ma: 'KHONG_THUOC', ten: 'Không thuộc lĩnh vực trọng tâm' }, lop: 'chua' }) : '';
  const chua = t.chuaNganh ? hangKv(t.chuaNganh, { ten: 'Chưa phân loại — cần rà soát', ct: { t: 'khoi', ma: 'CHUA', ten: 'Chưa có ngành — cần rà soát' }, lop: 'chua' }) : '';
  const nutRs = thieu?.tong && raSoat ? `<p class="chu-phu tq-chu-nho" id="tqLvThieu">${chuThieuNganh(thieu)} — <button type="button" class="ten-bam lien-ket" data-action="moRaSoatMucTieu" data-che="nganh">Rà soát phân loại</button></p>` : '';
  const chuGiai = DOAN.map(([, ten, mau]) => `<span><i style="background:var(${mau})"></i>${ten}</span>`).join('');
  return `<article class="the-bd n12" id="tqLinhVuc">${dauKhoi(3, 'Thực hiện theo lĩnh vực trọng tâm', `Việc đang mở và việc hoàn thành ${k.trong}, gom ${soNganh} ngành của danh mục thành ${soKhoi} khối như bố cục báo cáo; bấm một khối để mở các ngành.`,
    nhomNut('tqLvSap', 'sap', [['qh', 'Nhiều quá hạn trước'], ['dm', 'Theo danh mục']], sap, 'Sắp xếp lĩnh vực'))}
    <div class="kv-bang"><div class="kv-hang kv-dau" aria-hidden="true"><span>Khối, ngành</span><span>Cơ cấu trạng thái</span><span class="kv-so">Tổng</span><span class="kv-so an-dt">Đúng hạn</span><span class="kv-so an-dt">Quá hạn</span></div>
      ${hangKv(t.toan, { ten: 'Toàn bộ', ct: { t: 'khoi', ma: 'TAT', ten: 'Toàn bộ lĩnh vực' }, lop: 'tong' })}${khoi}${khong}${chua}</div>
    ${nutRs}<div class="chu-giai kv-chu-giai">${chuGiai}</div></article>`;
}
