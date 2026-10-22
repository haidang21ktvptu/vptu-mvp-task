// Diễn biến tại chỗ (GĐ22, v_dien_bien 0037): một dòng thời gian gộp lịch sử, chỉ đạo/phản hồi, từ chối (lý do chỉ khi RLS cho), minh chứng,
// cảnh báo — mới nhất trên đầu. "Xem diễn biến" trên thẻ/dòng mở rộng ngay dưới thẻ đó (không rời trang); ngăn chi tiết dùng cùng dòng thời gian.
import { $, escapeHtml, formatDateTime } from '../../lib/dom.js';
import { notifyError } from '../../components/toast.js';
import { loadDienBien, TEN_LOAI_CHI_DAO, TEN_TRANG_THAI_CHI_DAO } from '../../lib/kl/dieu-hanh.js';
import { tenCot } from '../../lib/kl/nhan.js';
import { moNhiemVu } from './kl/index.js';
import { hienGiaTri } from './kl/chi-tiet.js';

const NHAN_NGUON = { lich_su: '', canh_bao: 'Cảnh báo', tu_choi: 'Từ chối', tu_choi_ly_do: 'Lý do từ chối', chi_dao: 'Chỉ đạo', phan_hoi: 'Phản hồi', minh_chung: 'Minh chứng' };
const LOP_NGUON = { lich_su: 'db-lich-su', canh_bao: 'db-canh-bao', tu_choi: 'db-tu-choi', tu_choi_ly_do: 'db-tu-choi', chi_dao: 'db-chi-dao', phan_hoi: 'db-phan-hoi', minh_chung: 'db-minh-chung' };
const TT_MC = { CHO_XAC_NHAN: 'chờ xác nhận', HOP_LE: 'hợp lệ', KHONG_HOP_LE: 'không hợp lệ' };

// Giá trị trong lịch sử hiện bằng tên, ngày dd/mm/yyyy (như bảng căn cứ của ngăn chi tiết — hienGiaTri): mã danh mục (ngành, lĩnh vực, nguồn, chất
// lượng, mức quan trọng, cơ quan trình, tiến độ, loại thời hạn, cấp, đơn vị), tài khoản (chủ trì, người theo dõi, Thường trực chỉ đạo), ngày.
const gt = (cot, v) => (v == null || v === '' ? v : hienGiaTri(cot, v));
function noiDung(d) {
  if (d.nguon === 'lich_su') {
    if (d.loai === '*') return `Tạo dòng ${escapeHtml(d.noi_dung || '')}`;
    if (d.loai === 'han_nop_minh_chung_ly_do') return escapeHtml(d.noi_dung || '');   // PR-2b: tin đã đủ "Đổi hạn nộp minh chứng · mã: cũ → mới — lý do"
    if (d.gia_tri_cu === null || d.gia_tri_cu === undefined) return `<b>${escapeHtml(tenCot(d.loai))}</b>: ${escapeHtml(gt(d.loai, d.noi_dung) || '')}`;
    return `<b>${escapeHtml(tenCot(d.loai))}</b>: <s class="cu">${escapeHtml(gt(d.loai, d.gia_tri_cu) || '(trống)')}</s> → <span class="moi">${escapeHtml(gt(d.loai, d.noi_dung) || '(trống)')}</span>`;   // Đợt C1: cũ gạch ngang
  }
  if (d.nguon === 'chi_dao' || d.nguon === 'phan_hoi') {
    const phu = [d.gia_tri_cu ? `<span class="dk dk-${d.gia_tri_cu === 'Hỏa tốc' ? 'hoa-toc' : d.gia_tri_cu === 'Thượng khẩn' ? 'thuong-khan' : 'khan'}">${escapeHtml(d.gia_tri_cu)}</span>` : '',
      d.nguon === 'chi_dao' && d.loai !== 'Y_KIEN' ? `<span class="nhan-xam">${TEN_TRANG_THAI_CHI_DAO[d.trang_thai] || ''}</span>` : ''].filter(Boolean).join(' ');
    return `<b>${escapeHtml(TEN_LOAI_CHI_DAO[d.loai] || d.loai)}</b>: ${escapeHtml(d.noi_dung || '')} ${phu}`;
  }
  if (d.nguon === 'minh_chung') return `${escapeHtml(d.noi_dung || '')} <span class="nhan-xam">${TT_MC[d.trang_thai] || ''}</span>`;
  return escapeHtml(d.noi_dung || '');
}

// v3.29: dòng của các ô đã được một dòng khác ghi CÙNG LẦN (cùng lúc) nói đủ thì ẩn — lĩnh vực tự đổi theo ngành (không còn ô Lĩnh vực; lĩnh vực
// đổi riêng — rà soát bằng tệp, sửa lĩnh vực chi tiết — vẫn hiện); hạn, số lần gia hạn khi "Điều chỉnh hạn"; chủ trì, phòng, người theo dõi khi
// "Đổi chủ trì theo dõi"; tiến độ, ngày hoàn thành khi "Mở lại nhiệm vụ" (dòng tóm tắt có cũ → mới và lý do).
const AN_CUNG_LAN = { nganh_ma: ['linh_vuc_ma'], dieu_chinh_han: ['han_xu_ly', 'so_lan_gia_han'], doi_chu_tri: ['owner_tai_khoan', 'owner_don_vi_ma', 'nguoi_theo_doi'],
  mo_lai: ['tien_do_ma', 'ngay_hoan_thanh'] };
export function dienBienHtml(tatCa) {
  const ls = tatCa.filter((d) => d.nguon === 'lich_su');
  const an = new Set(ls.flatMap((d) => (AN_CUNG_LAN[d.loai] || []).map((c) => `${c}|${d.luc}`)));
  const rows = tatCa.filter((d) => !(d.nguon === 'lich_su' && an.has(`${d.loai}|${d.luc}`)));
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
  // Phải tính xong HTML (sau await) RỒI mới gọi dich(): trong `dich().innerHTML = await …` vế trái được đánh giá trước await → trỏ phần tử cũ.
  const dich = () => (el.isConnected ? el : $(`db-${nhiemVuId}`)?.querySelector(':scope > div')) || el;
  try {
    const html = dienBienHtml(await loadDienBien(nhiemVuId));
    dich().innerHTML = html;
  } catch (e) {
    const loi = `<p class="loi-inline">${escapeHtml(e.message)}</p>`;
    notifyError(e.message);
    dich().innerHTML = loi;
  }
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
