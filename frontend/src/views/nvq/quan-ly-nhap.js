// Phân hệ Nhiệm vụ quý BTV — Nhập danh mục quý: từ tệp Word Phụ lục (bảng 7 cột, chữ đỏ cột Stt = chủ trì theo dõi) hoặc tệp Excel theo mẫu. Đọc tệp ngay
// trên trình duyệt → xem trước từng dòng (vị trí, kết quả / sản phẩm tách được, chủ trì theo dõi đã khớp tài khoản; sửa chủ trì từng dòng, gán tên chưa
// khớp cho tài khoản, bỏ dòng) → nhập một lô (nvq_nhap_danh_muc: cùng Trục · Nhóm · Stt → sửa thông tin giao) → hoàn tác lô trong 24 giờ.
import { notifyError, notifySuccess } from '../../components/toast.js';
import { state } from '../../lib/state.js';
import { DEPT_NAMES, TEN_PHONG_NGAN } from '../../lib/constants.js';
import { taoXlsx, taiXuong } from '../../lib/xlsx.js';
import { docXlsx } from '../../lib/xlsx-doc.js';
import { nq, nhapDanhMuc, hoanTacLo, napLoNhap } from '../../lib/nvq/du-lieu.js';
import { docBangWord } from '../../lib/nvq/doc-word.js';
import { dongTuPhuLuc, tomTatNhap, tenViTri, kiemDongNhap } from '../../lib/nvq/phu-luc.js';
import { sheetMau, dongTuMau } from '../../lib/nvq/mau-excel.js';
import { khoaTen } from '../../lib/nvq/tach.js';
import { LOAI_SP, tenKy, tenKyNgan } from '../../lib/nvq/nhan.js';
import { sapXepViTri, spTheoNv } from '../../lib/nvq/tinh.js';
import { e, tenNguoi, tenPhong, rutGon, thoiGian } from './khung.js';
import { hoiLyDo } from './hoi.js';

const nh = { tenTep: '', loai: '', goc: null, biDanh: {}, chuTri: {}, bo: new Set(), ket: null, dangNhap: false };
const khoa = (d) => `${d.truc_so}|${d.nhom}|${d.stt}`;
const TEN_PHONG = Object.fromEntries(Object.keys(DEPT_NAMES).filter((k) => k !== 'LANH_DAO_VAN_PHONG').map((k) => [k, [DEPT_NAMES[k], TEN_PHONG_NGAN[k]]]));
const canBo = () => state.accounts.filter((a) => a.role_group !== 'A0' && !a.is_system && !a.bi_khoa).sort((a, b) => a.full_name.localeCompare(b.full_name, 'vi'));

function phanTich() {
  const ctx = { ky: nq.ky, dmLanhDao: nq.lanhDao, dmDonVi: nq.donVi, taiKhoan: state.accounts, tenPhong: TEN_PHONG, biDanh: nh.biDanh, tenTep: nh.tenTep };
  nh.ket = nh.loai === 'word' ? dongTuPhuLuc(nh.goc, ctx) : dongTuMau(nh.goc, ctx);
  nh.ket.dong.forEach((d) => { const k = khoa(d); if (k in nh.chuTri) d.chu_tri_theo_doi = nh.chuTri[k] || null; });
}
export async function khiChonTepNhap(input) {
  const f = input.files?.[0]; input.value = '';
  if (!f) return false;
  try {
    const buf = await f.arrayBuffer();
    const word = /\.docx$/i.test(f.name);
    if (!word && !/\.xlsx$/i.test(f.name)) throw new Error('Chọn tệp Word (.docx) bảng Phụ lục hoặc tệp Excel (.xlsx) theo mẫu.');
    Object.assign(nh, { tenTep: f.name, loai: word ? 'word' : 'excel', goc: word ? await docBangWord(buf) : await docXlsx(buf), biDanh: {}, chuTri: {}, bo: new Set() });
    phanTich();
    if (!nh.ket.dong.length) throw new Error('Không đọc được dòng nhiệm vụ nào trong tệp.');
    return true;
  } catch (err) { notifyError(err.message); return false; }
}
// Ô chọn trong bảng xem trước: gán tên chưa khớp (data-nq-bi-danh), chủ trì từng dòng (data-nq-ct-nhap), bỏ dòng (data-nq-bo-nhap).
export function khiDoiXemTruoc(el) {
  if (el.dataset.nqBiDanh !== undefined) { if (el.value) nh.biDanh[el.dataset.nqBiDanh] = el.value; else delete nh.biDanh[el.dataset.nqBiDanh]; phanTich(); return true; }
  if (el.dataset.nqCtNhap !== undefined) { nh.chuTri[el.dataset.nqCtNhap] = el.value; phanTich(); return false; }
  if (el.dataset.nqBoNhap !== undefined) { if (el.checked) nh.bo.delete(el.dataset.nqBoNhap); else nh.bo.add(el.dataset.nqBoNhap); return true; }
  return false;
}

function xemTruoc() {
  const { dong, meta, canhBao } = nh.ket;
  const daCo = new Set(nq.rows.map(khoa));
  const chon = dong.filter((d) => !nh.bo.has(khoa(d)));
  const t = tomTatNhap(chon);
  const sai = kiemDongNhap(chon).loi;
  const chuaKhop = new Map();
  meta.forEach((m) => m.khop.filter((x) => !x.id && !x.phong).forEach((x) => chuaKhop.set(khoaTen(x.ten), x)));
  Object.keys(nh.biDanh).forEach((k) => { if (!chuaKhop.has(k)) chuaKhop.set(k, { ten: k }); });
  const ds = canBo();
  const opt = (gt) => `<option value="">— Chưa phân công —</option>${ds.map((a) => `<option value="${a.id}"${a.id === gt ? ' selected' : ''}>${e(a.full_name)}</option>`).join('')}`;
  const ganTen = chuaKhop.size ? `<div class="nq-khoi rong nq-canh"><h4>Tên chủ trì theo dõi chưa khớp tài khoản (${chuaKhop.size})</h4><p class="chu-phu">Chọn cán bộ đúng — áp cho mọi dòng có tên này.</p>`
    + [...chuaKhop.entries()].map(([k, x]) => `<label class="nq-o-form ngang"><span>"${e(x.ten)}"</span><select class="o-nhap nho" data-nq-bi-danh="${e(k)}">${opt(nh.biDanh[k])}</select></label>`).join('') + '</div>' : '';
  const hang = dong.map((d, i) => {
    const k = khoa(d); const bo = nh.bo.has(k);
    const sp = d.san_pham.map((s) => `<li class="${s.trang_thai === 'HOAN_THANH' ? 'tt-xong' : 'tt-xam'}"><i aria-hidden="true"></i><span><small>${LOAI_SP[s.loai] || ''}${s.han ? ` · ${s.han.split('-').reverse().join('/')}` : ''}</small> ${e(rutGon(s.mo_ta, 120))}${s.kq_so_ky_hieu ? ` <b>${e(s.kq_so_ky_hieu)}</b>` : ''}</span></li>`).join('');
    const ph = (d.phoi_hop_theo_doi || []).map(tenNguoi).join(', ');
    return `<tr class="${bo ? 'nq-rut' : ''}"><td data-nhan="Nhập"><input type="checkbox" data-nq-bo-nhap="${k}"${bo ? '' : ' checked'} aria-label="Nhập dòng ${tenViTri(d)}"></td>`
      + `<td data-nhan="Vị trí"><b>${tenViTri(d)}</b><small class="chu-phu">${daCo.has(k) ? 'Đã có — cập nhật thông tin giao' : 'Mới'}</small></td>`
      + `<td class="nq-nd" data-nhan="Nhiệm vụ">${e(rutGon(d.noi_dung, 220))}<small class="chu-phu">${e(rutGon(d.lanh_dao_text || '', 90))} · ${e(rutGon(d.don_vi_text || '', 90))}</small></td>`
      + `<td class="nq-cot-sp" data-nhan="Kết quả, sản phẩm"><ul class="nq-sp-mini">${sp}</ul></td>`
      + `<td data-nhan="Chủ trì theo dõi"><select class="o-nhap nho" data-nq-ct-nhap="${k}" aria-label="Chủ trì theo dõi ${tenViTri(d)}">${opt(d.chu_tri_theo_doi)}</select>`
      + `${d.phong_theo_doi ? `<small>${e(tenPhong(d.phong_theo_doi))}</small>` : ''}${ph ? `<small class="chu-phu">Phối hợp: ${e(ph)}</small>` : ''}`
      + `<small class="chu-phu">${e((meta[i]?.khop || []).map((x) => x.ten).join('; '))}</small></td>`
      + `<td class="nq-cot-kq" data-nhan="Kết quả đã cập nhật">${d.cap_nhat_dau ? e(rutGon(d.cap_nhat_dau.ket_qua_thuc_hien, 200)) : '<span class="chu-phu">—</span>'}</td></tr>`;
  }).join('');
  return `<section class="nq-khoi rong"><h3>Xem trước: ${e(nh.tenTep)}</h3>`
    + `<p><b>${t.tong}</b> nhiệm vụ (${t.trongCt} theo chương trình, kế hoạch; ${t.ngoaiCt} ngoài chương trình, kế hoạch) · <b>${t.sanPham}</b> kết quả, sản phẩm · `
    + `${t.hoanThanh} nhiệm vụ đã hoàn thành theo tệp · ${t.chuaPhanCong} nhiệm vụ chưa có chủ trì theo dõi. Theo trục: ${Object.entries(t.theoTruc).map(([k, v]) => `Trục ${k}: ${v}`).join(' · ')}.</p>`
    + (canhBao.length ? `<details class="nq-canh"><summary>${canhBao.length} lưu ý khi đọc tệp</summary><ul class="nq-ds">${canhBao.map((c) => `<li>${e(c)}</li>`).join('')}</ul></details>` : '')
    + (sai.length ? `<div class="nq-canh"><b>${sai.length} lỗi cần sửa trong tệp (hoặc bỏ dòng) trước khi nhập</b><ul class="nq-ds">${sai.map((c) => `<li>${e(c)}</li>`).join('')}</ul></div>` : '')
    + ganTen
    + `<div class="nq-bang-cuon"><table class="nq-bang nq-bang-nhap"><thead><tr><th>Nhập</th><th>Vị trí</th><th>Nhiệm vụ</th><th>Kết quả, sản phẩm</th><th>Chủ trì theo dõi</th><th>Kết quả đã cập nhật</th></tr></thead><tbody>${hang}</tbody></table></div>`
    + `<div class="hanh-dong"><button type="button" class="nut" data-action="nqHuyNhap">Huỷ</button><button type="button" class="nut chinh" data-action="nqXacNhanNhap"${nh.dangNhap || !chon.length || sai.length ? ' disabled' : ''}>Nhập ${chon.length} nhiệm vụ vào ${e(tenKyNgan(nq.ky))}</button></div></section>`;
}

export async function veNhap() {
  const dau = `<section class="nq-khoi rong"><h3>Nhập danh mục nhiệm vụ ${e(tenKy(nq.ky))}</h3>`
    + '<p>Chọn tệp Word bảng Phụ lục "Danh mục tổ chức thực hiện các chỉ tiêu, nhiệm vụ chính trị trong quý" (chữ đỏ ở cột Stt là chủ trì theo dõi; chữ đỏ ở cột Kết quả / Tiến độ là kết quả đã cập nhật) '
    + 'hoặc tệp Excel theo mẫu. Hệ thống đọc tệp ngay trên máy, hiện bản xem trước để đồng chí rà soát rồi mới nhập.</p>'
    + '<div class="hanh-dong trai"><label class="nut chinh nq-nut-tep">Chọn tệp Word / Excel<input type="file" accept=".docx,.xlsx" data-nq-tep-nhap hidden></label>'
    + '<button type="button" class="nut" data-action="nqTaiMau">Tải mẫu Excel trống</button>'
    + `<button type="button" class="nut" data-action="nqXuatMau"${nq.rows.length ? '' : ' disabled'}>Xuất danh mục quý ra Excel (sửa rồi nhập lại)</button></div></section>`;
  let lo = [];
  try { lo = await napLoNhap(nq.ky.id); } catch { /* bảng lô: không chặn màn */ }
  const moi = Date.now() - 24 * 3600e3;
  const dsLo = lo.length ? `<section class="nq-khoi rong"><h3>Các lần nhập</h3><ul class="nq-ds">${lo.map((l) => `<li>${thoiGian(l.nhap_luc)} · ${e(tenNguoi(l.nhap_boi))} · ${e(l.ten_tep || 'Không tên tệp')} · `
    + `${l.so_moi} mới, ${l.so_sua} cập nhật${l.hoan_tac_luc ? ` · <i>đã hoàn tác ${thoiGian(l.hoan_tac_luc)}</i>` : Date.parse(l.nhap_luc) > moi && l.so_moi
      ? ` <button type="button" class="nq-link" data-action="nqHoanTacLo" data-id="${l.id}">Hoàn tác lô</button>` : ''}</li>`).join('')}</ul></section>` : '';
  return dau + (nh.ket ? xemTruoc() : '') + dsLo;
}

export function hanhDongNhap(veLai, napLaiSauGhi) {
  const xlsx = (ten, dong) => taiXuong(ten, taoXlsx(sheetMau({ dong, tenNguoi, tenPhong })));
  return {
    nqHuyNhap: () => { nh.ket = null; nh.goc = null; return veLai(); },
    nqTaiMau: () => xlsx('Mau-danh-muc-nhiem-vu-quy.xlsx', []),
    nqXuatMau: () => {
      const spMap = spTheoNv(nq.sp);
      xlsx(`Danh-muc-${tenKyNgan(nq.ky).replace(/\W+/g, '-')}.xlsx`, sapXepViTri(nq.rows.filter((r) => r.dieu_chinh !== 'RUT')).map((r) => ({ ...r, san_pham: spMap.get(r.id) || [] })));
    },
    nqXacNhanNhap: async () => {
      if (!nh.ket || nh.dangNhap) return;
      const { dong, loi } = kiemDongNhap(nh.ket.dong.filter((d) => !nh.bo.has(khoa(d))));
      if (loi.length) { notifyError(`Chưa nhập được — ${loi.length} dòng cần sửa: ${loi.slice(0, 3).join(' ')}${loi.length > 3 ? ' …' : ''}`); return; }
      nh.dangNhap = true;
      try {
        const kq = await nhapDanhMuc(nq.ky.id, dong, nh.tenTep);
        notifySuccess(`Đã nhập: ${kq.so_moi} nhiệm vụ mới, ${kq.so_sua} nhiệm vụ cập nhật thông tin giao.`);
        nh.ket = null; nh.goc = null;
        await napLaiSauGhi();
      } catch (err) { notifyError(err.message); } finally { nh.dangNhap = false; }
    },
    nqHoanTacLo: async ({ id }) => {
      const ok = await hoiLyDo({ tieuDe: 'Hoàn tác lô nhập', khongO: true, nutXacNhan: 'Hoàn tác',
        moTa: 'Xoá các nhiệm vụ lô này đã thêm (khi chưa có cập nhật, ý kiến, tệp nào). Thông tin giao đã sửa của nhiệm vụ có sẵn không được khôi phục.' });
      if (!ok) return;
      try { const n = await hoanTacLo(id); notifySuccess(`Đã hoàn tác lô nhập: xoá ${n} nhiệm vụ.`); await napLaiSauGhi(); } catch (err) { notifyError(err.message); }
    },
  };
}
