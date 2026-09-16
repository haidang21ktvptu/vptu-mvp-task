// Bảng nhiệm vụ của một cán bộ bung ngay dưới dòng cán bộ (accordion), dùng chung cho cây phân cấp A1 và KPI phòng A2.
// GĐ14: đọc dòng v_nhiem_vu trong state.nhiemVu — nhóm "Owner" (chịu trách nhiệm) và nhóm "theo dõi" tách riêng (CH-2);
// màu từ muc_canh_bao; không có thao tác trên dòng (chỉ đạo → GĐ18), nút "Mở trong Nhiệm vụ" đưa sang danh sách dùng chung.
import { $, escapeHtml } from '../../lib/dom.js';
import { DEPT_NAMES } from '../../lib/constants.js';
import { state, findAccount } from '../../lib/state.js';
import { registerActions } from '../../lib/actions.js';
import { formatNgay } from '../../lib/kl/ngay.js';
import { nhanTrangThai, chamMuc } from '../../lib/kl/nhan.js';
import { sanPhamText } from './kl/dong.js';
import { laOwnerPhong } from './kpi.js';

// Chip KPI theo màu mức (DESIGN mục 2): Owner · đang mở · quá hạn · đỏ đặc biệt · hoàn thành · theo dõi.
// Màu là thông tin: chỉ tô màu mức khi số lớn hơn 0. Nhãn ghi rõ "Owner" và "theo dõi" (CH-2).
export function kpiChipsHtml(kpi, ownerLabel = 'Owner') {
  const chip = (label, n, cls) => `<span class="muc ${n > 0 ? cls : ''}">${label}: ${n}</span>`;
  return [
    chip(ownerLabel, kpi.owner, ''),
    chip('Đang mở', kpi.dangMo, 'muc-xanh'),
    chip('Quá hạn', kpi.quaHan, 'muc-do'),
    chip('Đỏ đặc biệt', kpi.doDacBiet, 'muc-dodb'),
    chip('Hoàn thành', kpi.hoanThanh, ''),
    `<span class="muc chu-phu">đang theo dõi ${kpi.theoDoi} việc</span>`,
  ].join('');
}

function dongHtml(r) {
  const cham = chamMuc(r.muc_canh_bao);
  return `
    <tr class="${r.tien_do_ma === 'HOAN_THANH' ? 'r-ht' : ''}" data-muc="${escapeHtml(r.muc_canh_bao || '')}">
      <td class="tieude">${escapeHtml(r.ma)}<small>${escapeHtml(r.so_ket_luan)}</small></td>
      <td data-nhan="Nội dung" class="noi-dung" title="${escapeHtml(r.noi_dung)}">${escapeHtml(r.noi_dung.length > 100 ? `${r.noi_dung.slice(0, 99)}…` : r.noi_dung)}<small>${escapeHtml(sanPhamText(r) || 'Chưa định nghĩa sản phẩm')}</small></td>
      <td data-nhan="Hạn" class="whitespace-nowrap">${r.han_xu_ly ? formatNgay(r.han_xu_ly) : '—'}</td>
      <td data-nhan="Trạng thái"><span class="${cham.lop}" title="${escapeHtml(cham.ten)}"></span>${escapeHtml(nhanTrangThai(r))}</td>
    </tr>`;
}

function bangHtml(tieuDe, rows) {
  if (rows.length === 0) return '';
  return `
    <div class="bang">
      <div class="bang-dau"><h2 class="text-[15px]">${tieuDe}<span class="chu-phu">${rows.length} việc</span></h2></div>
      <div class="bang-cuon"><table>
        <thead><tr><th>Mã · Văn bản</th><th>Nội dung · Sản phẩm</th><th>Hạn</th><th>Cảnh báo · Trạng thái</th></tr></thead>
        <tbody>${rows.map(dongHtml).join('')}</tbody>
      </table></div>
    </div>`;
}

export function generateInlineTasksHtml(staffId) {
  const staff = findAccount(staffId) || {};
  const owner = state.nhiemVu.filter((r) => r.owner_tai_khoan === staffId);
  const theoDoi = state.nhiemVu.filter((r) => r.nguoi_theo_doi === staffId && r.owner_tai_khoan !== staffId);
  if (owner.length === 0 && theoDoi.length === 0) return '<p class="chu-phu text-center py-3">Cán bộ chưa là Owner hay người theo dõi của nhiệm vụ nào trong phạm vi của đồng chí.</p>';
  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="chu-phu">${escapeHtml(staff.full_name)} · ${escapeHtml(staff.position_title)} · ${DEPT_NAMES[staff.department] || ''}</span>
        <button type="button" data-action="moKlDanhSach" data-loc='${escapeHtml(JSON.stringify({ nguoiTheoDoi: staffId }))}' class="btn btn-phu btn-nho">Mở trong Nhiệm vụ</button>
      </div>
      ${bangHtml('Chịu trách nhiệm (Owner)', owner)}
      ${bangHtml('Đang theo dõi (không tính vào đánh giá)', theoDoi.filter((r) => r.tien_do_ma !== 'HOAN_THANH'))}
    </div>`;
}

// Việc Owner là chính PHÒNG (owner_tai_khoan NULL, owner_don_vi_ma = mã phòng): hiện ở nút phòng, không dưới cá nhân nào.
export function phongOwnerHtml(phongMa) {
  const rows = state.nhiemVu.filter((r) => laOwnerPhong(r, phongMa));
  return rows.length ? bangHtml(`Phòng là Owner — chưa giao tiếp cho cá nhân (${DEPT_NAMES[phongMa] || phongMa})`, rows) : '';
}

// Nút "Chi tiết việc" trên bảng cán bộ: mở/đóng dòng chi tiết ngay dưới (A1 cây + A2 KPI).
export function toggleTableRowAccordion({ rowId, staffId }, btn) {
  const row = $(rowId);
  const isHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden');
  if (btn) {
    btn.innerText = isHidden ? 'Đóng chi tiết' : 'Chi tiết việc';
    btn.setAttribute('aria-expanded', String(isHidden));
  }
  if (isHidden) row.querySelector('td').innerHTML = generateInlineTasksHtml(staffId);
}

export function staffDetailButtonHtml(btnId, rowId, staffId) {
  return `<button type="button" id="${btnId}" data-action="toggleTableRowAccordion" data-row-id="${rowId}" data-staff-id="${staffId}" class="btn btn-phu btn-nho" aria-expanded="false">Chi tiết việc</button>`;
}

registerActions({ toggleTableRowAccordion });
