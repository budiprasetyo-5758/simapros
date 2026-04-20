 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const { project_title, project_description, project_stage, progress_status, tasks } = await req.json();
 
     const stageLabels: Record<string, string> = {
       planning: "Perencanaan",
       execution: "Pelaksanaan",
       evaluation: "Evaluasi",
       followup: "Tindak Lanjut",
     };
 
     const progressLabels: Record<string, string> = {
       in_progress: "Aktif",
       on_hold: "Pending",
       completed: "Selesai",
     };
 
     // Calculate task statistics
     const totalTasks = tasks?.length || 0;
     const completedTasks = tasks?.filter((t: { status: string }) => t.status === "completed").length || 0;
     const inProgressTasks = tasks?.filter((t: { status: string }) => t.status === "in_progress").length || 0;
     const avgProgress = totalTasks > 0
       ? Math.round(tasks.reduce((acc: number, t: { progress: number }) => acc + (t.progress || 0), 0) / totalTasks)
       : 0;
 
     // Collect monev notes from tasks
     const monevNotes = tasks
       ?.filter((t: { monev: string }) => t.monev && t.monev.trim())
       .map((t: { name: string; monev: string; phase: string }) => `- ${t.name} (${t.phase}): ${t.monev}`)
       .join("\n") || "Belum ada catatan monev per task.";
 
      const systemPrompt = `Anda adalah asisten AI pembuat rangkuman Monev proyek dalam Bahasa Indonesia.

Aturan KETAT:
1. HANYA 3 poin, tidak lebih
2. Setiap poin diawali "• " dan MAKSIMAL 8 kata
3. Gunakan kata kerja aktif di awal kalimat
4. Langsung ke inti tanpa basa-basi

Format: "• " di awal setiap poin, baris baru. TANPA markdown/numbering.`;
 
     const userPrompt = `Buat rangkuman Monev untuk proyek berikut:
 
 INFORMASI PROYEK:
 - Judul: ${project_title}
 - Deskripsi: ${project_description}
 - Fase Saat Ini: ${stageLabels[project_stage] || project_stage}
 - Status Progres: ${progressLabels[progress_status] || progress_status}
 
 STATISTIK TASK:
 - Total Task: ${totalTasks}
 - Task Selesai: ${completedTasks}
 - Task Berjalan: ${inProgressTasks}
 - Rata-rata Progress: ${avgProgress}%
 
 CATATAN MONEV PER TASK:
 ${monevNotes}
 
 DATA TASK LENGKAP:
 ${JSON.stringify(tasks, null, 2)}
 
 Buat rangkuman monev yang komprehensif berdasarkan data di atas.`;
 
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         Authorization: `Bearer ${LOVABLE_API_KEY}`,
         "Content-Type": "application/json",
       },
       body: JSON.stringify({
         model: "google/gemini-3-flash-preview",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: userPrompt },
         ],
       }),
     });
 
     if (!response.ok) {
       if (response.status === 429) {
         return new Response(
           JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
           { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       if (response.status === 402) {
         return new Response(
           JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
           { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
         );
       }
       const errorText = await response.text();
       console.error("AI gateway error:", response.status, errorText);
       throw new Error("AI gateway error");
     }
 
     const data = await response.json();
     const summary = data.choices?.[0]?.message?.content || "";
 
     return new Response(
       JSON.stringify({ summary }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     console.error("Error generating monev summary:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });