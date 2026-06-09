-- Tambahkan kolom google_calendar_event_id ke tabel meetings
ALTER TABLE public.meetings
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
