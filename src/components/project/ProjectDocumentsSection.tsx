import { useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useProjectDocuments, DOCUMENT_CATEGORIES } from '@/hooks/useProjectDocuments';
import { useAuth } from '@/hooks/useAuth';
import { AddDocumentDialog } from './AddDocumentDialog';
import { FileText, Download, Trash2, Plus } from 'lucide-react';

interface ProjectDocumentsSectionProps {
  projectId: string;
  canManage: boolean;
}

export function ProjectDocumentsSection({ projectId, canManage }: ProjectDocumentsSectionProps) {
  const { documents, isLoading, deleteDocument } = useProjectDocuments(projectId);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Group by category
  const grouped = documents.reduce<Record<string, typeof documents>>((acc, doc) => {
    const cat = doc.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Dokumen Project
          </CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Upload
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada dokumen</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(DOCUMENT_CATEGORIES).map(([catKey, catLabel]) => {
                const docs = grouped[catKey];
                if (!docs || docs.length === 0) return null;
                return (
                  <div key={catKey}>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{catLabel}</h4>
                    <div className="space-y-2">
                      {docs.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.document_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-[10px]">{catLabel}</Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(doc.created_at), 'd MMM yyyy', { locale: localeId })}
                              </span>
                            </div>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button variant="ghost" size="icon" asChild>
                              <a href={doc.document_url} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                            {canManage && (
                              <Button variant="ghost" size="icon" onClick={() => deleteDocument.mutate(doc.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AddDocumentDialog open={showAddDialog} onOpenChange={setShowAddDialog} projectId={projectId} />
    </>
  );
}
