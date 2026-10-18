// Ghi của màn Rà soát mục tiêu then chốt (v3.25): (1) số hiệu mới đang tích → hệ thống thêm vào danh mục (them_muc_tieu_tu_dong — đã có thì trả mã sẵn
// có), (2) gắn hàng loạt ≤ 200 việc mỗi lượt (gan_muc_tieu_hang_loat — quyền như gan_muc_tieu, việc lỗi không chặn việc khác), (3) đọc lại phần gắn rồi
// ghép vào dòng (đúng cả việc bỏ gắn riêng), (4) phản hồi cho bộ tự học chạy nền, tuần tự (lỗi bỏ qua) — cả việc chỉ bỏ mục tích sẵn mà tập mục tiêu
// không đổi (không ghi mục tiêu, chỉ ghi "bỏ" để lần sau không tích lại — 0115). DB là chốt quyền.
import { themMucTieuTuDong, ganMucTieuHangLoat, ghiPhanHoiGoiY, loadGanMucTieu, ganVaoDong } from '../../../lib/kl/muc-tieu-db.js';
import { loadDanhMucKl } from '../../../lib/kl/du-lieu.js';
import { khoaSoHieu } from '../../../lib/kl/goi-y-muc-tieu.js';
import { loiDeHieu } from '../../../lib/kl/loi.js';
import { keHoachLuu, phanHoiLuu, coBoTichSan } from './ke-hoach.js';

const PHAN = 200;

// ds: [{ r, tt, daThaoTac }] → { ok: [dòng đã lưu — kể cả dòng chỉ ghi "bỏ"], loi: [{ id, ma, loi }], loiSoHieu: [chuỗi], soKe, soBo }. tienDo(đã gửi, tổng).
export async function luuViec(ds, { tienDo = () => {} } = {}) {
  const moi = new Map();
  ds.forEach(({ tt }) => tt.moi.filter((m) => m.chon).forEach((m) => { const k = khoaSoHieu(m.so_hieu); if (!moi.has(k)) moi.set(k, m); }));
  const maMoi = new Map(); const loiSoHieu = [];
  for (const [k, m] of moi) {
    try { const r = await themMucTieuTuDong(m.so_hieu, m.ve || null); if (r?.ma) maMoi.set(k, r.ma); } catch (e) { loiSoHieu.push(`${m.so_hieu}: ${loiDeHieu(e)}`); }
  }
  if (maMoi.size) await loadDanhMucKl(true).catch(() => null);   // tên mục vừa thêm hiện ngay trên chip
  const tat = ds.map((x) => ({ ...x, ke: keHoachLuu(x.r, x.tt, maMoi) }));
  const ke = tat.filter((x) => x.ke); const chiBo = tat.filter((x) => !x.ke && coBoTichSan(x.tt, maMoi));
  const ok = []; const loi = [];
  for (let i = 0; i < ke.length; i += PHAN) {
    const phan = ke.slice(i, i + PHAN);
    try {
      const kq = await ganMucTieuHangLoat(phan.map((x) => x.ke));
      const hong = new Map((kq.loi || []).map((l) => [l.id, l.loi]));
      phan.forEach((x) => (hong.has(x.r.id) ? loi.push({ id: x.r.id, ma: x.r.ma, loi: loiDeHieu({ message: hong.get(x.r.id) }) }) : ok.push(x)));
    } catch (e) { phan.forEach((x) => loi.push({ id: x.r.id, ma: x.r.ma, loi: loiDeHieu(e) })); }
    tienDo(Math.min(ke.length, i + PHAN), ke.length);
  }
  if (ok.length) { await loadGanMucTieu(); ok.forEach((x) => ganVaoDong(x.r)); }
  const xong = [...ok, ...chiBo];
  const ph = xong.map((x) => [x.r.id, phanHoiLuu(x.tt, maMoi, x.daThaoTac)]).filter(([, p]) => p.length);
  (async () => { for (const [id, p] of ph) await ghiPhanHoiGoiY(id, p); })();
  return { ok: xong.map((x) => x.r), loi, loiSoHieu, soKe: ke.length, soBo: chiBo.length };
}

// Câu báo sau khi lưu.
export function chuKetQua({ ok, loi, loiSoHieu, soBo = 0 }) {
  const gan = ok.length - soBo;
  const phan = [gan ? `Đã gắn mục tiêu then chốt cho ${gan} việc.` : soBo ? '' : 'Chưa gắn được việc nào.'];
  if (soBo) phan.push(`Đã ghi bỏ mục tích sẵn ở ${soBo} việc — lần sau không tự tích lại.`);
  if (loi.length) phan.push(`${loi.length} việc chưa gắn được (${loi[0].ma}: ${loi[0].loi}).`);
  if (loiSoHieu.length) phan.push(`Chưa thêm được số hiệu ${loiSoHieu[0]}.`);
  return phan.filter(Boolean).join(' ');
}
