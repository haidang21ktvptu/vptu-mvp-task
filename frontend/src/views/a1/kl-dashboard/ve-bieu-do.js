// Hàng 3 (thanh xếp chồng theo người theo dõi — chỉ việc đang mở; tỷ lệ hoàn thành 8 hội nghị) và hàng 4 (ngành → lĩnh vực)
// của dashboard A1. Thanh vẽ bằng HTML/CSS, không thư viện; mỗi đoạn/ô số là nút mở danh sách 10B với bộ lọc.
import { escapeHtml } from '../../../lib/dom.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { tenNhom, boSoThuTu } from '../../../lib/kl/nhan.js';
import { formatNgay } from '../../../lib/kl/ngay.js';
import { CHUA_PHAN_LOAI, CHUA_CO_NGANH } from '../../../lib/kl/tong-hop.js';
import { nutLoc } from './ve-o-so.js';

// Thứ tự đoạn trên thanh việc đang mở: đỏ → vàng → xanh → xám. Tên lớp viết NGUYÊN VĂN (không ghép chuỗi) vì Tailwind
// chỉ giữ lớp trong @layer components khi thấy tên đó trong mã nguồn.
const LOP_DOAN = { QUA_HAN: 'doan-QUA_HAN', DANG_DINH_CHINH: 'doan-DANG_DINH_CHINH', SAP_DEN_HAN: 'doan-SAP_DEN_HAN', CAN_DIEN_HAN: 'doan-CAN_DIEN_HAN',
  DANG_THUC_HIEN: 'doan-DANG_THUC_HIEN', CHO_DIEU_KIEN: 'doan-CHO_DIEU_KIEN', HOAN_THANH: 'doan-HOAN_THANH' };
const DOAN_MO = ['QUA_HAN', 'DANG_DINH_CHINH', 'SAP_DEN_HAN', 'CAN_DIEN_HAN', 'DANG_THUC_HIEN', 'CHO_DIEU_KIEN'];

function thanhHtml(nhom, tong, locGoc) {
  return `<div class="thanh" role="group">${DOAN_MO.filter((k) => nhom[k] > 0).map((k) =>
    `<button type="button" class="doan ${LOP_DOAN[k]}" style="flex-basis:${(nhom[k] / tong) * 100}%" ${nutLoc({ ...locGoc, nhom: k })} title="${tenNhom(k)}: ${nhom[k]}" aria-label="${tenNhom(k)}: ${nhom[k]}">${nhom[k]}</button>`).join('')}</div>`;
}

// Hàng 3a (GĐ15, CH-2): theo Owner đơn vị/phòng — nhãn mở danh sách lọc đơn vị; ghi số người theo dõi để thấy "ai theo dõi" là việc riêng.
export function ownerHtml(ds) {
  if (ds.length === 0) return '<p class="bd-trong">Không có việc đang mở.</p>';
  const max = Math.max(...ds.map((c) => c.so));
  return ds.map((c) => `
    <div class="bd-hang">
      <button type="button" class="bd-nhan" ${nutLoc({ donVi: c.owner_don_vi_ma, chiMo: true })}>${escapeHtml(boSoThuTu(c.ten))}<small>${c.trongVanPhong ? 'Trong Văn phòng' : 'Đơn vị ngoài'} · ${c.so} việc đang mở · ${c.nguoiTheoDoi.size} người theo dõi</small></button>
      <div class="bd-thanh-o" style="width:${(c.so / max) * 100}%">${thanhHtml(c.nhom, c.so, { donVi: c.owner_don_vi_ma })}</div>
    </div>`).join('') + chuGiaiHtml();
}

export function nguoiTheoDoiHtml(ds) {
  if (ds.length === 0) return '<p class="bd-trong">Không có việc đang mở.</p>';
  const max = Math.max(...ds.map((c) => c.so));
  return ds.map((c) => `
    <div class="bd-hang">
      <button type="button" class="bd-nhan" ${nutLoc({ nguoiTheoDoi: c.nguoi_theo_doi, chiMo: true })}>${escapeHtml(c.ten)}<small>${escapeHtml(DEPT_NAMES[c.phong] || c.phong || '')} · ${c.so} việc đang mở</small></button>
      <div class="bd-thanh-o" style="width:${(c.so / max) * 100}%">${thanhHtml(c.nhom, c.so, { nguoiTheoDoi: c.nguoi_theo_doi })}</div>
    </div>`).join('') + chuGiaiHtml();
}

function chuGiaiHtml() {
  return `<div class="bd-chu-giai">${DOAN_MO.map((k) => `<span><i class="${LOP_DOAN[k]}"></i>${tenNhom(k)}</span>`).join('')}</div>`;
}

export function hoiNghiHtml(ds) {
  if (ds.length === 0) return '<p class="bd-trong">Chưa có hội nghị nào.</p>';
  return ds.map((h) => `
    <div class="bd-hang">
      <button type="button" class="bd-nhan" ${nutLoc({ hoiNghi: h.so_hoi_nghi })}>Hội nghị ${h.so_hoi_nghi}<small>ban hành ${formatNgay(h.ngay_ban_hanh)} · ${h.hoanThanh}/${h.tong} hoàn thành</small></button>
      <div class="bd-thanh-o">
        <div class="thanh thanh-ty-le">
          <button type="button" class="doan doan-HOAN_THANH" style="flex-basis:${h.tyLe}%" ${nutLoc({ hoiNghi: h.so_hoi_nghi, nhom: 'HOAN_THANH' })} aria-label="Hoàn thành ${h.hoanThanh}">${h.tyLe}%</button>
          <button type="button" class="doan doan-con" style="flex-basis:${100 - h.tyLe}%" ${nutLoc({ hoiNghi: h.so_hoi_nghi, chiMo: true })} aria-label="Chưa hoàn thành ${h.tong - h.hoanThanh}">${h.tong - h.hoanThanh > 0 ? h.tong - h.hoanThanh : ''}</button>
        </div>
      </div>
    </div>`).join('');
}

const KHAC = ['DANG_DINH_CHINH', 'DANG_THUC_HIEN', 'CHO_DIEU_KIEN', 'THUONG_XUYEN']; // cột "Khác" của hàng 4
// Hàng 4: dòng ngành (đậm) + dòng lĩnh vực (thụt vào); ô số là nút; nhóm "Chưa phân loại" / "Chưa có ngành" in nghiêng.
export function nganhLinhVucHtml(ds) {
  if (ds.length === 0) return '<tr><td colspan="7" class="trong">Không có dữ liệu.</td></tr>';
  const o = (so, loc, cls = '') => `<td class="so">${so > 0 ? `<button type="button" class="bd-so ${cls}" ${nutLoc(loc)}>${so}</button>` : '<span class="chu-phu">·</span>'}</td>`;
  const moKhac = (n) => KHAC.reduce((s, k) => s + (n[k] || 0), 0);
  const hang = (ten, n, so, loc, la, chuaPL) => `
    <tr class="${la ? 'bd-nganh' : 'bd-linh-vuc'}${chuaPL ? ' bd-chua-pl' : ''}">
      <td>${escapeHtml(ten)}</td>
      ${o(so, loc)}${o(n.QUA_HAN, { ...loc, nhom: 'QUA_HAN' }, 'bd-do')}${o(n.SAP_DEN_HAN, { ...loc, nhom: 'SAP_DEN_HAN' }, 'bd-vang')}${o(n.CAN_DIEN_HAN, { ...loc, nhom: 'CAN_DIEN_HAN' }, 'bd-vang')}${o(moKhac(n), { ...loc, nhomTrong: KHAC })}${o(n.HOAN_THANH, { ...loc, nhom: 'HOAN_THANH' })}
    </tr>`;
  return ds.map((ng) => {
    const locNganh = { nganh: ng.ma };
    return hang(ng.ten, ng.nhom, ng.so, locNganh, true, ng.ma === CHUA_CO_NGANH)
      + ng.linhVuc.map((l) => hang(l.ten, l.nhom, l.so, { ...locNganh, linhVuc: l.ma }, false, l.ma === CHUA_PHAN_LOAI)).join('');
  }).join('');
}
