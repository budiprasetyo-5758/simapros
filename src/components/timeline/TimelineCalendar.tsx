import { useMemo, useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay,
  eachDayOfInterval, isSameMonth, isToday, isBefore, isAfter,
  differenceInDays, addMonths, subMonths, addWeeks, subWeeks,
  addDays, subDays, addYears, subYears, startOfYear, endOfYear,
  eachMonthOfInterval, isSameDay,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, FolderKanban, Clock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ColorMode = 'master_proyek' | 'status_pdca' | 'urgency';
export type ViewRange = 'day' | 'week' | 'month' | 'year';

interface TimelineProject {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  project_stage: string;
  priority: string;
  master_proyek_id?: string | null;
  master_proyek_name?: string;
  color: string;
}

interface MeetingItem {
  id: string;
  meeting_date: string;
  title: string;
}

interface TimelineCalendarProps {
  projects: TimelineProject[];
  onProjectClick: (projectId: string) => void;
  viewRange: ViewRange;
  onDateClick?: (date: Date) => void;
  meetings?: MeetingItem[];
}

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning',
  execution: 'Execution',
  evaluation: 'Evaluation',
  followup: 'Follow-up',
};

const STAGE_DOT_COLORS: Record<string, string> = {
  planning: 'bg-blue-500',
  execution: 'bg-green-500',
  evaluation: 'bg-yellow-500',
  followup: 'bg-purple-500',
  meeting: 'bg-rose-600',
};

// Rich project bar component
function SpanningProjectBar({
  project,
  span,
  isStart,
  isEnd,
  onProjectClick,
}: {
  project: TimelineProject;
  span: number;
  isStart: boolean;
  isEnd: boolean;
  onProjectClick: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'px-2 py-1 border text-[11px] leading-tight cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
        isStart && 'rounded-l-md',
        isEnd && 'rounded-r-md',
        !isStart && 'border-l-0',
        !isEnd && 'border-r-0',
      )}
      style={{
        backgroundColor: `${project.color}18`,
        borderColor: `${project.color}66`,
      }}
      onClick={() => onProjectClick(project.id)}
      title={`${project.title} — ${project.master_proyek_name || ''}`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
        <span className="font-semibold truncate text-card-foreground">{project.title}</span>
        {project.project_stage === 'meeting' && project.master_proyek_name && (
          <span className="flex items-center gap-0.5 text-muted-foreground flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            <span className="text-[10px]">{project.master_proyek_name}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STAGE_DOT_COLORS[project.project_stage] || 'bg-muted-foreground')} />
        <span className="truncate">{STAGE_LABELS[project.project_stage] || project.project_stage}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
        <Calendar className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">
          {format(new Date(project.start_date), 'd MMM', { locale: localeId })} → {format(new Date(project.end_date), 'd MMM', { locale: localeId })}
        </span>
      </div>
      {project.master_proyek_name && (
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <FolderKanban className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{project.master_proyek_name}</span>
        </div>
      )}
    </div>
  );
}

// Project card for day/year views
function ProjectCard({ project, onProjectClick }: { project: TimelineProject; onProjectClick: (id: string) => void }) {
  return (
    <div
      className="p-2 rounded-md border bg-card hover:shadow-md transition-shadow cursor-pointer text-xs space-y-1.5"
      style={{ borderLeftWidth: '3px', borderLeftColor: project.color }}
      onClick={() => onProjectClick(project.id)}
    >
      <p className="font-semibold text-card-foreground line-clamp-2 leading-tight">{project.title}</p>
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', STAGE_DOT_COLORS[project.project_stage] || 'bg-muted-foreground')} />
        <span className="text-muted-foreground">{STAGE_LABELS[project.project_stage] || project.project_stage}</span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        <Calendar className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">
          {format(new Date(project.start_date), 'd MMM', { locale: localeId })} → {format(new Date(project.end_date), 'd MMM yy', { locale: localeId })}
        </span>
      </div>
      {project.master_proyek_name && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <FolderKanban className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{project.master_proyek_name}</span>
        </div>
      )}
    </div>
  );
}

export function TimelineCalendar({ projects, onProjectClick, viewRange, onDateClick, meetings = [] }: TimelineCalendarProps) {
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
        return `${format(ws, 'd MMM', { locale: localeId })} - ${format(we, 'd MMM yyyy', { locale: localeId })}`;
      }
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: localeId });
      case 'year':
        return format(currentDate, 'yyyy');
    }
  }, [currentDate, viewRange]);

  // Render based on view range
  if (viewRange === 'day') return <DayView currentDate={currentDate} projects={projects} onProjectClick={onProjectClick} headerLabel={headerLabel} onNavigate={navigate} onDateClick={onDateClick} meetings={meetings} />;
  if (viewRange === 'week') return <WeekView currentDate={currentDate} projects={projects} onProjectClick={onProjectClick} headerLabel={headerLabel} onNavigate={navigate} onDateClick={onDateClick} meetings={meetings} />;
  if (viewRange === 'year') return <YearView currentDate={currentDate} projects={projects} onProjectClick={onProjectClick} headerLabel={headerLabel} onNavigate={navigate} onDateClick={onDateClick} meetings={meetings} />;
  return <MonthView currentDate={currentDate} projects={projects} onProjectClick={onProjectClick} headerLabel={headerLabel} onNavigate={navigate} onDateClick={onDateClick} meetings={meetings} />;
}

// Shared nav header
function NavHeader({ headerLabel, onNavigate }: { headerLabel: string; onNavigate: (d: 'prev' | 'next') => void }) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="outline" size="icon" onClick={() => onNavigate('prev')}><ChevronLeft className="h-4 w-4" /></Button>
      <h2 className="text-2xl font-bold tracking-wide opacity-80">{headerLabel}</h2>
      <Button variant="outline" size="icon" onClick={() => onNavigate('next')}><ChevronRight className="h-4 w-4" /></Button>
    </div>
  );
}

interface ViewProps {
  currentDate: Date;
  projects: TimelineProject[];
  onProjectClick: (id: string) => void;
  headerLabel: string;
  onNavigate: (d: 'prev' | 'next') => void;
  onDateClick?: (date: Date) => void;
  meetings?: MeetingItem[];
}

// Segment type for week-based spanning
interface ProjectSegment {
  project: TimelineProject;
  colStart: number;
  colSpan: number;
  isStart: boolean;
  isEnd: boolean;
}

function getProjectSegmentsForWeek(projects: TimelineProject[], weekDays: Date[]): ProjectSegment[] {
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const segments: ProjectSegment[] = [];

  projects.forEach(project => {
    const pEnd = startOfDay(new Date(project.end_date));

    // Only show on the end_date
    if (isBefore(pEnd, weekStart) || isAfter(pEnd, weekEnd)) return;

    const colStart = differenceInDays(pEnd, weekStart);

    segments.push({
      project,
      colStart,
      colSpan: 1,
      isStart: true,
      isEnd: true,
    });
  });

  return segments;
}

function layoutSegmentRows(segments: ProjectSegment[]): ProjectSegment[][] {
  const rows: ProjectSegment[][] = [];
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
  return rows;
}

// ===== DAY VIEW =====
function DayView({ currentDate, projects, onProjectClick, headerLabel, onNavigate, onDateClick }: ViewProps) {
  const dayProjects = useMemo(() => {
    const d = startOfDay(currentDate);
    return projects.filter(p => {
      const s = startOfDay(new Date(p.start_date));
      const e = startOfDay(new Date(p.end_date));
      return !isAfter(s, d) && !isBefore(e, d);
    });
  }, [projects, currentDate]);

  return (
    <div className="space-y-4">
      <NavHeader headerLabel={headerLabel} onNavigate={onNavigate} />
      <div className="border border-border rounded-lg p-4 space-y-3 min-h-[200px]">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onDateClick?.(currentDate)}>
            <Plus className="h-3.5 w-3.5" />
            Add Meeting
          </Button>
        </div>
        {dayProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Tidak ada project pada hari ini</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dayProjects.map(p => (
            <ProjectCard key={p.id} project={p} onProjectClick={onProjectClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== WEEK VIEW =====
function WeekView({ currentDate, projects, onProjectClick, headerLabel, onNavigate, onDateClick }: ViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const segments = useMemo(() => getProjectSegmentsForWeek(projects, days), [projects, days]);
  const rows = useMemo(() => layoutSegmentRows(segments), [segments]);

  return (
    <div className="space-y-4">
      <NavHeader headerLabel={headerLabel} onNavigate={onNavigate} />
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted">
          {days.map((day, i) => (
            <div
              key={i}
              className="text-center py-2 border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
              onDoubleClick={() => onDateClick?.(day)}
            >
              <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS[i]}</div>
              <div className={cn('text-sm mt-0.5', isToday(day) && 'font-bold text-primary')}>{format(day, 'd')}</div>
            </div>
          ))}
        </div>
        {/* Day columns bg */}
        <div className="border-b last:border-b-0">
          <div className="grid grid-cols-7">
            {days.map((day, i) => (
              <div key={i} className={cn('border-r last:border-r-0 px-1.5 pt-1 pb-0.5', isToday(day) && 'bg-primary/5')}>
                {/* spacer for date numbers area — not needed in week since we have headers */}
              </div>
            ))}
          </div>
          <div className={cn('px-0.5 pb-1 space-y-0.5', rows.length === 0 && 'min-h-[60px]')}>
            {rows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-px">
                {(() => {
                  const cells: React.ReactNode[] = [];
                  let col = 0;
                  const sorted = [...row].sort((a, b) => a.colStart - b.colStart);
                  sorted.forEach((seg, si) => {
                    if (seg.colStart > col) {
                      cells.push(<div key={`empty-${si}`} style={{ gridColumn: `span ${seg.colStart - col}` }} />);
                    }
                    cells.push(
                      <div key={seg.project.id} style={{ gridColumn: `span ${seg.colSpan}` }}>
                        <SpanningProjectBar
                          project={seg.project}
                          span={seg.colSpan}
                          isStart={seg.isStart}
                          isEnd={seg.isEnd}
                          onProjectClick={onProjectClick}
                        />
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
      </div>
    </div>
  );
}

// ===== MONTH VIEW =====
function MonthView({ currentDate, projects, onProjectClick, headerLabel, onNavigate, onDateClick, meetings = [] }: ViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const calendarDays = useMemo(() => {
    const ms = monthStart;
    const me = monthEnd;
    const ws = startOfWeek(ms, { weekStartsOn: 1 });
    const we = endOfWeek(me, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [monthStart, monthEnd]);

  const weeks = useMemo(() => {
    const w: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) w.push(calendarDays.slice(i, i + 7));
    return w;
  }, [calendarDays]);

  // Meeting count by date
  const meetingCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    meetings.forEach(m => {
      map[m.meeting_date] = (map[m.meeting_date] || 0) + 1;
    });
    return map;
  }, [meetings]);

  return (
    <div className="space-y-4">
      <NavHeader headerLabel={headerLabel} onNavigate={onNavigate} />
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2 border-b border-border">{day}</div>
          ))}
        </div>
        {weeks.map((week, wi) => {
          const segments = getProjectSegmentsForWeek(projects, week);
          const rows = layoutSegmentRows(segments);

          return (
            <div key={wi} className="border-b last:border-b-0">
              {/* Day numbers */}
              <div className="grid grid-cols-7">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={cn(
                      'border-r last:border-r-0 px-1.5 pt-1 pb-0.5 cursor-pointer hover:bg-muted/30 transition-colors',
                      !isSameMonth(day, currentDate) && 'bg-muted/50',
                      isToday(day) && 'bg-primary/5',
                    )}
                    onDoubleClick={() => onDateClick?.(day)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs',
                        isToday(day) && 'bg-primary text-primary-foreground font-bold',
                        !isSameMonth(day, currentDate) && 'text-muted-foreground/50',
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
                ))}
              </div>
              {/* Project bar rows */}
              <div className={cn('px-0.5 pb-1 space-y-0.5', rows.length === 0 && 'min-h-[40px]')}>
                {rows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-7 gap-px">
                    {(() => {
                      const cells: React.ReactNode[] = [];
                      let col = 0;
                      const sorted = [...row].sort((a, b) => a.colStart - b.colStart);
                      sorted.forEach((seg, si) => {
                        if (seg.colStart > col) {
                          cells.push(<div key={`empty-${si}`} style={{ gridColumn: `span ${seg.colStart - col}` }} />);
                        }
                        cells.push(
                          <div key={seg.project.id + '-' + wi} style={{ gridColumn: `span ${seg.colSpan}` }}>
                            <SpanningProjectBar
                              project={seg.project}
                              span={seg.colSpan}
                              isStart={seg.isStart}
                              isEnd={seg.isEnd}
                              onProjectClick={onProjectClick}
                            />
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

// ===== YEAR VIEW =====
function YearView({ currentDate, projects, onProjectClick, headerLabel, onNavigate, onDateClick }: ViewProps) {
  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      const s = startOfDay(new Date(p.start_date));
      const e = startOfDay(new Date(p.end_date));
      return !isAfter(s, yearEnd) && !isBefore(e, yearStart);
    });
  }, [projects, yearStart, yearEnd]);

  // Group by month for card display
  const projectsByMonth = useMemo(() => {
    const map: Record<number, TimelineProject[]> = {};
    visibleProjects.forEach(p => {
      const s = new Date(p.start_date);
      if (s.getFullYear() === currentDate.getFullYear()) {
        const m = s.getMonth();
        if (!map[m]) map[m] = [];
        map[m].push(p);
      }
    });
    return map;
  }, [visibleProjects, currentDate]);

  return (
    <div className="space-y-4">
      <NavHeader headerLabel={headerLabel} onNavigate={onNavigate} />
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {months.map((m, idx) => {
          const monthProjects = projectsByMonth[idx] || [];
          return (
            <div key={idx} className="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow" onDoubleClick={() => onDateClick?.(m)}>
              <h3 className="text-sm font-semibold mb-2">{format(m, 'MMMM', { locale: localeId })}</h3>
              {monthProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Tidak ada project</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {monthProjects.slice(0, 5).map(p => (
                    <ProjectCard key={p.id} project={p} onProjectClick={onProjectClick} />
                  ))}
                  {monthProjects.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center">+{monthProjects.length - 5} lainnya</p>
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
