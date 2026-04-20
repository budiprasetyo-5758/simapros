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

    const { project_title, project_description, start_date, end_date, master_proyek_name } =
      await req.json();

    const systemPrompt = `Anda adalah asisten AI project manager yang ahli dalam breakdown proyek menjadi task-task yang terstruktur.
Tugas Anda adalah menganalisis deskripsi proyek dan menghasilkan daftar task yang terstruktur dengan WBS (Work Breakdown Structure).

ATURAN PENTING:
1. Buat 5-10 task utama yang realistis dan terukur
2. Setiap task harus memiliki estimasi durasi yang masuk akal
3. Gunakan format WBS dengan penomoran bertingkat (1.0, 1.1, 2.0, dst)
4. Pastikan task berurutan secara logis (planning → execution → evaluation)
5. Distribusikan tanggal secara merata antara start_date dan end_date
6. Status awal semua task adalah "not_started"
7. Progress awal adalah 0

FORMAT OUTPUT WAJIB (JSON):
{
  "tasks": [
    {
      "wbs_number": "1.0",
      "name": "Nama Task",
      "description": "Deskripsi singkat task",
      "phase": "planning|execution|evaluation|followup",
      "duration_days": 7,
      "dependencies": []
    }
  ]
}`;

    const userPrompt = `Buat breakdown task untuk proyek berikut:

JUDUL PROYEK: ${project_title}
KATEGORI: ${master_proyek_name || "Umum"}
DESKRIPSI: ${project_description}
PERIODE: ${start_date} sampai ${end_date}

Hasilkan daftar task dengan format JSON yang sudah ditentukan.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "generate_tasks",
              description: "Generate a list of project tasks with WBS structure",
              parameters: {
                type: "object",
                properties: {
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        wbs_number: { type: "string", description: "WBS number like 1.0, 1.1, 2.0" },
                        name: { type: "string", description: "Task name" },
                        description: { type: "string", description: "Task description" },
                        phase: {
                          type: "string",
                          enum: ["planning", "execution", "evaluation", "followup"],
                        },
                        duration_days: { type: "number", description: "Duration in days" },
                        dependencies: {
                          type: "array",
                          items: { type: "string" },
                          description: "WBS numbers of dependent tasks",
                        },
                      },
                      required: ["wbs_number", "name", "description", "phase", "duration_days"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tasks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_tasks" } },
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

    // Extract tasks from tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);

      // Calculate actual dates based on duration
      const startDateObj = new Date(start_date);
      const endDateObj = new Date(end_date);
      const totalDays = Math.ceil(
        (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate total duration from tasks
      const totalTaskDays = args.tasks.reduce(
        (acc: number, t: any) => acc + (t.duration_days || 7),
        0
      );

      // Scale factor to fit tasks within project duration
      const scale = totalDays / totalTaskDays;

      let currentDate = new Date(startDateObj);
      const tasksWithDates = args.tasks.map((task: any) => {
        const taskStart = new Date(currentDate);
        const scaledDuration = Math.max(1, Math.round(task.duration_days * scale));
        currentDate.setDate(currentDate.getDate() + scaledDuration);
        const taskEnd = new Date(currentDate);
        taskEnd.setDate(taskEnd.getDate() - 1);

        return {
          ...task,
          start_date: taskStart.toISOString().split("T")[0],
          end_date: taskEnd.toISOString().split("T")[0],
          progress: 0,
          status: "not_started",
          pic: "",
          monev: "",
        };
      });

      return new Response(JSON.stringify({ tasks: tasksWithDates }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Failed to parse AI response");
  } catch (error) {
    console.error("Error generating task suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
