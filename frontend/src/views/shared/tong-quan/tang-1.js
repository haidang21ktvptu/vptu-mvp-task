// Tổng quan — tầng 1 "Dải điều hành" (v3.36, chủ dự án chọn phương án A ngày 26/11/2026 — CAU-HOI V-11; DESIGN mục 10): vừa một màn hình.
// Dải màu nhận diện #tqSo .tq-dai (tên, phạm vi, giờ cập nhật, kỳ, In báo cáo nhanh, Giao việc; vòng tỷ lệ hoàn thành đúng hạn; ba số tổng: nhiệm vụ
// của kỳ, đã hoàn thành, đang thực hiện) → bốn thẻ việc cần quan tâm (Quá hạn chưa hoàn thành là thẻ duy nhất có màu nhấn; Cần lãnh đạo cho ý kiến;
// Chỉ đạo chờ phản hồi; Đang thực hiện trong hạn) → câu kết luận kèm nút mở danh sách quá hạn → hàng biểu đồ và dòng Nhiệm vụ quý (tang-1-khoi.js).
// Cách đếm không đổi (CAU-HOI V-9, lib/kl/tong-quan-tang.js): mỗi số, mỗi thẻ là nút mở đúng danh sách tạo nên con số (data-action="tqMo",
// lib/kl/tong-quan-loc.js). Bản in "Báo cáo nhanh" dùng bảng năm chỉ tiêu .tq1-bang-in (chỉ hiện khi in, in.css). Chỉ dựng chuỗi HTML.
// v3.36 (CAU-HOI V-13, DESIGN mục 17 "số trước, chi tiết bấm mới mở"): trên màn hình mỗi con số chỉ kèm một nhãn ngắn; phần tách của con số (trước là
// dòng chữ phụ) chuyển vào gợi ý data-goi (rê chuột, đưa tiêu điểm — index.js hienGoi), nhãn đọc màn hình và danh sách mở khi bấm; bản in giữ đủ chữ.
import { escapeHtml } from '../../../lib/dom.js';
import { tenMuc } from '../../../lib/kl/nhan.js';
import { ngayVanBanVN } from '../../../lib/kl/ngay.js';
import { soSanh } from '../../../lib/kl/tong-quan-tang.js';
import { soLanHtml, tieuDeHtml, duongNhoSvg } from '../../../lib/chuyen-dong.js';
import { mo, KY } from './template.js';

const svg = (than, co = 18) => `<svg width="${co}" height="${co}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${than}</svg>`;
const ICON_GIAO = svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>');
const ICON_IN = svg('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>');
const ICON_CANH_BAO = svg('<circle cx="12" cy="12" r="10"/><path d="M12 7.5v5M12 16.5h.01"/>', 20);
const ICON_Y_KIEN = svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>', 20);
const ICON_CHI_DAO = svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 20);
const ICON_TRONG_HAN = svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', 20);
// Ba lớp núi mờ của dải (không dùng ảnh): tô bằng lớp phủ trắng nhạt của nền đặc (--ben-hover), chồng lên nhau thành ba sắc độ.
const NUI = `<svg class="dai-nui" viewBox="0 0 520 200" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,200 60,120 110,150 170,70 230,130 290,60 350,120 410,50 470,110 520,80 520,200"/>
  <polygon points="80,200 150,140 210,170 280,105 340,150 400,95 460,140 520,120 520,200"/><polygon points="220,200 300,160 360,180 430,140 520,165 520,200"/></svg>`;

const phan = (ds) => ds.filter(([n, , luon]) => n || luon).map(([n, chu]) => `${n} ${chu}`).join(', ');
const thuongDau = (s) => s.charAt(0).toLowerCase() + s.slice(1);
// Kỳ ghi sau "nhiệm vụ của …": tháng 11, quý IV, năm 2026, nhiệm kỳ 2025–2030; kỳ tuỳ chọn (từ ngày – đến ngày) ghi "kỳ đã chọn".
const tenKy = (k) => (k.ky === 'tuy-chon' ? 'kỳ đã chọn' : thuongDau(k.ten || 'kỳ'));

const goi = (chu) => (chu ? ` data-goi="${escapeHtml(chu)}"` : '');
// Dòng so sánh với tuần trước: trên thẻ chỉ ghi "tăng 3 trong tuần" / "giảm 2 trong tuần" (không đổi thì không ghi); câu đủ (chu) ở gợi ý và nhãn đọc
// màn hình. lop 'xau' khi tăng là xấu (quá hạn, cần ý kiến, chỉ đạo chờ), 'tot' khi giảm; thẻ trong hạn không tô màu. Trả { html, chu } hoặc null.
function dongSoSanh(nay, cu, tangLaXau = true) {
  const s = soSanh(nay, cu);
  if (!s) return null;
  if (!s.d) return { html: '', chu: s.chu };
  const lop = !tangLaXau ? '' : s.d > 0 ? ' xau' : ' tot';
  return { html: `<span class="ss-tq${lop}"${goi(s.chu)}>${s.d > 0 ? 'tăng' : 'giảm'} ${Math.abs(s.d)} trong tuần</span>`, chu: s.chu };
}
// Thanh nhỏ dưới thẻ: các phần của con số theo đúng thứ tự dòng phụ. lop viết nguyên văn (p-do, p-ddb, p-vang, p-navy, p-lam, p-xam).
const thanhNho = (ds) => (ds.some(([n]) => n) ? `<span class="thanh-nho" aria-hidden="true">${ds.filter(([n]) => n).map(([n, lop]) => `<i class="${lop}" style="flex-grow:${n}"></i>`).join('')}</span>` : '');
// Thẻ: số, biểu tượng, nhãn, thanh nhỏ, dòng so sánh. phu (phần tách của con số) là gợi ý của thẻ và nằm trong nhãn đọc màn hình.
function the(khoa, so, ten, phu, { icon, lopIc, thanh = '', ss = null, nhan = false }) {
  const doc = [`${so} nhiệm vụ ${thuongDau(ten)}`, so ? phu : '', ss?.chu].filter(Boolean).join('; ');
  return `<button type="button" class="${nhan ? 'the-so qua-han' : 'the-so'}" data-so="${khoa}" ${mo({ t: khoa })}${goi(phu)} aria-label="${escapeHtml(`${doc}, xem danh sách`)}">
    <span class="the-dau-so"><span class="gia">${soLanHtml(so)}</span><span class="${lopIc}" aria-hidden="true">${icon}</span></span>
    <span class="nhan-so">${escapeHtml(ten)}</span>${thanh}${ss?.html || ''}</button>`;
}
// Chữ của năm chỉ tiêu (dùng chung cho thẻ trên màn hình và bảng của bản in).
function chuChiTieu(t, k) {
  const x = t.xong;
  return {
    qh: t.qh.so ? phan([[t.qh.do, tenMuc('do'), true], [t.qh.ddb, tenMuc('ddb'), true]]) : 'Không có nhiệm vụ quá hạn',
    quyet: t.quyet.so ? phan([[t.quyet.vm, 'có vướng mắc hoặc đề xuất', true], [t.quyet.cq, 'quá hạn đã ghi cấp cần quyết định', true]]) : 'Không có vướng mắc, đề xuất chờ ý kiến',
    cd: t.cd.so ? phan([[t.cd.quaHan, 'quá hạn phản hồi', true], [t.cd.trongHan, 'trong hạn phản hồi', true]]) : 'Không có chỉ đạo chờ phản hồi',
    th: phan([[t.th.trongHan, 'trong hạn', true], [t.th.vang, tenMuc('vang'), true], [t.th.khac, 'chưa có hạn hoặc thường xuyên']]),
    dh: x.tyLe !== null ? `${x.dung} trên ${x.xet} nhiệm vụ có đủ hạn và ngày hoàn thành${x.boSung ? `, trong đó ${x.boSung} nhiệm vụ có ngày hoàn thành bổ sung` : ''}`
      : x.so ? `Chưa tính tỷ lệ: ${x.xet}/${x.canXet} nhiệm vụ có hạn đã ghi ngày hoàn thành` : `Chưa có nhiệm vụ hoàn thành ${k.trong}`,
    tuan: `${x.tuan} nhiệm vụ hoàn thành trong 7 ngày qua`,
  };
}

// Bốn thẻ việc cần quan tâm. t: theTang1; cu: tuanTruoc (cu.ngay null = chưa có bản chụp tuần trước).
export function theSoHtml(t, cu, k) {
  const coCu = Boolean(cu?.ngay); const c = chuChiTieu(t, k);
  return `<div class="tq1-the">${the('qh', t.qh.so, 'Quá hạn chưa hoàn thành', c.qh, { icon: ICON_CANH_BAO, lopIc: 'the-ic do', nhan: t.qh.so > 0,
    thanh: thanhNho([[t.qh.do, 'p-do'], [t.qh.ddb, 'p-ddb']]), ss: coCu ? dongSoSanh(t.qh.so, cu.qh) : null })}${the('quyet', t.quyet.so, 'Cần lãnh đạo cho ý kiến', c.quyet, { icon: ICON_Y_KIEN, lopIc: 'the-ic vang',
    thanh: thanhNho([[t.quyet.vm, 'p-vang'], [t.quyet.cq, 'p-navy']]), ss: coCu ? dongSoSanh(t.quyet.so, cu.quyet) : null })}${the('cdCho', t.cd.so, 'Chỉ đạo chờ phản hồi', c.cd, { icon: ICON_CHI_DAO, lopIc: 'the-ic lam',
    thanh: thanhNho([[t.cd.quaHan, 'p-do'], [t.cd.trongHan, 'p-lam']]), ss: dongSoSanh(t.cd.so, cu?.cd) })}${the('th', t.th.so, 'Đang thực hiện trong hạn', c.th, { icon: ICON_TRONG_HAN, lopIc: 'the-ic luc',
    thanh: thanhNho([[t.th.trongHan, 'p-lam'], [t.th.vang, 'p-vang'], [t.th.khac, 'p-xam']]), ss: coCu ? dongSoSanh(t.th.so, cu.th, false) : null })}</div>`;
}

// Vòng tỷ lệ hoàn thành đúng hạn (chỉ vẽ phần vòng khi đủ dữ liệu — tyLeDungHan) và ba số tổng của dải. v3.36 (CAU-HOI V-12): số lăn, vòng quét từ 0
// (--cung = độ dài cung), đường xu hướng nhỏ 12 tuần cạnh số giao mới / hoàn thành (tuan: xuHuongTuan), thanh trong hạn – quá hạn dưới số đang thực hiện.
const BK = 50.5; const CHU_VI = 2 * Math.PI * BK;
const duongNho = (ds, chu) => { const svg1 = duongNhoSvg(ds); return svg1 ? `<span class="dn-bao" data-goi="${escapeHtml(chu)}">${svg1}</span>` : ''; };
function soDaiHtml(t, k, tuan = []) {
  const x = t.xong; const dangMo = t.qh.so + t.th.so; const tong = x.so + dangMo; const c = chuChiTieu(t, k); const ky = tenKy(k);
  const cung = x.tyLe === null ? 0 : (CHU_VI * x.tyLe) / 100;
  const vong = `<span class="vong-dai"><svg viewBox="0 0 112 112" aria-hidden="true"><circle class="vd-ranh" cx="56" cy="56" r="${BK}"/>${x.tyLe === null ? ''
    : `<circle class="vd-gia" cx="56" cy="56" r="${BK}" stroke-dasharray="${cung.toFixed(1)} ${CHU_VI.toFixed(1)}" style="--cung:${cung.toFixed(1)}" transform="rotate(-90 56 56)"/>`}</svg>
    <span class="vd-chu"><b>${x.tyLe === null ? '—' : soLanHtml(`${x.tyLe}%`)}</b><small>đúng hạn</small></span></span>`;
  const so = (khoa, n, ten, phu, ct, nhan, them = '', duoi = '') => `<button type="button" class="so-dai" data-so="${khoa}" ${mo(ct)}${goi(phu)} aria-label="${escapeHtml(`${nhan}, xem danh sách`)}">
    <span class="so-hang"><span class="gia">${soLanHtml(n)}</span>${them}</span><span class="nhan-so">${escapeHtml(ten)}</span>${duoi}</button>`;
  const thanhMo = dangMo ? `<span class="thanh-nho tren-dai" aria-hidden="true">${t.th.so ? `<i class="p-sang" style="flex-grow:${t.th.so}"></i>` : ''}${t.qh.so ? `<i class="p-do" style="flex-grow:${t.qh.so}"></i>` : ''}</span>` : '';
  const tachMo = `${t.th.so} trong hạn, ${t.qh.so} quá hạn`; const tachTong = `${x.so} hoàn thành ${k.trong}, ${dangMo} đang thực hiện`;
  return `<div class="dai-so"><button type="button" class="so-dung" data-so="dh" ${mo({ t: 'dg' })}${goi(c.dh)} aria-label="${escapeHtml(`Hoàn thành đúng hạn${x.tyLe === null ? '' : ` ${x.tyLe}%`}: ${c.dh}, xem danh sách`)}">
      ${vong}<span class="so-dung-chu"><b>Hoàn thành đúng hạn</b></span></button>
    ${so('tong', tong, `nhiệm vụ của ${ky}`, tachTong, { t: 'nhom', ma: '*', ten: `Nhiệm vụ của ${ky}` }, `${tong} nhiệm vụ của ${ky}: ${tachTong}`,
    duongNho(tuan.map((w) => w.giao), 'Giao mới theo tuần, 12 tuần gần đây'))}
    ${so('xong', x.so, 'đã hoàn thành', c.tuan, { t: 'xong' }, `${x.so} nhiệm vụ đã hoàn thành ${k.trong}, trong đó ${c.tuan}`, duongNho(tuan.map((w) => w.xong), 'Hoàn thành theo tuần, 12 tuần gần đây'))}
    ${so('mo', dangMo, 'đang thực hiện', tachMo, { t: 'mo' }, `${dangMo} nhiệm vụ đang thực hiện: ${tachMo}`, '', thanhMo)}</div>`;
}

// Bản in A4 "Báo cáo nhanh": phần đầu theo thể thức Văn phòng (cơ quan, dòng Đảng, ngày), tên báo cáo, phạm vi, kỳ; chân ghi nguồn. Chỉ hiện khi
// in (in.css). coQuan = [cấp trên, cơ quan]. Ngày theo thể thức (ngayVanBanVN), ngày giờ theo giờ Việt Nam.
const VN = { timeZone: 'Asia/Ho_Chi_Minh' };
export function inDauHtml({ coQuan = ['TỈNH ỦY CAO BẰNG', 'VĂN PHÒNG'], phamVi, kyTen, luc = new Date() }) {
  return `<div class="tq-in-dau" aria-hidden="true"><div class="tq-in-the-thuc"><div><span>${escapeHtml(coQuan[0])}</span><b>${escapeHtml(coQuan[1])}</b><span>*</span></div>
      <div><b class="tq-in-dang">ĐẢNG CỘNG SẢN VIỆT NAM</b><i>${ngayVanBanVN(luc)}</i></div></div>
    <p class="tq-in-ten">BÁO CÁO NHANH</p><p class="tq-in-trich-yeu">Tình hình thực hiện nhiệm vụ đến ngày ${luc.toLocaleDateString('vi-VN', VN)}</p>
    <p class="tq-in-pham-vi">Phạm vi: ${escapeHtml(phamVi)}. Kỳ tính hoàn thành: ${escapeHtml(kyTen || '')}. Số liệu lúc ${luc.toLocaleTimeString('vi-VN', { ...VN, hour: '2-digit', minute: '2-digit' })}.</p></div>`;
}
export const inChanHtml = () => '<p class="tq-in-chan" aria-hidden="true">In từ Hệ thống quản trị nhiệm vụ của Văn phòng Tỉnh ủy Cao Bằng; số liệu theo phạm vi của người in, việc đang mở và cảnh báo tính đến ngày in.</p>';
// Bảng năm chỉ tiêu của bản in: số, tên, phần tách, so với tuần trước (như năm dòng của bản in trước đây).
function bangInHtml(t, cu, k) {
  const coCu = Boolean(cu?.ngay); const c = chuChiTieu(t, k); const x = t.xong; const ss = (nay, truoc) => soSanh(nay, truoc)?.chu || '';
  const dong = (so, ten, phu, sau) => `<div class="dong-in"><b>${so}</b><span class="ten-in">${escapeHtml(ten)}</span><span>${escapeHtml(phu)}</span><span>${escapeHtml(sau)}</span></div>`;
  return `<div class="tq1-bang-in" aria-hidden="true">${dong(t.qh.so, 'Nhiệm vụ quá hạn chưa hoàn thành', c.qh, coCu ? ss(t.qh.so, cu.qh) : '')}${dong(t.quyet.so, 'Nhiệm vụ cần lãnh đạo cho ý kiến', c.quyet, coCu ? ss(t.quyet.so, cu.quyet) : '')}${
    dong(t.cd.so, 'Nhiệm vụ có chỉ đạo chờ phản hồi', c.cd, ss(t.cd.so, cu?.cd))}${dong(t.th.so, 'Nhiệm vụ đang thực hiện trong hạn', c.th, coCu ? ss(t.th.so, cu.th) : '')}${
    dong(x.so, `Nhiệm vụ đã hoàn thành ${k.trong}`, x.tyLe !== null ? `Đúng hạn ${x.tyLe}%: ${c.dh}` : c.dh, c.tuan)}</div>`;
}

// Nút và nhóm kỳ của dải: dùng chung cho dải thật và khung chờ (khung chờ có đủ hai phần này nên dải cao gần bằng dải thật ở mọi bề rộng; nút In chờ
// có số liệu mới bấm được, nút kỳ chọn trước được).
const nutDaiHtml = (coGiaoViec, cho = false) => `<div class="dai-nut"><button type="button" class="nut" data-action="tqIn" id="tqIn"${cho ? ' disabled' : ''} aria-label="In báo cáo nhanh trên một trang A4">${ICON_IN}<span class="chu-nut">In báo cáo nhanh</span></button>
    ${coGiaoViec ? `<button type="button" class="nut chinh" data-action="openGiaoViec" aria-label="Giao việc">${ICON_GIAO}<span class="chu-nut">Giao việc</span></button>` : ''}</div>`;
const kyHtml = (ten, kyChon) => `<div class="pham-vi" role="group" aria-label="Kỳ tính hoàn thành và các bảng phân tích" id="tqKy">${KY.map((x) => `<button type="button" data-action="tqKy" data-ky="${x}" aria-pressed="${String(kyChon === x)}">${escapeHtml(ten[x])}</button>`).join('')}</div>`;
const dauDaiHtml = ({ tieuDe, phamVi, capNhat, nut = '', ky = '' }) => `<div class="dai-hang"><h1 id="tqTieuDe" aria-label="${escapeHtml(tieuDe)}">${tieuDeHtml(tieuDe)}</h1>${nut}</div>
  <div class="dai-hang"><p class="dai-pham-vi">${escapeHtml(phamVi)}. <span class="tq1-luc">${capNhat}</span></p>${ky}</div>`;

// Tầng 1 đầy đủ. luc: thời điểm đọc số liệu; kyChon null = đang dùng kỳ tuỳ chọn của bộ lọc chi tiết (không nút nào sáng); t, cu, k: số của tầng 1,
// tuần trước, kỳ; duocChiDao: người xem ra được chỉ đạo (nhãn nút của câu kết luận); hang: hàng biểu đồ; nvq: dòng Nhiệm vụ quý (tang-1-khoi.js); tuan: 12 tuần
// gần đây (xuHuongTuan) cho đường xu hướng nhỏ trên dải.
export function tang1Html({ tieuDe, phamVi, luc, ten, kyChon, coGiaoViec, t, cu, k, ketLuan, ketLuanGon = ketLuan, duocChiDao, hang, nvq, coQuan, tuan }) {
  const capNhat = luc ? `Số liệu cập nhật ${luc.toLocaleTimeString('vi-VN', { ...VN, hour: '2-digit', minute: '2-digit' })} ngày ${luc.toLocaleDateString('vi-VN', VN)}` : 'Đang nạp số liệu…';
  const nut = nutDaiHtml(coGiaoViec); const ky = kyHtml(ten, kyChon);
  // Màn hình ghi câu gọn (cauKetLuanGon), bản in "Báo cáo nhanh" ghi câu đủ (in.css đổi .chi-man / .chi-in); số việc quá hạn in đậm.
  const cauIn = escapeHtml(ketLuan).replace(/(\d+ nhiệm vụ quá hạn chưa hoàn thành)/, '<b>$1</b>');
  const cauGon = escapeHtml(ketLuanGon).replace(/^((?:Theo bộ lọc: )?)(\d+ nhiệm vụ quá hạn)/, '$1<b>$2</b>');
  return `<section class="tq-tang1" id="tqTang1" aria-labelledby="tqTieuDe">${inDauHtml({ coQuan, phamVi, kyTen: k.ten, luc: luc || new Date() })}
    <div class="tq-so" id="tqSo"><div class="tq-dai">${NUI}<div class="dai-than">${dauDaiHtml({ tieuDe, phamVi, capNhat, nut, ky })}${soDaiHtml(t, k, tuan)}</div><div class="dai-vach" aria-hidden="true"></div></div>
      ${theSoHtml(t, cu, k)}</div>${bangInHtml(t, cu, k)}
    <div class="${t.qh.so ? 'tq1-kl qua-han' : 'tq1-kl'}"><span class="kl-ic" aria-hidden="true">${ICON_CANH_BAO}</span><p class="tq1-ket-luan" id="tqKetLuan"><span class="chi-man">${cauGon}</span><span class="chi-in">${cauIn}</span></p>
      ${t.qh.so ? `<button type="button" class="nut chinh" id="tqXemQuaHan" ${mo({ t: 'do' })}>${duocChiDao ? 'Xem và chỉ đạo' : 'Xem danh sách'}</button>` : ''}</div>
    ${hang}${nvq}</section>`;
}

// Khung chờ (lần mở đầu chưa có số): dải có tên trang, nút, nhóm kỳ (ten có thì vẽ), vòng và ba ô số giữ chỗ — dải cao gần bằng dải thật nên các
// khối bên dưới ít xô lệch khi số liệu về; bốn thẻ nhấp nháy; không hiện số 0 gây hiểu nhầm.
export function khungCho1Html(tieuDe, phamVi, { ten = null, kyChon = null, coGiaoViec = false } = {}) {
  const soCho = `<div class="dai-so cho" aria-hidden="true"><span class="so-dung"><span class="vong-dai"><svg viewBox="0 0 112 112"><circle class="vd-ranh" cx="56" cy="56" r="${BK}"/></svg></span>
    <span class="so-dung-chu"><span class="xuong" style="width:9rem;height:14px"></span></span></span>${
    '<span class="so-dai"><span class="xuong" style="width:64px;height:30px"></span><span class="xuong" style="width:7rem;margin-top:8px"></span></span>'.repeat(3)}</div>`;
  const o = '<span class="the-so cho" aria-hidden="true"><span class="xuong" style="width:56px;height:30px"></span><span class="xuong" style="width:80%;margin-top:10px"></span><span class="xuong" style="width:100%;height:6px;margin-top:12px"></span></span>';
  return `<section class="tq-tang1" aria-busy="true"><div class="tq-so"><div class="tq-dai">${NUI}<div class="dai-than">${dauDaiHtml({ tieuDe, phamVi, capNhat: 'Đang nạp số liệu…', nut: ten ? nutDaiHtml(coGiaoViec, true) : '', ky: ten ? kyHtml(ten, kyChon) : '' }).replace(' id="tqTieuDe"', '')}${soCho}</div>
    <div class="dai-vach" aria-hidden="true"></div></div><div class="tq1-the">${o.repeat(4)}</div></div></section>`;
}
