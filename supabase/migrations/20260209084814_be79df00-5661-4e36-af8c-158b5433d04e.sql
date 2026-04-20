
-- Add customizable reminder days for deadline warning
ALTER TABLE public.notification_preferences
ADD COLUMN reminder_days_before_deadline integer NOT NULL DEFAULT 7;
