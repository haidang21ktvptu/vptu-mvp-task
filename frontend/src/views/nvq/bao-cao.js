// Phân hệ Nhiệm vụ quý BTV — Báo cáo quý: (1) báo cáo tuần — chọn tuần, chốt tuần (đầu mối: ảnh chụp trạng thái từng nhiệm vụ, nhận xét), xuất DỰ THẢO báo cáo
// Word theo thể thức Văn phòng + Excel; (2) báo cáo kết quả quý — tình hình đánh giá, xuất Word / Excel; (3) tổng hợp theo lãnh đạo phụ trách / đơn vị.
// Người ký, nơi nhận của dự thảo nhớ theo máy (localStorage — chỉ là tiện ích; không có thì dùng mặc định).
import { $ } from '../../lib/dom.js';
import { notifyError, notifySuccess } from '../../components/toast.js';
import { homNayVN } from '../../lib/kl/ngay.js';
import { nq, napCapNhatTuan, napAnhTuan, chotTuan, moLaiTuan } from '../../lib/nvq/du-lieu.js';
import { tenKy, DANH_GIA, TRANG_THAI } from '../../lib/nvq/nhan.js';
import { demTheoTrangThai, tuanCua, trongDanhMuc } from '../../lib/nvq/tinh.js';
import { e, vn, vnNgan, dauTrang, chuaCoKy, tenNguoi, thoiGian } from './khung.js';
import { khoiTheoNhom } from './tong-quan-2.js';
import { hoiLyDo } from './hoi.js';

const bc = { tuanId: '' };
const KHOA_KY = 'vptu.nvq.nguoi-ky';
const MAC_DINH_KY = { quyenHan: '', chucVu: 'CHÁNH VĂN PHÒNG', hoTen: '', noiNhan: '- Thường trực Tỉnh ủy (b/c);\n- Các đồng chí Ủy viên Ban Thường vụ Tỉnh ủy;\n- Lãnh đạo Văn phòng;\n- Lưu Văn phòng Tỉnh ủy.' };
const docKy = () => { try { return { ...MAC_DINH_KY, ...JSON.parse(localStorage.getItem(KHOA_KY) || '{}') }; } catch { return { ...MAC_DINH_KY }; } };
const ghiKy = (v) => { try { localStorage.setItem(KHOA_KY, JSON.stringify(v)); } catch { /* chế độ riêng tư: bỏ qua */ } };
const tuanDangChon = () => nq.tuans.find((w) => w.id === bc.tuanId) || tuanCua(nq.tuans, homNayVN());

export async function veBaoCao(el) {
  if (!nq.ky) { el.innerHTML = dauTrang('Báo cáo quý') + chuaCoKy(nq.quyen.quan_ly); return; }
  const hom = homNayVN();
  const w = tuanDangChon(); bc.tuanId = w?.id || '';
  const chon = nq.tuans.filter((x) => x.tu_ngay <= hom).map((x) => `<option value="${x.id}"${x.id === w?.id ? ' selected' : ''}>Tuần ${x.so} (${vnNgan(x.tu_ngay)} – ${vn(x.den_ngay)})${x.trang_thai === 'DA_CHOT' ? ' — đã chốt' : ''}</option>`).join('');
  const sl = w?.so_lieu;
  const d = demTheoTrangThai(nq.rows);
  const k = docKy();
  const ql = nq.quyen.quan_ly && nq.ky.trang_thai !== 'DA_CHOT';
  const dg = trongDanhMuc(nq.rows);
  el.innerHTML = dauTrang('Báo cáo quý')
    + '<div class="nq-luoi">'
    + `<section class="nq-khoi rong"><div class="nq-khoi-dau"><h2>Báo cáo tiến độ hằng tuần</h2><span class="chu-phu">Văn phòng tổng hợp, báo cáo Thường trực, Ban Thường vụ Tỉnh ủy</span></div>`
    + `<label class="nq-o-form"><span>Tuần báo cáo</span><select class="o-nhap nho" data-nq-chon-tuan>${chon}</select></label>`
    + (w ? `<p>${w.trang_thai === 'DA_CHOT' ? `<span class="trang-thai tt-xong">Đã chốt</span> ${thoiGian(w.chot_luc)} · ${e(tenNguoi(w.chot_boi))}` : '<span class="trang-thai tt-cho">Chưa chốt</span>'}</p>`
      + `<p class="chu-phu">${sl ? `Số liệu khi chốt: ${sl.tong} nhiệm vụ — hoàn thành ${sl.hoan_thanh}, đang thực hiện ${sl.dang + (sl.thuong_xuyen || 0)}, chậm tiến độ ${sl.cham}, chưa triển khai ${sl.chua}; ${sl.co_cap_nhat} nhiệm vụ có báo cáo trong tuần.`
        : `Số liệu hiện tại: ${d.tong} nhiệm vụ — hoàn thành ${d.HOAN_THANH}, đang thực hiện ${d.DANG_THUC_HIEN + d.THUONG_XUYEN}, chậm tiến độ ${d.CHAM_TIEN_DO}, chưa triển khai ${d.CHUA_TRIEN_KHAI}.`}</p>`
      + (w.nhan_xet && !(ql && w.trang_thai !== 'DA_CHOT') ? `<p><b>Nhận xét:</b> ${e(w.nhan_xet)}</p>` : '') : '')
    + (ql && w ? (w.trang_thai === 'DA_CHOT' ? '<button type="button" class="nut" data-action="nqMoLaiTuan">Mở lại tuần</button>'
      : `<form class="nq-form" data-submit="nqChotTuan"><label class="nq-o-form rong"><span>Nhận xét, đề xuất của Văn phòng (đưa vào báo cáo)</span><textarea class="o-nhap" name="nhan_xet" rows="3" maxlength="4000">${e(w.nhan_xet || '')}</textarea></label><button type="submit" class="nut chinh">Chốt báo cáo tuần</button></form>`) : '')
    + '<div class="hanh-dong"><button type="button" class="nut lam" data-action="nqXuatWord" data-loai="tuan">Xuất dự thảo báo cáo tuần (Word)</button><button type="button" class="nut" data-action="nqXuatExcelBc" data-loai="tuan">Xuất Excel</button></div></section>'
    + `<section class="nq-khoi rong"><div class="nq-khoi-dau"><h2>Báo cáo kết quả ${e(tenKy(nq.ky))}</h2><span class="chu-phu">Hạn báo cáo kết quả: ${nq.ky.han_bao_cao_ket_qua ? vn(nq.ky.han_bao_cao_ket_qua) : 'chưa ghi'}</span></div>`
    + `<p>${Object.entries(DANH_GIA).map(([m, t]) => `${e(t)}: <b>${dg.filter((r) => r.danh_gia === m).length}</b>`).join(' · ')} · Chưa đánh giá: <b>${dg.filter((r) => !r.danh_gia).length}</b>`
    + ` · Đề xuất của chủ trì theo dõi chờ chốt: <b>${dg.filter((r) => !r.danh_gia && r.danh_gia_de_xuat).length}</b></p>`
    + '<div class="hanh-dong"><button type="button" class="nut lam" data-action="nqXuatWord" data-loai="quy">Xuất dự thảo báo cáo kết quả quý (Word)</button><button type="button" class="nut" data-action="nqXuatExcelBc" data-loai="quy">Xuất Excel</button>'
    + (nq.quyen.quan_ly ? '<button type="button" class="nut" data-action="openNqQuanLy" data-the="cuoi-quy">Đánh giá, chốt quý</button>' : '') + '</div></section>'
    + `<details class="nq-khoi rong"><summary>Người ký, nơi nhận của dự thảo</summary><form class="nq-form" data-submit="nqLuuNguoiKy"><div class="nq-luoi-form">`
    + `<label class="nq-o-form"><span>Quyền hạn ký (nếu ký thay)</span><select class="o-nhap nho" name="quyenHan"><option value="">— Ký trực tiếp —</option><option value="K/T CHÁNH VĂN PHÒNG"${k.quyenHan ? ' selected' : ''}>K/T CHÁNH VĂN PHÒNG</option></select></label>`
    + `<label class="nq-o-form"><span>Chức vụ người ký</span><input class="o-nhap nho" name="chucVu" value="${e(k.chucVu)}" maxlength="80"></label>`
    + `<label class="nq-o-form"><span>Họ tên người ký</span><input class="o-nhap nho" name="hoTen" value="${e(k.hoTen)}" maxlength="80"></label></div>`
    + `<label class="nq-o-form rong"><span>Nơi nhận (mỗi dòng một nơi)</span><textarea class="o-nhap" name="noiNhan" rows="4">${e(k.noiNhan)}</textarea></label><button type="submit" class="nut">Lưu trên máy này</button></form></details>`
    + khoiTheoNhom(nq.rows) + '</div>';
}

async function duLieuTuan(w) {
  const [cap, anh] = await Promise.all([napCapNhatTuan(w.id), w.trang_thai === 'DA_CHOT' ? napAnhTuan(w.id) : Promise.resolve([])]);
  const theoAnh = new Map(anh.map((a) => [a.nhiem_vu_id, a]));
  const rows = nq.rows.map((r) => { const a = theoAnh.get(r.id); return a ? { ...r, trang_thai: a.trang_thai, muc: a.muc, ket_qua_thuc_hien: a.ket_qua ?? r.ket_qua_thuc_hien } : r; });
  return { cap, rows };
}
async function xuatWord({ loai }) {
  try {
    const { taoBaoCaoWord } = await import('../../lib/nvq/bao-cao-word.js');
    const { taiXuong } = await import('../../lib/xlsx.js');
    const { KIEU_DOCX } = await import('../../lib/nvq/docx.js');
    const hom = homNayVN(); const w = tuanDangChon();
    const { cap, rows } = loai === 'tuan' && w ? await duLieuTuan(w) : { cap: [], rows: nq.rows };
    const ngay = loai === 'tuan' && w && w.den_ngay < hom ? w.den_ngay : hom;
    const k = docKy();
    const bytes = taoBaoCaoWord({ loai, ky: nq.ky, tuan: w, rows, sp: nq.sp, capNhatTuan: cap, dm: { truc: nq.truc, lanhDao: nq.lanhDao, donVi: nq.donVi }, vanBan: nq.vanBan, ngay,
      kyTen: { quyenHan: k.quyenHan, chucVu: k.chucVu || (k.quyenHan ? 'PHÓ CHÁNH VĂN PHÒNG' : 'CHÁNH VĂN PHÒNG'), hoTen: k.hoTen }, noiNhan: k.noiNhan.split('\n').map((x) => x.trim()).filter(Boolean),
      nhanXet: loai === 'tuan' ? w?.nhan_xet : nq.ky.chot_nhan_xet });
    taiXuong(`Bao cao ${loai === 'tuan' ? `tuan ${w?.so}` : 'ket qua'} ${tenKy(nq.ky)}.docx`, bytes, KIEU_DOCX);
  } catch (err) { notifyError(`Không xuất được báo cáo: ${err.message}`); }
}
async function xuatExcelBc({ loai }) {
  try {
    const { taoXlsx, taiXuong } = await import('../../lib/xlsx.js');
    const { sheetMau } = await import('../../lib/nvq/mau-excel.js');
    const { spTheoNv, theoLanhDao, theoDonVi } = await import('../../lib/nvq/tinh.js');
    const w = tuanDangChon();
    const { cap, rows } = loai === 'tuan' && w ? await duLieuTuan(w) : { cap: [], rows: nq.rows };
    const spMap = spTheoNv(nq.sp); const capTheo = new Map(cap.filter((c) => c.noi_dung).map((c) => [c.nhiem_vu_id, c.noi_dung]));
    const sh = sheetMau({ dong: rows.map((r) => ({ ...r, san_pham: spMap.get(r.id) || [] })), tenNguoi, tenPhong: (p) => p });
    sh[0].cot.push({ nhan: 'Trạng thái', rong: 18 }, { nhan: loai === 'tuan' ? 'Kết quả trong tuần' : 'Đánh giá', rong: 40 });
    rows.forEach((r, i) => sh[0].dong[i].push(TRANG_THAI[r.trang_thai]?.ten || r.trang_thai, loai === 'tuan' ? capTheo.get(r.id) || '' : [DANH_GIA[r.danh_gia] || '', r.danh_gia_ly_do || ''].filter(Boolean).join(' — ')));
    const nhom = (ten, ds) => ({ ten, cot: ['Tên', 'Số nhiệm vụ', 'Hoàn thành', 'Đang thực hiện', 'Chậm tiến độ', 'Tỷ lệ hoàn thành (%)'].map((nhan, i) => ({ nhan, rong: i ? 14 : 50 })),
      dong: ds.map((x) => [x.ten, x.tong, x.hoanThanh, x.dang, x.cham, x.tyLe]) });
    taiXuong(`Bao cao ${loai === 'tuan' ? `tuan ${w?.so}` : 'ket qua'} ${tenKy(nq.ky)}.xlsx`,
      taoXlsx([...sh.slice(0, 2), nhom('Theo lãnh đạo phụ trách', theoLanhDao(rows, nq.lanhDao)), nhom('Theo đơn vị', theoDonVi(rows, nq.donVi))]));
  } catch (err) { notifyError(`Không xuất được Excel: ${err.message}`); }
}

export function hanhDongBaoCao(veLai, napLaiSauGhi) {
  return {
    nqXuatWord: xuatWord,
    nqXuatExcelBc: xuatExcelBc,
    nqChotTuan: async (ds, form) => {
      const w = tuanDangChon(); if (!w) return;
      try { await chotTuan(w.id, String(new FormData(form).get('nhan_xet') || '')); notifySuccess(`Đã chốt báo cáo tuần ${w.so}.`); await napLaiSauGhi(); } catch (err) { notifyError(err.message); }
    },
    nqMoLaiTuan: async () => {
      const w = tuanDangChon(); if (!w) return;
      const ly = await hoiLyDo({ tieuDe: `Mở lại báo cáo tuần ${w.so}`, moTa: 'Cập nhật mới có ngày trong tuần này lại được tính vào tuần; chốt lại để có ảnh chụp số liệu mới.' });
      if (!ly) return;
      try { await moLaiTuan(w.id, ly); notifySuccess('Đã mở lại tuần.'); await napLaiSauGhi(); } catch (err) { notifyError(err.message); }
    },
    nqLuuNguoiKy: (ds, form) => { ghiKy(Object.fromEntries(new FormData(form))); notifySuccess('Đã lưu người ký, nơi nhận trên máy này.'); },
    chonTuan: (id) => { bc.tuanId = id; return veLai(); },
  };
}
export const dangChonTuan = () => $('viewNvq')?.querySelector('[data-nq-chon-tuan]');
