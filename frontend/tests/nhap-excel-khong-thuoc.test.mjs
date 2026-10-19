// Unit test nhập Excel v3.26 (0116 — mục cố định "Không thuộc" của danh mục): dòng ghi mục tiêu "Không thuộc" cùng mục khác thì giữ mục thật (như
// trigger kl_dong_nhap_gan_muc_tieu); Kết luận BTV / Thông báo Thường trực ghi ngành "Không thuộc" → chờ hoàn thiện, báo ngay ở bản xem trước (DB cũng
// chặn — trigger 0116); công văn nhận ngành "Không thuộc". Dữ liệu hư cấu (fixtures-nhap.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chuanGiaTri } from '../src/lib/kl/nhap/chuan-hoa.js';
import { danhGia } from '../src/lib/kl/nhap/danh-gia.js';
import { chuanDong } from '../src/lib/kl/nhap/bang.js';
import { DM, CTX, DG, DU } from './fixtures-nhap.mjs';
test('v3.26 (0116): "Không thuộc" — Kết luận / Thông báo không nhận ngành "Không thuộc" (chờ hoàn thiện); mục tiêu "Không thuộc" ghi cùng mục khác thì bỏ', () => {
  const dmKt = { ...DM, nganh: [...DM.nganh, { ma: 'KHONG_THUOC', ten: 'Không thuộc ngành, lĩnh vực nào' }],
    linhVuc: [...DM.linhVuc, { ma: 'LV99_KHONG_THUOC', ten: 'Không thuộc lĩnh vực nào', nganh_ma: 'KHONG_THUOC' }],
    mucTieu: [...DM.mucTieu, { ma: 'KHONG_THUOC', nhom: 'KHONG_THUOC', ten: 'Không thuộc mục tiêu then chốt nào', ten_ngan: 'Không thuộc mục tiêu then chốt', dang_dung: true }] };
  const ctx = { ...CTX, dm: dmKt };
  const mt = chuanGiaTri('mucTieu', 'Không thuộc mục tiêu then chốt; Nghị quyết 57-NQ/TW', ctx);
  assert.deepEqual(mt.ma, ['NQ_57']); assert.match(mt.hien, /bỏ: "Không thuộc" ghi cùng mục khác/); assert.equal(mt.gan, 'gan_dung');
  assert.deepEqual(chuanGiaTri('mucTieu', 'Không thuộc mục tiêu then chốt', ctx).ma, ['KHONG_THUOC']);
  const dg = { ...DG, dm: dmKt }; const dongKt = (raw) => chuanDong({ soDong: 7, raw, goc: {} }, ctx);
  const kt = { nganh: 'Không thuộc ngành, lĩnh vực nào', linh_vuc: 'Không thuộc lĩnh vực nào' };
  const kl = danhGia(dongKt({ ...DU, ...kt }), dg);
  assert.equal(kl.ket_qua, 'CHO_HOAN_THIEN'); assert.ok(kl.thieu.includes('nganh'));
  assert.ok(kl.canhBao.some((c) => c.includes('không chọn "Không thuộc"')), 'báo ngay ở bản xem trước (DB cũng chặn)');
  const cv = danhGia(dongKt({ ...DU, ...kt, so_hoi_nghi: undefined, so_ket_luan: '15/CV-VPTU' }), dg);
  assert.equal(cv.gt.loai_van_ban, 'CONG_VAN'); assert.equal(cv.ket_qua, 'GIAO'); assert.equal(cv.du_lieu.nganh_ma, 'KHONG_THUOC');
});
