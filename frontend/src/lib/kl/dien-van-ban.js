// Đọc văn bản giao việc bằng trợ lý AI (v3.25 — chủ dự án 17/10/2026: "chỉ đọc, không lưu; tự động điền các giá trị tiếp theo — vẫn phải bảo đảm
// chính xác"): phần THUẦN — kiểm tệp, nhãn đối chiếu, kế hoạch điền vào biểu mẫu Giao việc. Quy tắc: chỉ điền ô CÒN TRỐNG (không bao giờ ghi đè chữ
// người dùng đã nhập); giá trị chép nguyên văn từ văn bản (số hiệu, ngày, trích yếu, nội dung, hạn, đơn vị phối hợp, mô tả sản phẩm) chỉ tự điền khi
// máy chủ đã đối chiếu được câu trích trong chữ của tệp (xac_minh — supabase/functions/tro-ly-ai/xac-minh.js); mã danh mục (loại văn bản, sản phẩm,
// ngành, lĩnh vực) máy chủ đã kiểm có trong danh mục — điền như đề xuất, có ghi chú để người giao kiểm tra. Nội dung nhiệm vụ chưa khớp nguyên văn
// với chữ của tệp: không tự điền — hiện để người giao bấm dùng; riêng bản chụp (không có chữ để đối chiếu) vẫn điền nhưng kèm cảnh báo. Không DOM,
// không mạng — unit test frontend/tests/dien-van-ban.test.mjs.
export const TOI_DA_MB = 30;
export const TOI_DA_THE = 20;

export function kiemTep(f) {
  if (!f) return 'Chưa chọn tệp.';
  if (!/\.pdf$/i.test(f.name || '') && f.type !== 'application/pdf') return 'Chỉ đọc được tệp PDF (văn bản tải từ V-Office).';
  if (f.size > TOI_DA_MB * 1024 * 1024) return `Tệp lớn hơn ${TOI_DA_MB} MB — đồng chí tách bớt trang (chỉ cần phần giao nhiệm vụ).`;
  return null;
}
// Chữ ít (dưới 200 ký tự ngoài khoảng trắng) → coi là bản chụp, gửi ảnh trang.
export const laBanChup = (chu) => String(chu || '').replace(/\s+/g, '').length < 200;
export const nhanXacMinh = (xm) => (xm === 'dung' ? ['dung', 'Đã đối chiếu nguyên văn'] : xm === 'khong_dau' ? ['dung', 'Đã đối chiếu (chữ trong tệp mất dấu)'] : ['kiem', 'Cần kiểm tra']);

const trong = (v) => v === undefined || v === null || String(v).trim() === '';
// Văn bản: [{ k, o, ten, gia_tri, trich, xac_minh, dien }] — dien = được tự điền. hienTai: giá trị đang có của các ô (id → giá trị); moi = các ô văn bản
// mới còn trống cả số hiệu lẫn ngày (người dùng chưa nhập gì) — khi đó loại văn bản (ô chọn, luôn có giá trị mặc định) cũng được đặt theo văn bản.
// Loại văn bản là MÃ DANH MỤC (như sản phẩm, ngành): đặt theo trợ lý AI cả khi câu trích chưa đối chiếu được — vẫn hiện nhãn "Cần kiểm tra" (chủ dự án
// duyệt 18/10/2026: giữ mặc định Kết luận BTV khi AI đọc ra Thông báo / Công văn thì người giao phải tự đổi và dễ bỏ sót).
const O_VB = [['loai', 'klThLoaiVB', 'Loại văn bản'], ['so_hieu', 'klThSoKL', 'Số hiệu'], ['ngay_ban_hanh', 'klThNgayBH', 'Ngày ban hành'],
  ['trich_yeu', 'klThTrichYeu', 'Trích yếu'], ['so_hoi_nghi', 'klThSoHN', 'Số hội nghị']];
export function keHoachVanBan(vb, hienTai = {}, { homNay = '9999-12-31' } = {}) {
  const moi = trong(hienTai.klThSoKL) && trong(hienTai.klThNgayBH);
  return O_VB.map(([k, o, ten]) => {
    const x = vb?.[k] || {}; const gt = x.gia_tri ?? '';
    const coThe = !trong(gt) && (k === 'loai' ? moi : Boolean(x.xac_minh) && trong(hienTai[o])) && (k !== 'ngay_ban_hanh' || gt <= homNay);
    return { k, o, ten, gia_tri: String(gt), trich: x.trich || '', xac_minh: x.xac_minh || false, dien: coThe };
  }).filter((x) => !trong(x.gia_tri));
}

// Một nhiệm vụ → kế hoạch cho một thẻ. hienTai: { noi_dung, san_pham, san_pham_mo_ta, han, loai, nganh, linh_vuc, phoi_hop } của thẻ. Trả:
//  dien: { cột → giá trị } (chỉ ô trống), deXuat: cột được điền là đề xuất của AI (mã danh mục), canhBao: [chữ], goiY: { han?, noiDung?, conTiep?, tronCau?,
//  chuTri? } để hiện ghi chú (nút "dùng"). banChup: tệp là bản chụp (không có chữ để đối chiếu nội dung).
// Đợt sửa gộp 18/10/2026: nội dung khớp nguyên văn nhưng câu trong văn bản CÒN TIẾP (máy chủ — con_tiep) → không tự điền: gợi ý "Dùng trọn câu" (nguyên
// văn câu của tệp) hoặc phần trợ lý AI tách; trợ lý AI chỉ lấy câu dẫn (cau_dan) → không có "trọn câu", người giao xem các ý liệt kê.
export const tronCau = (nd, tiep) => (tiep ? `${nd}${/^[,;:.)\]]/.test(tiep) ? '' : ' '}${tiep}` : nd);
export function keHoachThe(n, hienTai = {}, { banChup = false } = {}) {
  const dien = {}; const deXuat = []; const canhBao = []; const goiY = {};
  const nd = n?.noi_dung?.gia_tri || ''; const tiep = n?.noi_dung?.con_tiep || '';
  if (nd && trong(hienTai.noi_dung)) {
    if (n.noi_dung.xac_minh && !tiep) dien.noi_dung = nd;
    else if (n.noi_dung.xac_minh) { goiY.noiDung = nd; goiY.conTiep = tiep; if (!n.noi_dung.cau_dan) goiY.tronCau = tronCau(nd, tiep); }
    else if (banChup) { dien.noi_dung = nd; canhBao.push('nội dung đọc từ bản chụp, chưa đối chiếu được nguyên văn — đồng chí đối chiếu văn bản gốc'); }
    else goiY.noiDung = nd;
  }
  if (Number.isInteger(n?.trung_voi)) canhBao.push(`trùng với nhiệm vụ ${n.trung_voi + 1} của văn bản — đồng chí xem có cần giao riêng không`);
  if (n?.tu_ra_soat) canhBao.push('đoạn do hệ thống rà thấy (trợ lý AI chưa tách) — đồng chí kiểm tra nội dung, chọn chủ trì theo dõi, hạn xử lý, sản phẩm đầu ra');
  const han = n?.han?.gia_tri || '';
  if (han && trong(hienTai.han)) { if (n.han.xac_minh) dien.han = han; else goiY.han = { gia_tri: han, trich: n.han.trich || '' }; }
  if (n?.loai_thoi_han?.gia_tri === 'KY_BAN_HANH' && (trong(hienTai.loai) || hienTai.loai === 'CO_HAN_CU_THE') && trong(hienTai.han) && !dien.han) { dien.loai = 'KY_BAN_HANH'; deXuat.push('loai'); }
  [['san_pham', 'san_pham'], ['nganh', 'nganh'], ['linh_vuc', 'linh_vuc']].forEach(([k, cot]) => {
    const v = n?.[k]?.gia_tri; if (v && trong(hienTai[cot])) { dien[cot] = v; deXuat.push(cot); }
  });
  [['mo_ta_san_pham', 'san_pham_mo_ta'], ['don_vi_phoi_hop', 'phoi_hop']].forEach(([k, cot]) => {
    const x = n?.[k]; if (x?.gia_tri && x.xac_minh && trong(hienTai[cot])) dien[cot] = x.gia_tri;
  });
  if (n?.don_vi_chu_tri?.gia_tri) goiY.chuTri = n.don_vi_chu_tri.gia_tri;
  return { dien, deXuat, canhBao, goiY };
}
// Đoạn "có thể còn sót" (máy chủ rà — nghi_bo_sot: nguyên văn chữ của tệp) → nhiệm vụ để người giao thêm vào danh sách rồi điền như các nhiệm vụ khác.
export const nhiemVuTuDoan = (d) => ({ noi_dung: { gia_tri: String(d?.chu || ''), xac_minh: 'dung' }, trich: String(d?.chu || ''), trang: d?.trang ?? null,
  don_vi_chu_tri: { gia_tri: '' }, don_vi_phoi_hop: { gia_tri: '', xac_minh: false }, han: { gia_tri: '', trich: '', xac_minh: false }, loai_thoi_han: { gia_tri: '' },
  san_pham: { gia_tri: '' }, mo_ta_san_pham: { gia_tri: '', xac_minh: false }, nganh: { gia_tri: '' }, linh_vuc: { gia_tri: '' }, co_quan_trinh: { gia_tri: '' }, muc_tieu: [],
  tu_ra_soat: true });
// Nhiệm vụ "Điền tất cả" bỏ qua: trùng với một nhiệm vụ khác của văn bản (người giao vẫn bấm điền riêng được).
export const laTrung = (n) => Number.isInteger(n?.trung_voi);

// Số hiệu văn bản nhắc tới → { coSan: [{ ma, so_hieu, trich }] (đã có trong danh mục — gợi ý AI; mục đã gộp → mục giữ lại; mục ngừng dùng không gợi
// ý), moi: [{ so_hieu, nhom, ve }] (đúng dạng một nhóm, chưa có, máy chủ đã đối chiếu được câu trích trong tệp — gợi ý thêm vào danh mục) }.
// dm: danh mục mục tiêu (dang_dung, gop_vao); nhom: dm_nhom_muc_tieu (mau_so_hieu).
const khoaSh = (s) => { const m = /^0*(\d{1,5})-([A-Za-zĐđ]{1,5})\/([A-Za-z]{1,8})$/.exec(String(s || '').replace(/\s+/g, '').replace(/[–—]/g, '-'));
  return m ? `${Number(m[1])}-${m[2].toUpperCase()}/${m[3].toUpperCase()}` : null; };
export function phanLoaiNhacToi(ds = [], dm = [], nhom = []) {
  const coSan = []; const moi = []; const da = new Set();
  const giuLai = (m) => { let x = m; for (let i = 0; x?.gop_vao && i < 5; i += 1) x = dm.find((y) => y.ma === x.gop_vao); return x; };
  ds.forEach((v) => {
    const k = khoaSh(v?.so_hieu); if (!k || da.has(k)) return; da.add(k);
    const goc = dm.find((x) => x.so_hieu && khoaSh(x.so_hieu) === k);
    if (goc) {
      const m = giuLai(goc);
      if (m && m.dang_dung !== false && !coSan.some((c) => c.ma === m.ma)) coSan.push({ ma: m.ma, so_hieu: v.so_hieu, trich: v.trich || '', ly_do: `văn bản nhắc tới ${v.so_hieu}` });
      return;
    }
    if (!v.xac_minh) return;   // chưa đối chiếu được trong tệp (hoặc bản chụp): không mời thêm vào danh mục
    const chuan = String(v.so_hieu).replace(/\s+/g, '').replace(/[–—]/g, '-').replace(/-CTR\//i, '-CTr/');
    const n = nhom.filter((x) => x.dang_dung !== false && x.mau_so_hieu).find((x) => { try { return new RegExp(x.mau_so_hieu).test(chuan); } catch { return false; } });
    if (n) moi.push({ so_hieu: chuan, nhom: n.ma, ve: /([Vv]ề\s.*)$/u.exec(String(v.ten || ''))?.[1].slice(0, 200) || null });
  });
  return { coSan, moi };
}
// Thống kê đối chiếu để hiện ở đầu kết quả.
export const chuThongKe = (tk) => (tk?.co_gia_tri ? `${tk.da_xac_minh}/${tk.co_gia_tri} giá trị đối chiếu được nguyên văn` : 'không có giá trị nào để đối chiếu');
