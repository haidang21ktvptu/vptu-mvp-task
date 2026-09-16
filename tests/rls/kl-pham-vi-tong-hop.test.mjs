// GĐ10 (PR 10B): phạm vi đọc v_kl_dashboard theo từng vai và bất biến tổng hợp — với MỖI tài khoản: tập dòng thấy được
// đúng bằng kỳ vọng tính từ accounts + phu_trach_phong (service_role, không ghi số cứng), tổng theo nhom_dem = số dòng,
// tổng theo lĩnh vực (kể cả NULL = "Chưa phân loại") = số dòng, mọi nhom_dem thuộc bộ tên đã biết. Chạy ở hai trạng thái:
// bảng kiêm nhiệm RỖNG (hiện trạng production) rồi có một kiêm nhiệm (mượn cách của rls-11), rồi kết thúc kiêm nhiệm.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { userClient, adminClient, assertOk, IDS } from './lib.mjs';
import { setupKlFixtures, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await linhVucReady()) ? false : 'Chưa có migration 0018–0019 trên project này (chạy lại sau khi merge).';
const NHOM = ['QUA_HAN', 'DANG_DINH_CHINH', 'SAP_DEN_HAN', 'CAN_DIEN_HAN', 'DANG_THUC_HIEN', 'CHO_DIEU_KIEN', 'THUONG_XUYEN', 'HOAN_THANH'];
const VAI = ['demo_cvp', 'demo_pcvp', 'demo_pcvp2', 'demo_truongphong', 'demo_cv1', 'demo_cv2', 'demo_qtht'];
const LY_DO = 'RLS-TEST TH';
const homNay = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); // hôm nay giờ VN, đủ cho so sánh ngày hiệu lực
let taiKhoan = new Map(); // id -> { username, role_group, department, is_chief, quan_tri_kl }

before(async () => {
  if (SKIP) return;
  await setupKlFixtures();
  const { data } = await adminClient().from('accounts').select('id, username, role_group, department, is_chief, quan_tri_kl');
  taiKhoan = new Map(data.map((a) => [a.id, a]));
});
after(async () => { if (!SKIP) await adminClient().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`); });

// Kỳ vọng tập id thấy được của một tài khoản, tính lại từ dữ liệu bằng service_role theo quyết định 7 + 5.4.
async function kyVong(username) {
  const me = [...taiKhoan.values()].find((a) => a.username === username);
  const db = adminClient();
  const { data: rows } = await db.from('nhiem_vu').select('id, nguoi_theo_doi, nganh_ma, linh_vuc_ma, owner_tai_khoan, owner_don_vi_ma');
  const { data: pc } = await db.from('phu_trach_phong').select('lanh_dao_id, phong, nganh_ma, linh_vuc_ma, tu_ngay, den_ngay');
  const { data: dv } = await db.from('dm_don_vi').select('ma, phong');
  const hieuLuc = (p) => p.tu_ngay <= homNay() && (!p.den_ngay || p.den_ngay >= homNay());
  const phongCua = (id) => taiKhoan.get(id)?.department;
  // 0025: phòng của Owner = phòng của tài khoản Owner, hoặc dòng phòng trong dm_don_vi; PCVP xét cả hai phòng như nhau.
  const phongOwner = (r) => (r.owner_tai_khoan ? phongCua(r.owner_tai_khoan) : dv.find((d) => d.ma === r.owner_don_vi_ma)?.phong) || null;
  const pcvpThay = (phong, r) => {
    if (!phong) return false;
    const kn = pc.find((p) => hieuLuc(p) && p.phong === phong && p.nganh_ma && p.nganh_ma === r.nganh_ma && p.linh_vuc_ma === r.linh_vuc_ma);
    if (kn) return kn.lanh_dao_id === me.id;
    return pc.some((p) => hieuLuc(p) && p.lanh_dao_id === me.id && p.phong === phong && !p.nganh_ma);
  };
  return new Set(rows.filter((r) => {
    if (me.quan_tri_kl || r.nguoi_theo_doi === me.id || r.owner_tai_khoan === me.id) return true;
    const phong = phongCua(r.nguoi_theo_doi);
    if (me.role_group === 'A2') return phong === me.department || phongOwner(r) === me.department;
    if (me.role_group !== 'A1') return false;
    if (me.is_chief) return true;
    return pcvpThay(phong, r) || pcvpThay(phongOwner(r), r);
  }).map((r) => r.id));
}

async function kiemMotVai(username, nhan) {
  const c = await userClient(username);
  const r = await c.from('v_nhiem_vu').select('id, nhom_dem, linh_vuc_ma, nganh_ma, nguoi_theo_doi');
  assertOk(r, `${username} đọc v_nhiem_vu`);
  const thay = new Set(r.data.map((x) => x.id));
  const mong = await kyVong(username);
  assert.deepEqual([...thay].sort(), [...mong].sort(), `${nhan}: ${username} thấy ${thay.size} dòng, kỳ vọng ${mong.size}`);
  const demNhom = {};
  const demLV = {};
  r.data.forEach((x) => {
    assert.ok(NHOM.includes(x.nhom_dem), `${username}: nhom_dem lạ "${x.nhom_dem}"`);
    demNhom[x.nhom_dem] = (demNhom[x.nhom_dem] || 0) + 1;
    const lv = x.linh_vuc_ma || 'CHUA_PHAN_LOAI';
    demLV[lv] = (demLV[lv] || 0) + 1;
  });
  assert.equal(Object.values(demNhom).reduce((a, b) => a + b, 0), r.data.length, `${username}: tổng các nhóm = tổng dòng`);
  assert.equal(Object.values(demLV).reduce((a, b) => a + b, 0), r.data.length, `${username}: tổng theo lĩnh vực (kể cả Chưa phân loại) = tổng dòng`);
  return { so: r.data.length, demNhom, demLV };
}

describe('KL phạm vi và bất biến tổng hợp theo vai', { skip: SKIP }, () => {
  test('kiêm nhiệm RỖNG (hiện trạng production): 7 vai, tập dòng = kỳ vọng, tổng nhóm = tổng dòng, lĩnh vực NULL không mất', async () => {
    await adminClient().from('phu_trach_phong').delete().like('ly_do', `${LY_DO}%`);
    const { data: kn } = await adminClient().from('phu_trach_phong').select('id').not('nganh_ma', 'is', null).is('den_ngay', null);
    assert.equal(kn.length, 0, 'seed không có kiêm nhiệm đang hiệu lực');
    const kq = {};
    for (const u of VAI) kq[u] = await kiemMotVai(u, 'rỗng');
    assert.ok(kq.demo_cvp.so >= kq.demo_truongphong.so && kq.demo_truongphong.so >= kq.demo_cv1.so, 'CVP ⊇ A2 ⊇ A3');
    assert.equal(kq.demo_pcvp.so, kq.demo_truongphong.so, 'PCVP cả phòng TONG_HOP = A2 TONG_HOP khi không kiêm nhiệm');
    assert.ok(kq.demo_cvp.demLV.CHUA_PHAN_LOAI >= 3, 'CVP thấy nhóm Chưa phân loại (N5–N7 fixture NULL)');
    assert.equal(kq.demo_cv1.demNhom.CAN_DIEN_HAN, undefined, 'cv1 không có N4 (của cv2)');
  });
  test('có kiêm nhiệm (pcvp2 ↔ TONG_HOP / ngành 8 / Tài chính): 7 vai vẫn đúng kỳ vọng và bất biến; PCVP phòng mất đúng các dòng bị kiêm nhiệm', async () => {
    const qtht = await userClient('demo_qtht');
    assertOk(await qtht.rpc('admin_kiem_nhiem_linh_vuc', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_nganh_ma: 'KINH_TE_TONG_HOP',
      p_linh_vuc_ma: ['LV08_TAI_CHINH'], p_bat: true, p_ly_do: LY_DO, p_tu_ngay: '2026-09-01' }), 'kiêm nhiệm');
    const truoc = await kiemMotVai('demo_pcvp', 'có kiêm nhiệm');
    for (const u of VAI.filter((x) => x !== 'demo_pcvp')) await kiemMotVai(u, 'có kiêm nhiệm');
    const pcvp2 = await kiemMotVai('demo_pcvp2', 'có kiêm nhiệm');
    assert.ok(pcvp2.demLV.LV08_TAI_CHINH >= 2, 'pcvp2 thấy N1, N3 (Tài chính) của TONG_HOP');
    assert.equal(truoc.demLV.LV08_TAI_CHINH, undefined, 'pcvp không còn dòng Tài chính của TONG_HOP');
    assertOk(await qtht.rpc('admin_kiem_nhiem_linh_vuc', { p_username: 'demo_pcvp2', p_phong: 'TONG_HOP', p_nganh_ma: 'KINH_TE_TONG_HOP',
      p_linh_vuc_ma: ['LV08_TAI_CHINH'], p_bat: false, p_ly_do: LY_DO }), 'kết thúc');
    const sau = await kiemMotVai('demo_pcvp', 'sau kết thúc');
    assert.ok(sau.demLV.LV08_TAI_CHINH >= 2, 'việc trở về PCVP phòng');
  });
  test('cột hiển thị của v_kl_dashboard đủ cho màn hình (tên chủ trì, phòng, tên danh mục, tuổi, chỉ đạo chờ)', async () => {
    const cv1 = await userClient('demo_cv1');
    const r = await cv1.from('v_kl_dashboard').select('ma, chu_tri_ten, chu_tri_phong, nganh_ten, co_quan_trinh_ten, loai_thoi_han_ten, linh_vuc_ten, tuoi_ngay, so_chi_dao_cho_phan_hoi, thieu_minh_chung, so_ngay_qua').eq('ma', 'NV-T01').single();
    assertOk(r, 'đọc N1');
    assert.equal(r.data.chu_tri_phong, 'TONG_HOP'); assert.equal(r.data.linh_vuc_ten, 'Tài chính');
    assert.equal(r.data.so_chi_dao_cho_phan_hoi, 1, 'D1 chờ phản hồi'); assert.ok(r.data.tuoi_ngay > 0); assert.ok(r.data.so_ngay_qua > 0);
  });
});
