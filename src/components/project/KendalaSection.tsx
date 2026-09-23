import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Plus, Loader2, Save, X, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Project, ProjectObstacle } from '@/types/project';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface KendalaSectionProps {
  project: Project;
  isSuperAdmin: boolean;
  isProjectExecutor: boolean;
  onUpdate: () => void;
}

interface ObstacleWithAuthor extends ProjectObstacle {
  profiles?: { name: string } | null;
}

export function KendalaSection({ project, isSuperAdmin, isProjectExecutor, onUpdate }: KendalaSectionProps) {
  const [obstacles, setObstacles] = useState<ObstacleWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const canEdit = isSuperAdmin || isProjectExecutor;

  const fetchObstacles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_obstacles')
        .select(`
          id, project_id, note, is_resolved, created_at, created_by, updated_at,
          profiles:created_by(name)
        `)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setObstacles((data || []) as ObstacleWithAuthor[]);
    } catch (error) {
      console.error('Error fetching obstacles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchObstacles();
  }, [fetchObstacles]);

  const hasActiveObstacle = obstacles.some(o => !o.is_resolved);

  const handleAdd = async () => {
    if (!newNote.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('project_obstacles')
        .insert({
          project_id: project.id,
          note: newNote.trim(),
          created_by: user?.id,
        });

      if (error) throw error;

      toast({ title: 'Berhasil', description: 'Kendala baru ditambahkan.' });
      setNewNote('');
      setIsAdding(false);
      fetchObstacles();
      onUpdate();
    } catch (error) {
      console.error('Error adding obstacle:', error);
      toast({ title: 'Error', description: 'Gagal menambahkan kendala.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<ProjectObstacle>) => {
    try {
      const { error } = await supabase
        .from('project_obstacles')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      fetchObstacles();
      onUpdate();
    } catch (error) {
      console.error('Error updating obstacle:', error);
      toast({ title: 'Error', description: 'Gagal memperbarui kendala.', variant: 'destructive' });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editNote.trim()) return;
    setIsSaving(true);
    await handleUpdate(editingId, { note: editNote.trim() });
    setEditingId(null);
    setEditNote('');
    setIsSaving(false);
    toast({ title: 'Berhasil', description: 'Catatan kendala diperbarui.' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus kendala ini?')) return;
    try {
      const { error } = await supabase
        .from('project_obstacles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Berhasil', description: 'Kendala dihapus.' });
      fetchObstacles();
      onUpdate();
    } catch (error) {
      console.error('Error deleting obstacle:', error);
      toast({ title: 'Error', description: 'Gagal menghapus kendala.', variant: 'destructive' });
    }
  };

  if (!canEdit && obstacles.length === 0) {
    return null; // Non-editable users don't see anything if empty
  }

  return (
    <Card className={cn(
      "transition-colors",
      hasActiveObstacle ? "border-l-4 border-l-warning" : "border-l-4 border-l-success/50"
    )}>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2 pb-4">
        <CardTitle className={cn(
          "flex items-center gap-2",
          hasActiveObstacle ? "text-warning" : "text-foreground"
        )}>
          {hasActiveObstacle ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-success" />
          )}
          Kendala Proyek
        </CardTitle>
        
        {canEdit && !isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Tambah Kendala
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Form Add */}
        {isAdding && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-3 mb-4 border">
            <h4 className="text-sm font-semibold">Tambah Kendala Baru</h4>
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Jelaskan kendala/hambatan yang dialami proyek ini..."
              className="min-h-[100px] bg-white"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setIsAdding(false); setNewNote(''); }} disabled={isSaving}>
                Batal
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={isSaving || !newNote.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Simpan Kendala
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : obstacles.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50 text-success" />
            <p>Tidak ada kendala yang tercatat.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {obstacles.map(obs => (
              <div key={obs.id} className={cn(
                "p-4 rounded-lg border flex gap-3 transition-colors",
                obs.is_resolved ? "bg-muted/20 border-border/50" : "bg-warning/5 border-warning/20"
              )}>
                {/* Checkbox for resolving */}
                {canEdit && (
                  <div className="pt-1">
                    <Checkbox
                      checked={obs.is_resolved}
                      onCheckedChange={(checked) => handleUpdate(obs.id, { is_resolved: checked as boolean })}
                    />
                  </div>
                )}
                
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={obs.is_resolved ? "secondary" : "outline"} className={cn(
                          "text-[10px]",
                          !obs.is_resolved && "bg-warning/10 text-warning border-warning/20"
                        )}>
                          {obs.is_resolved ? 'Selesai' : 'Aktif'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          Dilaporkan oleh {obs.profiles?.name || 'User'} pada {format(parseISO(obs.created_at), 'd MMM yyyy, HH:mm', { locale: localeId })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    {canEdit && editingId !== obs.id && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingId(obs.id); setEditNote(obs.note); }}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(obs.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingId === obs.id ? (
                    <div className="space-y-2 mt-2">
                      <Textarea
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingId(null); setEditNote(''); }} className="h-7 text-xs">Batal</Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={isSaving || !editNote.trim()} className="h-7 text-xs">Simpan</Button>
                      </div>
                    </div>
                  ) : (
                    <p className={cn(
                      "text-sm whitespace-pre-wrap leading-relaxed",
                      obs.is_resolved ? "text-muted-foreground line-through opacity-70" : "text-foreground"
                    )}>
                      {obs.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
