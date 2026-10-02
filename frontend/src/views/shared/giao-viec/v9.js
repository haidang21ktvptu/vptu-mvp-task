// Phần v9 của biểu mẫu Giao việc (docs/DESIGN.md mục 10), gắn thêm KHÔNG đổi luồng giao_viec của index.js:
//  - dải quy tắc 1-1-1-1-3 (một chủ trì, một sản phẩm, một hạn, một minh chứng, ba mức cảnh báo) sáng dần theo ô đã điền;
//  - chọn nhanh dưới ô Chịu trách nhiệm / Sản phẩm / Hạn hoàn thành: đặt giá trị rồi phát sự kiện change/input như người dùng chọn, để
//    kiểm tra, "Còn thiếu" và hạn nộp minh chứng chạy đúng đường cũ; hạn gợi ý tính từ ngày nhận văn bản (nhãn ghi rõ ngày), giao tiếp
//    xuống thì là "sớm n ngày" trước hạn của cấp trên;
//  - giao tiếp xuống: khối "Kế thừa từ cấp trên" (nội dung, văn bản, hạn, sản phẩm của việc cha — cấp dưới chỉ xem);
//  - cột phải "Văn bản đang nhập": đã nhập x / dự kiến y và các việc vừa nhập từ văn bản đó (chuyên viên tổng hợp nhập liền một văn bản).
// Chỉ ghi innerHTML khi nội dung đổi: vẽ lại đúng nút đang được bấm (mousedown → change của ô vừa rời → vẽ lại) làm trình duyệt bỏ cú bấm.
import { $, escapeHtml } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { formatNgay, congNgay, homNayVN } from '../../../lib/kl/ngay.js';
import { soViecTheoVanBan } from '../../../lib/kl/du-lieu.js';
import { timKlRow } from '../kl/danh-sach.js';
import { dh } from '../dieu-hanh/du-lieu.js';
import { dongTongQuan } from '../tong-quan/index.js';
import { timTrongDs, MOI } from './van-ban.js';

const chuOpt = (id) => $(id)?.selectedOptions?.[0]?.text || '';
const SP_NHANH = ['Báo cáo', 'Tờ trình', 'Kế hoạch', 'Công văn'];
const cha = () => { const id = $('gvCha')?.dataset.id; return id ? timKlRow(id) || dh.rows.find((r) => r.id === id) || null : null; };
const daVe = new WeakMap();
function dat(id, html) { const el = $(id); if (!el || daVe.get(el) === html) return; daVe.set(el, html); el.innerHTML = html; }
const ngan = (d) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const cuoiThang = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

function oQuyTac(so, nhan, giaTri, xong) {
  return `<li class="${xong ? 'xong' : ''}"><b>${so}</b><span>${nhan}</span><small>${escapeHtml(giaTri)}</small></li>`;
}
function veQuyTac() {
  const owner = $('klThOwner').value ? chuOpt('klThOwner').split(' — ')[0] : 'chưa chọn';
  const sp = $('klThSanPham').value ? chuOpt('klThSanPham') : 'chưa chọn';
  const kyBH = $('klThLoai').value === 'KY_BAN_HANH';
  const han = kyBH ? 'theo kỳ ban hành' : $('klThHan').value ? formatNgay($('klThHan').value) : 'chưa đặt';
  const nop = $('klThHanNop').value ? `nộp ${formatNgay($('klThHanNop').value)}` : 'tự gợi ý theo hạn';
  dat('gvQuyTac', oQuyTac(1, 'chủ trì', owner, Boolean($('klThOwner').value)) + oQuyTac(1, 'sản phẩm', sp, Boolean($('klThSanPham').value))
    + oQuyTac(1, 'hạn hoàn thành', han, kyBH || Boolean($('klThHan').value)) + oQuyTac(1, 'minh chứng', nop, Boolean($('klThHanNop').value))
    + oQuyTac(3, 'mức cảnh báo', 'Vàng, Đỏ, Đỏ đặc biệt tự bật theo hạn', Boolean($('klThHan').value) || kyBH));
}

// Nút chọn nhanh: data-o = id ô, data-gt = giá trị.
const nut = (o, gt, nhan, goi = '') => `<button type="button" data-action="gvChonNhanh" data-o="${o}" data-gt="${escapeHtml(gt)}"${goi ? ` title="${escapeHtml(goi)}"` : ''}>${escapeHtml(nhan)}</button>`;
function veChonNhanh() {
  const opts = [...($('klThOwner')?.options || [])].filter((o) => o.value);
  const uuTien = opts.filter((o) => o.value.startsWith('dv:')).concat(opts.filter((o) => o.value.startsWith('tk:')));
  dat('gvNhanhOwner', uuTien.slice(0, 4).map((o) => nut('klThOwner', o.value, o.text.split(' — ')[0].replace(/^\d+\.\s*/, ''))).join(''));
  const sp = [...($('klThSanPham')?.options || [])].filter((o) => SP_NHANH.includes(o.text));
  dat('gvNhanhSanPham', sp.map((o) => nut('klThSanPham', o.value, o.text)).join(''));
  const homNay = homNayVN(); const c = cha();
  if (c?.han_xu_ly) {
    dat('gvNhanhHan', [3, 5, 7].map((n) => [n, congNgay(c.han_xu_ly, -n)]).filter(([, d]) => d >= homNay)
      .map(([n, d]) => nut('klThHan', d, `Sớm ${n} ngày · ${ngan(d)}`, `Hạn ${formatNgay(d)}, trước hạn của cấp trên ${n} ngày`)).join('')
      || '<small>hạn của cấp trên đã sát, chọn ngày cụ thể</small>');
    return;
  }
  const moc = $('klThNgayNhan')?.value || homNay;
  const [y, m] = moc.split('-').map(Number);
  const cuoi = cuoiThang(y, m) > moc ? cuoiThang(y, m) : cuoiThang(y, m + 1);
  dat('gvNhanhHan', [[congNgay(moc, 7), '7 ngày'], [congNgay(moc, 14), '14 ngày'], [congNgay(moc, 30), '30 ngày'], [cuoi, 'Cuối tháng']]
    .map(([d, nhan]) => nut('klThHan', d, `${nhan} · ${ngan(d)}${d < homNay ? ', đã qua' : ''}`, `Hạn ${formatNgay(d)}, tính từ ngày nhận ${formatNgay(moc)}`)).join(''));
}

function veKeThua() {
  const el = $('gvKeThua'); if (!el) return;
  const c = cha(); el.classList.toggle('hidden', !c);
  if (!c) { dat('gvKeThua', ''); return; }
  const dong = (nhan, gt) => (gt ? `<div><dt>${nhan}</dt><dd>${escapeHtml(gt)}</dd></div>` : '');
  dat('gvKeThua', `<p class="kt-dau"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
    Kế thừa từ ${escapeHtml(c.ma)} — phần cấp trên đã giao, cấp dưới chỉ xem</p><dl>${dong('Nội dung', c.noi_dung)}${dong('Văn bản', c.so_ket_luan)}
    ${dong('Hạn của cấp trên', c.han_xu_ly ? formatNgay(c.han_xu_ly) : '')}${dong('Sản phẩm', c.san_pham_ten)}${dong('Lĩnh vực', c.linh_vuc_ten || c.nganh_ten)}</dl>`);
}

// Cột phải: văn bản đang chọn (đọc lại ô mỗi lần vẽ), số việc đã nhập (kl_van_ban_so_viec — tổng thật, đọc lại khi mở biểu mẫu và sau mỗi
// lần giao) trên dự kiến, các việc vừa nhập có trong dữ liệu đã tải. Lượt đọc cũ về sau lượt mới thì bỏ.
let soViec = null; let luotDoc = 0;
function veVanBan() {
  const el = $('gvVanBanDangNhap'); if (!el) return;
  const id = $('klThVanBan').value; const v = id && id !== MOI ? timTrongDs(id) : null;
  el.classList.toggle('hidden', !v);
  if (!v) return;
  const daNhap = soViec ? soViec.get(v.id) ?? 0 : null; const duKien = v.so_nhiem_vu_du_kien || 0;
  const ds = (dh.rows.length ? dh.rows : dongTongQuan()).filter((r) => r.van_ban_id === v.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5);
  dat('gvVanBanDangNhap', `<div class="tam-dau"><h2>Văn bản đang nhập</h2></div><div class="vbn">
    <b class="vbn-so">${escapeHtml(v.so_ket_luan || 'Văn bản mới')}</b><span class="chu-phu">${escapeHtml(v.trich_yeu || '')}${v.ngay_ban_hanh ? ` · ban hành ${formatNgay(v.ngay_ban_hanh)}` : ''}</span>
    <div class="vbn-tien"><span>Đã nhập</span><b>${daNhap ?? '…'}${duKien ? ` / ${duKien}` : ''}</b></div>${duKien && daNhap !== null ? `<span class="thuoc-tq tot"><i style="width:${Math.min(100, Math.round((daNhap / duKien) * 100))}%"></i></span>` : ''}
    ${ds.length ? `<ul class="vbn-ds">${ds.map((r) => `<li><span><b>${escapeHtml(r.ma)}</b> ${escapeHtml(r.noi_dung)}<small>${escapeHtml(r.owner_tai_khoan_ten || (r.owner_don_vi_ten || '').replace(/^\d+\.\s*/, ''))}${r.han_xu_ly ? `, hạn ${formatNgay(r.han_xu_ly)}` : ''}</small></span></li>`).join('')}</ul>` : ''}</div>`);
}
async function docSoViec() {
  const lan = ++luotDoc;
  try { const m = await soViecTheoVanBan(); if (lan === luotDoc) { soViec = m; veVanBan(); } } catch { /* lỗi đọc số: giữ số cũ, không chặn nhập */ }
}

function capNhat() { veQuyTac(); veChonNhanh(); veKeThua(); }

function gvChonNhanh({ o, gt }) {
  const el = $(o); if (!el || el.disabled) return;
  el.value = gt;
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  el.focus();
}

export function mountGiaoViecV9() {
  const form = $('giaoViecForm'); if (!form) return;
  ['input', 'change'].forEach((ev) => form.addEventListener(ev, capNhat));
  $('klThVanBan').addEventListener('change', () => { veVanBan(); if (!soViec) docSoViec(); });   // kể cả khi ô tìm tự chọn (van-ban.js)
  // Mở biểu mẫu (khởi tạo xong: data-san-sang = 1): vẽ lại và đọc lại số đã nhập.
  new MutationObserver(() => { if (form.dataset.sanSang === '1') { capNhat(); veVanBan(); docSoViec(); } }).observe(form, { attributes: true, attributeFilter: ['data-san-sang'] });
  form.addEventListener('gv-da-giao', () => { capNhat(); veVanBan(); docSoViec(); });   // index.js: "Giao, nhập tiếp" xong — ô đã đặt lại, số đã nhập tăng
  registerActions({ gvChonNhanh });
}
