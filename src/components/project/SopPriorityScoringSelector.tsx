import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Wallet } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  EFFORT_BARS,
  PRIORITY_GATES,
  SOP_CRITERIA,
  SOP_EVIDENCE_MIN_SCORE,
  SOP_SCALE_MAX,
  calculateSopAssessment,
  sopFinancialGateConfig,
} from '@/lib/sopPriority2026';
import { recommendationConfig } from '@/lib/priorityScoring';
import type { EffortScore } from '@/lib/priorityMatrix';
import { EFFORT_HIGH_THRESHOLD, quadrantConfig } from '@/lib/priorityMatrix';
import type { SopBand } from '@/lib/sopPriority2026';
import type { PriorityGateKey } from '@/types/priorityAssessment';
import type {
  SopAssessmentDraft,
  SopCriterionKey,
  SopScore,
} from '@/types/sopPriority2026';
import { cn } from '@/lib/utils';

interface SopPriorityScoringSelectorProps {
  value: SopAssessmentDraft;
  onChange: (value: SopAssessmentDraft) => void;
  disabled?: boolean;
}

// Pemilih pita rubrik. Rubrik SOP memberi rentang beserta kalimatnya, bukan
// angka tunggal, sehingga penilai memilih KALIMAT dulu — baru menajamkan
// nilainya di dalam pita itu.
function BandSelector({
  band,
  selectedScore,
  onSelect,
  disabled,
}: {
  band: SopBand;
  selectedScore?: SopScore;
  onSelect: (score: SopScore) => void;
  disabled?: boolean;
}) {
  const active = selectedScore !== undefined && band.scores.includes(selectedScore);

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
            active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted',
          )}
        >
          {band.label}
        </span>
        {band.zone && (
          <span className="text-xs font-medium text-muted-foreground">{band.zone}</span>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{band.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {band.scores.map((score) => (
          <Button
            key={score}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            aria-pressed={selectedScore === score}
            onClick={() => onSelect(score)}
            className={cn(
              'h-8 w-9 p-0 tabular-nums',
              selectedScore === score && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {score}
          </Button>
        ))}
      </div>
    </div>
  );
}

// TAHAP 2 — Penilaian Pembobotan Kriteria (SOP Bab 6-8).
//
// Pertanyaan probing sengaja ditampilkan DI DALAM tiap kriteria, bukan di
// halaman terpisah: SOP 5.3 mewajibkan HTO menggali usulan superfisial alih-alih
// menolaknya, dan pertanyaan itu hanya berguna kalau terbaca tepat saat penilai
// sedang mewawancarai pemohon.
export function SopPriorityScoringSelector({
  value,
  onChange,
  disabled = false,
}: SopPriorityScoringSelectorProps) {
  const result = calculateSopAssessment(value);

  const updateScore = (key: SopCriterionKey, score: SopScore) => {
    onChange({ ...value, scores: { ...value.scores, [key]: score } });
  };

  const updateNarrative = (
    field: 'justifications' | 'evidence',
    key: SopCriterionKey | 'effort',
    text: string,
  ) => {
    onChange({ ...value, [field]: { ...value[field], [key]: text } });
  };

  const updateGate = (key: PriorityGateKey, complete: boolean) => {
    onChange({ ...value, gates: { ...value.gates, [key]: complete } });
  };

  const recommendation = result.recommendation ? recommendationConfig[result.recommendation] : null;
  const financialGate = result.financialGate ? sopFinancialGateConfig[result.financialGate] : null;
  // 5 kriteria + effort + 8 butir checklist + catatan probing = 15 langkah.
  const completionPercent = Math.round(
    ((result.completedCriteria
      + (value.effort ? 1 : 0)
      + result.assessedGates
      + (value.probing.notes.trim() ? 1 : 0)) / 15) * 100,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h4 className="font-semibold">Sesi Probing</h4>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="probing-date">Tanggal Sesi</Label>
              <Input
                id="probing-date"
                type="date"
                value={value.probing.date}
                onChange={(event) => onChange({ ...value, probing: { ...value.probing, date: event.target.value } })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="probing-participants">Peserta</Label>
              <Input
                id="probing-participants"
                value={value.probing.participants}
                onChange={(event) => onChange({ ...value, probing: { ...value.probing, participants: event.target.value } })}
                disabled={disabled}
                placeholder="Analis HTO, kepala unit pengaju, PIC teknis..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="probing-notes">Catatan Hasil Probing *</Label>
            <Textarea
              id="probing-notes"
              value={value.probing.notes}
              onChange={(event) => onChange({ ...value, probing: { ...value.probing, notes: event.target.value } })}
              disabled={disabled}
              rows={3}
              placeholder="Ringkas jawaban pemohon atas pertanyaan probing, angka yang berhasil digali, dan hal yang masih perlu diklarifikasi..."
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">Tahap 2 — Penilaian Pembobotan Kriteria (K1–K5)</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih pita rubrik yang paling sesuai, lalu tentukan nilai persisnya. Tidak ada nilai awal
                agar penilaian selalu eksplisit.
              </p>
            </div>
            <Badge variant="outline">{result.completedCriteria}/{SOP_CRITERIA.length} dinilai</Badge>
          </div>

          <Accordion type="multiple" defaultValue={['k1']} className="mt-3">
            {SOP_CRITERIA.map((criterion) => {
              const score = value.scores[criterion.key];
              const evidenceRequired = (score ?? 0) >= SOP_EVIDENCE_MIN_SCORE;

              return (
                <AccordionItem key={criterion.key} value={criterion.key} className="last:border-b-0">
                  <AccordionTrigger className="gap-3 text-left hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <Badge variant="secondary" className="shrink-0">
                        {Math.round(criterion.weight * 100)}%
                      </Badge>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {criterion.code} — {criterion.name}
                          {criterion.isFinancialGate && (
                            <span className="ml-2 text-xs font-medium text-warning">GATE</span>
                          )}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {criterion.indicator}
                        </span>
                      </span>
                      {score ? (
                        <Badge className="ml-auto shrink-0">Skor {score}</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto shrink-0 text-muted-foreground">
                          Belum dinilai
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <HelpCircle className="h-4 w-4" />
                        Tanyakan kepada pemohon
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {criterion.probingQuestions.map((question) => (
                          <li key={question} className="text-sm italic text-muted-foreground">
                            &ldquo;{question}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {criterion.bands.map((band) => (
                        <BandSelector
                          key={band.label}
                          band={band}
                          selectedScore={score}
                          onSelect={(nextScore) => updateScore(criterion.key, nextScore)}
                          disabled={disabled}
                        />
                      ))}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`${criterion.key}-justification`}>Konteks Penilaian *</Label>
                        <Textarea
                          id={`${criterion.key}-justification`}
                          value={value.justifications[criterion.key] ?? ''}
                          onChange={(event) => updateNarrative('justifications', criterion.key, event.target.value)}
                          disabled={disabled}
                          rows={3}
                          placeholder="Jelaskan kondisi proyek yang membuat pita rubrik ini paling sesuai..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${criterion.key}-evidence`}>
                          Bukti / Referensi {evidenceRequired ? '*' : '(disarankan)'}
                        </Label>
                        <Textarea
                          id={`${criterion.key}-evidence`}
                          value={value.evidence[criterion.key] ?? ''}
                          onChange={(event) => updateNarrative('evidence', criterion.key, event.target.value)}
                          disabled={disabled}
                          rows={3}
                          placeholder={criterion.evidenceHint}
                          className={cn(evidenceRequired && !value.evidence[criterion.key]?.trim() && 'border-warning')}
                        />
                        {evidenceRequired && (
                          <p className="text-xs text-muted-foreground">
                            Skor {SOP_EVIDENCE_MIN_SCORE}–{SOP_SCALE_MAX} wajib disertai bukti.
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div>
            <h4 className="font-semibold">Effort / Kompleksitas</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Effort tidak memengaruhi urutan Master Queue. Nilai ini hanya dipakai untuk label kuadran, perencanaan kapasitas, dan usulan jadwal.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {EFFORT_BARS.map((option) => (
              <Button
                key={option.score}
                type="button"
                variant="outline"
                aria-pressed={value.effort === option.score}
                disabled={disabled}
                onClick={() => onChange({ ...value, effort: option.score as EffortScore })}
                className={cn(
                  'h-auto min-h-24 items-start justify-start whitespace-normal p-3 text-left',
                  value.effort === option.score && 'border-primary bg-primary/5 ring-2 ring-primary/20 hover:bg-primary/10',
                )}
              >
                <span className="space-y-1">
                  <span className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
                    value.effort === option.score
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted',
                  )}>
                    Skor {option.score}
                  </span>
                  <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </Button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sop-effort-justification">Dasar Penilaian Effort *</Label>
              <Textarea
                id="sop-effort-justification"
                value={value.justifications.effort ?? ''}
                onChange={(event) => updateNarrative('justifications', 'effort', event.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="Jelaskan durasi, dependensi, kebutuhan SDM/vendor, risiko implementasi, dan asumsi estimasi..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sop-effort-evidence">
                Bukti / Referensi {(value.effort ?? 0) >= EFFORT_HIGH_THRESHOLD ? '*' : '(disarankan)'}
              </Label>
              <Input
                id="sop-effort-evidence"
                value={value.evidence.effort ?? ''}
                onChange={(event) => updateNarrative('evidence', 'effort', event.target.value)}
                disabled={disabled}
                placeholder="Estimasi teknis, dependency map, proposal vendor, atau capacity plan"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">Checklist Kelengkapan & Probing</h4>
            </div>
            <Badge variant="outline">
              {PRIORITY_GATES.length - result.incompleteGates.length}/{PRIORITY_GATES.length} lengkap
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {PRIORITY_GATES.map((gate) => {
              const gateValue = value.gates[gate.key];
              return (
                <div key={gate.key} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    {gateValue === true ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : gateValue === false ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{gate.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{gate.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      aria-pressed={gateValue === true}
                      onClick={() => updateGate(gate.key, true)}
                      className={cn(gateValue === true && 'border-success bg-success/10 text-success')}
                    >
                      Lengkap
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      aria-pressed={gateValue === false}
                      onClick={() => updateGate(gate.key, false)}
                      className={cn(gateValue === false && 'border-warning bg-warning/10 text-warning')}
                    >
                      Perlu Klarifikasi
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {(result.incompleteGates.length > 0 || value.eligibilityNotes) && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="sop-eligibility-notes">
                Catatan Kelayakan {result.incompleteGates.length > 0 && '*'}
              </Label>
              <Textarea
                id="sop-eligibility-notes"
                value={value.eligibilityNotes}
                onChange={(event) => onChange({ ...value, eligibilityNotes: event.target.value })}
                disabled={disabled}
                rows={3}
                placeholder="Jelaskan butir yang belum lengkap, pemilik tindak lanjut, dan rencana klarifikasinya..."
              />
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-4 xl:sticky xl:top-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">Hasil Penilaian</h4>
            <Badge variant="outline">{completionPercent}% lengkap</Badge>
          </div>
          <Progress value={completionPercent} className="mt-2 h-2" />
        </div>

        <div className="rounded-lg bg-muted/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Skor Akhir</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {result.totalScore?.toFixed(2) ?? '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            dari {SOP_SCALE_MAX.toFixed(2)} — dasar urutan Master Queue
          </p>
        </div>

        {financialGate && (
          <div className={cn('rounded-lg border p-3', financialGate.className)}>
            <p className="flex items-center gap-2 text-xs font-semibold">
              <Wallet className="h-4 w-4" />
              {financialGate.label}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">{financialGate.description}</p>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Checklist</span>
            {result.eligibilityStatus === 'eligible' ? (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Lengkap</Badge>
            ) : (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                Perlu klarifikasi
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Effort</span>
            <span className="font-medium">{value.effort ? `${value.effort}/5` : '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Priority Index</span>
            <span className="font-medium tabular-nums">{result.priorityIndex?.toFixed(3) ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Kuadran</span>
            <span className="font-medium">
              {result.quadrant ? quadrantConfig[result.quadrant].label : '—'}
            </span>
          </div>
        </div>

        {recommendation ? (
          <div className={cn('rounded-lg border p-3', recommendation.className)}>
            <p className="text-xs font-semibold">{recommendation.label}</p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">{recommendation.description}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            Lengkapi penilaian untuk melihat rekomendasi.
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Kalkulator hanya menghasilkan MANDATORY, MASTER QUEUE, atau GATED. Penundaan dan penolakan
          selalu merupakan keputusan manusia yang wajib disertai alasan.
        </p>
      </aside>
    </div>
  );
}
