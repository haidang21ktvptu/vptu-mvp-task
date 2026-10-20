// Bảng đề xuất của trợ lý AI ở Giao việc (v3.27 — chủ dự án 20/10/2026, mục 5: "cho phép chỉnh sửa nội dung ngay trên bảng đề xuất, cho phép bỏ 1
// nhiệm vụ … Chịu trách nhiệm, Sản phẩm đầu ra, Hạn hoàn thành nên được hiện trong khung đề xuất luôn để điền luôn cho nhanh"): mỗi nhiệm vụ một dòng
// sửa được — nội dung, chịu trách nhiệm, sản phẩm đầu ra, loại thời hạn + hạn, cơ quan/đơn vị trình — bỏ / lấy lại từng dòng. Phần THUẦN: giá trị ban
// đầu của dòng, điền nhanh các dòng còn trống, kế hoạch điền thẻ từ giá trị đã sửa. Giữ quy tắc v3.25: chỉ điền ô còn trống của thẻ; hạn chỉ tự điền
// khi đối chiếu được trong tệp (chưa đối chiếu → nút "Dùng ngày …"); nội dung chưa khớp nguyên văn mà người giao không sửa → thẻ ghi cảnh báo.
// Không DOM, không mạng — unit test frontend/tests/bang-de-xuat.test.mjs.
import { keHoachThe, laTrung } from './dien-van-ban.js';
import { sanPhamMacDinh } from './nhap/mac-dinh.js';

const trong = (v) => v === undefined || v === null || String(v).trim() === '';
export const LOAI_BANG = ['CO_HAN_CU_THE', 'KY_BAN_HANH'];   // loại thời hạn được tạo mới (dm_loai_thoi_han.cho_phep_tao_moi)

// n: nhiệm vụ trợ lý AI tách (máy chủ đã đối chiếu); dsSanPham: danh mục sản phẩm. Sản phẩm: đề xuất của AI, không có thì quy tắc từ khoá (mac-dinh.js).
// Việc trùng (trung_voi) bỏ sẵn — bấm "Lấy lại" để giao riêng.
export function dongBanDau(n, dsSanPham = []) {
  const nd = String(n?.noi_dung?.gia_tri || '');
  const han = n?.han?.xac_minh ? String(n.han.gia_tri || '') : '';
  const loai = n?.loai_thoi_han?.gia_tri === 'KY_BAN_HANH' && !han ? 'KY_BAN_HANH' : 'CO_HAN_CU_THE';
  const ai = n?.san_pham?.gia_tri; const spAi = dsSanPham.some((s) => s.ma === ai) ? ai : '';
  return { noi_dung: nd, owner: '', san_pham: spAi || sanPhamMacDinh(nd, loai, dsSanPham) || '', sp_ai: Boolean(spAi), loai, han,
    han_goi_y: !han && n?.han?.gia_tri ? String(n.han.gia_tri) : '', han_trich: String(n?.han?.trich || ''),
    co_quan_trinh: String(n?.co_quan_trinh?.gia_tri || ''), sua: new Set(), bo: laTrung(n) };
}

// Điền nhanh giá trị chung vào các dòng còn trống (dòng đã bỏ / đã điền vào thẻ / đã giao: khoa(i) — giữ nguyên). → số dòng có thay đổi.
export function dienNhanh(ds, { owner = '', han = '' } = {}, khoa = () => false) {
  let n = 0;
  ds.forEach((d, i) => {
    if (!d || d.bo || khoa(i)) return;
    let doi = false;
    if (owner && !d.owner) { d.owner = owner; d.sua.add('owner'); doi = true; }
    if (han && d.loai !== 'KY_BAN_HANH' && !d.han) { d.han = han; d.sua.add('han'); doi = true; }
    if (doi) n += 1;
  });
  return n;
}

// Kế hoạch điền một thẻ từ dòng đã sửa d. hienTai: giá trị đang có của thẻ (cột → giá trị). → như keHoachThe: { dien, deXuat, canhBao, goiY: { chuTri } }.
// Ngành, lĩnh vực, đơn vị phối hợp, mô tả sản phẩm theo keHoachThe (đề xuất / đã đối chiếu); nội dung, chịu trách nhiệm, sản phẩm, loại thời hạn, hạn,
// cơ quan trình theo giá trị của bảng. deXuat: cột điền theo đề xuất mà người giao chưa sửa (ghi chú đầu thẻ nhắc kiểm tra).
export function keHoachBang(n, d, hienTai = {}, { banChup = false } = {}) {
  const rong = { gia_tri: '' };
  const kh = keHoachThe({ ...n, noi_dung: rong, han: rong, loai_thoi_han: rong, san_pham: rong }, hienTai, { banChup });
  const dien = { ...kh.dien }; const deXuat = [...kh.deXuat]; const canhBao = [...kh.canhBao];
  const sua = d?.sua instanceof Set ? d.sua : new Set();
  const nd = String(d?.noi_dung || '').trim(); const goc = String(n?.noi_dung?.gia_tri || '').trim();
  if (nd && trong(hienTai.noi_dung)) {
    dien.noi_dung = nd;
    if (nd === goc && !n?.noi_dung?.xac_minh) {
      canhBao.push(banChup ? 'nội dung đọc từ bản chụp, chưa đối chiếu được nguyên văn — đồng chí đối chiếu văn bản gốc'
        : 'nội dung trợ lý AI tách chưa khớp nguyên văn với tệp — đồng chí đối chiếu văn bản gốc');
    } else if (nd === goc && n?.noi_dung?.con_tiep) {
      canhBao.push(n.noi_dung.cau_dan ? 'trợ lý AI chỉ lấy câu dẫn, văn bản còn liệt kê các ý — đồng chí xem lại nội dung' : 'câu trong văn bản còn tiếp — đồng chí xem lại nội dung');
    }
  }
  if (d?.owner && trong(hienTai.owner)) dien.owner = d.owner;
  if (d?.san_pham && trong(hienTai.san_pham)) { dien.san_pham = d.san_pham; if (!sua.has('san_pham')) deXuat.push('san_pham'); }
  if (LOAI_BANG.includes(d?.loai) && trong(hienTai.han) && (trong(hienTai.loai) || hienTai.loai === 'CO_HAN_CU_THE')) {
    dien.loai = d.loai; if (d.loai === 'KY_BAN_HANH' && !sua.has('loai')) deXuat.push('loai');
  }
  if (d?.loai !== 'KY_BAN_HANH' && d?.han && trong(hienTai.han)) dien.han = d.han;
  if (d?.co_quan_trinh && trong(hienTai.co_quan_trinh)) { dien.co_quan_trinh = d.co_quan_trinh; if (!sua.has('co_quan_trinh')) deXuat.push('co_quan_trinh'); }
  return { dien, deXuat, canhBao, goiY: kh.goiY.chuTri ? { chuTri: kh.goiY.chuTri } : {} };
}

// Dòng còn điền được: chưa bỏ, chưa điền vào thẻ, chưa giao.
export const conDien = (ds, khoa = () => false) => ds.map((d, i) => i).filter((i) => ds[i] && !ds[i].bo && !khoa(i));
