import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Edit2, Save, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GanttTask, Project } from '@/types/project';

interface MonevSummarySectionProps {
  project: Project;
  tasks: GanttTask[];
  isSuperAdmin: boolean;
  onUpdate: () => void;
}

export function MonevSummarySection({ project, tasks, isSuperAdmin, onUpdate }: MonevSummarySectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(project.monev_summary || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Send monev summary notification to super admins via Gmail
  const sendMonevNotification = async (summary: string) => {
    try {
      // Get all super admins
      const { data: superAdmins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');

      if (!superAdmins) return;

      for (const admin of superAdmins) {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'monev_summary',
            userId: admin.user_id,
            projectId: project.id,
            projectTitle: project.title,
            monevSummary: summary,
            sendEmail: true,
          },
        });
      }
    } catch (error) {
      console.error('Error sending monev notification:', error);
    }
  };

   const saveMonev = async (value: string) => {
     setIsSaving(true);
     try {
       const { error } = await supabase
         .from('projects')
         .update({ monev_summary: value })
         .eq('id', project.id);
 
       if (error) throw error;
 
       toast({
         title: 'Berhasil',
         description: 'Rangkuman monev berhasil disimpan.',
       });
       setIsEditing(false);
       onUpdate();
     } catch (error) {
       console.error('Error saving monev:', error);
       toast({
         title: 'Error',
         description: 'Gagal menyimpan rangkuman monev.',
         variant: 'destructive',
       });
     } finally {
       setIsSaving(false);
     }
   };
 
   const handleSave = async () => {
     await saveMonev(editValue);
     await sendMonevNotification(editValue);
   };
 
   const handleCancel = () => {
     setEditValue(project.monev_summary || '');
     setIsEditing(false);
   };
 
   if (!isSuperAdmin) {
     // Non-super admin can only view
     if (!project.monev_summary) return null;
     
     return (
       <Card>
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <FileText className="w-5 h-5" />
             Rangkuman Monev
           </CardTitle>
         </CardHeader>
         <CardContent>
           <p className="text-muted-foreground whitespace-pre-wrap">{project.monev_summary}</p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
         <CardTitle className="flex items-center gap-2">
           <FileText className="w-5 h-5" />
           Rangkuman Monev
         </CardTitle>
         <div className="flex gap-2">
           {!isEditing && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => setIsEditing(true)}
               className="gap-2"
             >
               <Edit2 className="w-4 h-4" />
               Edit
             </Button>
           )}
           {isEditing && (
             <>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={handleCancel}
                 disabled={isSaving}
               >
                 <X className="w-4 h-4" />
               </Button>
               <Button
                 size="sm"
                 onClick={handleSave}
                 disabled={isSaving}
                 className="gap-2"
               >
                 {isSaving ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                 ) : (
                   <Save className="w-4 h-4" />
                 )}
                 Simpan
               </Button>
             </>
           )}
         </div>
       </CardHeader>
       <CardContent>
         {isEditing ? (
           <Textarea
             value={editValue}
             onChange={(e) => setEditValue(e.target.value)}
             placeholder="Tulis rangkuman monitoring dan evaluasi proyek..."
             className="min-h-[150px]"
           />
         ) : project.monev_summary ? (
           <p className="text-muted-foreground whitespace-pre-wrap">{project.monev_summary}</p>
         ) : (
           <div className="text-center py-8 text-muted-foreground">
             <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p>Belum ada rangkuman monev.</p>
             <p className="text-sm mt-1">Klik "Edit" untuk menulis rangkuman monitoring dan evaluasi.</p>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }