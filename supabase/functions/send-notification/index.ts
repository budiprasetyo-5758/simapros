import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'proposal_approved' | 'proposal_rejected' | 'proposal_revision' | 'deadline_warning' | 'task_overdue' | 'edit_request_approved' | 'edit_request_rejected' | 'no_progress_reminder' | 'pending_too_long' | 'monev_summary' | 'new_meeting' | 'meeting_reminder' | 'priority_decision_required' | 'priority_accepted' | 'priority_withdrawn';
  userId?: string;
  projectId?: string;
  projectTitle?: string;
  taskName?: string;
  daysRemaining?: number;
  adminNote?: string;
  sendEmail?: boolean;
  monevSummary?: string;
  pendingDays?: number;
  meetingTitle?: string;
  meetingDate?: string;
  meetingTime?: string;
  notifySuperAdmins?: boolean;
}

const getNotificationContent = (req: NotificationRequest) => {
  switch (req.type) {
    case 'proposal_approved':
      return {
        title: '🎉 Proposal Disetujui',
        message: `Proposal "${req.projectTitle}" telah disetujui dan siap untuk dieksekusi.`,
        emailSubject: `[Disetujui] Proposal: ${req.projectTitle}`,
        emailBody: `
          <h2>Selamat! Proposal Anda Disetujui</h2>
          <p>Proposal <strong>"${req.projectTitle}"</strong> telah disetujui oleh Super Admin.</p>
          ${req.adminNote ? `<p><strong>Catatan Admin:</strong> ${req.adminNote}</p>` : ''}
          <p>Proyek Anda sekarang dalam status aktif dan akan segera dieksekusi oleh tim.</p>
        `
      };
    case 'proposal_rejected':
      return {
        title: '❌ Proposal Ditolak',
        message: `Proposal "${req.projectTitle}" tidak disetujui.${req.adminNote ? ` Alasan: ${req.adminNote}` : ''}`,
        emailSubject: `[Ditolak] Proposal: ${req.projectTitle}`,
        emailBody: `
          <h2>Proposal Tidak Disetujui</h2>
          <p>Mohon maaf, proposal <strong>"${req.projectTitle}"</strong> tidak dapat disetujui.</p>
          ${req.adminNote ? `<p><strong>Alasan:</strong> ${req.adminNote}</p>` : ''}
          <p>Silakan hubungi admin untuk informasi lebih lanjut.</p>
        `
      };
    case 'proposal_revision':
      return {
        title: '📝 Proposal Perlu Revisi',
        message: `Proposal "${req.projectTitle}" memerlukan revisi.${req.adminNote ? ` Catatan: ${req.adminNote}` : ''}`,
        emailSubject: `[Perlu Revisi] Proposal: ${req.projectTitle}`,
        emailBody: `
          <h2>Proposal Memerlukan Revisi</h2>
          <p>Proposal <strong>"${req.projectTitle}"</strong> memerlukan beberapa perbaikan sebelum dapat disetujui.</p>
          ${req.adminNote ? `<p><strong>Catatan Revisi:</strong> ${req.adminNote}</p>` : ''}
          <p>Silakan login dan lakukan revisi yang diperlukan.</p>
        `
      };
    case 'priority_decision_required':
      return {
        title: '⏳ Keputusan Ditunda - Konfirmasi Jadwal',
        message: `Steering Committee menetapkan proposal "${req.projectTitle}" untuk ditunda. Tinjau jadwal tindak lanjut dan tentukan keputusan Anda.${req.adminNote ? ` Catatan: ${req.adminNote}` : ''}`,
        emailSubject: `[Butuh Keputusan] Proposal: ${req.projectTitle}`,
        emailBody: `
          <h2>Keputusan Proposal: Ditunda</h2>
          <p>Steering Committee menetapkan proposal <strong>"${req.projectTitle}"</strong> untuk ditunda pada periode berjalan.</p>
          <p>Silakan tinjau snapshot penilaian dan jadwal tindak lanjut yang telah diusulkan.</p>
          ${req.adminNote ? `<p><strong>Catatan Keputusan:</strong> ${req.adminNote}</p>` : ''}
          <p>Silakan login untuk meninjau jadwal yang diusulkan, lalu <strong>terima jadwal tersebut</strong> atau <strong>tarik pengajuan</strong>.</p>
        `
      };
    case 'priority_accepted':
      return {
        title: '✅ Jadwal Tindak Lanjut Diterima',
        message: `Pengaju menerima jadwal untuk "${req.projectTitle}". Proyek siap dikerjakan.`,
        emailSubject: `[Diterima Pengaju] ${req.projectTitle}`,
        emailBody: `
          <h2>Jadwal Tindak Lanjut Diterima</h2>
          <p>Pengaju telah menerima jadwal yang diusulkan untuk <strong>"${req.projectTitle}"</strong>.</p>
          <p>Proyek kini berstatus disetujui dan masuk antrean pengerjaan sesuai jadwal yang disepakati.</p>
        `
      };
    case 'priority_withdrawn':
      return {
        title: '🚪 Pengajuan Ditarik',
        message: `Pengaju menarik pengajuan "${req.projectTitle}" setelah keputusan penundaan.`,
        emailSubject: `[Ditarik] ${req.projectTitle}`,
        emailBody: `
          <h2>Pengajuan Ditarik Pengaju</h2>
          <p>Pengaju memilih untuk menarik pengajuan <strong>"${req.projectTitle}"</strong> setelah meninjau keputusan penundaan dan jadwal tindak lanjut.</p>
          <p>Tidak ada tindakan lanjutan yang diperlukan.</p>
        `
      };
    case 'deadline_warning':
      return {
        title: '⚠️ Deadline Mendekat',
        message: `Task "${req.taskName}" akan berakhir dalam ${req.daysRemaining} hari.`,
        emailSubject: `[Deadline ${req.daysRemaining} Hari] ${req.taskName}`,
        emailBody: `
          <h2>Peringatan Deadline</h2>
          <p>Task <strong>"${req.taskName}"</strong> pada proyek <strong>"${req.projectTitle}"</strong> akan berakhir dalam <strong>${req.daysRemaining} hari</strong>.</p>
          <p>Pastikan untuk menyelesaikan task ini tepat waktu dan mengupdate progress harian.</p>
        `
      };
    case 'task_overdue':
      return {
        title: '🚨 Task Melewati Deadline',
        message: `Task "${req.taskName}" telah melewati deadline!`,
        emailSubject: `[OVERDUE] ${req.taskName} - ${req.projectTitle}`,
        emailBody: `
          <h2 style="color: #dc2626;">Task Melewati Deadline!</h2>
          <p>Task <strong>"${req.taskName}"</strong> pada proyek <strong>"${req.projectTitle}"</strong> telah melewati deadline.</p>
          <p>Segera update progress dan selesaikan task ini, atau hubungi Super Admin jika ada kendala.</p>
        `
      };
    case 'edit_request_approved':
      return {
        title: '✅ Permintaan Edit Disetujui',
        message: `Permintaan edit untuk "${req.taskName || req.projectTitle}" telah disetujui.`,
        emailSubject: `[Disetujui] Permintaan Edit: ${req.taskName || req.projectTitle}`,
        emailBody: `
          <h2>Permintaan Edit Disetujui</h2>
          <p>Permintaan edit Anda untuk <strong>"${req.taskName || req.projectTitle}"</strong> telah disetujui oleh Super Admin.</p>
          ${req.adminNote ? `<p><strong>Catatan:</strong> ${req.adminNote}</p>` : ''}
          <p>Perubahan telah diterapkan ke sistem.</p>
        `
      };
    case 'edit_request_rejected':
      return {
        title: '❌ Permintaan Edit Ditolak',
        message: `Permintaan edit untuk "${req.taskName || req.projectTitle}" tidak disetujui.`,
        emailSubject: `[Ditolak] Permintaan Edit: ${req.taskName || req.projectTitle}`,
        emailBody: `
          <h2>Permintaan Edit Ditolak</h2>
          <p>Permintaan edit Anda untuk <strong>"${req.taskName || req.projectTitle}"</strong> tidak dapat disetujui.</p>
          ${req.adminNote ? `<p><strong>Alasan:</strong> ${req.adminNote}</p>` : ''}
        `
      };
    case 'no_progress_reminder':
      return {
        title: '⏳ Proyek Tanpa Progress',
        message: `Proyek "${req.projectTitle}" tidak ada progress selama 7 hari terakhir.`,
        emailSubject: `[Reminder] Proyek Tanpa Progress: ${req.projectTitle}`,
        emailBody: `
          <h2 style="color: #f59e0b;">⏳ Proyek Tanpa Progress</h2>
          <p>Proyek <strong>"${req.projectTitle}"</strong> tidak menunjukkan progress selama <strong>7 hari terakhir</strong>.</p>
          <p>Mohon segera tindak lanjuti proyek ini atau update progress melalui laporan harian.</p>
        `
      };
    case 'pending_too_long':
      return {
        title: '📋 Proyek Pending Terlalu Lama',
        message: `Proyek "${req.projectTitle}" sudah pending selama ${req.pendingDays} hari sejak pengajuan.`,
        emailSubject: `[Reminder] Proyek Pending: ${req.projectTitle} (${req.pendingDays} hari)`,
        emailBody: `
          <h2 style="color: #f59e0b;">📋 Proyek Pending Terlalu Lama</h2>
          <p>Proyek <strong>"${req.projectTitle}"</strong> telah dalam status pending selama <strong>${req.pendingDays} hari</strong> sejak diajukan.</p>
          <p>Mohon segera review dan berikan keputusan terhadap proyek ini.</p>
        `
      };
    case 'monev_summary':
      return {
        title: '📊 Rangkuman Monev Diperbarui',
        message: `Rangkuman monev untuk proyek "${req.projectTitle}" telah diperbarui.`,
        emailSubject: `[Monev] Rangkuman: ${req.projectTitle}`,
        emailBody: `
          <h2>📊 Rangkuman Monev Diperbarui</h2>
          <p>Rangkuman monitoring dan evaluasi untuk proyek <strong>"${req.projectTitle}"</strong> telah diperbarui.</p>
          ${req.monevSummary ? `
            <div style="margin-top: 15px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
              <h3 style="margin: 0 0 10px 0; color: #374151; font-size: 14px;">Rangkuman:</h3>
              <p style="margin: 0; color: #4b5563; font-size: 14px; white-space: pre-wrap;">${req.monevSummary}</p>
            </div>
          ` : ''}
          <p style="margin-top: 15px;">Silakan login untuk melihat detail lengkapnya.</p>
        `
      };
    case 'new_meeting':
      return {
        title: '📅 Meeting Baru Dijadwalkan',
        message: `Meeting "${req.meetingTitle}" dijadwalkan pada ${req.meetingDate}${req.meetingTime ? ` pukul ${req.meetingTime}` : ''}.`,
        emailSubject: `[Meeting Baru] ${req.meetingTitle}`,
        emailBody: `
          <h2>📅 Meeting Baru Dijadwalkan</h2>
          <p>Meeting <strong>"${req.meetingTitle}"</strong> telah dijadwalkan.</p>
          <p><strong>Tanggal:</strong> ${req.meetingDate}</p>
          ${req.meetingTime ? `<p><strong>Waktu:</strong> ${req.meetingTime}</p>` : ''}
          ${req.projectTitle ? `<p><strong>Project:</strong> ${req.projectTitle}</p>` : ''}
          <p>Silakan login untuk melihat detail meeting.</p>
        `
      };
    case 'meeting_reminder':
      return {
        title: '⏰ Reminder Meeting',
        message: `Meeting "${req.meetingTitle}" akan dilaksanakan ${req.daysRemaining === 0 ? 'hari ini' : `dalam ${req.daysRemaining} hari`}.`,
        emailSubject: `[Reminder] Meeting: ${req.meetingTitle}${req.daysRemaining === 0 ? ' - HARI INI' : ''}`,
        emailBody: `
          <h2>⏰ Reminder Meeting</h2>
          <p>Meeting <strong>"${req.meetingTitle}"</strong> akan dilaksanakan <strong>${req.daysRemaining === 0 ? 'hari ini' : `dalam ${req.daysRemaining} hari`}</strong>.</p>
          ${req.meetingTime ? `<p><strong>Waktu:</strong> ${req.meetingTime}</p>` : ''}
          ${req.projectTitle ? `<p><strong>Project:</strong> ${req.projectTitle}</p>` : ''}
          <p>Pastikan untuk mempersiapkan materi meeting yang diperlukan.</p>
        `
      };
    default:
      return {
        title: 'Notifikasi',
        message: 'Anda memiliki notifikasi baru.',
        emailSubject: 'Notifikasi Baru',
        emailBody: '<p>Anda memiliki notifikasi baru. Silakan login untuk melihat detailnya.</p>'
      };
  }
};

// Helper function to get Gmail address for a user (gmail field first, fallback to email)
const getUserGmail = async (supabase: any, userId: string): Promise<{ email: string | null; name: string | null }> => {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('gmail, email, name')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.error('Could not find user profile:', error);
    return { email: null, name: null };
  }

  const targetEmail = profile.gmail || profile.email;
  return { email: targetEmail, name: profile.name };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const notificationReq: NotificationRequest = await req.json();
    const content = getNotificationContent(notificationReq);

    // Handle super admin notifications (new_meeting, meeting_reminder)
    if (notificationReq.notifySuperAdmins) {
      // Get all super admin user IDs
      const { data: superAdminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      const superAdminIds = (superAdminRoles || []).map((r: any) => r.user_id);

      // Get project title if projectId provided
      let projectTitle = notificationReq.projectTitle;
      if (notificationReq.projectId && !projectTitle) {
        const { data: project } = await supabase
          .from('projects')
          .select('title')
          .eq('id', notificationReq.projectId)
          .single();
        projectTitle = project?.title || '';
      }

      // Update content with project title
      const updatedReq = { ...notificationReq, projectTitle };
      const updatedContent = getNotificationContent(updatedReq);

      for (const adminId of superAdminIds) {
        // In-app notification
        await supabase.from('notifications').insert({
          user_id: adminId,
          type: notificationReq.type,
          title: updatedContent.title,
          message: updatedContent.message,
          link: notificationReq.projectId ? `/project/${notificationReq.projectId}` : '/timeline',
          metadata: {
            projectId: notificationReq.projectId,
            meetingTitle: notificationReq.meetingTitle,
            meetingDate: notificationReq.meetingDate,
          },
        });

        // Email
        if (notificationReq.sendEmail) {
          const { email: targetEmail, name } = await getUserGmail(supabase, adminId);
          if (targetEmail) {
            try {
              await resend.emails.send({
                from: "SIMAPROS <noreply@simapros.my.id>",
                to: [targetEmail],
                subject: updatedContent.emailSubject,
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                      h2 { color: #1a56db; }
                      .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                    </style>
                  </head>
                  <body>
                    <p>Halo ${name || 'Super Admin'},</p>
                    ${updatedContent.emailBody}
                    <div class="footer">
                      <p>Email ini dikirim otomatis oleh SIMAPROS. Mohon tidak membalas email ini.</p>
                    </div>
                  </body>
                  </html>
                `,
              });
              console.log("Meeting notification email sent to:", targetEmail);
            } catch (emailError) {
              console.error("Error sending meeting email:", emailError);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, notifiedAdmins: superAdminIds.length }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Standard single-user notification
    if (!notificationReq.userId) {
      throw new Error('userId is required for single-user notifications');
    }

    // 1. Create in-app notification
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: notificationReq.userId,
        type: notificationReq.type,
        title: content.title,
        message: content.message,
        link: notificationReq.projectId ? `/project/${notificationReq.projectId}` : null,
        metadata: {
          projectId: notificationReq.projectId,
          projectTitle: notificationReq.projectTitle,
          taskName: notificationReq.taskName,
          adminNote: notificationReq.adminNote,
        }
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
      throw notifError;
    }

    // 2. Send email if requested
    if (notificationReq.sendEmail) {
      const { email: targetEmail, name } = await getUserGmail(supabase, notificationReq.userId);

      if (!targetEmail) {
        console.error('No email found for user:', notificationReq.userId);
      } else {
        try {
          const emailResponse = await resend.emails.send({
            from: "SIMAPROS <noreply@simapros.my.id>",
            to: [targetEmail],
            subject: content.emailSubject,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                  h2 { color: #1a56db; }
                  .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
                </style>
              </head>
              <body>
                <p>Halo ${name || 'User'},</p>
                ${content.emailBody}
                <div class="footer">
                  <p>Email ini dikirim otomatis oleh SIMAPROS. Mohon tidak membalas email ini.</p>
                </div>
              </body>
              </html>
            `,
          });
          console.log("Email sent successfully to Gmail:", targetEmail, emailResponse);
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
