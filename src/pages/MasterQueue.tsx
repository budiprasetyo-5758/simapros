import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListOrdered, Search, Filter, Siren, Wallet, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { SOP_SOURCE_REFERENCE } from '@/lib/sopPriority2026';
import { buildPriorityAssessmentView } from '@/lib/priorityAssessmentView';
import { quadrantConfig } from '@/lib/priorityMatrix';
import type { Quadrant } from '@/lib/priorityMatrix';
import { exportPriorityAssessmentFormPdf } from '@/lib/exportPriorityAssessmentForm';
import { useToast } from '@/hooks/use-toast';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';

type QueueLane = 'mandatory' | 'queued' | 'gated';

interface QueueRow {
  project: Project;
  lane: QueueLane;
  scorePercent: number | null;
  scoreText: string;
  methodVersion: string;
  revisionNo: number | null;
  quadrant: Quadrant | null;
}

const laneMeta: Record<QueueLane, { title: string; description: string; icon: typeof Siren; className: string }> = {
  mandatory: {
    title: 'Priority 0 — Mandatory (Fast Track)',
    description:
      'Lolos Tahap 1: kewajiban regulasi, dampak akreditasi/BPJS, atau pencegahan risiko kritis. Tidak diskor dan selalu berada di puncak antrean.',
    icon: Siren,
    className: 'border-destructive/30 bg-destructive/5',
  },
  queued: {
    title: 'Master Queue — Urut Total Skor Akhir',
    description:
      'Lolos gate finansial. Urutan ditentukan murni oleh Total Skor Akhir; Effort tidak menggeser peringkat.',
    icon: ListOrdered,
    className: 'border-success/30 bg-success/5',
  },
  gated: {
    title: 'GATED — Under Review / Pending',
    description:
      'Skor K3 ≤ 3 (Red Zone). Menunggu justifikasi ulang atau diskresi Direksi, belum masuk urutan antrean.',
    icon: Wallet,
    className: 'border-warning/30 bg-warning/5',
  },
};

// Antrean hanya memuat proyek yang sudah punya snapshot penilaian. Proyek yang
// belum dinilai tidak boleh muncul dengan peringkat apa pun — menampilkannya
// tanpa skor akan membuatnya terlihat seperti sudah dievaluasi.
function toQueueRow(project: Project): QueueRow | null {
  const assessment = project.current_priority_assessment;
  if (!assessment) return null;

  const view = buildPriorityAssessmentView(assessment);
  const lane: QueueLane = view.isMandatory
    ? 'mandatory'
    : view.recommendation === 'gated' || view.finalDecision === 'gated'
      ? 'gated'
      : 'queued';

  return {
    project,
    lane,
    scorePercent: view.isMandatory ? null : view.scorePercent,
    scoreText: view.scoreText,
    methodVersion: view.methodVersion,
    revisionNo: assessment.revision_no ?? null,
    quadrant: view.quadrant,
  };
}

export default function MasterQueue() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { masterProyek } = useMasterProyek();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [masterFilter, setMasterFilter] = useState<string>('all');
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleDownloadForm = async (project: Project) => {
    setExportingId(project.id);
    try {
      await exportPriorityAssessmentFormPdf(project);
      toast({ title: 'Formulir Diunduh', description: `Formulir evaluasi "${project.title}" berhasil diekspor ke PDF.` });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error exporting assessment form:', error);
      toast({ title: 'Gagal', description: 'Gagal membuat formulir evaluasi. Silakan coba lagi.', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && user && !isSuperAdmin) navigate('/');
  }, [user, authLoading, isSuperAdmin, navigate]);

  const lanes = useMemo(() => {
    const rows = projects
      .filter((project) => {
        // Proyek yang sudah ditutup tidak lagi memperebutkan kapasitas.
        if (project.status === 'rejected' || project.status === 'withdrawn') return false;
        const query = search.trim().toLowerCase();
        const matchesSearch = query === ''
          || project.title.toLowerCase().includes(query)
          || project.unit.toLowerCase().includes(query)
          || project.requester_name.toLowerCase().includes(query);
        const matchesMaster = masterFilter === 'all' || project.master_proyek_id === masterFilter;
        return matchesSearch && matchesMaster;
      })
      .map(toQueueRow)
      .filter((row): row is QueueRow => row !== null);

    // Urutan di dalam lane memakai score_percent, bukan impact_score mentah:
    // skala 1-5 (metode lama) dan 1-10 (SOP) tidak sebanding secara langsung.
    const sortByScore = (a: QueueRow, b: QueueRow) =>
      (b.scorePercent ?? Number.NEGATIVE_INFINITY) - (a.scorePercent ?? Number.NEGATIVE_INFINITY);

    return {
      mandatory: rows.filter((row) => row.lane === 'mandatory'),
      queued: rows.filter((row) => row.lane === 'queued').sort(sortByScore),
      gated: rows.filter((row) => row.lane === 'gated').sort(sortByScore),
    };
  }, [projects, search, masterFilter]);

  const unassessedCount = useMemo(
    () => projects.filter(
      (project) => project.status === 'pending' && !project.current_priority_assessment,
    ).length,
    [projects],
  );

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  const renderLane = (lane: QueueLane, rows: QueueRow[]) => {
    const meta = laneMeta[lane];
    const Icon = meta.icon;
    const ranked = lane === 'queued';

    return (
      <section key={lane} className={cn('rounded-2xl border p-4', meta.className)}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{meta.title}</h2>
              <Badge variant="outline" className="text-xs">{rows.length} proyek</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Belum ada proyek pada jalur ini.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">{ranked ? '#' : 'Prio'}</TableHead>
                  <TableHead>Proyek</TableHead>
                  <TableHead className="w-40">Unit</TableHead>
                  <TableHead className="w-36">Total Skor</TableHead>
                  <TableHead className="w-40">Kuadran</TableHead>
                  <TableHead className="w-36">Metode</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={row.project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/project/${row.project.id}`)}
                  >
                    <TableCell className="font-semibold tabular-nums">
                      {lane === 'mandatory' ? '0' : ranked ? index + 1 : '—'}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{row.project.title}</p>
                      <p className="text-xs text-muted-foreground">{row.project.requester_name}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.project.unit}</TableCell>
                    <TableCell className="tabular-nums">
                      {row.scoreText}
                      {row.scorePercent !== null && (
                        <span className="block text-xs text-muted-foreground">
                          {row.scorePercent.toFixed(1)}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.quadrant ? (
                        <Badge variant="outline" className={cn('text-xs', quadrantConfig[row.quadrant].className)}>
                          {quadrantConfig[row.quadrant].label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {row.methodVersion}
                        {row.revisionNo ? ` · rev ${row.revisionNo}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={exportingId === row.project.id}
                        title="Unduh formulir evaluasi prioritas (PDF)"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDownloadForm(row.project);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    );
  };

  return (
    <SimpleLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <ListOrdered className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Master Project Queue</h1>
              <p className="text-muted-foreground">
                Peringkat terkini menurut {SOP_SOURCE_REFERENCE}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari proyek, unit, atau pengaju..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-12 pl-10"
              />
            </div>
            <Select value={masterFilter} onValueChange={setMasterFilter}>
              <SelectTrigger className="h-12 w-40">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {masterProyek.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <ArrowUpDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Urutan diperbarui otomatis setiap kali ada penilaian baru. Rapat skoring dan publikasi mingguan
            dijalankan di luar sistem — halaman ini menampilkan peringkat pada saat dibuka.
            {unassessedCount > 0 && (
              <>
                {' '}
                <strong className="text-warning">{unassessedCount} usulan belum dinilai</strong>{' '}
                dan belum masuk antrean; selesaikan penilaiannya di Antrean Approval.
              </>
            )}
          </p>
        </div>

        {(['mandatory', 'queued', 'gated'] as QueueLane[]).map((lane) => renderLane(lane, lanes[lane]))}
      </div>
    </SimpleLayout>
  );
}
