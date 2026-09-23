import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function checks for:
// 1. Projects with no progress for 7 days
// 2. Projects pending too long (customizable per project, default 30 days)
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Get all super admins
    const { data: superAdmins } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    const superAdminIds = superAdmins?.map(s => s.user_id) || [];

    let remindersSent = 0;

    // ===== 1. Check projects with no progress =====
    // Get all approved/active projects
    const { data: activeProjects } = await supabase
      .from('projects')
      .select('id, title, requester_id')
      .in('status', ['approved', 'active']);

    // Get all user notification preferences for no-progress reminder days
    const { data: allPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, reminder_days_no_progress');

    const userNoProgressDays: Record<string, number> = {};
    for (const pref of allPrefs || []) {
      userNoProgressDays[pref.user_id] = pref.reminder_days_no_progress ?? 7;
    }

    for (const project of activeProjects || []) {
      // Determine the minimum no-progress threshold among all recipients
      const recipients = [...new Set([...superAdminIds, project.requester_id])];
      const minDays = Math.min(...recipients.map(uid => userNoProgressDays[uid] ?? 7));

      const cutoffDate = new Date(today);
      cutoffDate.setDate(cutoffDate.getDate() - minDays);
      const cutoffStr = cutoffDate.toISOString();

      // Check if there are any daily reports since the cutoff
      const { data: recentReports } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('project_id', project.id)
        .gte('created_at', cutoffStr)
        .limit(1);

      if (recentReports && recentReports.length > 0) continue;

      // Check if there were any task updates since the cutoff
      const { data: recentTaskUpdates } = await supabase
        .from('gantt_tasks')
        .select('id')
        .eq('project_id', project.id)
        .gte('created_at', cutoffStr)
        .limit(1);

      if (recentTaskUpdates && recentTaskUpdates.length > 0) continue;

      // Check if reminder already sent today
      const { data: existingReminder } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'no_progress_reminder')
        .gte('created_at', todayStr)
        .contains('metadata', { projectId: project.id })
        .limit(1);

      if (existingReminder && existingReminder.length > 0) continue;

      // Send reminder per recipient, respecting each user's threshold
      for (const userId of recipients) {
        const userDays = userNoProgressDays[userId] ?? 7;
        const userCutoff = new Date(today);
        userCutoff.setDate(userCutoff.getDate() - userDays);

        // Only send if the project truly has no progress for this user's threshold
        const { data: userReports } = await supabase
          .from('daily_reports')
          .select('id')
          .eq('project_id', project.id)
          .gte('created_at', userCutoff.toISOString())
          .limit(1);

        if (userReports && userReports.length > 0) continue;

        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'no_progress_reminder',
              userId,
              projectId: project.id,
              projectTitle: project.title,
              noProgressDays: userDays,
              sendEmail: true,
            },
          });
          remindersSent++;
        } catch (error) {
          console.error('Error sending no-progress reminder:', error);
        }
      }
    }

    // ===== 2. Check projects pending too long =====
    const { data: pendingProjects } = await supabase
      .from('projects')
      .select('id, title, requester_id, created_at, pending_reminder_days')
      .in('status', ['pending', 'pending_creation']);

    for (const project of pendingProjects || []) {
      const createdAt = new Date(project.created_at);
      const daysSinceCreation = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const reminderThreshold = project.pending_reminder_days || 30;

      if (daysSinceCreation < reminderThreshold) continue;

      // Check if reminder already sent today
      const { data: existingReminder } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'pending_too_long')
        .gte('created_at', todayStr)
        .contains('metadata', { projectId: project.id })
        .limit(1);

      if (existingReminder && existingReminder.length > 0) continue;

      // Send to super admins and project requester
      const recipients = [...new Set([...superAdminIds, project.requester_id])];

      for (const userId of recipients) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'pending_too_long',
              userId,
              projectId: project.id,
              projectTitle: project.title,
              pendingDays: daysSinceCreation,
              sendEmail: true,
            },
          });
          remindersSent++;
        } catch (error) {
          console.error('Error sending pending reminder:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${remindersSent} reminders` 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-reminders function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
