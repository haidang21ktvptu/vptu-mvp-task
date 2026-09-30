// PR-2a (0048–0049, thiết kế B7 / §0.4 C) — Đối chiếu tập dòng: policy tập hợp mới (select id from <bảng>) phải TRÙNG KHỚP quy tắc gốc
// (rpc kl_tham_chieu_pham_vi: kl_pham_vi / kl_thay_nhiem_vu / thu_ky_tt_thay / tu_choi_thay) — hiệu đối xứng rỗng — cho 10 bảng/view.
// GỌN để chạy cả trên staging (bộ RLS ≤ 6 phút): tài khoản seed, mỗi vai một đại diện, một lời gọi tham chiếu trả cả 10 bảng.
// Tình huống: vai gốc (A0, CVP, PCVP phụ trách cả phòng, PCVP2, A2, A3 hai phòng, QTHT); kiêm nhiệm hết hạn hôm qua / hiệu lực tới hôm nay /
// bắt đầu ngày mai; thư ký bật; quan_tri_kl hết hạn hôm qua / còn hạn hôm nay. Ngày tính theo kl_hom_nay() của DB (giờ Việt Nam) nên đúng cả
// khung 17–24h UTC. Phép so nặng trên 1 400 việc (mọi tài khoản, mọi cột) chạy cục bộ: scripts/anh-chup-pham-vi.mjs, anh-chup-gia-tri.mjs.
// Khoá dữ liệu "KL-PQ-TD"; tự dọn, cờ khôi phục ở before lẫn after.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, userClient, assertOk, IDS, songSong } from './lib.mjs';
import { setupKlFixtures, klSchemaReady, linhVucReady } from './fixtures-kl.mjs';

const SKIP = (await klSchemaReady()) && (await linhVucReady()) ? false : 'Chưa có migration KL / dm_linh_vuc trên project này.';
const db = () => adminClient();
const KHOA = 'KL-PQ-TD';
const BANG = ['nhiem_vu', 'v_nhiem_vu', 'v_ngoai_le', 'van_ban_giao_viec', 'lich_su', 'chi_dao', 'minh_chung', 'canh_bao', 'dinh_chinh', 'tu_choi'];
const VIEC = ['nhiem_vu', 'v_nhiem_vu', 'van_ban_giao_viec', 'canh_bao'];   // tình huống kiêm nhiệm / quan_tri_kl
const THU_KY = ['nhiem_vu', 'van_ban_giao_viec', 'lich_su', 'chi_dao', 'minh_chung', 'canh_bao', 'dinh_chinh'];
let fx; let homNay; const id = {};
const cong = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Đọc đủ mọi trang (max_rows = 1000).
async function tatCa(taoTruyVan, label) {
  const kq = [];
  for (let i = 0; ; i += 1000) {
    const r = await taoTruyVan().range(i, i + 999);
    assertOk(r, label); kq.push(...r.data);
    if (r.data.length < 1000) return kq;
  }
}

async function doiChieu(username, bang = BANG) {
  const c = await userClient(username);
  // Tham chiếu + đọc từng bảng độc lập ⇒ songSong giới hạn 4 (D3, PR-2a: ít lượt khứ hồi trên staging).
  const [r, ...doc] = await songSong([() => c.rpc('kl_tham_chieu_pham_vi'), ...bang.map((b) => () => tatCa(() => c.from(b).select('id'), `${username} ${b}`))]);
  assertOk(r, `${username} tham chiếu`);   // mỗi bảng một dòng (bảng, mảng id)
  const goc = Object.fromEntries(r.data.map((x) => [x.bang, x.ids]));
  for (const [k, b] of bang.entries()) {
    const moi = new Set(doc[k].map((r) => String(r.id)));
    const cu = new Set(goc[b] || []);
    const chiMoi = [...moi].filter((x) => !cu.has(x)); const chiCu = [...cu].filter((x) => !moi.has(x));
    assert.deepEqual([chiMoi.length, chiCu.length], [0, 0],
      `${username} ${b}: policy mới ${moi.size} dòng, quy tắc gốc ${cu.size} — chỉ mới: ${chiMoi.slice(0, 3)} · chỉ gốc: ${chiCu.slice(0, 3)}`);
  }
}

const them = async (ma, row) => {
  const r = await db().from('nhiem_vu').insert({ van_ban_id: fx.hn, noi_dung: `${KHOA} ${ma}`, loai_thoi_han_ma: 'CO_HAN_CU_THE', han_xu_ly: '2026-12-31',
    theo_1400: true, ngay_nhan_van_ban: '2026-08-05', ngay_nhan_uoc_tinh: false, tao_boi: IDS.cvp, ...row }).select('id').single();
  assertOk(r, ma); id[ma] = r.data.id;
};
const kiemNhiem = async (tu, den) => {
  await db().from('phu_trach_phong').delete().like('ly_do', `${KHOA}%`);
  if (tu) assertOk(await db().from('phu_trach_phong').insert({ lanh_dao_id: IDS.pcvp2, phong: 'TONG_HOP', nganh_ma: 'KINH_TE_TONG_HOP',
    linh_vuc_ma: 'LV08_TAI_CHINH', tu_ngay: tu, den_ngay: den, ly_do: `${KHOA} kiêm nhiệm`, phan_cong_boi: IDS.qtht }), 'kiêm nhiệm');
};
const khoiPhuc = () => db().from('accounts').update({ thu_ky_thuong_truc: false, quan_tri_kl: false, quan_tri_kl_het_han: null }).eq('id', IDS.cv2);
const don = async () => {
  await db().from('nhiem_vu').delete().like('noi_dung', `${KHOA}%`);
  await db().from('phu_trach_phong').delete().like('ly_do', `${KHOA}%`);
  await khoiPhuc();
};

describe('PR-2a — policy tập hợp tương đương quy tắc gốc (hiệu đối xứng rỗng, 10 bảng/view)', { skip: SKIP }, () => {
  before(async () => {
    fx = await setupKlFixtures();
    await don();
    homNay = (await db().rpc('kl_hom_nay')).data;
    // Việc Tổng hợp đúng (ngành, lĩnh vực) kiêm nhiệm — Owner phòng + theo dõi Trưởng phòng; việc QUAN_TRI; việc có CHI_DAO_TT cho thư ký.
    await them('KN1', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong, nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH' });
    await them('KN2', { owner_don_vi_ma: 'TONG_HOP', owner_tai_khoan: IDS.cv1, nguoi_theo_doi: IDS.cv1, nganh_ma: 'KINH_TE_TONG_HOP', linh_vuc_ma: 'LV08_TAI_CHINH' });
    await them('QT1', { owner_don_vi_ma: 'QUAN_TRI', owner_tai_khoan: IDS.cv2, nguoi_theo_doi: IDS.cv2 });
    await them('TT1', { owner_don_vi_ma: 'TONG_HOP', nguoi_theo_doi: IDS.truongphong });
    assertOk(await (await userClient('demo_a0')).rpc('chi_dao_gui', { p: { nhiem_vu_id: id.TT1, loai: 'CHI_DAO_TT', noi_dung: `${KHOA} chỉ đạo TT` } }), 'A0 gửi CHI_DAO_TT');
  });
  after(don);

  test('1. Mọi vai seed (A0, CVP, PCVP, PCVP2, A2, A3 ×2, QTHT): 10 bảng/view trùng khớp quy tắc gốc', async () => {
    for (const u of ['demo_a0', 'demo_cvp', 'demo_pcvp', 'demo_pcvp2', 'demo_truongphong', 'demo_cv1', 'demo_cv2', 'demo_qtht']) await doiChieu(u);
  });

  test('2. Kiêm nhiệm PCVP2 (TONG_HOP, Tài chính): hết hạn hôm qua / hiệu lực tới hôm nay / bắt đầu ngày mai — PCVP và PCVP2 trùng khớp', async () => {
    for (const [tu, den] of [[cong(homNay, -30), cong(homNay, -1)], [cong(homNay, -30), homNay], [cong(homNay, 1), null]]) {
      await kiemNhiem(tu, den);
      for (const u of ['demo_pcvp', 'demo_pcvp2']) await doiChieu(u, VIEC);
    }
    await kiemNhiem(cong(homNay, -30), homNay);
    const thay = await (await userClient('demo_pcvp2')).from('nhiem_vu').select('id').eq('id', id.KN1);
    assert.equal(thay.data.length, 1, 'kiêm nhiệm hiệu lực tới hôm nay ⇒ PCVP2 thấy KN1 (không phụ trách cả phòng Tổng hợp)');
    const khong = await (await userClient('demo_pcvp')).from('nhiem_vu').select('id').eq('id', id.KN1);
    assert.equal(khong.data.length, 0, 'có người kiêm nhiệm ⇒ PCVP phụ trách cả phòng không còn thấy KN1');
    await kiemNhiem(null);
  });

  test('3. Thư ký Thường trực bật (A3 cv2): thấy thêm việc có CHI_DAO_TT ở nhiem_vu/lich_su/chi_dao/minh_chung, KHÔNG ở canh_bao/dinh_chinh', async () => {
    assertOk(await db().from('accounts').update({ thu_ky_thuong_truc: true }).eq('id', IDS.cv2), 'bật thư ký');
    await doiChieu('demo_cv2', THU_KY);
    const r = await (await userClient('demo_cv2')).from('nhiem_vu').select('id').eq('id', id.TT1);
    assert.equal(r.data.length, 1, 'thư ký thấy TT1');
    await khoiPhuc();
  });

  test('4. quan_tri_kl cấp tạm (A3 cv2): hết hạn hôm qua ⇒ phạm vi A3; còn hạn hôm nay ⇒ thấy tất cả — trùng khớp', async () => {
    for (const het of [cong(homNay, -1), homNay]) {
      assertOk(await db().from('accounts').update({ quan_tri_kl: true, quan_tri_kl_het_han: het }).eq('id', IDS.cv2), 'cấp quan_tri_kl');
      await doiChieu('demo_cv2', VIEC);
    }
    await khoiPhuc();
  });
});
