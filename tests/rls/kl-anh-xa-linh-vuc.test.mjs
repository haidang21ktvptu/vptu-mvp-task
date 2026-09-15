// GĐ9 PR 9B — scripts/anh-xa-linh-vuc.mjs: (a) phần thuần chạy mọi đích — đề xuất không phân biệt hoa/thường/dấu,
// KHÔNG vượt ngành, không đoán khi chỉ "chứa tên", CSV đọc/ghi tròn; (b) tích hợp chỉ trên Supabase local (RLS_LOCAL=1):
// dry-run xuất bảng duyệt → --ghi với dòng chốt sai ngành bị dừng → --ghi đúng chỉ điền dòng có chốt, giữ NULL dòng
// trống, không đụng dòng đã có lĩnh vực, không đổi cap_nhat_luc, kl_lich_su có vết. Dữ liệu tạo trong hội nghị 999.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminClient, IDS } from './lib.mjs';
import { setupKlFixtures, linhVucReady } from './fixtures-kl.mjs';
import { chuanHoa, deXuat, docChot, docCsv, ghiCsv, gomNhom, taoBangDuyet, COT_CSV } from '../../scripts/kl/anh-xa-linh-vuc.mjs';

const LV = [
  { ma: 'LV08_TAI_CHINH', nganh_ma: 'KINH_TE_TONG_HOP', ten: 'Tài chính', thu_tu: 2 },
  { ma: 'LV08_DAU_TU', nganh_ma: 'KINH_TE_TONG_HOP', ten: 'Đầu tư', thu_tu: 3 },
  { ma: 'LV03_TU_PHAP', nganh_ma: 'NOI_CHINH', ten: 'Tư pháp', thu_tu: 3 },
];
const NGANH = [{ ma: 'KINH_TE_TONG_HOP', ten: '8. …', thu_tu: 8 }, { ma: 'NOI_CHINH', ten: '3. …', thu_tu: 3 }];

describe('anh-xa-linh-vuc — đề xuất và CSV (thuần)', () => {
  test('khớp không phân biệt hoa/thường/dấu/khoảng trắng/dấu câu; chỉ trong đúng ngành', () => {
    for (const v of ['Tài chính', ' tài  chính ', 'TAI CHINH', 'Tài chính.', 'Tai chinh']) assert.equal(deXuat(v, 'KINH_TE_TONG_HOP', LV).de_xuat?.ma, 'LV08_TAI_CHINH', v);
    assert.equal(deXuat('Tư pháp', 'KINH_TE_TONG_HOP', LV).de_xuat, null, 'Tư pháp thuộc ngành 3, dòng ngành 8 → trống');
    assert.equal(deXuat('Tư pháp', 'NOI_CHINH', LV).de_xuat?.ma, 'LV03_TU_PHAP');
    assert.equal(deXuat('Tài chính', null, LV).de_xuat, null, 'không có ngành → trống');
    assert.equal(chuanHoa('Đầu tư – ĐẦU TƯ'), 'dau tu dau tu');
  });
  test('"chứa tên" không đề xuất, chỉ gợi ý; không chứa → trống không gợi ý', () => {
    const r = deXuat('Tài chính Đảng', 'KINH_TE_TONG_HOP', LV);
    assert.equal(r.de_xuat, null); assert.deepEqual(r.goi_y, ['Tài chính']);
    assert.deepEqual(deXuat('Ngân hàng', 'KINH_TE_TONG_HOP', LV), { de_xuat: null, goi_y: [] });
    assert.deepEqual(deXuat('Tài chính công', 'KINH_TE_TONG_HOP', LV).goi_y, ['Tài chính']);
  });
  test('gomNhom + taoBangDuyet: gom theo (ngành, giá trị đã trim), đếm dòng, ghi chú đã có / không có ngành', () => {
    const nv = [
      { ma: 'A', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_chi_tiet: ' Tài chính ', linh_vuc_ma: null },
      { ma: 'B', nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_chi_tiet: 'Tài chính', linh_vuc_ma: 'LV08_DAU_TU' },
      { ma: 'C', nganh_ma: null, linh_vuc_chi_tiet: 'Tài chính', linh_vuc_ma: null },
      { ma: 'D', nganh_ma: 'NOI_CHINH', linh_vuc_chi_tiet: '', linh_vuc_ma: null },
    ];
    const bang = taoBangDuyet(gomNhom(nv), NGANH, LV);
    assert.equal(bang.length, 2);
    const r8 = bang.find((b) => b.nganh === 'KINH_TE_TONG_HOP');
    assert.equal(r8.so_dong, 2); assert.equal(r8.linh_vuc_de_xuat, 'Tài chính'); assert.match(r8.ghi_chu, /đã có: LV08_DAU_TU/);
    const r0 = bang.find((b) => b.nganh === '');
    assert.equal(r0.linh_vuc_de_xuat, ''); assert.match(r0.ghi_chu, /không có ngành/);
  });
  test('CSV: BOM + ";" + nháy kép đi tròn; đọc lại nhận cả ","; docChot nhận mã hoặc tên, chặn sai ngành', () => {
    const rows = [{ gia_tri_goc: 'A; "b"', nganh: 'KINH_TE_TONG_HOP', so_dong: 1, linh_vuc_de_xuat: '', linh_vuc_chot: 'tai chinh', ghi_chu: 'x\ny' }];
    const text = ghiCsv(rows);
    assert.ok(text.startsWith('﻿' + COT_CSV.join(';')));
    assert.deepEqual(docCsv(text), [{ ...rows[0], so_dong: '1' }]);
    assert.deepEqual(docCsv('gia_tri_goc,nganh,linh_vuc_chot\nX,NOI_CHINH,LV03_TU_PHAP\n'), [{ gia_tri_goc: 'X', nganh: 'NOI_CHINH', linh_vuc_chot: 'LV03_TU_PHAP' }]);
    const chot = docChot([
      { gia_tri_goc: 'a', nganh: 'KINH_TE_TONG_HOP', linh_vuc_chot: 'tai chinh' },
      { gia_tri_goc: 'b', nganh: 'KINH_TE_TONG_HOP', linh_vuc_chot: 'LV08_DAU_TU' },
      { gia_tri_goc: 'c', nganh: 'KINH_TE_TONG_HOP', linh_vuc_chot: '' },
      { gia_tri_goc: 'd', nganh: 'KINH_TE_TONG_HOP', linh_vuc_chot: 'Tư pháp' },
      { gia_tri_goc: 'e', nganh: '', linh_vuc_chot: 'Tài chính' },
    ], LV);
    assert.deepEqual(chot.cap_nhat.map((c) => [c.gia_tri_goc, c.linh_vuc_ma]), [['a', 'LV08_TAI_CHINH'], ['b', 'LV08_DAU_TU']]);
    assert.equal(chot.bo_qua, 1);
    assert.equal(chot.loi.length, 2); assert.match(chot.loi[0], /thuộc ngành NOI_CHINH/); assert.match(chot.loi[1], /không có ngành/);
  });
});

// Tích hợp: chỉ local (staging không có linh_vuc_chi_tiet và không được chạy script ghi trong CI staging).
const SKIP_TICH_HOP = process.env.RLS_LOCAL === '1' && (await linhVucReady()) ? false : 'Chỉ chạy trên Supabase local (RLS_LOCAL=1) sau migration 0018.';
const SCRIPT = fileURLToPath(new URL('../../scripts/anh-xa-linh-vuc.mjs', import.meta.url));
const chay = (args) => spawnSync(process.execPath, [SCRIPT, '--local', ...args], { encoding: 'utf8' });

describe('anh-xa-linh-vuc — chạy thật trên local', { skip: SKIP_TICH_HOP }, () => {
  let fx; let dir; const ma = ['NV-T10', 'NV-T11', 'NV-T12', 'NV-T13'];
  before(async () => {
    fx = await setupKlFixtures();
    dir = mkdtempSync(join(tmpdir(), 'anh-xa-'));
    const base = { hoi_nghi_id: fx.hn, chu_tri_id: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP', loai_thoi_han_ma: 'CHO_QUYET_DINH' };
    const r = await adminClient().from('kl_nhiem_vu').insert([
      { ...base, ma: ma[0], noi_dung: 'RLS-TEST AX1', linh_vuc_chi_tiet: ' Tài chính ' },
      { ...base, ma: ma[1], noi_dung: 'RLS-TEST AX2', linh_vuc_chi_tiet: 'TÀI CHÍNH' },   // khác cách viết → cặp khác, cùng đề xuất
      { ...base, ma: ma[2], noi_dung: 'RLS-TEST AX3', linh_vuc_chi_tiet: 'Đầu tư', linh_vuc_ma: 'LV08_NGAN_SACH' }, // đã có → bỏ qua
      { ...base, ma: ma[3], noi_dung: 'RLS-TEST AX4', linh_vuc_chi_tiet: 'Không rõ lắm' },
    ]).select('id');
    assert.equal(r.error, null, r.error?.message);
  });
  after(async () => {
    rmSync(dir, { recursive: true, force: true });
    await adminClient().from('kl_nhiem_vu').delete().in('ma', ma);   // lịch sử xoá theo CASCADE
  });

  test('dry-run xuất CSV: đề xuất đúng, dòng đã có ghi chú, dòng lạ để trống; không ghi gì', async () => {
    const csv = join(dir, 'duyet.csv');
    const r = chay(['--out', csv]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const rows = docCsv(readFileSync(csv, 'utf8'));
    const cua = (gt) => rows.find((x) => x.gia_tri_goc === gt && x.nganh === 'KINH_TE_TONG_HOP');
    assert.equal(cua('Tài chính').linh_vuc_de_xuat, 'Tài chính'); assert.equal(cua('Tài chính').so_dong, '1');
    assert.equal(cua('TÀI CHÍNH').linh_vuc_de_xuat, 'Tài chính');
    assert.equal(cua('Đầu tư').linh_vuc_de_xuat, 'Đầu tư'); assert.match(cua('Đầu tư').ghi_chu, /đã có: LV08_NGAN_SACH/);
    assert.equal(cua('Không rõ lắm').linh_vuc_de_xuat, '');
    const { data } = await adminClient().from('kl_nhiem_vu').select('ma, linh_vuc_ma').in('ma', ma).order('ma');
    assert.deepEqual(data.map((x) => x.linh_vuc_ma), [null, null, 'LV08_NGAN_SACH', null]);
  });

  test('--ghi: chốt sai ngành → dừng không ghi; chốt đúng → chỉ điền dòng có chốt, giữ NULL dòng trống, không đổi cap_nhat_luc, có lịch sử', async () => {
    const truoc = (await adminClient().from('kl_nhiem_vu').select('ma, cap_nhat_luc').in('ma', ma).order('ma')).data;
    const dong = (gt, chot) => ({ gia_tri_goc: gt, nganh: 'KINH_TE_TONG_HOP', so_dong: 1, linh_vuc_de_xuat: '', linh_vuc_chot: chot, ghi_chu: '' });
    const sai = join(dir, 'sai.csv');
    writeFileSync(sai, ghiCsv([dong('Tài chính', 'Tài chính'), dong('TÀI CHÍNH', 'Tư pháp')]), 'utf8');
    const r1 = chay(['--ghi', '--file', sai]);
    assert.equal(r1.status, 2, r1.stdout + r1.stderr); assert.match(r1.stdout, /thuộc ngành NOI_CHINH/);
    const giua = (await adminClient().from('kl_nhiem_vu').select('ma, linh_vuc_ma').in('ma', ma).order('ma')).data;
    assert.deepEqual(giua.map((x) => x.linh_vuc_ma), [null, null, 'LV08_NGAN_SACH', null], 'dừng thì không ghi gì');

    const dung = join(dir, 'dung.csv');
    writeFileSync(dung, ghiCsv([dong('Tài chính', 'LV08_TAI_CHINH'), dong('TÀI CHÍNH', 'tài chính'), dong('Đầu tư', 'Đầu tư'), dong('Không rõ lắm', '')]), 'utf8');
    const r2 = chay(['--ghi', '--file', dung]);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    const sau = (await adminClient().from('kl_nhiem_vu').select('ma, linh_vuc_ma, cap_nhat_luc').in('ma', ma).order('ma')).data;
    assert.deepEqual(sau.map((x) => x.linh_vuc_ma), ['LV08_TAI_CHINH', 'LV08_TAI_CHINH', 'LV08_NGAN_SACH', null]);
    assert.deepEqual(sau.map((x) => x.cap_nhat_luc), truoc.map((x) => x.cap_nhat_luc), 'cap_nhat_luc không đổi');
    const ids = (await adminClient().from('kl_nhiem_vu').select('id').in('ma', ma)).data.map((x) => x.id);
    const { data: ls } = await adminClient().from('kl_lich_su').select('cot, gia_tri_moi, nguoi_sua_ghi_chu').in('nhiem_vu_id', ids).eq('cot', 'linh_vuc_ma');
    assert.equal(ls.length, 2);
    assert.ok(ls.every((l) => l.gia_tri_moi === 'LV08_TAI_CHINH' && /anh-xa-linh-vuc/.test(l.nguoi_sua_ghi_chu)));
  });
});
