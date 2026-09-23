import { AlertTriangle, CheckCircle2, CircleDashed, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SOP_MANDATORY_QUESTIONS, calculateSopAssessment } from '@/lib/sopPriority2026';
import type { SopAssessmentDraft, SopMandatoryKey } from '@/types/sopPriority2026';
import { cn } from '@/lib/utils';

interface SopMandatoryGateSelectorProps {
  value: SopAssessmentDraft;
  onChange: (value: SopAssessmentDraft) => void;
  disabled?: boolean;
}

// TAHAP 1 — Filtrasi Mandatory (SOP 5.1 / Formulir Evaluasi).
//
// Satu jawaban YES membuat proyek berstatus Priority 0 dan MELEWATI seluruh
// skoring Tahap 2. Karena itu setiap YES wajib menyertakan dasar tertulis —
// tanpa syarat itu, layar ini menjadi jalan pintas untuk menaikkan proyek apa
// pun ke puncak antrean hanya dengan satu klik.
export function SopMandatoryGateSelector({
  value,
  onChange,
  disabled = false,
}: SopMandatoryGateSelectorProps) {
  const result = calculateSopAssessment(value);

  const updateAnswer = (key: SopMandatoryKey, answer: boolean) => {
    onChange({
      ...value,
      mandatory: {
        ...value.mandatory,
        // Membatalkan YES ikut mengosongkan dasarnya supaya tidak ada dasar
        // menggantung yang tersimpan untuk jawaban NO.
        [key]: { answer, basis: answer ? value.mandatory[key].basis : '' },
      },
    });
  };

  const updateBasis = (key: SopMandatoryKey, basis: string) => {
    onChange({
      ...value,
      mandatory: { ...value.mandatory, [key]: { ...value.mandatory[key], basis } },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">Tahap 1 — Filtrasi Mandatory</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Jika <strong>salah satu</strong> dijawab YES, proyek berkategori MANDATORY (Priority 0 — Fast Track)
            dan skoring Tahap 2 dilewati. Jika <strong>semua</strong> NO, lanjutkan ke Tahap 2.
          </p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
          {result.mandatoryAnswered}/{SOP_MANDATORY_QUESTIONS.length} dijawab
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {SOP_MANDATORY_QUESTIONS.map((item) => {
          const answer = value.mandatory[item.key].answer;
          const basis = value.mandatory[item.key].basis;
          const basisMissing = answer === true && !basis.trim();

          return (
            <div
              key={item.key}
              className={cn(
                'rounded-lg border p-3',
                answer === true ? 'border-destructive/40 bg-destructive/5' : 'border-border',
              )}
            >
              <div className="flex items-start gap-2">
                {answer === true ? (
                  <Siren className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                ) : answer === false ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">
                  {item.number}. {item.question}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-xs">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-pressed={answer === true}
                  onClick={() => updateAnswer(item.key, true)}
                  className={cn(answer === true && 'border-destructive bg-destructive/10 text-destructive')}
                >
                  YES
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-pressed={answer === false}
                  onClick={() => updateAnswer(item.key, false)}
                  className={cn(answer === false && 'border-success bg-success/10 text-success')}
                >
                  NO
                </Button>
              </div>

              {answer === true && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor={`mandatory-basis-${item.key}`} className="text-xs">
                    Dasar Tertulis *
                  </Label>
                  <Textarea
                    id={`mandatory-basis-${item.key}`}
                    value={basis}
                    onChange={(event) => updateBasis(item.key, event.target.value)}
                    disabled={disabled}
                    rows={2}
                    placeholder={item.basisHint}
                    className={cn(basisMissing && 'border-destructive')}
                  />
                  {basisMissing && (
                    <p className="text-xs text-destructive">
                      Bypass Tahap 1 tidak dapat disimpan tanpa dasar tertulis.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {result.isMandatory ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <Siren className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              MANDATORY — Priority 0 (Fast Track)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Proyek menempati puncak Master Queue tanpa skoring. Tahap 2 tidak perlu diisi.
            </p>
          </div>
        </div>
      ) : result.mandatoryAnswered === SOP_MANDATORY_QUESTIONS.length ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-primary">
            Bukan proyek mandatory. Lanjutkan ke Tahap 2 — penilaian pembobotan kriteria.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-warning">
            Jawab ketiga pertanyaan untuk menentukan jalur penilaian.
          </p>
        </div>
      )}
    </div>
  );
}
