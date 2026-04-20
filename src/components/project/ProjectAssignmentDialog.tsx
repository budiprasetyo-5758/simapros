import { useState, useEffect } from 'react';
import { UserPlus, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useProjectAssignments, ProjectAssignment } from '@/hooks/useProjectAssignments';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProjectAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string | null;
}

export function ProjectAssignmentDialog({ 
  open, 
  onClose, 
  projectId, 
  projectTitle 
}: ProjectAssignmentDialogProps) {
  const { assignments, loading, assignUser, removeAssignment } = useProjectAssignments(projectId);
  const { user } = useAuth();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    // Fetch only users with 'user' role (not admin/super_admin)
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'user');

    if (rolesError || !userRoles) {
      setUsersLoading(false);
      return;
    }

    const userIds = userRoles.map(r => r.user_id);
    if (userIds.length === 0) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds)
      .order('name');

    if (!error && data) {
      setUsers(data);
    }
    setUsersLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedUserId || !user) return;
    
    setIsAssigning(true);
    await assignUser(selectedUserId, user.id);
    setSelectedUserId('');
    setIsAssigning(false);
  };

  const handleRemove = async (assignmentId: string) => {
    await removeAssignment(assignmentId);
  };

  // Filter out already assigned users
  const availableUsers = users.filter(
    user => !assignments.some(a => a.user_id === user.id)
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Assign User ke Proyek
          </DialogTitle>
          {projectTitle && (
            <p className="text-sm text-muted-foreground">{projectTitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Add User Section */}
          <div className="flex gap-2">
            <Select 
              value={selectedUserId} 
              onValueChange={setSelectedUserId}
              disabled={usersLoading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Pilih user..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      {user.email && (
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {availableUsers.length === 0 && (
                  <SelectItem value="none" disabled>
                    Tidak ada user tersedia
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAssign} 
              disabled={!selectedUserId || isAssigning}
            >
              {isAssigning ? 'Menambah...' : 'Tambah'}
            </Button>
          </div>

          {/* Assigned Users List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              User yang Di-assign ({assignments.length})
            </h4>
            
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Belum ada user yang di-assign
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {assignments.map(assignment => {
                  const assignedUser = users.find(u => u.id === assignment.user_id);
                  return (
                    <div 
                      key={assignment.id} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-full bg-primary/10">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {assignedUser?.name || 'Unknown User'}
                          </p>
                          {assignedUser?.email && (
                            <p className="text-xs text-muted-foreground">
                              {assignedUser.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemove(assignment.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Catatan:</strong> User yang di-assign hanya dapat melihat progress proyek ini. 
              Mereka tidak dapat mengubah data proyek.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
