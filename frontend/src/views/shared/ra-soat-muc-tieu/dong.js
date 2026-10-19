// Một dòng của màn Rà soát mục tiêu then chốt (v3.25): mã + nội dung (bấm mở ngăn chi tiết dùng chung), văn bản · chủ trì · trạng thái, mục tiêu ĐANG
// TÍNH trên Tổng quan (theo DB: gắn riêng hoặc theo văn bản), ô chọn có gợi ý (views/shared/kl/chon-muc-tieu.js — khoá 'rs-<id>') và nút Chấp nhận (chỉ
// sáng khi lựa chọn khác DB VÀ dòng đã nhận diện xong — lưu sớm hơn thì không ghi được phản hồi "bỏ", lần sau tự tích lại mục vừa bỏ). Chỉ dựng chuỗi
// HTML / cập nhật chữ trong dòng — không gọi mạng.
import { escapeHtml } from '../../../lib/dom.js';
import { boSoThuTu, tenNhom } from '../../../lib/kl/nhan.js';
import { mucTieuCua, laTheoVanBan } from '../../../lib/kl/muc-tieu.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { khungHtml } from '../kl/chon-muc-tieu.js';
import { tenTap } from './ke-hoach.js';

export const khoaO = (id) => `rs-${id}`;
const vanBan = (r) => (r.van_ban_id ? `${tenLoaiVanBan(r.van_ban_loai)} ${r.so_ket_luan || '(không số)'}` : 'Không gắn văn bản');
const chuTri = (r) => r.owner_tai_khoan_ten || boSoThuTu(r.owner_don_vi_ten) || 'chưa xác định';
// v3.26: ngành – lĩnh vực đang ghi (khối 3 Tổng quan); sửa hàng loạt bằng tệp rà soát (nhap-tep.js), việc đang mở sửa ở ngăn chi tiết.
const nganhChu = (r) => (r.nganh_ma ? `Ngành: ${boSoThuTu(r.nganh_ten || r.nganh_ma)}${r.linh_vuc_ten ? ` — ${r.linh_vuc_ten}` : ' — chưa có lĩnh vực'}` : 'Chưa phân loại ngành, lĩnh vực');
// "Đang tính: …" — đúng phần Tổng quan đang đếm cho việc này.
export function hienChu(r, dm) {
  const ds = mucTieuCua(r);
  return ds.length ? `Đang tính: ${tenTap(ds, dm)}${laTheoVanBan(r) ? ' (theo văn bản)' : ''}` : 'Đang tính: chưa phân loại mục tiêu then chốt';
}
// Trạng thái dòng: đang nhận diện / lỗi nhận diện / đồng chí đã chọn, chưa lưu / mục tích sẵn chờ chấp nhận / đã lưu / không có gì để chấp nhận.
export function trangThaiChu({ kq, daLuu, coKe, thaoTac }) {
  if (!kq) return 'Đang nhận diện…';
  if (coKe && thaoTac) return 'Đồng chí đã chọn, chưa lưu';
  if (kq === 'loi') return coKe ? 'Đồng chí đã chọn, chưa lưu' : 'Chưa nhận diện được — chọn từ danh mục nếu cần.';
  if (coKe) return 'Mục tích sẵn chờ chấp nhận';
  return daLuu ? 'Đã lưu' : 'Không có mục nào cần chấp nhận';
}

export function dongHtml(r, { dm, kq, daLuu, coKe, thaoTac }) {
  return `<article class="rs-dong${daLuu ? ' da-luu' : ''}" id="rsDong-${r.id}" data-id="${r.id}">
    <div class="rs-viec"><button type="button" class="ten-bam" data-action="rsMoViec" data-id="${r.id}" data-ma="${escapeHtml(r.ma)}"><span class="ma-ng">${escapeHtml(r.ma)}</span><b>${escapeHtml(r.noi_dung)}</b></button>
      <small class="chu-phu">${escapeHtml(vanBan(r))} · ${escapeHtml(chuTri(r))} · ${escapeHtml(tenNhom(r.nhom_dem))}</small>
      <small class="chu-phu rs-nganh">${escapeHtml(nganhChu(r))}</small>
      <small class="rs-hien" data-rs-hien="${r.id}">${escapeHtml(hienChu(r, dm))}</small></div>
    <div class="rs-mt">${khungHtml(khoaO(r.id), { nhan: 'Mục tiêu then chốt' })}</div>
    <div class="rs-chan"><span class="chu-phu" data-rs-tt="${r.id}" aria-live="polite">${escapeHtml(trangThaiChu({ kq, daLuu, coKe, thaoTac }))}</span>
      <button type="button" class="nut nho chinh" data-action="rsLuu" data-id="${r.id}"${coKe && kq ? '' : ' disabled'}>Chấp nhận</button></div>
  </article>`;
}
// Cập nhật chữ + nút của một dòng đang vẽ (sau khi gợi ý về, người dùng chọn, lưu xong) — ô chọn vẽ lại riêng (veO).
export function capNhatDong(r, { dm, kq, daLuu, coKe, thaoTac }) {
  const el = document.getElementById(`rsDong-${r.id}`); if (!el) return;
  el.classList.toggle('da-luu', Boolean(daLuu) && !coKe);
  const hien = el.querySelector('[data-rs-hien]'); if (hien) hien.textContent = hienChu(r, dm);
  const tt = el.querySelector('[data-rs-tt]'); if (tt) tt.textContent = trangThaiChu({ kq, daLuu, coKe, thaoTac });
  const nut = el.querySelector('[data-action="rsLuu"]'); if (nut) nut.disabled = !(coKe && kq);
}
