// Bản ghi con cho dữ liệu tổng hợp (minh_chung, đóng việc, lich_su, chi_dao, canh_bao, tu_choi, dinh_chinh) + chốt mốc thời gian.
// Trung bình mỗi việc ≈ 1,5 minh chứng, 8 dòng lich_su (gồm dòng trigger), 0,5 chỉ đạo, 0,3 cảnh báo (thiết kế PR-2 mục B8).
// Mọi id/thời điểm xác định (xem sinh-du-lieu-tong-hop.mjs); id bigint đặt tường minh bằng OVERRIDING SYSTEM VALUE.
import { q } from '../../scripts/lib-cuc-bo.mjs';
import { rng, chon, khoang, uid, cong, luc } from './tien-ich.mjs';

const LICH_SU_0 = 900000000;
const CANH_BAO_0 = 900000000;
const COT_SUA = ['ghi_chu', 'van_ban_trien_khai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'tien_do_ma'];

const chunk = (head, rows, n = 500) => {
  const out = [];
  for (let i = 0; i < rows.length; i += n) out.push(`${head}\nVALUES ${rows.slice(i, i + n).join(',\n')};`);
  return out.join('\n');
};

export function sinhCon(ctx, viec) {
  const mc = []; const dong = []; const ls = []; const cd = []; const cb = []; const tc = []; const dc = [];
  let nMc = 0; let nLs = 0; let nCd = 0; let nCb = 0; let nTc = 0; let nDc = 0;
  const duyet = (v) => (v.phong ? ctx.a2[v.phong].id : ctx.cvp.id);
  const soHieu = (loai, v, hopLe, ngay, gio) => {
    const lyDo = hopLe === false ? q('Số hiệu chưa khớp văn bản (dữ liệu tổng hợp)') : 'NULL';
    const xn = hopLe === null ? 'NULL, NULL' : `${q(duyet(v))}, ${q(luc(ngay, '15:00'))}`;
    const coSo = loai === 'so_hieu';
    mc.push(`(${q(uid(4, ++nMc))}, ${q(v.id)}, ${q(loai)}, ${coSo ? q(`${nMc}/TH-VPTU`) : 'NULL'}, ${coSo ? q(ngay) : 'NULL'}, ${coSo ? "'BAN_THUONG_VU'" : 'NULL'}, `
      + `${loai === 'chu_cu' ? q(`Minh chứng chữ cũ ${v.ma}`) : 'NULL'}, ${loai === 'tep' ? q(`${v.theo_doi}/th-${nMc}.pdf`) : 'NULL'}, ${loai === 'tep' ? q(`th-${nMc}.pdf`) : 'NULL'}, `
      + `${q(v.theo_doi)}, ${q(luc(ngay, gio))}, ${hopLe === null ? 'NULL' : hopLe}, ${xn}, ${lyDo}, ${coSo ? q(`Trích yếu minh chứng ${v.ma}`) : 'NULL'}, ${coSo ? q('Kết quả thực hiện (dữ liệu tổng hợp)') : 'NULL'})`);
  };

  for (const v of viec) {
    const moc = v.ngay_ht ?? cong(v.bh, 20);
    // Minh chứng
    if (v.kind === 'dong' && !v.excel) {
      for (let k = khoang(0, 2); k > 0; k--) soHieu('so_hieu', v, false, cong(moc, -k * 3), '09:00');
      soHieu('so_hieu', v, true, cong(moc, -1), '10:00');
      if (rng() < 0.4) soHieu('tep', v, true, cong(moc, -1), '10:30');
      dong.push(`(${q(v.id)}::uuid, ${q(v.ngay_ht)}::date)`);
    } else if (v.excel) { if (rng() < 0.5) soHieu('chu_cu', v, null, moc, '09:00'); }
    else if (v.kind === 'mo') { const r = rng(); if (r < 0.35) soHieu('so_hieu', v, null, cong(v.bh, 12), '09:00'); else if (r < 0.55) soHieu('so_hieu', v, false, cong(v.bh, 12), '09:00'); }
    else if (rng() < 0.2) soHieu('chu_cu', v, null, cong(v.bh, 12), '09:00');
    // Lịch sử: xác nhận nhận việc + các lần sửa (dòng '*' và đóng việc do trigger sinh)
    if (!v.excel && rng() < 0.8) ls.push(`(${LICH_SU_0 + ++nLs}, ${q(v.id)}, ${q(luc(cong(v.bh, 4), '09:00'))}, ${q(v.theo_doi)}, 'xac_nhan_nhan_viec', NULL, 'true', 'app')`);
    for (let k = khoang(3, 7); k > 0; k--) {
      const cot = chon(COT_SUA);
      ls.push(`(${LICH_SU_0 + ++nLs}, ${q(v.id)}, ${q(luc(cong(v.bh, 4 + k), '14:00'))}, ${q(v.theo_doi)}, ${q(cot)}, ${q(`cũ ${k}`)}, ${q(`mới ${k}`)}, ${q(v.excel ? 'excel' : 'app')})`);
    }
    // Chỉ đạo (≈ 0,5 / việc, kể cả phản hồi)
    if (rng() < 0.38) {
      const tt = rng() < 0.15; const id = uid(5, ++nCd); const ngay = cong(v.bh, 15);
      const tth = v.kind === 'dong' ? chon(['DA_DONG', 'DA_PHAN_HOI']) : chon(['CHO_PHAN_HOI', 'CHO_PHAN_HOI', 'DA_PHAN_HOI']);
      const hanPh = rng() < 0.5 ? cong(ngay, 5) : cong('2030-06-01', nCd % 200);
      const nguoiGui = tt ? chon(ctx.a0).id : chon([ctx.cvp, ...ctx.pcvp, ctx.a2[v.phong]]).id;
      const loai = tt ? 'CHI_DAO_TT' : chon(['DON_DOC', 'Y_KIEN', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU']);
      const nhan = tt ? `ARRAY[${q(v.theo_doi)}]::uuid[]` : "'{}'::uuid[]";
      const daNhan = tt && rng() < 0.5 ? `ARRAY[${q(v.theo_doi)}]::uuid[]` : "'{}'::uuid[]";
      const dongBoi = tth === 'DA_DONG' ? `${q(nguoiGui)}, ${q(luc(cong(ngay, 7), '16:00'))}` : 'NULL, NULL';
      cd.push(`(${q(id)}, ${q(v.id)}, ${q(nguoiGui)}, ${q(loai)}, ${q(`Chỉ đạo tổng hợp ${v.ma}`)}, ${q(hanPh)}, ${q(tth)}, ${q(luc(ngay, '08:30'))}, NULL, ${nhan}, ${daNhan}, ${dongBoi})`);
      if (tth !== 'CHO_PHAN_HOI') cd.push(`(${q(uid(5, ++nCd))}, ${q(v.id)}, ${q(v.theo_doi)}, 'PHAN_HOI', ${q(`Phản hồi ${v.ma}`)}, NULL, 'DA_PHAN_HOI', ${q(luc(cong(ngay, 2), '10:00'))}, ${q(id)}, '{}'::uuid[], '{}'::uuid[], NULL, NULL)`);
    }
    // Cảnh báo (≈ 0,3 / việc)
    const qh = v.kind === 'mo' && v.han && v.han < '2027-01-01';
    const soCb = qh ? khoang(1, 2) : v.kind === 'dong' && rng() < 0.12 ? 1 : 0;
    for (let k = 0; k < soCb; k++) {
      const ngay = cong(v.han ?? moc, 1 + k * 3);
      cb.push(`(${CANH_BAO_0 + ++nCb}, ${q(v.id)}, ${q(qh ? (k ? 'DO_DAC_BIET' : 'DO') : 'VANG')}, ${q(ngay)}, ${q(luc(ngay, '07:00'))}, ARRAY[${q(v.theo_doi)}]::uuid[])`);
    }
    // Từ chối (≈ 2 % việc mở), đính chính (≈ 2 % việc đóng)
    if (v.kind !== 'dong' && rng() < 0.02) tc.push(`(${q(uid(6, ++nTc))}, ${q(v.id)}, ${q(v.theo_doi)}, ${q(duyet(v))}, 'Không thuộc chức năng phòng (dữ liệu tổng hợp)', 'CHO_DUYET', ${q(luc(cong(v.bh, 6), '09:00'))})`);
    if (v.kind === 'dong' && !v.excel && rng() < 0.02) dc.push(`(${q(uid(7, ++nDc))}, ${q(v.id)}, ${q(v.theo_doi)}, 'ngay_hoan_thanh', ${q(v.ngay_ht)}, ${q(cong(v.ngay_ht, -1))}, 'Ghi nhầm ngày (dữ liệu tổng hợp)', 'CHO_DUYET', ${q(luc(cong(v.ngay_ht, 2), '09:00'))})`);
  }

  const truocDong = chunk('INSERT INTO public.minh_chung (id, nhiem_vu_id, loai, so_hieu, ngay_van_ban, cap_nhan, noi_dung_chu, tep_path, tep_ten, nop_boi, nop_luc, hop_le, xac_nhan_boi, xac_nhan_luc, ly_do_khong_hop_le, trich_yeu, mo_ta_ket_qua)', mc);
  const sqlDong = `UPDATE public.nhiem_vu n SET tien_do_ma = 'HOAN_THANH', ngay_hoan_thanh = d.ngay FROM (VALUES ${dong.join(',\n')}) d(id, ngay) WHERE n.id = d.id;`;
  const ma = viec.map((v) => `(${q(v.id)}::uuid, ${q(v.tao_luc)}::timestamptz, ${q(v.ngay_ht ? luc(v.ngay_ht, '17:00') : null)}::timestamptz, ${q(v.theo_doi)}::uuid)`);
  const sauDong = [
    chunk('INSERT INTO public.lich_su (id, nhiem_vu_id, luc, nguoi_sua, cot, gia_tri_cu, gia_tri_moi, nguon) OVERRIDING SYSTEM VALUE', ls),
    cd.length ? chunk('INSERT INTO public.chi_dao (id, nhiem_vu_id, nguoi_gui, loai, noi_dung, han_phan_hoi, trang_thai, created_at, tra_loi_cho, nguoi_nhan, da_nhan, dong_boi, dong_luc)', cd) : '',
    cb.length ? chunk('INSERT INTO public.canh_bao (id, nhiem_vu_id, muc, ngay, gui_luc, nguoi_nhan) OVERRIDING SYSTEM VALUE', cb) : '',
    tc.length ? chunk('INSERT INTO public.tu_choi (id, nhiem_vu_id, nguoi_de_nghi, cap_duyet, ly_do, trang_thai, tao_luc)', tc) : '',
    dc.length ? chunk('INSERT INTO public.dinh_chinh (id, nhiem_vu_id, de_nghi_boi, cot, gia_tri_cu, gia_tri_moi, ly_do, trang_thai, created_at)', dc) : '',
    // Chốt mốc thời gian do trigger đặt bằng now(): cap_nhat_luc / dong_luc / lich_su.luc của dòng trigger.
    `CREATE TEMP TABLE th_moc (id uuid, tao timestamptz, dong timestamptz, nguoi uuid) ON COMMIT DROP;
INSERT INTO th_moc VALUES ${ma.join(',\n')};
ALTER TABLE public.nhiem_vu DISABLE TRIGGER USER;
UPDATE public.nhiem_vu n SET cap_nhat_luc = coalesce(m.dong, m.tao + interval '5 days'), cap_nhat_boi = m.nguoi,
  dong_luc = CASE WHEN n.tien_do_ma = 'HOAN_THANH' AND n.nguon = 'app' THEN m.dong ELSE n.dong_luc END FROM th_moc m WHERE n.id = m.id;
ALTER TABLE public.nhiem_vu ENABLE TRIGGER USER;
UPDATE public.lich_su l SET luc = CASE WHEN l.cot = '*' THEN m.tao ELSE coalesce(m.dong, m.tao) END FROM th_moc m WHERE l.nhiem_vu_id = m.id AND l.id < ${LICH_SU_0};`,
  ].join('\n');
  return { truocDong, dong: sqlDong, sauDong };
}
