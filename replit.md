# SIMAPROS — Sistem Manajemen Proyek Strategis

## Overview
SIMAPROS is a strategic project management system built with Vite + React + TypeScript. It uses Supabase as the backend for authentication, database, and edge functions. The app is a pure frontend SPA — there is no local server.

## Architecture

- **Frontend**: Vite + React 18 + TypeScript, hosted on Replit
- **Backend/Database**: Supabase (external, hosted at `ycbpxbqbzbyhuqqrnczp.supabase.co`)
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **AI/Email Edge Functions**: Deployed on Supabase (Deno runtime)
- **UI**: shadcn/ui + Tailwind CSS + Radix UI

## Development

```bash
npm run dev   # Start dev server on port 5000
npm run build # Build for production
```

## Key Environment Variables

Set in `.env` (for local dev) and as Replit Secrets (for production):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` — Supabase project ID

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
