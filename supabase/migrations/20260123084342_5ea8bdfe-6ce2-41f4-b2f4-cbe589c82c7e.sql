-- Create storage bucket for daily report attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('daily-report-attachments', 'daily-report-attachments', true);

-- Add attachment column to daily_reports table
ALTER TABLE public.daily_reports ADD COLUMN attachment_url TEXT;

-- Storage policies for daily report attachments
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'daily-report-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'daily-report-attachments');

CREATE POLICY "Users can update their own attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'daily-report-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'daily-report-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);