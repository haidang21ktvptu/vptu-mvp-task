// Khối "Đọc văn bản gốc (PDF)" ở khối 1 của Giao việc (v3.25): chỉ dựng HTML từ trạng thái (doc-ai.js giữ trạng thái, đọc tệp, gọi trợ lý AI, điền ô).
// Mỗi giá trị kèm nhãn đối chiếu (rê chuột xem câu trích nguyên văn); văn bản đã có trên hệ thống thì báo đã chọn văn bản có sẵn; danh sách nhiệm vụ
// với nút điền từng việc / điền tất cả (tối đa 20 thẻ một lượt — giao xong thì điền tiếp).
import { escapeHtml } from '../../../lib/dom.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { nhanXacMinh, chuThongKe } from '../../../lib/kl/dien-van-ban.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { nhanVanBan } from './van-ban.js';

const esc = escapeHtml;
const ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>';
export const dauHtml = () => `<div class="gv-doc-dau"><button type="button" class="nut nho" data-action="gvDocChon" id="gvDocNut">${ICON}<span>Đọc văn bản gốc (PDF) để điền sẵn</span></button>
  <input type="file" id="gvDocTep" accept="application/pdf,.pdf" hidden><small class="gv-chu-thich" id="gvDocChu"></small></div>
  <p class="gv-doc-tt hidden" id="gvDocTt" role="status"></p><div class="gv-doc-kq hidden" id="gvDocKq"></div>`;

const xm = (x, trich = '') => { const [lop, ten] = nhanXacMinh(x); return `<span class="gv-xm ${lop}" title="${esc(trich ? `Trích nguyên văn: “${trich}”` : ten)}">${ten}</span>`; };
const giaTriVb = (x) => (x.k === 'ngay_ban_hanh' ? formatNgay(x.gia_tri) : x.k === 'loai' ? tenLoaiVanBan(x.gia_tri) : x.gia_tri);
const ten = (ds, ma) => (ds || []).find((x) => x.ma === ma)?.ten || ma;

function vanBanHtml(s) {
  if (s.vbCo) return `<p class="gv-doc-vbco"><b>Văn bản này đã có trên hệ thống:</b> ${esc(nhanVanBan(s.vbCo))} — đã chọn văn bản có sẵn, các nhiệm vụ giao thêm vào văn bản này.</p>`;
  if (!s.vbKh.length) return '<p class="chu-phu">Không tách được số hiệu, ngày ban hành của văn bản — đồng chí nhập ở các ô bên dưới.</p>';
  const giu = s.giuVb ? '<p class="chu-phu">Đồng chí đang chọn một văn bản có sẵn — giữ nguyên lựa chọn đó. Thông tin đọc được dưới đây dùng khi chọn "Văn bản mới".</p>' : '';
  return `${giu}<dl class="gv-doc-vb">${s.vbKh.map((x) => `<div><dt>${esc(x.ten)}</dt><dd><span class="gv-doc-gt">${esc(giaTriVb(x))}</span>${xm(x.xac_minh, x.trich)}
    ${s.vbDaDien.has(x.o) ? '<small class="gv-doc-da">đã điền</small>' : x.trong ? `<button type="button" class="nut nho" data-action="gvDocDienVb" data-o="${x.o}">Điền</button>` : '<small class="chu-phu">ô đã có giá trị — giữ nguyên</small>'}</dd></div>`).join('')}</dl>`;
}
function nvHtml(s, n, i, dm) {
  const han = n.han?.gia_tri ? `Hạn: ${formatNgay(n.han.gia_tri)} ${xm(n.han.xac_minh, n.han.trich)}` : '';
  const phu = [n.don_vi_chu_tri?.gia_tri ? `Chủ trì theo văn bản: ${esc(n.don_vi_chu_tri.gia_tri)}` : '', han,
    n.san_pham?.gia_tri ? `Sản phẩm: ${esc(ten(dm.sanPham, n.san_pham.gia_tri))}` : '', n.linh_vuc?.gia_tri ? `Lĩnh vực: ${esc(ten(dm.linhVuc, n.linh_vuc.gia_tri))}` : '',
    n.muc_tieu?.length ? `Mục tiêu gợi ý: ${n.muc_tieu.length}` : ''].filter(Boolean).join(' · ');
  const tt = s.daGiao.has(i) ? '<small class="gv-doc-da">đã giao</small>' : s.the.has(i) ? `<small class="gv-doc-da">đã điền vào ${esc(s.tenThe(s.the.get(i)))}</small>`
    : `<button type="button" class="nut nho" data-action="gvDocDien" data-i="${i}">Điền vào thẻ</button>`;
  return `<li class="gv-doc-nv${s.daGiao.has(i) ? ' xong' : ''}"><div class="gv-doc-nd"><p>${esc(n.noi_dung?.gia_tri || '')}</p>${xm(n.noi_dung?.xac_minh)}</div>
    ${phu ? `<small class="chu-phu">${phu}</small>` : ''}<span class="gv-doc-nv-nut">${tt}</span></li>`;
}
// s: { tep, soTrang, moHinh, ncc, banChup, kq, vbKh: [... + trong], vbCo, vbDaDien: Set id ô, the: Map i → khoá thẻ, daGiao: Set i, tenThe(khoá) }
export function ketQuaHtml(s, dm) {
  const ds = s.kq?.nhiem_vu || []; const con = ds.map((_, i) => i).filter((i) => !s.daGiao.has(i) && !s.the.has(i)).length;
  const nut = con ? `<button type="button" class="nut nho chinh" data-action="gvDocDienTatCa">${s.daGiao.size ? `Điền tiếp ${con} nhiệm vụ còn lại` : `Điền ${con} nhiệm vụ vào các thẻ`}</button>` : '';
  return `<div class="gv-doc-kq-dau"><div><b>Đã đọc “${esc(s.tep)}” — ${s.soTrang} trang</b>
      <small class="chu-phu">${esc(s.ncc || 'Trợ lý AI')}${s.moHinh ? ` (${esc(s.moHinh)})` : ''} · ${esc(chuThongKe(s.kq?.thong_ke))}${s.banChup ? ' · tệp là bản chụp: chưa đối chiếu tự động được, đồng chí kiểm tra từng giá trị' : ''}</small></div>
    <button type="button" class="nut nho" data-action="gvDocBo">Bỏ kết quả</button></div>
    ${vanBanHtml(s)}
    ${ds.length ? `<div class="gv-doc-nv-dau"><b>Văn bản giao ${ds.length} nhiệm vụ</b>${nut}</div>${ds.length > 20 ? '<small class="chu-phu">Mỗi lượt giao tối đa 20 nhiệm vụ: giao lượt đầu xong, bấm "Điền tiếp" để điền phần còn lại vào văn bản vừa tạo.</small>' : ''}
      <ol class="gv-doc-ds">${ds.map((n, i) => nvHtml(s, n, i, dm)).join('')}</ol>` : '<p class="chu-phu">Không tách được nhiệm vụ nào — đồng chí nhập ở khối 2.</p>'}
    <small class="chu-phu gv-doc-chan">Chỉ điền vào ô còn trống; giá trị nguyên văn (số hiệu, ngày, trích yếu, nội dung, hạn) chỉ tự điền khi đã đối chiếu được trong tệp — chưa đối chiếu được thì hiện để đồng chí bấm dùng (bản chụp: nội dung điền kèm cảnh báo); sản phẩm, ngành, lĩnh vực, mục tiêu là đề xuất của trợ lý AI. Đồng chí kiểm tra trước khi bấm Giao việc. Tệp và nội dung không lưu vào hệ thống.</small>`;
}
// Ghi chú đầu thẻ sau khi điền (thay ghi chú cũ). kh: keHoachThe; n: nhiệm vụ; thu: số thứ tự trong văn bản / tổng.
export function ghiChuTheHtml(kh, i, tong) {
  const phan = [`Điền từ văn bản (nhiệm vụ ${i + 1}/${tong})`, kh.goiY.chuTri ? `chủ trì theo văn bản: ${esc(kh.goiY.chuTri)}` : '',
    kh.deXuat.length ? 'sản phẩm, ngành, lĩnh vực do trợ lý AI đề xuất — đồng chí kiểm tra' : '', ...kh.canhBao.map(esc)].filter(Boolean).join(' · ');
  const nd = kh.goiY.noiDung ? ` <span data-ai-nd>Nội dung chưa điền: trợ lý AI tách chưa khớp nguyên văn với tệp — đồng chí chép từ văn bản gốc hoặc <button type="button" class="nut nho" data-action="gvDocDungNd" data-i="${i}">Dùng nội dung trợ lý AI tách</button></span>` : '';
  const han = kh.goiY.han ? ` Văn bản nêu thời hạn “${esc(kh.goiY.han.trich || '')}” — chưa đối chiếu được ngày: <button type="button" class="nut nho" data-action="gvDocDungHan" data-i="${i}" data-han="${esc(kh.goiY.han.gia_tri)}">Dùng ngày ${esc(formatNgay(kh.goiY.han.gia_tri))}</button>` : '';
  return `<p class="gv-ai-ghi" data-ai-ghi="${i}">${phan}.${nd}${han}</p>`;
}
