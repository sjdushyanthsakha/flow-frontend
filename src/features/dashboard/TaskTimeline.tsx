import { useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../lib/icons';
import { dateKey, dateLabel, initials, isDone, type Member, type Project, type Task } from './data';
import { projectPath } from './projectRoutes';

const statuses = [
  { label: 'To do', tone: 'todo' },
  { label: 'In progress', tone: 'progress' },
  { label: 'In review', tone: 'review' },
  { label: 'Blocked', tone: 'blocked' },
  { label: 'Completed', tone: 'completed' },
];
const zoomLevels = [
  { label: 'Months', width: 28, days: 56, step: 28, lead: 14 },
  { label: 'Weeks', width: 44, days: 42, step: 14, lead: 7 },
  { label: 'Days', width: 72, days: 28, step: 7, lead: 0 },
];
const groupingOptions = ['Status', 'Owner', 'Project'] as const;
type Grouping = typeof groupingOptions[number];

const dayMs = 86400000;
const dayNumber = (value: string) => Date.parse(value + 'T00:00:00Z') / dayMs;
const dayKey = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);
const monthFormat = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });
const toneFor = (task: Task) => isDone(task) ? 'completed' :
  statuses.find(({ label }) => label.toLowerCase() === task.status.toLowerCase())?.tone ?? 'todo';

type Props = {
  projects: Project[];
  project?: Project;
  tasks: Task[];
  members: Member[];
  timezone: string;
  workspaceSearch: string;
  onOpenTask: (task: Task) => void;
  onEditProject: (project: Project) => void;
};

function groupTasks(tasks: Task[], grouping: Grouping) {
  const groups = new Map<string, { label: string; tasks: Task[] }>();
  if (grouping === 'Status') {
    statuses.forEach(({ label }) => groups.set(label.toLowerCase(), { label, tasks: [] }));
  }
  for (const task of tasks) {
    const status = isDone(task) ? 'Completed' : task.status;
    const label = grouping === 'Status' ? status : grouping === 'Owner' ? task.assignee ?? 'Unassigned' : task.project;
    const key = grouping === 'Status' ? status.toLowerCase() :
      grouping === 'Owner' ? task.assigneeId ?? 'unassigned' : task.projectId;
    const group = groups.get(key);
    if (group) group.tasks.push(task);
    else groups.set(key, { label, tasks: [task] });
  }
  const populated = [...groups.entries()].filter(([, group]) => group.tasks.length > 0);
  return grouping === 'Status' ? populated : populated.sort(([, a], [, b]) => a.label.localeCompare(b.label));
}

function TaskSchedule({ task, firstDay, lastDay, timezone }: {
  task: Task; firstDay: number; lastDay: number; timezone: string;
}) {
  const end = task.dueDate ?? task.startDate;
  if (!end) return <span className="timeline-unscheduled">Unscheduled</span>;
  const start = task.startDate ?? (task.createdAt ? dateKey(new Date(task.createdAt), timezone) : end);
  const from = Math.min(dayNumber(start), dayNumber(end));
  const to = dayNumber(end);
  const visibleStart = Math.max(firstDay, from);
  const visibleEnd = Math.min(lastDay, to);
  if (visibleStart > visibleEnd) return null;
  const schedule = from === to ? dateLabel(end) : `${dateLabel(dayKey(from))} – ${dateLabel(end)}`;
  const style = {
    '--bar-start': visibleStart - firstDay,
    '--bar-days': visibleEnd - visibleStart + 1,
  } as CSSProperties;
  return <button type="button" className={`timeline-bar timeline-tone--${toneFor(task)}`} style={style}
    aria-label={`${task.title}, ${task.status}, ${schedule}`} aria-haspopup="dialog"
    title={`${task.title} · ${schedule}`}>{task.title}</button>;
}

export default function TaskTimeline({ projects, project, tasks, members, timezone, workspaceSearch, onOpenTask, onEditProject }: Props) {
  const [search, setSearch] = useState('');
  const [grouping, setGrouping] = useState<Grouping>('Status');
  const [zoom, setZoom] = useState(0);
  const [offset, setOffset] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const level = zoomLevels[zoom];
  const today = dayNumber(dateKey(new Date(), timezone));
  const weekday = new Date(today * dayMs).getUTCDay();
  const firstDay = today - (weekday + 6) % 7 - level.lead + offset;
  const lastDay = firstDay + level.days - 1;
  const days = Array.from({ length: level.days }, (_, index) => dayKey(firstDay + index));
  const months: { label: string; length: number }[] = [];
  for (const day of days) {
    const label = monthFormat.format(new Date(day));
    const previous = months.at(-1);
    if (previous?.label === label) previous.length += 1;
    else months.push({ label, length: 1 });
  }

  const query = search.trim().toLowerCase();
  const groups = groupTasks(tasks.filter((task) => {
    const text = `${task.title} ${task.description ?? ''} ${task.id} ${task.project} ${task.status} ${task.assignee ?? ''}`.toLowerCase();
    return text.includes(query) && text.includes(workspaceSearch);
  }), grouping);
  const milestones = new Map<string, Project[]>();
  for (const item of projects) {
    if (!item.dueDate || !days.includes(item.dueDate)) continue;
    const due = milestones.get(item.dueDate) ?? [];
    due.push(item);
    milestones.set(item.dueDate, due);
  }
  const owners = new Map(members.map(({ id }, index) => [id, index]));
  const todayIndex = today - firstDay;

  function moveRange(daysToMove: number) {
    setOffset((current) => current + daysToMove);
    if (viewport.current) viewport.current.scrollLeft = 0;
  }

  function goToToday() {
    setOffset(0);
    const scroller = viewport.current;
    const grid = calendar.current;
    if (!scroller || !grid) return;
    const pinnedWidth = grid.querySelector('.timeline-column-headings')?.getBoundingClientRect().width ?? 0;
    const marker = ((weekday + 6) % 7 + level.lead + 0.5) * level.width;
    const railWidth = scroller.clientWidth - pinnedWidth;
    scroller.scrollLeft = marker + 35 > railWidth ? Math.max(0, marker - railWidth / 2) : 0;
  }

  return <>
    <header className="timeline-heading">
      <div>
        {project ? <a className="eyebrow" href={projectPath(project.id)} title={project.name}>
          {project.name.trim().split(/\s+/)[0]} / Planning
        </a> : <span className="eyebrow">Workspace / Planning</span>}
        <h1>Project timeline</h1>
        <p>See delivery windows, milestones, and schedule risk.</p>
      </div>
      <button className="button button--primary timeline-today-button" type="button" onClick={goToToday}>
        <Icon name="calendar" />Today
      </button>
    </header>

    <div className="timeline-toolbar">
      <label className="timeline-search">
        <Icon name="search" />
        <input type="search" aria-label="Find a task" placeholder="Find a task…" value={search}
          onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="timeline-controls">
        <label className="timeline-control timeline-group-control">
          <span>Group by</span>
          <select value={grouping} onChange={(event) => setGrouping(event.target.value as Grouping)}>
            {groupingOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <div className="timeline-control" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)}>
            <Icon name="zoom-out" />
          </button>
          <span className="timeline-zoom-label" aria-live="polite">{level.label}</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom === zoomLevels.length - 1} onClick={() => setZoom(zoom + 1)}>
            <Icon name="zoom-in" />
          </button>
        </div>
        <div className="timeline-control timeline-range-controls" role="group" aria-label="Date range">
          <button type="button" aria-label="Previous date range" title="Previous date range" onClick={() => moveRange(-level.step)}>
            <Icon name="chevron" />
          </button>
          <button type="button" aria-label="Next date range" title="Next date range" onClick={() => moveRange(level.step)}>
            <Icon name="chevron" />
          </button>
        </div>
      </div>
    </div>

    <div className="timeline-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Scrollable timeline calendar">
      <div className="timeline-grid" ref={calendar} role="table" aria-label={project ? `${project.name} timeline` : 'Workspace timeline'}
        style={{ '--day-width': `${level.width}px`, '--day-count': days.length } as CSSProperties}>
        <div className="timeline-row timeline-header" role="row">
          <div className="timeline-pinned timeline-column-headings" role="presentation">
            <span role="columnheader">Task</span><span role="columnheader">Owner</span>
          </div>
          <div className="timeline-calendar-heading" role="columnheader" aria-label={`Schedule, ${days[0]} to ${days.at(-1)}`}>
            <div className="timeline-months">
              {months.map(({ label, length }) => <span key={label} style={{ width: `calc(var(--day-width) * ${length})` }}>{label}</span>)}
            </div>
            <div className="timeline-days">
              {days.map((key) => {
                const date = new Date(key);
                const weekdayLabel = weekdayFormat.format(date);
                return <div key={key} className="timeline-day">
                  <time dateTime={key} aria-current={key === dayKey(today) ? 'date' : undefined} aria-label={`${weekdayLabel}, ${dateLabel(key)}`}>
                    <strong>{date.getUTCDate()}</strong><span aria-hidden="true">{weekdayLabel.slice(0, 1)}</span>
                  </time>
                  {milestones.get(key)?.map((item) => <button key={item.id} className="timeline-milestone"
                    type="button" title={`${item.name} due ${dateLabel(key)}`}
                    aria-label={`${item.name} milestone, ${dateLabel(key)}`} aria-haspopup="dialog"
                    onClick={() => onEditProject(item)} />)}
                </div>;
              })}
            </div>
          </div>
        </div>
        {groups.map(([key, group]) => (
          <div role="rowgroup" key={key}>
            <div className="timeline-row timeline-group" role="row">
              <div className="timeline-pinned timeline-group-label" role="rowheader" aria-colspan={2}>
                {group.label}<span>{group.tasks.length}</span>
              </div>
              <div role="cell" />
            </div>
            {group.tasks.map((task) => {
              const ownerIndex = task.assigneeId ? owners.get(task.assigneeId) ?? 0 : 0;
              const owner = task.assignee ?? 'Unassigned';
              return <div className="timeline-row timeline-task-row" key={task.id} role="row" onClick={() => onOpenTask(task)}>
                <div className="timeline-pinned timeline-task-details" role="presentation">
                  <div className="timeline-task-name" role="rowheader">
                    <button type="button" title={task.title} aria-haspopup="dialog">
                      <strong>{task.title}</strong>
                      <span>{task.id.slice(0, 8).toUpperCase()}{!project && ` · ${task.project}`}</span>
                    </button>
                  </div>
                  <div className="timeline-owner" role="cell" title={owner} aria-label={owner}>
                    {task.assignee ? <span className={`timeline-owner-avatar timeline-owner-avatar--${ownerIndex % 5}`}>{initials(owner)}</span> : '—'}
                  </div>
                </div>
                <div className="timeline-track" role="cell">
                  <TaskSchedule task={task} firstDay={firstDay} lastDay={lastDay} timezone={timezone} />
                </div>
              </div>;
            })}
          </div>
        ))}
        {!groups.length && <div className="timeline-row timeline-empty" role="row">
          <div className="timeline-pinned" role="cell" aria-colspan={2}>
            {query || workspaceSearch ? 'No tasks match your search.' : 'No tasks to show.'}
          </div>
          <div className="timeline-track" role="cell" />
        </div>}
        {todayIndex >= 0 && todayIndex < days.length && (
          <div className="timeline-today-marker" style={{ '--today-index': todayIndex + 0.5 } as CSSProperties} aria-hidden="true">
            <span>Today</span>
          </div>
        )}
      </div>
    </div>
    <ul className="timeline-legend" aria-label="Task status colors">
      {statuses.map(({ label, tone }) => <li key={tone} className={`timeline-tone--${tone}`}><span />{label}</li>)}
    </ul>
  </>;
}
