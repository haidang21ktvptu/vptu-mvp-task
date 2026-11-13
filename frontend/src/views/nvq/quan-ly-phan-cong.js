// Phân hệ Nhiệm vụ quý BTV — Phân công chủ trì theo dõi nhiều nhiệm vụ một lần (đầu mối tổng hợp): bảng phân bổ theo người (số việc, đang làm, chậm, xong —
// bấm tên để lọc), bảng danh mục chế độ chọn, hộp phân công (chủ trì, phối hợp, phòng theo dõi; lý do bắt buộc khi đổi người đang chủ trì — nvq_phan_cong).
import { $ } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { nq, phanCong } from '../../lib/nvq/du-lieu.js';
import { locRows, sapXepViTri, spTheoNv, theoChuTri } from '../../lib/nvq/tinh.js';
import { e, tenNguoi, tenPhong } from './khung.js';
import { dauBangHtml, thanBangHtml } from './dong.js';

const pc = { loc: {}, chon: new Set() };
const canBo = () => state.accounts.filter((a) => a.role_group !== 'A0' && !a.is_system && !a.bi_khoa).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));
const dangHien = () => sapXepViTri(locRows(nq.rows, pc.loc, { dmLanhDao: nq.lanhDao }));

export function vePhanCong() {
  const nhom = theoChuTri(nq.rows, tenNguoi, tenPhong);
  const phanBo = `<section class="nq-khoi rong"><h3>Phân bổ theo chủ trì theo dõi</h3><div class="nq-bang-cuon"><table class="nq-bang nq-bang-gon"><thead><tr><th>Chủ trì theo dõi</th>`
    + '<th>Nhiệm vụ</th><th>Hoàn thành</th><th>Đang thực hiện</th><th>Chưa triển khai</th><th>Chậm tiến độ</th><th>Chưa báo cáo tuần này</th></tr></thead><tbody>'
    + nhom.map((g) => `<tr><td><button type="button" class="nq-link" data-action="nqPcLoc" data-chu-tri="${e(g.khoa || 'chua')}">${e(g.ten)}</button></td><td>${g.tong}</td><td>${g.hoanThanh}</td>`
      + `<td>${g.dang}</td><td>${g.chua}</td><td${g.cham ? ' class="nq-chu-do"' : ''}>${g.cham}</td><td>${g.mo - g.daCapNhatTuan}</td></tr>`).join('') + '</tbody></table></div></section>';
  const ds = canBo();
  const phong = [...new Set(ds.map((a) => a.department).filter((p) => p && p !== 'LANH_DAO_VAN_PHONG'))];
  const chuTriCo = nhom.filter((g) => g.khoa).map((g) => [g.khoa, g.ten]);
  const L = pc.loc;
  const loc = '<div class="nq-bo-loc">'
    + `<label class="nq-loc nq-tim"><span>Tìm</span><input type="search" class="o-nhap nho" data-nq-pc-loc="q" value="${e(L.q || '')}" placeholder="Nội dung, đơn vị, mã…"></label>`
    + `<label class="nq-loc"><span>Trục</span><select class="o-nhap nho" data-nq-pc-loc="truc"><option value="">Tất cả</option>${nq.truc.map((t) => `<option value="${t.so}"${String(L.truc) === String(t.so) ? ' selected' : ''}>Trục ${t.so} — ${e(t.ten_ngan)}</option>`).join('')}</select></label>`
    + `<label class="nq-loc"><span>Chủ trì theo dõi</span><select class="o-nhap nho" data-nq-pc-loc="chuTri"><option value="">Tất cả</option><option value="chua"${L.chuTri === 'chua' ? ' selected' : ''}>Chưa phân công</option>`
    + `${chuTriCo.map(([k, t]) => `<option value="${e(k)}"${L.chuTri === k ? ' selected' : ''}>${e(t)}</option>`).join('')}</select></label></div>`;
  const rows = dangHien();
  const bang = (rows.length ? `<div class="nq-bang-cuon"><table class="nq-bang">${dauBangHtml(true)}<tbody>${thanBangHtml(rows, spTheoNv(nq.sp), { chon: true })}</tbody></table></div>`
    : '<p class="chu-phu">Không có nhiệm vụ khớp bộ lọc.</p>').replace(/data-nq-chon="([^"]+)"/g, (m, id) => (pc.chon.has(id) ? `${m} checked` : m));
  const form = '<form class="nq-form nq-pc-hop" data-submit="nqPhanCongNhieu"><h3>Phân công cho các nhiệm vụ đã chọn</h3><div class="nq-luoi-form">'
    + `<label class="nq-o-form"><span>Chủ trì theo dõi</span><select class="o-nhap nho" name="chu_tri"><option value="">— Chưa phân công —</option>${ds.map((a) => `<option value="${a.id}">${e(a.full_name)} (${e(tenPhong(a.department))})</option>`).join('')}</select></label>`
    + `<label class="nq-o-form"><span>Phối hợp theo dõi (giữ Ctrl để chọn nhiều)</span><select class="o-nhap" name="phoi_hop" multiple size="5">${ds.map((a) => `<option value="${a.id}">${e(a.full_name)}</option>`).join('')}</select></label>`
    + `<label class="nq-o-form"><span>Phòng theo dõi</span><select class="o-nhap nho" name="phong"><option value="">— Không —</option>${phong.map((p) => `<option value="${p}">${e(tenPhong(p))}</option>`).join('')}</select></label>`
    + '<label class="nq-o-form rong"><span>Lý do (bắt buộc khi đổi người đang chủ trì)</span><input class="o-nhap nho" name="ly_do" maxlength="500"></label></div>'
    + '<p class="chu-phu">Phân công thay toàn bộ chủ trì, phối hợp, phòng theo dõi của các nhiệm vụ đã chọn; người được phân công nhận thông báo.</p>'
    + `<div class="hanh-dong trai"><label class="nq-hop"><input type="checkbox" data-nq-chon-het${rows.length && rows.every((r) => pc.chon.has(r.id)) ? ' checked' : ''}> Chọn tất cả đang hiện (${rows.length})</label>`
    + `<button type="submit" class="nut chinh" id="nqPcNut"${pc.chon.size ? '' : ' disabled'}>Phân công ${pc.chon.size} nhiệm vụ</button>`
    + `<button type="button" class="nut" data-action="nqPcBoChon"${pc.chon.size ? '' : ' disabled'}>Bỏ chọn</button></div></form>`;
  return phanBo + `<section class="nq-khoi rong"><h3>Danh mục — chọn nhiệm vụ cần phân công</h3>${loc}${form}${bang}</section>`;
}

function capNhatNut() {
  const n = $('nqPcNut'); if (!n) return;
  n.textContent = `Phân công ${pc.chon.size} nhiệm vụ`; n.disabled = !pc.chon.size;
}
// Ô chọn / ô lọc trong thẻ Phân công. Trả true khi cần vẽ lại.
export function khiDoiPhanCong(el) {
  if (el.dataset.nqChon) { if (el.checked) pc.chon.add(el.dataset.nqChon); else pc.chon.delete(el.dataset.nqChon); capNhatNut(); return false; }
  if (el.dataset.nqChonHet !== undefined) { dangHien().forEach((r) => (el.checked ? pc.chon.add(r.id) : pc.chon.delete(r.id))); return true; }
  if (el.dataset.nqPcLoc) { pc.loc[el.dataset.nqPcLoc] = el.value || undefined; return true; }
  return false;
}

export function hanhDongPhanCong(veLai, napLaiSauGhi) {
  return {
    nqPcLoc: ({ chuTri }) => { pc.loc = { chuTri }; return veLai(); },
    nqPcBoChon: () => { pc.chon.clear(); return veLai(); },
    nqPhanCongNhieu: async (ds, form) => {
      const f = new FormData(form);
      const ids = [...pc.chon].filter((id) => nq.rows.some((r) => r.id === id));
      if (!ids.length) return;
      try {
        const n = await phanCong(ids, { chu_tri: f.get('chu_tri') || null, phoi_hop: f.getAll('phoi_hop'), phong: f.get('phong') || null }, String(f.get('ly_do') || ''));
        notifySuccess(n ? `Đã phân công ${n} nhiệm vụ.` : 'Các nhiệm vụ đã chọn đã đúng phân công này.');
        pc.chon.clear();
        await napLaiSauGhi();
      } catch (err) { notifyError(err.message); }
    },
  };
}
