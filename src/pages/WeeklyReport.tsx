import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Loader2, RefreshCw, Sparkles, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function WeeklyReport() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { masterProyek } = useMasterProyek();
  const { toast } = useToast();

  const [masterFilter, setMasterFilter] = useState<string>('all');
  const [report, setReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    // Only super admins can access AI Report
    if (!authLoading && user && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  const generateReport = async () => {
    setIsGenerating(true);
    setReport('');

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-weekly-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ master_proyek_id: masterFilter }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: 'Rate Limit',
            description: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            variant: 'destructive',
          });
          setIsGenerating(false);
          return;
        }
        if (response.status === 402) {
          toast({
            title: 'Kredit Habis',
            description: 'Kredit AI habis. Silakan tambah kredit.',
            variant: 'destructive',
          });
          setIsGenerating(false);
          return;
        }
        throw new Error('Failed to generate report');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              setReport((prev) => prev + content);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      toast({
        title: 'Laporan Selesai',
        description: 'Laporan mingguan berhasil dibuat.',
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Error generating report:', error);
        toast({
          title: 'Error',
          description: 'Gagal membuat laporan. Silakan coba lagi.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([report], { type: 'text/markdown' });
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
      // Create a temporary container for PDF generation
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        width: 800px;
        padding: 40px;
        background: white;
        color: #1a1a1a;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      `;
      
      // Add header
      const header = document.createElement('div');
      header.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
          <h1 style="font-size: 24px; color: #1e40af; margin: 0 0 8px 0;">LAPORAN MINGGUAN PROYEK</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            ${new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
            Dibuat oleh: SIMAPROS - Sistem Manajemen Proyek Strategis
          </p>
        </div>
      `;
      tempContainer.appendChild(header);
      
      // Clone and style the report content
      const contentClone = reportContentRef.current.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = `
        font-size: 11px;
        line-height: 1.5;
        color: #374151;
      `;
      
      // Style markdown elements
      const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach((h) => {
        const el = h as HTMLElement;
        el.style.color = '#1e40af';
        el.style.marginTop = '16px';
        el.style.marginBottom = '8px';
        el.style.pageBreakAfter = 'avoid';
      });
      
      const paragraphs = contentClone.querySelectorAll('p');
      paragraphs.forEach((p) => {
        const el = p as HTMLElement;
        el.style.marginBottom = '6px';
      });
      
      const lists = contentClone.querySelectorAll('ul, ol');
      lists.forEach((list) => {
        const el = list as HTMLElement;
        el.style.paddingLeft = '16px';
        el.style.marginBottom = '8px';
      });
      
      // Style tables with proper page break handling
      const tables = contentClone.querySelectorAll('table');
      tables.forEach((table) => {
        const el = table as HTMLElement;
        el.style.width = '100%';
        el.style.borderCollapse = 'collapse';
        el.style.marginBottom = '12px';
        el.style.fontSize = '10px';
        el.style.pageBreakInside = 'auto';
      });
      
      const tableRows = contentClone.querySelectorAll('tr');
      tableRows.forEach((row) => {
        const el = row as HTMLElement;
        el.style.pageBreakInside = 'avoid';
        el.style.pageBreakAfter = 'auto';
      });
      
      const tableCells = contentClone.querySelectorAll('th, td');
      tableCells.forEach((cell) => {
        const el = cell as HTMLElement;
        el.style.border = '1px solid #d1d5db';
        el.style.padding = '6px 8px';
        el.style.textAlign = 'left';
        el.style.verticalAlign = 'top';
        el.style.wordBreak = 'break-word';
      });
      
      const tableHeaders = contentClone.querySelectorAll('th');
      tableHeaders.forEach((th) => {
        const el = th as HTMLElement;
        el.style.backgroundColor = '#e5e7eb';
        el.style.fontWeight = 'bold';
        el.style.whiteSpace = 'nowrap';
      });

      // Style table header row for repeat on new pages
      const theads = contentClone.querySelectorAll('thead');
      theads.forEach((thead) => {
        const el = thead as HTMLElement;
        el.style.display = 'table-header-group';
      });
      
      tempContainer.appendChild(contentClone);
      
      // Add footer
      const footer = document.createElement('div');
      footer.innerHTML = `
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="font-size: 9px; color: #9ca3af; margin: 0;">
            Dokumen ini dibuat secara otomatis oleh sistem AI SIMAPROS
          </p>
          <p style="font-size: 9px; color: #9ca3af; margin: 4px 0 0 0;">
            © ${new Date().getFullYear()} SIMAPROS - Semua hak dilindungi
          </p>
        </div>
      `;
      tempContainer.appendChild(footer);
      
      document.body.appendChild(tempContainer);
      
      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Generate canvas from the container
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 800,
        windowHeight: tempContainer.scrollHeight,
      });
      
      // Remove temp container
      document.body.removeChild(tempContainer);
      
      // Create PDF with proper pagination
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 10; // margin in mm
      const contentWidth = imgWidth - (margin * 2);
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const contentPageHeight = pageHeight - (margin * 2);
      
      let heightLeft = imgHeight;
      let position = margin;
      let page = 1;
      
      // Calculate scale to fit width
      const scaleFactor = contentWidth / (canvas.width / 2); // Divide by 2 because of scale: 2 in html2canvas
      
      // Add first page content
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        margin,
        position,
        contentWidth,
        imgHeight,
        undefined,
        'FAST'
      );
      heightLeft -= contentPageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        pdf.addPage();
        page++;
        position = margin - (page - 1) * contentPageHeight;
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          margin,
          position,
          contentWidth,
          imgHeight,
          undefined,
          'FAST'
        );
        heightLeft -= contentPageHeight;
      }
      
      // Add page numbers
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(156, 163, 175);
        pdf.text(
          `Halaman ${i} dari ${pageCount}`,
          imgWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }
      
      // Download PDF
      pdf.save(`laporan-mingguan-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: 'PDF Berhasil Diunduh',
        description: 'Laporan mingguan telah diexport ke PDF.',
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengexport PDF. Silakan coba lagi.',
        variant: 'destructive',
      });
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
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI Weekly Report</h1>
              <p className="text-muted-foreground">Laporan mingguan otomatis berbasis AI</p>
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
                  <SelectItem key={mp.id} value={mp.id}>
                    {mp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={generateReport} disabled={isGenerating} className="gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Membuat Laporan...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Generate Laporan
                </>
              )}
            </Button>

            {report && (
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
                  {isExportingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Export PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Report Content */}
        <Card className="min-h-[500px]">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Laporan Mingguan
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {!report && !isGenerating ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">
                  Belum Ada Laporan
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Klik tombol "Generate Laporan" untuk membuat laporan mingguan otomatis
                  berdasarkan data proyek dan task Anda.
                </p>
                <Button onClick={generateReport} className="mt-6 gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate Laporan Sekarang
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div 
                  ref={reportContentRef} 
                  className="p-6 prose prose-sm max-w-none dark:prose-invert prose-table:w-full prose-table:border-collapse prose-th:bg-muted prose-th:border prose-th:border-border prose-th:p-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:p-2"
                >
                  {isGenerating && !report && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menganalisis data proyek...</span>
                    </div>
                  )}
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="w-full border-collapse border border-border text-sm" {...props} />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead className="bg-muted" {...props} />
                      ),
                      th: ({ node, ...props }) => (
                        <th className="border border-border p-2 text-left font-semibold whitespace-nowrap" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="border border-border p-2 align-top" {...props} />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr className="even:bg-muted/30" {...props} />
                      ),
                    }}
                  >
                    {report}
                  </ReactMarkdown>
                  {isGenerating && report && (
                    <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1"></span>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </SimpleLayout>
  );
}
