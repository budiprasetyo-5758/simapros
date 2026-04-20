import { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectUnitKerjaAssignments } from '@/hooks/useProjectUnitKerjaAssignments';
import { useUnitKerja } from '@/hooks/useUnitKerja';
import { useAuth } from '@/hooks/useAuth';

interface UnitKerjaAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
}

export function UnitKerjaAssignmentDialog({
  open,
  onClose,
  projectId,
  projectTitle,
}: UnitKerjaAssignmentDialogProps) {
  const { assignments, loading, assignUnitKerja, removeAssignment } = useProjectUnitKerjaAssignments(projectId);
  const { unitKerja, loading: unitKerjaLoading } = useUnitKerja();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!selectedId || !user) return;
    setIsAssigning(true);
    await assignUnitKerja(selectedId, user.id);
    setSelectedId('');
    setIsAssigning(false);
  };

  const availableUnits = unitKerja.filter(
    uk => !assignments.some(a => a.unit_kerja_id === uk.id)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Assign Unit Kerja ke Proyek
          </DialogTitle>
          {projectTitle && (
            <p className="text-sm text-muted-foreground">{projectTitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={selectedId}
              onValueChange={setSelectedId}
              disabled={unitKerjaLoading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pilih unit kerja..." />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map(uk => (
                  <SelectItem key={uk.id} value={uk.id}>
                    {uk.name}
                  </SelectItem>
                ))}
                {availableUnits.length === 0 && (
                  <SelectItem value="none" disabled>
                    Tidak ada unit kerja tersedia
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssign}
              disabled={!selectedId || isAssigning}
            >
              {isAssigning ? 'Menambah...' : 'Tambah'}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Unit Kerja yang Di-assign ({assignments.length})
            </h4>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Belum ada unit kerja yang di-assign
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {assignments.map(assignment => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-full bg-primary/10">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-medium">
                        {assignment.unit_kerja?.name || 'Unknown'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAssignment(assignment.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
