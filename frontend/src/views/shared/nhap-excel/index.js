// Thẻ "Nhập từ Excel" của màn Giao việc (v9 đợt 2 — nhập toàn trình): đọc tệp ngay trong trình duyệt (lib/xlsx-doc.js, nạp động), tự nhận sheet /
// dòng tiêu đề / hồ sơ ghép cột, chuẩn hoá theo danh mục + từ điển dùng chung, đánh giá chuẩn 3 mức + quy tắc mặc định, xem trước — KHÔNG ghi gì cho
// tới khi bấm Nhập; nhập theo lô (mã LO-…; lỗi giữa chừng → "Nhập tiếp" cùng lô), dòng thiếu vào "Chờ hoàn thiện", hoàn tác lô trong 24 giờ. Tải
// "Mẫu nhập chuẩn VPTU-TASK"; "Xuất theo mẫu" ở màn Nhiệm vụ (sửa rồi nhập lại theo mã). Quyền thật ở DB (0072–0075).
import { $, escapeHtml } from '../../../lib/dom.js';
import { state, findAccount } from '../../../lib/state.js';
import { DEPT_NAMES } from '../../../lib/constants.js';
import { registerActions } from '../../../lib/actions.js';
import { notifySuccess, notifyError } from '../../../components/toast.js';
import { loadDanhMucKl, danhMucKl } from '../../../lib/kl/du-lieu.js';
import { homNayVN } from '../../../lib/kl/ngay.js';
import { timTieuDe, ghepTheoHoSo, HO_SO_MAU, HO_SO_PHU_LUC_2, chuanTieuDe, chuanChu, truong } from '../../../lib/kl/nhap/truong.js';
import { LOAI_TU_DIEN } from '../../../lib/kl/nhap/chuan-hoa.js';
import { danhGia, demKetQua } from '../../../lib/kl/nhap/danh-gia.js';
import { tieuDeCot, layDong, chuanDong } from '../../../lib/kl/nhap/bang.js';
import { docTuDien, docHoSo, luuHoSo, luuTuDien, maDaCo, nhapLo, loDoCuaTep } from '../../../lib/kl/nhap/du-lieu.js';
import { khungNhapHtml, ghepHtml, xemTruocHtml, ketQuaHtml } from './ve.js';
import { napCho, hoanTacLoAction } from './cho.js';
import { dsDangHien } from '../kl/danh-sach.js';

const TOI_DA_DONG = 2000;   // mỗi lô (CHECK của lo_nhap)
// loDo: lô của lần bấm Nhập trước bị lỗi giữa chừng (bấm lại = gửi tiếp vào lô đó); khongLuu: lựa chọn chỉ dùng cho tệp này (trùng tên người).
const nx = { sheets: [], tenTep: '', sheet: 0, dongTieuDe: 0, anhXa: {}, hoSoTen: '', mau: 'TU_GHEP', nhanDien: '', hangLoat: {}, hlTruong: '', loc: '', soHien: 100,
  cheDoXong: '', tuDien: new Map(), tuDienMoi: new Map(), khongLuu: new Set(), hoSoDs: [], ma: new Set(), maKhoa: '', loiMa: '', dong: [], dg: [], dangNhap: false, loDo: null };
const tenPhong = (m) => DEPT_NAMES[m] || m || '';
const ctx = () => { const td = new Map([...nx.tuDien].map(([k, m]) => [k, new Map(m)])); nx.tuDienMoi.forEach((m, k) => { if (!td.has(k)) td.set(k, new Map()); m.forEach((v, g) => td.get(k).set(g, v)); });
  return { dm: danhMucKl(), accounts: state.accounts || [], tenPhong, tuDien: td }; };
const hoSoTatCa = () => [HO_SO_MAU, HO_SO_PHU_LUC_2, ...nx.hoSoDs.map((h) => ({ ...h, mau: 'TU_GHEP' }))];

async function chonTep(f) {
  if (!f || nx.dangNhap) return;
  $('nxTenTep').textContent = `Đang đọc ${f.name}…`;
  try {
    const [{ docXlsx }] = await Promise.all([import('../../../lib/xlsx-doc.js'), loadDanhMucKl(), napChung()]);
    nx.sheets = await docXlsx(await f.arrayBuffer()); nx.tenTep = f.name;
    const t = timTieuDe(nx.sheets, nx.hoSoDs);
    if (!t) throw new Error('Không nhận ra dòng tiêu đề nào (cần ít nhất 2 cột như "Nội dung", "Hạn hoàn thành"). Kiểm tra lại tệp hoặc dùng mẫu nhập chuẩn.');
    const loDo = await loDoCuaTep(f.name, state.user?.id).catch(() => null);   // cùng tệp, lô lần trước nhập dở → nhập tiếp đúng lô đó, đúng chế độ của lô
    Object.assign(nx, { sheet: t.sheet, dongTieuDe: t.dongTieuDe, anhXa: t.anhXa, hoSoTen: t.hoSo?.ten || '', mau: t.hoSo?.mau || 'TU_GHEP', hangLoat: {}, loc: '', soHien: 100,
      cheDoXong: loDo?.che_do_xong || '', tuDienMoi: new Map(), khongLuu: new Set(), loDo, maKhoa: '', loiMa: '' });
    $('nxTenTep').textContent = f.name;
    await tinhLai();
  } catch (e) { $('nxTenTep').textContent = f.name; $('nxBuoc').innerHTML = `<p class="nx-loi">${escapeHtml(e.message)}</p>`; }
}
let daNapChung = false;
async function napChung(lai = false) {
  if (daNapChung && !lai) return;
  [nx.tuDien, nx.hoSoDs] = await Promise.all([docTuDien().catch(() => new Map()), docHoSo().catch(() => [])]); daNapChung = true;
}

// Ghép → chuẩn hoá → đánh giá → vẽ. Mã có trong tệp: hỏi DB một lần cho mỗi bộ mã (dòng có mã đã có = cập nhật); hỏi lỗi → CHẶN nhập (không coi
// nhầm việc có sẵn là việc mới rồi điền mặc định đè lên — DB cũng chặn bằng cờ cap_nhat).
async function tinhLai() {
  const sh = nx.sheets[nx.sheet]; const c = ctx();
  const tho = layDong(sh, nx.dongTieuDe, nx.anhXa);
  nx.dong = tho.map((d) => chuanDong(d, c));
  const ma = [...new Set(nx.dong.map((d) => d.o.ma?.ma).filter(Boolean).map((m) => String(m).trim().toUpperCase()))];
  if (ma.join() !== nx.maKhoa) {
    try { nx.ma = await maDaCo(ma); nx.maKhoa = ma.join(); nx.loiMa = ''; } catch (e) {
      nx.ma = new Set(); nx.maKhoa = ''; nx.loiMa = `Không kiểm tra được mã việc trên hệ thống (${e.message}) — chọn lại tệp để thử lại.`;
    }
  }
  nx.dg = nx.dong.map((d) => danhGia(d, { me: state.user, dm: c.dm, accounts: c.accounts, cheDoXong: nx.cheDoXong || 'CHO_NGHIEM_THU', hangLoat: nx.hangLoat, maDaCo: nx.ma, homNay: homNayVN() }));
  const xong = nx.dg.some((x) => x.gt.tien_do === 'HOAN_THANH' && x.ket_qua !== 'CAP_NHAT');   // chỉ việc MỚI đã hoàn thành phải chọn cách xử lý
  const nhom = new Map();   // giá trị cần người nhập chọn: chưa khớp (loi) và khớp gần đúng (ma = mục đã khớp, chọn sẵn)
  nx.dong.forEach((d) => Object.entries(d.o).forEach(([k, x]) => { const gan = x?.gan === 'gan_dung'; if (!(x?.loi || gan) || !LOAI_TU_DIEN[truong(k)?.kieu]) return;
    const g = `${k}|${chuanChu(d.raw[k])}`;
    if (!nhom.has(g)) nhom.set(g, { k, v: d.raw[k], loi: gan ? `khớp gần đúng: ${x.hien}` : x.loi, chon: x.chon || [], ma: gan ? x.ma : '', n: 0 });
    nhom.get(g).n += 1; }));
  const quaNhieu = tho.length > TOI_DA_DONG;
  const s = { ...nx, tieuDe: tieuDeCot(sh, nx.dongTieuDe), dongDuLieu: tho, hoSoDs: hoSoTatCa(), dem: demKetQua(nx.dg), chuaKhop: [...nhom.values()].sort((a, b) => Boolean(a.ma) - Boolean(b.ma)),
    nhanDien: `${nx.hoSoTen ? `Hồ sơ "${nx.hoSoTen}" · ` : ''}sheet "${sh.ten}" · tiêu đề ở dòng ${nx.dongTieuDe + 1} · ${tho.length} dòng dữ liệu`,
    choNhap: tho.length > 0 && !quaNhieu && !nx.loiMa && !(xong && !nx.cheDoXong) && !nx.dangNhap,
    thongBao: !tho.length ? 'Không có dòng dữ liệu dưới dòng tiêu đề.' : quaNhieu ? `Tệp có ${tho.length} dòng — mỗi lô tối đa ${TOI_DA_DONG} dòng; chia tệp rồi nhập từng phần.`
      : nx.loiMa || (xong && !nx.cheDoXong ? 'Chọn cách xử lý việc đã hoàn thành trước khi nhập.'
        : nx.loDo ? `Lô ${nx.loDo.ma} nhập dở — bấm "Nhập tiếp" để gửi tiếp; dòng đã nhập không bị tạo lại.` : 'Chưa ghi gì cho tới khi bấm Nhập.') };
  nx.chuaKhop = s.chuaKhop;
  $('nxBuoc').innerHTML = ghepHtml(s) + xemTruocHtml(s, ctx());
  if (tieuDiem) { document.querySelector(tieuDiem)?.focus(); tieuDiem = ''; }   // vẽ lại sau mỗi lựa chọn: tiêu điểm về ô vừa đổi / ô kế tiếp
}
let tieuDiem = '';
const ve = (chon) => { tieuDiem = chon; tinhLai(); };

// Lựa chọn giá trị chưa khớp → từ điển dùng chung (trừ lựa chọn chỉ cho tệp này, giá trị gốc quá dài); lỗi lưu không chặn việc nhập.
async function luuTuDienMoi() {
  const muc = []; nx.tuDienMoi.forEach((m, loai) => m.forEach((ma, goc) => { if (goc.length <= 300 && !nx.khongLuu.has(`${loai}|${goc}`)) muc.push({ loai, goc, ma }); }));
  if (!muc.length) return;
  try { await luuTuDien(muc); } catch (e) { notifyError(`Chưa lưu được từ điển dùng chung (lần sau chọn lại): ${e.message}`); }
}
async function nhap() {
  if (nx.dangNhap) return;
  nx.dangNhap = true; $('nxNhap').disabled = true; $('nxTep').disabled = true;
  const dong = nx.dg.map((x) => x.du_lieu); const tenTep = nx.tenTep;
  try {
    if (!nx.loDo) await luuTuDienMoi();
    const kq = await nhapLo({ tenTep, mau: nx.mau, cheDoXong: nx.cheDoXong || 'CHO_NGHIEM_THU', dong, loCu: nx.loDo },
      (n) => { $('nxThongBao').textContent = `Đang nhập… ${n}/${dong.length} dòng`; });
    nx.loDo = null;
    $('nxBuoc').innerHTML = ketQuaHtml({ ...kq, tenTep });
    notifySuccess(`Đã nhập lô ${kq.lo.ma}: ${dong.length} dòng.`);
    await napChung(true); napCho(true);
  } catch (e) {
    if (e.lo) nx.loDo = e.lo;
    notifyError(`Không nhập được: ${e.message}`);
    $('nxThongBao').textContent = nx.loDo ? `${e.message} — bấm "Nhập tiếp" để gửi tiếp vào lô ${nx.loDo.ma}; dòng đã nhập không bị tạo lại.` : e.message;
    $('nxNhap').disabled = false; if (nx.loDo) $('nxNhap').textContent = `Nhập tiếp lô ${nx.loDo.ma}`;
  }
  nx.dangNhap = false; $('nxTep').disabled = false;
}

function doiO(e) {
  const t = e.target;
  if (t.id === 'nxTep') { chonTep(t.files?.[0]); t.value = ''; return; }
  if (t.dataset.nxCot !== undefined) {
    const i = Number(t.dataset.nxCot); Object.keys(nx.anhXa).forEach((j) => { if (t.value && nx.anhXa[j] === t.value) delete nx.anhXa[j]; });
    if (t.value) nx.anhXa[i] = t.value; else delete nx.anhXa[i];
    nx.hoSoTen = ''; nx.mau = 'TU_GHEP'; ve(`[data-nx-cot="${i}"]`); return;
  }
  if (t.dataset.nxKhop !== undefined && t.value) {   // trùng tên người: chỉ áp cho tệp này (lần sau người cùng tên có thể là người khác); nhóm lãnh đạo (v3.18): từ điển
    const g = nx.chuaKhop[Number(t.dataset.nxKhop)]; const loai = LOAI_TU_DIEN[truong(g.k).kieu]; const goc = chuanChu(g.v);   // can_bo trên máy chủ chỉ nhận id tài khoản → chỉ tệp này
    if (!nx.tuDienMoi.has(loai)) nx.tuDienMoi.set(loai, new Map());
    nx.tuDienMoi.get(loai).set(goc, t.value);
    if (/trùng tên/.test(g.loi) || t.value.startsWith('nhom:')) nx.khongLuu.add(`${loai}|${goc}`); else nx.khongLuu.delete(`${loai}|${goc}`);
    ve('.nx-khop select, #nxHlTruong, #nxNhap'); return;
  }
  if (t.id === 'nxSheet') {
    nx.sheet = Number(t.value); const tt = timTieuDe([nx.sheets[nx.sheet]], nx.hoSoDs);
    Object.assign(nx, { dongTieuDe: tt?.dongTieuDe || 0, anhXa: tt?.anhXa || {}, hoSoTen: tt?.hoSo?.ten || '', mau: tt?.hoSo?.mau || 'TU_GHEP' }); ve('#nxSheet');
  } else if (t.id === 'nxDongTD') { nx.dongTieuDe = Math.max(0, Number(t.value) - 1); apHoSo(hoSoTatCa().find((h) => h.ten === nx.hoSoTen)); ve('#nxDongTD'); }
  else if (t.id === 'nxHoSo') { apHoSo(hoSoTatCa().find((h) => h.ten === t.value), true); ve('#nxHoSo'); }
  else if (t.name === 'nxCheDo') { nx.cheDoXong = t.value; ve(`input[name="nxCheDo"][value="${t.value}"]`); }
  else if (t.id === 'nxHlTruong') { nx.hlTruong = t.value; ve('#nxHlTruong'); }
}
// Áp một hồ sơ: cột theo tiêu đề đã chuẩn hoá (chọn hồ sơ → nhảy tới dòng tiêu đề của hồ sơ; gõ dòng tiêu đề → giữ dòng đã gõ); không hồ sơ →
// đoán lại theo tiêu đề của dòng đang chọn.
function apHoSo(h, tuHoSo = false) {
  const sh = nx.sheets[nx.sheet];
  nx.hoSoTen = h?.ten || ''; nx.mau = h?.mau || 'TU_GHEP';
  if (h && tuHoSo && h.dong_tieu_de > 1) nx.dongTieuDe = h.dong_tieu_de - 1;
  nx.anhXa = h ? ghepTheoHoSo(tieuDeCot(sh, nx.dongTieuDe).map(chuanTieuDe), h) : timTieuDe([{ ...sh, dong: [sh.dong[nx.dongTieuDe] || []] }])?.anhXa || {};
}

async function luuHoSoAction() {
  const ten = $('nxTenHoSo').value.trim();
  if (!ten) { notifyError('Đặt tên cho cách ghép cột.'); $('nxTenHoSo').focus(); return; }
  const td = tieuDeCot(nx.sheets[nx.sheet], nx.dongTieuDe); const anhXa = {};
  Object.entries(nx.anhXa).forEach(([i, k]) => { const h = chuanTieuDe(td[i]); if (h) anhXa[h] = k; });
  try { await luuHoSo({ ten, tenSheet: nx.sheets[nx.sheet].ten, dongTieuDe: nx.dongTieuDe + 1, anhXa }); await napChung(true); nx.hoSoTen = ten; notifySuccess(`Đã lưu cách ghép "${ten}".`); ve('#nxHoSo'); }
  catch (e) { notifyError(e.message); }
}
// Mẫu trống (thẻ Nhập) hoặc danh sách đang hiện ở màn Nhiệm vụ theo mẫu (có mã — sửa rồi nhập lại để cập nhật theo mã). Bộ ghi xlsx nạp động.
async function taiMau(rows = []) {
  try {
    const [{ taoMauNhap }, { taiXuong }] = await Promise.all([import('../../../lib/kl/nhap/mau.js'), import('../../../lib/xlsx.js'), loadDanhMucKl()]);
    const ten = rows.length ? `vptu-theo-mau-nhap-${homNayVN().replace(/-/g, '')}.xlsx` : 'mau-nhap-chuan-vptu-task.xlsx';
    taiXuong(ten, taoMauNhap({ dm: danhMucKl(), accounts: state.accounts || [], tenPhong, findAccount }, rows));
    if (rows.length) notifySuccess(`Đã xuất ${rows.length} nhiệm vụ theo mẫu nhập (${ten}). Sửa trong Excel rồi nhập lại ở Giao việc → Nhập từ Excel.`);
  } catch (e) { notifyError('Không tạo được tệp theo mẫu: ' + e.message); }
}

export function mountNhapExcel() {
  $('gvKhuNhap').innerHTML = khungNhapHtml();
  $('gvKhuNhap').addEventListener('change', doiO);
  registerActions({
    nxNhap: nhap, nxTaiMau: () => taiMau(), klXuatMau: () => taiMau(dsDangHien()), nxLuuHoSo: luuHoSoAction, nxHoanTac: hoanTacLoAction,
    nxLoc: ({ loc }) => { nx.loc = loc; nx.soHien = 100; ve(`[data-action="nxLoc"][data-loc="${loc}"]`); }, nxXemThem: () => { nx.soHien += 100; ve('#nxNhap'); },
    nxHangLoat: () => {
      const k = $('nxHlTruong')?.value; const v = $('nxHlGt')?.value;
      if (!k || !v) { notifyError('Chọn trường và giá trị cần điền.'); return; }
      const nganh = (ma) => danhMucKl().linhVuc?.find((l) => l.ma === ma)?.nganh_ma;   // lĩnh vực: mỗi ngành một mục, chọn lại trong cùng ngành thì thay
      nx.hangLoat[k] = k === 'linh_vuc' ? [...[].concat(nx.hangLoat.linh_vuc || []).filter((x) => nganh(x) !== nganh(v)), v] : v;
      ve('#nxHlTruong');
    },
    nxBoHangLoat: ({ truong: k, giaTri }) => {
      const con = [].concat(nx.hangLoat[k] || []).filter((x) => x !== giaTri);
      if (Array.isArray(nx.hangLoat[k]) && con.length) nx.hangLoat[k] = con; else delete nx.hangLoat[k];
      ve('#nxHlTruong');
    },
    nxLamLai: () => { $('nxBuoc').innerHTML = ''; $('nxTenTep').textContent = 'Chọn tệp khác để nhập tiếp.'; },
  });
}
