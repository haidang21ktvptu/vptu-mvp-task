// Đợt D v3.20 (0089–0090): ô tệp của hộp Nộp minh chứng / hộp Cập nhật (tiền tố id: klMc / klCn), tự điền gợi ý khi chọn tệp, xem tệp đã nộp,
// gắn tệp cho minh chứng đã nộp chưa có tệp. Tự điền chỉ ghi vào ô còn trống: PDF có lớp chữ → đọc trang đầu (lib/kl/doc-pdf.js, nạp khi cần);
// PDF scan / Word / Excel / ảnh → đoán số hiệu theo tên tệp. Người nộp luôn kiểm lại; nop_minh_chung là chốt.
import { $, setText, escapeHtml } from '../../../lib/dom.js';
import { state } from '../../../lib/state.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { NHAN_TEP, loiTep, laPdf } from '../../../lib/kl/tep-ten.js';
import { doanTuChu, doanTuTenTep } from '../../../lib/kl/doc-van-ban.js';
import { taiLenTep, xoaTepChuaGan, duongDanXemTep } from '../../../lib/kl/tep-minh-chung.js';
import { ganTepMinhChung, duocNopMinhChung } from '../../../lib/kl/minh-chung.js';
import { timKlRow } from './danh-sach.js';

// Khối ô tệp (dùng trong template hai hộp).
export const oTepHtml = (p) => `<div class="mt-3 o-tep" id="${p}TepWrap">
      <span class="nhan" id="${p}TepNhanChinh">Tệp văn bản kết quả <span class="chu-phu" id="${p}TepNhan">không bắt buộc — PDF, Word, Excel, ảnh; tối đa 10 MB</span></span>
      <div class="o-tep-hang"><input type="file" id="${p}Tep" class="an-tep" accept="${NHAN_TEP}" aria-labelledby="${p}TepNhanChinh">
        <label class="nut nho" for="${p}Tep">Chọn tệp…</label><span class="ten-tep" id="${p}TepTen">Chưa chọn tệp</span></div>
      <p class="chu-phu mt-1" id="${p}TepGoiY" aria-live="polite">Chọn tệp PDF có chữ, hệ thống điền sẵn số hiệu, ngày, trích yếu để đồng chí kiểm tra.</p>
    </div>`;

export const tepDangChon = (p) => $(`${p}Tep`)?.files?.[0] || null;
export function datLaiTep(p, batBuoc) {
  if (!$(`${p}Tep`)) return;
  $(`${p}Tep`).value = ''; setText(`${p}TepTen`, 'Chưa chọn tệp');
  setText(`${p}TepNhan`, batBuoc ? 'bắt buộc — PDF, Word, Excel, ảnh; tối đa 10 MB' : 'không bắt buộc — PDF, Word, Excel, ảnh; tối đa 10 MB');
  setText(`${p}TepGoiY`, 'Chọn tệp PDF có chữ, hệ thống điền sẵn số hiệu, ngày, trích yếu để đồng chí kiểm tra.');
}

async function doanTuTep(f) {
  if (laPdf(f)) {
    try {
      const { chuTrangDau } = await import('../../../lib/kl/doc-pdf.js');
      const d = doanTuChu(await chuTrangDau(f));
      if (d.so_hieu || d.ngay_van_ban || d.trich_yeu) return { ...d, so_hieu: d.so_hieu || doanTuTenTep(f.name).so_hieu, nguon: 'trang đầu tệp' };
    } catch { /* PDF scan, mã hoá hoặc trình duyệt cũ — đoán theo tên tệp */ }
  }
  return { ...doanTuTenTep(f.name), ngay_van_ban: '', trich_yeu: '', nguon: 'tên tệp' };
}

// ids: { soHieu, ngay, trichYeu } — id các ô cần điền. Chỉ điền ô trống; ngày ngoài khoảng min..max của ô thì bỏ.
export function ganSuKienTep(p, ids) {
  let luot = 0;
  $(`${p}Tep`)?.addEventListener('change', async () => {
    const f = tepDangChon(p); const toi = ++luot;
    setText(`${p}TepTen`, f ? f.name : 'Chưa chọn tệp');
    if (!f) return;
    const loi = loiTep(f);
    if (loi) { notifyError(loi); $(`${p}Tep`).value = ''; setText(`${p}TepTen`, 'Chưa chọn tệp'); return; }
    setText(`${p}TepGoiY`, laPdf(f) ? 'Đang đọc tệp…' : '');
    const d = await doanTuTep(f);
    if (toi !== luot) return;   // đã chọn tệp khác trong lúc đọc
    const da = [];
    const dien = (id, v, ten) => { const o = $(id); if (o && v && !o.value.trim()) { o.value = v; da.push(ten); } };
    dien(ids.soHieu, d.so_hieu, 'số hiệu');
    const o = $(ids.ngay);
    if (o && d.ngay_van_ban && !o.value && (!o.min || d.ngay_van_ban >= o.min) && (!o.max || d.ngay_van_ban <= o.max)) { o.value = d.ngay_van_ban; da.push('ngày'); }
    dien(ids.trichYeu, d.trich_yeu, 'trích yếu');
    setText(`${p}TepGoiY`, da.length ? `Đã điền sẵn ${da.join(', ')} theo ${d.nguon} — đồng chí kiểm tra lại trước khi nộp.`
      : `Đã chọn ${f.name}. Không đọc được thông tin văn bản từ tệp — đồng chí nhập số hiệu, ngày.`);
  });
}

// Liên kết xem tệp: khối (ngăn chi tiết) hoặc trong dòng (inline — khối kết quả của Cần xử lý).
export const tepHtml = (m, inline = false) => {
  if (!m.tep_path) return '';
  const nut = `<button type="button" class="lien-ket" data-action="xemTepMinhChung" data-path="${escapeHtml(m.tep_path)}">Tệp: ${escapeHtml(m.tep_ten || 'tệp đính kèm')}</button>`;
  return inline ? `<span class="mc-tep">${nut}</span>` : `<p class="mc-tep">${nut}</p>`;
};
export function nutGanTepHtml(r, m) {
  const duoc = m.loai === 'so_hieu' && !m.tep_path && m.hop_le !== false && (m.nop_boi === state.user?.id || duocNopMinhChung(r));
  return duoc ? `<button type="button" class="nut nho" data-action="ganTepMinhChung" data-id="${m.id}" data-nv="${r.id}">Gắn tệp</button>` : '';
}

export function hanhDongTep(sau) {
  return {
    async xemTepMinhChung({ path }) {
      const w = window.open('', '_blank');   // mở cửa sổ ngay trong lượt bấm (trình duyệt chặn cửa sổ mở sau await)
      try { const url = await duongDanXemTep(path); if (w) { w.opener = null; w.location.href = url; } else window.location.assign(url); } catch (e) { w?.close(); notifyError(e.message); }
    },
    ganTepMinhChung({ id, nv }) {
      const o = document.createElement('input');
      o.type = 'file'; o.accept = NHAN_TEP;
      o.addEventListener('change', async () => {
        const f = o.files?.[0]; if (!f) return;
        const loi = loiTep(f); if (loi) { notifyError(loi); return; }
        let path = null;
        try {
          path = await taiLenTep(nv, f);
          await ganTepMinhChung(id, path, f.name);
          notifySuccess(`Đã gắn tệp ${f.name} vào minh chứng${timKlRow(nv) ? ` của ${timKlRow(nv).ma}` : ''}.`);
          sau();
        } catch (e) { await xoaTepChuaGan(path); notifyError(e.message); }
      });
      o.click();
    },
  };
}
