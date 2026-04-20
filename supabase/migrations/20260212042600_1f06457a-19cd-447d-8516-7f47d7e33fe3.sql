
-- Create meetings table
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  meeting_date date NOT NULL,
  meeting_time time NOT NULL DEFAULT '09:00',
  description text NOT NULL DEFAULT '',
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all meetings" ON public.meetings FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can view all meetings" ON public.meetings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own meetings" ON public.meetings FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own meetings" ON public.meetings FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own meetings" ON public.meetings FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create project_documents table
CREATE TABLE public.project_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  document_name text NOT NULL,
  document_url text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all documents" ON public.project_documents FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can manage all documents" ON public.project_documents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Project owners can view documents" ON public.project_documents FOR SELECT USING (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Assigned users can view documents" ON public.project_documents FOR SELECT USING (is_assigned_to_project(auth.uid(), project_id));
CREATE POLICY "Project owners can manage documents" ON public.project_documents FOR INSERT WITH CHECK (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Project owners can update documents" ON public.project_documents FOR UPDATE USING (is_project_owner(auth.uid(), project_id));
CREATE POLICY "Project owners can delete documents" ON public.project_documents FOR DELETE USING (is_project_owner(auth.uid(), project_id));

CREATE TRIGGER update_project_documents_updated_at BEFORE UPDATE ON public.project_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create meeting-attachments storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-attachments', 'meeting-attachments', true);

CREATE POLICY "Anyone can view meeting attachments" ON storage.objects FOR SELECT USING (bucket_id = 'meeting-attachments');
CREATE POLICY "Authenticated users can upload meeting attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own meeting attachments" ON storage.objects FOR UPDATE USING (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own meeting attachments" ON storage.objects FOR DELETE USING (bucket_id = 'meeting-attachments' AND auth.role() = 'authenticated');
