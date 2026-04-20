import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, dailyReports, allTaskReports } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration is missing");
    }

    // Create Supabase client with service role for bypassing RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date();
    const startDate = new Date(task.start_date);
    const endDate = new Date(task.end_date);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = today > endDate;

    const reportsText = dailyReports.map((r: any, i: number) => 
      `Laporan ${i + 1} (${r.report_date}):
- Deskripsi: ${r.description}
- Pencapaian: ${r.achievements || 'Tidak disebutkan'}
- Kendala: ${r.challenges || 'Tidak ada'}`
    ).join('\n\n');

    const systemPrompt = `Kamu adalah AI yang bertugas menghitung progress task proyek berdasarkan laporan harian dari eksekutor.

ATURAN PENTING:
1. Analisis SEMUA laporan harian yang diberikan secara menyeluruh
2. Berikan penilaian progress dalam persentase (0-100)
3. Pertimbangkan faktor:
   - Jumlah hari yang sudah berlalu vs total durasi task
   - Pencapaian yang dilaporkan dalam setiap laporan
   - Kendala yang dihadapi dan dampaknya
   - Apakah task sudah melewati deadline
4. Jika sudah melewati deadline tapi belum 100%, jelaskan apa yang kemungkinan belum selesai
5. Usahakan progress mencapai 100% saat due date jika memungkinkan berdasarkan laporan

FORMAT RESPONS (JSON):
{
  "progress": <number 0-100>,
  "reasoning": "<penjelasan singkat mengapa progress ini diberikan>",
  "incomplete_items": ["<item yang belum selesai jika ada>"],
  "recommendations": ["<rekomendasi jika diperlukan>"]
}`;

    const userPrompt = `INFORMASI TASK:
- Nama: ${task.name}
- Deskripsi: ${task.description || 'Tidak ada deskripsi'}
- PIC: ${task.pic}
- Tanggal Mulai: ${task.start_date}
- Tanggal Selesai: ${task.end_date}
- Total Durasi: ${totalDays} hari
- Hari Berlalu: ${daysElapsed} hari
- Hari Tersisa: ${daysRemaining} hari
- Status Deadline: ${isOverdue ? 'SUDAH MELEWATI DEADLINE' : 'Belum melewati deadline'}
- WBS: ${task.wbs_number || '-'}
- Phase: ${task.phase}

JUMLAH LAPORAN: ${dailyReports.length}

LAPORAN HARIAN:
${reportsText || 'Belum ada laporan harian untuk task ini.'}

Berdasarkan informasi di atas, hitung progress task ini dalam persentase dan berikan alasannya.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Silakan coba lagi." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits habis." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fallback: estimate based on days elapsed
      const estimatedProgress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      result = {
        progress: estimatedProgress,
        reasoning: "Progress dihitung berdasarkan proporsi waktu yang telah berlalu.",
        incomplete_items: [],
        recommendations: []
      };
    }

    // Update task progress using service role (bypasses RLS)
    console.log(`Updating task ${task.id} with progress: ${result.progress}%`);
    
    // First update: ai_progress and ai_progress_reasoning for ALL tasks
    const { error: aiUpdateError } = await supabase
      .from('gantt_tasks')
      .update({
        ai_progress: result.progress,
        ai_progress_reasoning: result.reasoning
      })
      .eq('id', task.id);

    if (aiUpdateError) {
      console.error("Error updating AI progress:", aiUpdateError);
      throw aiUpdateError;
    }

    // Second update: only update progress if there's no manual override
    const { error: progressUpdateError } = await supabase
      .from('gantt_tasks')
      .update({
        progress: result.progress
      })
      .eq('id', task.id)
      .is('progress_override', null);

    if (progressUpdateError) {
      console.error("Error updating progress:", progressUpdateError);
      // Don't throw, this is expected if there's an override
    }

    // Also save AI progress to daily report
    if (dailyReports.length > 0) {
      const latestReport = dailyReports[dailyReports.length - 1];
      const { error: reportUpdateError } = await supabase
        .from('daily_reports')
        .update({
          ai_calculated_progress: result.progress,
          ai_reasoning: result.reasoning
        })
        .eq('id', latestReport.id);

      if (reportUpdateError) {
        console.error("Error updating daily report:", reportUpdateError);
      }
    }

    console.log(`Successfully updated task ${task.id} progress to ${result.progress}%`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in calculate-task-progress:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});