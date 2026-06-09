import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Loader2, RefreshCw, FileDown, Calendar, BarChart3, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import html2canvas from 'html2canvas';

interface ProjectReport {
  id: string;
  title: string;
  unit: string;
  requester_name: string;
  project_stage: string;
  progress_status: string;
  start_date: string | null;
  end_date: string | null;
  monev_summary: string | null;
  master_proyek: { name: string } | null;
  tasks: TaskReport[];
  meetings: MeetingReport[];
}

interface TaskReport {
  id: string;
  name: string;
  phase: string;
  status: string;
  progress: number;
  pic: string;
  start_date: string;
  end_date: string;
  wbs_number: string;
}

interface MeetingReport {
  id: string;
  title: string;
  meeting_date: string;
  description: string | null;
}

const stageLabels: Record<string, string> = {
  planning: 'Perencanaan',
  execution: 'Pelaksanaan',
  evaluation: 'Evaluasi',
  followup: 'Tindak Lanjut',
};

const progressStatusLabels: Record<string, { label: string; className: string }> = {
  in_progress: { label: 'Aktif', className: 'bg-green-500/10 text-green-600 border-green-200' },
  on_hold: { label: 'Pending', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
  completed: { label: 'Selesai', className: 'bg-blue-500/10 text-blue-600 border-blue-200' },
};

export default function ManualWeeklyReport() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { masterProyek } = useMasterProyek();
  const { toast } = useToast();

  const [masterFilter, setMasterFilter] = useState<string>('all');
  const [reportData, setReportData] = useState<ProjectReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && user && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      // Fetch projects
      let projectsQuery = supabase
        .from('projects')
        .select(`
          id, title, unit, requester_name, project_stage, progress_status,
          start_date, end_date, monev_summary, master_proyek_id,
          master_proyek:master_proyek_id (name)
        `)
        .in('status', ['approved', 'active']);

      if (masterFilter && masterFilter !== 'all') {
        projectsQuery = projectsQuery.eq('master_proyek_id', masterFilter);
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) throw projectsError;

      const projectIds = (projects || []).map(p => p.id);

      // Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('gantt_tasks')
        .select('id, project_id, name, phase, status, progress, pic, start_date, end_date, wbs_number')
        .in('project_id', projectIds);
      if (tasksError) throw tasksError;

      // Fetch meetings (last 2 weeks)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, project_id, title, meeting_date, description')
        .in('project_id', projectIds)
        .gte('meeting_date', twoWeeksAgo.toISOString().split('T')[0])
        .order('meeting_date', { ascending: false });
      if (meetingsError) throw meetingsError;

      // Group data
      const report: ProjectReport[] = (projects || []).map(p => ({
        id: p.id,
        title: p.title,
        unit: p.unit,
        requester_name: p.requester_name,
        project_stage: p.project_stage,
        progress_status: p.progress_status || 'in_progress',
        start_date: p.start_date,
        end_date: p.end_date,
        monev_summary: (p as any).monev_summary || null,
        master_proyek: p.master_proyek as { name: string } | null,
        tasks: (tasks || []).filter(t => t.project_id === p.id).map(t => ({
          id: t.id,
          name: t.name,
          phase: t.phase || '',
          status: t.status || 'not_started',
          progress: t.progress || 0,
          pic: t.pic || '-',
          start_date: t.start_date,
          end_date: t.end_date,
          wbs_number: t.wbs_number || '',
        })),
        meetings: (meetings || []).filter(m => (m as any).project_id === p.id).map(m => ({
          id: m.id,
          title: m.title,
          meeting_date: m.meeting_date,
          description: m.description,
        })),
      }));

      setReportData(report);
      setIsGenerated(true);

      toast({
        title: 'Laporan Selesai',
        description: `Laporan berhasil dibuat untuk ${report.length} proyek.`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: 'Gagal membuat laporan. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Statistics
  const totalProjects = reportData.length;
  const totalTasks = reportData.reduce((acc, p) => acc + p.tasks.length, 0);
  const completedTasks = reportData.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'completed').length, 0);
  const inProgressTasks = reportData.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'in_progress').length, 0);
  const notStartedTasks = reportData.reduce((acc, p) => acc + p.tasks.filter(t => t.status === 'not_started').length, 0);
  const avgProgress = totalTasks > 0
    ? Math.round(reportData.reduce((acc, p) => acc + p.tasks.reduce((a, t) => a + t.progress, 0), 0) / totalTasks)
    : 0;

  const getProjectAvgProgress = (tasks: TaskReport[]) => {
    if (tasks.length === 0) return 0;
    return Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);
  };

  const handleDownloadMarkdown = () => {
    let md = `# Laporan Mingguan Proyek\n`;
    md += `**Tanggal:** ${format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })}\n\n`;
    md += `## Statistik Keseluruhan\n`;
    md += `- Total Proyek Aktif: ${totalProjects}\n`;
    md += `- Total Task: ${totalTasks}\n`;
    md += `- Task Selesai: ${completedTasks}\n`;
    md += `- Task Berjalan: ${inProgressTasks}\n`;
    md += `- Task Belum Dimulai: ${notStartedTasks}\n`;
    md += `- Rata-rata Progress: ${avgProgress}%\n\n`;

    md += `## Tabel Perbandingan Proyek\n\n`;
    md += `| No | Nama Proyek | Unit | Fase | Progress (%) | Task Selesai | Status |\n`;
    md += `|---|---|---|---|---|---|---|\n`;
    reportData.forEach((p, i) => {
      const pTasks = p.tasks;
      const completed = pTasks.filter(t => t.status === 'completed').length;
      md += `| ${i + 1} | ${p.title} | ${p.unit} | ${stageLabels[p.project_stage] || p.project_stage} | ${getProjectAvgProgress(pTasks)}% | ${completed}/${pTasks.length} | ${progressStatusLabels[p.progress_status]?.label || p.progress_status} |\n`;
    });

    md += `\n## Detail Per Proyek\n\n`;
    reportData.forEach(p => {
      md += `### ${p.title}\n`;
      if (p.monev_summary) {
        md += `**Rangkuman Monev:**\n${p.monev_summary}\n\n`;
      }
      if (p.meetings.length > 0) {
        md += `**Meeting Terkini:**\n`;
        p.meetings.forEach(m => {
          md += `- [${m.meeting_date}] ${m.title}${m.description ? ': ' + m.description : ''}\n`;
        });
        md += `\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-mingguan-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!reportContentRef.current) return;
    setIsExportingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');

      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: absolute; left: -9999px; top: 0; width: 800px;
        padding: 40px; background: white; color: #1a1a1a;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;

      const header = document.createElement('div');
      header.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
          <h1 style="font-size: 24px; color: #1e40af; margin: 0 0 8px 0;">LAPORAN MINGGUAN PROYEK</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            ${format(new Date(), 'EEEE, d MMMM yyyy', { locale: localeId })}
          </p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
            Dibuat oleh: SIMAPROS - Sistem Manajemen Proyek Strategis
          </p>
        </div>
      `;
      tempContainer.appendChild(header);

      const contentClone = reportContentRef.current.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = `font-size: 11px; line-height: 1.5; color: #374151;`;

      const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(h => { (h as HTMLElement).style.color = '#1e40af'; });

      const tableCells = contentClone.querySelectorAll('th, td');
      tableCells.forEach(cell => {
        const el = cell as HTMLElement;
        el.style.border = '1px solid #d1d5db';
        el.style.padding = '6px 8px';
        el.style.textAlign = 'left';
      });

      const tableHeaders = contentClone.querySelectorAll('th');
      tableHeaders.forEach(th => {
        (th as HTMLElement).style.backgroundColor = '#e5e7eb';
        (th as HTMLElement).style.fontWeight = 'bold';
      });

      tempContainer.appendChild(contentClone);
      document.body.appendChild(tempContainer);

      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(tempContainer, {
        scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff',
        windowWidth: 800, windowHeight: tempContainer.scrollHeight,
      });

      document.body.removeChild(tempContainer);

      const imgWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = imgWidth - (margin * 2);
      const imgHeight = (canvas.height * contentWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const contentPageHeight = pageHeight - (margin * 2);

      let heightLeft = imgHeight;
      let position = margin;
      let page = 1;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
      heightLeft -= contentPageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        page++;
        position = margin - (page - 1) * contentPageHeight;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, imgHeight, undefined, 'FAST');
        heightLeft -= contentPageHeight;
      }

      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Halaman ${i} dari ${pageCount}`, imgWidth / 2, pageHeight - 5, { align: 'center' });
      }

      pdf.save(`laporan-mingguan-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({ title: 'PDF Berhasil Diunduh', description: 'Laporan mingguan telah diexport ke PDF.' });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({ title: 'Error', description: 'Gagal mengexport PDF. Silakan coba lagi.', variant: 'destructive' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Laporan Mingguan</h1>
              <p className="text-muted-foreground">Ringkasan progress proyek berdasarkan data aktual</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={masterFilter} onValueChange={setMasterFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {masterProyek.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={generateReport} disabled={isLoading} className="gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memuat Data...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Generate Laporan
                </>
              )}
            </Button>

            {isGenerated && (
              <>
                <Button variant="outline" onClick={handleDownloadMarkdown} className="gap-2">
                  <Download className="w-4 h-4" />
                  Markdown
                </Button>
                <Button
                  variant="default"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="gap-2 bg-destructive hover:bg-destructive/90"
                >
                  {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  Export PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Report Content */}
        {!isGenerated && !isLoading ? (
          <Card className="min-h-[500px]">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">
                Belum Ada Laporan
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Klik tombol "Generate Laporan" untuk membuat laporan mingguan berdasarkan data proyek dan task.
              </p>
              <Button onClick={generateReport} className="mt-6 gap-2">
                <BarChart3 className="w-4 h-4" />
                Generate Laporan Sekarang
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div ref={reportContentRef} className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-primary">{totalProjects}</p>
                  <p className="text-xs text-muted-foreground mt-1">Proyek Aktif</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-foreground">{totalTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total Task</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{completedTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Task Selesai</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">{inProgressTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Task Berjalan</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{notStartedTasks}</p>
                  <p className="text-xs text-muted-foreground mt-1">Belum Dimulai</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-primary">{avgProgress}%</p>
                  <p className="text-xs text-muted-foreground mt-1">Rata-rata Progress</p>
                </CardContent>
              </Card>
            </div>

            {/* Project Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Tabel Perbandingan Proyek
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead>Nama Proyek</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead className="text-center">Progress</TableHead>
                        <TableHead className="text-center">Task</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((p, i) => {
                        const pCompleted = p.tasks.filter(t => t.status === 'completed').length;
                        const pProgress = getProjectAvgProgress(p.tasks);
                        const statusInfo = progressStatusLabels[p.progress_status] || progressStatusLabels['in_progress'];
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{i + 1}</TableCell>
                            <TableCell className="font-medium">{p.title}</TableCell>
                            <TableCell>{p.unit}</TableCell>
                            <TableCell>
                              {p.master_proyek ? (
                                <Badge variant="secondary" className="text-xs">{p.master_proyek.name}</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {stageLabels[p.project_stage] || p.project_stage}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center gap-2 justify-center">
                                <div className="w-16 bg-muted rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${pProgress}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium">{pProgress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm">
                                <span className="text-green-600 font-medium">{pCompleted}</span>
                                <span className="text-muted-foreground">/{p.tasks.length}</span>
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.className}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {reportData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Tidak ada proyek aktif
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Detail Per Project */}
            {reportData.filter(p => p.monev_summary || p.meetings.length > 0).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Detail Per Proyek
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {reportData.filter(p => p.monev_summary || p.meetings.length > 0).map(p => (
                    <div key={p.id} className="border rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-lg">{p.title}</h4>

                      {p.monev_summary && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Rangkuman Monev
                          </p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                            {p.monev_summary}
                          </p>
                        </div>
                      )}

                      {p.meetings.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> Meeting Terkini
                          </p>
                          <div className="space-y-1">
                            {p.meetings.map(m => (
                              <div key={m.id} className="text-sm flex items-start gap-2 bg-muted/50 p-2 rounded">
                                <Badge variant="outline" className="text-xs shrink-0">
                                  {format(parseISO(m.meeting_date), 'd MMM', { locale: localeId })}
                                </Badge>
                                <span>{m.title}{m.description ? ` — ${m.description}` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Overdue Tasks */}
            {(() => {
              const today = new Date();
              const overdueTasks = reportData.flatMap(p =>
                p.tasks
                  .filter(t => t.status !== 'completed' && new Date(t.end_date) < today)
                  .map(t => ({ ...t, projectTitle: p.title }))
              );
              if (overdueTasks.length === 0) return null;

              return (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-5 h-5" />
                      Task Melewati Deadline ({overdueTasks.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Proyek</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>PIC</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead className="text-center">Progress</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overdueTasks.map(t => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{t.projectTitle}</TableCell>
                            <TableCell className="font-medium text-sm">{t.name}</TableCell>
                            <TableCell className="text-sm">{t.pic}</TableCell>
                            <TableCell className="text-sm text-destructive">
                              {format(parseISO(t.end_date), 'd MMM yyyy', { locale: localeId })}
                            </TableCell>
                            <TableCell className="text-center text-sm font-medium">{t.progress}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Footer */}
            <p className="text-center text-xs text-muted-foreground py-4">
              Laporan dibuat pada {format(new Date(), 'EEEE, d MMMM yyyy HH:mm', { locale: localeId })} — SIMAPROS
            </p>
          </div>
        )}
      </div>
    </SimpleLayout>
  );
}
