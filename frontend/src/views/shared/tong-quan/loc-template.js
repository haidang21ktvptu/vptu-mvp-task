// Đợt C1 v3.19: thanh lọc Tổng quan (dưới hero; mọi khối tính trên dòng đã lọc), khối "Theo loại văn bản" (vòng tròn + 3 số, bấm một dòng =
// lọc theo loại) và khối "Theo lãnh đạo VP phụ trách" (A0 / Chánh VP). Chỉ dựng HTML từ số đã tính (lib/kl/tong-quan-them.js).
import { escapeHtml } from '../../../lib/dom.js';
import { tenLoaiVanBan } from '../kl/them-owner.js';
import { KHONG_VB, CHUA_LDVP, coLoc } from '../../../lib/kl/tong-quan-them.js';
import { mo, dauThe, pillCanh, thuoc } from './template.js';

const MAU = ['--f-tot', '--du-lieu', '--f-vang', '--f-nt', '--f-xs', '--f-dt', '--f-tre', '--chu-mo'];
export const tenLoai = (ma) => (ma === KHONG_VB ? 'Không có văn bản' : tenLoaiVanBan(ma));
const TEN_NGAN = { KL_BTV: 'Kết luận BTV', TB_THUONG_TRUC: 'Thông báo Thường trực', NQ_TW: 'Nghị quyết TW', CONG_VAN: 'Công văn', KHAC: 'Văn bản khác', [KHONG_VB]: 'Không có văn bản' };
const tenNgan = (ma) => TEN_NGAN[ma] || tenLoai(ma);
const opt = (o, chon) => `<option value="${escapeHtml(o.ma)}"${o.ma === chon ? ' selected' : ''}>${escapeHtml(o.ten)}${o.n === null ? '' : ` (${o.n})`}</option>`;
const oChon = (id, khoa, nhan, ds, chon, tatCa) => (ds.length ? `<label>${nhan}<select id="${id}" data-loc="${khoa}" aria-label="${nhan}"><option value="">${tatCa}</option>${ds.map((o) => opt(o, chon)).join('')}</select></label>` : '');

// tc: tuyChonLoc(); loc: tq.loc; hien: { phong, ldvp } — ô theo vai (phòng: A0/A1; lãnh đạo VP: A0/Chánh VP); phamViNhan: nhãn ô phạm vi theo vai.
export function thanhLocHtml(loc, tc, { phong = false, ldvp = false, phamViNhan = 'Việc tôi theo dõi hoặc giao' } = {}, soHien, soTong) {
  const chipLoai = tc.loai.map((o) => `<button type="button" data-action="tqLocLoai" data-loai="${escapeHtml(o.ma)}" aria-pressed="${String(loc.loai === o.ma)}" title="${escapeHtml(tenLoai(o.ma))}">${escapeHtml(tenNgan(o.ma))} <b>${o.n}</b></button>`).join('');
  return `<div class="tq-loc" id="tqLoc" role="group" aria-label="Lọc số liệu Tổng quan">
    <label>Phạm vi<select id="tqLocPhamVi" data-loc="phamVi" aria-label="Phạm vi"><option value="">Toàn bộ trong phạm vi</option><option value="toi"${loc.phamVi ? ' selected' : ''}>${escapeHtml(phamViNhan)}</option></select></label>
    ${phong ? oChon('tqLocPhong', 'phong', 'Phòng', tc.phong, loc.phong, 'Mọi phòng, đơn vị') : ''}
    ${oChon('tqLocCanBo', 'canBo', 'Cán bộ chủ trì', tc.canBo, loc.canBo, 'Mọi cán bộ')}
    ${oChon('tqLocDoKhan', 'doKhan', 'Độ khẩn', tc.doKhan, loc.doKhan, 'Mọi độ khẩn')}
    ${ldvp ? oChon('tqLocLdvp', 'ldvp', 'Lãnh đạo VP phụ trách', [...tc.ldvp, { ma: CHUA_LDVP, ten: 'Chưa có lãnh đạo phụ trách', n: null }], loc.ldvp, 'Mọi lãnh đạo') : ''}
    <button type="button" class="tq-loc-bo" data-action="tqLocBo" ${coLoc(loc) ? '' : 'disabled'}>Bỏ lọc</button>
    <div class="chip-loai" role="group" aria-label="Loại văn bản">${chipLoai}</div>
    <span class="tq-dang-loc" id="tqDangLoc">${coLoc(loc) ? `Đang lọc: <b>${soHien}</b> / ${soTong} nhiệm vụ — mọi khối bên dưới tính trên số đã lọc.` : `${soTong} nhiệm vụ trong phạm vi.`}</span></div>`;
}

export function loaiVanBanHtml(ds, locLoai) {
  const tong = ds.reduce((s, d) => s + d.tong, 0);
  let goc = 0;
  const doan = ds.map((d, i) => { const tu = goc; goc += (d.tong / (tong || 1)) * 360; return `var(${MAU[i % MAU.length]}) ${tu}deg ${goc}deg`; });
  const dong = (d, i) => `<tr><td><button type="button" class="ten-bam loai-nut" style="--mau:var(${MAU[i % MAU.length]})" data-action="tqLocLoai" data-loai="${escapeHtml(d.ma)}" aria-pressed="${String(locLoai === d.ma)}" title="Bấm để lọc toàn bộ Tổng quan theo loại này">${escapeHtml(tenLoai(d.ma))}</button>
      <small class="chu-phu">${d.xong} hoàn thành · ${d.dangMo} đang làm${d.canhBao ? ` · ${d.canhBao} cảnh báo` : ''}</small></td>
    <td class="so" data-n="Tổng"><button type="button" class="ten-bam" ${mo({ t: 'nhom', kh: 'loai', ma: d.ma, ten: tenLoai(d.ma) })}><b>${d.tong}</b><small>${d.tyLe}%</small></button></td></tr>`;
  return `<article class="the-bd n5" id="tqLoaiVanBan">${dauThe('Theo loại văn bản giao việc', 'Tổng, hoàn thành (mọi kỳ) và đang làm · bấm tên loại để lọc cả Tổng quan, bấm số để xem việc')}
    ${ds.length ? `<div class="loai-vb"><div class="vong" data-tong="${tong}" style="background:conic-gradient(${doan.join(', ')})" role="img" aria-label="${tong} nhiệm vụ theo loại văn bản"></div>
      <table><tbody>${ds.map(dong).join('')}</tbody></table></div>` : '<p class="trong">Chưa có nhiệm vụ trong phạm vi.</p>'}</article>`;
}

export function lanhDaoVpHtml(ds, k) {
  const dong = (d) => `<tr><td class="c-ten"><button type="button" class="ten-bam" ${mo({ t: 'nhom', kh: 'ldvp', ma: d.ma, ten: d.ten })}><b>${escapeHtml(d.ten)}</b><small><span class="chi-mt">${d.phong.length ? escapeHtml(d.phong.join(', ')) : d.ma === CHUA_LDVP ? 'ngoài phân công' : 'chỉ kiêm nhiệm'}</span><span class="chi-dt">${d.xong} hoàn thành, ${d.dangMo} đang làm</span></small></button></td>
    <td class="so" data-n="Tổng">${d.tong}</td><td class="so" data-n="Hoàn thành">${d.xong}</td><td class="so" data-n="Đang làm">${d.dangMo}</td>
    <td data-n="Cảnh báo"><span class="canh-tq">${pillCanh(d, 'ldvp')}</span></td><td data-n="Đúng hạn">${thuoc(d.tyLe)}</td></tr>`;
  return `<article class="the-bd n7" id="tqLanhDaoVp">${dauThe('Theo lãnh đạo Văn phòng phụ trách', `Theo phân công phụ trách phòng, kiêm nhiệm ngành / lĩnh vực đang hiệu lực · hoàn thành, đúng hạn tính ${k.trong}`)}
    ${ds.length ? `<div class="cuon-ngang"><table class="bang-tq"><thead><tr><th>Lãnh đạo · phòng phụ trách</th><th class="so">Tổng</th><th class="so">Hoàn thành</th><th class="so">Đang làm</th><th>Cảnh báo</th><th>Đúng hạn</th></tr></thead>
      <tbody>${ds.map(dong).join('')}</tbody></table></div>` : '<p class="trong">Chưa có phân công phụ trách hoặc chưa có nhiệm vụ.</p>'}</article>`;
}
