// Vẽ thẻ "Nhập từ Excel" (v9 đợt 2): chọn tệp / tải mẫu → 1. Ghép cột (sheet, dòng tiêu đề, hồ sơ ghép, bảng cột → trường) → 2. Xem trước (kết quả
// dự kiến từng dòng, chế độ cho việc đã hoàn thành, giá trị chưa khớp → chọn đúng mục (lưu từ điển dùng chung), điền hàng loạt ô còn trống) → Nhập.
// Thuần chuỗi HTML; mọi chữ người dùng đều escape. Tên lớp ghi nguyên văn (Tailwind giữ lớp có trong mã).
import { escapeHtml } from '../../../lib/dom.js';
import { TRUONG, TEN_MUC, nhanTruong, truong } from '../../../lib/kl/nhap/truong.js';
import { LOAI_VB, DO_KHAN, TIEN_DO, CHAT_LUONG } from '../../../lib/kl/nhap/chuan-hoa.js';
import { hienGoc } from '../../../lib/kl/nhap/bang.js';
import { NHOM_THAY_MAT, giaTriNhom } from '../../../lib/kl/thay-mat.js';

const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
export const KQ = { GIAO: ['Giao ngay', 'nx-kq nx-giao'], DA_XONG: ['Đã xong (ngoài hệ thống)', 'nx-kq nx-xong'], CHO_NGHIEM_THU: ['Chờ nghiệm thu', 'nx-kq nx-nt'],
  CAP_NHAT: ['Cập nhật việc có sẵn', 'nx-kq nx-cn'], CHO_HOAN_THIEN: ['Chờ hoàn thiện', 'nx-kq nx-cho'], BO_QUA: ['Bỏ qua', 'nx-kq nx-bo'], DA_HOAN_THIEN: ['Đã hoàn thiện', 'nx-kq nx-xong'],
  DA_BO: ['Đã bỏ', 'nx-kq nx-bo'], DA_HOAN_TAC: ['Đã hoàn tác', 'nx-kq nx-bo'] };
export const chipKq = (k) => `<span class="${KQ[k]?.[1] || 'nx-kq'}">${KQ[k]?.[0] || k}</span>`;

export const khungNhapHtml = () => `
  <section class="tam nx-phan" aria-labelledby="nxTieuDe">
    <div class="tam-dau"><h2 id="nxTieuDe">Nhập nhiệm vụ từ tệp Excel</h2><span class="chu-phu">chuẩn ba mức: đủ để giao · tiến độ · đủ để đóng</span></div>
    <div class="nx-chon">
      <label class="nut chinh nx-tep" for="nxTep">Chọn tệp .xlsx</label>
      <input type="file" id="nxTep" class="sr-only" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      <span id="nxTenTep" class="chu-phu" aria-live="polite">Mẫu chuẩn của hệ thống hoặc bảng đang dùng (Phụ lục 2…) — hệ thống tự nhận dòng tiêu đề và cột.</span>
      <button type="button" class="nut" data-action="nxTaiMau">Tải mẫu nhập chuẩn</button>
    </div>
    <ul class="nx-muc"><li class="nx-m1"><b>Mức 1 — đủ để giao</b> văn bản, nội dung, chủ trì, sản phẩm, hạn; thiếu → vào "Chờ hoàn thiện", không mất dòng.</li>
      <li class="nx-m2"><b>Mức 2 — tiến độ</b> đang thực hiện / hoàn thành, vướng mắc.</li>
      <li class="nx-m3"><b>Mức 3 — đủ để đóng</b> số hiệu, ngày, trích yếu văn bản kết quả, mô tả kết quả; chất lượng.</li></ul>
  </section>
  <div id="nxBuoc"></div>`;

// Ô chọn trường cho một cột: nhóm theo mức; trường đang dùng ở cột khác vẫn chọn được (chọn lại thì cột cũ bỏ ghép).
const chonTruong = (i, k) => `<select class="o-nhap" data-nx-cot="${i}" aria-label="Ghép cột ${i + 1} vào trường">${opt('', '— Không ghép (giữ ở dữ liệu gốc) —', !k)}${
  [0, 1, 2, 3].map((m) => `<optgroup label="${escapeHtml(TEN_MUC[m])}">${TRUONG.filter((t) => t.muc === m).map((t) => opt(t.k, `${t.nhan}${t.mau ? '' : ' (trường phụ)'}`, t.k === k)).join('')}</optgroup>`).join('')}</select>`;

export function ghepHtml(s) {
  const viDu = (i) => s.dongDuLieu.slice(0, 3).map((d) => d.goc[s.tieuDe[i]]).filter((v) => v !== undefined).map((v) => escapeHtml(hienGoc(v).slice(0, 40))).join(' · ');
  const thieu = ['so_ket_luan', 'ngay_ban_hanh', 'noi_dung'].filter((k) => !Object.values(s.anhXa).includes(k));
  return `<section class="tam nx-phan" id="nxGhep"><div class="tam-dau"><h2>1. Ghép cột</h2><span class="chu-phu" id="nxNhanDien">${escapeHtml(s.nhanDien)}</span></div>
    <div class="nx-hang">
      <label class="nhan">Sheet <select id="nxSheet" class="o-nhap">${s.sheets.map((x, i) => opt(i, `${x.ten}${x.an ? ' (ẩn)' : ''}`, i === s.sheet)).join('')}</select></label>
      <label class="nhan">Dòng tiêu đề <input id="nxDongTD" type="number" min="1" max="50" class="o-nhap" value="${s.dongTieuDe + 1}"></label>
      <label class="nhan">Hồ sơ ghép cột <select id="nxHoSo" class="o-nhap">${opt('', '— Theo tiêu đề cột —', !s.hoSoTen)}${s.hoSoDs.map((h) => opt(h.ten, h.ten, h.ten === s.hoSoTen)).join('')}</select></label>
    </div>
    <div class="bang-cuon"><table class="nx-bang"><thead><tr><th scope="col">Cột trong tệp</th><th scope="col">Ví dụ (3 dòng đầu)</th><th scope="col">Ghép vào trường chuẩn</th></tr></thead>
      <tbody>${s.tieuDe.map((t, i) => `<tr><th scope="row">${escapeHtml(t)}</th><td class="chu-phu">${viDu(i)}</td><td>${chonTruong(i, s.anhXa[i])}</td></tr>`).join('')}</tbody></table></div>
    ${thieu.length ? `<p class="nx-loi">Chưa ghép cột cho: ${thieu.map(nhanTruong).join(', ')} — dòng thiếu sẽ vào "Chờ hoàn thiện".</p>` : ''}
    <div class="nx-hang"><input id="nxTenHoSo" class="o-nhap" maxlength="100" placeholder="Tên hồ sơ, ví dụ: Bảng theo dõi của phòng" aria-label="Tên hồ sơ ghép cột">
      <button type="button" class="nut" data-action="nxLuuHoSo">Lưu cách ghép để dùng lại</button><span class="chu-phu">dùng chung cho người nhập</span></div></section>`;
}

// Danh sách chọn cho một trường (giá trị chưa khớp / điền hàng loạt). Lĩnh vực kèm tên ngành (tên lĩnh vực có thể trùng giữa các ngành); cán bộ
// không gồm Thường trực (A0); lãnh đạo giao: hai nhóm (v3.18) rồi lãnh đạo Văn phòng / Trưởng phòng (như ô Thay mặt của biểu mẫu Giao việc).
const tenLv = (l, ctx) => `${l.ten} — ${ctx.dm.nganh?.find((n) => n.ma === l.nganh_ma)?.ten || l.nganh_ma}`;
const canBoChon = (a, k) => !a.is_system && !a.bi_khoa && a.role_group !== 'A0' && (k !== 'lanh_dao_giao' || ['A1', 'A2'].includes(a.role_group));
export function luaChon(kieu, ctx, them = [], k = '') {
  const ds = { loaiVanBan: LOAI_VB, doKhan: DO_KHAN, tienDo: TIEN_DO, chatLuong: CHAT_LUONG }[kieu]?.map(([ma, ten]) => ({ ma, ten }))
    || (kieu === 'lanhDao' ? [...NHOM_THAY_MAT.map(([ma, ten]) => ({ ma: giaTriNhom(ma), ten: `${ten} (cả nhóm)` })), ...luaChon('canBo', ctx, [], 'lanh_dao_giao')]
      : kieu === 'canBo' ? ctx.accounts.filter((a) => canBoChon(a, k)).map((a) => ({ ma: a.id, ten: `${a.full_name} — ${ctx.tenPhong(a.department)}` }))
      : kieu === 'linhVuc' ? (ctx.dm.linhVuc || []).map((l) => ({ ma: l.ma, ten: tenLv(l, ctx) }))
        : { donVi: ctx.dm.donVi, sanPham: ctx.dm.sanPham, cap: ctx.dm.cap, nguon: (ctx.dm.nguonNhiemVu || []).filter((x) => x.dang_dung), nganh: ctx.dm.nganh,
          loaiThoiHan: ctx.dm.loaiThoiHan }[kieu]) || [];
  const dau = ds.filter((d) => them.some((x) => x.ma === d.ma));
  return [...dau, ...ds.filter((d) => !dau.includes(d))];
}

export function xemTruocHtml(s, ctx) {
  const dem = s.dem; const xong = s.dg.filter((x) => x.gt.tien_do === 'HOAN_THANH' && x.ket_qua !== 'CAP_NHAT').length;
  const loc = (k, n) => `<button type="button" class="${KQ[k][1]}" data-action="nxLoc" data-loc="${k}" aria-pressed="${String(s.loc === k)}">${KQ[k][0]} <b>${n}</b></button>`;
  const hien = s.dg.map((x, i) => [x, s.dong[i]]).filter(([x]) => !s.loc || x.ket_qua === s.loc);
  // Điền hàng loạt chỉ lấp ô TRỐNG — ô có giá trị chưa khớp danh mục không tính (chọn mục đúng ở khối "chưa khớp").
  const thieuDem = {}; s.dg.forEach((x) => x.ket_qua === 'CHO_HOAN_THIEN' && x.thieu.forEach((k) => { if (!x.loi.includes(k)) thieuDem[k] = (thieuDem[k] || 0) + 1; }));
  return `<section class="tam nx-phan" id="nxXem"><div class="tam-dau"><h2>2. Xem trước</h2><span class="chu-phu">${s.dg.length} dòng dữ liệu · chưa ghi gì</span></div>
    <div class="nx-loc" role="group" aria-label="Lọc theo kết quả dự kiến">${Object.keys(KQ).filter((k) => dem[k]).map((k) => loc(k, dem[k])).join('')}
      ${s.loc ? '<button type="button" class="nut nho" data-action="nxLoc" data-loc="">Bỏ lọc</button>' : ''}</div>
    ${xong ? `<fieldset class="nx-che-do"${s.loDo ? ' disabled' : ''}><legend>${xong} việc đã hoàn thành trong tệp — xử lý thế nào? <b class="gv-bb">*</b>${
      s.loDo ? ` <span class="chu-phu">(theo lô ${escapeHtml(s.loDo.ma)} đang nhập dở)</span>` : ''}</legend>
      <label><input type="radio" name="nxCheDo" value="DA_XONG_NGOAI"${s.cheDoXong === 'DA_XONG_NGOAI' ? ' checked' : ''}> Đã xong ngoài hệ thống — đóng ngay, không tính tỷ lệ đúng hạn (dữ liệu cũ)</label>
      <label><input type="radio" name="nxCheDo" value="CHO_NGHIEM_THU"${s.cheDoXong === 'CHO_NGHIEM_THU' ? ' checked' : ''}> Chờ nghiệm thu — giao như thường kèm minh chứng, lãnh đạo nghiệm thu và chấm chất lượng</label></fieldset>` : ''}
    ${khopHtml(s, ctx)}${hangLoatHtml(thieuDem, s, ctx)}${macDinhHtml(s)}
    <div class="bang-cuon"><table class="nx-bang nx-xem"><thead><tr><th scope="col">Dòng</th><th scope="col">Dự kiến</th><th scope="col">Nội dung</th><th scope="col">Chủ trì</th><th scope="col">Hạn</th><th scope="col">Thiếu / ghi chú</th></tr></thead>
      <tbody>${hien.slice(0, s.soHien).map(([x, d]) => dongXemHtml(x, d)).join('') || '<tr><td colspan="6" class="trong">Không có dòng nào.</td></tr>'}</tbody></table></div>
    ${hien.length > s.soHien ? `<button type="button" class="nut nho" data-action="nxXemThem">Xem thêm ${Math.min(100, hien.length - s.soHien)} dòng (còn ${hien.length - s.soHien})</button>` : ''}</section>
    <div class="nx-chan"><span id="nxThongBao" class="chu-phu" aria-live="polite">${escapeHtml(s.thongBao || '')}</span>
      <button type="button" class="nut chinh" id="nxNhap" data-action="nxNhap"${s.choNhap ? '' : ' disabled'}>${s.loDo ? `Nhập tiếp lô ${escapeHtml(s.loDo.ma)}` : `Nhập ${s.dg.length} dòng`}</button></div>`;
}
const hienO = (d, k) => (d.o[k] && !d.o[k].loi ? d.o[k].hien : '');
function dongXemHtml(x, d) {
  const chuTri = hienO(d, 'can_bo') || hienO(d, 'don_vi') || (x.gt.don_vi ? '(theo cán bộ)' : '');
  const ghi = [...x.thieu.map((k) => `thiếu ${nhanTruong(k).toLowerCase()}${d.o[k]?.loi ? ` (${d.o[k].loi})` : ''}`), ...x.canhBao];
  return `<tr data-dong="${d.soDong}"><td>${d.soDong}</td><td>${chipKq(x.ket_qua)}</td><td class="nx-nd">${escapeHtml(String(x.gt.noi_dung || x.gt.ma || '').slice(0, 140))}</td>
    <td>${escapeHtml(chuTri)}</td><td>${escapeHtml(hienO(d, 'han_xu_ly') || (x.gt.loai_thoi_han === 'KY_BAN_HANH' ? 'ký ban hành' : ''))}</td>
    <td class="chu-phu">${escapeHtml(ghi.join('; '))}</td></tr>`;
}

// Giá trị cần chọn đúng mục, gom theo (trường, giá trị): chưa khớp (chọn → áp cho mọi dòng cùng giá trị) và khớp gần đúng (đã chọn sẵn mục khớp,
// đổi nếu sai). Lựa chọn lưu từ điển dùng chung khi nhập.
function khopHtml(s, ctx) {
  if (!s.chuaKhop.length) return '';
  const gan = s.chuaKhop.filter((g) => g.ma).length; const loi = s.chuaKhop.length - gan;
  return `<div class="nx-khop"><h3>${[loi && `${loi} giá trị chưa khớp danh mục`, gan && `${gan} giá trị khớp gần đúng cần xem lại`].filter(Boolean).join(' · ')} — chọn đúng mục, hệ thống nhớ cho lần sau</h3>
    ${s.chuaKhop.slice(0, 40).map((g, i) => { const kieu = truong(g.k)?.kieu; const ds = luaChon(kieu, ctx, g.chon, g.k);
      return `<div class="nx-khop-dong"><span><b>${escapeHtml(nhanTruong(g.k))}</b> «${escapeHtml(String(g.v).slice(0, 80))}» · ${g.n} dòng · ${escapeHtml(g.loi)}</span>
        ${ds.length ? `<select class="o-nhap" data-nx-khop="${i}" aria-label="Chọn mục đúng cho ${escapeHtml(nhanTruong(g.k))} «${escapeHtml(String(g.v).slice(0, 40))}»">${opt('', 'Chọn mục đúng…', !g.ma)}${ds.map((x) => opt(x.ma, x.ten, x.ma === g.ma)).join('')}</select>`
          : '<span class="chu-phu">sửa trong tệp rồi chọn lại tệp</span>'}</div>`; }).join('')}</div>`;
}
// Lĩnh vực (điền hàng loạt): nhóm theo ngành; ngành có dòng còn thiếu lĩnh vực lên đầu, kèm số dòng.
function lvTheoNganh(s, ctx) {
  const dem = {}; s.dg.forEach((x) => { if (x.ket_qua === 'CHO_HOAN_THIEN' && x.thieu.includes('linh_vuc')) dem[x.gt.nganh || ''] = (dem[x.gt.nganh || ''] || 0) + 1; });
  return [...(ctx.dm.nganh || [])].sort((a, b) => Boolean(dem[b.ma]) - Boolean(dem[a.ma])).map((n) => `<optgroup label="${escapeHtml(`${n.ten}${dem[n.ma] ? ` — thiếu ở ${dem[n.ma]} dòng` : ''}`)}">${
    (ctx.dm.linhVuc || []).filter((l) => l.nganh_ma === n.ma).map((l) => opt(l.ma, l.ten)).join('')}</optgroup>`).join('');
}
function hangLoatHtml(thieuDem, s, ctx) {
  const ks = Object.keys(thieuDem).filter((k) => truong(k)?.kieu && truong(k).kieu !== 'so');
  const the = Object.entries(s.hangLoat).flatMap(([x, v]) => [].concat(v).map((g) => [x, g]));
  if (!ks.length && !the.length) return '';
  const k = s.hlTruong && ks.includes(s.hlTruong) ? s.hlTruong : ks[0];
  const kieu = truong(k)?.kieu;
  const oGt = !k ? '' : kieu === 'ngay' ? '<input type="date" id="nxHlGt" class="o-nhap" aria-label="Giá trị điền">'
    : `<select id="nxHlGt" class="o-nhap" aria-label="Giá trị điền">${opt('', 'Chọn giá trị…', true)}${k === 'linh_vuc' ? lvTheoNganh(s, ctx) : luaChon(kieu, ctx, [], k).map((x) => opt(x.ma, x.ten)).join('')}</select>`;
  const ten = (x, v) => (truong(x)?.kieu === 'ngay' ? hienGoc(v) : luaChon(truong(x)?.kieu, ctx, [], x).find((d) => d.ma === v)?.ten || v);
  return `<div class="nx-hang-loat"><h3>Điền hàng loạt cho ô còn trống</h3>${ks.length ? `<div class="nx-hang">
      <select id="nxHlTruong" class="o-nhap" aria-label="Trường cần điền">${ks.map((x) => opt(x, `${nhanTruong(x)} — thiếu ở ${thieuDem[x]} dòng`, x === k)).join('')}</select>${oGt}
      <button type="button" class="nut" data-action="nxHangLoat">Điền</button></div>` : ''}
    ${k === 'linh_vuc' ? '<p class="chu-phu nx-goi-y">Lĩnh vực điền theo ngành của từng dòng: chọn một lĩnh vực cho mỗi ngành. Dòng chưa có ngành chỉ được điền khi chỉ chọn một lĩnh vực.</p>' : ''}
    ${the.map(([x, v]) => `<span class="nx-the">${escapeHtml(nhanTruong(x))} = ${escapeHtml(ten(x, v))}
      <button type="button" class="nut nho" data-action="nxBoHangLoat" data-truong="${x}" data-gia-tri="${escapeHtml(v)}" aria-label="Bỏ điền hàng loạt ${escapeHtml(nhanTruong(x))}: ${escapeHtml(ten(x, v))}">×</button></span>`).join('')}</div>`;
}
// Ô trống tự điền theo quy tắc mặc định (danh-gia.js): một dòng tóm tắt (trường · số dòng), mở ra xem quy tắc — thay cho ghi chú lặp ở từng dòng.
const QUY_TAC = { loai_van_ban: 'có số hội nghị → Kết luận Hội nghị Ban Thường vụ; ký hiệu TB / NQ / CV → loại tương ứng; còn lại → Văn bản khác',
  do_khan: 'Thường', tien_do: 'Đang thực hiện', loai_thoi_han: 'Có hạn cụ thể', nguon: 'theo loại văn bản', don_vi: 'đơn vị của cán bộ chủ trì',
  nganh: 'ngành của lĩnh vực', linh_vuc: 'ngành chỉ có một lĩnh vực', lanh_dao_giao: 'Trưởng phòng của phòng chủ trì; việc ngoài các phòng → Chánh Văn phòng (ghi thay mặt; ghi "Lãnh đạo Văn phòng" / "Thường trực Tỉnh ủy" để thay mặt cả nhóm)',
  theo_doi: 'cán bộ chủ trì; không có → Trưởng phòng chủ trì (việc của Văn phòng) hoặc lãnh đạo giao' };
function macDinhHtml(s) {
  const dem = {}; s.dg.forEach((x) => x.macDinh.forEach((k) => { dem[k] = (dem[k] || 0) + 1; }));
  const ks = Object.keys(dem); if (!ks.length) return '';
  return `<details class="nx-mac-dinh"><summary>Ô trống tự điền theo quy tắc: ${escapeHtml(ks.map((k) => `${nhanTruong(k).toLowerCase()} ${dem[k]} dòng`).join(' · '))}</summary>
    <ul>${ks.map((k) => `<li><b>${escapeHtml(nhanTruong(k))}</b>: ${escapeHtml(QUY_TAC[k] || 'mặc định')}</li>`).join('')}</ul></details>`;
}

// Hộp xác nhận hoàn tác (kết quả nhập, thẻ Chờ hoàn thiện): mở bằng moO, gửi bằng nxHoanTac.
export const xacNhanHoanTacHtml = (lo, tienTo) => `<form class="o nx-xac-nhan" id="${tienTo}-${lo.id}" data-submit="nxHoanTac" data-id="${lo.id}" data-ma="${escapeHtml(lo.ma)}">
  <p>Hoàn tác lô ${escapeHtml(lo.ma)}: xoá các việc lô đã tạo mà chưa ai thao tác, trả giá trị cũ cho việc lô đã cập nhật, bỏ các dòng đang chờ. Việc đã có
  người xác nhận, chỉ đạo, nộp minh chứng được giữ lại.</p><button type="submit" class="nut chinh">Xác nhận hoàn tác</button>
  <button type="button" class="nut" data-action="dongO" data-o="${tienTo}-${lo.id}">Huỷ</button></form>`;

export function ketQuaHtml(kq) {
  const dem = kq.soLieu || {}; const loi = kq.ketQua.filter((x) => x.ghi_chu);
  return `<section class="tam nx-phan nx-ket-qua" id="nxKetQua"><div class="tam-dau"><h2>Đã nhập lô ${escapeHtml(kq.lo.ma)}</h2><span class="chu-phu">${escapeHtml(kq.tenTep)}</span></div>
    <div class="nx-loc">${Object.keys(KQ).filter((k) => dem[k]).map((k) => `<span class="${KQ[k][1]}">${KQ[k][0]} <b>${dem[k]}</b></span>`).join('')}</div>
    ${loi.length ? `<ul class="nx-ghi">${loi.slice(0, 30).map((x) => `<li>Dòng ${x.so_dong}${x.ma ? ` (${escapeHtml(x.ma)})` : ''}: ${chipKq(x.ket_qua)} ${escapeHtml(x.ghi_chu)}</li>`).join('')}</ul>` : ''}
    <div class="hanh-dong"><button type="button" class="nut" data-action="gvChonTab" data-tab="cho">Mở "Chờ hoàn thiện"</button>
      <button type="button" class="nut" data-action="moO" data-o="oHtKq-${kq.lo.id}">Hoàn tác lô (trong 24 giờ)</button>
      <button type="button" class="nut chinh" data-action="nxLamLai">Nhập tệp khác</button></div>${xacNhanHoanTacHtml(kq.lo, 'oHtKq')}</section>`;
}
