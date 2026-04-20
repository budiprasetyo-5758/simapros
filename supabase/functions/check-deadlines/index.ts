import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function checks for upcoming deadlines (H-7) and overdue tasks
// Should be called daily via cron job or manually
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

    // Get all user reminder preferences to find the maximum reminder days
    const { data: allPrefs } = await supabase
      .from('notification_preferences')
      .select('user_id, reminder_days_before_deadline');

    // Build a map of user_id -> reminder_days (default 7)
    const userReminderDays: Record<string, number> = {};
    const defaultReminderDays = 7;
    let maxReminderDays = defaultReminderDays;

    for (const pref of allPrefs || []) {
      const days = pref.reminder_days_before_deadline ?? defaultReminderDays;
      userReminderDays[pref.user_id] = days;
      if (days > maxReminderDays) maxReminderDays = days;
    }

    // Use the max reminder days to query tasks (so we capture all possible upcoming deadlines)
    const maxDaysFromNow = new Date(today);
    maxDaysFromNow.setDate(maxDaysFromNow.getDate() + maxReminderDays);

    // Get all active tasks with upcoming deadlines or overdue
    const { data: tasks, error: tasksError } = await supabase
      .from('gantt_tasks')
      .select(`
        id,
        name,
        end_date,
        progress,
        status,
        project_id,
        projects!inner (
          id,
          title,
          status,
          requester_id
        )
      `)
      .neq('status', 'completed')
      .lte('end_date', maxDaysFromNow.toISOString().split('T')[0]);

    if (tasksError) throw tasksError;

    // Get all project executors (to notify them about deadlines)
    const { data: executors, error: executorsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'project_executor');

    if (executorsError) throw executorsError;

    // Get all super admins
    const { data: superAdmins, error: superAdminsError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (superAdminsError) throw superAdminsError;

    const executorIds = executors?.map(e => e.user_id) || [];
    const superAdminIds = superAdmins?.map(s => s.user_id) || [];
    const allRecipients = [...new Set([...executorIds, ...superAdminIds])];

    let notificationsSent = 0;

    for (const task of tasks || []) {
      const project = (task as any).projects;
      if (!project || project.status !== 'approved') continue;

      const endDate = new Date(task.end_date);
      endDate.setHours(0, 0, 0, 0);
      
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = daysRemaining < 0;

      if (!isOverdue && daysRemaining > maxReminderDays) continue;

      // For each recipient, check their personal reminder threshold
      const recipientsForThisTask = allRecipients.filter(userId => {
        if (isOverdue) return true; // always notify overdue
        const userDays = userReminderDays[userId] ?? defaultReminderDays;
        return daysRemaining <= userDays;
      });

      if (recipientsForThisTask.length === 0) continue;

      // Create notifications per eligible user
      const notifications = recipientsForThisTask.map(userId => {
        const userDays = userReminderDays[userId] ?? defaultReminderDays;
        return {
          user_id: userId,
          type: isOverdue ? 'task_overdue' : 'deadline_warning',
          title: isOverdue ? '🚨 Task Melewati Deadline' : '⚠️ Deadline Mendekat (H-' + daysRemaining + ')',
          message: isOverdue
            ? `Task "${task.name}" pada proyek "${project.title}" telah melewati deadline!`
            : `Task "${task.name}" akan berakhir dalam ${daysRemaining} hari.`,
          link: `/project/${project.id}`,
          metadata: {
            taskId: task.id,
            taskName: task.name,
            projectId: project.id,
            projectTitle: project.title,
            daysRemaining,
            progress: task.progress,
          }
        };
      });

      // Check if notification already sent today for this task
      const todayStr = today.toISOString().split('T')[0];
      const { data: existingNotifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', isOverdue ? 'task_overdue' : 'deadline_warning')
        .gte('created_at', todayStr)
        .contains('metadata', { taskId: task.id });

      if (existingNotifs && existingNotifs.length > 0) {
        console.log(`Notification already sent today for task ${task.id}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
      } else {
        notificationsSent += notifications.length;
      }

      // Send email to Gmail for both overdue and warning
      for (const userId of recipientsForThisTask) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: isOverdue ? 'task_overdue' : 'deadline_warning',
              userId,
              projectId: project.id,
              projectTitle: project.title,
              taskName: task.name,
              daysRemaining,
              sendEmail: true,
            },
          });
        } catch (emailError) {
          console.error('Error sending deadline email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Checked ${tasks?.length || 0} tasks, sent ${notificationsSent} notifications` 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-deadlines function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
