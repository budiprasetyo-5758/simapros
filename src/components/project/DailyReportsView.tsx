import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GanttTask } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { FileText, Calendar, CheckCircle2, AlertTriangle, Bot, Loader2, Download, Paperclip, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface DailyReport {
  id: string;
  task_id: string;
  project_id: string;
  reporter_id: string;
  report_date: string;
  description: string;
  challenges: string | null;
  achievements: string | null;
  ai_calculated_progress: number | null;
  ai_reasoning: string | null;
  attachment_url: string | null;
  created_at: string;
}

interface DailyReportsViewProps {
  projectId: string;
  tasks: GanttTask[];
  selectedTaskId?: string;
  projectTitle?: string;
}

export function DailyReportsView({ projectId, tasks, selectedTaskId, projectTitle }: DailyReportsViewProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, [projectId, selectedTaskId]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('daily_reports')
        .select('*')
        .eq('project_id', projectId)
        .order('report_date', { ascending: false });

      if (selectedTaskId) {
        query = query.eq('task_id', selectedTaskId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTaskName = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.name || 'Task tidak ditemukan';
  };

  const getTaskWBS = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    return task?.wbs_number || '';
  };

  const isImageUrl = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  const handleExportPDF = async () => {
    if (reports.length === 0) {
      toast({
        title: 'Tidak ada laporan',
        description: 'Tidak ada laporan harian untuk diekspor',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('LAPORAN HARIAN', pageWidth / 2, 15, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(projectTitle || 'Proyek', pageWidth / 2, 25, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.text(`Diekspor: ${format(new Date(), 'd MMMM yyyy, HH:mm', { locale: id })}`, pageWidth / 2, 32, { align: 'center' });
      
      yPosition = 45;

      // Group reports by date
      const groupedReports = reports.reduce((acc, report) => {
        const date = report.report_date;
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(report);
        return acc;
      }, {} as Record<string, DailyReport[]>);

      pdf.setTextColor(0, 0, 0);

      for (const [date, dateReports] of Object.entries(groupedReports)) {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }

        // Date header
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(format(new Date(date), 'EEEE, d MMMM yyyy', { locale: id }), margin + 3, yPosition + 5.5);
        yPosition += 12;

        for (const report of dateReports) {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }

          // Task name
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(59, 130, 246);
          const taskText = `[${getTaskWBS(report.task_id)}] ${getTaskName(report.task_id)}`;
          pdf.text(taskText, margin, yPosition);
          yPosition += 6;

          // Description
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(9);
          const descLines = pdf.splitTextToSize(report.description, pageWidth - 2 * margin);
          pdf.text(descLines, margin, yPosition);
          yPosition += descLines.length * 4 + 2;

          // Achievements
          if (report.achievements) {
            pdf.setTextColor(34, 197, 94);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Pencapaian:', margin, yPosition);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
            const achieveLines = pdf.splitTextToSize(report.achievements, pageWidth - 2 * margin - 20);
            pdf.text(achieveLines, margin + 20, yPosition);
            yPosition += achieveLines.length * 4 + 2;
          }

          // Challenges
          if (report.challenges) {
            pdf.setTextColor(234, 179, 8);
            pdf.setFont('helvetica', 'bold');
            pdf.text('Kendala:', margin, yPosition);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(0, 0, 0);
            const challengeLines = pdf.splitTextToSize(report.challenges, pageWidth - 2 * margin - 20);
            pdf.text(challengeLines, margin + 15, yPosition);
            yPosition += challengeLines.length * 4 + 2;
          }

          // AI Progress
          if (report.ai_calculated_progress !== null) {
            pdf.setTextColor(59, 130, 246);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`AI Progress: ${report.ai_calculated_progress}%`, margin, yPosition);
            yPosition += 5;
            if (report.ai_reasoning) {
              pdf.setFont('helvetica', 'italic');
              pdf.setTextColor(100, 100, 100);
              const reasonLines = pdf.splitTextToSize(report.ai_reasoning, pageWidth - 2 * margin);
              pdf.text(reasonLines, margin, yPosition);
              yPosition += reasonLines.length * 4;
            }
          }

          // Attachment indicator
          if (report.attachment_url) {
            pdf.setTextColor(100, 100, 100);
            pdf.setFont('helvetica', 'italic');
            pdf.text('📎 Lampiran tersedia', margin, yPosition);
            yPosition += 5;
          }

          yPosition += 8;
        }
      }

      // Footer on last page
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Halaman ${i} dari ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      pdf.save(`laporan-harian-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      toast({
        title: 'Export Berhasil',
        description: 'Laporan harian berhasil diexport ke PDF',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengexport laporan ke PDF',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Belum ada laporan harian</p>
      </div>
    );
  }

  // Group reports by date
  const groupedReports = reports.reduce((acc, report) => {
    const date = report.report_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(report);
    return acc;
  }, {} as Record<string, DailyReport[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleExportPDF} disabled={exporting} variant="outline" className="gap-2">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>
      
      <ScrollArea className="h-[500px]">
        <div ref={reportContainerRef} className="space-y-4 pr-4">
          {Object.entries(groupedReports).map(([date, dateReports]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(new Date(date), 'EEEE, d MMMM yyyy', { locale: id })}
                </span>
                <Badge variant="secondary">{dateReports.length} laporan</Badge>
              </div>
              
              <div className="space-y-3 ml-6">
                {dateReports.map(report => (
                  <Card key={report.id} className="border-l-4 border-l-primary">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{getTaskWBS(report.task_id)}</span>
                        {getTaskName(report.task_id)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 space-y-3">
                      <p className="text-sm">{report.description}</p>
                      
                      {report.achievements && (
                        <div className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
                          <div>
                            <span className="font-medium text-success">Pencapaian:</span>
                            <p className="text-muted-foreground">{report.achievements}</p>
                          </div>
                        </div>
                      )}
                      
                      {report.challenges && (
                        <div className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                          <div>
                            <span className="font-medium text-warning">Kendala:</span>
                            <p className="text-muted-foreground">{report.challenges}</p>
                          </div>
                        </div>
                      )}

                      {report.attachment_url && (
                        <div className="pt-2 border-t space-y-2">
                          {isImageUrl(report.attachment_url) ? (
                            <a 
                              href={report.attachment_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img 
                                src={report.attachment_url} 
                                alt="Lampiran" 
                                className="max-w-full max-h-48 rounded-lg border object-cover hover:opacity-90 transition-opacity cursor-pointer"
                              />
                            </a>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <a 
                                href={report.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                Lihat Lampiran
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {report.ai_calculated_progress !== null && (
                        <div className="flex items-start gap-2 text-sm pt-2 border-t">
                          <Bot className="h-4 w-4 text-primary mt-0.5" />
                          <div>
                            <span className="font-medium">AI Progress: {report.ai_calculated_progress}%</span>
                            {report.ai_reasoning && (
                              <p className="text-xs text-muted-foreground">{report.ai_reasoning}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
