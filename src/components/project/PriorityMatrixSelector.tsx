import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Urgency, 
  Impact, 
  CalculatedPriority,
  calculatePriority, 
  urgencyOptions, 
  impactOptions, 
  priorityConfig 
} from '@/lib/priorityMatrix';
import { cn } from '@/lib/utils';

interface PriorityMatrixSelectorProps {
  urgency: Urgency;
  impact: Impact;
  onUrgencyChange: (value: Urgency) => void;
  onImpactChange: (value: Impact) => void;
  showResult?: boolean;
  disabled?: boolean;
}

export function PriorityMatrixSelector({
  urgency,
  impact,
  onUrgencyChange,
  onImpactChange,
  showResult = true,
  disabled = false,
}: PriorityMatrixSelectorProps) {
  const calculatedPriority = calculatePriority(urgency, impact);
  const priorityInfo = priorityConfig[calculatedPriority];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Urgensi (Likelihood)</Label>
          <Select value={urgency} onValueChange={onUrgencyChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih urgensi" />
            </SelectTrigger>
            <SelectContent>
              {urgencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
            <SelectContent>
              {impactOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showResult && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm text-muted-foreground">Prioritas Hasil:</span>
          <Badge variant="outline" className={cn('text-sm font-medium', priorityInfo.className)}>
            {priorityInfo.label}
          </Badge>
        </div>
      )}
    </div>
  );
}
