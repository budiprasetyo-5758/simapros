
-- Create storage bucket for deliverable attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('deliverable-attachments', 'deliverable-attachments', true);

-- Create policies for deliverable attachment uploads
CREATE POLICY "Anyone can view deliverable attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'deliverable-attachments');

CREATE POLICY "Authenticated users can upload deliverable attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own deliverable attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own deliverable attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'deliverable-attachments' AND auth.role() = 'authenticated');
