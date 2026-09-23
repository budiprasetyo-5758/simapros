import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientEmail?: string;
  recipientName?: string;
  userId?: string;
  projectTitle: string;
  status: "approved" | "revision" | "rejected";
  adminNote?: string;
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "approved": return "Disetujui";
    case "revision": return "Perlu Revisi";
    case "rejected": return "Ditolak";
    default: return status;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "approved": return "#22c55e";
    case "revision": return "#f59e0b";
    case "rejected": return "#ef4444";
    default: return "#6b7280";
  }
};

const getEmailSubject = (status: string, projectTitle: string): string => {
  switch (status) {
    case "approved": return `✅ Proyek "${projectTitle}" Telah Disetujui`;
    case "revision": return `📝 Proyek "${projectTitle}" Memerlukan Revisi`;
    case "rejected": return `❌ Proyek "${projectTitle}" Ditolak`;
    default: return `Update Status Proyek "${projectTitle}"`;
  }
};

// Helper: resolve Gmail address from userId
const resolveGmail = async (supabase: any, userId?: string, fallbackEmail?: string, fallbackName?: string) => {
  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gmail, email, name')
      .eq('id', userId)
      .single();

    if (profile) {
      return {
        email: profile.gmail || profile.email || fallbackEmail,
        name: profile.name || fallbackName || 'User',
      };
    }
  }
  return { email: fallbackEmail, name: fallbackName || 'User' };
};

const handler = async (req: Request): Promise<Response> => {
  console.log("Received request to send-project-notification");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      recipientEmail,
      recipientName,
      userId,
      projectTitle,
      status,
      adminNote,
    }: NotificationRequest = await req.json();

    // Resolve Gmail: prioritize userId lookup, fallback to provided email
    const resolved = await resolveGmail(supabase, userId, recipientEmail, recipientName);
    const targetEmail = resolved.email;
    const targetName = resolved.name;

    if (!targetEmail) {
      console.error("No email found for notification");
      return new Response(
        JSON.stringify({ error: "No email found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending notification to ${targetEmail} for project "${projectTitle}" with status "${status}"`);

    const statusLabel = getStatusLabel(status);
    const statusColor = getStatusColor(status);
    const subject = getEmailSubject(status, projectTitle);

    const adminNoteSection = adminNote
      ? `
        <div style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">Catatan Admin:</h3>
          <p style="margin: 0; color: #4b5563; font-size: 14px;">${adminNote}</p>
        </div>
      `
      : "";

    const emailResponse = await resend.emails.send({
      from: "SIMAPROS <noreply@simapros.my.id>",
      to: [targetEmail],
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Update Status Proyek</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin-top: 0;">Halo <strong>${targetName}</strong>,</p>
            
            <p>Status proyek Anda telah diperbarui:</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Nama Proyek:</td>
                  <td style="padding: 8px 0; font-weight: 600;">${projectTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Status Baru:</td>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; padding: 4px 12px; background-color: ${statusColor}; color: white; border-radius: 20px; font-size: 13px; font-weight: 500;">
                      ${statusLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            ${adminNoteSection}
            
            <p style="margin-top: 25px; color: #6b7280; font-size: 14px;">
              Silakan login ke SIMAPROS untuk melihat detail lebih lanjut.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0; text-align: center;">
              Email ini dikirim secara otomatis oleh SIMAPROS. Mohon tidak membalas email ini.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-project-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
