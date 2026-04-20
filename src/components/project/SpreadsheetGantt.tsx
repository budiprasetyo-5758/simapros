import { useState, useMemo, useRef, useEffect } from 'react';
import { format, parseISO, differenceInDays, eachDayOfInterval, getWeek, isSameDay, getMonth, getYear, isToday } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { GanttTask, TaskStatus, Project } from '@/types/project';
import { Plus, Save, X, FileSpreadsheet, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Pencil, SendHorizontal, Trash2, CornerDownRight, Maximize2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ExcelJS from 'exceljs';
import { supabase } from '@/integrations/supabase/client';
import { TaskEditRequestDialog } from './TaskEditRequestDialog';
import { AdminTaskEditDialog } from './AdminTaskEditDialog';
import { useTaskEditRequests } from '@/hooks/useTaskEditRequests';
import { FullscreenGanttDialog } from './FullscreenGanttDialog';
import { useNavigate } from 'react-router-dom';
import { AddPhaseDialog } from './AddPhaseDialog';
import { AddTaskDialog } from './AddTaskDialog';
import { ConfirmChangeDialog } from './ConfirmChangeDialog';
interface SpreadsheetGanttProps {
  tasks: GanttTask[];
  projectStartDate: string;
  projectEndDate: string;
  onAddTask: (task: Omit<GanttTask, 'id'>) => Promise<{ success: boolean }>;
  onUpdateTask: (taskId: string, updates: Partial<GanttTask>) => Promise<{ success: boolean }>;
  onDeleteTask: (taskId: string) => Promise<{ success: boolean }>;
  readOnly?: boolean;
  projectId: string;
  project?: Project;
  isAdmin?: boolean;
  isProjectExecutor?: boolean;
  isProjectOwner?: boolean;
  isFullscreen?: boolean;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  not_started: { label: 'Not Started', className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress', className: 'bg-primary/20 text-primary' },
  completed: { label: 'Completed', className: 'bg-success/20 text-success' },
  pending: { label: 'Pending', className: 'bg-warning/20 text-warning' },
};

const taskColors = [
  'bg-primary',
  'bg-success',
  'bg-warning',
  'bg-chart-4',
  'bg-chart-5',
  'bg-destructive',
];

const phaseColors: Record<string, string> = {
  planning: 'bg-chart-1',
  execution: 'bg-chart-2',
  evaluation: 'bg-chart-3',
  followup: 'bg-chart-4',
};

export function SpreadsheetGantt({
  tasks,
  projectStartDate,
  projectEndDate,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  readOnly = false,
  projectId,
  project,
  isAdmin = false,
  isProjectExecutor = false,
  isProjectOwner = false,
  isFullscreen = false,
}: SpreadsheetGanttProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());
  
  // Dialog states for adding phase and task
  const [addPhaseDialogOpen, setAddPhaseDialogOpen] = useState(false);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedParentTask, setSelectedParentTask] = useState<GanttTask | null>(null);
  const [selectedPhaseForTask, setSelectedPhaseForTask] = useState<string>('');
  // Delete confirmation states
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'task' | 'phase'; id: string; label: string } | null>(null);

  const [editValues, setEditValues] = useState<{
    wbs_number: string;
    name: string;
    description: string;
    pic: string;
    start_date: string;
    end_date: string;
    progress: number;
    status: TaskStatus;
    monev: string;
    phase: string;
    deliverable_result: string;
    problem: string;
  }>({ wbs_number: '', name: '', description: '', pic: '', start_date: '', end_date: '', progress: 0, status: 'not_started', monev: '', phase: '', deliverable_result: '', problem: '' });

  // Scroll container ref for drag scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Task edit request states
  const [editRequestDialogOpen, setEditRequestDialogOpen] = useState(false);
  const [selectedTaskForRequest, setSelectedTaskForRequest] = useState<GanttTask | null>(null);
  const [isNewTaskRequest, setIsNewTaskRequest] = useState(false);
  
  // Admin double-tap edit
  const [adminEditDialogOpen, setAdminEditDialogOpen] = useState(false);
  const [adminEditTask, setAdminEditTask] = useState<GanttTask | null>(null);
  
  const { 
    createTaskEditRequest, 
    createNewTaskRequest,
    createDeleteTaskRequest,
    hasPendingTaskRequest,
    pendingCount 
  } = useTaskEditRequests(projectId);

  // Project executors can now directly edit tasks without approval
  // Only project owners (regular users) need to request edits via approval
  const canRequestEdit = isProjectOwner && !isAdmin && !isProjectExecutor;

  const { toast } = useToast();

  // Removed: newTaskPhase is no longer needed as we use dialogs
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // On touch/pen devices, keep native swipe-to-scroll behavior.
    if (e.pointerType !== 'mouse') return;

    // Only left-click for mouse
    if (e.button !== 0) return;

    // Don't hijack interactions inside inputs/buttons/etc.
    if ((e.target as HTMLElement).closest('input, button, select, textarea, [role="dialog"]')) return;

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const rect = el.getBoundingClientRect();
    setIsDragging(true);
    setStartX(e.clientX - rect.left);
    setScrollLeft(el.scrollLeft);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!isDragging || !el) return;

    // Drag-to-scroll is mouse-only; this prevents blocking native touch scroll.
    if (e.pointerType !== 'mouse') return;

    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const walk = (x - startX) * 1.25;
    el.scrollLeft = scrollLeft - walk;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    setIsDragging(false);

    if (el && e) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Build task tree with subtasks
  const taskTree = useMemo(() => {
    const parentTasks = tasks.filter(t => !t.parent_task_id);
    const childTasks = tasks.filter(t => t.parent_task_id);
    
    return parentTasks.map(parent => ({
      ...parent,
      subtasks: childTasks.filter(child => child.parent_task_id === parent.id),
    }));
  }, [tasks]);

  // Group tasks by phase (Notion-style)
  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof taskTree> = {};
    const ungrouped: typeof taskTree = [];
    
    taskTree.forEach(task => {
      const phase = task.phase?.trim() || '';
      if (phase) {
        if (!groups[phase]) {
          groups[phase] = [];
        }
        groups[phase].push(task);
      } else {
        ungrouped.push(task);
      }
    });

    return { groups, ungrouped };
  }, [taskTree]);

  const togglePhase = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const toggleTask = (taskId: string) => {
    setCollapsedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const allPhases = Object.keys(groupedTasks.groups);

  const phasesToRender = allPhases;

  const allCollapsed = phasesToRender.length > 0 && phasesToRender.every((phase) => collapsedPhases.has(phase));

  const toggleAllPhases = () => {
    if (allCollapsed) {
      setCollapsedPhases(new Set());
    } else {
      setCollapsedPhases(new Set(phasesToRender));
    }
  };

  const getPhaseStats = (phaseTasks: typeof taskTree) => {
    const allTasks = phaseTasks.flatMap(t => [t, ...t.subtasks]);
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const avgProgress = total > 0 ? Math.round(allTasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;
    return { total, completed, avgProgress };
  };

  // Generate days for Gantt
  const days = useMemo(() => {
    if (!projectStartDate || !projectEndDate) return [];
    
    try {
      const start = parseISO(projectStartDate);
      const end = parseISO(projectEndDate);
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [projectStartDate, projectEndDate]);


  const today = useMemo(() => new Date(), []);

  // Group days by month for header
  const monthGroups = useMemo(() => {
    if (days.length === 0) return [];
    
    const groups: { label: string; count: number }[] = [];
    let currentKey = '';
    
    days.forEach(day => {
      const key = `${getYear(day)}-${getMonth(day)}`;
      if (key !== currentKey) {
        const label = format(day, 'MMMM yyyy', { locale: localeId });
        groups.push({ label, count: 1 });
        currentKey = key;
      } else {
        groups[groups.length - 1].count++;
      }
    });
    
    return groups;
  }, [days]);

  // Group days by week for header
  const weekGroups = useMemo(() => {
    if (days.length === 0) return [];
    
    const groups: { weekNum: number; days: Date[]; startDate: Date }[] = [];
    let currentWeek = -1;
    
    days.forEach(day => {
      const weekNum = getWeek(day, { weekStartsOn: 1 });
      if (weekNum !== currentWeek) {
        groups.push({ weekNum, days: [day], startDate: day });
        currentWeek = weekNum;
      } else {
        groups[groups.length - 1].days.push(day);
      }
    });
    
    return groups;
  }, [days]);

  const isDayInTask = (day: Date, task: GanttTask) => {
    try {
      const taskStart = parseISO(task.start_date);
      const taskEnd = parseISO(task.end_date);
      return day >= taskStart && day <= taskEnd;
    } catch {
      return false;
    }
  };

  const isFirstDayOfTask = (day: Date, task: GanttTask) => {
    try {
      const taskStart = parseISO(task.start_date);
      return isSameDay(day, taskStart);
    } catch {
      return false;
    }
  };

  const isLastDayOfTask = (day: Date, task: GanttTask) => {
    try {
      const taskEnd = parseISO(task.end_date);
      return isSameDay(day, taskEnd);
    } catch {
      return false;
    }
  };

  const canEdit = isAdmin || isProjectExecutor;

  const handleStartEdit = (task: GanttTask) => {
    if (!canEdit) return;
    setEditingTask(task.id);
    setEditValues({
      wbs_number: task.wbs_number,
      name: task.name,
      description: task.description,
      pic: task.pic,
      start_date: task.start_date,
      end_date: task.end_date,
      progress: task.progress,
      status: task.status,
      monev: task.monev,
      phase: task.phase || '',
      deliverable_result: task.deliverable_result || '',
      problem: task.problem || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    await onUpdateTask(editingTask, editValues);
    setEditingTask(null);
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
  };

  // Open dialog for adding subtask
  const handleAddSubtask = (parentTask: GanttTask) => {
    setSelectedParentTask(parentTask);
    setSelectedPhaseForTask(parentTask.phase || '');
    setAddTaskDialogOpen(true);
  };

  // Open dialog for adding phase
  const handleOpenAddPhase = () => {
    setAddPhaseDialogOpen(true);
  };

  // Handle adding phase with first task
  const handleAddPhaseWithTask = async (data: {
    phase: string;
    name: string;
    description: string;
    pic: string;
    start_date: string;
    end_date: string;
    status: TaskStatus;
    monev: string;
  }) => {
    // Calculate WBS for first task in new phase - start from .1
    const existingPhaseCount = allPhases.length;
    const phaseNumber = existingPhaseCount + 1;
    const wbsNumber = `${phaseNumber}.1`;

    const result = await onAddTask({
      project_id: projectId,
      wbs_number: wbsNumber,
      name: data.name,
      description: data.description,
      pic: data.pic,
      start_date: data.start_date,
      end_date: data.end_date,
      progress: 0,
      status: data.status,
      monev: data.monev,
      phase: data.phase,
      parent_task_id: null,
    });
    return result;
  };

  // Handle adding task/subtask from dialog
  const handleAddTaskFromDialog = async (data: {
    wbs_number: string;
    name: string;
    description: string;
    pic: string;
    start_date: string;
    end_date: string;
    status: TaskStatus;
    monev: string;
    phase: string;
    parent_task_id?: string | null;
  }) => {
    const result = await onAddTask({
      project_id: projectId,
      ...data,
      progress: 0,
    });
    return result;
  };

  const getTaskDuration = (task: GanttTask) => {
    try {
      return differenceInDays(parseISO(task.end_date), parseISO(task.start_date)) + 1;
    } catch {
      return 0;
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    const exportData = tasks.map((task, idx) => ({
      'WBS NUMBER': task.wbs_number || `${idx + 1}`,
      'TASK TITLE': task.name,
      'DESCRIPTION': task.description,
      'PIC': task.pic,
      'PHASE': task.phase || '',
      'START DATE': task.start_date ? format(parseISO(task.start_date), 'd MMM yyyy') : '',
      'DUE DATE': task.end_date ? format(parseISO(task.end_date), 'd MMM yyyy') : '',
      'DURATION': getTaskDuration(task),
      'PCT OF TASK COMPLETE': `${task.progress}%`,
      'STATUS': statusConfig[task.status]?.label || task.status,
      'MONEV': task.monev,
      'DELIVERABLE RESULT': task.deliverable_result || '',
      'PROBLEM': task.problem || '',
      'PARENT TASK': task.parent_task_id ? tasks.find(t => t.id === task.parent_task_id)?.name || '' : '',
    }));

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Task Tracker');

    // Project info header
    ws.addRow(['PROJECT TITLE', project?.title || '']);
    ws.addRow(['PROJECT MANAGER', project?.requester_name || '']);
    ws.addRow(['UNIT', project?.unit || '']);
    ws.addRow(['PERIOD', projectStartDate && projectEndDate ? `${format(parseISO(projectStartDate), 'd MMM yyyy')} - ${format(parseISO(projectEndDate), 'd MMM yyyy')}` : '']);
    ws.addRow([]);

    // Headers
    const headers = ['WBS NUMBER', 'TASK TITLE', 'DESCRIPTION', 'PIC', 'PHASE', 'START DATE', 'DUE DATE', 'DURATION', 'PCT OF TASK COMPLETE', 'STATUS', 'MONEV', 'DELIVERABLE RESULT', 'PROBLEM', 'PARENT TASK'];
    ws.addRow(headers);

    // Data rows
    exportData.forEach(row => {
      ws.addRow(Object.values(row));
    });

    // Column widths
    ws.columns = [
      { width: 12 }, { width: 25 }, { width: 40 }, { width: 15 }, { width: 15 }, { width: 12 },
      { width: 12 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 20 }, { width: 25 }, { width: 25 }, { width: 20 },
    ];

    const fileName = `${project?.title || 'Project'}_Task_Tracker_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate sticky left positions for frozen columns
  const frozenColumnWidths = {
    wbs: 45,
    taskTitle: isFullscreen ? 180 : 100,
  };

  // Track edited tasks for batch save
  const [editedTasks, setEditedTasks] = useState<Record<string, Partial<GanttTask>>>({});

  const handleFieldChange = (taskId: string, field: keyof GanttTask, value: string | number) => {
    setEditedTasks(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  const getEditedValue = (task: GanttTask, field: keyof GanttTask) => {
    return editedTasks[task.id]?.[field] ?? task[field];
  };

  const handleSaveAll = async () => {
    const promises = Object.entries(editedTasks).map(([taskId, updates]) => 
      onUpdateTask(taskId, updates)
    );
    await Promise.all(promises);
    setEditedTasks({});
    setIsEditMode(false);
  };

  const handleDeleteTask = async (task: GanttTask) => {
    // Delete subtasks first
    const subtasks = tasks.filter(t => t.parent_task_id === task.id);
    for (const sub of subtasks) {
      await onDeleteTask(sub.id);
    }
    await onDeleteTask(task.id);
    setDeleteConfirm(null);
    toast({ title: 'Task dihapus', description: `"${task.name}" berhasil dihapus` });
  };

  const handleDeletePhase = async (phase: string) => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    for (const task of phaseTasks) {
      // Delete subtasks first
      const subtasks = tasks.filter(t => t.parent_task_id === task.id);
      for (const sub of subtasks) {
        await onDeleteTask(sub.id);
      }
      await onDeleteTask(task.id);
    }
    setDeleteConfirm(null);
    toast({ title: 'Fase dihapus', description: `Fase "${phase}" dan semua task-nya berhasil dihapus` });
  };

  const handleCancelEditMode = () => {
    setEditedTasks({});
    setIsEditMode(false);
  };

  // Render task row (reused for parent and subtasks)
  const renderTaskRow = (task: GanttTask, taskIdx: number, isSubtask = false, phaseColor = 'bg-primary') => {
    const hasSubtasks = !isSubtask && taskTree.find(t => t.id === task.id)?.subtasks.length;
    const isCollapsed = collapsedTasks.has(task.id);
    
    return (
      <tr key={task.id} className={cn("hover:bg-muted/30", isSubtask && "bg-muted/10")} onDoubleClick={() => {
        if (isAdmin || isProjectExecutor) {
          setAdminEditTask(task);
          setAdminEditDialogOpen(true);
        }
      }}>
        {/* WBS - Frozen */}
        <td className="sticky left-0 z-10 bg-card border-r border-b border-border px-0.5 py-0.5" style={{ width: frozenColumnWidths.wbs }}>
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'wbs_number') as string} 
              onChange={(e) => handleFieldChange(task.id, 'wbs_number', e.target.value)} 
              className="h-5 text-[8px] px-1" 
              placeholder="1.1" 
            />
          ) : (
            <span className={cn("text-primary font-medium", isSubtask && "pl-2 text-muted-foreground")}>
              {isSubtask ? '' : task.wbs_number}
            </span>
          )}
        </td>

        {/* Task Name - Frozen */}
        <td className="sticky z-10 bg-card border-r border-b border-border px-0.5 py-0.5" style={{ left: frozenColumnWidths.wbs, width: frozenColumnWidths.taskTitle }}>
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'name') as string} 
              onChange={(e) => handleFieldChange(task.id, 'name', e.target.value)} 
              className="h-5 text-[8px] px-1" 
            />
          ) : (
            <div className="flex items-center gap-1">
              {isSubtask && <CornerDownRight className="w-3 h-3 text-muted-foreground shrink-0" />}
              {!isSubtask && hasSubtasks ? (
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className="shrink-0 p-0.5 hover:bg-muted rounded"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              ) : null}
              <span className={cn("font-medium flex-1", isSubtask && "text-muted-foreground text-[7px]")}>{task.name}</span>
              {canEdit && (
                <div className="flex flex-col gap-0.5 shrink-0">
                  {!isSubtask && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4"
                      onClick={() => handleAddSubtask(task)}
                      title="Tambah subtask"
                    >
                      <Plus className="w-2.5 h-2.5 text-muted-foreground" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => handleStartEdit(task)}
                    title="Edit task"
                  >
                    <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => setDeleteConfirm({ type: 'task', id: task.id, label: task.name })}
                    title="Hapus task"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                  </Button>
                </div>
              )}
              {canRequestEdit && !hasPendingTaskRequest(task.id) && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0"
                    onClick={() => {
                      setSelectedTaskForRequest(task);
                      setIsNewTaskRequest(false);
                      setEditRequestDialogOpen(true);
                    }}
                    title="Ajukan perubahan"
                  >
                    <Pencil className="w-2.5 h-2.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 shrink-0"
                    onClick={async () => {
                      if (confirm(`Ajukan penghapusan task "${task.name}"?`)) {
                        await createDeleteTaskRequest(task.id, projectId);
                      }
                    }}
                    title="Ajukan penghapusan"
                  >
                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                  </Button>
                </>
              )}
              {hasPendingTaskRequest(task.id) && (
                <span className="px-1 py-0.5 text-[6px] bg-warning/20 text-warning rounded" title="Ada permintaan pending">
                  Pending
                </span>
              )}
            </div>
          )}
        </td>
        
        {/* Description */}
        <td className="border-r border-b border-border px-0.5 py-0.5">
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'description') as string} 
              onChange={(e) => handleFieldChange(task.id, 'description', e.target.value)} 
              className="h-5 text-[8px] px-1" 
            />
          ) : task.description ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="text-muted-foreground line-clamp-1 cursor-help">{task.description}</span>
              </HoverCardTrigger>
              <HoverCardContent className="w-80 text-sm">
                <p className="font-medium mb-1">Deskripsi:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>

        {/* PIC */}
        <td className="border-r border-b border-border px-0.5 py-0.5 text-center">
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'pic') as string} 
              onChange={(e) => handleFieldChange(task.id, 'pic', e.target.value)} 
              className="h-5 text-[8px] px-1" 
            />
          ) : (
            <span>{task.pic}</span>
          )}
        </td>

        {/* Start Date */}
        <td className="border-r border-b border-border px-0 py-0.5 text-center">
          {isEditMode ? (
            <Input 
              type="date" 
              value={getEditedValue(task, 'start_date') as string} 
              onChange={(e) => handleFieldChange(task.id, 'start_date', e.target.value)} 
              className="h-5 text-[7px] px-0.5" 
            />
          ) : (
            <span className="text-[7px]">{format(parseISO(task.start_date), 'd/M')}</span>
          )}
        </td>
        
        {/* End Date */}
        <td className="border-r border-b border-border px-0 py-0.5 text-center">
          {isEditMode ? (
            <Input 
              type="date" 
              value={getEditedValue(task, 'end_date') as string} 
              onChange={(e) => handleFieldChange(task.id, 'end_date', e.target.value)} 
              className="h-5 text-[7px] px-0.5" 
            />
          ) : (
            <span className="text-[7px]">{format(parseISO(task.end_date), 'd/M')}</span>
          )}
        </td>
        
        {/* Progress */}
        <td className="border-r border-b border-border px-0 py-0.5 text-center">
          {isEditMode ? (
            <Input 
              type="number" 
              min={0} 
              max={100} 
              value={getEditedValue(task, 'progress') as number} 
              onChange={(e) => handleFieldChange(task.id, 'progress', parseInt(e.target.value) || 0)} 
              className="h-5 text-[8px] w-10 mx-auto px-0.5" 
            />
          ) : (
            <div className={cn(
              "inline-block px-1 py-0 rounded text-[7px] font-medium",
              task.progress === 100 ? "bg-success/20 text-success" : task.progress > 0 ? "bg-primary/20 text-primary" : "bg-muted"
            )}>
              {task.progress}%
            </div>
          )}
        </td>

        {/* Status */}
        <td className="border-r border-b border-border px-0 py-0.5 text-center">
          {isEditMode ? (
            <Select 
              value={getEditedValue(task, 'status') as TaskStatus} 
              onValueChange={(v) => handleFieldChange(task.id, 'status', v)}
            >
              <SelectTrigger className="h-5 text-[7px] px-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className={cn("inline-block px-1 py-0 rounded text-[7px] font-medium whitespace-nowrap", statusConfig[task.status]?.className || 'bg-muted')}>
              {statusConfig[task.status]?.label || task.status}
            </span>
          )}
        </td>

        {/* MONEV */}
        <td className="border-r border-b border-border px-0.5 py-0.5">
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'monev') as string} 
              onChange={(e) => handleFieldChange(task.id, 'monev', e.target.value)} 
              className="h-5 text-[8px] px-1" 
            />
          ) : task.monev ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="text-muted-foreground line-clamp-1 cursor-help">{task.monev}</span>
              </HoverCardTrigger>
              <HoverCardContent className="w-80 text-sm">
                <p className="font-medium mb-1">Monev:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{task.monev}</p>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>

        {/* Deliverable Result (Attachment) */}
        <td className="border-r border-b border-border px-0.5 py-0.5 text-center">
          {isEditMode ? (
            <div className="flex items-center gap-1">
              <input
                type="file"
                className="hidden"
                id={`deliverable-upload-${task.id}`}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    toast({ title: 'Error', description: 'Ukuran file maksimal 10MB', variant: 'destructive' });
                    return;
                  }
                  const ext = file.name.split('.').pop();
                  const filePath = `${projectId}/${task.id}/${Date.now()}.${ext}`;
                  const { data, error } = await supabase.storage.from('deliverable-attachments').upload(filePath, file);
                  if (error) {
                    toast({ title: 'Upload gagal', description: error.message, variant: 'destructive' });
                    return;
                  }
                  const { data: urlData } = supabase.storage.from('deliverable-attachments').getPublicUrl(data.path);
                  handleFieldChange(task.id, 'deliverable_result', urlData.publicUrl);
                  toast({ title: 'Berhasil', description: 'File berhasil diupload' });
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-5 text-[7px] px-1"
                onClick={() => document.getElementById(`deliverable-upload-${task.id}`)?.click()}
              >
                <Plus className="w-3 h-3" />
              </Button>
              {(getEditedValue(task, 'deliverable_result') as string) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[7px] px-1 text-destructive"
                  onClick={() => handleFieldChange(task.id, 'deliverable_result', '')}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ) : task.deliverable_result ? (
            <a
              href={task.deliverable_result}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline text-[8px]"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span className="line-clamp-1">Lihat File</span>
            </a>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>

        {/* Problem */}
        <td className="border-r border-b border-border px-0.5 py-0.5">
          {isEditMode ? (
            <Input 
              value={getEditedValue(task, 'problem') as string} 
              onChange={(e) => handleFieldChange(task.id, 'problem', e.target.value)} 
              className="h-5 text-[8px] px-1" 
            />
          ) : (task.problem) ? (
            <HoverCard>
              <HoverCardTrigger asChild>
                <span className="text-muted-foreground line-clamp-1 cursor-help">{task.problem}</span>
              </HoverCardTrigger>
              <HoverCardContent className="w-80 text-sm">
                <p className="font-medium mb-1">Problem:</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{task.problem}</p>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>


        {/* Timeline cells */}
        {days.map((day, idx) => {
          const isInTask = isDayInTask(day, task);
          const isFirst = isFirstDayOfTask(day, task);
          const isLast = isLastDayOfTask(day, task);
          const barColor = isSubtask ? 'bg-muted-foreground/50' : phaseColor;
          const isTodayCol = isToday(day);
          const isActiveToday = isTodayCol && isInTask;
          
          if (!isInTask) {
            return (
              <td key={idx} className={cn(
                "border-r border-b border-border px-0 py-0 transition-colors duration-200",
                isTodayCol && "bg-primary/[0.06]"
              )}>
                <div className={cn("w-full", isFullscreen ? "h-5" : "h-3")} />
              </td>
            );
          }
          
          // Show HoverCard only on first day of task
          if (isFirst) {
            return (
              <td 
                key={idx} 
                className={cn(
                  'border-r border-b border-border px-0 py-0 transition-colors duration-200', 
                  barColor, 
                  isActiveToday && 'ring-2 ring-inset ring-primary shadow-sm'
                )}
              >
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <div className={cn("w-full cursor-pointer rounded-l", isFullscreen ? "h-5" : "h-3")} />
                  </HoverCardTrigger>
                  <HoverCardContent className="w-72 text-xs" side="top">
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-sm">{task.name}</p>
                        <p className="text-muted-foreground text-[10px]">WBS: {task.wbs_number || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">PIC:</span>
                          <span className="ml-1 font-medium">{task.pic || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phase:</span>
                          <span className="ml-1 font-medium">{task.phase || '-'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Mulai:</span>
                          <span className="ml-1 font-medium">{format(parseISO(task.start_date), 'd MMM yyyy', { locale: localeId })}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Selesai:</span>
                          <span className="ml-1 font-medium">{format(parseISO(task.end_date), 'd MMM yyyy', { locale: localeId })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] mb-0.5">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{task.progress}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className={cn("h-1.5 rounded-full", task.progress === 100 ? "bg-success" : "bg-primary")} 
                              style={{ width: `${task.progress}%` }} 
                            />
                          </div>
                        </div>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusConfig[task.status]?.className)}>
                          {statusConfig[task.status]?.label}
                        </span>
                      </div>
                      {task.description && (
                        <div className="pt-1 border-t border-border">
                          <p className="text-muted-foreground text-[10px] line-clamp-2">{task.description}</p>
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </td>
            );
          }
          
          return (
            <td 
              key={idx} 
              className={cn(
                'border-r border-b border-border px-0 py-0 transition-colors duration-200', 
                barColor, 
                isActiveToday && 'ring-2 ring-inset ring-primary shadow-sm'
              )}
            >
              <div className={cn("w-full", isLast && "rounded-r", isFullscreen ? "h-5" : "h-3")} />
            </td>
          );
        })}
      </tr>
    );
  };

  // renderNewTaskRow removed - using dialogs instead

  const ganttContent = (
    <div className={cn("border border-border rounded-lg overflow-hidden", isFullscreen && "h-full flex flex-col")}>
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            <strong>Periode:</strong>{' '}
            {projectStartDate && projectEndDate ? (
              <>
                {format(parseISO(projectStartDate), 'd MMM yyyy', { locale: localeId })} - 
                {format(parseISO(projectEndDate), 'd MMM yyyy', { locale: localeId })}
              </>
            ) : 'Belum ditentukan'}
          </p>
          {allPhases.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleAllPhases} 
              className="gap-1.5 text-xs h-7"
            >
              {allCollapsed ? (
                <>
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                  Expand All
                </>
              ) : (
                <>
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                  Collapse All
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            isEditMode ? (
              <>
                <Button variant="default" size="sm" onClick={handleSaveAll} className="gap-1.5 h-7">
                  <Save className="w-3.5 h-3.5" />
                  Simpan
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelEditMode} className="gap-1.5 h-7">
                  <X className="w-3.5 h-3.5" />
                  Batal
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="gap-1.5 h-7">
                <Pencil className="w-3.5 h-3.5" />
                Edit Tabel
              </Button>
            )
          )}
          {canRequestEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setIsNewTaskRequest(true);
                setSelectedTaskForRequest(null);
                setEditRequestDialogOpen(true);
              }} 
              className="gap-1.5 h-7"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              Ajukan Task Baru
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-warning/20 text-warning rounded-full">
                  {pendingCount}
                </span>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-7">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export
          </Button>
          {!isFullscreen && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(`/project/${projectId}/gantt`, '_blank')}
              className="gap-1.5 h-7"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Fullscreen
            </Button>
          )}
        </div>
      </div>


      {/* Table with horizontal scroll - native scrollbar always visible */}
      <div 
        ref={scrollContainerRef}
        className={cn(
          "overflow-x-scroll overflow-y-auto gantt-scroll-container",
          isFullscreen && "flex-1"
        )}
        style={{ 
          WebkitOverflowScrolling: 'touch',
          minHeight: '200px',
          // Force scrollbar to always be visible
          scrollbarWidth: 'auto',
          scrollbarColor: 'hsl(var(--muted-foreground)) hsl(var(--muted))',
        }}
      >
        {/* Custom scrollbar styling */}
        <style>{`
          .gantt-scroll-container::-webkit-scrollbar {
            height: 12px;
            width: 12px;
          }
          .gantt-scroll-container::-webkit-scrollbar-track {
            background: hsl(var(--muted));
            border-radius: 6px;
          }
          .gantt-scroll-container::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.5);
            border-radius: 6px;
            border: 2px solid hsl(var(--muted));
          }
          .gantt-scroll-container::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground) / 0.7);
          }
        `}</style>
        <table className={cn("w-full border-collapse", isFullscreen ? "text-xs" : "text-[8px]")} style={{ minWidth: `${810 + days.length * (isFullscreen ? 24 : 14)}px` }}>
          <thead>
            {/* Month header row */}
            <tr className="bg-muted/80">
              <th className="sticky left-0 z-20 bg-muted/80 border-r border-b border-border" style={{ width: frozenColumnWidths.wbs, minWidth: frozenColumnWidths.wbs }} rowSpan={3}>
                <div className="px-0.5 py-0.5 text-left font-semibold">WBS</div>
              </th>
              <th className="sticky z-20 bg-muted/80 border-r border-b border-border" style={{ left: frozenColumnWidths.wbs, width: frozenColumnWidths.taskTitle, minWidth: frozenColumnWidths.taskTitle }} rowSpan={3}>
                <div className="px-0.5 py-0.5 text-left font-semibold">TASK</div>
              </th>
              <th className="border-r border-b border-border min-w-[80px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-left font-semibold">DESC</div>
              </th>
              <th className="border-r border-b border-border w-[40px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">PIC</div>
              </th>
              <th className="border-r border-b border-border w-[50px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">START</div>
              </th>
              <th className="border-r border-b border-border w-[50px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">DUE</div>
              </th>
              <th className="border-r border-b border-border w-[45px]" rowSpan={3}>
                <div className="px-0 py-0.5 text-center font-semibold">PROGRESS</div>
              </th>
              <th className="border-r border-b border-border w-[55px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">STATUS</div>
              </th>
              <th className="border-r border-b border-border min-w-[60px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">MONEV</div>
              </th>
              <th className="border-r border-b border-border min-w-[60px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">DELIVERABLE</div>
              </th>
              <th className="border-r border-b border-border min-w-[60px]" rowSpan={3}>
                <div className="px-0.5 py-0.5 text-center font-semibold">PROBLEM</div>
              </th>
              
              {/* Month headers */}
              {monthGroups.map((month, idx) => (
                <th 
                  key={idx}
                  colSpan={month.count}
                  className="border-r border-b border-border px-0 py-0.5 text-center font-semibold bg-primary/15"
                >
                  <div className={cn("leading-none whitespace-nowrap", isFullscreen ? "text-[10px]" : "text-[7px]")}>
                    {month.label}
                  </div>
                </th>
              ))}
            </tr>

            {/* Week header row */}
            <tr className="bg-muted/70">
              {/* Week headers spanning days */}
              {weekGroups.map((week, idx) => (
                <th 
                  key={idx}
                  colSpan={week.days.length}
                  className="border-r border-b border-border px-0 py-0 text-center font-medium bg-primary/10"
                >
                  <div className={cn("leading-none whitespace-nowrap", isFullscreen ? "text-[10px]" : "text-[7px]")}>
                    W{idx + 1}
                  </div>
                </th>
              ))}
            </tr>
            
            {/* Day header row */}
            <tr className="bg-muted">
              {days.map((day, idx) => {
                const isTodayCol = isToday(day);
                return (
                  <th 
                    key={idx}
                    className={cn(
                      "border-r border-b border-border px-0 text-center font-normal transition-colors duration-200",
                      isFullscreen ? "w-[24px] min-w-[24px] py-0.5" : "w-[14px] min-w-[14px] py-0.5",
                    )}
                    title={format(day, 'd MMMM yyyy', { locale: localeId })}
                  >
                    <div className={cn(
                      "leading-none mx-auto flex items-center justify-center transition-all duration-300",
                      isFullscreen ? "text-[9px]" : "text-[6px]",
                      isTodayCol 
                        ? cn(
                            "bg-primary text-primary-foreground font-bold rounded-full shadow-sm",
                            isFullscreen ? "w-5 h-5" : "w-3.5 h-3.5"
                          )
                        : "text-muted-foreground"
                    )}>
                      {format(day, 'd')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Grouped tasks by phase - Notion style */}
            {Object.entries(groupedTasks.groups).map(([phase, phaseTasks]) => {
              const isCollapsed = collapsedPhases.has(phase);
              const stats = getPhaseStats(phaseTasks);
              const phaseColor = phaseColors[phase.toLowerCase()] || 'bg-primary';
              
              return (
                <React.Fragment key={`phase-${phase}`}>
                  {/* Phase Header Row - Notion style */}
                  <tr 
                    className="bg-card cursor-pointer group"
                    onClick={() => togglePhase(phase)}
                  >
                    <td 
                      colSpan={11 + days.length} 
                      className="sticky left-0 z-10 border-b border-border px-2 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          )}
                          <div className={cn("w-2 h-2 rounded-full", phaseColor)} />
                          <span className="font-semibold text-sm">{phase}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {stats.total} tugas
                        </span>
                        <div className="flex items-center gap-1.5 ml-2">
                          <div className="w-16 bg-muted rounded-full h-1.5">
                            <div 
                              className={cn("h-1.5 rounded-full", phaseColor)} 
                              style={{ width: `${stats.avgProgress}%` }} 
                            />
                          </div>
                          <span className="text-muted-foreground text-[10px]">{stats.avgProgress}%</span>
                        </div>
                        {isEditMode && canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'phase', id: phase, label: phase });
                            }}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Hapus Fase
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Task Rows (hidden if collapsed) */}
                  {!isCollapsed && phaseTasks.map((task, taskIdx) => {
                    const isTaskCollapsed = collapsedTasks.has(task.id);
                    return (
                      <React.Fragment key={task.id}>
                        {renderTaskRow(task, taskIdx, false, phaseColor)}
                        {/* Subtasks */}
                        {!isTaskCollapsed && task.subtasks.map((subtask, subIdx) => 
                          renderTaskRow(subtask, subIdx, true, phaseColor)
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Ungrouped tasks */}
            {groupedTasks.ungrouped.length > 0 && (
              <>
                {allPhases.length > 0 && (
                  <tr className="bg-card">
                    <td 
                      colSpan={10 + days.length} 
                      className="sticky left-0 z-10 border-b border-border px-2 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <span className="font-semibold text-sm text-muted-foreground">Tanpa Fase</span>
                        <span className="text-muted-foreground text-xs">
                          {groupedTasks.ungrouped.length} tugas
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
                {groupedTasks.ungrouped.map((task, taskIdx) => {
                  const isTaskCollapsed = collapsedTasks.has(task.id);
                  return (
                    <React.Fragment key={task.id}>
                      {renderTaskRow(task, taskIdx, false, 'bg-muted-foreground')}
                      {!isTaskCollapsed && task.subtasks.map((subtask, subIdx) => 
                        renderTaskRow(subtask, subIdx, true, 'bg-muted-foreground')
                      )}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Phase Button */}
      {canEdit && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={handleOpenAddPhase} className="gap-2">
            <Plus className="w-4 h-4" />
            Tambah Fase
          </Button>
        </div>
      )}

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="px-4 py-8 text-center text-muted-foreground">
          <p>Belum ada tugas yang ditambahkan</p>
          {canEdit && (
            <Button variant="link" onClick={handleOpenAddPhase} className="mt-2">
              Tambah fase pertama
            </Button>
          )}
          {canRequestEdit && (
            <Button 
              variant="link" 
              onClick={() => {
                setIsNewTaskRequest(true);
                setSelectedTaskForRequest(null);
                setEditRequestDialogOpen(true);
              }} 
              className="mt-2"
            >
              Ajukan task pertama
            </Button>
          )}
        </div>
      )}

      {/* Task Edit Request Dialog */}
      <TaskEditRequestDialog
        open={editRequestDialogOpen}
        onClose={() => {
          setEditRequestDialogOpen(false);
          setSelectedTaskForRequest(null);
          setIsNewTaskRequest(false);
        }}
        task={selectedTaskForRequest}
        projectId={projectId}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        isNewTask={isNewTaskRequest}
        onSubmit={async (changes) => {
          if (isNewTaskRequest) {
            return createNewTaskRequest(projectId, {
              name: changes.proposed_name || '',
              description: changes.proposed_description || '',
              pic: changes.proposed_pic || '',
              phase: changes.proposed_phase || '',
              start_date: changes.proposed_start_date || projectStartDate,
              end_date: changes.proposed_end_date || projectStartDate,
              progress: changes.proposed_progress || 0,
              status: (changes.proposed_status as TaskStatus) || 'not_started',
              monev: changes.proposed_monev || '',
              wbs_number: changes.proposed_wbs_number || '',
            });
          } else if (selectedTaskForRequest) {
            return createTaskEditRequest(selectedTaskForRequest.id, projectId, changes);
          }
          return { success: false };
        }}
      />

      {/* Add Phase Dialog */}
      <AddPhaseDialog
        open={addPhaseDialogOpen}
        onClose={() => setAddPhaseDialogOpen(false)}
        onSubmit={handleAddPhaseWithTask}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        existingPhases={allPhases}
      />

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={addTaskDialogOpen}
        onClose={() => {
          setAddTaskDialogOpen(false);
          setSelectedParentTask(null);
        }}
        onSubmit={handleAddTaskFromDialog}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        parentTask={selectedParentTask}
        siblingTasks={tasks}
        phase={selectedPhaseForTask}
      />

      {/* Admin Double-Tap Edit Dialog */}
      <AdminTaskEditDialog
        open={adminEditDialogOpen}
        onClose={() => {
          setAdminEditDialogOpen(false);
          setAdminEditTask(null);
        }}
        task={adminEditTask}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        onSubmit={async (taskId, updates) => {
          return onUpdateTask(taskId, updates);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmChangeDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (!deleteConfirm) return;
          if (deleteConfirm.type === 'task') {
            const task = tasks.find(t => t.id === deleteConfirm.id);
            if (task) await handleDeleteTask(task);
          } else {
            await handleDeletePhase(deleteConfirm.id);
          }
        }}
        title={deleteConfirm?.type === 'phase' ? `Hapus Fase "${deleteConfirm?.label}"?` : `Hapus Task "${deleteConfirm?.label}"?`}
        description={deleteConfirm?.type === 'phase' 
          ? 'Semua task dalam fase ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.'
          : 'Task beserta subtask-nya akan dihapus. Tindakan ini tidak dapat dibatalkan.'
        }
      />
    </div>
  );

  return ganttContent;
}

// Need to import React for Fragment
import React from 'react';
