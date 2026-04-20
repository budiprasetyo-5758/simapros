ALTER TABLE public.notification_preferences 
ADD COLUMN reminder_days_no_progress integer NOT NULL DEFAULT 7;