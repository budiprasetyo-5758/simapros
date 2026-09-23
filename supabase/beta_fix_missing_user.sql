-- ============================================================
-- BETA-ONLY: sinkronisasi user yang hilang dari snapshot import
--
-- Snapshot `import_data.sql` tidak konsisten: baris di projects
-- ('Verba'), unit_kerja_change_requests, dan notifications masih
-- mereferensikan user 1bd97ef7-4829-4bda-8fe2-2def028584a4 yang
-- tidak ikut terekspor ke auth.users (kemungkinan user sudah
-- dihapus di production setelah tabel-tabel lain diekspor).
-- Import berjalan dengan session_replication_role = replica sehingga
-- FK tidak diperiksa dan orphan lolos masuk; batch 7 gagal karena
-- orphan ini.
--
-- Solusi: sintesis user placeholder dengan UUID sama agar semua
-- referensi valid. Jangan dijalankan di production.
--
-- Jalankan SETELAH import_data.sql dan SEBELUM _batch7.
-- ============================================================

BEGIN;

SET session_replication_role = replica;

INSERT INTO auth.users (
  "instance_id", "id", "aud", "role", "email", "encrypted_password",
  "email_confirmed_at", "confirmation_token", "recovery_token",
  "email_change_token_new", "email_change", "phone_change",
  "phone_change_token", "email_change_token_current",
  "email_change_confirm_status", "reauthentication_token",
  "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at",
  "is_super_admin", "is_sso_user", "is_anonymous"
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '1bd97ef7-4829-4bda-8fe2-2def028584a4',
  'authenticated', 'authenticated',
  'orphan.user.1bd97ef7@beta.local',
  crypt('Simapros2026!', gen_salt('bf')),
  now(), '', '', '', '', '', '', '', 0, '',
  '{"provider":"email","providers":["email"]}',
  '{"name":"user (placeholder beta)"}',
  now(), now(), false, false, false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  "id", "user_id", "provider_id", "provider", "identity_data",
  "last_sign_in_at", "created_at", "updated_at"
) VALUES (
  gen_random_uuid(),
  '1bd97ef7-4829-4bda-8fe2-2def028584a4',
  '1bd97ef7-4829-4bda-8fe2-2def028584a4',
  'email',
  '{"sub":"1bd97ef7-4829-4bda-8fe2-2def028584a4","email":"orphan.user.1bd97ef7@beta.local","email_verified":true,"phone_verified":false}',
  NULL, now(), now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.profiles (
  "id", "name", "email", "created_at", "updated_at"
) VALUES (
  '1bd97ef7-4829-4bda-8fe2-2def028584a4',
  'user (placeholder beta)',
  'orphan.user.1bd97ef7@beta.local',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

SET session_replication_role = DEFAULT;

COMMIT;
