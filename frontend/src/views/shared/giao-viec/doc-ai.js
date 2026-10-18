// Giao việc — đọc văn bản gốc (PDF) ở khối 1 (v3.25; chủ dự án 17/10/2026: văn bản giao việc không mật, đã công khai trên V-Office → được gửi nội dung
// tới trợ lý AI; tệp CHỈ ĐỌC, không lưu). Luồng: chọn tệp → pdf.js đọc chữ mọi trang ngay trong trình duyệt (bản chụp: ảnh các trang đầu) → Edge Function
// tro-ly-ai (doc_van_ban) tách văn bản + từng nhiệm vụ và ĐỐI CHIẾU câu trích ở máy chủ → văn bản đã có trên hệ thống thì chọn văn bản đó, không thì
// điền "Văn bản mới" (chỉ ô trống, chỉ giá trị đã đối chiếu — lib/kl/dien-van-ban.js); mục tiêu của văn bản và của từng nhiệm vụ thành gợi ý một bấm
// (muc-tieu.js); nhiệm vụ điền vào thẻ (từng việc / tất cả, tối đa 20 thẻ — giao xong điền tiếp vào văn bản vừa tạo). Trợ lý AI chưa bật → chỉ đọc
// số hiệu, ngày ban hành, trích yếu ở trang đầu (lib/kl/doc-van-ban.js), không gửi đi đâu. DB và người giao là chốt cuối.
import { $, show, setText } from '../../../lib/dom.js';
import { registerActions } from '../../../lib/actions.js';
import { notifyError, notifySuccess } from '../../../components/toast.js';
import { danhMucKl, timVanBan } from '../../../lib/kl/du-lieu.js';
import { trangThaiAi, aiDocDuoc, docVanBanAi } from '../../../lib/kl/tro-ly-ai.js';
import { kiemTep, laBanChup, keHoachVanBan, keHoachThe, phanLoaiNhacToi, laTrung, nhiemVuTuDoan, tronCau } from '../../../lib/kl/dien-van-ban.js';
import { doanTuChu } from '../../../lib/kl/doc-van-ban.js';
import { MOI, napVanBan } from './van-ban.js';
import { getHomNay, nhanMoi } from './trang-thai.js';
import { themDong, soThe, TOI_DA } from './nhieu.js';
import { o as oThe } from './nhieu-the.js';
import { apAiVanBan, apAiThe, khoaThe, khiDaGiao } from './muc-tieu.js';
import { dauHtml, ketQuaHtml, ghiChuTheHtml } from './doc-ai-ve.js';

const da = { kq: null, tep: '', soTrang: 0, moHinh: '', ncc: '', banChup: false, vbCo: null, vbDaDien: new Set(), the: new Map(), daGiao: new Set(), vbId: null, dang: false,
  luot: 0, vbTay: false, giuVb: false };   // luot: lượt đọc (mở lại biểu mẫu / bỏ kết quả → kết quả lượt cũ bỏ); vbTay: người dùng tự chọn văn bản có sẵn
const phat = (el, loai) => el?.dispatchEvent(new Event(loai, { bubbles: true }));
const tt = (chu) => { setText('gvDocTt', chu); show('gvDocTt', Boolean(chu)); };
const chuanSo = (s) => String(s || '').replace(/\s+/g, '').toUpperCase();
const ID1 = { noi_dung: 'klThNoiDung', san_pham: 'klThSanPham', san_pham_mo_ta: 'klThSanPhamMoTa', han: 'klThHan', loai: 'klThLoai', nganh: 'klThNganh', linh_vuc: 'klThLinhVuc', phoi_hop: 'klThPhoiHop' };
const oCua = (the, cot) => (the?.id === 'gvThe1' ? $(ID1[cot]) : oThe(the, cot));
const cacThe = () => [$('gvThe1'), ...document.querySelectorAll('#gvLuoiThan .gv-nv')].filter(Boolean);
const theTheoKhoa = (k) => cacThe().find((t) => khoaThe(t) === k) || null;
const tenThe = (k) => theTheoKhoa(k)?.getAttribute('aria-label') || 'thẻ đã xoá';

function chuHuongDan(t) {
  if (aiDocDuoc(t)) return `Tệp chỉ được đọc trên máy này; nội dung gửi tới trợ lý AI (${t.ten || 'AI'}) để tách số hiệu, ngày, trích yếu và từng nhiệm vụ — không lưu vào hệ thống. Giá trị nguyên văn chỉ tự điền khi đối chiếu được trong tệp.`;
  return `Trợ lý AI ${t?.bat === false && !t?.loi ? 'đang tắt' : 'chưa sẵn sàng'} — hệ thống chỉ đọc số hiệu, ngày ban hành, trích yếu ở trang đầu (tệp có lớp chữ), không gửi tệp đi đâu.`;
}
function veKq() {
  const el = $('gvDocKq'); if (!el) return;
  show('gvDocKq', Boolean(da.kq));
  if (!da.kq) { el.innerHTML = ''; return; }
  const hien = { klThSoKL: $('klThSoKL').value, klThNgayBH: $('klThNgayBH').value, klThTrichYeu: $('klThTrichYeu').value, klThSoHN: $('klThSoHN').value };
  const vbKh = keHoachVanBan(da.kq.van_ban, hien, { homNay: getHomNay() }).map((x) => ({ ...x, trong: x.k === 'loai' ? !da.vbDaDien.has(x.o) : !hien[x.o],
    trung: x.k === 'loai' && $('klThLoaiVB').value === x.gia_tri }));   // ô Loại đã đúng giá trị đọc được → không hiện nút "Điền" (kiểm tay 18/10)
  el.innerHTML = ketQuaHtml({ ...da, vbKh, tenThe }, danhMucKl());
}

const huyDangDoc = () => { da.luot += 1; da.dang = false; if ($('gvDocNut')) $('gvDocNut').disabled = false; tt(''); };
// Mở biểu mẫu (index.js): ẩn khi giao tiếp xuống / hoàn thiện dòng Excel (một việc); giữ kết quả đã đọc (để "Điền tiếp" sau khi giao), bỏ thẻ cũ.
export async function datLaiDocAi({ an = false } = {}) {
  const el = $('gvDoc'); if (!el) return;
  if (!el.dataset.gan) {
    el.innerHTML = dauHtml(); el.dataset.gan = '1';
    $('gvDocTep').addEventListener('change', (e) => { e.stopPropagation(); const f = e.target.files?.[0]; e.target.value = ''; if (f) docTep(f); });
    const tay = (e) => { if (e.isTrusted) da.vbTay = true; };   // chọn ở ô chọn hoặc gõ tìm (ô tìm tự chọn kết quả đầu)
    $('klThVanBan')?.addEventListener('change', tay); $('klThVanBanTim')?.addEventListener('input', tay);
  }
  show('gvDoc', !an);
  if (da.dang) huyDangDoc();
  document.querySelectorAll('#giaoViecForm [data-ai-ghi]').forEach((x) => x.remove());
  da.the = new Map(); da.vbTay = false;
  veKq();
  if (!an) setText('gvDocChu', chuHuongDan(await trangThaiAi()));
}

async function chonVanBan(id) {
  await napVanBan({ nhanMoi: nhanMoi(), giu: id, kem: id });
  if ($('klThVanBan').value !== id) { $('klThVanBan').value = id; phat($('klThVanBan'), 'change'); }
}
function datO(id, gt) {
  const el = $(id); if (!el || gt === '' || gt === null || gt === undefined) return false;
  if (el.tagName === 'SELECT' && ![...el.options].some((x) => x.value === String(gt))) return false;
  el.value = String(gt); phat(el, el.tagName === 'SELECT' || el.type === 'date' ? 'change' : 'input');
  return true;
}
// Văn bản: đã có (đúng số hiệu, cùng ngày ban hành nếu đọc được) → chọn; không thì "Văn bản mới" + điền ô trống đã đối chiếu — trừ khi người dùng
// đã tự chọn một văn bản có sẵn (giữ nguyên lựa chọn, thông tin đọc được chỉ để bấm điền khi chuyển sang "Văn bản mới").
async function apVanBan(cu = () => false) {   // cu(): biểu mẫu đã mở lại trong lúc chờ — dừng, không điền vào biểu mẫu mới
  const vb = da.kq?.van_ban || {}; const so = vb.so_hieu?.gia_tri; const ngay = vb.ngay_ban_hanh?.gia_tri;
  if (so && vb.so_hieu?.xac_minh) {   // chỉ tự chọn văn bản có sẵn theo số hiệu đã đối chiếu được trong tệp
    try { const { ds } = await timVanBan(so, 0, 20); da.vbCo = ds.find((h) => chuanSo(h.so_ket_luan) === chuanSo(so) && (!ngay || !h.ngay_ban_hanh || h.ngay_ban_hanh === ngay)) || null; } catch { da.vbCo = null; }
    if (cu()) return;
  }
  da.giuVb = !da.vbCo && da.vbTay && $('klThVanBan').value !== MOI;
  if (da.vbCo) { await chonVanBan(da.vbCo.id); if (cu()) return; }
  else if (!da.giuVb) {
    if ($('klThVanBan').value !== MOI) { $('klThVanBan').value = MOI; phat($('klThVanBan'), 'change'); }
    const hien = { klThSoKL: $('klThSoKL').value, klThNgayBH: $('klThNgayBH').value, klThTrichYeu: $('klThTrichYeu').value, klThSoHN: $('klThSoHN').value };
    keHoachVanBan(vb, hien, { homNay: getHomNay() }).filter((x) => x.dien).forEach((x) => { if (datO(x.o, x.gia_tri)) da.vbDaDien.add(x.o); });
  }
  const nhac = phanLoaiNhacToi(da.kq?.van_ban_nhac_toi || [], danhMucKl().mucTieu || [], danhMucKl().nhomMucTieu || []);
  apAiVanBan([...(da.kq?.muc_tieu_van_ban || []), ...nhac.coSan], nhac.moi);
}
// Trợ lý AI chưa bật: số hiệu, ngày, trích yếu ở trang đầu → ô trống của "Văn bản mới".
function dienTaiMay(doc) {
  const g = doanTuChu(String(doc.chu || '').slice(0, 6000));
  if (!g.so_hieu && !g.ngay_van_ban && !g.trich_yeu) { notifyError('Không đọc được số hiệu, ngày ban hành ở trang đầu (tệp có thể là bản chụp) — đồng chí nhập tay.'); return; }
  if ($('klThVanBan').value !== MOI) { $('klThVanBan').value = MOI; phat($('klThVanBan'), 'change'); }
  const n = [['klThSoKL', g.so_hieu], ['klThNgayBH', g.ngay_van_ban && g.ngay_van_ban <= getHomNay() ? g.ngay_van_ban : ''], ['klThTrichYeu', g.trich_yeu]]
    .filter(([id, v]) => v && !$(id).value && datO(id, v)).length;
  notifySuccess(`Đã điền ${n} ô của văn bản đọc được ở trang đầu — đồng chí kiểm tra; trợ lý AI chưa bật nên chưa tách nhiệm vụ.`);
}

async function docTep(f) {
  const loi = kiemTep(f); if (loi) { notifyError(loi); return; }
  if (da.dang) return;
  const luot = ++da.luot; const cu = () => luot !== da.luot;   // biểu mẫu mở lại / bỏ kết quả trong lúc đọc → bỏ kết quả lượt này
  da.dang = true; $('gvDocNut').disabled = true; tt('Đang đọc tệp trên máy…');
  try {
    const { docPdf, anhCacTrang } = await import('../../../lib/kl/doc-pdf.js');
    const doc = await docPdf(f);
    const t = await trangThaiAi(); if (cu()) return;
    if (!aiDocDuoc(t)) { dienTaiMay(doc); return; }
    const banChup = laBanChup(doc.chu);
    let anh = [];
    if (banChup) { tt('Tệp là bản chụp — đang chuẩn bị ảnh các trang…'); anh = await anhCacTrang(f, { toiDa: 8 }); if (!anh.length) throw new Error('không đọc được trang nào của tệp'); }
    if (cu()) return;
    tt(`Trợ lý AI đang đọc ${doc.soTrang} trang — thường mất từ 20 giây đến 2 phút, đồng chí vui lòng chờ…`);
    const r = await docVanBanAi({ ten_tep: f.name, chu: banChup ? '' : doc.chu, anh, so_trang: doc.soTrang }); if (cu()) return;
    Object.assign(da, { kq: r.ket_qua, tep: f.name, soTrang: doc.soTrang, moHinh: r.mo_hinh || '', ncc: r.nha_cung_cap || '', banChup, vbCo: null,
      vbDaDien: new Set(), the: new Map(), daGiao: new Set(), vbId: null });
    document.querySelectorAll('#giaoViecForm [data-ai-ghi]').forEach((x) => x.remove());
    await apVanBan(cu); if (cu()) return;
    const n = r.ket_qua?.nhiem_vu?.length || 0; const sot = r.ket_qua?.tong_bo_sot || 0;
    notifySuccess(`Đã đọc văn bản${da.vbCo ? ' (đã có trên hệ thống — đã chọn)' : da.giuVb ? ' (giữ văn bản đồng chí đã chọn)' : ''}: ${n} nhiệm vụ.${sot ? ` Có ${sot} đoạn có thể còn sót — đồng chí xem cuối danh sách.` : ''} Đồng chí bấm "Điền" để đưa vào các thẻ.`);
  } catch (e) { if (!cu()) notifyError(`Chưa đọc được văn bản: ${e.message}`); } finally {
    if (!cu()) { da.dang = false; $('gvDocNut').disabled = false; tt(''); veKq(); }
  }
}

// Thẻ để điền nhiệm vụ i: thẻ đã điền nhiệm vụ đó → thẻ trống nội dung chưa nhận nhiệm vụ nào → thẻ mới (≤ 20).
function theDeDien(i) {
  const daDung = new Set(da.the.values());
  const cu = da.the.has(i) ? theTheoKhoa(da.the.get(i)) : null; if (cu) return cu;
  const trong = cacThe().find((t) => !daDung.has(khoaThe(t)) && !String(oCua(t, 'noi_dung')?.value || '').trim()); if (trong) return trong;
  if (soThe() >= TOI_DA) return null;
  themDong(); return cacThe().at(-1);
}
function datOThe(the, cot, gt) {
  const el = oCua(the, cot); if (!el) return;
  if (el.tagName === 'SELECT' && ![...el.options].some((x) => x.value === String(gt))) return;
  el.value = String(gt); phat(el, el.tagName === 'SELECT' ? 'change' : 'input');
}
function dienVao(i) {
  const n = da.kq?.nhiem_vu?.[i]; if (!n) return false;
  const the = theDeDien(i); if (!the) return false;
  const hien = Object.fromEntries(Object.keys(ID1).map((c) => [c, oCua(the, c)?.value || '']));
  const kh = keHoachThe(n, hien, { banChup: da.banChup });
  ['nganh', 'linh_vuc', 'san_pham', 'loai', 'han', 'noi_dung', 'san_pham_mo_ta', 'phoi_hop'].forEach((c) => { if (kh.dien[c] !== undefined) datOThe(the, c, kh.dien[c]); });
  the.querySelector('[data-ai-ghi]')?.remove();
  the.querySelector('.gv-nv-dau')?.insertAdjacentHTML('afterend', ghiChuTheHtml(kh, i, da.kq.nhiem_vu.length));
  apAiThe(the, n.muc_tieu || []);
  da.the.set(i, khoaThe(the));
  return true;
}
async function dienTatCa() {
  if (da.vbId && $('klThVanBan').value !== da.vbId) await chonVanBan(da.vbId);   // điền tiếp: nhiệm vụ còn lại vào văn bản vừa tạo
  let n = 0; let het = false;   // nhiệm vụ trùng (máy chủ rà — trung_voi) không điền khi "Điền tất cả"
  (da.kq?.nhiem_vu || []).forEach((x, i) => { if (het || da.daGiao.has(i) || da.the.has(i) || laTrung(x)) return; if (dienVao(i)) n += 1; else het = true; });
  veKq();
  if (n) notifySuccess(`Đã điền ${n} nhiệm vụ vào các thẻ — đồng chí chọn người chịu trách nhiệm, kiểm tra hạn, sản phẩm của từng thẻ rồi bấm Giao.`);
  if (het) notifyError(`Biểu mẫu đã đủ ${TOI_DA} nhiệm vụ — giao lượt này trước rồi bấm "Điền tiếp".`);
  $('gvPhan2')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

export function mountDocAi() {
  khiDaGiao(({ vbId, viec }) => {   // muc-tieu.js ganSauGiao: nhiệm vụ của văn bản đã giao (theo khoá thẻ) → "đã giao"; điền tiếp vào văn bản vừa tạo
    const khoa = new Set(viec.map((v) => v.khoa));
    da.the.forEach((k, i) => { if (khoa.has(k)) { da.daGiao.add(i); da.the.delete(i); } });
    if (da.kq && vbId) da.vbId = vbId;
  });
  registerActions({
    gvDocChon: () => { if (!da.dang) $('gvDocTep')?.click(); },
    gvDocBo: () => { Object.assign(da, { kq: null, vbCo: null, giuVb: false, the: new Map(), daGiao: new Set(), vbId: null }); document.querySelectorAll('#giaoViecForm [data-ai-ghi]').forEach((x) => x.remove()); veKq(); },
    gvDocDienVb: ({ o }) => {
      if (o !== 'klThLoaiVB' && $(o)?.value) { notifyError('Ô đã có giá trị — giữ nguyên.'); veKq(); return; }
      const x = keHoachVanBan(da.kq?.van_ban, {}, { homNay: '9999-12-31' }).find((y) => y.o === o); if (x && datO(o, x.gia_tri)) da.vbDaDien.add(o); veKq();
    },
    gvDocDien: ({ i }) => { if (!dienVao(Number(i))) notifyError(`Biểu mẫu đã đủ ${TOI_DA} nhiệm vụ — giao lượt này trước.`); veKq(); },
    gvDocDienTatCa: () => dienTatCa(),
    gvDocDungHan: ({ i, han }) => { const the = theTheoKhoa(da.the.get(Number(i))); if (the && !oCua(the, 'han')?.value) datOThe(the, 'han', han); },
    gvDocDungNd: ({ i }, nut) => {   // người giao chủ động dùng nội dung trợ lý AI tách (chưa khớp nguyên văn / chưa trọn câu) — vẫn phải đối chiếu văn bản gốc
      const the = theTheoKhoa(da.the.get(Number(i))); const nd = da.kq?.nhiem_vu?.[Number(i)]?.noi_dung?.gia_tri;
      if (!the || !nd) return;
      datOThe(the, 'noi_dung', nd); nut?.closest('[data-ai-nd]')?.replaceWith(document.createTextNode('Đã dùng nội dung trợ lý AI tách — đồng chí đối chiếu văn bản gốc.'));
    },
    gvDocDungTron: ({ i }, nut) => {   // nội dung khớp nguyên văn nhưng câu còn tiếp: dùng trọn câu (nguyên văn chữ của tệp — máy chủ con_tiep)
      const the = theTheoKhoa(da.the.get(Number(i))); const x = da.kq?.nhiem_vu?.[Number(i)]?.noi_dung;
      if (!the || !x?.gia_tri || !x.con_tiep) return;
      datOThe(the, 'noi_dung', tronCau(x.gia_tri, x.con_tiep)); nut?.closest('[data-ai-nd]')?.replaceWith(document.createTextNode('Đã dùng trọn câu trong văn bản.'));
    },
    gvDocThemDoan: ({ j }) => {   // đoạn "có thể còn sót" → thêm vào danh sách nhiệm vụ (nguyên văn), người giao bấm điền như các việc khác
      const ds = da.kq?.nghi_bo_sot || []; const d = ds[Number(j)]; if (!d) return;
      da.kq = { ...da.kq, nhiem_vu: [...(da.kq.nhiem_vu || []), nhiemVuTuDoan(d)], nghi_bo_sot: ds.filter((_, k) => k !== Number(j)),
        tong_bo_sot: Math.max(0, (da.kq.tong_bo_sot || ds.length) - 1) };
      veKq(); notifySuccess(`Đã thêm vào danh sách thành nhiệm vụ ${da.kq.nhiem_vu.length} — đồng chí bấm "Điền vào thẻ".`);
    },
  });
}
