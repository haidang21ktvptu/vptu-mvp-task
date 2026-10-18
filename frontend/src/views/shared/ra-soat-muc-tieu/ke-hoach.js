// Rà soát mục tiêu then chốt (v3.25) — phần THUẦN (không DOM, không mạng; unit test frontend/tests/ra-soat-muc-tieu.test.mjs): trạng thái ô chọn của
// một việc đã có (lib/kl/goi-y-muc-tieu.js), việc nào còn "chờ xử lý", việc nào cần ghi và ghi gì (gan_muc_tieu_hang_loat — 0111), phản hồi cho bộ
// tự học. Nguồn khi ghi: mục hệ thống tích sẵn được chấp nhận ở đây → RA_SOAT; mục người dùng bấm giữ GOI_Y / AI / CHON; mục đã gắn từ trước và mục
// của văn bản không gửi nguồn (DB giữ nguồn cũ — EXCEL, AI…; mục của văn bản chép nguồn của văn bản).
import { taoBoChon, ketQua, dsHien, phanHoi, hieuLuc, khoaSoHieu } from '../../../lib/kl/goi-y-muc-tieu.js';
import { mucTieuCua, timMucTieu } from '../../../lib/kl/muc-tieu.js';

const giong = (a = [], b = []) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

// Trạng thái từ dòng v_nhiem_vu đã ghép mục tiêu (muc_tieu_rieng, muc_tieu_vb, muc_tieu_nguon — ganMucTieuVaoDong).
export function taoTrangThai(r) {
  const rieng = r?.muc_tieu_rieng || [];
  const nguonRieng = Object.fromEntries(rieng.map((ma) => [ma, r.muc_tieu_nguon?.[ma] || { nguon: 'CHON', ly_do: null }]));
  return taoBoChon({ rieng, nguonRieng, vb: r?.muc_tieu_vb || [] });
}
// Có mục hệ thống tích sẵn (người dùng chưa đụng) hoặc số hiệu mới được tích — "Chấp nhận" mới có việc để làm.
export const coTichSan = (tt) => [...tt.chon.values()].some((x) => x.tu === 'tich') || tt.moi.some((m) => m.chon);
// Chờ xử lý: còn mục tích sẵn chưa chấp nhận, hoặc việc chưa gắn mục tiêu nào mà có gợi ý (trừ gợi ý người dùng đã bỏ ở việc này — da_bo, 0115).
export const choXuLy = (r, tt) => coTichSan(tt) || (mucTieuCua(r).length === 0 && dsHien(tt).goiY.some((g) => !g.da_bo));
// Nhóm mục tiêu có trong gợi ý / mục tích sẵn của việc (lọc "nhóm mục tiêu gợi ý"); số hiệu mới theo nhóm máy chủ báo.
export function nhomGoiY(tt, dm) {
  const h = dsHien(tt); const ma = [...h.daChon.filter((x) => x.tu === 'tich').map((x) => x.ma), ...h.goiY.map((g) => g.ma)];
  return new Set([...ma.map((m) => timMucTieu(dm, m)?.nhom).filter(Boolean), ...tt.moi.map((m) => m.nhom).filter(Boolean)]);
}

// → { id, ma, nguon } cần gửi, hoặc null khi không đổi gì so với DB. maMoi: Map khoaSoHieu → mã (số hiệu đã được hệ thống thêm vào danh mục).
export function keHoachLuu(r, tt, maMoi = new Map()) {
  const k = ketQua(tt, maMoi); const rieng = r?.muc_tieu_rieng || []; const vb = r?.muc_tieu_vb || [];
  if (k.theoVb) return rieng.length && !giong(rieng, vb) ? { id: r.id, ma: [], nguon: {} } : null;   // bỏ gắn riêng → tính theo văn bản
  if (rieng.length && giong(k.ma, rieng)) return null;
  const nguon = {};
  k.ma.filter((ma) => !rieng.includes(ma)).forEach((ma) => {
    const x = tt.chon.get(ma); if (!x && tt.vb.includes(ma)) return;   // mục của văn bản: máy chủ chép nguồn của văn bản
    const n = k.nguon[ma] || { nguon: 'CHON', ly_do: null };
    const tuDong = x ? x.tu === 'tich' : n.nguon === 'QUY_TAC';   // không có trong chon và không thuộc văn bản → số hiệu mới
    nguon[ma] = tuDong ? { nguon: 'RA_SOAT', ly_do: n.ly_do || null } : n;
  });
  return { id: r.id, ma: k.ma, nguon };
}
// Có gì để lưu (bật nút, đếm hàng loạt) trước khi số hiệu mới có mã thật: số hiệu mới đang tích nhận mã tạm.
export const coThayDoi = (r, tt) => Boolean(keHoachLuu(r, tt, new Map(tt.moi.filter((m) => m.chon).map((m) => [khoaSoHieu(m.so_hieu), `SH:${m.so_hieu}`]))));
// Mục hiệu lực sau khi lưu (để vẽ lại chữ "Hiện tính" trước khi đọc lại DB).
export const maSauLuu = (r, ke) => (ke ? (ke.ma.length ? ke.ma : r?.muc_tieu_vb || []) : mucTieuCua(r));
// Phản hồi: lưu hàng loạt mà người dùng chưa mở / chưa thao tác ở việc đó → chỉ tính mục tích sẵn (giữ / bỏ), không tính gợi ý "không bấm" (người
// dùng chưa xem gợi ý — tính vào sẽ làm bộ tự học tắt nhầm quy tắc gợi ý). Theo tập hiện trên dòng (ketQua — kể cả khi lưu thành "theo văn bản").
export function phanHoiLuu(tt, maMoi, daThaoTac) {
  const ds = phanHoi(tt, ketQua(tt, maMoi).ma);
  return daThaoTac ? ds : ds.filter((x) => x.ket_qua === 'GIU' || x.ket_qua === 'BO');
}
// Chữ ngắn tập mục tiêu đang tính (tên ngắn theo danh mục).
export const tenTap = (ma, dm) => ma.map((m) => timMucTieu(dm, m)?.ten_ngan || m).join('; ');
export { hieuLuc };
