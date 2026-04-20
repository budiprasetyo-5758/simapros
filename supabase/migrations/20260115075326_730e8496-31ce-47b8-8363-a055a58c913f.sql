-- Migration 3: Add RLS policies for new tables and super_admin access

-- RLS policies for project_update_requests
CREATE POLICY "Admins can manage their update requests"
ON public.project_update_requests FOR ALL
USING (auth.uid() = requester_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Super admins can manage all update requests"
ON public.project_update_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Project owners can view update requests for their projects"
ON public.project_update_requests FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_requests.project_id 
    AND projects.requester_id = auth.uid()
));

-- RLS policies for project_update_logs
CREATE POLICY "Super admins can manage all update logs"
ON public.project_update_logs FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view update logs for their requests"
ON public.project_update_logs FOR SELECT
USING (auth.uid() = changed_by OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Project owners can view update logs"
ON public.project_update_logs FOR SELECT
USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_update_logs.project_id 
    AND projects.requester_id = auth.uid()
));

-- Super admin policies for projects
CREATE POLICY "Super admins can view all projects"
ON public.projects FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all projects"
ON public.projects FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete projects"
ON public.projects FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Super admin policies for other tables
CREATE POLICY "Super admins can manage all tasks"
ON public.gantt_tasks FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all task edit requests"
ON public.gantt_task_edit_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all edit requests"
ON public.project_edit_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage unit_kerja"
ON public.unit_kerja FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage unit_kerja_requests"
ON public.unit_kerja_requests FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage all collaborators"
ON public.project_collaborators FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));