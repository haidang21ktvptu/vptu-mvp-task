// Nhà cung cấp giả lập (v3.25) — CHỈ cho Supabase cục bộ / CI (index.ts chỉ dùng khi biến môi trường AI_CHO_PHEP_GIA_LAP = 1; qt_dat_cau_hinh_ai
// không cho chọn). Trả kết quả cố định suy từ chữ đầu vào bằng biểu thức chính quy — để e2e và unit test chạy không cần khoá API, không gọi mạng.
// Chép nguyên văn từ văn bản nên các câu trích đều xác minh được (xac-minh.js).

const NGAY = /ng[àa]y\s+(\d{1,2})\s+th[áa]ng\s+(\d{1,2})\s+n[ăa]m\s+(\d{4})/i;
const pad = (n) => String(n).padStart(2, '0');

function docVanBan(noiDung) {
  const i = noiDung.indexOf('VĂN BẢN (tệp');
  const chu = i >= 0 ? noiDung.slice(noiDung.indexOf('\n', i) + 1) : '';
  const dong = chu.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const sh = chu.match(/S[ốo]\s*[:.]?\s*([0-9]{1,5}-[A-Za-zĐđ]{1,5}\/[A-Z]{1,8})/u);
  const dongNgay = dong.find((d) => NGAY.test(d)) || ''; const n = NGAY.exec(dongNgay);
  const hoa = chu.toUpperCase();
  const loai = hoa.includes('KẾT LUẬN') && hoa.includes('BAN THƯỜNG VỤ') ? 'KL_BTV' : hoa.includes('THÔNG BÁO') ? 'TB_THUONG_TRUC' : hoa.includes('NGHỊ QUYẾT') ? 'NQ_BCH' : 'CONG_VAN';
  const tieuDe = dong.findIndex((d) => /^(KẾT LUẬN|THÔNG BÁO|NGHỊ QUYẾT|CÔNG VĂN)/.test(d));
  const trichYeu = tieuDe >= 0 ? (dong[tieuDe + 1] || '') : '';
  const nv = dong.filter((d) => /^(-|\d+\.)\s+\S/.test(d) && d.length >= 20).map((d) => {
    const noi = d.replace(/^(-|\d+\.)\s+/, '');
    const h = /trước ngày (\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(noi);
    const mt = /chuyển đổi số/i.test(noi) ? [{ ma: 'DP_KHCN_CDS', trich: 'chuyển đổi số', ly_do: 'Nhiệm vụ về chuyển đổi số (giả lập)' }] : [];
    return { noi_dung: noi, trich: d, don_vi_chu_tri: (/^(Giao|Đề nghị)\s+([^,;]+?)\s+(chủ trì|tham mưu|thực hiện)/.exec(noi) || [])[2] || '', don_vi_phoi_hop: '',
      han: h ? `${h[3]}-${pad(h[2])}-${pad(h[1])}` : '', trich_han: h ? h[0] : '', loai_thoi_han: h ? 'CO_HAN_CU_THE' : '', san_pham: /báo cáo/i.test(noi) ? 'BAO_CAO' : '',
      mo_ta_san_pham: '', nganh: '', linh_vuc: '', muc_tieu: mt };
  });
  const nhac = [...chu.matchAll(/([0-9]{1,5}-NQ\/TW)[^.;\n]{0,120}/g)].filter((m) => !sh || m[1] !== sh[1]).map((m) => ({ so_hieu: m[1], ten: '', trich: m[0] }));
  return {
    van_ban: { loai: { gia_tri: loai, trich: dong[tieuDe] || '' }, so_hieu: { gia_tri: sh ? sh[1] : '', trich: sh ? sh[0] : '' },
      ngay_ban_hanh: { gia_tri: n ? `${n[3]}-${pad(n[2])}-${pad(n[1])}` : '', trich: dongNgay }, trich_yeu: { gia_tri: trichYeu, trich: trichYeu },
      so_hoi_nghi: { gia_tri: '', trich: '' }, co_quan_ban_hanh: { gia_tri: '', trich: '' } },
    nhiem_vu: nv, muc_tieu_van_ban: [], van_ban_nhac_toi: nhac,
  };
}

export function giaLap(yc) {
  const t = yc?.tenSchema;
  if (t === 'doc_van_ban') return { json: docVanBan(String(yc.noiDung || '')), vao: 0, ra: 0 };
  if (t === 'quy_tac') {
    const ten = /MỤC TIÊU: ([^\n(]+)/.exec(String(yc.noiDung || ''))?.[1]?.trim() || '';
    return { json: { tu_khoa: ten ? [{ gia_tri: ten.split(/\s+/).slice(0, 4).join(' '), ly_do: 'giả lập' }] : [], loai_tru: [] }, vao: 0, ra: 0 };
  }
  return { json: { tra_loi: 'Kết nối giả lập hoạt động.' }, vao: 0, ra: 0 };
}
