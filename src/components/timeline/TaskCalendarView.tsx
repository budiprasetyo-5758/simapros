import { useMemo, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday,
  addMonths, subMonths, addWeeks, subWeeks,
  addDays, subDays, addYears, subYears,
  differenceInCalendarDays,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FolderKanban, Calendar, Clock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewRange } from './TimelineCalendar';

export interface TaskCalendarItem {
  id: string;
  taskName: string;
  projectName: string;
  masterProyekName: string;
  startDate: string;
  endDate: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  projectId: string;
}

interface MeetingItem {
  id: string;
  meeting_date: string;
  title: string;
}

interface TaskCalendarViewProps {
  tasks: TaskCalendarItem[];
  onTaskClick: (projectId: string) => void;
  viewRange: ViewRange;
  onDateClick?: (date: Date) => void;
  meetings?: MeetingItem[];
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const STATUS_DOT_COLORS: Record<string, string> = {
  not_started: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  completed: 'bg-success',
  delayed: 'bg-destructive',
  on_hold: 'bg-warning',
  meeting: 'bg-rose-600',
};

const STATUS_BAR_COLORS: Record<string, string> = {
  not_started: 'bg-muted-foreground/20 border-muted-foreground/40',
  in_progress: 'bg-primary/15 border-primary/40',
  completed: 'bg-green-100 border-green-400 dark:bg-green-900/30 dark:border-green-600',
  delayed: 'bg-destructive/15 border-destructive/40',
  on_hold: 'bg-yellow-100 border-yellow-400 dark:bg-yellow-900/30 dark:border-yellow-600',
  meeting: 'bg-rose-100 border-rose-400 dark:bg-rose-900/30 dark:border-rose-600',
};

interface TaskSegment {
  task: TaskCalendarItem;
  colStart: number; // 0-indexed within the week
  colSpan: number;
  isStart: boolean;
  isEnd: boolean;
}

function getTaskSegmentsForWeek(
  tasks: TaskCalendarItem[],
  weekDays: Date[],
): TaskSegment[] {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const segments: TaskSegment[] = [];

  tasks.forEach(task => {
    const tEnd = new Date(task.endDate + 'T00:00:00');

    // Only show on the end_date
    if (tEnd < weekStart || tEnd > weekEnd) return;

    const colStart = differenceInCalendarDays(tEnd, weekStart);

    segments.push({
      task,
      colStart,
      colSpan: 1,
      isStart: true,
      isEnd: true,
    });
  });

  return segments;
}

function SpanningTaskBar({ segment, onTaskClick }: { segment: TaskSegment; onTaskClick: (id: string) => void }) {
  const { task, isStart, isEnd } = segment;
  const isMeeting = task.id.startsWith('meeting-');
  const barColor = STATUS_BAR_COLORS[task.status] || STATUS_BAR_COLORS.not_started;

  return (
    <div
      className={cn(
        'px-2 py-1 border text-[11px] leading-tight cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
        barColor,
        isStart && 'rounded-l-md',
        isEnd && 'rounded-r-md',
        !isStart && 'border-l-0',
        !isEnd && 'border-r-0',
      )}
      onClick={() => onTaskClick(isMeeting ? task.id : task.projectId)}
      title={`${task.taskName} — ${task.projectName}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[task.status] || 'bg-muted-foreground')} />
        <span className="font-semibold truncate text-card-foreground">{task.taskName}</span>
        {isMeeting && task.projectName && (
          <span className="flex items-center gap-0.5 text-muted-foreground flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            <span className="text-[10px]">{task.projectName}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[task.status] || 'bg-muted-foreground')} />
        <span className="truncate">{task.statusLabel}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
        <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">
          {format(new Date(task.startDate), 'd MMM', { locale: localeId })} → {format(new Date(task.endDate), 'd MMM', { locale: localeId })}
        </span>
      </div>
      {task.masterProyekName && (
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <FolderKanban className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{task.masterProyekName}</span>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onTaskClick }: { task: TaskCalendarItem; onTaskClick: (id: string) => void }) {
  return (
    <div
      className="p-2 rounded-md border bg-card hover:shadow-md transition-shadow cursor-pointer text-xs space-y-1.5"
      onClick={() => onTaskClick(task.id.startsWith('meeting-') ? task.id : task.projectId)}
    >
      <p className="font-semibold text-card-foreground line-clamp-2 leading-tight">{task.taskName}</p>
      <p className="text-muted-foreground line-clamp-1">📁 {task.projectName}</p>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">
          {format(new Date(task.startDate), 'd MMM', { locale: localeId })} → {format(new Date(task.endDate), 'd MMM yy', { locale: localeId })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT_COLORS[task.status] || 'bg-muted-foreground')} />
        <span className="text-muted-foreground">{task.statusLabel}</span>
      </div>
      {task.masterProyekName && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <FolderKanban className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{task.masterProyekName}</span>
        </div>
      )}
    </div>
  );
}

export function TaskCalendarView({ tasks, onTaskClick, viewRange, onDateClick, meetings = [] }: TaskCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const navigate = (dir: 'prev' | 'next') => {
    const fn = dir === 'prev'
      ? { day: subDays, week: subWeeks, month: subMonths, year: subYears }
      : { day: addDays, week: addWeeks, month: addMonths, year: addYears };
    setCurrentDate(fn[viewRange](currentDate, 1));
  };

  const headerLabel = useMemo(() => {
    switch (viewRange) {
      case 'day':
        return format(currentDate, 'EEEE, d MMMM yyyy', { locale: localeId });
      case 'week': {
        const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
        const we = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(ws, 'd MMM', { locale: localeId })} – ${format(we, 'd MMM yyyy', { locale: localeId })}`;
      }
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: localeId });
      case 'year':
        return format(currentDate, 'yyyy');
      default:
        return '';
    }
  }, [currentDate, viewRange]);

  const calendarDays = useMemo(() => {
    if (viewRange === 'day') return [currentDate];
    if (viewRange === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: ws, end: we });
    }
    if (viewRange === 'month') {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      const ws = startOfWeek(ms, { weekStartsOn: 1 });
      const we = endOfWeek(me, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: ws, end: we });
    }
    return [];
  }, [currentDate, viewRange]);

  const weeks = useMemo(() => {
    const w: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      w.push(calendarDays.slice(i, i + 7));
    }
    return w;
  }, [calendarDays]);

  // Map tasks by start_date for day view
  const tasksByDay = useMemo(() => {
    const map: Record<string, TaskCalendarItem[]> = {};
    tasks.forEach(t => {
      const key = t.startDate;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // Year view helpers
  const months = useMemo(() => {
    if (viewRange !== 'year') return [];
    return Array.from({ length: 12 }, (_, m) => new Date(currentDate.getFullYear(), m, 1));
  }, [currentDate, viewRange]);

  const tasksByMonth = useMemo(() => {
    if (viewRange !== 'year') return {};
    const map: Record<number, TaskCalendarItem[]> = {};
    tasks.forEach(t => {
      const d = new Date(t.startDate);
      if (d.getFullYear() === currentDate.getFullYear()) {
        const m = d.getMonth();
        if (!map[m]) map[m] = [];
        map[m].push(t);
      }
    });
    return map;
  }, [tasks, currentDate, viewRange]);

  // Meeting count by date
  const meetingCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    meetings.forEach(m => {
      map[m.meeting_date] = (map[m.meeting_date] || 0) + 1;
    });
    return map;
  }, [meetings]);

  const NavHeader = () => (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold capitalize">{headerLabel}</h2>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Hari Ini
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('next')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Day view
  if (viewRange === 'day') {
    const dayKey = format(currentDate, 'yyyy-MM-dd');
    const dayTasks = tasksByDay[dayKey] || [];
    return (
      <div className="space-y-4">
        <NavHeader />
        <div className="border rounded-lg p-4 min-h-[300px] space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onDateClick?.(currentDate)}>
              <Plus className="h-3.5 w-3.5" />
              Add Meeting
            </Button>
          </div>
          {dayTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tidak ada task pada hari ini</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dayTasks.map((t, i) => <TaskCard key={i} task={t} onTaskClick={onTaskClick} />)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Year view
  if (viewRange === 'year') {
    return (
      <div className="space-y-4">
        <NavHeader />
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          {months.map((m, idx) => {
            const monthTasks = tasksByMonth[idx] || [];
            return (
              <div key={idx} className="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow" onDoubleClick={() => onDateClick?.(m)}>
                <h3 className="text-sm font-semibold mb-2">{format(m, 'MMMM', { locale: localeId })}</h3>
                {monthTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Tidak ada task</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {monthTasks.slice(0, 5).map((t, i) => <TaskCard key={i} task={t} onTaskClick={onTaskClick} />)}
                    {monthTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">+{monthTasks.length - 5} lainnya</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Week & Month view — spanning task bars
  return (
    <div className="space-y-4">
      <NavHeader />
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        {/* Weeks */}
        {weeks.map((week, wi) => {
          const segments = getTaskSegmentsForWeek(tasks, week);
          // Layout: stack segments into rows to avoid overlaps
          const rows: TaskSegment[][] = [];
          segments.forEach(seg => {
            let placed = false;
            for (const row of rows) {
              const overlap = row.some(
                r => !(seg.colStart >= r.colStart + r.colSpan || seg.colStart + seg.colSpan <= r.colStart)
              );
              if (!overlap) { row.push(seg); placed = true; break; }
            }
            if (!placed) rows.push([seg]);
          });

          return (
            <div key={wi} className="border-b last:border-b-0">
              {/* Day numbers row */}
              <div className="grid grid-cols-7">
                {week.map((day, di) => {
                  const isCurrentMonth = viewRange === 'month' ? isSameMonth(day, currentDate) : true;
                  return (
                    <div
                      key={di}
                      className={cn(
                        'border-r last:border-r-0 px-1.5 pt-1 pb-0.5',
                        !isCurrentMonth && 'bg-muted/50',
                        isToday(day) && 'bg-primary/5',
                        (viewRange === 'week' || viewRange === 'month') && 'cursor-pointer hover:bg-muted/30 transition-colors',
                      )}
                      onDoubleClick={(viewRange === 'week' || viewRange === 'month') ? () => onDateClick?.(day) : undefined}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
                          isToday(day) && 'bg-primary text-primary-foreground font-bold',
                          !isCurrentMonth && 'text-muted-foreground/50'
                        )}>
                          {format(day, 'd')}
                        </span>
                        {(() => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const count = meetingCountByDate[dateKey];
                          if (!count) return null;
                          return (
                            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white">
                              {count}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Task bar rows */}
              <div className={cn('px-0.5 pb-1 space-y-0.5', rows.length === 0 && 'min-h-[40px]')}>
                {rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-px">
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let col = 0;
                      // Sort row by colStart
                      const sorted = [...row].sort((a, b) => a.colStart - b.colStart);
                      sorted.forEach((seg, si) => {
                        // Fill empty space before this segment
                        if (seg.colStart > col) {
                          cells.push(
                            <div key={`empty-${si}`} style={{ gridColumn: `span ${seg.colStart - col}` }} />
                          );
                        }
                        cells.push(
                          <div key={seg.task.id + '-' + wi} style={{ gridColumn: `span ${seg.colSpan}` }}>
                            <SpanningTaskBar segment={seg} onTaskClick={onTaskClick} />
                          </div>
                        );
                        col = seg.colStart + seg.colSpan;
                      });
                      return cells;
                    })()}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
