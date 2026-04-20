import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check meetings happening today or tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .in('meeting_date', [todayStr, tomorrowStr]);

    if (error) {
      console.error('Error fetching meetings:', error);
      throw error;
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No meetings to remind about' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let remindersCount = 0;

    for (const meeting of meetings) {
      const meetingDate = new Date(meeting.meeting_date);
      const diffDays = Math.round((meetingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, diffDays);

      // Get project title if exists
      let projectTitle = '';
      if (meeting.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('title')
          .eq('id', meeting.project_id)
          .single();
        projectTitle = project?.title || '';
      }

      // Send reminder to super admins via send-notification
      const notifPayload = {
        type: 'meeting_reminder',
        meetingTitle: meeting.title,
        meetingDate: meeting.meeting_date,
        meetingTime: meeting.meeting_time?.slice(0, 5),
        projectId: meeting.project_id,
        projectTitle,
        daysRemaining,
        notifySuperAdmins: true,
        sendEmail: true,
      };

      const notifUrl = `${supabaseUrl}/functions/v1/send-notification`;
      await fetch(notifUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(notifPayload),
      });

      remindersCount++;
    }

    return new Response(
      JSON.stringify({ success: true, remindersCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-meeting-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
