// Phân hệ Nhiệm vụ quý BTV — Danh mục nhiệm vụ quý: bảng đúng cột Phụ lục (nhóm theo trục → nhóm), thêm Kết quả thực hiện mới nhất (chủ trì theo dõi ghi),
// Trạng thái, Chủ trì theo dõi. Lọc: chữ, trạng thái (ô số), trục, nhóm, lãnh đạo phụ trách, đơn vị tham mưu chủ trì, chủ trì theo dõi, tháng có mốc,
// việc tôi theo dõi, chưa báo cáo tuần này, cần lãnh đạo quan tâm. Bấm dòng → ngăn chi tiết. In; Xuất Excel (danh mục + kết quả / sản phẩm).
import { $ } from '../../lib/dom.js';
import { state } from '../../lib/state.js';
import { notifyError } from '../../components/toast.js';
import { nq } from '../../lib/nvq/du-lieu.js';
import { THU_TU_TT, TRANG_THAI, NHOM_NGAN, tenKy } from '../../lib/nvq/nhan.js';
import { locRows, sapXepViTri, spTheoNv, demTheoTrangThai, lanhDaoCaNhan } from '../../lib/nvq/tinh.js';
import { e, dauTrang, chuaCoKy, oSo, tenNguoi, tenPhong } from './khung.js';
import { dauBangHtml, thanBangHtml } from './dong.js';

export const dm = { loc: {}, tuTongQuan: false };
const sel = (id, nhan, ds, gt) => `<label class="nq-loc"><span>${nhan}</span><select class="o-nhap nho" data-nq-loc="${id}"><option value="">Tất cả</option>`
  + ds.map(([v, t]) => `<option value="${e(String(v))}"${String(gt ?? '') === String(v) ? ' selected' : ''}>${e(t)}</option>`).join('') + '</select></label>';

function boLoc(rows) {
  const L = dm.loc;
  const chuTri = new Map();
  rows.forEach((r) => { if (r.chu_tri_theo_doi) chuTri.set(r.chu_tri_theo_doi, tenNguoi(r.chu_tri_theo_doi)); else if (r.phong_theo_doi) chuTri.set(`phong:${r.phong_theo_doi}`, tenPhong(r.phong_theo_doi)); });
  const thang = [...new Set(nq.sp.filter((s) => s.han).map((s) => s.han.slice(0, 7)))].sort();
  const ldCo = new Set(rows.flatMap((r) => lanhDaoCaNhan(r.lanh_dao_ma, nq.lanhDao)));
  return '<div class="nq-bo-loc">'
    + `<label class="nq-loc nq-tim"><span>Tìm</span><input type="search" class="o-nhap nho" data-nq-loc="q" value="${e(L.q || '')}" placeholder="Nội dung, đơn vị, kết quả, mã…"></label>`
    + sel('truc', 'Trục', nq.truc.map((t) => [t.so, `Trục ${t.so} — ${t.ten_ngan}`]), L.truc)
    + sel('nhom', 'Nhóm', Object.entries(NHOM_NGAN), L.nhom)
    + sel('lanhDao', 'Lãnh đạo phụ trách', nq.lanhDao.filter((l) => !l.tap_the && ldCo.has(l.ma)).map((l) => [l.ma, l.ten]), L.lanhDao)
    + sel('donVi', 'Đơn vị tham mưu, chủ trì', nq.donVi.map((d) => [d.ma, d.ten]), L.donVi)
    + sel('chuTri', 'Chủ trì theo dõi', [...[...chuTri.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi')), ['chua', 'Chưa phân công']], L.chuTri)
    + sel('thang', 'Có mốc trong tháng', thang.map((t) => [t, `Tháng ${Number(t.slice(5))}/${t.slice(0, 4)}`]), L.thang)
    + `<label class="nq-hop"><input type="checkbox" data-nq-loc="cuaToi"${L.cuaToi ? ' checked' : ''}> Việc tôi theo dõi</label>`
    + `<label class="nq-hop"><input type="checkbox" data-nq-loc="chuaCapNhat"${L.chuaCapNhat ? ' checked' : ''}> Chưa báo cáo tuần này</label>`
    + `<label class="nq-hop"><input type="checkbox" data-nq-loc="canQuanTam"${L.canQuanTam ? ' checked' : ''}> Cần lãnh đạo quan tâm</label>`
    + (Object.keys(L).some((k) => L[k]) ? '<button type="button" class="nut nho" data-action="nqBoLoc">Bỏ lọc</button>' : '')
    + '</div>';
}

export function dongDangLoc() {
  const L = { ...dm.loc };
  if (L.cuaToi) { L.cuaToi = state.user?.id; L.phongToi = state.user?.department; }
  return sapXepViTri(locRows(nq.rows, L, { dmLanhDao: nq.lanhDao, spMap: spTheoNv(nq.sp) }));
}

export async function veDanhMuc(el, ds = {}) {
  if (ds.loc) { try { dm.loc = JSON.parse(ds.loc); dm.tuTongQuan = true; } catch { dm.loc = {}; } }
  else if (!ds.giu) dm.tuTongQuan = false;
  if (!nq.ky) { el.innerHTML = dauTrang('Danh mục nhiệm vụ quý') + chuaCoKy(nq.quyen.quan_ly); return; }
  const rowsKhongTT = locRows(nq.rows, { ...dm.loc, trangThai: '', coRut: true, cuaToi: dm.loc.cuaToi ? state.user?.id : '', phongToi: state.user?.department },
    { dmLanhDao: nq.lanhDao, spMap: spTheoNv(nq.sp) });
  const d = demTheoTrangThai(rowsKhongTT);
  const o = [{ khoa: '', nhan: 'tất cả', so: d.tong }, ...THU_TU_TT.filter((k) => d[k]).map((k) => ({ khoa: k, nhan: TRANG_THAI[k].ten.toLowerCase(), so: d[k],
    lop: { HOAN_THANH: 'nq-o-luc', CHAM_TIEN_DO: 'nq-o-do', CHUA_TRIEN_KHAI: 'nq-o-xam', RUT: 'nq-o-xam' }[k] || 'nq-o-lam' }))];
  const rows = dongDangLoc();
  const nut = '<button type="button" class="nut" data-action="nqXuatExcel">Xuất Excel</button><button type="button" class="nut" data-action="nqIn">In</button>';
  el.innerHTML = dauTrang('Danh mục nhiệm vụ quý', { nut })
    + (dm.tuTongQuan ? '<button type="button" class="nq-ve" data-action="openNqTongQuan">← Về Tổng quan quý</button>' : '')
    + oSo(o, 'nqLocTrangThai', dm.loc.trangThai || '') + boLoc(nq.rows)
    + `<p class="chu-phu nq-dem-dong" aria-live="polite">Hiển thị ${rows.length} nhiệm vụ${rows.length !== nq.rows.length ? ` (lọc từ ${nq.rows.length})` : ''} · ${e(tenKy(nq.ky))}</p>`
    + (rows.length ? `<div class="nq-bang-khung"><table class="nq-bang">${dauBangHtml()}<tbody>${thanBangHtml(rows, spTheoNv(nq.sp))}</tbody></table></div>`
      : '<div class="trong"><p>Không có nhiệm vụ nào khớp bộ lọc.</p><button type="button" class="nut" data-action="nqBoLoc">Bỏ lọc</button></div>');
}

// Đổi một ô lọc (gõ tìm: chờ 250 ms) → vẽ lại, giữ tiêu điểm.
let hen = null;
export function doiLoc(khoa, giaTri, veLai) {
  if (giaTri === '' || giaTri === false) delete dm.loc[khoa]; else dm.loc[khoa] = giaTri;
  clearTimeout(hen);
  hen = setTimeout(async () => {
    const dangGo = document.activeElement?.dataset?.nqLoc;
    const vt = document.activeElement?.selectionStart;
    await veLai({ giu: true });
    const o = dangGo ? document.querySelector(`[data-nq-loc="${dangGo}"]`) : null;
    if (o) { o.focus(); if (vt !== undefined && o.setSelectionRange) try { o.setSelectionRange(vt, vt); } catch { /* ô không hỗ trợ */ } }
  }, khoa === 'q' ? 250 : 0);
}

export async function xuatExcel() {
  try {
    const [{ sheetMau }, { taoXlsx, taiXuong }] = await Promise.all([import('../../lib/nvq/mau-excel.js'), import('../../lib/xlsx.js')]);
    const spMap = spTheoNv(nq.sp);
    const rows = dongDangLoc().map((r) => ({ ...r, san_pham: spMap.get(r.id) || [] }));
    const sh = sheetMau({ dong: rows, tenNguoi, tenPhong });
    sh[0].cot.push({ nhan: 'Trạng thái', rong: 18 }, { nhan: 'Mã', rong: 10 });
    rows.forEach((r, i) => sh[0].dong[i].push(TRANG_THAI[r.trang_thai]?.ten || r.trang_thai, r.ma));
    taiXuong(`Danh muc nhiem vu ${tenKy(nq.ky).replace(/\s+/g, ' ')}.xlsx`, taoXlsx(sh.slice(0, 2)));
  } catch (err) { notifyError(`Không xuất được Excel: ${err.message}`); }
}
export const inDanhMuc = () => { if ($('viewNvq')) window.print(); };
