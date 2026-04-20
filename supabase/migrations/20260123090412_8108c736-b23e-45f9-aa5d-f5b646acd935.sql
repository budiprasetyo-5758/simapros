-- Create notification preferences table
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_proposal_approved BOOLEAN NOT NULL DEFAULT true,
  email_proposal_rejected BOOLEAN NOT NULL DEFAULT true,
  email_proposal_revision BOOLEAN NOT NULL DEFAULT true,
  email_deadline_warning BOOLEAN NOT NULL DEFAULT true,
  email_task_overdue BOOLEAN NOT NULL DEFAULT true,
  email_edit_request_approved BOOLEAN NOT NULL DEFAULT true,
  email_edit_request_rejected BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

-- Super admins can view all preferences
CREATE POLICY "Super admins can view all notification preferences"
ON public.notification_preferences
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();