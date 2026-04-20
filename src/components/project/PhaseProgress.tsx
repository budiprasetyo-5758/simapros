import { useState } from 'react';
import { StageNotes, ProjectStage } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, Circle, Save, Edit2 } from 'lucide-react';

interface PhaseProgressProps {
  currentStage: ProjectStage;
  stageNotes: StageNotes;
  onUpdateStage?: (stage: ProjectStage) => void;
  onUpdateNote?: (stage: ProjectStage, note: string) => void;
  readOnly?: boolean;
}

const stages: { key: ProjectStage; label: string; description: string }[] = [
  { key: 'planning', label: 'Perencanaan', description: 'Penyusunan rencana dan strategi' },
  { key: 'execution', label: 'Pelaksanaan', description: 'Eksekusi rencana yang telah disusun' },
  { key: 'evaluation', label: 'Evaluasi', description: 'Evaluasi hasil pelaksanaan' },
  { key: 'followup', label: 'Tindak Lanjut', description: 'Perbaikan dan tindak lanjut' },
];

export function PhaseProgress({
  currentStage,
  stageNotes,
  onUpdateStage,
  onUpdateNote,
  readOnly = false,
}: PhaseProgressProps) {
  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null);
  const [editNote, setEditNote] = useState('');

  const currentStageIndex = stages.findIndex(s => s.key === currentStage);

  const handleEditNote = (stage: ProjectStage) => {
    setEditingStage(stage);
    setEditNote(stageNotes[stage] || '');
  };

  const handleSaveNote = () => {
    if (editingStage && onUpdateNote) {
      onUpdateNote(editingStage, editNote);
      setEditingStage(null);
    }
  };

  const handleSetStage = (stage: ProjectStage) => {
    if (onUpdateStage) {
      onUpdateStage(stage);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-6">
        {stages.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          
          return (
            <div key={stage.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => !readOnly && handleSetStage(stage.key)}
                  disabled={readOnly}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    isCompleted && 'bg-success text-success-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                    !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
                    !readOnly && 'hover:ring-2 hover:ring-primary/30 cursor-pointer'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-bold">{index + 1}</span>
                  )}
                </button>
                <span className={cn(
                  'text-xs mt-2 text-center',
                  isCurrent ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}>
                  {stage.label}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className={cn(
                  'flex-1 h-1 mx-2 rounded',
                  index < currentStageIndex ? 'bg-success' : 'bg-muted'
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {stages.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const note = stageNotes[stage.key];

          return (
            <Card key={stage.key} className={cn(
              'transition-all',
              isCurrent && 'ring-2 ring-primary'
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{stage.label}</CardTitle>
                    {isCompleted && (
                      <Badge variant="outline" className="bg-success/10 text-success text-xs">
                        Selesai
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
                        Aktif
                      </Badge>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleEditNote(stage.key)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{stage.description}</p>
              </CardHeader>
              <CardContent>
                {editingStage === stage.key ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Tambahkan catatan fase..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNote} className="gap-1">
                        <Save className="w-4 h-4" />
                        Simpan
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingStage(null)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className={cn(
                    'text-sm',
                    note ? 'text-foreground' : 'text-muted-foreground italic'
                  )}>
                    {note || 'Belum ada catatan'}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
