// DEPRECATED — DIJADWALKAN UNTUK DIHAPUS. JANGAN DIIMPOR LAGI.
//
// Komponen ini adalah formulir penilaian metode lama `HTO-T2-1.0` (7 kriteria
// skala 1-5, 8 gate yang mem-veto, ambang GO/Conditional/Defer/No-Go). Sejak
// penerapan SOP/HTO/001/2026 rev 02 komponen ini sudah tidak punya satu pun
// pemakai — penggantinya `SopMandatoryGateSelector` + `SopPriorityScoringSelector`.
//
// Teksnya kini AKTIF SALAH terhadap SOP yang berlaku: menyebut "Gate gagal
// menghasilkan rekomendasi No-Go" (SOP 5.3 melarang kalkulator menolak) dan
// menampilkan skor "dari 5.00" (skala SOP 1-10). Menghidupkannya kembali akan
// menuntun penilai pada aturan yang sudah dibatalkan.
//
// Untuk MERENDER snapshot lama, pakai `buildPriorityAssessmentView()` di
// `src/lib/priorityAssessmentView.ts` — snapshot lama tetap dibaca pada skalanya
// sendiri dan tidak pernah dihitung ulang.
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck, XCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  EFFORT_BARS,
  PRIORITY_CRITERIA,
  PRIORITY_GATES,
  calculatePriorityAssessment,
  recommendationConfig,
} from '@/lib/priorityScoring';
import type {
  PriorityAssessmentDraft,
  PriorityCriterionKey,
  PriorityGateKey,
  PriorityScore,
} from '@/types/priorityAssessment';
import { cn } from '@/lib/utils';

interface PriorityScoringSelectorProps {
  value: PriorityAssessmentDraft;
  onChange: (value: PriorityAssessmentDraft) => void;
  disabled?: boolean;
}

const quadrantLabels = {
  quick_win: 'Quick Win',
  big_bet: 'Big Bet',
  fill_in: 'Fill-in',
  thankless: 'Thankless Task',
} as const;

function ScoreButton({
  score,
  description,
  selected,
  onClick,
  disabled,
}: {
  score: PriorityScore;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-auto min-h-24 items-start justify-start whitespace-normal p-3 text-left',
        selected && 'border-primary bg-primary/5 ring-2 ring-primary/20 hover:bg-primary/10',
      )}
    >
      <span className="space-y-1">
        <span className={cn(
          'inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted',
        )}>
          Skor {score}
        </span>
        <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

export function PriorityScoringSelector({ value, onChange, disabled = false }: PriorityScoringSelectorProps) {
  const result = calculatePriorityAssessment(value);

  const updateScore = (key: PriorityCriterionKey, score: PriorityScore) => {
    onChange({ ...value, scores: { ...value.scores, [key]: score } });
  };

  const updateNarrative = (
    field: 'justifications' | 'evidence',
    key: PriorityCriterionKey | 'effort',
    text: string,
  ) => {
    onChange({ ...value, [field]: { ...value[field], [key]: text } });
  };

  const updateGate = (key: PriorityGateKey, passed: boolean) => {
    onChange({ ...value, gates: { ...value.gates, [key]: passed } });
  };

  const recommendation = result.recommendation ? recommendationConfig[result.recommendation] : null;
  const completionPercent = Math.round(
    ((result.completedCriteria + (value.effort ? 1 : 0) + result.assessedGates) / 16) * 100,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">Gate Kelayakan Wajib</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Tandai setiap review sebagai Lulus atau Tidak Lulus. Gate gagal menghasilkan rekomendasi No-Go,
                tetapi keputusan formal tetap berada pada Steering Committee.
              </p>
            </div>
            <Badge variant="outline">
              {result.assessedGates}/8 diperiksa
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
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
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
                      Lulus
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      aria-pressed={gateValue === false}
                      onClick={() => updateGate(gate.key, false)}
                      className={cn(gateValue === false && 'border-destructive bg-destructive/10 text-destructive')}
                    >
                      Tidak Lulus
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {(result.failedGates.length > 0 || value.eligibilityNotes) && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="eligibility-notes">
                Catatan Kelayakan {result.failedGates.length > 0 && '*'}
              </Label>
              <Textarea
                id="eligibility-notes"
                value={value.eligibilityNotes}
                onChange={(event) => onChange({ ...value, eligibilityNotes: event.target.value })}
                disabled={disabled}
                rows={3}
                placeholder="Jelaskan gate yang belum lulus, risiko, pemilik tindak lanjut, dan syarat agar proyek dapat dinilai kembali..."
              />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">Skor Dampak Tertimbang (K1-K7)</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Pilih kalimat BARS yang paling sesuai. Tidak ada nilai awal agar penilaian selalu eksplisit.
              </p>
            </div>
            <Badge variant="outline">{result.completedCriteria}/7 dinilai</Badge>
          </div>

          <Accordion type="multiple" defaultValue={['k1']} className="mt-3">
            {PRIORITY_CRITERIA.map((criterion) => {
              const score = value.scores[criterion.key];
              const evidenceRequired = (score ?? 0) >= 4;
              return (
                <AccordionItem key={criterion.key} value={criterion.key} className="last:border-b-0">
                  <AccordionTrigger className="gap-3 text-left hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <Badge variant="secondary" className="shrink-0">
                        {Math.round(criterion.weight * 100)}%
                      </Badge>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{criterion.code} — {criterion.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{criterion.indicator}</span>
                      </span>
                      {score ? (
                        <Badge className="ml-auto shrink-0">Skor {score}</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto shrink-0 text-muted-foreground">Belum dinilai</Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {criterion.bars.map((option) => (
                        <ScoreButton
                          key={option.score}
                          score={option.score}
                          description={option.description}
                          selected={score === option.score}
                          onClick={() => updateScore(criterion.key, option.score)}
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
                          placeholder="Jelaskan kondisi proyek yang membuat jangkar BARS ini paling sesuai..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${criterion.key}-evidence`}>
                          Bukti / Referensi {evidenceRequired ? '*' : '(disarankan)'}
                        </Label>
                        <Input
                          id={`${criterion.key}-evidence`}
                          value={value.evidence[criterion.key] ?? ''}
                          onChange={(event) => updateNarrative('evidence', criterion.key, event.target.value)}
                          disabled={disabled}
                          placeholder="Nama dokumen, nomor temuan, tautan, atau lokasi lampiran"
                        />
                        <p className="text-xs text-muted-foreground">{criterion.evidenceHint}</p>
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
              Arah skala berbeda dari dampak: skor tinggi berarti semakin sulit. Effort menjadi pembagi Priority Index,
              bukan alasan otomatis untuk menggugurkan proyek berdampak tinggi.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {EFFORT_BARS.map((option) => (
              <ScoreButton
                key={option.score}
                score={option.score}
                description={option.description}
                selected={value.effort === option.score}
                onClick={() => onChange({ ...value, effort: option.score })}
                disabled={disabled}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="effort-justification">Dasar Penilaian Effort *</Label>
              <Textarea
                id="effort-justification"
                value={value.justifications.effort ?? ''}
                onChange={(event) => updateNarrative('justifications', 'effort', event.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="Jelaskan durasi, dependensi, kebutuhan SDM/vendor, risiko implementasi, dan asumsi estimasi..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effort-evidence">Bukti / Referensi {(value.effort ?? 0) >= 4 ? '*' : '(disarankan)'}</Label>
              <Input
                id="effort-evidence"
                value={value.evidence.effort ?? ''}
                onChange={(event) => updateNarrative('evidence', 'effort', event.target.value)}
                disabled={disabled}
                placeholder="Estimasi teknis, dependency map, proposal vendor, atau capacity plan"
              />
            </div>
          </div>
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

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/60 p-3 text-center">
            <p className="text-xs text-muted-foreground">Skor Dampak</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {result.weightedScore?.toFixed(2) ?? '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">dari 5.00</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-3 text-center">
            <p className="text-xs text-muted-foreground">Priority Index</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {result.priorityIndex?.toFixed(3) ?? '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">dampak ÷ effort</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Eligibility</span>
            {result.eligibilityStatus === 'eligible' ? (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Eligible</Badge>
            ) : result.eligibilityStatus === 'ineligible' ? (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">Ineligible</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">Belum lengkap</Badge>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Effort</span>
            <span className="font-medium">{value.effort ? `${value.effort}/5` : '—'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Kuadran</span>
            <span className="font-medium">{result.quadrant ? quadrantLabels[result.quadrant] : '—'}</span>
          </div>
        </div>

        {recommendation ? (
          <div className={cn('rounded-lg border p-3', recommendation.className)}>
            <div className="flex items-start gap-2">
              {result.recommendation === 'no_go' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold">{recommendation.label}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{recommendation.description}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Lengkapi tujuh skor, Effort, dan seluruh gate untuk memperoleh rekomendasi.
          </div>
        )}

        {result.failedGates.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-xs font-semibold text-destructive">{result.failedGates.length} gate tidak lulus</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {PRIORITY_GATES.filter((gate) => result.failedGates.includes(gate.key)).map((gate) => (
                <li key={gate.key}>{gate.label}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Skor dan rekomendasi adalah alat bantu. Keputusan final, jadwal, kapasitas, serta setiap override harus
          disahkan dan dicatat oleh Steering Committee.
        </p>
      </aside>
    </div>
  );
}
