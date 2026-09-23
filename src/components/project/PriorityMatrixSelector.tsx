import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Urgency,
  Impact,
  EffortScore,
  calculatePriority,
  calculateQuadrant,
  urgencyOptions,
  impactOptions,
  effortOptions,
  priorityConfig,
  quadrantConfig,
} from '@/lib/priorityMatrix';
import { cn } from '@/lib/utils';

interface PriorityMatrixSelectorProps {
  urgency?: Urgency;
  impact?: Impact;
  effort?: EffortScore;
  onUrgencyChange: (value: Urgency) => void;
  onImpactChange: (value: Impact) => void;
  onEffortChange: (value: EffortScore) => void;
  showResult?: boolean;
  disabled?: boolean;
}

export function PriorityMatrixSelector({
  urgency,
  impact,
  effort,
  onUrgencyChange,
  onImpactChange,
  onEffortChange,
  showResult = true,
  disabled = false,
}: PriorityMatrixSelectorProps) {
  // Keduanya harus dipilih sebelum hasil prioritas bermakna — nilai default
  // yang tersembunyi akan membuat HTO menentukan prioritas tanpa sadar.
  const calculatedPriority = urgency && impact ? calculatePriority(urgency, impact) : null;
  const priorityInfo = calculatedPriority ? priorityConfig[calculatedPriority] : null;

  // Kuadran butuh effort juga, jadi bisa saja prioritas sudah terhitung tapi
  // kuadran belum. Pola "tolak menebak" yang sama diterapkan ke effort.
  const quadrantInfo =
    calculatedPriority && effort
      ? quadrantConfig[calculateQuadrant(calculatedPriority, effort)]
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Urgensi (Cost of Delay)</Label>
          <Select value={urgency} onValueChange={onUrgencyChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih urgensi" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
              {urgencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground whitespace-normal">
                    {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Impact</Label>
          <Select value={impact} onValueChange={onImpactChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih impact" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
              {impactOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground whitespace-normal">
                    {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Effort / Kompleksitas</Label>
          <Select
            value={effort ? String(effort) : undefined}
            onValueChange={(value) => onEffortChange(Number(value) as EffortScore)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih tingkat effort" />
            </SelectTrigger>
            <SelectContent className="max-w-[min(28rem,calc(100vw-2rem))]">
              {effortOptions.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  <span className="font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground whitespace-normal">
                    {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Perhatikan arah skala: skor tinggi berarti <strong>lebih sulit</strong> dikerjakan.
            Jangan disalin dari Skor Kemudahan Implementasi RSB yang arahnya berkebalikan.
          </p>
        </div>
      </div>

      {showResult && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg flex-wrap">
            <span className="text-sm text-muted-foreground">Prioritas Hasil:</span>
            {priorityInfo ? (
              <Badge variant="outline" className={cn('text-sm font-medium', priorityInfo.className)}>
                {priorityInfo.label}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Pilih Urgensi dan Impact terlebih dahulu
              </span>
            )}

            <span className="text-sm text-muted-foreground ml-2">Kuadran:</span>
            {quadrantInfo ? (
              <Badge variant="outline" className={cn('text-sm font-medium', quadrantInfo.className)}>
                {quadrantInfo.label}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Pilih Effort terlebih dahulu
              </span>
            )}
          </div>

          {quadrantInfo && (
            <p className="text-xs text-muted-foreground px-3">
              <strong>{quadrantInfo.condition}.</strong> {quadrantInfo.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
