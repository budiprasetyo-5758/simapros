import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminSidebarLayout } from '@/components/layout/AdminSidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import {
  useFollowUpMeetings,
  useFollowUpTasks,
  useFollowUpFiles,
  type MeetingWithDetails,
  type TaskWithMeeting,
  type FileWithMeta,
  type CreateMeetingInput,
} from '@/hooks/useFollowUp';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  ListChecks,
  Paperclip,
  CalendarDays,
  File as FileIcon,
  ClipboardList,
  ArrowUpDown,
  LayoutDashboard,
  CircleDashed,
  Target,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useTindakLanjut, useTindakLanjutStats } from '@/hooks/useTindakLanjut';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { usePicOptions } from '@/hooks/usePicOptions';

const CATEGORY_LABELS: Record<string, string> = {
  rapimtas: 'Rapimtas — Rapat Pimpinan Terbatas',
  rapim: 'Rapim — Rapat Pimpinan',
  others: 'Others — Lainnya',
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DatePicker({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}
          data-testid={testId}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {value ? format(value, 'd MMM yyyy', { locale: localeId }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} locale={localeId} />
      </PopoverContent>
    </Popover>
  );
}

interface TaskInput {
  title: string;
  pic: string;
  due_date: Date | undefined;
}

function AddMeetingDialog({
  open,
  onOpenChange,
  category,
  userId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: string;
  userId: string;
  onSubmit: (input: CreateMeetingInput) => Promise<void>;
}) {
  const isOthers = category === 'others';
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [tasks, setTasks] = useState<TaskInput[]>([{ title: '', pic: '', due_date: undefined }]);
  const [notulensiFiles, setNotulensiFiles] = useState<File[]>([]);
  const [pendukungFiles, setPendukungFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addTask = () => setTasks([...tasks, { title: '', pic: '', due_date: undefined }]);
  const removeTask = (idx: number) => {
    if (tasks.length <= 1) return;
    setTasks(tasks.filter((_, i) => i !== idx));
  };
  const updateTask = (idx: number, field: keyof TaskInput, val: string | Date | undefined) => {
    const copy = [...tasks];
    copy[idx] = { ...copy[idx], [field]: val };
    setTasks(copy);
  };

  const handleFiles = (setter: typeof setNotulensiFiles, fl: FileList | null) => {
    if (!fl) return;
    setter(prev => [...prev, ...Array.from(fl)]);
  };
  const removeFile = (setter: typeof setNotulensiFiles, idx: number) => {
    setter(prev => prev.filter((_, i) => i !== idx));
  };

  const isValid =
    meetingDate &&
    (!isOthers || title.trim()) &&
    tasks.length >= 1 &&
    tasks.every(t => t.title.trim() && t.pic.trim() && t.due_date);

  const handleSubmit = async () => {
    if (!isValid || !meetingDate) return;
    setSubmitting(true);
    try {
      await onSubmit({
        category,
        meeting_date: format(meetingDate, 'yyyy-MM-dd'),
        title: isOthers ? title.trim() : null,
        created_by: userId,
        tasks: tasks.map(t => ({
          title: t.title.trim(),
          pic: t.pic.trim(),
          due_date: format(t.due_date!, 'yyyy-MM-dd'),
        })),
        notulensiFiles,
        pendukungFiles,
      });
      setMeetingDate(undefined);
      setTitle('');
      setTasks([{ title: '', pic: '', due_date: undefined }]);
      setNotulensiFiles([]);
      setPendukungFiles([]);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Tanggal Meeting *</Label>
            <DatePicker value={meetingDate} onChange={setMeetingDate} placeholder="Pilih tanggal" testId="input-meeting-date" />
          </div>

          {isOthers && (
            <div>
              <Label>Nama Meeting *</Label>
              <Input
                data-testid="input-meeting-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Nama meeting"
              />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tasks *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTask} data-testid="button-add-task">
                <Plus className="w-4 h-4 mr-1" /> Tambah Task
              </Button>
            </div>
            {tasks.map((task, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium w-6">#{idx + 1}</span>
                  <Input
                    data-testid={`input-task-title-${idx}`}
                    value={task.title}
                    onChange={e => updateTask(idx, 'title', e.target.value)}
                    placeholder="Nama task"
                    className="flex-1"
                  />
                  {tasks.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(idx)} data-testid={`button-remove-task-${idx}`}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">PIC *</Label>
                    <Input
                      data-testid={`input-task-pic-${idx}`}
                      value={task.pic}
                      onChange={e => updateTask(idx, 'pic', e.target.value)}
                      placeholder="Penanggung jawab"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Due Date *</Label>
                    <DatePicker
                      value={task.due_date}
                      onChange={d => updateTask(idx, 'due_date', d)}
                      placeholder="Due date"
                      testId={`input-task-duedate-${idx}`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label>File Notulensi (opsional)</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload file notulensi</span>
              <input type="file" className="hidden" multiple onChange={e => handleFiles(setNotulensiFiles, e.target.files)} data-testid="input-notulensi-files" />
            </label>
            {notulensiFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {notulensiFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate flex-1">{f.name}</span>
                    <button onClick={() => removeFile(setNotulensiFiles, i)} className="text-destructive hover:underline">hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>File Pendukung (opsional)</Label>
            <label className="mt-1 flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Upload file pendukung</span>
              <input type="file" className="hidden" multiple onChange={e => handleFiles(setPendukungFiles, e.target.files)} data-testid="input-pendukung-files" />
            </label>
            {pendukungFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendukungFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate flex-1">{f.name}</span>
                    <button onClick={() => removeFile(setPendukungFiles, i)} className="text-destructive hover:underline">hapus</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting} data-testid="button-submit-meeting">
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MeetingCard({ meeting, onSelect }: { meeting: MeetingWithDetails; onSelect: (m: MeetingWithDetails) => void }) {
  const displayTitle = meeting.title
    ? meeting.title
    : format(new Date(meeting.meeting_date + 'T00:00:00'), 'd MMMM yyyy', { locale: localeId });

  const completedCount = meeting.tasks.filter(t => t.is_completed).length;

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
      onClick={() => onSelect(meeting)}
      data-testid={`card-meeting-${meeting.id}`}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{displayTitle}</h3>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5" />
              {format(new Date(meeting.meeting_date + 'T00:00:00'), 'd MMM yyyy', { locale: localeId })}
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="w-3.5 h-3.5" /> {completedCount}/{meeting.tasks.length} task
            </span>
            <span className="flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5" /> {meeting.files.length} file
            </span>
          </div>
        </div>
        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      </div>
    </Card>
  );
}

function MeetingDetailDialog({ meeting, open, onClose }: { meeting: MeetingWithDetails | null; open: boolean; onClose: () => void }) {
  if (!meeting) return null;

  const notulensiFiles = meeting.files.filter(f => f.file_category === 'notulensi');
  const pendukungFiles = meeting.files.filter(f => f.file_category === 'pendukung');
  const displayTitle = meeting.title
    ? meeting.title
    : format(new Date(meeting.meeting_date + 'T00:00:00'), 'd MMMM yyyy', { locale: localeId });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {format(new Date(meeting.meeting_date + 'T00:00:00'), 'd MMMM yyyy', { locale: localeId })}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Daftar Task</h4>
            {meeting.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Tidak ada task.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {meeting.tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3" data-testid={`task-item-${task.id}`}>
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium', task.is_completed && 'line-through text-muted-foreground')}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>PIC: {task.pic}</span>
                        <span>Due: {format(new Date(task.due_date + 'T00:00:00'), 'd MMM yyyy', { locale: localeId })}</span>
                      </div>
                      {task.is_completed && task.completed_at && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          Selesai pada {format(new Date(task.completed_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                        </p>
                      )}
                    </div>
                    {task.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">Pending</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {notulensiFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">File Notulensi</h4>
              {notulensiFiles.map(f => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline p-1" data-testid={`link-notulensi-${f.id}`}>
                  <Download className="w-4 h-4" /> {f.file_name}
                  {f.file_size && <span className="text-xs text-muted-foreground">({formatFileSize(f.file_size)})</span>}
                </a>
              ))}
            </div>
          )}

          {pendukungFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">File Pendukung</h4>
              {pendukungFiles.map(f => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline p-1" data-testid={`link-pendukung-${f.id}`}>
                  <Download className="w-4 h-4" /> {f.file_name}
                  {f.file_size && <span className="text-xs text-muted-foreground">({formatFileSize(f.file_size)})</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SortKey = 'title' | 'pic' | 'due_date' | 'is_completed';
type SortDir = 'asc' | 'desc';

function TaskMeetingTab({
  category,
  onToggleTask,
  togglePending,
}: {
  category: string;
  onToggleTask: (taskId: string, isCompleted: boolean) => void;
  togglePending: boolean;
}) {
  const { tasks, isLoading } = useFollowUpTasks(category);
  const [sortKey, setSortKey] = useState<SortKey>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [fileDialogFiles, setFileDialogFiles] = useState<FileWithMeta[] | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'pic') cmp = a.pic.localeCompare(b.pic);
      else if (sortKey === 'due_date') cmp = a.due_date.localeCompare(b.due_date);
      else if (sortKey === 'is_completed') cmp = Number(a.is_completed) - Number(b.is_completed);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [tasks, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">Belum ada task</p>
        <p className="text-sm mt-1">Tambahkan meeting dengan task terlebih dahulu.</p>
      </div>
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead>
      <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort(field)} data-testid={`sort-${field}`}>
        {label}
        <ArrowUpDown className={cn('w-3.5 h-3.5', sortKey === field ? 'text-foreground' : 'text-muted-foreground/50')} />
      </button>
    </TableHead>
  );

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Task" field="title" />
              <SortHeader label="PIC" field="pic" />
              <SortHeader label="Due Date" field="due_date" />
              <TableHead>File</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(task => (
              <TableRow key={task.id} data-testid={`task-row-${task.id}`}>
                <TableCell className="font-medium">
                  <span className={cn(task.is_completed && 'line-through text-muted-foreground')}>{task.title}</span>
                </TableCell>
                <TableCell>{task.pic}</TableCell>
                <TableCell>{format(new Date(task.due_date + 'T00:00:00'), 'd MMM yyyy', { locale: localeId })}</TableCell>
                <TableCell>
                  {task.meetingFiles.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-primary"
                      onClick={() => setFileDialogFiles(task.meetingFiles.map(f => ({ ...f, meetingTitle: task.meetingTitle, meetingDate: task.meetingDate })))}
                      data-testid={`button-files-${task.id}`}
                    >
                      <Paperclip className="w-3.5 h-3.5" /> {task.meetingFiles.length}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Checkbox
                      checked={task.is_completed}
                      onCheckedChange={(checked) => onToggleTask(task.id, !!checked)}
                      disabled={togglePending}
                      data-testid={`checkbox-task-${task.id}`}
                    />
                    {task.is_completed && task.completed_at && (
                      <span className="text-[10px] text-green-600 leading-tight" data-testid={`text-completed-${task.id}`}>
                        Selesai: {format(new Date(task.completed_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!fileDialogFiles} onOpenChange={() => setFileDialogFiles(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Meeting</DialogTitle>
          </DialogHeader>
          {fileDialogFiles && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {['notulensi', 'pendukung'].map(cat => {
                const catFiles = fileDialogFiles.filter(f => f.file_category === cat);
                if (catFiles.length === 0) return null;
                return (
                  <div key={cat}>
                    <h4 className="text-sm font-medium text-muted-foreground capitalize mb-1">File {cat}</h4>
                    {catFiles.map(f => (
                      <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline p-1" data-testid={`dialog-file-${f.id}`}>
                        <Download className="w-4 h-4" /> {f.file_name}
                        {f.file_size && <span className="text-xs text-muted-foreground">({formatFileSize(f.file_size)})</span>}
                      </a>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FileRepositoryTab({ category }: { category: string }) {
  const { files, isLoading } = useFollowUpFiles(category);
  const [subTab, setSubTab] = useState<'notulensi' | 'pendukung'>('notulensi');

  const filtered = files.filter(f => f.file_category === subTab);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={v => setSubTab(v as 'notulensi' | 'pendukung')}>
        <TabsList>
          <TabsTrigger value="notulensi" data-testid="subtab-notulensi">File Notulensi</TabsTrigger>
          <TabsTrigger value="pendukung" data-testid="subtab-pendukung">File Pendukung</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>Belum ada file {subTab}.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {filtered.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors" data-testid={`file-row-${f.id}`}>
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span>{formatFileSize(f.file_size)}</span>
                  <span>{format(new Date(f.created_at), 'd MMM yyyy', { locale: localeId })}</span>
                  <span>
                    Meeting: {f.meetingTitle || format(new Date(f.meetingDate + 'T00:00:00'), 'd MMM yyyy', { locale: localeId })}
                  </span>
                </div>
              </div>
              <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0" data-testid={`button-download-${f.id}`}>
                <Button variant="ghost" size="icon">
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TindakLanjutDialog({
  open,
  onOpenChange,
  category,
  userId,
  editItem,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: string;
  userId: string;
  editItem?: any;
}) {
  const { createTindakLanjut, updateTindakLanjut } = useTindakLanjut(category);
  const { activePicOptions: direksiOptions } = usePicOptions('coresec_direksi');
  const { activePicOptions: coresecOptions } = usePicOptions('coresec_coresec');
  const { activePicOptions: picOptions } = usePicOptions('coresec_pic');

  const [topik, setTopik] = useState('');
  const [masalah, setMasalah] = useState('');
  const [upaya, setUpaya] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [pic, setPic] = useState('');
  const [direksi, setDireksi] = useState('');
  const [coresec, setCoresec] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editItem && open) {
      setTopik(editItem.topik);
      setMasalah(editItem.masalah);
      setUpaya(editItem.upaya_tindak_lanjut);
      setActionPlan(editItem.action_plan);
      setDeadline(new Date(editItem.deadline));
      setPic(editItem.pic || '');
      setDireksi(editItem.direksi || '');
      setCoresec(editItem.coresec || '');
    } else if (open) {
      setTopik(''); setMasalah(''); setUpaya(''); setActionPlan(''); 
      setDeadline(undefined); setPic(''); setDireksi(''); setCoresec('');
    }
  }, [editItem, open]);

  const isValid = topik.trim() && masalah.trim() && upaya.trim() && actionPlan.trim() && deadline && pic.trim() && direksi.trim() && coresec.trim();

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const payload = {
        topik: topik.trim(),
        masalah: masalah.trim(),
        upaya_tindak_lanjut: upaya.trim(),
        action_plan: actionPlan.trim(),
        deadline: format(deadline!, 'yyyy-MM-dd'),
        pic: pic.trim(),
        direksi: direksi.trim(),
        coresec: coresec.trim(),
      };
      
      if (editItem) {
        await updateTindakLanjut.mutateAsync({
          id: editItem.id,
          ...payload
        });
      } else {
        await createTindakLanjut.mutateAsync({
          category,
          ...payload,
          created_by: userId,
        });
      }
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit Tindak Lanjut' : 'Tambah Tindak Lanjut'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Topik *</Label>
            <Input value={topik} onChange={e => setTopik(e.target.value)} placeholder="Topik tindak lanjut" />
          </div>
          <div>
            <Label>Masalah *</Label>
            <Textarea value={masalah} onChange={e => setMasalah(e.target.value)} placeholder="Deskripsi masalah" />
          </div>
          <div>
            <Label>Upaya Tindak Lanjut *</Label>
            <Textarea value={upaya} onChange={e => setUpaya(e.target.value)} placeholder="Upaya yang dilakukan" />
          </div>
          <div>
            <Label>Action Plan *</Label>
            <Textarea value={actionPlan} onChange={e => setActionPlan(e.target.value)} placeholder="Rencana aksi ke depan" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Direksi *</Label>
              <Select value={direksi} onValueChange={setDireksi}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Direksi" />
                </SelectTrigger>
                <SelectContent>
                  {direksiOptions.map(opt => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Coresec *</Label>
              <Select value={coresec} onValueChange={setCoresec}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Coresec" />
                </SelectTrigger>
                <SelectContent>
                  {coresecOptions.map(opt => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>PIC *</Label>
              <Select value={pic} onValueChange={setPic}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PIC" />
                </SelectTrigger>
                <SelectContent>
                  {picOptions.map(opt => <SelectItem key={opt.id} value={opt.name}>{opt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Deadline *</Label>
              <DatePicker value={deadline} onChange={setDeadline} placeholder="Pilih deadline" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TindakLanjutTab({ category, userId }: { category: string; userId: string }) {
  const { tindakLanjutList, isLoading, toggleStatus, deleteTindakLanjut } = useTindakLanjut(category);
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditItem(null); setShowDialog(true); }} size="sm">
          <Plus className="w-4 h-4 mr-2" /> Tambah Tindak Lanjut
        </Button>
      </div>

      {tindakLanjutList.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg bg-card">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Belum ada tindak lanjut</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tindakLanjutList.map(tl => (
            <Card key={tl.id} className="relative group cursor-pointer hover:shadow-md transition-all duration-200 overflow-hidden" onClick={() => { setEditItem(tl); setShowDialog(true); }}>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-base leading-tight line-clamp-2">{tl.topik}</h3>
                  <Badge variant={tl.status === 'open' ? 'outline' : 'secondary'} className={cn('flex-shrink-0', tl.status === 'open' ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50')}>
                    {tl.status.toUpperCase()}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Deadline</p>
                    <p className="flex items-center gap-1.5 mt-1 font-medium text-foreground"><CalendarDays className="w-3.5 h-3.5 text-primary" /> {format(new Date(tl.deadline + 'T00:00:00'), 'd MMM yyyy', { locale: localeId })}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Direksi</p>
                    <p className="truncate mt-1 font-medium text-foreground">{tl.direksi || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Coresec</p>
                    <p className="truncate mt-1 font-medium text-foreground">{tl.coresec || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">PIC</p>
                    <p className="truncate mt-1 font-medium text-foreground">{tl.pic || '-'}</p>
                  </div>
                </div>
              </div>
              <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-full p-0.5 z-10 shadow-sm border">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus.mutate({ id: tl.id, currentStatus: tl.status });
                  }}
                  disabled={toggleStatus.isPending}
                  title="Toggle Status"
                >
                  <CheckCircle2 className={cn("w-4 h-4", tl.status === 'open' ? 'text-emerald-600' : 'text-amber-600')} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Yakin ingin menghapus tindak lanjut ini?')) {
                      deleteTindakLanjut.mutate(tl.id);
                    }
                  }}
                  disabled={deleteTindakLanjut.isPending}
                  title="Hapus"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TindakLanjutDialog 
        open={showDialog} 
        onOpenChange={setShowDialog} 
        category={category} 
        userId={userId} 
        editItem={editItem}
      />
    </div>
  );
}

export default function FollowUpCategory() {
  const { category } = useParams<{ category: string }>();
  const { isSuperAdmin, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingWithDetails | null>(null);

  const validCategory = category && ['rapimtas', 'rapim', 'others'].includes(category) ? category : '';
  const { meetings, isLoading, createMeeting, toggleTaskCompletion } = useFollowUpMeetings(validCategory);
  const { stats, isLoading: statsLoading } = useTindakLanjutStats(validCategory);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
    if (!authLoading && category && !['rapimtas', 'rapim', 'others'].includes(category)) {
      navigate('/follow-up');
    }
  }, [authLoading, isSuperAdmin, category, navigate]);

  if (authLoading || !validCategory) return null;

  const categoryLabel = CATEGORY_LABELS[validCategory] || validCategory;

  return (
    <AdminSidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/follow-up')} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold" data-testid="text-category-title">{categoryLabel}</h1>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-4 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900">
            <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-full">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tindak Lanjut</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.total}</h3>}
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900">
            <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 rounded-full">
              <CircleDashed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status Open</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.open}</h3>}
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900">
            <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-full">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status Closed</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.closed}</h3>}
            </div>
          </Card>
        </div>

        <Tabs defaultValue="tindak-lanjut">
          <TabsList>
            <TabsTrigger value="tindak-lanjut" className="gap-1.5" data-testid="tab-tindak-lanjut">
              <Target className="h-4 w-4" /> Tindak Lanjut
            </TabsTrigger>
            <TabsTrigger value="meetings" className="gap-1.5" data-testid="tab-meetings">
              <ListChecks className="h-4 w-4" /> Meetings
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5" data-testid="tab-tasks">
              <ClipboardList className="h-4 w-4" /> Task Meeting
            </TabsTrigger>
            <TabsTrigger value="files" className="gap-1.5" data-testid="tab-files">
              <FolderOpen className="h-4 w-4" /> File Repository
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tindak-lanjut" className="mt-4">
            {user && <TindakLanjutTab category={validCategory} userId={user.id} />}
          </TabsContent>

          <TabsContent value="meetings" className="mt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-meeting">
                <Plus className="w-4 h-4 mr-2" /> Tambah Meeting
              </Button>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">Belum ada meeting</p>
                <p className="text-sm mt-1">Klik "Tambah Meeting" untuk membuat meeting pertama.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map(meeting => (
                  <MeetingCard key={meeting.id} meeting={meeting} onSelect={setSelectedMeeting} />
                ))}
              </div>
            )}
            <MeetingDetailDialog meeting={selectedMeeting} open={!!selectedMeeting} onClose={() => setSelectedMeeting(null)} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <TaskMeetingTab
              category={validCategory}
              onToggleTask={(taskId, isCompleted) => toggleTaskCompletion.mutate({ taskId, isCompleted })}
              togglePending={toggleTaskCompletion.isPending}
            />
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <FileRepositoryTab category={validCategory} />
          </TabsContent>
        </Tabs>
      </div>

      {user && (
        <AddMeetingDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          category={validCategory}
          userId={user.id}
          onSubmit={async (input) => { await createMeeting.mutateAsync(input); }}
        />
      )}
    </AdminSidebarLayout>
  );
}
