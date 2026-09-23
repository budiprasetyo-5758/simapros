import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { action, gmail, code } = await req.json();

    if (action === "send") {
      // Validate gmail
      if (!gmail || !gmail.toLowerCase().trim().endsWith("@gmail.com")) {
        return new Response(
          JSON.stringify({ error: "Hanya alamat @gmail.com yang diizinkan" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Generate 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Save code and gmail to profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          gmail: gmail.toLowerCase().trim(),
          gmail_verified: false,
          gmail_verification_code: verificationCode,
          gmail_verification_expires_at: expiresAt,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error saving verification code:", updateError);
        throw updateError;
      }

      // Send email
      const emailResponse = await resend.emails.send({
        from: "SIMAPROS <onboarding@resend.dev>",
        to: [gmail.toLowerCase().trim()],
        subject: "Kode Verifikasi Gmail - SIMAPROS",
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Verifikasi Gmail</h1>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Kode verifikasi Anda:</p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${verificationCode}</span>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Kode berlaku selama 10 menit. Jangan bagikan kode ini kepada siapapun.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">Email otomatis dari SIMAPROS.</p>
            </div>
          </body>
          </html>
        `,
      });

      console.log("Verification email sent:", emailResponse);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "verify") {
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Kode verifikasi diperlukan" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("gmail_verification_code, gmail_verification_expires_at")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Profil tidak ditemukan" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check expiry
      if (!profile.gmail_verification_expires_at || new Date(profile.gmail_verification_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "Kode verifikasi telah kedaluwarsa. Silakan kirim ulang." }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check code
      if (profile.gmail_verification_code !== code) {
        return new Response(
          JSON.stringify({ error: "Kode verifikasi salah" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark as verified
      const { error: verifyError } = await supabase
        .from("profiles")
        .update({
          gmail_verified: true,
          gmail_verification_code: null,
          gmail_verification_expires_at: null,
        })
        .eq("id", user.id);

      if (verifyError) throw verifyError;

      return new Response(JSON.stringify({ success: true, verified: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (action === "welcome") {
      if (!gmail) {
        return new Response(
          JSON.stringify({ error: "Gmail diperlukan" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get user name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      const userName = profile?.name || "User";

      await resend.emails.send({
        from: "SIMAPROS <onboarding@resend.dev>",
        to: [gmail.toLowerCase().trim()],
        subject: "✅ Gmail Terhubung ke SIMAPROS",
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 20px;">Gmail Berhasil Terhubung</h1>
            </div>
            <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <p>Halo <strong>${userName}</strong>,</p>
              <p>Gmail Anda (<strong>${gmail}</strong>) telah berhasil terhubung dan terverifikasi di SIMAPROS.</p>
              <p>Mulai sekarang, Anda akan menerima notifikasi email terkait:</p>
              <ul style="color: #4b5563; font-size: 14px;">
                <li>Update status proyek</li>
                <li>Peringatan deadline</li>
                <li>Reminder progress</li>
                <li>Hasil evaluasi AI (Monev)</li>
              </ul>
              <p style="color: #6b7280; font-size: 14px;">Anda dapat mengatur preferensi notifikasi di halaman Pengaturan Notifikasi.</p>
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
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in verify-gmail:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
