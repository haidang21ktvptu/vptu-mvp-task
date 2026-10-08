// Đợt C2 v3.19 (0087): thông tin nguồn của nhiệm vụ trên dòng danh sách và ngăn chi tiết — mã theo nguồn (KL-BTV·HN39·671·04) cạnh mã NV, nhãn
// mức quan trọng, ô Mức quan trọng / Cơ quan trình / Thường trực chỉ đạo (chỉ hiện khi đã ghi; sửa qua "Sửa thông tin giao" — ô tầng giao 0070),
// nút "Giao thêm nhiệm vụ từ văn bản này" (mở Giao việc với đúng văn bản; mọi vai giao được từ 0085, quyền thật ở giao_viec).
import { escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { boSoThuTu } from '../../../lib/kl/nhan.js';
import { maTheoNguon, tenMucQuanTrong } from '../../../lib/kl/ma-nguon.js';

const GOI_MA = 'Mã theo nguồn: loại văn bản · số hội nghị · số hiệu văn bản · số thứ tự nhiệm vụ trong văn bản';
export const maNguonHtml = (r) => { const m = maTheoNguon(r); return m ? `<span class="ma-nguon" title="${GOI_MA}">${escapeHtml(m)}</span>` : ''; };
export const nhanMucHtml = (r) => (r.muc_quan_trong ? `<span class="muc-qt muc-${escapeHtml(r.muc_quan_trong.toLowerCase())}" title="Mức quan trọng ${escapeHtml(tenMucQuanTrong(r.muc_quan_trong))}">Mức ${escapeHtml(r.muc_quan_trong)}</span>` : '');

// Ô lưới (dt/dd) của ngăn chi tiết — o(nhãn, giá trị, cột) như chi-tiet.js (cột: bút / khoá của ô tầng giao).
export function oLuoiNguonHtml(r, o) {
  return [r.muc_quan_trong ? o('Mức quan trọng', escapeHtml(tenMucQuanTrong(r.muc_quan_trong)), 'muc_quan_trong') : '',
    r.co_quan_trinh ? o('Cơ quan trình', escapeHtml(boSoThuTu(r.co_quan_trinh_ten) || r.co_quan_trinh), 'co_quan_trinh') : '',
    r.thuong_truc_chi_dao ? o('Thường trực chỉ đạo', escapeHtml(r.thuong_truc_chi_dao_ten || ''), 'thuong_truc_chi_dao') : ''].join('');
}

export const nutGiaoThemHtml = (r) => (r.van_ban_id && state.user?.role_group && !state.user?.bi_khoa
  ? `<button type="button" class="nut" data-action="giaoThemTuVanBan" data-vb="${escapeHtml(r.van_ban_id)}" title="Mở Giao việc với văn bản ${escapeHtml(r.so_ket_luan || '')} đã chọn sẵn">Giao thêm nhiệm vụ từ văn bản này</button>` : '');
