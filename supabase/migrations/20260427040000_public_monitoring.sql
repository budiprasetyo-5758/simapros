-- ============================================================
-- Migration: Public Monitoring Dashboard
-- Enables read-only project monitoring via shareable links.
-- ============================================================

-- 1. Table: monitoring_links
CREATE TABLE IF NOT EXISTS public.monitoring_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS for monitoring_links
ALTER TABLE public.monitoring_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_validate_monitoring_link"
  ON public.monitoring_links
  FOR SELECT TO anon
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "super_admin_manage_monitoring_links"
  ON public.monitoring_links
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- 3. Allow anon to read approved/active projects (read-only monitoring)
CREATE POLICY "anon_read_approved_projects"
  ON public.projects
  FOR SELECT TO anon
  USING (status IN ('approved', 'active'));

-- 4. Allow anon to read gantt_tasks for approved/active projects
CREATE POLICY "anon_read_gantt_tasks"
  ON public.gantt_tasks
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND status IN ('approved', 'active')
    )
  );

-- 5. Allow anon to read master_proyek (for category filter)
CREATE POLICY "anon_read_master_proyek"
  ON public.master_proyek
  FOR SELECT TO anon
  USING (true);
