import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email diperlukan" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userName = name || "User";

    await resend.emails.send({
      from: "SIMAPROS <noreply@simapros.my.id>",
      to: [email.toLowerCase().trim()],
      subject: "🎉 Selamat Datang di SIMAPROS!",
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Selamat Datang di SIMAPROS!</h1>
          </div>
          <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Halo <strong>${userName}</strong>,</p>
            <p>Terima kasih telah mendaftar di <strong>SIMAPROS</strong> (Sistem Manajemen Proyek Strategis).</p>
            <p>Dengan SIMAPROS, Anda dapat:</p>
            <ul style="color: #4b5563; font-size: 14px; line-height: 1.8;">
              <li>📋 Mengajukan dan mengelola proyek strategis</li>
              <li>📊 Memantau progres dengan Gantt Chart</li>
              <li>🤖 Mendapatkan evaluasi AI (Monev)</li>
              <li>🔔 Menerima notifikasi & reminder otomatis</li>
            </ul>
            <p style="color: #6b7280; font-size: 14px;">Langkah selanjutnya: lengkapi profil Anda dan mulai kelola proyek!</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">Email otomatis dari SIMAPROS. Mohon tidak membalas email ini.</p>
          </div>
        </body>
        </html>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-welcome-email:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
