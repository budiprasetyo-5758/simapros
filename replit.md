# SIMAPROS — Sistem Manajemen Proyek Strategis

## Overview
SIMAPROS is a strategic project management system built with Vite + React + TypeScript. It uses Supabase as the backend for authentication, database, and edge functions. The app is a pure frontend SPA — there is no local server.

## Architecture

- **Frontend**: Vite + React 18 + TypeScript, hosted on Replit
- **Backend/Database**: Supabase (external, hosted at `vqvhwicknmaccgxvunww.supabase.co`)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **AI/Email Edge Functions**: Deployed on Supabase (Deno runtime)
- **UI**: shadcn/ui + Tailwind CSS + Radix UI

## Development

```bash
npm run dev       # Dev server (env production via .env) di port 3000
npm run dev:beta  # Dev server (env beta via .env.beta) di port 3000
npm run build     # Build untuk production
```

## Key Environment Variables

Set in `.env` (for local dev) and as Replit Secrets (for production):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

## Lingkungan Beta

Project Supabase beta untuk testing fungsional: `blitdxwxaztjaujxfrfe` (region sama dengan production: Sydney). Jalankan `npm run dev:beta` — Vite memuat `.env.beta` (jangan di-commit; sudah dicakup `.gitignore`).

- Password semua akun hasil import snapshot: `Simapros2026!`
- Email eksternal tidak terkirim (`RESEND_API_KEY` dummy) — notifikasi in-app tetap jalan
- Tombol Google, `sync-google-calendar`, dan OTP `verify-gmail` error (limitasi disengaja)
- Free tier menjeda project idle ±7 hari — buka dashboard beta berkala selama fase testing

### Setup ulang database beta dari nol

Urutan eksekusi di SQL Editor (atau via helper di bawah), database harus fresh:

1. `supabase/combined_migration.sql` — satu eksekusi penuh
2. `supabase/import_data.sql` — satu transaksi (data snapshot production)
3. `supabase/beta_fix_missing_user.sql` — placeholder untuk user yang hilang dari snapshot (ada baris projects/notifications yang memreferensikannya; tanpa fix ini `_batch7` gagal FK)
4. `supabase/_batch6_priority_gate.sql` — BAGIAN 1 (ALTER TYPE) dieksekusi terpisah dulu (commit), baru sisanya
5. `supabase/_batch7_effort_quadrant.sql` → `supabase/_batch8_tier2_priority_assessment.sql` → `supabase/_batch9_sop2026_priority.sql`

Helper terminal: `BETA_DB_PW=<password> node supabase/.temp/run-sql.mjs <file.sql>` atau `-q "<sql>"` — mengeksekusi ke beta via session pooler IPv4 (host `aws-0-ap-southeast-2.pooler.supabase.com`, user `postgres.blitdxwxaztjaujxfrfe`).

### Workflow beta-first

1. Perubahan SQL: buat file baru `_batchN_<nama>.sql` (lanjutkan penomoran, append-only) → apply ke beta → smoke test via `npm run dev:beta` → baru apply ke production.
2. Perubahan edge function: deploy ke beta dulu, uji, baru ke production. **Selalu pakai `--project-ref` eksplisit** — `supabase/config.toml` menunjuk production (`vqvhwicknmaccgxvunww`); tanpa flag, perintah CLI mengenai production.
3. Data beta adalah snapshot statis (makin lama makin beda dari production) — cukup untuk uji fungsional/skema, bukan uji angka/beban terkini.

Catatan status (2026-09-14): production **belum** menerima batch 6–9 (belum ada tabel `project_priority_assessments`, RPC SOP 2026, maupun kolom prioritas batch 6/7 di production). Beta menerapkannya pertama kali; saat siap, terapkan batch 6–9 ke production mengikuti workflow beta-first di atas.

## Project Structure

```
src/
  App.tsx                    — Root app with routing
  pages/                     — Page-level components (one per route)
  components/                — Reusable UI components
  hooks/                     — Custom React hooks (useAuth, useProjects, etc.)
  integrations/supabase/     — Supabase client + generated TypeScript types
  types/                     — Shared TypeScript type definitions
  lib/                       — Utility functions

supabase/
  functions/                 — Edge functions deployed to Supabase (Deno)
  migrations/                — Database migration history (already applied)
```

## User Roles

- `super_admin` — Full access, approves proposals, manages users
- `project_executor` — Can submit proposals and daily progress reports
- `admin` — Legacy role, treated as project_executor
- `user` — Default new user role

## Supabase Edge Functions

All edge functions are deployed on Supabase and called via `supabase.functions.invoke()`:

- `calculate-task-progress` — AI-powered task progress calculation (uses OpenAI-compatible gateway)
- `generate-weekly-report` — Weekly project report generation with streaming
- `generate-task-suggestions` — AI task breakdown suggestions
- `generate-monev-summary` — Monitoring & evaluation summary generation
- `send-notification` — In-app + email notification sender (Resend)
- `send-project-notification` — Project status email notifications
- `send-welcome-email` — Welcome emails for new users
- `check-deadlines` — Scheduled check for approaching task deadlines
- `check-reminders` — Scheduled reminder checks for inactive projects
- `sync-google-calendar` — Sync project dates to Google Calendar
- `verify-gmail` — Gmail verification with OTP codes

## Penilaian Prioritas Proyek (SOP/HTO/001/2026)

Metode aktif: `HTO-SOP-2026.1` — Tahap 1 mandatory (3 pertanyaan YES/NO, satu YES = Priority 0), Tahap 2 pembobotan K1–K5 skala 1–10 (bobot 20/20/25/20/15), gate finansial pada K3 ≤ 3, dan checklist kelengkapan 8 butir yang **tidak** mem-veto.

Kalkulator hanya menghasilkan `mandatory`, `queued`, atau `gated`. Penundaan dan penolakan selalu keputusan manusia dengan `override_reason` wajib — SOP 5.3 melarang HTO menolak langsung usulan yang belum jelas. Urutan Master Queue memakai Total Skor Akhir (`score_percent`), bukan Priority Index.

Berkas kunci:
- `src/lib/sopPriority2026.ts` — rubrik, pertanyaan probing, kalkulasi, validasi
- `src/types/sopPriority2026.ts` — tipe metode SOP
- `src/lib/priorityAssessmentView.ts` — pembaca snapshot untuk tampilan; skala dibaca dari `method_snapshot` tiap baris, bukan konstanta frontend
- `src/components/project/SopMandatoryGateSelector.tsx` — Tahap 1
- `src/components/project/SopPriorityScoringSelector.tsx` — Tahap 2 + sesi probing + checklist
- `src/pages/MasterQueue.tsx` (`/master-queue`, super_admin) — 3 lane: mandatory / queued / gated
- `src/lib/priorityScoring.ts` — metode lama `HTO-T2-1.0`, kini hanya renderer snapshot lama + registry label bersama

Database: `supabase/_batch9_sop2026_priority.sql` (butuh batch 6–8), petunjuk penerapan di `supabase/APPLY_SOP2026_PRIORITY.md`. RPC aktif `record_sop2026_priority_assessment` mengizinkan penilaian ulang; `record_tier2_priority_assessment` sudah dicabut hak EXECUTE-nya.

Ritme mingguan SOP Bab 9 (probing Sen–Rab, rapat Kamis, publikasi Jumat) dijalankan manual oleh HTO di luar sistem — tidak ada objek siklus, penguncian, atau publikasi terjadwal. Konsekuensinya sistem menyimpan riwayat per proyek (rantai `revision_no`), bukan foto antrean pada suatu Jumat.

## Follow Up Feature (super_admin only)

Routes:
- `/follow-up` — Main page with 3 folder cards (Rapimtas, Rapim, Others)
- `/follow-up/:category` — Category page with 3 tabs: Meetings, Task Meeting, File Repository

Key files:
- `src/hooks/useFollowUp.tsx` — Data hooks (useFollowUpMeetings, useFollowUpTasks, useFollowUpFiles)
- `src/pages/FollowUp.tsx` — Folder cards page
- `src/pages/FollowUpCategory.tsx` — Category page with 3-tab layout:
  - Meetings tab: meeting cards (read-only task list), add meeting dialog (date, conditional title, tasks with PIC+due date, notulensi+pendukung file uploads)
  - Task Meeting tab: sortable data table with task completion checkbox
  - File Repository tab: sub-tabs for Notulensi and Pendukung files

Database tables (Supabase): `followup_meetings`, `followup_tasks`, `followup_files`
Storage bucket: `followup-attachments`
Migrations:
- `supabase/migrations/20260316043600_followup_feature.sql` (v1 — superseded)
- `supabase/migrations/20260316070000_followup_v2.sql` (v2 — current, drops v1 and recreates)
Schema v2 changes: meeting_date (date) added, title nullable, tasks have pic + due_date (no sort_order), files use file_category (notulensi/pendukung) instead of file_type, no task_id FK on files

## Migration Notes (Lovable → Replit)

- Removed `@lovable.dev/cloud-auth-js` package and `lovable-tagger` devDependency
- Replaced Lovable Google OAuth with native `supabase.auth.signInWithOAuth`
- Updated Vite config: port 5000, host `0.0.0.0`, removed lovable-tagger plugin
- Removed `src/integrations/lovable/` directory
- Fixed `sync-google-calendar` edge function to use `APP_URL` env var instead of hardcoded lovable.app URL
