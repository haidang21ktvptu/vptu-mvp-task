// Phần thuần (không I/O) của scripts/anh-xa-linh-vuc.mjs (GĐ9 PR 9B): chuẩn hoá chuỗi, đề xuất lĩnh vực trong
// đúng ngành, dựng bảng duyệt, đọc/ghi CSV, đọc cột "lĩnh vực chốt" và sinh SQL cập nhật. Test: tests/rls/kl-anh-xa-linh-vuc.
// Nguyên tắc: chỉ đề xuất khi BẰNG NHAU sau chuẩn hoá và lĩnh vực thuộc đúng ngành của dòng; "chứa tên" chỉ là gợi ý.

export const COT_CSV = ['gia_tri_goc', 'nganh', 'so_dong', 'linh_vuc_de_xuat', 'linh_vuc_chot', 'ghi_chu'];
export const GHI_CHU_LICH_SU = 'script anh-xa-linh-vuc (CSV đã duyệt)';
const BOM = String.fromCharCode(0xfeff); // đầu file CSV để Excel mở đúng UTF-8

// Bỏ dấu kết hợp U+0300–U+036F sau khi tách NFD (không dùng dải escape unicode trong regex — dễ bị công cụ sửa file làm hỏng).
const boDau = (s) => [...s.normalize('NFD')].filter((ch) => { const c = ch.charCodeAt(0); return c < 0x300 || c > 0x36f; }).join('');

// Bỏ dấu (kể cả đ), thường hoá, gộp khoảng trắng, bỏ dấu câu ở hai đầu: "Tài chính." ≡ "TAI CHINH" ≡ " tài  chính".
export function chuanHoa(s) {
  return boDau(String(s ?? '')).replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Đề xuất cho một giá trị tự do trong một ngành: { de_xuat: {ma, ten} | null, goi_y: [ten...] }.
// de_xuat chỉ khi đúng một lĩnh vực của ngành bằng giá trị sau chuẩn hoá; goi_y = lĩnh vực của ngành mà tên
// xuất hiện trọn vẹn (theo từ) trong giá trị — để người duyệt tự quyết, KHÔNG điền vào cột đề xuất.
export function deXuat(giaTri, nganhMa, linhVuc) {
  const gt = chuanHoa(giaTri);
  if (!gt || !nganhMa) return { de_xuat: null, goi_y: [] };
  const cuaNganh = linhVuc.filter((l) => l.nganh_ma === nganhMa);
  const bang = cuaNganh.filter((l) => chuanHoa(l.ten) === gt);
  if (bang.length === 1) return { de_xuat: { ma: bang[0].ma, ten: bang[0].ten }, goi_y: [] };
  const goiY = cuaNganh.filter((l) => {
    const t = chuanHoa(l.ten);
    return t && t !== gt && ` ${gt} `.includes(` ${t} `);
  }).map((l) => l.ten);
  return { de_xuat: null, goi_y: goiY };
}

// Gom nhiem_vu theo cặp (ngành, giá trị gốc đã cắt khoảng trắng; khoá "ngành|giá trị"); bỏ dòng không có linh_vuc_chi_tiet.
export function gomNhom(nhiemVu) {
  const map = new Map();
  for (const n of nhiemVu) {
    const gt = String(n.linh_vuc_chi_tiet ?? '').trim();
    if (!gt) continue;
    const key = `${n.nganh_ma ?? ''}|${gt}`;
    if (!map.has(key)) map.set(key, { gia_tri_goc: gt, nganh_ma: n.nganh_ma ?? null, so_dong: 0, ma_nv: [], da_co: new Set() });
    const g = map.get(key);
    g.so_dong += 1;
    g.ma_nv.push(n.ma);
    if (n.linh_vuc_ma) g.da_co.add(n.linh_vuc_ma);
  }
  return [...map.values()].sort((a, b) => (a.nganh_ma ?? 'zzz').localeCompare(b.nganh_ma ?? 'zzz') || a.gia_tri_goc.localeCompare(b.gia_tri_goc, 'vi'));
}

// Bảng duyệt (một dòng CSV mỗi cặp). nganh = mã ngành; đề xuất/chốt ghi TÊN lĩnh vực; ghi_chu cho người duyệt.
export function taoBangDuyet(nhom, nganh, linhVuc) {
  const tenNganh = (ma) => { const n = nganh.find((x) => x.ma === ma); return n ? `ngành ${n.thu_tu}` : ''; };
  return nhom.map((g) => {
    const { de_xuat, goi_y } = deXuat(g.gia_tri_goc, g.nganh_ma, linhVuc);
    const ghiChu = [];
    if (!g.nganh_ma) ghiChu.push('không có ngành — không thể ánh xạ');
    else ghiChu.push(tenNganh(g.nganh_ma));
    if (goi_y.length > 0) ghiChu.push(`gợi ý (chứa tên): ${goi_y.join(' / ')}`);
    if (g.da_co.size > 0) ghiChu.push(`đã có: ${[...g.da_co].join(', ')} (bỏ qua khi ghi)`);
    return { gia_tri_goc: g.gia_tri_goc, nganh: g.nganh_ma ?? '', so_dong: g.so_dong, linh_vuc_de_xuat: de_xuat?.ten ?? '', linh_vuc_chot: '', ghi_chu: ghiChu.join('; ') };
  });
}

// CSV: UTF-8 có BOM, phân cách ";" (Excel tiếng Việt), bọc nháy kép khi cần. Đọc lại nhận ";" hoặc "," theo dòng đầu.
const boc = (v) => { const s = String(v ?? ''); return /[";,\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function ghiCsv(rows, cols = COT_CSV) {
  return BOM + [cols.join(';'), ...rows.map((r) => cols.map((c) => boc(r[c])).join(';'))].join('\r\n') + '\r\n';
}

export function docCsv(text) {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const dauDong = src.split(/\r?\n/, 1)[0];
  const sep = (dauDong.match(/;/g) || []).length >= (dauDong.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let cell = ''; let trongNhay = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (trongNhay) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else trongNhay = false; } else cell += ch;
    } else if (ch === '"') trongNhay = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => Object.fromEntries(header.map((h, k) => [h.trim(), (r[k] ?? '').trim()])));
}

// Cột "lĩnh vực chốt": nhận mã hoặc tên (chuẩn hoá), phải thuộc đúng ngành của dòng. Trống = giữ NULL.
// Trả về { cap_nhat: [{gia_tri_goc, nganh_ma, linh_vuc_ma, ten}], bo_qua: n, loi: [chuỗi] }.
export function docChot(csvRows, linhVuc) {
  const capNhat = []; const loi = []; let boQua = 0;
  for (const r of csvRows) {
    const chot = (r.linh_vuc_chot || '').trim();
    if (!chot) { boQua += 1; continue; }
    if (!r.nganh) { loi.push(`"${r.gia_tri_goc}": không có ngành nên không thể chốt lĩnh vực.`); continue; }
    const lv = linhVuc.find((l) => l.nganh_ma === r.nganh && (l.ma === chot || chuanHoa(l.ten) === chuanHoa(chot)));
    if (!lv) {
      const khacNganh = linhVuc.find((l) => l.ma === chot || chuanHoa(l.ten) === chuanHoa(chot));
      loi.push(`"${r.gia_tri_goc}" (${r.nganh}): lĩnh vực chốt "${chot}" ${khacNganh ? `thuộc ngành ${khacNganh.nganh_ma}, không phải ${r.nganh}` : 'không có trong danh mục'}.`);
      continue;
    }
    capNhat.push({ gia_tri_goc: r.gia_tri_goc, nganh_ma: r.nganh, linh_vuc_ma: lv.ma, ten: lv.ten });
  }
  return { cap_nhat: capNhat, bo_qua: boQua, loi };
}

// Một khối DO (một statement = một transaction): tắt tạm trigger b_ (không đổi cap_nhat_luc/cap_nhat_boi của dòng),
// cập nhật đúng danh sách id đã in ở báo cáo "trước khi ghi" (vẫn kèm điều kiện linh_vuc_ma IS NULL); trigger lịch sử
// ghi từng dòng rồi được gắn ghi chú nguồn. Số dòng cập nhật phải bằng dự kiến và bằng số dòng lịch sử, không thì huỷ.
export function sqlCapNhat(dong) {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const values = dong.map((d) => `(${q(d.id)}::uuid, ${q(d.linh_vuc_ma)})`).join(',\n    ');
  return `DO $anh_xa_lv$
DECLARE v_n integer; v_ls integer;
BEGIN
  ALTER TABLE public.nhiem_vu DISABLE TRIGGER b_nhiem_vu_truoc_ghi;
  WITH a(id, linh_vuc_ma) AS (VALUES
    ${values})
  UPDATE public.nhiem_vu n SET linh_vuc_ma = a.linh_vuc_ma FROM a
  WHERE n.id = a.id AND n.linh_vuc_ma IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> ${dong.length} THEN
    RAISE EXCEPTION 'Cập nhật % dòng, dự kiến % — dữ liệu đã đổi kể từ báo cáo, huỷ.', v_n, ${dong.length};
  END IF;
  UPDATE public.lich_su SET nguoi_sua_ghi_chu = ${q(GHI_CHU_LICH_SU)}
  WHERE cot = 'linh_vuc_ma' AND nguoi_sua IS NULL AND nguon = 'app' AND luc = now();
  GET DIAGNOSTICS v_ls = ROW_COUNT;
  ALTER TABLE public.nhiem_vu ENABLE TRIGGER b_nhiem_vu_truoc_ghi;
  IF v_ls <> v_n THEN RAISE EXCEPTION 'Số dòng lịch sử (%) khác số dòng cập nhật (%) — huỷ.', v_ls, v_n; END IF;
END $anh_xa_lv$;
`;
}
