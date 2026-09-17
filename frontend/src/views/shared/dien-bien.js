// Diễn biến tại chỗ (GĐ22, v_dien_bien 0037): một dòng thời gian gộp lịch sử, chỉ đạo/phản hồi, từ chối (lý do chỉ khi RLS cho), minh chứng,
// cảnh báo — mới nhất trên đầu. "Xem diễn biến" trên thẻ/dòng mở rộng ngay dưới thẻ đó (không rời trang); ngăn chi tiết dùng cùng dòng thời gian.
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { notifyError } from '../../components/toast.js';
import { loadDienBien, TEN_LOAI_CHI_DAO, TEN_TRANG_THAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { tenCot } from '../../lib/kl/nhan.js';
import { moNhiemVu } from './kl/index.js';

const NHAN_NGUON = { lich_su: '', canh_bao: 'Cảnh báo', tu_choi: 'Từ chối', tu_choi_ly_do: 'Lý do từ chối', chi_dao: 'Chỉ đạo', phan_hoi: 'Phản hồi', minh_chung: 'Minh chứng' };
const LOP_NGUON = { lich_su: 'db-lich-su', canh_bao: 'db-canh-bao', tu_choi: 'db-tu-choi', tu_choi_ly_do: 'db-tu-choi', chi_dao: 'db-chi-dao', phan_hoi: 'db-phan-hoi', minh_chung: 'db-minh-chung' };
const TT_MC = { CHO_XAC_NHAN: 'chờ xác nhận', HOP_LE: 'hợp lệ', KHONG_HOP_LE: 'không hợp lệ' };

function noiDung(d) {
  if (d.nguon === 'lich_su') {
    if (d.loai === '*') return `Tạo dòng ${escapeHtml(d.noi_dung || '')}`;
    if (d.gia_tri_cu === null || d.gia_tri_cu === undefined) return `<b>${escapeHtml(tenCot(d.loai))}</b>: ${escapeHtml(d.noi_dung || '')}`;
    return `<b>${escapeHtml(tenCot(d.loai))}</b>: ${escapeHtml(d.gia_tri_cu || '(trống)')} → ${escapeHtml(d.noi_dung || '(trống)')}`;
  }
  if (d.nguon === 'chi_dao' || d.nguon === 'phan_hoi') {
    const phu = [d.gia_tri_cu ? `<span class="dk dk-${d.gia_tri_cu === 'Hỏa tốc' ? 'hoa-toc' : d.gia_tri_cu === 'Thượng khẩn' ? 'thuong-khan' : 'khan'}">${escapeHtml(d.gia_tri_cu)}</span>` : '',
      d.nguon === 'chi_dao' && d.loai !== 'Y_KIEN' ? `<span class="nhan-xam">${TEN_TRANG_THAI_CHI_DAO[d.trang_thai] || ''}</span>` : ''].filter(Boolean).join(' ');
    return `<b>${escapeHtml(TEN_LOAI_CHI_DAO[d.loai] || d.loai)}</b>: ${escapeHtml(d.noi_dung || '')} ${phu}`;
  }
  if (d.nguon === 'minh_chung') return `${escapeHtml(d.noi_dung || '')} <span class="nhan-xam">${TT_MC[d.trang_thai] || ''}</span>`;
  return escapeHtml(d.noi_dung || '');
}

export function dienBienHtml(rows) {
  if (!rows.length) return '<p class="chu-phu">Chưa có diễn biến nào.</p>';
  return `<ul class="dien-bien">${rows.map((d) => `<li class="${LOP_NGUON[d.nguon] || ''}" data-nguon="${escapeHtml(d.nguon)}">
      <span class="db-luc">${formatDateTime(d.luc)}</span><span class="db-nguoi">${escapeHtml(d.nguoi_ten || 'Hệ thống')}</span>
      ${NHAN_NGUON[d.nguon] ? `<span class="db-nhan">${NHAN_NGUON[d.nguon]}</span>` : ''}<span class="db-nd">${noiDung(d)}</span></li>`).join('')}</ul>`;
}

// Nạp và vẽ vào một phần tử chứa (ngăn chi tiết, khối dưới thẻ).
export async function napDienBien(el, nhiemVuId) {
  if (!el) return;
  el.innerHTML = '<p class="chu-phu">Đang tải diễn biến…</p>';
  // Trong lúc đọc, vùng chứa có thể đã bị vẽ lại (giuDienBien gắn lại bản sao) → ghi vào phần tử đang có trong trang, không vào phần tử đã rời DOM.
  const dich = () => (el.isConnected ? el : $(`db-${nhiemVuId}`)?.querySelector(':scope > div')) || el;
  try { dich().innerHTML = dienBienHtml(await loadDienBien(nhiemVuId)); } catch (e) { notifyError(e.message); dich().innerHTML = `<p class="loi-inline">${escapeHtml(e.message)}</p>`; }
}

// "Xem diễn biến" trên thẻ/dòng: mở rộng ngay dưới thẻ chứa nút (bấm lại để gập); không có thẻ chứa (chuông, ngăn) → mở ngăn chi tiết như cũ.
export async function xemDienBien({ id, ma }, el) {
  const the = el?.closest('.the, .the-con, article.viec, .nv-dong, .hang-nv');
  if (!the) { await moNhiemVu(id, ma, 'chi-tiet'); return; }
  const co = the.querySelector(`#db-${id}`) || $(`db-${id}`);
  if (co && the.contains(co)) { co.remove(); el.setAttribute('aria-expanded', 'false'); return; }
  the.insertAdjacentHTML('beforeend', `<div class="khoi-nho db-khoi" id="db-${id}"><h4>Diễn biến <span class="chu-phu">${escapeHtml(ma || '')}</span></h4><div></div></div>`);
  el.setAttribute('aria-expanded', 'true');
  await napDienBien(the.querySelector(`#db-${id} > div`), id);
}

// Khối diễn biến đang mở trong một vùng sắp vẽ lại (nạp lại nền, realtime): nhớ HTML theo id việc trước, gắn lại vào đúng thẻ sau khi vẽ —
// người dùng vừa bấm "Xem diễn biến" không bị mất khối chỉ vì danh sách vẽ lại. Gọi: const tra = giuDienBien(vung); vung.innerHTML = …; tra();
export function giuDienBien(vung) {
  const ds = [...(vung?.querySelectorAll('.db-khoi') || [])].map((k) => [k.id.slice(3), k.outerHTML]);
  return () => ds.forEach(([id, html]) => {
    const nut = vung.querySelector(`[data-action="xemDienBien"][data-id="${id}"]`);
    const the = nut?.closest('.the, .the-con, article.viec, .nv-dong, .hang-nv');
    if (!the || the.querySelector(`#db-${id}`)) return;
    the.insertAdjacentHTML('beforeend', html);
    nut.setAttribute('aria-expanded', 'true');
  });
}
