// Ô của hộp "Sửa toàn bộ thông tin" (v3.29, 0125 — tài khoản quản trị): nhóm Thông tin giao (như "Sửa thông tin giao" — O_GIAO, trừ Lĩnh vực: tự
// xác định theo ngành, lĩnh vực chi tiết trong cùng quy tắc với sua-tang-lv.js) và nhóm Thực hiện (hạn, loại thời hạn, ngày giao, ngày hoàn thành,
// cấp cần quyết định, văn bản triển khai, kết quả dạng chữ, ghi chú). Mỗi ô điền sẵn giá trị đang có; chỉ ô người dùng đổi được gửi —
// sua_toan_bo_nhiem_vu so lại với dòng đã khoá và kiểm như khi giao (danh mục, ngành – lĩnh vực theo loại văn bản, ngày, cha – con). Không có ô định
// danh (mã, người giao, việc cha, văn bản của việc); chủ trì, người theo dõi đổi ở "Đổi chủ trì theo dõi".
import { escapeHtml } from '../../../lib/dom.js';
import { danhMucKl } from '../../../lib/kl/du-lieu.js';
import { O_GIAO } from '../../../lib/kl/sua-tang.js';
import { oMoiHtml } from './sua-tang.js';
import { lvSauSua, ghiChuLv } from './sua-tang-lv.js';

export const O_TB_GIAO = O_GIAO.filter(([c]) => c !== 'linh_vuc_ma');
export const O_TB_THUC_HIEN = [['han_xu_ly', 'Hạn xử lý', 'ngay'], ['loai_thoi_han_ma', 'Loại thời hạn', 'loaiThoiHan'], ['ly_do_chua_co_han', 'Lý do chưa có hạn', 'chu'],
  ['ngay_nhan_van_ban', 'Ngày giao nhiệm vụ', 'ngay'], ['ngay_hoan_thanh', 'Ngày hoàn thành', 'ngay'], ['cap_quyet_dinh', 'Cấp cần quyết định', 'cap'],
  ['van_ban_trien_khai', 'Văn bản triển khai', 'chu'], ['minh_chung', 'Kết quả, minh chứng (dạng chữ)', 'vb'], ['ghi_chu', 'Ghi chú', 'vb']];
const TEN = Object.fromEntries([...O_TB_GIAO, ...O_TB_THUC_HIEN].map(([c, n]) => [c, n]));
export const idO = (cot) => `stb-${cot}`;
const opt = (v, t, chon) => `<option value="${escapeHtml(v)}"${chon ? ' selected' : ''}>${escapeHtml(t)}</option>`;
// Ô của việc này: ngày hoàn thành chỉ khi việc đã hoàn thành (DB không cho ghi ngày hoàn thành cho việc chưa xong).
export const oCuaViec = (r) => [...O_TB_GIAO, ...O_TB_THUC_HIEN.filter(([c]) => c !== 'ngay_hoan_thanh' || r.tien_do_ma === 'HOAN_THANH')];

const GOI_Y = {
  han_xu_ly: 'Sửa ở đây là đính chính, không tính lần gia hạn (gia hạn: "Điều chỉnh hạn").',
  ngay_hoan_thanh: 'Không để trống khi việc đã hoàn thành; muốn việc chạy lại: "Mở lại nhiệm vụ".',
};
function oThucHienHtml([cot, nhan, kieu], r) {
  const id = idO(cot); const v = r[cot] ?? '';
  const lbl = `<label for="${id}" class="nhan">${escapeHtml(nhan)}</label>`;
  const goiY = GOI_Y[cot] ? `<small class="chu-phu">${escapeHtml(GOI_Y[cot])}</small>` : '';
  if (kieu === 'ngay') return `${lbl}<input type="date" id="${id}" class="o-nhap" value="${escapeHtml(v)}">${goiY}`;
  if (kieu === 'vb') return `${lbl}<textarea id="${id}" class="o-nhap" rows="2" maxlength="2000">${escapeHtml(v)}</textarea>`;
  if (kieu === 'chu') return `${lbl}<input type="text" id="${id}" class="o-nhap" maxlength="1000" value="${escapeHtml(v)}">`;
  const ds = (kieu === 'loaiThoiHan' ? danhMucKl().loaiThoiHan : danhMucKl().cap) || [];
  const trong = kieu === 'cap' ? opt('', '(chưa xác định)', !v) : '';
  return `${lbl}<select id="${id}" class="o-nhap">${trong}${ds.map((d) => opt(d.ma, d.ten, d.ma === v)).join('')}</select>${goiY}`;
}
const lopO = (kieu) => (kieu === 'vb' ? 'stb-o stb-o-rong' : 'stb-o');

// HTML hai nhóm ô (điền sẵn giá trị của r).
export function oSuaToanBoHtml(r) {
  const giao = O_TB_GIAO.map(([c, n, k]) => `<div class="${lopO(k)}">${oMoiHtml(c, r, idO(c), n)}</div>`).join('');
  const thucHien = oCuaViec(r).slice(O_TB_GIAO.length).map((o) => `<div class="${lopO(o[2])}">${oThucHienHtml(o, r)}</div>`).join('');
  return `<h3 class="stb-nhom">Thông tin giao</h3><div class="stb-luoi">${giao}</div>
    <h3 class="stb-nhom">Thực hiện</h3><div class="stb-luoi">${thucHien}</div>`;
}

// Đọc biểu mẫu → { thay, ghiChu, ten }. doc(cot) = giá trị đang nhập (đã cắt khoảng trắng); dau = giá trị lúc mở hộp — chỉ ô người dùng đổi mới vào
// thay ('' → null; ô chọn không có sẵn giá trị đang có thì không tự sinh thay đổi). Đổi ngành / lĩnh vực chi tiết → kèm linh_vuc_ma tự xác định (như
// sua-tang.js) khi khác lĩnh vực đang có; ghiChu: câu về lĩnh vực và lãnh đạo phụ trách; ten: nhãn các ô sẽ sửa.
export function thayDoiTuForm(r, doc, dau) {
  const thay = {};
  oCuaViec(r).forEach(([c]) => { const moi = doc(c); if (moi !== undefined && moi !== dau[c]) thay[c] = moi || null; });
  const r2 = { ...r, ...thay, linh_vuc_ma: r.linh_vuc_ma };
  const cot = 'nganh_ma' in thay ? 'nganh_ma' : thay.linh_vuc_chi_tiet ? 'linh_vuc_chi_tiet' : '';
  const lv = cot ? lvSauSua(cot, thay[cot] || '', r2) : null;
  if (lv && lv.ma !== (r.linh_vuc_ma ?? null)) thay.linh_vuc_ma = lv.ma;
  const ghiChu = cot ? ghiChuLv(cot, thay[cot] || '', r2) : '';
  const ten = Object.keys(thay).map((c) => (c === 'linh_vuc_ma' ? 'Lĩnh vực (tự xác định)' : TEN[c] || c));
  return { thay, ghiChu, ten };
}
