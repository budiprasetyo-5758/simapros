import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { master_proyek_id } = await req.json();

    // Fetch projects with tasks
    let projectsQuery = supabase
      .from("projects")
      .select(`
        id,
        title,
        description,
        unit,
        requester_name,
        status,
        priority,
        project_stage,
        start_date,
        end_date,
        master_proyek_id,
         master_proyek:master_proyek_id (name),
         monev_summary,
         progress_status
      `)
      .in("status", ["approved", "active"]);

    if (master_proyek_id && master_proyek_id !== "all") {
      projectsQuery = projectsQuery.eq("master_proyek_id", master_proyek_id);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) throw projectsError;

    // Fetch all tasks for these projects
    const projectIds = projects?.map((p) => p.id) || [];
    const { data: tasks, error: tasksError } = await supabase
      .from("gantt_tasks")
      .select("*")
      .in("project_id", projectIds);

    if (tasksError) throw tasksError;

    // Fetch meetings for these projects
    const { data: meetings, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });

    if (meetingsError) throw meetingsError;

    // Determine actual phase from task data
    const determineActualPhase = (projectTasks: any[]) => {
      const phases = ["planning", "execution", "evaluation", "followup"];
      const phaseData: Record<string, { total: number; completed: number; progress: number }> = {};
      for (const phase of phases) {
        const phaseTasks = projectTasks.filter((t) => (t.phase || "").toLowerCase().includes(phase));
        const total = phaseTasks.length;
        const completed = phaseTasks.filter((t) => t.status === "completed").length;
        const progress = total > 0 ? Math.round(phaseTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / total) : 0;
        phaseData[phase] = { total, completed, progress };
      }
      // Walk phases in reverse: the latest phase that has tasks is the current one
      // But if the previous phase is 100%, we're in the next phase
      let currentPhase = "planning";
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        if (phaseData[phase].total > 0) {
          currentPhase = phase;
          // If this phase is 100% complete and there's a next phase with tasks, move to next
          if (phaseData[phase].progress >= 100 && i + 1 < phases.length && phaseData[phases[i + 1]].total > 0) {
            continue;
          }
          break;
        }
      }
      // Special case: if a later phase has tasks with progress, use that
      for (let i = phases.length - 1; i >= 0; i--) {
        if (phaseData[phases[i]].total > 0 && (phaseData[phases[i]].progress > 0 || phaseData[phases[i]].completed > 0)) {
          // Check if earlier phases are done
          let allEarlierDone = true;
          for (let j = 0; j < i; j++) {
            if (phaseData[phases[j]].total > 0 && phaseData[phases[j]].progress < 100) {
              allEarlierDone = false;
              break;
            }
          }
          if (allEarlierDone || phaseData[phases[i]].progress > 0) {
            currentPhase = phases[i];
            break;
          }
        }
      }
      return { currentPhase, phaseData };
    };

    // Group tasks by project
    const projectsWithTasks = projects?.map((project) => {
      const projectTasks = tasks?.filter((t) => t.project_id === project.id) || [];
      const { currentPhase, phaseData } = determineActualPhase(projectTasks);
      const projectMeetings = meetings?.filter((m) => m.project_id === project.id) || [];

      return {
        ...project,
        computed_current_phase: currentPhase,
        phase_breakdown: phaseData,
        tasks: projectTasks,
        recent_meetings: projectMeetings.slice(0, 5),
      };
    });

    // Calculate stats
    const stats = {
      total_projects: projects?.length || 0,
      total_tasks: tasks?.length || 0,
      completed_tasks: tasks?.filter((t) => t.status === "completed").length || 0,
      in_progress_tasks: tasks?.filter((t) => t.status === "in_progress").length || 0,
      not_started_tasks: tasks?.filter((t) => t.status === "not_started").length || 0,
      avg_progress:
        tasks && tasks.length > 0
          ? Math.round(tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / tasks.length)
          : 0,
      total_meetings: meetings?.length || 0,
    };

    const systemPrompt = `Anda adalah asisten AI yang bertugas membuat laporan mingguan proyek dalam Bahasa Indonesia.
Buat laporan yang ringkas, profesional, dan informatif dengan format TABEL PERBANDINGAN antar proyek.

Format laporan WAJIB mencakup:
1. Ringkasan Eksekutif (2-3 kalimat)
2. Statistik Utama (dalam format daftar)
3. **TABEL PERBANDINGAN PROYEK** - Ini adalah bagian UTAMA, wajib berformat tabel Markdown dengan kolom:
   | No | Nama Proyek | Unit | Fase | Progress (%) | Task Selesai | Task Tertunda | Status |
4. Highlight Pencapaian Minggu Ini (max 5 poin)
5. **RANGKUMAN MONEV PER PROYEK** - Tampilkan ringkasan monev untuk setiap proyek yang memilikinya
6. **RANGKUMAN MEETING** - Tampilkan meeting terkini yang relevan per proyek
7. Task yang Perlu Perhatian (overdue atau tertunda)
8. Rekomendasi untuk Minggu Depan (max 5 poin)

PENTING:
- Gunakan tabel Markdown yang valid untuk perbandingan proyek
- **KRITIS**: Kolom "Fase" HARUS menggunakan nilai dari field "computed_current_phase", BUKAN dari "project_stage"! Field "computed_current_phase" sudah dihitung berdasarkan progress task per fase
- Setiap proyek harus ada di dalam tabel perbandingan
- Gunakan emoji untuk memperjelas status (✅ ⚠️ 🔴 🟡 🟢)
- Progress harus ditampilkan sebagai persentase
- Sertakan rangkuman monev untuk proyek yang memilikinya
- Sertakan informasi meeting terkini per proyek
- Format menggunakan Markdown yang valid`;

    const userPrompt = `Buat laporan mingguan berdasarkan data berikut:

STATISTIK KESELURUHAN:
- Total Proyek Aktif: ${stats.total_projects}
- Total Task: ${stats.total_tasks}
- Task Selesai: ${stats.completed_tasks}
- Task Berjalan: ${stats.in_progress_tasks}
- Task Belum Dimulai: ${stats.not_started_tasks}
- Rata-rata Progress: ${stats.avg_progress}%
- Total Meeting: ${stats.total_meetings}

DATA PROYEK (untuk tabel perbandingan):
PERHATIAN: Gunakan field "computed_current_phase" untuk kolom Fase, BUKAN "project_stage"!
${JSON.stringify(projectsWithTasks, null, 2)}

RANGKUMAN MONEV PER PROYEK:
${projectsWithTasks?.filter((p: { monev_summary?: string }) => p.monev_summary).map((p: { title: string; monev_summary: string }) => `
### ${p.title}
${p.monev_summary}
`).join("\n") || "Belum ada rangkuman monev untuk proyek-proyek ini."}

MEETING TERKINI PER PROYEK:
${projectsWithTasks?.filter((p: { recent_meetings?: any[] }) => p.recent_meetings && p.recent_meetings.length > 0).map((p: { title: string; recent_meetings: any[] }) => `
### ${p.title}
${p.recent_meetings.map((m: any) => `- [${m.meeting_date}] ${m.title}: ${m.description || 'Tidak ada deskripsi'}`).join("\n")}
`).join("\n") || "Belum ada meeting terkini."}

Tanggal Laporan: ${new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}

INGAT: Buat tabel perbandingan yang jelas dan mudah dibaca untuk semua proyek! Kolom Fase WAJIB dari "computed_current_phase"! Sertakan juga rangkuman monev dan meeting per proyek.`;

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
        stream: true,
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

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Error generating weekly report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
