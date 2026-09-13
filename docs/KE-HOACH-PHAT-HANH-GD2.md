# Kế hoạch phát hành Giai đoạn 2 — Supabase Auth lên production

Áp dụng cho project production `frwyxcmbonjaimziiuqr`. Quyết định của chủ dự án (2026-09-13): **giữ nguyên mật khẩu hiện có** (nạp vào Auth dạng băm bcrypt), `must_change_password = false` cho tất cả → người dùng đăng nhập như cũ, không phát mật khẩu tạm; phát hành **ngay sau khi QA staging không còn lỗi** (hệ thống đang là bản demo). Bước 1–6 do Claude Code chạy, bước 7 (merge) chủ dự án bấm.

## Nguyên tắc
- **PR-A** chỉ *thêm* (migration `0004`, `0005`, script, config, frontend). **PR-B** mới *xoá* (migration `0006`: cột `password`, hàm `verify_login`) — mở ngay sau khi bản live đã kiểm tra đăng nhập 3 vai trò.
- Trước khi PR-B áp lên production, đăng nhập cũ (`verify_login` + cột `password`) vẫn còn nguyên trong DB → quay lui chỉ cần đưa frontend cũ lên lại.
- Chỉ chạy lệnh khi `supabase/.temp/project-ref` đúng project; luôn `supabase config diff` và trình diff trước `config push`.

## Thứ tự thực hiện (backup → migration → config → nạp Auth → merge → kiểm tra live)
| Bước | Lệnh / việc | Kiểm tra sau bước | Ảnh hưởng người dùng |
|---|---|---|---|
| 1. Backup | `supabase db dump --project-ref frwyxcmbonjaimziiuqr -f <ngoài git>/prod-<ngày>-schema.sql` và `--data-only -f <ngoài git>/prod-<ngày>-data.sql` (pg_dump; bản data còn cột `password`; giữ ≥ 7 ngày) | 2 file tồn tại, data có `INSERT INTO "public"."accounts"` | Không |
| 2. Migration | `git checkout feature/gd2-supabase-auth` → `supabase link --project-ref frwyxcmbonjaimziiuqr` → `supabase db push --dry-run` (chỉ `0004`, `0005`) → `supabase db push` | REST: `rpc/verify_login` vẫn 200; `accounts_public` có cột `must_change_password` | Không (chỉ thêm) |
| 3. Config Auth | `supabase config diff` → trình diff (chỉ được có: `enable_signup`, `minimum_password_length`, `password_requirements`, `site_url` = `https://haidang21ktvptu.github.io/vptu-mvp-task`, `additional_redirect_urls`, MFA/OTP tắt, `enable_confirmations`) → `supabase config push` | `POST /auth/v1/signup` trả `signup_disabled` | Không |
| 4. Nạp 49 tài khoản vào Auth | `cd scripts && node create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --dry-run` rồi bỏ `--dry-run` | Console "Tạo mới: 49"; `supabase db query --linked "select count(*) from auth.users"` = số `accounts`; REST đăng nhập thử 1 tài khoản mỗi vai trò bằng mật khẩu hiện có | Không (app cũ chưa dùng Auth) |
| 5. Kiểm tra cờ | `supabase db query --linked "select count(*) from accounts where must_change_password"` = 0 | — | — |
| 6. Link lại staging | `supabase link --project-ref vojmrjezspdftovzinek` | `cat supabase/.temp/project-ref` = staging | — |
| 7. **Merge PR-A** (chủ dự án) | Bấm Merge trên GitHub (ruleset: CI xanh) → GitHub Pages deploy ~1–2 phút | — | Người dùng đăng nhập như cũ (mật khẩu không đổi) |
| 8. Kiểm tra bản live | Mở `https://haidang21ktvptu.github.io/vptu-mvp-task/`: đăng nhập 3 vai trò (A1, A2, A3) bằng mật khẩu hiện có → vào đúng view; F5 giữ phiên; đăng xuất | Không lỗi console; ghi `CHANGELOG.md` | — |
| 9. PR-B (ngay sau bước 8) | Nhánh `feature/gd2-don-dep`: migration `0006` (`DROP FUNCTION verify_login`, `ALTER TABLE accounts DROP COLUMN password`), `supabase/seed.sql` bỏ cột `password`; áp staging → CI → duyệt → merge → `db push` production | `rpc/verify_login` 404; `accounts.password` không còn | Không |

## Quay lui (trước bước 9)
| Tình huống | Cách quay lui | Thời gian |
|---|---|---|
| Đăng nhập lỗi hàng loạt sau bước 7 | **R1**: PR `git revert -m 1 <merge-commit PR-A>` → merge → Pages deploy lại bản cũ; `verify_login` + cột `password` còn nguyên nên đăng nhập cũ chạy ngay. | ≈ 5 phút |
| Cần xoá tài khoản Auth đã tạo | **R2**: `node create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --rollback` (xoá 49 `auth.users`, `accounts` giữ nguyên). | ≈ 2 phút |
| Cần bỏ schema 0004/0005 | **R3**: không cần — chỉ thêm cột/bảng/hàm. Nếu bắt buộc: migration mới để xoá (không sửa migration đã commit). | — |

**Sau bước 9 (đã xoá cột `password`)**: quay lui phải khôi phục dữ liệu `accounts` từ backup bước 1 sau khi tạo lại cột — coi đây là **điểm không quay lui nhanh**.

## Sau phát hành — theo dõi tuần đầu
- Giới hạn IP của Supabase (30 lượt/5 phút/IP, gói Free): cả cơ quan chung IP nên giờ cao điểm có thể bị chặn oan (giao diện báo "vui lòng chờ 5 phút"). Theo dõi Supabase Dashboard → Auth → Logs (`over_request_rate_limit`) trong tuần đầu; nếu xảy ra, cân nhắc nâng `sign_in_sign_ups` hoặc lên gói Pro sớm hơn GĐ7.
- Bật bắt buộc đổi mật khẩu (khi chủ dự án quyết, sau 7 giai đoạn): `supabase db query --linked "SELECT public.admin_set_must_change_password();"`.
