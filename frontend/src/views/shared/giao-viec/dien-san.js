// Hoàn thiện một dòng "Chờ hoàn thiện" của lô nhập Excel (v9 đợt 2): biểu mẫu Giao việc điền sẵn từ dữ liệu đã chuẩn hoá của dòng (dong_nhap.du_lieu),
// dải nhắc phía trên ghi lô / dòng / ô còn thiếu / lý do DB trả. Điền theo thứ tự các ô phụ thuộc nhau (văn bản → thay mặt [chờ đọc phạm vi] → Owner
// → ngành → lĩnh vực → người theo dõi) bằng chính sự kiện change của ô, nên mọi kiểm tra / gợi ý của biểu mẫu chạy như người dùng chọn. Gửi Giao
// việc kèm dong_nhap_id (+ vướng mắc của dòng) → giao_viec (0073) gắn việc vào dòng (DA_HOAN_THIEN). Quyền thật ở DB.
import { $, show, escapeHtml } from '../../../lib/dom.js';
import { vanBanTheoKhoa } from '../../../lib/kl/du-lieu.js';
import { nhanTruong } from '../../../lib/kl/nhap/truong.js';
import { giaTriNhom } from '../../../lib/kl/thay-mat.js';
import { napVanBan, MOI } from './van-ban.js';

let dang = null;   // dòng đang hoàn thiện: { id, so_dong, lo_ma, ten_tep, du_lieu, thieu, ghi_chu }
// Gửi kèm dòng chờ: vướng mắc và ghi chú của tệp (biểu mẫu không có hai ô này) — giao_viec ghi cùng lúc tạo việc.
export const themHoanThien = (p) => (dang ? Object.assign(p, { dong_nhap_id: dang.id, ...(dang.du_lieu?.vuong_mac ? { vuong_mac: dang.du_lieu.vuong_mac } : {}),
  ...(dang.du_lieu?.ghi_chu ? { ghi_chu: dang.du_lieu.ghi_chu } : {}) }) : p);
export function boHoanThien() { dang = null; show('gvHoanThien', false); $('gvHoanThien').innerHTML = ''; }

const cho = (dk, ms = 5000) => new Promise((ok) => { const t0 = Date.now(); const lap = () => (dk() || Date.now() - t0 > ms ? ok() : setTimeout(lap, 40)); lap(); });
const phat = (o, loai = 'change') => o.dispatchEvent(new Event(loai, { bubbles: true }));
const coOpt = (id, v) => Boolean(v) && [...($(id)?.options || [])].some((o) => o.value === String(v));
const chon = (id, v) => { if (coOpt(id, v)) { $(id).value = String(v); phat($(id)); return true; } return false; };
const go = (id, v, loai = 'input') => { if (v !== null && v !== undefined && v !== '' && $(id)) { $(id).value = String(v); phat($(id), loai); } };

export async function apDienSan(dong, { nhanMoi }) {
  dang = dong; const d = dong.du_lieu || {};
  $('gvHoanThien').innerHTML = `<b>Hoàn thiện dòng ${dong.so_dong} của lô ${escapeHtml(dong.lo_ma)}</b> (tệp ${escapeHtml(dong.ten_tep)})${dong.thieu?.length
    ? ` — còn thiếu: ${escapeHtml(dong.thieu.map(nhanTruong).join(', '))}` : ''}${dong.ghi_chu ? `. Hệ thống báo: ${escapeHtml(dong.ghi_chu)}` : ''}.${
    d.tien_do_ma === 'HOAN_THANH' ? ' Tệp ghi việc đã hoàn thành: giao xong, chủ trì nộp minh chứng để lãnh đạo nghiệm thu.' : ''}
    <button type="button" class="nut nho" data-action="gvBoHoanThien">Thôi, về danh sách chờ</button>`;
  show('gvHoanThien', true);
  // 1. Văn bản: đã có trên hệ thống (đúng khoá: số hội nghị + số hiệu, hoặc loại + số hiệu + ngày ban hành) → chọn; chưa có → văn bản mới điền sẵn.
  let vb = null;
  if (d.so_ket_luan) {
    try { vb = await vanBanTheoKhoa({ so: d.so_ket_luan, soHn: d.so_hoi_nghi, loai: d.loai_van_ban || 'KHAC', ngay: d.ngay_ban_hanh }); } catch { /* đọc lỗi: điền văn bản mới */ }
  }
  if (vb) { await napVanBan({ nhanMoi, giu: vb.id, kem: vb.id }); chon('klThVanBan', vb.id); } else {
    $('klThVanBan').value = MOI; phat($('klThVanBan'));
    chon('klThLoaiVB', d.loai_van_ban); go('klThSoHN', d.so_hoi_nghi); go('klThSoKL', d.so_ket_luan); go('klThNgayBH', d.ngay_ban_hanh, 'change');
  }
  // 2. Thay mặt (chuyên viên giao): đổi lãnh đạo → biểu mẫu khoá trong lúc đọc phạm vi → chờ mở lại rồi mới chọn Owner / ngành.
  if (!$('klThThayMatWrap').classList.contains('hidden') && chon('klThThayMat', d.thay_mat_nhom ? giaTriNhom(d.thay_mat_nhom) : d.thay_mat_cho)) { await cho(() => $('gvKhoa').disabled); await cho(() => !$('gvKhoa').disabled); }
  // 3. Owner (cán bộ, không thì đơn vị) → ngành → lĩnh vực → người theo dõi.
  if (!(d.owner_tai_khoan && chon('klThOwner', `tk:${d.owner_tai_khoan}`))) chon('klThOwner', d.owner_don_vi_ma ? `dv:${d.owner_don_vi_ma}` : '');
  chon('klThNganh', d.nganh_ma); chon('klThLinhVuc', d.linh_vuc_ma); chon('klThNguoiTheoDoi', d.nguoi_theo_doi);
  // 4. Các ô còn lại.
  go('klThNoiDung', d.noi_dung); chon('klThSanPham', d.san_pham_loai); chon('klThCapNhan', d.cap_nhan_san_pham);
  chon('klThLoai', d.loai_thoi_han_ma); go('klThHan', d.han_xu_ly);
  if (chon('klThNguon', d.nguon_nhiem_vu_ma)) phat($('klThNguon'), 'input');   // đánh dấu đã chọn: mặc định theo loại văn bản không ghi đè
  go('klThPhoiHop', d.don_vi_phoi_hop); go('klThVanBanTK', d.van_ban_trien_khai); go('klThGhiChu', d.linh_vuc_chi_tiet);
  if (d.van_ban_trien_khai || d.linh_vuc_chi_tiet) $('gvThemWrap').open = true;   // v3.18: "Thông tin thêm" thu gọn — có giá trị từ tệp thì mở cho thấy
  $('klThDoKhanWrap').querySelector(`.dk-chon button[data-gia-tri="${d.do_khan || 'THUONG'}"]`)?.click();   // độ khẩn của biểu mẫu chính (thẻ nhiệm vụ cũng có .dk-chon)
  phat($('giaoViecForm'), 'input');
  $('klThNoiDung').focus();
}
